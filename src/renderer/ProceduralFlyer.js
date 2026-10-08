import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { DIRECTIONS } from '../utils/constants.js';
import { TAU, smooth, damp } from './QuadrupedRig.js';
import { taperTube, glowMat, flameTongue, flickerFlames } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralFlyer — birds and bats flying over the battlefield (hovering 1–2 m above the ground).
 * Kinds:
 *   bird    — eagle (giant royal eagle: dark brown, golden nape, white tail with a dark band),
 *             phoenix (huge golden-red bird: glowing feathers, flame tongues on the wing tips, crest and the long
 *             tail plumes, halo; attack adds a fiery wing buffet and a jet of flame from the beak)
 *   gryffon — eagle front (head with ear tufts, feathered chest, bird fore-legs with talons, wings) on a lion's body
 *             (hind legs with paws, tufted tail). Walks on four legs with folded wings, flies when running / attacking.
 *   harpy   — woman's head and torso (face, long hair, cloth wrap) on a bird's body with feathered thighs,
 *             taloned legs, tail fan; the arms are wings.
 *   bat     — giant bat, vampire in bat form, elder vampire (bigger, darker, glowing red eyes): furry body,
 *             big ears, fanged jaw, membrane wings (one membrane per wing, re-shaped every frame from the finger bones).
 * Feather wings: arm ─ forearm ─ hand bones carrying tertials, secondaries, coverts and fanned primaries; every feather
 * is a thin two-tone blade (vertex colours: top / underside / tip band). Both wing kinds fold back along the flank.
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
    eagle: { kind: 'bird', scale: 1.5, hover: 1.05, body: 0x3a2616, belly: 0x46301c, head: 0xb5874a, feather: 0x3b2717, under: 0x6a5440,
        covert: 0x54381e, tip: 0x15100c, tail: 0xf0ece4, tailTip: 0x2a1c12, beak: 0xe8b830, beakTip: 0x3a3028, leg: 0xe8b830, eye: 0xc88a20 },
    phoenix: { kind: 'bird', phoenix: true, scale: 2, hover: 1.1, body: 0xd8561a, belly: 0xf2a630, head: 0xf2b23c, feather: 0xe8601a,
        under: 0xffb040, covert: 0xf2b632, tip: 0xd02a10, tail: 0xf0a028, tailTip: 0xd8300e, beak: 0xf0d060, beakTip: 0x8a4a10, leg: 0x9a3a10,
        eye: 0xfff0a0, glow: 0xff7a20 },
    gryffon: { kind: 'gryffon', scale: 1.6, hover: 1.1, body: 0x5a3a1e, belly: 0xece4d4, head: 0x6a4424, face: 0xf0ead8, coat: 0xc8964a,
        coatLight: 0xe0c08a, feather: 0x5a3a1e, under: 0xe4d8c0, covert: 0xb08848, tip: 0x2a1c12, beak: 0xe8c040, beakTip: 0x5a4a30,
        leg: 0xe0b030, eye: 0xd09020, tuft: 0x3a2414 },
    harpy: { kind: 'harpy', scale: 1, hover: 1.35, body: 0x6e6862, feather: 0x77706a, under: 0xe8e4dc, covert: 0x8a8278, tip: 0x2a2624,
        tail: 0x5e5852, tailTip: 0x222020, leg: 0x6a6460, skin: 0xe6c2a4, hair: 0x4a3020, cloth: 0xd8d2c4, lips: 0xa03038, eye: 0x3a5a30 },
    'giant-bat': { kind: 'bat', scale: 1.05, hover: 1.25, fur: 0x5a4a44, face: 0x9a6a5a, membrane: 0x4a3a36, bone: 0x3a2e2a, ear: 0x8a5e52,
        eye: 0x100a08 },
    'vampire-bat-form': { kind: 'bat', scale: 1.15, hover: 1.2, fur: 0x1e1618, face: 0x2e2024, membrane: 0x3a1828, bone: 0x1a1014,
        ear: 0x3e2030, eye: 0xff2010, glowEye: true },
    'vampire-elder-bat-form': { kind: 'bat', scale: 1.45, hover: 1.1, fur: 0x0e0a0c, face: 0x1c1216, membrane: 0x2a0c16, bone: 0x120a0c,
        ear: 0x2e0e1a, eye: 0xff1008, glowEye: true, elder: true }
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
function featherGeo(len, w, top, under, tip = top, frac = 0) {
    return cached(`f${len},${w},${top},${under},${tip},${frac}`, () => {
        const ts = [0, .12, .35, .6, .82, 1];
        if (frac > 0) { const b = 1 - frac; ts.push(b, b + .002); ts.sort((a, b2) => a - b2); }
        const pos = [], col = [], idx = [], cTop = new THREE.Color(top), cUnder = new THREE.Color(under), cTip = new THREE.Color(tip);
        const th = Math.max(.0015, w * .025), ridge = w * .08;
        const rows = ts.map(t => {
            const hw = w / 2 * Math.sin(Math.min(1, (t + .1) / .5) * Math.PI / 2) * (t > .72 ? 1 - (t - .72) / .28 * .8 : 1);
            return { z: -len * t, hw, tip: frac > 0 && t > 1 - frac + .001 };
        });
        // top row vertices (L, C, R) then bottom
        for (const r of rows) {
            const c = r.tip ? cTip : cTop;
            for (const [x, y] of [[-r.hw, th], [0, th + ridge], [r.hw, th]]) { pos.push(x, y, r.z); col.push(c.r, c.g, c.b); }
        }
        for (const r of rows) {
            const c = r.tip ? cTip : cUnder;
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
    featherWing(parent, s, { x, y, z, len, feather, under, covert, tip }) {
        const add = this.add, grp = this.grp, fm = this.featherMat;
        const a = len * .24, f = len * .3;
        const root = grp(parent, x, y, z);
        root.rotation.order = 'YZX';
        const arm = grp(root), elbow = grp(arm, s * a, 0, 0), hand = grp(elbow, s * f, 0, 0);
        const bone = this.m(covert);
        const lim = (g, l, r) => { add(g, G.cyl(r * .75, r, l, 7), bone, s * l / 2, 0, -r * .3).rotation.z = Math.PI / 2; };
        lim(arm, a, len * .045);
        lim(elbow, f, len * .032);
        add(hand, G.sph(len * .03, 7, 5), bone).scale.set(1.6, .7, 1);
        const pivots = [], prim = [], sec = [];
        for (let i = 0; i < 4; i++) {                                       // tertials on the arm (fold forward)
            const pv = grp(arm, s * a * (i + .6) / 4, -.003, 0);
            add(pv, featherGeo(len * (.3 - i * .01), len * .1, feather, under), fm, 0, 0, -len * .02).rotation.y = s * .08;
            pivots.push([pv, -1]);
        }
        for (let i = 0; i < 6; i++) {                                       // secondaries along the forearm
            const pv = grp(elbow, s * f * (i + .5) / 6, -.004 - (i % 2) * .002, 0);
            const l = len * (.36 + i * .008);
            const mesh = add(pv, featherGeo(l, len * .1, feather, under, tip, .18), fm, 0, 0, -len * .01);
            mesh.rotation.y = -s * .06 * i / 5;
            mesh.userData.len = l;
            pivots.push([pv, 1]);
            sec.push(mesh);
        }
        for (let i = 0; i < 5; i++) {                                       // coverts: short top layer on arm and forearm
            const onArm = i < 2, g = onArm ? arm : elbow, l0 = onArm ? a : f;
            const pv = grp(g, s * l0 * ((onArm ? i : i - 2) + .5) / (onArm ? 2 : 3), .012, 0);
            add(pv, featherGeo(len * .18, len * .1, covert, under), fm, 0, 0, len * .03);
            pivots.push([pv, onArm ? -1 : 1]);
        }
        const nP = 6;
        for (let i = 0; i < nP; i++) {                                       // primaries fanned from the hand
            const pv = grp(hand, s * len * .02 * i, -.006 - .003 * i, 0);
            const l = len * (.52 - i * .035);
            const mesh = add(pv, featherGeo(l, len * .085, feather, under, tip, .4), fm);
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
        const mem = add(root, geo, mat(membrane, { roughness: .85, side: THREE.DoubleSide }));
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
                P[5].copy(P[4]).lerp(P[6], .5).lerp(P[2], .14);                 // scalloped trailing edge
                P[7].copy(P[6]).lerp(P[8], .5).lerp(P[2], .14);
                P[9].copy(P[8]).lerp(P[10], .5).lerp(P[2], .12);
                for (let i = 0; i < 11; i++) set3(i, P[i]);
                geo.attributes.position.needsUpdate = true;
                geo.computeVertexNormals();
            }
        };
        wing.set(1);
        return wing;
    }

    // Bird leg on `parent`: feathered thigh, scaly shank, three toes forward + one back, hooked talons.
    birdLeg(parent, x, y, z, { th, sh, toe, r, upper, scale, talon, thighR = r * 2.4 }) {
        const add = this.add, grp = this.grp;
        const top = grp(parent, x, y, z);
        add(top, G.sph(thighR, 9, 7), upper, 0, -th * .4, 0).scale.set(.85, th / thighR * .7, 1);
        const knee = grp(top, 0, -th, 0);
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

    // Bird head: skull, hooked beak (+ lower mandible on J.jaw), fierce eyes under a brow ridge.
    birdHead(head, r, { color, beak, beakTip, eye, face = null }) {
        const add = this.add, J = this.j, k = r / .075;
        const hm = this.m(color), bm = mat(beak, { roughness: .45 }), tm = mat(beakTip, { roughness: .4 });
        add(head, G.sph(r, 14, 10), hm, 0, 0, 0).scale.set(.86, .9, 1.15);
        add(head, G.sph(r * .7, 10, 8), face ? this.m(face) : hm, 0, -r * .35, r * .25).scale.set(1, .9, 1.2);   // cheeks / throat
        const up = add(head, taperTube([[0, .0, 0], [0, .006 * k, .03 * k], [0, -.004 * k, .058 * k], [0, -.03 * k, .068 * k]], .03 * k, .004 * k, 10, 7), bm, 0, -r * .05, r * .82);
        up.scale.x = .7;
        add(head, G.sph(.009 * k, 6, 5), tm, 0, -.032 * k - r * .05, .066 * k + r * .82);                       // dark hook tip
        add(head, G.sph(r * .33, 8, 6), bm, 0, r * .05, r * .78).scale.set(1, .8, .6);                          // cere
        J.jaw = this.grp(head, 0, -r * .3, r * .8);
        add(J.jaw, taperTube([[0, 0, 0], [0, -.003 * k, .025 * k], [0, -.004 * k, .045 * k]], .018 * k, .004 * k, 6, 6), bm).scale.x = .75;
        const em = mat(eye, { roughness: .15, emissive: eye, emissiveIntensity: this.c.phoenix ? .9 : .15 }), dark = mat(0x0a0806, { roughness: .2 });
        const brow = this.m(new THREE.Color(color).multiplyScalar(.75).getHex());
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(head, G.sph(r * .2, 8, 6), em, s * r * .58, r * .2, r * .5));
            add(head, G.sph(r * .1, 6, 5), dark, s * r * .7, r * .21, r * .58);
            const b = add(head, G.box(r * .3, r * .1, r * .45), brow, s * r * .55, r * .38, r * .5);
            b.rotation.set(0, s * .35, -s * .3);
        }
    }

    // Tail fan of n feathers at (x, y, z); J.tailF animated by tailFan.
    tailFan(parent, x, y, z, n, len, w, top, under, tip, frac) {
        const J = this.j;
        J.tail = this.grp(parent, x, y, z);
        J.tailF = [];
        for (let i = 0; i < n; i++) {
            const d = i - (n - 1) / 2;
            const pv = this.grp(J.tail, 0, -Math.abs(d) * .004, 0);
            this.add(pv, featherGeo(len * (1 - Math.abs(d) * .04), w, top, under, tip, frac), this.featherMat);
            pv.userData.d = d;
            J.tailF.push(pv);
        }
    }

    // Overlapping contour feathers on the back (breaks up the smooth body).
    backFeathers(parent, rows, color, under, tip) {
        for (const [x, y, z, l, w, rx] of rows) {
            const m = this.add(parent, featherGeo(l, w, color, under, tip, .3), this.featherMat, x, y, z);
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

    buildBird() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const body = this.m(c.body), belly = this.m(c.belly), headM = this.m(c.head);
        const legM = mat(c.leg, { roughness: .6 }), talon = mat(0x141210, { roughness: .35 });
        J.body = grp(this.root, 0, c.hover, 0);
        add(J.body, G.sph(.15, 14, 10), body, 0, 0, -.03).scale.set(1, .95, 1.85);
        add(J.body, G.sph(.14, 12, 9), belly, 0, -.025, .13).scale.set(1, 1.05, 1.1);                      // chest
        add(J.body, G.sph(.1, 10, 8), body, 0, -.05, -.2).scale.set(1, .85, 1.4);                         // vent
        this.backFeathers(J.body, [
            [-.06, .12, .12, .2, .12, -.25], [.06, .12, .12, .2, .12, -.25], [0, .135, .06, .22, .14, -.2],
            [-.07, .1, -.02, .22, .12, -.15], [.07, .1, -.02, .22, .12, -.15], [0, .12, -.08, .22, .13, -.12]
        ], c.phoenix ? c.covert : c.body, c.belly, c.phoenix ? c.feather : c.feather);
        // neck & head
        J.neck = grp(J.body, 0, .05, .23);
        add(J.neck, G.cyl(.07, .1, .17, 10), headM, 0, .07, 0);
        add(J.neck, G.sph(.085, 10, 8), belly, 0, .03, .04).scale.set(1, 1.2, .8);                         // throat
        J.head = grp(J.neck, 0, .16, .02);
        this.birdHead(J.head, .075, { color: c.head, beak: c.beak, beakTip: c.beakTip, eye: c.eye });
        // legs
        J.legs = [1, -1].map(s => this.birdLeg(J.body, .065 * s, -.08, .03,
            { th: .11, sh: .14, toe: .075, r: .016, upper: body, scale: legM, talon, thighR: .055 }));
        // tail
        this.tailFan(J.body, 0, .02, -.28, 7, .38, .1, c.tail, c.tail, c.tailTip, .35);
        // wings
        J.wings = [1, -1].map(s => this.featherWing(J.body, s, { x: .09 * s, y: .08, z: .1, len: 1.12,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip }));
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
        for (const [x, ry] of [[0, 0], [.04, .22], [-.04, -.22]]) {                                      // long flowing tail plumes
            let p = grp(J.tail, x, -.01, 0);
            p.rotation.y = ry;
            const segs = [];
            for (let i = 0; i < 4; i++) {
                const g = grp(p);
                add(g, featherGeo(.3, .07 + i * .012, i < 2 ? c.tail : c.feather, c.under, i === 3 ? c.tip : (i < 2 ? c.tail : c.feather), i === 3 ? .5 : 0), fm);
                segs.push(g);
                p = grp(g, 0, 0, -.29);
            }
            this.flame(p, 0, 0, 0, .09, c.glow, .2);
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
        const fea = this.m(c.body), chest = this.m(c.belly), coat = mat(c.coat, { roughness: .95 }), light = mat(c.coatLight, { roughness: .95 });
        const legM = mat(c.leg, { roughness: .6 }), talon = mat(0x141210, { roughness: .35 });
        this.H0 = .565;
        J.body = grp(this.root, 0, this.H0, 0);
        // lion rear
        add(J.body, G.sph(.15, 14, 10), coat, 0, 0, -.12).scale.set(.92, .92, 2.1);
        add(J.body, G.sph(.145, 12, 9), coat, 0, .01, -.32).scale.set(.95, 1.02, 1);                       // haunches
        add(J.body, G.sph(.12, 10, 8), light, 0, -.07, -.1).scale.set(.85, .5, 1.8);                       // belly
        // feathered eagle front
        add(J.body, G.sph(.17, 14, 10), fea, 0, .02, .16).scale.set(.95, 1, 1.15);
        add(J.body, G.sph(.13, 12, 9), chest, 0, -.02, .28).scale.set(.95, 1.15, .8);                      // white chest
        this.backFeathers(J.body, [
            [-.07, .14, .2, .2, .12, -.2], [.07, .14, .2, .2, .12, -.2], [0, .16, .12, .22, .14, -.15],
            [-.09, .1, .06, .18, .1, -.05], [.09, .1, .06, .18, .1, -.05]
        ], c.body, c.under, c.covert);
        // neck & head (ear tufts, white face)
        J.neck = grp(J.body, 0, .1, .3);
        add(J.neck, G.cyl(.075, .11, .2, 10), fea, 0, .09, 0);
        add(J.neck, G.sph(.09, 10, 8), chest, 0, .05, .05).scale.set(1, 1.3, .8);
        J.head = grp(J.neck, 0, .2, .02);
        this.birdHead(J.head, .085, { color: c.head, beak: c.beak, beakTip: c.beakTip, eye: c.eye, face: c.face });
        for (const s of [1, -1]) {
            const pv = grp(J.head, s * .045, .05, -.05);
            pv.rotation.set(.75, s * .35, 0);
            add(pv, featherGeo(.12, .045, c.tuft, c.covert, c.tuft), this.featherMat);
        }
        // fore-legs: eagle legs with talons; hind-legs: lion
        J.FL = this.birdLeg(J.body, .085, -.04, .22, { th: .24, sh: .24, toe: .085, r: .022, upper: fea, scale: legM, talon, thighR: .07 });
        J.FR = this.birdLeg(J.body, -.085, -.04, .22, { th: .24, sh: .24, toe: .085, r: .022, upper: fea, scale: legM, talon, thighR: .07 });
        J.FL.side = 1; J.FR.side = -1;
        for (const [name, x] of [['HL', .085], ['HR', -.085]]) {
            const top = grp(J.body, x, 0, -.32);
            add(top, G.sph(.1, 10, 8), coat, 0, -.07, .01).scale.set(.75, 1.15, 1.45);
            add(top, G.cyl(.068, .046, .22, 9), coat, 0, -.11, 0);
            const knee = grp(top, 0, -.22, 0);
            add(knee, G.sph(.045, 8, 6), coat);
            add(knee, G.cyl(.044, .03, .22, 8), coat, 0, -.11, -.005).scale.z = 1.25;
            const low = grp(knee, 0, -.22, 0);
            add(low, G.sph(.03, 7, 5), coat);
            add(low, G.cyl(.03, .028, .14, 7), coat, 0, -.07, 0);
            add(low, G.sph(.048, 9, 7), light, 0, -.15, .025).scale.set(1, .55, 1.3);
            for (const cx of [-.022, 0, .022]) add(low, G.cone(.006, .03, 4), talon, cx, -.158, .075).rotation.x = Math.PI / 2 + .5;
            J[name] = { top, knee, low, side: x > 0 ? 1 : -1 };
        }
        // lion tail with a dark tuft
        J.tailRoot = grp(J.body, 0, .06, -.46);
        J.tailSeg = [];
        let p = J.tailRoot;
        for (let i = 0; i < 7; i++) {
            const g = grp(p), r0 = .028 - i * .002, r1 = .028 - (i + 1) * .002;
            add(g, G.cyl(r1, r0, .095, 7), coat, 0, -.0475, 0);
            J.tailSeg.push(g);
            p = grp(g, 0, -.095, 0);
        }
        add(p, G.sph(.04, 8, 6), mat(c.tuft, { roughness: 1 }), 0, -.02, 0).scale.set(1, 1.6, 1);
        J.wings = [1, -1].map(s => this.featherWing(J.body, s, { x: .1 * s, y: .13, z: .2, len: 1.2,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip }));
    }

    buildHarpy() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const fea = this.m(c.body), skin = mat(c.skin, { roughness: .65 }), cloth = mat(c.cloth, { roughness: .85 });
        const hairM = mat(c.hair, { roughness: .8 }), legM = mat(c.leg, { roughness: .6 }), talon = mat(0x101010, { roughness: .35 });
        J.body = grp(this.root, 0, c.hover, 0);
        // bird lower body with a skirt of feathers
        add(J.body, G.sph(.13, 12, 10), fea, 0, -.04, -.01).scale.set(1.05, 1.1, 1.15);
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU;
            const pv = grp(J.body, Math.sin(a) * .11, .03, Math.cos(a) * .1);
            pv.rotation.set(0, a + Math.PI, 0);
            const m = add(pv, featherGeo(.2, .09, c.covert, c.under, c.feather, .3), this.featherMat);
            m.rotation.x = 1.15;                                                                         // hangs down and out
        }
        J.legs = [1, -1].map(s => this.birdLeg(J.body, .075 * s, -.1, 0,
            { th: .15, sh: .22, toe: .09, r: .018, upper: fea, scale: legM, talon, thighR: .065 }));
        this.tailFan(J.body, 0, -.06, -.1, 7, .42, .09, c.tail, c.under, c.tailTip, .3);
        // woman's torso
        J.waist = grp(J.body, 0, .04, .0);
        add(J.waist, G.cyl(.095, .115, .2, 12), cloth, 0, .08, 0).scale.z = .8;                          // dress
        add(J.waist, G.cyl(.08, .095, .12, 12), skin, 0, .2, 0).scale.z = .78;                            // midriff
        add(J.waist, G.sph(.13, 14, 10), skin, 0, .32, -.005).scale.set(1.05, .82, .72);                  // ribcage / shoulders
        add(J.waist, G.cyl(.118, .1, .12, 12), cloth, 0, .3, .003).scale.z = .82;                         // breast wrap
        for (const s of [1, -1]) {
            add(J.waist, G.sph(.052, 10, 8), cloth, s * .048, .3, .06).scale.set(1, .9, .85);
            add(J.waist, G.sph(.042, 8, 6), skin, s * .125, .36, -.01);                                     // shoulders
        }
        J.neck = grp(J.waist, 0, .41, 0);
        add(J.neck, G.cyl(.036, .042, .1, 8), skin, 0, .04, 0);
        J.head = grp(J.neck, 0, .1, 0);
        const h = J.head;
        add(h, G.sph(.09, 14, 10), skin, 0, .02, .01).scale.set(.84, 1.05, .95);
        add(h, G.sph(.05, 10, 8), skin, 0, -.035, .04).scale.set(.95, .8, .9);                           // jaw line / chin
        add(h, G.sph(.014, 8, 6), skin, 0, .01, .092).scale.set(.75, 1.2, .9);                          // nose
        J.jaw = grp(h, 0, -.035, .07);
        add(J.jaw, G.sph(.017, 8, 6), mat(0x3a1010), 0, -.004, .006).scale.set(1.3, .5, .5);            // open mouth (shows on jaw)
        add(J.jaw, G.box(.026, .006, .01), mat(c.lips, { roughness: .5 }), 0, -.002, .014);               // lower lip
        add(h, G.box(.028, .005, .01), mat(c.lips, { roughness: .5 }), 0, -.029, .086);                   // upper lip
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
        // hair: cap, long locks down the back, side locks
        add(h, G.sph(.097, 14, 10, 0, TAU, 0, Math.PI * .58), hairM, 0, .035, -.008).scale.set(.9, 1.05, 1);
        J.hair = grp(h, 0, .06, -.06);
        for (const [x, l, ry] of [[0, .36, 0], [.05, .32, .25], [-.05, .32, -.25], [.08, .26, .5], [-.08, .26, -.5]]) {
            const lock = grp(J.hair, x, 0, 0);
            lock.rotation.y = ry;
            add(lock, G.sph(.05, 8, 6), hairM, 0, -l / 2, -.01).scale.set(.9, l / .1, .5);
        }
        for (const s of [1, -1]) add(h, G.sph(.03, 8, 6), hairM, s * .075, -.04, .0).scale.set(.6, 2.2, .8);
        J.wings = [1, -1].map(s => this.featherWing(J.waist, s, { x: .14 * s, y: .36, z: -.02, len: 1.15,
            feather: c.feather, under: c.under, covert: c.covert, tip: c.tip }));
    }

    buildBat() {
        const c = this.c, J = this.j, add = this.add, grp = this.grp;
        const fur = mat(c.fur, { roughness: 1 }), face = mat(c.face, { roughness: .8 }), ear = mat(c.ear, { roughness: .8, side: THREE.DoubleSide });
        const bone = mat(c.bone, { roughness: .7 }), fang = mat(0xf0ead8, { roughness: .3 }), claw = mat(0x0c0a0a, { roughness: .35 });
        const e = c.elder ? 1.15 : 1;
        J.body = grp(this.root, 0, c.hover, 0);
        add(J.body, G.sph(.1, 12, 10), fur, 0, 0, 0).scale.set(1, .95, 1.75);
        add(J.body, G.sph(.085, 10, 8), fur, 0, .01, .12).scale.set(1.15, 1.05, .9);                       // chest / shoulders
        add(J.body, G.sph(.06, 8, 6), fur, 0, .03, .19).scale.set(1.3, 1.1, 1);                           // furry ruff
        J.neck = grp(J.body, 0, .03, .2);
        J.head = grp(J.neck, 0, 0, .06);
        const h = J.head;
        h.scale.setScalar(1.3);
        add(h, G.sph(.07, 12, 10), fur, 0, 0, 0).scale.set(1, .9, 1.05);
        add(h, G.sph(.04, 10, 8), face, 0, -.015, .06).scale.set(1, .85, 1.1);                           // muzzle
        add(h, G.sph(.016, 6, 5), mat(0x140c0c), 0, -.0, .1).scale.set(1.4, .9, .7);                     // nose
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
        tg.computeVertexNormals();
        add(J.body, tg, mat(c.membrane, { roughness: .85, side: THREE.DoubleSide }));
        J.wings = [1, -1].map(s => this.batWing(J.body, s, { x: .06 * s, y: .04, z: .1, len: 1.12 * (c.elder ? 1.05 : 1), bone: c.bone,
            membrane: c.membrane, hip: [s * .07, -.05, -.2] }));
    }

    /* ---------- poses ---------- */

    makePoses() {
        const H = this.c.hover, kind = this.kind;
        const P = o => ({ ...KEYS0, ...this.BASE, ...o });
        if (kind === 'bat') {
            this.BASE = { y: H, bx: -.35, flapAmp: .9, flapRate: 2.3, flapBias: .05, neckX: 0, headX: 0, legX: .7, legK: .3, foot: .6, toe: .5, air: 1 };
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
            this.BASE = { y: H, bx: 0, waist: -.05, flapAmp: .7, flapRate: 1.1, flapBias: .2, neckX: 0, headX: 0, legX: .25, legK: .25, foot: .9, toe: .4, tailX: .75, tailFan: .5, air: 1 };
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
                neckX: .2, headX: -1.2, headY: 1.1, jaw: .4, hair: -1.2, air: 0 });
        } else if (kind === 'gryffon') {
            const G0 = this.H0;
            this.BASE = { y: G0, bx: 0, spread: 0, flapAmp: 0, flapBias: 0, flapRate: 1.5, neckX: .35, headX: 0, legX: 0, legK: 0, foot: 0, toe: .25, tailX: .8,
                FL0: .05, FL1: -.05, HL0: -.5, HL1: 1.05, HL2: -.6, air: 0 };
            this.STAND = P({});
            this.WALK = P({ neckX: .5 });
            const fly = { y: this.c.hover, bx: .2, spread: 1, flapAmp: .85, flapRate: 1.6, flapBias: .12, neckX: .9, FL0: 1.3, FL1: -1.6, toe: 1, foot: .5,
                HL0: .9, HL1: .3, HL2: .6, tailX: 1.3, air: 1 };
            this.RUN = P(fly);
            this.A1 = P({ ...fly, y: .95, bz: -.15, bx: -.65, flapBias: .35, flapAmp: .9, flapRate: 1.8, neckX: .3, headX: .2, FL0: -.7, FL1: -.6, toe: -.2, foot: .2,
                HL0: .1, HL1: .4, HL2: -.2, jaw: .3, tailX: .9 });
            this.A2 = P({ ...fly, y: .75, bz: .5, bx: .3, spread: .9, flapBias: .75, flapAmp: .08, sweep: .4, neckX: .7, headX: .2, FL0: -1.4, FL1: .2, toe: -.4, foot: -.2,
                HL0: .7, HL1: .3, HL2: .3, jaw: .7 });
            this.A3 = P({ ...fly, y: .67, bz: .55, bx: .15, flapBias: -.3, flapAmp: .15, sweep: -.2, neckX: 1.25, headX: .6, FL0: -1.0, FL1: .1, toe: 1.25, foot: .3,
                HL0: .3, HL1: .5, HL2: -.2, jaw: .05 });
            this.DEFEND = P({ y: .86, bz: -.12, bx: -.9, spread: 1, flapAmp: .25, flapBias: .4, wingX: .5, sweep: -.15, flapRate: 1.1, neckX: -.35, headX: -.1, jaw: .65, FL0: -.4, FL1: -1.0, toe: -.2, foot: .6,
                HL0: .5, HL1: .9, HL2: -.55, tailX: 1.9, air: 0 });
            this.HIT = P({ y: G0 + .05, bz: -.12, bx: -.12, spread: .35, flapBias: .5, neckX: 0, headX: -.3, jaw: .45, FL0: -.2, tailX: 1.1 });
            this.KNEEL = P({ y: .37, bz: -.1, bx: -.5, neckX: .2, FL0: -.2, FL1: .9, HL0: -1.55, HL1: 2.45, HL2: -1, tailX: 2 });
            this.LIE = P({ y: .19, bx: .02, neckX: .55, headX: .1, FL0: -1.5, FL1: .1, toe: .2, HL0: -1.35, HL1: 2.55, HL2: -2.6, tailX: 1.5 });
            this.DEAD = P({ y: .17, bx: .05, roll: .05, spread: .95, flapBias: -.06, neckX: 1.4, headX: .9, headY: 1, jaw: .4, FL0: -1.55, FL1: 0, toe: .3, HL0: 1.45, HL1: .1, HL2: .1, tailX: 1.5 });
        } else {
            this.BASE = { y: H, bx: -.3, flapAmp: .75, flapRate: .85, flapBias: .15, neckX: .5, headX: 0, legX: .5, legK: -.2, foot: .9, toe: .4, tailX: .25, tailFan: .7, air: 1 };
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
                if (this.kind === 'gryffon') {                                                           // stretches the wings now and then
                    const r = Math.max(0, Math.sin(t * .35) - .85) / .15;
                    T.spread = r * .5;
                    T.flapBias = r * .4;
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
        J.plumes.forEach((segs, j) => segs.forEach((g, i) => {
            g.rotation.x = (still ? -.02 : .12 + i * .06) + Math.sin(t * 2.2 - i * .9 + j) * (still ? .02 : .12) - (i === 0 ? p.tailX : 0) * .3;
            g.rotation.y = Math.sin(t * 1.7 - i * .7 + j * 2) * (still ? .03 : .12);
        }));
    }
}
