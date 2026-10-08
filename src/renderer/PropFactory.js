import * as THREE from 'three';
import { mat, mesh } from './TreeFactory.js';

/*
 * PropFactory — procedural 3D counterparts of the old 2D editor objects
 * (img/iso/objects/*.png): stump, stone/brick blocks, walls, column, rock,
 * chest, barrel, boxes, vase, lantern, candlestick.
 *
 * Sizes follow the 2D sprites relative to a tile (1 × 1) and a 1.9 tall human.
 * Textures are generated on a canvas (brick, sandstone, stone) and are
 * embedded into the exported GLB assets.
 */

const texCache = new Map();
function canvasTexture(key, draw, size = 128) {
    if (typeof document === 'undefined') return null;
    if (!texCache.has(key)) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        draw(c.getContext('2d'), size);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        t.name = key;
        texCache.set(key, t);
    }
    return texCache.get(key);
}

function noise(ctx, s, alpha, seed = 1) {
    let a = seed;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < s * s / 6; i++) {
        const v = rnd() > .5 ? 255 : 0;
        ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
        ctx.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2);
    }
}

// rows × cols of blocks with mortar lines, every second row offset
function blocks(ctx, s, rows, cols, base, mortar, jitter, seed) {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    let a = seed;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const bh = s / rows, bw = s / cols;
    for (let r = 0; r < rows; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let c = -1; c <= cols; c++) {
            const x = c * bw + off, y = r * bh;
            const k = 1 + (rnd() - .5) * jitter;
            const [R, G, B] = base;
            ctx.fillStyle = `rgb(${R * k | 0},${G * k | 0},${B * k | 0})`;
            ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        }
    }
    noise(ctx, s, .08, seed + 7);
}

const TEX = {
    brick: () => canvasTexture('brick', (ctx, s) => blocks(ctx, s, 8, 4, [168, 62, 48], '#cdbfae', .25, 11)),
    sandstone: () => canvasTexture('sandstone', (ctx, s) => blocks(ctx, s, 4, 3, [214, 182, 132], '#a88a62', .18, 23)),
    stone: () => canvasTexture('stone', (ctx, s) => {
        ctx.fillStyle = '#a7a59c';
        ctx.fillRect(0, 0, s, s);
        noise(ctx, s, .18, 5);
        ctx.strokeStyle = 'rgba(70,70,64,.55)';
        ctx.lineWidth = 1.5;
        for (const [x0, y0, x1, y1] of [[10, 0, 40, 60], [40, 60, 30, 128], [40, 60, 110, 70], [110, 70, 128, 40], [80, 0, 95, 30]]) {
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
    })
};

function texMat(key, color = 0xffffff, rough = .92) {
    const t = TEX[key]?.();
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, map: t || null });
    m.name = `prop_${key}`;
    return m;
}

function group(name) {
    const g = new THREE.Group();
    g.name = name;
    const body = new THREE.Group();
    body.name = 'body';
    g.add(body);
    return { g, body };
}

