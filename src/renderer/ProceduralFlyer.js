import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { DIRECTIONS } from '../utils/constants.js';
import { TAU, smooth, damp } from './QuadrupedRig.js';
import { taperTube, glowMat, flameTongue, flickerFlames } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralFlyer — birds and bats flying over the battlefield (hovering 1–2 m above the ground).
 * Kinds:
 *   bird    — eagle (giant royal eagle: blackish brown, golden head and nape, pale-fringed coverts, white tail with a
 *             dark band, feathered legs), phoenix (huge crimson bird: glowing feathers with golden flame tips, flame
 *             tongues on the wing tips, crest, long streaming red-to-gold tail plumes, halo; attack adds a fiery wing
 *             buffet and a jet of flame from the beak)
 *   gryffon — eagle front (brown head with white cheeks and ear tufts, white bib, bird fore-legs with talons, barred
 *             wings held raised) on a tawny lion's body (muscular hind legs with paws, tufted tail). Walks on four legs
 *             with folded wings, flies when running / attacking.
 *   harpy   — woman (face, long wind-blown hair, sleeveless tunic) whose bare arms carry the white, brown-barred wings;
 *             feathered bird legs with talons below the tunic, barred tail.
 *   bat     — giant bat (reddish fur, huge ears, brown membranes), vampire in bat form, elder vampire (bigger, darker,
 *             glowing red eyes): furry body, pointed snout, fanged jaw, veined membrane wings (one membrane per wing,
 *             re-shaped every frame from the finger bones).
 * Bodies, heads, necks and limbs are smooth spine tubes (spineGeo: rings along a Catmull-Rom spine, vertex colours for
 * back / belly / throat, canvas feather or fur texture). Feather wings: arm ─ forearm ─ hand bones carrying tertials,
 * secondaries, coverts and fanned primaries; every feather is a thin blade with vertex colours (top / underside / pale
 * fringe / bars / tip band). Both wing kinds fold back along the flank.
 *
 *   root (yaw, scale)
 *   └─ body (height y, lunge bz, pitch bx, roll)
 *      ├─ wings L/R  (set(spread, flap, sweep, pitch))
 *      ├─ neck ─ head ─ jaw          (harpy: body ─ waist ─ torso ─ neck ─ head)
 *      ├─ legs (bird: hip ─ knee ─ foot ─ toes; gryffon: + lion hind legs)
 *      └─ tail (feather fan / lion tail / phoenix plumes / bat tail membrane)
 *
 * States: idle (hovering with slow wing beats, looking around; gryffon stands), walk / run (faster beats, body pitched
 * forward, legs tucked; gryffon walks on four legs, flies when running), attack (rises → dives → strikes with talons /
 * beak / bite → recovers; gryffon leaps up, strikes with talons and beak), defend (wings spread wide and raised,
 * screech; gryffon rears up), hit (knocked back in the air), kneel (landed, wings folded), lie (resting on the belly),
 * death (falls to the ground, lies with the wings spread limp).
 */

export const FLYER_VARIANTS = {
    eagle: { kind: 'bird', scale: 1.5, hover: 1.05, body: 0x2e2016, belly: 0x3a2818, head: 0xb8894a, throat: 0x4a3420, feather: 0x2a1d13,
        under: 0x9a8a78, covert: 0x4a321c, edge: 0xa07a48, tip: 0x120d09, tail: 0xeeeae2, tailTip: 0x1e150e, beak: 0xe2b838, beakTip: 0x34302c,
        leg: 0xe8b830, eye: 0xc88a20 },
    phoenix: { kind: 'bird', phoenix: true, scale: 2, hover: 1.1, body: 0xb01810, belly: 0xd84018, chest: 0xe86020, head: 0xc01c10, throat: 0xd84018,
        feather: 0xd02818, under: 0xff9a30, covert: 0xe04818, edge: 0xffa030, tip: 0xffc040, tail: 0xd8281a, tailTip: 0xffb030, beak: 0xf0c860,
        beakTip: 0x8a4a10, leg: 0x7a2008, eye: 0xfff0a0, glow: 0xff7a20 },
    gryffon: { kind: 'gryffon', scale: 1.6, hover: 1.1, body: 0x5e3c1e, belly: 0xf2ece0, head: 0x5a3a1c, face: 0xf0ead8, coat: 0xc48a3a,
        coatLight: 0xe4c088, feather: 0xe6dcc8, bars: 3, bar: 0x8a6c4c, under: 0xe8e0d0, covert: 0x6a4424, edge: 0xc8a070, tip: 0x3a2a1c,
        beak: 0xe8c040, beakTip: 0x5a4a30, leg: 0xe0b030, eye: 0xd09020, tuft: 0x3a2414 },
    harpy: { kind: 'harpy', scale: 1, hover: 1.35, body: 0x7a5a40, feather: 0xece6da, bars: 3, bar: 0x7a5a40, under: 0xf2eee6, covert: 0x8a6a4c,
        edge: 0xe2d6c2, tip: 0x4a3626, tail: 0xe8e0d4, tailTip: 0x3a2a1c, leg: 0x6a5a4a, skin: 0xe2bc9c, hair: 0x5a3a22, cloth: 0xd8cfbc,
        lips: 0xb0545a, eye: 0x3a5a30 },
    'giant-bat': { kind: 'bat', scale: 1.05, hover: 1.25, fur: 0x9a5e46, belly: 0xb8846a, face: 0x8a5240, membrane: 0x7a5442, bone: 0x3a2620,
        ear: 0xa86a5a, eye: 0x100a08, ears: 1.25, glowThrough: .45 },
    'vampire-bat-form': { kind: 'bat', scale: 1.15, hover: 1.2, fur: 0x1c1418, belly: 0x2e2226, face: 0x2c1e22, membrane: 0x4e2440, bone: 0x1a0e14,
        ear: 0x4a2034, eye: 0xff2010, glowEye: true, ears: 1.2 },
    'vampire-elder-bat-form': { kind: 'bat', scale: 1.45, hover: 1.1, fur: 0x120c0e, belly: 0x1e1418, face: 0x1c1216, membrane: 0x40182c, bone: 0x100a0c,
        ear: 0x34101e, eye: 0xff1008, glowEye: true, elder: true }
};

