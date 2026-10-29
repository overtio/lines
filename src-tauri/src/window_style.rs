//! Native touches for windows in the Mac app: fading the traffic-light buttons on floating
//! notes in and out, and blurring the desktop behind see-through windows.

use tauri::WebviewWindow;

/// Fades the close, minimize and zoom buttons in or out.
#[tauri::command]
pub fn set_window_buttons(window: WebviewWindow, visible: bool) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    // AppKit wants the main thread; the pointer stays valid while the window exists.
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as usize;
    window
      .run_on_main_thread(move || unsafe { macos::set_buttons(ns_window, visible) })
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(target_os = "macos"))]
  let _ = (window, visible);
  Ok(())
}

/// Lets a floating note follow you like a Picture in Picture video: onto every desktop (Space),
/// and optionally over full-screen apps too.
#[tauri::command]
pub fn set_follows_desktops(window: WebviewWindow, over_fullscreen: bool) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    let target = window.clone();
    window
      .run_on_main_thread(move || macos::follow_desktops(&target, over_fullscreen))
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(target_os = "macos"))]
  let _ = (window, over_fullscreen);
  Ok(())
}

/// Makes the window see-through (optionally with macOS's own blur of the desktop behind it) or a
/// normal opaque window, and shows or hides its shadow, whose rim is the window's outline.
/// Opaque windows keep macOS's rounded corners, which a see-through window loses, so lines only
/// goes see-through when asked to.
#[tauri::command]
pub fn set_window_effects(window: WebviewWindow, translucent: bool, blur: bool, shadow: bool) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    let target = window.clone();
    window
      .run_on_main_thread(move || macos::set_effects(&target, translucent, blur, shadow))
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(target_os = "macos"))]
  let _ = (window, translucent, blur, shadow);
  Ok(())
}

#[cfg(target_os = "macos")]
mod macos {
  use objc2_app_kit::{NSAnimatablePropertyContainer, NSColor, NSWindow, NSWindowButton, NSWindowCollectionBehavior};
  use tauri::WebviewWindow;
  use window_vibrancy::{apply_vibrancy, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

  /// Matches `--window-radius` in app.css, which rounds the page the same way.
  const CORNER_RADIUS: f64 = 16.0;
  /// The tag window-vibrancy gives its blur view, so we can find it again.
  const BLUR_VIEW_TAG: isize = 91376254;

  /// # Safety
  /// `ns_window` must point to a live NSWindow, and this must run on the main thread.
  pub unsafe fn set_buttons(ns_window: usize, visible: bool) {
    let window = unsafe { &*(ns_window as *const NSWindow) };
    let alpha = if visible { 1.0 } else { 0.0 };
    for kind in [NSWindowButton::CloseButton, NSWindowButton::MiniaturizeButton, NSWindowButton::ZoomButton] {
      if let Some(button) = window.standardWindowButton(kind) {
        // Through the animator, so it fades like the system's own controls.
        button.animator().setAlphaValue(alpha);
      }
    }
  }

  /// Must run on the main thread.
  pub fn follow_desktops(window: &WebviewWindow, over_fullscreen: bool) {
    let Ok(pointer) = window.ns_window() else { return };
    let ns_window = unsafe { &*(pointer as *const NSWindow) };
    let mut behavior = ns_window.collectionBehavior() | NSWindowCollectionBehavior::CanJoinAllSpaces;
    if over_fullscreen {
      behavior |= NSWindowCollectionBehavior::FullScreenAuxiliary;
    } else {
      behavior &= !NSWindowCollectionBehavior::FullScreenAuxiliary;
    }
    ns_window.setCollectionBehavior(behavior);
  }

  /// Must run on the main thread.
  pub fn set_effects(window: &WebviewWindow, translucent: bool, blur: bool, shadow: bool) {
    let Ok(pointer) = window.ns_window() else { return };
    let ns_window = unsafe { &*(pointer as *const NSWindow) };
    let blur_view = || ns_window.contentView().and_then(|v| v.viewWithTag(BLUR_VIEW_TAG));

    if translucent && blur {
      // macOS's own behind-window blur, with rounded corners, under the page. It has to stay
      // fully visible: a faded blur view stops blurring and just tints.
      match blur_view() {
        Some(view) => view.setAlphaValue(1.0),
        None => {
          let _ = apply_vibrancy(
            window,
            NSVisualEffectMaterial::UnderWindowBackground,
            Some(NSVisualEffectState::Active),
            Some(CORNER_RADIUS),
          );
        }
      }
    } else {
      let _ = clear_vibrancy(window);
    }

    ns_window.setHasShadow(shadow);
    ns_window.setOpaque(!translucent);
    let background = if translucent { NSColor::clearColor() } else { NSColor::windowBackgroundColor() };
    ns_window.setBackgroundColor(Some(&background));
    // The shadow follows the window's shape, which just changed.
    ns_window.invalidateShadow();
  }
}
