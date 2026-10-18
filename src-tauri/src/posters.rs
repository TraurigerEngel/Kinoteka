//! User-owned offline poster storage. No network, database modifications or path input.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use serde_json::{json, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_BYTES: usize = 5 * 1024 * 1024;
const MAX_KEY_BYTES: usize = 5000;

fn poster_root() -> PathBuf { super::storage::poster_directory() }

fn key_hash(key: &str) -> Result<String, String> {
    if key.trim().is_empty() || key.len() > MAX_KEY_BYTES || key.chars().any(|x| x.is_control()) {
        return Err("Некорректный идентификатор постера.".into());
    }
    if key.starts_with("imdb:") {
        let id = &key[5..];
        if !id.starts_with("tt") || id.len() < 6 || id.len() > 17 || !id[2..].bytes().all(|x| x.is_ascii_digit()) {
            return Err("Некорректный IMDb ID.".into());
        }
    } else if !key.starts_with("local:") { return Err("Неизвестный тип постера.".into()); }
    Ok(format!("{:x}", Sha256::digest(key.as_bytes())))
}

fn extension_and_mime(data: &[u8]) -> Result<(&'static str, &'static str), String> {
    if data.len() < 16 || data.len() > MAX_BYTES { return Err("Постер должен быть не больше 5 МБ.".into()); }
    if data.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) { return Ok(("png", "image/png")); }
    if data.starts_with(&[0xff, 0xd8, 0xff]) && data.ends_with(&[0xff, 0xd9]) { return Ok(("jpg", "image/jpeg")); }
    if &data[..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        let size = u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize;
        if size + 8 == data.len() { return Ok(("webp", "image/webp")); }
    }
    Err("Поддерживаются только корректные JPG, PNG и WebP.".into())
}

fn poster_file(root: &Path, hash: &str) -> Option<(PathBuf, &'static str)> {
    for (ext, mime) in [("webp", "image/webp"), ("jpg", "image/jpeg"), ("png", "image/png")] {
        let path = root.join(format!("{hash}.{ext}"));
        if path.is_file() { return Some((path, mime)); }
    }
    None
}

fn credit_file(root: &Path, hash: &str) -> PathBuf { root.join(format!("{hash}.credit.json")) }

fn checked_credit(input: Option<Value>) -> Result<Option<Value>, String> {
    let Some(v) = input else { return Ok(None); };
    let read = |key: &str, max: usize| -> Result<String, String> {
        let value = v.get(key).and_then(Value::as_str).ok_or("Нет обязательного поля лицензии.")?;
        if value.len() > max || value.chars().any(|ch| ch.is_control()) { return Err("Некорректные данные лицензии.".into()); }
        Ok(value.to_owned())
    };
    let source_url = read("sourceUrl", 600)?;
    let license_url = read("licenseUrl", 300)?;
    let license = read("license", 60)?;
    let author = read("author", 250)?;
    let title = read("title", 250)?;
    if !source_url.starts_with("https://commons.wikimedia.org/wiki/File:") ||
       !(license_url.starts_with("https://creativecommons.org/licenses/") || license_url.starts_with("https://creativecommons.org/publicdomain/")) ||
       !matches!(license.as_str(), "CC0" | "CC0 1.0" | "CC BY 1.0" | "CC BY 2.0" | "CC BY 2.5" | "CC BY 3.0" | "CC BY 4.0" | "CC BY-SA 1.0" | "CC BY-SA 2.0" | "CC BY-SA 2.5" | "CC BY-SA 3.0" | "CC BY-SA 4.0") || author.is_empty() {
        return Err("Недопустимый источник или лицензия изображения.".into());
    }
    Ok(Some(json!({"sourceUrl":source_url,"licenseUrl":license_url,"license":license,"author":author,"title":title})))
}

