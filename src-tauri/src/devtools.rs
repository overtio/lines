//! The Web Inspector, for debug builds only: off until you turn it on with View → Developer Tools
//! or F12, so right-clicking never offers "Inspect Element". Release builds don't include it.

use tauri::{Manager, Runtime, Webview, WebviewWindow};

/// The View menu item's id.
pub const MENU_ID: &str = "devtools";

/// Opens the inspector for `window`, or closes it if it's open.
#[tauri::command]
pub fn toggle_devtools<R: Runtime>(window: WebviewWindow<R>) {
  #[cfg(debug_assertions)]
  {
    if window.is_devtools_open() {
      window.close_devtools();
      set_inspectable(window.as_ref(), false);
    } else {
      set_inspectable(window.as_ref(), true);
      window.open_devtools();
    }
  }
  #[cfg(not(debug_assertions))]
  let _ = window;
}

/// Toggles the inspector for whichever window is in front.
pub fn toggle_focused<R: Runtime, M: Manager<R>>(app: &M) {
  if let Some(window) = app.webview_windows().into_values().find(|w| w.is_focused().unwrap_or(false)) {
    toggle_devtools(window);
  }
}

/// Adds or removes "Inspect Element" in the webview's own menus. Debug builds of the Mac app
/// turn it on for every page; lines turns it off until you ask for the inspector.
#[cfg_attr(not(debug_assertions), allow(dead_code))]
pub fn set_inspectable<R: Runtime>(webview: &Webview<R>, on: bool) {
  #[cfg(target_os = "macos")]
  let _ = webview.with_webview(move |platform| unsafe {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSNumber, NSString};
    // The same preference WKWebView's debug setup turns on.
    let view = platform.inner() as *mut AnyObject;
    let config: *mut AnyObject = msg_send![view, configuration];
    let prefs: *mut AnyObject = msg_send![config, preferences];
    let value = NSNumber::new_bool(on);
    let key = NSString::from_str("developerExtrasEnabled");
    let _: () = msg_send![prefs, setValue: &*value, forKey: &*key];
  });
  #[cfg(not(target_os = "macos"))]
  let _ = (webview, on);
}
