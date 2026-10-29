use std::sync::Mutex;

use tauri::{
  ipc::{InvokeBody, Request, Response},
  State,
};

/// The app lock's device key while lines is unlocked (see src/lib/lock/lock.svelte.ts). The main
/// window puts it here once it's unlocked, so floating notes, which are windows of their own, can
/// open the notes too. Only ever in memory; locking forgets it.
#[derive(Default)]
pub struct Unlocked(Mutex<Option<Vec<u8>>>);

impl Unlocked {
  fn get(&self) -> Option<Vec<u8>> {
    self.0.lock().ok()?.clone()
  }

  fn set(&self, key: Option<Vec<u8>>) {
    if let Ok(mut held) = self.0.lock() {
      if let Some(old) = held.as_mut() {
        old.fill(0);
      }
      *held = key;
    }
  }
}

#[tauri::command]
pub fn lock_share(state: State<'_, Unlocked>, request: Request<'_>) -> Result<(), String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("Expected the key".into());
  };
  state.set(Some(bytes.clone()));
  Ok(())
}

/// The key, or nothing while lines is locked.
#[tauri::command]
pub fn lock_shared(state: State<'_, Unlocked>) -> Response {
  Response::new(state.get().unwrap_or_default())
}

#[tauri::command]
pub fn lock_forget(state: State<'_, Unlocked>) {
  state.set(None);
}

/*
 * Touch ID. With it turned on, the device key is also kept in the login keychain, and given
 * back only after Touch ID says it's you. Locked notes can use it too, with a key of their own
 * (see src/lib/notes/locked.svelte.ts): `which` is "notes" for that one.
 */

/// Which key: the app lock's, or locked notes'.
#[derive(Clone, Copy)]
pub enum Which {
  App,
  Notes,
}

impl Which {
  fn from(which: Option<String>) -> Result<Self, String> {
    match which.as_deref() {
      None | Some("app") => Ok(Self::App),
      Some("notes") => Ok(Self::Notes),
      Some(other) => Err(format!("Unknown key: {other}")),
    }
  }
}

#[tauri::command]
pub fn touch_id_available() -> bool {
  #[cfg(target_os = "macos")]
  return touch_id::available();
  #[cfg(not(target_os = "macos"))]
  false
}

/// Keeps the key lines is unlocked with now, for Touch ID to unlock it next time.
#[tauri::command]
pub fn touch_id_remember(state: State<'_, Unlocked>) -> Result<(), String> {
  let key = state.get().ok_or("lines is locked")?;
  keep(Which::App, &key)
}

/// Keeps the key locked notes are open with, for Touch ID to open them next time.
#[tauri::command]
pub fn touch_id_keep(which: String, key: Vec<u8>) -> Result<(), String> {
  match Which::from(Some(which))? {
    Which::Notes => keep(Which::Notes, &key),
    // The app lock's key only ever comes from the state above.
    Which::App => Err("Use touch_id_remember".into()),
  }
}

fn keep(which: Which, key: &[u8]) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  return touch_id::remember(which, key);
  #[cfg(not(target_os = "macos"))]
  {
    let _ = (which, key);
    Err("Touch ID isn't available here".into())
  }
}

#[tauri::command]
pub fn touch_id_forget(which: Option<String>) -> Result<(), String> {
  let which = Which::from(which)?;
  #[cfg(target_os = "macos")]
  return touch_id::forget(which);
  #[cfg(not(target_os = "macos"))]
  {
    let _ = which;
    Ok(())
  }
}

/// Asks for Touch ID, and gives back the key if it's you; nothing if it was cancelled.
#[tauri::command]
pub async fn touch_id_unlock(which: Option<String>) -> Result<Response, String> {
  let which = Which::from(which)?;
  #[cfg(target_os = "macos")]
  {
    let key = tauri::async_runtime::spawn_blocking(move || touch_id::unlock(which))
      .await
      .map_err(|e| e.to_string())??;
    Ok(Response::new(key.unwrap_or_default()))
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = which;
    Err("Touch ID isn't available here".to_string())
  }
}

#[cfg(target_os = "macos")]
mod touch_id {
  use block2::RcBlock;
  use objc2::runtime::Bool;
  use objc2_foundation::{NSError, NSString};
  use objc2_local_authentication::{LAContext, LAPolicy};
  use security_framework::passwords;

  use super::Which;

  const SERVICE: &str = "lines app lock";
  /// errSecItemNotFound
  const NOT_FOUND: i32 = -25300;

  fn account(which: Which) -> &'static str {
    match which {
      Which::App => "device key",
      Which::Notes => "locked notes key",
    }
  }

  /// What the Touch ID prompt says it's for: "lines is trying to …".
  fn reason(which: Which) -> &'static str {
    match which {
      Which::App => "unlock your notes",
      Which::Notes => "open your locked notes",
    }
  }

  pub fn available() -> bool {
    let context = unsafe { LAContext::new() };
    unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics) }.is_ok()
  }

  pub fn remember(which: Which, key: &[u8]) -> Result<(), String> {
    passwords::set_generic_password(SERVICE, account(which), key).map_err(|e| e.to_string())
  }

  pub fn forget(which: Which) -> Result<(), String> {
    match passwords::delete_generic_password(SERVICE, account(which)) {
      Err(e) if e.code() != NOT_FOUND => Err(e.to_string()),
      _ => Ok(()),
    }
  }

  /// Blocks until Touch ID answers.
  pub fn unlock(which: Which) -> Result<Option<Vec<u8>>, String> {
    let context = unsafe { LAContext::new() };
    // Our own passphrase is the fallback, on the lock screen, rather than the Mac's password.
    unsafe { context.setLocalizedFallbackTitle(Some(&NSString::from_str(""))) };
    let (send, receive) = std::sync::mpsc::channel();
    let reply = RcBlock::new(move |ok: Bool, _error: *mut NSError| {
      let _ = send.send(ok.as_bool());
    });
    unsafe {
      context.evaluatePolicy_localizedReason_reply(
        LAPolicy::DeviceOwnerAuthenticationWithBiometrics,
        &NSString::from_str(reason(which)),
        &reply,
      );
    }
    if !receive.recv().unwrap_or(false) {
      return Ok(None);
    }
    match passwords::get_generic_password(SERVICE, account(which)) {
      Ok(key) => Ok(Some(key)),
      Err(e) if e.code() == NOT_FOUND => Err(match which {
        Which::App => "Touch ID isn't set up for lines any more. Use your passphrase.".into(),
        Which::Notes => "Touch ID isn't set up for locked notes any more. Use your password.".into(),
      }),
      Err(e) => Err(e.to_string()),
    }
  }
}
