'use strict';
// Hotfix 44. TMDB web search must never return without an explicit product decision.
// Old IDs/aliases are intentionally preserved in the local import bridge only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('app/index.html');
const integrationUi=read('app/shared/library-integration-ui.js');
const integrationCss=read('app/shared/library-integration.css');
const bridge=read('app/shared/kinoteka-bridge.js');
const prod=JSON.parse(read('src-tauri/tauri.release.conf.json'));
const allRuntime=[];
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
 const rel=path.join(dir,e.name);if(e.isDirectory())walk(rel);else if(/\.(?:js|css|html)$/.test(e.name))allRuntime.push(rel);
}}
walk('app');
for(const file of allRuntime){
 const data=read(file);
 assert.doesNotMatch(data,/\b(?:api\.themoviedb\.org|image\.tmdb\.org|www\.themoviedb\.org|www\.tmdb\.org)\b/i,`${file}: online TMDB URL forbidden`);
 // TMDB-ID matching is permitted in the bridge only, not search controls or adapters.
 if(file.replaceAll('\\','/')!=='app/shared/kinoteka-bridge.js')
   assert.doesNotMatch(data,/\b(?:tmdb|themoviedb|tmdbApiKey|tmdbToken|tmdbResults|searchTmdb)\b/i,`${file}: TMDB UI/logic forbidden`);
}
assert.doesNotMatch(html, /(?:поиск\s*tmdb|api\s*read\s*access\s*token|tmdb)/i);
assert.doesNotMatch(integrationUi,/\bfetch\s*\(|\bXMLHttpRequest\b|tmdb|themoviedb/i);
assert.doesNotMatch(integrationCss,/#tmdbResults|tmdb/i);
assert.match(html,/id="search"/, 'Keep local library search');
assert.match(html,/id="letterboxdFile"/, 'Keep Letterboxd import');
assert.match(bridge,/byTmdb/, 'Existing offline catalog aliases must remain readable');
assert.match(bridge,/linkedId=Number\(item\.tmdbId\)/, 'Legacy ID crossmatching must remain backward compatible');
assert.doesNotMatch(JSON.stringify(prod.app.security.csp),/tmdb|themoviedb/i);
assert.doesNotMatch(read('src-tauri/src/lib.rs'),/themoviedb|tmdb/i);
assert.doesNotMatch(read('src-tauri/src/storage.rs'),/themoviedb|tmdb/i);
assert.ok(fs.existsSync(path.join(root,'test-data','Letterboxd_SYNTHETIC_15_TEST_ONLY.zip')),
  'The synthetic Letterboxd fixture must be included in source distributions');
console.log('NO TMDB SEARCH: PASS (UI, integration, runtime hosts, CSP, native backend; offline compatibility retained)');
