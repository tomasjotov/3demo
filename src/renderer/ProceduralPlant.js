import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, mat } from '../avatar/kit.js';
import { DIRECTIONS } from '../utils/constants.js';
import { TAU, smooth, damp } from './QuadrupedRig.js';
import { taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralPlant — carnivorous plants, mimics and walking tree beings. Own small rig (no legs to share with
 * QuadrupedRig): damped flat poses like the other rigs, tendrils are chains of segments bent by sine waves.
 * Organic bodies (trunks, torsos, limbs, stems) are deformed cylinders (trunkGeo: radius profile, twisted bark ridges,
 * lumps), bark / moss / stone / robe patterns are small canvas textures, moss and hair hang as merged flat strands.
 *
 * Rooted plants (stay where they grow; walk / run = slow creeping of roots and tendrils):
 *   drischea     gnarled spiralling tree, tiers of dark foliage, white flowers, long fruit strands; hooked claw roots lash
 *                and drag prey to a maw in the trunk
 *   gwanga       olive segmented spiny stalk on hooked black claw roots, glossy bulb head with a star of long thorny
 *                tentacles curling up at the tips, spits spores
 *   hungry-wine  vine figure: twisted stem on roots, dark leafy body with red eyes, grapes, strangling vine arms
 *   suotix       tall mossy trunk with hanging dark tentacles and lashes tipped by dark caps with glowing dots
 *   waaz         bell-shaped spotted lilac mushroom with gnarled stem and curling octopus tentacles, spore clouds
 * Mimics (perfectly still until they strike):
 *   mirocus      weathered chest resting ajar on rows of fangs and red gums: the lid snaps open, tongue lashes, poison
 *                gas on defend; waddles when moving
 *   rack         pitted stone bristling with short spikes, dark cap, small eyes: splits into jaws and leaps, tiny legs
 *                only while it shuffles
 *   skorfan      mossy log propped up at its splintered end, really a reptile: eyes open, stubby legs come out, fanged
 *                jaws in the log end
 * Tree beings (two root legs, long branch arms, bark; walk on the roots):
 *   evil-tree    hunched dead giant, massive trunk body, huge spiky branch crown, skull-like maw; double-arm slam
 *   tree-folk    5 m hunched bark giant, grinning face carved in the mossy upper trunk, broken top; arm sweep
 *   nature-wrath 8 m antlered nature spirit, long hair, glowing green arms, wide skirt of vines, leaves and roots;
 *                double-arm slam
 *   forest-phantom hunched skull-faced figure in a shaggy moss robe, glides without legs, glowing blue eyes, chops
 *                with a big crescent-bladed glaive
 *
 * States: idle (sway, breathing; mimics still), walk / run, attack (wind-up → strike → recover: roots / tendrils lash,
 * maw / lid / jaws snap, branch arms slam or sweep), defend (closes up, tendrils raised, gas / pollen / spores),
 * hit (shudder), kneel and lie (droop low), death (wilts and collapses, ends still on the ground).
 */

export const PLANT_VARIANTS = {
    drischea: { kind: 'tree', bark: 0x4a2a22, dark: 0x22100c, leaf: 0x1c3020, flower: 0xf6f2ea, fruit: 0xb05a2a, mouth: 0x4a0a10, scale: 1.2 },
    gwanga: { kind: 'stalk', skin: 0x4a4a30, dark: 0x16140f, flesh: 0x8a3e30, bulb: 0xd8905e, thorn: 0xe0d0b0, spore: 0xc8d878, scale: 1.1 },
    'hungry-wine': { kind: 'vine', wood: 0x6a4428, dark: 0x14170f, leaf: 0x8aa83a, grape: 0x46285e, eye: 0xff2a18, scale: 1 },
    mirocus: { kind: 'chest', wood: 0x5e4e40, band: 0x26221e, flesh: 0x7a1c24, tooth: 0xeee4c8, gas: 0x90d040, scale: 1 },
    rack: { kind: 'stone', stone: 0x6a5c4e, cap: 0x3a4452, spike: 0xa89478, flesh: 0x8a3440, scale: 1 },
    skorfan: { kind: 'log', bark: 0x544a40, dark: 0x241e18, wood: 0x9a8466, moss: 0x4a6a26, eye: 0xe0c040, scale: 1 },
    suotix: { kind: 'stump', bark: 0x3e3830, dark: 0x1c1814, moss: 0x4e7a2a, tent: 0x4a3430, cap: 0x2a2620, glow: 0xffe070, scale: 1 },
    waaz: { kind: 'shroom', cap: 0xb0a0c4, spot: 0xf4f0f8, gill: 0xd8a8b8, stem: 0x4a3a4c, tent: 0x7a6890, sucker: 0xe0c8d8, spore: 0xc0a0ff, scale: 1 },
    'evil-tree': { kind: 'walker', style: 'evil', bark: 0x4a443e, dark: 0x1e1a16, eye: 0xff7a20, scale: 2 },
    'tree-folk': { kind: 'walker', style: 'folk', bark: 0x4a3c2c, dark: 0x221a10, face: 0x7a7242, moss: 0x52702a, leaf: 0x5a8a30, eye: 0xe0b040, scale: 1.9 },
    'nature-wrath': { kind: 'walker', style: 'wrath', bark: 0x4a5236, dark: 0x1e2618, face: 0x4a5a3a, moss: 0x2e4a1e, leaf: 0x4a7a2a, hair: 0x2a3a22, eye: 0x80ff70, glow: 0x60ff50, scale: 3.1 },
    'forest-phantom': { kind: 'walker', style: 'phantom', bark: 0x3a3a26, dark: 0x1e2014, bone: 0xcfc6b0, moss: 0x3e4a22, eye: 0x60d0ff, metal: 0x9a9a96, scale: .9 }
};

// tree beings at scale 1: thigh, shin, leg radius, hip x, torso height / radius, [upper arm, forearm], arm radius, head, foot height,
// finger length, forward hunch of the torso
const WALKERS = {
    evil: { lt: .5, ls: .5, lr: .25, hip: .27, tor: 1.05, tr: .46, arm: [.92, .9], ar: .17, head: .26, foot: .08, fl: .36, hunch: .2 },
    folk: { lt: .44, ls: .44, lr: .22, hip: .24, tor: .95, tr: .42, arm: [.9, .86], ar: .15, head: .3, foot: .08, fl: .3, hunch: .22 },
    wrath: { lt: .6, ls: .6, lr: .1, hip: .13, tor: .95, tr: .28, arm: [.62, .6], ar: .08, head: .2, foot: .05, fl: .14, hunch: 0 },
    phantom: { lt: 0, ls: 0, lr: .06, hip: .1, tor: .78, tr: .17, arm: [.56, .54], ar: .035, head: .18, foot: 0, fl: .17, float: .1, robe: 1.05, hunch: .32 }
};

const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const q3 = v => Math.round(v * 1000) / 1000;
const cache = new Map();
const cached = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const hex = c => '#' + new THREE.Color(c).getHexString();

// Lumpy icosphere (canopy pads, moss, knots): offset by a smooth function of the position, so shared corners stay shut.
function blobGeo(r, detail = 1, amp = .25, seed = 1) {
    return cached(`blob${r},${detail},${amp},${seed}`, () => {
        const ico = new THREE.IcosahedronGeometry(r, detail);
        ico.deleteAttribute('normal');
        const g = mergeVertices(ico), p = g.attributes.position, v = new THREE.Vector3();                // shared corners → smooth normals
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

// Piecewise linear profile through [t, value] points (t ascending, 0..1), smoothed between the points.
function profile(pts) {
    return t => {
        if (t <= pts[0][0]) return pts[0][1];
        for (let i = 1; i < pts.length; i++) {
            if (t <= pts[i][0]) {
                const [t0, a] = pts[i - 1], [t1, b] = pts[i], k = (t - t0) / (t1 - t0);
                return a + (b - a) * k * k * (3 - 2 * k);
            }
        }
        return pts[pts.length - 1][1];
    };
}

// Organic trunk / body: a cylinder (base at y = 0, height h) with a radius profile prof(t), elliptic section (sx, sz),
// twisted bark ridges, soft lumps and an optional bend(t) → [x, z] offset. UVs stay the cylinder's (bark grain along y).
function trunkGeo(key, { h, prof, sx = 1, sz = 1, twist = 0, ridges = 0, ramp = 0, lump = 0, seed = 1, radial = 14, hseg = 12, bend = null, open = false }) {
    return cached('trunk' + key, () => {
        const g = new THREE.CylinderGeometry(1, 1, 1, radial, hseg, open);
        g.translate(0, .5, 0);
        const p = g.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            const t = Math.min(1, Math.max(0, v.y)), rr = Math.hypot(v.x, v.z), a = Math.atan2(v.x, v.z);
            const rid = ridges ? Math.pow(.5 + .5 * Math.sin(a * ridges + t * twist + seed), 3) : 0;
            const r = prof(t) * (1 + ramp * rid + lump * Math.sin(a * 3 + t * 7 + seed) * Math.sin(t * 5 + seed * 2)) * rr;
            const [ox, oz] = bend ? bend(t) : [0, 0];
            p.setXYZ(i, Math.sin(a) * r * sx + ox, t * h, Math.cos(a) * r * sz + oz);
        }
        g.computeVertexNormals();
        return g;
    });
}

// Hanging moss / hair strands: flat tapered ribbons merged into one geometry. items: [x, y, z, length, outward angle]
function strandGeo(key, items, w = .05, droop = .15) {
    return mergedGeo(key, () => items.map(([x, y, z, L, a], i) => {
        const ox = Math.sin(a) * droop * L, oz = Math.cos(a) * droop * L, wig = Math.sin(i * 2.7) * .03;
        const g = taperTube([[x, y, z], [x + ox * .6 + wig, y - L * .45, z + oz * .6], [x + ox - wig, y - L, z + oz]], w, w * .2, 5, 4);
        const c = g.clone(), pp = c.attributes.position, v = new THREE.Vector3();
        for (let k = 0; k < pp.count; k++) {                                              // flatten across the outward direction
            v.fromBufferAttribute(pp, k);
            const dx = v.x - x, dz = v.z - z, n = dx * Math.sin(a) + dz * Math.cos(a);
            pp.setXYZ(k, v.x - Math.sin(a) * n * .6, v.y, v.z - Math.cos(a) * n * .6);
        }
        c.computeVertexNormals();
        return [c, null];
    }));
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
function barkTex(base, dark, tube, moss = null, mossK = .5) {
    return canvasTex(`bark${base},${dark},${tube},${moss},${mossK}`, g => {
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
        if (moss !== null) {                                                               // moss patches, denser at the top (v = 1)
            const m = new THREE.Color(moss), hi = m.clone().offsetHSL(.02, 0, .12), lo = m.clone().multiplyScalar(.6);
            for (let i = 0; i < 70 * mossK; i++) {
                const y0 = Math.pow(r(), 1.6) * 128, x0 = r() * 128, w = 6 + r() * 16;
                for (let k = 0; k < 26; k++) {                                              // fuzzy patch of small tufts
                    const d = Math.pow(r(), .7) * w, an = r() * TAU;
                    const [px, py] = pt(x0 + Math.cos(an) * d, y0 + Math.sin(an) * d * 1.2);
                    g.globalAlpha = (.9 - d / w * .6) * (.6 + r() * .4);
                    g.fillStyle = '#' + [m, hi, lo][(i + k) % 3].getHexString();
                    const rad = 1.2 + r() * 2.4;
                    for (const dxx of [-128, 0, 128]) { g.beginPath(); g.arc(px + dxx, py, rad, 0, TAU); g.fill(); }
                }
            }
            g.globalAlpha = 1;
        }
    }, tube ? [2, 2] : [2, 1]);
}
const barkMat = (base, dark, tube, moss = null, mossK = .5) => {
    const map = barkTex(base, dark, tube, moss, mossK);
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
            this.add(g, G.cyl(rb, ra, q3(l * 1.12), radial), m, 0, l / 2, 0);                  // overlapping, so bends show no gaps
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

        // claw roots arching out of the trunk base and hooking into the ground (pivot inside the trunk; lift = rotate up, reach = stretch)
        J.roots = [];
        const nR = 10;
        for (let i = 0; i < nR; i++) {
            const a = i / nR * TAU + .2, len = 1.0 + (i % 3) * .18;
            const g = this.grp(this.root, 0, .5, 0);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, .12, len * .3], [0, .02, len * .62], [0, -.3, len * .9], [0, -.48, len * 1.02], [0, -.5, len * .94]], .2, .022, bark, 16, 7);
            J.roots.push({ g, a, w: Math.pow(Math.max(0, Math.cos(a)), 2) });
        }
        // trunk tilts around its base edge when it falls (pivot at -x): one gnarled, spiralling trunk
        J.trunk = this.grp(this.root, 0, 0, -.45);
        const T = this.grp(J.trunk, 0, 0, .45);
        this.add(T, trunkGeo('drTrunk', { h: 2.65, prof: profile([[0, 1.55], [.12, 1.05], [.4, .86], [.7, .7], [.9, .62], [1, .66]]), ridges: 5, ramp: .4, twist: 7, lump: .1, seed: 2, radial: 16, hseg: 18,
            bend: t => [Math.sin(t * 3.4) * .12 * t, Math.sin(t * 2.3 + 1) * .05 * t] }), barkC).scale.set(.42, 1, .42);
        // maw in the trunk base: throat, upper / lower lip with teeth
        this.add(T, G.sph(.24, 10, 8), mouth, 0, .95, .38).scale.set(1.1, .7, .45);
        J.lipU = this.grp(T, 0, 1.04, .38);
        J.lipL = this.grp(T, 0, .86, .38);
        for (const [lip, s] of [[J.lipU, 1], [J.lipL, -1]]) {
            this.tube(lip, [[-.3, 0, -.08], [-.15, 0, .07], [0, 0, .12], [.15, 0, .07], [.3, 0, -.08]], .07, .07, barkC, 10, 6);
            for (let i = 0; i < 7; i++) {
                const x = (i - 3) * .075, zz = .1 - Math.abs(x) * .45;
                this.add(lip, G.cone(.022, .1, 4), tooth, x, -s * .06, zz).rotation.x = s > 0 ? Math.PI : 0;
            }
        }
        // crown: spreading branches carrying flat tiers of dark foliage (bonsai-like clouds), few white flowers, fruit strands
        J.crown = this.grp(T, 0, 2.55, 0);
        const r = rnd(3), pads = [], tips = [];
        for (let i = 0; i < 7; i++) {
            const a = i / 7 * TAU + .5, sx = Math.sin(a), sz = Math.cos(a), L = 1.35 + (i % 3) * .25, y = (i % 2) * .35;
            this.tube(J.crown, [[0, -.25, 0], [sx * .4, .2 + y * .5, sz * .4], [sx * L * .7, .45 + y, sz * L * .7], [sx * L, .38 + y, sz * L]], .2, .05, bark, 10, 6);
            pads.push([sx * L * .9, .62 + y, sz * L * .9, .62 + (i % 3) * .08, a]);
            pads.push([sx * L * .5, .78 + y, sz * L * .5, .45, a + 1]);
            tips.push([sx * L * 1.05, .5 + y, sz * L * 1.05], [sx * L * .7, .58 + y, sz * L * .7]);
        }
        this.tube(J.crown, [[0, -.2, 0], [.05, .6, 0], [0, 1.25, .05]], .2, .06, bark, 8, 6);
        pads.push([0, 1.35, 0, .7, 0], [.3, 1.05, -.3, .5, 2]);
        const padGeo = mergedGeo('drischeaPads2', () => pads.map(([x, y, z, s, a], i) => [blobGeo(1, 2, .3, i + 1),
            new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_up, a), new THREE.Vector3(s * 1.35, s * .38, s * 1.35))]));
        this.add(J.crown, padGeo, this.leafM);
        const fl = [];
        for (const [x, y, z, s] of pads) {
            for (let k = 0; k < 6; k++) {
                const u = r() * TAU, v = r() * .7;
                const nx = Math.cos(u) * Math.sin(v * 2), ny = Math.cos(v * 2), nz = Math.sin(u) * Math.sin(v * 2);
                fl.push({ p: [x + nx * s * 1.3, y + ny * s * .36, z + nz * s * 1.3], n: [nx, ny + .3, nz], spin: r() * 3, s: .5 + r() * .4 });
            }
        }
        this.leaves(J.crown, cached('drFlower', () => new THREE.IcosahedronGeometry(.075, 0)), this.flowerM, fl);
        J.fruit = [];
        tips.forEach(([x, y, z], i) => {
            const g = this.grp(J.crown, x, y - .15, z), len = 1.0 + (i % 4) * .25;
            this.add(g, G.cyl(.008, .008, q3(len), 4), dark, 0, -len / 2, 0);
            for (let k = 0; k < 6; k++) this.add(g, G.sph(.032, 6, 5), fruitM, 0, -len * (.3 + k * .13), 0).scale.set(1, 1.4, 1);
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
        J.crown.position.y = 2.55 - q.droop * .25;
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
        const skin = mat(c.skin, { roughness: .45 }), dark = mat(c.dark, { roughness: .5 }), flesh = mat(c.flesh, { roughness: .5 });
        const thorn = mat(c.thorn, { roughness: .5 }), bulbM = mat(c.bulb, { roughness: .35, emissive: c.bulb, emissiveIntensity: .12 });
        J.base = this.grp(this.root);
        this.add(J.base, blobGeo(.2, 2, .18, 3), skin, 0, .2, 0).scale.set(1, .75, 1);
        J.feet = [];
        for (let i = 0; i < 7; i++) {                                                          // big hooked black claw roots
            const a = i / 7 * TAU, g = this.grp(J.base, 0, .22, 0);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, .2, .2], [0, .22, .42], [0, .05, .62], [0, -.16, .7], [0, -.21, .64]], .08, .012, dark, 14, 7);
            this.add(g, G.cone(.022, .1, 4), thorn, 0, .26, .3).rotation.x = -.4;
            J.feet.push({ g, a, set: i % 2 });
        }
        // segmented stalk: rounded olive vertebrae with dark joints and side spines
        J.stalk = [];
        let p = this.grp(J.base, 0, .3, 0);
        J.stalkRoot = p;
        const n = 9, l = .14;
        const segGeo = cached('gwangaSeg', () => {
            const pts = [];
            for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(.001 + Math.sin(t * Math.PI) * .9 + .25 * (1 - Math.abs(t - .5) * 2) ** 3, t - .5)); }
            const g = new THREE.LatheGeometry(pts, 14);
            g.computeVertexNormals();
            return g;
        });
        for (let i = 0; i < n; i++) {
            const g = this.grp(p), r = .15 * (1 - i * .05);
            this.add(g, segGeo, skin, 0, l * .5, 0).scale.set(r, l * 1.15, r);
            this.add(g, G.cyl(q3(r * .78), q3(r * .78), .03, 10), dark, 0, l * .98, 0);
            for (const s of [1, -1]) this.add(g, G.cone(.018, .12, 4), thorn, s * r * .9, l * .55, 0).rotation.z = -s * 1.0;
            this.add(g, G.cone(.016, .09, 4), thorn, 0, l * .5, -r * .85).rotation.x = -1.2;
            J.stalk.push(g);
            p = this.grp(g, 0, l, 0);
        }
        // head: collar, glossy bulb with a spike crown, 8 long thorny tentacles
        J.head = this.grp(p);
        this.add(J.head, G.sph(.13, 10, 7), dark, 0, .03, 0).scale.set(1.1, .6, 1.1);
        this.add(J.head, G.sph(.2, 16, 12), bulbM, 0, .2, 0).scale.set(1, .92, 1);
        this.add(J.head, G.cyl(.205, .19, .04, 16), mat(new THREE.Color(c.bulb).multiplyScalar(.55), { roughness: .4 }), 0, .14, 0);
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
        for (let i = 0; i < 8; i++) J.tent.push(this.chain(J.head, { n: 9, len: 1.6, r0: .06, r1: .01, m: flesh, y: .08, a: i / 8 * TAU + .2, tilt: .9, thorn }));
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
        J.tent.forEach((T, i) => this.wave(T, 1.3 + q.tilt, (-.09 + q.curlT * .5) * (1 + .3 * Math.sin(i * 2.3)), .06 * sw + .04 * g, t, 1.6 + g, .6, i * 1.3, 2));
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ hungry vine: rooted vine figure
    build_vine() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { sag: 0, lean: 0, armL: .1, armR: .1, armS: 0, fing: .2 });
        const wood = barkMat(c.wood, 0x3a2414, true), dark = mat(c.dark, { roughness: .7 }), woodC = mat(c.wood, { roughness: .9 }), armM = mat(0x2a2218, { roughness: .8 });
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
        const r = rnd(7), items = [], greens = [c.leaf, 0x9ab040, 0x3e5a24, 0x6a8a30, 0x4a6a28];
        for (let i = 0; i < 30; i++) {                                                          // big grape leaves spreading over the head
            const az = i * 2.4, el = .4 + r() * .9, R = .5 + r() * .25;
            const nx = Math.sin(az) * Math.cos(el), ny = Math.sin(el), nz = Math.cos(az) * Math.cos(el);
            items.push({ p: [nx * R * 1.4, ny * R * .7 + .1, nz * R * 1.05 - .08], n: [nx, ny + .5, nz], spin: r() * 6, s: .9 + r() * .5, color: greens[i % 5] });
        }
        this.leaves(J.crown, vineLeafGeo(.23), leafM, items);
        J.grapes = [];
        for (let i = 0; i < 9; i++) {                                                           // heavy grape bunches all around
            const az = .6 + i * .72, rr = .5 + (i % 3) * .1, g = this.grp(J.crown, Math.sin(az) * rr * 1.1, -.02 - (i % 2) * .1, Math.cos(az) * rr * .9);
            this.add(g, grapeGeo(.045), grape).scale.setScalar(.85 + (i % 3) * .15);
            J.grapes.push(g);
        }
        // vine arms with tendril fingers
        J.arms = [];
        for (const s of [1, -1]) {
            const sh = this.grp(J.body, s * .36, .4, .06);
            const pit = this.grp(sh);
            const arm = this.chain(pit, { n: 5, len: .8, r0: .075, r1: .035, m: armM, a: 0, tilt: Math.PI - .35, joints: true, radial: 6 });
            const fingers = [];
            for (let f = 0; f < 4; f++) fingers.push(this.chain(arm.end, { n: 3, len: .3, r0: .024, r1: .005, m: armM, a: (f - 1.5) * .7 + (s > 0 ? 0 : Math.PI), tilt: .35, radial: 4 }));
            const gr = this.grp(arm.segs[3], s * .05, .05, 0);
            this.add(gr, grapeGeo(.04), grape);
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
        Object.assign(this.S, { lid: .3, tongue: 0, loll: 0 });                                  // rests ajar, fangs showing
        const plank = canvasTex(`plank${c.wood}`, g => {
            g.fillStyle = hex(c.wood);
            g.fillRect(0, 0, 128, 128);
            const r = rnd(3);
            for (let y = 0; y < 128; y += 32) {
                g.fillStyle = 'rgba(20,14,8,.85)';
                g.fillRect(0, y, 128, 3);
                for (let k = 0; k < 9; k++) {
                    g.fillStyle = `rgba(${r() < .5 ? '30,20,12' : '170,160,145'},${.15 + r() * .2})`;    // weathered grey grain
                    g.fillRect(0, y + 4 + r() * 26, 128, 1 + r() * 2);
                }
                for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(15,10,6,.7)'; g.beginPath(); g.ellipse(r() * 128, y + 10 + r() * 14, 3, 2, 0, 0, TAU); g.fill(); }
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
        // iron corner brackets, red gums along the rim and a crowded row of long fangs
        for (const sx of [1, -1]) for (const sz of [1, -1]) this.add(J.body, G.box(.07, Hh * .95, .07), band, sx * (W / 2 - .02), Hh / 2, sz * (Dp / 2 - .02));
        const gumGeo = (k, w, d) => cached('mirGum' + k, () => taperTube([[-w / 2, 0, d - .1], [-w / 2 + .02, 0, d], [w / 2 - .02, 0, d], [w / 2, 0, d - .1]], .035, .035, 12, 6));
        this.add(J.body, gumGeo('b', W - .1, Dp / 2 - .06), flesh, 0, Hh - .01, 0);
        for (let i = 0; i < 13; i++) this.add(J.body, G.cone(.022, i % 2 ? .1 : .15, 4), tooth, (i - 6) * .064, Hh + (i % 2 ? .04 : .06), Dp / 2 - .07);
        for (const s of [1, -1]) for (let i = 0; i < 4; i++) this.add(J.body, G.cone(.02, .1, 4), tooth, s * (W / 2 - .08), Hh + .04, .14 - i * .1);
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
        this.add(J.lid, gumGeo('l', W - .1, Dp - .07), flesh, 0, -.02, 0);
        for (let i = 0; i < 12; i++) { const L = i % 2 ? .13 : .2; this.add(J.lid, G.cone(.026, L, 4), tooth, (i - 5.5) * .066, -.02 - L / 2, Dp - .07).rotation.x = Math.PI; }
        for (const s of [1, -1]) for (let i = 0; i < 4; i++) this.add(J.lid, G.cone(.022, .11, 4), tooth, s * (W / 2 - .08), -.06, Dp - .17 - i * .1).rotation.x = Math.PI;
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
            WALK: P({ lid: .32 }),
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
        Object.assign(this.S, { lid: .05, legs: 0, sq: 1 });
        const pits = canvasTex(`pits${c.stone}`, g => {                                     // pitted, mottled stone
            g.fillStyle = hex(c.stone);
            g.fillRect(0, 0, 128, 128);
            const r = rnd(4), base = new THREE.Color(c.stone);
            for (let i = 0; i < 260; i++) {
                const col = base.clone().offsetHSL((r() - .5) * .04, 0, (r() - .55) * .2);
                g.fillStyle = '#' + col.getHexString();
                g.globalAlpha = .5 + r() * .5;
                g.beginPath();
                g.arc(r() * 128, r() * 128, 1 + r() * 5, 0, TAU);
                g.fill();
            }
            g.fillStyle = '#16120e';
            for (let i = 0; i < 70; i++) { g.globalAlpha = .4 + r() * .4; g.beginPath(); g.arc(r() * 128, r() * 128, .8 + r() * 1.6, 0, TAU); g.fill(); }
        }, [3, 2]);
        const stone = mat(pits ? 0xffffff : c.stone, { map: pits, roughness: .9 }), spike = mat(c.spike, { roughness: .6 });
        const cap = mat(c.cap, { roughness: .2, metalness: .3 });
        const flesh = mat(c.flesh, { roughness: .5 }), tooth = mat(0xe8dcc0, { roughness: .4 });
        const R = .46, lowH = .5, upH = .72;
        const shellGeo = (lower) => cached('rackShell' + lower, () => {
            const g = new THREE.SphereGeometry(R, 24, 8, 0, TAU, lower ? Math.PI / 2 : 0, Math.PI / 2), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const n = 1 + .05 * Math.sin(v.x * 17 + 1) * Math.sin(v.z * 15 + 2) + .03 * Math.sin(v.y * 23);
                p.setXYZ(i, v.x * n, v.y * (lower ? lowH : upH), v.z * n);
            }
            g.computeVertexNormals();
            return g;
        });
        // dense short spikes all over (none on the dark cap, the face or the lip seam)
        const spikesGeo = (lower) => mergedGeo('rackSpikes2' + lower, () => {
            const parts = [], r = rnd(lower ? 3 : 9), N = lower ? 70 : 230;
            for (let k = 0; k < N; k++) {
                const az = r() * TAU, el = lower ? -.15 - r() * .55 : .14 + r() * 1.1;
                if (!lower && el > .95) continue;                                            // leave the dark cap bare
                if (!lower && el < .55 && Math.abs(Math.atan2(Math.sin(az - Math.PI / 2), Math.cos(az - Math.PI / 2))) < .6) continue;   // face
                const d = [Math.cos(el) * Math.cos(az), Math.sin(el) * (lower ? lowH : upH), Math.cos(el) * Math.sin(az)];
                const h = .045 + r() * .05;
                parts.push([new THREE.ConeGeometry(.013, h, 4).translate(0, h / 2, 0), along([d[0] * R * .98, d[1] * R * .98, d[2] * R * .98], [d[0] + (r() - .5) * .3, Math.sin(el) + (r() - .5) * .3, d[2] + (r() - .5) * .3])]);
            }
            return parts;
        });
        J.body = this.grp(this.root, 0, R * lowH, 0);
        J.sq = this.grp(J.body);
        this.add(J.sq, shellGeo(true), stone);
        this.add(J.sq, spikesGeo(true), spike);
        const disc = this.add(J.sq, cached('rackDisc2', () => new THREE.CircleGeometry(R * .92, 20)), flesh, 0, .005, 0);
        disc.rotation.x = -Math.PI / 2;
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * TAU, front = Math.cos(a) > .3 ? 1.5 : 1;
            this.add(J.sq, G.cone(.02, q3(.06 * front), 4), tooth, Math.sin(a) * R * .9, .03 * front, Math.cos(a) * R * .9);
        }
        J.lid = this.grp(J.sq, 0, 0, -R * .95);
        const U = this.grp(J.lid, 0, 0, R * .95);
        this.add(U, shellGeo(false), stone);
        this.add(U, spikesGeo(false), spike);
        this.add(U, G.sph(R * .45, 16, 8, 0, TAU, 0, Math.PI / 2), cap, 0, R * upH * .76, -R * .05).scale.set(1, .42, 1);
        const lip = this.add(U, cached('rackDisc2', () => new THREE.CircleGeometry(R * .92, 20)), flesh, 0, -.004, 0);
        lip.rotation.x = Math.PI / 2;
        for (let i = 0; i < 18; i++) {
            const a = (i + .5) / 18 * TAU, front = Math.cos(a) > .3 ? 1.6 : 1;
            this.add(U, G.cone(.02, q3(.065 * front), 4), tooth, Math.sin(a) * R * .9, -.03 * front, Math.cos(a) * R * .9).rotation.x = Math.PI;
        }
        // small dark eyes low on the front, just above the jaw seam
        const eyeM = mat(0x0c0a08, { roughness: .15 }), irisM = mat(0x8a7a3a, { roughness: .3, emissive: 0x3a3010 });
        for (const s of [1, -1]) {
            const ex = s * R * .32, el = .32, ez = R * .85;
            this.add(U, G.sph(.05, 10, 8), eyeM, ex, R * upH * Math.sin(el) * .95, ez).scale.set(1, .8, .7);
            this.add(U, G.sph(.018, 6, 5), irisM, ex, R * upH * Math.sin(el) * .95 + .008, ez + .032);
            this.add(U, G.cone(.03, .1, 4), stone, ex, R * upH * Math.sin(el) * .95 + .05, ez - .01).rotation.set(-1.2, 0, -s * .3);
        }
        // little legs, only out while it shuffles or leaps
        J.legs = [];
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + .5, g = this.grp(J.sq, Math.sin(a) * R * .55, -R * lowH * .35, Math.cos(a) * R * .55);
            g.rotation.order = 'YXZ';
            g.rotation.y = a;
            this.add(g, G.cyl(.022, .03, .14, 5), spike, 0, -.06, 0);
            this.add(g, G.cone(.02, .06, 4), spike, 0, -.15, 0).rotation.x = Math.PI;
            J.legs.push({ g, a, i });
        }
        const P = this.pose.bind(this);
        this.P = {
            WALK: P({ legs: 1, by: .05 }),
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
        J.body.position.set(0, .23 + q.by + shuffle, q.bz);
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
        Object.assign(this.S, { legs: 0, head: -.08, eyes: .3, jaw: .2, bx: -.12 });            // front end propped up out of the mud
        const bark = barkMat(c.bark, c.dark, false, c.moss, .25), woodM = mat(c.wood, { roughness: .9 }), moss = mat(c.moss, { roughness: .95 });
        const tooth = mat(0xe8dcc0, { roughness: .4 }), gum = mat(0x5a1a1a, { roughness: .6 }), claw = mat(0x1e1810, { roughness: .5 });
        const rings = canvasTex(`rings${c.wood}`, g => {                                     // end grain: growth rings and cracks
            const w = new THREE.Color(c.wood);
            g.fillStyle = '#' + w.clone().multiplyScalar(.55).getHexString();
            g.fillRect(0, 0, 128, 128);
            for (let i = 16; i > 0; i--) {
                g.fillStyle = '#' + w.clone().multiplyScalar(i % 2 ? .75 : .95).getHexString();
                g.beginPath();
                g.ellipse(64, 64, i * 4, i * 4 * .95, 0, 0, TAU);
                g.fill();
            }
            g.strokeStyle = 'rgba(26,18,10,.6)';
            g.lineWidth = 1;
            const r = rnd(3);
            for (let i = 0; i < 6; i++) { const a = r() * TAU; g.beginPath(); g.moveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8); g.lineTo(64 + Math.cos(a) * (40 + r() * 24), 64 + Math.sin(a) * (40 + r() * 24)); g.stroke(); }
        });
        if (rings) { rings.repeat.set(1, 1); }
        const endM = rings ? mat(0xffffff, { map: rings, roughness: .9 }) : mat(c.wood);
        const R = .27;
        J.body = this.grp(this.root, 0, R, 0);
        const log = this.add(J.body, G.cyl(R, R * 1.05, 1.3, 12), [bark, endM, endM], 0, 0, -.55);
        log.rotation.x = Math.PI / 2;
        const r = rnd(4);
        for (let i = 0; i < 7; i++) {                                                          // splintered rear end
            const a = i / 7 * TAU, l = .12 + r() * .22;
            this.add(J.body, G.cone(.07, q3(l), 4), woodM, Math.sin(a) * R * .7, Math.cos(a) * R * .7, -1.2 - l / 2 + .02).rotation.x = -Math.PI / 2;
        }
        const snag = this.add(J.body, G.cone(.09, .45, 4), bark, .05, R * .75, -1.05);
        snag.rotation.x = -.7;
        for (let i = 0; i < 4; i++) this.add(J.body, blobGeo(.2, 2, .3, i + 2), moss, (r() - .5) * .12, R * .82, -1.05 + i * .3).scale.set(1, .32, 1.6);
        for (const s of [1, -1]) this.add(J.body, G.cyl(.04, .055, .2, 6), bark, s * R * .95, .05, -.7 + s * .2).rotation.z = -s * 1.2;
        // head = front of the log: upper jaw half-cylinder, lower jaw hinged
        J.head = this.grp(J.body, 0, 0, .08);
        const upper = this.add(J.head, G.cyl(R * .92, R, .5, 12, false, Math.PI / 2, Math.PI), [bark, endM, endM], 0, 0, .25);
        upper.rotation.x = Math.PI / 2;
        this.add(J.head, G.box(R * 1.8, .02, .48), gum, 0, -.005, .25);
        this.add(J.head, blobGeo(.12, 2, .3, 5), moss, -.06, R * .9, .02).scale.set(1, .35, 1.2);
        for (const s of [1, -1]) {
            for (let i = 0; i < 7; i++) { const L = i % 2 ? .08 : .12; this.add(J.head, G.cone(.02, L, 4), tooth, s * R * .8, -L / 2 + .005, .08 + i * .06).rotation.x = Math.PI; }
            this.add(J.head, G.sph(.095, 8, 6), bark, s * .13, R * .85, .12).scale.set(1, .75, 1.1);
            this.add(J.head, G.box(.13, .04, .07), bark, s * .13, R * .85 + .07, .16).rotation.z = s * .25;      // brow ridge
        }
        for (let i = 0; i < 5; i++) { const L = i % 2 ? .11 : .16; this.add(J.head, G.cone(.022, L, 4), tooth, (i - 2) * .075, -L / 2 + .01, .47).rotation.x = Math.PI; }
        this.add(J.head, mergedGeo('skorSplinters', () => {                                    // broken, splintered wood above the eyes
            const parts = [], r = rnd(8);
            for (let i = 0; i < 7; i++) {
                const x = (i - 3) * .07, L = .1 + r() * .22;
                parts.push([new THREE.ConeGeometry(.035, L, 4).translate(0, L / 2, 0), along([x, R * .7, -.02 + r() * .05], [x * .8, 1, -.25 + r() * .3])]);
            }
            return parts;
        }), woodM);
        J.eyes = [];
        const eyeM = mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .45 });
        for (const s of [1, -1]) {
            const e = this.grp(J.head, s * .13, R * .9, .17);
            this.add(e, G.sph(.062, 10, 8), eyeM);
            this.add(e, G.box(.012, .07, .02), mat(0x080604), 0, 0, .045);
            J.eyes.push(e);
        }
        J.jaw = this.grp(J.head, 0, -.01, .02);
        const lower = this.add(J.jaw, G.cyl(R * .82, R * .9, .48, 12, false, -Math.PI / 2, Math.PI), [bark, endM, endM], 0, 0, .24);
        lower.rotation.x = Math.PI / 2;
        lower.scale.set(1, 1, .7);
        this.add(J.jaw, G.box(R * 1.6, .02, .44), gum, 0, -.01, .24);
        for (const s of [1, -1]) for (let i = 0; i < 6; i++) this.add(J.jaw, G.cone(.018, i % 2 ? .07 : .1, 4), tooth, s * R * .7, .03, .08 + i * .065);
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
            WALK: P({ legs: 1, eyes: 1, by: .07, head: -.05, bx: -.03 }),
            A1: P({ legs: 1, eyes: 1, jaw: 1, head: -.35, by: .08, bz: -.1 }),
            A2: P({ legs: 1, eyes: 1, jaw: .08, head: .1, bz: .45, by: .06 }),
            A3: P({ legs: 1, eyes: 1, jaw: .04, head: 0, bz: .3, roll: .35, shake: .3, by: .05 }),
            DEF: P({ legs: 1, eyes: 1, jaw: .75, head: -.25, by: .09, bx: -.06 }),
            HIT: P({ legs: .7, eyes: 1, shake: 1, jaw: .3, head: -.2, bx: -.05, by: .04 }),
            KNEEL: P({ legs: .35, eyes: .6, head: .12, jaw: .05, roll: .06 }),
            LIE: P({ legs: .45, eyes: 0, jaw: .1, roll: .12, bx: 0 }),
            DEAD: P({ legs: 1, eyes: 0, jaw: .4, roll: Math.PI, bx: 0 })
        };
        this.stride = { walk: .9, run: 1.3 };
    }

    anim_log(q, t, dt, g, run, state) {
        const J = this.j, sh = q.shake * Math.sin(t * 45) * .04, ph = this.phase;
        J.body.position.set(0, .27 + q.by * Math.max(0, 1 - Math.abs(q.roll)) + Math.max(0, -q.bx) * 1.2, q.bz);   // lifted so the tail end stays on the ground
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
        const bark = barkMat(c.bark, c.dark, true), barkM = barkMat(c.bark, c.dark, false, c.moss, .9), moss = mat(c.moss, { roughness: .95 });
        const tent = mat(c.tent, { roughness: .6 }), capM = mat(c.cap, { roughness: .5 });
        this.glowM = mat(0x2a2418, { roughness: .5, emissive: c.glow, emissiveIntensity: 1.4 });
        // tall mossy trunk with flared root buttresses
        J.trunk = this.grp(this.root, 0, 0, -.4);
        const T = this.grp(J.trunk, 0, 0, .4);
        this.add(T, trunkGeo('suoTrunk', { h: 1.95, prof: profile([[0, 1.55], [.1, 1.05], [.35, .86], [.75, .8], [.92, .86], [1, .7]]), ridges: 7, ramp: .2, twist: 1.5, lump: .08, seed: 3, radial: 16, hseg: 12 }), barkM).scale.set(.3, 1, .3);
        for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + .3, g = this.grp(this.root, 0, .4, 0);
            g.rotation.y = a;
            this.tube(g, [[0, 0, 0], [0, -.08, .36], [0, -.3, .58], [0, -.4, .74]], .17, .035, bark, 8, 6);
        }
        const r = rnd(6);
        for (let i = 0; i < 4; i++) {                                                          // soft moss pads on the trunk
            const a = r() * TAU, y = .3 + r() * 1.2;
            const mb = this.add(T, blobGeo(.16, 2, .25, i + 3), moss, Math.sin(a) * .25, y, Math.cos(a) * .25);
            mb.scale.set(1.1, .8 + r() * .5, .5);
            mb.rotation.y = a;
        }
        this.add(T, blobGeo(.36, 2, .2, 2), moss, 0, 1.98, 0).scale.set(1.15, .6, 1.15);       // moss cushion on top
        J.top = this.grp(T, 0, 1.9, 0);
        // dark hanging tentacles
        J.hang = [];
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU + .15;
            J.hang.push(this.chain(J.top, { n: 6, len: 1.0 + (i % 3) * .18, r0: .045, r1: .01, m: tent, x: Math.sin(a) * .3, z: Math.cos(a) * .3, a, tilt: 2.85, radial: 5 }));
        }
        // lashes reaching out and up, each ending in a dark mushroom cap with glowing dots on top
        const dots = mergedGeo('suoDots', () => {
            const parts = [], rr = rnd(5);
            for (let k = 0; k < 11; k++) {
                const az = k * 2.4, el = .35 + (k % 3) * .3 + rr() * .1;
                const x = Math.sin(el) * Math.cos(az) * .17, y = Math.cos(el) * .17 * .6 + .02, z = Math.sin(el) * Math.sin(az) * .17;
                parts.push([new THREE.SphereGeometry(.018 + rr() * .008, 5, 4), new THREE.Matrix4().makeTranslation(x, y, z)]);
            }
            return parts;
        });
        J.lash = [];
        for (const a of [0, 1.25, 2.5, -2.5, -1.25]) {
            const ch = this.chain(J.top, { n: 5, len: .85, r0: .055, r1: .03, m: tent, y: .1, a, tilt: 1.5, radial: 6 });
            this.add(ch.end, G.sph(.17, 12, 6, 0, TAU, 0, Math.PI / 2), capM, 0, .02, 0).scale.set(1, .6, 1);
            this.add(ch.end, cached('suoUnder', () => new THREE.CircleGeometry(.165, 14)), mat(0x14100c, { roughness: .8, side: THREE.DoubleSide }), 0, .02, 0).rotation.x = Math.PI / 2;
            this.add(ch.end, dots, this.glowM).castShadow = false;
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
            this.wave(H, 2.85 - q.tentR * w * 1.3 - Math.max(0, -q.tentR) * -.3, .04 + q.droop * .05, .07 * sw + .06 * g + .03, t, 1.4 + g, .7, i * 1.7);
        });
        J.lash.forEach((L, i) => {
            const w = Math.max(0, L.w);
            this.wave(L, 1.8 - q.capR + q.capF * w * 1.2 + q.droop * .7, -.2 + q.capF * w * .4 + q.droop * .55 + Math.sin(t * .8 + i) * .04 * sw, .05 * sw, t, 1.2, .5, i * 2.1);
        });
        this.glowM.emissiveIntensity = .3 + 1.1 * (1 - q.droop * .7) * (.85 + .15 * Math.sin(t * 2.3));
    }

    // ================================================================ waaz: tentacled mushroom
    build_shroom() {
        const c = this.c, J = this.j;
        Object.assign(this.S, { capT: 0, tentU: 0, tentF: 0, curlK: 0, lean: 0 });
        const stem = barkMat(c.stem, 0x2a2030, true), tent = mat(c.tent, { roughness: .55 }), sucker = mat(c.sucker, { roughness: .5 });
        const spot = mat(c.spot, { roughness: .6 });
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
        this.add(T, trunkGeo('waazStem', { h: 1.42, prof: profile([[0, 1.5], [.15, 1.0], [.6, .8], [.9, .75], [1, .95]]), ridges: 6, ramp: .3, twist: 4, lump: .12, seed: 5, radial: 12, hseg: 10,
            bend: t => [Math.sin(t * 3) * .05, 0] }), barkMat(c.stem, 0x2a2030, false)).scale.set(.22, 1, .22);
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
        // bell-shaped cap, light lilac on top darkening to a blue-violet rim that curls under; spots of many sizes
        const capPt = a => { const u = a / (Math.PI / 2); return [u, .76 * (1 - Math.pow(u, 2.4)) - .04]; };
        const dome = cached('waazBell', () => {
            const pts = [];
            for (let i = 0; i <= 16; i++) { const [x, y] = capPt(i / 16 * Math.PI / 2); pts.push(new THREE.Vector2(x + .001, y)); }
            pts.push(new THREE.Vector2(.97, -.1), new THREE.Vector2(.9, -.12));
            const g = new THREE.LatheGeometry(pts.reverse(), 28), p = g.attributes.position, col = [], top = new THREE.Color(0xc4b6e4), rim = new THREE.Color(0x54468a), cc = new THREE.Color();
            for (let i = 0; i < p.count; i++) {
                const ang = Math.atan2(p.getX(i), p.getZ(i)), k = 1 + .035 * Math.sin(ang * 9) * Math.max(0, .2 - p.getY(i));   // wavy rim
                p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
                cc.copy(rim).lerp(top, Math.min(1, Math.max(0, (p.getY(i) + .1) / .85)) ** .7);
                col.push(cc.r, cc.g, cc.b);
            }
            g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
            g.computeVertexNormals();
            return g;
        });
        this.add(J.cap, dome, mat(0xffffff, { roughness: .5, vertexColors: true, side: THREE.DoubleSide }));
        const under = this.add(J.cap, cached('waazUnder2', () => new THREE.CircleGeometry(.92, 28)), gills ? mat(0xffffff, { map: gills, roughness: .8 }) : mat(c.gill), 0, -.1, 0);
        under.rotation.x = Math.PI / 2;
        const r = rnd(8), sp = [];
        for (let i = 0; i < 70; i++) {
            const az = r() * TAU, e = .08 + r() * 1.35, [x, y] = capPt(e), [x2, y2] = capPt(e + .01);
            const nx = y2 - y, ny = -(x2 - x), nl = Math.hypot(nx, ny);
            sp.push({ p: [Math.cos(az) * (x + .006), y + .006, Math.sin(az) * (x + .006)], n: [Math.cos(az) * -nx / nl, -ny / nl, Math.sin(az) * -nx / nl], s: .35 + r() * r() * 1.4 });
        }
        this.leaves(J.cap, cached('waazSpot2', () => new THREE.CircleGeometry(.06, 7)), spot, sp);
        J.tent = [];
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU + .2;
            J.tent.push(this.chain(J.cap, { n: 9, len: 1.45 + (i % 3) * .25, r0: .065, r1: .01, m: tent, x: Math.sin(a) * .32, y: -.08, z: Math.cos(a) * .32, a, tilt: 2.45, radial: 6, sucker }));
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
            this.wave(T, 2.7 - q.tentU - q.tentF * w * 1.1 + pulse + q.droop * .2 - (i % 3) * .12, -(.26 + (i % 2) * .14 + q.curlK * .5) * (1 - q.droop * .6), .07 * sw + .03, t, 1.3, .6, i * 1.9, 3);
        });
        this.animPuffs(J.puffs, q.puff, t);
    }

    // ================================================================ tree beings
    build_walker() {
        const c = this.c, st = c.style, J = this.j, D = this.D = { ...WALKERS[st] };
        Object.assign(this.S, { tx: 0, L0: -.04, L1: .1, aLx: -.05, aLz: .16, aLe: -.25, aRx: -.05, aRz: .16, aRe: -.25, headX: 0, headY: 0, fing: .2 });
        const S = this.S;
        if (st === 'evil') Object.assign(S, { aLx: -.2, aRx: -.2, aLz: .32, aRz: .32, aLe: -.3, aRe: -.3 });   // long arms held out and forward
        if (st === 'phantom') Object.assign(S, { aLx: -.55, aLz: .45, aLe: -.5, aRx: -.2, aRz: .22 });   // bony hand reaching out
        if (st === 'folk') Object.assign(S, { aLx: -.3, aRx: -.3, aLz: .26, aRz: .26, aLe: -.35, aRe: -.35 });
        const legH = (a0, a1) => D.lt * Math.cos(a0) + D.ls * Math.cos(a0 + a1);
        const H = D.H = D.float ? D.float + D.robe : legH(S.L0, S.L1) + D.foot;
        const bark = barkMat(c.bark, c.dark, true), barkC = barkMat(c.bark, c.dark, false), dark = flatMat(c.dark);
        const skin = st === 'wrath' ? mat(c.face, { roughness: .75 }) : null;
        const mossC = st === 'folk' ? barkMat(c.bark, c.dark, false, new THREE.Color(c.moss).multiplyScalar(.75).getHex(), .45) : barkC;             // moss grown over the upper trunk
        this.mats = { bark, barkC, dark, skin, mossC };
        J.body = this.grp(this.root, 0, H, 0);
        J.legs = [];
        if (!D.float) for (const s of [1, -1]) {
            const top = this.grp(J.body, s * D.hip, 0, 0);
            const thigh = trunkGeo(`${st}Thigh`, { h: D.lt + .12, prof: profile([[0, .78], [.2, 1.1], [.6, .95], [1, .85]]), ridges: 5, ramp: .18, twist: 2, lump: .08, seed: 3, radial: 9, hseg: 5 });
            this.add(top, thigh, barkC, 0, .08, 0).scale.set(D.lr * 1.1, -1, D.lr);
            const knee = this.grp(top, 0, -D.lt, 0);
            this.add(knee, blobGeo(q3(D.lr * .95), 1, .2, s + 4), barkC).scale.set(1, .9, 1);
            const shin = trunkGeo(`${st}Shin`, { h: D.ls + .03, prof: profile([[0, .95], [.4, .82], [.85, .8], [1, 1.05]]), ridges: 6, ramp: .2, twist: -2, lump: .07, seed: 5, radial: 9, hseg: 5 });
            this.add(knee, shin, barkC, 0, 0, 0).scale.set(D.lr * .85, -1, D.lr * .8);
            const foot = this.grp(knee, 0, -D.ls, 0);
            for (const a of [-1.1, -.45, .1, .7, Math.PI - .3]) {                             // root toes spread on the ground
                const len = D.lr * (a > 2 ? 2 : 3.2), sx = Math.sin(a), sz = Math.cos(a);
                this.tube(foot, [[0, .02, 0], [sx * len * .4, -D.foot * .55, sz * len * .4], [sx * len, -D.foot + D.lr * .15, sz * len], [sx * len * 1.2, -D.foot + D.lr * .12, sz * len * 1.2]], D.lr * .55, D.lr * .1, bark, 8, 5);
            }
            J.legs.push({ top, knee, foot, s });
        }
        // torso: one organic trunk (hips → shoulders), the phantom's hides under its robe
        J.torso = this.grp(J.body);
        const M0 = k => k === 'folk' ? mossC : barkC;
        if (st === 'phantom') this.add(J.torso, blobGeo(q3(D.tr * .95), 1, .15, 2), barkC, 0, 0, 0).scale.set(1.25, .8, .9);
        else {
            const prof = {
                evil: [[0, .8], [.25, .78], [.55, .92], [.8, 1.12], [.93, 1.05], [1, .45]],
                folk: [[0, .85], [.25, .9], [.55, .92], [.85, 1.02], [1, .92]],
                wrath: [[0, .92], [.18, 1], [.45, .74], [.68, .9], [.8, 1.0], [.9, .92], [1, .4]]
            }[st];
            const geo = trunkGeo(st + 'Torso', { h: D.tor * (st === 'folk' ? .98 : 1.12), prof: profile(prof), sx: st === 'wrath' ? 1.3 : 1.32, sz: .85,
                twist: st === 'wrath' ? 0 : 2.5, ridges: st === 'wrath' ? 0 : 7, ramp: .14, lump: st === 'wrath' ? .03 : .07, seed: 2, radial: 16, hseg: 12, open: st === 'folk' });
            this.add(J.torso, geo, st === 'wrath' ? skin : M0(st), 0, -D.tr * .45, 0).scale.set(D.tr, 1, D.tr);
            if (st === 'wrath') for (const s of [1, -1]) this.add(J.torso, G.sph(q3(D.tr * .36), 10, 8), skin, s * D.tr * .42, D.tor * .66, D.tr * .55).scale.set(1, .9, .8);
        }
        // arms: thick branch limbs (bony for the phantom)
        J.arms = [];
        for (const s of [1, -1]) {
            const sh = this.grp(J.torso, s * D.tr * 1.2, D.tor * .86, 0);
            const [ua, fa] = D.arm, bone = st === 'phantom';
            const limb = bone ? mat(c.bone, { roughness: .6 }) : st === 'wrath' ? skin : bark;
            this.add(sh, blobGeo(q3(D.ar * 1.7), 1, .2, 7 + s), bone ? flatMat(c.moss) : st === 'wrath' ? skin : barkC);
            if (bone) this.tube(sh, [[0, 0, 0], [s * .02, -ua * .5, -.02], [0, -ua, 0]], D.ar * 1.1, D.ar * .85, limb, 6, 7);
            else this.add(sh, trunkGeo(`${st}Upper`, { h: ua, prof: profile([[0, 1.15], [.5, .95], [1, .82]]), ridges: st === 'wrath' ? 0 : 5, ramp: .2, twist: 2, lump: .08, seed: 7, radial: 8, hseg: 5 }), limb).scale.set(D.ar, -1, D.ar);
            const el = this.grp(sh, 0, -ua, 0);
            this.add(el, G.sph(q3(D.ar * 1.0), 7, 5), bone || st === 'wrath' ? limb : barkC);
            let fm = limb;
            if (st === 'wrath') fm = mat(0x3a5a2a, { roughness: .6, emissive: c.glow, emissiveIntensity: .7 });
            if (bone || st === 'wrath') this.tube(el, [[0, 0, 0], [0, -fa * .5, .03], [0, -fa, 0]], D.ar * .85, D.ar * .6, fm, 6, 7);
            else this.add(el, trunkGeo(`${st}Fore`, { h: fa, prof: profile([[0, .9], [.4, .8], [1, .72]]), ridges: 5, ramp: .2, twist: -2, lump: .08, seed: 9, radial: 8, hseg: 5 }), fm).scale.set(D.ar, -1, D.ar);
            const hand = this.grp(el, 0, -fa, 0);
            this.add(hand, blobGeo(q3(D.ar * 1.0), 0, .2, 9), bone ? limb : st === 'wrath' ? skin : barkC).scale.set(1.25, 1.3, .8);
            const fingers = [];
            for (let f = 0; f < 4; f++) {
                const fg = this.grp(hand, (f - 1.5) * D.ar * .5, -D.ar * .8, f === 0 || f === 3 ? 0 : D.ar * .2);
                fg.rotation.z = (f - 1.5) * .25;
                const l = D.fl * (f === 1 || f === 2 ? 1 : .8);
                this.tube(fg, [[0, 0, 0], [0, -l * .5, l * .15], [0, -l, l * .4]], D.ar * .34, D.ar * .05, bone || st === 'wrath' ? limb : bark, 6, 5);
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
            this.P.A1 = P({ ry: .6, aRx: .1, aRz: 1.25, aRe: -.4, aLx: -.4, aLz: .3, headY: -.3, L1: .3, by: legH(S.L0, .3) + D.foot - H, jaw: .4, fing: -.2 });
            this.P.A2 = P({ ry: -.65, tx: .2, aRx: -1.5, aRz: .45, aRe: -.1, aLx: .3, aLz: .4, headY: .25, L1: .35, by: legH(S.L0, .35) + D.foot - H, jaw: .7, bz: .08, fing: .9 });
            this.P.A3 = P({ ry: -.5, tx: .15, aRx: -1.15, aRz: .1, aRe: -.4, aLx: .2, jaw: .2, fing: 1 });
        }
        this.P.DEF = P({ aLx: -1.5, aRx: -1.5, aLz: -.3, aRz: -.3, aLe: -1.25, aRe: -1.25, tx: .15, headX: .25, L0: -.3, L1: .6, by: D.float ? -.05 : crouch, fing: 1, jaw: .5 });
        if (st === 'folk') for (const k of ['A1', 'A2', 'A3']) this.P[k].aLe = Math.min(this.P[k].aLe, -.75);   // free hand kept off the ground
        this.P.HIT = P({ tx: -.25, bx: -.06, aLz: .7, aRz: .7, aLx: .35, aRx: .35, headX: -.3, jaw: .5, L1: .25, shake: 1 });
        const longArms = st === 'evil' || st === 'folk';                                         // long branch arms rest bent forward
        this.P.KNEEL = P({ L0: 0, L1: 1.57, by: D.float ? -.35 : D.lt + D.lr * .8 - H, bx: .05, tx: .3, headX: .3, aLx: longArms ? -1.2 : -1.0, aRx: longArms ? -1.2 : -1.0, aLe: -.5, aRe: -.5, aLz: longArms ? .35 : .25, aRz: longArms ? .35 : .25, fing: .5 });
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
        H.position.set(0, h * .55, D.tr * .78);                                               // sunk between the shoulders
        this.add(H, trunkGeo('evilHead', { h: h * 2.3, prof: profile([[0, .95], [.35, 1.05], [.75, .9], [1, .35]]), sz: .74, ridges: 6, ramp: .22, twist: 2, lump: .12, seed: 4, radial: 12, hseg: 6 }), M.barkC, 0, -h * .9, 0).scale.set(h, 1, h);
        const hole = mat(0x080604, { roughness: .9 });
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .27, 8, 6), hole, s * h * .38, h * .3, h * .66).scale.set(1, .75, .6);
            this.eyeGlow(H, c.eye, s * h * .38, h * .3, h * .8, h * .075, 4);
            this.add(H, G.cone(h * .14, h * .7, 4), M.barkC, s * h * .55, h * .62, h * .55).rotation.set(-.5, 0, -s * 1.0);
        }
        this.add(H, G.sph(h * .5, 10, 8), hole, 0, -h * .38, h * .6).scale.set(1, .6, .5);   // dark maw cavity
        J.jaw = this.grp(H, 0, -h * .5, h * .55);
        this.add(J.jaw, G.box(h * 1.1, h * .25, h * .6), M.barkC, 0, -h * .14, h * .1);
        for (let i = 0; i < 6; i++) {
            this.add(J.jaw, G.cone(h * .055, h * .32, 4), M.barkC, (i - 2.5) * h * .17, h * .08, h * .34);
            this.add(H, G.cone(h * .055, h * .36, 4), M.barkC, (i - 2.5) * h * .17, -h * .48, h * .9).rotation.x = Math.PI;
        }
        // huge dead crown of spiky branches rising from the shoulders and back
        const tr = D.tr, T = D.tor;
        const geo = this.branches('evilCrown', [
            [[tr * 1.15, -.05, -.05], [.8, 1, -.25], 1.05, .13, 3], [[-tr * 1.15, -.05, -.05], [-.8, 1, -.25], 1.05, .13, 3],
            [[tr * .55, .05, -.2], [.3, 1, -.5], 1.2, .14, 3], [[-tr * .55, .05, -.2], [-.35, 1, -.45], 1.2, .14, 3],
            [[0, .1, -.25], [.05, 1, -.35], 1.25, .15, 3], [[tr * 1.25, -.2, -.1], [1, .35, -.3], .85, .1, 2], [[-tr * 1.25, -.2, -.1], [-1, .35, -.3], .85, .1, 2],
            [[tr * .3, -.1, -tr * .7], [.4, .7, -1], .8, .09, 2], [[-tr * .3, -.1, -tr * .7], [-.4, .7, -1], .8, .09, 2]
        ], 21);
        this.add(J.crown, geo, M.bark);
        for (const A of J.arms) {                                                             // snags along the arms
            const g = this.branches('evilArm' + A.s, [[[A.s * D.ar, -.15, 0], [A.s, .6, -.3], .5, .06, 2], [[A.s * D.ar * .5, -.5, -.05], [A.s * .6, .3, -.8], .4, .05, 1]], 30 + A.s);
            this.add(A.sh, g, M.bark);
            const f = this.branches('evilFore' + A.s, [[[A.s * D.ar * .8, -.25, 0], [A.s, .2, .3], .4, .045, 1], [[0, -.55, -D.ar * .8], [A.s * .3, .2, -1], .3, .035, 1]], 40 + A.s);
            this.add(A.el, f, M.bark);
        }
        this.add(J.torso, this.branches('evilRibs', [[[.2, T * .45, D.tr * .7], [.6, .4, 1], .4, .05, 1], [[-.22, T * .55, D.tr * .72], [-.6, .5, 1], .38, .05, 1], [[0, T * .25, -D.tr * .8], [.2, .6, -1], .5, .06, 1],
            [[D.tr * 1.1, T * .3, 0], [1, .3, .1], .4, .05, 1], [[-D.tr * 1.1, T * .35, 0], [-1, .2, -.1], .4, .05, 1]], 50), M.bark);
    }

    head_folk(c, D) {
        const J = this.j, M = this.mats, H = J.head, h = D.head, moss = mat(new THREE.Color(c.moss).multiplyScalar(.6), { roughness: .95 }), face = mat(c.face, { roughness: .85 });
        const tr = D.tr, base = -(h * .7 + D.tor * .1) - .12;
        // the head is the upper trunk itself: face carved in front, broken top with a few branches
        this.add(H, trunkGeo('folkHead', { h: h * 2.6 + .12, prof: profile([[0, .92], [.45, .86], [.8, .78], [.92, .6], [1, .2]]), sx: 1.25, sz: .85, ridges: 7, ramp: .14, twist: 2.5, lump: .07, seed: 6, radial: 14, hseg: 8 }), M.mossC, 0, base, 0).scale.set(tr, 1, tr);
        const fz = tr * .74;
        this.add(H, G.sph(h * .62, 12, 10), face, 0, -h * .05, fz - h * .3).scale.set(1.05, 1.2, .58);
        this.add(H, taperTube([[-h * .55, -h * .05, -h * .05], [0, h * .1, h * .1], [h * .55, -h * .05, -h * .05]], h * .13, h * .13, 8, 6), face, 0, h * .3, fz);
        this.add(H, G.cone(h * .11, h * .32, 5), face, 0, h * .02, fz + h * .12).rotation.x = Math.PI / 2 + .35;
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .13, 8, 6), mat(0x140c06), s * h * .26, h * .14, fz + h * .02);
            this.eyeGlow(H, c.eye, s * h * .26, h * .14, fz + h * .1, h * .05, 0);
            this.add(H, G.sph(h * .16, 8, 6), face, s * h * .32, -h * .2, fz - h * .02).scale.set(1, .8, .7);   // grinning cheeks
        }
        J.jaw = this.grp(H, 0, -h * .32, fz);
        this.add(J.jaw, taperTube([[-h * .36, h * .1, -h * .06], [0, -h * .04, h * .05], [h * .36, h * .1, -h * .06]], h * .09, h * .09, 8, 5), mat(0x1a0e06), 0, 0, 0);
        for (let i = 0; i < 7; i++) this.add(J.jaw, G.box(h * .075, h * .09, h * .04), mat(0xc8b890), (i - 3) * h * .09, h * .06 - Math.abs(i - 3) * h * .03 + h * .03, h * .07 - Math.abs(i - 3) * h * .02);
        const top = base + h * 2.6 + .12;
        this.add(H, mergedGeo('folkSplinters', () => {                                  // broken trunk top
            const parts = [], r = rnd(14);
            for (let i = 0; i < 9; i++) {
                const a = i / 9 * TAU, L = h * (.3 + r() * .7);
                parts.push([new THREE.ConeGeometry(h * .12, L, 4).translate(0, L / 2, 0), along([Math.sin(a) * tr * .45, top - h * .4, Math.cos(a) * tr * .3], [Math.sin(a) * .25, 1, Math.cos(a) * .2])]);
            }
            return parts;
        }), M.barkC);
        this.add(H, this.branches('folkCrown', [
            [[tr * .2, top - h * .5, -h * .1], [.25, 1, -.2], .8, .1, 2], [[tr * .5, top - h * .9, 0], [1, .8, .1], .6, .07, 1], [[-tr * .5, top - h * .8, -.05], [-1, .9, -.2], .65, .07, 1]
        ], 13), M.bark);
        this.add(H, blobGeo(h * .8, 2, .25, 7), moss, -tr * .3, top - h * .55, -tr * .1).scale.set(1.1, .45, 1);
        // moss blankets on the shoulders and moss beards hanging from them and from the head
        for (const s of [1, -1]) this.add(J.torso, blobGeo(q3(tr * .62), 2, .25, 8 + s), moss, s * tr * 1.0, D.tor * .9, -.02).scale.set(1.3, .45, 1.1);
        const items = [], r = rnd(19);
        for (let i = 0; i < 26; i++) {
            const s = i % 2 ? 1 : -1, a = (r() - .5) * 2.4, x = s * tr * (.7 + r() * .65), z = Math.cos(a) * tr * .8;
            items.push([x, D.tor * .9, z, .25 + r() * .45, Math.atan2(x, z)]);
        }
        this.add(J.torso, strandGeo('folkMoss', items, .045, .12), moss);
        const hi = [];
        for (let i = 0; i < 10; i++) { const a = (i / 9 - .5) * 2.6; hi.push([Math.sin(a) * tr * 1.1, top - h * .7, Math.cos(a) * tr * .78 - .02, .2 + (i % 3) * .12, a]); }
        this.add(H, strandGeo('folkMossH', hi.filter(it => Math.abs(it[0]) > tr * .5), .04, .1), moss);
        const lr = rnd(17), leafItems = [];
        for (let i = 0; i < 30; i++) {
            const a = lr() * TAU;
            leafItems.push({ p: [Math.sin(a) * .25, top + lr() * .25 - h * .1, Math.cos(a) * .2 - .05], n: [Math.sin(a), .6, Math.cos(a)], spin: lr() * 6, s: .8 + lr() * .5, color: [c.leaf, 0x7aa040, 0x3e6a20][i % 3] });
        }
        this.leaves(H, leafGeo(.16, .07), mat(0xffffff, { roughness: .85, side: THREE.DoubleSide }), leafItems);
        J.vines = [];
        for (let i = 0; i < 4; i++) J.vines.push(this.chain(J.torso, { n: 4, len: .45, r0: .014, r1: .006, m: moss, x: (i - 1.5) * .2, y: D.tor * .75, z: tr * .85, a: 0, tilt: Math.PI - .2, radial: 4 }));
    }

    head_wrath(c, D) {
        const J = this.j, M = this.mats, H = J.head, h = D.head, face = M.skin;
        const hair = mat(c.hair, { roughness: .9 }), moss = flatMat(c.moss), leafM = mat(0xffffff, { roughness: .85, side: THREE.DoubleSide });
        this.add(H, G.sph(h * .8, 12, 10), face, 0, 0, h * .05).scale.set(.82, 1.1, .95);
        this.add(H, G.cone(h * .1, h * .25, 5), face, 0, -h * .05, h * .78).rotation.x = Math.PI / 2 + .3;
        for (const s of [1, -1]) this.eyeGlow(H, c.eye, s * h * .27, h * .1, h * .68, h * .07, 6);
        J.jaw = this.grp(H, 0, -h * .45, h * .45);
        this.add(J.jaw, G.box(h * .35, h * .06, h * .1), mat(0x0a1a08), 0, 0, 0);
        this.add(H, this.branches('wrathAntlers', [[[h * .4, h * .6, -h * .1], [1.1, .8, -.15], .48, .07, 3], [[-h * .4, h * .6, -h * .1], [-1.1, .8, -.15], .48, .07, 3], [[h * .2, h * .8, -h * .2], [.3, 1, -.4], .35, .05, 2], [[-h * .2, h * .8, -h * .2], [-.3, 1, -.4], .35, .05, 2]], 34), M.bark);
        // wild mane down over the shoulders and back
        this.add(H, mergedGeo('wrathHair', () => {
            const parts = [], r = rnd(4);
            for (let i = 0; i < 30; i++) {
                const a = (i / 29 - .5) * 4.2, x = Math.sin(a) * h * .75, z = Math.cos(a) * h * .55 - h * .2, L = .6 + r() * .55, o = 1.6 + r() * .6;
                parts.push([taperTube([[x, h * .6, z], [x * o, h * .1, z - h * .3], [x * (o + .2) + (r() - .5) * .12, -L * .55, z - h * .5 + Math.cos(a) * h * .3], [x * (o + .1), -L, z - h * .4 + (r() - .5) * .15]], h * .17, h * .04, 8, 4), null]);
            }
            return parts;
        }), hair);
        // vines and leaves wound around the body
        this.add(J.torso, mergedGeo('wrathVines', () => {
            const parts = [];
            for (let k = 0; k < 4; k++) {
                const pts = [];
                for (let i = 0; i <= 10; i++) {
                    const y = -D.tr * .3 + i / 10 * D.tor * .95, a = k * TAU / 4 + i * .9, rad = D.tr * (1.05 - .25 * Math.sin(i / 10 * Math.PI * 1.2));
                    pts.push([Math.sin(a) * rad * 1.3, y, Math.cos(a) * rad * .9]);
                }
                parts.push([taperTube(pts, .025, .015, 30, 5), null]);
            }
            return parts;
        }), mat(0x2e4a1e, { roughness: .9 }));
        const r = rnd(9), items = [];
        for (let i = 0; i < 60; i++) {
            const a = r() * TAU, y = r() * D.tor * .8 - D.tr * .2, rad = D.tr * (1.0 + r() * .15);
            items.push({ p: [Math.sin(a) * rad * 1.3, y, Math.cos(a) * rad * .9], n: [Math.sin(a), .3, Math.cos(a)], spin: r() * 6, s: .7 + r() * .5, color: [0x3a6a24, 0x4e7a30, 0x23401a][i % 3] });
        }
        this.leaves(J.torso, leafGeo(.13, .06), leafM, items);
        // wide skirt of vines, leaves and roots spreading on the ground
        J.skirt = this.grp(J.body);
        const skirtH = D.H - .05, sk = skirtH * .7, R0 = D.tr * 1.3, R1 = .95;
        this.add(J.skirt, cached('wrathSkirt', () => {
            const g = new THREE.CylinderGeometry(R0, R1, sk, 18, 5, true), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const u = .5 - v.y / sk, a = Math.atan2(v.x, v.z);
                const k = (1 + .16 * Math.sin(a * 7) * u + .08 * Math.sin(a * 13 + u * 5)) * (1 - .25 * Math.sin(u * Math.PI) * (1 - u));
                p.setXYZ(i, v.x * k, v.y + (u > .99 ? Math.sin(a * 9) * .05 : 0), v.z * k);
            }
            g.translate(0, -sk / 2 + .1, 0);
            g.computeVertexNormals();
            return g;
        }), mat(0xffffff, { map: barkTex(0x22341a, 0x0e180a, false, 0x34521e, .7), roughness: .95, side: THREE.DoubleSide }));
        this.add(J.skirt, mergedGeo('wrathStrands', () => {
            const parts = [], rr = rnd(12);
            for (let i = 0; i < 28; i++) {
                const a = i / 28 * TAU + rr() * .2, r0 = R1 * .8 + rr() * .1, y0 = -sk * .75, R = R1 + rr() * .12, b = a + (rr() - .5) * .5;
                parts.push([taperTube([[Math.sin(a) * r0, y0, Math.cos(a) * r0], [Math.sin(a) * R, -skirtH * .9, Math.cos(a) * R], [Math.sin(b) * (R + .12), -skirtH + .04, Math.cos(b) * (R + .12)], [Math.sin(b + .2) * (R + .2), -skirtH + .05, Math.cos(b + .2) * (R + .2)]], .05, .012, 8, 4), null]);
            }
            for (let i = 0; i < 16; i++) {                                                     // vines hanging over the skirt
                const a = i / 16 * TAU + .1, L = sk * (.4 + rr() * .5);
                parts.push([taperTube([[Math.sin(a) * R0 * 1.05, .05, Math.cos(a) * R0 * 1.05], [Math.sin(a) * (R0 + (R1 - R0) * .5 + .06), -L * .5, Math.cos(a) * (R0 + (R1 - R0) * .5 + .06)], [Math.sin(a) * (R0 + (R1 - R0) * L / sk + .05), -L, Math.cos(a) * (R0 + (R1 - R0) * L / sk + .05)]], .025, .01, 6, 4), null]);
            }
            return parts;
        }), mat(0x2e4a1e, { roughness: .9 }));
        this.leaves(J.skirt, leafGeo(.17, .08), leafM, Array.from({ length: 90 }, (_, i) => {
            const a = r() * TAU, u = r(), y = .1 - u * sk, rad = (R0 + (R1 - R0) * u) * (1 - .25 * Math.sin(u * Math.PI) * (1 - u)) + .03;
            return { p: [Math.sin(a) * rad, y, Math.cos(a) * rad], n: [Math.sin(a), -.1, Math.cos(a)], spin: Math.PI + (r() - .5), s: .8 + r() * .6, color: [0x3a6a24, 0x4e7a30, 0x23401a, 0x2e5420][i % 4] };
        }));
        this.add(J.torso, blobGeo(q3(D.tr * .7), 1, .3, 3), moss, D.tr * .9, D.tor * .9, 0).scale.set(1.2, .5, 1);
    }

    head_phantom(c, D) {
        const J = this.j, H = J.head, h = D.head, bone = mat(c.bone, { roughness: .6 }), socket = mat(0x060806, { roughness: .9 });
        const robeTex = canvasTex(`robe${c.moss}`, g => {                                     // shaggy moss: vertical streaks
            g.fillStyle = hex(c.moss);
            g.fillRect(0, 0, 128, 128);
            const r = rnd(8), m = new THREE.Color(c.moss);
            for (let i = 0; i < 90; i++) {
                const col = m.clone().offsetHSL((r() - .5) * .06, (r() - .5) * .2, (r() - .55) * .22);
                g.strokeStyle = '#' + col.getHexString();
                g.lineWidth = 1 + r() * 4;
                const x = r() * 128, y = r() * 128, L = 20 + r() * 60;
                g.beginPath();
                g.moveTo(x, y);
                g.quadraticCurveTo(x + (r() - .5) * 8, y + L * .5, x + (r() - .5) * 6, y + L);
                g.stroke();
            }
        }, [3, 1]);
        const moss = mat(robeTex ? 0xffffff : c.moss, { map: robeTex, roughness: .95, side: THREE.DoubleSide });
        // skull: cranium, cheek bones, deep sockets, upper teeth; bony spike crown
        this.add(H, G.sph(h * .72, 12, 10), bone, 0, h * .18, -h * .12).scale.set(.85, .95, 1.15);
        this.add(H, G.sph(h * .48, 10, 8), bone, 0, -h * .18, h * .22).scale.set(.95, .85, 1);
        for (const s of [1, -1]) {
            this.add(H, G.sph(h * .18, 8, 6), bone, s * h * .36, -h * .1, h * .36).scale.set(1, .65, 1.1);
            this.add(H, G.sph(h * .2, 8, 6), socket, s * h * .2, h * .06, h * .52).scale.set(1.1, .8, .55);
            this.add(H, G.box(h * .3, h * .07, h * .12), bone, s * h * .2, h * .2, h * .56).rotation.z = s * .35;   // frowning brow ridge
            this.eyeGlow(H, c.eye, s * h * .2, h * .06, h * .6, h * .075, 10);
        }
        this.add(H, G.cone(h * .08, h * .14, 3), socket, 0, -h * .14, h * .66).rotation.x = Math.PI;
        J.jaw = this.grp(H, 0, -h * .48, h * .1);
        this.add(J.jaw, G.box(h * .62, h * .12, h * .55), bone, 0, -h * .02, h * .2);
        for (let i = 0; i < 6; i++) {
            this.add(J.jaw, G.cone(h * .035, h * .14, 4), bone, (i - 2.5) * h * .09, h * .08, h * .44);
            this.add(H, G.cone(h * .035, h * .16, 4), bone, (i - 2.5) * h * .09, -h * .44, h * .55).rotation.x = Math.PI;
        }
        this.add(H, mergedGeo('phantomCrown', () => {
            const parts = [];
            for (let i = 0; i < 11; i++) {
                const a = (i / 10 - .5) * 2.8, d = [Math.sin(a) * .8, 1, -.5 + Math.cos(a) * .2];
                parts.push([new THREE.ConeGeometry(h * .07, h * (.7 + (i % 3) * .3), 4).translate(0, h * .35, 0), along([Math.sin(a) * h * .55, h * .6, Math.cos(a) * h * .3 - h * .25], d)]);
            }
            return parts;
        }), bone);
        // shaggy moss mantle over the shoulders, robe of moss down to the ground, tattered translucent hem
        this.add(J.torso, blobGeo(q3(D.tr * 1.6), 1, .25, 6), moss, 0, D.tor * .82, -D.tr * .1).scale.set(1.35, .6, 1.1);
        const mi = [], r = rnd(23);
        for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; mi.push([Math.sin(a) * D.tr * 1.9, D.tor * .8, Math.cos(a) * D.tr * 1.5 - D.tr * .1, .25 + r() * .35, a]); }
        this.add(J.torso, strandGeo('phantomMantle', mi, .05, .2), moss);
        J.robe = this.grp(J.body, 0, D.tor, 0);                                        // hangs from the shoulders
        const R0 = this.grp(J.robe, 0, -D.tor, 0);
        const robeH = D.tor + D.robe;
        const radAt = y => {                                                                 // robe radius at height y (R0 space)
            const u = (D.tor - y) / robeH;
            return D.tr * 1.35 + (.42 - D.tr * 1.35) * u;
        };
        this.add(R0, cached('phantomRobe', () => {
            const g = new THREE.CylinderGeometry(D.tr * 1.35, .42, robeH, 16, 4, true), p = g.attributes.position, v = new THREE.Vector3();
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i);
                const a = Math.atan2(v.x, v.z), k = 1 + .12 * Math.sin(a * 5) + .08 * Math.sin(a * 11 + v.y * 4);
                p.setXYZ(i, v.x * k, v.y + (v.y < -robeH / 2 + .01 ? Math.sin(a * 9) * .06 : 0), v.z * k);
            }
            g.translate(0, D.tor - robeH / 2, 0);
            g.computeVertexNormals();
            return g;
        }), moss);
        const si = [];
        for (const [y, n, L] of [[D.tor * .55, 16, .32], [D.tor * .05, 18, .4], [-D.tor * .5, 20, .42]]) {
            for (let i = 0; i < n; i++) { const a = (i + (y > 0 ? .5 : 0)) / n * TAU; si.push([Math.sin(a) * radAt(y) * 1.06, y, Math.cos(a) * radAt(y) * 1.06, L * (.7 + r() * .5), a]); }
        }
        this.add(R0, strandGeo('phantomShag', si, .055, .12), moss);
        this.ghostM = new THREE.MeshStandardMaterial({ color: c.moss, roughness: 1, transparent: true, opacity: .55, emissive: 0x2a4a3a, emissiveIntensity: .5, side: THREE.DoubleSide, depthWrite: false });
        J.tatters = [];
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU, r0 = .42;
            const ch = this.chain(R0, { n: 3, len: .3, r0: .05, r1: .015, m: this.ghostM, x: Math.sin(a) * r0, y: D.tor - robeH + .06, z: Math.cos(a) * r0, a, tilt: Math.PI - .15, radial: 4 });
            ch.segs.forEach(s => { s.children[0].castShadow = false; s.children[0].scale.set(1.8, 1, .4); });
            J.tatters.push(ch);
        }
        for (const A of J.arms) {                                                             // ragged moss sleeves over the bony arms
            this.add(A.sh, G.cyl(D.ar * 2.6, D.ar * 3.4, D.arm[0] * .7, 7, true), moss, 0, -D.arm[0] * .35, 0);
            const sl = [];
            for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; sl.push([Math.sin(a) * D.ar * 3.2, -D.arm[0] * .6, Math.cos(a) * D.ar * 3.2, .12 + (i % 3) * .06, a]); }
            this.add(A.sh, strandGeo('phantomSleeve', sl, .03, .1), moss);
        }
        // glaive with a big crescent blade in the right hand
        const metal = mat(c.metal, { roughness: .35, metalness: .7 }), shaft = mat(0x2a2016, { roughness: .8 });
        const R = J.arms.find(A => A.s < 0);
        J.glaive = this.grp(R.hand, 0, -D.ar * .8, 0);
        J.glaive.rotation.x = .45;
        const sg = this.add(J.glaive, G.cyl(.018, .018, 1.7, 6), shaft, 0, 0, 0);
        sg.rotation.x = Math.PI / 2;
        sg.position.z = .25;
        const blade = this.add(J.glaive, cached('glaiveBlade2', () => {
            const s = new THREE.Shape();
            s.moveTo(0, -.04);
            s.quadraticCurveTo(.34, .2, .26, .62);
            s.quadraticCurveTo(.2, .85, .02, 1.0);
            s.quadraticCurveTo(.14, .55, .04, .3);
            s.quadraticCurveTo(-.02, .12, -.06, -.04);
            return new THREE.ShapeGeometry(s, 8);
        }), mat(0xc0c0b8, { roughness: .28, metalness: .8, side: THREE.DoubleSide }), 0, -.02, 1.05);
        blade.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));   // blade in the swing plane
        this.add(J.glaive, G.cyl(.03, .03, .08, 6), metal, 0, 0, 1.08).rotation.x = Math.PI / 2;
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
        const hunch = D.hunch * (1 - q.droop);
        J.torso.rotation.set(q.tx + breath + hunch, -Math.sin(ph) * .08 * g, sh);
        for (const A of J.arms) {
            const p = ph + (A.s > 0 ? Math.PI : 0);
            const swing = (Math.sin(p) * (.35 + run * .2) * g + Math.sin(t * .9 + A.s) * .03) * (J.glaive && A.s < 0 ? .25 : 1);
            const ax = A.s > 0 ? q.aLx : q.aRx, az = A.s > 0 ? q.aLz : q.aRz, ae = A.s > 0 ? q.aLe : q.aRe;
            A.sh.rotation.set(ax + swing, 0, A.s * az);
            A.el.rotation.x = ae - Math.max(0, -swing) * .3;
            A.fingers.forEach((f, i) => { f.rotation.x = -q.fing * .9 - Math.sin(t * 1.3 + i) * .05; });
        }
        J.head.rotation.set(q.headX - hunch * .8 + Math.sin(t * .7) * .03, q.headY + this.look * .4 * q.eyes, 0);
        if (J.jaw) J.jaw.rotation.x = q.jaw * .45;
        J.crown.rotation.set(Math.sin(t * .6) * .02 + sh, 0, Math.sin(t * .5 + 1) * .025);
        if (J.vines) J.vines.forEach((v, i) => this.wave(v, Math.PI - .2 - q.tx, .03, .06, t, 1.4, .6, i));
        // skirt / robe: flattened and shortened so the hem stays above the ground when the body sinks or tilts
        const th = Math.abs(J.body.rotation.x), co = Math.cos(th);
        if (J.skirt) this.fitHang(J.skirt, J.body.position.y, D.H - .1, 1.25, th, Math.sin(ph) * .03 * g, Math.sin(t * .8) * .02);
        if (J.robe) {
            const tq = q.tx + hunch;
            J.robe.position.set(0, D.tor * Math.cos(tq), D.tor * Math.sin(tq) * .8);
            this.fitHang(J.robe, J.body.position.y + D.tor * co, D.tor + D.robe, .5, th, -.1 * g - tq * .25, Math.sin(t * .8) * .02);
            J.tatters.forEach((T, i) => this.wave(T, Math.PI - .15 - g * .5 * Math.max(0, T.w), .05, .12 + .1 * g, t, 2, .8, i * 1.3));
        }
        if (J.glaive) J.glaive.rotation.x = .45 + q.droop * q.droop * q.droop * 1.25 - g * .25;
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
