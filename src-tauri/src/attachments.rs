//! Gestione degli allegati: i file vengono copiati in una cartella dedicata
//! dell'app (AppData / Application Support) e il percorso assoluto è salvato nel DB.

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
pub struct AttachmentInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("attachments");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control() { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() { "allegato".to_string() } else { cleaned }
}

/// Verifica che `path` sia davvero dentro la cartella allegati.
fn inside_root(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let root = root(app)?.canonicalize().map_err(|e| e.to_string())?;
    let p = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
    if p.starts_with(&root) {
        Ok(p)
    } else {
        Err("percorso fuori dalla cartella allegati".into())
    }
}

#[tauri::command]
pub async fn add_attachment(app: AppHandle, task_id: String, src: String) -> Result<AttachmentInfo, String> {
    let src_path = PathBuf::from(&src);
    let name = src_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or("nome file non valido")?;
    let name = sanitize(&name);

    let dir = root(&app)?.join(sanitize(&task_id));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let mut dest = dir.join(&name);
    if dest.exists() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        dest = dir.join(format!("{stamp}-{name}"));
    }
    let size = std::fs::copy(&src_path, &dest).map_err(|e| format!("copia fallita: {e}"))?;
    Ok(AttachmentInfo {
        path: dest.to_string_lossy().to_string(),
        name,
        size,
    })
}

#[tauri::command]
pub async fn delete_attachment_file(app: AppHandle, path: String) -> Result<(), String> {
    match inside_root(&app, &path) {
        Ok(p) => std::fs::remove_file(p).map_err(|e| e.to_string()),
        Err(_) => Ok(()), // già rimosso o non gestito da noi
    }
}

#[tauri::command]
pub async fn delete_task_attachments(app: AppHandle, task_id: String) -> Result<(), String> {
    let dir = root(&app)?.join(sanitize(&task_id));
    if dir.exists() {
        std::fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_attachment(app: AppHandle, path: String) -> Result<(), String> {
    let p = inside_root(&app, &path)?;
    app.opener()
        .open_path(p.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Apre un link esterno (solo http/https/mailto) nel browser di sistema.
#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let lower = url.to_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:")) {
        return Err("schema non consentito".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Scrive un file di testo scelto dall'utente (es. l'esportazione di una lista in Markdown).
#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
