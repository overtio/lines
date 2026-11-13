//! Links in notes to folders and files on this computer (src/lib/notes/localLinks.ts): the paths of
//! folders dropped from Finder, which the page isn't told; a folder chosen to link to; and opening
//! what a link leads to.

use std::path::{Component, Path, PathBuf};

use tauri::AppHandle;

/// Runs `job` on the main thread, as AppKit's panels, the drag pasteboard and the font manager want, and waits for it.
#[cfg(target_os = "macos")]
pub(crate) async fn on_main<T: Send + 'static>(app: &AppHandle, job: impl FnOnce() -> T + Send + 'static) -> Option<T> {
  let (send, receive) = std::sync::mpsc::channel();
  app
    .run_on_main_thread(move || {
      let _ = send.send(job());
    })
    .ok()?;
  tauri::async_runtime::spawn_blocking(move || receive.recv().ok()).await.ok().flatten()
}

/// The paths of what was last dragged (macOS's drag pasteboard): asked as something's dropped in a
/// note, whose page sees a folder's name but not where it is.
#[tauri::command]
pub async fn dropped_paths(app: AppHandle) -> Vec<String> {
  #[cfg(target_os = "macos")]
  return on_main(&app, macos::dropped_paths).await.unwrap_or_default();
  #[cfg(not(target_os = "macos"))]
  {
    let _ = app;
    Vec::new()
  }
}

/// A folder to link to, chosen with the system's folder picker; `prompt` and `message` in the app's language.
#[tauri::command]
pub async fn pick_link_folder(app: AppHandle, prompt: String, message: String) -> Option<String> {
  #[cfg(target_os = "macos")]
  return on_main(&app, move || crate::folder_sync::macos::pick_folder(&prompt, &message)).await.flatten();
  #[cfg(not(target_os = "macos"))]
  {
    let _ = (app, prompt, message);
    None
  }
}

/// Opens what a link leads to: a folder in Finder, a file in its app (one that runs something is
/// shown in Finder instead, as attachments are). "missing" if it isn't there.
#[tauri::command]
pub async fn open_local(path: String) -> Result<(), String> {
  let path = local_path(&path)?;
  if !path.exists() {
    return Err("missing".into());
  }
  crate::attachments::open(&path)
}

/// A path a note can link to: absolute, on this computer, without `..`.
fn local_path(path: &str) -> Result<PathBuf, String> {
  let path = PathBuf::from(path);
  if !path.is_absolute() || on_network(&path) || path.components().any(|part| matches!(part, Component::ParentDir)) {
    return Err("Not a path on this computer".into());
  }
  Ok(path)
}

/// A share on another computer (`\\server\share`), which Windows signs in to, sending the
/// person's credentials, only to see whether something's there: a note's link mustn't lead there.
#[cfg(windows)]
fn on_network(path: &Path) -> bool {
  use std::path::Prefix;
  matches!(path.components().next(), Some(Component::Prefix(prefix)) if !matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)))
}

#[cfg(not(windows))]
fn on_network(_path: &Path) -> bool {
  false
}

#[cfg(target_os = "macos")]
mod macos {
  use objc2::{rc::Retained, runtime::AnyClass, ClassType};
  use objc2_app_kit::{NSPasteboard, NSPasteboardNameDrag};
  use objc2_foundation::{NSArray, NSURL};

  /// The file URLs on the drag pasteboard, as paths. Finder's are references (`/.file/id=…`), made paths here.
  pub fn dropped_paths() -> Vec<String> {
    let pasteboard = NSPasteboard::pasteboardWithName(unsafe { NSPasteboardNameDrag });
    let classes: Retained<NSArray<AnyClass>> = NSArray::from_slice(&[NSURL::class()]);
    let Some(objects) = (unsafe { pasteboard.readObjectsForClasses_options(&classes, None) }) else {
      return Vec::new();
    };
    objects
      .iter()
      .filter_map(|object| object.downcast::<NSURL>().ok())
      .filter_map(|url| url.filePathURL().and_then(|url| url.path()))
      .map(|path| path.to_string())
      .collect()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// A whole path where the tests run: Windows' start with a drive.
  #[cfg(windows)]
  const HOME: &str = r"C:\Users\me";
  #[cfg(not(windows))]
  const HOME: &str = "/Users/me";

  #[test]
  fn only_whole_paths() {
    assert!(local_path(&format!("{HOME}/Projects")).is_ok());
    assert!(local_path("Projects").is_err());
    assert!(local_path(&format!("{HOME}/../other")).is_err());
  }

  #[cfg(windows)]
  #[test]
  fn never_a_network_share() {
    assert!(local_path(r"D:\").is_ok());
    assert!(local_path(r"\\server\share\Report.pdf").is_err());
    assert!(local_path("//server/share").is_err());
    assert!(local_path(r"\\?\UNC\server\share").is_err());
  }
}