// Every pose key (the kinds add their values in makePoses).
const KEYS0 = {
    y: 1, bz: 0, bx: 0, roll: 0, turn: 0, spread: 1, flapAmp: .7, flapBias: .1, flapRate: 1, sweep: 0, wingX: 0,
    neckX: .6, headX: 0, headY: 0, jaw: 0, legX: .5, legK: -.3, foot: .8, toe: .4, tailX: .1, tailFan: .6,
    waist: 0, hair: 0, ear: 0, flame: 1, jet: 0, air: 1,
    FL0: 0, FL1: 0, HL0: 0, HL1: 0, HL2: 0
};

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// Feather blade along -z (quill at the origin): top face coloured `top`, underside `under`, the last `frac` of its length `tip`.
// o.edge: colour of the top face's side edges (pale fringe); o.bars + o.bar: number of dark cross bars and their colour.
function featherGeo(len, w, top, under, tip = top, frac = 0, o = {}) {
    const { edge = null, bars = 0, bar = 0 } = o;
    return cached(`f${len},${w},${top},${under},${tip},${frac},${edge},${bars},${bar}`, () => {
        const rows0 = [0, .12, .35, .6, .82, 1].map(t => [t, 0]);
        const cut = t => { rows0.push([t, -1], [t + .002, 1]); };
        if (frac > 0) cut(1 - frac);
        const end = 1 - frac;
        for (let i = 0; i < bars; i++) { cut(end * (i + .62) / bars); cut(end * (i + .82) / bars); }
        rows0.sort((a, b) => a[0] - b[0]);
        const pos = [], col = [], idx = [], cTop = new THREE.Color(top), cUnder = new THREE.Color(under), cTip = new THREE.Color(tip);
        const cEdge = edge === null ? null : new THREE.Color(edge), cBar = new THREE.Color(bar);
        const th = Math.max(.0015, w * .025), ridge = w * .08;
        const zone = t => frac > 0 && t > end ? 2 : bars && t < end && (t / end * bars) % 1 > .62 && (t / end * bars) % 1 < .82 ? 1 : 0;
        const rows = rows0.map(([t, sd]) => {
            const hw = w / 2 * Math.sin(Math.min(1, (t + .1) / .5) * Math.PI / 2) * (t > .72 ? 1 - (t - .72) / .28 * .8 : 1);
            return { z: -len * t, hw, zone: zone(t + sd * .0005) };
        });
        for (const r of rows) {                                                 // top row vertices (L, C, R) then bottom
            const c = r.zone === 2 ? cTip : r.zone === 1 ? cBar : cTop, ce = r.zone === 0 && cEdge ? cEdge : c;
            for (const [x, y, cc] of [[-r.hw, th, ce], [0, th + ridge, c], [r.hw, th, ce]]) { pos.push(x, y, r.z); col.push(cc.r, cc.g, cc.b); }
        }
        for (const r of rows) {
            const c = r.zone === 2 ? cTip : r.zone === 1 ? cBar : cUnder;
            for (const [x, y] of [[-r.hw, -th], [0, -th - ridge * .3], [r.hw, -th]]) { pos.push(x, y, r.z); col.push(c.r, c.g, c.b); }
        }
        const n = rows.length, B = n * 3;
        for (let i = 0; i < n - 1; i++) {
            const a = i * 3, b = a + 3;
            idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
            idx.push(B + a, B + b, B + a + 1, B + a + 1, B + b, B + b + 1, B + a + 1, B + b + 1, B + a + 2, B + a + 2, B + b + 1, B + b + 2);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    });
}

// Flat plume ribbon along -z from width w0 to w1, colour c0 → c1 (two-sided via a thin ridge).
function stripGeo(len, w0, w1, c0, c1) {
    return cached(`st${len},${w0},${w1},${c0},${c1}`, () => {
        const pos = [], col = [], idx = [], A = new THREE.Color(c0), B = new THREE.Color(c1), c = new THREE.Color();
        const n = 4;
        for (let i = 0; i <= n; i++) {
            const t = i / n, hw = (w0 + (w1 - w0) * t) / 2, z = -len * t;
            c.copy(A).lerp(B, t);
            for (const [x, y] of [[-hw, 0], [0, hw * .25], [hw, 0], [0, -hw * .25]]) { pos.push(x, y, z); col.push(c.r, c.g, c.b); }
        }
        for (let i = 0; i < n; i++) {
            const a = i * 4, b = a + 4;
            for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    });
}

// Catmull-Rom on arrays of numbers (spine points [x, y, z, rx, ry]).
function crArr(p0, p1, p2, p3, t, out) {
    const t2 = t * t, t3 = t2 * t;
    for (let i = 0; i < p1.length; i++) {
        out[i] = .5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    }
    return out;
}

// Smooth closed body along a spine: pts = [[x, y, z, rx, ry], ...] (rx sideways, ry towards `up`), subdivided `sub` times
// per span; rings of `seg` vertices. col(t, a, out) writes the vertex colour for spine parameter t (0..1) and ring angle a
// (0 = top, π = underside). UVs: u around (uRep repeats), v along the length (vRep repeats per metre). Ends are capped.
function spineGeo(key, pts, { seg = 14, sub = 3, col = null, uRep = 2, vRep = 6, up = [0, 1, 0] } = {}) {
    return cached('sp' + key, () => {
        const S = [];
        const n = pts.length;
        for (let i = 0; i < n - 1; i++) {
            for (let k = 0; k < sub; k++) {
                S.push(crArr(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n - 1, i + 2)], k / sub, []));
            }
        }
        S.push(pts[n - 1].slice());
        const pos = [], uv = [], colA = [], idx = [];
        const T = new THREE.Vector3(), N = new THREE.Vector3(...up), B = new THREE.Vector3(), P = new THREE.Vector3(), v = new THREE.Vector3();
        const cc = new THREE.Color(1, 1, 1);
        let len = 0;
        const R = seg + 1;
        S.forEach((s, i) => {
            const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
            T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
            N.addScaledVector(T, -N.dot(T)).normalize();                       // parallel transport of the up vector
            B.crossVectors(T, N);
            if (i > 0) len += Math.hypot(s[0] - S[i - 1][0], s[1] - S[i - 1][1], s[2] - S[i - 1][2]);
            P.set(s[0], s[1], s[2]);
            const t = i / (S.length - 1);
            for (let j = 0; j <= seg; j++) {
                const ang = j / seg * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
                v.copy(P).addScaledVector(N, ca * s[4]).addScaledVector(B, sa * s[3]);
                pos.push(v.x, v.y, v.z);
                uv.push(j / seg * uRep, len * vRep);
                if (col) col(t, ang <= Math.PI ? ang : TAU - ang, cc);
                colA.push(cc.r, cc.g, cc.b);
            }
            if (i > 0) for (let j = 0; j < seg; j++) {
                const p = (i - 1) * R + j, q = i * R + j;
                idx.push(p, p + 1, q, p + 1, q + 1, q);
            }
        });
        // caps
        for (const [ri, dir] of [[0, -1], [S.length - 1, 1]]) {
            const c = pos.length / 3, s = S[ri];
            pos.push(s[0], s[1], s[2]);
            const o = ri * R;
            const a = S[Math.max(0, ri - 1)], b = S[Math.min(S.length - 1, ri + 1)];
            uv.push(.5, ri ? len * vRep : 0);
            colA.push(colA[o * 3], colA[o * 3 + 1], colA[o * 3 + 2]);
            for (let j = 0; j < seg; j++) dir < 0 ? idx.push(c, o + j, o + j + 1) : idx.push(c, o + j + 1, o + j);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const nm = g.attributes.normal;                                        // weld the seam normals
        for (let i = 0; i < S.length; i++) {
            const p = i * R, q = p + seg;
            v.set(nm.getX(p) + nm.getX(q), nm.getY(p) + nm.getY(q), nm.getZ(p) + nm.getZ(q)).normalize();
            nm.setXYZ(p, v.x, v.y, v.z); nm.setXYZ(q, v.x, v.y, v.z);
        }
        return g;
    });
}

// Colour helpers for spineGeo: blend between `top` and `under` around the ring (`edge` = angle where it switches),
// optionally towards `end` over the spine from t0 to t1.
const _ca = new THREE.Color(), _cb = new THREE.Color();
function ringCol(top, under, edge = 1.9, soft = .5, end = null, t0 = 0, t1 = 1) {
    const A = new THREE.Color(top), U = new THREE.Color(under), E = end === null ? null : new THREE.Color(end);
    return (t, a, out) => {
        out.copy(A).lerp(U, smooth((a - edge + soft / 2) / soft));
        if (E) out.lerp(E, smooth((t - t0) / (t1 - t0)));
    };
}

// Material cache keyed by texture uuid (kit's mat() would serialize the canvas into its key).
const tmatCache = new Map();
function tmat(color, opts) {
    const key = color + '|' + Object.entries(opts).map(([k, v]) => k + ':' + (v && v.isTexture ? v.uuid : v)).join(',');
    if (!tmatCache.has(key)) tmatCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...opts }));
    return tmatCache.get(key);
}

