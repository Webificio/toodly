//! Gestione multi-finestra: creazione, persistenza del layout, ripristino,
//! finestra di Quick Add e uscita dall'applicazione.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

pub const QUICK_LABEL: &str = "quick";
const DEFAULT_ROUTE: &str = "/?scope=today&mode=list";
const STATE_FILE: &str = "windows.json";
const DATASETS_FILE: &str = "datasets.json";
/// Ritardo (ms) con cui lo stato viene scritto su disco dopo una modifica.
const SAVE_DEBOUNCE_MS: u64 = 700;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WinState {
    pub label: String,
    pub route: String,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub w: Option<u32>,
    pub h: Option<u32>,
    #[serde(default)]
    pub maximized: bool,
    /// Set di dati (dataset) aperto nella finestra; None = da scegliere all'apertura.
    #[serde(default)]
    pub ws: Option<String>,
    /// Larghezza (px logici) della sidebar di questa finestra; None = predefinita.
    #[serde(default)]
    pub sidebar: Option<u32>,
}

/// Un set di dati: un database SQLite indipendente, salvato anche quando nessuna finestra lo usa.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Dataset {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct DatasetInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    /// Etichetta della finestra che lo sta usando (se aperto).
    pub window: Option<String>,
}

#[derive(Default)]
struct Inner {
    wins: Vec<WinState>,
    datasets: Vec<Dataset>,
    last_active: Option<String>,
}

#[derive(Default)]
pub struct AppState {
    inner: Mutex<Inner>,
    save_pending: AtomicBool,
    quitting: AtomicBool,
}

// ---------------------------------------------------------------------------
// Persistenza su file JSON (cartella dati dell'app)
// ---------------------------------------------------------------------------

fn state_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(STATE_FILE))
}

fn load_saved(app: &AppHandle) -> Vec<WinState> {
    state_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Vec<WinState>>(&s).ok())
        .unwrap_or_default()
}

/// Scrive subito il layout corrente di tutte le finestre aperte.
pub fn save_now(app: &AppHandle) {
    let wins = {
        let st = app.state::<AppState>();
        let g = st.inner.lock().unwrap();
        g.wins.clone()
    };
    if let Some(path) = state_path(app) {
        if let Ok(json) = serde_json::to_string_pretty(&wins) {
            let _ = std::fs::write(path, json);
        }
    }
}

/// Salvataggio con debounce: raggruppa le raffiche di eventi Moved/Resized.
fn schedule_save(app: &AppHandle) {
    let st = app.state::<AppState>();
    if st.save_pending.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(SAVE_DEBOUNCE_MS));
        app.state::<AppState>().save_pending.store(false, Ordering::SeqCst);
        if !app.state::<AppState>().quitting.load(Ordering::SeqCst) {
            save_now(&app);
        }
    });
}

// ---------------------------------------------------------------------------
// Tracciamento della geometria
// ---------------------------------------------------------------------------

/// Aggiorna posizione/dimensioni/stato massimizzato di una finestra tracciata.
pub fn capture_geometry(app: &AppHandle, label: &str) {
    if label == QUICK_LABEL {
        return;
    }
    let Some(win) = app.get_webview_window(label) else { return };
    // Da minimizzata Windows riporta coordinate fittizie (-32000): le ignoriamo.
    if win.is_minimized().unwrap_or(false) || win.is_fullscreen().unwrap_or(false) {
        return;
    }
    let maximized = win.is_maximized().unwrap_or(false);
    let geo = if maximized {
        None
    } else {
        match (win.outer_position(), win.inner_size()) {
            (Ok(p), Ok(s)) => Some((p.x, p.y, s.width, s.height)),
            _ => None,
        }
    };
    let st = app.state::<AppState>();
    let mut changed = false;
    {
        let mut g = st.inner.lock().unwrap();
        if let Some(ws) = g.wins.iter_mut().find(|w| w.label == label) {
            if ws.maximized != maximized {
                ws.maximized = maximized;
                changed = true;
            }
            if let Some((x, y, w, h)) = geo {
                if ws.x != Some(x) || ws.y != Some(y) || ws.w != Some(w) || ws.h != Some(h) {
                    ws.x = Some(x);
                    ws.y = Some(y);
                    ws.w = Some(w);
                    ws.h = Some(h);
                    changed = true;
                }
            }
        }
    }
    if changed {
        schedule_save(app);
    }
}

