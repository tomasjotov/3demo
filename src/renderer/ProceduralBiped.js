import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, furTexture } from './QuadrupedRig.js';
import { makeWing, taperTube } from './creatureParts.js';

/*
 * ProceduralBiped — two-legged lizards and birds balanced over the hips: sagat (raptor with sickle claws), uth
 * (long-necked beaked runner), gauton (huge tyrant lizard, tiny arms), terrorbird (giant bird of prey, wings),
 * ghat (hunched amphibious lizard with big clawed arms). Real size; QuadrupedRig with the two hind legs only.
 *
 *   body (hips; chest forward, tail back) ├─ leg HL/HR: thigh ─ shin ─ foot (metatarsus) ─ toes (kept flat)
 *                                        ├─ arms armL/armR: upper arm ─ forearm ─ claws (or wings)
 *                                        └─ neck ─ head ─ jaw;  tail chain along -z
 *
 * States: idle, walk, run, attack (raptor / ghat: crouch → lunge with the claws → bite; uth and terrorbird: rise →
 * peck / beak strike; gauton: jaws wide → bite down → shake), defend (crouched, jaws open, arms or wings raised),
 * hit, kneel (sits down on the folded legs), lie, death (on its side).
 */

export const BIPED_VARIANTS = {
    sagat: { kind: 'raptor', skin: 0x2a3448, belly: 0xc8c4b8, dark: 0x141a26, stripe: 0xd8d8d0, feather: 0x1a2030, eye: 0xe8e0a0, scale: 1 },
    uth: { kind: 'uth', skin: 0x3e4a3a, belly: 0xd8ccb0, dark: 0x1e2620, feather: 0x26302a, beak: 0xc89a50, eye: 0xd8a030, scale: 1 },
    gauton: { kind: 'gauton', skin: 0x4a5236, belly: 0x9a9268, dark: 0x2a301e, eye: 0xd8a020, scale: 3 },
    terrorbird: { kind: 'bird', skin: 0x3a4a4e, belly: 0x8a8a76, dark: 0x1e2a2e, feather: 0x2e5a62, beak: 0xb8b090, eye: 0xd03018, scale: 3.2 },
    ghat: { kind: 'ghat', skin: 0x46584a, belly: 0xa8a47a, dark: 0x26302a, eye: 0xe0c040, scale: 1.15 }
};

// metres at scale 1: torso radius / length / chest offset, leg segments, neck, arm length, tail [n, len, radius], torso pitch
const KINDS = {
    raptor: { r: .2, len: .45, chest: .3, legX: .13, legs: [.42, .45, .3], R: .06, neck: .32, arm: .26, tail: [9, .17, .1], bx: 0 },
    uth: { r: .2, len: .35, chest: .25, legX: .12, legs: [.4, .5, .36], R: .055, neck: .62, arm: .22, tail: [7, .14, .09], bx: -.1 },
    gauton: { r: .26, len: .6, chest: .4, legX: .2, legs: [.52, .55, .3], R: .15, neck: .26, arm: .14, tail: [10, .2, .2], bx: .05 },
    bird: { r: .24, len: .35, chest: .25, legX: .14, legs: [.38, .42, .32], R: .06, neck: .42, arm: .7, tail: [3, .12, .1], bx: -.25 },
    ghat: { r: .22, len: .32, chest: .25, legX: .15, legs: [.38, .4, .26], R: .08, neck: .14, arm: .62, tail: [8, .15, .11], bx: -.3 }
};

