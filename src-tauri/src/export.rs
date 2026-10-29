use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::{ipc::InvokeBody, AppHandle, Manager};

/// Saves an export (the raw request body) to the Downloads folder, or the app's Documents
/// folder where there is no Downloads (iOS), without overwriting anything. Returns the path.
/// The file name comes, percent-encoded, in the `x-file-name` header.
#[tauri::command]
pub async fn save_export(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("Expected the file's contents".into());
  };
  let requested = request
    .headers()
    .get("x-file-name")
    .and_then(|value| value.to_str().ok())
    .and_then(crate::folder_sync::percent_decode)
    .ok_or("Missing file name")?;
  // Only ever a plain name inside the chosen folder.
  let name = PathBuf::from(Path::new(&requested).file_name().ok_or("Invalid file name")?);

  let paths = app.path();
  let dir = paths
    .download_dir()
    .or_else(|_| paths.document_dir())
    .map_err(|e| e.to_string())?;
  let bytes = bytes.clone();
  tauri::async_runtime::spawn_blocking(move || {
    std::fs::create_dir_all(&dir)?;
    write_new(&dir, &name, &bytes)
  })
  .await
  .map_err(|e| e.to_string())?
  .map(|path| path.to_string_lossy().into_owned())
  .map_err(|e| e.to_string())
}

/// Writes to `name`, or `name 2`, `name 3`… if that's taken. Never replaces a file, even one
/// that appears while we're looking.
fn write_new(dir: &Path, name: &Path, bytes: &[u8]) -> std::io::Result<PathBuf> {
  let stem = name.file_stem().unwrap_or_default().to_string_lossy();
  let ext = name.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
  let mut path = dir.join(name);
  for n in 2.. {
    match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
      Ok(mut file) => {
        file.write_all(bytes)?;
        return Ok(path);
      }
      Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => path = dir.join(format!("{stem} {n}{ext}")),
      Err(e) => return Err(e),
    }
  }
  unreachable!()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn never_overwrites() {
    let dir = std::env::temp_dir().join(format!("lines-export-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let name = Path::new("notes.zip");
    assert_eq!(write_new(&dir, name, b"1").unwrap(), dir.join("notes.zip"));
    assert_eq!(write_new(&dir, name, b"2").unwrap(), dir.join("notes 2.zip"));
    assert_eq!(write_new(&dir, name, b"3").unwrap(), dir.join("notes 3.zip"));
    assert_eq!(std::fs::read(dir.join("notes.zip")).unwrap(), b"1");
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
