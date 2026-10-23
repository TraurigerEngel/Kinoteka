"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/index.html');
const storage=read('src-tauri/src/storage.rs');
const core=read('app/core.js');
const lib=read('src-tauri/src/lib.rs');
const select=html.match(/<select id="sort"[^>]*>([\s\S]*?)<\/select>/);
assert(select,'sorting <select> missing');
const values=Array.from(select[1].matchAll(/<option value="([^"]+)"/g),m=>m[1]);
assert.equal(values.length,13);
assert.equal(new Set(values).size,13);
const rust=storage.match(/const VALID_UI_SORTS: \[&str; 13\] = \[([^\]]+)\];/);
assert(rust,'Rust sort allowlist missing');
const valid=Array.from(rust[1].matchAll(/"([^"]+)"/g),m=>m[1]);
assert.deepEqual(valid,values,'Rust validation must accept all UI sort choices in the same order');
assert.match(storage,/VALID_UI_SORTS\.contains\(&sort\) \|\| sort == "random"/);
assert.match(storage,/if !ui_semantics_valid\(&value\) \{ return Err\("Некорректные настройки интерфейса\."\.into\(\)\); \}/,'saving movies must check updated validator');
assert.match(storage,/if !ui_semantics_valid\(&ui\) \{ return Err\("Некорректные настройки интерфейса\."\.into\(\)\); \}/,'saving UI settings must use same validator');
assert.match(lib,/storage::persist_movies\(&state, ui\.as_deref\(\)/);
assert.match(lib,/storage::persist_ui\(&ui\)/);
for(const f of ['scripts/verify-standalone.js','scripts/verify-sqlite-db.js','scripts/verify-release-artifact.js']) {
  const code=read(f);
  const allowed=code.match(/if \(!\[([^\]]+)\]\.includes\(ui\.sort\)\)/);
  assert(allowed,`sort validator missing in ${f}`);
  const toolValues=Array.from(allowed[1].matchAll(/'([^']+)'/g),m=>m[1]);
  assert.deepEqual(toolValues.filter(v=>v!=='random'),values,`${f} mismatch (legacy random read accepted)`);
}
assert.match(core,/function uiState\(\)\{return \{search:search\.value,sort:sort\.value,/);
assert.match(core,/saveUITimer=setTimeout\(\(\)=>\{saveUI\(\);saveUITimer=null\},250\)/);
assert.match(storage,/mod ui_sort_validation_hf57/);
// Regression: malicious or unknown sort values remain excluded from the fixed allowlist.
for(const value of ['', 'anything', 'year', 'randomized', '<script>'])assert(!valid.includes(value));
console.log('HF57 UI SAVE VALIDATION: PASS (all 13 active options native+tool parity, movie/UI writes, unknown values rejected)');
