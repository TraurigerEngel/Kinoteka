use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const DB_FILENAME: &str = "kinoteka.sqlite3";
const BACKUP_KEEP: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupMeta {
    reason: String,
    created_at: String,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn file_stamp() -> String {
    Utc::now().format("%Y-%m-%dT%H-%M-%S-%3fZ").to_string()
}

fn source_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn portable_root() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(Path::to_path_buf)
}

fn is_cargo_build_output(root: &Path) -> bool {
    let Some(profile) = root.file_name().and_then(|x| x.to_str()) else { return false; };
    if profile != "release" && profile != "debug" { return false; }
    let Some(target) = root.parent() else { return false; };
    if target.file_name().and_then(|x| x.to_str()) != Some("target") { return false; }
    let Some(src_tauri) = target.parent() else { return false; };
    src_tauri.file_name().and_then(|x| x.to_str()) == Some("src-tauri")
}

fn root_for_data() -> PathBuf {
    if let Some(root) = portable_root() {
        if root.join("data").is_dir() || root.join("seed-data").is_dir() {
            return root;
        }
        if is_cargo_build_output(&root) {
            return source_root();
        }
        return root;
    }
    source_root()
}

fn database_path() -> Result<PathBuf, String> {
    let path = root_for_data().join("data").join(DB_FILENAME);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn seed_database_path() -> Option<PathBuf> {
    let seed = root_for_data().join("seed-data").join(DB_FILENAME);
    seed.is_file().then_some(seed)
}

fn backup_root() -> Result<PathBuf, String> {
    let root = root_for_data().join("data").join("backups");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn meta_path() -> Result<PathBuf, String> {
    Ok(backup_root()?.join("backup-meta.json"))
}

fn integrity_path(path: &Path) -> Result<bool, String> {
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    let result: String = db.query_row("PRAGMA integrity_check", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    Ok(result.eq_ignore_ascii_case("ok"))
}

fn valid_category(value: Option<&Value>) -> bool {
    matches!(value.and_then(Value::as_str), Some("Фильмы") | Some("Сериалы") | Some("Анимация"))
}

fn valid_year(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(v) => v.as_i64().map(|year| (1000..=9999).contains(&year)).unwrap_or(false),
    }
}

fn valid_item_rating(value: Option<&Value>) -> bool {
    matches!(value.and_then(Value::as_str), Some("Понравилось") | Some("Нормально") | Some("Не понравилось") | Some("Смотрю") | Some("Запланировано"))
}

fn valid_trash_rating(value: Option<&Value>) -> bool {
    valid_item_rating(value) || value.and_then(Value::as_str) == Some("Избранное")
}

fn state_semantics_valid(state: &Value) -> bool {
    let Some(items) = state.get("items").and_then(Value::as_array) else { return false; };
    let Some(favorites) = state.get("favorites").and_then(Value::as_array) else { return false; };
    let Some(trash) = state.get("trash").and_then(Value::as_array) else { return false; };

    let mut item_keys = std::collections::BTreeSet::new();
    for item in items {
        let Some(object) = item.as_object() else { return false; };
        let Some(name) = object.get("name").and_then(Value::as_str) else { return false; };
        if name.trim().is_empty() || !valid_category(object.get("category")) || !valid_year(object.get("year")) || !valid_item_rating(object.get("rating")) {
            return false;
        }
        let category = object.get("category").and_then(Value::as_str).unwrap_or_default();
        let year = object.get("year").and_then(Value::as_i64).map(|v| v.to_string()).unwrap_or_default();
        item_keys.insert(format!("{}::{}::{}", category, name, year));
    }

    let mut favorite_keys = std::collections::BTreeSet::new();
    for favorite in favorites {
        let Some(key) = favorite.as_str() else { return false; };
        if key.trim().is_empty() || !item_keys.contains(key) || !favorite_keys.insert(key.to_string()) {
            return false;
        }
    }

    for entry in trash {
        let Some(object) = entry.as_object() else { return false; };
        let name = object.get("game").or_else(|| object.get("name")).and_then(Value::as_str).unwrap_or_default();
        if name.trim().is_empty()
            || object.get("id").and_then(Value::as_i64).map(|id| id > 0) != Some(true)
            || !valid_category(object.get("category"))
            || !valid_year(object.get("year"))
            || !valid_trash_rating(object.get("rating"))
            || !matches!(object.get("favorite"), Some(Value::Bool(_))) {
            return false;
        }
    }
    true
}

fn ui_semantics_valid(ui: &Value) -> bool {
    let Some(object) = ui.as_object() else { return false; };
    for key in ["search", "sort", "quickFilter", "mediaCategory", "mediaYear"] {
        if !object.get(key).map(Value::is_string).unwrap_or(false) { return false; }
    }
    matches!(object.get("sort").and_then(Value::as_str), Some("game-asc") | Some("game-desc"))
        && matches!(object.get("mediaCategory").and_then(Value::as_str), Some("Все") | Some("Фильмы") | Some("Сериалы") | Some("Анимация"))
}

fn schema_and_payload_valid(path: &Path) -> Result<bool, String> {
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    for table in ["state", "ui_state"] {
        let exists: Option<String> = db.query_row(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?1",
            params![table],
            |r| r.get(0),
        ).ok();
        if exists.is_none() { return Ok(false); }
    }
    let raw: String = match db.query_row("SELECT payload FROM state WHERE id=1", [], |r| r.get(0)) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };
    let state: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };
    if !state.is_object()
        || state.get("app").and_then(Value::as_str) != Some("Кинотека")
        || state.get("formatVersion").and_then(Value::as_i64) != Some(1)
        || !state_semantics_valid(&state) {
        return Ok(false);
    }
    let ui_raw: String = match db.query_row("SELECT payload FROM ui_state WHERE id=1", [], |r| r.get(0)) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };
    let ui: Value = match serde_json::from_str(&ui_raw) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };
    Ok(ui_semantics_valid(&ui))
}

