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
 *   octopus octopuss-1 (giant octopus), octopuss-2 (devil octopus), octopuss-3 (horror from the deep: fangs, glowing
 *           eyes, angry brows), kraken (10 arms, toothy maw, spiked crest and arms, glowing eyes, the biggest).
 *           Bulbous mantle tilted back over the head, 8 / 10 arms built from segment chains. Every frame each arm is
 *           solved from a few numbers (root pitch, curl, tip curl, sideways wave with its own phase) and laid onto the
 *           ground where it would sink (the tips curl up off the ground in spirals).
 *           walk / run: arms crawl in alternating sets; attack: the front arms rise → lash forward and slam → coil
 *           around the prey → retract; defend: front arms raised as a wall, ink-dark colour flash, jaws open;
 *           death: the mantle sinks and flattens, arms go limp flat on the ground.
 *   biped   klobg (green swamp creature: hunched, long clawed arms, stringy hair, glowing eyes; attack: shoots its
 *           body-long tongue and rakes with the claws), manyhead (giant black rat standing upright with five rat
 *           heads and three naked tails, product of mad magic; attack: the heads bite one after another, claws rake).
 *           QuadrupedRig with the two hind legs; the torso leans on its own joint (chest).
 *   illusion illusion-beast (translucent shimmering serpent dragon with glowing runes, horns, whiskers, mane wisps),
 *           illusion-beast-2 (same spell, other look: gold / rose, antlers, glowing frill fins along the neck).
 *           One skinned translucent body (rear chain on the ground + rising neck chain), runes scrolling along it;
 *           attack: draws the neck back → strikes; death: sinks flat and fades.
 *
 * All rigs: `root` (on the grid cell, y = 0 ground), `j` (joints, j.head always present), `update(c, dt)`;
 * states idle, walk, run, attack, defend, hit, kneel, lie, death blend through damped poses; facing as QuadrupedRig.
 */

