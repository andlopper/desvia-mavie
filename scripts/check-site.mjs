import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readProjectFile = (relativePath) => readFile(path.join(root, relativePath));
const html = await readProjectFile('index.html').then((buffer) => buffer.toString('utf8'));
const game = await readProjectFile('game.js').then((buffer) => buffer.toString('utf8'));
const server = await readProjectFile('serve.mjs').then((buffer) => buffer.toString('utf8'));

assert.match(html, /<script\s+type="module"\s+src="game\.js(?:\?[^\"]*)?"\s*>/,
  'index.html loads the browser game as an ES module');
assert.match(html, /href="styles\.css(?:\?[^\"]*)?"/, 'index.html loads the game stylesheet');
assert.match(game, /from '\.\/game-logic\.js'/, 'game.js imports the unit-tested game logic');
const importedLogic = game.match(/import\s*\{([^}]+)\}\s*from\s*'\.\/game-logic\.js'/)?.[1];
assert.ok(importedLogic, 'game logic imports use a named import list');
const logicModule = await readProjectFile('game-logic.js').then((buffer) => buffer.toString('utf8'));
for (const importedName of importedLogic.split(',').map((name) => name.trim())) {
  assert.match(logicModule, new RegExp(`export\\s+(?:function|const)\\s+${importedName}\\b`),
    `${importedName} is exported by game-logic.js`);
}
assert.match(game, /visibilitychange/, 'game responds when the browser tab becomes hidden');
assert.match(game, /setInterval\(\(\) =>/, 'a watchdog can recover a stalled animation frame loop');
assert.doesNotMatch(game, /walk-extra\.png/, 'test-only walk image is not loaded by the game');
assert.match(server, /requestPath\.slice\(1\)/, 'preview server resolves static request paths');
assert.match(server, /writeHead\(404/, 'preview server reports missing files as 404');
assert.match(server, /startsWith\(`\$\{root\}\$\{path\.sep\}`\)/, 'preview server blocks paths outside the project');

const requiredAssets = [
  'idle.png', 'duck.png', 'walk-a.png', 'walk-b.png', 'walk-c.png',
  ...Array.from({ length: 3 }, (_, index) => `duck-walk-${String(index).padStart(2, '0')}.png`),
  ...Array.from({ length: 8 }, (_, index) => `jump-${String(index).padStart(2, '0')}.png`)
];
for (const filename of requiredAssets) {
  const bytes = await readProjectFile(path.join('assets', 'characters', filename));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filename} is a valid PNG`);
}

const requiredBallSprites = Array.from({ length: 8 }, (_, index) => `rotation-${String(index).padStart(2, '0')}.png`);
for (const filename of requiredBallSprites) {
  const bytes = await readProjectFile(path.join('assets', 'balls', filename));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filename} is a valid PNG`);
}
assert.match(game, /assets\/balls\/rotation-\$\{String\(index\)\.padStart\(2, '0'\)\}\.png/,
  'football rotation frames are loaded by index');
assert.match(game, /duck-walk-\$\{String\(index\)/, 'crouched walking uses its own animation frames');

const requiredBackgrounds = ['desktop.png', 'mobile.png'];
for (const filename of requiredBackgrounds) {
  const bytes = await readProjectFile(path.join('assets', 'backgrounds', filename));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filename} is a valid PNG`);
}
assert.match(game, /assets\/backgrounds\/desktop\.png/, 'desktop stage background is loaded');
assert.match(game, /assets\/backgrounds\/mobile\.png/, 'mobile stage background is loaded');

console.log(`Site check passed: entry point, logic imports, server safeguards, ${requiredAssets.length} character sprites, ${requiredBallSprites.length} ball frames and ${requiredBackgrounds.length} stage backgrounds.`);
