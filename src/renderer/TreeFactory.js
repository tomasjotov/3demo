import * as THREE from 'three';

/*
 * TreeFactory — procedural low-poly vegetation.
 *
 * Every model is a Group with two named children so that both the procedural
 * version and the exported GLB assets can be animated the same way:
 *   "trunk" – static part
 *   "crown" – foliage, swayed by ObjectRenderer (wind)
 *
 * Types: oak, pine, birch, apple, bush, deadtree.  `variant` (1..n) picks a
 * deterministic seed, so the same variant always looks the same — this is
 * what `tools/tree-assets.html` exports to public/assets/models/objects/.
 */

export const TREE_TYPES = {
    oak: 3, pine: 3, birch: 3, apple: 2, bush: 2, deadtree: 2
};
export const isTree = type => type in TREE_TYPES;
export const treeAssetName = (type, variant = 1) => `tree_${type}_${variant}`;

// Small seeded RNG (mulberry32).
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const matCache = new Map();
function mat(color, rough = .9) {
    const key = `${color}:${rough}`;
    if (!matCache.has(key)) {
        const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
        m.name = `veg_${color.toString(16)}`;
        matCache.set(key, m);
    }
    return matCache.get(key);
}

// Flat-shaded, slightly lumpy blob. Jitter depends only on vertex position,
// so the non-indexed faces stay watertight.
function blob(radius, detail, R, lump = .18) {
    const g = new THREE.IcosahedronGeometry(radius, detail);
    const p = g.attributes.position;
    const seedX = R() * 100, seedY = R() * 100;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = Math.sin(x * 12.9 + seedX) * Math.cos(z * 11.3 + seedY) * Math.sin(y * 9.7 + seedX * .5);
        const k = 1 + n * lump;
        p.setXYZ(i, x * k, y * k * .92, z * k);
    }
    g.computeVertexNormals();
    return g;
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

// Tapered trunk segment from a to b (Vector3).
function limb(parent, a, b, r0, r1, material, seg = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, seg);
    g.translate(0, len / 2, 0);
    const m = mesh(g, material, parent, a.x, a.y, a.z);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
}

function root(name) {
    const g = new THREE.Group();
    g.name = name;
    const trunk = new THREE.Group(); trunk.name = 'trunk';
    const crown = new THREE.Group(); crown.name = 'crown';
    g.add(trunk, crown);
    return { g, trunk, crown };
}