pub fn set_last_active(app: &AppHandle, label: &str) {
    if label == QUICK_LABEL {
        return;
    }
    let st = app.state::<AppState>();
    let mut g = st.inner.lock().unwrap();
    if g.wins.iter().any(|w| w.label == label) {
        g.last_active = Some(label.to_string());
    }
}

/// Chiamata quando una finestra viene distrutta.
pub fn forget_window(app: &AppHandle, label: &str) {
    if label == QUICK_LABEL {
        return;
    }
    let st = app.state::<AppState>();
    if st.quitting.load(Ordering::SeqCst) {
        // Chiusura dell'intera app: il layout è già stato salvato, va conservato.
        return;
    }
    {
        let mut g = st.inner.lock().unwrap();
        g.wins.retain(|w| w.label != label);
        if g.last_active.as_deref() == Some(label) {
            g.last_active = None;
        }
    }
    schedule_save(app);
}

// ---------------------------------------------------------------------------
// Creazione / ripristino finestre
// ---------------------------------------------------------------------------

fn position_is_visible(app: &AppHandle, x: i32, y: i32, w: u32, h: u32) -> bool {
    let Ok(monitors) = app.available_monitors() else { return true };
    if monitors.is_empty() {
        return true;
    }
    let (wx1, wy1) = (x as i64, y as i64);
    let (wx2, wy2) = (wx1 + w as i64, wy1 + h as i64);
    monitors.iter().any(|m| {
        let mp = m.position();
        let ms = m.size();
        let (mx1, my1) = (mp.x as i64, mp.y as i64);
        let (mx2, my2) = (mx1 + ms.width as i64, my1 + ms.height as i64);
        let ox = (wx2.min(mx2) - wx1.max(mx1)).max(0);
        let oy = (wy2.min(my2) - wy1.max(my1)).max(0);
        ox >= 120 && oy >= 80
    })
}

/// Identificatore univoco e stabile (non è un indice: non viene mai riutilizzato).
fn unique_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    static SEQ: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let seq = SEQ.fetch_add(1, Ordering::SeqCst);
    format!("{prefix}-{:x}{:04x}{:02x}", d.as_millis(), d.subsec_nanos() & 0xffff, seq & 0xff)
}

fn next_label(_app: &AppHandle) -> String {
    unique_id("w")
}

/// Nome del file database di un set ("main" = database storico di toodly).
pub fn db_file_name(id: &str) -> String {
    if id == "main" {
        "toodly.db".to_string()
    } else {
        format!("ds-{id}.db")
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() < 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn config_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok()
}

/// Elimina (best effort) i file SQLite di un set.
fn delete_db_files(app: &AppHandle, id: &str) {
    if !valid_id(id) {
        return;
    }
    let Some(dir) = config_dir(app) else { return };
    let base = db_file_name(id);
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let _ = std::fs::remove_file(dir.join(format!("{base}{suffix}")));
    }
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{secs}")
}

// ---------------------------------------------------------------------------
// Registro dei set di dati (datasets.json)
// ---------------------------------------------------------------------------

fn datasets_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(DATASETS_FILE))
}

fn save_datasets(app: &AppHandle) {
    let list = {
        let st = app.state::<AppState>();
        let g = st.inner.lock().unwrap();
        g.datasets.clone()
    };
    if let Some(p) = datasets_path(app) {
        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = std::fs::write(p, json);
        }
    }
}

fn default_dataset_name(app: &AppHandle) -> String {
    let en = app
        .path()
        .app_data_dir()
        .ok()
        .and_then(|d| std::fs::read_to_string(d.join("lang.txt")).ok())
        .map(|s| s.trim() == "en")
        .unwrap_or(false);
    if en { "Main data".into() } else { "Dati principali".into() }
}