fn database_valid(path: &Path) -> bool {
    integrity_path(path).unwrap_or(false) && schema_and_payload_valid(path).unwrap_or(false)
}

fn has_active_wal(path: &Path) -> bool {
    fs::metadata(PathBuf::from(format!("{}-wal", path.display())))
        .map(|m| m.len() > 0)
        .unwrap_or(false)
}

fn checkpoint(path: &Path) -> Result<(), String> {
    let db = Connection::open(path).map_err(|e| e.to_string())?;
    let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    drop(db);
    if has_active_wal(path) {
        return Err(format!("SQLite WAL всё ещё активен: {}", path.display()));
    }
    Ok(())
}

fn read_catalog() -> BTreeMap<String, BackupMeta> {
    let Ok(path) = meta_path() else { return BTreeMap::new(); };
    let Ok(text) = fs::read_to_string(path) else { return BTreeMap::new(); };
    serde_json::from_str(&text).unwrap_or_default()
}

fn replace_file_cross_platform(tmp: &Path, target: &Path) -> Result<(), String> {
    if !target.exists() {
        return fs::rename(tmp, target).map_err(|e| e.to_string());
    }
    let old = target.with_file_name(format!(
        ".{}.old-{}-{}",
        target.file_name().and_then(|x| x.to_str()).unwrap_or("kinoteka"),
        std::process::id(),
        Utc::now().timestamp_millis()
    ));
    fs::rename(target, &old).map_err(|e| e.to_string())?;
    match fs::rename(tmp, target) {
        Ok(()) => {
            let _ = fs::remove_file(&old);
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&old, target);
            Err(error.to_string())
        }
    }
}

fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_file_name(format!(
        ".{}.tmp-{}-{}",
        path.file_name().and_then(|x| x.to_str()).unwrap_or("kinoteka"),
        std::process::id(),
        Utc::now().timestamp_millis()
    ));
    let mut file = OpenOptions::new().create_new(true).write(true).open(&tmp).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        replace_file_cross_platform(&tmp, path)
    })();
    if result.is_err() { let _ = fs::remove_file(&tmp); }
    result
}

