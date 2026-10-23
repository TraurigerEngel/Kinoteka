"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const css = fs.readFileSync(path.join(root,"app/styles.css"),"utf8");
const games = fs.readFileSync(path.join(root,"app/games.js"),"utf8");
const html = fs.readFileSync(path.join(root,"app/index.html"),"utf8");
const packageJson = require(path.join(root,"package.json"));
// The change must be scoped to the title label of a film card, not the table or its controls.
const block=css.match(/\/\* HF59 — center movie titles within their own card width\.[\s\S]*?\*\/\s*(\.kinoteka-film-card \.kinoteka-card-title\s*\{[^}]*\})/);
assert(block,"HF59 card title rule missing");
assert.match(block[1],/text-align\s*:\s*center\s*;/);
assert.doesNotMatch(block[1],/(width|height|margin|padding|display|position|font-size|line-height|transform|overflow|grid|pointer-events)\s*:/i,"Do not alter title geometry");
assert.match(games,/class="kinoteka-card-meta"><div class="kinoteka-card-title"/);
assert.match(games,/class="kinoteka-card-title-full" role="tooltip"/);
assert.match(html,/id="kinotekaCardGrid"/);
assert.match(packageJson.scripts.verify,/test-card-title-center-hf59\.js\s*&&\s*node scripts\/test-sort-field-highlight-hf60.js\s*&&\s*node scripts\/test-release-v121\.js$/);
console.log("HF59 CARD TITLES: PASS (centered inside each card, 3-line clipping and table unchanged)");