/// Carica il registro; alla prima esecuzione dopo l'aggiornamento registra il database storico.
pub fn init_datasets(app: &AppHandle) {
    let loaded: Option<Vec<Dataset>> = datasets_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok());
    let mut list = loaded.clone().unwrap_or_default();
    if loaded.is_none() {
        let legacy = config_dir(app).map(|d| d.join("toodly.db").exists()).unwrap_or(false);
        if legacy {
            list.push(Dataset { id: "main".into(), name: default_dataset_name(app), created_at: now_iso() });
        }
    }
    {
        let st = app.state::<AppState>();
        st.inner.lock().unwrap().datasets = list;
    }
    save_datasets(app);
}

fn dataset_in_use(g: &Inner, id: &str, except_label: Option<&str>) -> bool {
    g.wins.iter().any(|w| w.ws.as_deref() == Some(id) && Some(w.label.as_str()) != except_label)
}

fn create_dataset_inner(app: &AppHandle, name: String) -> Dataset {
    let d = Dataset { id: unique_id("d"), name, created_at: now_iso() };
    {
        let st = app.state::<AppState>();
        st.inner.lock().unwrap().datasets.push(d.clone());
    }
    save_datasets(app);
    d
}

/// Stabilisce quale set apre una finestra.
/// - con un candidato (salvato o richiesto): lo usa se esiste e non è già aperto altrove;
/// - finestra nuova senza candidato: se è la prima finestra e c'è un solo set lo apre
///   (se non ce ne sono ne crea uno); altrimenti `None` → il frontend fa scegliere.
fn resolve_dataset(app: &AppHandle, label: &str, candidate: Option<String>, is_new: bool) -> Option<String> {
    if let Some(id) = candidate {
        let st = app.state::<AppState>();
        let g = st.inner.lock().unwrap();
        let exists = g.datasets.iter().any(|d| d.id == id);
        return if exists && !dataset_in_use(&g, &id, Some(label)) { Some(id) } else { None };
    }
    if !is_new {
        return None;
    }
    let (others, count, only) = {
        let st = app.state::<AppState>();
        let g = st.inner.lock().unwrap();
        let others = g.wins.iter().filter(|w| w.label != label).count();
        (others, g.datasets.len(), g.datasets.first().map(|d| d.id.clone()))
    };
    if others > 0 {
        return None;
    }
    match (count, only) {
        (0, _) => Some(create_dataset_inner(app, default_dataset_name(app)).id),
        (1, Some(id)) => {
            let st = app.state::<AppState>();
            let g = st.inner.lock().unwrap();
            if dataset_in_use(&g, &id, Some(label)) { None } else { Some(id) }
        }
        _ => None,
    }
}

/// Crea una finestra applicativa. Con `saved` ripristina posizione e dimensioni.
pub fn create_window(
    app: &AppHandle,
    label: Option<String>,
    route: Option<String>,
    saved: Option<&WinState>,
    dataset: Option<String>,
) -> tauri::Result<WebviewWindow> {
    let label = label.unwrap_or_else(|| next_label(app));
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(existing);
    }
    let route = route.unwrap_or_else(|| DEFAULT_ROUTE.to_string());
    // Finestre salvate prima dell'introduzione dei set: usavano il database storico.
    let candidate = match (&dataset, saved) {
        (Some(d), _) => Some(d.clone()),
        (None, Some(s)) => Some(s.ws.clone().unwrap_or_else(|| "main".to_string())),
        (None, None) => None,
    };
    let ws = resolve_dataset(app, &label, candidate, saved.is_none() && dataset.is_none());

    // Registra subito la finestra nello stato, così gli eventi iniziali vengono tracciati.
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        g.wins.retain(|w| w.label != label);
        g.wins.push(WinState {
            label: label.clone(),
            route: route.clone(),
            x: saved.and_then(|s| s.x),
            y: saved.and_then(|s| s.y),
            w: saved.and_then(|s| s.w),
            h: saved.and_then(|s| s.h),
            maximized: saved.map(|s| s.maximized).unwrap_or(false),
            ws: ws.clone(),
            sidebar: saved.and_then(|s| s.sidebar),
        });
        g.last_active = Some(label.clone());
    }

    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(route.into()))
        .title("toodly")
        .inner_size(1180.0, 780.0)
        .min_inner_size(820.0, 540.0)
        .visible(false)
        // Il drag&drop interno è gestito dal frontend (pointer events).
        .disable_drag_drop_handler()
        .build()?;

    let mut positioned = false;
    if let Some(s) = saved {
        if let (Some(w), Some(h)) = (s.w, s.h) {
            let _ = win.set_size(PhysicalSize::new(w, h));
            if let (Some(x), Some(y)) = (s.x, s.y) {
                if position_is_visible(app, x, y, w, h) {
                    let _ = win.set_position(PhysicalPosition::new(x, y));
                    positioned = true;
                }
            }
        }
        if s.maximized {
            let _ = win.maximize();
        }
    }
    if !positioned && !saved.map(|s| s.maximized).unwrap_or(false) {
        let _ = win.center();
    }

    // La finestra viene mostrata da `window_ready` quando la UI è pronta
    // (evita il flash bianco); fallback temporizzato se il frontend non risponde.
    let app2 = app.clone();
    let l2 = label.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(3500));
        if let Some(w) = app2.get_webview_window(&l2) {
            let _ = w.show();
        }
    });

    schedule_save(app);
    Ok(win)
}