pub fn get(key: String) -> Result<Value, String> {
    let hash = key_hash(&key)?;
    let Some((path, mime)) = poster_file(&poster_root(), &hash) else { return Ok(json!({"exists": false})); };
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let (_, actual) = extension_and_mime(&bytes)?;
    if actual != mime { return Err("Файл постера повреждён.".into()); }
    let credit = fs::read(credit_file(&poster_root(), &hash)).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok());
    Ok(json!({"exists":true,"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(bytes)),"credit":credit}))
}

pub fn set(key: String, data_url: String, source: Option<Value>) -> Result<Value, String> {
    let credit = checked_credit(source)?;
    let hash = key_hash(&key)?;
    if data_url.len() > (MAX_BYTES * 4 / 3 + 256) { return Err("Слишком большой файл изображения.".into()); }
    let (mime, encoded) = data_url.split_once(";base64,").ok_or("Неверный формат изображения.")?;
    if !["data:image/png", "data:image/jpeg", "data:image/webp"].contains(&mime) { return Err("Недопустимый тип файла.".into()); }
    let bytes = STANDARD.decode(encoded).map_err(|_| "Не удалось прочитать изображение.")?;
    let (ext, actual) = extension_and_mime(&bytes)?;
    if mime.strip_prefix("data:") != Some(actual) { return Err("Формат файла не совпадает с содержимым.".into()); }
    let root = poster_root();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let dest = root.join(format!("{hash}.{ext}"));
    let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?.as_nanos();
    let pending = root.join(format!("{hash}.{}.{}.pending", std::process::id(), nonce));
    // Only one writer per poster; never trust client-supplied filenames or directories.
    let mut file = OpenOptions::new().write(true).create_new(true).open(&pending).map_err(|e| e.to_string())?;
    let write = file.write_all(&bytes).and_then(|_| file.sync_all()).map_err(|e| e.to_string());
    drop(file);
    if let Err(e) = write { let _ = fs::remove_file(&pending); return Err(e); }
    // Windows cannot rename over an existing file. Temporarily move it aside, restore on failure.
    let old = poster_file(&root, &hash).map(|(p, _)| p);
    let backup = root.join(format!("{hash}.previous"));
    if let Some(ref path) = old {
        if let Err(e) = fs::rename(path, &backup) { let _ = fs::remove_file(&pending); return Err(e.to_string()); }
    }
    if let Err(e) = fs::rename(&pending, &dest) {
        if let Some(path) = old { let _ = fs::rename(&backup, path); }
        let _ = fs::remove_file(&pending);
        return Err(e.to_string());
    }
    let _ = fs::remove_file(&backup);
    let credit_path = credit_file(&root, &hash);
    if let Some(ref credit) = credit {
        // Credit metadata lives alongside the image; no personal DB migration required.
        let tmp = root.join(format!("{hash}.credit.pending"));
        fs::write(&tmp, serde_json::to_vec(credit).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        if credit_path.is_file() { fs::remove_file(&credit_path).map_err(|e|e.to_string())?; }
        fs::rename(tmp, credit_path).map_err(|e|e.to_string())?;
    } else { let _ = fs::remove_file(credit_path); }
    Ok(json!({"ok":true,"dataUrl":format!("data:{actual};base64,{}",STANDARD.encode(&bytes)),"credit":credit}))
}

pub fn remove(key: String) -> Result<Value, String> {
    let hash = key_hash(&key)?;
    let root = poster_root();
    if let Some((path, _)) = poster_file(&root, &hash) {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    let _ = fs::remove_file(credit_file(&root, &hash));
    Ok(json!({"ok":true}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn key_and_content_validation() {
        assert!(key_hash("imdb:tt0816692").is_ok());
        assert!(key_hash("local:Фильмы::Interstellar::2014").is_ok());
        assert!(key_hash("../unsafe").is_err());
        assert!(key_hash("imdb:tt\n0000").is_err());
        assert!(extension_and_mime(b"<svg>some fake image</svg>").is_err());
        assert!(checked_credit(None).unwrap().is_none());
        assert!(checked_credit(Some(json!({"sourceUrl":"https://example.org","license":"CC BY 4.0","author":"a","title":"t","licenseUrl":"https://creativecommons.org/licenses/by/4.0/"}))).is_err());
    }
}
