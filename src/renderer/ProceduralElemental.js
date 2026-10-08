import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, damp, TAU } from './QuadrupedRig.js';
import { glowMat, flameTongue, taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralElemental — humanoid beings made of a material instead of flesh, on one biped rig (QuadrupedRig with the
 * legs HL / HR, two big arms, a chest that leans and twists). Kinds:
 *   rock      earth-elemental (layered tan slabs, glowing cracks), -greater (grey boulders, moss), -giant (colossal)
 *   golem     iron-and-stone giant: barrel chest, pauldrons, dome head, glowing coil at the waist
 *   automaton black metal construct: rods, plates, rivets, brass gears turning, red eyes and vent
 *   fire      fire-elemental-greater (dark ember body with glowing cracks), -giant (bright orange): flame tongues, breath
 *   water     water-elemental-greater: translucent blue body on a flowing water column, foam streaming over it
 *   air       air-elemental-greater: pale smoke body, mushroom-cloud head, lower body a spinning vortex with dust
 *   vestrad   hooded energy demon: floating robe, glowing hands, lightning crackling around the hands and body
 *   swarm     swarm-devil: dark humanoid core covered by hundreds of orbiting insects (instanced)
 *   maggot    maggot-man: flesh core wrapped in ribbed worms, crawling maggots (instanced), dangling worm tendrils
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
    'earth-elemental': { kind: 'rock', scale: 1.45, stone: 0xa08a6c, dark: 0x6e5c48, crack: 0xff8a30, glow: .9, slab: .6, eye: true,
        dims: { spine: .22, legs: [.44, .44], arm: [.44, .42], shX: .46 } },
    'earth-elemental-greater': { kind: 'rock', scale: 2.3, stone: 0x7a726a, dark: 0x4e4842, crack: 0x9a4a18, glow: .15, slab: 1,
        moss: 0x5a6a30, dims: { spine: .55, chestW: .46 } },
    'earth-elemental-giant': { kind: 'rock', scale: 3.6, stone: 0xa48c72, dark: 0x5a4c40, crack: 0xff6a20, glow: 1.1, slab: .75,
        moss: 0x5e7034, eye: true, dims: { spine: .5 } },
    golem: { kind: 'golem', scale: 1.3, metal: 0x3c4856, dark: 0x252c34, glow: 0xff8a30 },
    automaton: { kind: 'automaton', scale: 1, metal: 0x1c1e22, plate: 0x2e3035, brass: 0x9a7438, glow: 0xff2418 },
    'fire-elemental-greater': { kind: 'fire', scale: 1.5, core: 0x2a120a, ember: 0xff5a10, glow: 1.7, lava: 0, flame: 0xff7a20,
        shell: .22, fs: 1.1, fl: 1.2, dims: { spine: .38 } },
    'fire-elemental-giant': { kind: 'fire', scale: 3.6, core: 0xd06018, ember: 0xff8a28, glow: 1.3, lava: 120, flame: 0xffa040,
        shell: .32, fs: 1.3, fl: 1.4, dims: { spine: .06 } },
    'water-elemental-greater': { kind: 'water', scale: 1.7, water: 0x3e8eb0, deep: 0x0c3a58, foam: 0xdaf2fa, eye: 0xe8ffff },
    'air-elemental-greater': { kind: 'air', scale: 1.7, air: 0xb4bcc4, cloud: 0xd2d6da, dust: 0x9a948a },
    vestrad: { kind: 'vestrad', scale: 1.15, robe: 0x101824, bolt: 0x9ae8ff },
    'swarm-devil': { kind: 'swarm', scale: 1.1 },
    'maggot-man': { kind: 'maggot', scale: .95, flesh: 0xa88a7c, worm: 0xdccdb6 }
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
    automaton: { ...HUMAN, legR: .05, legX: .12, chestW: .22, chestD: .15, hipW: .15, shX: .27, shY: .45, arm: [.36, .34],
        armR: .05, hand: .08, neck: .1, head: .12, headZ: .02, armZ: .12 },
    fire: { ...HUMAN, armZ: .3 },
    swarm: { ...HUMAN, legR: .085, chestW: .27, chestD: .19, hipW: .18, armR: .075, head: .14 },
    maggot: { ...HUMAN, legR: .07, chestW: .23, chestD: .16, armR: .065, arm: [.42, .42], spine: .2 },
    water: { ...HUMAN, legs: null, hover: .95, chestW: .27, chestD: .18, hipW: .18, shX: .32, shY: .46, arm: [.44, .42],
        armR: .08, hand: .09, head: .14, armZ: .3 },
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
    const P = [], C = [], body = [.03, .03, .035], wing = [.62, .64, .6];
    const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) C.push(...col); };
    const f = [0, 0, .5], bk = [0, 0, -.55], l = [.17, 0, 0], r = [-.17, 0, 0], u = [0, .14, .05], d = [0, -.12, 0];
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
    for (let i = 0; i < 150; i++) {
        const x = r() * 128, y = r() * 128, a = r() * TAU;
        g.save();
        g.translate(x, y);
        g.rotate(a);
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
        const c = R.c;
        R.M.stone = mat(c.stone, { roughness: .95 });
        R.M.stone2 = mat(c.dark, { roughness: .95 });
        R.M.core = new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: c.crack, emissiveIntensity: c.glow, roughness: 1 });
        R.M.moss = c.moss ? mat(c.moss, { roughness: 1 }) : null;
        R.M.eye = mat(c.crack, { emissive: c.crack, emissiveIntensity: 2.5 });
    },
    moss(R, g, r, x, y, z) {
        for (let i = 0; i < 3; i++) {
            const a = R.rnd() * TAU, k = .5 + R.rnd() * .5;
            R.add(g, G.sph(1, 7, 5), R.M.moss, x + Math.cos(a) * r * .5, y + r * .1 * i, z + Math.sin(a) * r * .5).scale.set(r * k, r * k * .38, r * k * .9);
        }
    },
    chunk(R, g, r, x, y, z, sy = 1) {
        const m = R.add(g, rockGeo(R.ri(6)), R.rnd() < .35 ? R.M.stone2 : R.M.stone, x, y, z);
        m.scale.set(r * (.95 + R.rnd() * .25), r * sy, r * (.9 + R.rnd() * .25));
        m.rotation.set((R.rnd() - .5) * .5, R.rnd() * TAU, (R.rnd() - .5) * .5);
        R.anchors.push(m);
        return m;
    },
    seg(R, g, len, r0, r1, dir, part) {
        const big = part === 'fore' ? 1.12 : 1, slab = R.c.slab;
        R.tube(g, len, r0 * .5, r1 * .5, dir, R.M.core, 6);
        const n = Math.max(2, Math.round(len / (Math.max(r0, r1) * 1.2 * slab)));
        for (let i = 0; i < n; i++) {
            const t = (i + .5) / n, r = (r0 + (r1 - r0) * t) * big;
            ROCK.chunk(R, g, r, (R.rnd() - .5) * r * .25, dir * t * len, (R.rnd() - .5) * r * .25, len / n / r * .8 * slab);
        }
        ROCK.chunk(R, g, r0 * .9, 0, 0, 0, .8);
    },
    torso(R, g) {
        const D = R.D, T = D.torso, slab = R.c.slab;
        R.tube(g, T, D.hipW * .6, D.chestW * .6, 1, R.M.core, 7);
        const rows = Math.round(4 / slab);
        for (let i = 0; i < rows; i++) {
            const t = (i + .5) / rows, w = D.hipW + (D.chestW - D.hipW) * Math.min(1, t * 1.3), d = D.chestD * (.75 + .25 * t);
            for (let k = 0; k < 4; k++) {
                const a = k * Math.PI / 2 + i * .55 + R.rnd() * .3;
                ROCK.chunk(R, g, w * .58, Math.cos(a) * w * .45, t * T, Math.sin(a) * d * .45, T / rows / (w * .58) * .8 * slab);
            }
        }
        for (const s of [1, -1]) {
            ROCK.chunk(R, g, D.armR * 1.6, s * D.shX * .85, D.shY + D.armR * .3, 0, .85);
            if (R.M.moss) ROCK.moss(R, g, D.armR * .9, s * D.shX * .85, D.shY + D.armR * 1.1, 0);
        }
        ROCK.chunk(R, g, D.chestW * .72, 0, T * .78, D.chestD * .4, .55);
        if (R.M.moss) ROCK.moss(R, g, D.chestW * .35, 0, T * .95, -D.chestD * .25);
    },
    pelvis(R, g) {
        const D = R.D;
        for (let k = 0; k < 3; k++) {
            const a = k * TAU / 3 + .5;
            ROCK.chunk(R, g, D.hipW * .62, Math.cos(a) * D.hipW * .4, -.02, Math.sin(a) * D.chestD * .3, .75);
        }
    },
    hand(R, h, s) {
        const r = R.D.hand;
        ROCK.chunk(R, h, r, 0, -r * .7, r * .1, 1);
        for (let i = -1; i <= 1; i++) ROCK.chunk(R, h, r * .42, i * r * .5, -r * 1.5, r * .4, 1.1);
        ROCK.chunk(R, h, r * .42, -s * r * .8, -r * .95, r * .45, 1);
    },
    foot(R, f) {
        const D = R.D, r = D.legR * 1.35;
        ROCK.chunk(R, f, r, 0, -D.foot * .45, D.legR * .4, D.foot * .5 / r);
        ROCK.chunk(R, f, r * .6, 0, -D.foot * .55, D.legR * 1.3, D.foot * .4 / (r * .6));
    },
    head(R, h) {
        const r = R.D.head;
        ROCK.chunk(R, h, r, 0, r * .75, 0, .95);
        ROCK.chunk(R, h, r * .95, 0, r * 1.05, r * .35, .38);
        ROCK.chunk(R, h, r * .72, 0, r * .25, r * .45, .55);
        if (R.c.eye) for (const s of [1, -1]) {
            R.add(h, G.sph(r * .13, 6, 5), R.M.eye, s * r * .38, r * .75, r * .9);
            halo(h, R.c.crack, r * 1.1, .55, s * r * .38, r * .75, r * 1.0);
        }
        if (R.M.moss) ROCK.moss(R, h, r * .6, 0, r * 1.25, -r * .15);
    },
    animate(R, q, state, t) {
        R.M.core.emissiveIntensity = R.c.glow * (1 + .2 * Math.sin(t * 2.3) + q.harden * 1.8 + q.fx * 1.2);
    },
    death: R => ({ mode: 'pile', n: 60, geo: rockGeo(1), mat: R.M.stone, size: [R.D.armR * .6, R.D.armR * 1.15], at: .45, hide: true,
        R: R.D.chestW * 1.7, heap: R.D.chestW * 1.3, spin: 6, jit: R.D.armR * .4, stretch: [1, .75, 1] }),
    impact: true
};

