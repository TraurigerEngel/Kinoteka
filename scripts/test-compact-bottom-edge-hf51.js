'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src-tauri/src/lib.rs'), 'utf8');
const beginning = src.indexOf('fn compatible_target(m: Rect, current: Rect, visual: Rect) -> Option<Rect>');
const ending = src.indexOf('pub fn apply(window: &WebviewWindow)', beginning);
assert(beginning >= 0 && ending > beginning, 'compatible geometry function must exist');
const area = src.slice(beginning, ending);
assert.match(area, /let bottom = m\.bottom - TASKBAR_NATIVE_GAP_PX;/);
assert.match(area, /KINOTEKA_TASKBAR_GAP_PX/);
assert.match(area, /Some\("4"\)/);
assert.match(area, /bottom \+ 2/);
assert.match(area, /if m\.right - m\.left < 780 \|\| bottom - m\.top < 620/);
assert.match(src, /const TASKBAR_NATIVE_GAP_PX: i32 = 4;/, 'HF47 and legacy mode must retain their 4px guard');
assert.match(src, /fn remove_native_frame\(hwnd: \*mut c_void\) -> bool/, 'HF49 frameless native style must remain');
assert.match(src, /if !taskbar_is_autohidden_at_bottom\(info\.monitor\) \{ return; \}/, 'no changing non-auto-hidden geometry');
const models = [
  {name:'1080p',screen:{left:0,top:0,right:1920,bottom:1080}},
  {name:'1440p',screen:{left:0,top:0,right:2560,bottom:1440}},
  {name:'secondary left',screen:{left:-1920,top:0,right:0,bottom:1080}},
];
function rect(m, frame, fallback) {
  const b = m.bottom - 4 + (fallback ? 0 : 2);
  return {left:m.left-frame.left,top:m.top-frame.top,right:m.right+frame.right,bottom:b};
}
for (const {name,screen} of models) {
  for (const frame of [{left:0,top:0,right:0},{left:8,top:6,right:8}]) {
    const narrow = rect(screen,frame,false);
    const fallback = rect(screen,frame,true);
    assert.equal(narrow.bottom,screen.bottom-2, name+' 2px physical taskbar strip');
    assert.equal(fallback.bottom,screen.bottom-4,name+' fallback to HF49');
    assert.equal(narrow.left+frame.left,screen.left,name+' left edge unchanged');
    assert.equal(narrow.right-frame.right,screen.right,name+' right edge unchanged');
    assert.equal(narrow.top+frame.top,screen.top,name+' top edge unchanged');
    assert(narrow.bottom < screen.bottom,name+' native HWND never covers the last physical row');
  }
}
// The release and development windows must both remain frameless.
for (const conf of ['src-tauri/tauri.conf.json','src-tauri/tauri.release.conf.json']) {
  const c = JSON.parse(fs.readFileSync(path.join(root,conf),'utf8'));
  assert.equal(c.app.windows[0].decorations,false);
  assert.equal(c.app.windows[0].shadow,false);
  assert.equal(c.version,'1.2.1','v1.2.1 release retains the verified HF51 bottom-edge geometry');
}
console.log('HF51: PASS (2px bottom strip, 4px HF49 fallback, frameless sides, monitor & DPI invariants)');