export const AQUATIC_VARIANTS = {
    shark: { kind: 'shark', back: 0x5a6e7e, belly: 0xeceee8, fin: 0x4a5c6c, scale: 1 },
    'octopuss-1': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x8a6448, spot: 0xd8b48a, arm: 0x7e5a40, under: 0xc49c7c, sucker: 0xd8b894,
        eye: 0xc8a050, pattern: 'spots', scale: 1 },
    'octopuss-2': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x4a3a72, spot: 0xa8a848, arm: 0x8e4a32, under: 0xcc8c64, sucker: 0xf4d0a0,
        eye: 0xe8c040, pattern: 'cells', scale: 1.4 },
    'octopuss-3': { kind: 'octopus', arms: 8, seg: 14, mantle: 0x3e5a8e, spot: 0x84c0d8, arm: 0x4e4252, under: 0x8a6a6c, sucker: 0xd8a48c,
        eye: 0xffd050, glow: true, fangs: true, brow: true, pattern: 'scales', scale: 1.8 },
    kraken: { kind: 'octopus', arms: 10, seg: 16, len: 1.3, mantle: 0x2c443a, spot: 0x5a7e68, arm: 0x28342e, under: 0x5a4642, sucker: 0xc47a6a,
        eye: 0x9af4ff, glow: true, fangs: true, brow: true, maw: true, crest: true, spikes: true, pattern: 'scales', scale: 2.3 },
    klobg: { kind: 'klobg', skin: 0x5c9a48, dark: 0x2e5a28, belly: 0x8cb86c, hair: 0x5e6450, eye: 0xf0d040, claw: 0xd8d0b0, scale: 1 },
    manyhead: { kind: 'manyhead', fur: 0x37363c, dark: 0x18181c, skin: 0xb48682, ear: 0xa84a48, eye: 0x2a0808, claw: 0xd8c8b0, scale: 1 },
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
        return paint(new THREE.SphereGeometry(1, 18, 12), (c, p) => c.copy(B).lerp(A, sstep(split - .14, split + .14, p.y)));
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
        } else if (kind === 'cells') {
            g.strokeStyle = hex(dark); g.lineWidth = 2;
            for (let i = 0; i < 70; i++) {
                const x = rnd() * 128, y = rnd() * 128, r = 4 + rnd() * 6;
                g.fillStyle = hex(rnd() < .55 ? ink : base);
                g.globalAlpha = .55 + rnd() * .4;
                g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; g.stroke();
            }
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
        const ell = (p, rx, ry, rz, x, y, z) => { const m = add(p, twoTone(c.back, c.belly, -.12), skin, x, y, z); m.scale.set(rx, ry, rz); return m; };

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
            (col, y) => col.copy(B).lerp(A, sstep(-.3, 0, y))), z => -z, boneZ.map(z => -z)));
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
            f.scale.x = s;
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
                o.jaw = .03 + Math.max(0, Math.sin(t * .6)) * .08;
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
        this.armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .6 });
        this.baseMantle = this.mantleMat.color.clone();
        this.inkCol = new THREE.Color(0x14121c);
        const sk = this.mantleMat, dark = mat(0x0a0808, { roughness: .3 });
        const eyeM = c.glow ? mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.2, roughness: .3 }) : mat(c.eye, { roughness: .25 });

        J.body = grp(this.root, 0, this.H, 0);
        J.head = grp(J.body);
        const big = c.maw;
        add(J.head, G.sph(big ? .36 : .3, 16, 12), sk, 0, big ? .05 : .02, .04).scale.set(1, .85, big ? 1.3 : 1.05);
        // mantle sac tilted back over the head (scaled by breathing / flattening)
        J.squash = grp(J.head, 0, .12, -.08);                                                    // flattening stays vertical
        J.mantle = grp(J.squash);
        add(J.mantle, G.sph(.37, 18, 14), sk, 0, .3, -.12).scale.set(.95, 1, big ? 1.5 : 1.12);
        if (c.crest) for (let i = 0; i < 8; i++) {                                                 // spiked crest along the sac
            const a = -.2 + i * .34, R = .39;
            const sp = add(J.mantle, G.cone(.05 - i * .003, .26 - i * .012, 5), dark, 0, .3 + Math.cos(a) * R, -.12 - Math.sin(a) * R * 1.45);
            sp.rotation.x = -a - .25;
        }
        add(J.head, G.cyl(.035, .05, .14, 8), sk, -.24, -.06, -.06).rotation.z = 1.1;               // siphon
        // eyes: bulging, horizontal slit pupils, lids (angry brows)
        J.eyes = [];
        this.halos = [];
        const ez = big ? .3 : .17;
        for (const s of [1, -1]) {
            const ex = s * (big ? .25 : .2), ey = big ? .17 : .12;
            add(J.head, G.sph(.09, 10, 8), eyeM, ex, ey, ez);
            const pu = add(J.head, G.box(.075, .022, .02), dark, ex + s * .045, ey, ez + .065);
            pu.rotation.y = s * .6;
            const lid = add(J.head, G.sph(.1, 10, 6, 0, TAU, 0, Math.PI * .42), sk, ex, ey, ez);
            lid.rotation.set(c.brow ? .25 : -.2, 0, c.brow ? -s * .5 : 0);
            if (c.glow) { const h = haloSprite(c.eye, .42, .6); h.position.set(ex + s * .05, ey, ez + .06); J.head.add(h); this.halos.push(h); }
        }
        if (c.fangs) {
            const tooth = mat(0xe8e0c8, { roughness: .35 }), mouth = mat(0x3a0e12, { roughness: .8 });
            const w = big ? .2 : .1, d = big ? .24 : .1, zf = big ? .3 : .2;
            add(J.head, G.sph(1, 10, 8), mouth, 0, -.12, zf + .02).scale.set(w * 1.1, .08, d + .04);
            add(J.head, teethGeo(big ? 11 : 7, w, d, zf - d * .2, -.11, big ? .14 : .08, -1), tooth);
            J.jaw = grp(J.head, 0, -.13, zf - d * .5);
            add(J.jaw, G.sph(1, 10, 8), sk, 0, -.03, d * .7).scale.set(w * 1.15, .06, d * 1.1);
            add(J.jaw, teethGeo(big ? 10 : 6, w * .9, d * .95, -d * .1, 0, big ? .12 : .065, 1), tooth);
        }

        // arms: ring under the head, each one skinned mesh on a bone chain (+z outwards)
        const L = 1.5 * (c.len || 1), l = this.segLen = L / N, r0 = big ? .1 : .085;
        this.radii = [];
        for (let k = 0; k <= N; k++) this.radii.push(r0 * (1 - .84 * k / N));
        this.arms = [];
        const lashN = n === 10 ? 4 : 2, geo = armGeo(c, N, L, r0);
        for (let i = 0; i < n; i++) {
            let ang = (i + .5) / n * TAU;
            if (ang > Math.PI) ang -= TAU;
            const holder = grp(J.body, Math.sin(ang) * .19, this.ringY, Math.cos(ang) * .19);
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
        J.mantle.rotation.x = -.5 + q.mantle + breathe * .6;
        J.mantle.scale.setScalar(1 + breathe);
        J.squash.scale.set(1 + q.flat * .3, 1 - q.flat, 1 + q.flat * .3);
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
        this.rad = z => z >= 0 ? .2 - .06 * z / (this.NN * this.ln) : .03 + .17 * smooth((z + this.NR * this.lr) / (this.NR * this.lr - 1));
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
            transparent: true, opacity: .62, depthWrite: false
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
        add(J.head, G.sph(.16, 14, 10), hm, 0, .03, .06).scale.set(.95, .78, 1.15);
        add(J.head, G.sph(.1, 12, 8), hm, 0, .01, .25).scale.set(.95, .6, 1.5);
        J.jaw = grp(J.head, 0, -.06, .06);
        add(J.jaw, G.sph(.085, 10, 8), hm, 0, -.015, .17).scale.set(.95, .35, 1.7);
        add(J.jaw, teethGeo(6, .06, .14, .06, .01, .035, 1), hornM);
        add(J.head, teethGeo(6, .065, .16, .08, -.04, .04, -1), hornM);
        const eyeM = mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.6 });
        this.halos = [];
        for (const s of [1, -1]) {
            add(J.head, G.sph(.032, 8, 6), eyeM, s * .1, .08, .16);
            const h = haloSprite(c.eye, .3, .55); h.position.set(s * .11, .08, .17); J.head.add(h); this.halos.push([h, .55]);
            const horn = add(J.head, taperTube([[0, 0, 0], [.03, .08, -.08], [.05, .2, -.2], [.04, .32, -.38]], .03, .004, 10, 6), hornM, s * .07, .1, .02);
            horn.scale.x = s;
            if (c.antler) for (const [y, z, bx] of [[.12, -.1, .1], [.22, -.22, .12]]) {
                const br = add(J.head, taperTube([[0, 0, 0], [.06, .06, .02], [.1, .14, .0]], .014, .003, 6, 5), hornM, s * (.1 + bx * .1), .1 + y, .02 + z);
                br.scale.x = s;
            }
            const wh = add(J.head, taperTube([[0, 0, 0], [.12, -.04, .04], [.26, -.14, -.04], [.36, -.3, -.16]], .011, .002, 10, 5), hornM, s * .07, -.01, .34);
            wh.scale.x = s;
        }
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
        this.skin.opacity = (.56 + Math.sin(t * 2.3) * .08) * (.45 + .55 * live);
        if (!this.skin.map) this.skin.color.lerpColors(this.c1, this.c2, .5 + .5 * Math.sin(t * .9));
        for (const [m, op] of this.glowMats) m.opacity = op * (.7 + .3 * Math.sin(t * 2.7)) * (.3 + .7 * live) * (1 + q.flare * .4);
        for (const [h, op] of this.halos) h.material.opacity = op * (.8 + .2 * Math.sin(t * 3.7)) * (.25 + .75 * live);
        J.mane.forEach((m, i) => { m.rotation.x = -.2 - q.flare * .5 + Math.sin(t * 2 + i) * .15; });
        J.frill.forEach((f, k) => { f.rotation.z = Math.sin(t * 2.5 - k * .6) * .12; f.scale.y = (1 - k * .07) * (.8 + q.flare * .4); });
        this.face(c, dt);
    }
}

