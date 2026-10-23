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
fn poster_exists_batch(keys: Vec<String>) -> Result<Vec<bool>, String> { posters::exists_batch(keys) }

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

// Hotfix 39/46/47/48/49: keep the auto-hidden bottom taskbar hot-edge accessible.
// Windows 11 maximized undecorated windows can have an invisible 8px resize
// frame. SetWindowPos at (monitor.left, monitor.top) placed the visible content
// *inside* the screen, exposing the desktop down the left side. Compensate
// using DWM's real visible frame bounds, without guessing a fixed frame size.
// Only maximized windows with the bottom auto-hidden taskbar are adjusted.
#[cfg(windows)]
mod taskbar_autohide {
    use std::{ffi::c_void, mem::size_of, ptr::null_mut, sync::atomic::{AtomicBool, Ordering}};
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
        fn GetWindowLongPtrW(hwnd: *mut c_void, index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: *mut c_void, index: i32, value: isize) -> isize;
    }
    #[link(name = "shell32")]
    unsafe extern "system" {
        fn SHAppBarMessage(message: u32, data: *mut AppBarData) -> usize;
    }
    #[link(name = "dwmapi")]
    unsafe extern "system" {
        fn DwmGetWindowAttribute(hwnd: *mut c_void, attribute: u32,
                                 value: *mut c_void, size: u32) -> i32;
        fn DwmSetWindowAttribute(hwnd: *mut c_void, attribute: u32,
                                 value: *const c_void, size: u32) -> i32;
    }

    const ABM_GETSTATE: u32 = 0x0000_0004;
    const ABM_GETTASKBARPOS: u32 = 0x0000_0005;
    const ABM_GETAUTOHIDEBAREX: u32 = 0x0000_000B;
    const ABS_AUTOHIDE: usize = 0x1;
    const ABE_BOTTOM: u32 = 3;
    const SWP_NOZORDER_NOACTIVATE: u32 = 0x0004 | 0x0010;
    const DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWCP_DONOTROUND: u32 = 1;
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;
    const GWL_STYLE: i32 = -16;
    const WS_THICKFRAME: isize = 0x0004_0000;
    const WS_BORDER: isize = 0x0080_0000;
    const WS_DLGFRAME: isize = 0x0040_0000;
    const SWP_FRAMECHANGED_NOMOVE_NOSIZE: u32 = 0x0020 | 0x0002 | 0x0001 | SWP_NOZORDER_NOACTIVATE;
    // Minimum visible bottom-edge gap retained from HF39/HF46.
    const GAP_PX: i32 = 2;
    // HF47: The shell needs an exposed physical edge *outside the native HWND*.
    // In HF46, adding the invisible DWM bottom frame to GAP_PX could make the
    // underlying HWND overlap the taskbar trigger even when its visible pixels
    // stopped 2px short. Leave an independent, unoccupied native strip.
    const TASKBAR_NATIVE_GAP_PX: i32 = 4;
    // Guard against faulty/mismatched DWM coordinates, e.g. DPI virtualization.
    const MAX_FRAME_PX: i32 = 32;
    // HF48: Windows 11 may suppress auto-hide activation when a frameless
    // maximized window is manually repositioned (HF39–HF47). Keep an ordinary
    // non-maximized native HWND covering the monitor (except the hot edge).
    // It looks maximized but avoids IsZoomed/fullscreen shell heuristics.
    static COMPAT_WINDOW: AtomicBool = AtomicBool::new(false);
    // Window style changes raise resize/focus events synchronously. Avoid a
    // nested apply, which could otherwise recursively unmaximize/reposition.
    static APPLYING: AtomicBool = AtomicBool::new(false);
    struct ApplyGuard;
    impl Drop for ApplyGuard {
        fn drop(&mut self) { APPLYING.store(false, Ordering::Release); }
    }

    // HF49: make the HWND truly frameless, not just visually undecorated.
    // Windows' WS_THICKFRAME/WS_CAPTION may reserve ~8 physical pixels below
    // the DWM content. HF48 intentionally stops the HWND 4px above the bottom;
    // retaining the hidden frame caused ~12px of visible desktop there.
    // Only run in the HF48 non-maximized compatibility mode, and allow the old
    // behavior for A/B testing with KINOTEKA_TASKBAR_MODE=hf48.
    fn remove_native_frame(hwnd: *mut c_void) -> bool {
        let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
        if style == 0 { return false; }
        let without_frame = style & !(WS_THICKFRAME | WS_BORDER | WS_DLGFRAME);
        if without_frame != style {
            let previous = unsafe { SetWindowLongPtrW(hwnd, GWL_STYLE, without_frame) };
            if previous == 0 {
                eprintln!("[Kinoteka] cannot disable non-client resize border");
                return false;
            }
            let ok = unsafe { SetWindowPos(hwnd, null_mut(), 0, 0, 0, 0,
                SWP_FRAMECHANGED_NOMOVE_NOSIZE) };
            if ok == 0 {
                eprintln!("[Kinoteka] non-client frame recalculation failed");
                return false;
            }
        }
        // Windows 11: opt out of DWM rounded corners / 1px visual outline.
        // Unsupported OS versions may reject these optional hints safely.
        let corner = DWMWCP_DONOTROUND;
        let border = DWMWA_COLOR_NONE;
        unsafe {
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE,
                (&corner as *const u32).cast(), size_of::<u32>() as u32);
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR,
                (&border as *const u32).cast(), size_of::<u32>() as u32);
        }
        true
    }

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

    // Compute the native window rectangle from its actually visible DWM frame.
    // When the invisible left/right borders are 8px, the HWND must occupy
    // (-8..screenWidth+8), so its visible content reaches both screen edges.
    fn target_rect(m: Rect, current: Rect, visual: Rect) -> Option<Rect> {
        let margins = [visual.left - current.left, visual.top - current.top,
                       current.right - visual.right, current.bottom - visual.bottom];
        if margins.iter().any(|v| *v < 0 || *v > MAX_FRAME_PX) { return None; }
        // Don't resize an unrelated window or a window partly on another monitor.
        if (visual.left - m.left).abs() > MAX_FRAME_PX
            || (visual.top - m.top).abs() > MAX_FRAME_PX
            || (visual.right - m.right).abs() > MAX_FRAME_PX
            || (visual.bottom - m.bottom).abs() > MAX_FRAME_PX { return None; }
        // The visible-frame correction alone cannot guarantee hover access:
        // native invisible bottom borders can still cover the shell hot-edge.
        // Constrain the HWND itself to end above the physical monitor bottom.
        // A few physical pixels are reserved only while auto-hide is active.
        let visual_limit = m.bottom - GAP_PX + margins[3];
        let native_limit = m.bottom - TASKBAR_NATIVE_GAP_PX;
        Some(Rect {
            left: m.left - margins[0],
            top: m.top - margins[1],
            right: m.right + margins[2],
            bottom: visual_limit.min(native_limit),
        })
    }

    fn apply_legacy(window: &WebviewWindow) {
        let Ok(native) = window.hwnd() else { return; };
        let hwnd = native.0 as *mut c_void;
        if unsafe { IsZoomed(hwnd) } == 0 { return; }
        let monitor = unsafe { MonitorFromWindow(hwnd, 2) }; // MONITOR_DEFAULTTONEAREST
        if monitor.is_null() { return; }
        let mut info = MonitorInfo { cb_size: size_of::<MonitorInfo>() as u32,
            ..Default::default() };
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 { return; }
        if !taskbar_is_autohidden_at_bottom(info.monitor) { return; }
        let m = info.monitor;
        if m.right - m.left < 780 || m.bottom - m.top < 620 + GAP_PX { return; }

        let mut current = Rect::default();
        if unsafe { GetWindowRect(hwnd, &mut current) } == 0 { return; }
        let mut visual = Rect::default();
        let hr = unsafe { DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS,
            (&mut visual as *mut Rect).cast(), size_of::<Rect>() as u32) };
        // No assumption about NC frame width; never recreate the left-hand gap
        // by falling back to a hard-coded monitor-aligned SetWindowPos.
        // HF47 also avoids native bottom-frame overlap with the taskbar edge.
        if hr != 0 { return; }
        let Some(target) = target_rect(m, current, visual) else { return; };
        if current.left == target.left && current.top == target.top
            && current.right == target.right && current.bottom == target.bottom { return; }
        let ok = unsafe { SetWindowPos(hwnd, null_mut(), target.left, target.top,
            target.right - target.left, target.bottom - target.top,
            SWP_NOZORDER_NOACTIVATE) };
        if ok == 0 { eprintln!("[Kinoteka] taskbar frame correction rejected by Windows"); }
    }

    // Normal-window target does not require the current DWM visual bounds to
    // touch the monitor: unmaximize() first restores a 1040x820 window.
    fn compatible_target(m: Rect, current: Rect, visual: Rect) -> Option<Rect> {
        let margins = [visual.left - current.left, visual.top - current.top,
                       current.right - visual.right, current.bottom - visual.bottom];
        if margins.iter().any(|v| *v < 0 || *v > MAX_FRAME_PX) { return None; }
        // Stable HF51: preserve two real screen pixels for the auto-hide taskbar
        // instead of the four reserved by HF49. Restore HF49's proven 4px gap
        // with KINOTEKA_TASKBAR_GAP_PX=4 (no reinstall or source change).
        // The older TASKBAR_NATIVE_GAP_PX remains untouched for legacy mode.
        let bottom = m.bottom - TASKBAR_NATIVE_GAP_PX;
        let bottom = if std::env::var("KINOTEKA_TASKBAR_GAP_PX").ok().as_deref() == Some("4") {
            bottom
        } else {
            bottom + 2
        };
        if m.right - m.left < 780 || bottom - m.top < 620 { return None; }
        Some(Rect {
            left: m.left - margins[0],
            top: m.top - margins[1],
            right: m.right + margins[2],
            bottom,
        })
    }

    pub fn apply(window: &WebviewWindow) {
        // Temporary A/B fallback without reinstalling or changing files:
        // $env:KINOTEKA_TASKBAR_MODE='legacy'; & '...\Kinoteka.exe'
        if std::env::var("KINOTEKA_TASKBAR_MODE").ok().as_deref() == Some("legacy") {
            apply_legacy(window);
            return;
        }
        let mode = std::env::var("KINOTEKA_TASKBAR_MODE").unwrap_or_default();
        if APPLYING.swap(true, Ordering::AcqRel) { return; }
        let _guard = ApplyGuard;
        let Ok(native) = window.hwnd() else { return; };
        let hwnd = native.0 as *mut c_void;
        let monitor = unsafe { MonitorFromWindow(hwnd, 2) };
        if monitor.is_null() { return; }
        let mut info = MonitorInfo { cb_size: size_of::<MonitorInfo>() as u32,
            ..Default::default() };
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 { return; }
        if !taskbar_is_autohidden_at_bottom(info.monitor) { return; }

        // Do not affect an unrelated user-restored window. Once HF48 takes
        // ownership, focus/resize events can safely reapply its geometry.
        let maximized = unsafe { IsZoomed(hwnd) } != 0;
        if !maximized && !COMPAT_WINDOW.load(Ordering::Acquire) { return; }
        if maximized {
            if let Err(error) = window.unmaximize() {
                eprintln!("[Kinoteka] native compatibility unmaximize failed: {error}");
                return;
            }
        }
        // HF49 runs only in normal mode. An opt-in HF48 compatibility switch
        // skips the style change for comparison without another download.
        if mode != "hf48" && !remove_native_frame(hwnd) { return; }
        let mut current = Rect::default();
        if unsafe { GetWindowRect(hwnd, &mut current) } == 0 { return; }
        let mut visual = Rect::default();
        let hr = unsafe { DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS,
            (&mut visual as *mut Rect).cast(), size_of::<Rect>() as u32) };
        if hr != 0 { return; }
        let Some(target) = compatible_target(info.monitor, current, visual) else { return; };
        if current.left != target.left || current.top != target.top
            || current.right != target.right || current.bottom != target.bottom {
            let ok = unsafe { SetWindowPos(hwnd, null_mut(), target.left, target.top,
                target.right - target.left, target.bottom - target.top,
                SWP_NOZORDER_NOACTIVATE) };
            if ok == 0 {
                eprintln!("[Kinoteka] taskbar compatible-window positioning rejected by Windows");
                return;
            }
        }
        COMPAT_WINDOW.store(true, Ordering::Release);
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
            poster_get, poster_exists_batch, poster_set, poster_remove, poster_clipboard_set,
            window_minimize, window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kinoteka Standalone");
}
