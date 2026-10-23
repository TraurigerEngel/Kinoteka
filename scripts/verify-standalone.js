'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const KINOTEKA_CATEGORIES = new Set(['Фильмы','Сериалы','Анимация']);
const KINOTEKA_ITEM_RATINGS = new Set(['Понравилось','Нормально','Не понравилось','Смотрю','Запланировано']);
const KINOTEKA_TRASH_RATINGS = new Set([...KINOTEKA_ITEM_RATINGS,'Избранное']);
function validCanonicalYear(value) {
  return value == null || (Number.isInteger(value) && value >= 1000 && value <= 9999);
}
function assertStateSemantics(state,label) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`State object is invalid: ${label}`);
  if (!Array.isArray(state.items) || !Array.isArray(state.favorites) || !Array.isArray(state.trash)) throw new Error(`State arrays are invalid: ${label}`);
  const itemKeys = new Set();
  for (const [index,item] of state.items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Item ${index} is invalid: ${label}`);
    if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`Item ${index} name is invalid: ${label}`);
    if (!KINOTEKA_CATEGORIES.has(item.category)) throw new Error(`Item ${index} category is invalid: ${label}`);
    if (!validCanonicalYear(item.year)) throw new Error(`Item ${index} year is invalid: ${label}`);
    if (!KINOTEKA_ITEM_RATINGS.has(item.rating)) throw new Error(`Item ${index} rating is invalid: ${label}`);
    itemKeys.add(`${item.category}::${item.name}::${item.year == null ? '' : String(item.year)}`);
  }
  const seenFavorites = new Set();
  for (const key of state.favorites) {
    if (typeof key !== 'string' || !key.trim() || !itemKeys.has(key) || seenFavorites.has(key)) throw new Error(`Favorite reference is invalid: ${label}`);
    seenFavorites.add(key);
  }
  for (const [index,item] of state.trash.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Trash item ${index} is invalid: ${label}`);
    const name = typeof item.game === 'string' ? item.game : (typeof item.name === 'string' ? item.name : '');
    if (!name.trim()) throw new Error(`Trash item ${index} name is invalid: ${label}`);
    if (!Number.isSafeInteger(item.id) || item.id <= 0) throw new Error(`Trash item ${index} id is invalid: ${label}`);
    if (!KINOTEKA_CATEGORIES.has(item.category)) throw new Error(`Trash item ${index} category is invalid: ${label}`);
    if (!validCanonicalYear(item.year)) throw new Error(`Trash item ${index} year is invalid: ${label}`);
    if (!KINOTEKA_TRASH_RATINGS.has(item.rating)) throw new Error(`Trash item ${index} rating is invalid: ${label}`);
    if (typeof item.favorite !== 'boolean') throw new Error(`Trash item ${index} favorite flag is invalid: ${label}`);
  }
}
function assertUiSemantics(ui,label) {
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) throw new Error(`UI state is invalid: ${label}`);
  for (const key of ['search','sort','quickFilter','mediaCategory','mediaYear']) if (typeof ui[key] !== 'string') throw new Error(`UI key ${key} is invalid: ${label}`);
  if (!['game-asc','game-desc','year-desc','year-asc','score-desc','score-asc','added-desc','added-asc','status','category','favorite-first','score-missing','poster-missing','random'].includes(ui.sort)) throw new Error(`UI sort is invalid: ${label}`);
  if (!['Все','Фильмы','Сериалы','Анимация'].includes(ui.mediaCategory)) throw new Error(`UI mediaCategory is invalid: ${label}`);
}


const root = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '1.2.1';
const EXPECTED_RELEASE_NAME = 'Kinoteka_Standalone_v1.2_Stable';

const mustExist = [
  'package.json','package-lock.json','README.md','CHANGELOG.md','START-HERE.txt','RELEASE_NOTES_v1.0_STABLE.md','RELEASE_NOTES_v1.1_STABLE.md','RELEASE_NOTES_v1.2_STABLE.md','RELEASE-CHECKLIST.md',
  'app/index.html','app/core.js','app/games.js','app/trash.js','app/runtime.js','app/favicon.ico',
  'app/shared/kinoteka-bridge.js','app/shared/modal-system.js','app/shared/themed-select.js',
  'app/shared/browser-guard.js','app/shared/route-transition.js','app/shared/tauri-titlebar.css',
  'data/kinoteka.sqlite3','seed-data/kinoteka.sqlite3',
  'src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs',
  'src-tauri/tauri.conf.json','src-tauri/tauri.release.conf.json',
  'src-tauri/src/main.rs','src-tauri/src/lib.rs','src-tauri/src/storage.rs','src-tauri/icons/icon.ico','src-tauri/icons/icon.png',
  'scripts/verify-sqlite-db.js','scripts/verify-release-artifact.js','scripts/kinoteka-db-summary.js',
  'BUILD-DEV.cmd','BUILD-DEV.ps1','BUILD-RELEASE.cmd','BUILD-RELEASE.ps1',
  'MAKE-FINAL-RELEASE.cmd','MAKE-FINAL-RELEASE.ps1',
  'FREEZE-CANONICAL-DATA.cmd','FREEZE-CANONICAL-DATA.ps1',
  'MIGRATE-FROM-LOST-HEAVEN.cmd','MIGRATE-FROM-LOST-HEAVEN.ps1'
];
for (const rel of mustExist) if (!fs.existsSync(path.join(root,rel))) throw new Error(`Required file is missing: ${rel}`);

const EXPECTED_ICON_PNG_SHA256 = 'c09f0bffa3377e21f5b9b574395c64b392b9fe0f41bb5348b33d1112d15a9450';
const EXPECTED_ICON_ICO_SHA256 = '2ba82164c4ebf17f06199e3315f8a5c8fe8529e08f39228713096b536d6782eb';
const iconPng = fs.readFileSync(path.join(root,'src-tauri/icons/icon.png'));
const iconIco = fs.readFileSync(path.join(root,'src-tauri/icons/icon.ico'));
const faviconIco = fs.readFileSync(path.join(root,'app/favicon.ico'));
const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
if (sha256Buffer(iconPng) !== EXPECTED_ICON_PNG_SHA256) throw new Error('Canonical Kinoteka icon PNG hash mismatch.');
if (sha256Buffer(iconIco) !== EXPECTED_ICON_ICO_SHA256) throw new Error('Canonical Kinoteka Windows icon hash mismatch.');
if (!iconIco.equals(faviconIco)) throw new Error('App favicon must match the canonical Windows icon.');

const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const tauri = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'),'utf8'));
const tauriRelease = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.release.conf.json'),'utf8'));
const cargo = fs.readFileSync(path.join(root,'src-tauri/Cargo.toml'),'utf8');
const cargoLock = fs.readFileSync(path.join(root,'src-tauri/Cargo.lock'),'utf8');
const mainRs = fs.readFileSync(path.join(root,'src-tauri/src/main.rs'),'utf8');
const libRs = fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
const storageRs = fs.readFileSync(path.join(root,'src-tauri/src/storage.rs'),'utf8');
const html = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const bridge = fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const modalSystem = fs.readFileSync(path.join(root,'app/shared/modal-system.js'),'utf8');
const modalSystemCss = fs.readFileSync(path.join(root,'app/shared/modal-system.css'),'utf8');
const themedSelectJs = fs.readFileSync(path.join(root,'app/shared/themed-select.js'),'utf8');
const themedSelectCss = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const buildDev = fs.readFileSync(path.join(root,'BUILD-DEV.ps1'),'utf8');
const buildRelease = fs.readFileSync(path.join(root,'BUILD-RELEASE.ps1'),'utf8');
const makeRelease = fs.readFileSync(path.join(root,'MAKE-FINAL-RELEASE.ps1'),'utf8');
const migrate = fs.readFileSync(path.join(root,'MIGRATE-FROM-LOST-HEAVEN.ps1'),'utf8');
const freezeCanonical = fs.readFileSync(path.join(root,'FREEZE-CANONICAL-DATA.ps1'),'utf8');
const canonicalSummaryHelper = fs.readFileSync(path.join(root,'scripts/kinoteka-db-summary.js'),'utf8');

// Identity/version consistency.
if (pkg.name !== 'kinoteka-standalone' || pkg.version !== EXPECTED_VERSION) throw new Error('package.json identity/version mismatch.');
if (pkg.description !== 'Kinoteka Standalone v1.2.1 Stable — HF60 Verified') throw new Error('package.json description mismatch.');
if (lock.name !== pkg.name || lock.version !== EXPECTED_VERSION) throw new Error('package-lock root identity/version mismatch.');
if (lock.packages?.['']?.name !== pkg.name || lock.packages?.['']?.version !== EXPECTED_VERSION) throw new Error('package-lock package identity/version mismatch.');
if (lock.packages?.['']?.description !== pkg.description) throw new Error('package-lock description mismatch.');
if (!/name\s*=\s*"kinoteka-standalone"/.test(cargo) || !/version\s*=\s*"1\.2\.1"/.test(cargo)) throw new Error('Cargo package identity/version mismatch.');
if (!/name\s*=\s*"kinoteka"/.test(cargo) || !/name\s*=\s*"kinoteka_standalone_lib"/.test(cargo)) throw new Error('Cargo binary/library identity mismatch.');
if (!/name = "kinoteka-standalone"\nversion = "1\.2\.1"/.test(cargoLock)) throw new Error('Cargo.lock root package identity/version mismatch.');

// Guard against accidental release-version replacement in third-party Cargo.lock entries.
// The project version belongs only to the local kinoteka-standalone package, never to crates.io packages.
const cargoLockPackages = [...cargoLock.matchAll(/\[\[package\]\]\r?\nname = "([^"]+)"\r?\nversion = "([^"]+)"/g)];
if (cargoLockPackages.length < 200) throw new Error('Cargo.lock package inventory is unexpectedly short.');
for (const [, name, version] of cargoLockPackages) {
  if (name !== 'kinoteka-standalone' && version.includes(`+spec-${EXPECTED_VERSION}`)) {
    throw new Error(`Cargo.lock corrupt third-party package version: ${name} ${version}`);
  }
}
if (cargoLock.includes(`+spec-${EXPECTED_VERSION}`)) throw new Error('Cargo.lock includes a corrupted third-party TOML spec version.');

if (tauri.productName !== 'Кинотека' || tauri.identifier !== 'com.lostheaven.kinoteka' || tauri.version !== EXPECTED_VERSION) throw new Error('Tauri standalone identity mismatch.');
if (tauri?.app?.windows?.[0]?.title !== 'Кинотека' || tauri?.app?.windows?.[0]?.url !== 'index.html') throw new Error('Tauri standalone window mismatch.');
if (tauriRelease.version !== EXPECTED_VERSION || tauriRelease?.app?.windows?.[0]?.devtools !== false) throw new Error('Release Tauri configuration mismatch.');

