//! Keeps the desktop apps up to date from lines' releases on GitHub (docs/releasing.md#updates).
//!
//! A check lists the releases and picks the newest one newer than this build that has been out
//! for the wait chosen in Settings. Its package is downloaded in the background, checked against
//! the signing key in tauri.conf.json, and installed as lines quits, or at once to restart into
//! it. Every window hears how it's going as `updates` events.

use std::path::PathBuf;
use std::sync::Mutex;

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_http::reqwest;
use tauri_plugin_updater::{Update, UpdaterExt};
use time::{Duration, OffsetDateTime};

const RELEASES: &str = "https://api.github.com/repos/overtio/lines/releases?per_page=30";
/// The asset each release describes its packages and their signatures in (release.yml writes it).
const MANIFEST: &str = "latest.json";
const EVENT: &str = "updates";

#[derive(Clone, Default, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Status {
  /// Not installed from a release (a development build), so there's nothing to replace.
  Unsupported,
  #[default]
  Idle,
  Checking,
  UpToDate,
  /// A newer version is out. `due` is when it's been out long enough to install on its own
  /// (milliseconds since 1970), or None when it won't.
  Available { version: String, due: Option<i64> },
  /// `progress` from 0 to 1, once the size is known.
  Downloading { version: String, progress: Option<f64> },
  /// Downloaded and checked: it's installed when lines quits.
  Ready { version: String },
  Failed { error: String },
}

struct Downloaded {
  update: Update,
  package: PathBuf,
}

pub struct Updates {
  status: Mutex<Status>,
  ready: Mutex<Option<Downloaded>>,
}

impl Default for Updates {
  fn default() -> Self {
    let status = if installed() { Status::Idle } else { Status::Unsupported };
    Self { status: Mutex::new(status), ready: Mutex::default() }
  }
}

/// Whether this is an installed release build, which a newer one can replace. A development
/// build isn't: on a Mac, Tauri takes any build for an app bundle, so look for one around it.
fn installed() -> bool {
  if cfg!(debug_assertions) {
    return false;
  }
  if cfg!(target_os = "macos") {
    return std::env::current_exe().is_ok_and(|exe| exe.parent().is_some_and(|dir| dir.ends_with("Contents/MacOS")));
  }
  tauri::utils::platform::bundle_type().is_some()
}

fn set(app: &AppHandle, status: Status) {
  *app.state::<Updates>().status.lock().unwrap() = status.clone();
  let _ = app.emit(EVENT, status);
}

#[tauri::command]
pub fn updates_status(updates: tauri::State<Updates>) -> Status {
  updates.status.lock().unwrap().clone()
}

/// Looks for a newer release. With `download`, fetches the newest that's been out `wait_days`
/// days, to install when lines quits. Returns how things stand after.
#[tauri::command]
pub async fn updates_check(app: AppHandle, wait_days: u32, download: bool) -> Status {
  {
    let updates = app.state::<Updates>();
    let mut status = updates.status.lock().unwrap();
    // One check at a time; and once an update is ready, it's the one installed.
    if matches!(*status, Status::Unsupported | Status::Checking | Status::Downloading { .. } | Status::Ready { .. }) {
      return status.clone();
    }
    *status = Status::Checking;
  }
  let _ = app.emit(EVENT, Status::Checking);
  let status = check(&app, Duration::days(wait_days.into()), download)
    .await
    .unwrap_or_else(|error| Status::Failed { error });
  set(&app, status.clone());
  status
}

async fn check(app: &AppHandle, wait: Duration, download: bool) -> Result<Status, String> {
  let releases = reqwest::Client::new()
    .get(RELEASES)
    .header(reqwest::header::USER_AGENT, "lines")
    .header(reqwest::header::ACCEPT, "application/vnd.github+json")
    .send()
    .await
    .and_then(reqwest::Response::error_for_status)
    .map_err(|e| e.to_string())?
    .bytes()
    .await
    .map_err(|e| e.to_string())?;
  let releases: Vec<Release> = serde_json::from_slice(&releases).map_err(|e| e.to_string())?;
  let choice = choose(releases, &app.package_info().version, wait, OffsetDateTime::now_utc());
  match (choice.due, choice.newest) {
    (Some(due), _) if download => fetch(app, due).await,
    (_, Some(newest)) => Ok(Status::Available {
      version: newest.version.to_string(),
      due: download.then(|| (newest.published + wait).unix_timestamp() * 1000),
    }),
    _ => Ok(Status::UpToDate),
  }
}

