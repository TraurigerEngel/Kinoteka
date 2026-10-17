'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = source('app/index.html');
const bridge = source('app/shared/kinoteka-bridge.js');
const styles = source('app/styles.css');
const titlebar = source('app/shared/tauri-titlebar.css');
const css = source('app/shared/startup-transition.css');
const js = source('app/shared/startup-transition.js');
const runtime = source('app/runtime.js');
const rust = source('src-tauri/src/lib.rs');
const dev = JSON.parse(source('src-tauri/tauri.conf.json'));
const release = JSON.parse(source('src-tauri/tauri.release.conf.json'));

// Exact window hit-test parity with Software Hub: native resize is disabled.
for (const [label,conf] of [['dev',dev],['release',release]]) {
  const w = conf.app.windows[0];
  assert.equal(w.label, 'main');
  assert.equal(w.maximized,true,`${label} maximized`);
  assert.equal(w.visible,true,`${label} visible at Tauri creation`);
  assert.equal(w.center,true,`${label} centered`);
  assert.equal(w.backgroundColor,'#020203',`${label} matches opaque splash`);
  assert.equal(w.decorations,false);
  assert.equal(w.resizable,false,`${label} must not expose native resize hit zones`);
}
assert.doesNotMatch(rust, /fn window_ready\s*\(|window\.show\(\)|window\.maximize\(\)/);
assert.doesNotMatch(bridge, /showNativeWindow|revealStaticFirstPaint|invoke\(['"]window_ready['"]\)/);
assert.doesNotMatch(rust,/window_minimize, window_close, window_ready/);
assert.match(rust,/window_minimize, window_close/);

// First visible frame: synchronous titlebar creation at the very START of body.
// Do not build it at DOMContentLoaded after styles, frontend bootstrap or SQLite.
const bodyStart = html.indexOf('<body>');
const earlyScript = html.indexOf('<script id="kinoteka-titlebar-first-paint">', bodyStart);
const splash = html.indexOf('id="kinotekaStartupSplash"', bodyStart);
assert.ok(bodyStart >= 0 && earlyScript > bodyStart && earlyScript < splash, 'Titlebar must precede splash and library');
const earlyEnd = html.indexOf('</script>', earlyScript);
const earlyCode = html.slice(html.indexOf('\n',earlyScript)+1,earlyEnd);
assert.match(earlyCode, /shadow\.innerHTML\s*=\s*`/);
assert.match(earlyCode, /<span class="name">Кинотека<\/span>/);
assert.match(earlyCode, /\.bar\s*\{[^}]*height:42px/);
assert.match(earlyCode, /\.actions button\s*\{[^}]*width:46px;height:42px/);
assert.match(earlyCode, /\.actions button\.close:hover/);
assert.match(earlyCode, /document\.body\.prepend\(host\)/);
assert.match(earlyCode, /shared\/tauri-titlebar\.css/);
assert.doesNotMatch(earlyCode, /__TAURI__|window_ready|setTimeout|DOMContentLoaded|fetch\(/);
assert.doesNotMatch(bridge, /document\.createElement\(['"]div['"]\);\s*host\.id\s*=\s*['"]kinotekaCustomTitlebar/);
assert.match(bridge, /const host = document\.getElementById\('kinotekaCustomTitlebar'\)/);
assert.match(bridge, /const shadow = host\?\.shadowRoot/);
assert.match(bridge, /if \(await flushBeforeLeave\(\)\) invoke\('window_close'\)/);
assert.match(titlebar, /cursor: pointer;\s*-webkit-app-region: no-drag;/);
assert.match(titlebar, /button:hover,[\s\S]*?button:focus-visible/);
assert.match(bridge, /invoke\('window_minimize'\)/);
assert.match(bridge, /if \(await flushBeforeLeave\(\)\) invoke\('window_close'\)/);

// Exercise the first-paint creation without Tauri APIs, SQLite, or late scripts.
const roots=[];
const earlyDoc={
  getElementById(id){return roots.find(x=>x.id===id)||null;},
  createElement(tag){assert.equal(tag,'div'); return {attachShadow(){this.shadowRoot={innerHTML:''};return this.shadowRoot;}};},
  body:{prepend(host){roots.unshift(host);}},
};
vm.runInNewContext(earlyCode,{document:earlyDoc});
assert.equal(roots.length,1);
assert.ok(roots[0].shadowRoot.innerHTML.includes('<span class="name">Кинотека</span>'));
vm.runInNewContext(earlyCode,{document:earlyDoc});
assert.equal(roots.length,1, 'Titlebar must never be recreated');

// Static loading state hides 1122-entry library; splash matches native background.
assert.match(html, /<html[^>]+class="app-loading"[^>]+data-kinoteka-startup="loading"/);
assert.match(html, /id="kinotekaStartupSplash"/);
assert.match(html, /shared\/startup-transition\.css/);
assert.match(html, /shared\/startup-transition\.js/);
assert.match(styles, /html\.app-loading body > :not\(#kinotekaCustomTitlebar\):not\(#kinotekaStartupSplash\)\{visibility:hidden!important\}/);
assert.match(css, /background:#020203/);
assert.match(css, /opacity 200ms ease-in-out 1000ms/);
assert.match(css, /opacity 480ms ease-in-out 1250ms,visibility 0s linear 1730ms/);
assert.match(css, /kinoteka-startup-library-reveal 480ms/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(runtime,/document\.documentElement\.classList\.remove\("app-loading"\)/);
assert.match(bridge, /if \(document\.documentElement\.classList\.contains\('app-loading'\)\) \{/);
assert.match(bridge,/if \(await flushBeforeLeave\(\)\) invoke\('window_close'\)/);
assert.match(bridge,/invoke\('window_minimize'\)/);
assert.match(earlyCode,/class="min"[^>]+aria-label="Свернуть"><svg class="window-control-icon"/);
assert.match(earlyCode,/class="close"[^>]+aria-label="Закрыть"><svg class="window-control-icon"/);
assert.match(titlebar,/width: 46px/);
assert.match(titlebar,/height: 42px/);
assert.match(titlebar,/stroke-width:1\.7/);

// Idempotent handoff: no extra animation or repeated library reveal.
let changes=0;
const data = new Proxy({kinotekaStartup:'loading'},{set(o,k,v){changes++;o[k]=v;return true;}});
const splashContext={window:{},document:{documentElement:{dataset:data}}};
vm.runInNewContext(js,splashContext,{filename:'startup-transition.js'});
assert.equal(splashContext.window.kinotekaStartup.markReady(),true);
assert.equal(splashContext.window.kinotekaStartup.markReady(),false);
assert.equal(data.kinotekaStartup,'ready');
assert.equal(changes,1);

// Functional readiness sequencing (no IPC show/maximize/focus anywhere):
// titlebar stylesheet -> SQLite bootstrap -> frontend readiness -> reveal.
async function startupLifecycle() {
  const block = bridge.match(/  const start = async \(\) => \{[\s\S]*?\n  \};\n\n  if \(document\.readyState/);
  assert.ok(block,'Startup lifecycle controller missing');
  const calls=[];
  let finishTitlebar, finishBoot, finishFrontend;
  let loading=true;
  const context={
    console:{error(...args){calls.push('error');}},
    window:{kinotekaStartup:{markReady(){calls.push('reveal');}}},
    document:{
      documentElement:{classList:{contains(){return loading;},remove(){loading=false;calls.push('remove-loading');}}},
      createElement(){return {style:{}};}, body:{appendChild(){calls.push('error-visible');}},
    },
    installTitlebar(){calls.push('titlebar');return new Promise(r=>finishTitlebar=r);},
    boot(){calls.push('sqlite');return new Promise(r=>finishBoot=r);},
    waitForFrontendReady(){calls.push('frontend');return new Promise(r=>finishFrontend=r);},
  };
  vm.runInNewContext(block[0].replace(/\n\n  if \(document\.readyState$/, '')+'\nwindow.testStart = start;', context);
  const done=context.window.testStart();
  assert.deepEqual(calls,['titlebar']);
  finishTitlebar();await new Promise(setImmediate);await new Promise(setImmediate);
  assert.deepEqual(calls,['titlebar','sqlite']);
  finishBoot();await new Promise(setImmediate);await new Promise(setImmediate);
  assert.deepEqual(calls,['titlebar','sqlite','frontend']);
  loading=false;finishFrontend();await done;
  assert.deepEqual(calls,['titlebar','sqlite','frontend','reveal']);
  // Failure path must not leak covered library or freeze splash forever.
  const bad=context.window.testStart();
  finishTitlebar();await new Promise(setImmediate);await new Promise(setImmediate);
  finishBoot();await new Promise(setImmediate);await new Promise(setImmediate);
  loading=true;finishFrontend();await bad;
  assert.ok(calls.includes('error-visible'));
  assert.equal(calls.filter(s=>s==='reveal').length,2);
}
startupLifecycle().then(()=>console.log('KINOTEKA SOFTWARE HUB NATIVE WINDOW PARITY: PASS')).catch(e=>{console.error(e);process.exitCode=1;});
