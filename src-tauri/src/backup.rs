//! Esportazione / importazione di tutti i dati in un unico file ZIP.
//!
//! Struttura dello ZIP:
//!   manifest.json                       metadati, layout delle finestre, preferenze locali
//!   workspaces/<id>.json                dump di tutte le tabelle di uno spazio dati (finestra)
//!   attachments/<id>/<allegato>/<nome>  file allegati

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
pub struct WorkspaceDump {
    pub id: String,
    pub data: String,
}

#[derive(Deserialize)]
pub struct AttachmentRef {
    pub ws: String,
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct BackupContent {
    pub manifest: String,
    pub workspaces: Vec<WorkspaceOut>,
}

#[derive(Serialize)]
pub struct WorkspaceOut {
    pub id: String,
    pub data: String,
}

#[derive(Deserialize)]
pub struct ExtractRef {
    pub ws: String,
    pub id: String,
    pub task_id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct Extracted {
    pub id: String,
    pub path: String,
    pub size: u64,
}

fn safe_part(s: &str) -> String {
    let c: String = s
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' })
        .collect();
    let c = c.trim_matches('.').to_string();
    if c.is_empty() { "_".into() } else { c }
}

fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control() { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() { "allegato".into() } else { cleaned }
}

fn attachments_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("attachments");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn zip_opts() -> zip::write::SimpleFileOptions {
    zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated)
}

#[tauri::command]
pub async fn export_zip(
    dest: String,
    manifest: String,
    workspaces: Vec<WorkspaceDump>,
    attachments: Vec<AttachmentRef>,
) -> Result<u32, String> {
    let file = std::fs::File::create(&dest).map_err(|e| format!("impossibile creare il file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let o = zip_opts();
    zip.start_file("manifest.json", o).map_err(|e| e.to_string())?;
    zip.write_all(manifest.as_bytes()).map_err(|e| e.to_string())?;
    for w in &workspaces {
        zip.start_file(format!("workspaces/{}.json", safe_part(&w.id)), o).map_err(|e| e.to_string())?;
        zip.write_all(w.data.as_bytes()).map_err(|e| e.to_string())?;
    }
    let mut n = 0u32;
    for a in &attachments {
        let Ok(bytes) = std::fs::read(&a.path) else { continue }; // file mancante: si salta
        let entry = format!("attachments/{}/{}/{}", safe_part(&a.ws), safe_part(&a.id), safe_name(&a.name));
        zip.start_file(entry, o).map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
        n += 1;
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(n)
}

fn read_entry(zip: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Result<String, String> {
    let mut f = zip.by_name(name).map_err(|_| format!("MISSING_FILE:{name}"))?;
    let mut s = String::new();
    f.read_to_string(&mut s).map_err(|e| e.to_string())?;
    Ok(s)
}

/// Legge e valida lo ZIP: restituisce manifest e dump di ogni spazio dati.
#[tauri::command]
pub async fn read_backup(path: String) -> Result<BackupContent, String> {
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| "BAD_ZIP".to_string())?;
    let manifest = read_entry(&mut zip, "manifest.json").map_err(|_| "NOT_BACKUP".to_string())?;
    let v: serde_json::Value = serde_json::from_str(&manifest).map_err(|_| "BAD_MANIFEST".to_string())?;
    if v.get("app").and_then(|x| x.as_str()) != Some("toodly") {
        return Err("NOT_BACKUP".into());
    }
    // Prima cosa: la versione del formato di esportazione. Oggi esiste solo la 1;
    // una futura versione 2 potrà avere un lettore diverso (nuovo ramo del match).
    let version = v.get("formatVersion").and_then(|x| x.as_u64());
    match version {
        Some(1) => read_v1(&mut zip, manifest, &v),
        Some(n) => Err(format!("UNSUPPORTED_VERSION:{n}")),
        None => Err("NO_VERSION".into()),
    }
}

/// Lettore del formato di esportazione versione 1.
fn read_v1(zip: &mut zip::ZipArchive<std::fs::File>, manifest: String, v: &serde_json::Value) -> Result<BackupContent, String> {
    let ids: Vec<String> = v
        .get("workspaces")
        .and_then(|x| x.as_array())
        .map(|a| a.iter().filter_map(|i| i.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let mut workspaces = Vec::new();
    for id in ids {
        let data = read_entry(zip, &format!("workspaces/{}.json", safe_part(&id)))?;
        workspaces.push(WorkspaceOut { id, data });
    }
    Ok(BackupContent { manifest, workspaces })
}

/// Estrae gli allegati dallo ZIP nella cartella allegati dell'app (<task>/<nome>).
#[tauri::command]
pub async fn extract_attachments(app: AppHandle, path: String, items: Vec<ExtractRef>) -> Result<Vec<Extracted>, String> {
    let root = attachments_root(&app)?;
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for it in items {
        let entry = format!("attachments/{}/{}/{}", safe_part(&it.ws), safe_part(&it.id), safe_name(&it.name));
        let Ok(mut f) = zip.by_name(&entry) else { continue };
        let mut bytes = Vec::new();
        if f.read_to_end(&mut bytes).is_err() {
            continue;
        }
        let dir = root.join(safe_part(&it.task_id));
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let name = safe_name(&it.name);
        let mut dest = dir.join(&name);
        if dest.exists() {
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            dest = dir.join(format!("{stamp}-{name}"));
        }
        if std::fs::write(&dest, &bytes).is_ok() {
            out.push(Extracted { id: it.id, path: path_string(&dest), size: bytes.len() as u64 });
        }
    }
    Ok(out)
}

fn path_string(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_zip() {
        let dir = std::env::temp_dir().join(format!("toodly-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let att = dir.join("nota.txt");
        std::fs::write(&att, b"ciao").unwrap();
        let zip_path = dir.join("b.zip").to_string_lossy().to_string();
        let manifest = r#"{"app":"toodly","formatVersion":1,"workspaces":["d-1"]}"#.to_string();
        let n = tauri::async_runtime::block_on(export_zip(
            zip_path.clone(),
            manifest,
            vec![WorkspaceDump { id: "d-1".into(), data: r#"{"tasks":[]}"#.into() }],
            vec![AttachmentRef { ws: "d-1".into(), id: "a1".into(), name: "nota.txt".into(), path: att.to_string_lossy().to_string() }],
        ))
        .unwrap();
        assert_eq!(n, 1);
        let back = tauri::async_runtime::block_on(read_backup(zip_path.clone())).unwrap();
        assert_eq!(back.workspaces.len(), 1);
        assert_eq!(back.workspaces[0].id, "d-1");
        assert!(back.workspaces[0].data.contains("tasks"));
        // zip non toodly
        let bad = dir.join("bad.zip").to_string_lossy().to_string();
        std::fs::write(&bad, b"non e uno zip").unwrap();
        assert!(tauri::async_runtime::block_on(read_backup(bad)).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