export class ProceduralBiped extends QuadrupedRig {
    constructor(variant = 'sagat', { scale = 1 } = {}) {
        super();
        this.variant = BIPED_VARIANTS[variant] ? variant : 'sagat';
        this.c = { ...BIPED_VARIANTS[this.variant] };
        this.kind = this.c.kind;
        const D = this.D = KINDS[this.kind];
        const k = this.kind, bx = D.bx;
        // leg angles relative to the (pitched) body: thigh forward, shin back, foot forward
        const L0 = -.5 - bx, L1 = 1.1, L2 = -.85;
        const [a, b, f] = D.legs;
        const H = a * Math.cos(L0 + bx) + b * Math.cos(L0 + bx + L1) + f * Math.cos(L0 + bx + L1 + L2) + D.R * .7 + .02;
        const S = {
            ...BASE_STAND, bx, HL0: L0, HL1: L1, HL2: L2,
            neckX: k === 'uth' ? .45 : k === 'bird' ? .6 : k === 'ghat' ? 1.0 : 1.05,
            headX: k === 'uth' ? -.35 : k === 'bird' ? -.5 : k === 'ghat' ? -.95 : -1.05,
            jaw: .02, tailX: k === 'ghat' ? .55 : -.05, armX: k === 'ghat' ? .5 : .55, armK: k === 'ghat' ? -.5 : -1.1, wing: 0
        };
        this.init({ H, stand: S, legs: ['HL', 'HR'], sniff: .4, scale: this.c.scale * (scale || 1),
            gait: { walk: (a + b) * 1.9, run: (a + b) * 3.6, amp: .55, ampRun: .2, lift: .9, roll: .04 } });
        this.root.name = k;
        const P = this.pose.bind(this), crouch = { HL0: L0 - .35, HL1: L1 + .7, HL2: L2 - .4 };
        const sit = -(a + b) * .62;
        if (k === 'uth' || k === 'bird') {                                                     // rise up, then strike down with the beak
            this.A1 = P({ by: .05, bz: -.1, bx: bx - .3, neckX: S.neckX - .5, headX: S.headX - .1, jaw: .5, armX: -.3, armK: -.3, wing: 1 });
            this.A2 = P({ ...crouch, by: -.06, bz: .3, bx: bx + .35, neckX: S.neckX + 1.0, headX: S.headX - .1, jaw: .1, wing: 1 });
            this.A3 = P({ by: 0, bz: .2, bx: bx + .15, neckX: S.neckX + .4, headX: S.headX, jaw: .3, wing: .6 });
            this.DEFEND = P({ ...crouch, by: -.04, bx: bx - .1, neckX: S.neckX - .2, headX: S.headX - .1, jaw: .45, wing: 1, armX: -.4 });
        } else if (k === 'gauton') {                                                           // jaws wide → bite down → shake
            this.A1 = P({ by: .02, bz: -.1, bx: bx - .2, neckX: S.neckX - .4, headX: S.headX - .2, jaw: .9 });
            this.A2 = P({ ...crouch, by: -.05, bz: .35, bx: bx + .3, neckX: S.neckX + .3, headX: S.headX + .1, jaw: .8 });
            this.A3 = P({ by: -.02, bz: .3, bx: bx + .2, neckX: S.neckX + .2, headX: S.headX, jaw: .05, neckY: .4 });
            this.DEFEND = P({ ...crouch, by: -.03, bx: bx - .1, neckX: S.neckX - .25, headX: S.headX - .15, jaw: .85 });
        } else {                                                                               // raptor / ghat: crouch → lunge with the claws → bite
            this.A1 = P({ ...crouch, by: -.1, bz: -.08, bx: bx + .15, neckX: S.neckX + .15, headX: S.headX - .05, armX: -.2, armK: -.6 });
            this.A2 = P({ by: .05, bz: .45, bx: bx - .05, HL0: L0 + .5, HL1: L1 - .4, HL2: L2 + .2, neckX: S.neckX - .1, headX: S.headX, jaw: .8, armX: -1.3, armK: -.2 });
            this.A3 = P({ by: -.02, bz: .35, bx: bx + .1, neckX: S.neckX + .2, headX: S.headX, jaw: .05, armX: .3, armK: -1.0 });
            this.DEFEND = P({ ...crouch, by: -.06, bx: bx - .1, neckX: S.neckX - .1, headX: S.headX, jaw: .7, armX: -.9, armK: -.9, tailX: S.tailX + .1 });
        }
        this.HIT = P({ by: -.03, bz: -.1, bx: bx - .15, neckX: S.neckX - .3, headX: S.headX + .1, jaw: .35, armX: -.3 });
        const fold = { HL0: -1.5 - bx, HL1: 2.6, HL2: -2.2 };
        this.SIT = P({ ...fold, by: sit, bx: bx * .5, neckX: S.neckX, headX: S.headX, tailX: S.tailX * .3, wing: 0 });
        this.LIE = P({ ...fold, by: sit - D.r * .3, bx: 0, neckX: S.neckX + .4, headX: S.headX - .2, tailX: 0 });
        this.DEAD = P({ by: -(H - D.r * .9), bx: 0, roll: 1.45, HL0: -.6, HL1: .8, HL2: -.4, neckX: 1.6, headX: -1.4, jaw: .4, tailX: 0, armX: .2 });
        this.build();
    }

