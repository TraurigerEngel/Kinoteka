mod storage;
mod posters;

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
fn poster_get(key: String) -> Result<Value, String> { posters::get(key) }

#[tauri::command]
fn poster_set(key: String, data_url: String, source: Option<Value>) -> Result<Value, String> { posters::set(key, data_url, source) }

#[tauri::command]
fn poster_remove(key: String) -> Result<Value, String> { posters::remove(key) }

// Read the Windows clipboard outside WebView2: no browser permission prompt.
// An STA Windows Forms clipboard reader handles CF_DIB/bitmap formats from browsers
// and screenshots, then the existing poster_set validator persists a bounded PNG.
#[tauri::command]
fn poster_clipboard_set(key: String) -> Result<Value, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        // Fixed script: never interpolate user input or filesystem paths into PowerShell.
        const SCRIPT: &str = r#"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $img=[System.Windows.Forms.Clipboard]::GetImage(); if($null -eq $img){[Console]::Error.Write('NO_IMAGE');exit 2}; try{$stream=New-Object System.IO.MemoryStream; try{$img.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png);$bytes=$stream.ToArray();if($bytes.Length -gt 5242880){[Console]::Error.Write('TOO_BIG');exit 3};[Console]::Out.Write([Convert]::ToBase64String($bytes))}finally{$stream.Dispose()}}finally{$img.Dispose()}"#;
        let system_root = std::env::var_os("SystemRoot")
            .unwrap_or_else(|| std::ffi::OsString::from(r"C:\Windows"));
        let powershell = std::path::PathBuf::from(system_root)
            .join("System32").join("WindowsPowerShell").join("v1.0").join("powershell.exe");
        let output = Command::new(powershell)
            .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command", SCRIPT])
            .creation_flags(CREATE_NO_WINDOW)
            .output().map_err(|_| "Не удалось запустить системное чтение буфера обмена.".to_string())?;
        if !output.status.success() {
            let reason = String::from_utf8_lossy(&output.stderr);
            if reason.contains("NO_IMAGE") { return Err("В буфере нет изображения.".into()); }
            if reason.contains("TOO_BIG") { return Err("Изображение из буфера больше 5 МБ.".into()); }
            return Err("Не удалось прочитать изображение из буфера Windows.".into());
        }
        if output.stdout.len() > 5 * 1024 * 1024 * 4 / 3 + 256 || output.stdout.is_empty() {
            return Err("Размер изображения из буфера недопустим.".into());
        }
        let encoded = std::str::from_utf8(&output.stdout)
            .map_err(|_| "Неверный формат изображения из буфера.".to_string())?;
        posters::set(key, format!("data:image/png;base64,{encoded}"), None)
    }
    #[cfg(not(windows))]
    {
        let _ = key;
        Err("Чтение буфера доступно только в Windows.".into())
    }
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

// Hotfix 39: leave the Windows auto-hide taskbar's bottom hot-edge accessible.
// Uses exactly the 2-PHYSICAL-pixel inset proven by the short Win32 diagnostic.
// No subprocesses, registry writes, global hooks or changes to Tauri startup
// visibility/maximized settings. Other taskbar configurations are untouched.
#[cfg(windows)]
mod taskbar_autohide {
    use std::{ffi::c_void, mem::size_of, ptr::null_mut};
    use tauri::WebviewWindow;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct Rect { left: i32, top: i32, right: i32, bottom: i32 }

    #[repr(C)]
    #[derive(Default)]
    struct MonitorInfo { cb_size: u32, monitor: Rect, work: Rect, flags: u32 }

    #[repr(C)]
    #[derive(Default)]
    struct AppBarData {
        cb_size: u32,
        hwnd: *mut c_void,
        callback: u32,
        edge: u32,
        rect: Rect,
        lparam: isize,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn MonitorFromWindow(hwnd: *mut c_void, flags: u32) -> *mut c_void;
        fn GetMonitorInfoW(monitor: *mut c_void, info: *mut MonitorInfo) -> i32;
        fn GetWindowRect(hwnd: *mut c_void, rect: *mut Rect) -> i32;
        fn SetWindowPos(hwnd: *mut c_void, after: *mut c_void, x: i32, y: i32,
                        cx: i32, cy: i32, flags: u32) -> i32;
        fn IsZoomed(hwnd: *mut c_void) -> i32;
    }
    #[link(name = "shell32")]
    unsafe extern "system" {
        fn SHAppBarMessage(message: u32, data: *mut AppBarData) -> usize;
    }

