import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';
import { G, mat } from '../avatar/kit.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralCanine — runtime low-poly wolf (and its kin: dire wolf, dog, hellhound, spectral wolf …), 1 grid cell.
 *
 *   root (yaw, scale)
 *   └─ body (torso centre: bob, lunge, pitch, roll)
 *      ├─ torso, chest, withers, rump, belly, back saddle, neck ruff
 *      ├─ leg FL/FR: shoulder ─ elbow ─ wrist ─ paw;  HL/HR: hip ─ stifle ─ hock ─ paw (digitigrade)
 *      ├─ neck ─ head (skull, muzzle, nose, eyes, ears, cheek ruff) ─ jaw (bite)
 *      └─ tail (4 chained bushy segments)
 *
 * Same interface as ProceduralAvatar / ProceduralHorse: `root`, `j`, `update(c, dt)`.
 * States: idle (breathing, looking around, sniffing, ear twitch, tail sway), walk (4-beat walk),
 * run (gallop), attack (crouch → lunge → bite → recover), defend (low snarl, ears flat),
 * hit (flinch), kneel (sit), lie (lying, head up), death (on its side).
 */

const TAU = Math.PI * 2;
const H = .6;                                   // torso centre above the ground (scale 1)
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

// Variants (avatar/creatures.js maps the bestiary keys to them).
export const CANINE_VARIANTS = {
    wolf: { coat: 0x80786c, dark: 0x4b453d, light: 0xd6ccba, eye: 0xd8a23a },
    'wolf-black': { coat: 0x2e2b29, dark: 0x191817, light: 0x55504a, eye: 0xd8a23a },
    direwolf: { coat: 0x5d554b, dark: 0x2f2a25, light: 0xa49884, eye: 0xe0b040, scale: 1.3, ruff: 1.25 },
    dog: { coat: 0x8a5a32, dark: 0x5a3a20, light: 0xd8c0a0, eye: 0x4a2a10, scale: .82, ruff: .6, ears: 'soft', tail: 'curl' },
    hellhound: { coat: 0x2a2220, dark: 0x120e0d, light: 0x5a3020, eye: 0xff5a1a, glow: 0xff4a10, scale: 1.2, ruff: 1.15, embers: 0xff5a14 },
    firedog: { coat: 0x3a2418, dark: 0x1a100a, light: 0x7a3a1a, eye: 0xff7a20, glow: 0xff6a10, scale: .95, embers: 0xff7a1a },
    spectral: { coat: 0xb8d4ff, dark: 0x7a98c8, light: 0xe8f2ff, eye: 0xd0f0ff, glow: 0x9fd0ff, ghost: true },
    soulhound: { coat: 0x3a4258, dark: 0x1a2030, light: 0x7080a0, eye: 0x80ffd0, glow: 0x60ffc0, ghost: true, scale: 1.15, ruff: 1.2 },
    vampirewolf: { coat: 0x1e1a1c, dark: 0x0e0c0d, light: 0x3a3236, eye: 0xff2020, glow: 0xff1010, scale: 1.15, ruff: 1.2 },
    undeadwolf: { coat: 0x6f7466, dark: 0x3a3d34, light: 0xb0ae98, eye: 0x9aff60, glow: 0x80ff40, ribs: true }
};
const BASE = { coat: 0x80786c, dark: 0x4b453d, light: 0xd6ccba, eye: 0xd8a23a, nose: 0x141210, scale: 1, ruff: 1, ears: 'pointy', tail: 'brush' };

// Standing pose; every state pose is a set of overrides of it.
const STAND = {
    by: 0, bz: 0, bx: 0, roll: 0,
    FL0: .3, FL1: -.38, FL2: -.12, FLz: 0,
    HL0: -.45, HL1: 1, HL2: -.6, HLz: 0,
    neckX: 1.05, neckY: 0, headX: -.95, headY: 0, jaw: .03, ear: 0, tailX: .28
};
const KEYS = Object.keys(STAND);
const mix = (A, B, k) => { const o = {}; for (const key of KEYS) o[key] = A[key] + (B[key] - A[key]) * k; return o; };
const pose = over => ({ ...STAND, ...over });

