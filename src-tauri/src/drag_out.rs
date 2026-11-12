//! Dragging a note out of the list as a file (src/lib/notes/dragOut.ts): to Finder, the desktop,
//! Mail or any app that takes files, which gets a copy. The page can't hand macOS a file to drag, so
//! the note is written to a folder of its own in the temporary folder, and AppKit drags that.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{Emitter, Webview};

/// Told to the page once the drag's over, wherever it was let go (back in the window too), or as it
/// doesn't begin: till then the note's still being dragged.
const ENDED: &str = "note-drag-ended";

/// Starts dragging the note, as a file called `name` holding `text`, from where the pointer is.
/// Called as the page's drag leaves the window, while the button is still down.
#[tauri::command]
pub fn drag_note_out(webview: Webview, name: String, text: String) -> Result<(), String> {
  let path = write_copy(&std::env::temp_dir().join("lines-drag"), &name, text.as_bytes()).map_err(|e| e.to_string())?;
  let page = webview.clone();
  let ended = move || {
    let _ = page.emit(ENDED, ());
  };
  #[cfg(target_os = "macos")]
  webview
    .with_webview(move |platform| unsafe { macos::drag_file(platform.inner().cast(), &path, Box::new(ended)) })
    .map_err(|e| e.to_string())?;
  #[cfg(not(target_os = "macos"))]
  {
    let _ = path;
    ended();
  }
  Ok(())
}

/// Writes the file in a folder of its own (each drag's, so two notes with one title don't meet),
/// clearing out earlier drags' first. Only a plain file name is taken: no folders, nothing hidden.
fn write_copy(root: &Path, name: &str, bytes: &[u8]) -> std::io::Result<PathBuf> {
  let plain = Path::new(name).file_name().is_some_and(|file| file == name) && !name.starts_with('.');
  if !plain {
    return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "not a file name"));
  }
  let _ = std::fs::remove_dir_all(root);
  let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|time| time.as_nanos()).unwrap_or_default();
  let dir = root.join(stamp.to_string());
  std::fs::create_dir_all(&dir)?;
  let path = dir.join(name);
  std::fs::write(&path, bytes)?;
  Ok(path)
}

#[cfg(target_os = "macos")]
mod macos {
  use std::path::Path;

  use objc2::rc::Retained;
  use objc2::runtime::{AnyObject, NSObjectProtocol, ProtocolObject};
  use objc2::{define_class, msg_send, AllocAnyThread, MainThreadMarker, MainThreadOnly};
  use objc2_app_kit::{
    NSDragOperation, NSDraggingContext, NSDraggingItem, NSDraggingSession, NSDraggingSource, NSEvent, NSEventModifierFlags, NSEventType, NSView,
    NSWorkspace,
  };
  use std::cell::{OnceCell, RefCell};
  use objc2_foundation::{NSArray, NSObject, NSPoint, NSProcessInfo, NSRect, NSSize, NSString, NSURL};

  define_class!(
    /// What macOS asks about the drag, and tells of it: it's a copy, wherever it's dropped, and it's
    /// over.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "LinesNoteDragSource"]
    struct DragSource;

    unsafe impl NSObjectProtocol for DragSource {}

    unsafe impl NSDraggingSource for DragSource {
      #[unsafe(method(draggingSession:sourceOperationMaskForDraggingContext:))]
      fn operation_mask(&self, _session: &NSDraggingSession, _context: NSDraggingContext) -> NSDragOperation {
        NSDragOperation::Copy
      }

      #[unsafe(method(draggingSession:endedAtPoint:operation:))]
      fn ended(&self, _session: &NSDraggingSession, _at: NSPoint, _operation: NSDragOperation) {
        if let Some(ended) = ON_END.take() {
          ended();
        }
      }
    }
  );

  impl DragSource {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
      unsafe { msg_send![Self::alloc(mtm), init] }
    }
  }

  thread_local! {
    /// One for every drag, kept for good: a drag session doesn't keep its source alive.
    static SOURCE: OnceCell<Retained<DragSource>> = const { OnceCell::new() };
    /// What's told when the drag under way ends.
    static ON_END: RefCell<Option<Box<dyn FnOnce()>>> = const { RefCell::new(None) };
  }

  /// Drags the file from the web view, under the pointer, with its icon as Finder shows it, and
  /// calls `ended` once it's let go; not if the button's been let go since (`ended` is called now).
  pub unsafe fn drag_file(view: *mut AnyObject, path: &Path, ended: Box<dyn FnOnce()>) {
    if !unsafe { begin(view, path) } {
      return ended();
    }
    if let Some(earlier) = ON_END.replace(Some(ended)) {
      earlier();
    }
  }

  /// Begins the drag, if it can: whether it did.
  unsafe fn begin(view: *mut AnyObject, path: &Path) -> bool {
    let Some(mtm) = MainThreadMarker::new() else { return false };
    let Some(view) = (unsafe { view.cast::<NSView>().as_ref() }) else { return false };
    let Some(window) = view.window() else { return false };
    if NSEvent::pressedMouseButtons() & 1 == 0 {
      return false;
    }
    // The page's call reaches here a moment later, when the event AppKit is handling isn't the mouse's
    // (the event loop's own, waking it): a drag begun from that shows, but nothing takes its drop. So
    // it's begun from a drag of the mouse, made where the pointer is now, as Electron does.
    let location = window.mouseLocationOutsideOfEventStream();
    let Some(event) = NSEvent::mouseEventWithType_location_modifierFlags_timestamp_windowNumber_context_eventNumber_clickCount_pressure(
      NSEventType::LeftMouseDragged,
      location,
      NSEventModifierFlags::empty(),
      NSProcessInfo::processInfo().systemUptime(),
      window.windowNumber(),
      None,
      0,
      1,
      1.0,
    ) else {
      return false;
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    let item = NSDraggingItem::initWithPasteboardWriter(NSDraggingItem::alloc(), ProtocolObject::from_ref(&*url));
    let icon = NSWorkspace::sharedWorkspace().iconForFile(&NSString::from_str(&path.to_string_lossy()));
    let size = 48.0;
    let at = view.convertPoint_fromView(location, None);
    let frame = NSRect::new(NSPoint::new(at.x - size / 2.0, at.y - size / 2.0), NSSize::new(size, size));
    unsafe { item.setDraggingFrame_contents(frame, Some(&icon)) };
    SOURCE.with(|source| {
      let source = source.get_or_init(|| DragSource::new(mtm));
      view.beginDraggingSessionWithItems_event_source(&NSArray::from_retained_slice(&[item]), &event, ProtocolObject::from_ref(&**source));
    });
    true
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn only_a_plain_file_name() {
    let root = std::env::temp_dir().join(format!("lines-drag-test-{}", std::process::id()));
    let path = write_copy(&root, "Trip - Rome.md", b"# Trip").unwrap();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), "# Trip");
    assert_eq!(path.file_name().unwrap(), "Trip - Rome.md");
    assert!(write_copy(&root, "../escape.md", b"").is_err());
    assert!(write_copy(&root, "a/b.md", b"").is_err());
    assert!(write_copy(&root, ".hidden", b"").is_err());
    let _ = std::fs::remove_dir_all(root);
  }
}