/// Downloads a release's package for this platform and keeps it for when lines quits.
async fn fetch(app: &AppHandle, release: Candidate) -> Result<Status, String> {
  let update = app
    .updater_builder()
    .endpoints(vec![release.manifest])
    .and_then(|builder| builder.build())
    .map_err(|e| e.to_string())?
    .check()
    .await
    .map_err(|e| e.to_string())?;
  let Some(update) = update else { return Ok(Status::UpToDate) };
  let version = update.version.clone();
  set(app, Status::Downloading { version: version.clone(), progress: None });

  let (mut received, mut shown) = (0, 0);
  let bytes = update
    .download(
      |chunk, total| {
        received += chunk;
        // A step at each percent, not at every chunk.
        let Some(total) = total.filter(|&total| total > 0) else { return };
        let percent = received as u64 * 100 / total;
        if percent > shown {
          shown = percent;
          set(app, Status::Downloading { version: version.clone(), progress: Some(percent as f64 / 100.0) });
        }
      },
      || {},
    )
    .await
    .map_err(|e| e.to_string())?;

  // Kept on disk rather than in memory until lines quits, which may be days away.
  let package = package_path(app)?;
  let written = package.clone();
  tauri::async_runtime::spawn_blocking(move || {
    std::fs::create_dir_all(written.parent().unwrap())?;
    std::fs::write(&written, bytes)
  })
  .await
  .map_err(|e| e.to_string())?
  .map_err(|e| e.to_string())?;
  *app.state::<Updates>().ready.lock().unwrap() = Some(Downloaded { update, package });
  Ok(Status::Ready { version })
}

fn package_path(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(app.path().app_cache_dir().map_err(|e| e.to_string())?.join("update"))
}

/// Removes a package left behind by a run that ended before installing it.
pub fn clean_up(app: &AppHandle) {
  if let Ok(package) = package_path(app) {
    let _ = std::fs::remove_file(package);
  }
}

/// Puts the update in place of this app. On Windows its installer takes over and lines exits
/// (starting again after if `relaunch`); elsewhere the new version opens next time.
fn install(downloaded: Downloaded, relaunch: bool) -> Result<(), String> {
  let bytes = std::fs::read(&downloaded.package).map_err(|e| e.to_string())?;
  let _ = std::fs::remove_file(&downloaded.package);
  downloaded.update.restart_after_install(relaunch).install(bytes).map_err(|e| e.to_string())
}

/// Installs the update that's ready and starts lines again, as the new version.
#[tauri::command]
pub async fn updates_restart(app: AppHandle) -> Result<(), String> {
  let downloaded = app.state::<Updates>().ready.lock().unwrap().take().ok_or("No update is ready")?;
  let installed = tauri::async_runtime::spawn_blocking(move || install(downloaded, true))
    .await
    .map_err(|e| e.to_string())
    .and_then(|result| result);
  if let Err(error) = installed {
    set(&app, Status::Failed { error: error.clone() });
    return Err(error);
  }
  app.restart();
}

/// As lines quits, installs an update that's ready, before the process ends. Every way of
/// quitting ends here (on a Mac, ⌘Q skips ExitRequested), on the main thread, where the Mac's
/// password prompt for an app the user can't replace runs too.
pub fn on_exit(app: &AppHandle) {
  let Some(downloaded) = app.state::<Updates>().ready.lock().unwrap().take() else { return };
  for window in app.webview_windows().values() {
    let _ = window.hide();
  }
  let _ = install(downloaded, false);
}

#[derive(Deserialize)]
struct Release {
  tag_name: String,
  draft: bool,
  prerelease: bool,
  #[serde(default, with = "time::serde::rfc3339::option")]
  published_at: Option<OffsetDateTime>,
  assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
  name: String,
  browser_download_url: Url,
}

