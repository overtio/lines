//! The font families installed on this device, to write notes in (Settings → Typography, src/lib/themes/installedFonts.ts):
//! AppKit's on the Mac, UIKit's on iPhone and iPad, DirectWrite's on Windows and fontconfig's on
//! Linux. Each is the name the system's web view knows the family by. Android lists none, and
//! there a font is chosen by typing its name.

use tauri::AppHandle;

/// Every font family installed, in alphabetical order, once each, without the system's hidden ones (".SF NS").
#[tauri::command]
pub async fn installed_fonts(app: AppHandle) -> Vec<String> {
  #[cfg(target_os = "macos")]
  let families = crate::local_links::on_main(&app, macos::families).await.unwrap_or_default();
  #[cfg(not(target_os = "macos"))]
  let families = {
    let _ = app;
    tauri::async_runtime::spawn_blocking(families).await.unwrap_or_default()
  };
  tidy(families)
}

fn tidy(families: Vec<String>) -> Vec<String> {
  let mut families: Vec<String> = families
    .into_iter()
    .map(|family| family.trim().to_owned())
    .filter(|family| !family.is_empty() && !family.starts_with('.'))
    .collect();
  families.sort_by_cached_key(|family| family.to_lowercase());
  families.dedup_by(|a, b| a.to_lowercase() == b.to_lowercase());
  families
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
/// whatever Windows' language (and by its first, for one without).
#[cfg(windows)]
fn families() -> Vec<String> {
  use windows::core::{w, BOOL};
  use windows::Win32::Graphics::DirectWrite::{DWriteCreateFactory, IDWriteFactory, IDWriteFontCollection, DWRITE_FACTORY_TYPE_SHARED};

  let list = || -> windows::core::Result<Vec<String>> {
    unsafe {
      let factory: IDWriteFactory = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED)?;
      let mut collection: Option<IDWriteFontCollection> = None;
      factory.GetSystemFontCollection(&mut collection, false)?;
      let Some(collection) = collection else { return Ok(Vec::new()) };
      let mut families = Vec::new();
      for index in 0..collection.GetFontFamilyCount() {
        let names = collection.GetFontFamily(index)?.GetFamilyNames()?;
        let (mut name, mut english) = (0, BOOL(0));
        names.FindLocaleName(w!("en-us"), &mut name, &mut english)?;
        if !english.as_bool() {
          name = 0;
        }
        let mut text = vec![0u16; names.GetStringLength(name)? as usize + 1];
        names.GetString(name, &mut text)?;
        families.push(String::from_utf16_lossy(&text[..text.len() - 1]));
      }
      Ok(families)
    }
  };
  list().unwrap_or_else(|error| {
    log::error!("couldn't list the installed fonts: {error}");
    Vec::new()
  })
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn sorted_once_each_without_hidden_ones() {
    let listed = ["Zapfino", ".SF NS", "avenir", "Avenir", " Menlo ", "", "Arial", "Menlo"].map(String::from).to_vec();
    assert_eq!(tidy(listed), ["Arial", "avenir", "Menlo", "Zapfino"]);
  }
}