    build() {
        const c = this.c, D = this.D, J = this.j, add = this.adder(), grp = this.grp.bind(this), k = this.kind, r = D.r;
        const tex = k === 'raptor' ? furTexture('stripes', c.skin, c.stripe, { faint: true }) : null;
        const skin = tex ? mat(0xffffff, { roughness: .85, map: tex }) : mat(c.skin, { roughness: .85 });
        const belly = mat(c.belly, { roughness: .85 }), dark = mat(c.dark, { roughness: .85 });
        const claw = mat(0x1a1612, { roughness: .45 }), tooth = mat(0xf0e8d0, { roughness: .4 });
        const feather = c.feather ? mat(c.feather, { roughness: .95, side: THREE.DoubleSide }) : null;
        this.mats = { skin, belly, dark, claw, tooth, feather };

        J.body = grp(this.root, 0, this.H, 0);
        const torso = add(J.body, new THREE.CapsuleGeometry(r, D.len, 6, 12), skin, 0, 0, D.chest * .4);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(.85, 1, 1.05);
        add(J.body, G.sph(r * 1.05, 12, 9), skin, 0, -.02, D.chest).scale.set(.85, 1.05, 1);          // chest
        add(J.body, G.sph(r * .9, 12, 8), belly, 0, -r * .35, D.chest * .6).scale.set(.75, .6, 1.6);   // belly
        add(J.body, G.sph(r * 1.0, 12, 9), skin, 0, .02, -.05).scale.set(.95, .95, 1.1);               // hips
        if (feather && k !== 'bird') for (let i = 0; i < 7; i++) {                                    // feathery mane along the back
            const fe = add(J.body, G.box(.03, .12, .1), feather, 0, r * .95, D.chest + .05 - i * .1);
            fe.rotation.x = -.6;
        }
        if (k === 'bird') {                                                                            // body plumage
            for (let i = 0; i < 10; i++) add(J.body, G.sph(r * .45, 8, 6), mat(c.feather, { roughness: 1 }), (i % 2 - .5) * r * .9, r * .5 - (i % 3) * r * .2, D.chest - i * .07).scale.set(.6, .5, 1.3);
        }

        // legs
        const [la, lb, lf] = D.legs, R = D.R;
        for (const [name, s] of [['HL', 1], ['HR', -1]]) {
            const top = grp(J.body, D.legX * s, -r * .2, 0);
            add(top, G.sph(R * 2.6, 10, 8), skin, 0, -la * .25, .02).scale.set(.7, 1.4, 1.2);           // thigh
            add(top, G.cyl(R * 1.4, R * .9, la, 9), skin, 0, -la / 2, 0);
            const knee = grp(top, 0, -la, 0);
            add(knee, G.sph(R * .9, 8, 6), skin);
            add(knee, G.cyl(R * .85, R * .55, lb, 8), skin, 0, -lb / 2, 0);
            const low = grp(knee, 0, -lb, 0);
            add(low, G.sph(R * .55, 8, 6), dark);
            add(low, G.cyl(R * .5, R * .45, lf, 7), k === 'uth' || k === 'bird' ? mat(c.beak) : dark, 0, -lf / 2, 0);
            const toes = grp(low, 0, -lf, 0);
            for (const a of [-.4, 0, .4]) {
                const t = add(toes, G.cyl(R * .3, R * .22, R * 3, 6), k === 'uth' || k === 'bird' ? mat(c.beak) : dark, Math.sin(a) * R * 1.4, -R * .55, Math.cos(a) * R * 1.4);
                t.rotation.set(Math.PI / 2, 0, -a);
                add(toes, G.cone(R * .2, R * 1.0, 5), claw, Math.sin(a) * R * 2.9, -R * .6, Math.cos(a) * R * 2.9).rotation.set(Math.PI / 2 + .4, 0, -a);
            }
            if (k === 'raptor') add(toes, G.cone(R * .28, R * 1.8, 5), claw, 0, R * .4, R * .7).rotation.x = -.6;   // sickle claw raised
            J[name] = { top, knee, low, toes, hind: true, side: s, walk: s > 0 ? 0 : .5, gal: s > 0 ? 0 : .5 };
        }

        // arms (or wings)
        J.arms = [];
        if (k === 'bird') {
            this.wings = [1, -1].map(s => makeWing(J.body, s, { x: r * .7 * s, y: r * .45, z: D.chest + .05, len: D.arm * 2.2, kind: 'feather',
                color: c.dark, feather: c.feather }));
        } else for (const s of [1, -1]) {
            const big = k === 'ghat';
            const sh = grp(J.body, r * .75 * s, -r * .1, D.chest + r * .4);
            add(sh, G.sph(R * (big ? 1.8 : .9), 8, 6), skin);
            add(sh, G.cyl(R * (big ? 1.2 : .55), R * (big ? .9 : .45), D.arm * .5, 7), skin, 0, -D.arm * .25, 0);
            const el = grp(sh, 0, -D.arm * .5, 0);
            add(el, G.cyl(R * (big ? .9 : .45), R * (big ? .7 : .35), D.arm * .45, 7), skin, 0, -D.arm * .22, 0);
            const hand = grp(el, 0, -D.arm * .45, 0);
            add(hand, G.sph(R * (big ? 1.0 : .45), 7, 5), skin).scale.set(1, .6, 1.2);
            for (const a of [-.4, 0, .4]) add(hand, G.cone(R * (big ? .25 : .15), R * (big ? 1.6 : 1.1), 5), claw, Math.sin(a) * R * (big ? .7 : .35), -R * .4, R * (big ? .6 : .3)).rotation.x = Math.PI - .5;
            if (feather) for (let i = 0; i < 3; i++) add(el, G.box(.006, .14, .06), feather, 0, -D.arm * .1 - i * .05, -.04).rotation.x = .3;
            sh.rotation.z = s * .15;
            J.arms.push({ sh, el, s });
        }

        this.buildHead(add, grp);

        // tail along -z
        const [n, len, tr] = D.tail;
        J.tail = [];
        J.tailRoot = grp(J.body, 0, .02, -r * .9);
        let p = J.tailRoot;
        for (let i = 0; i < n; i++) {
            const g = grp(p), r0 = tr * (1 - i / n * .85), r1 = tr * (1 - (i + 1) / n * .85);
            const seg = add(g, G.cyl(r1, r0, len, 8), skin, 0, 0, -len / 2);
            seg.rotation.x = Math.PI / 2;
            add(g, G.sph(r0, 8, 6), skin);
            J.tail.push(g);
            p = grp(g, 0, 0, -len);
        }
        if (feather) {                                                                              // tail feather fan
            for (let i = -2; i <= 2; i++) {
                const fe = add(p, G.box(.08, .006, k === 'bird' ? .55 : .3), k === 'raptor' ? mat(c.stripe, { side: THREE.DoubleSide }) : feather, i * .04, 0, k === 'bird' ? -.22 : -.12);
                fe.rotation.y = i * .2;
            }
        }
    }

