//! Sync through a folder that a cloud drive app keeps in sync: iCloud Drive, Google Drive,
//! Proton Drive, Dropbox, OneDrive… lines writes one Markdown file per note into the folder and
//! the drive's own app carries it to other devices.
//!
//! Images go in an `attachments` folder beside `notes`, as `<hash>.<ext>` files.
//!
//! File names are checked to be plain names of those kinds; the folder is whatever the page passes.

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};

/// A synced cloud folder found on this computer.
#[derive(Serialize)]
pub struct Candidate {
  /// "icloud", "google", "proton", "dropbox", "onedrive" or "box".
  provider: &'static str,
  name: String,
  path: String,
}

#[derive(Serialize)]
pub struct Entry {
  name: String,
  etag: String,
}

#[derive(Serialize)]
pub struct File {
  text: String,
  etag: String,
}

/// The cloud drive folders this computer has, best known first. Off the main thread, like the
/// other folder commands: looking into a drive's folder can wait on its app.
#[tauri::command]
pub async fn sync_folder_candidates(app: AppHandle) -> Vec<Candidate> {
  let Ok(home) = app.path().home_dir() else { return Vec::new() };
  tauri::async_runtime::spawn_blocking(move || candidates_in(&home)).await.unwrap_or_default()
}

fn candidates_in(home: &Path) -> Vec<Candidate> {
  let mut found = Vec::new();

  let icloud = home.join("Library/Mobile Documents/com~apple~CloudDocs");
  if icloud.is_dir() {
    found.push(candidate("icloud", "iCloud Drive".into(), icloud));
  }

  // Drives built on Apple's File Provider live here, one folder per account.
  if let Ok(entries) = std::fs::read_dir(home.join("Library/CloudStorage")) {
    let mut entries: Vec<_> = entries.flatten().filter(|e| e.path().is_dir()).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
      let dir = entry.file_name().to_string_lossy().into_owned();
      let account = |prefix: &str, suffix: &str| {
        dir.strip_prefix(prefix).map(|rest| rest.strip_suffix(suffix).unwrap_or(rest).to_string())
      };
      let path = entry.path();
      if let Some(account) = account("GoogleDrive-", "") {
        let my_drive = path.join("My Drive");
        let path = if my_drive.is_dir() { my_drive } else { path };
        found.push(candidate("google", format!("Google Drive ({account})"), path));
      } else if let Some(account) = account("ProtonDrive-", "-folder") {
        found.push(candidate("proton", format!("Proton Drive ({account})"), path));
      } else if dir.starts_with("Dropbox") {
        found.push(candidate("dropbox", "Dropbox".into(), path));
      } else if dir.starts_with("OneDrive") {
        let name = account("OneDrive-", "").filter(|a| !a.is_empty()).map_or("OneDrive".into(), |a| format!("OneDrive ({a})"));
        found.push(candidate("onedrive", name, path));
      } else if dir.starts_with("Box") {
        found.push(candidate("box", "Box".into(), path));
      }
    }
  }

  // Dropbox's older, non-File Provider location.
  let dropbox = home.join("Dropbox");
  if dropbox.is_dir() && !found.iter().any(|c| c.provider == "dropbox") {
    found.push(candidate("dropbox", "Dropbox".into(), dropbox));
  }
  found
}

fn candidate(provider: &'static str, name: String, path: PathBuf) -> Candidate {
  Candidate { provider, name, path: path.to_string_lossy().into_owned() }
}

/// Every note or image file in `dir`, creating it if needed (which also checks we may write there).
///
/// Only the sync folder and its `notes` and `attachments` folders are ever created. If the folder they go in is gone
/// (a drive that's signed out, a folder that was moved), this fails rather than return an empty
/// list, which would look like every note had been deleted on another device.
#[tauri::command]
pub async fn sync_folder_list(dir: String) -> Result<Vec<Entry>, String> {
  blocking(move || {
    let dir = folder(&dir)?;
    let container = dir.parent().and_then(Path::parent).filter(|p| p.is_dir());
    if container.is_none() {
      return Err(format!("{} isn't available. Is the drive signed in?", dir.display()));
    }
    std::fs::create_dir_all(&dir).map_err(|e| describe(&dir, e))?;
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| describe(&dir, e))?.flatten() {
      let name = entry.file_name().to_string_lossy().into_owned();
      if let Some(real) = icloud_placeholder(&name) {
        // Not downloaded to this Mac yet: ask for it, and list it so it doesn't look deleted.
        // Reading it finds nothing until it's here, so it's picked up on a later pass.
        request_download(&dir.join(real));
        entries.push(Entry { name: real.to_string(), etag: PLACEHOLDER.into() });
      } else if valid_name(&name)
        && let Ok(meta) = entry.metadata()
      {
        entries.push(Entry { name, etag: etag(&meta) });
      }
    }
    Ok(entries)
  })
  .await
}