pub fn restore_windows(app: &AppHandle, launched_by_autostart: bool) {
    let saved = load_saved(app)
        .into_iter()
        .filter(|w| w.label != QUICK_LABEL)
        .collect::<Vec<_>>();

    if saved.is_empty() {
        // Avvio automatico senza finestre salvate: si resta silenziosi nel tray.
        if !launched_by_autostart {
            let _ = create_window(app, None, None, None, None);
        }
        return;
    }

    for s in &saved {
        let _ = create_window(app, Some(s.label.clone()), Some(s.route.clone()), Some(s), None);
    }
}

/// Click sul tray / seconda istanza: riporta in primo piano l'ultima finestra attiva.
pub fn restore_last_active_or_main(app: &AppHandle) {
    let (last, first) = {
        let st = app.state::<AppState>();
        let g = st.inner.lock().unwrap();
        (g.last_active.clone(), g.wins.first().map(|w| w.label.clone()))
    };
    for label in [last, first].into_iter().flatten() {
        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
            return;
        }
    }
    spawn_new_window(app, None);
}

// ---------------------------------------------------------------------------
// Quick Add
// ---------------------------------------------------------------------------

pub fn create_quick_window(app: &AppHandle) {
    if app.get_webview_window(QUICK_LABEL).is_some() {
        return;
    }
    let res = WebviewWindowBuilder::new(app, QUICK_LABEL, WebviewUrl::App("/?quick=1".into()))
        .title("toodly Quick Add")
        .inner_size(680.0, 84.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .disable_drag_drop_handler()
        .build();
    if let Err(e) = res {
        eprintln!("[toodly] finestra quick add non creata: {e}");
    }
}

/// (finestra, set) di destinazione del Quick Add: l'ultima finestra attiva con dati assegnati.
fn quick_target(app: &AppHandle) -> Option<String> {
    let st = app.state::<AppState>();
    let g = st.inner.lock().unwrap();
    let with_ws = |l: &str| g.wins.iter().find(|w| w.label == l).and_then(|w| w.ws.clone());
    g.last_active
        .as_deref()
        .and_then(with_ws)
        .or_else(|| g.wins.iter().find_map(|w| w.ws.clone()))
}

pub fn show_quick(app: &AppHandle) {
    if app.get_webview_window(QUICK_LABEL).is_none() {
        create_quick_window(app);
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let Some(target) = quick_target(&app) else {
            // nessuna finestra con dati: ne apre una (l'utente sceglierà il set) e rinuncia al Quick Add
            restore_last_active_or_main(&app);
            return;
        };
        if let Some(w) = app.get_webview_window(QUICK_LABEL) {
            let _ = w.center();
            let _ = w.show();
            let _ = w.set_focus();
            let _ = app.emit_to(QUICK_LABEL, "quick-show", target);
        }
    });
}

// ---------------------------------------------------------------------------
// Uscita
// ---------------------------------------------------------------------------

/// `true` se `label` è l'unica finestra applicativa (Quick Add escluso) e l'app non sta già uscendo.
pub fn is_last_app_window(app: &AppHandle, label: &str) -> bool {
    if app.state::<AppState>().quitting.load(Ordering::SeqCst) {
        return false;
    }
    let others = app
        .webview_windows()
        .keys()
        .filter(|l| l.as_str() != QUICK_LABEL && l.as_str() != label)
        .count();
    others == 0
}