const GOLEM = {
    mats(R) {
        const c = R.c;
        R.M.metal = mat(c.metal, { roughness: .5, metalness: .55 });
        R.M.dark = mat(c.dark, { roughness: .55, metalness: .5 });
        R.M.glow = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 1.6 });
    },
    seg(R, g, len, r0, r1, dir, part) {
        const r2 = r1 * (part === 'fore' ? 1.45 : part === 'shin' ? 1.3 : 1);
        R.add(g, G.sph(rd(r0 * 1.08), 12, 9), R.M.dark);
        R.anchors.push(R.tube(g, len * .88, r0, r2, dir, R.M.metal, 12));
        for (const t of [.25, .55, .85]) {
            const r = (r0 + (r2 - r0) * t) * 1.04;
            R.add(g, G.torus(rd(r), rd(r * .1), 5, 16), R.M.dark, 0, dir * t * len * .88, 0).rotation.x = Math.PI / 2;
        }
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        for (let i = 0; i < 4; i++) R.add(g, G.torus(rd(D.hipW * .62), .035, 6, 16), R.M.glow, 0, .03 + i * .05, 0).rotation.x = Math.PI / 2;
        R.add(g, G.cyl(rd(D.hipW * .5), rd(D.hipW * .5), .2, 10), R.M.glow, 0, .1, 0);
        R.add(g, G.cyl(rd(D.chestW * .6), rd(D.hipW * .62), rd(T * .14), 12), R.M.dark, 0, .23, 0);
        const chest = R.add(g, G.sph(1, 16, 12), R.M.metal, 0, T * .62, 0);
        chest.scale.set(D.chestW, T * .42, D.chestD);
        R.anchors.push(chest);
        R.add(g, G.box(rd(D.chestW * 1.1), rd(T * .3), .08), R.M.dark, 0, T * .58, D.chestD * .86).rotation.x = -.15;
        for (let i = -2; i <= 2; i++) R.add(g, G.sph(.02, 5, 4), R.M.metal, i * D.chestW * .22, T * .72, D.chestD * .93);
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
        R.add(h, G.box(rd(r * 1.3), rd(r * 1.1), rd(r * 1.1)), R.M.metal, 0, -r * .55, 0);
        for (let i = -1; i <= 1; i++) R.add(h, G.box(rd(r * .32), rd(r * .7), rd(r * .32)), R.M.dark, i * r * .42, -r * 1.35, r * .15).rotation.x = .3;
        R.add(h, G.box(rd(r * .3), rd(r * .55), rd(r * .3)), R.M.dark, -s * r * .7, -r * .8, r * .35).rotation.z = s * .4;
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
        R.M.metal = mat(c.metal, { roughness: .4, metalness: .7 });
        R.M.plate = mat(c.plate, { roughness: .35, metalness: .75 });
        R.M.brass = mat(c.brass, { roughness: .35, metalness: .8 });
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
        R.add(g, G.box(rd(D.chestW * 1.5), rd(T * .3), .05), R.M.plate, 0, T * .8, D.chestD * .8);
        AUTOMATON.gear(R, g, D.chestW * .5, 0, T * .55, D.chestD * .95, 0, 1.2);
        for (const s of [1, -1]) {
            R.add(g, G.box(rd(D.shX * .6), .08, rd(D.chestD * 1.4)), R.M.plate, s * D.shX * .6, D.shY + .05, 0);
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
        R.add(h, G.box(rd(r * 1.5), rd(r * 1.5), rd(r * 1.45)), R.M.metal, 0, r * .75, 0);
        R.add(h, G.sph(rd(r * .8), 10, 6, 0, TAU, 0, Math.PI / 2), R.M.plate, 0, r * 1.45, 0).scale.set(.95, .6, .9);
        R.add(h, G.box(rd(r * 1.3), rd(r * .9), .03), R.M.plate, 0, r * .85, r * .74);
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .17), 8, 6), R.M.glow, s * r * .32, r * 1.0, r * .76);
            halo(h, R.c.glow, r * 1.4, .75, s * r * .32, r * 1.0, r * .9);
        }
        R.add(h, G.box(rd(r * .18), rd(r * .7), .04), R.M.glow, 0, r * .42, r * .76);
        AUTOMATON.gear(R, h, r * .55, -r * .8, r * 1.1, -r * .1, Math.PI / 2, 1.5);
        AUTOMATON.gear(R, h, r * .32, r * .3, r * 1.62, -r * .2, Math.PI / 2, -2.5);
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
    flame(R, g, x, y, z, size) {
        const f = flameTongue(g, x, y, z, size, R.c.flame);
        R.flames.push(f);
        return f;
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0), 10, 8), R.M.core);
        R.anchors.push(R.tube(g, len, r0, r1, dir, R.M.core, 9));
        R.tube(g, len, r0, r1, dir, R.M.shell, 8, 1.55).castShadow = false;
        const n = Math.max(1, Math.round(len / .2 * R.c.fl));
        for (let i = 0; i < n; i++) {
            const t = (i + .6) / n, a = R.rnd() * TAU, r = r0 + (r1 - r0) * t;
            FIRE.flame(R, g, Math.cos(a) * r * .8, dir * t * len, Math.sin(a) * r * .8, r * (2 + R.rnd()) * R.c.fs);
        }
    },
    torso(R, g) {
        const D = R.D, T = D.torso, c = R.c;
        const chest = R.add(g, G.sph(1, 14, 10), R.M.core, 0, T * .62, 0);
        chest.scale.set(D.chestW, T * .4, D.chestD);
        R.anchors.push(chest, R.tube(g, T * .55, D.hipW * .85, D.chestW * .7, 1, R.M.core, 10));
        R.add(g, G.sph(1, 12, 8), R.M.shell, 0, T * .6, 0).scale.set(D.chestW * 1.35, T * .55, D.chestD * 1.4);
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
        R.M.water = new THREE.MeshStandardMaterial({ color: c.water, transparent: true, opacity: .62, roughness: .06, metalness: .25,
            emissive: c.deep, emissiveIntensity: .6 });
        R.M.foam = mat(c.foam, { roughness: .5, emissive: 0x4a6a7a, emissiveIntensity: .35 });
        R.M.eye = mat(c.eye, { emissive: c.eye, emissiveIntensity: 2.5 });
        R.M.dark = mat(0x0a2030, { roughness: .3 });
    },
    foam(R, g, n, o) { R.motes.push(new Motes(g, G.sph(1, 5, 4), R.M.foam, n, { radial: [.95, 1.12], speed: [.5, 1.5], size: [.012, .025], wobble: .05, ...o }, R.rnd)); },
    seg(R, g, len, r0, r1, dir) {
        R.add(g, G.sph(rd(r0), 10, 8), R.M.water);
        R.anchors.push(R.tube(g, len, r0, r1, dir, R.M.water, 10));
        WATER.foam(R, g, Math.round(len * 30), { len, r0, r1, dir, flow: .35 });
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        const chest = R.add(g, G.sph(1, 14, 10), R.M.water, 0, T * .62, 0);
        chest.scale.set(D.chestW, T * .42, D.chestD);
        R.anchors.push(chest, R.add(g, G.cyl(rd(D.chestW * .8), rd(D.hipW), rd(T * .65), 12), R.M.water, 0, T * .3 - .05, 0));
        WATER.foam(R, g, 26, { len: T, r0: D.hipW, r1: D.chestW, dir: 1, zs: D.chestD / D.chestW, flow: -.3 });
    },
    column(R) {
        const D = R.D, H = R.H, J = R.j;
        J.low = R.grp(R.root);
        const geo = new THREE.CylinderGeometry(D.hipW, D.hipW * 2.8, H, 14, 6, true), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i) / H + .5, a = Math.atan2(p.getZ(i), p.getX(i));
            const k = 1 + .08 * Math.sin(a * 3 + y * 9);
            p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
        }
        geo.computeVertexNormals();
        R.anchors.push(R.add(J.low, geo, R.M.water, 0, H / 2, 0));
        const crown = R.grp(J.low);                                                // splash crown at the base
        for (let i = 0; i < 12; i++) {
            const a = i * TAU / 12, rr = D.hipW * 2.7, h = .1 + (i % 3) * .05;
            const sp = R.add(crown, G.cone(.04, rd(h * 1.8), 5), i % 2 ? R.M.foam : R.M.water, Math.cos(a) * rr, h * .7, Math.sin(a) * rr);
            sp.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7);
        }
        R.add(J.low, G.torus(rd(D.hipW * 2.75), .035, 5, 20), R.M.foam, 0, .03, 0).rotation.x = Math.PI / 2;
        R.spin.push({ o: crown, ax: 'y', sp: .8 });
        for (const [y, sp] of [[.3, -2], [.62, 2.5]]) {
            const r = D.hipW * (2.8 - 1.8 * y) * 1.03;
            const w = R.add(J.low, G.torus(rd(r), .025, 5, 16, 4), R.M.foam, 0, H * y, 0);
            w.rotation.x = Math.PI / 2;
            R.spin.push({ o: w, ax: 'z', sp });
        }
        WATER.foam(R, J.low, 46, { len: H, r0: D.hipW * 2.8, r1: D.hipW, dir: 1, speed: [1.5, 3], size: [.015, .03], flow: -.4 });
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, G.sph(r, 12, 9), R.M.water, 0, r * .85, 0));
        h.children[h.children.length - 1].scale.set(.95, 1.1, 1);
        for (let i = 0; i < 5; i++) {                                               // wave crest swept back
            const cr = R.add(h, G.cone(rd(r * (.4 - Math.abs(i - 2) * .06)), rd(r * (1.9 - Math.abs(i - 2) * .3)), 6), i === 2 ? R.M.foam : R.M.water,
                (i - 2) * r * .28, r * 1.35, -r * .45);
            cr.rotation.set(-1.9 + Math.abs(i - 2) * .15, 0, -(i - 2) * .25);
        }
        for (const s of [1, -1]) {
            R.add(h, G.sph(rd(r * .13), 6, 5), R.M.eye, s * r * .34, r * .95, r * .85);
            halo(h, 0xc0f4ff, r * .9, .7, s * r * .34, r * .95, r * .98);
        }
        R.add(h, G.sph(rd(r * .2), 8, 6), R.M.dark, 0, r * .45, r * .82).scale.set(1, 1.3, .5);
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, G.sph(r, 8, 6), R.M.water, 0, -r * .5, 0).scale.set(1, 1.1, .75);
        for (let i = -1; i <= 1; i++) R.add(h, G.cone(rd(r * .25), rd(r * .9), 6), R.M.water, i * r * .42, -r * 1.2, 0).rotation.x = Math.PI;
    },
    animate(R, q) {
        R.M.water.opacity = .62 + q.harden * .25;
        R.M.water.emissiveIntensity = .6 + q.harden * .8;
        R.moteSpeed = 1 + q.harden + q.fx * 2;
        R.spinMul = 1 + q.fx * 2;
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
        R.M.air = new THREE.MeshStandardMaterial({ color: c.air, transparent: true, opacity: .5, depthWrite: false, roughness: 1,
            emissive: 0x30363c, emissiveIntensity: .4 });
        R.M.cloud = mat(c.cloud, { roughness: 1, emissive: 0x2a3036, emissiveIntensity: .5 });
        R.M.dark = mat(0x1e2228, { roughness: 1 });
        R.M.dust = mat(c.dust, { roughness: 1 });
    },
    swirl(R, g, r, y, sp, tube = .18) {
        const s = R.add(g, G.torus(rd(r), rd(r * tube), 5, 16, 4.2), R.M.air, 0, y, 0);
        s.rotation.set(Math.PI / 2 + (R.rnd() - .5) * .3, 0, R.rnd() * TAU);
        s.castShadow = false;
        R.spin.push({ o: s, ax: 'z', sp });
        return s;
    },
    seg(R, g, len, r0, r1, dir) {
        R.add(g, G.sph(rd(r0), 10, 8), R.M.air);
        R.anchors.push(R.tube(g, len, r0, r1, dir, R.M.air, 10));
        AIR.swirl(R, g, (r0 + r1) * .7, dir * len * .5, 5 * (R.rnd() < .5 ? -1 : 1));
        for (let i = 0; i < 3; i++) {
            const t = (i + .3) / 3, r = (r0 + (r1 - r0) * t) * (.8 + R.rnd() * .3), a = R.rnd() * TAU;
            R.add(g, G.sph(1, 8, 6), R.M.cloud, Math.cos(a) * r * .5, dir * t * len, Math.sin(a) * r * .5).scale.set(r, r * 1.2, r);
        }
    },
    torso(R, g) {
        const D = R.D, T = D.torso;
        const chest = R.add(g, G.sph(1, 14, 10), R.M.air, 0, T * .62, 0);
        chest.scale.set(D.chestW, T * .42, D.chestD);
        R.anchors.push(chest, R.add(g, G.cyl(rd(D.chestW * .8), rd(D.hipW), rd(T * .65), 12), R.M.air, 0, T * .3 - .05, 0));
        AIR.swirl(R, g, D.chestW * 1.1, T * .55, 4, .08);
        AIR.swirl(R, g, D.hipW * 1.25, T * .15, -6, .1);
        for (const s of [1, -1]) R.add(g, G.sph(rd(D.armR * 1.5), 8, 6), R.M.cloud, s * D.shX * .9, D.shY + D.armR * .5, 0).scale.set(1, .7, 1);
        [[.5, .7, .3, .45], [-.45, .75, .25, .42], [.2, .45, .45, .4], [-.25, .3, .35, .38], [0, .9, -.4, .5], [.4, .2, -.3, .4], [-.4, .5, -.35, .42]]
            .forEach(([x, y, z, s]) => R.add(g, G.sph(1, 8, 6), R.M.cloud, x * D.chestW, y * T, z * D.chestD).scale.setScalar(s * D.chestW));
    },
    column(R) {
        const D = R.D, H = R.H, J = R.j;
        J.low = R.grp(R.root);
        for (let i = 0; i < 8; i++) {
            const t = i / 7, r = .07 + (D.hipW * 1.1 - .07) * Math.pow(t, 1.3);
            const s = R.add(J.low, G.torus(rd(r), rd(r * .4 + .02), 5, 16, 4.6), R.M.air, 0, H * (.14 + .86 * t), 0);
            s.rotation.set(Math.PI / 2, 0, i * 1.3);
            s.castShadow = false;
            R.spin.push({ o: s, ax: 'z', sp: (7 - 3 * t) * (i % 2 ? 1 : -1.3) });
            if (i % 3 === 0) R.anchors.push(s);
        }
        R.add(J.low, G.cyl(rd(D.hipW * .9), .05, rd(H * .9), 10, true), R.M.air, 0, H * .55, 0).castShadow = false;
        for (let i = 0; i < 7; i++) {
            const a = i * TAU / 7, rr = .2 + (i % 2) * .1;
            R.add(J.low, G.sph(1, 8, 6), R.M.cloud, Math.cos(a) * rr, .1, Math.sin(a) * rr).scale.set(.2, .13, .2);
        }
        R.motes.push(new Motes(J.low, G.sph(1, 4, 3), R.M.dust, 40, { len: H * .9, r0: .32, r1: D.hipW * 1.3, dir: 1,
            radial: [1, 1.8], speed: [3, 6], size: [.012, .03], flow: .15, signed: false }, R.rnd));
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, G.sph(rd(r * .85), 12, 9), R.M.cloud, 0, r * .7, 0));
        for (const s of [1, -1]) R.add(h, G.sph(rd(r * .2), 6, 5), R.M.dark, s * r * .32, r * .8, r * .62).scale.set(1, 1.2, .6);
        R.add(h, G.sph(rd(r * .22), 6, 5), R.M.dark, 0, r * .38, r * .66).scale.set(1, 1.4, .6);
        [[0, 2.0, -.1, 1.1], [.85, 1.75, 0, .8], [-.85, 1.75, 0, .8], [.5, 2.3, -.5, .8], [-.55, 2.35, -.45, .75], [0, 2.6, .2, .7],
            [0, 1.6, -.75, .8], [1.2, 1.5, -.3, .55], [-1.2, 1.5, -.3, .55], [0, 1.55, .55, .6]]
            .forEach(([x, y, z, s]) => R.add(h, G.sph(1, 10, 8), R.M.cloud, x * r, y * r, z * r).scale.setScalar(s * r));
    },
    hand(R, h) {
        const r = R.D.hand;
        for (let i = 0; i < 3; i++) R.add(h, G.sph(rd(r * (.8 - i * .15)), 8, 6), i ? R.M.air : R.M.cloud, (i - 1) * r * .35, -r * (.5 + i * .4), 0);
    },
    animate(R, q) {
        R.spinMul = 1 + q.harden * 2 + q.fx * 2;
        R.moteSpeed = 1 + q.harden * 1.5 + q.fx * 2;
        R.moteSpread = 1 + q.fx * .4 + R.scatter * .5;
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
        R.bolts.push({ b: new Bolts(g, 7, 5, R.c.bolt, { len: .45, width: .008, spread: D.chestW, cy: T * .5 }), fwd: false });
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
        R.glows.push(halo(h, R.c.bolt, r * 9, .7, 0, -r * .6, 0));
        R.bolts.push({ b: new Bolts(h, 9, 6, R.c.bolt, { len: .8, width: .011, cy: -r * .6 }), fwd: true });
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
        R.M.core = mat(0xffffff, { roughness: .8, map: bugTex() });
        R.M.mask = mat(0x9a9a96, { roughness: .85, map: bugTex() });
        R.M.hole = mat(0x020202, { roughness: 1 });
    },
    bugs(R, g, n, o, arm = false) {
        const m = new Motes(g, insectGeo(), insectMat(), n, { radial: [.92, 1.35], speed: [1.5, 4], size: [.06, .09], wobble: .12, ...o }, R.rnd);
        m.arm = arm;
        R.motes.push(m);
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0 * .85), 8, 6), R.M.core);
        R.anchors.push(R.tube(g, len, r0, r1, dir, R.M.core, 8, .85));
        SWARM.bugs(R, g, Math.round(len * (r0 + r1) * 420), { len, r0, r1, dir }, part === 'fore');
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
        R.M.flesh = mat(c.flesh, { roughness: .55 });
        R.M.worm = mat(0xffffff, { map: wormTex(c.worm), roughness: .45 });
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
            R.spin.push({ o: ring, ax: 'z', sp: (R.rnd() - .5) * .9 });
            R.anchors.push(ring);
        }
    },
    tendril(R, parent, x, y, z, len, rz = 0) {
        const g = R.grp(parent, x, y, z);
        R.add(g, tendrilGeo(R.ri(3)), R.M.worm).scale.setScalar(len);
        g.rotation.z = rz;
        R.wigglers.push({ g, ph: R.rnd() * TAU, amp: .3, rz });
    },
    crawl(R, g, n, o) {
        R.motes.push(new Motes(g, G.sph(1, 6, 4), R.M.wormPlain, n, { radial: [1.05, 1.18], speed: [.3, .8], size: [.018, .026],
            stretch: [.4, .4, 1.3], flow: .05, wobble: .03, ...o }, R.rnd));
    },
    seg(R, g, len, r0, r1, dir, part) {
        R.add(g, G.sph(rd(r0 * .8), 8, 6), R.M.flesh);
        R.tube(g, len, r0, r1, dir, R.M.flesh, 8, .8);
        MAGGOT.rings(R, g, len, r0, r1, dir, Math.max(.02, r0 * .34));
        MAGGOT.crawl(R, g, 5, { len, r0, r1, dir });
        if (part === 'fore') for (let i = 0; i < 2; i++) MAGGOT.tendril(R, g, (i - .5) * r0, -len * (.3 + i * .3), -r0 * .5, .22 + i * .08);
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
            for (let i = 0; i < 3; i++) MAGGOT.tendril(R, g, s * (D.shX * .7 + i * .04), D.shY + .03, -.04 + i * .03, .2 + i * .07, s * .3);
        }
    },
    pelvis(R, g) {
        const D = R.D;
        R.add(g, G.sph(rd(D.hipW * .9), 8, 6), R.M.flesh).scale.set(1, .8, .85);
        MAGGOT.rings(R, g, .14, D.hipW * .9, D.hipW * .9, -1, .028, .8);
    },
    head(R, h) {
        const r = R.D.head;
        R.anchors.push(R.add(h, G.sph(r, 12, 9), R.M.flesh, 0, r * .85, 0));
        h.children[h.children.length - 1].scale.set(.82, 1.12, .95);
        const n0 = h.children.length;
        MAGGOT.rings(R, h, r * 1.1, r * 1.12, r * .85, 1, .022);
        h.children.slice(n0).forEach(c => { c.position.y += r * .4; });
        for (const s of [1, -1]) R.add(h, G.sph(rd(r * .2), 6, 5), R.M.hole, s * r * .3, r * .95, r * .72).scale.set(1, .85, .5);
        R.add(h, G.box(rd(r * .45), rd(r * .08), .03), R.M.hole, 0, r * .45, r * .85);
        for (let i = 0; i < 6; i++) {
            const a = Math.PI * .65 + i * Math.PI * .14;
            MAGGOT.tendril(R, h, Math.cos(a) * r * .75, r * 1.2, Math.sin(a) * r * .75 - r * .1, .32 + (i % 3) * .1, (Math.cos(a) > 0 ? .3 : -.3));
        }
    },
    hand(R, h) {
        const r = R.D.hand;
        R.add(h, G.sph(rd(r * .8), 8, 6), R.M.flesh, 0, -r * .4, 0).scale.set(1, 1, .7);
        for (let i = 0; i < 4; i++) MAGGOT.tendril(R, h, (i - 1.5) * r * .35, -r * .7, r * .1, .14 + (i % 2) * .05);
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
            lX: .05, lZ: D.armZ, lK: -.25, rX: .05, rZ: D.armZ, rK: -.25, harden: 0, col: 1, fx: 0 };
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
                lX: -.5, lK: -.5, rX: this.heavy ? -.3 : -.5, rK: this.heavy ? -.05 : -.5, rZ: this.heavy ? .1 : D.armZ });
            this.LIE = P({ bx: -1.5, by: D.chestD - H, HL0: .2, HL1: .1, HL2: .1, HLz: .12, spine: 0, neckX: 0,
                lX: .2, lZ: .45, lK: -.25, rX: .2, rZ: .45, rK: -.25 });
            this.DEAD = k === 'golem' || k === 'automaton'
                ? P({ bx: 1.45, by: D.chestD * (k === 'golem' ? 1.1 : 1.3) - H, HL0: -.2, HL1: .05, HL2: .2, HLz: .1, spine: 0, neckX: -.3, neckY: 1.0,
                    lX: -.25, lZ: .5, lK: -.4, rX: -.2, rZ: .35, rK: -.2 })
                : P({ ...crouch(.6), bz: .05, spine: sp + .55, neckX: .5, lX: .25, lK: -.1, rX: .25, rK: -.1 });
        } else {
            this.KNEEL = P({ by: -H * .3, col: .7, spine: sp + .3, neckX: -.1, lX: -.4, lK: -.6, rX: -.4, rK: -.6 });
            this.LIE = P({ by: -H * .62, col: .35, spine: sp + .55, neckX: -.35, lX: -1.0, lZ: .7, lK: -.2, rX: -1.0, rZ: .7, rK: -.2 });
            this.DEAD = k === 'vestrad'
                ? P({ by: -H + .14, spine: 1.35, neckX: .4, lX: .3, lZ: .8, rX: .3, rZ: .8 })
                : P({ by: -H * .45, col: .5, spine: sp + .6, neckX: .5, lX: .3, rX: .3 });
        }
        // attacks: wind-up A1 → strike A2 (fx = effect: slam chips, flame jet, bolt, insect stream) → follow-through A3
        let A1, A2, A3;
        if (k === 'rock' || k === 'golem') {                                           // two-handed overhead slam
            const cr = crouch(.35);
            A1 = P({ ...crouch(.05), bx: -.1, spine: sp - .45, neckX: -.15, lX: -2.9, lZ: .15, lK: -.6, rX: -2.9, rZ: .15, rK: -.6 });
            A2 = P({ ...cr, bz: .18, bx: .08, spine: sp + .55, neckX: .1, lX: -.55, lZ: -.12, lK: -.1, rX: -.55, rZ: -.12, rK: -.1, fx: 1 });
            A3 = P({ ...cr, bz: .16, bx: .06, spine: sp + .5, lX: -.5, lZ: -.1, lK: -.15, rX: -.5, rZ: -.1, rK: -.15, fx: .5 });
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
            J.low.rotation.x = g * .1 + run * .08;
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
                wg.g.rotation.x = Math.sin(t * 2.2 + wg.ph) * wg.amp * this.wigMul;
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
