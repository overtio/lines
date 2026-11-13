//! The font families installed on this device, to write notes in (Settings → Typography), as the
//! system lists them: src/lib/themes/installedFonts.ts puts them in order, once each, without its
//! hidden ones. AppKit's on the Mac, UIKit's on iPhone and iPad (iOS's own fonts: those other apps
//! install need the Fonts entitlement, which lines doesn't have), DirectWrite's on Windows and
//! fontconfig's on Linux, each the name the system's web view knows the family by. Android lists
//! none, and there a font is chosen by typing its name.

use tauri::AppHandle;

/// Every font family installed.
#[tauri::command]
pub async fn installed_fonts(app: AppHandle) -> Vec<String> {
  #[cfg(target_os = "macos")]
  return crate::local_links::on_main(&app, macos::families).await.unwrap_or_default();
  #[cfg(not(target_os = "macos"))]
  {
    let _ = app;
    tauri::async_runtime::spawn_blocking(families).await.unwrap_or_default()
  }
}

#[cfg(target_os = "macos")]
mod macos {
  use objc2::MainThreadMarker;
  use objc2_app_kit::NSFontManager;

  /// Must run on the main thread, as AppKit's font manager wants.
  pub fn families() -> Vec<String> {
    let Some(mtm) = MainThreadMarker::new() else { return Vec::new() };
    NSFontManager::sharedFontManager(mtm).availableFontFamilies().iter().map(|family| family.to_string()).collect()
  }
}

#[cfg(target_os = "ios")]
fn families() -> Vec<String> {
  objc2_ui_kit::UIFont::familyNames().iter().map(|family| family.to_string()).collect()
}

/// The system's font collection, each family by its English name, which the web view knows it by
/// whatever Windows' language (and by its first, for one without); one whose name can't be read
/// is left out.
#[cfg(windows)]
fn families() -> Vec<String> {
  use windows::core::{w, Result, BOOL};
  use windows::Win32::Graphics::DirectWrite::{DWriteCreateFactory, IDWriteFactory, IDWriteFontCollection, DWRITE_FACTORY_TYPE_SHARED};

  let collection = || -> Result<Option<IDWriteFontCollection>> {
    let factory: IDWriteFactory = unsafe { DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED)? };
    let mut collection = None;
    unsafe { factory.GetSystemFontCollection(&mut collection, false)? };
    Ok(collection)
  };
  let name = |collection: &IDWriteFontCollection, index: u32| -> Result<String> {
    unsafe {
      let names = collection.GetFontFamily(index)?.GetFamilyNames()?;
      let (mut name, mut english) = (0, BOOL(0));
      names.FindLocaleName(w!("en-us"), &mut name, &mut english)?;
      if !english.as_bool() {
        name = 0;
      }
      let mut text = vec![0u16; names.GetStringLength(name)? as usize + 1];
      names.GetString(name, &mut text)?;
      Ok(String::from_utf16_lossy(&text[..text.len() - 1]))
    }
  };
  match collection() {
    Ok(Some(collection)) => (0..unsafe { collection.GetFontFamilyCount() }).filter_map(|index| name(&collection, index).ok()).collect(),
    Ok(None) => Vec::new(),
    Err(error) => {
      log::error!("couldn't list the installed fonts: {error}");
      Vec::new()
    }
  }
}

/// fontconfig's list, which WebKitGTK finds fonts by: each font's first family name. Where its
/// `fc-list` isn't installed, none.
#[cfg(target_os = "linux")]
fn families() -> Vec<String> {
  std::process::Command::new("fc-list")
    .args(["--format", "%{family[0]}\n"])
    .output()
    .map(|output| String::from_utf8_lossy(&output.stdout).lines().map(str::to_owned).collect())
    .unwrap_or_default()
}

#[cfg(target_os = "android")]
fn families() -> Vec<String> {
  Vec::new()
}
