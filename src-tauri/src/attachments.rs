use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use tauri::{ipc::InvokeBody, AppHandle, Manager};

use crate::folder_sync::{percent_decode, valid_name};

/// Kinds of file that run something when opened, rather than show it, on each system. These are
/// shown in Finder (Explorer, the file manager) instead, so opening an attachment or a link never
/// runs a program by surprise.
#[cfg(target_os = "macos")]
const RUNS: &[&str] = &[
  "app", "command", "tool", "terminal", "sh", "bash", "zsh", "csh", "ksh", "fish", "py", "pl", "rb", "pkg", "mpkg",
  "workflow", "action", "prefpane", "jar", "fileloc", "inetloc", "webloc",
];
#[cfg(windows)]
const RUNS: &[&str] = &[
  "exe", "com", "bat", "cmd", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "scr", "pif", "cpl", "msc",
  "msi", "msp", "msix", "msixbundle", "appx", "appxbundle", "appinstaller", "application", "appref-ms", "lnk", "url",
  "website", "reg", "inf", "scf", "chm", "jar", "py", "pyw", "settingcontent-ms", "library-ms", "search-ms", "gadget",
];
#[cfg(all(desktop, not(any(target_os = "macos", windows))))]
const RUNS: &[&str] = &[
  "desktop", "sh", "bash", "zsh", "run", "bin", "appimage", "jar", "py", "pl", "rb", "deb", "rpm", "flatpakref",
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

/// Opens a file or folder in its app (a folder in Finder), or shows it in Finder if it runs something.
#[cfg(desktop)]
pub(crate) fn open(path: &Path) -> Result<(), String> {
  if runs(path) {
    tauri_plugin_opener::reveal_item_in_dir(path)
  } else {
    tauri_plugin_opener::open_path(path, None::<&str>)
  }
  .map_err(|e| e.to_string())
}

/// Whether opening `path` would run something: a kind of file in `RUNS`, or a program without an
/// extension, which macOS opens in Terminal. What a symbolic link leads to is what counts.
#[cfg(desktop)]
fn runs(path: &Path) -> bool {
  let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
  match path.extension() {
    Some(ext) => RUNS.contains(&ext.to_string_lossy().to_lowercase().as_str()),
    None => executable(&path),
  }
}

#[cfg(all(desktop, unix))]
fn executable(path: &Path) -> bool {
  use std::os::unix::fs::PermissionsExt;
  std::fs::metadata(path).is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
}

#[cfg(windows)]
fn executable(_path: &Path) -> bool {
  false
}

#[cfg(mobile)]
pub(crate) fn open(_path: &Path) -> Result<(), String> {
  Err("Opening attachments isn't supported here".into())
}

fn stem(name: &str) -> &str {
  name.split_once('.').map_or(name, |(stem, _)| stem)
}

/// Names Windows keeps for devices, which no file may have, whatever follows the first dot.
const RESERVED: [&str; 4] = ["con", "prn", "aux", "nul"];

/// The name a note gives an attachment, made safe for a file name on every system, and ending in its
/// extension. The page sends one made safe already (`attachmentFileName`); this makes sure.
fn file_name(shown: &str, name: &str) -> PathBuf {
  let ext = name.rsplit_once('.').map_or("", |(_, ext)| ext);
  let clean: String = shown
    .chars()
    .map(|c| if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { c })
    .collect();
  let clean = clean.trim().trim_start_matches('.').trim_end_matches(['.', ' ']);
  // Room for the extension within the 255 bytes a name may have.
  let end = clean.char_indices().map(|(i, c)| i + c.len_utf8()).take_while(|&end| end <= 200).last().unwrap_or(0);
  let clean = clean[..end].trim_end_matches(['.', ' ']);
  let stem = clean.split('.').next().unwrap_or_default().to_lowercase();
  let device = RESERVED.contains(&stem.as_str())
    || (stem.len() == 4 && (stem.starts_with("com") || stem.starts_with("lpt")) && stem.ends_with(|c: char| c.is_ascii_digit()));
  let clean = match clean {
    "" => name.to_owned(),
    _ if device => format!("_{clean}"),
    _ => clean.to_owned(),
  };
  if Path::new(&clean).extension().is_some_and(|e| e.eq_ignore_ascii_case(ext)) {
    PathBuf::from(clean)
  } else {
    PathBuf::from(format!("{clean}.{ext}"))
  }
}

/// Attachments never change, so a copy that's already there is the same file.
fn write_once(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
  static WRITES: AtomicU32 = AtomicU32::new(0);
  if path.exists() {
    return Ok(());
  }
  let folder = path.parent().expect("a file in a folder");
  std::fs::create_dir_all(folder)?;
  // A name of its own, so neither a write that failed nor one under way gets in the way.
  let temp = folder.join(format!(".partial-{}-{}", std::process::id(), WRITES.fetch_add(1, Ordering::Relaxed)));
  if let Err(error) = std::fs::write(&temp, bytes).and_then(|()| std::fs::rename(&temp, path)) {
    let _ = std::fs::remove_file(&temp);
    // Unless another open of the same attachment wrote it first.
    if !path.exists() {
      return Err(error);
    }
  }
  let mut permissions = std::fs::metadata(path)?.permissions();
  permissions.set_readonly(true);
  std::fs::set_permissions(path, permissions)
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
    assert_eq!(file_name("Q3: costs? <draft> | final.", name), PathBuf::from("Q3- costs- -draft- - final.pdf"));
    assert_eq!(file_name("con", name), PathBuf::from("_con.pdf"));
    assert_eq!(file_name("LPT1.backup", name), PathBuf::from("_LPT1.backup.pdf"));
    assert_eq!(file_name("Console", name), PathBuf::from("Console.pdf"));
    let long = file_name(&"日本語".repeat(40), name);
    assert!(long.as_os_str().len() <= 255 && long.to_string_lossy().ends_with("語.pdf"));
    assert_eq!(stem(name), "3f9c0a1b2c3d4e5f60718293a4b5c6d7");
  }

  #[test]
  fn shows_what_runs_instead_of_opening_it() {
    let dir = std::env::temp_dir().join(format!("lines-runs-test-{}", std::process::id()));
    std::fs::create_dir_all(dir.join("Photos.v2")).unwrap();
    let file = |name: &str| {
      let path = dir.join(name);
      std::fs::write(&path, b"").unwrap();
      path
    };
    assert!(!runs(&file("Report.pdf")));
    assert!(!runs(&dir.join("Photos.v2")));
    assert!(runs(&file(if cfg!(windows) { "Invoice.pdf.EXE" } else { "install.SH" })));
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let program = file("tool");
      assert!(!runs(&program));
      std::fs::set_permissions(&program, std::fs::Permissions::from_mode(0o755)).unwrap();
      assert!(runs(&program));
      std::os::unix::fs::symlink(&program, dir.join("Notes.txt")).unwrap();
      assert!(runs(&dir.join("Notes.txt")));
    }
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn a_failed_write_leaves_nothing_in_the_way() {
    let dir = std::env::temp_dir().join(format!("lines-attachment-fail-{}", std::process::id()));
    // A name too long for any system fails to write…
    assert!(write_once(&dir.join("b").join("x".repeat(300)), b"1").is_err());
    // …and the next one, under a name that can be, still opens.
    write_once(&dir.join("b").join("Report.pdf"), b"1").unwrap();
    assert_eq!(std::fs::read_dir(dir.join("b")).unwrap().count(), 1);
    let mut permissions = std::fs::metadata(dir.join("b").join("Report.pdf")).unwrap().permissions();
    #[allow(clippy::permissions_set_readonly_false)]
    permissions.set_readonly(false);
    std::fs::set_permissions(dir.join("b").join("Report.pdf"), permissions).unwrap();
    std::fs::remove_dir_all(&dir).unwrap();
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