#[tauri::command]
pub async fn sync_folder_read(dir: String, name: String) -> Result<Option<File>, String> {
  blocking(move || {
    let path = file(&dir, &name)?;
    match std::fs::read_to_string(&path) {
      Ok(text) => {
        let meta = std::fs::metadata(&path).map_err(|e| describe(&path, e))?;
        Ok(Some(File { text, etag: etag(&meta) }))
      }
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
      Err(e) => Err(describe(&path, e)),
    }
  })
  .await
}

#[tauri::command]
pub async fn sync_folder_write(dir: String, name: String, text: String) -> Result<String, String> {
  blocking(move || {
    let path = file(&dir, &name)?;
    let meta = write_atomic(&path, text.as_bytes())?;
    Ok(etag(&meta))
  })
  .await
}

/// Writes through a temporary file and a rename, so the drive never uploads half a file.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<std::fs::Metadata, String> {
  let parent = path.parent().ok_or("Invalid folder")?;
  let name = path.file_name().ok_or("Invalid file name")?.to_string_lossy();
  std::fs::create_dir_all(parent).map_err(|e| describe(parent, e))?;
  let temp = parent.join(format!(".{name}.saving"));
  std::fs::write(&temp, bytes).map_err(|e| describe(&temp, e))?;
  std::fs::rename(&temp, path).map_err(|e| describe(path, e))?;
  std::fs::metadata(path).map_err(|e| describe(path, e))
}

/// An attachment's bytes, as they are, or `null` if it isn't there (or the drive hasn't downloaded
/// it yet). An empty file is there, with no bytes.
#[tauri::command]
pub async fn sync_folder_read_file(dir: String, name: String) -> Result<Response, String> {
  blocking(move || {
    let bytes = read_file(&file(&dir, &name)?)?;
    Ok(bytes.map_or_else(|| Response::new("null".to_string()), Response::new))
  })
  .await
}

fn read_file(path: &Path) -> Result<Option<Vec<u8>>, String> {
  match std::fs::read(path) {
    Ok(bytes) => Ok(Some(bytes)),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(describe(path, e)),
  }
}

/// Writes an image: the raw request body, with the folder (percent-encoded) and file name in the
/// `x-dir` and `x-name` headers.
#[tauri::command]
pub async fn sync_folder_write_file(request: Request<'_>) -> Result<(), String> {
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("Expected the file's contents".into());
  };
  let header = |key: &str| request.headers().get(key).and_then(|value| value.to_str().ok()).map(str::to_owned);
  let dir = header("x-dir").and_then(|dir| percent_decode(&dir)).ok_or("Missing folder")?;
  let name = header("x-name").ok_or("Missing file name")?;
  let bytes = bytes.clone();
  blocking(move || write_atomic(&file(&dir, &name)?, &bytes).map(|_| ())).await
}

/// `%2F`-style escapes, as `encodeURIComponent` writes them.
pub(crate) fn percent_decode(text: &str) -> Option<String> {
  let mut bytes = Vec::with_capacity(text.len());
  let mut rest = text.as_bytes();
  while let Some((&byte, tail)) = rest.split_first() {
    if byte == b'%' {
      let hex = std::str::from_utf8(tail.get(..2)?).ok()?;
      bytes.push(u8::from_str_radix(hex, 16).ok()?);
      rest = &tail[2..];
    } else {
      bytes.push(byte);
      rest = tail;
    }
  }
  String::from_utf8(bytes).ok()
}

#[tauri::command]
pub async fn sync_folder_delete(dir: String, name: String) -> Result<(), String> {
  blocking(move || {
    let path = file(&dir, &name)?;
    match std::fs::remove_file(&path) {
      Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(describe(&path, e)),
      _ => Ok(()),
    }
  })
  .await
}

