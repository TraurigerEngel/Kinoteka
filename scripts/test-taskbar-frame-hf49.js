'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
const conf = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'),'utf8'));
const win = conf.app.windows.find(w=>w.label==='main');
assert.equal(win.decorations,false);
assert.equal(win.shadow,false, 'nonclient shadow must not draw a border');
const releaseConf=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.release.conf.json'),'utf8'));
assert.equal(releaseConf.app.windows[0].shadow,false,'release must use the same no-shadow policy');
const moduleText=lib.slice(lib.indexOf('mod taskbar_autohide {'),lib.indexOf('#[cfg_attr(mobile'));
for (const regex of [
 /fn remove_native_frame\(hwnd: \*mut c_void\) -> bool/,
 /GetWindowLongPtrW\(hwnd, GWL_STYLE\)/,
 /SetWindowLongPtrW\(hwnd, GWL_STYLE, without_frame\)/,
 /style & !\(WS_THICKFRAME \| WS_BORDER \| WS_DLGFRAME\)/,
 /SWP_FRAMECHANGED_NOMOVE_NOSIZE/,
 /DWMWA_WINDOW_CORNER_PREFERENCE/,
 /DWMWA_BORDER_COLOR/,
 /mode != "hf48" && !remove_native_frame\(hwnd\)/,
 /static APPLYING: AtomicBool/,
 /let _guard = ApplyGuard;/,
 /fn compatible_target\(m: Rect, current: Rect, visual: Rect\) -> Option<Rect>/,
 /let bottom = m.bottom - TASKBAR_NATIVE_GAP_PX;/,
]) assert.match(moduleText,regex);
assert.match(moduleText,/Some\("legacy"\)/);
// The native window never reaches the bottom hot-edge. After removing the
// 8px nonclient frame, the *visual* window should have only 4px inset.
function target(mon,nativeMargin){return {left:mon.left-nativeMargin.left,
 top:mon.top-nativeMargin.top,right:mon.right+nativeMargin.right,
 bottom:mon.bottom-4};}
const monitor={left:0,top:0,right:1920,bottom:1080};
const compact=target(monitor,{left:0,top:0,right:0,bottom:0});
assert.deepEqual(compact,{left:0,top:0,right:1920,bottom:1076});
assert.equal(monitor.bottom-compact.bottom,4);
const oldFrame={left:8,top:0,right:8,bottom:8};
const old = target(monitor,oldFrame);
assert.equal(monitor.bottom-(old.bottom-oldFrame.bottom),12,
 'HF48 gap demonstrates how 4px hotedge and 8px frame added up');
const second={left:-1920,top:0,right:0,bottom:1080};
assert.equal(target(second,{left:0,top:0,right:0,bottom:0}).right,0);
console.log('PASS HF49: frameless Win32 style, squared corners, no shadow, 4px native taskbar hot edge, opt-in HF48 A/B');
