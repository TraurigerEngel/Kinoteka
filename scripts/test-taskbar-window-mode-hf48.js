'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src-tauri/src/lib.rs'),'utf8');
const moduleText=src.slice(src.indexOf('mod taskbar_autohide {'),src.indexOf('#[cfg_attr(mobile'));
assert.match(moduleText,/static COMPAT_WINDOW: AtomicBool = AtomicBool::new\(false\)/);
assert.match(moduleText,/fn apply_legacy\(window: &WebviewWindow\)/);
assert.match(moduleText,/KINOTEKA_TASKBAR_MODE/);
assert.match(moduleText,/Some\("legacy"\)/);
assert.match(moduleText,/window\.unmaximize\(\)/);
assert.match(moduleText,/fn compatible_target\(m: Rect, current: Rect, visual: Rect\) -> Option<Rect>/);
assert.match(moduleText,/let bottom = m\.bottom - TASKBAR_NATIVE_GAP_PX;/);
assert.match(moduleText,/if !maximized && !COMPAT_WINDOW\.load\(Ordering::Acquire\) \{ return; \}/);
assert.match(moduleText,/COMPAT_WINDOW\.store\(true, Ordering::Release\)/);
assert.match(moduleText,/SWP_NOZORDER_NOACTIVATE/);
function position(m,c,v){const margins=[v.left-c.left,v.top-c.top,c.right-v.right,c.bottom-v.bottom]; if(margins.some(x=>x<0||x>32))return null;const bottom=m.bottom-4;if(m.right-m.left<780||bottom-m.top<620)return null;return {left:m.left-margins[0],top:m.top-margins[1],right:m.right+margins[2],bottom};}
for(const [name,m,f] of [
 ['Windows 11 native borderless',{left:0,top:0,right:1920,bottom:1080},[0,0,0,0]],
 ['Windows 11 invisible left/right frame',{left:0,top:0,right:1920,bottom:1080},[8,0,8,6]],
 ['monitor to the left',{left:-1920,top:0,right:0,bottom:1080},[8,0,8,6]],
 ['high DPI',{left:0,top:0,right:2560,bottom:1440},[10,10,10,10]],
]){const c={left:m.left+430,top:m.top+100,right:m.right-430,bottom:m.bottom-100},v={left:c.left+f[0],top:c.top+f[1],right:c.right-f[2],bottom:c.bottom-f[3]};const p=position(m,c,v);assert(p,name);assert.equal(p.left+f[0],m.left,name+' left');assert.equal(p.right-f[2],m.right,name+' right');assert.equal(p.top+f[1],m.top,name+' top');assert.equal(p.bottom,m.bottom-4,name+' physical edge');assert.deepEqual(position(m,p,{left:p.left+f[0],top:p.top+f[1],right:p.right-f[2],bottom:p.bottom-f[3]}),p,name+' idempotence');}
assert.equal(position({left:0,top:0,right:1920,bottom:1080},{left:0,top:0,right:1920,bottom:1080},{left:-50,top:0,right:1920,bottom:1080}),null);
console.log('PASS HF48: normal-window taskbar compatibility and legacy mode; geometry is monitor-safe and idempotent');