/// File work runs off the async runtime: reading a file a drive hasn't downloaded yet can block.
async fn blocking<T: Send + 'static>(work: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
  tauri::async_runtime::spawn_blocking(work).await.map_err(|e| e.to_string())?
}

/// The tag listed for a file iCloud hasn't downloaded yet.
const PLACEHOLDER: &str = "icloud-placeholder";

/// Lets the person choose any folder with the system's folder picker.
#[tauri::command]
pub async fn sync_folder_pick(app: AppHandle) -> Option<String> {
  #[cfg(target_os = "macos")]
  {
    let (send, receive) = std::sync::mpsc::channel();
    app
      .run_on_main_thread(move || {
        let _ = send.send(macos::pick_folder());
      })
      .ok()?;
    tauri::async_runtime::spawn_blocking(move || receive.recv().ok().flatten()).await.ok().flatten()
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = app;
    None
  }
}

fn folder(dir: &str) -> Result<PathBuf, String> {
  let dir = PathBuf::from(dir);
  if !dir.is_absolute() || dir.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
    return Err("Choose a folder for sync again.".into());
  }
  Ok(dir)
}

fn file(dir: &str, name: &str) -> Result<PathBuf, String> {
  if !valid_name(name) {
    return Err(format!("Not a note or attachment: {name}"));
  }
  Ok(folder(dir)?.join(name))
}