// ------------------------------------------------------------------ upright beasts (klobg, manyhead)
const BIPED_DIMS = {
    // legs [thigh, shin, low], leg radius, hip width, lean, torso height, shoulder half width, arm [upper, fore], neck
    klobg: { legs: [.48, .5, .1], R: .088, legX: .13, lean: .6, torso: .62, sh: .27, arm: [.52, .5], neck: .1, L: [-.5, 1.0, -.5] },
    manyhead: { legs: [.4, .42, .22], R: .085, legX: .15, lean: .35, torso: .62, sh: .27, arm: [.34, .32], neck: .08, L: [-.75, 1.5, -1.0] }
};

class UprightBeast extends QuadrupedRig {
    constructor(c, scale) {
        super();
        this.c = c;
        this.kind = c.kind;
        const D = this.D = BIPED_DIMS[this.kind];
        const [L0, L1, L2] = D.L, [a, b, f] = D.legs;
        const H = a * Math.cos(L0) + b * Math.cos(L0 + L1) + f * Math.cos(L0 + L1 + L2) + D.R * .55;
        const kl = this.kind === 'klobg';
        const S = {
            ...BASE_STAND, HL0: L0, HL1: L1, HL2: L2, lean: D.lean,
            neckX: kl ? -.15 : -.05, headX: kl ? -.45 : -.3, jaw: .05,
            armX: kl ? .15 : -.5, armK: kl ? -.35 : -.9, armZ: .12, hand: kl ? .3 : -.2, tongue: 0, hx: 0, hjaw: .1, hsp: 0, tailX: .9
        };
        this.init({ H, stand: S, legs: ['HL', 'HR'], sniff: .3, scale: c.scale * (scale || 1),
            gait: { walk: (a + b) * 1.7, run: (a + b) * 3, amp: .5, ampRun: .2, lift: .9, roll: .04 } });
        this.root.name = this.kind;
        const P = this.pose.bind(this);
        const crouch = { HL0: L0 - .4, HL1: L1 + .75, HL2: L2 - .35 };
        const crouchH = a * Math.cos(L0 - .4) + b * Math.cos(L0 + L1 + .35) + f * Math.cos(L0 + L1 + L2) + D.R * .55 - H;
        if (kl) {                                                                                  // crouch → tongue shot + claw → rake
            this.A1 = P({ ...crouch, by: crouchH, lean: .85, neckX: -.35, headX: -.5, jaw: .7, armX: -.5, armK: -.5 });
            this.A2 = P({ ...crouch, by: crouchH * .5, bz: .15, lean: .75, neckX: -.3, headX: -.45, jaw: 1, tongue: 1, armX: -1.6, armK: -.3, hand: -.2 });
            this.A3 = P({ by: crouchH * .4, bz: .2, lean: .8, neckX: -.2, headX: -.4, jaw: .5, tongue: .15, armX: .3, armK: -.6, hand: .4 });
            this.DEFEND = P({ ...crouch, by: crouchH, lean: .45, neckX: -.1, headX: -.4, jaw: .8, armX: -1.5, armK: -1.0, armZ: .5, hand: -.4 });
        } else {                                                                                   // heads pull back → bite one after another, claws rake
            this.A1 = P({ by: .02, bz: -.08, lean: .15, neckX: -.35, headX: -.2, jaw: .8, hx: -.45, hjaw: .8, armX: -1.6, armK: -.8, hand: -.4 });
            this.A2 = P({ ...crouch, by: crouchH * .6, bz: .3, lean: .75, neckX: .1, headX: -.4, jaw: 1, hx: .1, hjaw: .6, armX: -.9, armK: -.2 });
            this.A3 = P({ by: crouchH * .3, bz: .2, lean: .6, neckX: .15, headX: -.4, jaw: .05, hx: .2, hjaw: .2, armX: .2, armK: -.5 });
            this.DEFEND = P({ by: .03, lean: .1, neckX: -.3, headX: -.2, jaw: .9, hx: -.35, hjaw: .9, hsp: 1, armX: -1.5, armK: -1.2, armZ: .4, hand: -.5 });
        }
        this.HIT = P({ by: .02, bz: -.12, lean: D.lean - .3, neckX: S.neckX - .3, headX: S.headX + .1, jaw: .45, hjaw: .5, hx: -.3, armX: -.6, armK: -.4, armZ: .35 });
        const fold = { HL0: -1.65, HL1: 2.6, HL2: -1.25 };
        const sitH = a * Math.cos(-1.65) + b * Math.cos(.95) + f * Math.cos(-.3) + D.R * .5 - H;
        this.SIT = P({ ...fold, by: sitH, lean: kl ? 1.0 : .6, neckX: kl ? -.45 : -.3, headX: kl ? -.55 : -.35, armX: kl ? .1 : -.6, armK: -.2, hand: .2, tailX: 1.0 });
        this.LIE = P({ HL0: -.2, HL1: .3, HL2: -.1, by: -(H - D.R * 2.6), bx: 1.45, lean: .05, neckX: -.6, headX: -.75, jaw: 0, armX: -.4, armK: -.6, armZ: .5, hand: 0, hx: -.4, tailX: .2 });
        this.DEAD = P({ HL0: -.6, HL1: .9, HL2: -.3, by: -(H - .2), roll: 1.45, lean: .4, neckX: .3, headX: -.1, jaw: .5, hjaw: .5, hx: .5, armX: -.3, armK: -.3, armZ: .1, hand: .2, tailX: .2 });
        this.build();
    }