const CROUCH = pose({ by: -.07, bz: -.07, bx: .12, FL0: .45, FL1: -.75, FL2: .1, HL0: -.75, HL1: 1.45, HL2: -.75, neckX: 1.25, headX: -1.05, jaw: .12, ear: .5, tailX: .55 });
const LUNGE = pose({ by: .06, bz: .34, bx: -.14, FL0: -.95, FL1: .55, FL2: .25, HL0: .15, HL1: .55, HL2: -.35, neckX: 1.3, headX: -1.25, jaw: .6, ear: .35, tailX: 1.2 });
const BITE = pose({ by: .01, bz: .3, bx: .02, FL0: -.2, FL1: -.1, FL2: 0, HL0: -.2, HL1: .8, HL2: -.55, neckX: 1.25, headX: -1.05, jaw: .02, ear: .35, tailX: 1.1 });
const DEFEND = pose({ by: -.1, bz: -.04, bx: .12, FL0: .2, FL1: -.75, FL2: .25, HL0: -.85, HL1: 1.55, HL2: -.75, neckX: 1.45, headX: -1.25, jaw: .28, ear: .95, tailX: -.15 });
const HIT = pose({ by: -.02, bz: -.1, bx: -.12, FL0: .05, FL1: -.2, neckX: .65, headX: -.35, jaw: .25, ear: .8, tailX: .1 });
const SIT = pose({ by: -.2, bz: -.1, bx: -.6, FL0: .62, FL1: -.05, FL2: -.05, HL0: -1.55, HL1: 2.45, HL2: -1, HLz: .12, neckX: .8, headX: -.6, tailX: 1.35 });
const LIE = pose({ by: -.38, bz: -.02, bx: .02, FL0: -.9, FL1: -.65, FL2: .1, HL0: -1.3, HL1: 2.5, HL2: -2.6, HLz: .35, neckX: .78, headX: -.72, tailX: 1.45 });
const DEAD = pose({ by: -.47, bz: 0, roll: 1.45, FL0: -.35, FL1: .05, FL2: .05, FLz: .1, HL0: .35, HL1: .25, HL2: 0, neckX: 1.65, headX: -1.25, jaw: .3, ear: .6, tailX: 1.5 });

export class ProceduralCanine {
    constructor(variant = 'wolf', { scale = 1 } = {}) {
        this.variant = CANINE_VARIANTS[variant] ? variant : 'wolf';
        this.c = { ...BASE, ...CANINE_VARIANTS[this.variant] };
        this.size = this.c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.name = 'canine';
        this.root.scale.setScalar(this.size);
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.yaw = null;
        this.gait = 0;
        this.state = null;
        this.stateTime = 0;
        this.p = { ...STAND };
        this.sniff = 0; this.sniffing = false; this.sniffTimer = 3 + Math.random() * 4;
        this.ear = 0; this.earTimer = 1;
        this.look = 0; this.lookTimer = 2;
        this.build();
    }

    build() {
        const c = this.c, J = this.j;
        const ghost = c.ghost ? { transparent: true, opacity: .58, emissive: c.coat, emissiveIntensity: .35 } : {};
        const coat = mat(c.coat, { roughness: .95, ...ghost }), dark = mat(c.dark, { roughness: .95, ...ghost });
        const light = mat(c.light, { roughness: .95, ...ghost }), nose = mat(c.nose, { roughness: .35, ...ghost });
        const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
            const mesh = new THREE.Mesh(geo, m);
            mesh.position.set(x, y, z);
            mesh.castShadow = !c.ghost;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };
        const grp = (parent, x = 0, y = 0, z = 0) => {
            const g = new THREE.Group();
            g.position.set(x, y, z);
            parent.add(g);
            return g;
        };

        J.body = grp(this.root, 0, H, 0);

        // --- trunk ----------------------------------------------------------------
        const torso = add(J.body, new THREE.CapsuleGeometry(.15, .42, 6, 12), coat, 0, 0, -.02);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(.82, 1, 1.08);                                                   // x = width, z = height
        add(J.body, G.sph(.18, 14, 10), coat, 0, -.03, .21).scale.set(.84, 1.15, 1.05);  // deep chest
        add(J.body, G.sph(.12, 12, 8), coat, 0, .09, .19).scale.set(.95, .8, 1.1);       // withers
        add(J.body, G.sph(.14, 12, 9), coat, 0, .03, -.27).scale.set(.92, 1, 1);         // rump
        add(J.body, G.sph(.13, 12, 8), light, 0, -.1, .0).scale.set(.68, .45, 1.75);     // belly / underside
        add(J.body, G.sph(.1, 12, 8), light, 0, -.07, .32).scale.set(.78, .95, .5);        // pale chest bib
        const r = c.ruff;
        add(J.body, G.sph(.125, 12, 9), coat, 0, .07, .3).scale.set(1.05 * r, 1.05 * r, .95);    // neck ruff
        for (const s of [1, -1]) {                                                       // ruff tufts
            const tuft = add(J.body, G.cone(.04 * r, .12 * r, 5), coat, .09 * s, .0, .33);
            tuft.rotation.set(.9, 0, 1.2 * s);
        }
        if (c.ribs) {                                                                    // undead: ribs showing through
            for (let i = 0; i < 4; i++) {
                const rib = add(J.body, G.torus(.135, .01, 4, 10, 2.2), mat(c.light), 0, -.01, .12 - i * .07);
                rib.rotation.set(0, 0, Math.PI / 2 - 1.1);
            }
        }

