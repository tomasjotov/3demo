import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, mat } from '../avatar/kit.js';
import { DIRECTIONS } from '../utils/constants.js';
import { TAU, smooth, damp } from './QuadrupedRig.js';
import { taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralPlant — carnivorous plants, mimics and walking tree beings. Own small rig (no legs to share with
 * QuadrupedRig): damped flat poses like the other rigs, tendrils are chains of segments bent by sine waves.
 *
 * Rooted plants (stay where they grow; walk / run = slow creeping of roots and tendrils):
 *   drischea     beautiful twisted tree, white flowers, hanging fruit; claw roots lash and drag prey to a maw in the trunk
 *   gwanga       segmented spiny stalk on scuttling claw roots, bulb head ringed by thorny tentacles, spits spores
 *   hungry-wine  vine figure: twisted stem on roots, dark leafy body with red eyes, grapes, strangling vine arms
 *   suotix       mossy stump with hanging tentacles and lashes tipped by glowing mushroom caps
 *   waaz         huge spotted mushroom with gnarled stem and curling octopus tentacles, spore clouds
 * Mimics (perfectly still until they strike):
 *   mirocus      wizard's chest: the lid snaps open on fangs and a tongue, poison gas on defend; waddles when moving
 *   rack         spiky stone: splits into jaws and leaps, tiny legs only while it shuffles
 *   skorfan      mossy fallen log, really a reptile: eyes open, stubby legs come out, jaws in the log end
 * Tree beings (two root legs, long branch arms, bark; walk on the roots):
 *   evil-tree    dead grey giant with a spiky branch crown and a skull-like maw; double-arm slam
 *   tree-folk    5 m bark giant, grinning face, moss and leaves; arm sweep
 *   nature-wrath 8 m antlered nature spirit, long hair, glowing green arms, skirt of vines; double-arm slam
 *   forest-phantom thin skeletal figure in a moss robe, glides without legs, glowing blue eyes, sweeps a glaive
 *
 * States: idle (sway, breathing; mimics still), walk / run, attack (wind-up → strike → recover: roots / tendrils lash,
 * maw / lid / jaws snap, branch arms slam or sweep), defend (closes up, tendrils raised, gas / pollen / spores),
 * hit (shudder), kneel and lie (droop low), death (wilts and collapses, ends still on the ground).
 */

export const PLANT_VARIANTS = {
    drischea: { kind: 'tree', bark: 0x5a2a22, dark: 0x2a120e, leaf: 0x22382a, flower: 0xf6f2ea, fruit: 0xc86a2a, mouth: 0x4a0a10, scale: 1.2 },
    gwanga: { kind: 'stalk', skin: 0x34302a, dark: 0x1c1a18, flesh: 0x8a3430, bulb: 0xc07a62, thorn: 0xe8d8b8, spore: 0xc8d878, scale: 1.1 },
    'hungry-wine': { kind: 'vine', wood: 0x7a5232, dark: 0x1c2018, leaf: 0x7a9a3a, grape: 0x4a2a62, eye: 0xff2a18, scale: 1 },
    mirocus: { kind: 'chest', wood: 0x6e4e32, band: 0x2e2824, flesh: 0x7a1c24, tooth: 0xeee4c8, gas: 0x90d040, scale: 1 },
    rack: { kind: 'stone', stone: 0x5e5650, cap: 0x2a2e36, spike: 0xc8b898, flesh: 0x8a3440, scale: 1 },
    skorfan: { kind: 'log', bark: 0x5e4c3a, dark: 0x2e2418, wood: 0xa88a62, moss: 0x5a7a2a, eye: 0xe0c040, scale: 1 },
    suotix: { kind: 'stump', bark: 0x4a3e34, dark: 0x241c16, moss: 0x5a8a2a, tent: 0x8a6252, cap: 0x2a2620, glow: 0xffe070, scale: 1 },
    waaz: { kind: 'shroom', cap: 0xb0a0c4, spot: 0xf4f0f8, gill: 0xd0b0c0, stem: 0x5a4a5e, tent: 0x7a6a8a, sucker: 0xd0c0d8, spore: 0xc0a0ff, scale: 1 },
    'evil-tree': { kind: 'walker', style: 'evil', bark: 0x4e4a46, dark: 0x22201e, eye: 0xff7a20, scale: 2 },
    'tree-folk': { kind: 'walker', style: 'folk', bark: 0x5a4430, dark: 0x2a1e14, face: 0x7a6040, moss: 0x4a6a24, leaf: 0x5a8a30, eye: 0xe0b040, scale: 1.9 },
    'nature-wrath': { kind: 'walker', style: 'wrath', bark: 0x4a5236, dark: 0x1e2618, face: 0x6a7258, moss: 0x2e4a1e, leaf: 0x4a7a2a, hair: 0x1a2416, eye: 0x80ff70, glow: 0x60ff50, scale: 3.1 },
    'forest-phantom': { kind: 'walker', style: 'phantom', bark: 0x3a3a26, dark: 0x1e2014, bone: 0xd8d2c0, moss: 0x3e4a22, eye: 0x60d0ff, metal: 0x9a9a96, scale: .9 }
};

// tree beings at scale 1: thigh, shin, leg radius, hip x, torso height / radius, [upper arm, forearm], arm radius, head, foot height
const WALKERS = {
    evil: { lt: .55, ls: .55, lr: .18, hip: .22, tor: .95, tr: .38, arm: [.85, .8], ar: .13, head: .25, foot: .07, fl: .2 },
    folk: { lt: .55, ls: .55, lr: .16, hip: .19, tor: .9, tr: .33, arm: [.8, .76], ar: .11, head: .25, foot: .07, fl: .2 },
    wrath: { lt: .6, ls: .6, lr: .1, hip: .12, tor: .95, tr: .21, arm: [.62, .6], ar: .065, head: .2, foot: .05, fl: .14 },
    phantom: { lt: 0, ls: 0, lr: .06, hip: .1, tor: .78, tr: .16, arm: [.5, .48], ar: .035, head: .21, foot: 0, fl: .12, float: .1, robe: 1.05 }
};

const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const q3 = v => Math.round(v * 1000) / 1000;
const cache = new Map();
const cached = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const hex = c => '#' + new THREE.Color(c).getHexString();

// Lumpy icosphere (canopy pads, moss, knots): offset by a smooth function of the position, so shared corners stay shut.
function blobGeo(r, detail = 1, amp = .25, seed = 1) {
    return cached(`blob${r},${detail},${amp},${seed}`, () => {
        const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            const x = v.x / r, y = v.y / r, z = v.z / r;
            const n = Math.sin(x * 4.1 + seed) * Math.sin(y * 3.7 + seed * 1.7) * Math.sin(z * 4.3 + seed * 2.3) + .4 * Math.sin((x + y - z) * 6 + seed);
            v.multiplyScalar(1 + amp * n);
            p.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        return g;
    });
}

// Several geometries (each with its matrix) merged into one, cached by key.
function mergedGeo(key, make) {
    return cached(key, () => {
        const parts = make().map(([g, m]) => {
            let c = g.index ? g.toNonIndexed() : g.clone();
            for (const name of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(name)) c.deleteAttribute(name);
            if (m) c.applyMatrix4(m);
            return c;
        });
        return mergeGeometries(parts);
    });
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// matrix placing a +y-pointing part at p, pointing along direction d
function along(p, d, s = 1) {
    _v.set(d[0], d[1], d[2]).normalize();
    _q.setFromUnitVectors(_up, _v);
    return new THREE.Matrix4().compose(new THREE.Vector3(...p), _q.clone(), _s.set(s, s, s).clone());
}

// Canvas textures: bark grain (along the tube length or the cylinder height), spots, gills, glowing dots.
function canvasTex(key, draw, repeat = [1, 1]) {
    return cached(key, () => {
        if (typeof document === 'undefined') return null;
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        draw(cv.getContext('2d'));
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(...repeat);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });
}
function barkTex(base, dark, tube) {
    return canvasTex(`bark${base},${dark},${tube}`, g => {
        g.fillStyle = hex(base);
        g.fillRect(0, 0, 128, 128);
        const r = rnd(11), pt = (a, b) => tube ? [b, a] : [a, b];
        g.strokeStyle = hex(dark);
        for (let i = 0; i < 24; i++) {
            const x0 = r() * 128;
            g.lineWidth = 1 + r() * 4;
            g.globalAlpha = .45 + r() * .55;
            g.beginPath();
            for (let y = -8; y <= 136; y += 8) {
                const [px, py] = pt(x0 + Math.sin(y * .06 + i) * 4 + (r() - .5) * 2, y);
                y === -8 ? g.moveTo(px, py) : g.lineTo(px, py);
            }
            g.stroke();
        }
        g.globalAlpha = .3;
        g.strokeStyle = '#ffffff';
        for (let i = 0; i < 10; i++) {
            const x0 = r() * 128, y0 = r() * 128;
            g.lineWidth = 1;
            g.beginPath();
            const [a, b] = pt(x0, y0), [c, d] = pt(x0 + (r() - .5) * 3, y0 + 20 + r() * 20);
            g.moveTo(a, b);
            g.lineTo(c, d);
            g.stroke();
        }
    }, tube ? [2, 2] : [2, 1]);
}
const barkMat = (base, dark, tube) => {
    const map = barkTex(base, dark, tube);
    return map ? mat(0xffffff, { map, roughness: .95 }) : mat(base, { roughness: .95 });
};
const flatMat = (color, opts = {}) => mat(color, { roughness: .95, flatShading: true, ...opts });

// leaf shapes in the xy plane, stem at the origin, pointing +y (normal +z)
function leafGeo(len, w) {
    return cached(`leaf${len},${w}`, () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.quadraticCurveTo(w, len * .35, 0, len);
        s.quadraticCurveTo(-w, len * .35, 0, 0);
        return new THREE.ShapeGeometry(s, 4);
    });
}
function vineLeafGeo(size) {
    return cached(`vleaf${size}`, () => {
        const s = new THREE.Shape();
        for (let i = 0; i <= 30; i++) {
            const a = i / 30 * TAU, r = size * (.62 + .3 * Math.abs(Math.cos(a * 2.5)) + .08 * Math.cos(a * 11));
            const x = Math.sin(a) * r, y = size * .55 - Math.cos(a) * r;
            i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
        }
        return new THREE.ShapeGeometry(s);
    });
}
// cluster of berries hanging down from the origin
function grapeGeo(r = .035) {
    return mergedGeo(`grape${r}`, () => {
        const parts = [], rr = rnd(5);
        for (let k = 0; k < 6; k++) {
            const n = Math.max(1, 6 - k), rad = r * 2.1 * (1 - k / 6.5);
            for (let i = 0; i < n; i++) {
                const a = i / n * TAU + k;
                parts.push([new THREE.SphereGeometry(r * (.9 + rr() * .2), 7, 5), new THREE.Matrix4().makeTranslation(Math.cos(a) * rad, -r - k * r * 1.5, Math.sin(a) * rad)]);
            }
        }
        parts.push([new THREE.CylinderGeometry(r * .15, r * .15, r * 2, 4), new THREE.Matrix4().makeTranslation(0, 0, 0)]);
        return parts;
    });
}

export class ProceduralPlant {
    constructor(variant = 'drischea', { scale = 1 } = {}) {
        this.variant = PLANT_VARIANTS[variant] ? variant : 'drischea';
        this.c = { ...PLANT_VARIANTS[this.variant] };
        this.kind = this.c.kind;
        this.size = this.c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.name = this.variant;
        this.root.scale.setScalar(this.size);
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.gait = 0;
        this.yaw = null;
        this.state = null;
        this.stateTime = 0;
        this.atk = 0;
        this.look = 0; this.lookTarget = 0; this.lookTimer = 2;
        this.blink = 0; this.blinkTimer = 2;
        this.S = { by: 0, bz: 0, bx: 0, roll: 0, ry: 0, sw: 1, shake: 0, droop: 0, jaw: 0, puff: 0, eyes: 1 };
        this.stride = { walk: 1, run: 1.6 };
        this.P = {};
        this['build_' + this.kind]();
        this.KEYS = Object.keys(this.S);
        this.p = { ...this.S };
        this.tgt = { ...this.S };
        for (const key of ['A1', 'A2', 'A3', 'DEF', 'HIT', 'KNEEL', 'LIE', 'DEAD']) if (!this.P[key]) this.P[key] = this.S;
    }

    pose(over) { return { ...this.S, ...over }; }

    // ---------------------------------------------------------------- build helpers
    add(parent, geo, m, x = 0, y = 0, z = 0) {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }
    grp(parent, x = 0, y = 0, z = 0) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        return g;
    }
    tube(parent, pts, r0, r1, m, seg = 10, radial = 7) { return this.add(parent, taperTube(pts, r0, r1, seg, radial), m); }

    // Chain of n segments growing along +y: yaw `a` around y, then `tilt` from vertical towards that direction.
    chain(parent, { n, len, r0, r1, m, x = 0, y = 0, z = 0, a = 0, tilt = 0, radial = 6, joints = false, thorn = null, sucker = null }) {
        const root = this.grp(parent, x, y, z);
        root.rotation.order = 'YXZ';
        root.rotation.set(tilt, a, 0);
        const segs = [], l = len / n;
        let p = root;
        for (let i = 0; i < n; i++) {
            const g = this.grp(p);
            const ra = q3(r0 + (r1 - r0) * i / n), rb = q3(r0 + (r1 - r0) * (i + 1) / n);
            this.add(g, G.cyl(rb, ra, q3(l), radial), m, 0, l / 2, 0);
            if (joints) this.add(g, G.sph(ra, radial, 4), m);
            if (thorn) this.add(g, G.cone(q3(ra * .45), q3(ra * 2.6), 4), thorn, 0, l * .5, -ra * .9).rotation.x = -1.1;
            if (sucker) this.add(g, G.sph(q3(ra * .5), 5, 4), sucker, 0, l * .5, ra * .75);
            segs.push(g);
            p = this.grp(g, 0, l, 0);
        }
        return { root, segs, end: p, a, tilt, n, w: Math.cos(a) };
    }
    // bend a chain: root tilt, per-segment curl (tipPow > 0: curl grows towards the tip), travelling sine wave
    wave(ch, tilt, curl, amp, t, f, k, ph, tipPow = 0, side = .6) {
        const S = ch.segs, n = S.length;
        ch.root.rotation.x = tilt;
        for (let i = 0; i < n; i++) {
            const cu = tipPow ? curl * Math.pow((i + 1) / n, tipPow) * 2 : curl;
            S[i].rotation.x = cu + Math.sin(t * f - i * k + ph) * amp;
            S[i].rotation.z = Math.cos(t * f * .8 - i * k + ph * 1.3) * amp * side;
        }
    }
    // instanced leaves: items { p: [x,y,z], n: [normal], spin, s, color }
    leaves(parent, geo, m, items) {
        const im = new THREE.InstancedMesh(geo, m, items.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
        const p = new THREE.Vector3(), n = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), Z = new THREE.Vector3(0, 0, 1);
        items.forEach((it, i) => {
            n.set(...it.n).normalize();
            q.setFromUnitVectors(Z, n);
            q2.setFromAxisAngle(Z, it.spin || 0);
            q.multiply(q2);
            M.compose(p.set(...it.p), q, sc.setScalar(it.s || 1));
            im.setMatrixAt(i, M);
            if (it.color !== undefined) im.setColorAt(i, col.set(it.color));
        });
        im.castShadow = true;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        parent.add(im);
        return im;
    }
    // additive spore / pollen / gas puffs drifting from (x, y, z) along (dx, dy, dz)
    puffs(parent, color, n, size, { x = 0, y = 0, z = 0, dx = 0, dy = .3, dz = 1, spread = .3 } = {}) {
        const list = [];
        for (let i = 0; i < n; i++) {
            const s = haloSprite(color, size, 0);
            s.visible = false;
            s.raycast = () => {};
            parent.add(s);
            list.push(s);
        }
        return { list, x, y, z, dx, dy, dz, spread, size };
    }
    animPuffs(P, amount, t) {
        const n = P.list.length;
        for (let i = 0; i < n; i++) {
            const s = P.list[i], f = (t * .45 + i / n) % 1;
            s.visible = amount > .03;
            if (!s.visible) continue;
            const a = i * 2.39, sp = P.spread * (.3 + f);
            s.position.set(P.x + Math.sin(a) * sp + P.dx * f, P.y + Math.cos(i * 1.7) * sp * .5 + P.dy * f, P.z + Math.cos(a) * sp * .4 + P.dz * f);
            s.material.opacity = amount * .55 * Math.sin(f * Math.PI);
            s.scale.setScalar(P.size * (.4 + f));
        }
    }
    eyeGlow(parent, color, x, y, z, r, halo = 3) {
        const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: .3 });
        const e = this.add(parent, G.sph(r, 8, 6), m, x, y, z);
        e.castShadow = false;
        let h = null;
        if (halo) {
            h = haloSprite(color, r * halo, .7);
            h.position.set(x, y, z + r * .5);
            parent.add(h);
        }
        (this.eyeList ||= []).push({ m, h, base: 1.6 });
        return e;
    }

    // ================================================================ drischea: predatory tree
    build_tree() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { rootF: 0, rootAll: 0, rootReach: 0 });
        const bark = barkMat(c.bark, c.dark, true), barkC = barkMat(c.bark, c.dark, false), dark = flatMat(c.dark);
        this.leafM = new THREE.MeshStandardMaterial({ color: c.leaf, roughness: .9, flatShading: true });
        this.flowerM = new THREE.MeshStandardMaterial({ color: c.flower, roughness: .6, emissive: 0x302c28 });
        this.cLeaf = new THREE.Color(c.leaf); this.cFlower = new THREE.Color(c.flower);
        this.cWilt = new THREE.Color(0x4a3a20); this.cWiltF = new THREE.Color(0x6a5030);
        const fruitM = mat(c.fruit, { roughness: .4 }), mouth = mat(c.mouth, { roughness: .6 }), tooth = mat(0xe8dcc0, { roughness: .4 });

        // claw roots arching out of the trunk base (pivot inside the trunk; lift = rotate up, reach = stretch)
        J.roots = [];
        const nR = 8;
        for (let i = 0; i < nR; i++) {
            const a = i / nR * TAU + .2, len = 1.0 + (i % 3) * .16;
            const g = this.grp(this.root, 0, .5, 0);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, .08, len * .35], [0, -.1, len * .7], [0, -.42, len * .95], [0, -.46, len * 1.08], [0, -.36, len * 1.2]], .17, .025, bark, 14, 7);
            J.roots.push({ g, a, w: Math.pow(Math.max(0, Math.cos(a)), 2) });
        }
        // trunk tilts around its base edge when it falls (pivot at -x)
        J.trunk = this.grp(this.root, 0, 0, -.45);
        const T = this.grp(J.trunk, 0, 0, .45);
        this.tube(T, [[0, .05, 0], [.1, .9, .05], [-.08, 1.7, -.04], [.04, 2.5, 0]], .52, .24, bark, 12, 10);
        for (let k = 0; k < 3; k++) {                                                          // twisted ridges
            const pts = [];
            for (let i = 0; i <= 6; i++) {
                const y = .2 + i * .36, ang = k * TAU / 3 + y * 1.5, rad = .46 - y * .1;
                pts.push([Math.cos(ang) * rad, y, Math.sin(ang) * rad]);
            }
            this.tube(T, pts, .14, .06, bark, 14, 6);
        }
        // maw in the trunk base: throat, upper / lower lip with teeth
        this.add(T, G.sph(.24, 10, 8), mouth, 0, .95, .38).scale.set(1.1, .7, .45);
        J.lipU = this.grp(T, 0, 1.04, .36);
        J.lipL = this.grp(T, 0, .86, .36);
        for (const [lip, s] of [[J.lipU, 1], [J.lipL, -1]]) {
            this.tube(lip, [[-.3, 0, -.08], [-.15, 0, .07], [0, 0, .12], [.15, 0, .07], [.3, 0, -.08]], .07, .07, barkC, 10, 6);
            for (let i = 0; i < 7; i++) {
                const x = (i - 3) * .075, zz = .1 - Math.abs(x) * .45;
                this.add(lip, G.cone(.022, .1, 4), tooth, x, -s * .06, zz).rotation.x = s > 0 ? Math.PI : 0;
            }
        }
        // crown: branches, canopy pads (merged), flowers (instanced), fruit strands
        J.crown = this.grp(T, 0, 2.45, 0);
        const r = rnd(3), pads = [], tips = [];
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + .5, sx = Math.sin(a), sz = Math.cos(a), L = 1.45 + (i % 2) * .3;
            this.tube(J.crown, [[0, 0, 0], [sx * .45, .32, sz * .45], [sx * L * .7, .58, sz * L * .7], [sx * L, .45, sz * L]], .2, .05, bark, 10, 6);
            pads.push([sx * L * .85, .78, sz * L * .85, .72, a]);
            if (i % 2 === 0) pads.push([sx * L * .4, 1.12, sz * L * .4, .6, a + 1]);
            tips.push([sx * L, .42, sz * L], [sx * L * .6, .5, sz * L * .6]);
        }
        this.tube(J.crown, [[0, 0, 0], [.05, .6, 0], [0, 1.15, .05]], .18, .06, bark, 8, 6);
        pads.push([0, 1.38, 0, .85, 0]);
        const padGeo = mergedGeo('drischeaPads', () => pads.map(([x, y, z, s, a], i) => [blobGeo(1, 1, .22, i + 1),
            new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_up, a), new THREE.Vector3(s * 1.3, s * .45, s * 1.3))]));
        this.add(J.crown, padGeo, this.leafM);
        const fl = [];
        for (const [x, y, z, s] of pads) {
            for (let k = 0; k < 16; k++) {
                const u = r() * TAU, v = r() * .75;
                const nx = Math.cos(u) * Math.sin(v * 2), ny = Math.cos(v * 2), nz = Math.sin(u) * Math.sin(v * 2);
                fl.push({ p: [x + nx * s * 1.25, y + ny * s * .43, z + nz * s * 1.25], n: [nx, ny + .3, nz], spin: r() * 3, s: .8 + r() * .5 });
            }
        }
        this.leaves(J.crown, cached('drFlower', () => new THREE.IcosahedronGeometry(.075, 0)), this.flowerM, fl);
        J.fruit = [];
        tips.forEach(([x, y, z], i) => {
            const g = this.grp(J.crown, x, y, z), len = .7 + (i % 3) * .25;
            this.add(g, G.cyl(.012, .012, q3(len), 4), dark, 0, -len / 2, 0);
            for (let k = 0; k < 4; k++) this.add(g, G.sph(.055, 7, 5), fruitM, 0, -len * (.35 + k * .2), 0).scale.set(1, 1.5, 1);
            J.fruit.push(g);
        });
        J.puffs = this.puffs(J.crown, 0xfff6c8, 10, 1.1, { y: .6, dy: .5, dz: 0, spread: 1.8 });

        const P = this.pose.bind(this);
        this.P = {
            A1: P({ rootF: .9, puff: .7, jaw: .4, bx: -.04, shake: .2 }),
            A2: P({ rootF: .12, rootReach: .7, jaw: 1, bx: .02, puff: .5 }),
            A3: P({ rootF: .45, rootReach: .25, jaw: .8, bx: .01, puff: .3 }),
            DEF: P({ rootAll: .4, rootF: .3, puff: 1, jaw: .15, shake: .2, sw: 1.8 }),
            HIT: P({ shake: 1, bx: -.05, jaw: .4, roll: .03 }),
            KNEEL: P({ droop: .5, bx: -.07, sw: .4 }),
            LIE: P({ droop: .8, bx: -.16, sw: .2 }),
            DEAD: P({ droop: 1, bx: -.72, sw: 0, jaw: .6, eyes: 0 })
        };
        this.stride = { walk: 1.2, run: 1.6 };
    }

    anim_tree(q, t, dt, g, run) {
        const J = this.j, sw = q.sw, sh = q.shake * Math.sin(t * 47) * .03;
        const rx = q.bx + Math.sin(t * .43) * .012 * sw + g * .05 + Math.sin(this.phase * 2) * .02 * g + sh * .5;
        const rz = q.roll + Math.sin(t * .57) * .016 * sw + Math.sin(this.phase) * .025 * g + sh;
        J.trunk.position.set(0, q.by + Math.max(0, rx) * .95 + Math.abs(rz) * .5, q.bz - .45);
        J.trunk.rotation.set(rx, 0, rz);
        J.crown.position.y = 2.45 - q.droop * .25;
        J.crown.rotation.set(Math.sin(t * .7 + 1) * .03 * sw + q.droop * .08, 0, Math.sin(t * .61) * .035 * sw + sh * 1.5);
        J.crown.scale.set(1 + q.droop * .08, 1 - q.droop * .4, 1 + q.droop * .08);
        const n = J.roots.length;
        J.roots.forEach((R, i) => {
            let lift = q.rootAll + R.w * q.rootF + Math.sin(t * 1.3 + i * 1.7) * .012 * sw;
            if (g > .001) lift += g * Math.max(0, Math.sin(this.phase - i * TAU / n)) * (.35 + run * .15);
            R.g.rotation.x = -lift;
            R.g.scale.z = 1 + R.w * q.rootReach;
        });
        J.lipU.rotation.x = -q.jaw * .7;
        J.lipL.rotation.x = q.jaw * .5;
        J.fruit.forEach((f, i) => {
            f.rotation.z = Math.sin(t * 1.3 + i) * .08 * sw + sh * 3;
            f.rotation.x = Math.cos(t * 1.1 + i * 2) * .06 * sw + q.droop * .2;
        });
        this.leafM.color.copy(this.cLeaf).lerp(this.cWilt, q.droop * q.droop * (1 - q.eyes));
        this.flowerM.color.copy(this.cFlower).lerp(this.cWiltF, q.droop * .8);
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ gwanga: spiny stalk with a tentacle crown
    build_stalk() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { bend: 0, fall: 0, head: 0, tilt: 0, curlT: 0 });
        const skin = flatMat(c.skin), dark = mat(c.dark, { roughness: .8 }), flesh = mat(c.flesh, { roughness: .6 });
        const thorn = mat(c.thorn, { roughness: .5 }), bulbM = mat(c.bulb, { roughness: .45, emissive: c.bulb, emissiveIntensity: .1 });
        J.base = this.grp(this.root);
        this.add(J.base, blobGeo(.22, 1, .18, 3), skin, 0, .2, 0).scale.set(1, .75, 1);
        J.feet = [];
        for (let i = 0; i < 7; i++) {                                                          // scuttling claw roots
            const a = i / 7 * TAU, g = this.grp(J.base, 0, .22, 0);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, .12, .2], [0, .08, .42], [0, -.1, .56], [0, -.2, .62]], .07, .012, dark, 10, 6);
            this.add(g, G.cone(.02, .09, 4), thorn, 0, .14, .25).rotation.x = -.5;
            J.feet.push({ g, a, set: i % 2 });
        }
        // segmented stalk
        J.stalk = [];
        let p = this.grp(J.base, 0, .3, 0);
        J.stalkRoot = p;
        const n = 8, l = .15;
        for (let i = 0; i < n; i++) {
            const g = this.grp(p), r = .11 * (1 - i * .045);
            this.add(g, G.sph(q3(r), 9, 6), skin, 0, l * .5, 0).scale.set(1, .8, 1);
            this.add(g, G.cyl(q3(r * 1.12), q3(r * .85), .04, 9), dark, 0, l * .82, 0);
            for (const s of [1, -1]) this.add(g, G.cone(.02, .13, 4), thorn, s * r * .95, l * .55, 0).rotation.z = -s * 1.25;
            this.add(g, G.cone(.018, .1, 4), thorn, 0, l * .5, -r * .9).rotation.x = -1.3;
            J.stalk.push(g);
            p = this.grp(g, 0, l, 0);
        }
        // head: collar, bulb with a spike crown, 8 thorny tentacles
        J.head = this.grp(p);
        this.add(J.head, G.sph(.13, 10, 7), dark, 0, .03, 0).scale.set(1, .6, 1);
        this.add(J.head, G.sph(.2, 14, 10), bulbM, 0, .21, 0);
        const spikes = mergedGeo('gwangaSpikes', () => {
            const parts = [];
            for (let k = 0; k < 18; k++) {
                const ph = .25 + (k % 3) * .22, az = k * 2.4, d = [Math.sin(ph) * Math.cos(az), Math.cos(ph), Math.sin(ph) * Math.sin(az)];
                parts.push([new THREE.ConeGeometry(.012, .11, 4).translate(0, .055, 0), along([d[0] * .19, .21 + d[1] * .19, d[2] * .19], d)]);
            }
            return parts;
        });
        this.add(J.head, spikes, thorn);
        J.tent = [];
        for (let i = 0; i < 8; i++) J.tent.push(this.chain(J.head, { n: 7, len: 1.0, r0: .05, r1: .01, m: flesh, y: .08, a: i / 8 * TAU + .2, tilt: .75, thorn }));
        J.puffs = this.puffs(J.head, c.spore, 8, .45, { y: .25, dz: 1.2, dy: .1, spread: .25 });

        const P = this.pose.bind(this);
        this.P = {
            A1: P({ bend: -.3, head: -.35, tilt: .55, curlT: -.08, puff: .9 }),
            A2: P({ bend: .6, head: .7, tilt: .15, curlT: -.36, puff: .5, bz: .12 }),
            A3: P({ bend: .5, head: .55, tilt: -.1, curlT: -.45, bz: .08 }),
            DEF: P({ tilt: -.5, curlT: -.42, bend: -.12, by: -.03 }),
            HIT: P({ shake: 1, bend: -.25, head: -.3, tilt: .3 }),
            KNEEL: P({ bend: .75, head: .45, tilt: .45, curlT: .12, by: -.04 }),
            LIE: P({ fall: .55, bend: .7, head: .3, tilt: .5, curlT: .1, by: -.05 }),
            DEAD: P({ fall: 1.25, bend: .25, head: .1, tilt: -.4, curlT: -.2, droop: 1, by: -.04 })
        };
        this.stride = { walk: .7, run: 1.1 };
    }

    anim_stalk(q, t, dt, g, run) {
        const J = this.j, sw = q.sw, sh = q.shake * Math.sin(t * 45) * .06, ph = this.phase;
        J.base.position.set(0, q.by + (g > .001 ? Math.abs(Math.sin(ph)) * .03 * g : 0), q.bz);
        J.base.rotation.set(q.bx, 0, q.roll + Math.sin(ph) * .05 * g);
        for (const F of J.feet) {
            const p = ph + F.set * Math.PI;
            const lift = Math.max(0, Math.sin(p)) * g * (.45 + run * .2) + Math.sin(t * 2 + F.a * 3) * .02 * sw;
            F.g.rotation.x = -lift;
            F.g.rotation.y = F.a + Math.cos(p) * g * .22;
        }
        const n = J.stalk.length;
        J.stalkRoot.rotation.set(q.fall, 0, 0);
        J.stalk.forEach((s, i) => {
            s.rotation.x = q.bend / n + Math.sin(t * 1.1 - i * .45) * .03 * sw + Math.sin(ph * 2 - i * .5) * .03 * g + sh * .3;
            s.rotation.z = Math.sin(t * .9 - i * .4) * .03 * sw + Math.sin(ph - i * .4) * .04 * g + sh * .3;
        });
        J.head.rotation.x = q.head + Math.sin(t * .8) * .05 * sw;
        J.tent.forEach((T, i) => this.wave(T, .4 + q.tilt, .22 + q.curlT, .06 * sw + .04 * g, t, 1.6 + g, .6, i * 1.3));
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ hungry vine: rooted vine figure
    build_vine() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { sag: 0, lean: 0, armL: .1, armR: .1, armS: 0, fing: .2 });
        const wood = barkMat(c.wood, 0x3a2414, true), dark = flatMat(c.dark), woodC = mat(c.wood, { roughness: .9 });
        const leafM = mat(0xffffff, { roughness: .85, side: THREE.DoubleSide }), grape = mat(c.grape, { roughness: .35 });
        J.roots = [];
        for (let i = 0; i < 7; i++) {
            const a = i / 7 * TAU + .3, len = .55 + (i % 3) * .12, g = this.grp(this.root, 0, .3, 0);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [.03, .02, len * .4], [-.03, -.16, len * .8], [0, -.26, len], [.02, -.24, len * 1.2]], .08, .014, wood, 10, 5);
            J.roots.push({ g, a });
        }
        // twisted stem of three strands
        J.trunk = this.grp(this.root);
        for (let k = 0; k < 3; k++) {
            const pts = [];
            for (let i = 0; i <= 6; i++) {
                const y = .05 + i * .2, ang = k * TAU / 3 + y * 3.2, rad = .1 + .04 * Math.sin(y * 3);
                pts.push([Math.cos(ang) * rad, y, Math.sin(ang) * rad]);
            }
            this.tube(J.trunk, pts, .1, .07, wood, 16, 6);
        }
        // hunched dark body
        J.body = this.grp(this.root, 0, 1.2, 0);
        this.add(J.body, blobGeo(.38, 1, .2, 2), dark, 0, .28, 0).scale.set(1.15, .95, .8);
        this.add(J.body, blobGeo(.26, 1, .25, 4), dark, 0, .02, .02).scale.set(1, .9, .8);
        for (const s of [1, -1]) this.add(J.body, blobGeo(.17, 1, .25, 6 + s), dark, s * .34, .44, .02);
        J.head = this.grp(J.body, 0, .58, .1);
        this.add(J.head, blobGeo(.2, 1, .2, 9), dark, 0, 0, 0).scale.set(1, .9, .9);
        for (const s of [1, -1]) this.eyeGlow(J.head, c.eye, s * .075, .02, .17, .028, 4);
        J.jaw = this.grp(J.head, 0, -.08, .12);
        this.add(J.jaw, G.box(.14, .04, .06), mat(0x2a0806, { roughness: .6 }), 0, 0, 0);
        for (let i = 0; i < 5; i++) this.add(J.jaw, G.cone(.01, .04, 4), woodC, (i - 2) * .028, .03, .02);
        J.beard = [];
        for (let i = 0; i < 5; i++) J.beard.push(this.chain(J.head, { n: 4, len: .35 + (i % 2) * .15, r0: .016, r1: .005, m: woodC, x: (i - 2) * .05, y: -.12, z: .08, a: (i - 2) * .3, tilt: Math.PI - .2, radial: 4 }));
        // leaf crown with grapes
        J.crown = this.grp(J.body, 0, .62, -.05);
        const r = rnd(7), items = [], greens = [c.leaf, 0xb8c050, 0x3e5a24, 0x96b040, 0x5a7a2e];
        for (let i = 0; i < 20; i++) {
            const az = i * 2.4, el = .25 + r() * .9, R = .5 + r() * .15;
            const nx = Math.sin(az) * Math.cos(el), ny = Math.sin(el), nz = Math.cos(az) * Math.cos(el);
            items.push({ p: [nx * R, ny * R * .7, nz * R * .9], n: [nx, ny + .4, nz], spin: r() * 6, s: .8 + r() * .5, color: greens[i % 5] });
        }
        this.leaves(J.crown, vineLeafGeo(.22), leafM, items);
        J.grapes = [];
        for (let i = 0; i < 6; i++) {
            const az = 1.1 + i * .82, g = this.grp(J.crown, Math.sin(az) * .55, .05, Math.cos(az) * .5);
            this.add(g, grapeGeo(), grape);
            J.grapes.push(g);
        }
        // vine arms with tendril fingers
        J.arms = [];
        for (const s of [1, -1]) {
            const sh = this.grp(J.body, s * .36, .4, .06);
            const pit = this.grp(sh);
            const arm = this.chain(pit, { n: 5, len: .8, r0: .07, r1: .035, m: woodC, a: 0, tilt: Math.PI - .35, joints: true, radial: 6 });
            const fingers = [];
            for (let f = 0; f < 4; f++) fingers.push(this.chain(arm.end, { n: 3, len: .24, r0: .022, r1: .007, m: woodC, a: (f - 1.5) * .7 + (s > 0 ? 0 : Math.PI), tilt: .35, radial: 4 }));
            const gr = this.grp(arm.segs[3], s * .05, .05, 0);
            this.add(gr, grapeGeo(.03), grape);
            J.arms.push({ sh, pit, arm, fingers, s });
        }
        const P = this.pose.bind(this);
        this.P = {
            A1: P({ armR: 2.5, armL: .5, fing: -.4, lean: -.18, jaw: .3 }),
            A2: P({ armR: 1.3, armL: .9, fing: 1, lean: .32, bz: .15, jaw: 1 }),
            A3: P({ armR: 1.0, armL: .7, fing: 1.3, lean: .22, bz: .1, jaw: .2 }),
            DEF: P({ armR: 1.6, armL: 1.6, armS: -.5, fing: .9, lean: .12, sag: .15 }),
            HIT: P({ shake: 1, lean: -.25, armS: .45, fing: -.3, jaw: .5 }),
            KNEEL: P({ sag: .45, lean: .35, droop: .6, armR: .25, armL: .25, fing: .5 }),
            LIE: P({ sag: .72, lean: .6, droop: .9, armS: .5, armR: .5, armL: .5 }),
            DEAD: P({ sag: .9, lean: 1.25, droop: 1, armS: 1.1, armR: .2, armL: .2, eyes: 0, fing: .6 })
        };
        this.stride = { walk: 1.1, run: 1.5 };
    }

    anim_vine(q, t, dt, g, run) {
        const J = this.j, sw = q.sw, sh = q.shake * Math.sin(t * 45) * .05, ph = this.phase;
        J.roots.forEach((R, i) => {
            R.g.rotation.x = -(Math.sin(t * 1.2 + i * 1.9) * .015 * sw + g * Math.max(0, Math.sin(ph - i * TAU / 7)) * (.2 + run * .1));
        });
        const sq = 1 - q.sag * .75;
        J.trunk.scale.set(1 + q.sag * .3, sq, 1 + q.sag * .3);
        J.trunk.rotation.set(q.lean * .2 + Math.sin(ph) * .04 * g, 0, Math.sin(t * .7) * .02 * sw + sh);
        J.body.position.set(0, 1.2 * sq + q.by + Math.sin(t * 1.4) * .01 * sw, q.bz + q.lean * .2);
        J.body.rotation.set(q.lean + .1 * g + Math.sin(t * .8) * .02 * sw, Math.sin(t * .5) * .08 * sw + this.look * .2, q.roll + sh + Math.sin(ph) * .04 * g);
        J.head.rotation.set(q.droop * .4 - q.lean * .3, this.look * .3, 0);
        J.jaw.rotation.x = q.jaw * .6;
        J.crown.rotation.set(Math.sin(t * .9) * .04 * sw + q.droop * .3, 0, Math.sin(t * .7 + 1) * .05 * sw + sh * 2);
        J.grapes.forEach((gr, i) => { gr.rotation.z = Math.sin(t * 1.5 + i) * .12 * sw + sh * 3; gr.rotation.x = q.droop * .3; });
        J.beard.forEach((b, i) => this.wave(b, Math.PI - .2 - q.lean * .5, .05, .08 * sw + .05, t, 1.5, .7, i));
        for (const A of J.arms) {
            const raise = (A.s > 0 ? q.armL : q.armR) + Math.sin(ph + (A.s > 0 ? 0 : Math.PI)) * .3 * g + Math.sin(t * .9 + A.s) * .06 * sw;
            A.sh.rotation.set(0, 0, A.s * (.35 + q.armS));
            A.pit.rotation.x = -raise;
            this.wave(A.arm, Math.PI - .35, .08 + q.droop * .1, .07 * sw + .03, t, 1.1, .6, A.s);
            A.fingers.forEach((F, i) => this.wave(F, .35 - q.fing * .3, .25 + q.fing * .45, .1 * sw, t, 2.2, .8, i + A.s));
        }
        this.animEyes(q, t);
    }

    // ================================================================ mirocus: the biting chest
    build_chest() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { lid: 0, tongue: 0, loll: 0 });
        const plank = canvasTex(`plank${c.wood}`, g => {
            g.fillStyle = hex(c.wood);
            g.fillRect(0, 0, 128, 128);
            const r = rnd(3);
            for (let y = 0; y < 128; y += 32) {
                g.fillStyle = 'rgba(30,18,8,.8)';
                g.fillRect(0, y, 128, 3);
                for (let k = 0; k < 7; k++) {
                    g.fillStyle = `rgba(${r() < .5 ? '40,24,12' : '150,120,90'},.25)`;
                    g.fillRect(0, y + 4 + r() * 26, 128, 1 + r() * 2);
                }
            }
        }, [1, 1]);
        const wood = plank ? mat(0xffffff, { map: plank, roughness: .9 }) : mat(c.wood, { roughness: .9 });
        const band = mat(c.band, { roughness: .5, metalness: .5 }), flesh = mat(c.flesh, { roughness: .55 });
        const tooth = mat(c.tooth, { roughness: .35 }), gold = mat(0xb08a3a, { roughness: .35, metalness: .7 });
        const W = .9, Dp = .56, Hh = .38;
        J.pivot = this.grp(this.root, -W / 2, 0, 0);
        J.body = this.grp(J.pivot, W / 2, 0, 0);
        // open box: bottom and four walls, red lining inside
        this.add(J.body, G.box(W, .04, Dp), wood, 0, .02, 0);
        for (const s of [1, -1]) {
            this.add(J.body, G.box(W, Hh, .035), wood, 0, Hh / 2, s * (Dp / 2 - .0175));
            this.add(J.body, G.box(.035, Hh, Dp), wood, s * (W / 2 - .0175), Hh / 2, 0);
        }
        this.add(J.body, G.box(W - .08, .3, Dp - .08), flesh, 0, .2, 0);
        for (const x of [-.3, .3]) {
            this.add(J.body, G.box(.05, Hh + .01, Dp + .012), band, x, Hh / 2, 0);
        }
        this.add(J.body, G.box(W + .012, .04, Dp + .012), band, 0, .03, 0);
        for (let i = 0; i < 9; i++) this.add(J.body, G.cone(.024, .1, 4), tooth, (i - 4) * .09, Hh + .03, Dp / 2 - .06);
        for (const s of [1, -1]) for (let i = 0; i < 3; i++) this.add(J.body, G.cone(.02, .08, 4), tooth, s * (W / 2 - .07), Hh + .03, .12 - i * .13);
        // tongue lying in the mouth
        J.tongue = this.chain(J.body, { n: 4, len: .44, r0: .06, r1: .03, m: mat(0xb03848, { roughness: .4 }), y: .36, z: -.18, tilt: Math.PI / 2, radial: 7 });
        J.tongue.segs.forEach(s => { s.children[0].scale.set(1.6, 1, .5); });
        // barrel lid, hinged at the back edge
        J.lid = this.grp(J.body, 0, Hh, -Dp / 2);
        const shell = this.add(J.lid, G.cyl(Dp / 2, Dp / 2, W, 14, false, 0, Math.PI), wood, 0, 0, Dp / 2);
        shell.rotation.z = Math.PI / 2;
        shell.scale.set(.75, 1, 1);
        for (const x of [-.3, .3]) {
            const b = this.add(J.lid, G.cyl(Dp / 2 + .01, Dp / 2 + .01, .05, 14, false, 0, Math.PI), band, x, 0, Dp / 2);
            b.rotation.z = Math.PI / 2;
            b.scale.set(.76, 1, 1);
        }
        this.add(J.lid, G.box(W - .04, .02, Dp - .04), flesh, 0, .0, Dp / 2);
        this.add(J.lid, G.box(.1, .12, .03), gold, 0, -.02, Dp + .005);
        for (let i = 0; i < 9; i++) this.add(J.lid, G.cone(.03, .15, 4), tooth, (i - 4) * .09 + .045, -.07, Dp - .06).rotation.x = Math.PI;
        for (const s of [1, -1]) for (let i = 0; i < 3; i++) this.add(J.lid, G.cone(.022, .09, 4), tooth, s * (W / 2 - .07), -.04, Dp - .18 - i * .13).rotation.x = Math.PI;
        J.drool = [];
        for (let i = 0; i < 3; i++) {
            const d = this.add(J.lid, G.cyl(.006, .004, 1, 4), mat(0xe8e0d0, { roughness: .2 }), (i - 1) * .22 + .05, -.14, Dp - .06);
            d.castShadow = false;
            J.drool.push(d);
        }
        J.puffs = this.puffs(J.body, c.gas, 9, .7, { y: .45, z: .2, dz: .8, dy: .4, spread: .5 });
        const P = this.pose.bind(this);
        this.P = {
            A1: P({ lid: 1.3, by: .04, bx: -.22, tongue: .3, shake: .2 }),
            A2: P({ lid: 1.05, bz: .32, by: .16, bx: .12, tongue: 1 }),
            A3: P({ lid: 0, bz: .28, by: .0, bx: .06, tongue: 0, shake: .5 }),
            DEF: P({ lid: .55, puff: 1, bx: -.08, tongue: .25 }),
            HIT: P({ shake: 1, lid: .18, bx: -.1 }),
            WALK: P({ lid: .1 }),
            KNEEL: P({ lid: .32, loll: .7, bx: .05 }),
            LIE: P({ roll: .3, lid: .12, loll: .4 }),
            DEAD: P({ roll: .35, lid: 2.1, loll: 1, by: .0 })
        };
        this.stride = { walk: .45, run: .6 };
    }

    anim_chest(q, t, dt, g, run, state) {
        const J = this.j, sh = q.shake * Math.sin(t * 50) * .03, ph = this.phase;
        const hop = g > .001 ? Math.abs(Math.sin(ph)) * (.05 + run * .06) * g : 0;
        J.pivot.position.set(-.45, q.by + hop, q.bz);
        J.pivot.rotation.z = q.roll;
        J.body.rotation.set(q.bx + sh + (g > .001 ? -Math.cos(ph * 2) * .06 * g : 0), 0, Math.sin(ph) * .1 * g + sh);
        let lid = q.lid + Math.max(0, Math.sin(ph * 2)) * (.12 + run * .15) * g;
        if (state === 'idle') lid += Math.pow(Math.max(0, Math.sin(t * .7)), 12) * .14;
        lid += q.shake * Math.abs(Math.sin(t * 31)) * .08;
        J.lid.rotation.x = -lid;
        const T = J.tongue;
        T.root.rotation.x = Math.PI / 2 - q.tongue * .5 - q.loll * .45;
        T.segs.forEach((s, i) => {
            s.rotation.x = q.tongue * (i === 0 ? -.2 : .32) + Math.sin(t * 5 - i) * .08 * q.tongue + (1 - q.tongue) * .05 + q.loll * (i === 0 ? -.2 : i === 1 ? .35 : 1.0);
            s.scale.y = 1 + q.tongue * .5 + q.loll * .4;
            s.rotation.z = Math.sin(t * 3 + i) * .1 * q.tongue;
        });
        J.drool.forEach((d, i) => {
            const L = Math.max(.001, Math.min(lid, 1.1) * (.12 + i * .05));
            d.scale.y = L;
            d.position.y = -.12 - L / 2;
            d.visible = lid > .15;
        });
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ rack: the spiky stone
    build_stone() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { lid: 0, legs: 0, sq: 1 });
        const stone = flatMat(c.stone), spike = mat(c.spike, { roughness: .6 }), cap = mat(c.cap, { roughness: .25, metalness: .2 });
        const flesh = mat(c.flesh, { roughness: .5 }), tooth = mat(0xe8dcc0, { roughness: .4 });
        const R = .4, lowH = .7, upH = .8;
        const shellGeo = (lower) => cached('rackShell' + lower, () => {
            const g = new THREE.SphereGeometry(R, 16, 6, 0, TAU, lower ? Math.PI / 2 : 0, Math.PI / 2), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const n = 1 + .07 * Math.sin(v.x * 17 + 1) * Math.sin(v.z * 15 + 2) + .04 * Math.sin(v.y * 23);
                p.setXYZ(i, v.x * n, v.y * (lower ? lowH : upH), v.z * n);
            }
            g.computeVertexNormals();
            return g;
        });
        const spikesGeo = (lower) => mergedGeo('rackSpikes' + lower, () => {
            const parts = [], r = rnd(lower ? 3 : 9), N = lower ? 18 : 46;
            for (let k = 0; k < N; k++) {
                const az = r() * TAU, el = lower ? -r() * .5 : .12 + r() * 1.05;
                if (!lower && el > 1.0 && r() < .7) continue;                        // leave the dark cap bare
                const d = [Math.cos(el) * Math.cos(az), Math.sin(el) * (lower ? lowH : upH), Math.cos(el) * Math.sin(az)];
                const h = .07 + r() * .07;
                parts.push([new THREE.ConeGeometry(.022, h, 4).translate(0, h / 2, 0), along([d[0] * R * .97, d[1] * R * .97, d[2] * R * .97], [d[0], Math.sin(el), d[2]])]);
            }
            return parts;
        });
        J.body = this.grp(this.root, 0, R * lowH, 0);
        J.sq = this.grp(J.body);
        this.add(J.sq, shellGeo(true), stone);
        this.add(J.sq, spikesGeo(true), spike);
        const disc = this.add(J.sq, cached('rackDisc', () => new THREE.CircleGeometry(R * .92, 16)), flesh, 0, .005, 0);
        disc.rotation.x = -Math.PI / 2;
        for (let i = 0; i < 14; i++) {
            const a = i / 14 * TAU;
            this.add(J.sq, G.cone(.02, .07, 4), tooth, Math.sin(a) * R * .86, .03, Math.cos(a) * R * .86);
        }
        J.lid = this.grp(J.sq, 0, 0, -R * .95);
        const U = this.grp(J.lid, 0, 0, R * .95);
        this.add(U, shellGeo(false), stone);
        this.add(U, spikesGeo(false), spike);
        this.add(U, G.sph(R * .5, 14, 8, 0, TAU, 0, Math.PI / 2), cap, 0, R * upH * .72, 0).scale.set(1, .55, 1);
        const lip = this.add(U, cached('rackDisc', () => new THREE.CircleGeometry(R * .92, 16)), flesh, 0, -.004, 0);
        lip.rotation.x = Math.PI / 2;
        for (let i = 0; i < 14; i++) {
            const a = (i + .5) / 14 * TAU;
            this.add(U, G.cone(.02, .07, 4), tooth, Math.sin(a) * R * .86, -.03, Math.cos(a) * R * .86).rotation.x = Math.PI;
        }
        // little legs, only out while it shuffles or leaps
        J.legs = [];
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + .5, g = this.grp(J.sq, Math.sin(a) * R * .55, -R * lowH * .55, Math.cos(a) * R * .55);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.add(g, G.cyl(.022, .03, .14, 5), spike, 0, -.06, 0);
            this.add(g, G.cone(.02, .06, 4), spike, 0, -.15, 0).rotation.x = Math.PI;
            J.legs.push({ g, a, i });
        }
        const P = this.pose.bind(this);
        this.P = {
            WALK: P({ legs: 1 }),
            A1: P({ sq: .82, lid: .25, legs: 1, by: -.02 }),
            A2: P({ by: .3, bz: .45, lid: .85, bx: -.3, legs: 1, sq: 1.06 }),
            A3: P({ by: .22, bz: .6, lid: .04, bx: .3, legs: .6, shake: .5 }),
            DEF: P({ lid: .22, bx: .12, legs: .4, shake: .2, sq: .93 }),
            HIT: P({ shake: 1, lid: .12, bx: -.15, by: .03 }),
            KNEEL: P({ sq: .9, lid: .14, legs: .35, roll: .08 }),
            LIE: P({ roll: .5, legs: 1, lid: .06, by: .06 }),
            DEAD: P({ roll: 1.45, by: .13, legs: 1, lid: .45 })
        };
        this.stride = { walk: .35, run: .5 };
    }

    anim_stone(q, t, dt, g, run) {
        const J = this.j, sh = q.shake * Math.sin(t * 50) * .04, ph = this.phase;
        const shuffle = g > .001 ? Math.abs(Math.sin(ph)) * .03 * g : 0;
        J.body.position.set(0, .28 + q.by + shuffle, q.bz);
        J.body.rotation.set(q.bx + sh + Math.sin(ph) * .08 * g, 0, q.roll + sh);
        J.sq.scale.set(1 + (1 - q.sq) * .5, q.sq, 1 + (1 - q.sq) * .5);
        J.lid.rotation.x = -q.lid * 1.1;
        const L = Math.max(q.legs, g);
        for (const leg of J.legs) {
            leg.g.visible = L > .02;
            leg.g.scale.setScalar(Math.max(.01, L));
            const p = ph * 2 + leg.i * Math.PI;
            leg.g.rotation.x = .5 * (1 - L) + Math.sin(p) * .5 * g + (q.roll > 1 ? -.8 : 0);
        }
    }

    // ================================================================ skorfan: the log reptile
    build_log() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { legs: 0, head: 0, eyes: .3 });
        const bark = barkMat(c.bark, c.dark, false), woodM = mat(c.wood, { roughness: .9 }), moss = flatMat(c.moss);
        const tooth = mat(0xe8dcc0, { roughness: .4 }), gum = mat(0x5a1a1a, { roughness: .6 }), claw = mat(0x1e1810, { roughness: .5 });
        const R = .27;
        J.body = this.grp(this.root, 0, R, 0);
        const log = this.add(J.body, G.cyl(R, R * 1.05, 1.3, 12), [bark, woodM, woodM], 0, 0, -.55);
        log.rotation.x = Math.PI / 2;
        const r = rnd(4);
        for (let i = 0; i < 7; i++) {                                                          // splintered rear end
            const a = i / 7 * TAU, l = .12 + r() * .22;
            this.add(J.body, G.cone(.07, q3(l), 4), woodM, Math.sin(a) * R * .7, Math.cos(a) * R * .7, -1.2 - l / 2 + .02).rotation.x = -Math.PI / 2;
        }
        const snag = this.add(J.body, G.cone(.09, .45, 4), bark, .05, R * .75, -1.05);
        snag.rotation.x = -.7;
        for (let i = 0; i < 4; i++) this.add(J.body, blobGeo(.2, 1, .3, i + 2), moss, (r() - .5) * .12, R * .82, -1.05 + i * .3).scale.set(1, .32, 1.6);
        for (const s of [1, -1]) this.add(J.body, G.cyl(.04, .055, .2, 6), bark, s * R * .95, .05, -.7 + s * .2).rotation.z = -s * 1.2;
        // head = front of the log: upper jaw half-cylinder, lower jaw hinged
        J.head = this.grp(J.body, 0, 0, .08);
        const upper = this.add(J.head, G.cyl(R * .92, R, .5, 12, false, Math.PI / 2, Math.PI), [bark, woodM, woodM], 0, 0, .25);
        upper.rotation.x = Math.PI / 2;
        this.add(J.head, G.box(R * 1.8, .02, .48), gum, 0, -.005, .25);
        this.add(J.head, blobGeo(.12, 1, .3, 5), moss, -.06, R * .9, .1).scale.set(1, .35, 1.4);
        for (const s of [1, -1]) {
            for (let i = 0; i < 6; i++) this.add(J.head, G.cone(.017, .07, 4), tooth, s * R * .8, -.035, .08 + i * .07).rotation.x = Math.PI;
            this.add(J.head, G.sph(.085, 8, 6), bark, s * .13, R * .85, .12).scale.set(1, .75, 1.1);
        }
        for (let i = 0; i < 4; i++) this.add(J.head, G.cone(.018, .08, 4), tooth, (i - 1.5) * .09, -.04, .46).rotation.x = Math.PI;
        J.eyes = [];
        const eyeM = mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .45 });
        for (const s of [1, -1]) {
            const e = this.grp(J.head, s * .13, R * .9, .17);
            this.add(e, G.sph(.05, 8, 6), eyeM);
            this.add(e, G.box(.012, .07, .02), mat(0x080604), 0, 0, .045);
            J.eyes.push(e);
        }
        J.jaw = this.grp(J.head, 0, -.01, .02);
        const lower = this.add(J.jaw, G.cyl(R * .82, R * .9, .48, 12, false, -Math.PI / 2, Math.PI), [bark, woodM, woodM], 0, 0, .24);
        lower.rotation.x = Math.PI / 2;
        lower.scale.set(1, 1, .7);
        this.add(J.jaw, G.box(R * 1.6, .02, .44), gum, 0, -.01, .24);
        for (const s of [1, -1]) for (let i = 0; i < 5; i++) this.add(J.jaw, G.cone(.016, .06, 4), tooth, s * R * .7, .02, .1 + i * .075);
        // stubby legs, tucked inside the log while it pretends
        J.legs = [];
        for (const [z, side, ph] of [[-.05, 1, 0], [-.05, -1, .5], [-.95, 1, .5], [-.95, -1, 0]]) {
            const top = this.grp(J.body, side * .12, -.05, z);
            top.rotation.order = 'YZX';
            this.add(top, G.cyl(.05, .045, .2, 7), bark, 0, -.1, 0);
            const knee = this.grp(top, 0, -.2, 0);
            this.add(knee, G.cyl(.045, .04, .17, 7), bark, 0, -.085, 0);
            const foot = this.grp(knee, 0, -.17, 0);
            for (const a of [-.5, 0, .5]) this.add(foot, G.cone(.014, .07, 4), claw, Math.sin(a) * .03, -.01, .03 + Math.cos(a) * .02).rotation.x = Math.PI / 2;
            J.legs.push({ top, knee, foot, side, ph });
        }
        const P = this.pose.bind(this);
        this.P = {
            WALK: P({ legs: 1, eyes: 1, by: .07, head: -.05 }),
            A1: P({ legs: 1, eyes: 1, jaw: 1, head: -.35, by: .08, bz: -.1 }),
            A2: P({ legs: 1, eyes: 1, jaw: .08, head: .1, bz: .45, by: .06 }),
            A3: P({ legs: 1, eyes: 1, jaw: .04, head: 0, bz: .3, roll: .35, shake: .3, by: .05 }),
            DEF: P({ legs: 1, eyes: 1, jaw: .75, head: -.25, by: .09, bx: -.06 }),
            HIT: P({ legs: .7, eyes: 1, shake: 1, jaw: .3, head: -.2, bx: -.05, by: .04 }),
            KNEEL: P({ legs: .35, eyes: .6, head: .12, jaw: .05, roll: .06 }),
            LIE: P({ legs: .45, eyes: 0, jaw: .1, roll: .12 }),
            DEAD: P({ legs: 1, eyes: 0, jaw: .4, roll: Math.PI })
        };
        this.stride = { walk: .9, run: 1.3 };
    }

    anim_log(q, t, dt, g, run, state) {
        const J = this.j, sh = q.shake * Math.sin(t * 45) * .04, ph = this.phase;
        J.body.position.set(0, .27 + q.by * Math.max(0, 1 - Math.abs(q.roll)), q.bz);
        J.body.rotation.set(q.bx + sh, Math.sin(ph) * .12 * g, q.roll + sh);
        J.head.rotation.set(q.head - Math.max(0, Math.sin(t * .4)) * .02 * q.eyes, -Math.sin(ph) * .1 * g, 0);
        J.jaw.rotation.x = q.jaw * .75;
        let open = q.eyes;
        if (state === 'idle') open = .25 + .35 * Math.max(0, Math.sin(t * .3)) * (1 - this.blink);
        else open *= 1 - this.blink;
        for (const e of J.eyes) e.scale.set(1, Math.max(.08, open), 1);
        const L = Math.max(q.legs, g);
        for (const leg of J.legs) {
            const p = ph + leg.ph * TAU, lift = Math.max(0, Math.cos(p)) * g;
            const abd = 2.7 - 1.6 * L - lift * .35;
            leg.top.rotation.set(0, leg.side * 0 + Math.sin(p) * .5 * g * leg.side, leg.side * abd);
            leg.knee.rotation.z = -leg.side * (2.5 - 1.25 * L);
            leg.foot.rotation.z = leg.side * (abd - (2.5 - 1.35 * L)) * -1 * L;
        }
    }

    // ================================================================ suotix: mossy stump with tentacles and glowing lashes
    build_stump() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { capR: 0, capF: 0, tentR: 0, lean: 0 });
        const bark = barkMat(c.bark, c.dark, true), moss = flatMat(c.moss), tent = mat(c.tent, { roughness: .7 });
        const capM = mat(c.cap, { roughness: .6 });
        const dots = canvasTex(`dots${c.glow}`, g => {
            g.fillStyle = '#000';
            g.fillRect(0, 0, 128, 128);
            g.fillStyle = '#fff';
            for (let k = 0; k < 3; k++) for (let i = 0; i < 7 + k * 3; i++) {
                const a = i / (7 + k * 3) * TAU, rr = 18 + k * 18;
                g.beginPath();
                g.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 6 - k, 0, TAU);
                g.fill();
            }
        });
        this.glowM = mat(0x2a2418, { roughness: .5, emissive: c.glow, emissiveIntensity: 1.4, emissiveMap: dots, side: THREE.DoubleSide });
        J.trunk = this.grp(this.root, 0, 0, -.4);
        const T = this.grp(J.trunk, 0, 0, .4);
        this.tube(T, [[0, 0, 0], [.05, .6, 0], [-.03, 1.2, .02], [0, 1.65, 0]], .44, .32, bark, 8, 10);
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + .3, g = this.grp(this.root, 0, .45, 0);
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, -.05, .42], [0, -.33, .7], [0, -.43, .82]], .18, .04, bark, 8, 6);
        }
        const r = rnd(6);
        for (let i = 0; i < 6; i++) {
            const a = r() * TAU, y = .15 + r() * .9;
            const mb = this.add(T, blobGeo(.2, 1, .3, i + 3), moss, Math.sin(a) * .36, y, Math.cos(a) * .36);
            mb.scale.set(1.2, .7 + r() * .6, .45);
            mb.rotation.y = a;
        }
        this.add(T, blobGeo(.44, 1, .2, 2), moss, 0, 1.68, 0).scale.set(1, .55, 1);
        J.top = this.grp(T, 0, 1.6, 0);
        J.hang = [];
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * TAU + .15;
            J.hang.push(this.chain(J.top, { n: 6, len: .85 + (i % 3) * .12, r0: .05, r1: .012, m: tent, x: Math.sin(a) * .26, z: Math.cos(a) * .26, a, tilt: 2.75, radial: 5 }));
        }
        J.lash = [];
        for (const a of [0, 1.25, 2.5, -2.5, -1.25]) {
            const ch = this.chain(J.top, { n: 5, len: .8, r0: .055, r1: .035, m: tent, y: .15, a, tilt: 1.5, radial: 6 });
            this.add(ch.end, G.sph(.14, 12, 6, 0, TAU, 0, Math.PI / 2), capM, 0, .02, 0).scale.set(1, .6, 1);
            const under = this.add(ch.end, cached('suoUnder', () => new THREE.CircleGeometry(.135, 14)), this.glowM, 0, .02, 0);
            under.rotation.x = Math.PI / 2;
            J.lash.push(ch);
        }
        const P = this.pose.bind(this);
        this.P = {
            A1: P({ capR: .8, tentR: .3, lean: -.06 }),
            A2: P({ capR: -.1, capF: 1.2, tentR: 1, lean: .1 }),
            A3: P({ capF: .8, tentR: .7, lean: .06 }),
            DEF: P({ capR: .95, tentR: -.3, shake: .15, sw: 2 }),
            HIT: P({ shake: 1, capR: .3, lean: -.06 }),
            KNEEL: P({ droop: .55, lean: .08 }),
            LIE: P({ droop: .85, lean: .15 }),
            DEAD: P({ droop: 1, lean: .75, eyes: 0 })
        };
        this.stride = { walk: 1.2, run: 1.6 };
    }

    anim_stump(q, t, dt, g, run) {
        const J = this.j, sw = q.sw, sh = q.shake * Math.sin(t * 45) * .03, ph = this.phase;
        J.trunk.position.set(0, q.by, q.bz - .4);
        J.trunk.rotation.set(q.bx - q.lean + Math.sin(ph) * .04 * g + sh * .5, 0, Math.sin(t * .6) * .015 * sw + sh);
        J.hang.forEach((H, i) => {
            const w = Math.max(0, H.w);
            this.wave(H, 2.75 - q.tentR * w * 1.3 - Math.max(0, -q.tentR) * -.3, .04 + q.droop * .05, .07 * sw + .06 * g + .03, t, 1.4 + g, .7, i * 1.7);
        });
        J.lash.forEach((L, i) => {
            const w = Math.max(0, L.w);
            this.wave(L, 1.5 - q.capR + q.capF * w * 1.2 + q.droop * .7, -.1 + q.capF * w * .3 + q.droop * .45 + Math.sin(t * .8 + i) * .04 * sw, .05 * sw, t, 1.2, .5, i * 2.1);
        });
        this.glowM.emissiveIntensity = .3 + 1.1 * (1 - q.droop * .7) * (.85 + .15 * Math.sin(t * 2.3));
    }

    // ================================================================ waaz: tentacled mushroom
    build_shroom() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { capT: 0, tentU: 0, tentF: 0, curlK: 0, lean: 0 });
        const stem = barkMat(c.stem, 0x2a2030, true), tent = mat(c.tent, { roughness: .55 }), sucker = mat(c.sucker, { roughness: .5 });
        const capM = mat(c.cap, { roughness: .55 }), spot = mat(c.spot, { roughness: .6 });
        const gills = canvasTex(`gills${c.gill}`, g => {
            g.fillStyle = hex(c.gill);
            g.fillRect(0, 0, 128, 128);
            g.strokeStyle = 'rgba(60,30,50,.6)';
            g.lineWidth = 1.2;
            for (let i = 0; i < 90; i++) {
                const a = i / 90 * TAU;
                g.beginPath();
                g.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
                g.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64);
                g.stroke();
            }
        });
        J.stem = this.grp(this.root, 0, 0, -.25);
        const T = this.grp(J.stem, 0, 0, .25);
        this.tube(T, [[0, 0, 0], [.06, .4, 0], [-.05, .85, .03], [0, 1.4, 0]], .26, .13, stem, 10, 9);
        for (let k = 0; k < 3; k++) {
            const pts = [];
            for (let i = 0; i <= 5; i++) {
                const y = .05 + i * .25, ang = k * 2.1 + y * 2.4, rad = .22 - y * .07;
                pts.push([Math.cos(ang) * rad, y, Math.sin(ang) * rad]);
            }
            this.tube(T, pts, .08, .04, stem, 12, 5);
        }
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU, g = this.grp(this.root, 0, .3, 0);
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, -.08, .3], [0, -.26, .5], [0, -.28, .62]], .11, .02, stem, 8, 5);
        }
        J.cap = this.grp(T, 0, 1.38, 0);
        const dome = cached('waazDome', () => {
            const pts = [];
            for (let i = 0; i <= 12; i++) {
                const a = i / 12 * Math.PI / 2;
                pts.push(new THREE.Vector2(Math.sin(a) * .95 + .001, Math.cos(a) * .5 - .05 - (i === 12 ? .06 : 0)));
            }
            return new THREE.LatheGeometry(pts.reverse(), 24);
        });
        this.add(J.cap, dome, capM);
        const under = this.add(J.cap, cached('waazUnder', () => new THREE.CircleGeometry(.94, 24)), gills ? mat(0xffffff, { map: gills, roughness: .8 }) : mat(c.gill), 0, -.1, 0);
        under.rotation.x = Math.PI / 2;
        const r = rnd(8), sp = [];
        for (let i = 0; i < 40; i++) {
            const a = r() * TAU, e = .1 + r() * 1.3;
            const x = Math.sin(e) * Math.cos(a), z = Math.sin(e) * Math.sin(a);
            sp.push({ p: [x * .95, Math.cos(e) * .5 - .05, z * .95], n: [x, Math.cos(e) * 1.6, z], s: .6 + r() * .8 });
        }
        this.leaves(J.cap, cached('waazSpot', () => new THREE.CircleGeometry(.045, 7)), spot, sp);
        J.tent = [];
        for (let i = 0; i < 9; i++) {
            const a = i / 9 * TAU + .2;
            J.tent.push(this.chain(J.cap, { n: 8, len: 1.3 + (i % 3) * .2, r0: .065, r1: .012, m: tent, x: Math.sin(a) * .3, y: -.08, z: Math.cos(a) * .3, a, tilt: 2.35, radial: 6, sucker }));
        }
        J.puffs = this.puffs(J.cap, c.spore, 9, .7, { y: -.1, dz: 1, dy: -.2, spread: .7 });
        const P = this.pose.bind(this);
        this.P = {
            A1: P({ tentU: .9, capT: -.2, puff: .5 }),
            A2: P({ tentU: .1, tentF: 1.2, capT: .25, curlK: 1, puff: .8, bz: .1 }),
            A3: P({ tentF: .9, curlK: 1.4, capT: .15, puff: .4 }),
            DEF: P({ tentU: 1.1, curlK: .6, capT: -.1, shake: .1, puff: .6 }),
            HIT: P({ shake: 1, capT: -.22, tentU: .4 }),
            KNEEL: P({ droop: .6, capT: .25, lean: .1 }),
            LIE: P({ droop: .85, lean: .2, capT: .3 }),
            DEAD: P({ droop: 1, lean: .72, capT: -.35, tentU: 1.4, curlK: .4 })
        };
        this.stride = { walk: 1, run: 1.4 };
    }

    anim_shroom(q, t, dt, g, run) {
        const J = this.j, sw = q.sw, sh = q.shake * Math.sin(t * 45) * .03, ph = this.phase;
        J.stem.position.set(0, q.by + (g > .001 ? Math.abs(Math.sin(ph)) * .03 * g : 0), q.bz - .25);
        J.stem.rotation.set(q.bx - q.lean + Math.sin(ph) * .05 * g + Math.sin(t * .5) * .015 * sw, 0, Math.sin(t * .6) * .02 * sw + sh);
        J.cap.rotation.set(q.capT + Math.sin(t * .8) * .03 * sw + sh, 0, Math.sin(t * .55 + 1) * .03 * sw + q.droop * .2);
        J.tent.forEach((T, i) => {
            const w = Math.max(0, T.w);
            const pulse = g > .001 ? Math.sin(ph - i * .7) * .25 * g : 0;
            this.wave(T, 2.55 - q.tentU - q.tentF * w * 1.1 + pulse + q.droop * .2, -(.55 + q.curlK * .5) * (1 - q.droop * .6), .07 * sw + .03, t, 1.3, .6, i * 1.9, 2.5);
        });
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ tree beings
    build_walker() {
        const c = this.c, st = c.style, J = this.j, D = this.D = { ...WALKERS[st] };
        Object.assign(this.S, { tx: 0, L0: -.04, L1: .1, aLx: -.05, aLz: .16, aLe: -.25, aRx: -.05, aRz: .16, aRe: -.25, headX: 0, headY: 0, fing: .2 });
        const S = this.S;
        const legH = (a0, a1) => D.lt * Math.cos(a0) + D.ls * Math.cos(a0 + a1);
        const H = D.H = D.float ? D.float + D.robe : legH(S.L0, S.L1) + D.foot;
        const bark = barkMat(c.bark, c.dark, true), barkC = barkMat(c.bark, c.dark, false), dark = flatMat(c.dark);
        this.mats = { bark, barkC, dark };
        J.body = this.grp(this.root, 0, H, 0);
        J.legs = [];
        if (!D.float) for (const s of [1, -1]) {
            const top = this.grp(J.body, s * D.hip, 0, 0);
            this.tube(top, [[0, .06, 0], [s * .02, -D.lt * .5, .03], [0, -D.lt, 0]], D.lr * 1.15, D.lr * .85, bark, 6, 8);
            const knee = this.grp(top, 0, -D.lt, 0);
            this.add(knee, blobGeo(q3(D.lr * 1.05), 1, .2, s + 4), dark);
            this.tube(knee, [[0, 0, 0], [0, -D.ls * .5, -.02], [0, -D.ls, 0]], D.lr * .85, D.lr * .7, bark, 6, 8);
            const foot = this.grp(knee, 0, -D.ls, 0);
            for (const a of [-1.1, -.45, .1, .7, Math.PI - .3]) {                             // root toes spread on the ground
                const len = D.lr * (a > 2 ? 2 : 3.2), sx = Math.sin(a), sz = Math.cos(a);
                this.tube(foot, [[0, .02, 0], [sx * len * .4, -D.foot * .55, sz * len * .4], [sx * len, -D.foot + D.lr * .15, sz * len], [sx * len * 1.2, -D.foot + D.lr * .12, sz * len * 1.2]], D.lr * .5, D.lr * .1, bark, 8, 5);
            }
            J.legs.push({ top, knee, foot, s });
        }
        // torso
        J.torso = this.grp(J.body);
        this.add(J.torso, blobGeo(q3(D.tr * .95), 1, .15, 2), barkC, 0, 0, 0).scale.set(1.25, .8, .9);
        if (st !== 'phantom') {
            this.tube(J.torso, [[0, -.05, 0], [0, D.tor * .5, .04], [0, D.tor * .85, 0]], D.tr * .8, D.tr, bark, 6, 10);
            this.add(J.torso, blobGeo(q3(D.tr), 1, .2, 5), barkC, 0, D.tor * .78, .02).scale.set(st === 'wrath' ? 1.2 : 1.45, .8, .82);
        }
        // arms
        J.arms = [];
        for (const s of [1, -1]) {
            const sh = this.grp(J.torso, s * D.tr * 1.2, D.tor * .86, 0);
            const [ua, fa] = D.arm, bone = st === 'phantom';
            const limb = bone ? mat(c.bone, { roughness: .6 }) : bark;
            this.add(sh, blobGeo(q3(D.ar * 1.7), 1, .2, 7 + s), bone ? flatMat(c.moss) : barkC);
            this.tube(sh, [[0, 0, 0], [s * .02, -ua * .5, -.02], [0, -ua, 0]], D.ar * 1.1, D.ar * .85, limb, 6, 7);
            const el = this.grp(sh, 0, -ua, 0);
            this.add(el, G.sph(q3(D.ar * 1.0), 7, 5), bone ? limb : barkC);
            let fm = limb;
            if (st === 'wrath') fm = mat(0x3a5a2a, { roughness: .6, emissive: c.glow, emissiveIntensity: .7 });
            this.tube(el, [[0, 0, 0], [0, -fa * .5, .03], [0, -fa, 0]], D.ar * .85, D.ar * .6, fm, 6, 7);
            const hand = this.grp(el, 0, -fa, 0);
            this.add(hand, blobGeo(q3(D.ar * 1.0), 0, .2, 9), bone ? limb : dark).scale.set(1.1, 1.3, .8);
            const fingers = [];
            for (let f = 0; f < 4; f++) {
                const fg = this.grp(hand, (f - 1.5) * D.ar * .45, -D.ar * .8, f === 0 || f === 3 ? 0 : D.ar * .2);
                fg.rotation.z = (f - 1.5) * .2;
                const l = D.fl * (f === 1 || f === 2 ? 1 : .8);
                this.tube(fg, [[0, 0, 0], [0, -l * .5, l * .12], [0, -l, l * .3]], D.ar * .32, D.ar * .06, bone ? limb : bark, 6, 5);
                fingers.push(fg);
            }
            if (st === 'wrath') {
                const h = haloSprite(c.glow, D.ar * 9, .55);
                h.position.y = -D.ar;
                hand.add(h);
                (this.glowHalos ||= []).push(h);
            }
            J.arms.push({ sh, el, hand, fingers, s });
        }
        J.neck = this.grp(J.torso, 0, D.tor * .9, 0);
        J.head = this.grp(J.neck, 0, D.head * (st === 'phantom' ? 1.15 : .7), D.tr * .1);
        J.crown = this.grp(J.torso, 0, D.tor * .85, 0);
        this['head_' + st](c, D);

        const P = this.pose.bind(this);
        const crouch = legH(-.3, .6) + D.foot - H;
        if (st === 'evil' || st === 'wrath') {                                                 // both arms overhead → slam down
            this.P.A1 = P({ aLx: -2.7, aRx: -2.7, aLz: .3, aRz: .3, aLe: .6, aRe: .6, tx: -.2, headX: -.25, jaw: .8, L0: -.12, L1: .25, by: legH(-.12, .25) + D.foot - H, fing: -.3 });
            this.P.A2 = P({ aLx: -.95, aRx: -.95, aLz: .12, aRz: .12, aLe: -.05, aRe: -.05, tx: .5, headX: .2, jaw: 1, L0: -.35, L1: .7, by: legH(-.35, .7) + D.foot - H, bz: .1, fing: 1 });
            this.P.A3 = P({ aLx: -.65, aRx: -.65, aLe: -.15, aRe: -.15, tx: .42, jaw: .3, L0: -.3, L1: .6, by: legH(-.3, .6) + D.foot - H, bz: .08, fing: 1 });
        } else if (st === 'phantom') {                                                        // glaive raised behind the head → chop down
            this.P.A1 = P({ aRx: -2.7, aRz: .2, aRe: .35, aLx: -.6, aLz: .5, aLe: -.6, tx: -.18, ry: .25, headX: -.2, jaw: .6, fing: 1 });
            this.P.A2 = P({ aRx: -.75, aRz: .1, aRe: -.1, aLx: -.3, aLz: .6, tx: .4, ry: -.2, headX: .25, jaw: 1, bz: .15, by: -.05, fing: 1 });
            this.P.A3 = P({ aRx: -.5, aRz: .1, aRe: -.2, aLx: .1, aLz: .5, tx: .3, ry: -.15, jaw: .3, bz: .1, by: -.04, fing: 1 });
        } else {                                                                              // right arm sweeps across
            this.P.A1 = P({ ry: .6, aRx: .4, aRz: 1.25, aRe: -.4, aLx: -.4, aLz: .3, headY: -.3, L1: .3, by: legH(S.L0, .3) + D.foot - H, jaw: .4, fing: -.2 });
            this.P.A2 = P({ ry: -.65, tx: .2, aRx: -1.5, aRz: .45, aRe: -.1, aLx: .3, aLz: .4, headY: .25, L1: .35, by: legH(S.L0, .35) + D.foot - H, jaw: .7, bz: .08, fing: .9 });
            this.P.A3 = P({ ry: -.5, tx: .15, aRx: -1.15, aRz: .1, aRe: -.4, aLx: .2, jaw: .2, fing: 1 });
        }
                this.P.DEF = P({ aLx: -1.5, aRx: -1.5, aLz: -.3, aRz: -.3, aLe: -1.25, aRe: -1.25, tx: .15, headX: .25, L0: -.3, L1: .6, by: D.float ? -.05 : crouch, fing: 1, jaw: .5 });
        this.P.HIT = P({ tx: -.25, bx: -.06, aLz: .7, aRz: .7, aLx: .35, aRx: .35, headX: -.3, jaw: .5, L1: .25, shake: 1 });
        this.P.KNEEL = P({ L0: 0, L1: 1.57, by: D.float ? -.35 : D.lt + D.lr * .8 - H, bx: .05, tx: .3, headX: .3, aLx: -1.0, aRx: -1.0, aLe: -.5, aRe: -.5, aLz: .25, aRz: .25, fing: .5 });
        this.P.LIE = P({ L0: -1.45, L1: .25, by: D.float ? -.6 : D.tr * .75 + .02 - H, tx: .55, headX: .45, aLx: -1.75, aRx: -1.75, aLz: .35, aRz: .35, aLe: -.2, aRe: -.2, droop: .5, fing: .6 });
        this.P.DEAD = P({ bx: D.float || st === 'wrath' ? -1.57 : -1.48, by: D.tr * .9 - H + (D.float ? .05 : st === 'evil' ? .38 : st === 'wrath' ? .22 : 0), L0: -.2, L1: .25, aLz: 1.35, aRz: 1.35, aLx: -.3, aRx: -.3, aLe: -.1, aRe: -.1, headX: .35, jaw: .6, droop: 1, eyes: 0, fing: .7 });
        this.stride = { walk: (D.lt + D.ls || .9) * 1.5, run: (D.lt + D.ls || .9) * 2.4 };
    }

    // branch generator (merged into one geometry): start, direction, length, radius, depth
    branches(key, list, seed) {
        return mergedGeo(key, () => {
            const parts = [], r = rnd(seed);
            const branch = (p, d, len, rad, depth) => {
                const n = Math.hypot(...d), u = d.map(v => v / n);
                const mid = [p[0] + u[0] * len * .5 + (r() - .5) * len * .2, p[1] + u[1] * len * .5 + (r() - .5) * len * .1, p[2] + u[2] * len * .5 + (r() - .5) * len * .2];
                const end = [p[0] + u[0] * len, p[1] + u[1] * len, p[2] + u[2] * len];
                parts.push([taperTube([p, mid, end], rad, depth ? rad * .6 : rad * .1, 6, 5), null]);
                if (depth > 0) for (let k = 0; k < 2; k++) {
                    const nd = [u[0] + (r() - .5) * 1.4, u[1] + .25 + r() * .4, u[2] + (r() - .5) * 1.4];
                    branch(end, nd, len * (.5 + r() * .25), rad * .55, depth - 1);
                }
            };
            for (const [p, d, len, rad, depth] of list) branch(p, d, len, rad, depth);
            return parts;
        });
    }

    head_evil(c, D) {
        const J = this.j, M = this.mats, H = J.head, h = D.head;
        this.add(H, blobGeo(h, 1, .22, 3), M.barkC, 0, 0, 0).scale.set(.95, 1.25, .9);
        this.add(H, G.cone(h * .5, h * 1.6, 5), M.barkC, 0, h * 1.1, -h * .2).rotation.x = -.3;
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .26, 8, 6), mat(0x080604, { roughness: .9 }), s * h * .38, h * .25, h * .58);
            this.eyeGlow(H, c.eye, s * h * .38, h * .25, h * .82, h * .06, 4);
            this.add(H, G.cone(h * .12, h * .6, 4), M.barkC, s * h * .5, h * .55, h * .5).rotation.set(-.4, 0, -s * .9);
        }
        J.jaw = this.grp(H, 0, -h * .45, h * .35);
        this.add(J.jaw, G.box(h * 1.1, h * .25, h * .7), M.dark, 0, -h * .12, h * .1);
        this.add(J.jaw, G.box(h * .9, h * .1, h * .5), mat(0x200806), 0, .0, h * .15);
        for (let i = 0; i < 6; i++) {
            this.add(J.jaw, G.cone(h * .05, h * .28, 4), M.barkC, (i - 2.5) * h * .17, h * .1, h * .4);
            this.add(H, G.cone(h * .05, h * .3, 4), M.barkC, (i - 2.5) * h * .17, -h * .48, h * .76).rotation.x = Math.PI;
        }
        const tr = D.tr, T = D.tor;
        const geo = this.branches('evilCrown', [
            [[tr * 1.1, 0, -.05], [.7, 1, -.3], .75, .09, 2], [[-tr * 1.1, 0, -.05], [-.7, 1, -.3], .75, .09, 2],
            [[tr * .5, .05, -.15], [.3, 1, -.5], .85, .09, 2], [[-tr * .5, .05, -.15], [-.35, 1, -.45], .85, .09, 2],
            [[0, .12, -.1], [.05, 1, -.2], .9, .1, 2], [[tr * .9, -.15, -.2], [1, .3, -.6], .6, .07, 1], [[-tr * .9, -.15, -.2], [-1, .3, -.6], .6, .07, 1]
        ], 21);
        this.add(J.crown, geo, M.bark);
        for (const A of J.arms) {                                                             // snags along the arms
            const g = this.branches('evilArm' + A.s, [[[A.s * D.ar, -.2, 0], [A.s, .5, -.3], .35, .045, 1], [[A.s * D.ar * .5, -.5, -.05], [A.s * .6, .3, -.8], .3, .04, 1]], 30 + A.s);
            this.add(A.sh, g, M.bark);
            const f = this.branches('evilFore' + A.s, [[[A.s * D.ar * .8, -.25, 0], [A.s, .2, .3], .3, .035, 1]], 40 + A.s);
            this.add(A.el, f, M.bark);
        }
        this.add(J.torso, this.branches('evilRibs', [[[.15, T * .4, D.tr * .7], [.6, .4, 1], .3, .04, 1], [[-.18, T * .5, D.tr * .75], [-.6, .5, 1], .28, .04, 1], [[0, T * .2, -D.tr * .8], [.2, .6, -1], .4, .05, 1]], 50), M.bark);
    }

    head_folk(c, D) {
        const J = this.j, M = this.mats, H = J.head, h = D.head, moss = flatMat(c.moss), face = mat(c.face, { roughness: .9 });
        this.add(H, blobGeo(h, 1, .18, 4), M.barkC, 0, h * .1, -h * .1).scale.set(1, 1.35, .95);
        this.add(H, G.sph(h * .75, 12, 9), face, 0, -h * .05, h * .32).scale.set(1, 1.15, .7);
        this.add(H, taperTube([[-h * .55, 0, 0], [0, h * .1, h * .12], [h * .55, 0, 0]], h * .14, h * .14, 8, 6), M.barkC, 0, h * .3, h * .62);
        this.add(H, G.cone(h * .12, h * .35, 5), face, 0, h * .05, h * .88).rotation.x = Math.PI / 2 + .3;
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .13, 8, 6), mat(0x140c06), s * h * .28, h * .15, h * .72);
            this.eyeGlow(H, c.eye, s * h * .28, h * .15, h * .84, h * .055, 0);
        }
        J.jaw = this.grp(H, 0, -h * .32, h * .62);
        this.add(J.jaw, G.box(h * .7, h * .14, h * .12), mat(0x1a0e06), 0, 0, 0);
        for (let i = 0; i < 6; i++) this.add(J.jaw, G.box(h * .08, h * .1, h * .04), mat(0xc8b890), (i - 2.5) * h * .1, h * .04, h * .06);
        this.add(H, blobGeo(h * .7, 1, .3, 7), moss, h * .3, h * .6, -h * .2).scale.set(1, .5, 1);
        const geo = this.branches('folkCrown', [
            [[0, h * .9, -h * .2], [.1, 1, -.15], .7, .12, 1], [[h * .3, h * .7, -h * .1], [.8, 1, .1], .5, .07, 1], [[-h * .3, h * .7, 0], [-.9, .9, -.2], .55, .07, 1]
        ], 13);
        this.add(H, geo, M.bark);
        for (const s of [1, -1]) this.add(J.torso, blobGeo(q3(D.tr * .7), 1, .3, 8 + s), moss, s * D.tr * 1.05, D.tor * .92, -.04).scale.set(1.2, .55, 1);
        const r = rnd(17), items = [];
        for (let i = 0; i < 46; i++) {
            const k = i % 3, a = r() * TAU;
            const base = k === 0 ? [0, h * 1.3 + r() * .5, -h * .2] : [(k === 1 ? 1 : -1) * (D.tr * 1.1 + r() * .2), D.tor * .9 + r() * .1, (r() - .5) * .2];
            items.push({ p: [base[0] + Math.sin(a) * .15, base[1] + r() * .1, base[2] + Math.cos(a) * .15], n: [Math.sin(a), .6, Math.cos(a)], spin: r() * 6, s: .8 + r() * .5, color: [c.leaf, 0x7aa040, 0x3e6a20][i % 3] });
        }
        const L = this.leaves(J.torso, leafGeo(.16, .07), mat(0xffffff, { roughness: .85, side: THREE.DoubleSide }), items.filter((_, i) => i % 3));
        L.castShadow = true;
        this.leaves(H, leafGeo(.16, .07), mat(0xffffff, { roughness: .85, side: THREE.DoubleSide }), items.filter((_, i) => i % 3 === 0).map(it => ({ ...it, p: [it.p[0], it.p[1] - D.tor * .2, it.p[2]] })));
        J.vines = [];
        for (let i = 0; i < 4; i++) J.vines.push(this.chain(J.torso, { n: 4, len: .4, r0: .012, r1: .006, m: moss, x: (i - 1.5) * .15, y: D.tor * .7, z: D.tr * .8, a: 0, tilt: Math.PI - .2, radial: 4 }));
    }

    head_wrath(c, D) {
        const J = this.j, M = this.mats, H = J.head, h = D.head, face = mat(c.face, { roughness: .8 });
        const hair = mat(c.hair, { roughness: .9 }), moss = flatMat(c.moss), leafM = mat(0xffffff, { roughness: .85, side: THREE.DoubleSide });
        this.add(H, G.sph(h * .8, 12, 10), face, 0, 0, h * .05).scale.set(.85, 1.1, .95);
        for (const s of [1, -1]) this.eyeGlow(H, c.eye, s * h * .27, h * .1, h * .7, h * .07, 6);
        J.jaw = this.grp(H, 0, -h * .45, h * .45);
        this.add(J.jaw, G.box(h * .35, h * .06, h * .1), mat(0x0a1a08), 0, 0, 0);
        this.add(H, this.branches('wrathAntlers', [[[h * .4, h * .55, -h * .1], [.7, 1, -.2], .5, .045, 2], [[-h * .4, h * .55, -h * .1], [-.7, 1, -.2], .5, .045, 2]], 33), M.bark);
        this.add(H, mergedGeo('wrathHair', () => {
            const parts = [], r = rnd(4);
            for (let i = 0; i < 18; i++) {
                const a = (i / 17 - .5) * 3.4, x = Math.sin(a) * h * .7, z = Math.cos(a) * h * .5 - h * .25, L = .55 + r() * .35;
                parts.push([taperTube([[x, h * .5, z], [x * 1.5, 0, z - h * .4], [x * 1.7 + (r() - .5) * .1, -L * .6, z - h * .55], [x * 1.6, -L, z - h * .5 + (r() - .5) * .1]], h * .1, h * .03, 8, 4), null]);
            }
            return parts;
        }), hair);
        // vines and leaves over the body, skirt of vines and roots down to the ground
        const r = rnd(9), items = [];
        for (let i = 0; i < 70; i++) {
            const a = r() * TAU, y = r() * D.tor * .9, rad = D.tr * (1.05 + r() * .2);
            items.push({ p: [Math.sin(a) * rad * 1.2, y, Math.cos(a) * rad], n: [Math.sin(a), .3, Math.cos(a)], spin: r() * 6, s: .7 + r() * .5, color: [c.leaf, 0x6aa040, 0x2e5a1c][i % 3] });
        }
        this.leaves(J.torso, leafGeo(.13, .06), leafM, items);
        J.skirt = this.grp(J.body);
        const skirtH = D.H - .05;
        this.add(J.skirt, cached('wrathSkirt', () => {
            const g = new THREE.CylinderGeometry(D.tr * 1.3, .62, skirtH * .62, 14, 3, true), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const k = 1 + .15 * Math.sin(Math.atan2(v.x, v.z) * 7) * (.5 - v.y / (skirtH * .62));
                p.setXYZ(i, v.x * k, v.y, v.z * k);
            }
            g.translate(0, -skirtH * .31 + .1, 0);
            g.computeVertexNormals();
            return g;
        }), mat(c.moss, { roughness: .95, flatShading: true, side: THREE.DoubleSide }));
        this.add(J.skirt, mergedGeo('wrathStrands', () => {
            const parts = [], rr = rnd(12);
            for (let i = 0; i < 22; i++) {
                const a = i / 22 * TAU + rr() * .2, r0 = .5 + rr() * .1, y0 = -skirtH * .5, R = .62 + rr() * .2;
                parts.push([taperTube([[Math.sin(a) * r0, y0, Math.cos(a) * r0], [Math.sin(a) * R, -skirtH * .78, Math.cos(a) * R], [Math.sin(a) * (R + .15), -skirtH + .04, Math.cos(a) * (R + .15)]], .035, .012, 6, 4), null]);
            }
            return parts;
        }), M.bark);
        this.leaves(J.skirt, leafGeo(.15, .07), leafM, Array.from({ length: 50 }, (_, i) => {
            const a = r() * TAU, y = .1 - r() * skirtH * .62, rad = D.tr * 1.3 + (.62 - D.tr * 1.3) * (.1 - y) / (skirtH * .62) + .03;
            return { p: [Math.sin(a) * rad, y, Math.cos(a) * rad], n: [Math.sin(a), -.2, Math.cos(a)], spin: Math.PI + (r() - .5), s: .8 + r() * .5, color: [c.leaf, 0x6aa040, 0x2e5a1c][i % 3] };
        }));
        this.add(J.torso, blobGeo(q3(D.tr * .7), 1, .3, 3), moss, D.tr * .9, D.tor * .9, 0).scale.set(1.2, .5, 1);
    }

    head_phantom(c, D) {
        const J = this.j, H = J.head, h = D.head, bone = mat(c.bone, { roughness: .6 }), socket = mat(0x060806, { roughness: .9 });
        const moss = mat(c.moss, { roughness: .95, flatShading: true, side: THREE.DoubleSide });
        this.add(H, G.sph(h * .75, 12, 10), bone, 0, h * .1, 0).scale.set(.9, 1, 1);
        this.add(H, G.box(h * .8, h * .4, h * .6), bone, 0, -h * .3, h * .25);
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .2, 8, 6), socket, s * h * .25, h * .05, h * .45);
            this.eyeGlow(H, c.eye, s * h * .25, h * .05, h * .66, h * .075, 10);
        }
        J.jaw = this.grp(H, 0, -h * .48, h * .1);
        this.add(J.jaw, G.box(h * .7, h * .12, h * .6), bone, 0, -h * .02, h * .18);
        for (let i = 0; i < 6; i++) {
            this.add(J.jaw, G.cone(h * .035, h * .14, 4), bone, (i - 2.5) * h * .1, h * .08, h * .45);
            this.add(H, G.cone(h * .035, h * .16, 4), bone, (i - 2.5) * h * .1, -h * .52, h * .52).rotation.x = Math.PI;
        }
        this.add(H, mergedGeo('phantomCrown', () => {
            const parts = [];
            for (let i = 0; i < 9; i++) {
                const a = (i / 8 - .5) * 2.6, d = [Math.sin(a) * .7, 1, -.4 + Math.cos(a) * .2];
                parts.push([new THREE.ConeGeometry(h * .06, h * (.6 + (i % 3) * .25), 4).translate(0, h * .35, 0), along([Math.sin(a) * h * .55, h * .55, Math.cos(a) * h * .3 - h * .2], d)]);
            }
            return parts;
        }), bone);
        // hood and robe of moss, tattered translucent hem
        const hood = this.add(J.neck, blobGeo(q3(h * 1.1), 1, .25, 6), moss, 0, h * .75, -h * .55);
        hood.scale.set(1.05, 1.15, .75);
        J.robe = this.grp(J.body, 0, D.tor, 0);                                        // hangs from the shoulders
        const R0 = this.grp(J.robe, 0, -D.tor, 0);
        const robeH = D.tor + D.robe;
        this.add(R0, cached('phantomRobe', () => {
            const g = new THREE.CylinderGeometry(D.tr * 1.25, .4, robeH, 14, 4, true), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const a = Math.atan2(v.x, v.z), k = 1 + .12 * Math.sin(a * 5) + .08 * Math.sin(a * 11 + v.y * 4);
                p.setXYZ(i, v.x * k, v.y + (v.y < -robeH / 2 + .01 ? Math.sin(a * 9) * .06 : 0), v.z * k);
            }
            g.translate(0, D.tor - robeH / 2, 0);
            g.computeVertexNormals();
            return g;
        }), moss);
        this.add(R0, G.sph(D.tr * 1.25, 12, 6, 0, TAU, 0, Math.PI / 2), moss, 0, D.tor, 0).scale.set(1, .5, 1);
        this.ghostM = new THREE.MeshStandardMaterial({ color: c.moss, roughness: 1, transparent: true, opacity: .55, emissive: 0x2a4a3a, emissiveIntensity: .5, side: THREE.DoubleSide, depthWrite: false });
        J.tatters = [];
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU, r0 = .4;
            const ch = this.chain(R0, { n: 3, len: .3, r0: .05, r1: .015, m: this.ghostM, x: Math.sin(a) * r0, y: D.tor - robeH + .06, z: Math.cos(a) * r0, a, tilt: Math.PI - .15, radial: 4 });
            ch.segs.forEach(s => { s.children[0].castShadow = false; s.children[0].scale.set(1.8, 1, .4); });
            J.tatters.push(ch);
        }
        for (const A of J.arms) {                                                             // moss sleeves over the bony arms
            const sl = this.add(A.sh, G.cyl(D.ar * 2.4, D.ar * 3.6, D.arm[0] * .9, 7, true), moss, 0, -D.arm[0] * .45, 0);
            sl.castShadow = true;
        }
        // glaive in the right hand
        const metal = mat(c.metal, { roughness: .35, metalness: .7 }), shaft = mat(0x2a2016, { roughness: .8 });
        const R = J.arms.find(A => A.s < 0);
        J.glaive = this.grp(R.hand, 0, -D.ar * .8, 0);
        J.glaive.rotation.x = .7;
        const sg = this.add(J.glaive, G.cyl(.018, .018, 1.7, 6), shaft, 0, 0, 0);
        sg.rotation.x = Math.PI / 2;
        sg.position.z = .25;
        const blade = this.add(J.glaive, cached('glaiveBlade', () => {
            const s = new THREE.Shape();
            s.moveTo(0, 0);
            s.quadraticCurveTo(.12, .3, .02, .62);
            s.quadraticCurveTo(-.02, .3, -.06, 0);
            return new THREE.ShapeGeometry(s, 6);
        }), mat(c.metal, { roughness: .3, metalness: .75, side: THREE.DoubleSide }), 0, -.02, 1.08);
        blade.rotation.set(Math.PI / 2, 0, 0);
        blade.rotation.y = Math.PI / 2;
        this.add(J.glaive, G.cyl(.03, .03, .06, 6), metal, 0, 0, 1.08).rotation.x = Math.PI / 2;
    }

    anim_walker(q, t, dt, g, run, state) {
        const J = this.j, D = this.D, ph = this.phase, sh = q.shake * Math.sin(t * 40) * .03;
        const big = this.size > 2.5 ? .7 : 1;
        for (const L of J.legs) {
            const p = ph + (L.s > 0 ? 0 : Math.PI), lift = smooth(Math.max(0, Math.cos(p))) * g;
            const a0 = q.L0 - Math.sin(p) * (.42 + run * .15) * g, a1 = q.L1 + lift * (.9 + run * .4);
            L.top.rotation.set(a0, 0, L.s * .03);
            L.knee.rotation.x = a1;
            L.foot.rotation.x = -(q.bx + a0 + a1) * Math.min(1, Math.max(0, (1.45 - Math.abs(q.bx)) * 2));
        }
        let by = q.by;
        if (q.bx < -.05) by = Math.max(by, q.by * Math.min(1, -q.bx / 1.2));            // falling back: hips drop with the tilt
        if (D.float) by += Math.sin(t * 1.3) * .03 * (1 - q.droop) + Math.sin(ph * 2) * .02 * g;
        else {
            const need = D.lt * Math.cos(q.L0) + D.ls * Math.cos(q.L0 + q.L1) + D.foot - D.H, k = Math.max(0, 1 - Math.abs(q.bx) * 2);
            if (need > by) by += (need - by) * k;
            by += g > .001 ? -Math.abs(Math.sin(ph)) * .03 * g : 0;
        }
        J.body.position.set(0, D.H + by, q.bz);
        J.body.rotation.set(q.bx + .06 * g + (D.float ? .1 * g : 0), q.ry + Math.sin(ph) * .07 * g, q.roll + Math.sin(ph) * .03 * g * big + sh);
        const breath = Math.sin(t * 1.1) * .012 * q.eyes;
        J.torso.rotation.set(q.tx + breath, -Math.sin(ph) * .08 * g, sh);
        for (const A of J.arms) {
            const p = ph + (A.s > 0 ? Math.PI : 0);
            const swing = (Math.sin(p) * (.35 + run * .2) * g + Math.sin(t * .9 + A.s) * .03) * (J.glaive && A.s < 0 ? .25 : 1);
            const ax = A.s > 0 ? q.aLx : q.aRx, az = A.s > 0 ? q.aLz : q.aRz, ae = A.s > 0 ? q.aLe : q.aRe;
            A.sh.rotation.set(ax + swing, 0, A.s * az);
            A.el.rotation.x = ae - Math.max(0, -swing) * .3;
            A.fingers.forEach((f, i) => { f.rotation.x = -q.fing * .9 - Math.sin(t * 1.3 + i) * .05; });
        }
        J.head.rotation.set(q.headX + Math.sin(t * .7) * .03, q.headY + this.look * .4 * q.eyes, 0);
        if (J.jaw) J.jaw.rotation.x = q.jaw * .45;
        J.crown.rotation.set(Math.sin(t * .6) * .02 + sh, 0, Math.sin(t * .5 + 1) * .025);
        if (J.vines) J.vines.forEach((v, i) => this.wave(v, Math.PI - .2 - q.tx, .03, .06, t, 1.4, .6, i));
        // skirt / robe: flattened and shortened so the hem stays above the ground when the body sinks or tilts
        const th = Math.abs(J.body.rotation.x), co = Math.cos(th);
        if (J.skirt) this.fitHang(J.skirt, J.body.position.y, D.H - .1, 1.05, th, Math.sin(ph) * .03 * g, Math.sin(t * .8) * .02);
        if (J.robe) {
            this.fitHang(J.robe, J.body.position.y + D.tor * co, D.tor + D.robe, .5, th, -.1 * g, Math.sin(t * .8) * .02);
            J.tatters.forEach((T, i) => this.wave(T, Math.PI - .15 - g * .5 * Math.max(0, T.w), .05, .12 + .1 * g, t, 2, .8, i * 1.3));
        }
        if (J.glaive) J.glaive.rotation.x = .7 + q.droop * q.droop * q.droop * 1.0 - g * .35;
        if (this.glowHalos) for (const h of this.glowHalos) h.material.opacity = (.35 + .2 * Math.sin(t * 3.1)) * q.eyes;
        this.animEyes(q, t);
    }

    // hanging skirt / robe (pivot at height h, length L, hem radius R) under a body tilted back by th
    fitHang(G0, h, L, R, th, rx, rz) {
        const co = Math.cos(th), si = Math.sin(th);
        const sz = Math.min(1, Math.max(.25, (h - .05) * .8 / (R * si + 1e-3)));
        const sy = Math.min(1, Math.max(.2, (h - .05 - R * sz * si) / (L * co + 1e-3)));
        G0.scale.set(1 + (1 - sy) * .35, sy, sz);
        G0.rotation.set(rx, 0, rz);
    }

    animEyes(q, t) {
        if (!this.eyeList) return;
        for (const e of this.eyeList) {
            const k = q.eyes * (1 - this.blink * .8) * (.9 + .1 * Math.sin(t * 5.3));
            e.m.emissiveIntensity = e.base * k;
            if (e.h) e.h.material.opacity = .7 * k;
        }
    }

    // ---------------------------------------------------------------- frame update
    targetPose(state) {
        const T = this.tgt, P = this.P, K = this.KEYS;
        let src = this.S;
        if (state === 'defend') src = P.DEF;
        else if (state === 'hit') src = P.HIT;
        else if (state === 'kneel') src = P.KNEEL;
        else if (state === 'lie') src = P.LIE;
        else if (state === 'death') src = P.DEAD;
        else if (state === 'walk' || state === 'run') src = P.WALK || this.S;
        for (const k of K) T[k] = src[k];
        if (state === 'attack') {
            const p = this.atk;
            this.blend(T, P.A1, smooth(p / .3));
            if (p > .3) this.blend(T, P.A2, smooth((p - .3) / .16));
            if (p > .5) this.blend(T, P.A3, smooth((p - .5) / .16));
            if (p > .74) this.blend(T, this.S, smooth((p - .74) / .26));
        }
        return T;
    }
    blend(T, B, k) { for (const key of this.KEYS) T[key] += (B[key] - T[key]) * k; }

    update(c, dt) {
        this.time += dt;
        const t = this.time;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;
        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 5, dt);
        if (target) {
            const speed = (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) : 1);
            this.phase += dt * speed / ((target === 2 ? this.stride.run : this.stride.walk) * this.size) * TAU;
        }
        this.atk = c.actionDuration ? 1 - c.actionTime / c.actionDuration : (this.stateTime / .9) % 1;
        // idle glances and blinks
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) { this.lookTarget = state === 'idle' ? (Math.random() - .5) * 2 : 0; this.lookTimer = 1.5 + Math.random() * 3; }
        this.look = damp(this.look, state === 'idle' ? this.lookTarget : 0, 2.5, dt);
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) { this.blinkTimer = 2 + Math.random() * 4; this.blinkT = .15; }
        this.blinkT = Math.max(0, (this.blinkT || 0) - dt);
        this.blink = this.blinkT > 0 ? 1 : 0;

        const T = this.targetPose(state);
        const k = state === 'attack' ? 30 : state === 'hit' ? 18 : state === 'death' ? 3 : state === 'lie' || state === 'kneel' ? 4 : 7;
        for (const key of this.KEYS) this.p[key] = damp(this.p[key], T[key], k, dt);
        const g = Math.min(1, this.gait), run = Math.max(0, this.gait - 1);
        this['anim_' + this.kind](this.p, t, dt, g, run, state);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }
}
