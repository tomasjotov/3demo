#!/usr/bin/env node
/*
 * Exports the 3D client into the hof web application, without a bundler:
 * ES modules are copied as they are and the bare imports of three.js
 * ('three', 'three/addons/...') are rewritten to relative paths.
 *
 *   node tools/export-hof.mjs [WEB-INF dir]
 *   default: ../hof/src/main/webapp/WEB-INF
 *
 * Result (mvc:resources /js/** and /assets/**):
 *   js/plan3d/src/**          client modules (entry: src/embed.js)    → <ctx>/js/plan3d/
 *   js/plan3d/lib/            three.module.js, three.core.js, addons/loaders/GLTFLoader.js, addons/utils/...
 *   js/plan3d/VERSION.txt
 *   assets/objects/*.glb      object models    (public/assets/models/objects)    → <ctx>/assets/objects/
 *   assets/objects/previews/*.png  editor palette thumbnails
 *   assets/objects/catalog.json    object catalogue (src/data/objectCatalog.js) for planControl3d.jsp
 *   assets/characters/*.glb   character models (public/assets/models/characters) → <ctx>/assets/characters/
 * Existing files are overwritten, nothing is deleted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webinf = path.resolve(root, process.argv[2] || '../hof/src/main/webapp/WEB-INF');
const target = path.join(webinf, 'js/plan3d');
const three = path.join(root, 'node_modules/three');

const LIB = {
    'build/three.module.js': 'lib/three.module.js',
    'build/three.core.js': 'lib/three.core.js',
    'examples/jsm/loaders/GLTFLoader.js': 'lib/addons/loaders/GLTFLoader.js',
    'examples/jsm/utils/BufferGeometryUtils.js': 'lib/addons/utils/BufferGeometryUtils.js'
};

let files = 0;
const rel = (fromFile, toFile) => {
    let r = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/');
    return r.startsWith('.') ? r : './' + r;
};

function rewrite(code, destFile) {
    const threeMain = path.join(target, 'lib/three.module.js');
    return code
        .replace(/(from\s*|import\s*\(\s*)(['"])three\2/g, (m, pre, q) => `${pre}${q}${rel(destFile, threeMain)}${q}`)
        .replace(/(['"])three\/addons\/([^'"]+)\1/g, (m, q, sub) => `${q}${rel(destFile, path.join(target, 'lib/addons', sub))}${q}`);
}

function writeFile(dest, content) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    files++;
}

function copyTree(srcDir, destDir, filter, transform) {
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const s = path.join(srcDir, entry.name), d = path.join(destDir, entry.name);
        if (entry.isDirectory()) copyTree(s, d, filter, transform);
        else if (filter(s)) writeFile(d, transform ? transform(fs.readFileSync(s, 'utf8'), d) : fs.readFileSync(s));
    }
}

// 1) client modules (tools/ = standalone dev pages, not needed in hof)
copyTree(path.join(root, 'src'), path.join(target, 'src'),
    f => f.endsWith('.js') && !f.includes(`${path.sep}tools${path.sep}`), rewrite);

// 2) three.js
for (const [from, to] of Object.entries(LIB)) {
    const dest = path.join(target, to);
    writeFile(dest, rewrite(fs.readFileSync(path.join(three, from), 'utf8'), dest));
}

// 3) GLB models → WEB-INF/assets/{objects,characters}
for (const kind of ['objects', 'characters']) {
    const src = path.join(root, 'public/assets/models', kind);
    if (fs.existsSync(src)) copyTree(src, path.join(webinf, 'assets', kind), f => f.endsWith('.glb') || f.endsWith('.png'));
}

// 4) object catalogue as JSON for the JSP editor palette
const { OBJECT_GROUPS, OBJECT_CATALOG, sprite2d } = await import(new URL('../src/data/objectCatalog.js', import.meta.url));
writeFile(path.join(webinf, 'assets/objects/catalog.json'), JSON.stringify({
    groups: OBJECT_GROUPS,
    objects: OBJECT_CATALOG.map(o => ({ ...o, sprite2d: sprite2d(o.id) }))
}, null, 1));

writeFile(path.join(target, 'VERSION.txt'), `${new Date().toISOString()}\n`);
console.log(`plan3d exported: ${files} files → ${target} (+ models in ${path.join(webinf, 'assets')})`);