        // --- legs -------------------------------------------------------------------
        const legDef = [['FL', .085, -.02, .24, false], ['FR', -.085, -.02, .24, false],
            ['HL', .09, .03, -.27, true], ['HR', -.09, .03, -.27, true]];
        for (const [name, x, y, z, hind] of legDef) {
            const top = grp(J.body, x, y, z);
            let knee, low;
            if (hind) {
                add(top, G.sph(.1, 10, 8), coat, 0, -.07, .01).scale.set(.72, 1.4, 1.15);       // thigh muscle
                add(top, G.cyl(.07, .048, .25, 8), coat, 0, -.125, 0);
                knee = grp(top, 0, -.25, 0);                                                   // stifle
                add(knee, G.sph(.045, 8, 6), coat);
                add(knee, G.cyl(.046, .03, .25, 7), coat, 0, -.125, -.005).scale.z = 1.25;
                low = grp(knee, 0, -.25, 0);                                                   // hock
                add(low, G.sph(.03, 7, 5), dark);
                add(low, G.cyl(.028, .024, .17, 7), dark, 0, -.085, 0);
                add(low, G.sph(.04, 8, 6), dark, 0, -.175, .02).scale.set(1, .55, 1.45);       // paw
            } else {
                add(top, G.sph(.08, 10, 8), coat, 0, -.04, 0).scale.set(.7, 1.4, 1.05);         // shoulder
                add(top, G.cyl(.066, .045, .25, 8), coat, 0, -.125, 0);
                knee = grp(top, 0, -.25, 0);                                                   // elbow
                add(knee, G.sph(.042, 8, 6), coat);
                add(knee, G.cyl(.04, .03, .23, 7), coat, 0, -.115, 0);
                low = grp(knee, 0, -.23, 0);                                                   // wrist
                add(low, G.sph(.028, 7, 5), dark);
                add(low, G.cyl(.03, .027, .08, 7), dark, 0, -.04, 0);
                add(low, G.sph(.04, 8, 6), dark, 0, -.088, .018).scale.set(1, .55, 1.45);      // paw
            }
            J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
        }

        // --- neck & head ---------------------------------------------------------------
        J.neck = grp(J.body, 0, .1, .3);
        add(J.neck, G.cyl(.075, .115, .28, 10), coat, 0, .13, 0).scale.z = .9;
        add(J.neck, G.sph(.09, 10, 8), light, 0, .1, .05).scale.set(.85, 1.3, .6);           // throat
        J.head = grp(J.neck, 0, .27, 0);
        J.head.scale.setScalar(1.15);
        add(J.head, G.sph(.085, 12, 9), coat, 0, 0, 0).scale.set(.95, .85, 1.08);           // skull
        for (const s of [1, -1]) add(J.head, G.sph(.055, 8, 6), light, .052 * s, -.03, -.01).scale.set(.8, .9, 1.1);   // cheek ruff
        const muzzle = add(J.head, G.cyl(.03, .05, .15, 9), coat, 0, -.022, .105);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.scale.set(.92, 1, .85);
        add(J.head, G.cyl(.02, .035, .11, 8), dark, 0, .0, .1).rotation.x = Math.PI / 2 + .25;   // nose bridge
        add(J.head, G.sph(.022, 8, 6), nose, 0, -.008, .18).scale.set(1.1, .85, .9);            // nose
        J.jaw = grp(J.head, 0, -.05, .025);
        add(J.jaw, G.box(.055, .022, .14), light, 0, 0, .065);
        const tooth = mat(0xf2ead8, { roughness: .4 });
        for (const s of [1, -1]) {                                                       // fangs, seen when the jaw opens
            add(J.head, G.cone(.007, .028, 5), tooth, .018 * s, -.052, .155).rotation.x = Math.PI;
            add(J.jaw, G.cone(.006, .022, 5), tooth, .016 * s, .018, .12);
        }
        const eyeMat = c.glow
            ? mat(c.eye, { emissive: c.glow, emissiveIntensity: 2.2, roughness: .2 })
            : mat(c.eye, { roughness: .2 });
        J.eyes = [];
        for (const s of [1, -1]) {
            const eye = add(J.head, G.sph(.014, 8, 6), eyeMat, .04 * s, .022, .065);
            eye.scale.set(.75, .8, .6);
            J.eyes.push(eye);
            if (c.glow) {
                const h = haloSprite(c.glow, .09, .55);
                h.position.set(.04 * s, .022, .075);
                h.raycast = () => {};
                J.head.add(h);
            }
            const ear = grp(J.head, .045 * s, .065, -.025);
            if (c.ears === 'soft') {
                add(ear, G.box(.05, .085, .018), dark, .012 * s, -.02, 0).rotation.z = 1.2 * s;   // floppy ear
            } else {
                add(ear, G.cone(.032, .085, 4), coat, 0, .04, 0).scale.set(1, 1, .45);
                add(ear, G.cone(.02, .06, 4), dark, 0, .035, .006).scale.set(1, 1, .3);
            }
            ear.rotation.z = -.22 * s;
            J['ear' + (s > 0 ? 'L' : 'R')] = ear;
        }

