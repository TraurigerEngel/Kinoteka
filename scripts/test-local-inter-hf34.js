'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root,'app/shared/fonts.css'), 'utf8');
const styles = fs.readFileSync(path.join(root,'app/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root,'app/index.html'), 'utf8');
const tauri = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'), 'utf8'));
assert.equal(tauri.build.frontendDist, '../app', 'Tauri should bundle local app assets');
assert.match(html, /rel="stylesheet"\s+href="shared\/fonts\.css"/, 'local stylesheet is loaded');
assert.match(styles, /--font-ui:"Inter"/);
assert.match(styles, /html,body\{font-family:var\(--font-ui\)!important\}/);
const faces = [
 ['Regular',400], ['Medium',500], ['SemiBold',600], ['Bold',700],
];
for (const [name,weight] of faces) {
 const rel = `shared/fonts/Inter-${name}.woff2`;
 const p = path.join(root,'app',rel);
 const binary = fs.readFileSync(p);
 assert.equal(binary.subarray(0,4).toString('ascii'),'wOF2', `${rel} must be a valid WOFF2 container`);
 assert.ok(binary.length > 2048, `${rel} unexpectedly small`);
 assert.ok(html.includes(`href="${rel}"`), `missing local font preload: ${rel}`);
 assert.ok(css.includes(`fonts/Inter-${name}.woff2`) && css.includes(`font-weight:${weight}`), `missing Inter ${weight} face`);
}
assert.doesNotMatch(css,/https?:\/\//, 'Inter must never depend on a remote font host');
console.log('HOTFIX 34 INTER: PASS (4 bundled local WOFF2 weights, active app typography, no font CDN dependency)');