    build() {
        const c = this.c, D = this.D, J = this.j, kl = this.kind === 'klobg';
        const tex = kl ? skinTex('spots', c.skin, c.belly) : null;
        const skin = tex ? mat(0xffffff, { roughness: .7, map: tex }) : mat(kl ? c.skin : c.fur, { roughness: kl ? .7 : 1 });
        const belly = mat(kl ? c.belly : c.fur, { roughness: .9 }), dark = mat(c.dark, { roughness: .8 });
        const bare = mat(kl ? c.skin : c.skin, { roughness: .7 });
        const claw = mat(c.claw, { roughness: .4 });
        this.mats = { skin, belly, dark, bare, claw };
        const [la, lb, lf] = D.legs, R = D.R;

        J.body = grp(this.root, 0, this.H, 0);
        add(J.body, G.sph(R * (kl ? 1.7 : 2.6), 12, 9), skin, 0, .02, -.02).scale.set(1.25, .9, 1);                 // hips
        // legs (feet kept flat by animateExtras)
        for (const [name, s] of [['HL', 1], ['HR', -1]]) {
            const top = grp(J.body, D.legX * s, -R * .3, 0);
            add(top, G.sph(R * (kl ? 1.2 : 1.7), 10, 8), skin, 0, -la * .3, .01).scale.set(.85, 1.6, kl ? .85 : 1);
            add(top, G.cyl(R * 1.2, R * .85, la, 8), skin, 0, -la / 2, 0);
            const knee = grp(top, 0, -la, 0);
            add(knee, G.sph(R * .9, 8, 6), skin);
            add(knee, G.cyl(R * .85, R * .55, lb, 8), skin, 0, -lb / 2, 0);
            if (kl) add(knee, G.sph(R * .9, 8, 6), skin, 0, -lb * .3, -R * .3).scale.set(.9, 1.8, 1);   // calf
            const low = grp(knee, 0, -lb, 0);
            add(low, G.sph(R * .55, 8, 6), skin);
            add(low, G.cyl(R * .55, R * .5, lf, 7), kl ? skin : bare, 0, -lf / 2, 0);
            const toes = grp(low, 0, -lf, 0);
            add(toes, G.sph(R * .8, 8, 6), kl ? skin : bare, 0, -R * .2, R * .6).scale.set(1, .45, 1.8);   // foot
            for (const a of [-.35, 0, .35]) {
                const t = add(toes, G.cyl(R * .2, R * .16, R * 1.6, 5), kl ? skin : bare, Math.sin(a) * R * 1.6, -R * .35, R * 1.4 + Math.cos(a) * R * .9);
                t.rotation.set(Math.PI / 2, 0, -a);
                add(toes, G.cone(R * .16, R * .7, 5), claw, Math.sin(a) * R * 2.3, -R * .38, R * 2.4 + Math.cos(a) * R * .5).rotation.set(Math.PI / 2 + .3, 0, -a);
            }
            J[name] = { top, knee, low, toes, hind: true, side: s, walk: s > 0 ? 0 : .5, gal: s > 0 ? 0 : .5 };
        }

        // torso on its own lean joint
        J.chest = grp(J.body, 0, .02, 0);
        const T = D.torso;
        if (kl) {
            add(J.chest, G.cyl(.17, .15, T * .6, 10), skin, 0, T * .3, 0);
            add(J.chest, G.sph(.23, 12, 10), skin, 0, T * .7, .0).scale.set(1.35, 1, .95);           // shoulders / chest
            add(J.chest, G.sph(.15, 10, 8), belly, 0, T * .35, .06).scale.set(1, 1.3, .7);
            for (const s of [1, -1]) add(J.chest, G.sph(.11, 10, 8), skin, s * .2, T * .82, -.02).scale.set(1.2, .9, 1);   // trapezius
            for (let i = 0; i < 6; i++) add(J.chest, G.cone(.025, .07, 4), dark, 0, T * (.25 + i * .11), -.15 - Math.sin(i * .5) * .03).rotation.x = -1.9;   // spine ridge
        } else {
            add(J.chest, G.sph(.33, 14, 11), skin, 0, T * .32, .03).scale.set(1, 1.1, .95);           // pot belly
            add(J.chest, G.sph(.3, 14, 11), skin, 0, T * .78, -.01).scale.set(1.08, .95, .95);       // chest
            add(J.chest, G.sph(.24, 12, 9), skin, 0, T * 1.05, -.06).scale.set(1.25, .8, 1);         // shoulder hump carrying the heads
        }

        // arms
        J.arms = [];
        const [ua, fa] = D.arm;
        for (const s of [1, -1]) {
            const sh = grp(J.chest, s * D.sh, T * (kl ? .8 : .85), .02);
            sh.rotation.order = 'ZXY';
            add(sh, G.sph(kl ? .11 : .08, 9, 7), skin);
            add(sh, G.cyl(kl ? .085 : .07, kl ? .065 : .05, ua, 8), skin, 0, -ua / 2, 0);
            if (kl) add(sh, G.sph(.085, 8, 6), skin, 0, -ua * .35, .01).scale.set(1, 2, 1);                // biceps
            const el = grp(sh, 0, -ua, 0);
            add(el, G.sph(kl ? .055 : .05, 8, 6), skin);
            add(el, G.cyl(kl ? .07 : .045, kl ? .048 : .035, fa, 8), skin, 0, -fa / 2, 0);
            if (kl) add(el, G.sph(.07, 8, 6), skin, 0, -fa * .3, 0).scale.set(1, 2.2, 1);
            const hand = grp(el, 0, -fa, 0);
            add(hand, G.sph(kl ? .06 : .045, 8, 6), kl ? skin : bare, 0, -.02, .01).scale.set(1.1, .9, .7);
            const nC = 4;
            for (let i = 0; i < nC; i++) {
                const a = (i - (nC - 1) / 2) * .3;
                const fg = add(hand, G.cyl(kl ? .014 : .01, kl ? .012 : .008, kl ? .12 : .07, 5), kl ? skin : bare, Math.sin(a) * .04, -.07, .02);
                fg.rotation.z = a * .4;
                add(hand, G.cone(kl ? .012 : .008, kl ? .11 : .05, 5), claw, Math.sin(a) * .045, kl ? -.17 : -.12, kl ? .05 : .03).rotation.x = Math.PI - .5;
            }
            J.arms.push({ sh, el, hand, s });
        }

        if (kl) this.buildKlobgHead();
        else this.buildRatHeads();
    }

