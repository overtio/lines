use tauri::Manager;

mod attachments;
mod bucket_sync;
mod devtools;
mod drag_out;
mod export;
mod folder_sync;
mod fonts;
mod local_links;
mod lock;
#[cfg(target_os = "macos")]
mod quit;
mod sf_symbols;
#[cfg(desktop)]
mod updates;
mod window_style;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_http::init())
    .manage(lock::Unlocked::default());
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_updater::Builder::new().build())
    .manage(updates::Updates::default());
  #[cfg(any(windows, target_os = "linux"))]
  let builder = builder.plugin(tauri_plugin_dialog::init());
  #[cfg(target_os = "macos")]
  let builder = builder.manage(quit::Quitting::default());
  builder
    .invoke_handler(tauri::generate_handler![
      attachments::open_attachment,
      bucket_sync::sync_bucket_transfer,
      devtools::toggle_devtools,
      drag_out::drag_note_out,
      export::save_export,
      folder_sync::sync_folder_candidates,
      folder_sync::sync_folder_list,
      folder_sync::sync_folder_read,
      folder_sync::sync_folder_write,
      folder_sync::sync_folder_read_file,
      folder_sync::sync_folder_write_file,
      folder_sync::sync_folder_delete,
      folder_sync::sync_folder_pick,
      fonts::installed_fonts,
      local_links::dropped_paths,
      local_links::pick_link_folder,
      local_links::open_local,
      lock::lock_share,
      lock::lock_shared,
      lock::lock_forget,
      lock::touch_id_available,
      lock::touch_id_remember,
      lock::touch_id_keep,
      lock::touch_id_forget,
      lock::touch_id_unlock,
      #[cfg(desktop)]
      updates::updates_status,
      #[cfg(desktop)]
      updates::updates_check,
      #[cfg(desktop)]
      updates::updates_forget,
      #[cfg(desktop)]
      updates::updates_restart,
      #[cfg(target_os = "macos")]
      quit::quit_ready,
      window_style::set_window_buttons,
      window_style::set_window_effects,
      window_style::set_follows_desktops,
    ])
    // Debug builds of the Mac app offer "Inspect Element" on every page; keep it off until asked.
    .on_page_load(|webview, _payload| {
      #[cfg(debug_assertions)]
      devtools::set_inspectable(webview, webview.is_devtools_open());
      #[cfg(not(debug_assertions))]
      let _ = webview;
    })
    .on_menu_event(|app, event| {
      if event.id() == devtools::MENU_ID {
        devtools::toggle_focused(app);
      }
      #[cfg(target_os = "macos")]
      if event.id() == quit::MENU_ID {
        quit::quit(app);
      }
    })
    .register_uri_scheme_protocol(sf_symbols::SCHEME, |_ctx, request| sf_symbols::handle(request))
    .setup(|app| {
      // The main window starts hidden and shows itself once its look is applied, so it never
      // flashes the wrong shape or color. Should that ever not happen, show it anyway.
      if let Some(window) = app.get_webview_window("main") {
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_secs(3));
          let _ = window.show();
        });
      }
      // Should it fail, Tauri's menu stays, and lines still opens.
      #[cfg(target_os = "macos")]
      if let Err(error) = set_menu(app.handle()) {
        log::error!("couldn't set the menu: {error}");
      }
      #[cfg(desktop)]
      updates::clean_up(app.handle());
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      #[cfg(desktop)]
      if let tauri::RunEvent::Exit = event {
        updates::on_exit(app);
      }
      #[cfg(mobile)]
      let _ = (app, event);
    });
}

/// The Mac app's menu: Tauri's, with a Quit of lines' own that waits for notes to be stored
/// (quit.rs), and in debug builds View → Developer Tools (F12).
#[cfg(target_os = "macos")]
fn set_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, MenuItemKind};
  let menu = Menu::default(app)?;
  for item in menu.items()? {
    let MenuItemKind::Submenu(submenu) = item else { continue };
    for (position, item) in submenu.items()?.into_iter().enumerate() {
      let MenuItemKind::Predefined(predefined) = item else { continue };
      let text = predefined.text()?;
      if text.starts_with("Quit") {
        submenu.remove_at(position)?;
        submenu.insert(&MenuItem::with_id(app, quit::MENU_ID, text, true, Some("CmdOrCtrl+Q"))?, position)?;
      }
    }
    #[cfg(debug_assertions)]
    if submenu.text()? == "View" {
      submenu.append(&tauri::menu::PredefinedMenuItem::separator(app)?)?;
      submenu.append(&MenuItem::with_id(app, devtools::MENU_ID, "Developer Tools", true, Some("F12"))?)?;
    }
  }
  app.set_menu(menu)?;
  Ok(())
}
