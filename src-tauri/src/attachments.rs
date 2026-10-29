use std::path::{Path, PathBuf};

use tauri::{ipc::InvokeBody, AppHandle, Manager};

use crate::folder_sync::{percent_decode, valid_name};

/// Kinds of file that run something when opened, rather than show it. These are shown in Finder
/// instead, so opening an attachment never runs a script by surprise.
const RUNS: [&str; 13] = [
  "app", "command", "tool", "terminal", "sh", "bash", "zsh", "pkg", "mpkg", "workflow", "jar", "fileloc", "inetloc",
];

/// Opens an attachment (the raw request body) in its default app. Attachments live in the
/// webview's storage, so it's copied first to `<cache>/attachments/<hash>/<file name>`, read-only,
/// so an app that edits it says so rather than saving changes nobody will see. The stored name
/// comes in `x-name` and the name to show, percent-encoded, in `x-file-name`.
#[tauri::command]
pub async fn open_attachment(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("Expected the file's contents".into());
  };
  let header = |key: &str| request.headers().get(key).and_then(|value| value.to_str().ok()).map(str::to_owned);
  let name = header("x-name").filter(|name| valid_name(name)).ok_or("Not an attachment")?;
  let shown = header("x-file-name").and_then(|name| percent_decode(&name)).unwrap_or_else(|| name.clone());
  let folder = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("attachments").join(stem(&name));
  let path = folder.join(file_name(&shown, &name));
  let bytes = bytes.clone();
  tauri::async_runtime::spawn_blocking(move || write_once(&path, &bytes).map(|_| path))
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
    .and_then(|path| open(&path))
}

#[cfg(desktop)]
fn open(path: &Path) -> Result<(), String> {
  let runs = path.extension().is_some_and(|ext| RUNS.contains(&ext.to_string_lossy().to_lowercase().as_str()));
  if runs {
    tauri_plugin_opener::reveal_item_in_dir(path)
  } else {
    tauri_plugin_opener::open_path(path, None::<&str>)
  }
  .map_err(|e| e.to_string())
}

#[cfg(mobile)]
fn open(_path: &Path) -> Result<(), String> {
  Err("Opening attachments isn't supported here".into())
}

fn stem(name: &str) -> &str {
  name.split_once('.').map_or(name, |(stem, _)| stem)
}

/// The name a note gives an attachment, made safe for a file name, and ending in its extension.
fn file_name(shown: &str, name: &str) -> PathBuf {
  let ext = name.rsplit_once('.').map_or("", |(_, ext)| ext);
  let clean: String = shown
    .chars()
    .map(|c| if c.is_control() || matches!(c, '/' | '\\' | ':') { '-' } else { c })
    .collect();
  let clean = clean.trim().trim_start_matches('.');
  let clean = if clean.is_empty() { name } else { clean };
  if Path::new(clean).extension().is_some_and(|e| e.eq_ignore_ascii_case(ext)) {
    PathBuf::from(clean)
  } else {
    PathBuf::from(format!("{clean}.{ext}"))
  }
}

/// Attachments never change, so a copy that's already there is the same file.
fn write_once(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  if path.exists() {
    return Ok(());
  }
  let folder = path.parent().expect("a file in a folder");
  std::fs::create_dir_all(folder)?;
  let temp = folder.join(".partial");
  std::fs::write(&temp, bytes)?;
  let mut permissions = std::fs::metadata(&temp)?.permissions();
  permissions.set_readonly(true);
  std::fs::set_permissions(&temp, permissions)?;
  std::fs::rename(&temp, path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn names_files_safely() {
    let name = "3f9c0a1b2c3d4e5f60718293a4b5c6d7.pdf";
    assert_eq!(file_name("Report.pdf", name), PathBuf::from("Report.pdf"));
    assert_eq!(file_name("Report.PDF", name), PathBuf::from("Report.PDF"));
    assert_eq!(file_name("Report", name), PathBuf::from("Report.pdf"));
    assert_eq!(file_name("../../etc/passwd", name), PathBuf::from("-..-etc-passwd.pdf"));
    assert_eq!(file_name(" .hidden.pdf", name), PathBuf::from("hidden.pdf"));
    assert_eq!(file_name("", name), PathBuf::from(name));
    assert_eq!(stem(name), "3f9c0a1b2c3d4e5f60718293a4b5c6d7");
  }

  #[test]
  fn writes_once_read_only() {
    let dir = std::env::temp_dir().join(format!("lines-attachment-test-{}", std::process::id()));
    let path = dir.join("a").join("Report.pdf");
    write_once(&path, b"1").unwrap();
    write_once(&path, b"2").unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), b"1");
    assert!(std::fs::metadata(&path).unwrap().permissions().readonly());
    let mut permissions = std::fs::metadata(&path).unwrap().permissions();
    #[allow(clippy::permissions_set_readonly_false)]
    permissions.set_readonly(false);
    std::fs::set_permissions(&path, permissions).unwrap();
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