/// A release this build could update to.
#[derive(Clone, Debug, PartialEq)]
struct Candidate {
  version: Version,
  published: OffsetDateTime,
  manifest: Url,
}

#[derive(Debug, Default, PartialEq)]
struct Choice {
  /// The newest release newer than this build.
  newest: Option<Candidate>,
  /// The newest of those that's been out for the wait or longer.
  due: Option<Candidate>,
}

/// Of `releases`, those newer than `current` that are published and have a manifest: the
/// newest, and the newest that's been out for `wait` at `now`.
fn choose(releases: Vec<Release>, current: &Version, wait: Duration, now: OffsetDateTime) -> Choice {
  let newer: Vec<Candidate> = releases
    .into_iter()
    .filter(|release| !release.draft && !release.prerelease)
    .filter_map(|release| {
      Some(Candidate {
        version: Version::parse(release.tag_name.strip_prefix('v')?).ok()?,
        published: release.published_at?,
        manifest: release.assets.into_iter().find(|asset| asset.name == MANIFEST)?.browser_download_url,
      })
    })
    .filter(|candidate| candidate.version > *current)
    .collect();
  let newest = newer.iter().max_by(|a, b| a.version.cmp(&b.version)).cloned();
  let due = newer
    .into_iter()
    .filter(|candidate| candidate.published + wait <= now)
    .max_by(|a, b| a.version.cmp(&b.version));
  Choice { newest, due }
}

#[cfg(test)]
mod tests {
  use super::*;
  use time::macros::datetime;

  const NOW: OffsetDateTime = datetime!(2026-11-20 12:00 UTC);

  fn release(tag: &str, published: OffsetDateTime) -> Release {
    Release {
      tag_name: tag.into(),
      draft: false,
      prerelease: false,
      published_at: Some(published),
      assets: vec![Asset {
        name: MANIFEST.into(),
        browser_download_url: format!("https://github.com/overtio/lines/releases/download/{tag}/latest.json").parse().unwrap(),
      }],
    }
  }

  /// The newest version and the one due, "-" for none.
  fn chosen(choice: Choice) -> [String; 2] {
    let version = |candidate: Option<Candidate>| candidate.map_or("-".into(), |c| c.version.to_string());
    [version(choice.newest), version(choice.due)]
  }

  #[test]
  fn waits_for_a_release_to_have_been_out_long_enough() {
    let releases = || {
      vec![
        release("v0.4.0", NOW - Duration::days(2)),
        release("v0.3.0", NOW - Duration::days(9)),
        release("v0.2.0", NOW - Duration::days(20)),
      ]
    };
    let current = Version::new(0, 2, 0);
    assert_eq!(chosen(choose(releases(), &current, Duration::days(7), NOW)), ["0.4.0", "0.3.0"]);
    assert_eq!(chosen(choose(releases(), &current, Duration::days(14), NOW)), ["0.4.0", "-"]);
    assert_eq!(chosen(choose(releases(), &current, Duration::ZERO, NOW)), ["0.4.0", "0.4.0"]);
  }

  #[test]
  fn nothing_when_up_to_date() {
    let releases = vec![release("v0.2.0", NOW - Duration::days(20)), release("v0.1.0", NOW - Duration::days(30))];
    assert_eq!(choose(releases, &Version::new(0, 2, 0), Duration::days(7), NOW), Choice::default());
  }

  #[test]
  fn skips_drafts_prereleases_and_releases_without_a_manifest() {
    let mut draft = release("v0.5.0", NOW - Duration::days(30));
    draft.draft = true;
    let mut prerelease = release("v0.4.0", NOW - Duration::days(30));
    prerelease.prerelease = true;
    let mut bare = release("v0.3.0", NOW - Duration::days(30));
    bare.assets.clear();
    let releases = vec![draft, prerelease, bare, release("v0.2.1", NOW - Duration::days(30))];
    assert_eq!(chosen(choose(releases, &Version::new(0, 2, 0), Duration::days(7), NOW)), ["0.2.1", "0.2.1"]);
  }
}