// v1.2 Preview 1 preserves native-visible first paint from the accepted Hotfix 6,
// and release-only WebView hardening. Never promote the rejected Hotfix 7 reveal.
for (const [label, config] of [['DEV', tauri], ['Release', tauriRelease]]) {
  const win = config?.app?.windows?.[0];
  if (!win || win.visible !== true || win.maximized !== true || win.center !== true || win.resizable !== false || win.backgroundColor !== '#020203') {
    throw new Error(`v1.2 Preview 1 ${label} window parity mismatch.`);
  }
}
if (tauriRelease.app.windows[0].devtools !== false) throw new Error('Release devtools must be disabled.');
for (const [label, script] of [['BUILD-RELEASE',buildRelease],['MAKE-FINAL-RELEASE',makeRelease]]) {
  if (!script.includes(`$releaseName = '${EXPECTED_RELEASE_NAME}'`)) throw new Error(`${label} v1.1 output name mismatch.`);
  if (!script.includes('Refusing to overwrite')) throw new Error(`${label} must protect existing release output.`);
}
if (!makeRelease.includes('exe_sha256 = $exeHash') || !makeRelease.includes('EXE hash mismatch')) {
  throw new Error('Final release EXE hash consistency is not verified.');
}
if (libRs.includes('window_ready') || bridge.includes("invoke('window_ready')")) {
  throw new Error('Rejected Hotfix 7 delayed native reveal was reintroduced.');
}
// Dedicated single-instance identity and standalone backend command surface.
if (!mainRs.includes('Local\\KinotekaStandalone')) throw new Error('Kinoteka single-instance mutex is missing.');
if (!mainRs.includes('FindWindowW') || !mainRs.includes('w!("Кинотека")')) throw new Error('Second-instance focus behavior is missing.');
for (const cmd of ['library_state','persist_movies_state','persist_movies_ui','window_minimize','window_close']) {
  if (!libRs.includes(cmd)) throw new Error(`Required Kinoteka backend command is missing: ${cmd}`);
}
for (const forbidden of ['persist_games','persist_games_ui','budget_','home_summary','create_full_db_backup','import_library_state']) {
  if (libRs.includes(forbidden)) throw new Error(`Foreign backend command/wiring remains: ${forbidden}`);
}
if (!storageRs.includes('kinoteka.sqlite3') || !storageRs.includes('seed-data')) throw new Error('Portable Kinoteka SQLite/seed storage is not wired.');
if (!storageRs.includes('BACKUP_KEEP') || !storageRs.includes('integrity_check')) throw new Error('SQLite backup/integrity hardening is missing.');

