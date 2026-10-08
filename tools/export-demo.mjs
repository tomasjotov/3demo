#!/usr/bin/env node
/*
 * Static demo build without a bundler (plain ES modules + import map):
 *
 *   node tools/export-demo.mjs [target dir]          default: deploy/
 *
 * Upload the content of the target folder anywhere, e.g. https://www.hrdinovefantasy.cz/demo/hof3d/
 * – all paths are relative. Result:
 *   index.html, game.html, wardrobe.html, avatar-viewer.html, object-assets.html,
 *   bestiary.html, creature-test.html                                                 (import map injected)
 *   src/**            client modules as they are
 *   lib/              three.module.js, three.core.js and the used addons (GLTFLoader, GLTFExporter, …)
 *   assets/, beast/, fixtures/, hub/   from public/
 * Existing files are overwritten, nothing is deleted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(root, process.argv[2] || 'deploy');
const three = path.join(root, 'node_modules/three');
const PAGES = ['index.html', 'game.html', 'wardrobe.html', 'avatar-viewer.html', 'object-assets.html', 'bestiary.html', 'creature-test.html'];
const IMPORT_MAP = '<script type="importmap">{"imports":{"three":"./lib/three.module.js","three/addons/":"./lib/addons/"}}</script>';

let files = 0;
function writeFile(dest, content) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    files++;
}
function copyTree(srcDir, destDir, filter = () => true) {
    if (!fs.existsSync(srcDir)) return;
    for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const s = path.join(srcDir, e.name), d = path.join(destDir, e.name);
        if (e.isDirectory()) copyTree(s, d, filter);
        else if (filter(s)) writeFile(d, fs.readFileSync(s));
    }
}

// 1) pages: import map before the first module script
for (const p of PAGES) {
    let html = fs.readFileSync(path.join(root, p), 'utf8');
    if (html.includes('type="module"')) html = html.replace('<script type="module"', IMPORT_MAP + '<script type="module"');
    writeFile(path.join(target, p), html);
}

// 2) client modules
copyTree(path.join(root, 'src'), path.join(target, 'src'), f => /\.(js|css)$/.test(f));

// 3) three.js + the addons the client imports (and what they import, relatively)
writeFile(path.join(target, 'lib/three.module.js'), fs.readFileSync(path.join(three, 'build/three.module.js')));
writeFile(path.join(target, 'lib/three.core.js'), fs.readFileSync(path.join(three, 'build/three.core.js')));
const addons = new Set();
const scan = file => {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/from\s*['"]three\/addons\/([^'"]+)['"]/g)) addons.add(m[1]);
};
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f); else if (f.endsWith('.js')) scan(f);
    }
})(path.join(root, 'src'));
const queue = [...addons];
const done = new Set();
while (queue.length) {
    const rel = queue.shift();
    if (done.has(rel)) continue;
    done.add(rel);
    const src = path.join(three, 'examples/jsm', rel);
    const code = fs.readFileSync(src, 'utf8');
    writeFile(path.join(target, 'lib/addons', rel), code);
    for (const m of code.matchAll(/from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
}

// 4) static data
for (const d of ['assets', 'beast', 'fixtures', 'hub']) copyTree(path.join(root, 'public', d), path.join(target, d));

writeFile(path.join(target, 'VERSION.txt'), `${new Date().toISOString()}\n`);
console.log(`demo exported: ${files} files → ${target} (addons: ${[...done].join(', ')})`);
