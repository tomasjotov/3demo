import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIRECTIONS } from '../utils/constants.js';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, damp } from './QuadrupedRig.js';
import { taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralAquatic — sea monsters placed on the land grid (there is no water surface), plus a few odd creatures
 * that have no other home. One facade class picks the body plan from the variant:
 *
 *   shark   Shark: counter-shaded body "swims" just above the ground (gentle up / down drift), spine chain with a
 *           travelling side wave, sweeping crescent tail, dorsal / pectoral fins, jaws with rows of teeth.
 *           attack: pulls back → lunges with the jaws wide open → bites and shakes; defend: arched threat display
 *           (nose up, pectorals down, body bent); kneel / lie: rests on the ground; death: rolls on its side.
 *   octopus octopuss-1 (giant octopus, brown with pale speckles), octopuss-2 (devil octopus, dark blue mantle with a
 *           copper net, copper arms), octopuss-3 (horror from the deep: fangs, glowing eyes, angry lids), kraken (10 spiked
 *           arms, long fish-like monster body with a spiny fin crest, wide toothy maw, glowing eyes, the biggest).
 *           One smooth skinned body (loft): head bone + mantle bone; the octopus rises from the arm skirt through the head
 *           with bulging eye sockets into a broad mantle sac tilted back. 8 / 10 skinned arms, mottled, sucker rows; every
 *           frame each arm is solved from a few numbers (root pitch, curl, tip curl, sideways wave with its own phase) and
 *           laid onto the ground where it would sink (the tips curl up off the ground in spirals).
 *           walk / run: arms crawl in alternating sets; attack: the front arms rise → lash forward and slam → coil
 *           around the prey → retract; defend: front arms raised as a wall, ink-dark colour flash, jaws open;
 *           death: the mantle sinks and flattens, arms go limp flat on the ground.
 *   klobg   lean sinewy green swamp creature (2 m+ when upright) crawling low on all fours: QuadrupedRig with long
 *           frog-like hind legs and very long clawed arms as fore legs, loft torso with ribs and spine ridge, scaly
 *           mottled skin texture, ghoul head with brow ridge, glowing eyes, fangs and long stringy hair.
 *           attack: rears and raises a claw → shoots its body-long tongue and rakes; defend: rears up, arms spread,
 *           roars; kneel: squats on the haunches; lie: flat on the belly, limbs splayed; death: rolls on its side.
 *   manyhead hulking black rat beast (product of mad magic) standing hunched on two rat legs: one massive furry
 *           pear-shaped body, five smooth rat heads (the big one in front of the chest, four around the shoulder hump),
 *           thin clawed arms, three naked tails on the ground. attack: the heads bite one after another, claws rake.
 *   illusion illusion-beast (translucent shimmering serpent dragon with glowing runes, horns, whiskers, mane wisps),
 *           illusion-beast-2 (same spell, other look: gold / rose, antlers, glowing frill fins along the neck).
 *           One skinned translucent body (rear chain on the ground + rising neck chain), runes scrolling along it,
 *           dorsal spines, eastern dragon head (long snout, brow ridges, hinged jaw, swept-back horns, cheek spurs);
 *           attack: draws the neck back → strikes; death: sinks flat and fades.
 *
 * All rigs: `root` (on the grid cell, y = 0 ground), `j` (joints, j.head always present), `update(c, dt)`;
 * states idle, walk, run, attack, defend, hit, kneel, lie, death blend through damped poses; facing as QuadrupedRig.
 */

export const AQUATIC_VARIANTS = {
    shark: { kind: 'shark', back: 0x4a6276, belly: 0xf0f2ee, fin: 0x41566a, scale: 1 },
    'octopuss-1': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x8a6448, spot: 0xd8b48a, arm: 0x7e5a40, under: 0xc49c7c, sucker: 0xd8b894,
        eye: 0xc8a050, pattern: 'spots', scale: 1 },
    'octopuss-2': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x2e4270, spot: 0xc07a44, arm: 0x8e4a32, under: 0xcc8c64, sucker: 0xf4d0a0,
        eye: 0xe8c040, pattern: 'cells', scale: 1.4 },
    'octopuss-3': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x3e5a8e, spot: 0x84c0d8, arm: 0x3e4a6a, under: 0xa06a52, sucker: 0xdc9c7a,
        eye: 0xffd050, glow: true, fangs: true, brow: true, pattern: 'scales', scale: 1.8 },
    kraken: { kind: 'octopus', arms: 10, seg: 16, len: 1.3, mantle: 0x26383a, spot: 0x4a6a66, arm: 0x283234, under: 0x7a5244, sucker: 0xc8866a,
        eye: 0x9af4ff, glow: true, fangs: true, brow: true, maw: true, crest: true, spikes: true, pattern: 'scales', scale: 2.3 },
    klobg: { kind: 'klobg', skin: 0x4a8a3a, dark: 0x22461c, belly: 0x9cc87a, hair: 0x5e6450, eye: 0xf0d040, claw: 0xd8d0b0, scale: 1 },
    manyhead: { kind: 'manyhead', fur: 0x2c2b30, light: 0x5c5a62, dark: 0x0e0e10, skin: 0xb48682, ear: 0xa84a48, eye: 0x2a0808, claw: 0xd8c8b0, scale: 1 },
    'illusion-beast': { kind: 'illusion', c1: 0x38d8d0, c2: 0x9a5cff, rune: 0xc0fff4, eye: 0x70fff0, horn: 0xe4d8ff, scale: 1 },
    'illusion-beast-2': { kind: 'illusion', c1: 0xffb040, c2: 0xff3a8a, rune: 0xfff0b8, eye: 0xffe070, horn: 0xfff2d8, frill: true, antler: true, scale: 1.1 }
};

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => smooth((x - a) / (b - a));

// ------------------------------------------------------------------ small helpers
const geoCache = new Map();
const cachedGeo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };

function add(parent, geo, m, x = 0, y = 0, z = 0, shadow = true) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = m.side !== THREE.DoubleSide;
    parent.add(mesh);
    return mesh;
}
function grp(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
}

// Vertex colours from a function of the (geometry space) position and normal.
const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
function paint(geo, fn) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i);
        _n.fromBufferAttribute(nor, i);
        fn(_c, _v, _n);
        arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}
const solid = hex => { const k = new THREE.Color(hex); return c => c.copy(k); };

// Unit sphere, dark back / light belly (counter-shading), soft line at y = split.
function twoTone(top, bottom, split = -.2) {
    return cachedGeo(`2t${top},${bottom},${split}`, () => {
        const A = new THREE.Color(top), B = new THREE.Color(bottom);
        return paint(new THREE.SphereGeometry(1, 18, 12), (c, p) => c.copy(B).lerp(A, sstep(split - .08, split + .08, p.y)));
    });
}

// Thin fin from a 2D outline drawn by `draw(shape)`; plane = 'side' (u → +z, v → +y) or 'flat' (u → +x, v → +z).
function finGeo(key, plane, draw, depth = .028) {
    return cachedGeo('fin' + key, () => {
        const s = new THREE.Shape();
        draw(s);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
        g.translate(0, 0, -depth / 2);
        if (plane === 'side') g.rotateY(-Math.PI / 2);
        else g.rotateX(Math.PI / 2);
        g.computeVertexNormals();
        return g;
    });
}

// Teeth along a U-shaped jaw line (one merged mesh): half width w, depth d, at height y, pointing down (dir -1) or up.
function teethGeo(n, w, d, z0, y, size, dir) {
    return cachedGeo(`teeth${n},${w},${d},${z0},${y},${size},${dir}`, () => {
        const parts = [];
        for (let i = 0; i < n; i++) {
            const f = -1.25 + 2.5 * i / (n - 1), sz = size * (1 - .35 * Math.abs(f) / 1.25);
            const g = new THREE.ConeGeometry(sz * .3, sz, 4);
            if (dir < 0) g.rotateX(Math.PI);
            g.translate(w * Math.sin(f), y + dir * sz * .5, z0 + d * Math.cos(f));
            parts.push(g);
        }
        return mergeGeometries(parts);
    });
}

// Small canvas skin patterns for the octopus mantles: spots (warts), cells (mottled net), scales.
const texCache = new Map();
function skinTex(kind, base, ink) {
    const key = kind + base + ink;
    if (texCache.has(key)) return texCache.get(key);
    let tex = null;
    if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 128;
        const g = cv.getContext('2d'), hex = c => '#' + new THREE.Color(c).getHexString();
        const dark = new THREE.Color(base).multiplyScalar(.6).getHex();
        g.fillStyle = hex(base);
        g.fillRect(0, 0, 128, 128);
        let seed = 11;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        if (kind === 'spots') {
            g.fillStyle = hex(dark); g.globalAlpha = .5;
            for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 0, TAU); g.fill(); }
            g.fillStyle = hex(ink); g.globalAlpha = .9;
            for (let i = 0; i < 55; i++) { g.beginPath(); g.arc(rnd() * 128, rnd() * 128, .8 + rnd() * 2.2, 0, TAU); g.fill(); }
        } else if (kind === 'cells') {                                                           // copper net over the dark skin
            for (let i = 0; i < 150; i++) {
                const x = rnd() * 128, y = rnd() * 128, r = 3 + rnd() * 5;
                g.fillStyle = hex(rnd() < .5 ? dark : base); g.globalAlpha = .5;
                g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                g.strokeStyle = hex(ink); g.globalAlpha = .55 + rnd() * .4; g.lineWidth = 1.2 + rnd() * 1.3;
                g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
            }
            g.globalAlpha = 1;
        } else {
            for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
                const x = col * 8 + (row % 2) * 4, y = row * 8;
                g.fillStyle = hex(rnd() < .5 ? ink : base); g.globalAlpha = .35 + rnd() * .35;
                g.beginPath(); g.arc(x, y, 5, 0, Math.PI); g.fill();
                g.globalAlpha = .8; g.strokeStyle = hex(dark); g.lineWidth = 1.2;
                g.beginPath(); g.arc(x, y, 5, 0, Math.PI); g.stroke();
            }
        }
        tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(key, tex);
    return tex;
}

// Skin weights by the coordinate s: bone i starts at boneS[i] (ascending), blended linearly into bone i + 1.
function weightAt(s, boneS, first, si, sw) {
    const n = boneS.length;
    let a = 0;
    while (a < n - 1 && s >= boneS[a + 1]) a++;
    const b = Math.min(a + 1, n - 1);
    const f = b === a ? 0 : clamp((s - boneS[a]) / (boneS[b] - boneS[a]), 0, 1);
    si.push(first + a, first + b, 0, 0);
    sw.push(1 - f, f, 0, 0);
}
function setSkin(geo, si, sw) {
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return geo;
}
function skinByZ(geo, sOf, boneS, first = 0) {
    const pos = geo.attributes.position, si = [], sw = [];
    for (let i = 0; i < pos.count; i++) weightAt(sOf(pos.getZ(i)), boneS, first, si, sw);
    return setSkin(geo, si, sw);
}
// Skinned mesh bound in the rest pose of `bones` (rootBone = top of the hierarchy, already holding the others).
function skinned(geo, material, rootBone, bones) {
    const m = new THREE.SkinnedMesh(geo, material);
    m.add(rootBone);
    m.updateMatrixWorld(true);
    m.bind(new THREE.Skeleton(bones));
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}
// Open tube along z (z0 → z1) with radii rx(z), ry(z); `rings` rows, colour from the unit circle position.
function profileTube(z0, z1, rings, radial, rFn, colFn) {
    const g = new THREE.CylinderGeometry(1, 1, z1 - z0, radial, rings, true).rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), r = [0, 0];
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        colFn(_c, y, z);
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
        rFn(z, r);
        pos.setXYZ(i, x * r[0], y * r[1], z);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
}
// Linear interpolation in a table [[s, a, b], …] (ascending s) → out [a, b].
function table(T, s, out) {
    if (s <= T[0][0]) { out[0] = T[0][1]; out[1] = T[0][2]; return out; }
    for (let i = 1; i < T.length; i++) if (s <= T[i][0]) {
        const f = (s - T[i - 1][0]) / (T[i][0] - T[i - 1][0]), k = f * f * (3 - 2 * f) * .5 + f * .5;
        out[0] = lerp(T[i - 1][1], T[i][1], k); out[1] = lerp(T[i - 1][2], T[i][2], k);
        return out;
    }
    const L = T[T.length - 1];
    out[0] = L[1]; out[1] = L[2];
    return out;
}