/// Risposta alla domanda «uscire o restare nella tray?» dopo la chiusura dell'ultima finestra.
#[tauri::command]
pub async fn close_choice(app: AppHandle, window: WebviewWindow, quit_app: bool) {
    if quit_app {
        quit(&app);
    } else {
        let _ = window.destroy();
    }
}

pub fn quit(app: &AppHandle) {
    let st = app.state::<AppState>();
    st.quitting.store(true, Ordering::SeqCst);
    save_now(app);
    app.exit(0);
}

// ---------------------------------------------------------------------------
// Comandi invocabili dal frontend
// ---------------------------------------------------------------------------

/// Su Windows creare finestre da un comando sincrono o dal thread principale può
/// bloccarsi: il comando è `async` e gli handler passano da `spawn_new_window`.
#[tauri::command]
pub async fn open_window(app: AppHandle, route: Option<String>, dataset: Option<String>) -> Result<(), String> {
    create_window(&app, None, route, None, dataset).map(|_| ()).map_err(|e| e.to_string())
}

/// Crea una nuova finestra su un thread separato (sicuro da menu, tray e shortcut).
pub fn spawn_new_window(app: &AppHandle, route: Option<String>) {
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = create_window(&app, None, route, None, None) {
            eprintln!("[toodly] impossibile creare la finestra: {e}");
        }
    });
}

/// Il frontend segnala la rotta corrente (vista, lista, modalità...) a ogni navigazione.
#[tauri::command]
pub fn report_route(app: AppHandle, window: WebviewWindow, route: String) {
    let label = window.label().to_string();
    if label == QUICK_LABEL {
        return;
    }
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        if let Some(ws) = g.wins.iter_mut().find(|w| w.label == label) {
            ws.route = route;
        }
    }
    schedule_save(&app);
}

/// Larghezza della sidebar salvata per la finestra chiamante (None = predefinita).
#[tauri::command]
pub fn window_sidebar(app: AppHandle, window: WebviewWindow) -> Option<u32> {
    let st = app.state::<AppState>();
    let g = st.inner.lock().unwrap();
    g.wins.iter().find(|w| w.label == window.label()).and_then(|w| w.sidebar)
}

/// Memorizza la larghezza della sidebar della finestra chiamante (salvata in windows.json).
#[tauri::command]
pub fn set_sidebar_width(app: AppHandle, window: WebviewWindow, width: u32) {
    let label = window.label().to_string();
    if label == QUICK_LABEL {
        return;
    }
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        match g.wins.iter_mut().find(|w| w.label == label) {
            Some(w) if w.sidebar != Some(width) => w.sidebar = Some(width),
            _ => return,
        }
    }
    schedule_save(&app);
}

