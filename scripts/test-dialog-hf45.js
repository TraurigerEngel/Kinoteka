'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app/shared/modal-system.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app/shared/modal-system.js'), 'utf8');
const games = fs.readFileSync(path.join(root, 'app/games.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
for (const selector of [
  '.kinoteka-native-dialog-layer{', '.kinoteka-native-dialog{',
  '.kinoteka-native-dialog-head{', '.kinoteka-native-dialog-title{',
  '.kinoteka-native-dialog-body{', '.kinoteka-native-dialog-actions{',
  '.kinoteka-native-dialog-btn{',
]) assert.ok(css.includes(selector), `native dialog CSS must be static: ${selector}`);
assert.match(css, /\.kinoteka-native-dialog-layer\{[^}]*position:fixed!important/);
assert.match(css, /\.kinoteka-native-dialog-layer\{[^}]*z-index:10000!important/);
assert.match(html, /href="shared\/modal-system\.css"/);
assert.doesNotMatch(js, /createElement\(['"]style['"]\)/, 'style injection must not be necessary');
assert.match(games, /if\(scoreDialogActive\) return Promise\.resolve\(undefined\)/);
assert.match(games, /scoreDialogActive=false;document\.removeEventListener/);
assert.match(games, /В разделе «\$\{label\}» пока нет записей/);
assert.match(pkg.scripts.verify, /scripts\/test-dialog-hf45\.js/);

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this.attributes = new Map();
    const classes = new Set();
    this.classList = {
      add(...keys){ keys.forEach(x => classes.add(x)); },
      remove(...keys){ keys.forEach(x => classes.delete(x)); },
      contains(x){ return classes.has(x); },
      toggle(x, on){ if(on) classes.add(x); else classes.delete(x); },
    };
  }
  set className(value){ this._className = value; value.split(/\s+/).forEach(x => x && this.classList.add(x)); }
  get className(){ return this._className || ''; }
  setAttribute(k,v){ this.attributes.set(k,v); }
  getAttribute(k){ return this.attributes.get(k) || null; }
  append(...nodes){ for(const n of nodes) this.appendChild(n); }
  appendChild(node){ this.children.push(node); node.parent=this; return node; }
  remove(){ if(this.parent){this.parent.children = this.parent.children.filter(x => x!==this);this.parent=null;} }
  addEventListener(name, fn){ if(!this.listeners.has(name)) this.listeners.set(name, []);this.listeners.get(name).push(fn); }
  focus(){}
  click(){ for(const fn of this.listeners.get('click') || []) fn({target:this}); }
}
(async () => {
  const body = new FakeNode('body');
  const htmlNode = new FakeNode('html');
  const document = {
    body, documentElement:htmlNode, activeElement:null,
    addEventListener(){}, querySelectorAll(){ return []; },
    createElement(tag){ return new FakeNode(tag); },
  };
  const window = { matchMedia(){ return {matches:true}; } };
  const ctx = {window, document, requestAnimationFrame(fn){ fn(); }, clearTimeout, setTimeout, console};
  vm.runInNewContext(js,ctx,{filename:'modal-system.js'});
  assert.ok(window.KinotekaDialog);
  const first=window.KinotekaDialog.confirm('Статус будет изменён',{title:'Изменить статус'});
  const duplicate=window.KinotekaDialog.confirm('Статус будет изменён',{title:'Изменить статус'});
  assert.equal(body.children.length,1, 'two rapid confirms must produce one overlay');
  assert.equal(await duplicate,false,'duplicate confirmation must fail closed');
  const layer=body.children[0];
  const actions=layer.children[0].children[2];
  actions.children[0].click();
  assert.equal(await first,false);
  assert.equal(body.children.length,0,'closed dialogs must be removed from the DOM');
  const next=window.KinotekaDialog.confirm('Другое действие');
  assert.equal(body.children.length,1,'new dialog must be possible after dismissal');
  body.children[0].children[0].children[2].children[1].click();
  assert.equal(await next,true);
  assert.equal(body.children.length,0);
  console.log('PASS HF45: permanent dialog geometry, duplicate-safe confirmation, dismissal/reuse, empty-filter explanation');
})().catch(err => {console.error(err); process.exitCode=1;});