// Pitch-only chain on the ground: absolute pitch of each segment (positive = down), clamped so no segment end sinks
// below its radius. segs[0] carries the root yaw as well. bendFn(o, k) gives the wanted relative bend of segment k,
// sideFn(o, k) its sideways turn (o = the limb's own state object, so nothing is allocated per frame).
function solveChain(segs, y, pitch0, yaw0, len, radii, bendFn, sideFn, o) {
    let prev = 0, abs = 0;
    for (let k = 0; k < segs.length; k++) {
        abs = k === 0 ? pitch0 : prev + bendFn(o, k);
        const ymin = radii[k + 1] * 1.05 + .012;
        if (y - Math.sin(abs) * len < ymin) abs = Math.asin(clamp((y - ymin) / len, -1, 1));
        const s = segs[k];
        s.rotation.x = k === 0 ? abs : abs - prev;
        s.rotation.y = k === 0 ? yaw0 : sideFn(o, k);
        y -= Math.sin(abs) * len;
        prev = abs;
    }
}

// Smooth loft along a centre line in the yz plane: S = [[cy, cz, rx, ry], …] (Catmull-Rom between samples; give r = 0
// at both ends to close it). Ring angle a = 0 points to N = T × X ("top" of a body running along +z, "front" of a limb
// running down -y), x = sin(a) rx. opt: rings, radial, rmul(a, u) radial factor (bumps, ribs, bulges), col(c, a, u, v)
// vertex colour, skin(u, si, sw) skin weights; u runs 0 … S.length - 1 along the samples. UV = (a / TAU, u / (n - 1)).
function crPt(S, u, k) {
    const n = S.length, i = Math.min(Math.floor(u), n - 2), f = u - i;
    const p0 = S[Math.max(i - 1, 0)][k], p1 = S[i][k], p2 = S[i + 1][k], p3 = S[Math.min(i + 2, n - 1)][k];
    return .5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
}
function loftGeo(key, S, { rings = 24, radial = 12, rmul = null, col = null, skin = null } = {}) {
    return cachedGeo('loft' + key, () => {
        const n = S.length, pos = [], uv = [], cols = [], si = [], sw = [], idx = [];
        const v = new THREE.Vector3(), cc = new THREE.Color();
        for (let i = 0; i <= rings; i++) {
            const u = i / rings * (n - 1);
            const cy = crPt(S, u, 0), cz = crPt(S, u, 1);
            const rx = Math.max(0, crPt(S, u, 2)), ry = Math.max(0, crPt(S, u, 3));
            const ua = Math.max(0, u - .02), ub = Math.min(n - 1, u + .02);
            let ty = crPt(S, ub, 0) - crPt(S, ua, 0), tz = crPt(S, ub, 1) - crPt(S, ua, 1);
            const tl = Math.hypot(ty, tz) || 1;
            ty /= tl; tz /= tl;
            const ny = tz, nz = -ty;                                                             // N = T × X
            for (let j = 0; j <= radial; j++) {
                const a = j / radial * TAU, aw = a > Math.PI ? a - TAU : a;
                const m = rmul ? rmul(aw, u) : 1, sx = Math.sin(a) * rx * m, sn = Math.cos(a) * ry * m;
                v.set(sx, cy + ny * sn, cz + nz * sn);
                pos.push(v.x, v.y, v.z);
                uv.push(j / radial, u / (n - 1));
                if (col) { col(cc, aw, u, v); cols.push(cc.r, cc.g, cc.b); }
                if (skin) skin(u, si, sw);
            }
        }
        const R = radial + 1;
        for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
            const a = i * R + j, b = a + R;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setIndex(idx);
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        if (skin) setSkin(g, si, sw);
        g.computeVertexNormals();
        const nr = g.attributes.normal;                                                         // weld the seam normals
        for (let i = 0; i <= rings; i++) {
            const a = i * R, b = a + radial;
            v.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
            nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z);
        }
        return g;
    });
}
// Limb segment hanging down -y from its joint (0 → -len): radius r0 → r1, muscle bulge at `at` (0..1), flattened by fz.
function limbGeo(len, r0, r1, bulge = 0, at = .35, fz = 1, radial = 9) {
    const S = [];
    for (let i = 0; i <= 8; i++) {
        const t = i / 8, r = i === 0 || i === 8 ? 0 : lerp(r0, r1, t) * (1 + bulge * Math.exp(-(((t - at) / .2) ** 2)));
        const e = i === 0 ? -r0 * .45 : i === 8 ? len + r1 * .45 : t * len;
        S.push([-e, 0, r, r * fz]);
    }
    return loftGeo(`limb${len},${r0},${r1},${bulge},${at},${fz}`, S, { rings: 16, radial });
}

// Canvas skins: scaly swamp hide (klobg) and coarse fur strokes (manyhead).
function canvasTex(key, size, draw, rep = 1) {
    if (texCache.has(key)) return texCache.get(key);
    let tex = null;
    if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        let seed = 17;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        draw(cv.getContext('2d'), rnd, c => '#' + new THREE.Color(c).getHexString());
        tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(rep, rep);
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(key, tex);
    return tex;
}
const swampTex = (base, light, dark) => canvasTex(`swamp${base},${light},${dark}`, 128, (g, rnd, hex) => {
    g.fillStyle = hex(base); g.fillRect(0, 0, 128, 128);
    const blots = [];
    for (let i = 0; i < 18; i++) blots.push([rnd() * 128, rnd() * 128, 5 + rnd() * 13]);
    g.fillStyle = hex(light);
    for (let k = 1; k <= 4; k++) {                                                               // pale mottled patches (soft edged)
        const path = new Path2D();
        for (const [x, y, r0] of blots) { const r = r0 * (1.15 - k * .2); path.moveTo(x + r, y); path.arc(x, y, r, 0, TAU); }
        g.globalAlpha = .2; g.fill(path);
    }
    const arcs = new Path2D(), dots = new Path2D();                                              // small scales, batched
    for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
        const x = col * 8 + (row % 2) * 4, y = row * 8;
        arcs.moveTo(x + 4.5 * Math.cos(.15), y + 4.5 * Math.sin(.15)); arcs.arc(x, y, 4.5, .15, Math.PI - .15);
        if (rnd() < .18) { dots.moveTo(x + 2.4, y + 2); dots.arc(x, y + 2, 2.4, 0, TAU); }
    }
    g.strokeStyle = hex(dark); g.globalAlpha = .45; g.lineWidth = 1; g.stroke(arcs);
    g.fillStyle = hex(light); g.globalAlpha = .5; g.fill(dots);
    g.globalAlpha = 1;
}, 4);
const furTex = (base, light, dark) => canvasTex(`fur${base},${light},${dark}`, 128, (g, rnd, hex) => {
    g.fillStyle = hex(base); g.fillRect(0, 0, 128, 128);
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {                                                                // hair strokes along v, batched by tone
        const path = new Path2D();
        for (let i = 0; i < 150; i++) {
            const x = rnd() * 128, y = rnd() * 128, l = 3 + rnd() * 7;
            path.moveTo(x, y); path.lineTo(x + (rnd() - .5) * 2.5, y + l);
        }
        g.strokeStyle = hex(k % 2 ? light : dark); g.globalAlpha = .3 + k * .07; g.lineWidth = .7 + (k % 3) * .35;
        g.stroke(path);
    }
    g.globalAlpha = 1;
}, 2);

// Neutral mottling multiplied over the vertex coloured octopus arms (repeats along the arm).
const armMottle = () => {
    const t = canvasTex('armMottle', 64, (g, rnd) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
        for (let i = 0; i < 40; i++) {
            g.fillStyle = rnd() < .7 ? '#a8a29c' : '#fff4e0'; g.globalAlpha = .35 + rnd() * .4;
            g.beginPath(); g.ellipse(rnd() * 64, rnd() * 64, 1 + rnd() * 4, 1 + rnd() * 2.5, rnd() * 3, 0, TAU); g.fill();
        }
    });
    if (t) t.repeat.set(1, 6);
    return t;
};

// ------------------------------------------------------------------ shared base of the legless rigs
class SoftRig {
    initSoft(stand, scale) {
        this.STAND = stand;
        this.KEYS = Object.keys(stand);
        this.p = { ...stand };
        this.tmp = { ...stand };
        this.root = new THREE.Group();
        this.root.scale.setScalar(scale);
        this.size = scale;
        this.j = {};
        this.time = Math.random() * 50;
        this.state = null;
        this.stateTime = 0;
        this.yaw = null;
        this.gait = 0;
        this.phase = 0;
    }
    pose(over) { return { ...this.STAND, ...over }; }
    // o = A + (B - A) k into `o` (o may be A)
    mixTo(o, A, B, k) { for (const key of this.KEYS) o[key] = A[key] + (B[key] - A[key]) * k; return o; }
    copyTo(o, A) { for (const key of this.KEYS) o[key] = A[key]; return o; }
    attackP(c, dur) { return c.actionDuration ? 1 - c.actionTime / c.actionDuration : (this.stateTime / dur) % 1; }
    // wind-up (A1) → strike (A2) → recover (A3) → stand
    strike(p, t1 = .3, t2 = .5, t3 = .74) {
        const o = this.copyTo(this.tmp, this.STAND);
        this.mixTo(o, o, this.A1, smooth(p / t1));
        if (p > t1) this.mixTo(o, o, this.A2, smooth((p - t1) / (t2 - t1) * 1.4));
        if (p > t2) this.mixTo(o, o, this.A3, smooth((p - t2) / (t3 - t2)));
        if (p > t3) this.mixTo(o, o, this.STAND, smooth((p - t3) / (1 - t3)));
        return o;
    }
    // time, state, gait phase (stride in m per cycle at scale 1) and the damped pose
    advance(c, dt, walk, run) {
        this.time += dt;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;
        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 6, dt);
        if (target > 0) {
            const stride = (target === 2 ? run : walk) * this.size;
            const speed = (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) : 1);
            this.phase += dt * speed / stride * TAU;
        }
        const P = this.statePose(state, c, this.time);
        const k = state === 'attack' ? 26 : state === 'hit' ? 16 : state === 'death' ? 3 : state === 'lie' || state === 'kneel' ? 4 : 7;
        for (const key of this.KEYS) this.p[key] = damp(this.p[key], P[key], k, dt);
        return state;
    }
    face(c, dt) {
        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }
}

// ------------------------------------------------------------------ shark
// body half width / half height by distance behind the head joint (s = -z)
const SHARK_PROFILE = [[-1.0, .19, .17], [-.75, .25, .24], [-.5, .3, .3], [-.2, .33, .36], [.1, .33, .36], [.4, .3, .33], [.7, .25, .27], [1.0, .18, .2],
    [1.3, .115, .13], [1.55, .07, .085], [1.75, .05, .062], [1.9, .04, .05]];
class Shark extends SoftRig {
    constructor(c, scale) {
        super();
        this.c = c;
        this.H = .8;
        const S = { by: 0, bz: 0, bx: 0, roll: 0, head: 0, jaw: .03, amp: .2, freq: 4, bend: 0, pec: .32, fold: 0, float: 1 };
        this.initSoft(S, c.scale * scale);
        this.root.name = 'shark';
        const P = this.pose.bind(this), H = this.H;
        this.WALK = P({ amp: .3, freq: 7, bx: .03 });
        this.RUN = P({ amp: .36, freq: 11, bx: .06, by: -.06, pec: .2 });
        this.A1 = P({ bz: -.4, by: .06, bx: -.14, head: -.1, jaw: .45, amp: .1, freq: 5, pec: .5 });
        this.A2 = P({ bz: .8, by: -.08, bx: .1, head: -.28, jaw: .95, amp: .42, freq: 14, pec: .1 });
        this.A3 = P({ bz: .6, by: -.04, bx: .05, head: .08, jaw: .02, amp: .26, freq: 9 });
        this.DEFEND = P({ by: .16, bx: -.15, head: -.2, jaw: .35, amp: .08, freq: 3.5, bend: .3, pec: 1.0 });
        this.HIT = P({ bz: -.22, by: .06, roll: .35, bend: -.4, jaw: .32, amp: .1, freq: 8, head: -.1 });
        this.REST = P({ by: -(H - .42), amp: .12, freq: 2.4, pec: -.12, float: .15 });
        this.LIE = P({ by: -(H - .4), roll: .28, amp: .04, freq: 1.5, pec: -.35, fold: .4, float: 0 });
        this.DEAD = P({ by: -(H - .34), roll: 1.5, amp: 0, freq: 0, jaw: .45, pec: 0, fold: 1, bend: .12, float: 0 });
        this.swim = Math.random() * 10;
        this.build();
    }

