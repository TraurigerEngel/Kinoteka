mod storage;

use serde_json::{json, Value};
use tauri::{Manager, WebviewWindow};

#[tauri::command]
fn library_state() -> Result<Value, String> { storage::read_state() }

#[tauri::command]
fn persist_movies_state(state: String, ui: Option<String>, reason: Option<String>) -> Result<Value, String> {
    storage::persist_movies(&state, ui.as_deref(), reason.as_deref().unwrap_or("Изменено состояние Кинотеки"), true)?;
    Ok(json!({"ok":true}))
}

#[tauri::command]
fn persist_movies_ui(ui: String) -> Result<Value, String> {
    storage::persist_ui(&ui)?;
    Ok(json!({"ok":true}))
}

#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> { window.minimize().map_err(|e|e.to_string()) }

#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<(), String> { window.close().map_err(|e|e.to_string()) }

#[cfg(windows)]
fn configure_windows_webview(window: &WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows::core::Interface;

    if let Err(error) = window.with_webview(|webview| unsafe {
        let Ok(webview2) = webview.controller().CoreWebView2() else { return; };
        let Ok(settings) = webview2.Settings() else { return; };
        let _ = settings.SetAreDefaultContextMenusEnabled(false);
        if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
            let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
    }) {
        eprintln!("[Kinoteka] WebView2 hardening warning: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(error) = storage::ensure_database() {
                eprintln!("[Kinoteka] database recovery warning: {error}");
            }
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(windows)]
                configure_windows_webview(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library_state, persist_movies_state, persist_movies_ui,
            window_minimize, window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kinoteka Standalone");
}