// Standalone frontend wiring and no cross-project navigation/runtime dependency.
if (!html.includes('<title>Кинотека</title>')) throw new Error('Kinoteka document identity is missing.');
if (!html.includes('shared/kinoteka-bridge.js')) throw new Error('Standalone Kinoteka bridge is not wired.');
if (/\.\.\/\.\.\/shared\//.test(html)) throw new Error('Kinoteka still depends on Lost Heaven relative shared paths.');
const foreignPatterns = [
  /projects\/igroteka/i, /projects\/budget/i, /shell\/index/i, /window\.lostHeaven/i,
  /data-lh-project/i
];
for (const re of foreignPatterns) {
  for (const rel of ['app/index.html','app/core.js','app/games.js','app/trash.js','app/runtime.js','app/shared/kinoteka-bridge.js']) {
    const s = fs.readFileSync(path.join(root,rel),'utf8');
    if (re.test(s)) throw new Error(`Foreign project/runtime wiring remains in ${rel}: ${re}`);
  }
}
if (!bridge.includes('window.kinotekaRuntime') || !bridge.includes('window.kinotekaDatabase')) throw new Error('Standalone Kinoteka runtime/database globals are missing.');
const invokes = [...bridge.matchAll(/invoke\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
const allowedInvokes = new Set(['library_state','persist_movies_state','persist_movies_ui','window_minimize','window_close']);
for (const cmd of invokes) if (!allowedInvokes.has(cmd)) throw new Error(`Foreign invoke found in standalone bridge: ${cmd}`);
for (const cmd of allowedInvokes) if (!invokes.includes(cmd)) throw new Error(`Expected standalone invoke is missing: ${cmd}`);

// Startup Hotfix 4 — Software Hub native-window parity. Both profiles must
// create an already-visible, centered, maximized window. Never call show() or
// maximize() on first paint. Library stays covered by an opaque static splash.
for (const [label, config] of [['dev',tauri],['release',tauriRelease]]) {
  const w = config.app.windows[0];
  if (w.resizable !== false) throw new Error(`${label}: native resizing must be disabled (Software Hub titlebar parity)`);
  if (w.visible !== true || w.maximized !== true || w.center !== true || w.backgroundColor !== '#020203') {
    throw new Error(`${label}: native visible/maximized/centered splash geometry is not configured`);
  }
}
if (/fn window_ready\s*\(|window\.show\(\)|window\.maximize\(\)/.test(libRs)) throw new Error('Obsolete delayed native reveal returned to Rust');
if (/showNativeWindow|revealStaticFirstPaint|invoke\(['"]window_ready['"]\)/.test(bridge)) throw new Error('Obsolete frontend native reveal returned');
if (!bridge.includes('await titlebarReady;') || !bridge.includes('await boot()') || !bridge.includes('await waitForFrontendReady()')) throw new Error('Native-visible frontend readiness sequence is incomplete');
if (!(bridge.indexOf('await titlebarReady;') < bridge.indexOf('await boot()') && bridge.indexOf('await boot()') < bridge.indexOf('await waitForFrontendReady()'))) throw new Error('Titlebar/boot/frontend ordering regressed');
if (!bridge.includes("classList.contains('app-loading')") || !bridge.includes('window.kinotekaStartup.markReady()')) throw new Error('Library splash guard is missing');
if (!runtime.includes('document.documentElement.classList.remove("app-loading")')) throw new Error('Frontend app-loading release is missing.');
if (runtime.includes('requestAnimationFrame(()=>document.documentElement.classList.remove("app-loading"))')) throw new Error('Startup still depends on requestAnimationFrame.');
console.log('- Kinoteka startup: Software Hub native-visible geometry + protected library barrier OK');

// Cleanup Pass 1: safe standalone dead-code / foreign-theme guards.
if (!modalSystem.includes("options.title || 'Кинотека'")) throw new Error('Standalone modal fallback title must be Кинотека.');
if (!themedSelectJs.includes("const theme = 'library';") || /budget/i.test(themedSelectJs) || /kinoteka-select-theme-budget/.test(themedSelectCss) || /data-lh-select-theme/.test(html)) {
  throw new Error('Dead cross-project themed-select branch remains.');
}

// Cleanup Pass 2: standalone runtime namespace finalization.
const namespaceFiles = [
  'app/index.html','app/core.js','app/games.js','app/trash.js','app/runtime.js','app/styles.css',
  'app/shared/kinoteka-bridge.js','app/shared/modal-system.js','app/shared/modal-system.css',
  'app/shared/themed-select.js','app/shared/themed-select.css','app/shared/route-transition.js',
  'app/shared/route-transition.css','app/shared/browser-guard.js','app/shared/fonts.css'
];
const legacyNamespacePatterns = [
  /\bLH(?:Modal|Dialog)\b/,
  /\blh[A-Z][A-Za-z0-9_]*/,
  /__lh[A-Z][A-Za-z0-9_]*/,
  /\blh-[A-Za-z0-9_-]+/,
  /_lh[A-Z][A-Za-z0-9_]*/,
  /igrotekaModal[A-Za-z0-9_]*/
];
for (const rel of namespaceFiles) {
  const source = fs.readFileSync(path.join(root,rel),'utf8');
  for (const re of legacyNamespacePatterns) {
    if (re.test(source)) throw new Error(`Cleanup Pass 2 legacy runtime namespace remains in ${rel}: ${re}`);
  }
}
if (!modalSystem.includes('window.KinotekaModal') || !modalSystem.includes('window.KinotekaDialog')) throw new Error('Kinoteka modal/dialog namespace is missing.');
if (!html.includes('kinoteka-route-overlay') || !html.includes('kinotekaParticleFlow')) throw new Error('Kinoteka route/background namespace is missing.');
if (!fs.readFileSync(path.join(root,'app/shared/route-transition.js'),'utf8').includes('window.kinotekaRouteTransition')) throw new Error('Kinoteka route transition namespace is missing.');
if (!themedSelectJs.includes('kinoteka-select-shell') || !themedSelectCss.includes('.kinoteka-select-theme-library')) throw new Error('Kinoteka themed-select namespace is missing.');
if (!modalSystemCss.includes('kinotekaModalDialogIn') || !modalSystemCss.includes('kinotekaModalDialogOut')) throw new Error('Kinoteka modal animation namespace is missing.');

// Cleanup Pass 3: retired hidden state / dead selector / no-op compatibility cleanup.
const pass3RuntimeFiles = ['app/index.html','app/core.js','app/games.js','app/trash.js','app/runtime.js'];
const pass3RuntimeText = pass3RuntimeFiles.map(rel=>fs.readFileSync(path.join(root,rel),'utf8')).join('\n');
const pass3DeadTokens = [
  '.page-size-wrap','.pageEllipsis','.sortActions','.sortToggle','#nameSortToggle',
  '.rowDelete','.rowDeleteCell','.delete-col','.server-status','.add-choice-card','.add-choice-grid',
  '.history-list','.history-empty','.active-filters','.filter-chip'
];
for (const token of pass3DeadTokens) {
  if ((pass3RuntimeText + '\n' + styles).includes(token)) throw new Error(`Cleanup Pass 3 dead selector returned: ${token}`);
}
for (const token of ['duplicateOnly','setAddMode','openBulkModal','closeBulkModal','addMultipleGames','updateBulkInfo','formatHistoryDate']) {
  if (pass3RuntimeText.includes(token)) throw new Error(`Cleanup Pass 3 retired runtime token returned: ${token}`);
}
for (const token of ['id="sort"','sort.value','quickFilter','mediaCategory','mediaYear']) {
  if (!(pass3RuntimeText + '\n' + styles).includes(token)) throw new Error(`Cleanup Pass 3 active UI/state contract missing: ${token}`);
}

// Cleanup Pass 4: retired Igroteka rating terminology cleanup.
const pass4RatingFiles = ['app/index.html','app/core.js','app/games.js','app/styles.css','app/shared/themed-select.css'];
for (const rel of pass4RatingFiles) {
  const source = fs.readFileSync(path.join(root,rel),'utf8');
  if (source.includes('Прохожу')) throw new Error(`Cleanup Pass 4 retired rating terminology remains in ${rel}: Прохожу`);
}
for (const token of ['Смотрю','rating-in-progress','data-filter-rating="Смотрю"']) {
  if (!(pass3RuntimeText + '\n' + styles + '\n' + themedSelectCss).includes(token)) throw new Error(`Cleanup Pass 4 canonical in-progress rating contract missing: ${token}`);
}

// Current canonical Kinoteka UI patch sanity (latest extracted Lost Heaven Kinoteka state).
if (!games.includes("replace(/\\D+/g,'').slice(0,4)")) throw new Error('PATCH 028 four-digit year input guard is missing.');
if (!styles.includes('PATCH 028')) throw new Error('PATCH 028 Kinoteka star/year polish marker is missing.');

// JavaScript syntax: standalone files + inline HTML scripts.
const jsFiles = [];
function walkJs(dir) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,ent.name);
    if (ent.isDirectory()) walkJs(full);
    else if (ent.isFile() && ent.name.endsWith('.js')) jsFiles.push(full);
  }
}
walkJs(path.join(root,'app'));
for (const file of jsFiles) new vm.Script(fs.readFileSync(file,'utf8'), {filename:path.relative(root,file)});
let inlineScripts = 0;
for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  if (!m[2].trim()) continue;
  new vm.Script(m[2], {filename:`app/index.html:inline-${++inlineScripts}`});
}

// Offline-by-default: the main runtime must not fetch from third-party APIs.
// Path normalization is necessary because Windows uses backslashes in relative paths.
const portableRuntimePath = rel => rel.replaceAll('\\','/');
function removeApprovedRuntimeUrls(rel, source) {
  // IMDb is mentioned solely as a human-readable attribution/link, not as a runtime API.
  if (portableRuntimePath(rel) === 'app/index.html') return source.replaceAll('https://www.imdb.com','');
  if (portableRuntimePath(rel) === 'app/games.js') return source.replaceAll('https://commons.wikimedia.org/wiki/File:','');
  if (portableRuntimePath(rel) === 'app/shared/commons-posters.js') {
    return source.replaceAll('https://query.wikidata.org/sparql','')
      .replaceAll('https://commons.wikimedia.org/w/api.php','')
      .replaceAll('https://commons.wikimedia.org/wiki/File:','')
      .replaceAll('https://upload.wikimedia.org/','')
      .replaceAll('https://creativecommons.org/licenses/','')
      .replaceAll('https://creativecommons.org/publicdomain/','');
  }
  return source;
}
const integrationUi = fs.readFileSync(path.join(root,'app/shared/library-integration-ui.js'),'utf8');
const integrationCss = fs.readFileSync(path.join(root,'app/shared/library-integration.css'),'utf8');
const integrationTabs = [...html.matchAll(/data-integration-tab="([^"]+)"/g)].map(m=>m[1]);
const integrationPages = [...html.matchAll(/data-integration-page="([^"]+)"/g)].map(m=>m[1]);
if (integrationTabs.length !== 0 || integrationPages.length !== 0 || !html.includes('id="letterboxdFile"')) {
  throw new Error('Hotfix 41: Letterboxd importer must not expose extra tabs or pages.');
}
if (/tmdb|themoviedb/i.test(html) || /tmdb|themoviedb|\bfetch\s*\(/i.test(integrationUi) ||
    /#tmdbResults/.test(integrationCss) ||
    /tmdb|themoviedb/i.test(JSON.stringify(tauriRelease.app.security.csp))) {
  throw new Error('Legacy online TMDB UI or network permissions were not fully removed.');
}
if (tauriRelease.app.security.csp['connect-src'] !== 'ipc: http://ipc.localhost https://query.wikidata.org https://commons.wikimedia.org https://upload.wikimedia.org') {
  throw new Error('Release CSP network restriction mismatch.');
}
for (const rel of ['app/index.html',...jsFiles.map(x=>path.relative(root,x)),'app/styles.css']) {
  const s = fs.readFileSync(path.join(root,rel),'utf8');
  const allowed = removeApprovedRuntimeUrls(rel,s);
  if (/https?:\/\//i.test(allowed) && portableRuntimePath(rel) !== 'app/shared/lucide-icons.js') {
    throw new Error(`Unexpected remote URL in runtime asset: ${rel}`);
  }
}

// Cleanup Pass 5: confirmed-write persistence and obsolete compatibility API cleanup.
const pass5Bridge = fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const pass5Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass5Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass5Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass5Surface = pass5Bridge + '\n' + pass5Core + '\n' + pass5Games + '\n' + pass5Trash;
for (const token of [
  'replaceGamesSync','replaceTrashSync','moveGameToTrashSync','restoreTrashSync',
  'permanentlyDeleteTrashSync','emptyTrashSync','trashComparable','writeTrash(','__flush: flushPersistence'
]) {
  if (pass5Surface.includes(token)) throw new Error(`Cleanup Pass 5 obsolete persistence compatibility token returned: ${token}`);
}
for (const token of ['function queuePersistence(task)','replaceGamesConfirmed: async raw =>','moveGameToTrash: async id =>','restoreTrash: async id =>','permanentlyDeleteTrash: async id =>','emptyTrash: async () =>']) {
  if (!pass5Bridge.includes(token)) throw new Error(`Cleanup Pass 5 confirmed-write bridge contract missing: ${token}`);
}
if (!pass5Core.includes('async function save()') || !pass5Core.includes('await db.replaceGamesConfirmed(raw)')) throw new Error('Cleanup Pass 5 confirmed game write is no longer mandatory.');
if (!pass5Core.includes('async function update(i,key,value)') || !pass5Core.includes('if(!(await save()))')) throw new Error('Cleanup Pass 5 rating save is no longer confirmed before UI acceptance.');
if (!pass5Games.includes('async function addEntry()') || !pass5Games.includes('if(!(await save()))')) throw new Error('Cleanup Pass 5 add-item save is no longer confirmed before UI acceptance.');
for (const token of ['await db.moveGameToTrash(gameId)','await db.restoreTrash(trashId)','await db.permanentlyDeleteTrash(trashId)','await db.emptyTrash()']) {
  if (!pass5Trash.includes(token)) throw new Error(`Cleanup Pass 5 confirmed trash write missing: ${token}`);
}

// Cleanup Pass 6: command wrappers must be non-interactive.
for (const rel of ['BUILD-DEV.cmd','BUILD-RELEASE.cmd','MAKE-FINAL-RELEASE.cmd','FREEZE-CANONICAL-DATA.cmd','MIGRATE-FROM-LOST-HEAVEN.cmd']) {
  const cmd = fs.readFileSync(path.join(root,rel),'utf8');
  if (/^\s*pause(?:\s|$)/im.test(cmd)) throw new Error(`Cleanup Pass 6 interactive pause returned: ${rel}`);
  if (!/exit \/b %(?:ERR|RC)%/i.test(cmd)) throw new Error(`Cleanup Pass 6 exit-code propagation missing: ${rel}`);
}

// Cleanup Pass 7: remove the permanently hidden legacy shown-count/statistics surface.
const pass7Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass7Styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const pass7Surface = pass5Core + '\n' + pass5Games + '\n' + pass5Trash + '\n' + pass7Index + '\n' + pass7Styles;
for (const token of ['id="stats"','statsRenderCache','countLabel','countTotal','class="count"','statsCache']) {
  if (pass7Surface.includes(token)) throw new Error(`Cleanup Pass 7 retired hidden-count token returned: ${token}`);
}
if (/\.stats(?:\s|\{|\.|,)/.test(pass7Styles) || /\.count(?:\s|\{|\[|\.|,)/.test(pass7Styles)) {
  throw new Error('Cleanup Pass 7 retired hidden statistics/count CSS returned.');
}
if (!pass7Index.includes('id="quickStats"') || !pass7Index.includes('id="totalCount"') || !pass7Index.includes('id="favoriteCount"')) {
  throw new Error('Cleanup Pass 7 active quick-stat cards are missing.');
}

// Cleanup Pass 8: remove retired no-op save-status and pagination alias residue.
const pass8Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass8Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
for (const token of ['oldStatus','saveStatus','updateSaveStatus','let pageSize=','pageSize=PAGE_SIZE']) {
  if (pass8Core.includes(token) || pass8Games.includes(token)) throw new Error(`Cleanup Pass 8 retired runtime token returned: ${token}`);
}
if (!pass8Core.includes('const PAGE_SIZE=25;')) throw new Error('Cleanup Pass 8 canonical PAGE_SIZE constant is missing.');
if (!pass8Core.includes('const CARD_PAGE_SIZE=24;') || !pass8Games.includes("kinotekaViewMode==='cards'?CARD_PAGE_SIZE:PAGE_SIZE") || !pass8Games.includes('Math.ceil(filteredTotal/pageSize)') || !pass8Games.includes('allRows.slice((currentPage-1)*pageSize,currentPage*pageSize)')) {
  throw new Error('Cleanup Pass 8 pagination must use canonical table/card page-size constants directly.');
}

// Cleanup Pass 9: canonical trash modal semantics; retire historical history-* aliases.
const pass9Html = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass9Styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const pass9Surface = pass9Html + '\n' + pass9Styles;
for (const token of ['history-modal','history-note']) {
  if (pass9Surface.includes(token)) throw new Error(`Cleanup Pass 9 retired trash/history alias returned: ${token}`);
}
for (const token of ['class="modal trash-modal"','class="trash-note"','.trash-modal','.trash-note']) {
  if (!pass9Surface.includes(token)) throw new Error(`Cleanup Pass 9 canonical trash surface missing: ${token}`);
}

// Cleanup Pass 10: canonical Kinoteka record terminology and corrupted-string cleanup.
const pass10Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass10Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass10Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
for (const token of ['Закрыть окно добавления игры','Удалить игру?','Игра будет перемещена в корзину','Игра <strong id="deleteGameName"','записейу',"count===1?'запись':'игр'"]) {
  if (pass10Index.includes(token) || pass10Trash.includes(token) || pass10Core.includes(token)) throw new Error(`Cleanup Pass 10 retired/corrupted media terminology returned: ${token}`);
}
for (const token of ['Закрыть окно добавления записи','Корзина, записей: ${count}']) {
  if (!pass10Index.includes(token) && !pass10Trash.includes(token)) throw new Error(`Cleanup Pass 10 canonical record terminology missing: ${token}`);
}

// Cleanup Pass 11: canonical add-entry DOM/CSS namespace.
const pass11Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass11Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass11Styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const pass11SelectJs = fs.readFileSync(path.join(root,'app/shared/themed-select.js'),'utf8');
const pass11SelectCss = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const pass11Surface = [pass11Index,pass11Games,pass11Styles,pass11SelectJs,pass11SelectCss].join('\n');
for (const token of ['game-entry-','add-game-action','add-game-modal','add-game-form']) {
  if (pass11Surface.includes(token)) throw new Error(`Cleanup Pass 11 retired add-entry namespace returned: ${token}`);
}
for (const token of ['kinoteka-entry-row','kinoteka-entry-name','kinoteka-entry-category','kinoteka-entry-year','kinoteka-entry-rating','kinoteka-entry-favorite','kinoteka-entry-remove','kinoteka-entry-error','add-entry-action','add-entry-modal']) {
  if (!pass11Surface.includes(token)) throw new Error(`Cleanup Pass 11 canonical add-entry namespace missing: ${token}`);
}

// Cleanup Pass 12: canonical entry table/delete-modal runtime namespace.
const pass12Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass12Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass12Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass12Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass12Styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const pass12Surface = [pass12Index,pass12Core,pass12Games,pass12Trash,pass12Styles].join('\n');
for (const token of ['gameEntries','kinotekaAddGameModal','async function addGame()', '.game-name','game-col','delete-game-','deleteGameName','"add-game"','"games-trash"','"game-delete"']) {
  if (pass12Surface.includes(token)) throw new Error(`Cleanup Pass 12 retired entry/delete namespace returned: ${token}`);
}
for (const token of ['entryEntries','kinotekaAddEntryModal','async function addEntry()', '.entry-name','entry-col','"add-entry"','"entries-trash"']) {
  if (!pass12Surface.includes(token)) throw new Error(`Cleanup Pass 12 canonical active entry namespace missing: ${token}`);
}
// Cleanup Pass 12 Hotfix 1: rendered table rows must use the same canonical title class as copy/delete handlers.
if (pass12Games.includes('class="game-name"')) throw new Error('Cleanup Pass 12 Hotfix 1 retired rendered game-name class returned.');
if (!pass12Games.includes('class="entry-name" data-i="${i}" data-k="game"')) throw new Error('Cleanup Pass 12 Hotfix 1 rendered entry-name class is missing.');
for (const token of ['e.target.closest(".entry-name")','row.querySelector(".entry-name")']) {
  if (!pass12Games.includes(token)) throw new Error(`Cleanup Pass 12 Hotfix 1 copy/delete selector contract missing: ${token}`);
}

// Cleanup Pass 13: canonical active entry control/function identifiers.
const pass13Surface = [pass12Index,pass12Games,pass12Trash].join('\n');
for (const token of ['addGameTitle','addGameRow','deleteGameAtIndex']) {
  if (pass13Surface.includes(token)) throw new Error(`Cleanup Pass 13 retired active entry identifier returned: ${token}`);
}
for (const token of ['addEntryTitle','addEntryRow','deleteEntryAtIndex']) {
  if (!pass13Surface.includes(token)) throw new Error(`Cleanup Pass 13 canonical active entry identifier missing: ${token}`);
}
if (!pass12Index.includes('aria-labelledby="addEntryTitle"')) throw new Error('Cleanup Pass 13 add-entry modal aria-labelledby is not synchronized.');
if (!pass12Trash.includes('$("addEntryRow").onclick=addEntryRow;')) throw new Error('Cleanup Pass 13 add-entry-row binding is not synchronized.');
if (!pass12Games.includes('typeof deleteEntryAtIndex==="function" ? await deleteEntryAtIndex(index) : false')) throw new Error('Cleanup Pass 13 context-delete function binding is not synchronized.');

// Cleanup Pass 14: canonical row selection/copy helper identifiers.
for (const token of ['selectGameRow','copyGameNameFromRow']) {
  if (pass12Games.includes(token)) throw new Error(`Cleanup Pass 14 retired row helper identifier returned: ${token}`);
}
for (const token of ['selectEntryRow','copyEntryNameFromRow']) {
  if (!pass12Games.includes(token)) throw new Error(`Cleanup Pass 14 canonical row helper identifier missing: ${token}`);
}
if (!pass12Games.includes('await copyEntryNameFromRow(row);')) throw new Error('Cleanup Pass 14 row copy call-site binding is not synchronized.');

// Cleanup Pass 14 Hotfix 1: nested trash confirmation must settle before mutation.
const pass14HotfixCore = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass14HotfixTrash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
for (const token of ['const closeObserver=new MutationObserver(finishClose);','controller?.close();','const closeFallback=setTimeout(()=>']) {
  if (!pass14HotfixCore.includes(token)) throw new Error(`Cleanup Pass 14 Hotfix 1 confirm-close sequencing guard missing: ${token}`);
}

// Cleanup Pass 14 Hotfix 2: destructive Trash actions close confirm -> mutate -> smoothly close Trash, in sequence.
for (const token of ['async function confirmTrashDestructiveAction(options)','function closeTrashAfterDestructiveAction()','backdrop?.classList.add("trash-action-smooth-close")','await closeTrashAfterDestructiveAction();']) {
  if (!pass14HotfixTrash.includes(token)) throw new Error(`Cleanup Pass 14 Hotfix 2 smooth-close sequencing guard missing: ${token}`);
}
if ((pass14HotfixTrash.match(/await closeTrashAfterDestructiveAction\(\);/g)||[]).length !== 2) throw new Error('Cleanup Pass 14 Hotfix 2 must smoothly close Trash after exactly two destructive confirmation paths.');
if ((pass14HotfixTrash.match(/confirmTrashDestructiveAction\(\{/g)||[]).length !== 2) throw new Error('Cleanup Pass 14 Hotfix 2 both destructive confirmation paths must use the smooth confirm wrapper.');
if ((pass14HotfixTrash.match(/if\(readTrash\(\)\.length===0\)closeTrashAnimated\(\(\)=>animateTrashDeactivation\(\)\);/g)||[]).length !== 1) throw new Error('Cleanup Pass 14 Hotfix 2 restore-last-item close path changed unexpectedly.');

// Modal Motion Pass 2: closing mirrors the opening motion path for every modal layer.
for (const token of ['--kinoteka-modal-open-ms:280ms','--kinoteka-modal-close-ms:260ms','--kinoteka-modal-ease:cubic-bezier(.22,.61,.36,1)','@keyframes kinotekaModalBackdropIn','@keyframes kinotekaModalBackdropOut','@keyframes kinotekaModalDialogIn','@keyframes kinotekaModalDialogOut','.kinoteka-native-dialog-layer.open:not(.closing)','.kinoteka-native-dialog-layer.closing']) {
  if (!modalSystemCss.includes(token)) throw new Error(`Modal Motion Pass 2 canonical motion contract missing: ${token}`);
}
for (const token of ['const MOTION = Object.freeze({ openMs: 280, closeMs: 260 })','setTimeout(finish, MOTION.closeMs)',"layer.classList.add(\'closing\')",'motion: MOTION']) {
  if (!modalSystem.includes(token)) throw new Error(`Modal Motion Pass 2 JS timing/close contract missing: ${token}`);
}
if (!pass14HotfixTrash.includes('window.KinotekaModal?.motion?.closeMs??240')) throw new Error('Modal Motion Pass 2 Trash close timing is not sourced from the canonical modal motion contract.');
for (const token of ['38%{opacity:.94;transform:translateY(1.5px) scale(.996)}','100%{opacity:0;transform:translateY(10px) scale(.975)}']) {
  if (!modalSystemCss.includes(token)) throw new Error(`Modal Motion Pass 2 mirrored close path missing: ${token}`);
}

for (const retired of ['kinotekaTrashActionBackdropClose','kinotekaTrashActionDialogClose','modal animations disabled intentionally','trashBackdropOutV841','trashModalOutV841','trashBackdropOutV842','trashModalOutV842','kinotekaModalBackdropCloseV849','kinotekaModalCloseV849','kinotekaModalBackdropOpenV857','kinotekaModalOpenV857','kinotekaModalBackdropCloseV852','kinotekaModalCloseV852']) {
  if (styles.includes(retired)) throw new Error(`Modal Motion Pass 2 retired modal-motion override returned: ${retired}`);
}
const stylesLinkPos = html.indexOf('href="styles.css"');
const modalCssLinkPos = html.indexOf('href="shared/modal-system.css"');
if (stylesLinkPos < 0 || modalCssLinkPos < 0 || modalCssLinkPos < stylesLinkPos) throw new Error('Modal Motion Pass 2 canonical modal-system.css must load after styles.css.');

// Cleanup Pass 15: canonical frontend-only entry/persistence helper namespace.
const pass15Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass15Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass15Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass15Runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass15Surface = [pass15Core,pass15Games,pass15Trash,pass15Runtime].join('\n');
for (const token of ['migrateGameStatuses','gameNameNormCache','gameNorm(','persistedGamesJSON','gamesDirty','nextProvisionalGameId']) {
  if (pass15Surface.includes(token)) throw new Error(`Cleanup Pass 15 retired frontend helper identifier returned: ${token}`);
}
for (const token of ['function migrateEntryStatuses(arr)','const entryNameNormCache=new WeakMap()','function entryNameNorm(entry)','let persistedEntriesJSON=null','let entriesDirty=true','function nextProvisionalEntryId(offset=0)']) {
  if (!pass15Core.includes(token)) throw new Error(`Cleanup Pass 15 canonical core helper identifier missing: ${token}`);
}
for (const token of ['nextProvisionalEntryId(index)','entriesDirty=true','entryNameNorm(g)']) {
  if (!pass15Games.includes(token)) throw new Error(`Cleanup Pass 15 games.js binding missing: ${token}`);
}
for (const token of ['migrateEntryStatuses(nextGames.map','persistedEntriesJSON=String(state.games??\'[]\')','entriesDirty=false']) {
  if (!pass15Trash.includes(token)) throw new Error(`Cleanup Pass 15 trash.js binding missing: ${token}`);
}
for (const token of ['persistedEntriesJSON=raw||"[]"','migrateEntryStatuses(parsedGames.map','entriesDirty=false']) {
  if (!pass15Runtime.includes(token)) throw new Error(`Cleanup Pass 15 runtime.js binding missing: ${token}`);
}

// Cleanup Pass 16: functional identity consistency + Escape search safety.
const pass16Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass16Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass16Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass16Runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass16Bridge = fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const pass16Surface = [pass16Core,pass16Games,pass16Trash,pass16Runtime,pass16Bridge].join('\n');
for (const token of ['scheduleSearchRender','searchRenderTimer','duplicateNameSet']) {
  if (pass16Surface.includes(token)) throw new Error(`Cleanup Pass 16 retired functional token returned: ${token}`);
}
for (const token of ['function entryIdentityKey(entry)','let duplicateIdentitySet=new Set()','duplicateIdentitySet=new Set(duplicateGroups().map(g=>g.key))']) {
  if (!pass16Core.includes(token)) throw new Error(`Cleanup Pass 16 canonical identity contract missing in core.js: ${token}`);
}
for (const token of [
  'games.map(g=>entryIdentityKey(g)).filter(Boolean)',
  'entryIdentityKey({category:item.category,name:item.name,year:item.year})',
  'dupKeys.has(entryIdentityKey(g))'
]) {
  if (!pass16Games.includes(token)) throw new Error(`Cleanup Pass 16 add/highlight identity binding missing: ${token}`);
}
if (!pass16Bridge.includes('games.some(g => entryIdentityKey(g) === entryIdentityKey(item))')) throw new Error('Cleanup Pass 16 Trash restore identity binding is missing.');
for (const token of ['if(search.value){','search.value="";','currentPage=1;','saveUI();','render();','search.focus();']) {
  if (!pass16Runtime.includes(token)) throw new Error(`Cleanup Pass 16 Escape search clear path is missing: ${token}`);
}

function pass16IdentityKey(entry) {
  const normalize = value => String(value ?? '').replace(/[\u00A0\u2007\u202F]/g,' ').replace(/[‘’`]/g,"'").replace(/\s+/g,' ').trim().toLocaleLowerCase('ru');
  const name = normalize(entry?.game ?? entry?.name);
  if (!name) return '';
  const category = normalize(entry?.category || 'Фильмы');
  const rawYear = entry?.year;
  let year = '';
  if (rawYear != null && String(rawYear).trim() !== '') {
    const numericYear = Number(rawYear);
    year = Number.isFinite(numericYear) ? String(numericYear) : normalize(rawYear);
  }
  return `${category}\u0000${name}\u0000${year}`;
}
const identityBase = pass16IdentityKey({category:'Фильмы',name:' Oldboy ',year:'2003'});
if (identityBase !== pass16IdentityKey({category:' фильмы ',game:'oldboy',year:2003})) throw new Error('Cleanup Pass 16 identity normalization is not stable.');
if (identityBase === pass16IdentityKey({category:'Фильмы',name:'Oldboy',year:2013})) throw new Error('Cleanup Pass 16 different years must remain distinct entries.');
if (identityBase === pass16IdentityKey({category:'Сериалы',name:'Oldboy',year:2003})) throw new Error('Cleanup Pass 16 different categories must remain distinct entries.');

// Cleanup Pass 17: centralized modal lifecycle ownership and retired delete-modal path.
const pass17Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass17Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass17Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass17Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass17Runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass17ModalSystem = fs.readFileSync(path.join(root,'app/shared/modal-system.js'),'utf8');
const pass17RuntimeSurface = [pass17Index,pass17Core,pass17Games,pass17Trash,pass17Runtime].join('\n');
for (const token of ['id="deleteModal"','pendingDelete','openDeleteModal','closeDeleteModal','confirmDelete','kinotekaDeleteModal','closeBackdropAnimated','TRASH_MODAL_CLOSE_MS','updateModalScrollLock','modalScrollObserver']) {
  if (pass17RuntimeSurface.includes(token)) throw new Error(`Cleanup Pass 17 retired modal lifecycle token returned: ${token}`);
}
if (pass17Core.includes('backdrop.addEventListener("click",onBackdrop)')) throw new Error('Cleanup Pass 17 duplicate confirm backdrop owner returned.');
if (pass17Trash.includes('$("modal").addEventListener("click"')) throw new Error('Cleanup Pass 17 duplicate add-modal backdrop owner returned.');
if (pass17Runtime.includes('yearPicker?.classList.contains("open")') || pass17Runtime.includes('$("trashModal").classList.contains("show")') || pass17Runtime.includes('$("modal").classList.contains("show")')) {
  throw new Error('Cleanup Pass 17 project-specific modal Escape routing returned.');
}
if (!pass17Runtime.includes('if(e.defaultPrevented)return;')) throw new Error('Cleanup Pass 17 runtime Escape must yield to centralized modal handling.');
if (!pass17ModalSystem.includes("overlay.addEventListener('click', e => { if (e.target === overlay) controller.close(); });")) throw new Error('Cleanup Pass 17 centralized backdrop owner is missing.');
if (!pass17ModalSystem.includes('e.stopPropagation();\n        current.close({ blurRestoredFocus: true });')) throw new Error('Cleanup Pass 17 centralized Escape owner is missing.');

// Cleanup Pass 18: interaction + persistence hardening.
const pass18Runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass18Bridge = fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const pass18Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass18ModalSystem = fs.readFileSync(path.join(root,'app/shared/modal-system.js'),'utf8');
if (!pass18Bridge.includes("if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); }")) throw new Error('Cleanup Pass 18 project-wide no-Tab policy is missing.');
for (const token of ["async function copyText(text)","await navigator.clipboard.writeText(value)","const copied = document.execCommand('copy')","window.kinotekaRuntime = { copyText }"]) {
  if (!pass18Bridge.includes(token)) throw new Error(`Cleanup Pass 18 confirmed clipboard helper missing: ${token}`);
}
if (!pass18Games.includes('const copied=await window.kinotekaRuntime.copyText(text);')) throw new Error('Cleanup Pass 18 row-copy path does not await clipboard confirmation.');
if (!pass18ModalSystem.includes('copied=(await window.kinotekaRuntime.copyText(text))===true')) throw new Error('Cleanup Pass 18 dialog-copy path does not await clipboard confirmation.');
for (const token of ['const editing=target&&','if(editing)return;','if(resetButton&&!resetButton.disabled){e.preventDefault();e.stopPropagation();resetButton.click();}']) {
  if (!pass18Runtime.includes(token)) throw new Error(`Cleanup Pass 18 keyboard contract missing: ${token}`);
}
if (pass18Runtime.includes('else{e.preventDefault();e.stopPropagation();}')) throw new Error('Cleanup Pass 18 Ctrl+Z still swallows native undo when no app reset is available.');
for (const token of [
  'state.get("app").and_then(Value::as_str) != Some("Кинотека")',
  'state.get("formatVersion").and_then(Value::as_i64) != Some(1)',
  'SELECT payload FROM ui_state WHERE id=1',
  'fn ui_semantics_valid(ui: &Value) -> bool'
]) {
  if (!storageRs.includes(token)) throw new Error(`Cleanup Pass 18 runtime SQLite validation missing: ${token}`);
}

// Cleanup Pass 19: dead runtime residue removal + behavior-preservation guards.
const pass19Core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const pass19Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const pass19Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass19Runtime = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass19Surface = [pass19Core,pass19Games,pass19Trash,pass19Runtime].join('\n');
for (const token of ['paginationRenderCache','persistedTrashJSON','trashIndicatorDeferred','lastModifiedReason','lastModified']) {
  if (pass19Surface.includes(token)) throw new Error(`Cleanup Pass 19 retired runtime token returned: ${token}`);
}
if (!pass19Trash.includes('function renderTrash(){') || !pass19Trash.includes('  updateTrashIndicator();')) {
  throw new Error('Cleanup Pass 19 Trash render must keep the indicator synchronized.');
}
for (const token of [
  'games.push(...addedItems);entriesDirty=true;',
  'if(!(await save())){games.splice(games.length-addedItems.length,addedItems.length);return;}',
  'games[i].rating=value||"Запланировано";',
  'entriesDirty=true;',
  'if(!(await save())){'
]) {
  if (!pass19Surface.includes(token)) throw new Error(`Cleanup Pass 19 confirmed-write behavior guard missing: ${token}`);
}
if (!pass19Trash.includes('if(!(await save())){games[i].favorite=beforeFavorite;games[i].rating=beforeRating;return;}')) {
  throw new Error('Cleanup Pass 19 favorite rollback path changed unexpectedly.');
}


// Cleanup Pass 20: exact duplicate CSS consolidation.
const pass20Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
if (!pass20Css.includes('Cleanup Pass 20 — exact duplicate CSS rules consolidated; visual cascade preserved.')) {
  throw new Error('Cleanup Pass 20 CSS consolidation marker is missing.');
}
function collectTopLevelCssRules(css){
  const out=[]; let i=0, start=0, depth=0, quote='', comment=false;
  while(i<css.length){
    const ch=css[i], next=css[i+1]||'';
    if(comment){ if(ch==='*'&&next==='/'){comment=false;i+=2;continue;} i++;continue; }
    if(quote){ if(ch==='\\'){i+=2;continue;} if(ch===quote)quote=''; i++;continue; }
    if(ch==='/'&&next==='*'){comment=true;i+=2;continue;}
    if(ch==='"'||ch==="'"){quote=ch;i++;continue;}
    if(ch==='{'){
      if(depth===0){
        const prelude=css.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim();
        depth=1; const bodyStart=i+1; let j=bodyStart, q='', c=false, d=1;
        for(;j<css.length;j++){
          const a=css[j], b=css[j+1]||'';
          if(c){if(a==='*'&&b==='/'){c=false;j++;}continue;}
          if(q){if(a==='\\'){j++;continue;}if(a===q)q='';continue;}
          if(a==='/'&&b==='*'){c=true;j++;continue;}
          if(a==='"'||a==="'"){q=a;continue;}
          if(a==='{')d++; else if(a==='}'&&--d===0)break;
        }
        if(prelude && !prelude.startsWith('@')){
          const body=css.slice(bodyStart,j).replace(/\s+/g,' ').trim();
          out.push(prelude+'\n'+body);
        }
        i=j+1; start=i; depth=0; continue;
      }
    }
    if(depth===0 && ch===';') start=i+1;
    i++;
  }
  return out;
}
const pass20Rules=collectTopLevelCssRules(pass20Css);
const pass20Seen=new Set();
for(const rule of pass20Rules){
  if(pass20Seen.has(rule)) throw new Error('Cleanup Pass 20 exact duplicate top-level CSS rule returned.');
  pass20Seen.add(rule);
}

// Cleanup Pass 21: retired superseded Trash/favorite override layers.
if (!pass20Css.includes('Cleanup Pass 21 — superseded Trash/star override layers consolidated; final visuals preserved.')) {
  throw new Error('Cleanup Pass 21 CSS consolidation marker is missing.');
}
for (const token of [
  'v1.18 — cart modal: prevent action buttons from overflowing and keep rows fully visible.',
  'v1.23 — content-sized trash modal: grow to fit content, never stay unnecessarily wide.',
  'v1.23 final override — intrinsic trash modal sizing.',
  'PATCH 025 — center media-type dropdown labels and remove star zoom in add modal.',
  'PATCH 027 — Kinoteka add-modal favorite star mirrors Kinoteka exactly.'
]) {
  if (pass20Css.includes(token)) throw new Error(`Cleanup Pass 21 retired CSS layer returned: ${token}`);
}
for (const token of [
  'Cleanup Pass 21 — effective Trash flex sizing retained from retired v1.23 layers.',
  '.trash-modal .trash-actions{flex:0 0 auto!important;}',
  'v1.88 trial — unified Trash modal visual parity.',
  'PATCH 028 — exact Kinoteka favorite-star geometry and press parity in add modal.'
]) {
  if (!pass20Css.includes(token)) throw new Error(`Cleanup Pass 21 canonical CSS contract missing: ${token}`);
}


// Cleanup Pass 22: retired pre-v1.8.49 Trash animation CSS.
const pass22Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const pass22Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
if (!pass22Css.includes('Cleanup Pass 22 — retired pre-v1.8.49 Trash activation/deactivation CSS removed; active transition/dot/fade path preserved.')) {
  throw new Error('Cleanup Pass 22 CSS consolidation marker is missing.');
}
for (const token of [
  'trash-activate','trash-deactivate',
  'trashDotAppearV841','trashDotDisappearV841','trashButtonActivateV841','trashButtonDeactivateV841',
  'trashDotAppearV842','trashDotDisappearV842','trashButtonActivateV842','trashButtonDeactivateV842',
  'trashDotAppearV843','trashDotDisappearV843','trashButtonActivateV843','trashButtonDeactivateV843',
  'trashDotAppearV844','trashDotDisappearV844','trashButtonActivateV844','trashButtonDeactivateV844'
]) {
  if (pass22Css.includes(token)) throw new Error(`Cleanup Pass 22 retired Trash CSS returned: ${token}`);
}
for (const token of ['trash-transition-in','trash-transition-out','trash-dot-enter','trash-dot-exit','trash-fade-out','trashDotAppearV849']) {
  if (!pass22Css.includes(token)) throw new Error(`Cleanup Pass 22 active Trash CSS contract missing: ${token}`);
}
for (const token of ["classList.add('has-items','trash-transition-out','trash-dot-exit')","classList.add('has-items','trash-transition-in')","classList.add('trash-dot-enter')","classList.add('trash-fade-out')"]) {
  if (!pass22Trash.includes(token)) throw new Error(`Cleanup Pass 22 active Trash runtime path changed: ${token}`);
}
if (pass22Trash.includes("classList.add('trash-activate'") || pass22Trash.includes("classList.add('trash-deactivate'")) {
  throw new Error('Cleanup Pass 22 retired Trash classes became active again.');
}

// Cleanup Pass 23: background performance + semantic DB validation.
const pass23Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const pass23Storage = fs.readFileSync(path.join(root,'src-tauri/src/storage.rs'),'utf8');
for (const token of ['const MAX_FPS=90;','const FRAME_INTERVAL=1000/MAX_FPS;','document.addEventListener(\'visibilitychange\'','if(document.hidden)stopAnimation();else startAnimation();','cancelAnimationFrame(rafId)']) {
  if (!pass23Index.includes(token)) throw new Error(`Cleanup Pass 23 background performance binding missing: ${token}`);
}
for (const retired of ['spawnDust','spawnStreak','dust=Array.from','streaks=Array.from','let particles=[],dust=[],streaks=[]']) {
  if (pass23Index.includes(retired)) throw new Error(`Cleanup Pass 23 dead background residue returned: ${retired}`);
}
for (const token of ['fn state_semantics_valid(state: &Value) -> bool','fn ui_semantics_valid(ui: &Value) -> bool','!state_semantics_valid(&state)','ui_semantics_valid(&ui)']) {
  if (!pass23Storage.includes(token)) throw new Error(`Cleanup Pass 23 Rust semantic validation binding missing: ${token}`);
}

// RC1 Theme Preview 1: Cinema Mono + Living Particles visual contract.
const themePreviewCss = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const themePreviewSelectCss = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const themePreviewTitlebarCss = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 1 — Cinema Mono + Living Particles',
  '--bg:#030303;',
  '.stat-card:not(.active) b,.stat-card:not(.active) span{color:#c9c9c9!important',
  '--kinoteka-modal-backdrop:rgba(0,0,0,.76)'
]) if (!themePreviewCss.includes(token)) throw new Error(`Theme Preview 1 CSS contract missing: ${token}`);
for (const token of ['--kinoteka-select-bg:#111214;','--kinoteka-select-option-selected:#25172e;']) if (!themePreviewSelectCss.includes(token)) throw new Error(`Theme Preview 1 select contract missing: ${token}`);
for (const token of ['RC1 Theme Preview 1 — monochrome titlebar chrome.','background:rgba(3,3,3,.96);']) if (!themePreviewTitlebarCss.includes(token)) throw new Error(`Theme Preview 1 titlebar contract missing: ${token}`);
for (const token of ['const HUE_CYCLE_SECONDS=72;','const HUE_SPEED=360/HUE_CYCLE_SECONDS;','const RGB_WHEEL=Array.from({length:360}','hue:rand(0,360)','colorAt(p.hue,t)']) if (!pass23Index.includes(token)) throw new Error(`Theme Preview 1 living-particle contract missing: ${token}`);
for (const retired of ["p.tone==='cyan'","g.pink?'255,134,226'","s.pink?'255,126,223'"]) if (pass23Index.includes(retired)) throw new Error(`Theme Preview 1 legacy fixed particle palette returned: ${retired}`);



// RC1 Theme Preview 2: true mono root + active filter glow.
const themePreview2Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 2 — True Mono Base + Active Filter Glow.',
  ':root{--bg:#020203}',
  '.media-filter.active,.media-year-trigger.active,.year-picker-option.active{',
  'border-color:var(--total)!important;',
  '0 0 18px rgba(103,232,249,.18)'
]) if (!themePreview2Css.includes(token)) throw new Error(`Theme Preview 2 CSS contract missing: ${token}`);
for (const token of ['background:#020203 !important;','background-color:#020203 !important;']) if (!pass23Index.includes(token)) throw new Error(`Theme Preview 2 root-background contract missing: ${token}`);


// RC1 Theme Preview 3: true-black runtime root + contextual secondary-filter accent.
const themePreview3Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const themePreview3Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const themePreview3Bridge = fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const themePreview3Route = fs.readFileSync(path.join(root,'app/shared/route-transition.css'),'utf8');
const themePreview3Titlebar = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 3 — True Black Runtime + Contextual Filter Accent.',
  ':root{--active-filter-color:var(--total)}',
  'border-color:var(--active-filter-color)!important;',
  '.stat-card[data-filter-rating="Смотрю"]:not(.active):hover b{'
]) if (!themePreview3Css.includes(token)) throw new Error(`Theme Preview 3 CSS contract missing: ${token}`);
for (const token of [
  'const activeFilterColor={',
  '"Смотрю":"var(--progress)"',
  'favorite:"var(--favorite)"',
  "document.documentElement.style.setProperty('--active-filter-color',activeFilterColor);"
]) if (!themePreview3Games.includes(token)) throw new Error(`Theme Preview 3 contextual-accent runtime contract missing: ${token}`);
if (!themePreview3Bridge.includes("setProperty('background', '#020203', 'important')")) throw new Error('Theme Preview 3 bridge root background is not neutral #020203.');
if (themePreview3Bridge.includes("setProperty('background', '#08070d', 'important')")) throw new Error('Theme Preview 3 legacy violet bridge root override returned.');
if (!themePreview3Route.includes('background:#020203;')) throw new Error('Theme Preview 3 route first-paint background is not #020203.');
if (!themePreview3Titlebar.includes('background: rgba(2, 2, 3, .96);')) throw new Error('Theme Preview 3 titlebar first-paint background is not neutral.');


// RC1 Theme Preview 4: semantic compact actions + contextual pagination/reset.
const themePreview4Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 4 — Semantic Utility Controls + Contextual Pagination.',
  '.list-actions .add-entry-action{',
  '.list-actions #trashData:not(.has-items){',
  '.list-actions #trashData.has-items.trash-fade-out{',
  '.pagination .pageIndicator{',
  '.pagination .pageCurrent{',
  '.toolbar .resetFilters:not(:disabled){',
  'border-color:var(--active-filter-color)!important;'
]) if (!themePreview4Css.includes(token)) throw new Error(`Theme Preview 4 utility-control contract missing: ${token}`);

// RC1 Theme Preview 5: Trash modal semantic mono/recovery/destructive action split.
const themePreview5Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 5 — Trash Modal Semantic Mono.',
  '#trashModal .trash-modal{',
  '#trashModal .trash-actions button[data-restore-trash]{',
  '#trashModal .trash-actions button[data-delete-trash],',
  '#trashModal #emptyTrash{',
  '#trashModal #closeTrash2{',
  'border-color:var(--total)!important;',
  'border-color:var(--dislike)!important;'
]) if (!themePreview5Css.includes(token)) throw new Error(`Theme Preview 5 Trash-modal contract missing: ${token}`);


// RC1 Theme Preview 6: Add modal semantic mono + per-row rating-context focus.
const themePreview6Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 6 — Add Modal Semantic Mono.',
  '#modal .unified-add-modal{',
  '#modal .kinoteka-entry-row{--entry-accent:var(--planned);',
  ':has(.kinoteka-entry-rating.rating-in-progress){--entry-accent:var(--progress)}',
  ':has(.kinoteka-entry-rating.rating-favorite){--entry-accent:var(--favorite)}',
  'border-color:var(--entry-accent)!important;',
  '#modal .unified-add-modal .kinoteka-entry-favorite:has(input:disabled)',
  '#modal #saveAdd{',
  '#modal #cancelAdd{'
]) if (!themePreview6Css.includes(token)) throw new Error(`Theme Preview 6 Add-modal contract missing: ${token}`);


// RC1 Theme Preview 7: add-row media-category select follows each row rating accent.
const themePreview7SelectCss = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const themePreview7SelectJs = fs.readFileSync(path.join(root,'app/shared/themed-select.js'),'utf8');
for (const token of [
  'RC1 Theme Preview 7 — Add-row Contextual Select Accent.',
  '--kinoteka-select-context-accent:var(--entry-accent);',
  '.kinoteka-select-menu-media-category .kinoteka-select-option[aria-selected="true"]',
  'var(--kinoteka-select-context-accent,#67e8f9)'
]) if (!themePreview7SelectCss.includes(token)) throw new Error(`Theme Preview 7 contextual-select CSS contract missing: ${token}`);
for (const token of [
  "if (kind === 'media-category') {",
  "getComputedStyle(row).getPropertyValue('--entry-accent').trim()",
  "menu.style.setProperty('--kinoteka-select-context-accent', accent)"
]) if (!themePreview7SelectJs.includes(token)) throw new Error(`Theme Preview 7 contextual-select runtime contract missing: ${token}`);

// RC1 Theme Preview 8: rating trigger and selected popup option must use semantic status color, never fixed violet.
for (const token of [
  'RC1 Theme Preview 8 — Semantic Rating Select Surface.',
  '--kinoteka-rating-accent:var(--planned,#5B8CFF)',
  '--kinoteka-rating-option-accent:var(--planned,#5B8CFF)',
  '.kinoteka-select-menu-rating-entry .kinoteka-select-option[aria-selected="true"]',
  'background:color-mix(in srgb,var(--kinoteka-rating-option-accent) 18%,#0b0c0e 82%)!important;',
  'border-color:var(--kinoteka-rating-accent,#AFA9BD)!important;'
]) if (!themePreview7SelectCss.includes(token)) throw new Error(`Theme Preview 8 semantic-rating select contract missing: ${token}`);


// RC1 Theme Preview 9: Add Entry primary action follows the last-focused row semantic accent.
const themePreview9Games = fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const themePreview9Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'function syncAddModalActionAccent(row){',
  "modal.dataset.actionRating=cls.replace('rating-','');",
  "row.addEventListener('focusin',()=>syncAddModalActionAccent(row));"
]) if (!themePreview9Games.includes(token)) throw new Error(`Theme Preview 9 contextual Add-action runtime contract missing: ${token}`);
for (const token of [
  'RC1 Theme Preview 9 — Contextual Add Action Accent.',
  '--add-modal-accent:var(--planned)',
  '#modal .unified-add-modal[data-action-rating="liked"]{--add-modal-accent:var(--like)}',
  '#modal #saveAdd{',
  'border-color:var(--add-modal-accent)!important;'
]) if (!themePreview9Css.includes(token)) throw new Error(`Theme Preview 9 contextual Add-action CSS contract missing: ${token}`);

// Canonical SQLite live/seed validation and byte identity.
function verifyDb(rel) {
  const file = path.join(root,rel);
  const db = new DatabaseSync(file,{readOnly:true});
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error(`SQLite integrity failed: ${rel}`);
    const journal = db.prepare('PRAGMA journal_mode').get();
    if (!journal || String(Object.values(journal)[0]).toLowerCase() !== 'delete') throw new Error(`SQLite journal_mode must be delete: ${rel}`);
    for (const table of ['state','ui_state']) if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error(`Missing table ${table}: ${rel}`);
    const row = db.prepare('SELECT revision,payload FROM state WHERE id=1').get();
    if (!row) throw new Error(`Canonical state row missing: ${rel}`);
    const state = JSON.parse(row.payload);
    if (state.app !== 'Кинотека' || Number(state.formatVersion) !== 1) throw new Error(`Kinoteka state identity mismatch: ${rel}`);
    if (!Array.isArray(state.items) || state.items.length !== 0) throw new Error(`Distributed Kinoteka must contain zero items: ${rel}`);
    if(state.favorites?.length || state.trash?.length || state.letterboxd) throw new Error(`Personal data in shipped SQLite: ${rel}`);
    for (const key of ['favorites','trash']) if (!Array.isArray(state[key])) throw new Error(`Canonical state array is invalid (${key}): ${rel}`);
    assertStateSemantics(state, rel);
    const uiRow = db.prepare('SELECT payload FROM ui_state WHERE id=1').get();
    if (!uiRow) throw new Error(`Canonical UI state row missing: ${rel}`);
    const ui = JSON.parse(uiRow.payload);
    for (const key of ['search','sort','quickFilter','mediaCategory','mediaYear']) if (!Object.prototype.hasOwnProperty.call(ui,key)) throw new Error(`UI key is missing (${key}): ${rel}`);
    if (Object.prototype.hasOwnProperty.call(ui,'duplicateOnly')) throw new Error(`Cleanup Pass 3 retired duplicateOnly remains in canonical UI state: ${rel}`);
    assertUiSemantics(ui, rel);
    return {items:state.items.length, revision:Number(row.revision)};
  } finally { db.close(); }
}
const liveInfo = verifyDb('data/kinoteka.sqlite3');
const seedInfo = verifyDb('seed-data/kinoteka.sqlite3');
const liveDb = fs.readFileSync(path.join(root,'data/kinoteka.sqlite3'));
const seedDb = fs.readFileSync(path.join(root,'seed-data/kinoteka.sqlite3'));
if (!liveDb.equals(seedDb)) throw new Error('Canonical live/seed Kinoteka SQLite files must be byte-identical.');
if (liveInfo.items !== seedInfo.items || liveInfo.revision !== seedInfo.revision) throw new Error('Live/seed Kinoteka DB metadata mismatch.');


// RC1 Theme Preview 10: each Trash restore action follows the deleted entry's semantic status color.
const themePreview10Trash = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
for (const token of [
  'class="trash-item ${metaClass}"',
  'const metaClass=clsForRating(meta);'
]) if (!themePreview10Trash.includes(token)) throw new Error(`Theme Preview 10 Trash semantic runtime contract missing: ${token}`);
const themePreview10Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 10 — Contextual Trash Restore Accent.',
  '.trash-item.rating-liked{--trash-restore-accent:var(--like)}',
  '.trash-item.rating-planned{--trash-restore-accent:var(--planned)}',
  '.trash-item.rating-favorite{--trash-restore-accent:var(--favorite)}',
  'button[data-restore-trash]:hover'
]) if (!themePreview10Css.includes(token)) throw new Error(`Theme Preview 10 contextual Trash restore CSS contract missing: ${token}`);

// RC1 Theme Preview 11: restrained glass surfaces + neutral white main Add action.
const themePreview11Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 11 — Soft Glass Mono + White Add Action.',
  '--mono-glass:rgba(13,14,16,.84)',
  'background:rgba(11,12,14,.94)!important;',
  '.list-actions .add-entry-action{',
  'border-color:rgba(255,255,255,.42)!important;',
  'box-shadow:0 0 0 1px rgba(255,255,255,.10),0 0 18px rgba(255,255,255,.16)!important;'
]) if (!themePreview11Css.includes(token)) throw new Error(`Theme Preview 11 glass/white-Add CSS contract missing: ${token}`);


// RC1 Theme Preview 12: pagination is neutral white and background particles are denser/more chaotic.
const themePreview12Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
for (const token of [
  'RC1 Theme Preview 12 background — denser full-spectrum living particles with slightly more chaos.',
  'const count=Math.min(1680,Math.max(1220,Math.round(w*h/1240)))',
  'const clustered=Math.round(count*.54)',
  'Math.min(520,Math.max(330,Math.round(w*h/6200)))',
  'Math.min(34,Math.max(18,Math.round(w*h/42000)))'
]) if (!themePreview12Index.includes(token)) throw new Error(`Theme Preview 12 particle runtime contract missing: ${token}`);
const themePreview12Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 12 — White Pagination + Wilder Living Particles.',
  '--pagination-white-border:rgba(255,255,255,.16)',
  '.pagination .pageBtn.active,',
  '.pagination .pageIndicator{',
  'box-shadow:0 0 0 1px rgba(255,255,255,.10) inset,0 0 18px rgba(255,255,255,.12)!important;'
]) if (!themePreview12Css.includes(token)) throw new Error(`Theme Preview 12 pagination/particle CSS contract missing: ${token}`);


// RC1 Theme Preview 13: reset and search focus are strictly neutral white/graphite.
const themePreview13Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 13 — White Reset + Neutral Search Focus.',
  '--utility-white-border:rgba(255,255,255,.18)',
  '.toolbar .resetFilters:hover:not(:disabled){',
  '.search-wrap #search:focus,',
  'border-color:rgba(255,255,255,.42)!important;',
  'box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 3px rgba(255,255,255,.055),0 0 14px rgba(255,255,255,.06)!important;'
]) if (!themePreview13Css.includes(token)) throw new Error(`Theme Preview 13 white utility/search CSS contract missing: ${token}`);


// RC1 Theme Preview 14: Trash restore and footer close are neutral white/graphite.
const themePreview14Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 14 — White Trash Restore + White Close.',
  '#trashModal .trash-item .trash-actions button[data-restore-trash],',
  'border-color:rgba(255,255,255,.34)!important;',
  'box-shadow:0 0 0 1px rgba(255,255,255,.08),0 0 16px rgba(255,255,255,.12)!important;',
  '#trashModal #closeTrash2{',
  'border-color:rgba(255,255,255,.30)!important;'
]) if (!themePreview14Css.includes(token)) throw new Error(`Theme Preview 14 trash neutral-white CSS contract missing: ${token}`);


// RC1 Theme Preview 15 base glass layer remains present; later hotfixes may override transparency/particle details.
const themePreview15Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 15 — Softer Glass + Line-Free Living Particles.',
  '--mono-glass:rgba(12,13,15,.76)',
  'background:rgba(10,11,13,.90)!important;',
  'background:rgba(10,11,13,.72)!important;'
]) if (!themePreview15Css.includes(token)) throw new Error(`Theme Preview 15 softer-glass base contract missing: ${token}`);
const themePreview15Titlebar = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 15 — translucent monochrome titlebar.',
  'background:rgba(3,3,4,.80)!important;'
]) if (!themePreview15Titlebar.includes(token)) throw new Error(`Theme Preview 15 titlebar glass base contract missing: ${token}`);
const themePreview15Index = fs.readFileSync(path.join(root,'app/index.html'),'utf8');


// RC1 Theme Preview 15 Hotfix 1: transparency stays alpha-based; always-visible backdrop filters are retired to avoid WebView2 compositor seams.
const themePreview15Hf1Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const themePreview15Hf1Titlebar = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 15 Hotfix 1 — WebView2 compositor seam hardening.',
  'backdrop-filter:none!important;',
  '-webkit-backdrop-filter:none!important;'
]) if (!themePreview15Hf1Css.includes(token)) throw new Error(`Theme Preview 15 Hotfix 1 compositor CSS contract missing: ${token}`);
for (const token of [
  'RC1 Theme Preview 15 Hotfix 1 — titlebar stays translucent without backdrop blur.',
  'background:rgba(3,3,4,.76)!important;',
  'backdrop-filter:none!important;'
]) if (!themePreview15Hf1Titlebar.includes(token)) throw new Error(`Theme Preview 15 Hotfix 1 titlebar contract missing: ${token}`);


// RC1 Theme Preview 15 Hotfix 2: rating popup has a comfortable fixed minimum width and no horizontal scrollbar.
const themePreview15Hf2Css = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const themePreview15Hf2Js = fs.readFileSync(path.join(root,'app/shared/themed-select.js'),'utf8');
for (const token of [
  'RC1 Theme Preview 15 Hotfix 2 — comfortable rating popup width.',
  'min-width:176px!important;',
  'overflow-x:hidden!important;'
]) if (!themePreview15Hf2Css.includes(token)) throw new Error(`Theme Preview 15 Hotfix 2 popup CSS contract missing: ${token}`);
for (const token of [
  "const ratingMenu = menu.classList.contains('kinoteka-select-menu-rating-table') || menu.classList.contains('kinoteka-select-menu-rating-entry');",
  'const minWidth = ratingMenu ? 176 : 110;',
  'const preferredLeft = ratingMenu ? rect.left + (rect.width - width) / 2 : rect.left;'
]) if (!themePreview15Hf2Js.includes(token)) throw new Error(`Theme Preview 15 Hotfix 2 popup runtime contract missing: ${token}`);



// RC1 Theme Preview 15 Hotfix 3: restore decorative local glint crosses/streaks while keeping compositor hardening; lower alpha one more step.
const themePreview15Hf3Css = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const themePreview15Hf3Titlebar = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'RC1 Theme Preview 15 Hotfix 3 — Slightly More Transparent Mono Glass.',
  '--mono-glass:rgba(12,13,15,.70)',
  '--mono-glass-soft:rgba(15,16,18,.61)',
  'background:rgba(10,11,13,.65)!important',
  'background:rgba(10,11,13,.86)!important'
]) if (!themePreview15Hf3Css.includes(token)) throw new Error(`Theme Preview 15 Hotfix 3 transparency contract missing: ${token}`);
for (const token of [
  'RC1 Theme Preview 15 Hotfix 3 — slightly lighter titlebar transparency, compositor-safe.',
  'background:rgba(3,3,4,.68)!important;',
  'backdrop-filter:none!important;'
]) if (!themePreview15Hf3Titlebar.includes(token)) throw new Error(`Theme Preview 15 Hotfix 3 titlebar contract missing: ${token}`);
for (const token of [
  'RC1 Theme Preview 15 Hotfix 3 — restore decorative local glint crosses + short fast-particle streaks.',
  'ctx.moveTo(x-r*3.5,y)',
  'ctx.lineTo(x+r*3.5,y)',
  'ctx.moveTo(x,y-r*3.5)',
  'ctx.lineTo(x,y+r*3.5)',
  'ctx.moveTo(oldX,oldY)',
  'ctx.lineTo(x,y)'
]) if (!themePreview15Index.includes(token)) throw new Error(`Theme Preview 15 Hotfix 3 restored particle-line contract missing: ${token}`);

// Release/migration contracts.
const releaseText = `${buildDev}\n${buildRelease}\n${makeRelease}`;
for (const token of [EXPECTED_RELEASE_NAME,'kinoteka.exe','Kinoteka.exe','kinoteka.sqlite3']) if (!releaseText.includes(token)) throw new Error(`Release identity/path missing: ${token}`);
for (const token of ["version = '1.2.0'","channel = 'Stable'","release = 'v1.2 Stable (HF49)'",'System.IO.Compression.ZipFile','SHA256']) if (!makeRelease.includes(token)) throw new Error(`Final release contract missing: ${token}`);
if (!makeRelease.includes('.stable-release-verify-stage') || !makeRelease.includes('.stable-release-source-verify-stage')) throw new Error('ZIP re-extract verification pipeline is missing.');
if (!migrate.includes('data\\movies\\kinoteka.sqlite3') || migrate.includes('data\\games\\kinoteka.sqlite3')) throw new Error('Lost Heaven Kinoteka migration path is wrong.');
if (!migrate.includes('verify-sqlite-db.js')) throw new Error('Migration SQLite verifier is missing.');

new vm.Script(canonicalSummaryHelper, {filename:'scripts/kinoteka-db-summary.js'});

// RC prep: explicit DEV -> canonical live/seed freeze with rollback and byte-identity checks.
for (const token of [
  'Portable\\Kinoteka_Standalone_v1.2_Preview_1_DEV\\data\\kinoteka.sqlite3',
  'CanonicalDataBackups\\before-freeze-',
  'scripts\\verify-sqlite-db.js',
  'scripts\\kinoteka-db-summary.js',
  'Get-Sha256Hex',
  'Assert-NoSqliteSidecars',
  'CANONICAL DATA FREEZE READY / VERIFY OK',
  '-AllowTrash'
]) {
  if (!freezeCanonical.includes(token)) throw new Error(`Canonical data freeze safety contract missing: ${token}`);
}
if (/Get-FileHash/i.test(freezeCanonical)) throw new Error('Canonical data freeze must stay PowerShell 5.1-safe and use .NET SHA-256, not Get-FileHash.');
if (!makeRelease.includes("'FREEZE-CANONICAL-DATA.cmd','FREEZE-CANONICAL-DATA.ps1'")) throw new Error('Final Source ZIP must include canonical data freeze tooling.');

require('./verify-empty-db.js').verify();
const sha = crypto.createHash('sha256').update(liveDb).digest('hex');
// Startup & Titlebar Preview 1: preserve the verified 1.0 Stable data/backend,
// and additionally require both full-width vector controls and a guarded handoff.
require('./verify-startup-titlebar-preview.js');
console.log('Kinoteka Standalone v1.2 Preview 1 — Library Integration verification OK');
console.log('- Dedicated Tauri identity and single-instance guard');
console.log('- Kinoteka-only frontend/backend command surface');
console.log(`- Empty canonical SQLite OK (${liveInfo.items} items, revision ${liveInfo.revision})`);
console.log('- Seed recovery + bounded automatic backups + DB integrity checks');
console.log(`- JavaScript syntax OK (${jsFiles.length} files + ${inlineScripts} inline scripts)`);
console.log('- No active Igroteka/Budget/shell navigation or runtime wiring');
console.log('- Cleanup Pass 1 dead-theme/modal-identity guards OK');
console.log('- Cleanup Pass 2 standalone runtime namespace guards OK');
console.log('- Cleanup Pass 3 retired state/dead selector guards OK');
console.log('- Cleanup Pass 4 canonical rating terminology guards OK');
console.log('- Cleanup Pass 5 confirmed-write compatibility cleanup guards OK');
console.log('- Cleanup Pass 6 non-interactive tooling guards OK');
console.log('- Cleanup Pass 7 retired hidden-count/statistics guards OK');
console.log('- Cleanup Pass 8 retired no-op runtime residue guards OK');
console.log('- Cleanup Pass 9 canonical trash modal semantics guards OK');
console.log('- Cleanup Pass 10 canonical record terminology guards OK');
console.log('- Cleanup Pass 11 canonical add-entry DOM namespace guards OK');
console.log('- Cleanup Pass 12 canonical active entry namespace guards OK');
console.log('- Cleanup Pass 12 Hotfix 1 row copy/delete selector sync guards OK');
console.log('- Cleanup Pass 13 canonical active entry identifier guards OK');
console.log('- Cleanup Pass 14 canonical row selection/copy helper guards OK');
console.log('- Cleanup Pass 14 Hotfix 1 nested trash modal sequencing guards OK');
console.log('- Cleanup Pass 14 Hotfix 2 smooth confirmed-trash close guards OK');
console.log('- Modal Motion Pass 2 mirrored open/close animation guards OK');
console.log('- Cleanup Pass 15 canonical frontend helper namespace guards OK');
console.log('- Cleanup Pass 16 functional identity/Escape safety guards OK');
console.log('- Cleanup Pass 17 centralized modal lifecycle guards OK');
console.log('- Cleanup Pass 18 interaction/persistence hardening guards OK');
console.log('- Cleanup Pass 19 dead-code/behavior-preservation guards OK');
console.log('- Cleanup Pass 20 exact-duplicate CSS consolidation guards OK');
console.log('- Cleanup Pass 21 superseded-override CSS consolidation guards OK');
console.log('- Cleanup Pass 22 retired Trash-animation CSS guards OK');
console.log('- Cleanup Pass 23 runtime-performance/semantic-DB guards OK');
console.log('- RC-prep canonical DEV-to-live/seed freeze tooling guards OK');
console.log('- v1.2 Preview 1 promotion metadata/artifact naming guards OK');
console.log('- RC1 canonical Kinoteka icon/favicons guard OK');
console.log('- RC1 Theme Preview 1 Cinema Mono + Living Particles guards OK');
console.log('- RC1 Theme Preview 2 True Mono Base + Active Filter Glow guards OK');
console.log('- RC1 Theme Preview 3 True Black Runtime + Contextual Filter Accent guards OK');
console.log('- RC1 Theme Preview 4 Semantic Utility Controls + Contextual Pagination guards OK');
console.log('- RC1 Theme Preview 5 Trash Modal Semantic Mono guards OK');
console.log('- RC1 Theme Preview 6 Add Modal Semantic Mono guards OK');
console.log('- RC1 Theme Preview 7 Add-row Contextual Select Accent guards OK');
console.log('- RC1 Theme Preview 8 Semantic Rating Select Surface guards OK');
console.log('- RC1 Theme Preview 9 Contextual Add Action Accent guards OK');
console.log('- RC1 Theme Preview 10 Contextual Trash Restore Accent guards OK');
console.log('- RC1 Theme Preview 11 Soft Glass Mono + White Add guards OK');
console.log('- RC1 Theme Preview 12 White Pagination + Wilder Living Particles guards OK');
console.log('- RC1 Theme Preview 13 White Reset + Neutral Search Focus guards OK');
console.log('- RC1 Theme Preview 14 White Trash Restore + White Close guards OK');
console.log('- RC1 Theme Preview 15 Softer Glass + Line-Free Particles guards OK');
console.log('- RC1 Theme Preview 15 Hotfix 1 WebView2 Compositor Seam guards OK');
console.log('- RC1 Theme Preview 15 Hotfix 2 Wider Rating Menu guards OK');
console.log('- RC1 Theme Preview 15 Hotfix 3 Restored Local Glints + More Transparency guards OK');
console.log('- Latest Kinoteka PATCH 028 year/star polish present');
console.log('- Windows migration points to Lost Heaven data\\movies\\kinoteka.sqlite3');
console.log('- v1.2 Preview 1 version/release metadata consistency OK');
console.log('- Strict 3-file Portable allowlist + ZIP/SHA-256 re-extract pipeline');
console.log(`- Canonical live/seed byte identity OK (${sha.slice(0,12)}...)`);