    build() {
        const c = this.c, J = this.j;
        const skin = mat(0xffffff, { vertexColors: true, roughness: .45 });
        const fin = mat(c.fin, { roughness: .5, side: THREE.DoubleSide });
        const dark = mat(0x101418, { roughness: .4 }), mouth = mat(0x5a1c22, { roughness: .7 });
        const tooth = mat(0xf4f0e4, { roughness: .35 }), eyeM = mat(0x050608, { roughness: .1 });
        const ell = (p, rx, ry, rz, x, y, z) => { const m = add(p, twoTone(c.back, c.belly, -.05), skin, x, y, z); m.scale.set(rx, ry, rz); return m; };

        J.body = grp(this.root, 0, this.H, 0);
        J.body.rotation.order = 'YXZ';
        // one skinned body from the gills to the tail stalk: spine bones along -z (root, t0..t3, caudal bone)
        const prof = SHARK_PROFILE, rr = [0, 0];
        const boneZ = [0, -.42, -.82, -1.18, -1.48, -1.72];
        const rootBone = new THREE.Bone(), bones = [rootBone];
        let pb = rootBone;
        for (let i = 1; i < boneZ.length; i++) { const b = new THREE.Bone(); b.position.z = boneZ[i] - boneZ[i - 1]; pb.add(b); bones.push(b); pb = b; }
        const A = new THREE.Color(c.back), B = new THREE.Color(c.belly);
        const geo = cachedGeo('sharkBody' + c.back + c.belly, () => skinByZ(profileTube(-1.9, 1.0, 46, 16, (z, o) => table(prof, -z, o),
            (col, y) => col.copy(B).lerp(A, sstep(-.16, -.02, y))), z => -z, boneZ.map(z => -z)));
        J.body.add(skinned(geo, skin, rootBone, bones));
        J.tail = bones.slice(1, 5);
        // gill slits on the flanks
        for (const s of [1, -1]) for (let i = 0; i < 5; i++) {
            const z = .6 - i * .065;
            table(prof, -z, rr);
            const g = add(J.body, G.box(.012, rr[1] * (.5 - i * .03), .014), dark, s * (rr[0] - .004), .01, z);
            g.rotation.y = s * .4;
        }
        add(J.body, finGeo('dorsal', 'side', s => {                                              // first dorsal fin
            s.moveTo(.28, 0); s.quadraticCurveTo(.08, .14, -.1, .46); s.quadraticCurveTo(-.06, .18, -.24, .02); s.lineTo(.28, 0);
        }), fin, 0, .3, .02);
        J.pec = [];
        for (const s of [1, -1]) {
            const g = grp(J.body, s * .2, -.2, .32);
            g.rotation.order = 'YXZ';
            const f = add(g, finGeo('pec', 'flat', sh => {
                sh.moveTo(0, .16); sh.quadraticCurveTo(.32, .08, .62, -.24); sh.quadraticCurveTo(.3, -.1, 0, -.12); sh.lineTo(0, .16);
            }), fin);
            f.scale.set(s * 1.25, 1, 1.15);
            J.pec.push({ g, s });
        }

        // head: upper skull + pointed snout, mouth cavity, hinged lower jaw, teeth rows, eyes
        J.head = grp(J.body, 0, .02, .6);
        ell(J.head, .25, .2, .52, 0, .03, .32);
        ell(J.head, .16, .13, .34, 0, .04, .55);
        add(J.head, G.sph(1, 10, 8), mouth, 0, -.1, .34).scale.set(.2, .08, .34);
        add(J.head, teethGeo(11, .17, .38, .2, -.11, .1, -1), tooth);
        for (const s of [1, -1]) add(J.head, G.sph(.04, 8, 6), eyeM, s * .225, .09, .48);
        J.jaw = grp(J.head, 0, -.12, .06);
        ell(J.jaw, .2, .09, .42, 0, -.02, .22);
        add(J.jaw, teethGeo(10, .15, .36, .1, .05, .085, 1), tooth);

        add(J.tail[0], finGeo('pelvic', 'side', s => { s.moveTo(.1, 0); s.lineTo(-.1, -.16); s.lineTo(-.14, -.12); s.lineTo(-.08, 0); }), fin, 0, -.2, -.1);
        add(J.tail[2], finGeo('dorsal2', 'side', s => { s.moveTo(.06, 0); s.lineTo(-.06, .14); s.lineTo(-.1, .12); s.lineTo(-.1, 0); }), fin, 0, .1, -.05);
        add(J.tail[2], finGeo('anal', 'side', s => { s.moveTo(.06, 0); s.lineTo(-.06, -.12); s.lineTo(-.1, -.1); s.lineTo(-.1, 0); }), fin, 0, -.1, -.08);
        J.caudal = grp(bones[5], 0, 0, -.06);
        add(J.caudal, finGeo('caudal', 'side', s => {
            s.moveTo(.08, .07); s.quadraticCurveTo(-.15, .3, -.42, .62); s.quadraticCurveTo(-.24, .26, -.15, .02);
            s.quadraticCurveTo(-.24, -.16, -.34, -.36); s.quadraticCurveTo(-.12, -.18, .08, -.06); s.lineTo(.08, .07);
        }, .034), fin);
    }

    statePose(state, c, t) {
        switch (state) {
            case 'walk': return this.WALK;
            case 'run': return this.RUN;
            case 'attack': return this.strike(this.attackP(c, .8), .3, .5, .72);
            case 'defend': return this.DEFEND;
            case 'hit': return this.HIT;
            case 'kneel': return this.REST;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                const o = this.copyTo(this.tmp, this.STAND);
                o.jaw = .1 + Math.max(0, Math.sin(t * .6)) * .1;
                return o;
            }
        }
    }

    update(c, dt) {
        const state = this.advance(c, dt, 2.6, 4);
        const q = this.p, J = this.j, t = this.time;
        this.swim += dt * q.freq;
        const sw = this.swim, fl = q.float;
        let shake = 0;
        if (state === 'attack') {
            const p = this.attackP(c, .8);
            if (p > .5 && p < .74) shake = Math.sin(t * 32) * .16;
        }
        J.body.position.set(0, this.H + q.by + Math.sin(t * 1.3) * .05 * fl, q.bz);
        J.body.rotation.set(q.bx + Math.cos(t * 1.3) * .03 * fl, -q.amp * .12 * Math.sin(sw) + shake * .4, q.roll);
        J.head.rotation.set(q.head, q.amp * .22 * Math.sin(sw + .6) + shake, 0);
        J.jaw.rotation.x = q.jaw;
        J.tail.forEach((s, i) => {
            s.rotation.y = q.amp * (.35 + .32 * i) * Math.sin(sw - (i + 1) * .9) + q.bend * (1 + i * .3) * .3;
        });
        J.caudal.rotation.y = q.amp * .5 * Math.sin(sw - 4.6);
        for (const { g, s } of J.pec) {
            g.rotation.y = s * q.fold * 1.1;
            g.rotation.z = -s * (q.pec + Math.sin(t * 1.3 + 1) * .05 * fl);
        }
        this.face(c, dt);
    }
}

// ------------------------------------------------------------------ octopus / kraken
// One whole arm along +z (0 → L): tapering tube, sucker pairs underneath, spikes on top (kraken), tip cap; vertex
// coloured, skinned to N bones (one every L / N).
function armGeo(c, N, L, r0) {
    return cachedGeo(`arm${c.arm},${c.under},${c.sucker},${c.spikes},${N},${L},${r0}`, () => {
        const top = new THREE.Color(c.arm), under = new THREE.Color(c.under);
        const rad = z => r0 * (1 - .84 * z / L);
        const parts = [profileTube(0, L, N * 4, 9, (z, o) => { o[0] = rad(z); o[1] = rad(z) * .92; }, (col, y) => col.copy(top).lerp(under, sstep(-.15, -.6, y)))];
        const cap = new THREE.SphereGeometry(rad(L), 7, 5).translate(0, 0, L);
        parts.push(paint(cap, solid(c.arm)));
        let z = .05 * L, i = 0;
        while (z < L * .97) {
            const r = rad(z);
            for (const s of [1, -1]) {
                const g = new THREE.SphereGeometry(r * .42, 7, 4).scale(1, .5, 1).translate(s * r * .46, -r * .74, z + (s > 0 ? 0 : r * .5));
                parts.push(paint(g, solid(c.sucker)));
            }
            if (c.spikes && i % 3 === 1 && z < L * .8) {
                const g = new THREE.ConeGeometry(r * .3, r * 1.1, 5).rotateX(.6).translate(0, r * 1.2, z);
                parts.push(paint(g, solid(0x161a16)));
            }
            z += r * 1.05; i++;
        }
        const boneS = [];
        for (let k = 0; k < N; k++) boneS.push(k * L / N);
        return skinByZ(mergeGeometries(parts), z => z, boneS);
    });
}

// arm bend along the chain: curl, tip spiral (up), travelling wave; sideways wave with the arm's own phase
const armBend = (A, k) => (A.curl - A.tip * sstep(.3, 1, k / (A.N - 1)) * 2.2 + A.wave * .5 * Math.sin(A.t * 1.9 + A.ph - k * .55) * k / A.N) * A.bk;
const armSide = (A, k) => A.wave * Math.sin(A.t * 1.3 + A.ph * 1.7 - k * .5) * (.25 + k / A.N * .5) * A.bk;
const tailBend = (T, k) => k < 3 ? .05 : -.06 * Math.sin(T.t * 1.6 + T.ph - k) * T.live;
const tailSide = (T, k) => Math.sin(T.t * 1.4 + T.ph - k * .6) * .2 * T.live;

