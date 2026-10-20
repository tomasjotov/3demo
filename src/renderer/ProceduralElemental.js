import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, damp, TAU } from './QuadrupedRig.js';
import { glowMat, flameTongue, taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralElemental — humanoid beings made of a material instead of flesh, on one biped rig (QuadrupedRig with the
 * legs HL / HR, two big arms, a chest that leans and twists). Bodies are smooth lathed torsos and tapered limbs dressed
 * per kind (canvas textures for stone strata, smoke, water streaks; static parts merged per joint to keep draw calls low):
 *   rock      earth-elemental (upright, stacked tan shale slabs), -greater (hunched gorilla of cracked flagstone plates,
 *             moss on the shoulders, fists before it), -giant (colossal hunched brute of splintered rock, long clawed arms,
 *             glowing seams on the chest)
 *   golem     steel-blue iron giant: barrel chest, round pauldrons, dome head with crest, glowing coil waist, claws
 *   automaton black metal skeleton construct, hunched: ribs, brass chest gear, pistons, gear-crowned skull, red eyes / vent
 *   fire      fire-elemental-greater (charred lava body with glowing veins, flame horns), -giant (bright orange): curved
 *             flame tongues all over, breath
 *   water     water-elemental-greater: translucent streaming body, hair of water swept back, rising from a breaking wave
 *   air       air-elemental-greater: smoky body, mushroom-cloud head, lower body a spinning funnel over a mist bank
 *   vestrad   hooded energy demon: floating robe, arms spread, lightning crackling from the hands and around the body
 *   swarm     swarm-devil: dark humanoid core covered by hundreds of orbiting insects (instanced)
 *   maggot    maggot-man: pale core wrapped in ribbed worms, worm dreadlocks and hanging tendrils, crawling maggots
 *
 *   root ─ body (hips: bob, lunge, pitch `bx`, roll) ├─ legs HL/HR: top ─ knee ─ low ─ foot (kept flat)
 *        │                                           ├─ chest (pose keys spine / twist) ─ arms (sh ─ el ─ hand), neck ─ head
 *        │                                           └─ robe (vestrad)
 *        ├─ low (water column / air vortex: links the floating body with the ground)
 *        └─ debris (death pieces), burst (hit / impact chips)
 *
 * States: idle (breathing, flickering, swirling), walk / run (heavy stomp for rock and golem, glide for the legless
 * kinds), attack (rock, golem: two-handed overhead slam that throws up chips; automaton: punch; fire: arms thrust and a
 * jet of flame from the mouth; water: rises and crashes forward; air: sweeping gust; vestrad: lightning bolts from both
 * hands; swarm: lash, insects stream from the hands; maggot: grab and pull in), defend (forearms raised before the face,
 * body hardens: cracks / flames / bolts flare, swarm tightens), hit (flinch, chips scatter), kneel, lie, death (rock,
 * fire, water, air, swarm, maggot: slump and break into instanced pieces that stay on the ground — rock pile, cooling
 * embers, puddle, dust, dead insects, heap of worms; golem / automaton topple face down shedding parts; vestrad's robe
 * collapses empty while sparks die out).
 */

export const ELEMENTAL_VARIANTS = {
    'earth-elemental': { kind: 'rock', scale: 1.45, tex: 'strata', stone: 0xa89070, dark: 0x78624c, skin: 0x7a6650, crack: 0xff8a30, glow: .1,
        slab: .5, eye: true, shoulder: 1.35, finger: 1, brow: .15,
        dims: { spine: .15, legs: [.44, .44], legR: .12, legX: .17, arm: [.44, .42], armR: .11, hand: .13, shX: .4, chestW: .3, chestD: .22,
            hipW: .22, head: .14, headZ: .06, neck: .05, torso: .56, armZ: .18 } },
    'earth-elemental-greater': { kind: 'rock', scale: 2.3, tex: 'plates', stone: 0x8e7e6a, dark: 0x5c4e42, skin: 0x6a5a4a, crack: 0x9a4a18, glow: 0,
        slab: .8, moss: 0x4e5a2c, eye: true, shoulder: 1.7, finger: .9, brow: .3,
        dims: { spine: .6, legs: [.36, .36], legR: .17, arm: [.53, .51], armR: .19, hand: .24, shX: .56, shY: .52, chestW: .5, chestD: .38,
            head: .16, headZ: .44, neck: .02, armZ: .2 }, stand: { lX: -.4, rX: -.4, lK: -.5, rK: -.5 } },
    'earth-elemental-giant': { kind: 'rock', scale: 3.6, tex: 'grain', stone: 0xa88e74, dark: 0x6a5848, skin: 0x4a3c30, crack: 0xff6a20, glow: .08,
        chestGlow: 1.2, slab: .7, moss: 0x56662e, eye: true, shoulder: 1.8, finger: 1.4, fore: 1.25, brow: .45,
        dims: { spine: .55, legs: [.38, .38], legR: .16, arm: [.58, .56], armR: .17, hand: .2, shX: .52, chestW: .46, chestD: .34,
            head: .15, headZ: .4, neck: .02, armZ: .22 }, stand: { lX: -.4, rX: -.4, lK: -.55, rK: -.55 } },
    golem: { kind: 'golem', scale: 1.3, metal: 0x5a6c82, dark: 0x2e3844, glow: 0xff8a30 },
    automaton: { kind: 'automaton', scale: 1.1, metal: 0x2c2f35, plate: 0x3c4048, brass: 0xb88c48, glow: 0xff2418 },
    'fire-elemental-greater': { kind: 'fire', scale: 1.5, core: 0x1e0c08, ember: 0xff5a10, glow: 2.2, lava: 0, flame: 0xff6a18,
        shell: .08, fs: 1.5, fl: 1.6, fop: .6, horns: true, dims: { spine: .38, chestW: .3, shX: .34, armR: .08, legR: .085 } },
    'fire-elemental-giant': { kind: 'fire', scale: 3.6, core: 0xe07018, ember: 0xffa030, glow: 1.4, lava: 150, flame: 0xffa040,
        shell: .22, fs: 1.4, fl: 1.6, fop: .7, dims: { spine: .06 } },
    'water-elemental-greater': { kind: 'water', scale: 1.95, water: 0x4aa8cc, glint: 0xbdeeff, foam: 0xe4f6fc, eye: 0xe8ffff,
        stand: { lX: -.45, lZ: .55, lK: -.5, rX: -.2, rZ: .45, rK: -.35 } },
    'air-elemental-greater': { kind: 'air', scale: 1.7, air: 0xb4bcc4, cloud: 0xd2d6da, dust: 0x9a948a },
    vestrad: { kind: 'vestrad', scale: 1.15, robe: 0x101824, bolt: 0x9ae8ff, stand: { lX: -.55, lZ: .95, lK: -.55, rX: -.55, rZ: .95, rK: -.55 } },
    'swarm-devil': { kind: 'swarm', scale: 1.1 },
    'maggot-man': { kind: 'maggot', scale: 1.05, flesh: 0x9a8a86, worm: 0xece6dc }
};

// metres at scale 1: legs [thigh, shin], leg radius, foot height, hip spacing, knee bend [hip, knee, ankle], torso,
// chest half width / depth, shoulders, arms [upper, fore], head, forward lean (spine), arm abduction
const HUMAN = {
    legs: [.46, .46], legR: .075, foot: .06, legX: .13, hipDrop: .04, bend: [-.16, .32, -.16], splay: .04,
    waist: .1, torso: .52, chestW: .25, chestD: .17, hipW: .17, shX: .3, shY: .44, arm: [.4, .38], armR: .068, hand: .08,
    neck: .08, head: .13, headZ: .05, spine: .12, armZ: .25
};
const DIMS = {
    rock: { ...HUMAN, legs: [.4, .4], legR: .15, foot: .1, legX: .22, hipDrop: .05, bend: [-.25, .5, -.25], splay: .06,
        waist: .12, torso: .6, chestW: .4, chestD: .3, hipW: .28, shX: .5, shY: .5, arm: [.5, .48], armR: .15, hand: .17,
        neck: .02, head: .15, headZ: .14, spine: .4, armZ: .22 },
    golem: { ...HUMAN, legs: [.42, .42], legR: .14, foot: .1, legX: .22, hipDrop: .06, bend: [-.18, .36, -.18], splay: .05,
        waist: .14, torso: .58, chestW: .4, chestD: .32, hipW: .26, shX: .5, shY: .48, arm: [.46, .46], armR: .12, hand: .15,
        neck: .02, head: .16, headZ: .06, spine: .12, armZ: .2 },
    automaton: { ...HUMAN, legR: .05, legX: .13, bend: [-.28, .56, -.28], chestW: .22, chestD: .15, hipW: .15, shX: .27, shY: .45,
        arm: [.38, .36], armR: .05, hand: .09, neck: .08, head: .14, headZ: .06, spine: .32, armZ: .14 },
    fire: { ...HUMAN, armZ: .3 },
    swarm: { ...HUMAN, legR: .085, chestW: .27, chestD: .19, hipW: .18, armR: .075, head: .14 },
    maggot: { ...HUMAN, legR: .07, chestW: .23, chestD: .16, armR: .065, arm: [.42, .42], spine: .2 },
    water: { ...HUMAN, legs: null, hover: .95, chestW: .3, chestD: .2, hipW: .19, shX: .35, shY: .46, arm: [.46, .44],
        armR: .095, hand: .1, head: .145, spine: .22, armZ: .3 },
    air: { ...HUMAN, legs: null, hover: .95, chestW: .27, chestD: .18, hipW: .18, shX: .32, shY: .46, arm: [.44, .42],
        armR: .08, hand: .09, head: .14, armZ: .3 },
    vestrad: { ...HUMAN, legs: null, hover: 1.0, chestW: .22, chestD: .15, hipW: .17, shX: .27, shY: .44, arm: [.36, .34],
        armR: .07, hand: .07, neck: .06, head: .13, headZ: .04, spine: .1, armZ: .35 }
};

// ------------------------------------------------------------------ shared geometry, textures (module caches)
const rd = v => Math.round(v * 1000) / 1000;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _s = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);
const ONE = [1, 1, 1];

// Angular boulder: icosahedron with every corner pushed in / out (same corner = same push, so the faces stay closed).
const rocks = [];
function rockGeo(i) {
    const k = i % 6;
    if (!rocks[k]) {
        const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position;
        for (let n = 0; n < p.count; n++) {
            _v.fromBufferAttribute(p, n);
            const h = Math.sin(_v.x * 12.9898 + _v.y * 78.233 + _v.z * 37.719 + k * 4.37) * 43758.5453;
            _v.multiplyScalar(.72 + .5 * (h - Math.floor(h)));
            p.setXYZ(n, _v.x, _v.y, _v.z);
        }
        g.computeVertexNormals();
        rocks[k] = g;
    }
    return rocks[k];
}

// Smooth organic shapes (module cache): tapered limbs, lathed torsos, lumpy blobs (clouds, foam), curved flames.
const geoCache = new Map();
const cachedGeo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
// smooth pseudo noise from sines (deterministic, cheap; only used while building geometry)
const nz = (x, y, z, s) => Math.sin(x * 1.7 + s) * Math.sin(y * 2.3 + s * 1.3) * Math.sin(z * 1.9 + s * .7)
    + .5 * Math.sin(x * 3.9 - y * 2.1 + s * 2.1) * Math.sin(z * 4.3 + y * 1.1 + s) + .25 * Math.sin(x * 7.3 + z * 6.1 + s * 3);

// Limb segment from the joint along dir (-1 down, +1 up): rounded ends, taper r0 → r1, muscle bulge near the top.
function limbGeo(len, r0, r1, dir, bulge = .12, seg = 10) {
    return cachedGeo(`limb${rd(len)},${rd(r0)},${rd(r1)},${dir},${bulge},${seg}`, () => {
        const P = [];
        for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 + i * Math.PI / 6; P.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a) * .8)); }
        for (let i = 1; i < 6; i++) {
            const t = i / 6;
            P.push(new THREE.Vector2((r0 + (r1 - r0) * t) * (1 + bulge * Math.sin(Math.PI * Math.sqrt(t))), t * len));
        }
        for (let i = 0; i <= 3; i++) { const a = i * Math.PI / 6; P.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), len + r1 * Math.sin(a) * .8)); }
        const g = new THREE.LatheGeometry(P, seg);
        if (dir < 0) g.rotateX(Math.PI);
        return g;
    });
}
// Lathe from [radius, y] pairs, squashed in depth by zs.
function latheGeo(key, pts, seg = 14, zs = 1) {
    return cachedGeo('lathe' + key, () => {
        const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), seg);
        g.scale(1, 1, zs);
        return g;
    });
}
// Humanoid torso from the hips (y 0) to the neck (y torso): hips, narrow waist, chest, sloping shoulders.
function torsoGeo(D, waist = .8, seg = 14) {
    const T = D.torso, W = D.chestW, Hp = D.hipW;
    return latheGeo(`torso${rd(T)},${rd(W)},${rd(Hp)},${rd(D.chestD)},${waist}`, [[0, -.05], [Hp * .85, -.035], [Hp, .05], [Hp * waist, T * .3],
        [W * .92, T * .6], [W, T * .78], [W * .8, T * .94], [W * .35, T * 1.02], [0, T * 1.04]], seg, D.chestD / W);
}
// Lumpy blob around the unit sphere (cloud puffs, foam, smooth boulders); amp = lump depth, f = lump frequency.
function lumpGeo(seed, amp = .25, f = 2, detail = 2, flatBottom = 0) {
    return cachedGeo(`lump${seed},${amp},${f},${detail},${flatBottom}`, () => {
        let g = new THREE.IcosahedronGeometry(1, detail);
        g.deleteAttribute('normal'); g.deleteAttribute('uv');
        g = mergeVertices(g);
        const p = g.attributes.position, uv = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i);
            uv[i * 2] = Math.atan2(_v.z, _v.x) / TAU + .5; uv[i * 2 + 1] = _v.y * .5 + .5;
            const k = 1 + amp * nz(_v.x * f, _v.y * f, _v.z * f, seed);
            _v.multiplyScalar(k);
            if (flatBottom && _v.y < -flatBottom) _v.y = -flatBottom + (_v.y + flatBottom) * .25;
            p.setXYZ(i, _v.x, _v.y, _v.z);
        }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.computeVertexNormals();
        return g;
    });
}
// Curved flame tongue (+y, height 1, base radius .2): S-bent teardrop, vertex colours white-yellow base → red tip.
function flameGeo(k) {
    return cachedGeo('flame' + k, () => {
        const g = new THREE.CylinderGeometry(1, 1, 1, 7, 6, true), p = g.attributes.position, C = [];
        const c0 = new THREE.Color(0xffc860), c1 = new THREE.Color(0xff6a10), c2 = new THREE.Color(0x701002), c = new THREE.Color();
        const bend = [.22, -.26, .34][k % 3], twist = [1, -1, .6][k % 3];
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i) + .5, a = Math.atan2(p.getZ(i), p.getX(i));
            const r = .2 * Math.pow(Math.sin(Math.PI * Math.min(1, .12 + y * .95)), .8) * (1 - y * .6);
            const ox = bend * Math.sin(y * 3.2) * y, oz = bend * .5 * twist * (1 - Math.cos(y * 2.6)) * y;
            p.setXYZ(i, Math.cos(a) * r + ox, y, Math.sin(a) * r * .8 + oz);
            if (y < .45) c.copy(c0).lerp(c1, y / .45); else c.copy(c1).lerp(c2, (y - .45) / .55);
            C.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        return g;
    });
}
const flameMats = new Map();
const flameMat = (op = .9) => flameMats.get(op) || (flameMats.set(op, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: op,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), flameMats.get(op));