#[tauri::command]
pub fn window_ready(window: WebviewWindow) {
    if window.label() == QUICK_LABEL {
        return;
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn hide_quick(app: AppHandle) {
    if let Some(w) = app.get_webview_window(QUICK_LABEL) {
        let _ = w.hide();
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    quit(&app);
}

/// Elenco delle finestre (= spazi dati) aperte, con layout e rotta.
#[tauri::command]
pub fn list_windows(app: AppHandle) -> Vec<WinState> {
    let st = app.state::<AppState>();
    let g = st.inner.lock().unwrap();
    g.wins.clone()
}

/// Elenco dei set di dati, con la finestra che li sta usando.
#[tauri::command]
pub fn list_datasets(app: AppHandle) -> Vec<DatasetInfo> {
    let st = app.state::<AppState>();
    let g = st.inner.lock().unwrap();
    g.datasets
        .iter()
        .map(|d| DatasetInfo {
            id: d.id.clone(),
            name: d.name.clone(),
            created_at: d.created_at.clone(),
            window: g.wins.iter().find(|w| w.ws.as_deref() == Some(d.id.as_str())).map(|w| w.label.clone()),
        })
        .collect()
}

/// Il nome è obbligatorio e univoco (senza distinzione tra maiuscole/minuscole).
fn validate_name(g: &Inner, name: &str, except_id: Option<&str>, ignore: &[String]) -> Result<String, String> {
    let n = name.trim().to_string();
    if n.is_empty() {
        return Err("NAME_REQUIRED".into());
    }
    let lower = n.to_lowercase();
    if g.datasets.iter().any(|d| Some(d.id.as_str()) != except_id && !ignore.contains(&d.id) && d.name.trim().to_lowercase() == lower) {
        return Err("NAME_TAKEN".into());
    }
    Ok(n)
}

#[tauri::command]
/// `ignore`: set in corso di sostituzione (non contano per l'univocità del nome).
pub fn create_dataset(app: AppHandle, name: String, ignore: Option<Vec<String>>) -> Result<Dataset, String> {
    let d = {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        let name = validate_name(&g, &name, None, &ignore.unwrap_or_default())?;
        let d = Dataset { id: unique_id("d"), name, created_at: now_iso() };
        g.datasets.push(d.clone());
        d
    };
    save_datasets(&app);
    Ok(d)
}

#[tauri::command]
pub fn rename_dataset(app: AppHandle, id: String, name: String) -> Result<(), String> {
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        let name = validate_name(&g, &name, Some(&id), &[])?;
        if let Some(d) = g.datasets.iter_mut().find(|d| d.id == id) {
            d.name = name;
        }
    }
    save_datasets(&app);
    Ok(())
}

/// Elimina un set (solo se non aperto in una finestra): il frontend ha già svuotato righe e allegati.
#[tauri::command]
pub fn remove_dataset(app: AppHandle, id: String) -> Result<(), String> {
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        if dataset_in_use(&g, &id, None) {
            return Err("set aperto in una finestra".into());
        }
        g.datasets.retain(|d| d.id != id);
    }
    save_datasets(&app);
    delete_db_files(&app, &id);
    Ok(())
}

/// Set assegnato alla finestra chiamante (None = deve scegliere).
#[tauri::command]
pub fn window_dataset(app: AppHandle, window: WebviewWindow) -> Option<String> {
    let st = app.state::<AppState>();
    let g = st.inner.lock().unwrap();
    g.wins.iter().find(|w| w.label == window.label()).and_then(|w| w.ws.clone())
}

/// Assegna alla finestra chiamante un set (che non sia aperto in un'altra finestra).
#[tauri::command]
pub fn assign_dataset(app: AppHandle, window: WebviewWindow, id: String) -> Result<(), String> {
    let label = window.label().to_string();
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        if !g.datasets.iter().any(|d| d.id == id) {
            return Err("set inesistente".into());
        }
        if dataset_in_use(&g, &id, Some(&label)) {
            return Err("set già aperto in un'altra finestra".into());
        }
        match g.wins.iter_mut().find(|w| w.label == label) {
            Some(w) => w.ws = Some(id),
            None => return Err("finestra non tracciata".into()),
        }
    }
    save_now(&app);
    Ok(())
}

/// Sostituisce il layout: chiude tutte le finestre correnti (senza conferma) e ricrea quelle indicate.
#[tauri::command]
pub async fn replace_layout(app: AppHandle, windows: Vec<WinState>, remove_datasets: Vec<String>) -> Result<(), String> {
    {
        let st = app.state::<AppState>();
        st.quitting.store(true, Ordering::SeqCst); // evita che la chiusura modifichi lo stato
        let mut g = st.inner.lock().unwrap();
        g.wins = windows.clone();
        g.last_active = windows.first().map(|w| w.label.clone());
    }
    save_now(&app);
    let new_labels: Vec<String> = windows.iter().map(|w| w.label.clone()).collect();
    for (label, w) in app.webview_windows() {
        if label != QUICK_LABEL && !new_labels.contains(&label) {
            let _ = w.destroy();
        }
    }
    app.state::<AppState>().quitting.store(false, Ordering::SeqCst);
    // i vecchi set (già svuotati dal frontend) vengono rimossi dal registro e dal disco
    {
        let st = app.state::<AppState>();
        let mut g = st.inner.lock().unwrap();
        g.datasets.retain(|d| !remove_datasets.contains(&d.id));
    }
    save_datasets(&app);
    for id in &remove_datasets {
        delete_db_files(&app, id);
    }
    for w in &windows {
        let _ = create_window(&app, Some(w.label.clone()), Some(w.route.clone()), Some(w), None);
    }
    Ok(())
}