class Octopus extends SoftRig {
    constructor(c, scale) {
        super();
        this.c = c;
        this.n = c.arms;
        this.N = c.seg;
        this.H = .5;
        this.ringY = -.14;
        const S = {
            by: 0, bz: 0, bx: 0, roll: 0, mantle: 0, flat: 0, jaw: .05, look: 0,
            reach: .5, curl: 0, tip: .42, wave: .12, lift: 0, ink: 0, limp: 0
        };
        if (c.maw) { this.H = .62; S.bx = -.12; S.jaw = .32; }                                    // kraken: head raised, maw open
        this.initSoft(S, c.scale * scale);
        this.root.name = 'octopus';
        const P = this.pose.bind(this);
        this.WALK = P({ wave: .2, bx: .05 });
        this.RUN = P({ wave: .24, bx: .1, by: .02, mantle: .15 });
        this.A1 = P({ bz: -.12, by: .08, bx: -.14, mantle: -.18, jaw: .55, reach: .6 });
        this.A2 = P({ bz: .32, by: -.04, bx: .18, mantle: .28, jaw: .95, reach: .7 });
        this.A3 = P({ bz: .2, by: 0, bx: .1, mantle: .12, jaw: .25, reach: .6 });
        this.DEFEND = P({ by: -.06, bz: -.14, bx: -.12, mantle: -.2, jaw: .7, lift: 1, reach: .75, wave: .16 });
        this.HIT = P({ by: .07, bz: -.16, bx: -.2, mantle: -.3, jaw: .4, reach: .15, tip: .65, ink: .5 });
        this.REST = P({ by: -.12, reach: .78, tip: .3, wave: .06, mantle: -.1 });
        this.LIE = P({ by: -.19, reach: .9, tip: .18, wave: .03, mantle: -.38, flat: .15, jaw: 0 });
        this.DEAD = P({ by: -.24, reach: .95, tip: 0, wave: 0, mantle: -.7, flat: .45, limp: 1, jaw: .3 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j, n = this.n, N = this.N;
        const tex = skinTex(c.pattern, c.mantle, c.spot);
        this.mantleMat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : c.mantle, map: tex, roughness: .55 });
        this.armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .55, map: armMottle() });
        this.baseMantle = this.mantleMat.color.clone();
        this.inkCol = new THREE.Color(0x14121c);
        const sk = this.mantleMat, dark = mat(0x0a0808, { roughness: .3 });
        const eyeM = c.glow ? mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.2, roughness: .3 }) : mat(c.eye, { roughness: .25 });

        J.body = grp(this.root, 0, this.H, 0);
        J.head = grp(J.body);
        const big = c.maw;
        // one skinned body: bone 0 = head, bone 1 = mantle (pitch, breathing, flattening). Octopus: rises from the arm
        // skirt through the head (bulging eye sockets) and swells into the mantle sac tilted back. Kraken: long beast
        // body from the tail tip to a fish-like monster head with a wide maw.
        const headBone = new THREE.Bone(), mantleBone = new THREE.Bone();
        headBone.add(mantleBone);
        const BS = big
            ? [[.2, -1.0, 0, 0], [.17, -.92, .06, .06], [.1, -.7, .17, .16], [.05, -.42, .3, .28], [.03, -.12, .37, .34], [.03, .14, .36, .3],
                [.01, .34, .31, .24], [-.02, .5, .22, .15], [-.04, .6, .11, .07], [-.05, .64, 0, 0]]
            : [[-.2, .02, 0, 0], [-.17, .02, .2, .2], [-.08, .03, .25, .24], [.04, .03, .27, .25], [.15, 0, .24, .22], [.3, -.1, .34, .31],
                [.44, -.24, .44, .38], [.53, -.42, .41, .34], [.56, -.58, .26, .21], [.54, -.68, 0, 0]];
        const pivot = big ? 3.6 : 4.2, eyeU = big ? 6 : 3, eyeA = big ? 1.35 : 2.0;
        mantleBone.position.set(0, crPt(BS, pivot, 0), crPt(BS, pivot, 1));
        const lightU = new THREE.Color(1, 1, 1), darkT = new THREE.Color(.72, .72, .74);
        const bodyGeo = loftGeo('octoBody' + (big ? 'K' : 'O'), BS, {
            rings: 36, radial: 18,
            rmul: (a, u) => 1 + (big ? .1 : .2) * Math.exp(-(((Math.abs(a) - eyeA) / .38) ** 2)) * Math.exp(-(((u - eyeU) / .55) ** 2))
                + (big ? .04 * Math.exp(-((a / .3) ** 2)) * sstep(5, 6.5, u) : 0),
            col: (o, a, u, v) => o.copy(darkT).lerp(lightU, sstep(.15, -.15, v.y - (big ? 0 : .25))),
            skin: big
                ? (u, si, sw) => { const f = sstep(3.3, 4.4, u); si.push(0, 1, 0, 0); sw.push(f, 1 - f, 0, 0); }
                : (u, si, sw) => { const f = sstep(3.6, 4.8, u); si.push(0, 1, 0, 0); sw.push(1 - f, f, 0, 0); }
        });
        J.head.add(skinned(bodyGeo, sk, headBone, [headBone, mantleBone]));
        J.mantle = mantleBone;
        // eyes on the bulges
        const er = big ? .075 : .085;
        const ey = crPt(BS, eyeU, 0) + (big ? .1 : .02), rxE = crPt(BS, eyeU, 2) * (big ? 1.1 : 1.16);
        const ex = Math.sin(eyeA) * rxE * .93, ez = crPt(BS, eyeU, 1) + (big ? Math.cos(eyeA) * .1 : -Math.cos(eyeA) * crPt(BS, eyeU, 3) * 1.1);
        J.eyes = [];
        this.halos = [];
        for (const s of [1, -1]) {
            add(J.head, G.sph(er, 12, 9), eyeM, s * ex, ey, ez);
            const pu = add(J.head, G.box(er * .85, er * .24, er * .2), dark, s * (ex + er * .55), ey, ez + er * .7);
            pu.rotation.y = s * .75;
            const lid = add(J.head, G.sph(er * 1.12, 10, 6, 0, TAU, 0, Math.PI * .45), sk, s * ex, ey, ez);
            lid.rotation.set(c.brow ? -.05 : -.15, s * .5, c.brow ? -s * .7 : 0);
            if (c.glow) { const h = haloSprite(c.eye, er * 4.5, .6); h.position.set(s * (ex + er * .6), ey, ez + er * .6); J.head.add(h); this.halos.push(h); }
        }
        if (!big) add(J.head, G.cyl(.035, .05, .14, 8), sk, -.25, -.06, -.04).rotation.z = 1.1;     // siphon
        if (c.crest) {                                                                             // spiny fin crest from the brow down the back
            const finM = mat(c.spot, { roughness: .5, side: THREE.DoubleSide }), spikeM = mat(0x0e1210, { roughness: .4 });
            const fin = add(J.head, finGeo('krakenCrest', 'side', s => {
                s.moveTo(.42, 0);
                for (let i = 0; i <= 9; i++) { const z = .38 - i * .13, h = .26 - i * .018; s.lineTo(z + .05, h); s.lineTo(z - .04, h * .45); }
                s.lineTo(-.9, 0); s.lineTo(.42, 0);
            }, .012), finM, 0, .25, 0);
            fin.castShadow = false;
            for (let i = 0; i <= 9; i++) {
                const z = .38 - i * .13, h = .26 - i * .018;
                const sp = add(J.head, G.cone(.022, h + .05, 5), spikeM, 0, .25 + h * .5, z + .02);
                sp.rotation.x = -.35;
            }
        }
        if (c.fangs) {
            const tooth = mat(0xe8e0c8, { roughness: .35 }), mouth = mat(0x3a0e12, { roughness: .8 });
            if (big) {                                                                            // wide monster maw across the snout
                add(J.head, G.sph(1, 12, 8), mouth, 0, -.08, .38).scale.set(.2, .07, .24);
                add(J.head, teethGeo(13, .2, .26, .3, -.07, .12, -1), tooth);
                J.jaw = grp(J.head, 0, -.1, .14);
                add(J.jaw, loftGeo('krakenJaw', [[0, -.05, 0, 0], [0, 0, .25, .08], [-.02, .2, .23, .07], [-.03, .38, .15, .05], [-.03, .46, 0, 0]],
                    { rings: 12, radial: 12 }), sk);
                add(J.jaw, teethGeo(12, .19, .27, .08, .03, .11, 1), tooth);
            } else {                                                                              // toothy mouth on the face below the eyes
                const w = .1, d = .1, zf = .2;
                add(J.head, G.sph(1, 10, 8), mouth, 0, -.1, zf + .02).scale.set(w * 1.1, .07, d + .04);
                add(J.head, teethGeo(7, w, d, zf - d * .2, -.09, .08, -1), tooth);
                J.jaw = grp(J.head, 0, -.11, zf - d * .5);
                add(J.jaw, G.sph(1, 10, 8), sk, 0, -.03, d * .7).scale.set(w * 1.15, .06, d * 1.1);
                add(J.jaw, teethGeo(6, w * .9, d * .95, -d * .1, 0, .065, 1), tooth);
            }
        }

        // arms: ring under the head, each one skinned mesh on a bone chain (+z outwards)
        const L = 1.5 * (c.len || 1), l = this.segLen = L / N, r0 = big ? .125 : .105;
        this.radii = [];
        for (let k = 0; k <= N; k++) this.radii.push(r0 * (1 - .84 * k / N));
        this.arms = [];
        const lashN = n === 10 ? 4 : 2, geo = armGeo(c, N, L, r0);
        for (let i = 0; i < n; i++) {
            let ang = (i + .5) / n * TAU;
            if (ang > Math.PI) ang -= TAU;
            const holder = grp(J.body, Math.sin(ang) * .16, this.ringY, Math.cos(ang) * .16);
            const segs = [];
            let p = null;
            for (let k = 0; k < N; k++) {
                const b = new THREE.Bone();
                b.rotation.order = 'YXZ';
                if (p) { b.position.z = l; p.add(b); }
                segs.push(b);
                p = b;
            }
            holder.add(skinned(geo, this.armMat, segs[0], segs));
            const front = Math.cos(ang);
            this.arms.push({
                segs, ang, front, sideSign: Math.sign(Math.sin(ang)) || 1, sideAbs: Math.abs(Math.sin(ang)),
                ph: i * 2.4 + Math.random(), gaitOff: (i % 2) * Math.PI + i * .3,
                lash: false, p0: .5, curl: 0, tip: .4, yaw: 0, wave: .1, t: 0, N, bk: 9 / N
            });
        }
        [...this.arms].sort((a, b) => b.front - a.front).slice(0, lashN).forEach(a => { a.lash = true; });
    }

    statePose(state, c, t) {
        switch (state) {
            case 'walk': return this.WALK;
            case 'run': return this.RUN;
            case 'attack': return this.strike(this.attackP(c, .9), .3, .48, .74);
            case 'defend': {
                const o = this.copyTo(this.tmp, this.DEFEND);
                o.ink = .65 + Math.sin(t * 6) * .3;
                o.jaw += Math.sin(t * 5) * .1;
                return o;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.REST;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                const o = this.copyTo(this.tmp, this.STAND);
                o.look = Math.sin(t * .37) * .2 + Math.sin(t * .91) * .08;
                o.mantle = Math.sin(t * .5) * .05;
                return o;
            }
        }
    }

    update(c, dt) {
        const state = this.advance(c, dt, 1.4, 2.2);
        const q = this.p, J = this.j, t = this.time;
        const g = Math.min(1, this.gait), run = Math.max(0, this.gait - 1);
        const live = 1 - q.limp;
        const att = state === 'attack' ? this.attackP(c, .9) : -1;
        const breathe = Math.sin(t * 1.6) * .035 * live;
        const bob = g * (.03 + .03 * run) * Math.abs(Math.sin(this.phase)) + Math.sin(t * 1.2) * .012 * live;
        J.body.position.set(0, this.H + q.by + bob, q.bz);
        J.body.rotation.set(q.bx, 0, q.roll);
        J.head.rotation.y = q.look;
        J.mantle.rotation.x = q.mantle * (this.c.maw ? .45 : .8) + breathe * .6;
        J.mantle.scale.set(1 + breathe + q.flat * .3, 1 + breathe - q.flat, 1 + breathe + q.flat * .3);
        if (J.jaw) J.jaw.rotation.x = q.jaw;
        this.mantleMat.color.copy(this.baseMantle).lerp(this.inkCol, q.ink * .75);
        this.armMat.color.setScalar(1).lerp(this.inkCol, q.ink * .7);
        for (const h of this.halos) h.material.opacity = .6 * live;

        const kA = state === 'attack' ? 16 : state === 'hit' ? 14 : state === 'death' ? 2.5 : 6;
        const y0 = this.H + q.by + bob + this.ringY;
        for (const A of this.arms) {
            let p0 = q.reach, curl = q.curl, tip = q.tip + Math.sin(t * .7 + A.ph) * .1 * live, yaw = 0, wave = q.wave;
            if (g > .001) {                                                                      // crawl: lift, reach, pull
                const ph = this.phase + A.gaitOff, lift = Math.max(0, Math.sin(ph));
                p0 -= lift * (.45 + .2 * run) * g;
                tip -= lift * .15 * g;
                yaw += A.sideSign * A.sideAbs * .3 * Math.cos(ph) * g;
            }
            if (q.lift > .001 && A.front > .1) {                                                 // defend: wall of raised arms
                const w = q.lift * Math.min(1, A.front * 1.8);
                p0 = lerp(p0, -1.15, w); curl = lerp(curl, .1, w); tip = lerp(tip, .32, w); yaw = lerp(yaw, -A.ang * .2, w);
            }
            if (att >= 0 && A.lash) {                                                            // rise → lash → coil → retract
                const w1 = smooth(att / .28), w2 = smooth((att - .3) / .13), w3 = smooth((att - .46) / .14), w4 = smooth((att - .74) / .26);
                let P0 = lerp(p0, -1.3, w1), CU = lerp(curl, -.1, w1), TI = lerp(tip, .15, w1), CV = .45 * w1;
                P0 = lerp(P0, .3, w2); CU = lerp(CU, .02, w2); TI = lerp(TI, -.08, w2); CV = lerp(CV, .8, w2);
                P0 = lerp(P0, .12, w3); CU = lerp(CU, 0, w3); TI = lerp(TI, .55, w3); CV = lerp(CV, .9, w3);
                p0 = lerp(P0, p0, w4); curl = lerp(CU, curl, w4); tip = lerp(TI, tip, w4);
                yaw = lerp(-A.ang * CV, yaw, w4); wave = lerp(.02, wave, w4);
            }
            if (q.limp > .001) { p0 = lerp(p0, .85, q.limp); curl *= live; tip = lerp(tip, .04, q.limp); wave *= live; }
            A.p0 = damp(A.p0, p0, kA, dt); A.curl = damp(A.curl, curl, kA, dt); A.tip = damp(A.tip, tip, kA, dt);
            A.yaw = damp(A.yaw, yaw, kA, dt); A.wave = damp(A.wave, wave, kA, dt);
            A.t = t;
            solveChain(A.segs, y0, A.p0, A.ang + A.yaw, this.segLen, this.radii, armBend, armSide, A);
        }
        this.face(c, dt);
    }
}