// Toothed gear (disc in the xy plane, axle hole), radius 1.
let gear = null;
function gearGeo() {
    if (gear) return gear;
    const sh = new THREE.Shape(), n = 10, w = TAU / n;
    for (let i = 0; i < n; i++) {
        const a = i * w;
        [[.78, a], [1, a + w * .12], [1, a + w * .42], [.78, a + w * .54]].forEach(([r, b], k) => {
            if (i === 0 && k === 0) sh.moveTo(Math.cos(b) * r, Math.sin(b) * r);
            else sh.lineTo(Math.cos(b) * r, Math.sin(b) * r);
        });
    }
    sh.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, .28, 0, TAU, true);
    sh.holes.push(hole);
    gear = new THREE.ExtrudeGeometry(sh, { depth: .22, bevelEnabled: false, curveSegments: 6 });
    gear.translate(0, 0, -.11);
    return gear;
}

// Wasp / fly: diamond body along +z with two pale wings, vertex coloured.
let insect = null, insectMatC = null;
function insectGeo() {
    if (insect) return insect;
    const P = [], C = [], body = [.025, .025, .03], wing = [.36, .37, .35];
    const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) C.push(...col); };
    const f = [0, 0, .5], bk = [0, 0, -.6], l = [.22, 0, 0], r = [-.22, 0, 0], u = [0, .18, .05], d = [0, -.14, 0];
    tri(f, l, u, body); tri(f, u, r, body); tri(f, d, l, body); tri(f, r, d, body);
    tri(bk, u, l, body); tri(bk, r, u, body); tri(bk, l, d, body); tri(bk, d, r, body);
    tri([.05, .1, .12], [.62, .16, -.12], [.18, .12, -.45], wing);
    tri([-.05, .1, .12], [-.18, .12, -.45], [-.62, .16, -.12], wing);
    insect = new THREE.BufferGeometry();
    insect.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    insect.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    insect.computeVertexNormals();
    return insect;
}
const insectMat = () => insectMatC || (insectMatC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, side: THREE.DoubleSide }));

// Hanging worm tendrils: three wiggly shapes of length 1 along -y.
let tendrils = null;
function tendrilGeo(i) {
    if (!tendrils) tendrils = [0, 1, 2].map(k => taperTube([[0, 0, 0], [.12 * Math.sin(k + 1), -.28, .1], [-.1, -.55, .06 * k],
        [.12, -.8, -.06], [.05 * k, -1, .1]], .05, .014, 14, 6));
    return tendrils[i % 3];
}

// Textured standard material, cached by colour + options (kit.mat() would serialise the canvas image for its key).
const tmatCache = new Map();
function tmat(color, o) {
    const key = color + Object.entries(o).map(([k, v]) => k + (v && v.isTexture ? v.uuid : v)).join();
    if (!tmatCache.has(key)) tmatCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...o }));
    return tmatCache.get(key);
}
const texCache = new Map();
function canvasTex(key, w, h, draw, repeat) {
    if (texCache.has(key)) return texCache.get(key);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'));
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, tex);
    return tex;
}
// glowing crack network (emissive map): grey level `base` between bright cracks
const lavaTex = base => canvasTex('lava' + base, 128, 128, g => {
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, 128, 128);
    let s = 11;
    const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
        g.lineWidth = 1 + r() * 3;
        g.beginPath();
        let x = r() * 128, y = r() * 128;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); }
        g.stroke();
    }
}, [2, 2]);
// crawling insects (dark bodies, pale wings) covering the swarm's core
const bugTex = () => canvasTex('bugs', 128, 128, g => {
    g.fillStyle = '#16140f';
    g.fillRect(0, 0, 128, 128);
    let s = 5;
    const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) {
        const x = r() * 128, y = r() * 128, a = r() * TAU;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.scale(1.4, 1.4);
        g.fillStyle = 'rgba(190,192,180,.75)';
        g.beginPath(); g.ellipse(-2.5, -2, 3.5, 1.6, -.5, 0, TAU); g.ellipse(2.5, -2, 3.5, 1.6, .5, 0, TAU); g.fill();
        g.fillStyle = '#0a0907';
        g.beginPath(); g.ellipse(0, 0, 1.6, 4, 0, 0, TAU); g.fill();
        g.restore();
    }
}, [3, 2]);
// ribbed worm skin: rings across u
const wormTex = color => canvasTex('worm' + color, 64, 16, g => {
    g.fillStyle = '#' + new THREE.Color(color).getHexString();
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(90,55,45,.5)';
    for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 2, 16);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.fillRect(0, 4, 64, 3);
}, [10, 1]);