// Lathe from a profile [[radius, y], …]
function lathe(profile, seg = 16) {
    return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

const WALL_SIDE = { n: [0, -.4, 0], s: [0, .4, 0], e: [.4, 0, Math.PI / 2], w: [-.4, 0, Math.PI / 2] };

function wall(side) {
    const { g, body } = group(`wall-${side}`);
    const sand = texMat('sandstone');
    const [x, z, ry] = WALL_SIDE[side];
    const w = mesh(new THREE.BoxGeometry(1, 1.25, .2), sand, body, x, .625, z);
    w.rotation.y = ry;
    const cap = mesh(new THREE.BoxGeometry(1.04, .08, .26), mat(0xc4a476, .9), body, x, 1.29, z);
    cap.rotation.y = ry;
    const foot = mesh(new THREE.BoxGeometry(1.02, .12, .26), mat(0xb39468, .95), body, x, .06, z);
    foot.rotation.y = ry;
    return g;
}

export const PROP_BUILDERS = {
    stump01() {
        const { g, body } = group('stump01');
        const bark = mat(0x5e4430), wood = mat(0xc9a676, .85);
        mesh(lathe([[0, 0], [.27, 0], [.22, .05], [.19, .18], [.18, .3], [0, .3]], 11), bark, body);
        mesh(new THREE.CylinderGeometry(.175, .175, .015, 11), wood, body, 0, .305, 0);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + .4;
            const r = mesh(new THREE.ConeGeometry(.06, .3, 5), bark, body, Math.cos(a) * .24, .04, Math.sin(a) * .24);
            r.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
        }
        return g;
    },

    stone01() {
        const { g, body } = group('stone01');
        mesh(new THREE.BoxGeometry(.92, .92, .92), texMat('stone'), body, 0, .46, 0);
        mesh(new THREE.BoxGeometry(.96, .05, .96), mat(0x95938b, .95), body, 0, .935, 0);
        return g;
    },

    brick01() {
        const { g, body } = group('brick01');
        mesh(new THREE.BoxGeometry(.92, .92, .92), texMat('brick'), body, 0, .46, 0);
        return g;
    },

    'wall-n': () => wall('n'),
    'wall-e': () => wall('e'),
    'wall-s': () => wall('s'),
    'wall-w': () => wall('w'),

    'stone-col'() {
        const { g, body } = group('stone-col');
        const sand = texMat('sandstone'), trim = mat(0xc4a476, .9);
        mesh(new THREE.BoxGeometry(.62, .16, .62), trim, body, 0, .08, 0);
        mesh(new THREE.BoxGeometry(.52, .1, .52), trim, body, 0, .21, 0);
        mesh(new THREE.BoxGeometry(.4, 1.8, .4), sand, body, 0, 1.16, 0);
        mesh(new THREE.BoxGeometry(.5, .1, .5), trim, body, 0, 2.11, 0);
        mesh(new THREE.BoxGeometry(.6, .16, .6), trim, body, 0, 2.24, 0);
        return g;
    },

    rock01() {
        const { g, body } = group('rock01');
        const geo = new THREE.DodecahedronGeometry(.16, 0);
        const r = mesh(geo, mat(0x8b867c, .95), body, 0, .09, 0);
        r.scale.set(1.2, .65, .95);
        mesh(new THREE.DodecahedronGeometry(.07, 0), mat(0x7a756c, .95), body, .17, .04, .06);
        return g;
    },

    chest01() {
        const { g, body } = group('chest01');
        const wood = mat(0x6e4524, .8), dark = mat(0x3a2414), metal = mat(0xb8a06a, .45);
        metal.metalness = .6;
        mesh(new THREE.BoxGeometry(.5, .26, .32), wood, body, 0, .13, 0);
        const lid = mesh(new THREE.CylinderGeometry(.16, .16, .5, 12, 1, false, 0, Math.PI), wood, body, 0, .26, 0);
        lid.rotation.set(0, 0, Math.PI / 2);      // half cylinder dome along X
        for (const x of [-.18, .18]) {
            mesh(new THREE.BoxGeometry(.04, .27, .34), dark, body, x, .135, 0);
            const band = mesh(new THREE.CylinderGeometry(.165, .165, .04, 12, 1, false, 0, Math.PI), dark, body, x, .26, 0);
            band.rotation.set(0, 0, Math.PI / 2);
        }
        mesh(new THREE.BoxGeometry(.07, .08, .02), metal, body, 0, .24, .17);
        return g;
    },

    barrel01() {
        const { g, body } = group('barrel01');
        const wood = mat(0x8a5f3a, .85), hoop = mat(0x3b3a38, .5);
        hoop.metalness = .5;
        mesh(lathe([[0, 0], [.24, 0], [.28, .12], [.31, .38], [.28, .64], [.24, .76], [0, .76]], 18), wood, body);
        for (const y of [.12, .3, .46, .64]) {
            const r = y === .3 || y === .46 ? .31 : .285;
            mesh(new THREE.TorusGeometry(r, .016, 5, 22), hoop, body, 0, y, 0).rotation.x = Math.PI / 2;
        }
        mesh(new THREE.CylinderGeometry(.235, .235, .01, 18), mat(0x6b4728), body, 0, .765, 0);
        return g;
    },

    boxes01() {
        const { g, body } = group('boxes01');
        const plank = mat(0x9c7647, .9), dark = mat(0x6b4f2e, .9);
        // open crate
        const crate = new THREE.Group();
        crate.position.set(.08, 0, 0);
        body.add(crate);
        mesh(new THREE.BoxGeometry(.5, .03, .34), dark, crate, 0, .015, 0);
        for (const [x, z, w, d] of [[0, .16, .5, .03], [0, -.16, .5, .03], [.235, 0, .03, .34], [-.235, 0, .03, .34]]) {
            mesh(new THREE.BoxGeometry(w, .22, d), plank, crate, x, .11, z);
        }
        mesh(new THREE.BoxGeometry(.14, .1, .1), mat(0xd8c9a0), crate, -.08, .08, .02);          // cloth bundle
        mesh(new THREE.CylinderGeometry(.05, .05, .14, 8), mat(0x5a6a7a, .5), crate, .1, .1, -.03);  // bottle
        // small box beside it
        const b = mesh(new THREE.BoxGeometry(.18, .14, .16), plank, body, -.28, .07, .12);
        b.rotation.y = .5;
        return g;
    },

    vase01() {
        const { g, body } = group('vase01');
        mesh(lathe([[0, 0], [.07, 0], [.12, .07], [.13, .14], [.09, .23], [.05, .27], [.06, .31], [0, .31]], 14), mat(0xb0623a, .7), body);
        mesh(new THREE.TorusGeometry(.06, .008, 4, 14), mat(0x7a3f22), body, 0, .27, 0).rotation.x = Math.PI / 2;
        return g;
    },

    lantern01() {
        const { g, body } = group('lantern01');
        const iron = mat(0x2a2a2c, .55);
        iron.metalness = .5;
        const glow = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 1.6, roughness: .4 });
        glow.name = 'prop_glow';
        mesh(new THREE.CylinderGeometry(.11, .12, .04, 8), iron, body, 0, .02, 0);
        mesh(new THREE.CylinderGeometry(.08, .08, .2, 8), glow, body, 0, .14, 0);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            mesh(new THREE.BoxGeometry(.015, .22, .015), iron, body, Math.cos(a) * .085, .14, Math.sin(a) * .085);
        }
        mesh(new THREE.ConeGeometry(.12, .1, 8), iron, body, 0, .3, 0);
        mesh(new THREE.TorusGeometry(.04, .01, 4, 10), iron, body, 0, .38, 0);
        return g;
    },

    candlestick01() {
        const { g, body } = group('candlestick01');
        const brass = mat(0xb08d4a, .4);
        brass.metalness = .7;
        const flame = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa630, emissiveIntensity: 2, roughness: .3 });
        flame.name = 'prop_flame';
        mesh(lathe([[0, 0], [.08, 0], [.08, .015], [.03, .04], [.018, .08], [.018, .3], [.05, .32], [.05, .34], [0, .34]], 12), brass, body);
        mesh(new THREE.CylinderGeometry(.022, .022, .12, 8), mat(0xf2ead6, .6), body, 0, .4, 0);
        mesh(new THREE.ConeGeometry(.018, .05, 6), flame, body, 0, .485, 0);
        return g;
    }
};

export const isProp = id => id in PROP_BUILDERS;

export function buildProp(id) {
    const make = PROP_BUILDERS[id];
    if (!make) return null;
    const g = make();
    g.name = id;
    return g;
}
