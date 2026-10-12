mod attachments;
mod backup;
mod windows;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent, WindowEvent, Wry};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Voci del menu del tray, per lingua.
fn tray_labels(lang: &str) -> (&'static str, &'static str, &'static str) {
    if lang == "en" {
        ("Open New Window", "New Quick Task", "Quit")
    } else {
        ("Apri Nuova Finestra", "Nuovo Task Rapido", "Esci")
    }
}

struct TrayItems(Mutex<Option<(MenuItem<Wry>, MenuItem<Wry>, MenuItem<Wry>)>>);

fn lang_file(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("lang.txt"))
}

fn saved_lang(app: &tauri::AppHandle) -> String {
    lang_file(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| s == "en" || s == "it")
        .unwrap_or_else(|| "it".to_string())
}

/// Il frontend comunica la lingua scelta: aggiorna il menu del tray e la ricorda.
#[tauri::command]
fn set_language(app: tauri::AppHandle, lang: String) {
    let lang = if lang == "en" { "en" } else { "it" };
    if let Some(p) = lang_file(&app) {
        let _ = std::fs::write(p, lang);
    }
    let (a, b, c) = tray_labels(lang);
    if let Some(items) = app.state::<TrayItems>().0.lock().unwrap().as_ref() {
        let _ = items.0.set_text(a);
        let _ = items.1.set_text(b);
        let _ = items.2.set_text(c);
    }
}

pub fn run() {
    let launched_by_autostart = std::env::args().any(|a| a == "--autostart");

    let mut builder = tauri::Builder::default();

    // Deve essere il primo plugin: una seconda istanza porta in primo piano la prima.
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        windows::restore_last_active_or_main(app);
    }));

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            // Lo schema è gestito dal frontend (src/lib/schema.ts) perché ogni finestra
            // ha un proprio file database con nome dinamico.
            tauri_plugin_sql::Builder::default().build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        windows::show_quick(app);
                    }
                })
                .build(),
        )
        .manage(windows::AppState::default())
        .manage(TrayItems(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            windows::open_window,
            windows::report_route,
            windows::window_ready,
            windows::window_sidebar,
            windows::set_sidebar_width,
            windows::hide_quick,
            windows::quit_app,
            windows::close_choice,
            windows::list_windows,
            windows::list_datasets,
            windows::create_dataset,
            windows::rename_dataset,
            windows::remove_dataset,
            windows::window_dataset,
            windows::assign_dataset,
            windows::replace_layout,
            backup::export_zip,
            backup::prune_backups,
            backup::read_backup,
            backup::extract_attachments,
            set_language,
            attachments::add_attachment,
            attachments::delete_attachment_file,
            attachments::delete_task_attachments,
            attachments::open_attachment,
            attachments::open_external,
            attachments::save_text_file,
            attachments::read_attachment,
        ])
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let label = window.label().to_string();
            match event {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                    windows::capture_geometry(app, &label);
                }
                WindowEvent::Focused(true) => windows::set_last_active(app, &label),
                WindowEvent::Focused(false) => {
                    if label == windows::QUICK_LABEL {
                        let _ = window.hide();
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    if label == windows::QUICK_LABEL {
                        api.prevent_close();
                        let _ = window.hide();
                    } else if windows::is_last_app_window(app, &label) {
                        // ultima finestra: chiede se uscire o restare nella tray
                        api.prevent_close();
                        let _ = window.emit("close-confirm", ());
                    }
                }
                WindowEvent::Destroyed => windows::forget_window(app, &label),
                _ => {}
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();

            // --- System tray ---------------------------------------------------
            let (l_new, l_quick, l_quit) = tray_labels(&saved_lang(&handle));
            let m_new = MenuItem::with_id(&handle, "new_window", l_new, true, None::<&str>)?;
            let m_quick = MenuItem::with_id(&handle, "quick_task", l_quick, true, None::<&str>)?;
            let m_quit = MenuItem::with_id(&handle, "quit", l_quit, true, None::<&str>)?;
            let menu = Menu::with_items(&handle, &[&m_new, &m_quick, &m_quit])?;
            *handle.state::<TrayItems>().0.lock().unwrap() = Some((m_new.clone(), m_quick.clone(), m_quit.clone()));

            let mut tray = TrayIconBuilder::with_id("toodly-tray")
                .tooltip("toodly")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "new_window" => windows::spawn_new_window(app, None),
                    "quick_task" => windows::show_quick(app),
                    "quit" => windows::quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        windows::restore_last_active_or_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(&handle)?;

            // --- Scorciatoia globale (Quick Add) -------------------------------
            let combo = if cfg!(target_os = "macos") {
                "Command+Shift+Space"
            } else {
                "Control+Shift+Space"
            };
            if let Err(e) = handle.global_shortcut().register(combo) {
                eprintln!("[toodly] impossibile registrare la scorciatoia globale {combo}: {e}");
            }

            // --- Finestre: ripristino dello stato salvato ----------------------
            windows::init_datasets(&handle);
            windows::create_quick_window(&handle);
            windows::restore_windows(&handle, launched_by_autostart);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("errore durante l'avvio di toodly")
        .run(|_app, event| {
            if let RunEvent::ExitRequested { code, api, .. } = event {
                // code == None: chiusa l'ultima finestra -> restiamo nel tray.
                // code == Some(_): uscita esplicita (menu "Esci").
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
