'use strict';
// Regression: auto-hide taskbar must own the *native* edge, not just the DWM
// visible edge. This can be checked on Linux without touching a real taskbar.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rust = fs.readFileSync(path.join(__dirname,'../src-tauri/src/lib.rs'),'utf8');
const start = rust.indexOf('mod taskbar_autohide {');
const end = rust.indexOf('#[cfg_attr(mobile',start);
assert(start>=0&&end>start,'Win32 taskbar geometry module is available');
const s = rust.slice(start,end);
const requireRegex = (re, why) => assert.match(s,re,why);
requireRegex(/const TASKBAR_NATIVE_GAP_PX: i32 = 4;/,'reserve at least 4 native physical pixels');
requireRegex(/let native_limit = m\.bottom - TASKBAR_NATIVE_GAP_PX;/,'native HWND must end above the screen edge');
requireRegex(/let visual_limit = m\.bottom - GAP_PX \+ margins\[3\];/,'preserve the original DWM visual calculation');
requireRegex(/bottom: visual_limit\.min\(native_limit\),/,'restrict the RECT before passing to Win32');
requireRegex(/SetWindowPos\(hwnd, null_mut\(\), target\.left, target\.top,/,'apply bounded native HWND rectangle');
requireRegex(/if unsafe \{ IsZoomed\(hwnd\) \} == 0 \{ return; \}/,'avoid changing floating windows');
requireRegex(/if !taskbar_is_autohidden_at_bottom\(info\.monitor\) \{ return; \}/,'do not reserve gap if auto-hide is disabled');
assert.match(rust,/tauri::WindowEvent::Focused\(true\) \| tauri::WindowEvent::Resized\(_\)/,'re-apply after Windows changes native size');
assert.doesNotMatch(s,/bottom: m\.bottom - GAP_PX \+ margins\[3\],/,'HF46 overlap must not come back');

function compute(m,c,v) {
 const margins = [v.left-c.left,v.top-c.top,c.right-v.right,c.bottom-v.bottom];
 if(margins.some(x=>x<0||x>32))return null;
 if(['left','top','right','bottom'].some(k=>Math.abs(v[k]-m[k])>32))return null;
 const visualLimit=m.bottom-2+margins[3];
 const nativeLimit=m.bottom-4;
 return {left:m.left-margins[0],top:m.top-margins[1],right:m.right+margins[2],bottom:Math.min(visualLimit,nativeLimit)};
}
for(const [label,margins,m] of [
 ['Windows 11 invisible left/right 8px',[8,0,8,0],{left:0,top:0,right:1920,bottom:1080}],
 ['Windows 11 invisible bottom 8px',[8,0,8,8],{left:0,top:0,right:1920,bottom:1080}],
 ['125-percent display scaling',[10,0,10,10],{left:0,top:0,right:2560,bottom:1440}],
 ['left-hand second monitor',[8,0,8,6],{left:-1920,top:0,right:0,bottom:1080}],
 ['zero invisible frame',[0,0,0,0],{left:0,top:0,right:1920,bottom:1080}],
 ]) {
 const [l,t,r,b]=margins;
 const c={left:m.left,top:m.top,right:m.right,bottom:m.bottom};
 const v={left:c.left+l,top:c.top+t,right:c.right-r,bottom:c.bottom-b};
 const result=compute(m,c,v);
 assert(result,`${label}: must compute`);
 assert.equal(result.left+l,m.left,`${label}: left edge filled`);
 assert.equal(result.right-r,m.right,`${label}: right edge filled`);
 assert.equal(result.top+t,m.top,`${label}: top edge filled`);
 assert(result.bottom<=m.bottom-4,`${label}: native physical bottom hot-edge is free`);
 assert(result.bottom-b<=m.bottom-2,`${label}: DWM visible bottom does not occlude hot-edge`);
 const visual={left:result.left+l,top:result.top+t,right:result.right-r,bottom:result.bottom-b};
 assert.deepEqual(compute(m,result,visual),result,`${label}: repeated corrections are stable`);
}
assert.equal(compute({left:0,top:0,right:1920,bottom:1080},{left:600,top:300,right:1400,bottom:900},{left:608,top:308,right:1392,bottom:892}),null,'floating windows remain untouched');
console.log('PASS HF47: Win32 native lower edge exposes taskbar trigger; DWM correction, monitors, DPI, idempotence preserved');