fn write_catalog(catalog: &BTreeMap<String, BackupMeta>) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(catalog).map_err(|e| e.to_string())?;
    write_bytes_atomic(&meta_path()?, &data)
}

fn copy_verified(source: &Path, target: &Path) -> Result<(), String> {
    if has_active_wal(source) {
        return Err(format!("Нельзя копировать SQLite с активным WAL: {}", source.display()));
    }
    if !database_valid(source) {
        return Err(format!("SQLite Кинотеки не прошла проверку: {}", source.display()));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(source, target).map_err(|e| e.to_string())?;
    if !database_valid(target) {
        let _ = fs::remove_file(target);
        return Err("Созданная копия SQLite не прошла повторную проверку.".into());
    }
    Ok(())
}

fn create_backup(reason: &str) -> Result<(), String> {
    let source = database_path()?;
    if !source.is_file() { return Ok(()); }
    checkpoint(&source)?;
    if !database_valid(&source) {
        return Err("Нельзя создать резервную копию повреждённой базы Кинотеки.".into());
    }

    let root = backup_root()?;
    let mut name = format!("kinoteka_{}.sqlite3", file_stamp());
    let mut index = 1usize;
    while root.join(&name).exists() {
        name = format!("kinoteka_{}_{}.sqlite3", file_stamp(), index);
        index += 1;
    }
    copy_verified(&source, &root.join(&name))?;

    let mut catalog = read_catalog();
    catalog.insert(name.clone(), BackupMeta { reason: reason.to_string(), created_at: now_iso() });
    let mut items: Vec<(String, BackupMeta)> = catalog.iter().map(|(k,v)|(k.clone(),v.clone())).collect();
    items.sort_by(|a,b| b.1.created_at.cmp(&a.1.created_at));
    for (old, _) in items.into_iter().skip(BACKUP_KEEP) {
        let _ = fs::remove_file(root.join(&old));
        catalog.remove(&old);
    }
    write_catalog(&catalog)
}

fn latest_valid_backup() -> Result<Option<PathBuf>, String> {
    let root = backup_root()?;
    let mut files: Vec<PathBuf> = fs::read_dir(&root).map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("sqlite3")).unwrap_or(false))
        .collect();
    files.sort_by(|a,b| b.file_name().cmp(&a.file_name()));
    for path in files {
        if !has_active_wal(&path) && database_valid(&path) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn replace_live_from(source: &Path) -> Result<(), String> {
    let target = database_path()?;
    let tmp = target.with_file_name(format!("{}.restore-{}.tmp", DB_FILENAME, Utc::now().timestamp_millis()));
    copy_verified(source, &tmp)?;
    let old = target.with_file_name(format!("{}.rollback-{}", DB_FILENAME, Utc::now().timestamp_millis()));
    if target.exists() { fs::rename(&target, &old).map_err(|e| e.to_string())?; }
    match fs::rename(&tmp, &target) {
        Ok(()) => {
            if !database_valid(&target) {
                let _ = fs::remove_file(&target);
                if old.exists() { let _ = fs::rename(&old, &target); }
                return Err("Восстановленная база не прошла проверку Кинотеки.".into());
            }
            let _ = fs::remove_file(&old);
            Ok(())
        }
        Err(error) => {
            if old.exists() { let _ = fs::rename(&old, &target); }
            let _ = fs::remove_file(&tmp);
            Err(error.to_string())
        }
    }
}

fn ensure_auto_vacuum() -> Result<(), String> {
    let path = database_path()?;
    if !path.is_file() { return Ok(()); }
    let db = Connection::open(&path).map_err(|e| e.to_string())?;
    let mode: i64 = db.query_row("PRAGMA auto_vacuum", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if mode != 1 {
        db.execute_batch("PRAGMA journal_mode=DELETE; PRAGMA auto_vacuum=FULL; VACUUM; PRAGMA optimize;")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn ensure_database() -> Result<(), String> {
    let live = database_path()?;
    if live.is_file() && database_valid(&live) {
        let _ = checkpoint(&live);
        let _ = ensure_auto_vacuum();
        return Ok(());
    }

    if live.is_file() {
        let recovery = backup_root()?.join("recovery");
        fs::create_dir_all(&recovery).map_err(|e| e.to_string())?;
        let _ = fs::copy(&live, recovery.join(format!("kinoteka_corrupt_{}.sqlite3", file_stamp())));
    }

    if let Some(backup) = latest_valid_backup()? {
        replace_live_from(&backup)?;
        let _ = ensure_auto_vacuum();
        return Ok(());
    }
    if let Some(seed) = seed_database_path() {
        replace_live_from(&seed)?;
        let _ = ensure_auto_vacuum();
        return Ok(());
    }
    Err("Не найдена рабочая, резервная или seed-база Кинотеки.".into())
}

fn open_readonly() -> Result<Connection, String> {
    let db = Connection::open_with_flags(database_path()?, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA busy_timeout=5000;").map_err(|e| e.to_string())?;
    Ok(db)
}

fn open_rw() -> Result<Connection, String> {
    let db = Connection::open(database_path()?).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;").map_err(|e| e.to_string())?;
    Ok(db)
}

pub fn persist_movies(state_raw: &str, ui_raw: Option<&str>, reason: &str, make_backup: bool) -> Result<(), String> {
    let mut state: Value = serde_json::from_str(state_raw).map_err(|_| "Некорректное состояние Кинотеки.".to_string())?;
    if !state.is_object()
        || state.get("app").and_then(Value::as_str) != Some("Кинотека")
        || state.get("formatVersion").and_then(Value::as_i64) != Some(1)
        || !state_semantics_valid(&state) {
        return Err("Некорректное состояние Кинотеки.".into());
    }
    if make_backup { create_backup(reason)?; }

    let ui_value = if let Some(raw) = ui_raw {
        let value: Value = serde_json::from_str(raw).map_err(|_| "Некорректные настройки интерфейса.".to_string())?;
        if !ui_semantics_valid(&value) { return Err("Некорректные настройки интерфейса.".into()); }
        Some(value)
    } else {
        state.get("uiState").cloned().filter(ui_semantics_valid)
    };
    if let Some(object) = state.as_object_mut() { object.remove("uiState"); }
    let payload = serde_json::to_string(&state).map_err(|e| e.to_string())?;

    let mut db = open_rw()?;
    db.execute_batch("PRAGMA journal_mode=DELETE;").map_err(|e| e.to_string())?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let revision: i64 = tx.query_row("SELECT revision FROM state WHERE id=1", [], |r| r.get(0)).unwrap_or(0);
    let now = now_iso();
    tx.execute(
        "UPDATE state SET revision=?1,updated_at=?2,payload=?3 WHERE id=1",
        params![revision + 1, now, payload],
    ).map_err(|e| e.to_string())?;
    if let Some(ui) = ui_value {
        tx.execute(
            "INSERT INTO ui_state(id,updated_at,payload) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload",
            params![now_iso(), serde_json::to_string(&ui).map_err(|e|e.to_string())?],
        ).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn persist_ui(ui_raw: &str) -> Result<(), String> {
    let ui: Value = serde_json::from_str(ui_raw).map_err(|_| "Некорректные настройки интерфейса.".to_string())?;
    if !ui_semantics_valid(&ui) { return Err("Некорректные настройки интерфейса.".into()); }
    let db = open_rw()?;
    db.execute(
        "INSERT INTO ui_state(id,updated_at,payload) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload",
        params![now_iso(), serde_json::to_string(&ui).map_err(|e|e.to_string())?],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn read_state() -> Result<Value, String> {
    let db = open_readonly()?;
    let state: String = db.query_row("SELECT payload FROM state WHERE id=1", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let ui: Option<String> = db.query_row("SELECT payload FROM ui_state WHERE id=1", [], |r| r.get(0)).ok();
    Ok(json!({"state": state, "ui": ui}))
}