    const ABM_GETSTATE: u32 = 0x0000_0004;
    const ABM_GETTASKBARPOS: u32 = 0x0000_0005;
    const ABM_GETAUTOHIDEBAREX: u32 = 0x0000_000B;
    const ABS_AUTOHIDE: usize = 0x1;
    const ABE_BOTTOM: u32 = 3;
    const SWP_NOZORDER_NOACTIVATE: u32 = 0x0004 | 0x0010;
    const GAP_PX: i32 = 2;

    fn new_appbar(monitor: Rect) -> AppBarData {
        AppBarData { cb_size: size_of::<AppBarData>() as u32,
            edge: ABE_BOTTOM, rect: monitor, ..Default::default() }
    }

    fn taskbar_is_autohidden_at_bottom(monitor: Rect) -> bool {
        // ABM_GETAUTOHIDEBAREX is per-monitor (unlike ABM_GETAUTOHIDEBAR).
        // On some Windows 11 builds the EX query may return zero; in that case
        // accept the global state only if taskbar's bounds are on this monitor's
        // bottom edge. Never inset if taskbar auto-hide is disabled.
        let mut data = new_appbar(monitor);
        if unsafe { SHAppBarMessage(ABM_GETAUTOHIDEBAREX, &mut data) } != 0 {
            return true;
        }
        let mut state = new_appbar(monitor);
        if unsafe { SHAppBarMessage(ABM_GETSTATE, &mut state) } & ABS_AUTOHIDE == 0 {
            return false;
        }
        let mut position = new_appbar(monitor);
        if unsafe { SHAppBarMessage(ABM_GETTASKBARPOS, &mut position) } == 0 {
            return false;
        }
        position.edge == ABE_BOTTOM && position.rect.bottom >= monitor.bottom - 3
            && position.rect.right > monitor.left
            && position.rect.left < monitor.right
    }

    pub fn apply(window: &WebviewWindow) {
        let Ok(native) = window.hwnd() else { return; };
        let hwnd = native.0 as *mut c_void;
        // Only modify the application's original maximized frameless window.
        if unsafe { IsZoomed(hwnd) } == 0 { return; }
        let monitor = unsafe { MonitorFromWindow(hwnd, 2) }; // NEAREST
        if monitor.is_null() { return; }
        let mut info = MonitorInfo { cb_size: size_of::<MonitorInfo>() as u32,
            ..Default::default() };
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 { return; }
        if !taskbar_is_autohidden_at_bottom(info.monitor) { return; }
        let m = info.monitor;
        let width = m.right - m.left;
        let height = m.bottom - m.top;
        if width < 780 || height < 620 + GAP_PX { return; }
        let mut current = Rect::default();
        if unsafe { GetWindowRect(hwnd, &mut current) } == 0 { return; }
        // Avoid interference with restored/floating windows and repeated resize
        // events. Exactly matching the target is an idempotent no-op.
        if current.left == m.left && current.top == m.top
            && current.right == m.right && current.bottom == m.bottom - GAP_PX {
            return;
        }
        if current.left > m.left + GAP_PX || current.top > m.top + GAP_PX
            || current.right < m.right - GAP_PX || current.bottom < m.bottom - GAP_PX {
            return;
        }
        let ok = unsafe { SetWindowPos(hwnd, null_mut(), m.left, m.top,
            width, height - GAP_PX, SWP_NOZORDER_NOACTIVATE) };
        if ok == 0 { eprintln!("[Kinoteka] taskbar auto-hide inset was rejected by Windows"); }
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
                {
                    configure_windows_webview(&window);
                    taskbar_autohide::apply(&window);
                    // The Win32 inset survives normal drawing but may be reset
                    // by the OS after a minimize/restore or display change.
                    let observed = window.clone();
                    window.on_window_event(move |event| {
                        if matches!(event,
                            tauri::WindowEvent::Focused(true) | tauri::WindowEvent::Resized(_)) {
                            taskbar_autohide::apply(&observed);
                        }
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            library_state, persist_movies_state, persist_movies_ui,
            poster_get, poster_set, poster_remove, poster_clipboard_set,
            window_minimize, window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kinoteka Standalone");
}