/// A note (`<id>.md`) or an attachment (`<hash>.<ext>`): a plain name, with an extension.
pub(crate) fn valid_name(name: &str) -> bool {
  let Some((stem, ext)) = name.rsplit_once('.') else { return false };
  !stem.is_empty()
    && (1..=10).contains(&ext.len())
    && ext.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    && !name.starts_with('.')
    && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

/// iCloud Drive stands in for files it hasn't downloaded with `.<name>.icloud`.
fn icloud_placeholder(name: &str) -> Option<&str> {
  name.strip_prefix('.')?.strip_suffix(".icloud").filter(|real| valid_name(real))
}

/// Modification time and size: changes whenever the file does, including when the drive
/// brings in another device's version.
fn etag(meta: &std::fs::Metadata) -> String {
  let modified = meta
    .modified()
    .ok()
    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
    .map_or(0, |d| d.as_nanos());
  format!("{modified:x}-{:x}", meta.len())
}

fn describe(path: &Path, error: std::io::Error) -> String {
  match error.kind() {
    std::io::ErrorKind::PermissionDenied => format!(
      "lines isn't allowed to use {}. Allow it in System Settings → Privacy & Security → Files and Folders.",
      path.display()
    ),
    _ => format!("{}: {error}", path.display()),
  }
}

fn request_download(path: &Path) {
  #[cfg(target_os = "macos")]
  macos::start_download(path);
  #[cfg(not(target_os = "macos"))]
  let _ = path;
}

#[cfg(target_os = "macos")]
mod macos {
  use std::path::Path;

  use objc2::MainThreadMarker;
  use objc2_app_kit::{NSModalResponseOK, NSOpenPanel};
  use objc2_foundation::{NSFileManager, NSString, NSURL};

  pub fn start_download(path: &Path) {
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    let _ = NSFileManager::defaultManager().startDownloadingUbiquitousItemAtURL_error(&url);
  }

  /// Must run on the main thread.
  pub fn pick_folder() -> Option<String> {
    let mtm = MainThreadMarker::new()?;
    let panel = NSOpenPanel::openPanel(mtm);
    panel.setCanChooseDirectories(true);
    panel.setCanChooseFiles(false);
    panel.setCanCreateDirectories(true);
    panel.setAllowsMultipleSelection(false);
    panel.setPrompt(Some(&NSString::from_str("Use This Folder")));
    panel.setMessage(Some(&NSString::from_str("Choose where lines keeps your notes. A folder in a cloud drive syncs them.")));
    if panel.runModal() != NSModalResponseOK {
      return None;
    }
    panel.URL()?.path().map(|p| p.to_string())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn only_plain_note_names() {
    assert!(valid_name("6f1c2b3a-1234-4abc-9def-0123456789ab.md"));
    assert!(!valid_name(".hidden.md"));
    assert!(!valid_name("../escape.md"));
    assert!(!valid_name("sub/dir.md"));
    assert!(valid_name("3f9c0a1b2c3d4e5f60718293a4b5c6d7.pdf"));
    assert!(!valid_name("notes.TXT"));
    assert!(!valid_name("archive.toolongextension"));
    assert!(!valid_name(".md"));
    assert!(valid_name("3f9c0a1b2c3d4e5f60718293a4b5c6d7.png"));
    assert!(!valid_name("noextension"));
    assert_eq!(percent_decode("/Users/me/Google%20Drive%20(me%40x.com)/lines"), Some("/Users/me/Google Drive (me@x.com)/lines".into()));
    assert_eq!(percent_decode("%E2%9C%93"), Some("✓".into()));
    assert_eq!(percent_decode("%2"), None);
    assert_eq!(icloud_placeholder(".abc.md.icloud"), Some("abc.md"));
    assert_eq!(icloud_placeholder("abc.md"), None);
  }

  #[test]
  fn finds_cloud_drives() {
    let home = std::env::temp_dir().join(format!("lines-home-{}", std::process::id()));
    for dir in [
      "Library/Mobile Documents/com~apple~CloudDocs",
      "Library/CloudStorage/GoogleDrive-me@gmail.com/My Drive",
      "Library/CloudStorage/ProtonDrive-me@proton.me-folder",
      "Library/CloudStorage/Dropbox",
      "Library/CloudStorage/OneDrive-Personal",
    ] {
      std::fs::create_dir_all(home.join(dir)).unwrap();
    }
    let found: Vec<_> = candidates_in(&home).into_iter().map(|c| (c.provider, c.name)).collect();
    assert_eq!(
      found,
      [
        ("icloud", "iCloud Drive".to_string()),
        ("dropbox", "Dropbox".to_string()),
        ("google", "Google Drive (me@gmail.com)".to_string()),
        ("onedrive", "OneDrive (Personal)".to_string()),
        ("proton", "Proton Drive (me@proton.me)".to_string()),
      ]
    );
    std::fs::remove_dir_all(&home).unwrap();
  }

  #[test]
  fn rejects_relative_folders() {
    // Absolute on every system: Windows' have a drive letter.
    let absolute = std::env::temp_dir().join("lines");
    assert!(folder("relative/path").is_err());
    assert!(folder(&absolute.join("..").join("etc").to_string_lossy()).is_err());
    assert!(folder(&absolute.to_string_lossy()).is_ok());
  }

  #[test]
  fn round_trip() {
    tauri::async_runtime::block_on(round_trip_async());
  }

  async fn round_trip_async() {
    let dir = std::env::temp_dir().join(format!("lines-folder-sync-{}", std::process::id()));
    let d = dir.to_string_lossy().into_owned();
    assert!(sync_folder_list(d.clone()).await.unwrap().is_empty());
    let etag = sync_folder_write(d.clone(), "a.md".into(), "hello".into()).await.unwrap();
    let listed = sync_folder_list(d.clone()).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].etag, etag);
    assert_eq!(sync_folder_read(d.clone(), "a.md".into()).await.unwrap().unwrap().text, "hello");
    sync_folder_delete(d.clone(), "a.md".into()).await.unwrap();
    assert!(sync_folder_read(d.clone(), "a.md".into()).await.unwrap().is_none());
    assert!(sync_folder_write(d.clone(), "../x.md".into(), "no".into()).await.is_err());
    // An empty attachment is there; a missing one isn't.
    let empty = dir.join("3f9c0a1b2c3d4e5f60718293a4b5c6d7.txt");
    write_atomic(&empty, b"").unwrap();
    assert_eq!(read_file(&empty).unwrap(), Some(Vec::new()));
    assert_eq!(read_file(&dir.join("0f9c0a1b2c3d4e5f60718293a4b5c6d7.txt")).unwrap(), None);
    std::fs::remove_dir_all(&dir).unwrap();
    // A drive that's gone isn't recreated as an empty folder.
    let gone = dir.join("signed-out-drive/lines/notes");
    assert!(sync_folder_list(gone.to_string_lossy().into_owned()).await.is_err());
    assert!(!dir.exists());
  }
}