// Grey-scale canvas textures multiplied with the vertex colours (null outside a browser).
const texCache = new Map();
function canvasTex(name, size, draw) {
    if (texCache.has(name)) return texCache.get(name);
    let tex = null;
    if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        draw(cv.getContext('2d'), size);
        tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(name, tex);
    return tex;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// overlapping contour feathers (scallops pointing back = -v)
const featherTex = () => canvasTex('feather', 128, (g, S) => {
    g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
    const w = S / 4, h = S / 6;
    for (let r = -1; r < 8; r++) for (let c = -1; c < 5; c++) {
        const x = c * w + (r % 2 ? w / 2 : 0), y = r * h;
        const gr = g.createLinearGradient(0, y - h, 0, y + h * .9);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(.75, '#e4e4e4'); gr.addColorStop(1, '#8a8a8a');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - w * .55, y - h); g.lineTo(x - w * .55, y + h * .2);
        g.quadraticCurveTo(x, y + h * 1.35, x + w * .55, y + h * .2); g.lineTo(x + w * .55, y - h); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y - h * .6); g.lineTo(x, y + h * .6); g.stroke();
    }
});
// short fur strands
const furTex = () => canvasTex('fur', 128, (g, S) => {
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
        const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 6, v = 120 + rnd() * 135 | 0;
        g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + rnd();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 2, y + l); g.stroke();
    }
});
// wing membrane: blotches and branching veins
const membraneTex = () => canvasTex('membrane', 256, (g, S) => {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
        const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 30, v = 110 + rnd() * 145 | 0;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},.7)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const vein = (x, y, a, l, w, d) => {
        if (d > 4 || l < 6) return;
        g.strokeStyle = `rgba(30,20,20,${.75 - d * .1})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y);
        let px = x, py = y;
        for (let k = 0; k < 4; k++) { a += (rnd() - .5) * .6; px += Math.cos(a) * l / 4; py += Math.sin(a) * l / 4; g.lineTo(px, py); }
        g.stroke();
        vein(px, py, a - .5 - rnd() * .4, l * .7, w * .7, d + 1);
        vein(px, py, a + .4 + rnd() * .4, l * .6, w * .7, d + 1);
    };
    for (let i = 0; i < 10; i++) vein(rnd() * S, rnd() * S, rnd() * TAU, 60 + rnd() * 50, 3, 0);
});

// Hooked talon / claw pointing +z, curling down.
const talonGeo = (r, l) => taperTube([[0, 0, 0], [0, -l * .08, l * .5], [0, -l * .42, l * .86], [0, -l * .86, l * .92]], r, r * .12, 6, 5);

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

export class ProceduralFlyer {
    constructor(variant = 'eagle', { scale = 1 } = {}) {
        this.variant = FLYER_VARIANTS[variant] ? variant : 'eagle';
        const c = this.c = { ...FLYER_VARIANTS[this.variant] };
        this.kind = c.kind;
        this.size = c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.scale.setScalar(this.size);
        this.root.name = 'flyer-' + this.kind;
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = Math.random() * TAU;
        this.step = 0;
        this.walkK = 0;
        this.yaw = null;
        this.state = null;
        this.stateTime = 0;
        this.fallV = 0;
        this.lookT = 0; this.look = 0; this.lookTimer = 1;
        this.flames = [];
        this.flareHolders = [];
        const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
            const mesh = new THREE.Mesh(geo, m);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };
        const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
        this.add = add;
        this.grp = grp;
        this.featherMat = c.phoenix ? mat(0xffffff, { vertexColors: true, roughness: .8, emissive: 0x902800, emissiveIntensity: .55 })
            : mat(0xffffff, { vertexColors: true, roughness: .92 });
        if (this.kind === 'bat') this.buildBat();
        else if (this.kind === 'harpy') this.buildHarpy();
        else if (this.kind === 'gryffon') this.buildGryffon();
        else this.buildBird();
        this.makePoses();
        this.KEYS = Object.keys(KEYS0);
        this.p = { ...this.STAND };
        this.T = { ...this.STAND };
    }

    // material for body parts (the phoenix glows)
    m(color, opts = {}) {
        return this.c.phoenix ? mat(color, { roughness: .8, emissive: color, emissiveIntensity: .35, ...opts }) : mat(color, { roughness: .92, ...opts });
    }

    /* ---------- parts ---------- */

    // Feather wing at the shoulder (x, y, z); side +1 = left (+x). set(spread 0..1, flap rad (+ up), sweep (+ back), pitch)
    // edge: pale fringe of tertials / coverts; bars + bar: barred flight feathers; arm: material of a visible (human) arm.
    featherWing(parent, s, { x, y, z, len, feather, under, covert, tip, edge = null, bars = 0, bar = 0, arm: armM = null }) {
        const add = this.add, grp = this.grp, fm = this.featherMat;
        const a = len * .24, f = len * .3, fo = { edge, bars, bar }, co = { edge };
        const root = grp(parent, x, y, z);
        root.rotation.order = 'YZX';
        const arm = grp(root), elbow = grp(arm, s * a, 0, 0), hand = grp(elbow, s * f, 0, 0);
        const bone = armM ?? this.m(covert);
        const lim = (g, l, r0, r1) => {
            add(g, spineGeo(`lim${l},${r0},${r1}`, [[0, 0, 0, r0 * .9, r0 * .8], [l * .3, 0, 0, r0, r0 * .9], [l * .75, 0, 0, r1 * 1.05, r1 * .95], [l, 0, 0, r1 * .8, r1 * .8]],
                { seg: 8, sub: 2 }), bone, 0, 0, -r0 * .3).scale.x = s;
        };
        const th = armM ? .66 : 1;
        lim(arm, a, len * .05 * th, len * .036 * th);
        lim(elbow, f, len * .036 * th, len * .026 * th);
        if (armM) {                                                          // human hand gripping the wing's leading edge
            add(hand, G.sph(len * .028, 8, 6), armM, s * len * .02, 0, len * .005).scale.set(1.5, .55, 1.1);
            for (let i = 0; i < 4; i++) add(hand, G.cyl(len * .006, len * .007, len * .05, 5), armM, s * len * (.055 + .004 * i), -len * .004, len * (.016 - i * .011)).rotation.z = Math.PI / 2;
        } else add(hand, G.sph(len * .03, 7, 5), bone).scale.set(1.6, .7, 1);
        const pivots = [], prim = [], sec = [];
        for (let i = 0; i < 4; i++) {                                       // tertials on the arm (fold forward)
            const pv = grp(arm, s * a * (i + .6) / 4, -.003, 0);
            add(pv, featherGeo(len * (.3 - i * .01), len * .12, covert, under, covert, 0, co), fm, 0, 0, -len * .02).rotation.y = s * .08;
            pivots.push([pv, -1]);
        }
        for (let i = 0; i < 6; i++) {                                       // secondaries along the forearm
            const pv = grp(elbow, s * f * (i + .5) / 6, -.004 - (i % 2) * .002, 0);
            const l = len * (.36 + i * .008);
            const mesh = add(pv, featherGeo(l, len * .12, feather, under, tip, .18, fo), fm, 0, 0, -len * .01);
            mesh.rotation.y = -s * .06 * i / 5;
            mesh.userData.len = l;
            pivots.push([pv, 1]);
            sec.push(mesh);
        }
        for (let i = 0; i < 5; i++) {                                       // coverts: short top layer on arm and forearm
            const onArm = i < 2, g = onArm ? arm : elbow, l0 = onArm ? a : f;
            const pv = grp(g, s * l0 * ((onArm ? i : i - 2) + .5) / (onArm ? 2 : 3), .012, 0);
            add(pv, featherGeo(len * .2, len * .11, covert, under, covert, 0, co), fm, 0, 0, len * .03);
            pivots.push([pv, onArm ? -1 : 1]);
        }
        const nP = 6;
        for (let i = 0; i < nP; i++) {                                       // primaries fanned from the hand
            const pv = grp(hand, s * len * .02 * i, -.006 - .003 * i, 0);
            const l = len * (.52 - i * .035);
            const mesh = add(pv, featherGeo(l, len * .095, feather, under, tip, .4, fo), fm);
            mesh.userData.len = l;
            prim.push(pv);
        }
        root.userData.prim = prim;
        const wing = {
            root, hand, elbow, sec, prim,
            set(spread, flap = 0, sweep = 0, pitch = 0) {
                const k = 1 - spread;
                root.rotation.y = s * (k * 1.3 + sweep);
                root.rotation.z = s * (flap - k * .12);
                root.rotation.x = k * .3 + pitch;
                elbow.rotation.y = -s * k * 2.6;
                elbow.rotation.z = -s * flap * .2 * spread;
                hand.rotation.y = s * k * 2.5;
                hand.rotation.z = -s * flap * .3 * spread;
                for (const [pv, dir] of pivots) pv.rotation.y = dir * s * k * 1.3;
                for (let i = 0; i < nP; i++) {
                    const open = 1.5 - i * .19, shut = 1.22 + i * .02;
                    prim[i].rotation.y = -s * (shut + (open - shut) * spread);
                }
            }
        };
        wing.set(1);
        return wing;
    }

    // Bat wing: arm, forearm, four fingers; one membrane re-shaped every frame between the finger tips and the hip.
    batWing(parent, s, { x, y, z, len, bone, membrane, hip }) {
        const add = this.add, grp = this.grp;
        const a = len * .2, f = len * .34;
        const root = grp(parent, x, y, z);
        root.rotation.order = 'YZX';
        const arm = grp(root), elbow = grp(arm, s * a, 0, 0), hand = grp(elbow, s * f, 0, 0);
        const bm = mat(bone, { roughness: .7 });
        const lim = (g, l, r) => { add(g, G.cyl(r * .7, r, l, 6), bm, s * l / 2, 0, 0).rotation.z = Math.PI / 2; };
        lim(arm, a, len * .032);
        lim(elbow, f, len * .022);
        add(hand, G.sph(len * .028, 7, 5), bm);
        add(hand, talonGeo(len * .01, len * .06), bm, 0, len * .01, len * .02);                                 // thumb claw
        const FL = [.2, .5, .45, .4], BACK = [-.5, .1, .8, 1.45];
        const fingers = [], tips = [];
        FL.forEach((fl, i) => {
            const fg = grp(hand);
            lim(fg, fl * len, len * (i === 1 ? .012 : .01));
            tips.push(grp(fg, s * fl * len, 0, 0));
            fingers.push(fg);
        });
        // membrane: shoulder, elbow, wrist, tips d2..d5, scallops between them, hip point
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(11 * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        //   0 shoulder 1 elbow 2 wrist 3 d2 4 d3 5 s34 6 d4 7 s45 8 d5 9 s5h 10 hip
        geo.setIndex([2, 3, 4, 2, 4, 5, 2, 5, 6, 2, 6, 7, 2, 7, 8, 2, 8, 9, 2, 9, 10, 1, 2, 10, 0, 1, 10]);
        const mem = add(root, geo, this.membraneMat(membrane));
        mem.frustumCulled = false;
        const P = [];
        for (let i = 0; i < 11; i++) P.push(new THREE.Vector3());
        const hipV = new THREE.Vector3(...hip);
        const set3 = (i, v) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; };
        const wing = {
            root, hand, fingers,
            set(spread, flap = 0, sweep = 0, pitch = 0) {
                const k = 1 - spread;
                root.rotation.y = s * (k * 1.25 + sweep);
                root.rotation.z = s * (flap - k * .1);
                root.rotation.x = k * 1.35 + pitch;
                elbow.rotation.y = -s * k * 2.5;
                elbow.rotation.z = -s * flap * .25 * spread;
                hand.rotation.y = s * k * 2.45;
                hand.rotation.z = -s * flap * .2 * spread;
                fingers.forEach((fg, i) => { fg.rotation.y = s * BACK[i] * (.12 + .88 * spread); });
                // membrane from the bones (relative to the wing root)
                root.updateMatrixWorld(true);
                _m.copy(root.matrixWorld).invert();
                P[0].set(0, 0, 0);
                P[1].setFromMatrixPosition(elbow.matrixWorld).applyMatrix4(_m);
                P[2].setFromMatrixPosition(hand.matrixWorld).applyMatrix4(_m);
                P[3].setFromMatrixPosition(tips[0].matrixWorld).applyMatrix4(_m);
                P[4].setFromMatrixPosition(tips[1].matrixWorld).applyMatrix4(_m);
                P[6].setFromMatrixPosition(tips[2].matrixWorld).applyMatrix4(_m);
                P[8].setFromMatrixPosition(tips[3].matrixWorld).applyMatrix4(_m);
                root.updateMatrix();
                _m2.copy(root.matrix).invert();
                P[10].copy(hipV).applyMatrix4(_m2);
                P[5].copy(P[4]).lerp(P[6], .5).lerp(P[2], .2);                  // scalloped trailing edge
                P[7].copy(P[6]).lerp(P[8], .5).lerp(P[2], .2);
                P[9].copy(P[8]).lerp(P[10], .5).lerp(P[2], .12);
                for (let i = 0; i < 11; i++) set3(i, P[i]);
                geo.attributes.position.needsUpdate = true;
                geo.computeVertexNormals();
            }
        };
        wing.set(1);
        const uv = new Float32Array(11 * 2);                                    // texture laid out on the spread wing
        for (let i = 0; i < 11; i++) { uv[i * 2] = Math.abs(pos[i * 3]) / len * 1.6; uv[i * 2 + 1] = pos[i * 3 + 2] / len * 1.6 + .5; }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        return wing;
    }

    // wing membrane: mottled, veined, faintly lit through (emissive)
    membraneMat(color) {
        const tex = membraneTex();
        return tmat(color, { roughness: .85, side: THREE.DoubleSide, map: tex, emissive: color, emissiveMap: tex, emissiveIntensity: this.c.glowThrough ?? .3 });
    }

    // Bird leg on `parent`: feathered thigh, scaly shank, three toes forward + one back, hooked talons.
    // trousers: feathered down to the ankle (eagle, harpy).
    birdLeg(parent, x, y, z, { th, sh, toe, r, upper, scale, talon, thighR = r * 2.4, trousers = false }) {
        const add = this.add, grp = this.grp;
        const top = grp(parent, x, y, z);
        const uc = typeof upper === 'number' ? upper : 0xffffff, col = ringCol(uc, new THREE.Color(uc).multiplyScalar(.8).getHex(), 1.6, 1.5);
        if (typeof upper === 'number') upper = this.bodyMat(featherTex());
        add(top, spineGeo(`thigh${th},${thighR},${uc}`, [[0, thighR * .3, 0, thighR * .6, thighR * .6], [0, -th * .25, .005, thighR * .85, thighR],
            [0, -th * .7, 0, thighR * .7, thighR * .75], [0, -th * 1.05, -.005, thighR * .3, thighR * .3]], { seg: 10, sub: 2, up: [0, 0, 1], uRep: 2, vRep: 10, col }), upper);
        const knee = grp(top, 0, -th, 0);
        if (trousers) add(knee, spineGeo(`trou${sh},${thighR},${uc}`, [[0, .01, 0, thighR * .55, thighR * .6], [0, -sh * .35, -.004, thighR * .5, thighR * .55],
            [0, -sh * .62, -.008, thighR * .42, thighR * .45], [0, -sh * .75, -.01, thighR * .1, thighR * .1]], { seg: 9, sub: 2, up: [0, 0, 1], uRep: 2, vRep: 10, col }), upper);
        add(knee, G.cyl(r * .85, r, sh, 7), scale, 0, -sh / 2, 0);
        const foot = grp(knee, 0, -sh, 0);
        add(foot, G.sph(r * 1.15, 7, 5), scale);
        const toes = [];
        for (const [ang, lf] of [[-.42, .9], [0, 1.05], [.42, .9], [Math.PI, .65]]) {
            const tg = grp(foot);
            tg.rotation.y = ang;
            const seg = grp(tg);
            const l = toe * lf;
            add(seg, G.cyl(r * .5, r * .75, l, 5), scale, 0, 0, l / 2).rotation.x = Math.PI / 2;
            add(seg, talonGeo(r * .5, toe * .6), talon, 0, 0, l);
            toes.push(seg);
        }
        return { top, knee, foot, toes };
    }

    // Bird head: smooth skull (paler throat / `face`), hooked two-tone beak (+ lower mandible on J.jaw), fierce eyes under
    // a brow ridge.
    birdHead(head, r, { color, beak, beakTip, eye, face = null }) {
        const add = this.add, J = this.j, k = r / .075;
        const cHead = new THREE.Color(color), cFace = new THREE.Color(face ?? color);
        const skull = spineGeo(`head${k},${color},${face}`, [[0, .004, -.078, .015, .015], [0, .01, -.062, .048, .05], [0, .014, -.025, .066, .068],
            [0, .01, .02, .062, .064], [0, -.004, .052, .046, .046], [0, -.012, .074, .028, .028], [0, -.014, .082, .01, .01]].map(p => p.map(v => v * k)),
        { seg: 14, sub: 3, uRep: 1, vRep: 40 / k, col: (t, a, out) => out.copy(cHead).lerp(cFace, smooth((a - 1.7) / .8) * (face ? 1 : .35)) });
        add(head, skull, this.bodyMat(featherTex()));
        const beakGeo = spineGeo(`beak${k},${beak},${beakTip}`, [[0, .004, -.01, .02, .024], [0, .007, .012, .019, .022], [0, .006, .034, .014, .017],
            [0, -.002, .052, .009, .011], [0, -.018, .064, .005, .006], [0, -.032, .066, .0015, .002]].map(p => p.map(v => v * k)),
        { seg: 10, sub: 3, col: ringCol(beak, beak, 9, 1, beakTip, .55, .9) });
        add(head, beakGeo, mat(0xffffff, { vertexColors: true, roughness: .4 }), 0, -r * .04, r * .88);
        add(head, G.sph(r * .24, 8, 6), mat(beak, { roughness: .5 }), 0, r * .04, r * .84).scale.set(1, .7, .7);    // cere
        J.jaw = this.grp(head, 0, -r * .3, r * .8);
        add(J.jaw, spineGeo(`mand${k},${beak}`, [[0, .004, -.005, .014, .008], [0, .0, .02, .012, .007], [0, -.003, .042, .006, .004],
            [0, -.004, .05, .001, .001]].map(p => p.map(v => v * k)), { seg: 8, sub: 2, col: ringCol(beak, beak) }), mat(0xffffff, { vertexColors: true, roughness: .45 }));
        const em = mat(eye, { roughness: .15, emissive: eye, emissiveIntensity: this.c.phoenix ? .9 : .15 }), dark = mat(0x0a0806, { roughness: .2 });
        const brow = this.m(cHead.clone().multiplyScalar(.7).getHex());
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(head, G.sph(r * .19, 8, 6), em, s * r * .74, r * .2, r * .5));
            add(head, G.sph(r * .1, 6, 5), dark, s * r * .85, r * .21, r * .56);
            const b2 = add(head, G.sph(r * .26, 8, 6), brow, s * r * .66, r * .36, r * .42);            // jutting brow ridge
            b2.scale.set(.6, .32, 1.25);
            b2.rotation.set(-.15, s * .3, -s * .3);
        }
    }

    // Tail fan of n feathers at (x, y, z); J.tailF animated by tailFan.
    tailFan(parent, x, y, z, n, len, w, top, under, tip, frac, o = {}) {
        const J = this.j;
        J.tail = this.grp(parent, x, y, z);
        J.tailF = [];
        for (let i = 0; i < n; i++) {
            const d = i - (n - 1) / 2;
            const pv = this.grp(J.tail, 0, -Math.abs(d) * .004, 0);
            this.add(pv, featherGeo(len * (1 - Math.abs(d) * .04), w, top, under, tip, frac, o), this.featherMat);
            pv.userData.d = d;
            J.tailF.push(pv);
        }
    }

    // Overlapping contour feathers on the back (breaks up the smooth body).
    backFeathers(parent, rows, color, under, tip, edge = null) {
        for (const [x, y, z, l, w, rx] of rows) {
            const m = this.add(parent, featherGeo(l, w, color, under, tip, .3, { edge }), this.featherMat, x, y, z);
            m.rotation.set(rx, x * 2, 0);
        }
    }

    // Flame tongue on `parent`, pointing along -z tilted up; the holder scales with the flare.
    flame(parent, x, y, z, size, color, tilt = .3) {
        const h = this.grp(parent, x, y, z);
        h.rotation.x = -Math.PI / 2 + tilt;
        this.flames.push(flameTongue(h, 0, 0, 0, size, color));
        const glow = haloSprite(color, size * 4.5, .55);                                             // soft fire around the tongue
        glow.position.y = size * .7;
        glow.raycast = () => {};
        h.add(glow);
        this.flareHolders.push(h);
        return h;
    }

    /* ---------- bodies ---------- */

    // vertex-coloured material for smooth spine bodies (the phoenix glows)
    bodyMat(tex, opts = {}) {
        return tmat(0xffffff, { vertexColors: true, map: tex, roughness: .9, ...(this.c.phoenix ? { emissive: 0x7a1400, emissiveIntensity: .55 } : {}), ...opts });
    }

    buildBird() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const legM = mat(c.leg, { roughness: .6 }), talon = mat(0x141210, { roughness: .35 });
        const fmat = this.bodyMat(featherTex());
        J.body = grp(this.root, 0, c.hover, 0);
        // one smooth torso: tail root → back / belly → chest → neck base
        add(J.body, spineGeo(`bird${this.variant}`, [[0, -.01, -.36, .02, .02], [0, 0, -.3, .07, .065], [0, 0, -.2, .115, .11], [0, 0, -.06, .148, .145],
            [0, .0, .07, .155, .158], [0, .02, .17, .142, .152], [0, .05, .25, .108, .118], [0, .08, .3, .065, .075], [0, .09, .32, .02, .02]],
        { seg: 16, sub: 3, uRep: 3, vRep: 7, col: ringCol(c.body, c.belly, 1.9, 1, c.chest ?? null, .6, .9) }), fmat);
        this.backFeathers(J.body, [
            [-.06, .125, .1, .2, .12, -.25], [.06, .125, .1, .2, .12, -.25], [0, .14, .04, .22, .14, -.2],
            [-.07, .105, -.04, .22, .12, -.15], [.07, .105, -.04, .22, .12, -.15], [0, .12, -.1, .22, .13, -.12]
        ], c.covert, c.belly, c.feather, c.edge);
        // neck (nape colour on the back of the neck) & head
        J.neck = grp(J.body, 0, .05, .23);
        const cB = new THREE.Color(c.body), cH = new THREE.Color(c.head), cT = new THREE.Color(c.throat ?? c.body);
        add(J.neck, spineGeo(`neck${this.variant}`, [[0, -.12, -.05, .03, .03], [0, -.07, -.03, .09, .09], [0, .0, -.005, .088, .09], [0, .08, .01, .072, .075], [0, .15, .02, .064, .068],
            [0, .19, .02, .03, .03]], { seg: 14, sub: 3, up: [0, 0, -1], uRep: 2, vRep: 9,
            col: (t, a, out) => out.copy(cB).lerp(cH, smooth((t - .15) / .5)).lerp(cT, smooth((a - 1.5) / 1.2) * .85) }), fmat);
        J.head = grp(J.neck, 0, .16, .02);
        this.birdHead(J.head, .075, { color: c.head, beak: c.beak, beakTip: c.beakTip, eye: c.eye });
        // legs: feathered "trousers" to the ankle, scaly yellow feet
        J.legs = [1, -1].map(s => this.birdLeg(J.body, .065 * s, -.06, .0,
            { th: .11, sh: .14, toe: .075, r: .016, upper: c.phoenix ? c.belly : c.body, scale: legM, talon, thighR: .058, trousers: !c.phoenix }));
        // tail
        this.tailFan(J.body, 0, .02, -.3, 9, .4, .1, c.tail, c.tailUnder ?? c.tail, c.tailTip, .35);
        // wings
        J.wings = [1, -1].map(s => this.featherWing(J.body, s, { x: .09 * s, y: .08, z: .1, len: 1.12,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip, edge: c.edge, bars: c.bars, bar: c.bar }));
        if (c.phoenix) this.buildPhoenix();
    }

    // phoenix: crest and tail plumes, flames on the wing tips, glow halo, beak flame jet
    buildPhoenix() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp, fm = this.featherMat;
        for (const [x, ry, rx, l] of [[0, 0, .9, .16], [.02, .25, .75, .13], [-.02, -.25, .75, .13]]) {     // crest
            const pv = grp(J.head, x, .06, -.03);
            pv.rotation.set(rx, ry, 0);
            add(pv, featherGeo(l, .035, c.head, c.feather, c.tip, .3), fm);
            if (x === 0) this.flame(pv, 0, 0, -l, .07, 0xffb030, .4);
        }
        J.plumes = [];
        const pc = [c.tail, 0xe03a14, 0xf06a1c, 0xffa030, 0xffd060, 0xfff0a0];
        for (const [x, ry, l, w] of [[0, 0, 1, 1], [.035, .2, .85, .9], [-.035, -.2, .85, .9], [.06, .42, .65, .75], [-.06, -.42, .65, .75]]) {   // long flowing tail plumes
            let p = grp(J.tail, x, -.012, 0);
            p.rotation.y = ry;
            const segs = [];
            for (let i = 0; i < 5; i++) {
                const g = grp(p), sl = .27 * l, w0 = w * (.045 + Math.sin((i + .2) / 5 * Math.PI) * .08), w1 = w * (.045 + Math.sin((i + 1.2) / 5 * Math.PI) * .08);
                add(g, stripGeo(sl, w0, i === 4 ? .004 : w1, pc[i], pc[i + 1]), fm);
                segs.push(g);
                p = grp(g, 0, 0, -sl * .97);
            }
            if (l === 1 || l < .7) this.flame(p, 0, 0, 0, .07, c.glow, .2);
            J.plumes.push(segs);
        }
        for (const w of J.wings) {
            w.prim.forEach((pv, i) => { if (i % 2 === 0) this.flame(pv.children[0], 0, 0, -pv.children[0].userData.len * .92, .08, i ? c.glow : 0xffb030); });
            w.sec.forEach((m, i) => { if (i === 3) this.flame(m, 0, 0, -m.userData.len * .9, .08, c.glow); });
        }
        J.halo = haloSprite(0xff8a30, 2, .35);
        J.halo.position.set(0, 0, .05);
        J.halo.raycast = () => {};
        J.body.add(J.halo);
        J.jet = grp(J.head, 0, -.02, .14);                                                                 // flame breath from the beak
        const o = add(J.jet, G.cone(.06, .7, 8), glowMat(0xff7a20, .8), 0, 0, .35);
        o.rotation.x = Math.PI / 2;
        const i2 = add(J.jet, G.cone(.03, .45, 6), glowMat(0xfff0b0, .9), 0, 0, .22);
        i2.rotation.x = Math.PI / 2;
        o.castShadow = i2.castShadow = false;
        J.jet.visible = false;
    }

    buildGryffon() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const coat = this.bodyMat(furTex(), { roughness: .95 }), fmat = this.bodyMat(featherTex());
        const legM = mat(c.leg, { roughness: .6 }), talon = mat(0x141210, { roughness: .35 }), light = mat(c.coatLight, { roughness: .95 });
        const coatCol = ringCol(c.coat, c.coatLight, 2.1, .9), coatC = ringCol(c.coat, c.coat);
        const cB = new THREE.Color(c.body), cW = new THREE.Color(c.belly);
        this.H0 = .565;
        J.body = grp(this.root, 0, this.H0, 0);
        // tawny lion body: rump → loins → ribs, front end hidden under the feathers
        add(J.body, spineGeo('gryLion', [[0, .0, -.52, .03, .03], [0, .01, -.47, .11, .11], [0, .015, -.37, .15, .155], [0, 0, -.24, .13, .14],
            [0, -.01, -.1, .125, .13], [0, .0, .04, .14, .15], [0, .02, .14, .12, .13]], { seg: 16, sub: 3, uRep: 3, vRep: 5, col: coatCol }), coat);
        // feathered eagle front: brown back, white bib on the chest
        add(J.body, spineGeo('gryFront', [[0, -.02, -.06, .05, .05], [0, 0, -.01, .145, .155], [0, .02, .11, .172, .182], [0, .035, .23, .16, .172],
            [0, .065, .32, .115, .125], [0, .1, .375, .055, .065], [0, .11, .39, .01, .01]], { seg: 16, sub: 3, uRep: 3, vRep: 7,
            col: (t, a2, out) => out.copy(cB).lerp(cW, smooth((a2 - 1.75) / .7) * smooth((t - .42) / .2)) }), fmat);
        this.backFeathers(J.body, [
            [-.07, .15, .2, .2, .12, -.2], [.07, .15, .2, .2, .12, -.2], [0, .17, .12, .22, .14, -.15],
            [-.1, .1, .03, .18, .11, -.05], [.1, .1, .03, .18, .11, -.05], [0, .15, .02, .2, .14, -.1]
        ], c.covert, c.under, c.body, c.edge);
        // neck (white throat) & head (ear tufts, white cheeks)
        J.neck = grp(J.body, 0, .1, .3);
        add(J.neck, spineGeo('gryNeck', [[0, -.12, -.05, .03, .03], [0, -.06, -.025, .11, .11], [0, .04, 0, .095, .1], [0, .14, .015, .078, .084],
            [0, .21, .02, .035, .035]], { seg: 14, sub: 3, up: [0, 0, -1], uRep: 2, vRep: 9,
            col: (t, a2, out) => out.copy(cB).lerp(cW, smooth((a2 - 1.7) / .9)) }), fmat);
        J.head = grp(J.neck, 0, .2, .02);
        this.birdHead(J.head, .085, { color: c.head, beak: c.beak, beakTip: c.beakTip, eye: c.eye, face: c.face });
        for (const s of [1, -1]) {
            const pv = grp(J.head, s * .05, .055, -.05);
            pv.rotation.set(.75, s * .35, 0);
            add(pv, featherGeo(.13, .032, c.tuft, c.tuft, c.tuft), this.featherMat);
        }
        // fore-legs: eagle legs with talons; hind-legs: muscular lion legs
        J.FL = this.birdLeg(J.body, .085, -.04, .22, { th: .24, sh: .24, toe: .085, r: .022, upper: c.body, scale: legM, talon, thighR: .062 });
        J.FR = this.birdLeg(J.body, -.085, -.04, .22, { th: .24, sh: .24, toe: .085, r: .022, upper: c.body, scale: legM, talon, thighR: .062 });
        J.FL.side = 1; J.FR.side = -1;
        for (const [name, x] of [['HL', .085], ['HR', -.085]]) {
            const top = grp(J.body, x, 0, -.32);
            add(top, spineGeo('gryThigh', [[0, .07, .02, .05, .06], [0, .0, .02, .085, .115], [0, -.11, 0, .075, .095], [0, -.21, -.01, .046, .05],
                [0, -.24, -.01, .02, .02]], { seg: 12, sub: 2, up: [0, 0, 1], uRep: 2, vRep: 6, col: coatC }), coat);
            const knee = grp(top, 0, -.22, 0);
            add(knee, spineGeo('gryShin', [[0, .03, 0, .03, .03], [0, -.01, -.01, .046, .05], [0, -.12, -.012, .032, .038], [0, -.22, 0, .027, .029],
                [0, -.24, 0, .01, .01]], { seg: 10, sub: 2, up: [0, 0, 1], uRep: 2, vRep: 6, col: coatC }), coat);
            const low = grp(knee, 0, -.22, 0);
            add(low, spineGeo('gryPastern', [[0, .02, 0, .02, .02], [0, -.01, 0, .029, .03], [0, -.1, .006, .028, .028], [0, -.13, .012, .03, .03]],
                { seg: 10, sub: 2, up: [0, 0, 1], col: coatC }), coat);
            add(low, G.sph(.048, 9, 7), light, 0, -.15, .025).scale.set(1, .55, 1.3);
            for (const cx of [-.022, 0, .022]) add(low, G.cone(.006, .03, 4), talon, cx, -.158, .075).rotation.x = Math.PI / 2 + .5;
            J[name] = { top, knee, low, side: x > 0 ? 1 : -1 };
        }
        // lion tail with a dark tuft
        const tailM = mat(c.coat, { roughness: .95 });
        J.tailRoot = grp(J.body, 0, .06, -.46);
        J.tailSeg = [];
        let p = J.tailRoot;
        for (let i = 0; i < 7; i++) {
            const g = grp(p), r0 = .028 - i * .002, r1 = .028 - (i + 1) * .002;
            add(g, G.cyl(r1, r0, .095, 7), tailM, 0, -.0475, 0);
            J.tailSeg.push(g);
            p = grp(g, 0, -.095, 0);
        }
        add(p, G.sph(.04, 8, 6), mat(c.tuft, { roughness: 1 }), 0, -.02, 0).scale.set(1, 1.6, 1);
        J.wings = [1, -1].map(s => this.featherWing(J.body, s, { x: .1 * s, y: .13, z: .2, len: 1.2,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip, edge: c.edge, bars: c.bars, bar: c.bar }));
    }

    buildHarpy() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const skin = mat(c.skin, { roughness: .65 }), cloth = mat(c.cloth, { roughness: .85 }), vc = mat(0xffffff, { vertexColors: true, roughness: .8 });
        const hairM = mat(c.hair, { roughness: .8 }), legM = mat(c.leg, { roughness: .6 }), talon = mat(0x101010, { roughness: .35 });
        const cC = new THREE.Color(c.cloth), cS = new THREE.Color(c.skin);
        J.body = grp(this.root, 0, c.hover, 0);
        // hem of the sleeveless tunic (soft folds), feathered bird legs below it, barred tail behind
        add(J.body, spineGeo('harpySkirt', [[0, .045, 0, .09, .07], [0, .0, 0, .104, .081], [0, -.06, -.003, .118, .092], [0, -.15, -.01, .13, .104],
            [0, -.165, -.01, .02, .02]], { seg: 18, sub: 3, up: [0, 0, 1],
            col: (t, a2, out) => out.copy(cC).multiplyScalar(.88 + .12 * Math.cos(a2 * 7) * smooth((t - .2) / .5)) }), vc);
        J.legs = [1, -1].map(s => this.birdLeg(J.body, .06 * s, -.11, 0,
            { th: .16, sh: .2, toe: .09, r: .018, upper: c.body, scale: legM, talon, thighR: .068, trousers: true }));
        this.tailFan(J.body, 0, -.08, -.08, 7, .44, .09, c.tail, c.under, c.tailTip, .25, { bars: 3, bar: c.bar });
        // woman's torso: one smooth body, tunic up to a low neckline, bare shoulders
        J.waist = grp(J.body, 0, .04, .0);
        add(J.waist, spineGeo('harpyTorso', [[0, -.05, 0, .092, .07], [0, .07, 0, .08, .062], [0, .16, .003, .095, .07], [0, .25, .006, .112, .08],
            [0, .32, -.004, .13, .072], [0, .37, -.008, .095, .06], [0, .405, -.008, .04, .035]], { seg: 24, sub: 6, up: [0, 0, 1],
            col: (t, a2, out) => {
                const y = -.05 + t * .455, neck = .31 - .045 * smooth((1 - a2) / 1) - .02 * Math.pow(Math.sin(a2), 6);
                out.copy(cC).lerp(cS, smooth((y - neck) / .012));
            } }), vc);
        for (const s of [1, -1]) {
            add(J.waist, G.sph(.04, 10, 8), cloth, s * .042, .25, .05).scale.set(1, .85, .6);          // bust under the tunic
            add(J.waist, G.sph(.034, 8, 6), skin, s * .122, .345, -.008);                                    // shoulders
        }
        J.neck = grp(J.waist, 0, .39, 0);
        add(J.neck, spineGeo('harpyNeck', [[0, -.02, 0, .04, .038], [0, .05, .003, .034, .032], [0, .11, .01, .03, .03]], { seg: 10, sub: 2, up: [0, 0, 1] }), skin);
        J.head = grp(J.neck, 0, .11, 0);
        const h = J.head;
        add(h, G.sph(.09, 14, 10), skin, 0, .02, .01).scale.set(.84, 1.05, .95);
        add(h, G.sph(.05, 10, 8), skin, 0, -.035, .04).scale.set(.95, .8, .9);                           // jaw line / chin
        add(h, G.sph(.014, 8, 6), skin, 0, .01, .092).scale.set(.75, 1.2, .9);                          // nose
        J.jaw = grp(h, 0, -.035, .07);
        add(J.jaw, G.sph(.015, 8, 6), mat(0x3a1010), 0, .001, .0).scale.set(1.2, .45, .5);              // mouth inside (shows when open)
        add(J.jaw, G.sph(.012, 8, 6), mat(c.lips, { roughness: .5 }), 0, -.003, .012).scale.set(1.15, .35, .45);   // lower lip
        add(h, G.sph(.013, 8, 6), mat(c.lips, { roughness: .5 }), 0, -.029, .083).scale.set(1.15, .3, .45);         // upper lip
        const white = mat(0xf2eee6, { roughness: .3 }), iris = mat(c.eye, { roughness: .2 }), dark = mat(0x161010);
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(h, G.sph(.014, 8, 6), white, s * .029, .03, .08));
            J.eyes[J.eyes.length - 1].scale.set(1.2, .75, .6);
            add(h, G.sph(.0075, 8, 6), iris, s * .029, .029, .087);
            const lid = add(h, G.box(.032, .003, .008), dark, s * .03, .039, .086);                        // dark lashes
            lid.rotation.z = s * .12;
            const brow = add(h, G.box(.03, .005, .008), hairM, s * .031, .052, .085);                     // angled brows: hidden malice
            brow.rotation.z = s * .38;
        }
        // hair: cap, long wind-blown locks down the back, side locks framing the face
        add(h, G.sph(.097, 14, 10, 0, TAU, 0, Math.PI * .58), hairM, 0, .035, -.008).scale.set(.9, 1.05, 1);
        add(h, G.sph(.085, 10, 8), hairM, 0, .0, -.04).scale.set(1, 1.05, .9);                               // back of the head
        J.hair = grp(h, 0, .05, -.06);
        for (const [x, l, r] of [[0, 1, .036], [.045, .9, .032], [-.045, .9, .032], [.08, .75, .026], [-.08, .75, .026], [.02, .8, .028], [-.025, .85, .03]]) {
            add(J.hair, taperTube([[x * .6, .02, .02], [x, -.06 * l, -.04], [x * 1.3, -.16 * l, -.07], [x * 1.6 + .01, -.27 * l, -.06], [x * 1.9 + .02, -.36 * l, -.02]],
                r, r * .15, 8, 6), hairM);
        }
        for (const s of [1, -1]) add(h, taperTube([[s * .07, .05, .03], [s * .085, -.01, .02], [s * .08, -.08, -.0], [s * .07, -.13, -.03]], .025, .006, 6, 5), hairM);
        J.wings = [1, -1].map(s => this.featherWing(J.waist, s, { x: .13 * s, y: .345, z: -.01, len: 1.15,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip, edge: c.edge, bars: c.bars, bar: c.bar, arm: skin }));
    }

    buildBat() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const fur = tmat(c.fur, { roughness: 1, map: furTex() }), face = mat(c.face, { roughness: .8 }), ear = mat(c.ear, { roughness: .8, side: THREE.DoubleSide });
        const furV = this.bodyMat(furTex(), { roughness: 1 }), cF = new THREE.Color(c.fur), cFace = new THREE.Color(c.face);
        const bone = mat(c.bone, { roughness: .7 }), fang = mat(0xf0ead8, { roughness: .3 }), claw = mat(0x0c0a0a, { roughness: .35 });
        const e = c.ears ?? (c.elder ? 1.15 : 1);
        J.body = grp(this.root, 0, c.hover, 0);
        // furry body (paler belly), thick shoulders and a ruff around the neck
        add(J.body, spineGeo(`bat${this.variant}`, [[0, -.02, -.21, .02, .02], [0, -.012, -.17, .06, .055], [0, 0, -.08, .095, .088], [0, .005, .02, .102, .095],
            [0, .015, .11, .108, .1], [0, .03, .18, .085, .08], [0, .03, .235, .03, .03]], { seg: 14, sub: 3, uRep: 3, vRep: 6,
            col: ringCol(c.fur, c.belly ?? c.fur, 1.9, 1) }), furV);
        J.neck = grp(J.body, 0, .03, .2);
        J.head = grp(J.neck, 0, 0, .06);
        const h = J.head;
        h.scale.setScalar(1.3);
        // skull running into a pointed, fox-like snout
        add(h, spineGeo(`batHead${this.variant}`, [[0, .0, -.075, .02, .02], [0, .006, -.058, .056, .052], [0, .006, -.02, .07, .064], [0, .0, .022, .062, .056],
            [0, -.01, .055, .044, .04], [0, -.016, .082, .03, .027], [0, -.016, .1, .019, .017], [0, -.016, .108, .006, .006]],
        { seg: 14, sub: 3, uRep: 2, vRep: 20, col: (t, a2, out) => out.copy(cF).lerp(cFace, smooth((t - .45) / .3)) }), furV);
        add(h, G.sph(.014, 6, 5), mat(0x140c0c), 0, -.004, .104).scale.set(1.4, .9, .7);                // nose
        add(h, G.cone(.012, .03, 4), face, 0, .015, .095).rotation.x = -.3;                               // nose leaf
        J.ears = [];
        for (const s of [1, -1]) {
            const eg = grp(h, s * .045, .045, -.01);
            const outer = add(eg, G.cone(.045 * e, .15 * e, 6), fur, 0, .065 * e, 0);
            outer.scale.z = .45;
            add(eg, G.cone(.032 * e, .12 * e, 6), ear, 0, .06 * e, .012).scale.z = .3;
            eg.rotation.set(-.15, 0, -s * .38);
            eg.userData.s = s;
            J.ears.push(eg);
            add(h, G.cone(.007 * e, .045 * e, 5), fang, s * .016, -.045, .085).rotation.x = Math.PI + .1;   // upper fangs
            const em = c.glowEye ? mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.6, roughness: .3 }) : mat(c.eye, { roughness: .15 });
            add(h, G.sph(.012 * e, 8, 6), em, s * .035, .02, .052);
        }
        if (c.elder) for (const s of [1, -1]) {
            const g = haloSprite(0xff2010, .12, .7);
            g.position.set(s * .036, .02, .06);
            g.raycast = () => {};
            h.add(g);
        }
        J.jaw = grp(h, 0, -.035, .02);
        add(J.jaw, G.sph(.032, 8, 6), face, 0, -.006, .045).scale.set(1, .45, 1.3);
        add(J.jaw, G.sph(.026, 8, 6), mat(0x4a1418), 0, .004, .04).scale.set(.9, .3, 1.2);                // mouth inside
        for (const s of [1, -1]) add(J.jaw, G.cone(.005 * e, .028 * e, 5), fang, s * .014, .012, .07);
        // legs hanging behind: thigh, shin, foot with five claws
        J.legs = [];
        for (const s of [1, -1]) {
            const top = grp(J.body, s * .05, -.04, -.12);
            add(top, G.cyl(.016, .022, .1, 6), fur, 0, -.05, 0);
            const knee = grp(top, 0, -.1, 0);
            add(knee, G.cyl(.01, .014, .1, 6), bone, 0, -.05, 0);
            const foot = grp(knee, 0, -.1, 0);
            add(foot, G.sph(.016, 6, 5), bone).scale.set(1.2, .6, 1.4);
            const toes = [];
            for (let i = 0; i < 5; i++) {
                const tg = grp(foot);
                tg.rotation.y = (i - 2) * .18;
                const seg = grp(tg);
                add(seg, talonGeo(.006, .04 * e), claw, 0, 0, .01);
                toes.push(seg);
            }
            J.legs.push({ top, knee, foot, toes });
        }
        // tail membrane between the legs
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.Float32BufferAttribute([.05, -.04, -.12, -.05, -.04, -.12, 0, -.08, -.32,
            .09, -.1, -.2, -.09, -.1, -.2], 3));
        tg.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2]);
        tg.setAttribute('uv', new THREE.Float32BufferAttribute([.4, 0, .6, 0, .5, .7, .2, .3, .8, .3], 2));
        tg.computeVertexNormals();
        add(J.body, tg, this.membraneMat(c.membrane));
        J.wings = [1, -1].map(s => this.batWing(J.body, s, { x: .06 * s, y: .04, z: .1, len: 1.12 * (c.elder ? 1.05 : 1), bone: c.bone,
            membrane: c.membrane, hip: [s * .07, -.05, -.2] }));
    }

    /* ---------- poses ---------- */

    makePoses() {
        const H = this.c.hover, kind = this.kind;
        const P = o => ({ ...KEYS0, ...this.BASE, ...o });
        if (kind === 'bat') {
            this.BASE = { y: H, bx: -.35, flapAmp: .9, flapRate: 2.3, flapBias: .2, neckX: 0, headX: 0, legX: .7, legK: .3, foot: .6, toe: .5, air: 1 };
            this.STAND = P({});
            this.WALK = P({ bx: -.28, flapRate: 2.9, legX: 1.1, legK: .2 });
            this.RUN = P({ bx: -.05, flapRate: 3.5, flapAmp: .95, legX: 1.4, legK: .1, sweep: .05 });
            this.A1 = P({ y: H + .35, bz: -.2, bx: -.85, flapBias: .25, flapRate: 3.2, legX: .3, jaw: .25, ear: .5 });
            this.A2 = P({ y: H - .22, bz: .45, bx: .3, spread: .85, flapBias: .85, flapAmp: .08, sweep: .45, legX: -.4, toe: -.3, jaw: 1, ear: 1, headX: -.1 });
            this.A3 = P({ y: H - .28, bz: .5, bx: .1, flapBias: -.35, flapAmp: .15, sweep: -.2, legX: -.2, toe: 1, jaw: 0, ear: .6 });
            this.DEFEND = P({ y: H + .1, bx: -.75, flapAmp: .3, flapBias: .35, wingX: .7, sweep: -.15, flapRate: 2.6, jaw: .9, ear: 1, legX: .3, toe: -.2 });
            this.HIT = P({ y: H + .05, bz: -.3, bx: -.9, flapBias: .6, wingX: .5, flapAmp: .15, jaw: .5, roll: .25, headX: -.4 });
            this.KNEEL = P({ y: .2, bx: -.3, wingX: -.9, spread: 0, flapAmp: 0, flapBias: 0, legX: .9, legK: 1.2, foot: 0, toe: .7, neckX: .1, headX: -.1, air: 0 });
            this.LIE = P({ y: .125, bx: 0, wingX: -.9, spread: 0, flapAmp: 0, flapBias: 0, legX: 1.4, legK: .3, foot: 0, toe: .6, neckX: .2, headX: .1, air: 0 });
            this.DEAD = P({ y: .11, bx: .05, roll: .08, spread: 1, flapAmp: 0, flapBias: -.04, legX: 1.4, legK: .2, foot: 0, toe: .9, jaw: .6, neckX: .3, headX: .2, headY: .9, air: 0 });
        } else if (kind === 'harpy') {
            this.BASE = { y: H, bx: 0, waist: -.05, flapAmp: .7, flapRate: 1.1, flapBias: .4, neckX: 0, headX: 0, legX: .25, legK: .25, foot: .9, toe: .4, tailX: .75, tailFan: .5, air: 1 };
            this.STAND = P({});
            this.WALK = P({ bx: .35, waist: .05, flapRate: 1.5, legX: .9, legK: .3, tailX: .5, hair: .4 });
            this.RUN = P({ bx: .75, waist: .12, flapRate: 1.95, flapAmp: .8, legX: 1.3, legK: .2, foot: 1.2, tailX: .25, tailFan: .3, hair: .8 });
            this.A1 = P({ y: H + .4, bz: -.2, bx: -.2, waist: -.25, flapBias: .35, flapAmp: .85, flapRate: 1.6, legX: -.3, toe: 0, hair: .5 });
            this.A2 = P({ y: H - .2, bz: .45, bx: -.15, waist: .25, legX: -1.3, legK: .25, foot: .1, toe: -.4, sweep: .4, spread: .9, flapBias: .8, flapAmp: .08, jaw: .6, hair: 1, headX: .2 });
            this.A3 = P({ y: H - .25, bz: .5, bx: -.05, waist: .1, legX: -1.0, legK: .2, foot: .3, toe: 1.25, flapBias: -.35, flapAmp: .15, sweep: -.2, jaw: .3, hair: .6 });
            this.DEFEND = P({ y: H + .1, bx: -.1, waist: -.12, flapBias: .35, flapAmp: .25, wingX: .8, sweep: -.2, flapRate: 1.3, jaw: 1, neckX: .25, headX: .05, hair: 1, legX: -.35, toe: -.3 });
            this.HIT = P({ y: H + .05, bz: -.25, bx: -.25, waist: -.35, flapBias: .55, wingX: .5, flapAmp: .15, neckX: -.35, headX: -.2, jaw: .5, hair: .6 });
            this.KNEEL = P({ y: .5, bx: .15, waist: .05, spread: 0, flapAmp: 0, flapBias: 0, legX: -.9, legK: 1.8, foot: 0, toe: .3, tailX: .5, tailFan: .3, air: 0 });
            this.LIE = P({ y: .2, bx: .1, waist: .35, spread: 0, flapAmp: 0, flapBias: 0, legX: -1.4, legK: 2.9, foot: 0, toe: .3, tailX: .1, tailFan: .5, neckX: .1, headX: .1, air: 0 });
            this.DEAD = P({ y: .14, bx: 1.45, waist: .1, roll: .12, spread: 1, flapAmp: 0, flapBias: -.02, wingX: -1.5, legX: .2, legK: .6, foot: -.3, toe: .8, tailX: .1, tailFan: 1,
                neckX: .2, headX: -1.2, headY: 1.1, jaw: .4, hair: -2.5, air: 0 });
        } else if (kind === 'gryffon') {
            const G0 = this.H0;
            this.BASE = { y: G0, bx: 0, spread: 0, flapAmp: 0, flapBias: 0, flapRate: 1.5, neckX: .35, headX: 0, legX: 0, legK: 0, foot: 0, toe: .25, tailX: .8,
                FL0: .05, FL1: -.05, HL0: -.5, HL1: 1.05, HL2: -.6, air: 0 };
            this.STAND = P({ spread: .9, flapBias: 1, flapAmp: .05, flapRate: .6 });
            this.WALK = P({ neckX: .5 });
            const fly = { y: this.c.hover, bx: .2, spread: 1, flapAmp: .85, flapRate: 1.6, flapBias: .12, neckX: .9, FL0: 1.3, FL1: -1.6, toe: 1, foot: .5,
                HL0: .9, HL1: .3, HL2: .6, tailX: 1.3, air: 1 };
            this.RUN = P(fly);
            this.A1 = P({ ...fly, y: .95, bz: -.15, bx: -.65, flapBias: .35, flapAmp: .9, flapRate: 1.8, neckX: .3, headX: .2, FL0: -.7, FL1: -.6, toe: -.2, foot: .2,
                HL0: .1, HL1: .4, HL2: -.2, jaw: .3, tailX: 1.25 });
            this.A2 = P({ ...fly, y: .75, bz: .5, bx: .3, spread: .9, flapBias: .75, flapAmp: .08, sweep: .4, neckX: .7, headX: .2, FL0: -1.4, FL1: .2, toe: -.4, foot: -.2,
                HL0: .7, HL1: .3, HL2: .3, jaw: .7 });
            this.A3 = P({ ...fly, y: .67, bz: .55, bx: .15, flapBias: -.3, flapAmp: .15, sweep: -.2, neckX: 1.25, headX: .6, FL0: -1.0, FL1: .1, toe: 1.25, foot: .3,
                HL0: .3, HL1: .5, HL2: -.2, jaw: .05 });
            this.DEFEND = P({ y: .86, bz: -.12, bx: -.9, spread: 1, flapAmp: .25, flapBias: .4, wingX: .5, sweep: -.15, flapRate: 1.1, neckX: -.35, headX: -.1, jaw: .65, FL0: -.4, FL1: -1.0, toe: -.2, foot: .6,
                HL0: .5, HL1: .9, HL2: -.55, tailX: 1.9, air: 0 });
            this.HIT = P({ y: G0 + .05, bz: -.12, bx: -.12, spread: .35, flapBias: .5, neckX: 0, headX: -.3, jaw: .45, FL0: -.2, tailX: 1.1 });
            this.KNEEL = P({ y: .395, bz: -.1, bx: -.5, neckX: .2, FL0: -.2, FL1: .9, HL0: -1.55, HL1: 2.45, HL2: -1, tailX: 2 });
            this.LIE = P({ y: .19, bx: .02, neckX: .55, headX: .1, FL0: -1.5, FL1: .1, toe: .2, HL0: -1.35, HL1: 2.55, HL2: -2.6, tailX: 1.5 });
            this.DEAD = P({ y: .17, bx: .05, roll: .05, spread: .95, flapBias: -.06, neckX: 1.4, headX: .9, headY: 1, jaw: .4, FL0: -1.55, FL1: 0, toe: .3, HL0: 1.45, HL1: .1, HL2: .1, tailX: 1.5 });
        } else {
            this.BASE = { y: H, bx: -.3, flapAmp: .75, flapRate: .85, flapBias: .3, neckX: .5, headX: 0, legX: .5, legK: -.2, foot: .9, toe: .4, tailX: .25, tailFan: .7, air: 1 };
            this.STAND = P({});
            this.WALK = P({ bx: .02, flapRate: 1.2, flapAmp: .8, legX: 1.2, legK: -.3, foot: 1.5, toe: .9, neckX: 1, tailFan: .45, tailX: .05 });
            this.RUN = P({ y: H + .05, bx: .22, flapRate: 1.65, flapAmp: .85, sweep: .08, legX: 1.4, legK: -.2, foot: 1.6, toe: 1, neckX: 1.25, tailFan: .3, tailX: 0 });
            this.A1 = P({ y: H + .45, bz: -.2, bx: -.55, flapAmp: .9, flapRate: 1.5, flapBias: .35, legX: .1, foot: .4, toe: 0, neckX: .4, headX: .25 });
            this.A2 = P({ y: H - .3, bz: .45, bx: .45, spread: .85, flapAmp: .08, flapBias: .85, sweep: .5, legX: -1.1, legK: .25, foot: -.2, toe: -.35, neckX: .9, headX: .3, jaw: .5, tailFan: 1, flame: 1.5 });
            this.A3 = P({ y: H - .35, bz: .55, bx: .1, flapAmp: .15, flapBias: -.4, sweep: -.3, legX: -1.25, legK: .2, foot: .2, toe: 1.25, neckX: .8, headX: .15, jaw: .1, tailFan: 1, flame: 2.2, jet: 1 });
            this.DEFEND = P({ y: H + .15, bz: -.1, bx: -.6, flapAmp: .25, flapBias: .4, wingX: .8, sweep: -.2, flapRate: 1.1, neckX: .3, headX: -.1, jaw: .65, legX: -.3, foot: .2, toe: -.25, tailFan: 1, flame: 1.6 });
            this.HIT = P({ y: H + .08, bz: -.3, bx: -.65, flapBias: .6, wingX: .5, flapAmp: .2, neckX: -.15, headX: -.35, jaw: .4, legX: .15, roll: .15 });
            this.KNEEL = P({ y: .29, bx: -.45, spread: 0, flapAmp: 0, flapBias: 0, legX: .2, legK: -.75, foot: 0, toe: .25, neckX: .3, tailX: .75, tailFan: .2, air: 0, flame: .8 });
            this.LIE = P({ y: .2, bx: -.05, spread: 0, flapAmp: 0, flapBias: 0, legX: 1.5, legK: -2.9, foot: 0, toe: .6, neckX: .45, tailX: .1, tailFan: .3, air: 0, flame: .7 });
            this.DEAD = P({ y: .18, bx: .05, roll: .1, spread: 1, flapAmp: 0, flapBias: -.08, legX: 1.7, legK: .3, foot: -.5, toe: .8, neckX: 1.5, headX: .9, headY: 1, jaw: .4,
                tailX: .05, tailFan: 1, air: 0, flame: .25 });
        }
    }

    // target pose for the state, written into this.T (no allocation)
    statePose(state, c, t) {
        const T = this.T, KEYS = this.KEYS;
        const copy = A => { for (const k of KEYS) T[k] = A[k]; };
        const blend = (B, w) => { if (w > 0) for (const k of KEYS) T[k] += (B[k] - T[k]) * w; };
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || 1;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / dur) % 1;
                copy(this.STAND);
                blend(this.A1, smooth(p / .32));
                blend(this.A2, smooth((p - .32) / .2));
                blend(this.A3, smooth((p - .52) / .12));
                blend(this.STAND, smooth((p - .74) / .26));
                break;
            }
            case 'defend':
                copy(this.DEFEND);
                T.jaw *= .75 + .25 * Math.sin(t * 9);                                                   // screech
                T.flapBias += Math.sin(t * 2.3) * .06;
                break;
            case 'hit': copy(this.HIT); break;
            case 'kneel': copy(this.KNEEL); break;
            case 'lie': copy(this.LIE); break;
            case 'death': copy(this.DEAD); break;
            case 'walk': copy(this.WALK); break;
            case 'run': copy(this.RUN); break;
            default:
                copy(this.STAND);
                T.headY = this.look * .6;
                if (this.kind === 'gryffon') {                                    // wings raised like a heraldic griffin, now and then a full beat
                    const r = Math.max(0, Math.sin(t * .35) - .85) / .15;
                    T.spread += r * .45;
                    T.flapBias -= r * .5;
                    T.flapAmp += r * .5;
                } else if (this.kind !== 'bat') T.flapAmp *= .7 + .3 * Math.sin(t * .4);                  // deep beats, short glides
        }
        return T;
    }

    /* ---------- frame ---------- */

    update(c, dt) {
        this.time += dt;
        const t = this.time, J = this.j;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; this.fallV = 0; }
        this.stateTime += dt;
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) { this.lookT = (Math.random() - .5) * 1.6; this.lookTimer = 1.5 + Math.random() * 3; }
        this.look = damp(this.look, state === 'idle' ? this.lookT : 0, 2.5, dt);

        const T = this.statePose(state, c, t), p = this.p;
        const k = state === 'attack' ? 16 : state === 'hit' ? 14 : state === 'death' ? 3.5 : state === 'lie' || state === 'kneel' ? 3 : 5;
        const landing = state === 'death' || state === 'lie' || state === 'kneel';
        for (const key of this.KEYS) {
            if (key === 'y' && state === 'death') continue;
            p[key] = damp(p[key], T[key], landing && (key === 'flapAmp' || key === 'flapBias') ? 8 : k, dt);
        }
        if (state === 'death') {                                                                         // free fall onto the ground
            if (p.y > T.y + .001) { this.fallV += 9 / this.size * dt; p.y = Math.max(T.y, p.y - this.fallV * dt); } else p.y = damp(p.y, T.y, 6, dt);
        }

        // wing beats
        this.phase += dt * p.flapRate * TAU;
        const sn = Math.sin(this.phase), up = Math.max(0, Math.cos(this.phase));
        const flap = p.flapBias + p.flapAmp * sn;
        const spread = clamp01(p.spread * (1 - (this.kind === 'bat' ? .15 : .22) * p.flapAmp * up));
        J.body.position.set(0, p.y - sn * p.flapAmp * .04, p.bz);
        J.body.rotation.set(p.bx, p.turn, p.roll);
        for (const w of J.wings) w.set(spread, flap, p.sweep, p.wingX);

        J.neck.rotation.x = p.neckX;
        const pitch = p.bx + (this.kind === 'harpy' ? p.waist : 0);
        J.head.rotation.set(p.headX - p.neckX - pitch * (this.kind === 'gryffon' ? .6 : .85), p.headY, 0);
        if (J.jaw) J.jaw.rotation.x = p.jaw * (this.kind === 'bat' ? .7 : this.kind === 'harpy' ? .35 : .45);

        if (this.kind === 'gryffon') this.animateGryffon(p, state, t, dt, c);
        else {
            for (const L of J.legs) {
                L.top.rotation.x = p.legX;
                L.knee.rotation.x = p.legK;
                L.foot.rotation.x = p.foot - (pitch - (this.kind === 'harpy' ? p.waist : 0) + p.legX + p.legK);
                for (const toe of L.toes) toe.rotation.x = -.3 + p.toe * 1.25;
            }
            if (J.legs.length === 2 && p.air > .5 && state !== 'death') {                              // dangling legs swing a little
                J.legs[0].top.rotation.x += Math.sin(t * 1.3) * .05;
                J.legs[1].top.rotation.x += Math.sin(t * 1.3 + 1) * .05;
            }
        }
        if (J.tailF) {
            J.tail.rotation.x = p.tailX - sn * p.flapAmp * .05;
            for (const pv of J.tailF) pv.rotation.y = pv.userData.d * .13 * p.tailFan;
        }
        if (this.kind === 'harpy') {
            J.waist.rotation.x = p.waist;
            J.hair.rotation.x = .25 + p.hair * .55 + Math.sin(t * 2.5) * .05 + up * p.flapAmp * .08;
        }
        if (J.ears) for (const e of J.ears) e.rotation.set(-.15 - p.ear * .3 + (state === 'death' ? .4 : 0), 0, -e.userData.s * (.38 - p.ear * .15));
        if (this.c.phoenix) this.animatePhoenix(p, state, t);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }

    animateGryffon(p, state, t, dt, c) {
        const J = this.j;
        this.walkK = damp(this.walkK, state === 'walk' ? 1 : 0, 6, dt);
        const g = this.walkK * (1 - p.air);
        if (g > .01) this.step += dt * (c.speed || 3) / (1.25 * this.size) * TAU;
        const off = { HL: 0, FL: .25, HR: .5, FR: .75 };
        for (const name of ['FL', 'FR', 'HL', 'HR']) {
            const L = J[name], hind = name[0] === 'H';
            const ph = this.step + off[name] * TAU, s = Math.sin(ph), lift = smooth(Math.max(0, Math.cos(ph))) * g;
            if (hind) {
                L.top.rotation.x = p.HL0 - s * .4 * g;
                L.knee.rotation.x = p.HL1 + lift * .7;
                L.low.rotation.x = p.HL2 - lift * .55;
            } else {
                const a0 = p.FL0 - s * .4 * g, a1 = p.FL1 + lift * 1.1;
                L.top.rotation.x = a0;
                L.knee.rotation.x = a1;
                L.foot.rotation.x = -(p.bx + a0 + a1) + p.foot * p.air + (state === 'defend' ? p.foot : 0) + lift * .6;
                for (const toe of L.toes) toe.rotation.x = -.3 + p.toe * 1.25;
            }
        }
        if (g > .01) {
            J.body.position.y += Math.sin(this.step * 2) * .01 * g;
            J.body.rotation.z += Math.sin(this.step) * .02 * g;
        }
        J.tailRoot.rotation.x = p.tailX;
        const sway = state === 'death' ? 0 : state === 'defend' ? .3 : .12;
        J.tailSeg.forEach((seg, i) => {
            seg.rotation.z = Math.sin(t * 1.6 - i * .6) * sway * (.4 + i / 6);
            seg.rotation.x = (i < 3 ? -.12 : .3) * (state === 'lie' || state === 'death' ? .3 : 1) + (p.air > .5 ? -.1 : 0);
        });
    }

    animatePhoenix(p, state, t) {
        const J = this.j;
        flickerFlames(this.flames, t);
        const f = p.flame * (1 + .08 * Math.sin(t * 13) * Math.sin(t * 5.3));
        for (const h of this.flareHolders) h.scale.setScalar(f);
        J.halo.scale.setScalar(2 * (.7 + .3 * p.flame) * (1 + .05 * Math.sin(t * 7)));
        J.halo.material.opacity = .18 + .1 * p.flame;
        J.jet.visible = p.jet > .05;
        if (J.jet.visible) J.jet.scale.set(.6 + .4 * p.jet, .6 + .4 * p.jet, p.jet * (1 + .15 * Math.sin(t * 31)));
        const still = state === 'death' || state === 'lie';
        const k = clamp01((p.y - .15) / (this.c.hover - .15)) * (still ? 0 : 1);       // high up the plumes hang, low they trail flat
        J.plumes.forEach((segs, j) => segs.forEach((g, i) => {
            g.rotation.x = (i ? -(.04 + i * .02) * k : -(p.bx + p.tailX) - .45 * k + .06 * (1 - k)) + Math.sin(t * 2.2 - i * .9 + j) * (still ? .02 : .03 + .09 * k) + (1 - k) * (i ? .02 : .1);
            g.rotation.y = Math.sin(t * 1.7 - i * .7 + j * 2) * (still ? .03 : .12);
        }));
    }
}