// ------------------------------------------------------------------ illusion serpent (skinned, translucent)
const runeTex = new Map();
function illusionTextures(c) {
    const key = c.c1 + ',' + c.c2 + ',' + c.rune;
    if (runeTex.has(key)) return runeTex.get(key);
    let out = { map: null, glow: null };
    if (typeof document !== 'undefined') {
        const hex = v => '#' + new THREE.Color(v).getHexString();
        const mk = draw => {
            const cv = document.createElement('canvas');
            cv.width = 128; cv.height = 256;
            draw(cv.getContext('2d'));
            const t = new THREE.CanvasTexture(cv);
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(1, 5);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        };
        out.map = mk(g => {                                                                      // iridescent bands + scale arcs
            const gr = g.createLinearGradient(0, 0, 128, 256);
            gr.addColorStop(0, hex(c.c1)); gr.addColorStop(.5, hex(c.c2)); gr.addColorStop(1, hex(c.c1));
            g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
            g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
            for (let y = 0; y < 256; y += 12) for (let x = 0; x < 128; x += 12) { g.beginPath(); g.arc(x + (y / 12 % 2) * 6, y, 6, 0, Math.PI); g.stroke(); }
        });
        out.glow = mk(g => {                                                                     // runes along the back (u = .5 is the top)
            g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
            g.strokeStyle = hex(c.rune); g.lineWidth = 3; g.lineCap = 'round';
            let seed = 5;
            const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            for (let y = 6; y < 256; y += 28) {
                const x0 = 48, w = 32, h = 22;
                g.beginPath();
                for (let s = 0; s < 4; s++) {
                    const a = [x0 + rnd() * w, y + rnd() * h], b = [x0 + rnd() * w, y + rnd() * h];
                    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
                }
                if (rnd() < .5) g.arc(x0 + w / 2, y + h / 2, 8, 0, TAU * rnd());
                g.stroke();
            }
            g.fillStyle = hex(c.rune);
            for (let i = 0; i < 40; i++) { g.globalAlpha = .4 + rnd() * .6; g.fillRect(rnd() * 128, rnd() * 256, 1.5, 1.5); }
        });
    }
    runeTex.set(key, out);
    return out;
}

// neck segment pitch per unit of `rise` (lower part up) and of `arc` (upper part bending forward)
const NECK_RISE = [-.55, -.5, -.35, -.12, .05, .1, .1], NECK_ARC = [0, 0, .05, .22, .35, .35, .25];

class Illusion extends SoftRig {
    constructor(c, scale) {
        super();
        this.c = c;
        this.NN = 7; this.NR = 12; this.ln = .26; this.lr = .3;
        const S = { by: 0, bz: 0, rise: 1, arc: 1, headX: 0, jaw: .05, wave: .18, coil: 0, sway: 1, flare: 0, fade: 0, look: 0 };
        this.initSoft(S, c.scale * scale);
        this.root.name = 'illusion';
        const P = this.pose.bind(this);
        this.WALK = P({ wave: .42, rise: .85, arc: .8 });
        this.RUN = P({ wave: .52, rise: .7, arc: .55, headX: .1 });
        this.A1 = P({ rise: 1.25, arc: 1.75, headX: -.2, jaw: .35, bz: -.15, flare: .6 });
        this.A2 = P({ rise: .5, arc: -.25, headX: .35, jaw: 1, bz: .3, wave: .1, flare: 1 });
        this.A3 = P({ rise: .7, arc: .3, headX: .1, jaw: 0, bz: .15 });
        this.DEFEND = P({ rise: 1.35, arc: 1.2, headX: -.25, jaw: .65, flare: 1, sway: 2.2, wave: .1 });
        this.HIT = P({ rise: .9, arc: 1.55, headX: -.35, jaw: .45, bz: -.18, wave: .05 });
        this.REST = P({ rise: .32, arc: .15, headX: .05, wave: .06, coil: .4, sway: .4 });
        this.LIE = P({ rise: .04, arc: 0, headX: .08, wave: .02, coil: .75, sway: .1, jaw: 0 });
        this.DEAD = P({ rise: 0, arc: 0, headX: .1, wave: 0, coil: .35, sway: 0, jaw: .35, fade: 1 });
        // static pitch of the rear segments so the tapering tail rests on the ground
        this.rad = z => z >= 0 ? .24 - .07 * z / (this.NN * this.ln) : .035 + .205 * smooth((z + this.NR * this.lr) / (this.NR * this.lr - 1));
        this.build();
    }

    build() {
        const c = this.c, J = this.j, NN = this.NN, NR = this.NR, ln = this.ln, lr = this.lr;
        const tx = illusionTextures(c);
        const map = tx.map ? tx.map.clone() : null, glow = tx.glow ? tx.glow.clone() : null;
        if (map) map.needsUpdate = true;
        if (glow) glow.needsUpdate = true;
        this.maps = [map, glow].filter(Boolean);
        this.skin = new THREE.MeshStandardMaterial({
            color: 0xffffff, map, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 1, roughness: .25, metalness: .1,
            transparent: true, opacity: .74, depthWrite: false
        });
        if (!map) { this.skin.color.set(c.c1); this.skin.emissive.set(c.c2); this.skin.emissiveIntensity = .3; }
        this.glowMats = [];
        const additive = (color, op) => {
            const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            this.glowMats.push([m, op]);
            return m;
        };

        J.body = grp(this.root, 0, .2, .4);
        // bones: rear chain (−z, on the ground) and neck chain (+z, rising), both from the body origin
        const rootBone = new THREE.Bone(), bones = [rootBone];
        J.neck = []; J.rear = [];
        let p = rootBone;
        for (let k = 0; k < NN; k++) { const b = new THREE.Bone(); b.position.z = k === 0 ? 0 : ln; p.add(b); bones.push(b); J.neck.push(b); p = b; }
        p = rootBone;
        for (let k = 0; k < NR; k++) { const b = new THREE.Bone(); b.position.z = k === 0 ? 0 : -lr; p.add(b); bones.push(b); J.rear.push(b); p = b; }
        // one tube along z, radius profile, weights blended between neighbouring bones
        const zMin = -NR * lr, zMax = NN * ln;
        const geo = new THREE.CylinderGeometry(1, 1, zMax - zMin, 10, 64, true).rotateX(Math.PI / 2).translate(0, 0, (zMax + zMin) / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const r = this.rad(pos.getZ(i));
            pos.setX(i, pos.getX(i) * r);
            pos.setY(i, pos.getY(i) * r * .9);
        }
        geo.computeVertexNormals();
        // bone order: root, neck 0..NN-1, rear 0..NR-1; neck weights for z >= 0, rear weights behind
        const nS = [], rS = [];
        for (let k = 0; k < NN; k++) nS.push(k * ln);
        for (let k = 0; k < NR; k++) rS.push(k * lr);
        const si = [], sw = [];
        for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            if (z >= 0) weightAt(z, nS, 1, si, sw);
            else weightAt(-z, rS, 1 + NN, si, sw);
        }
        setSkin(geo, si, sw);
        const body = skinned(geo, this.skin, rootBone, bones);
        body.castShadow = false;
        J.body.add(body);
        this.rearPitch = [];
        for (let k = 0; k < NR; k++) this.rearPitch.push(-Math.asin((this.rad(-k * lr) - this.rad(-(k + 1) * lr)) / lr));

        // head on the last neck bone
        J.head = grp(J.neck[NN - 1], 0, 0, ln);
        const hm = this.skin, hornM = mat(c.horn, { roughness: .3, emissive: c.horn, emissiveIntensity: .35 });
        // eastern dragon head: broad skull, long tapering snout, brow ridges, hinged lower jaw, swept-back horns
        add(J.head, loftGeo('illHead', [[.05, -.14, 0, 0], [.06, -.1, .13, .12], [.07, .0, .165, .14], [.06, .11, .145, .11],
            [.03, .23, .105, .075], [.015, .35, .085, .055], [.005, .43, .065, .045], [0, .47, 0, 0]], { rings: 22, radial: 14 }), hm);
        J.jaw = grp(J.head, 0, -.035, .02);
        add(J.jaw, loftGeo('illJaw', [[0, -.06, 0, 0], [-.015, -.02, .12, .05], [-.03, .14, .1, .04], [-.03, .3, .065, .03], [-.03, .38, 0, 0]],
            { rings: 12, radial: 10 }), hm);
        add(J.jaw, teethGeo(8, .055, .3, .04, -.005, .035, 1), hornM);
        add(J.head, teethGeo(9, .07, .3, .12, -.03, .045, -1), hornM);
        const eyeM = mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.6 });
        this.halos = [];
        for (const s of [1, -1]) {
            add(J.head, G.sph(.036, 9, 7), eyeM, s * .118, .1, .12);
            const brow = add(J.head, G.sph(.05, 8, 6), hornM, s * .1, .145, .12);
            brow.scale.set(.8, .35, 1.6);
            brow.rotation.set(.25, s * .2, -s * .3);
            const h = haloSprite(c.eye, .42, .6); h.position.set(s * .13, .1, .14); J.head.add(h); this.halos.push([h, .6]);
            const horn = add(J.head, taperTube([[0, 0, 0], [.04, .07, -.1], [.08, .15, -.26], [.08, .2, -.46], [.05, .22, -.6]], .042, .004, 12, 7), hornM, s * .08, .13, .0);
            horn.scale.x = s;
            const spur = add(J.head, taperTube([[0, 0, 0], [.06, .03, -.06], [.12, .03, -.16]], .02, .003, 6, 5), hornM, s * .14, .04, -.02);
            spur.scale.x = s;                                                                      // cheek spur
            if (c.antler) for (const [y, z, bx] of [[.09, -.12, .1], [.15, -.26, .12]]) {
                const br = add(J.head, taperTube([[0, 0, 0], [.06, .06, .02], [.1, .14, .0]], .016, .003, 6, 5), hornM, s * (.12 + bx * .1), .13 + y, z);
                br.scale.x = s;
            }
            add(J.head, G.sph(.012, 6, 4), hornM, s * .03, .05, .45);                               // nostril knobs
            const wh = add(J.head, taperTube([[0, 0, 0], [.12, -.02, .02], [.26, -.12, -.06], [.36, -.28, -.2], [.4, -.42, -.36]], .012, .002, 12, 5), hornM, s * .05, .02, .42);
            wh.scale.x = s;
        }
        // dorsal spines along the neck and back
        const spineG = cachedGeo('illSpine', () => new THREE.ConeGeometry(.03, .12, 5).rotateX(-.5).translate(0, .05, 0));
        J.neck.forEach((b, k) => { if (k < NN - 1) add(b, spineG, hornM, 0, this.rad(k * ln) * .82, ln * .5, false).scale.setScalar(1.1 - k * .05); });
        J.rear.forEach((b, k) => { if (k > 0 && k < NR - 2) add(b, spineG, hornM, 0, this.rad(-k * lr) * .82, -lr * .5, false).scale.setScalar(Math.max(.35, 1.1 - k * .07)); });
        // mane wisps on the back of the head (additive, order independent)
        const wisp = additive(c.c2, .32);
        J.mane = [];
        for (let i = 0; i < 5; i++) {
            const w = add(J.head, finGeo('wisp', 'side', sh => {
                sh.moveTo(.03, 0); sh.quadraticCurveTo(.05, .12, -.06, .2); sh.quadraticCurveTo(-.14, .3, -.26, .28);
                sh.quadraticCurveTo(-.12, .16, -.06, 0); sh.lineTo(.03, 0);
            }, .004), wisp, (i - 2) * .04, .08, -.06 - Math.abs(i - 2) * .02, false);
            w.rotation.set(0, (i - 2) * .35, 0);
            J.mane.push(w);
        }
        // frill fins along the neck (variant 2)
        J.frill = [];
        if (c.frill) {
            const fm = additive(c.c1, .55);
            J.neck.forEach((b, k) => {
                const f = add(b, finGeo('frill', 'side', s => { s.moveTo(.1, 0); s.quadraticCurveTo(.02, .2, -.12, .26); s.lineTo(-.14, 0); s.lineTo(.1, 0); }, .004), fm, 0, this.rad(k * ln) * .8, ln * .5, false);
                f.scale.setScalar(1 - k * .07);
                J.frill.push(f);
            });
        }
        // soft glow along the body
        for (const [b, sz] of [[J.neck[2], 1.1], [J.rear[2], 1.2], [J.rear[7], .9]]) {
            const h = haloSprite(c.c1, sz, .22);
            b.add(h);
            this.halos.push([h, .22]);
        }
        this.c1 = new THREE.Color(c.c1);
        this.c2 = new THREE.Color(c.c2);
    }

    statePose(state, c, t) {
        switch (state) {
            case 'walk': return this.WALK;
            case 'run': return this.RUN;
            case 'attack': return this.strike(this.attackP(c, .8), .32, .5, .72);
            case 'defend': {
                const o = this.copyTo(this.tmp, this.DEFEND);
                o.jaw += Math.sin(t * 6) * .1;
                return o;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.REST;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                const o = this.copyTo(this.tmp, this.STAND);
                o.look = Math.sin(t * .45) * .35;
                o.rise = 1 + Math.sin(t * .8) * .05;
                return o;
            }
        }
    }

    update(c, dt) {
        const state = this.advance(c, dt, 1.6, 2.6);
        const q = this.p, J = this.j, t = this.time, NN = this.NN, NR = this.NR;
        const g = Math.min(1, this.gait), run = Math.max(0, this.gait - 1);
        J.body.position.set(0, .2 + q.by, .4 + q.bz);
        // neck: S-curve from rise (lower part up) and arc (upper part bending forward), side sway; the head stays level
        const R = NECK_RISE, A = NECK_ARC;
        let sum = 0;
        for (let k = 0; k < NN; k++) {
            const a = q.rise * R[k] + q.arc * A[k];
            const b = J.neck[k];
            b.rotation.x = a;
            b.rotation.y = Math.sin(t * 1.1 * q.sway - k * .5) * .07 * q.sway + q.look / NN;
            sum += a;
        }
        J.head.rotation.set(-sum + q.headX, Math.sin(t * 1.3) * .08 * q.sway, 0);
        J.jaw.rotation.x = q.jaw;
        // rear: travelling side wave, coiled when resting
        const w = 2.2 + g * 3 + run * 3;
        this.slither = (this.slither || 0) + dt * w;
        for (let k = 0; k < NR; k++) {
            const b = J.rear[k];
            b.rotation.x = this.rearPitch[k];
            b.rotation.y = q.wave * Math.sin(this.slither - k * .75) * (k === 0 ? .4 : .55) + q.coil * .34 * (k > 0 ? 1 : 0);
        }
        // shimmer: runes scroll, colour and opacity breathe; fades on death
        const live = 1 - q.fade;
        for (const m of this.maps) m.offset.y = -t * .06;
        this.skin.emissiveIntensity = (.75 + Math.sin(t * 3.1) * .25 + Math.sin(t * 7.3) * .08) * (.4 + .6 * live);
        this.skin.opacity = (.7 + Math.sin(t * 2.3) * .07) * (.45 + .55 * live);
        if (!this.skin.map) this.skin.color.lerpColors(this.c1, this.c2, .5 + .5 * Math.sin(t * .9));
        for (const [m, op] of this.glowMats) m.opacity = op * (.7 + .3 * Math.sin(t * 2.7)) * (.3 + .7 * live) * (1 + q.flare * .4);
        for (const [h, op] of this.halos) h.material.opacity = op * (.8 + .2 * Math.sin(t * 3.7)) * (.25 + .75 * live);
        J.mane.forEach((m, i) => { m.rotation.x = -.2 - q.flare * .5 + Math.sin(t * 2 + i) * .15; });
        J.frill.forEach((f, k) => { f.rotation.z = Math.sin(t * 2.5 - k * .6) * .12; f.scale.y = (1 - k * .07) * (.8 + q.flare * .4); });
        this.face(c, dt);
    }
}