    buildKlobgHead() {
        const c = this.c, J = this.j, M = this.mats, T = this.D.torso;
        const tooth = mat(0xe8dcb8, { roughness: .4 }), mouth = mat(0x3a1414, { roughness: .8 });
        const eyeM = mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.1, roughness: .3 }), pupil = mat(0x080604);
        const hair = mat(c.hair, { roughness: 1, side: THREE.DoubleSide });
        J.neck = grp(J.chest, 0, T * .92, .06);
        add(J.neck, G.cyl(.075, .09, .16, 8), M.skin, 0, .06, 0);
        J.head = grp(J.neck, 0, this.D.neck + .04, 0);
        add(J.head, G.sph(.13, 12, 10), M.skin, 0, .1, -.01).scale.set(.95, 1.02, 1);                 // skull
        add(J.head, G.sph(.11, 12, 9), M.skin, 0, .02, .07).scale.set(1.05, .8, 1);                  // wide face
                add(J.head, G.sph(1, 9, 7), mouth, 0, -.03, .1).scale.set(.085, .03, .07);
        add(J.head, teethGeo(8, .07, .08, .07, -.025, .035, -1), tooth);
        for (const s of [1, -1]) add(J.head, G.cone(.01, .06, 5), tooth, s * .05, -.04, .13).rotation.x = Math.PI;   // fangs
        for (const s of [1, -1]) {
            add(J.head, G.sph(.022, 8, 6), eyeM, s * .055, .08, .145);
            const brow = add(J.head, G.sph(.045, 8, 6), M.dark, s * .055, .115, .14);                 // angry brow
            brow.scale.set(1.3, .4, .6);
            brow.rotation.z = s * .45;
            add(J.head, G.box(.006, .022, .006), pupil, s * .055, .08, .166);
            const ear = add(J.head, G.cone(.03, .14, 5), M.skin, s * .13, .08, -.01);
            ear.rotation.set(-.3, 0, -s * 1.2);
            ear.scale.z = .4;
            add(J.head, G.sph(.012, 6, 4), M.dark, s * .015, .05, .17);                               // nose slits
        }
        J.jaw = grp(J.head, 0, -.03, .04);
        add(J.jaw, G.sph(.09, 10, 8), M.skin, 0, -.025, .04).scale.set(1.05, .5, 1.05);
        add(J.jaw, teethGeo(7, .065, .07, -.0, .0, .04, 1), tooth);
        // long stringy hair from the crown down the back
        let seed = 3;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 22; i++) {
            const a = -2 + i / 21 * 4, len = .4 + rnd() * .35;
            const h = add(J.head, G.box(.012, len, .008), hair, Math.sin(a) * .125, .19 - len / 2, -Math.cos(a) * .1 - .01);
            h.rotation.set(.15 + rnd() * .15, a * .3, -Math.sin(a) * .22);
        }
        // tongue (body long, shot out of the mouth) with tiny tentacle tips
        J.tongue = grp(J.head, 0, -.04, .1);
        const tm = mat(0x9a4a5a, { roughness: .5 });
        J.tongueMesh = add(J.tongue, cachedGeo('tongue', () => new THREE.CylinderGeometry(.012, .03, 1, 7).rotateX(Math.PI / 2).translate(0, 0, .5)), tm);
        J.tongueTip = grp(J.tongue, 0, 0, 0);
        for (let i = 0; i < 5; i++) {
            const a = i / 5 * TAU;
            const t = add(J.tongueTip, G.cone(.008, .07, 4), tm, Math.cos(a) * .015, Math.sin(a) * .015, .03);
            t.rotation.set(Math.PI / 2 - Math.sin(a) * .5, 0, 0);
            t.rotation.y = Math.cos(a) * .5;
        }
        J.tongue.visible = false;
    }

    // rat head on `parent`, size factor s; returns { head, jaw }
    ratHead(parent, s, whiskers) {
        const c = this.c, M = this.mats;
        const tooth = this.toothMat || (this.toothMat = mat(0xe0c070, { roughness: .4 }));
        const mouth = this.mouthMat || (this.mouthMat = mat(0x6a1a20, { roughness: .8 }));
        const ear = this.earMat || (this.earMat = mat(c.ear, { roughness: .8 }));
        const eyeM = this.eyeMat || (this.eyeMat = mat(c.eye, { roughness: .1, emissive: 0x6a1010, emissiveIntensity: .4 }));
        const head = grp(parent);
        add(head, G.sph(.11 * s, 12, 9), M.skin, 0, .02 * s, 0).scale.set(.9, .85, 1.05);
        const sn = add(head, G.cone(.07 * s, .2 * s, 9), M.skin, 0, .0, .16 * s);
        sn.rotation.x = Math.PI / 2;
        sn.scale.set(1, .8, 1);
        add(head, G.sph(.02 * s, 7, 5), M.bare, 0, .005 * s, .26 * s);                                 // nose
        add(head, G.sph(1, 8, 6), mouth, 0, -.035 * s, .13 * s).scale.set(.045 * s, .02 * s, .09 * s);
        add(head, G.box(.016 * s, .03 * s, .008 * s), tooth, 0, -.03 * s, .23 * s);                   // incisors
        add(head, teethGeo(6, .04 * s, .08 * s, .07 * s, -.04 * s, .025 * s, -1), tooth);
        const jaw = grp(head, 0, -.045 * s, .05 * s);
        const lo = add(jaw, G.cone(.045 * s, .17 * s, 8), M.skin, 0, -.01 * s, .08 * s);
        lo.rotation.x = Math.PI / 2;
        lo.scale.set(1, .5, 1);
        add(jaw, G.box(.014 * s, .028 * s, .008 * s), tooth, 0, .01 * s, .16 * s);
        add(jaw, teethGeo(5, .032 * s, .07 * s, .02 * s, .0, .022 * s, 1), tooth);
        for (const k of [1, -1]) {
            add(head, G.sph(.017 * s, 7, 5), eyeM, k * .055 * s, .05 * s, .09 * s);
            const e = add(head, G.sph(.05 * s, 9, 7), ear, k * .07 * s, .1 * s, -.02 * s);
            e.scale.set(1, 1, .3);
            e.rotation.y = k * .5;
            if (whiskers) for (let w = 0; w < 3; w++) {
                const wh = add(head, G.cyl(.0015, .0015, .22 * s, 3), M.dark, k * .11 * s, .0, .2 * s, false);
                wh.rotation.set(0, 0, k * (1.4 + (w - 1) * .15));
                wh.rotation.y = -k * .4;
            }
        }
        return { head, jaw };
    }

    buildRatHeads() {
        const c = this.c, J = this.j, M = this.mats, T = this.D.torso;
        J.neck = grp(J.chest, 0, T * .98, .2);
        add(J.neck, G.cyl(.08, .11, .16, 8), M.skin, 0, .05, 0);
        const main = this.ratHead(J.neck, 1.45, true);
        main.head.position.y = this.D.neck + .06;
        J.head = main.head; J.jaw = main.jaw;
        // four more heads on short necks around the shoulder hump
        J.xheads = [];
        const spots = [[.28, .98, .05, .55, -.1], [-.28, .98, .05, -.55, -.1], [.14, 1.18, -.05, .3, -.45], [-.14, 1.18, -.05, -.3, -.45]];
        spots.forEach(([x, y, z, sp, up], i) => {
            const neck = grp(J.chest, x, T * y, z);
            neck.rotation.order = 'YXZ';
            add(neck, G.cyl(.06, .085, .2, 8), M.skin, 0, .08, 0);
            const h = this.ratHead(neck, 1.3, false);
            h.head.position.y = .18;
            J.xheads.push({ neck, head: h.head, jaw: h.jaw, sp, up, ph: i * 1.7 + .5, delay: [.06, .14, 0, .1][i] });
        });
        // three naked tails trailing on the ground
        J.tails = [];
        J.tailBase = grp(J.body, 0, -.05, -.2);                                                   // kept level: tails are solved on the ground
        J.tailBase.rotation.order = 'ZYX';
        const tm = M.bare, N = 9, l = .2;
        this.tailRadii = [];
        for (let k = 0; k <= N; k++) this.tailRadii.push(.035 * (1 - .8 * k / N));
        for (let i = 0; i < 3; i++) {
            const root = grp(J.tailBase, (i - 1) * .06, 0, 0);
            root.rotation.order = 'YXZ';
            const segs = [];
            let p = root;
            for (let k = 0; k < N; k++) {
                const g = k === 0 ? root : grp(p, 0, 0, l);
                g.rotation.order = 'YXZ';
                const r0 = this.tailRadii[k], r1 = this.tailRadii[k + 1];
                add(g, cachedGeo(`rtail${k}`, () => new THREE.CylinderGeometry(r1, r0, l, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, l / 2)), tm);
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
        if (J.tongue) {                                                                            // klobg tongue
            const ext = q.tongue;
            J.tongue.visible = ext > .02;
            const len = 1.9 * ext;
            J.tongueMesh.scale.z = Math.max(.01, len);
            J.tongueTip.position.z = len;
            J.tongue.rotation.x = .1 + Math.sin(t * 9) * .03 * ext;
            J.tongueTip.rotation.z = t * 6;
        }
        if (J.xheads) {
            const att = state === 'attack' ? this.attP : -1;
            const still = state === 'death' ? 0 : 1;
            for (const H of J.xheads) {
                let lunge = 0, jaw = q.hjaw;
                if (att >= 0) {                                                                    // staggered bites
                    const x = clamp((att - .28 - H.delay) / .3, 0, 1);
                    lunge = Math.sin(Math.PI * x);
                    jaw = x > 0 && x < .6 ? .9 : jaw;
                }
                const look = state === 'idle' ? Math.sin(t * .8 + H.ph) * .35 : 0;
                const snap = state === 'idle' ? Math.max(0, Math.sin(t * 2.3 + H.ph * 3)) ** 8 * .6 : 0;
                H.neck.rotation.set(H.up + q.hx + lunge * 1.2 - q.lean * .8 + Math.sin(t * 1.3 + H.ph) * .06 * still,
                    H.sp * (1 + q.hsp * .6) * .6 + look, H.sp * .6 * (1 + q.hsp));
                H.head.rotation.x = .9 * (1 - q.lean * .2) - q.hx * .3 - lunge * .3;
                H.jaw.rotation.x = jaw + snap + Math.sin(t * 7 + H.ph) * .05 * (q.hsp + (state === 'defend' ? 1 : 0));
            }
            J.tailBase.rotation.set(-q.bx, 0, -q.roll);
            const y0 = this.H + q.by - .05, live = state === 'death' || state === 'lie' ? .2 : 1;
            for (const T of J.tails) {                                                             // tails lie on the ground and swish
                T.t = t; T.live = live;
                solveChain(T.segs, y0, q.tailX, T.yaw + Math.PI + Math.sin(t * .9 + T.ph) * .2 * live, .2, this.tailRadii, tailBend, tailSide, T);
            }
        }
    }
}

// ------------------------------------------------------------------ facade
const RIGS = { shark: Shark, octopus: Octopus, illusion: Illusion, klobg: UprightBeast, manyhead: UprightBeast };

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