// ----------------------------------------------------------------------------
const BUILDERS = {
    oak(R) {
        const { g, trunk, crown } = root('oak');
        const bark = mat(0x6b4a2e), leaf = [mat(0x4f8a32), mat(0x5c9a3a), mat(0x447a2b)];
        const h = 1.25 + R() * .35;
        const top = new THREE.Vector3((R() - .5) * .15, h, (R() - .5) * .15);
        limb(trunk, new THREE.Vector3(0, 0, 0), top, .19, .12, bark, 7);
        // root flare
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + R() * .6;
            limb(trunk, new THREE.Vector3(0, .25, 0), new THREE.Vector3(Math.cos(a) * .3, 0, Math.sin(a) * .3), .08, .03, bark, 5);
        }
        // branches
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + R();
            const end = new THREE.Vector3(Math.cos(a) * .55, h + .35 + R() * .3, Math.sin(a) * .55);
            limb(trunk, top.clone().multiplyScalar(.85), end, .08, .04, bark, 5);
        }
        crown.position.copy(top);
        const n = 6 + Math.floor(R() * 3);
        mesh(blob(.72, 1, R), leaf[0], crown, 0, .55, 0);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + R() * .4;
            const r = .5 + R() * .25, y = .35 + R() * .55;
            mesh(blob(.38 + R() * .2, 1, R), leaf[i % 3], crown, Math.cos(a) * r, y, Math.sin(a) * r);
        }
        mesh(blob(.45, 1, R), leaf[1], crown, 0, 1.05, 0);
        return g;
    },

    apple(R) {
        const g = BUILDERS.oak(R);
        g.name = 'apple';
        g.scale.setScalar(.8);
        const crown = g.getObjectByName('crown');
        const fruit = mat(0xc8332b, .6);
        const fruitGeo = new THREE.IcosahedronGeometry(.055, 0);
        for (let i = 0; i < 14; i++) {
            const a = R() * Math.PI * 2, y = .2 + R() * .9, r = .62 + R() * .3;
            mesh(fruitGeo, fruit, crown, Math.cos(a) * r, y, Math.sin(a) * r);
        }
        return g;
    },

    pine(R) {
        const { g, trunk, crown } = root('pine');
        const bark = mat(0x5a3d26), needles = [mat(0x2f5d34), mat(0x376b3a), mat(0x2a5230)];
        const h = 2.6 + R() * .6;
        limb(trunk, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * .55, 0), .14, .1, bark, 6);
        const tiers = 4 + Math.floor(R() * 2);
        for (let i = 0; i < tiers; i++) {
            const t = i / tiers;
            const r = .75 * (1 - t * .78) + R() * .06;
            const ch = .9 - t * .3;
            const geo = new THREE.ConeGeometry(r, ch, 7 + (i % 2), 1);
            const p = geo.attributes.position;
            for (let k = 0; k < p.count; k++) {
                if (p.getY(k) < 0) {   // ragged bottom edge
                    const x = p.getX(k), z = p.getZ(k);
                    p.setY(k, p.getY(k) + Math.sin(x * 9 + i) * .05 - .03);
                    p.setX(k, x * (1 + Math.cos(z * 7 + i) * .08));
                }
            }
            geo.computeVertexNormals();
            const m = mesh(geo.toNonIndexed(), needles[i % 3], crown, 0, .55 + t * (h - .9) + ch / 2, 0);
            m.geometry.computeVertexNormals();
            m.rotation.y = R() * Math.PI;
        }
        return g;
    },

    birch(R) {
        const { g, trunk, crown } = root('birch');
        const bark = mat(0xe8e2d4, .7), dark = mat(0x2b2723), leaf = [mat(0x8db54a), mat(0x7aa63e), mat(0x9cc057)];
        const h = 2.0 + R() * .4;
        const lean = new THREE.Vector3((R() - .5) * .3, h, (R() - .5) * .3);
        limb(trunk, new THREE.Vector3(0, 0, 0), lean, .09, .05, bark, 6);
        // dark bark marks
        for (let i = 0; i < 6; i++) {
            const y = .2 + i * h / 7;
            const k = y / h;
            const m = mesh(new THREE.BoxGeometry(.07, .025, .02), dark, trunk, lean.x * k, y, lean.z * k + .08 - k * .03);
            m.rotation.y = R() * Math.PI * 2;
            m.castShadow = false;
        }
        crown.position.set(lean.x * .7, h * .62, lean.z * .7);
        const n = 5 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
            const y = i / n * .95, a = R() * Math.PI * 2, r = .12 + R() * .12;
            mesh(blob(.34 - i * .02 + R() * .08, 1, R, .22), leaf[i % 3], crown, Math.cos(a) * r, y, Math.sin(a) * r)
                .scale.set(1, 1.25, 1);
        }
        return g;
    },

    bush(R) {
        const { g, crown } = root('bush');
        const leaf = [mat(0x4a7d2f), mat(0x568d36), mat(0x3f6e29)];
        const n = 4 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + R() * .5, r = .15 + R() * .12;
            mesh(blob(.22 + R() * .1, 1, R, .2), leaf[i % 3], crown, Math.cos(a) * r, .2 + R() * .08, Math.sin(a) * r);
        }
        mesh(blob(.26, 1, R), leaf[1], crown, 0, .32, 0);
        if (R() > .4) {   // berries
            const berry = mat(0x8e2343, .5), bg = new THREE.IcosahedronGeometry(.03, 0);
            for (let i = 0; i < 9; i++) {
                const a = R() * Math.PI * 2;
                mesh(bg, berry, crown, Math.cos(a) * .33, .2 + R() * .25, Math.sin(a) * .33);
            }
        }
        return g;
    },

    deadtree(R) {
        const { g, trunk, crown } = root('deadtree');
        const bark = mat(0x5e5246, .95);
        const h = 1.5 + R() * .4;
        const top = new THREE.Vector3((R() - .5) * .25, h, (R() - .5) * .25);
        limb(trunk, new THREE.Vector3(0, 0, 0), top, .15, .07, bark, 6);
        crown.position.set(0, 0, 0);
        const grow = (from, dir, len, r, depth) => {
            const to = from.clone().addScaledVector(dir, len);
            limb(crown, from, to, r, r * .6, bark, 5);
            if (depth <= 0) return;
            for (let i = 0; i < 2; i++) {
                const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (i ? 1 : -1) * (.8 + R() * .6))
                    .add(new THREE.Vector3(0, .35, 0)).normalize();
                grow(to, d, len * .65, r * .6, depth - 1);
            }
        };
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + R();
            grow(top.clone().multiplyScalar(.8 + i * .07), new THREE.Vector3(Math.cos(a), .9, Math.sin(a)).normalize(), .5, .06, 2);
        }
        // broken stump knob
        mesh(new THREE.IcosahedronGeometry(.1, 0), bark, trunk, top.x, top.y, top.z);
        return g;
    },

    // tree01 of the old 2D editor: tall, slim, airy deciduous tree (aspen / poplar look).
    poplar(R) {
        const { g, trunk, crown } = root('poplar');
        const bark = mat(0x5b4a3c), leaf = [mat(0x6aa83e), mat(0x7db84a), mat(0x5a9536), mat(0x8cc456)];
        const h = 1.5;
        const top = new THREE.Vector3(.05, h, -.03);
        limb(trunk, new THREE.Vector3(0, 0, 0), top, .13, .08, bark, 7);
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + R();
            limb(trunk, new THREE.Vector3(0, .2, 0), new THREE.Vector3(Math.cos(a) * .22, 0, Math.sin(a) * .22), .06, .025, bark, 5);
        }
        limb(trunk, top.clone().multiplyScalar(.8), new THREE.Vector3(.04, h + 1.6, 0), .07, .02, bark, 5);   // leader
        crown.position.copy(top);
        // narrow, tall, loose crown of many small clumps
        const n = 22;
        for (let i = 0; i < n; i++) {
            const t = i / n;
            const y = -.15 + t * 2.05;
            const r = (.42 + Math.sin(t * Math.PI) * .2) * (.6 + R() * .45);
            const a = R() * Math.PI * 2;
            mesh(blob(.2 + R() * .13, 1, R, .25), leaf[i % 4], crown, Math.cos(a) * r, y, Math.sin(a) * r).scale.y = 1.2;
        }
        return g;
    },

    // tree02 of the old 2D editor: tall, dense spruce.
    spruce(R) {
        const { g, trunk, crown } = root('spruce');
        const bark = mat(0x4a3424), needles = [mat(0x24502d), mat(0x2c5d33), mat(0x1f472a)];
        const h = 3.3;
        limb(trunk, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * .7, 0), .15, .06, bark, 6);
        const tiers = 8;
        for (let i = 0; i < tiers; i++) {
            const t = i / (tiers - 1);
            const r = .95 * (1 - t * .85) + .05;
            const ch = .62 - t * .12;
            const geo = new THREE.ConeGeometry(r, ch, 9, 1);
            const p = geo.attributes.position;
            for (let k = 0; k < p.count; k++) {
                if (p.getY(k) < 0) {                        // drooping, ragged skirt
                    const x = p.getX(k), z = p.getZ(k);
                    p.setY(k, p.getY(k) - .06 + Math.sin(x * 11 + i * 3) * .05);
                    p.setX(k, x * (1 + Math.cos(z * 9 + i) * .1));
                }
            }
            const m = mesh(geo.toNonIndexed(), needles[i % 3], crown, 0, .35 + t * (h - .55), 0);
            m.geometry.computeVertexNormals();
            m.rotation.y = R() * Math.PI;
        }
        mesh(new THREE.ConeGeometry(.08, .35, 6), needles[0], crown, 0, h + .12, 0);
        return g;
    },

    // bush01 of the old 2D editor: young birch shrub, white stems, autumn-tinted leaves.
    shrub(R) {
        const { g, trunk, crown } = root('shrub');
        const stem = mat(0xe7e1d2, .7), leaf = [mat(0x8a9b3a), mat(0xc77a2a), mat(0x6f8f34), mat(0xb5562a)];
        for (let i = 0; i < 4; i++) {
            const a = i * 1.6 + R() * .5;
            const end = new THREE.Vector3(Math.cos(a) * .22, .75 + R() * .25, Math.sin(a) * .22);
            limb(trunk, new THREE.Vector3(Math.cos(a) * .04, 0, Math.sin(a) * .04), end, .03, .012, stem, 5);
        }
        for (let i = 0; i < 14; i++) {
            const a = R() * Math.PI * 2, r = .12 + R() * .3, y = .25 + R() * .65;
            mesh(blob(.1 + R() * .08, 0, R, .25), leaf[i % 4], crown, Math.cos(a) * r, y, Math.sin(a) * r);
        }
        return g;
    }
};

// Helpers shared with PropFactory.js
export { rng, mat, blob, mesh, limb, root };

export function buildTree(type, variant = 1) {
    const make = BUILDERS[type] || BUILDERS.oak;
    const seed = [...type].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) + variant * 1013;
    const g = make(rng(seed));
    g.name = treeAssetName(type, variant);
    return g;
}
