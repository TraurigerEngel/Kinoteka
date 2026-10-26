'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verify, portableDocs } = require('./verify-release-docs.js');
const root = path.resolve(__dirname, '..');
verify('source', root);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kinoteka-docs-'));
try {
  for (const name of [...portableDocs, 'README.md', '.gitignore', 'CHANGELOG.md', 'RELEASE_NOTES_v1.2.1_STABLE.md', 'RELEASE-CHECKLIST.md']) fs.copyFileSync(path.join(root, name), path.join(temp, name));
  verify('portable', temp);
  verify('source', temp);
  for (const name of portableDocs) {
    const target = path.join(temp, name), bytes = fs.readFileSync(target);
    fs.unlinkSync(target);
    assert.throws(() => verify('portable', temp), /Missing\/empty release document/);
    fs.writeFileSync(target, bytes);
  }
  const ignore = fs.readFileSync(path.join(temp, '.gitignore'), 'utf8');
  for (const rule of ['data/*.sqlite3', 'posters/']) {
    fs.writeFileSync(path.join(temp, '.gitignore'), ignore.split(/\r?\n/).filter(line => line !== rule).join('\n'));
    assert.throws(() => verify('source', temp), /Missing privacy exclusion/);
  }
  fs.writeFileSync(path.join(temp, '.gitignore'), ignore);
  fs.appendFileSync(path.join(temp, 'README.md'), '\n[Missing](MISSING-DOCUMENT.md)\n');
  assert.throws(() => verify('source', temp), /Broken README link/);
  // Check wiring in the active scripts, not historical builders.
  const build = fs.readFileSync(path.join(root, 'BUILD-RELEASE-v1.2.1.ps1'), 'utf8');
  const make = fs.readFileSync(path.join(root, 'MAKE-FINAL-RELEASE-v1.2.1.ps1'), 'utf8');
  for (const name of portableDocs) { assert(build.includes(`'${name}'`)); assert(make.includes(`'${name}'`)); }
  assert(build.indexOf('scripts\\verify-empty-db.js') < build.indexOf('npm run build:release'));
  assert(build.includes('scripts\\verify-release-docs.js source $PSScriptRoot'));
  assert(build.includes('scripts\\verify-release-artifact.js $out --with-docs'));
  assert(make.includes('scripts\\verify-release-artifact.js $verifyStage --with-docs'));
  assert(make.includes('packaging_revision = 2'));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('RELEASE DOCS: PASS (missing documents, privacy exclusions, broken links, active packaging wiring)');