// ------------------------------------------------------------------ klobg: lean swamp crawler on all fours
// leg chain height for the pose angles (segment lengths l, splay z) + sole thickness
const chainH = (l, a0, a1, a2, z, sole) => (l[0] * Math.cos(a0) + l[1] * Math.cos(a0 + a1) + l[2] * Math.cos(a0 + a1 + a2)) * Math.cos(z) + sole;
const KL_HIND = [.5, .52, .2], KL_FORE = [.56, .54, .06], KL_HIP = [.15, -.05, -.32], KL_SH = [.23, 0, .3];

class Klobg extends QuadrupedRig {
    constructor(c, scale) {
        super();
        this.c = c;
        const S = {
            ...BASE_STAND, HL0: -1.15, HL1: 2.25, HL2: -.95, HLz: .22, FL0: -.78, FL1: .8, FL2: -.1, FLz: .3,
            neckX: 1.2, headX: -1.3, jaw: .06, tongue: 0, tailX: 0
        };
        const hindH = chainH(KL_HIND, S.HL0, S.HL1, S.HL2, S.HLz, .035);
        const H = hindH - KL_HIP[1];
        this.shY = chainH(KL_FORE, S.FL0, S.FL1, S.FL2, S.FLz, .03) - H;                           // shoulders where the hands reach the ground
        this.init({ H, stand: S, sniff: .35, scale: c.scale * (scale || 1),
            gait: { walk: 1.25, run: 2.3, amp: .38, ampRun: .4, lift: .75, roll: .05 } });
        this.root.name = 'klobg';
        const P = this.pose.bind(this);
        // pitch the body by bx and keep the hind feet planted: thigh angle and height compensate
        const rear = (bx, extra = {}) => {
            const hy = KL_HIP[1] * Math.cos(bx) - KL_HIP[2] * Math.sin(bx);
            return P({ bx, HL0: S.HL0 - bx, by: hindH - H - hy, ...extra });
        };
        this.A1 = rear(-.22, { bz: -.1, FRx: -1.55, FRk: -.6, FL0: -.4, neckX: .95, headX: -1.05, jaw: .65 });
        this.A2 = P({ bz: .3, by: -.04, bx: .1, FRx: -.15, FRk: .15, neckX: 1.35, headX: -1.45, jaw: 1, tongue: 1 });
        this.A3 = P({ bz: .16, bx: .05, FRx: -.35, FRk: .35, jaw: .4, tongue: .15 });
        this.DEFEND = rear(-.4, { bz: -.08, FL0: -1.0, FL1: -1.2, FL2: -.5, FLz: .7, neckX: .75, headX: -.55, jaw: .9 });
        this.HIT = rear(-.2, { bz: -.12, FL0: -.45, FL1: .5, FLz: .45, neckX: .7, headX: -.9, jaw: .5 });
        // kneel: squat on the haunches, hands still on the ground
        const sit = { HL0: -1.5, HL1: 2.75, HL2: -1.1 };
        const sitBy = chainH(KL_HIND, sit.HL0, sit.HL1, sit.HL2, S.HLz, .035) - hindH;
        this.SIT = P({ ...sit, by: sitBy, FL0: -.95, FL1: 1.05, FL2: -.1, FLz: .5, neckX: 1.0, headX: -1.05 });
        this.LIE = P({ by: -H + .17, bx: .38, HL0: -1.35, HL1: 2.6, HL2: -1.1, HLz: 1.15, FL0: -1.45, FL1: .9, FL2: .3, FLz: 1.05,
            neckX: .95, headX: -.75, jaw: 0 });
        this.DEAD = P({ by: -H + .24, roll: 1.42, bx: .15, HL0: -.7, HL1: 1.3, HL2: -.5, HLz: .3, FL0: -1.0, FL1: .5, FL2: .2, FLz: .2,
            neckX: .9, headX: -.5, jaw: .55, tongue: .12 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j;
        const tex = swampTex(c.skin, c.belly, c.dark);
        const skin = mat(0xffffff, { roughness: .62, map: tex, vertexColors: true });
        const limb = mat(0xffffff, { roughness: .62, map: tex });
        const claw = mat(c.claw, { roughness: .35 }), dark = mat(c.dark, { roughness: .8 });
        this.mats = { skin, limb, claw, dark };
        J.body = grp(this.root, 0, this.H, 0);

        // torso: narrow pelvis → sunken waist → ribcage → bony shoulders; ribs and spine ridge as bumps
        const top = new THREE.Color(.62, .66, .6), side = new THREE.Color(.9, .92, .88), under = new THREE.Color(1, 1, .92);
        const sy = this.shY;
        const TS = [[-.04, -.54, 0, 0], [-.03, -.48, .11, .09], [-.03, -.37, .165, .135], [.02, -.21, .145, .12], [.08 * sy / .3, -.06, .13, .115],
            [.15 * sy / .3, .06, .175, .155], [.23 * sy / .3, .17, .23, .185], [sy - .01, .27, .27, .16], [sy + .04, .36, .16, .11], [sy + .06, .42, 0, 0]];
        const ribs = (a, u) => {
            const w = sstep(4.4, 4.9, u) * (1 - sstep(6.4, 6.9, u)), sideK = sstep(.6, 1.6, Math.abs(a));
            const spine = Math.exp(-((a / .22) ** 2)) * (.04 + .05 * Math.max(0, Math.sin(u * 11))) * (1 - sstep(7.4, 8.4, u));
            return 1 + w * sideK * .05 * Math.max(0, Math.cos((u - 4.5) * TAU * 1.6)) + spine;
        };
        add(J.body, loftGeo('klobgTorso' + sy.toFixed(3), TS, {
            rings: 40, radial: 16, rmul: ribs,
            col: (o, a, u) => {
                const k = Math.abs(a) / Math.PI;
                o.copy(top).lerp(side, sstep(.15, .5, k)).lerp(under, sstep(.6, .95, k));
                const w = sstep(4.4, 4.9, u) * (1 - sstep(6.4, 6.9, u)) * sstep(.35, .55, k);
                o.multiplyScalar(1 - w * .3 * Math.max(0, -Math.cos((u - 4.5) * TAU * 1.6)));
            }
        }), skin);

        // hind legs: long frog-like crouch, knees splayed, long clawed toes
        for (const [name, s] of [['HL', 1], ['HR', -1]]) {
            const [a, b, f] = KL_HIND;
            const topJ = grp(J.body, KL_HIP[0] * s, KL_HIP[1], KL_HIP[2]);
            add(topJ, limbGeo(a, .085, .055, .35, .3, .9), limb);
            const knee = grp(topJ, 0, -a, 0);
            add(knee, G.sph(.05, 8, 6), limb);
            add(knee, limbGeo(b, .055, .032, .45, .25, .85), limb);
            const low = grp(knee, 0, -b, 0);
            add(low, limbGeo(f, .034, .026, 0, .5, 1, 7), limb);
            const toes = grp(low, 0, -f, 0);
            add(toes, G.sph(.04, 8, 6), limb, 0, -.008, .03).scale.set(1.2, .5, 1.6);
            for (const ang of [-.45, -.15, .15, .45]) {
                const len = .15 - Math.abs(ang) * .08;
                const tg = grp(toes, 0, -.018, .04);
                tg.rotation.y = ang;
                add(tg, limbGeo(len, .013, .009, .2, .3, .8, 5), limb).rotation.x = -Math.PI / 2 + .12;
                add(tg, G.cone(.009, .05, 5), claw, 0, -.012, len + .03).rotation.x = Math.PI / 2 + .5;
            }
            J[name] = { top: topJ, knee, low, toes, hind: true, side: s };
        }
        // fore legs: very long sinewy arms on the knuckles / palms, splayed elbows, long clawed fingers
        for (const [name, s] of [['FL', 1], ['FR', -1]]) {
            const [a, b, f] = KL_FORE;
            const topJ = grp(J.body, KL_SH[0] * s, this.shY, KL_SH[2]);
            add(topJ, G.sph(.075, 10, 8), limb, 0, .01, 0).scale.set(1.1, 1, 1.1);
            add(topJ, limbGeo(a, .08, .05, .5, .3, .9), limb);
            const knee = grp(topJ, 0, -a, 0);
            add(knee, G.sph(.042, 8, 6), limb);
            add(knee, limbGeo(b, .062, .032, .4, .25, .8), limb);
            const low = grp(knee, 0, -b, 0);
            add(low, limbGeo(f, .03, .03, 0, .5, .8, 7), limb);
            const toes = grp(low, 0, -f, 0);
            add(toes, G.sph(.05, 9, 6), limb, 0, -.008, .035).scale.set(1.15, .42, 1.2);
            for (const ang of [-.55, -.2, .15, .5]) {
                const len = .17 - Math.abs(ang + .02) * .06;
                const fg = grp(toes, Math.sin(ang) * .03, -.012, .06);
                fg.rotation.y = ang * .7;
                add(fg, limbGeo(len, .012, .008, .25, .5, .8, 5), limb).rotation.x = -Math.PI / 2 + .1;
                add(fg, G.cone(.008, .06, 5), claw, 0, -.012, len + .03).rotation.x = Math.PI / 2 + .55;
            }
            J[name] = { top: topJ, knee, low, toes, hind: false, side: s };
        }
        this.buildHead();
    }

    buildHead() {
        const c = this.c, J = this.j, M = this.mats;
        const tooth = mat(0xe8dcb8, { roughness: .4 }), mouth = mat(0x3a1414, { roughness: .8 });
        const eyeM = mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.1, roughness: .3 }), pupil = mat(0x080604);
        const hair = mat(c.hair, { roughness: 1, side: THREE.DoubleSide });
        J.neck = grp(J.body, 0, this.shY + .03, .34);
        add(J.neck, limbGeo(.17, .085, .07, .1, .5, .9), M.limb).rotation.x = Math.PI;
        J.head = grp(J.neck, 0, .17, 0);
        J.head.scale.setScalar(1.15);
        // gaunt ghoul head: high cranium, heavy brow ridge, wide flat face, hinged jaw, pointed ears
        add(J.head, G.sph(.12, 14, 11), M.limb, 0, .1, -.02).scale.set(.95, .95, 1.08);
        add(J.head, G.sph(.1, 12, 9), M.limb, 0, .04, .07).scale.set(1.1, .85, .95);
        for (const s of [1, -1]) {                                                                // heavy brow ridge, angry V
            const brow = add(J.head, G.sph(.05, 10, 7), M.dark, s * .045, .112, .13);
            brow.scale.set(1.25, .42, .75);
            brow.rotation.set(.2, 0, s * .35);
        }
        for (const s of [1, -1]) add(J.head, G.sph(.04, 8, 6), M.limb, s * .07, .045, .12).scale.set(1, .8, .8);   // cheekbones
        add(J.head, G.sph(1, 9, 7), mouth, 0, -.015, .1).scale.set(.085, .03, .07);
        add(J.head, teethGeo(8, .07, .08, .07, -.012, .035, -1), tooth);
        for (const s of [1, -1]) {
            add(J.head, G.cone(.01, .06, 5), tooth, s * .05, -.03, .135).rotation.x = Math.PI;      // fangs
            add(J.head, G.sph(.018, 8, 6), eyeM, s * .05, .088, .146).scale.set(1.25, .8, 1);
            add(J.head, G.box(.005, .02, .005), pupil, s * .05, .088, .164);
            const ear = add(J.head, G.cone(.03, .16, 5), M.limb, s * .12, .1, -.02);
            ear.rotation.set(-.4, 0, -s * 1.25);
            ear.scale.z = .4;
            add(J.head, G.sph(.007, 6, 4), M.dark, s * .012, .05, .17);                               // nose slits
        }
        J.jaw = grp(J.head, 0, -.02, .03);
        add(J.jaw, G.sph(.09, 10, 8), M.limb, 0, -.025, .045).scale.set(1.05, .5, 1.05);
        add(J.jaw, teethGeo(7, .065, .07, 0, 0, .04, 1), tooth);
        // long stringy hair from the crown down the back and sides (ribbons)
        add(J.head, cachedGeo('klobgHair', () => {
            const pos = [], idx = [];
            let seed = 3;
            const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            const n = 40, K = 6;
            for (let i = 0; i < n; i++) {
                const a = -2.2 + 4.4 * i / (n - 1) + (rnd() - .5) * .1, L = .3 + rnd() * .34, w = .012 + rnd() * .01;
                const rx = Math.sin(a), rz = -Math.cos(a), tx = Math.cos(a), tz = Math.sin(a);
                const base = pos.length / 3;
                for (let k = 0; k <= K; k++) {
                    const t = k / K, ww = w * (1 - t * .7);
                    const x = rx * (.115 + .05 * t), y = .19 - .03 * Math.abs(Math.sin(a)) - L * t, z = rz * (.1 + .05 * t) - .02 - .05 * t * t;
                    pos.push(x - tx * ww, y, z - tz * ww, x + tx * ww, y, z + tz * ww);
                    if (k < K) { const q = base + k * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
                }
            }
            const g = new THREE.BufferGeometry();
            g.setIndex(idx);
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.computeVertexNormals();
            return g;
        }), hair, 0, 0, 0, false);
        // tongue (body long, shot out of the mouth) with tiny tentacle tips
        J.tongue = grp(J.head, 0, -.03, .1);
        const tm = mat(0x9a4a5a, { roughness: .5 });
        J.tongueMesh = add(J.tongue, cachedGeo('tongue', () => new THREE.CylinderGeometry(.012, .03, 1, 7).rotateX(Math.PI / 2).translate(0, 0, .5)), tm);
        J.tongueTip = grp(J.tongue, 0, 0, 0);
        for (let i = 0; i < 5; i++) {
            const a = i / 5 * TAU;
            const t = add(J.tongueTip, G.cone(.008, .07, 4), tm, Math.cos(a) * .015, Math.sin(a) * .015, .03);
            t.rotation.set(Math.PI / 2 - Math.sin(a) * .5, Math.cos(a) * .5, 0);
        }
        J.tongue.visible = false;
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const p = c.actionDuration ? 1 - c.actionTime / c.actionDuration : (this.stateTime / .8) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .14));
                if (p > .52) P = this.mix(P, this.A3, smooth((p - .52) / .2));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.jaw += Math.sin(t * 7) * .08;
                P.neckY = Math.sin(t * 1.7) * .2;
                P.FLz += Math.sin(t * 2.3) * .08;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.SIT;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                if (state !== 'idle') return this.STAND;
                const P = this.idlePose();
                P.by += Math.sin(t * 1.4) * .008;
                return P;
            }
        }
    }

    animateExtras(q, state, t) {
        const J = this.j;
        for (const name of ['HL', 'HR', 'FL', 'FR']) {                                            // soles and palms flat
            const L = J[name];
            L.toes.rotation.x = -(q.bx + L.top.rotation.x + L.knee.rotation.x + L.low.rotation.x);
        }
        const ext = q.tongue;
        J.tongue.visible = ext > .02;
        const len = 1.9 * ext;
        J.tongueMesh.scale.z = Math.max(.01, len);
        J.tongueTip.position.z = len;
        J.tongue.rotation.x = .1 + Math.sin(t * 9) * .03 * ext;
        J.tongueTip.rotation.z = t * 6;
    }
}