const lcg = s => () => (s = s * 16807 % 2147483647) / 2147483647;
// Stone skin: 'strata' = stacked shale slabs (earth elemental), 'grain' = long vertical splinters (giant), 'plates' =
// cracked flagstone mosaic (greater). Grey levels, tinted by the material colour.
const stoneTex = kind => canvasTex('stone' + kind, 128, 128, g => {
    const r = lcg(kind.length * 977 + 3);
    g.fillStyle = '#c4c4c4';
    g.fillRect(0, 0, 128, 128);
    if (kind === 'plates') {
        for (let y = 0; y < 128; y += 16) for (let x = -16; x < 128; x += 20) {
            const ox = x + (y / 16 % 2) * 10, v = 165 + r() * 90 | 0;
            g.fillStyle = `rgb(${v},${v * .97 | 0},${v * .92 | 0})`;
            g.beginPath();
            g.moveTo(ox + r() * 4, y + r() * 3); g.lineTo(ox + 18 + r() * 4, y + r() * 3);
            g.lineTo(ox + 20 - r() * 4, y + 15 - r() * 3); g.lineTo(ox + r() * 3, y + 15 - r() * 2);
            g.fill();
        }
    } else {
        const vert = kind === 'grain';
        for (let i = 0; i < 128; i += 3 + (r() * 5 | 0)) {
            const v = 160 + r() * 95 | 0, w = 3 + r() * 6;
            g.fillStyle = `rgb(${v},${v * .96 | 0},${v * .9 | 0})`;
            g.beginPath();
            const pts = [];
            for (let k = 0; k <= 8; k++) pts.push([k * 16, i + Math.sin(k * 1.3 + i) * 2 + (r() - .5) * 2]);
            pts.forEach(([a, b], k) => (vert ? (k ? g.lineTo(b, a) : g.moveTo(b, a)) : (k ? g.lineTo(a, b) : g.moveTo(a, b))));
            for (let k = 8; k >= 0; k--) { const [a, b] = pts[k]; vert ? g.lineTo(b + w, a) : g.lineTo(a, b + w); }
            g.fill();
            g.fillStyle = 'rgba(30,22,16,.7)';
            vert ? g.fillRect(i + w, 0, 1, 128) : g.fillRect(0, i + w, 128, 1);
        }
    }
    g.strokeStyle = 'rgba(20,14,10,.55)';
    for (let i = 0; i < 14; i++) {
        g.lineWidth = .8 + r();
        g.beginPath();
        let x = r() * 128, y = r() * 128;
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += (r() - .5) * 26; y += (r() - .5) * 26; g.lineTo(x, y); }
        g.stroke();
    }
}, [1, 1]);
// soft billowing smoke / flowing water streaks (grey levels for map, white streaks for emissive)
const smokeTex = () => canvasTex('smoke', 128, 128, g => {
    const r = lcg(41);
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) {
        const x = r() * 128, y = r() * 128, s = 6 + r() * 22, v = 150 + r() * 105 | 0;
        const gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, `rgba(${v},${v},${v},.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr;
        for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g.save(); g.translate(dx, dy); g.fillRect(x - s, y - s, s * 2, s * 2); g.restore(); }
    }
}, [1, 1]);
const streakTex = (k = 0) => canvasTex('streak' + k, 64, 128, g => {
    const r = lcg(73);
    g.fillStyle = '#000';
    g.fillRect(0, 0, 64, 128);
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
        const x = r() * 64, v = 120 + r() * 135 | 0;
        g.strokeStyle = `rgba(${v},${v},${v},${.35 + r() * .5})`;
        g.lineWidth = .8 + r() * 2.5;
        g.beginPath();
        for (let y = -8; y <= 136; y += 8) {
            const xx = x + Math.sin(y * .06 + i) * 6;
            y < 0 ? g.moveTo(xx, y) : g.lineTo(xx, y);
        }
        g.stroke();
    }
}, [2, 1]);

// ------------------------------------------------------------------ particle systems
// Instanced particles orbiting a segment's axis (insects, maggots, foam, dust); positions are a pure function of time.
class Motes {
    constructor(parent, geo, material, n, o, rnd) {
        const O = this.o = { dir: -1, radial: [1, 1.2], speed: [2, 4], size: [.05, .07], flow: 0, wobble: .1, zs: 1, y0: 0,
            stretch: ONE, signed: true, ...o };
        const m = this.mesh = new THREE.InstancedMesh(geo, material, n);
        m.frustumCulled = false;
        m.raycast = () => {};
        parent.add(m);
        this.n = n;
        const P = this.P = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const sp = O.speed[0] + rnd() * (O.speed[1] - O.speed[0]);
            P[i * 6] = rnd();
            P[i * 6 + 1] = rnd() * TAU;
            P[i * 6 + 2] = O.signed && rnd() < .5 ? -sp : sp;
            P[i * 6 + 3] = O.radial[0] + rnd() * (O.radial[1] - O.radial[0]);
            P[i * 6 + 4] = rnd() * TAU;
            P[i * 6 + 5] = O.size[0] + rnd() * (O.size[1] - O.size[0]);
        }
        this.update(0);
    }
    update(time, spread = 1, reach = 0) {
        const O = this.o, P = this.P, st = O.stretch;
        for (let i = 0; i < this.n; i++) {
            const k = i * 6;
            let t = P[k] + O.flow * time;
            t -= Math.floor(t);
            const tt = t * (1 + reach), th = P[k + 1] + P[k + 2] * time, ph = P[k + 4];
            const rr = (O.r0 + (O.r1 - O.r0) * Math.min(1, tt)) * P[k + 3] * spread * (1 + O.wobble * Math.sin(time * 3 + ph))
                * (tt > 1 ? 1 + (tt - 1) * .8 : 1);
            _p.set(Math.cos(th) * rr, O.y0 + O.dir * (tt * O.len + Math.sin(time * 2.3 + ph) * O.len * .03), Math.sin(th) * rr * O.zs);
            _q.setFromAxisAngle(_Y, -th + (P[k + 2] < 0 ? Math.PI : 0));
            const s = P[k + 5];
            _s.set(s * st[0], s * st[1], s * st[2]);
            _m.compose(_p, _q, _s);
            this.mesh.setMatrixAt(i, _m);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

// Death pieces: start where the body was (sampled from its meshes), fly a quadratic curve and rest on the ground.
class Debris {
    constructor(parent, geo, material, n) {
        const m = this.mesh = new THREE.InstancedMesh(geo, material, n);
        m.frustumCulled = false;
        m.castShadow = true;
        m.visible = false;
        m.raycast = () => {};
        parent.add(m);
        this.n = n;
        this.S = new Float32Array(n * 3); this.C = new Float32Array(n * 3); this.E = new Float32Array(n * 3);
        this.A = new Float32Array(n * 3); this.K = new Float32Array(n * 3); this.T = new Float32Array(n * 4);
        this.cx = 0; this.cz = 0;
    }
    start(R, o) {
        const { n, S, C, E, A, K, T } = this, root = R.root, anchors = R.anchors, rnd = Math.random;
        root.updateMatrixWorld(true);
        let cx = 0, cz = 0;
        for (let i = 0; i < n; i++) {
            anchors[Math.floor(rnd() * anchors.length)].getWorldPosition(_v);
            root.worldToLocal(_v);
            S[i * 3] = _v.x + (rnd() - .5) * o.jit;
            S[i * 3 + 1] = Math.max(.03, _v.y + (rnd() - .5) * o.jit);
            S[i * 3 + 2] = _v.z + (rnd() - .5) * o.jit;
            cx += S[i * 3]; cz += S[i * 3 + 2];
        }
        this.cx = cx /= n; this.cz = cz /= n;
        const st = o.stretch || ONE;
        for (let i = 0; i < n; i++) {
            const j = i * 3, sx = S[j], sy = S[j + 1], sz = S[j + 2];
            const ox0 = sx - cx, oz0 = sz - cz;
            const ang = (Math.hypot(ox0, oz0) > 1e-4 ? Math.atan2(oz0, ox0) : rnd() * TAU) + (rnd() - .5) * .9;
            const ox = Math.cos(ang), oz = Math.sin(ang);
            const size = o.size[0] + rnd() * (o.size[1] - o.size[0]);
            K[j] = size * st[0]; K[j + 1] = size * st[1] * (.8 + rnd() * .4); K[j + 2] = size * st[2];
            let delay = rnd() * .15, dur;
            if (o.mode === 'pile') {
                const rr = o.R * Math.pow(rnd(), .8);
                E[j] = cx + ox * rr; E[j + 2] = cz + oz * rr;
                E[j + 1] = K[j + 1] * .6 + o.heap * (1 - rr / o.R) * rnd();
                C[j] = sx + ox * size * 2; C[j + 1] = sy; C[j + 2] = sz + oz * size * 2;
                dur = Math.max(.25, Math.sqrt(2 * Math.max(.02, sy - E[j + 1]) / o.g));
            } else if (o.mode === 'splash') {
                const D = o.far * (.4 + rnd() * .6), rr = o.R * Math.sqrt(rnd());
                C[j] = sx + ox * D * .6; C[j + 1] = sy + o.far * (.2 + rnd() * .4); C[j + 2] = sz + oz * D * .6;
                E[j] = cx + ox * rr; E[j + 1] = K[j + 1] * .25; E[j + 2] = cz + oz * rr;
                dur = .45 + rnd() * .4;
            } else if (o.mode === 'spark') {
                C[j] = sx + ox * o.far * .5; C[j + 1] = sy + o.far * (.3 + rnd() * .5); C[j + 2] = sz + oz * o.far * .5;
                E[j] = sx + ox * o.far; E[j + 1] = size; E[j + 2] = sz + oz * o.far;
                dur = .5 + rnd() * .5;
            } else {                                                   // disperse (swarm) / dust (air): fly out, settle wide
                const D = o.far * (.6 + rnd() * .7), rr = o.R * (.35 + .65 * rnd());
                C[j] = sx + ox * D; C[j + 1] = sy + o.far * (.2 + rnd() * .6); C[j + 2] = sz + oz * D;
                E[j] = cx + ox * rr; E[j + 1] = K[j + 1] * .4; E[j + 2] = cz + oz * rr;
                dur = 1.2 + rnd() * 1.2; delay = rnd() * .4;
            }
            T[i * 4] = delay; T[i * 4 + 1] = dur; T[i * 4 + 2] = rnd() * TAU; T[i * 4 + 3] = (rnd() - .5) * o.spin;
            if (o.flatAxis) { A[j] = 0; A[j + 1] = 1; A[j + 2] = 0; } else {
                _a.set(rnd() - .5, rnd() - .5, rnd() - .5).normalize();
                A[j] = _a.x; A[j + 1] = _a.y; A[j + 2] = _a.z;
            }
        }
        this.o = o;
        this.mesh.visible = true;
        this.update(0);
    }
    update(time) {
        const { n, S, C, E, A, K, T, o } = this, ease = o.mode === 'pile' ? 2 : o.mode === 'splash' || o.mode === 'spark' ? 1 : 0;
        for (let i = 0; i < n; i++) {
            const j = i * 3, tau = clamp01((time - T[i * 4]) / T[i * 4 + 1]);
            const u = ease === 2 ? tau * tau : ease === 1 ? tau : 1 - (1 - tau) * (1 - tau);
            const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
            _p.set(a * S[j] + b * C[j] + c * E[j], a * S[j + 1] + b * C[j + 1] + c * E[j + 1], a * S[j + 2] + b * C[j + 2] + c * E[j + 2]);
            let ang = T[i * 4 + 2] + T[i * 4 + 3] * u;
            if (o.wiggle && tau >= 1) ang += Math.sin(time * 5 + i) * .35;
            _a.set(A[j], A[j + 1], A[j + 2]);
            _q.setFromAxisAngle(_a, ang);
            const fl = o.flat ? o.flat * u : 0, sh = o.shrink ? 1 - u : 1;
            _s.set(K[j] * sh * (1 + fl * .8), K[j + 1] * sh * (1 - fl), K[j + 2] * sh * (1 + fl * .8));
            _m.compose(_p, _q, _s);
            this.mesh.setMatrixAt(i, _m);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

// A few chips thrown up ballistically (hit flinch, ground slam), fading out after a second.
class Burst {
    constructor(parent, geo, material, n, stretch = ONE) {
        const m = this.mesh = new THREE.InstancedMesh(geo, material, n);
        m.frustumCulled = false;
        m.visible = false;
        m.raycast = () => {};
        parent.add(m);
        this.n = n; this.st = stretch; this.life = -1;
        this.P = new Float32Array(n * 3); this.V = new Float32Array(n * 3); this.Z = new Float32Array(n);
    }
    fire(x, y, z, speed, size, up = 1) {
        const { P, V, Z } = this, rnd = Math.random;
        for (let i = 0; i < this.n; i++) {
            const a = rnd() * TAU, sp = speed * (.35 + .65 * rnd());
            P[i * 3] = x + (rnd() - .5) * size * 3; P[i * 3 + 1] = y + (rnd() - .5) * size * 2; P[i * 3 + 2] = z + (rnd() - .5) * size * 3;
            V[i * 3] = Math.cos(a) * sp; V[i * 3 + 1] = speed * up * (.5 + .7 * rnd()); V[i * 3 + 2] = Math.sin(a) * sp;
            Z[i] = size * (.6 + .7 * rnd());
        }
        this.life = 0;
        this.mesh.visible = true;
    }
    update(dt, g) {
        if (this.life < 0) return;
        this.life += dt;
        if (this.life > 1) { this.life = -1; this.mesh.visible = false; return; }
        const { P, V, Z, st } = this, fade = 1 - smooth((this.life - .6) / .4);
        for (let i = 0; i < this.n; i++) {
            const j = i * 3;
            V[j + 1] -= g * dt;
            P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt;
            if (P[j + 1] < Z[i] * .5) { P[j + 1] = Z[i] * .5; V[j + 1] *= -.25; V[j] *= .6; V[j + 2] *= .6; }
            _p.set(P[j], P[j + 1], P[j + 2]);
            _q.setFromAxisAngle(_Y, i * 1.7 + this.life * 6);
            _s.set(Z[i] * fade * st[0], Z[i] * fade * st[1], Z[i] * fade * st[2]);
            _m.compose(_p, _q, _s);
            this.mesh.setMatrixAt(i, _m);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

// Lightning: zig-zag chains of thin additive boxes, re-jittered every few frames. fwd > 0 turns the first two bolts
// into long strikes along the parent's -y (the outstretched arm).
class Bolts {
    constructor(parent, nb, segs, color, o = {}) {
        this.o = { len: .3, width: .012, spread: 0, cy: 0, ...o };
        const mk = m => {
            const im = new THREE.InstancedMesh(G.box(1, 1, 1), m, nb * segs);
            im.frustumCulled = false;
            im.castShadow = false;
            im.raycast = () => {};
            im.count = 0;
            parent.add(im);
            return im;
        };
        this.core = mk(glowMat(0xf4ffff, .95));
        this.glow = mk(glowMat(color, .3));
        this.nb = nb; this.segs = segs; this.timer = 0;
        this.pts = new Float32Array((segs + 1) * 3);
    }
    update(dt, amount, fwd = 0) {
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = .05 + Math.random() * .05;
        const { nb, segs, o, pts } = this, rnd = Math.random;
        let k = 0;
        for (let b = 0; b < nb; b++) {
            const strike = b < 2 && fwd > 0;
            if (!strike && rnd() > amount) continue;
            let L, ox = 0, oy = o.cy, oz = 0;
            if (strike) { L = fwd * (.85 + rnd() * .3); _a.set((rnd() - .5) * .12, -1, (rnd() - .5) * .12).normalize(); } else {
                _a.set(rnd() - .5, rnd() - .5, rnd() - .5).normalize();
                L = o.len * (.4 + rnd() * .8) * Math.max(.35, amount);
                if (o.spread) {
                    ox = _a.x * o.spread; oz = _a.z * o.spread * .7; oy += _a.y * o.spread * 1.5;
                    _a.set(rnd() - .5, rnd() - .5, rnd() - .5).normalize();
                }
            }
            for (let s = 0; s <= segs; s++) {
                const f = s / segs, jit = s === 0 ? 0 : L * .14 * (s === segs ? .4 : 1);
                pts[s * 3] = ox + _a.x * L * f + (rnd() - .5) * jit;
                pts[s * 3 + 1] = oy + _a.y * L * f + (rnd() - .5) * jit;
                pts[s * 3 + 2] = oz + _a.z * L * f + (rnd() - .5) * jit;
            }
            for (let s = 0; s < segs; s++) {
                const i = s * 3;
                _v.set(pts[i + 3] - pts[i], pts[i + 4] - pts[i + 1], pts[i + 5] - pts[i + 2]);
                const l = _v.length() || 1e-4;
                _v.divideScalar(l);
                _q.setFromUnitVectors(_Y, _v);
                _p.set((pts[i + 3] + pts[i]) / 2, (pts[i + 4] + pts[i + 1]) / 2, (pts[i + 5] + pts[i + 2]) / 2);
                _s.set(o.width, l, o.width);
                _m.compose(_p, _q, _s);
                this.core.setMatrixAt(k, _m);
                _s.set(o.width * 3.5, l, o.width * 3.5);
                _m.compose(_p, _q, _s);
                this.glow.setMatrixAt(k, _m);
                k++;
            }
        }
        this.core.count = this.glow.count = k;
        this.core.instanceMatrix.needsUpdate = this.glow.instanceMatrix.needsUpdate = true;
    }
}

// ------------------------------------------------------------------ material styles (one per kind)
// Each style fills the rig's joints: seg (a limb segment from the joint along dir: -1 down, +1 up), torso, pelvis,
// hand, foot, head, extras; animate = per-frame effects; death = how the body breaks up.
const halo = (parent, color, size, op, x, y, z) => {
    const h = haloSprite(color, size, op);
    h.position.set(x, y, z);
    h.raycast = () => {};
    parent.add(h);
    return h;
};

const ROCK = {
    mats(R) {
        const c = R.c, map = stoneTex(c.tex);
        R.M.stone = tmat(c.stone, { roughness: .95, map });
        R.M.stone2 = tmat(c.dark, { roughness: .95, map });
        R.M.core = new THREE.MeshStandardMaterial({ color: c.skin, map, emissive: c.crack, emissiveMap: lavaTex(0), emissiveIntensity: c.glow, roughness: 1 });
        R.M.chest = c.chestGlow ? new THREE.MeshStandardMaterial({ color: c.skin, map, emissive: c.crack, emissiveMap: lavaTex(0),
            emissiveIntensity: c.chestGlow, roughness: 1 }) : R.M.core;
        R.M.moss = c.moss ? mat(c.moss, { roughness: 1 }) : null;
        R.M.eye = mat(c.crack, { emissive: c.crack, emissiveIntensity: 2.5 });
        R.M.hole = mat(0x120c08, { roughness: 1 });
    },
    // moss cushion: a flattened lumpy blob draped over a rock
    moss(R, g, r, x, y, z) {
        const m = R.add(g, lumpGeo(R.ri(4) + 20, .35, 3, 1, .2), R.M.moss, x, y, z);
        m.scale.set(r * .9, r * .3, r * .75);
        m.rotation.y = R.rnd() * TAU;
        return m;
    },
    chunk(R, g, r, x, y, z, sy = 1, sx = 1) {
        const m = R.add(g, rockGeo(R.ri(6)), R.rnd() < .3 ? R.M.stone2 : R.M.stone, x, y, z);
        m.scale.set(r * sx * (.95 + R.rnd() * .2), r * sy, r * (.9 + R.rnd() * .2));
        m.rotation.set((R.rnd() - .5) * .3, R.rnd() * TAU, (R.rnd() - .5) * .3);
        R.anchors.push(m);
        return m;
    },
    // slab ring: overlapping flat plates (strata), long splinters (grain) or fat boulders (plates) around an axis
    shell(R, g, len, r0, r1, dir, rows, per = 3, zs = 1) {
        const [w, th, hk, off] = { strata: [.85, .32, .6, .72], grain: [.5, .3, .8, .7], plates: [.72, .4, .62, .66] }[R.c.tex];
        for (let i = 0; i < rows; i++) {
            const t = (i + .5) / rows, r = r0 + (r1 - r0) * t, h = len / rows;
            for (let k = 0; k < per; k++) {
                const a = k * TAU / per + i * 1.1 + R.rnd() * .4;
                const m = ROCK.chunk(R, g, r * w, Math.cos(a) * r * off, dir * (t * len + (R.rnd() - .5) * h * .25), Math.sin(a) * r * off * zs,
                    h * hk / (r * w), th / w);
                m.rotation.set((R.rnd() - .5) * .2, -a, (R.rnd() - .5) * .25);
            }
        }
    },
    seg(R, g, len, r0, r1, dir, part) {
        const k = part === 'fore' ? R.c.fore || 1.15 : 1;
        R.anchors.push(R.add(g, limbGeo(len, r0 * .82, r1 * .82 * k, dir, .18), R.M.core));
        const rows = Math.max(2, Math.round(len / (Math.max(r0, r1) * R.c.slab)));
        ROCK.shell(R, g, len, r0, r1 * k, dir, rows, R.c.tex === 'plates' ? 3 : 4);
    },
    torso(R, g) {
        const D = R.D, T = D.torso, W = D.chestW, Hp = D.hipW, zs = D.chestD / W;
        R.anchors.push(R.add(g, latheGeo(`rock${rd(W)},${rd(Hp)},${rd(T)}`, [[0, -.04], [Hp * .9, -.03], [Hp, .06], [Hp * .82, T * .28],
            [W * .92, T * .6], [W, T * .8], [W * .78, T * .96], [W * .3, T * 1.04], [0, T * 1.05]], 12, zs), R.M.chest));
        const rows = Math.round(3 / R.c.slab);
        ROCK.shell(R, g, T * .9, Hp * 1.1, W * 1.05, 1, rows, R.c.tex === 'plates' ? 4 : 6, zs);
        for (const s of [1, -1]) {                                                      // shoulder boulders
            ROCK.chunk(R, g, D.armR * R.c.shoulder, s * D.shX * .9, D.shY + D.armR * .35, 0, .8);
            if (R.M.moss) ROCK.moss(R, g, D.armR * 1.2, s * D.shX * .9, D.shY + D.armR * 1.15, -D.armR * .1);
        }
        if (R.M.moss) { ROCK.moss(R, g, W * .5, 0, T * .95, -D.chestD * .6); ROCK.moss(R, g, W * .4, -W * .3, T * .8, -D.chestD * .85); }
    },
    pelvis(R, g) {
        const D = R.D;
        R.add(g, lumpGeo(3, .12, 1.5, 1), R.M.core, 0, -.02, 0).scale.set(D.hipW * 1.05, D.hipW * .7, D.chestD * .85);
        for (let k = 0; k < 3; k++) {
            const a = k * TAU / 3 + .5;
            ROCK.chunk(R, g, D.hipW * .45, Math.cos(a) * D.hipW * .6, -.04, Math.sin(a) * D.chestD * .45, .6);
        }
    },
    hand(R, h, s) {
        const r = R.D.hand, c = R.c;
        R.add(h, lumpGeo(5, .15, 1.6, 2), R.M.stone2, 0, -r * .7, 0).scale.set(r * 1.05, r, r * .85);
        ROCK.chunk(R, h, r * .8, 0, -r * .55, r * .25, .9);
        for (let i = -1; i <= 1; i++) {                                                 // thick blunt fingers / claws
            const f = R.add(h, limbGeo(r * c.finger, r * .3, r * .2, -1, .1, 6), R.M.stone, i * r * .48, -r * 1.2, r * .25);
            f.rotation.x = .35;
        }
        R.add(h, limbGeo(r * .8, r * .28, r * .2, -1, .1, 6), R.M.stone, -s * r * .85, -r * .8, r * .4).rotation.z = s * .6;
    },
    foot(R, f) {
        const D = R.D, r = D.legR * 1.3;
        R.add(f, lumpGeo(6, .12, 1.6, 1, .3), R.M.stone2, 0, -D.foot * .55, D.legR * .5).scale.set(r, D.foot * .75, r * 1.5);
        ROCK.chunk(R, f, r * .75, 0, -D.foot * .4, D.legR * 1.1, D.foot * .5 / (r * .75));
    },
    head(R, h) {
        const r = R.D.head, c = R.c;
        R.anchors.push(R.add(h, lumpGeo(8, .1, 1.4, 2), R.M.stone, 0, r * .8, r * .05));
        h.children[h.children.length - 1].scale.set(r * .85, r * 1.05, r * .95);
        ROCK.chunk(R, h, r * .9, 0, r * 1.25, -r * .1, .45);                           // skull plate
        for (const s of [1, -1]) {                                                       // heavy brow slabs, cheek plates
            ROCK.chunk(R, h, r * .5, s * r * .38, r * 1.0, r * .62, .35).rotation.z = s * c.brow;
            ROCK.chunk(R, h, r * .45, s * r * .55, r * .45, r * .35, .7);
            R.add(h, G.sph(rd(r * .16), 6, 5), c.eye ? R.M.eye : R.M.hole, s * r * .34, r * .82, r * .8).scale.set(1, .7, .6);
            if (c.eye) halo(h, c.crack, r * 1.1, .5, s * r * .34, r * .82, r * .95);
        }
        ROCK.chunk(R, h, r * .55, 0, r * .25, r * .45, .55);                            // jaw
        if (R.M.moss && R.c.chestGlow) ROCK.moss(R, h, r * .7, 0, r * 1.5, -r * .3);
    },
    animate(R, q, state, t) {
        const k = 1 + .2 * Math.sin(t * 2.3) + q.harden * 1.8 + q.fx * 1.2;
        R.M.core.emissiveIntensity = R.c.glow * k + q.harden * .4;
        if (R.M.chest !== R.M.core) R.M.chest.emissiveIntensity = R.c.chestGlow * k;
    },
    death: R => ({ mode: 'pile', n: 60, geo: rockGeo(1), mat: R.M.stone, size: [R.D.armR * .6, R.D.armR * 1.15], at: .45, hide: true,
        R: R.D.chestW * 1.7, heap: R.D.chestW * 1.3, spin: 6, jit: R.D.armR * .4, stretch: [1, .75, 1] }),
    impact: true
};

const GOLEM = {
    mats(R) {
        const c = R.c;
        R.M.metal = mat(c.metal, { roughness: .42, metalness: .45 });
        R.M.dark = mat(c.dark, { roughness: .5, metalness: .4 });
        R.M.glow = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 1.6 });
    },
    seg(R, g, len, r0, r1, dir, part) {
        const r2 = r1 * (part === 'fore' ? 1.45 : part === 'shin' ? 1.3 : 1);
        R.add(g, G.sph(rd(r0 * 1.08), 12, 9), R.M.dark);
        R.anchors.push(R.add(g, limbGeo(len * .86, r0 * .95, r2, dir, part === 'fore' || part === 'shin' ? .02 : .15, 12), R.M.metal));
        for (const t of [.12, .62]) {                                                // plate seams
            const r = (r0 + (r2 - r0) * t) * 1.02;
            R.add(g, G.torus(rd(r), rd(r * .07), 4, 16), R.M.dark, 0, dir * t * len * .86, 0).rotation.x = Math.PI / 2;
        }
        if (part === 'shin' || part === 'thigh') {                                  // piston rods at the back
            for (const s of [1, -1]) R.add(g, G.cyl(rd(r0 * .14), rd(r0 * .14), rd(len * .75), 6), R.M.dark, s * r0 * .55, dir * len * .45, -r0 * .9);
        }
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        for (let i = 0; i < 5; i++) R.add(g, G.torus(rd(D.hipW * .6), .03, 6, 16), R.M.glow, 0, .02 + i * .045, 0).rotation.x = Math.PI / 2;
        R.add(g, G.cyl(rd(D.hipW * .45), rd(D.hipW * .45), .22, 10), R.M.glow, 0, .11, 0);
        R.add(g, G.cyl(rd(D.chestW * .62), rd(D.hipW * .6), rd(T * .1), 12), R.M.dark, 0, .25, 0);
        const chest = R.add(g, G.sph(1, 16, 12), R.M.metal, 0, T * .7, 0);
        chest.scale.set(D.chestW, T * .38, D.chestD);
        R.anchors.push(chest);
        R.add(g, G.box(rd(D.chestW * 1.1), rd(T * .26), .08), R.M.dark, 0, T * .68, D.chestD * .86).rotation.x = -.15;
        for (let i = -2; i <= 2; i++) R.add(g, G.sph(.02, 5, 4), R.M.metal, i * D.chestW * .22, T * .8, D.chestD * .9);
        for (let i = 0; i < 3; i++) {                                                // ribbed belly plates
            const rb = R.add(g, G.torus(rd(D.chestW * (.82 - i * .1)), .022, 4, 16, Math.PI), R.M.dark, 0, T * (.45 - i * .06), D.chestD * .05);
            rb.scale.set(1, D.chestD / D.chestW * 1.1, 1);
            rb.rotation.x = Math.PI / 2 + .2;
        }
        for (const s of [1, -1]) {
            const p = R.add(g, G.sph(rd(D.armR * 1.9), 12, 9), R.M.metal, s * D.shX, D.shY + D.armR * .4, 0);
            p.scale.set(1, .85, 1);
            R.anchors.push(p);
            R.add(g, G.torus(rd(D.armR * 1.75), .025, 5, 16), R.M.dark, s * D.shX, D.shY + D.armR * .2, 0).rotation.x = Math.PI / 2;
        }
        R.add(g, G.cyl(rd(D.head * .8), rd(D.head), .08, 10), R.M.dark, 0, T, D.headZ);
    },
    pelvis(R, g) {
        const D = R.D;
        R.add(g, G.box(rd(D.hipW * 2.1), .2, rd(D.chestD * 1.3)), R.M.dark, 0, -.04, 0);
    },
    hand(R, h, s) {
        const r = R.D.hand;
        R.add(h, G.box(rd(r * 1.25), rd(r * 1.0), rd(r * .9)), R.M.metal, 0, -r * .5, 0);
        for (let i = -1; i <= 1; i++) {                                              // three jointed claws, curled in
            const f = R.grp(h, i * r * .42, -r * .95, r * .1);
            f.rotation.set(.25, 0, -i * .12);
            R.add(f, limbGeo(r * .6, r * .16, r * .13, -1, .05, 6), R.M.dark);
            const tip = R.grp(f, 0, -r * .6, 0);
            tip.rotation.x = .7;
            R.add(tip, G.cone(rd(r * .13), rd(r * .55), 5), R.M.metal, 0, -r * .27, 0).rotation.x = Math.PI;
        }
        const th = R.grp(h, -s * r * .65, -r * .7, r * .3);
        th.rotation.set(.6, 0, s * .5);
        R.add(th, limbGeo(r * .55, r * .15, r * .12, -1, .05, 6), R.M.dark);
    },
    foot(R, f) {
        const D = R.D;
        R.add(f, G.box(rd(D.legR * 2.4), rd(D.foot), rd(D.legR * 3.2)), R.M.dark, 0, -D.foot / 2, D.legR * .5);
    },
    head(R, h) {
        const r = R.D.head;
        R.add(h, G.sph(r, 14, 9, 0, TAU, 0, Math.PI / 2), R.M.metal, 0, r * .55, 0);
        R.add(h, G.cyl(r, rd(r * .9), rd(r * .7), 14), R.M.metal, 0, r * .2, 0);
        R.add(h, G.box(rd(r * 1.7), rd(r * .16), rd(r * .4)), R.M.dark, 0, r * .62, r * .78);
        R.add(h, G.box(rd(r * .16), rd(r * .3), rd(r * 1.6)), R.M.dark, 0, r * 1.45, 0);           // crest ridge
        R.add(h, G.box(rd(r * .9), rd(r * .12), .03), R.M.dark, 0, r * .1, r * .9);
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .2), 8, 6), R.M.glow, s * r * .4, r * .38, r * .84);
            halo(h, R.c.glow, r * 1.6, .7, s * r * .4, r * .38, r * 1.0);
        }
    },
    animate(R, q, state, t) {
        R.M.glow.emissiveIntensity = 1.5 + .35 * Math.sin(t * 3) + q.harden * 1.2 + q.fx;
    },
    death: R => ({ mode: 'pile', n: 9, geo: rockGeo(2), mat: R.M.metal, size: [.05, .1], at: 1.0, hide: false, R: R.D.chestW * 2.5,
        heap: .04, spin: 8, jit: .05 }),
    impact: true
};

const AUTOMATON = {
    mats(R) {
        const c = R.c;
        R.M.metal = mat(c.metal, { roughness: .38, metalness: .5 });
        R.M.plate = mat(c.plate, { roughness: .3, metalness: .55 });
        R.M.brass = mat(c.brass, { roughness: .35, metalness: .6, emissive: 0x2a1a06, emissiveIntensity: .5 });
        R.M.glow = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 2 });
    },
    gear(R, g, r, x, y, z, ry = 0, sp = 1.2) {
        const m = R.add(g, gearGeo(), R.M.brass, x, y, z);
        m.scale.set(r, r, r);
        m.rotation.y = ry;
        R.spin.push({ o: m, ax: 'z', sp });
        R.anchors.push(m);
        return m;
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0 * 1.25), 10, 8), R.M.brass);
        R.tube(g, len, r0 * .5, r1 * .5, dir, R.M.metal, 7);
        R.anchors.push(R.add(g, G.box(rd(r0 * 2.1), rd(len * .55), rd(r0 * 1.7)), R.M.plate, 0, dir * len * .42, r0 * .25));
        if (part === 'shin' || part === 'thigh') R.add(g, G.cyl(rd(r0 * .25), rd(r0 * .25), rd(len * .7), 5), R.M.brass, 0, dir * len * .5, -r0 * 1.1);
        for (const s of [1, -1]) R.add(g, G.sph(rd(r0 * .18), 5, 4), R.M.brass, s * r0 * .7, dir * len * .3, r0 * 1.12);
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        R.add(g, G.cyl(.035, .035, rd(T), 6), R.M.metal, 0, T / 2, -D.chestD * .3);
        R.add(g, G.cyl(rd(D.hipW * .5), rd(D.hipW * .6), rd(T * .3), 8), R.M.metal, 0, T * .15, 0);
        for (let i = 0; i < 4; i++) {
            const rb = R.add(g, G.torus(rd(D.chestW * (.85 - i * .08)), .018, 4, 14, Math.PI * 1.4), R.M.plate, 0, T * (.42 + i * .13), 0);
            rb.rotation.set(Math.PI / 2, 0, -.2 * Math.PI);
            rb.scale.set(1, D.chestD / D.chestW, 1);
        }
        R.add(g, G.box(rd(D.chestW * 1.5), rd(T * .22), .05), R.M.plate, 0, T * .86, D.chestD * .8);
        AUTOMATON.gear(R, g, D.chestW * .62, 0, T * .55, D.chestD * .95, 0, 1.2);                  // big chest gear
        AUTOMATON.gear(R, g, D.chestW * .3, D.chestW * .55, T * .32, D.chestD * .85, 0, -2.4);
        R.add(g, G.cyl(rd(D.chestW * .14), rd(D.chestW * .14), .04, 8), R.M.metal, 0, T * .55, D.chestD * 1.02).rotation.x = Math.PI / 2;
        for (const s of [1, -1]) {
            R.add(g, G.sph(rd(D.armR * 2.2), 10, 6, 0, TAU, 0, Math.PI / 2), R.M.plate, s * D.shX, D.shY + .01, 0).scale.set(1, .7, 1.1);
            R.add(g, G.box(rd(D.shX * .7), .04, rd(D.chestD * 1.1)), R.M.metal, s * D.shX * .5, D.shY + .02, 0);
            AUTOMATON.gear(R, g, D.armR * 1.6, s * (D.shX + D.armR * 1.2), D.shY, 0, Math.PI / 2, s * 2);
        }
    },
    pelvis(R, g) {
        const D = R.D;
        R.add(g, G.box(rd(D.hipW * 2), .1, rd(D.chestD * 1.4)), R.M.plate, 0, -.02, 0);
        AUTOMATON.gear(R, g, .06, 0, -.02, D.chestD * .72, 0, -2);
    },
    hand(R, h, s) {
        const r = R.D.hand;
        R.add(h, G.box(rd(r), rd(r * .8), rd(r * .45)), R.M.plate, 0, -r * .45, 0);
        for (const x of [-.36, -.12, .12, .36]) R.add(h, G.cyl(rd(r * .08), rd(r * .07), rd(r * .8), 5), R.M.metal, x * r, -r * 1.2, r * .05).rotation.x = .25;
        R.add(h, G.cyl(rd(r * .09), rd(r * .07), rd(r * .6), 5), R.M.metal, -s * r * .55, -r * .65, r * .2).rotation.z = s * .5;
    },
    foot(R, f) {
        const D = R.D;
        R.add(f, G.box(rd(D.legR * 3), rd(D.foot), rd(D.legR * 5.5)), R.M.plate, 0, -D.foot / 2, D.legR * 1.4);
    },
    head(R, h) {
        const r = R.D.head;
        R.add(h, lumpGeo(11, .06, 1.2, 2), R.M.metal, 0, r * .8, 0).scale.set(r * .78, r * .82, r * .8);
        R.add(h, G.box(rd(r * 1.1), rd(r * .5), rd(r * .9)), R.M.plate, 0, r * .3, r * .25);          // jaw
        R.add(h, G.sph(rd(r * .8), 10, 6, 0, TAU, 0, Math.PI / 2), R.M.plate, 0, r * 1.45, 0).scale.set(.95, .6, .9);
        R.add(h, G.box(rd(r * 1.1), rd(r * .55), .04), R.M.plate, 0, r * .95, r * .76);
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .17), 8, 6), R.M.glow, s * r * .32, r * 1.0, r * .84);
            halo(h, R.c.glow, r * 1.4, .75, s * r * .32, r * 1.0, r * .9);
        }
        R.add(h, G.box(rd(r * .2), rd(r * .55), .04), R.M.glow, 0, r * .38, r * .72);                   // mouth vent
        for (const s of [1, -1]) R.add(h, G.cyl(rd(r * .24), rd(r * .24), rd(r * .2), 10), R.M.plate, s * r * .32, r * 1.0, r * .76).rotation.x = Math.PI / 2;
        AUTOMATON.gear(R, h, r * .6, -r * .75, r * 1.15, -r * .1, Math.PI / 2, 1.5);
        AUTOMATON.gear(R, h, r * .45, r * .2, r * 1.62, -r * .15, Math.PI / 2 - .3, -2.5);
        AUTOMATON.gear(R, h, r * .3, r * .7, r * 1.35, r * .1, Math.PI / 2, 3);
    },
    animate(R, q, state, t, dt, g) {
        R.M.glow.emissiveIntensity = 2 + .4 * Math.sin(t * 5) + q.harden + q.fx;
        R.spinMul = 1 + g * 2 + q.fx * 3;
    },
    death: R => ({ mode: 'pile', n: 10, geo: gearGeo(), mat: R.M.brass, size: [.03, .06], at: .9, hide: false, R: R.D.chestW * 3,
        heap: .02, spin: 10, jit: .03 })
};

const FIRE = {
    mats(R) {
        const c = R.c;
        R.M.core = new THREE.MeshStandardMaterial({ color: c.core, emissive: c.ember, emissiveIntensity: c.glow, emissiveMap: lavaTex(c.lava), roughness: .9 });
        R.M.shell = glowMat(c.flame, c.shell);
        R.M.eye = mat(0xfff4c0, { emissive: 0xfff0a0, emissiveIntensity: 2.5 });
        R.M.ember = new THREE.MeshStandardMaterial({ color: 0x1a0804, emissive: c.ember, emissiveIntensity: 2, emissiveMap: lavaTex(60), roughness: .9 });
    },
    // curved additive flame tongue in a group (the group's scale flickers, the mesh carries the size)
    flame(R, g, x, y, z, size) {
        const f = R.grp(g, x, y, z);
        const m = R.add(f, flameGeo(R.ri(3)), flameMat(R.c.fop), 0, -size * .1, 0);
        m.scale.set(size * 1.1, size * 1.5, size * 1.1);
        m.rotation.y = R.rnd() * TAU;
        m.castShadow = false;
        m.raycast = () => {};
        f.userData.seed = R.rnd() * 10;
        R.flames.push(f);
        return f;
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.anchors.push(R.add(g, limbGeo(len, r0, r1, dir, .12, 9), R.M.core));
        R.add(g, limbGeo(len, r0 * 1.5, r1 * 1.6, dir, .1, 8), R.M.shell).castShadow = false;
        const n = Math.max(1, Math.round(len / .2 * R.c.fl));
        for (let i = 0; i < n; i++) {
            const t = (i + .6) / n, a = R.rnd() * TAU, r = r0 + (r1 - r0) * t;
            FIRE.flame(R, g, Math.cos(a) * r * .8, dir * t * len, Math.sin(a) * r * .8, r * (2 + R.rnd()) * R.c.fs);
        }
    },
    torso(R, g) {
        const D = R.D, T = D.torso, c = R.c;
        R.anchors.push(R.add(g, torsoGeo(D, .75), R.M.core));
        const sh = R.add(g, torsoGeo(D, .75), R.M.shell, 0, -T * .07, 0);
        sh.scale.set(1.3, 1.14, 1.35);
        sh.castShadow = false;
        for (const s of [1, -1]) {
            FIRE.flame(R, g, s * D.shX * .8, D.shY + .02, 0, D.armR * 3.6 * c.fs);
            FIRE.flame(R, g, s * D.chestW * .5, T * .7, -D.chestD * .6, D.armR * 3 * c.fs);
            FIRE.flame(R, g, s * D.chestW * .4, T * .45, D.chestD * .7, D.armR * 2.4 * c.fs);
        }
        FIRE.flame(R, g, 0, T * .85, -D.chestD * .5, D.armR * 3.4 * c.fs);
        R.glows.push(halo(g, c.flame, D.chestW * 7, .45, 0, T * .6, 0));
    },
    pelvis(R, g) {
        R.add(g, G.sph(rd(R.D.hipW), 10, 8), R.M.core).scale.set(1, .8, .85);
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, G.sph(rd(r * .8), 8, 6), R.M.core, 0, -r * .5, 0).scale.set(1, 1.1, .7);
        for (let i = -1; i <= 1; i++) {
            R.add(h, G.cone(rd(r * .15), rd(r * .9), 5), R.M.core, i * r * .35, -r * 1.25, r * .1).rotation.x = Math.PI;
            FIRE.flame(R, h, i * r * .4, -r * .9, r * .1, r * 1.5 * R.c.fs);
        }
    },
    foot(R, f) {
        const D = R.D;
        R.add(f, G.sph(rd(D.legR * 1.3), 8, 6), R.M.core, 0, -D.foot * .3, D.legR * .5).scale.set(1, .6, 1.6);
        for (let i = 0; i < 3; i++) FIRE.flame(R, f, (i - 1) * D.legR * .9, -D.foot * .6, D.legR * (.2 + i % 2 * .8), D.legR * 3.5 * R.c.fs);
    },
    head(R, h) {
        const r = R.D.head, c = R.c, J = R.j;
        R.add(h, G.sph(r, 12, 9), R.M.core, 0, r * .8, 0).scale.set(.85, 1.05, .95);
        R.add(h, G.sph(r, 10, 8), R.M.shell, 0, r * .9, 0).scale.setScalar(1.35);
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .14), 6, 5), R.M.eye, s * r * .35, r * .85, r * .82);
            halo(h, 0xffe080, r * 1.3, .8, s * r * .35, r * .85, r * .95);
        }
        if (c.horns) for (const s of [1, -1]) {                                       // flame horns
            const f = FIRE.flame(R, h, s * r * .45, r * 1.3, 0, r * 2.2 * c.fs);
            f.rotation.set(-.2, 0, -s * .7);
        }
        for (let i = 0; i < 7; i++) {                                               // hair of flame, swept back
            const f = FIRE.flame(R, h, (i - 3) * r * .24, r * (1.45 - Math.abs(i - 3) * .1), -r * .15 - (i % 2) * r * .3, r * (1.5 + (i % 3) * .3) * c.fs);
            f.rotation.x = -.35;
        }
        // breath: three nested cones from the mouth along +z, scaled by the attack effect
        J.jet = R.grp(h, 0, r * .5, r * .85);
        J.jet.visible = false;
        J.jetCones = [[.7, .07, 0xfff0b0, .9], [1.3, .16, c.flame, .7], [2.1, .32, 0xff6a20, .22]].map(([l, rad, col, op]) => {
            const m = R.add(J.jet, G.cone(rad, l, 8), glowMat(col, op), 0, 0, l / 2);
            m.rotation.x = -Math.PI / 2;
            m.castShadow = false;
            return m;
        });
    },
    extras(R) {
        R.pileFlames = R.grp(R.root);
        R.pileFlames.visible = false;
        for (let i = 0; i < 4; i++) {
            const a = i * TAU / 4;
            flameTongue(R.pileFlames, Math.cos(a) * R.D.chestW * .5, 0, Math.sin(a) * R.D.chestW * .5, .16 + (i % 2) * .06, R.c.flame);
        }
    },
    animate(R, q, state, t) {
        const amp = 1 + q.harden * .7 + q.fx * .4;
        for (const f of R.flames) {
            const s = f.userData.seed;
            f.scale.set(1 + q.harden * .2, (.75 + .35 * Math.sin(t * 11 + s) * Math.sin(t * 4.7 + s * 2) + .25) * amp, 1 + q.harden * .2);
            f.rotation.z = Math.sin(t * 6 + s) * .15;
        }
        R.M.core.emissiveIntensity = R.c.glow * (1 + .15 * Math.sin(t * 9) * Math.sin(t * 3.3) + q.harden * .5);
        for (const h of R.glows) h.material.opacity = .4 + .08 * Math.sin(t * 13) + q.harden * .2;
        const J = R.j, fx = q.fx;
        J.jet.visible = fx > .03;
        if (J.jet.visible) {
            J.jet.scale.set(fx * (1 + .12 * Math.sin(t * 31)), fx * (1 + .12 * Math.sin(t * 27)), fx * (.9 + .1 * Math.sin(t * 19)));
            J.jetCones.forEach((m, i) => { m.scale.x = m.scale.z = 1 + .2 * Math.sin(t * (23 + i * 7) + i); });
        }
    },
    deathFx(R, tt, t) {
        R.M.ember.emissiveIntensity = .5 + 2.2 * Math.exp(-tt / 1.5);
        const k = Math.max(.5, 1.5 * Math.exp(-tt / 1.2));
        R.pileFlames.children.forEach((f, i) => {
            const s = f.userData.seed;
            f.scale.set(k, k * (.8 + .3 * Math.sin(t * 11 + s) * Math.sin(t * 4.7 + i)), k);
        });
    },
    onBreak(R) {
        R.pileFlames.position.set(R.debris.cx, 0, R.debris.cz);
        R.pileFlames.visible = true;
    },
    onReset(R) { R.pileFlames.visible = false; },
    death: R => ({ mode: 'pile', n: 54, geo: rockGeo(3), mat: R.M.ember, size: [.035, .07], at: .5, hide: true, R: R.D.chestW * 2,
        heap: R.D.chestW * .6, spin: 6, jit: .05 })
};

const WATER = {
    mats(R) {
        const c = R.c;
        R.M.water = new THREE.MeshStandardMaterial({ color: c.water, transparent: true, opacity: .74, roughness: .08, metalness: .15,
            emissive: c.glint, emissiveMap: streakTex(), emissiveIntensity: .7 });
        R.M.foam = tmat(c.foam, { roughness: .6, map: smokeTex(), emissive: 0x5a7a8a, emissiveIntensity: .45 });
        R.M.eye = mat(c.eye, { emissive: c.eye, emissiveIntensity: 2.5 });
        R.M.dark = mat(0x06202e, { roughness: .3 });
    },
    foam(R, g, n, o) { R.motes.push(new Motes(g, G.sph(1, 5, 4), R.M.foam, n, { radial: [.95, 1.12], speed: [.5, 1.5], size: [.012, .025], wobble: .05, ...o }, R.rnd)); },
    // streaming water ribbon hanging from a limb, waving (wigglers)
    stream(R, parent, x, y, z, len, rx = 0, rz = 0) {
        const g = R.grp(parent, x, y, z);
        R.add(g, tendrilGeo(R.ri(3)), R.M.water).scale.set(len * 1.6, len, len * 1.6);
        g.rotation.set(rx, 0, rz);
        R.wigglers.push({ g, ph: R.rnd() * TAU, amp: .25, rz, rx });
        return g;
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.anchors.push(R.add(g, limbGeo(len, r0, r1 * (part === 'fore' ? 1.15 : 1), dir, .15, 10), R.M.water));
        WATER.foam(R, g, Math.round(len * 18), { len, r0, r1, dir, flow: .35 });
        if (part === 'fore') for (let i = 0; i < 2; i++) WATER.stream(R, g, 0, -len * (.35 + i * .35), -r0 * .6, .3 + i * .1, .5, 0);
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        R.anchors.push(R.add(g, torsoGeo(D, .7), R.M.water));
        WATER.foam(R, g, 18, { len: T, r0: D.hipW, r1: D.chestW, dir: 1, zs: D.chestD / D.chestW, flow: -.3 });
        for (const s of [1, -1]) {                                                       // shoulder spray swept back
            const sp = R.add(g, lumpGeo(31, .3, 2.5, 2), R.M.foam, s * D.shX * .85, D.shY + .02, -D.chestD * .3);
            sp.scale.set(D.armR * 1.3, D.armR * .8, D.armR * 1.6);
        }
    },
    column(R) {
        const D = R.D, H = R.H, J = R.j;
        J.low = R.grp(R.root);
        // rising swell: narrow under the hips, flaring into a breaking wave at the ground
        const geo = cachedGeo(`wave${rd(D.hipW)},${rd(H)}`, () => {
            const g = new THREE.LatheGeometry([[2.6, 0], [2.4, .08], [1.5, .25], [1.0, .5], [.9, .8], [.85, 1.02]]
                .map(([r, y]) => new THREE.Vector2(D.hipW * r, H * y)), 16), p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i) / H, a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + .1 * Math.sin(a * 3 + y * 8) * (1 - y);
                p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
            }
            g.computeVertexNormals();
            return g;
        });
        R.anchors.push(R.add(J.low, geo, R.M.water));
        const crown = R.grp(J.low);                                                // churning foam ring at the base
        for (let i = 0; i < 14; i++) {
            const a = i * TAU / 14, rr = D.hipW * (2.3 + (i % 3) * .25), s = .07 + (i % 4) * .025;
            const m = R.add(crown, lumpGeo(40 + (i % 4), .35, 2.2, 1, .3), R.M.foam, Math.cos(a) * rr, s * .3, Math.sin(a) * rr);
            m.scale.set(s * 1.6, s * .7, s * 1.3);
        }
        R.spin.push({ o: crown, ax: 'y', sp: .6 });
        // curling crest behind the body
        const crest = R.grp(J.low, 0, 0, -D.hipW * 1.2);
        R.add(crest, taperTube([[0, .1, 0], [0, H * .35, -.12], [0, H * .62, -.05], [0, H * .72, .12], [0, H * .64, .22]], .16, .03, 12, 8), R.M.water).scale.set(2.2, 1, 1);
        R.add(crest, lumpGeo(44, .4, 2.5, 2), R.M.foam, 0, H * .66, .14).scale.set(.18, .08, .1);
        const spiral = [];                                                          // foam streak spiralling up the swell
        for (let i = 0; i <= 12; i++) {
            const t = i / 12, r = D.hipW * (2.4 - 1.5 * Math.sqrt(t)) * 1.04, a = t * TAU * 1.3;
            spiral.push([Math.cos(a) * r, H * t * .9 + .03, Math.sin(a) * r]);
        }
        const sw = R.grp(J.low);
        R.add(sw, taperTube(spiral, .03, .012, 30, 5), R.M.foam);
        R.spin.push({ o: sw, ax: 'y', sp: -1.6 });
        WATER.foam(R, J.low, 40, { len: H, r0: D.hipW * 2.6, r1: D.hipW, dir: 1, speed: [1.5, 3], size: [.015, .03], flow: -.4 });
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, lumpGeo(12, .06, 1.3, 3), R.M.water, 0, r * .85, 0));
        h.children[h.children.length - 1].scale.set(r * .9, r * 1.1, r);
        for (let i = 0; i < 7; i++) {                                               // hair of water streaming back
            const x = (i - 3) * r * .26, g = R.grp(h, x, r * 1.45 - Math.abs(i - 3) * r * .14, -r * .2);
            R.add(g, taperTube([[0, 0, 0], [x * .3, r * .35, -r * .7], [x * .7, r * .1, -r * 1.6], [x * 1.2, -r * .7, -r * 2.4], [x * 1.4, -r * 1.6, -r * 2.7]],
                r * .26, r * .03, 10, 6),
                i % 3 === 1 ? R.M.foam : R.M.water);
            R.wigglers.push({ g, ph: i * 1.1, amp: .12, rz: 0, rx: 0 });
        }
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .15), 6, 5), R.M.eye, s * r * .34, r * .98, r * .8);
            halo(h, 0xc0f4ff, r * 1.1, .8, s * r * .34, r * .98, r * .95);
        }
        R.add(h, G.sph(rd(r * .24), 8, 6), R.M.dark, 0, r * .42, r * .78).scale.set(.9, 1.4, .5);       // screaming mouth
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, lumpGeo(13, .1, 1.5, 2), R.M.water, 0, -r * .5, 0).scale.set(r, r * 1.1, r * .75);
        for (let i = -1; i <= 1; i++) R.add(h, limbGeo(r * .9, r * .22, r * .06, -1, 0, 6), R.M.water, i * r * .42, -r * .9, 0);
    },
    animate(R, q) {
        R.M.water.opacity = .74 + q.harden * .2;
        R.M.water.emissiveIntensity = .7 + q.harden * .8 + q.fx * .5;
        R.M.water.emissiveMap.offset.y = -R.moteClock * .25;
        R.moteSpeed = 1 + q.harden + q.fx * 2;
        R.spinMul = 1 + q.fx * 2;
        R.wigMul = 1 + q.fx + R.scatter;
    },
    extras(R) {
        R.puddle = R.add(R.root, new THREE.CircleGeometry(1, 20), R.M.water, 0, .012, 0);
        R.puddle.rotation.x = -Math.PI / 2;
        R.puddle.visible = false;
        R.puddle.castShadow = false;
    },
    onBreak(R) { R.puddle.position.set(R.debris.cx, .012, R.debris.cz); R.puddle.visible = true; R.puddle.scale.setScalar(.01); },
    deathFx(R, tt) { R.puddle.scale.setScalar(R.D.chestW * 2.8 * (.05 + .95 * smooth(tt / .8))); },
    onReset(R) { R.puddle.visible = false; },
    death: R => ({ mode: 'splash', n: 46, geo: G.sph(1, 8, 6), mat: R.M.water, size: [.04, .08], at: .35, hide: true, R: R.D.chestW * 2.6,
        far: .6, flat: .8, spin: 0, jit: .05 }),
    impact: true
};

const AIR = {
    mats(R) {
        const c = R.c;
        R.M.cloud = tmat(c.cloud, { roughness: 1, map: smokeTex(), emissive: 0x3a4046, emissiveIntensity: .55 });
        R.M.cloud2 = tmat(c.air, { roughness: 1, map: smokeTex(), emissive: 0x2a3036, emissiveIntensity: .5 });
        R.M.air = new THREE.MeshStandardMaterial({ color: c.cloud, transparent: true, opacity: .38, depthWrite: false, roughness: 1,
            emissive: 0x50565c, emissiveIntensity: .5, map: streakTex(1), side: THREE.DoubleSide });
        R.M.dark = mat(0x1a1d22, { roughness: 1 });
        R.M.dust = mat(c.dust, { roughness: 1 });
    },
    puff(R, g, r, x, y, z, sy = 1, m = R.M.cloud) {
        const p = R.add(g, lumpGeo(50 + R.ri(5), .24, 2.2, 3), m, x, y, z);
        p.scale.set(r, r * sy, r);
        p.rotation.y = R.rnd() * TAU;
        return p;
    },
    // transparent smoke wisp spiralling around an axis, spinning
    wisp(R, g, r, y0, h, sp, turns = 1) {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, a = t * TAU * turns; pts.push([Math.cos(a) * r, y0 + h * t, Math.sin(a) * r]); }
        const w = R.grp(g);
        const m = R.add(w, taperTube(pts, r * .25, r * .05, 24, 5), R.M.air);
        m.castShadow = false;
        R.spin.push({ o: w, ax: 'y', sp });
        return w;
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.anchors.push(R.add(g, limbGeo(len, r0, r1, dir, .2, 10), R.M.cloud2));
        AIR.puff(R, g, r0 * 1.2, 0, dir * len * .1, 0, .9);
        for (let i = 0; i < 2; i++) {                                                  // billows along the limb
            const t = .4 + i * .3, a = R.rnd() * TAU, r = (r0 + (r1 - r0) * t) * .9;
            AIR.puff(R, g, r, Math.cos(a) * r * .45, dir * t * len, Math.sin(a) * r * .45, 1.1, R.M.cloud2);
        }
        if (part === 'fore') AIR.wisp(R, g, r1 * 1.4, -len, len * .8, 5 * (R.rnd() < .5 ? -1 : 1), 1.2);
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        R.anchors.push(R.add(g, torsoGeo(D, .65), R.M.cloud2));
        for (const s of [1, -1]) AIR.puff(R, g, D.armR * 1.7, s * D.shX * .85, D.shY + D.armR * .3, 0, .75);
        [[.4, .7, .45, .32], [-.45, .55, .4, .3], [0, .85, -.5, .42], [.3, .25, .4, .26], [-.2, .35, -.45, .3]]
            .forEach(([x, y, z, k]) => AIR.puff(R, g, k * D.chestW, x * D.chestW, y * T, z * D.chestD, .8));
        AIR.wisp(R, g, D.chestW * 1.15, T * .1, T * .7, 3, .9);
        for (let i = 0; i < 5; i++) {                                                  // smoke boiling off the hips
            const a = i * TAU / 5 + .4;
            AIR.puff(R, g, D.hipW * .75, Math.cos(a) * D.hipW, -T * .05, Math.sin(a) * D.chestD, .8, R.M.cloud2);
        }
    },
    column(R) {
        const D = R.D, H = R.H, J = R.j;
        J.low = R.grp(R.root);
        // vortex funnel: open lathe, narrow at the ground, opening into the hips; spins
        const fun = R.grp(J.low);
        const f = R.add(fun, latheGeo(`funnel${rd(D.hipW)},${rd(H)}`, [[D.hipW * .35, 0], [D.hipW * .5, H * .3], [D.hipW * .8, H * .65], [D.hipW * 1.15, H * 1.02]], 14),
            R.M.air);
        f.castShadow = false;
        R.spin.push({ o: fun, ax: 'y', sp: 6 });
        const core = R.add(J.low, limbGeo(H * .9, D.hipW * .32, D.hipW * .7, 1, .1, 10), R.M.cloud2, 0, H * .12, 0);
        R.anchors.push(core);
        AIR.wisp(R, J.low, D.hipW * 1.3, H * .1, H * .8, -5, 1.6);
        // mist bank on the ground
        for (let i = 0; i < 9; i++) {
            const a = i * TAU / 9 + .3, rr = D.hipW * (1.6 + (i % 2) * 1.1), s = D.hipW * (1.2 + (i % 3) * .35);
            R.add(J.low, lumpGeo(60 + i % 3, .24, 2.2, 3, .3), R.M.cloud, Math.cos(a) * rr, s * .3, Math.sin(a) * rr).scale.set(s, s * .55, s);
        }
        R.add(J.low, lumpGeo(63, .24, 2.2, 3, .3), R.M.cloud, 0, D.hipW * .66, 0).scale.set(D.hipW * 2, D.hipW * 1.2, D.hipW * 2);
        AIR.puff(R, J.low, D.hipW * 1.3, 0, H * .35, 0, .9, R.M.cloud2);
        R.motes.push(new Motes(J.low, G.sph(1, 4, 3), R.M.dust, 40, { len: H * .9, r0: .32, r1: D.hipW * 1.3, dir: 1,
            radial: [1, 1.8], speed: [3, 6], size: [.012, .03], flow: .15, signed: false }, R.rnd));
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(AIR.puff(R, h, r * .78, 0, r * .7, r * .05, 1.15));             // face
        for (const s of [1, -1]) R.add(h, G.sph(rd(r * .2), 8, 6), R.M.dark, s * r * .3, r * .82, r * .66).scale.set(1, 1.3, .6);
        R.add(h, G.sph(rd(r * .2), 8, 6), R.M.dark, 0, r * .35, r * .7).scale.set(.9, 1.6, .6);
        // mushroom cloud: a wide billowing cap over a smoky stalk
        AIR.puff(R, h, r * .75, 0, r * 1.45, -r * .15, 1.2);
        AIR.puff(R, h, r * 2.5, 0, r * 2.6, -r * .3, .7);
        [[1.4, 2.2, .3, 1.05], [-1.4, 2.25, .2, 1], [.8, 3.1, -.4, 1.1], [-.9, 3.0, -.5, 1.05], [0, 3.35, .2, 1], [1.7, 2.7, -.9, .85],
            [-1.7, 2.75, -.8, .9], [.2, 2.3, 1.1, .85], [0, 2.8, -1.4, .95], [-.6, 2.0, .9, .7], [.9, 2.0, .8, .65]]
            .forEach(([x, y, z, k]) => AIR.puff(R, h, r * k * 1.2, x * r * 1.25, y * r * 1.1, z * r * 1.2, .9));
    },
    hand(R, h) {
        const r = R.D.hand;
        AIR.puff(R, h, r * .8, 0, -r * .5, 0, 1.1, R.M.cloud2);
        for (let i = -1; i <= 1; i++) R.add(h, limbGeo(r, r * .22, r * .05, -1, 0, 6), R.M.cloud2, i * r * .4, -r * .9, 0);
    },
    animate(R, q) {
        R.spinMul = 1 + q.harden * 2 + q.fx * 2;
        R.moteSpeed = 1 + q.harden * 1.5 + q.fx * 2;
        R.moteSpread = 1 + q.fx * .4 + R.scatter * .5;
        R.M.air.map.offset.y = -R.moteClock * .4;
    },
    death: R => ({ mode: 'dust', n: 56, geo: G.sph(1, 5, 4), mat: R.M.dust, size: [.025, .05], at: .3, hide: true, R: R.D.chestW * 3,
        far: 1.2, spin: 4, jit: .08 })
};

const VESTRAD = {
    mats(R) {
        const c = R.c;
        R.M.robe = mat(c.robe, { roughness: .9, emissive: 0x0a2a48, emissiveIntensity: .35, side: THREE.DoubleSide });
        R.M.dark = new THREE.MeshBasicMaterial({ color: 0x010203 });
        R.M.glow = mat(0xe8ffff, { emissive: c.bolt, emissiveIntensity: 3 });
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0), 10, 8), R.M.robe);
        R.tube(g, len, r0, part === 'fore' ? r1 * 1.9 : r1, dir, R.M.robe, 10);
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        R.anchors.push(R.tube(g, T, D.hipW, D.chestW * .9, 1, R.M.robe, 12));
        R.add(g, G.cyl(rd(D.chestW * .6), rd(D.shX * 1.15), rd(T * .38), 12), R.M.robe, 0, T * .8, 0);
        R.glows.push(halo(g, R.c.bolt, D.chestW * 4, .25, 0, T * .55, D.chestD * .6));
        R.bolts.push({ b: new Bolts(g, 10, 5, R.c.bolt, { len: .6, width: .008, spread: D.chestW * 1.2, cy: T * .5 }), fwd: false });
        R.shield = R.add(g, G.sph(1, 16, 12), glowMat(R.c.bolt, .14), 0, T * .4, 0);
        R.shield.scale.setScalar(.001);
        R.shield.castShadow = false;
    },
    robe(R) {
        const D = R.D, J = R.j, L = R.robeLen = R.H - .12, top = D.waist + .08;
        J.robe = R.grp(J.body);
        const geo = new THREE.CylinderGeometry(D.hipW * .95, D.hipW * 2.3, L + top, 14, 3, true), p = geo.attributes.position;
        geo.translate(0, (top - L) / 2, 0);
        for (let i = 0; i < p.count; i++) {
            const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i), k = 1 + .07 * Math.sin(a * 7) * (-y / L);
            p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
            if (y < -L + .01) p.setY(i, y + Math.abs(Math.sin(a * 5 + 1) * Math.sin(a * 3)) * .14);
        }
        geo.computeVertexNormals();
        R.anchors.push(R.add(J.robe, geo, R.M.robe));
    },
    head(R, h) {
        const r = R.D.head;
        R.add(h, G.sph(rd(r * 1.25), 14, 10, Math.PI / 2 + .85, TAU - 1.7), R.M.robe, 0, r * .8, -r * .12).scale.set(1, 1.12, 1.1);
        R.add(h, G.cone(rd(r * .6), rd(r * 1.1), 8), R.M.robe, 0, r * 1.5, -r * .7).rotation.x = -1.1;
        R.add(h, G.sph(rd(r * .8), 12, 8), R.M.dark, 0, r * .72, r * .2).scale.set(1, 1.1, .7);
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .11), 6, 5), R.M.glow, s * r * .3, r * .8, r * .8);
            R.glows.push(halo(h, R.c.bolt, r * 1.6, .85, s * r * .3, r * .8, r * .95));
        }
    },
    hand(R, h) {
        const r = R.D.hand;
        R.anchors.push(R.add(h, G.sph(r, 10, 8), R.M.glow, 0, -r * .6, 0));
        R.glows.push(halo(h, R.c.bolt, r * 12, .75, 0, -r * .6, 0));
        R.bolts.push({ b: new Bolts(h, 13, 7, R.c.bolt, { len: 1.25, width: .011, cy: -r * .6 }), fwd: true });
    },
    animate(R, q, state, t, dt) {
        const dead = state === 'death' ? clamp01(1 - R.stateTime * .9) : 1;
        const amt = (.55 + q.harden * .45 + q.fx * .4) * dead, fwd = q.fx > .6 ? 3.2 / R.size : 0;
        for (const B of R.bolts) B.b.update(dt, amt, B.fwd ? fwd : 0);
        for (const h of R.glows) h.material.opacity = (.55 + .2 * Math.sin(t * 17) * Math.sin(t * 7) + q.fx * .3) * dead;
        R.M.glow.emissiveIntensity = .2 + 2.8 * dead;
        R.shield.scale.setScalar(.001 + q.harden * R.D.torso * 1.3);
    },
    death: R => ({ mode: 'spark', n: 28, geo: G.box(1, 1, 1), mat: glowMat(R.c.bolt, .95), size: [.015, .03], at: .4, hide: false,
        far: .5, spin: 10, jit: .05, shrink: true, stretch: [1, 3, 1] })
};

const SWARM = {
    mats(R) {
        R.M.core = tmat(0xffffff, { roughness: .8, map: bugTex() });
        R.M.mask = tmat(0x9a9a96, { roughness: .85, map: bugTex() });
        R.M.hole = mat(0x020202, { roughness: 1 });
    },
    bugs(R, g, n, o, arm = false) {
        const m = new Motes(g, insectGeo(), insectMat(), n, { radial: [.92, 1.3], speed: [1.2, 3.5], size: [.075, .11], wobble: .1, ...o }, R.rnd);
        m.arm = arm;
        R.motes.push(m);
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0 * .85), 8, 6), R.M.core);
        R.anchors.push(R.tube(g, len, r0, r1, dir, R.M.core, 8, .85));
        SWARM.bugs(R, g, Math.round(len * (r0 + r1) * 500), { len, r0, r1, dir }, part === 'fore');
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        const chest = R.add(g, G.sph(1, 12, 9), R.M.core, 0, T * .62, 0);
        chest.scale.set(D.chestW * .9, T * .4, D.chestD * .9);
        R.anchors.push(chest, R.tube(g, T * .6, D.hipW * .85, D.chestW * .75, 1, R.M.core, 9));
        SWARM.bugs(R, g, 200, { len: T * 1.02, r0: D.hipW, r1: D.chestW * .95, dir: 1, zs: D.chestD / D.chestW });
        for (const s of [1, -1]) R.add(g, G.sph(rd(D.armR * 1.3), 8, 6), R.M.core, s * D.shX * .9, D.shY, 0);
    },
    pelvis(R, g) {
        R.add(g, G.sph(rd(R.D.hipW * .9), 8, 6), R.M.core).scale.set(1, .8, .85);
        SWARM.bugs(R, g, 16, { len: .1, r0: R.D.hipW, r1: R.D.hipW, dir: -1, y0: .05 });
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, G.sph(r, 12, 9), R.M.mask, 0, r * .85, 0));
        h.children[h.children.length - 1].scale.set(.85, 1.08, .95);
        for (const s of [1, -1]) R.add(h, G.sph(rd(r * .22), 6, 5), R.M.hole, s * r * .33, r * .92, r * .72).scale.set(1, .8, .5);
        R.add(h, G.sph(rd(r * .16), 6, 5), R.M.hole, 0, r * .42, r * .78).scale.set(1.3, .6, .5);
        SWARM.bugs(R, h, 26, { len: r * 1.3, r0: r * .95, r1: r * .7, dir: 1, y0: r * .2, radial: [1, 1.15], size: [.045, .065] });
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, G.sph(rd(r * .8), 8, 6), R.M.core, 0, -r * .5, 0);
        SWARM.bugs(R, h, 12, { len: r * 1.4, r0: r * .9, r1: r * .6, dir: -1 }, true);
    },
    foot(R, f) {
        const D = R.D;
        R.add(f, G.sph(rd(D.legR * 1.2), 8, 6), R.M.core, 0, -D.foot * .4, D.legR * .5).scale.set(1, .6, 1.6);
    },
    extras(R) {
        SWARM.bugs(R, R.j.body, 24, { len: R.D.torso + .7, r0: .5, r1: .6, dir: 1, radial: [1, 1.6], speed: [1.5, 3], wobble: .3 });
    },
    animate(R, q) {
        R.moteSpeed = 1 + q.harden * 1.2 + q.fx;
        R.moteSpread = 1 + R.scatter * .9 - q.harden * .12;
        R.reach = q.fx * 1.6;
    },
    death: () => ({ mode: 'disperse', n: 170, geo: insectGeo(), mat: insectMat(), size: [.05, .07], at: .25, hide: true, far: 1.3, R: 1.2,
        spin: 0, flatAxis: true, jit: .08 })
};

const MAGGOT = {
    mats(R) {
        const c = R.c;
        R.M.flesh = mat(c.flesh, { roughness: .55, emissive: 0x2a1c1a, emissiveIntensity: .4 });
        R.M.worm = tmat(0xffffff, { map: wormTex(c.worm), roughness: .45 });
        R.M.wormPlain = mat(c.worm, { roughness: .5 });
        R.M.hole = mat(0x1a0c0a, { roughness: 1 });
    },
    rings(R, g, len, r0, r1, dir, wr, zs = 1) {
        const n = Math.max(2, Math.round(len / (wr * 1.85)));
        for (let i = 0; i < n; i++) {
            const t = (i + .5) / n, r = (r0 + (r1 - r0) * t) * .85 + wr * .6;
            const ring = R.add(g, G.torus(rd(r), rd(wr), 5, 14, 5.5), R.M.worm, 0, dir * t * len, 0);
            ring.rotation.set(Math.PI / 2 + (R.rnd() - .5) * .5, (R.rnd() - .5) * .4, R.rnd() * TAU);
            ring.scale.y = zs;
            R.anchors.push(ring);
        }
    },
    tendril(R, parent, x, y, z, len, rz = 0, rx = 0, thick = 1) {
        const g = R.grp(parent, x, y, z);
        R.add(g, tendrilGeo(R.ri(3)), R.M.worm).scale.set(len * thick, len, len * thick);
        g.rotation.set(rx, 0, rz);
        R.wigglers.push({ g, ph: R.rnd() * TAU, amp: .3, rz, rx });
    },
    crawl(R, g, n, o) {
        R.motes.push(new Motes(g, G.sph(1, 6, 4), R.M.wormPlain, n, { radial: [1.05, 1.18], speed: [.3, .8], size: [.018, .026],
            stretch: [.4, .4, 1.3], flow: .05, wobble: .03, ...o }, R.rnd));
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0 * .8), 8, 6), R.M.flesh);
        R.tube(g, len, r0, r1, dir, R.M.flesh, 8, .8);
        MAGGOT.rings(R, g, len, r0, r1, dir, Math.max(.022, r0 * .4));
        MAGGOT.crawl(R, g, 5, { len, r0, r1, dir });
        if (part === 'fore') for (let i = 0; i < 4; i++) MAGGOT.tendril(R, g, (i % 2 - .5) * r0 * 1.4, -len * (.15 + i * .22), r0 * .3, .32 + i * .07, (i % 2 - .5) * .5, -.25, 1.6);
        if (part === 'upper') MAGGOT.tendril(R, g, 0, -len * .6, r0 * .4, .4, 0, -.25, 1.6);
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        const chest = R.add(g, G.sph(1, 12, 9), R.M.flesh, 0, T * .62, 0);
        chest.scale.set(D.chestW * .85, T * .4, D.chestD * .85);
        R.tube(g, T * .6, D.hipW * .8, D.chestW * .7, 1, R.M.flesh, 9);
        MAGGOT.rings(R, g, T, D.hipW, D.chestW, 1, .028, D.chestD / D.chestW);
        MAGGOT.crawl(R, g, 10, { len: T, r0: D.hipW, r1: D.chestW, dir: 1, zs: D.chestD / D.chestW });
        for (const s of [1, -1]) {
            R.add(g, G.sph(rd(D.armR * 1.4), 8, 6), R.M.flesh, s * D.shX * .9, D.shY, 0);
            for (let i = 0; i < 5; i++) MAGGOT.tendril(R, g, s * (D.shX * .6 + i * .035), D.shY + .03, -.06 + i * .03, .34 + (i % 3) * .1, s * .3, 0, 1.6);
        }
    },
    pelvis(R, g) {
        const D = R.D;
        R.add(g, G.sph(rd(D.hipW * .9), 8, 6), R.M.flesh).scale.set(1, .8, .85);
        MAGGOT.rings(R, g, .14, D.hipW * .9, D.hipW * .9, -1, .028, .8);
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, G.sph(r, 12, 9), R.M.wormPlain, 0, r * .85, 0));
        h.children[h.children.length - 1].scale.set(.82, 1.12, .95);
        const n0 = h.children.length;
        MAGGOT.rings(R, h, r * 1.1, r * 1.12, r * .85, 1, .022);
        h.children.slice(n0).forEach(c => { c.position.y += r * .4; });
        for (const s of [1, -1]) R.add(h, G.sph(rd(r * .2), 6, 5), R.M.hole, s * r * .3, r * .95, r * .72).scale.set(1, .85, .5);
        R.add(h, G.box(rd(r * .45), rd(r * .08), .03), R.M.hole, 0, r * .45, r * .85);
        for (let i = 0; i < 13; i++) {                                              // worm dreadlocks around the skull
            const a = -Math.PI * .15 - i * Math.PI * 1.3 / 12;
            MAGGOT.tendril(R, h, Math.cos(a) * r * .8, r * (1.35 - Math.abs(i - 6) * .03), Math.sin(a) * r * .8 - r * .05, .55 + (i % 3) * .15,
                Math.cos(a) * .3, -Math.sin(a) * .3, 2);
        }
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, G.sph(rd(r * .8), 8, 6), R.M.flesh, 0, -r * .4, 0).scale.set(1, 1, .7);
        for (let i = 0; i < 5; i++) MAGGOT.tendril(R, h, (i - 2) * r * .3, -r * .7, r * .1, .26 + (i % 2) * .08, (i - 2) * .15, 0, 1.4);
    },
    foot(R, f) {
        const D = R.D;
        R.add(f, G.sph(rd(D.legR * 1.2), 8, 6), R.M.flesh, 0, -D.foot * .4, D.legR * .5).scale.set(1, .6, 1.6);
    },
    animate(R, q) {
        R.spinMul = 1 + q.harden * 2.5 + q.fx * 2;
        R.wigMul = 1 + q.fx * 1.2 + q.harden * .5 + R.scatter;
    },
    death: R => ({ mode: 'pile', n: 110, geo: G.sph(1, 6, 4), mat: R.M.wormPlain, size: [.07, .09], stretch: [.38, .38, 1.2], at: .5,
        hide: true, R: R.D.chestW * 2, heap: R.D.chestW * .7, spin: 4, jit: .05, wiggle: true })
};

const STYLES = { rock: ROCK, golem: GOLEM, automaton: AUTOMATON, fire: FIRE, water: WATER, air: AIR, vestrad: VESTRAD, swarm: SWARM, maggot: MAGGOT };

// ------------------------------------------------------------------ rig
export class ProceduralElemental extends QuadrupedRig {
    constructor(variant = 'earth-elemental', { scale = 1 } = {}) {
        super();
        this.variant = ELEMENTAL_VARIANTS[variant] ? variant : 'earth-elemental';
        const c = this.c = { ...ELEMENTAL_VARIANTS[this.variant] };
        const k = this.kind = c.kind;
        const D = this.D = { ...DIMS[k], ...(c.dims || {}) };
        this.style = STYLES[k];
        this.legged = !!D.legs;
        this.heavy = k === 'rock' || k === 'golem';
        const S = { ...BASE_STAND, neckX: 0, headX: 0, jaw: 0, tailX: 0, spine: D.spine, twist: 0,
            lX: .05, lZ: D.armZ, lK: -.25, rX: .05, rZ: D.armZ, rK: -.25, harden: 0, col: 1, fx: 0, ...(c.stand || {}) };
        let H, gait;
        if (this.legged) {
            const [a, b] = D.legs, [L0, L1, L2] = D.bend;
            this.legH = (l0, l1) => (a * Math.cos(l0) + b * Math.cos(l0 + l1)) * Math.cos(D.splay) + D.foot + D.hipDrop;
            H = this.legH(L0, L1);
            Object.assign(S, { HL0: L0, HL1: L1, HL2: L2, HLz: D.splay });
            gait = this.heavy ? { walk: (a + b) * 1.5, run: (a + b) * 2.6, amp: .36, ampRun: .2, lift: .55, roll: .07 }
                : { walk: (a + b) * 1.8, run: (a + b) * 3.2, amp: .45, ampRun: .2, lift: .8, roll: .035 };
        } else {
            H = D.hover;
            gait = { walk: 1.3, run: 2.4, amp: 0, ampRun: 0, lift: 0, roll: .03 };
        }
        this.init({ H, stand: S, legs: this.legged ? ['HL', 'HR'] : [], sniff: 0, scale: c.scale * (scale || 1), gait });
        this.root.name = this.variant;
        this.gl = 9.8 / this.size;                                       // gravity in local units
        let seed = 7;
        for (const ch of this.variant) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
        this.rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
        this.ri = n => Math.floor(this.rnd() * n);
        this.M = {}; this.anchors = []; this.flames = []; this.motes = []; this.spin = []; this.wigglers = []; this.glows = []; this.bolts = [];
        this.spinMul = 1; this.moteSpeed = 1; this.moteSpread = 1; this.reach = 0; this.wigMul = 1; this.scatter = 0;
        this.moteClock = 0; this.lastState = null; this.broken = false; this.atk = 0; this.prevAtk = 0;
        this.makePoses(S);
        this.build();
    }

    tube(g, len, r0, r1, dir, m, seg = 8, k = 1) {
        const top = (dir < 0 ? r0 : r1) * k, bot = (dir < 0 ? r1 : r0) * k;
        return this.add(g, G.cyl(rd(top), rd(bot), rd(len), seg), m, 0, dir * len / 2, 0);
    }

    makePoses(S) {
        const D = this.D, P = o => ({ ...S, ...o }), sp = D.spine, k = this.kind, H = this.H;
        const crouch = d => this.legged ? { HL0: S.HL0 - d, HL1: S.HL1 + 2 * d, HL2: S.HL2 - d, by: this.legH(S.HL0 - d, S.HL1 + 2 * d) - H } : { by: -d * .3 };
        this.WALK = P({ spine: sp + .05 });
        this.RUN = P({ ...crouch(.08), spine: sp + .22, lX: -.1, lK: -1.0, rX: -.1, rK: -1.0 });
        this.HIT = P({ bz: -.08, bx: -.15, spine: sp - .25, neckX: -.3, lX: -.7, lZ: D.armZ + .5, lK: -.9, rX: -.7, rZ: D.armZ + .5, rK: -.9 });
        this.DEFEND = P({ ...crouch(.22), spine: sp + .12, neckX: .1, lX: -1.25, lZ: -.3, lK: -1.4, rX: -1.25, rZ: -.3, rK: -1.4, harden: 1 });
        if (this.legged) {
            const a = D.legs[0];
            this.KNEEL = P({ by: a + D.legR * .9 + D.hipDrop - H, HL0: -.05, HL1: 1.6, HL2: -.35, spine: sp + .25, neckX: -.1,
                lX: -.5, lK: -.5, rX: this.heavy ? -.3 : -.5, rK: this.heavy ? -.05 : -.5, rZ: this.heavy ? .1 : D.armZ,
                ...(D.arm[0] + D.arm[1] > 1 ? { lX: -.6, lK: -1.05, rX: -.6, rK: -1.05 } : {}) });
            this.LIE = P({ bx: -1.5, by: D.chestD * (k === 'rock' ? 1.45 : 1) - H, HL0: -.15, HL1: .15, HL2: 0, HLz: .12, spine: 0, neckX: k === 'maggot' ? -.6 : 0,
                lX: .2, lZ: .45, lK: -.25, rX: .2, rZ: .45, rK: -.25 });
            this.DEAD = k === 'golem' || k === 'automaton'
                ? P({ bx: 1.45, by: D.chestD * (k === 'golem' ? 1.1 : 1.3) - H, HL0: .1, HL1: .05, HL2: 1.5, HLz: .1, spine: 0, neckX: -.3, neckY: 1.0,
                    lX: .3, lZ: .45, lK: -.15, rX: .25, rZ: .35, rK: -.1 })
                : P({ ...crouch(.6), bz: .05, spine: sp + .55, neckX: .5, lX: .25, lK: -.1, rX: .25, rK: -.1 });
        } else {
            this.KNEEL = P({ by: -H * .3, col: .7, spine: sp + .3, neckX: -.1, lX: -.4, lK: -.6, rX: -.4, rK: -.6 });
            this.LIE = P({ by: -H * .62, col: .35, spine: sp + .55, neckX: -.35, lX: -1.0, lZ: .7, lK: -.2, rX: -1.0, rZ: .7, rK: -.2 });
            this.DEAD = k === 'vestrad'
                ? P({ by: -H + .14, spine: 1.35, neckX: .4, lX: -1.2, lZ: 1.3, lK: 0, rX: -1.2, rZ: 1.3, rK: 0 })
                : P({ by: -H * .45, col: .5, spine: sp + .6, neckX: .5, lX: .3, rX: .3 });
        }
        // attacks: wind-up A1 → strike A2 (fx = effect: slam chips, flame jet, bolt, insect stream) → follow-through A3
        let A1, A2, A3;
        if (k === 'rock' || k === 'golem') {                                           // two-handed overhead slam
            const cr = crouch(.35);
            A1 = P({ ...crouch(.05), bx: -.1, spine: sp - .45, neckX: -.15, lX: -2.9, lZ: .15, lK: -.6, rX: -2.9, rZ: .15, rK: -.6 });
            const lx = D.arm[0] + D.arm[1] > 1 ? -.9 : -.55;                          // long arms strike further forward
            A2 = P({ ...cr, bz: .18, bx: .08, spine: sp + .55, neckX: .1, lX: lx, lZ: -.12, lK: -.1, rX: lx, rZ: -.12, rK: -.1, fx: 1 });
            A3 = P({ ...cr, bz: .16, bx: .06, spine: sp + .5, lX: lx + .05, lZ: -.1, lK: -.15, rX: lx + .05, rZ: -.1, rK: -.15, fx: .5 });
        } else if (k === 'automaton') {                                                // right jab, left guards
            A1 = P({ ...crouch(.1), bz: -.05, twist: -.5, spine: sp + .05, rX: -.6, rZ: .2, rK: -2.0, lX: -1.2, lK: -1.8 });
            A2 = P({ ...crouch(.15), bz: .15, twist: .5, spine: sp + .2, rX: -1.55, rZ: -.15, rK: -.05, lX: -.3, lK: -1.6, fx: 1 });
            A3 = P({ ...crouch(.12), bz: .1, twist: .35, spine: sp + .15, rX: -1.4, rZ: -.1, rK: -.3, lX: -.4, lK: -1.6, fx: .4 });
        } else if (k === 'fire') {                                                     // rear back, thrust arms, breathe flame
            A1 = P({ by: .03, bx: -.15, spine: sp - .35, neckX: -.4, lX: -.3, lZ: .9, lK: -.9, rX: -.3, rZ: .9, rK: -.9 });
            A2 = P({ ...crouch(.1), bz: .12, spine: sp + .25, neckX: -.15, lX: -1.4, lZ: .3, lK: -.2, rX: -1.4, rZ: .3, rK: -.2, fx: 1 });
            A3 = P({ ...crouch(.08), bz: .1, spine: sp + .2, neckX: -.1, lX: -1.3, lZ: .35, lK: -.3, rX: -1.3, rZ: .35, rK: -.3, fx: .85 });
        } else if (k === 'water') {                                                    // rise as a wave, crash forward
            A1 = P({ by: .12, bx: -.12, spine: sp - .3, neckX: -.2, lX: -2.6, lZ: .5, lK: -.4, rX: -2.6, rZ: .5, rK: -.4 });
            A2 = P({ by: -.12, bz: .35, spine: sp + .65, neckX: .2, lX: -.9, lZ: -.1, lK: -.1, rX: -.9, rZ: -.1, rK: -.1, fx: 1 });
            A3 = P({ by: -.08, bz: .3, spine: sp + .5, lX: -1.1, lZ: -.05, lK: -.2, rX: -1.1, rZ: -.05, rK: -.2, fx: .5 });
        } else if (k === 'air') {                                                      // sweeping gust
            A1 = P({ twist: -.7, spine: sp - .1, rX: -1.2, rZ: 1.2, rK: -.3, lX: -.4, lZ: .6, fx: .3 });
            A2 = P({ bz: .15, twist: .8, spine: sp + .2, rX: -1.5, rZ: -.4, rK: -.1, lX: -.8, lZ: .9, fx: 1 });
            A3 = P({ bz: .12, twist: .6, spine: sp + .15, rX: -1.3, rZ: -.2, rK: -.2, lX: -.7, lZ: .8, fx: .7 });
        } else if (k === 'vestrad') {                                                  // charge overhead, both hands loose bolts
            A1 = P({ by: .08, spine: sp - .2, neckX: -.2, lX: -2.4, lZ: .7, lK: -.6, rX: -2.4, rZ: .7, rK: -.6, fx: .4 });
            A2 = P({ bz: .1, spine: sp + .15, lX: -1.5, lZ: -.05, lK: -.05, rX: -1.5, rZ: -.05, rK: -.05, fx: 1 });
            A3 = P({ bz: .08, spine: sp + .1, lX: -1.45, lZ: 0, lK: -.1, rX: -1.45, rZ: 0, rK: -.1, fx: .75 });
        } else if (k === 'swarm') {                                                    // lash: insects stream from the hands
            A1 = P({ bz: -.05, spine: sp - .2, lX: -2.2, lZ: .6, lK: -1.0, rX: -2.2, rZ: .6, rK: -1.0, fx: .2 });
            A2 = P({ ...crouch(.15), bz: .25, spine: sp + .45, lX: -1.35, lZ: -.1, lK: 0, rX: -1.35, rZ: -.1, rK: 0, fx: 1 });
            A3 = P({ ...crouch(.1), bz: .2, spine: sp + .35, lX: -1.25, lZ: -.05, lK: -.1, rX: -1.25, rZ: -.05, rK: -.1, fx: .7 });
        } else {                                                                       // maggot: grab and pull in
            A1 = P({ bz: -.05, spine: sp - .1, lX: -1.8, lZ: .55, lK: -.3, rX: -1.8, rZ: .55, rK: -.3 });
            A2 = P({ ...crouch(.12), bz: .2, spine: sp + .35, lX: -1.5, lZ: -.4, lK: -.6, rX: -1.5, rZ: -.4, rK: -.6, fx: 1 });
            A3 = P({ ...crouch(.08), bz: .1, spine: sp + .2, lX: -1.2, lZ: -.35, lK: -1.2, rX: -1.2, rZ: -.35, rK: -1.2, fx: .7 });
        }
        Object.assign(this, { A1, A2, A3 });
    }

    build() {
        const D = this.D, J = this.j, St = this.style, grp = this.grp.bind(this);
        this.add = this.adder();
        St.mats(this);
        J.body = grp(this.root, 0, this.H, 0);
        St.pelvis?.(this, J.body);
        J.chest = grp(J.body, 0, D.waist, 0);
        St.torso(this, J.chest);
        if (this.legged) {
            const [a, b] = D.legs;
            for (const [name, s] of [['HL', 1], ['HR', -1]]) {
                const top = grp(J.body, D.legX * s, -D.hipDrop, 0);
                St.seg(this, top, a, D.legR * 1.15, D.legR, -1, 'thigh');
                const knee = grp(top, 0, -a, 0);
                St.seg(this, knee, b, D.legR, D.legR * .85, -1, 'shin');
                const low = grp(knee, 0, -b, 0);
                const foot = grp(low);
                St.foot(this, foot);
                J[name] = { top, knee, low, foot, hind: true, side: s, walk: s > 0 ? 0 : .5, gal: s > 0 ? 0 : .5 };
            }
        } else if (St.column) St.column(this);
        else if (St.robe) St.robe(this);
        J.arms = [];
        const [ua, fa] = D.arm;
        for (const s of [1, -1]) {
            const sh = grp(J.chest, D.shX * s, D.shY, 0);
            St.seg(this, sh, ua, D.armR, D.armR * .9, -1, 'upper');
            const el = grp(sh, 0, -ua, 0);
            St.seg(this, el, fa, D.armR * .9, D.armR * .85, -1, 'fore');
            const hand = grp(el, 0, -fa, 0);
            St.hand(this, hand, s);
            J.arms.push({ sh, el, hand, s });
        }
        J.neck = grp(J.chest, 0, D.torso, D.headZ);
        J.head = grp(J.neck, 0, D.neck, 0);
        St.head(this, J.head);
        St.extras?.(this);
        // death pieces and hit / impact chips share the kind's piece geometry
        const o = this.dcfg = { g: this.gl, ...St.death(this) };
        this.debris = new Debris(this.root, o.geo, o.mat, o.n);
        this.burst = new Burst(this.root, o.geo, o.mat, 10, o.stretch);
        this.chip = (o.size[0] + o.size[1]) * .4;
        this.mergeStatic();
    }

    // Fewer draw calls: inside every joint group, static meshes sharing a material are merged into one (cached per
    // variant, the build is deterministic). Spinning / scaled-at-runtime meshes keep their own; merged anchors leave a marker.
    mergeStatic() {
        const keep = new Set([this.shield, this.puddle, ...(this.j.jetCones || []), ...this.spin.map(s => s.o)]);
        const groups = [];
        this.root.traverse(o => { if (o.isGroup) groups.push(o); });
        groups.forEach((g, gi) => {
            const buckets = new Map();
            for (const c of g.children) {
                if (!c.isMesh || c.isInstancedMesh || keep.has(c) || !c.geometry.attributes.uv || !c.geometry.attributes.normal) continue;
                const k = c.material.uuid + c.castShadow;
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k).push(c);
            }
            let bi = 0;
            for (const list of buckets.values()) {
                bi++;
                if (list.length < 2) continue;
                const geo = cachedGeo(`merged:${this.variant}:${gi}:${bi}`, () => mergeGeometries(list.map(c => {
                    c.updateMatrix();
                    const src = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
                    const out = new THREE.BufferGeometry();
                    for (const a of ['position', 'normal', 'uv']) out.setAttribute(a, src.attributes[a]);
                    return out.applyMatrix4(c.matrix);
                })));
                if (!geo) continue;
                const m = this.add(g, geo, list[0].material);
                m.castShadow = list[0].castShadow;
                for (const c of list) {
                    const ai = this.anchors.indexOf(c);
                    if (ai >= 0) {
                        const mk = new THREE.Object3D();
                        mk.position.copy(c.position);
                        g.add(mk);
                        this.anchors[ai] = mk;
                    }
                    g.remove(c);
                }
            }
        });
    }

    statePose(state, c) {
        switch (state) {
            case 'walk': return this.WALK;
            case 'run': return this.RUN;
            case 'attack': {
                const dur = c.actionDuration || .9;
                const p = this.atk = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .9) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .17));
                if (p > .5) P = this.mix(P, this.A3, smooth((p - .5) / .14));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': return this.DEFEND;
            case 'hit': return this.HIT;
            case 'kneel': return this.KNEEL;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return this.idlePose();
        }
    }

    onState(state, prev) {
        if (prev === 'death') this.resetDeath();
        if (state === 'hit') {
            const D = this.D;
            this.scatter = 1;
            this.burst.fire(0, this.H + D.waist + D.torso * .6, D.chestD, Math.sqrt(2 * this.gl * .35), this.chip, .8);
        }
    }

    breakApart() {
        this.broken = true;
        const o = this.dcfg;
        this.debris.start(this, o);
        if (o.hide) { this.j.body.visible = false; if (this.j.low) this.j.low.visible = false; }
        this.style.onBreak?.(this);
    }

    resetDeath() {
        this.broken = false;
        this.j.body.visible = true;
        if (this.j.low) this.j.low.visible = true;
        this.debris.mesh.visible = false;
        this.style.onReset?.(this);
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j, D = this.D;
        if (state !== this.lastState) { this.onState(state, this.lastState); this.lastState = state; }
        const w = Math.max(0, 1 - Math.abs(q.bx)), alive = state !== 'death';
        // breathing chest, twist with the stride
        const br = alive ? Math.sin(t * (this.heavy ? 1.2 : 1.7)) * .5 + .5 : 0;
        J.chest.rotation.set(q.spine - br * .02, q.twist + (this.legged ? Math.sin(this.phase) * .12 * g : 0), 0);
        J.chest.scale.set(1 + br * .015, 1 + br * .02, 1 + br * .015);
        if (this.legged) {
            if (this.heavy && g > .01) J.body.position.y -= Math.pow(Math.abs(Math.sin(this.phase)), 8) * .035 * g;   // stomp
            for (const name of this.legNames) {
                const L = J[name];
                L.foot.rotation.x = -(q.bx + L.top.rotation.x + L.knee.rotation.x + L.low.rotation.x) * w;
            }
        } else if (alive) J.body.position.y += Math.sin(t * 1.3) * .025;                                           // hover
        // arms (angles relative to the world, the walk swings them against the legs)
        const sw = g > .01 ? Math.sin(this.phase) * (this.legged ? .35 : .2) * g * (1 - run * .3) : 0;
        for (const A of J.arms) {
            const left = A.s > 0;
            A.sh.rotation.set((left ? q.lX + sw : q.rX - sw) - q.spine - q.bx * w, 0, A.s * (left ? q.lZ : q.rZ));
            A.el.rotation.x = left ? q.lK : q.rK;
        }
        J.neck.rotation.x = q.neckX - q.spine * .85 - q.bx * w;
        // the water column / air vortex / robe reach from the floating body down to the ground
        if (J.low) {
            J.low.position.z = J.body.position.z;
            J.low.scale.y = Math.max(.05, J.body.position.y / this.H);
            const tilt = g * .08 + run * .06;
            J.low.rotation.x = tilt;
            J.low.position.y = Math.sin(tilt) * this.D.hipW * 2.7;
        }
        if (J.robe) {
            const sy = Math.min(1, Math.max(.06, (J.body.position.y - .1) / this.robeLen));
            J.robe.scale.set(1 + (1 - sy) * .6, sy, 1 + (1 - sy) * .6);
        }
        // material effects
        this.scatter = damp(this.scatter, 0, 3, dt);
        this.style.animate?.(this, q, state, t, dt, g, run);
        if (J.body.visible) {
            this.moteClock += dt * this.moteSpeed;
            for (const s of this.spin) s.o.rotation[s.ax] += s.sp * dt * this.spinMul;
            for (const m of this.motes) m.update(this.moteClock, this.moteSpread, m.arm ? this.reach : 0);
            for (const wg of this.wigglers) {
                wg.g.rotation.x = (wg.rx || 0) + Math.sin(t * 2.2 + wg.ph) * wg.amp * this.wigMul;
                wg.g.rotation.z = wg.rz + Math.cos(t * 1.7 + wg.ph * 1.3) * wg.amp * .7 * this.wigMul;
            }
        }
        // ground slam chips at the moment of impact
        if (state === 'attack') {
            if (this.style.impact && this.prevAtk < .47 && this.atk >= .47) {
                this.burst.fire(0, .05, D.chestD + (D.arm[0] + D.arm[1]) * .8, Math.sqrt(2 * this.gl * .5), this.chip * 1.2, 1);
            }
            this.prevAtk = this.atk;
        } else this.prevAtk = 0;
        this.burst.update(dt, this.gl);
        // death: break into pieces that come to rest on the ground
        if (state === 'death') {
            if (!this.broken && this.stateTime >= this.dcfg.at) this.breakApart();
            if (this.broken) {
                const tt = this.stateTime - this.dcfg.at;
                this.debris.update(tt);
                this.style.deathFx?.(this, tt, t);
            }
        }
    }
}