    buildHead(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, k = this.kind, r = D.r;
        const eyeMat = mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .2 }), pupil = mat(0x0a0806);
        J.eyes = [];
        J.neck = grp(J.body, 0, r * .3, D.chest + r * .6);
        const nr = k === 'gauton' ? r * .7 : k === 'ghat' ? r * .6 : r * .38;
        add(J.neck, G.cyl(nr * .75, nr, D.neck + .04, 9), M.skin, 0, D.neck / 2, 0);
        if (k === 'uth' || k === 'bird') {                                                         // feathered neck: ruff at the base, mane up the back
            const fm = mat(c.feather, { roughness: 1, side: THREE.DoubleSide });
            add(J.neck, G.sph(nr * 1.6, 10, 8), fm, 0, nr * .3, 0).scale.set(1, .8, 1);
            for (let i = 0; i < 6; i++) add(J.neck, G.box(.012, D.neck / 5, nr * 1.2), fm, 0, (i + .5) * D.neck / 6, -nr * .7).rotation.x = .25;
        }
        J.head = grp(J.neck, 0, D.neck, 0);
        const eye = (x, y, z, sz) => {
            for (const s of [1, -1]) {
                J.eyes.push(add(J.head, G.sph(sz, 8, 6), eyeMat, x * s, y, z));
                add(J.head, G.sph(sz * .5, 6, 5), pupil, x * s + s * sz * .6, y, z + sz * .2);
            }
        };
        if (k === 'uth' || k === 'bird') {                                                         // beaked head (frame: +z = beak when the head is level)
            const beak = mat(c.beak, { roughness: .45 }), big = k === 'bird';
            add(J.head, G.sph(r * (big ? .5 : .38), 10, 8), M.skin, 0, 0, 0).scale.set(.85, .9, 1.1);
            const up = add(J.head, G.cone(r * (big ? .28 : .17), r * (big ? 1.1 : .7), 8), beak, 0, -r * .02, r * (big ? .75 : .5));
            up.rotation.x = Math.PI / 2;
            up.scale.set(1, 1, big ? 1.5 : 1);
            if (big) add(J.head, G.sph(r * .12, 8, 6), beak, 0, -r * .15, r * 1.25);                 // hooked tip
            J.jaw = grp(J.head, 0, -r * .12, r * .1);
            const lo = add(J.jaw, G.cone(r * (big ? .2 : .13), r * (big ? .9 : .55), 8), beak, 0, 0, r * (big ? .5 : .35));
            lo.rotation.x = Math.PI / 2;
            lo.scale.set(1, 1, .6);
            eye(r * (big ? .3 : .25), r * .12, r * .1, r * (big ? .08 : .07));
            for (let i = 0; i < (big ? 6 : 4); i++) add(J.head, G.box(.012, r * .5, .06), mat(c.feather || c.dark, { side: THREE.DoubleSide }), 0, r * .35, -r * .15 - i * r * .12).rotation.x = -.7 - i * .1;   // crest
        } else {                                                                                   // toothy lizard head
            const big = k === 'gauton', hl = big ? r * 2.2 : k === 'ghat' ? r * 1.5 : r * 1.5, hw = big ? r * .95 : k === 'ghat' ? r * .7 : r * .55;
            add(J.head, G.sph(hw, 12, 9), M.skin, 0, hw * .1, 0).scale.set(1, .95, 1.1);              // skull
            const snout = add(J.head, G.box(hw * 1.3, hw * .7, hl), M.skin, 0, -hw * .05, hl * .45);
            snout.scale.x = .9;
            add(J.head, G.sph(hw * .5, 9, 7), M.skin, 0, 0, hl * .9).scale.set(1.2, .7, .9);
            J.jaw = grp(J.head, 0, -hw * .4, hw * .2);
            add(J.jaw, G.box(hw * 1.1, hw * .3, hl * .95), M.belly, 0, -hw * .1, hl * .4);
            const n = big ? 9 : 7;
            for (const s of [1, -1]) for (let i = 0; i < n; i++) {
                add(J.head, G.cone(hw * .05, hw * .25, 4), M.tooth, s * hw * .52, -hw * .45, hl * (.15 + .8 * i / n)).rotation.x = Math.PI;
                add(J.jaw, G.cone(hw * .045, hw * .2, 4), M.tooth, s * hw * .45, hw * .1, hl * (.05 + .8 * i / n));
            }
            eye(hw * .62, hw * .45, hw * .35, hw * .14);
            if (big) for (const s of [1, -1]) add(J.head, G.sph(hw * .25, 8, 6), M.dark, s * hw * .55, hw * .65, hw * .3).scale.set(.7, .5, 1.2);   // brow ridges
            if (k === 'ghat') for (const s of [1, -1]) {                                           // swept-back horns and frill
                add(J.head, taperTube([[0, 0, 0], [.02 * s, .05, -.1], [.04 * s, .07, -.24]], hw * .2, .005, 8, 6), M.dark, s * hw * .5, hw * .6, 0);
                const fr = add(J.head, G.cone(hw * .45, hw * 1.0, 4), M.dark, s * hw * 1.0, hw * .1, -hw * .3);
                fr.rotation.z = -s * 1.6;
                fr.scale.set(1, 1, .2);
            }
            if (k === 'raptor') for (let i = 0; i < 4; i++) add(J.head, G.box(.01, .08, .05), M.feather, 0, hw * .8, -hw * .1 - i * .05).rotation.x = -.8;
        }
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .18));
                if (p > .5) P = this.mix(P, this.A3, smooth((p - .5) / .14));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.jaw += Math.sin(t * 7) * .06;
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
        const J = this.j, n = J.tail.length;
        for (const name of ['HL', 'HR']) {                                                         // toes stay flat on the ground
            const L = J[name];
            L.toes.rotation.x = -(q.bx + L.top.rotation.x + L.knee.rotation.x + L.low.rotation.x);
        }
        for (const A of J.arms) {
            A.sh.rotation.x = q.armX + (g > .01 ? Math.sin(this.phase + (A.s > 0 ? 0 : Math.PI)) * .2 * g : 0) - q.bx;
            A.el.rotation.x = q.armK;
        }
        if (this.wings) {
            let spread = Math.max(q.wing, run * .3), flap = 0;
            if (q.wing > .5) flap = Math.sin(t * (state === 'attack' ? 7 : 3)) * .5;
            for (const w of this.wings) w.set(spread, flap * spread);
        }
        J.tailRoot.rotation.x = q.tailX - q.bx * .8;                                               // the tail balances the body
        const still = state === 'death' || state === 'lie';
        J.tail.forEach((seg, i) => {
            seg.rotation.y = Math.sin(t * 1.3 - i * .5) * (still ? .01 : .04 + .04 * g) + Math.sin(this.phase - i * .4) * .05 * g;
            seg.rotation.x = still ? 0 : .025;
        });
    }
}
