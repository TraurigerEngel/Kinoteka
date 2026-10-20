const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src-tauri/src/lib.rs'), 'utf8');
const section = source.slice(source.indexOf('mod taskbar_autohide {'), source.indexOf('#[cfg_attr(mobile'));
assert.match(section, /DwmGetWindowAttribute/);
assert.match(section, /DWMWA_EXTENDED_FRAME_BOUNDS: u32 = 9/);
assert.match(section, /MAX_FRAME_PX: i32 = 32/);
assert.match(section, /fn target_rect\(m: Rect, current: Rect, visual: Rect\) -> Option<Rect>/);
assert.match(section, /left: m\.left - margins\[0\]/);
assert.match(section, /top: m\.top - margins\[1\]/);
assert.match(section, /right: m\.right \+ margins\[2\]/);
assert.match(section, /let visual_limit = m\.bottom - GAP_PX \+ margins\[3\]/);
assert.doesNotMatch(section, /SetWindowPos\(hwnd, null_mut\(\), m\.left, m\.top/);
assert.match(section, /if unsafe \{ IsZoomed\(hwnd\) \} == 0 \{ return; \}/);
assert.match(section, /if !taskbar_is_autohidden_at_bottom\(info\.monitor\) \{ return; \}/);

// Model the exact four-margin arithmetic implemented above. These are
// regression vectors for left 8px desktop gap with Windows 11 DWM/Win32,
// side monitors, 125% DPI and no invisible frame.
function target(m,c,v) {
  const margins=[v.left-c.left,v.top-c.top,c.right-v.right,c.bottom-v.bottom];
  if(margins.some(x=>x<0||x>32)) return null;
  if(['left','top','right','bottom'].some(k=>Math.abs(v[k]-m[k])>32))return null;
  return {left:m.left-margins[0],top:m.top-margins[1],right:m.right+margins[2],bottom:Math.min(m.bottom-2+margins[3],m.bottom-4)};
}
function visible(rect, current, visual){
  return {left:rect.left+visual.left-current.left,top:rect.top+visual.top-current.top,
    right:rect.right-(current.right-visual.right),bottom:rect.bottom-(current.bottom-visual.bottom)};
}
for(const {name,monitor,current,frame} of [
  {name:'8px left + right Windows frame',monitor:{left:0,top:0,right:1920,bottom:1080},current:{left:0,top:0,right:1920,bottom:1080},frame:[8,0,8,0]},
  {name:'already maximized with frame outside edges',monitor:{left:0,top:0,right:1920,bottom:1080},current:{left:-8,top:0,right:1928,bottom:1080},frame:[8,0,8,0]},
  {name:'no frame',monitor:{left:0,top:0,right:1920,bottom:1080},current:{left:0,top:0,right:1920,bottom:1078},frame:[0,0,0,0]},
  {name:'left-side secondary monitor',monitor:{left:-1920,top:0,right:0,bottom:1080},current:{left:-1920,top:0,right:0,bottom:1080},frame:[8,0,8,0]},
  {name:'asymmetric DPI frame',monitor:{left:0,top:0,right:2560,bottom:1440},current:{left:0,top:0,right:2560,bottom:1440},frame:[10,0,10,0]},
  {name:'DWM top and bottom frame',monitor:{left:0,top:0,right:1920,bottom:1080},current:{left:0,top:0,right:1920,bottom:1080},frame:[8,8,8,8]},
]){
 const [l,t,r,b]=frame;
 const visualNow={left:current.left+l,top:current.top+t,right:current.right-r,bottom:current.bottom-b};
 const rect=target(monitor,current,visualNow);assert(rect,name);
 const rendered=visible(rect,current,visualNow);
 assert.deepEqual(rendered,{...monitor,bottom:monitor.bottom-Math.max(2,4+b)},name);
 assert.deepEqual(target(monitor,rect,rendered),rect,`reapply must be idempotent: ${name}`);
}
assert.equal(target({left:0,top:0,right:1920,bottom:1080},{left:500,top:300,right:1200,bottom:800},{left:508,top:300,right:1192,bottom:800}),null,'never snap floating window');
console.log('PASS HF46/HF47: DWM frame compensation fills left/right/top and keeps the native bottom hot-edge free');
