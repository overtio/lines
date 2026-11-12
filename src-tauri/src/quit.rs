//! Quitting the Mac app (lines → Quit, ⌘Q) waits for every window to store what's typed in it.
//! AppKit's own Quit ends lines at once, telling its pages nothing (only RunEvent::Exit comes),
//! so the last moments of typing were lost.

use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// The app menu's Quit, in place of AppKit's.
pub const MENU_ID: &str = "quit";
/// What every window hears as lines quits; each answers with `quit_ready` once its notes are stored.
const EVENT: &str = "quit";
/// The longest quitting waits for a window that doesn't answer (stuck, or still loading).
const WAIT: Duration = Duration::from_secs(3);

/// The windows yet to store what's typed in them, once quitting has started.
#[derive(Default)]
pub struct Quitting(Mutex<Option<HashSet<String>>>);

/// Asks every window to store what's typed in it, and quits once they all have, or after WAIT.
pub fn quit(app: &AppHandle) {
  let windows: HashSet<String> = app.webview_windows().into_keys().collect();
  let none = windows.is_empty();
  {
    let quitting = app.state::<Quitting>();
    let mut saving = quitting.0.lock().unwrap();
    if saving.is_some() {
      return;
    }
    *saving = Some(windows);
  }
  if none {
    return app.exit(0);
  }
  let _ = app.emit(EVENT, ());
  let app = app.clone();
  std::thread::spawn(move || {
    std::thread::sleep(WAIT);
    saved(&app, None);
  });
}

/// A window has stored what was typed in it.
#[tauri::command]
pub fn quit_ready(window: WebviewWindow) {
  saved(window.app_handle(), Some(window.label()));
}

/// Takes `window` off those still saving (every one, once the wait is over), and quits as the last goes.
fn saved(app: &AppHandle, window: Option<&str>) {
  let last = {
    let quitting = app.state::<Quitting>();
    let mut saving = quitting.0.lock().unwrap();
    let Some(windows) = saving.as_mut() else { return };
    let before = windows.len();
    if let Some(label) = window {
      windows.remove(label);
    } else {
      windows.clear();
    }
    before > 0 && windows.is_empty()
  };
  if last {
    app.exit(0);
  }
}