// ------------------------------------------------------------------ manyhead: hulking black rat beast with five heads
const MH = { legs: [.32, .34, .22], R: .09, legX: .2, lean: .3, L: [-.8, 1.6, -1.05] };

class Manyhead extends QuadrupedRig {
    constructor(c, scale) {
        super();
        this.c = c;
        const D = MH, [L0, L1, L2] = D.L, [a, b, f] = D.legs;
        const H = a * Math.cos(L0) + b * Math.cos(L0 + L1) + f * Math.cos(L0 + L1 + L2) + D.R * .55;
        const S = {
            ...BASE_STAND, HL0: L0, HL1: L1, HL2: L2, HLz: .12, lean: D.lean, neckX: .95, headX: -1.15, jaw: .25,
            armX: -.3, armK: -.65, armZ: .2, hand: -.1, hx: 0, hjaw: .35, hsp: 0, tailX: .9
        };
        this.init({ H, stand: S, legs: ['HL', 'HR'], sniff: .3, scale: c.scale * (scale || 1),
            gait: { walk: (a + b) * 1.7, run: (a + b) * 3, amp: .45, ampRun: .2, lift: .8, roll: .07 } });
        this.root.name = 'manyhead';
        const P = this.pose.bind(this);
        const crouch = { HL0: L0 - .4, HL1: L1 + .75, HL2: L2 - .35 };
        const crouchH = a * Math.cos(L0 - .4) + b * Math.cos(L0 + L1 + .35) + f * Math.cos(L0 + L1 + L2) + D.R * .55 - H;
        // heads pull back → bite one after another, claws rake
        this.A1 = P({ by: .02, bz: -.08, lean: .1, neckX: .7, headX: -.85, jaw: .9, hx: -.45, hjaw: .9, armX: -1.6, armK: -.8, hand: -.4 });
        this.A2 = P({ ...crouch, by: crouchH * .6, bz: .3, lean: .6, neckX: 1.1, headX: -1.5, jaw: 1, hx: .1, hjaw: .6, armX: -.9, armK: -.2 });
        this.A3 = P({ by: crouchH * .3, bz: .2, lean: .5, neckX: 1.0, headX: -1.3, jaw: .1, hx: .2, hjaw: .2, armX: .1, armK: -.5 });
        this.DEFEND = P({ by: .03, lean: .12, neckX: .75, headX: -.8, jaw: 1, hx: -.35, hjaw: 1, hsp: 1, armX: -1.45, armK: -1.2, armZ: .45, hand: -.5 });
        this.HIT = P({ by: .02, bz: -.12, lean: D.lean - .3, neckX: .6, headX: -.8, jaw: .5, hjaw: .55, hx: -.3, armX: -.6, armK: -.4, armZ: .35 });
        const fold = { HL0: -1.65, HL1: 2.6, HL2: -1.25 };
        const sitH = a * Math.cos(-1.65) + b * Math.cos(.95) + f * Math.cos(-.3) + D.R * .5 - H;
        this.SIT = P({ ...fold, by: sitH, lean: .45, neckX: .85, headX: -1.05, armX: -.6, armK: -.3, hand: .2, tailX: 1.0, hjaw: .15, jaw: .1 });
        this.LIE = P({ HL0: -.2, HL1: .3, HL2: -.1, by: -(H - .5), bx: 1.45, lean: 0, neckX: .2, headX: -.55, jaw: 0, armX: -.4, armK: -.6,
            armZ: .5, hand: 0, hx: -.2, hjaw: .05, tailX: .2 });
        this.DEAD = P({ HL0: -.6, HL1: .9, HL2: -.3, by: -(H - .5), roll: 1.45, lean: .3, neckX: 1.1, headX: -.9, jaw: .6, hjaw: .6, hx: .5,
            armX: -.3, armK: -.3, armZ: .1, hand: .2, tailX: .2 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j, D = MH, R = D.R;
        const tex = furTex(c.fur, c.light, c.dark);
        const fur = mat(0xffffff, { roughness: .95, map: tex, vertexColors: true });
        const furP = mat(0xffffff, { roughness: .95, map: tex });
        const bare = mat(c.skin, { roughness: .65 }), claw = mat(c.claw, { roughness: .4 });
        this.mats = { fur, furP, bare, claw };
        const [la, lb, lf] = D.legs;
        J.body = grp(this.root, 0, this.H, 0);

        // haunches + rat hind legs (long bare feet)
        for (const [name, s] of [['HL', 1], ['HR', -1]]) {
            const top = grp(J.body, D.legX * s, -R * .3, 0);
            add(top, G.sph(.27, 12, 9), furP, s * .03, -la * .3, -.02).scale.set(.85, 1.15, 1.15);
            add(top, limbGeo(la, R * 1.4, R, .3, .3), furP);
            const knee = grp(top, 0, -la, 0);
            add(knee, G.sph(R * .95, 8, 6), furP);
            add(knee, limbGeo(lb, R * 1.15, R * .75, .35, .25), furP);
            const low = grp(knee, 0, -lb, 0);
            add(low, limbGeo(lf, R * .6, R * .45, 0, .5, .8, 7), furP);
            const toes = grp(low, 0, -lf, 0);
            add(toes, G.sph(R * .8, 8, 6), bare, 0, -R * .2, R * .6).scale.set(1, .45, 1.8);
            for (const ang of [-.4, -.13, .13, .4]) {
                const tg = grp(toes, Math.sin(ang) * R * .5, -R * .32, R * 1.1);
                tg.rotation.y = ang;
                add(tg, limbGeo(R * 1.6, R * .22, R * .15, 0, .5, .8, 5), bare).rotation.x = -Math.PI / 2;
                add(tg, G.cone(R * .16, R * .75, 5), claw, 0, -R * .05, R * 1.9).rotation.x = Math.PI / 2 + .35;
            }
            J[name] = { top, knee, low, toes, hind: true, side: s, walk: s > 0 ? 0 : .5, gal: s > 0 ? 0 : .5 };
        }

        // one massive furry body on the lean joint: pear-shaped, belly forward, hunched shoulder hump
        J.chest = grp(J.body, 0, .02, 0);
        const back = new THREE.Color(.78, .78, .8), front = new THREE.Color(1, 1, 1);
        const BS = [[-.4, .03, 0, 0], [-.35, .03, .29, .26], [-.12, .05, .45, .4], [.2, .08, .5, .44], [.47, .06, .5, .42],
            [.73, 0, .46, .38], [.93, -.07, .39, .32], [1.06, -.11, .25, .21], [1.12, -.13, 0, 0]];
        const lump = (a, u) => 1 + .03 * Math.sin(a * 5 + u * 3) * Math.sin(u * 4.3) + .04 * Math.exp(-(((Math.abs(a) - 2.2) / .5) ** 2)) * sstep(4, 6, u) * (1 - sstep(6.5, 7.5, u));
        const body = add(J.chest, loftGeo('manyheadBody', BS, {
            rings: 30, radial: 18, rmul: lump,
            col: (o, a) => o.copy(back).lerp(front, sstep(.8, 2.6, Math.abs(a)))
        }), fur);
        body.castShadow = true;

        // arms: shaggy upper arm, thin bare forearm and long claws
        J.arms = [];
        for (const s of [1, -1]) {
            const sh = grp(J.chest, s * .4, .72, .2);
            sh.rotation.order = 'ZXY';
            add(sh, G.sph(.12, 9, 7), furP, 0, -.02, 0);
            add(sh, limbGeo(.32, .1, .07, .4, .3), furP);
            const el = grp(sh, 0, -.32, 0);
            add(el, G.sph(.06, 8, 6), furP);
            add(el, limbGeo(.3, .065, .04, .3, .25), furP);
            const hand = grp(el, 0, -.3, 0);
            add(hand, G.sph(.05, 8, 6), bare, 0, -.02, .01).scale.set(1.2, .9, .7);
            for (let i = 0; i < 4; i++) {
                const a = (i - 1.5) * .3;
                const fg = grp(hand, Math.sin(a) * .045, -.04, .015);
                fg.rotation.set(-.25, 0, a * .4);
                add(fg, limbGeo(.08, .012, .009, 0, .5, .8, 5), bare);
                add(fg, G.cone(.01, .085, 5), claw, 0, -.12, .02).rotation.x = Math.PI - .5;
            }
            J.arms.push({ sh, el, hand, s });
        }
        this.buildRatHeads();
    }

    // smooth rat head on `parent`, size factor s; returns { head, jaw }
    ratHead(parent, s, whiskers) {
        const c = this.c, M = this.mats;
        const tooth = this.toothMat || (this.toothMat = mat(0xe0c070, { roughness: .4 }));
        const mouth = this.mouthMat || (this.mouthMat = mat(0x6a1a20, { roughness: .8 }));
        const ear = this.earMat || (this.earMat = mat(c.ear, { roughness: .8 }));
        const eyeM = this.eyeMat || (this.eyeMat = mat(c.eye, { roughness: .1, emissive: 0x7a1010, emissiveIntensity: .7 }));
        const nose = this.noseMat || (this.noseMat = mat(0xc08a88, { roughness: .5 }));
        const head = grp(parent);
        head.scale.setScalar(s);
        const k = new THREE.Color(1, 1, 1), kd = new THREE.Color(.7, .7, .72);
        add(head, loftGeo('ratSkull', [[.02, -.13, 0, 0], [.025, -.11, .07, .07], [.03, -.05, .105, .095], [.02, .02, .095, .08],
            [0, .09, .065, .055], [-.015, .15, .042, .036], [-.022, .195, .024, .021], [-.024, .21, 0, 0]],
        { rings: 20, radial: 12, col: (o, a) => o.copy(kd).lerp(k, sstep(.5, 2, Math.abs(a))) }), M.fur);
        add(head, G.sph(.017, 7, 5), nose, 0, -.02, .205);
        add(head, G.sph(1, 8, 6), mouth, 0, -.05, .1).scale.set(.042, .02, .085);
        add(head, G.box(.016, .034, .008), tooth, 0, -.045, .185);                                  // incisors
        add(head, teethGeo(6, .036, .07, .06, -.05, .024, -1), tooth);
        const jaw = grp(head, 0, -.05, .03);
        add(jaw, loftGeo('ratJaw', [[0, -.02, 0, 0], [0, 0, .05, .028], [-.005, .07, .042, .022], [-.008, .13, .022, .014], [-.008, .15, 0, 0]],
            { rings: 10, radial: 10 }), M.furP);
        add(jaw, G.box(.014, .03, .008), tooth, 0, .02, .13);
        add(jaw, teethGeo(5, .03, .06, .02, .005, .022, 1), tooth);
        for (const q of [1, -1]) {
            add(head, G.sph(.017, 7, 5), eyeM, q * .055, .05, .07);
            const eg = grp(head, q * .065, .085, -.03);
            eg.rotation.set(-.2, q * .5, q * .35);
            add(eg, G.sph(.05, 10, 7), M.furP, 0, .03, 0).scale.set(1, 1, .28);
            add(eg, G.sph(.04, 9, 6), ear, 0, .03, .008).scale.set(1, 1, .2);
            if (whiskers) for (let w = 0; w < 3; w++) {
                const wh = add(head, G.cyl(.0015, .0008, .22, 3), M.bare, q * .1, -.01, .17, false);
                wh.rotation.set(0, -q * .3, q * (1.45 + (w - 1) * .15));
            }
        }
        return { head, jaw };
    }

    buildRatHeads() {
        const J = this.j, M = this.mats;
        // main head low in front of the chest
        J.neck = grp(J.chest, 0, .62, .32);
        add(J.neck, limbGeo(.16, .14, .12, 0, .5), M.furP).rotation.x = Math.PI;
        const main = this.ratHead(J.neck, 1.9, true);
        main.head.position.y = .16;
        J.head = main.head; J.jaw = main.jaw;
        // four more heads on short necks around the shoulder hump
        J.xheads = [];
        const spots = [[.4, .86, .02, 1.05, .15], [-.4, .86, .02, -1.05, .15], [.18, 1.04, -.06, .5, -.15], [-.18, 1.04, -.06, -.5, -.15]];
        spots.forEach(([x, y, z, sp, up], i) => {
            const neck = grp(J.chest, x, y, z);
            neck.rotation.order = 'YXZ';
            add(neck, limbGeo(.2, .1, .085, 0, .5), M.furP).rotation.x = Math.PI;
            const h = this.ratHead(neck, 1.65, false);
            h.head.position.y = .2;
            J.xheads.push({ neck, head: h.head, jaw: h.jaw, sp, up, ph: i * 1.7 + .5, delay: [.06, .14, 0, .1][i] });
        });
        // three naked tails trailing on the ground
        J.tails = [];
        J.tailBase = grp(J.body, 0, -.05, -.3);                                                   // kept level: tails are solved on the ground
        J.tailBase.rotation.order = 'ZYX';
        const tm = M.bare, N = 9, l = .17;
        this.tailRadii = [];
        for (let k = 0; k <= N; k++) this.tailRadii.push(.032 * (1 - .8 * k / N));
        for (let i = 0; i < 3; i++) {
            const root = grp(J.tailBase, (i - 1) * .08, 0, 0);
            root.rotation.order = 'YXZ';
            const segs = [];
            let p = root;
            for (let k = 0; k < N; k++) {
                const g = k === 0 ? root : grp(p, 0, 0, l);
                g.rotation.order = 'YXZ';
                const r0 = this.tailRadii[k], r1 = this.tailRadii[k + 1];
                add(g, cachedGeo(`rtail${k},${l}`, () => new THREE.CylinderGeometry(r1, r0, l, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, l / 2)), tm);
                add(g, G.sph(r0, 6, 4), tm);
                segs.push(g);
                p = g;
            }
            J.tails.push({ segs, yaw: (i - 1) * .45, ph: i * 2.1, t: 0, live: 1 });
        }
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const p = this.attP = c.actionDuration ? 1 - c.actionTime / c.actionDuration : (this.stateTime / .8) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .14));
                if (p > .52) P = this.mix(P, this.A3, smooth((p - .52) / .2));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.jaw += Math.sin(t * 7) * .08;
                P.hjaw += Math.sin(t * 6.3) * .1;
                P.neckY = Math.sin(t * 1.7) * .15;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.SIT;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return state === 'idle' ? this.idlePose() : this.STAND;
        }
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j;
        for (const name of ['HL', 'HR']) {
            const L = J[name];
            L.toes.rotation.x = -(q.bx + L.top.rotation.x + L.knee.rotation.x + L.low.rotation.x);
        }
        J.chest.rotation.x = q.lean + (g > .01 ? .1 * g + .08 * run : 0);
        for (const A of J.arms) {
            const swing = g > .01 ? Math.sin(this.phase + (A.s > 0 ? Math.PI : 0)) * (.35 + .2 * run) * g : 0;
            A.sh.rotation.x = q.armX - q.bx - J.chest.rotation.x + swing;
            A.sh.rotation.z = A.s * q.armZ;
            A.el.rotation.x = q.armK;
            A.hand.rotation.x = q.hand;
        }
        const att = state === 'attack' ? this.attP : -1;
        const still = state === 'death' ? 0 : 1;
        for (const H of J.xheads) {
            let lunge = 0, jaw = q.hjaw;
            if (att >= 0) {                                                                        // staggered bites
                const x = clamp((att - .28 - H.delay) / .3, 0, 1);
                lunge = Math.sin(Math.PI * x);
                jaw = x > 0 && x < .6 ? .9 : jaw;
            }
            const look = state === 'idle' ? Math.sin(t * .8 + H.ph) * .35 : 0;
            const snap = state === 'idle' ? Math.max(0, Math.sin(t * 2.3 + H.ph * 3)) ** 8 * .6 : 0;
            H.neck.rotation.set(H.up + .35 + q.hx + lunge * 1.1 - q.lean * .6 + Math.sin(t * 1.3 + H.ph) * .06 * still,
                H.sp * (1 + q.hsp * .6) * .6 + look, H.sp * .5 * (1 + q.hsp));
            H.head.rotation.x = -.35 - q.hx * .3 - lunge * .3;
            H.jaw.rotation.x = jaw + snap + Math.sin(t * 7 + H.ph) * .05 * (q.hsp + (state === 'defend' ? 1 : 0));
        }
        J.tailBase.rotation.set(-q.bx, 0, -q.roll);
        const y0 = this.H + q.by - .05, live = state === 'death' || state === 'lie' ? .2 : 1;
        for (const T of J.tails) {                                                                 // tails lie on the ground and swish
            T.t = t; T.live = live;
            solveChain(T.segs, y0, q.tailX, T.yaw + Math.PI + Math.sin(t * .9 + T.ph) * .2 * live, .17, this.tailRadii, tailBend, tailSide, T);
        }
    }
}

// ------------------------------------------------------------------ facade
const RIGS = { shark: Shark, octopus: Octopus, illusion: Illusion, klobg: Klobg, manyhead: Manyhead };

export class ProceduralAquatic {
    constructor(variant = 'shark', { scale = 1 } = {}) {
        this.variant = AQUATIC_VARIANTS[variant] ? variant : 'shark';
        const c = { ...AQUATIC_VARIANTS[this.variant] };
        this.rig = new RIGS[c.kind](c, scale || 1);
        this.root = this.rig.root;
        this.j = this.rig.j;
        this.root.userData.variant = this.variant;
    }
    update(c, dt) { this.rig.update(c, dt); }
}
