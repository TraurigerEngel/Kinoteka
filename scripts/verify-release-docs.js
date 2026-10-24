'use strict';
const fs = require('node:fs');
const path = require('node:path');
const portableDocs = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'GITHUB_PRIVACY_RU.md', 'README-PORTABLE.txt'];
function verify(kind, root) {
  if (!['source', 'portable'].includes(kind)) throw new Error('Expected source or portable documentation mode.');
  root = path.resolve(root);
  const required = kind === 'source' ? [...portableDocs, 'README.md', '.gitignore', 'CHANGELOG.md', 'RELEASE_NOTES_v1.2.1_STABLE.md', 'RELEASE-CHECKLIST.md'] : portableDocs;
  for (const file of required) {
    const target = path.join(root, file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile() || !fs.readFileSync(target, 'utf8').trim()) throw new Error(`Missing/empty release document: ${file}`);
  }
  if (kind === 'source') {
    const rules = new Set(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).map(x => x.trim()));
    for (const rule of ['data/*.sqlite3', 'data/backups/', 'posters/', '*.sqlite3-wal', '*.sqlite3-shm', '*.sqlite3-journal']) {
      if (!rules.has(rule)) throw new Error(`Missing privacy exclusion: ${rule}`);
    }
    for (const match of fs.readFileSync(path.join(root, 'README.md'), 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
      const href = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) continue;
      const relative = decodeURIComponent(href.split(/[?#]/)[0]);
      if (relative && !fs.existsSync(path.resolve(root, relative))) throw new Error(`Broken README link: ${href}`);
    }
  }
}
module.exports = { verify, portableDocs };
if (require.main === module) {
  verify(process.argv[2], process.argv[3] || path.resolve(__dirname, '..'));
  console.log('RELEASE DOCUMENTATION: PASS');
}