        // --- tail ------------------------------------------------------------------------
        J.tail = [];
        let parent = grp(J.body, 0, .06, -.38);
        J.tailRoot = parent;
        const segs = c.tail === 'curl'
            ? [[.025, .03, .1, coat], [.03, .028, .1, coat], [.028, .02, .09, coat], [.02, .012, .07, light]]
            : [[.032, .05, .12, coat], [.05, .065, .13, coat], [.065, .055, .13, coat], [.055, .018, .12, dark]];
        for (const [rt, rb, len, m] of segs) {
            const g = grp(parent, 0, 0, 0);
            add(g, G.cyl(rt, rb, len, 8), m, 0, -len / 2, 0).scale.z = .85;
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }

        // embers rising from a hellhound
        if (c.embers) {
            const m = new THREE.MeshBasicMaterial({ color: c.embers, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
            this.embers = [];
            for (let i = 0; i < 7; i++) {
                const e = new THREE.Mesh(G.sph(.012, 5, 4), m);
                e.userData = { x: (Math.random() - .5) * .22, z: (Math.random() - .5) * .6, t: Math.random() };
                e.raycast = () => {};
                J.body.add(e);
                this.embers.push(e);
            }
        }
    }

    // Target pose of the current state (without the locomotion cycle).
    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = mix(STAND, CROUCH, smooth(p / .28));
                if (p > .28) P = mix(P, LUNGE, smooth((p - .28) / .22));
                if (p > .5) P = mix(P, BITE, smooth((p - .5) / .12));
                if (p > .62 && p < .78) P.neckY = Math.sin((p - .62) * 80) * .18;          // shake the prey
                if (p > .74) P = mix(P, STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...DEFEND };
                P.jaw += Math.sin(t * 9) * .04;                                          // snarl
                P.bz += Math.sin(t * 2.1) * .02;
                return P;
            }
            case 'hit': return HIT;
            case 'kneel': return SIT;
            case 'lie': return LIE;
            case 'death': return DEAD;
            default: {
                const P = { ...STAND };
                if (state === 'idle') {
                    P.neckX += this.sniff * .7;
                    P.headX += this.sniff * .35;
                    P.neckY = this.look * .45 * (1 - this.sniff);
                    P.headY = this.look * .35;
                    P.by += Math.sin(t * 1.6) * .004;
                }
                return P;
            }
        }
    }

    update(c, dt) {
        this.time += dt;
        const t = this.time, J = this.j;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;

        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 6, dt);
        if (target > 0) {
            const stride = (target === 2 ? 1.9 : 1.05) * this.size;                      // m per full cycle
            const speed = (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) : 1);
            this.phase += dt * speed / stride * TAU;
        }

        // idle behaviour: sniff the ground, look around, twitch the ears
        if (state === 'idle') {
            this.sniffTimer -= dt;
            if (this.sniffTimer <= 0) {
                this.sniffing = !this.sniffing;
                this.sniffTimer = this.sniffing ? 1.5 + Math.random() * 2 : 3 + Math.random() * 5;
            }
            this.lookTimer -= dt;
            if (this.lookTimer <= 0) { this.lookTarget = (Math.random() - .5) * 2; this.lookTimer = 1.5 + Math.random() * 3; }
        } else this.sniffing = false;
        this.sniff = damp(this.sniff, this.sniffing ? 1 : 0, 3, dt);
        this.look = damp(this.look, state === 'idle' ? (this.lookTarget || 0) : 0, 2.5, dt);
        this.earTimer -= dt;
        if (this.earTimer <= 0) { this.ear = (Math.random() - .5) * 1.2; this.earTimer = .7 + Math.random() * 2.5; }

        // state pose, eased (fast for attacks / hits, slow when collapsing)
        const P = this.statePose(state, c, t);
        const k = state === 'attack' ? 40 : state === 'hit' ? 18 : state === 'death' ? 3.5 : state === 'lie' || state === 'kneel' ? 4 : 9;
        for (const key of KEYS) this.p[key] = damp(this.p[key], P[key], k, dt);
        const q = { ...this.p };

        // --- locomotion: 4-beat walk blending into a rotary gallop --------------------------
        const g = Math.min(1, this.gait), run = Math.max(0, this.gait - 1);
        if (g > .001) {
            const walkOff = { HL: 0, FL: .25, HR: .5, FR: .75 };
            const galOff = { HL: 0, HR: .1, FL: .48, FR: .58 };
            for (const name of ['FL', 'FR', 'HL', 'HR']) {
                const off = walkOff[name] * (1 - run) + galOff[name] * run;
                const ph = this.phase + off * TAU;
                const s = Math.sin(ph), co = Math.cos(ph);
                const amp = (.4 + run * .35) * g;
                const lift = smooth(Math.max(0, co)) * g * (.85 + run * .6);
                const L = J[name], hind = L.hind;
                const base = hind ? ['HL0', 'HL1', 'HL2'] : ['FL0', 'FL1', 'FL2'];
                L.top.rotation.x = q[base[0]] - s * amp;
                L.knee.rotation.x = q[base[1]] + (hind ? lift * .7 : lift * 1.1);
                L.low.rotation.x = q[base[2]] + (hind ? -lift * .55 : lift * .55);
                L.top.rotation.z = (hind ? q.HLz : q.FLz) * L.side;
            }
            q.by += run > 0 ? Math.abs(Math.sin(this.phase)) * .06 * run : Math.sin(this.phase * 2) * .012 * g;
            q.bx += Math.sin(this.phase) * .1 * run + Math.sin(this.phase * 2) * .015 * g * (1 - run);
            q.neckX += -Math.sin(this.phase) * .08 * run - .2 * run + Math.sin(this.phase * 2) * .05 * g * (1 - run);
            q.headX += .15 * run;
            q.tailX += g * .3 + run * .35;
            q.roll += Math.sin(this.phase) * .02 * g * (1 - run);
        } else {
            for (const name of ['FL', 'FR', 'HL', 'HR']) {
                const L = J[name], b = L.hind ? 'HL' : 'FL';
                L.top.rotation.x = q[b + '0'];
                L.knee.rotation.x = q[b + '1'];
                L.low.rotation.x = q[b + '2'];
                L.top.rotation.z = q[b + 'z'] * L.side;
            }
        }

        // --- body, head, ears, tail -------------------------------------------------------------
        J.body.position.set(0, H + q.by, q.bz);
        J.body.rotation.set(q.bx, 0, q.roll);
        J.neck.rotation.set(q.neckX, q.neckY, 0);
        J.head.rotation.set(q.headX, q.headY, 0);
        J.jaw.rotation.x = q.jaw + (this.sniffing ? Math.max(0, Math.sin(t * 14)) * .03 : 0);
        const flat = q.ear;
        J.earL.rotation.x = damp(J.earL.rotation.x, -flat - (this.ear > 0 ? this.ear * .6 : 0), 10, dt);
        J.earR.rotation.x = damp(J.earR.rotation.x, -flat - (this.ear < 0 ? -this.ear * .6 : 0), 10, dt);
        const wagAmp = state === 'idle' ? .16 : state === 'walk' ? .22 : state === 'run' ? .1 : state === 'death' ? 0 : .06;
        const wagF = state === 'idle' ? 1.8 : 5;
        J.tailRoot.rotation.x = q.tailX;
        J.tail.forEach((seg, i) => {
            seg.rotation.z = Math.sin(t * wagF - i * .7) * wagAmp * (1 + i * .35);
            seg.rotation.x = i ? (this.c.tail === 'curl' ? -.55 : .1 - g * .16) : 0;
        });

        if (this.embers) {
            for (const e of this.embers) {
                const u = e.userData;
                u.t = (u.t + dt * .7) % 1;
                e.position.set(u.x + Math.sin(t * 3 + u.z * 9) * .02, .1 + u.t * .45, u.z);
                e.material.opacity = Math.sin(u.t * Math.PI) * .9;
            }
        }

        // --- facing -------------------------------------------------------------------------------
        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }
}
