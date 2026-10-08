import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, furTexture } from './QuadrupedRig.js';
import { taperTube } from './creatureParts.js';

/*
 * ProceduralReptile — low reptiles on sprawled legs: crocodile, giant crocodile, giant eft (salamander), dragon
 * turtle (spiked shell), basilisk (eight legs, rooster head); karialis (armoured, spiked club tail) walks on upright
 * legs. The body and tail sway sideways as the legs move (sprawled legs swing around the vertical axis).
 *
 *   leg: top (rotation.y swing, rotation.z splay out from the body) ─ knee (rotation.z bends the shin down) ─ low (foot)
 *
 * States: idle (breathing, slow tail sway, the head turns), walk, run, attack (jaws open, lunge, snap with a twist;
 * karialis swings the club tail), defend (open jaws hiss, tail curled), hit, kneel / lie (flat on the belly),
 * death (on its back). Animation: QuadrupedRig.
 */

export const REPTILE_VARIANTS = {
    crocodile: { kind: 'croc', skin: 0x4a5a34, belly: 0xb0a878, dark: 0x2e3a22, eye: 0xd8c040, scale: 1 },
    'giant-crocodille': { kind: 'croc', skin: 0x3e4a30, belly: 0xa09868, dark: 0x262e1c, eye: 0xe0b030, scale: 2.3 },
    'giant-eft': { kind: 'eft', skin: 0xd8401c, belly: 0xf0a040, dark: 0x1a1210, eye: 0xf0d040, spots: true, scale: 1.5 },
    karialis: { kind: 'karialis', skin: 0x6e6252, belly: 0x9a8e78, dark: 0x4a4034, plate: 0x8a5a38, eye: 0x1a1410, scale: 1.25 },
    'dragon-turtle': { kind: 'turtle', skin: 0x5a6a5e, belly: 0xb8b090, dark: 0x3a4438, shell: 0x6a6e78, spike: 0xc8c4bc, eye: 0xe0a020, scale: 1.9 },
    basilisk: { kind: 'basilisk', skin: 0x3e6a34, belly: 0xc8b860, dark: 0x22401c, comb: 0xc02018, beak: 0xd8b040, eye: 0xf0e040, scale: 1.3 }
};

// metres at scale 1: body radius / length / flattening, legs (x, fore z, hind z, upper, lower, radius, splay),
// tail (segments, segment length, base radius), neck length
const KINDS = {
    croc: { r: .2, len: .9, flat: .62, legX: .16, legZ: [.36, -.4], up: .18, low: .17, R: .045, splay: 1.25, tail: [11, .15, .11], neck: .12 },
    eft: { r: .15, len: .7, flat: .7, legX: .13, legZ: [.3, -.3], up: .13, low: .12, R: .035, splay: 1.25, tail: [9, .11, .09], neck: .06 },
    karialis: { r: .5, len: 1.1, flat: .85, legX: .32, legZ: [.55, -.55], up: .45, low: .42, R: .11, splay: .15, tail: [8, .24, .26], neck: .2 },
    turtle: { r: .5, len: .55, flat: .55, legX: .4, legZ: [.42, -.4], up: .25, low: .22, R: .1, splay: 1.15, tail: [3, .1, .1], neck: .3 },
    basilisk: { r: .17, len: 1.1, flat: .75, legX: .14, legZ: [.5, .17, -.17, -.5], up: .16, low: .16, R: .035, splay: 1.2, tail: [12, .14, .11], neck: .25 }
};

export class ProceduralReptile extends QuadrupedRig {
    constructor(variant = 'crocodile', { scale = 1 } = {}) {
        super();
        this.variant = REPTILE_VARIANTS[variant] ? variant : 'crocodile';
        this.c = { ...REPTILE_VARIANTS[this.variant] };
        this.kind = this.c.kind;
        const D = this.D = KINDS[this.kind];
        const H = D.up * Math.cos(D.splay) + D.low + .04;
        const legs = this.kind === 'basilisk' ? ['FL', 'FR', 'M1L', 'M1R', 'M2L', 'M2R', 'HL', 'HR'] : ['FL', 'FR', 'HL', 'HR'];
        const upright = this.kind === 'karialis';
        const S = {
            ...BASE_STAND, FLz: D.splay, HLz: D.splay, FL1: D.splay, HL1: D.splay, FL2: 0, HL2: 0,
            neckX: 1.5, headX: -1.5, jaw: .02, tailX: -.22
        };
        if (upright) Object.assign(S, { FL1: .15, HL1: .15, HL0: .05, tailX: .02 });
        this.init({ H, stand: S, legs, sniff: .3, scale: this.c.scale * (scale || 1),
            gait: { walk: D.up * 4.5, run: D.up * 7, amp: upright ? .35 : .45, ampRun: .2, lift: upright ? .6 : .5, roll: .01 } });
        this.root.name = this.kind;
        this.upright = upright;
        const P = this.pose.bind(this), lie = -(H - D.r * D.flat * .9);
        const spread = { FLz: D.splay + .25, HLz: D.splay + .25, FL1: D.splay - .3, HL1: D.splay - .3, FL0: -.5, HL0: .6 };
        this.A1 = P({ by: .04, bz: -.06, bx: -.15, neckX: .95, headX: -1.3, jaw: .65, tailX: .1 });         // jaws wide, head up
        this.A2 = P({ by: .02, bz: .35, bx: -.04, FL0: -.4, HL0: .5, neckX: 1.2, headX: -1.4, jaw: .65 });        // lunge
        this.A3 = P({ by: 0, bz: .3, roll: .35, FL0: -.3, HL0: .4, neckX: 1.6, headX: -1.55, jaw: .05 });        // snap with a twist
        this.DEFEND = P({ by: .03, bx: -.1, neckX: 1.1, headX: -1.35, jaw: .6, tailX: .0 });
        this.HIT = P({ by: -.02, bz: -.08, bx: -.06, neckX: 1.35, headX: -1.4, jaw: .3 });
        this.LIE = P({ ...spread, by: lie, neckX: 1.55, headX: -1.5 });
        this.DEAD = P({ by: lie + D.r * D.flat * .3, roll: Math.PI - .25, FLz: .6, HLz: .6, FL1: .9, HL1: .9, FL0: -.4, HL0: .4, neckX: 1.5, headX: -1.3, jaw: .4 });
        if (upright) {                                                                         // karialis: club-tail swing instead of a lunge
            this.A1 = P({ by: -.03, bz: -.05, roll: -.08, neckX: 1.4, headX: -1.45, tailX: .2 });
            this.A2 = P({ by: -.02, bz: -.02, roll: .1, neckX: 1.35, headX: -1.4, jaw: .5, tailX: .3 });
            this.A3 = P({ by: -.02, bz: .05, roll: .02, neckX: 1.5, headX: -1.5, jaw: .1, tailX: .1 });
            this.DEFEND = P({ by: -.06, FL1: .45, HL1: .45, FL0: -.2, HL0: .25, neckX: 1.6, headX: -1.5, tailX: .25 });
            this.LIE = P({ by: -(H - D.r * D.flat * .95), FL0: -1.2, FL1: .3, HL0: 1.3, HL1: .1, FLz: .3, HLz: .3, neckX: 1.6, headX: -1.5 });
            this.DEAD = P({ by: -(H - D.r * .8), roll: 1.45, FL0: -.3, FL1: .3, HL0: .3, HL1: .2, neckX: 1.6, headX: -1.4, jaw: .3 });
        }
        this.build();
    }

    build() {
        const c = this.c, D = this.D, J = this.j, add = this.adder(), grp = this.grp.bind(this), kind = this.kind;
        const tex = c.spots ? furTexture('spots', c.skin, c.dark) : null;
        const skin = tex ? mat(0xffffff, { roughness: .45, map: tex }) : mat(c.skin, { roughness: .85 });
        const belly = mat(c.belly, { roughness: .8 }), dark = mat(c.dark, { roughness: .85 });
        const claw = mat(0x2a2620, { roughness: .5 }), tooth = mat(0xf0e8d0, { roughness: .4 });
        this.mats = { skin, belly, dark, claw, tooth };
        const r = D.r, f = D.flat;

        J.body = grp(this.root, 0, this.H, 0);
        const torso = add(J.body, new THREE.CapsuleGeometry(r, D.len, 6, 14), skin, 0, 0, 0);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(1, 1, f);                                                               // (rotated: z = height)
        add(J.body, G.sph(r * .95, 12, 8), belly, 0, -r * f * .35, 0).scale.set(.9, .45, (D.len / r + 2) * .45);
        if (kind === 'croc' || kind === 'basilisk') {                                           // scutes / crest along the back
            for (let i = 0; i < 10; i++) {
                const z = D.len / 2 + r * .5 - i * (D.len + r) / 9;
                for (const s of kind === 'croc' ? [1, -1] : [0]) add(J.body, G.cone(r * .12, r * .22, 4), dark, s * r * .3, r * f * .95, z);
            }
        }
        if (kind === 'karialis') this.buildArmour(add);
        if (kind === 'turtle') this.buildShell(add);

        // legs
        const zs = D.legZ, names = this.legNames;
        names.forEach((name, i) => {
            const pair = Math.floor(i / 2), side = i % 2 === 0 ? 1 : -1, hind = pair === zs.length - 1 && zs.length > 1 && pair > 0;
            const z = zs[pair];
            const top = grp(J.body, D.legX * side, -r * f * .25, z);
            top.rotation.order = 'YZX';
            add(top, G.sph(D.R * 1.6, 9, 7), skin, 0, -D.up * .2, 0).scale.set(1, 1.3, 1.1);
            add(top, G.cyl(D.R * 1.1, D.R * .85, D.up, 8), skin, 0, -D.up / 2, 0);
            const knee = grp(top, 0, -D.up, 0);
            add(knee, G.sph(D.R * .9, 8, 6), skin);
            add(knee, G.cyl(D.R * .8, D.R * .7, D.low, 8), skin, 0, -D.low / 2, 0);
            const low = grp(knee, 0, -D.low, 0);
            if (kind === 'karialis' || kind === 'turtle') {                                    // stumpy elephant-like foot
                add(low, G.cyl(D.R * .9, D.R * 1.05, D.R * .6, 10), skin, 0, -.02, 0);
                for (const a of [-.6, 0, .6]) add(low, G.cone(D.R * .2, D.R * .6, 5), claw, Math.sin(a) * D.R * .8, -.04, Math.cos(a) * D.R * 1.0).rotation.x = Math.PI / 2;
            } else {                                                                            // splayed toes
                add(low, G.sph(D.R * .9, 8, 6), skin, 0, -.01, D.R * .5).scale.set(1.2, .4, 1.3);
                for (const a of [-.7, -.25, .25, .7]) {
                    const t = add(low, G.cone(D.R * .2, D.R * 1.4, 4), kind === 'eft' ? skin : claw, Math.sin(a) * D.R * 1.2, -.015, D.R * .6 + Math.cos(a) * D.R * 1.1);
                    t.rotation.set(Math.PI / 2, 0, -a);
                }
            }
            const L = { top, knee, low, hind: z < 0, side, key: z < 0 ? 'HL' : 'FL' };
            if (names.length > 4) { L.walk = (pair * .25 + (side < 0 ? .5 : 0)) % 1; L.gal = L.walk; }
            J[name] = L;
        });

        this.buildHead(add, grp);

        // tail along -z: segments sway sideways
        const [n, len, tr] = D.tail;
        J.tail = [];
        J.tailRoot = grp(J.body, 0, kind === 'turtle' ? -r * f * .3 : 0, -D.len / 2 - r * .6);
        let p = J.tailRoot;
        for (let i = 0; i < n; i++) {
            const g = grp(p), r0 = tr * (1 - i / n) * (kind === 'turtle' ? .6 : 1), r1 = tr * (1 - (i + 1) / n) * (kind === 'turtle' ? .6 : 1);
            const seg = add(g, G.cyl(Math.max(.006, r1), r0, len, 8), skin, 0, 0, -len / 2);
            seg.rotation.x = Math.PI / 2;
            const sq = kind === 'croc' || kind === 'eft' ? [.7, 1.15] : [1, 1];                 // flattened sideways (croc, eft)
            seg.scale.set(sq[0], 1, sq[1]);
            add(g, G.sph(r0, 8, 6), skin).scale.set(sq[0], sq[1], 1);                            // rounded joint
            if (kind === 'croc' && i % 2 === 0) for (const s of [1, -1]) add(g, G.cone(r0 * .2, r0 * .45, 4), dark, s * r0 * .25, r0 * 1.0, -len / 2);
            if (kind === 'karialis' && i > 1 && i < n - 1) for (const s of [1, -1]) {
                const sp = add(g, G.cone(r0 * .2, r0 * .9, 5), this.mats.spike, s * r0 * .8, r0 * .3, -len / 2);
                sp.rotation.z = -s * 1.2;
            }
            J.tail.push(g);
            p = grp(g, 0, 0, -len);
        }
        if (kind === 'karialis') {                                                              // bony club
            add(p, G.sph(tr * .8, 10, 8), this.mats.plate, 0, 0, -tr * .5).scale.set(1.3, .8, 1.1);
            for (const s of [1, -1]) add(p, G.cone(tr * .2, tr * .6, 5), this.mats.spike, s * tr * 1.1, 0, -tr * .5).rotation.z = -s * Math.PI / 2;
        }
    }

    buildArmour(add) {
        const c = this.c, D = this.D, J = this.j, r = D.r, f = D.flat;
        const plate = mat(c.plate, { roughness: .7 }), spike = mat(0xd8ccb0, { roughness: .5 });
        this.mats.plate = plate; this.mats.spike = spike;
        for (let i = 0; i < 9; i++) {                                                           // tall back plates, alternating
            const z = D.len / 2 + r * .3 - i * (D.len + r * .6) / 8, h = r * (.45 + .35 * Math.sin(Math.PI * (i + .5) / 9));
            const pl = add(J.body, G.cone(h * .55, h, 4), plate, (i % 2 - .5) * r * .2, r * f + h * .35, z);
            pl.scale.set(.25, 1, 1);
        }
        for (const s of [1, -1]) for (let i = 0; i < 5; i++) {                                // side spikes
            const sp = add(J.body, G.cone(r * .08, r * .35, 5), spike, s * r * .92, r * f * .1, D.len / 2 - i * D.len / 4);
            sp.rotation.z = -s * 1.35;
        }
        for (let i = 0; i < 18; i++) {                                                          // armour knobs
            const a = (i % 6) / 5 * 2.4 - 1.2, z = D.len / 2 - Math.floor(i / 6) * D.len / 2;
            add(J.body, G.sph(r * .1, 6, 5), this.mats.dark, Math.sin(a) * r * .95, Math.cos(a) * r * f * .95, z).scale.set(1, .5, 1);
        }
    }

    buildShell(add) {
        const c = this.c, D = this.D, J = this.j, r = D.r;
        const shell = mat(c.shell, { roughness: .7 }), spike = mat(c.spike, { roughness: .5 }), dark = this.mats.dark;
        this.mats.spike = spike;
        const dome = add(J.body, G.sph(r * 1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, -r * .15, 0);
        dome.scale.set(1, .62, 1.2);
        add(J.body, G.cyl(r * 1.55, r * 1.5, r * .12, 18), dark, 0, -r * .15, 0).scale.set(1, 1, 1.2);       // rim
        add(J.body, G.cyl(r * 1.3, r * 1.3, r * .08, 16), this.mats.belly, 0, -r * .32, 0).scale.set(1, 1, 1.15);   // plastron
        for (let ring = 0; ring < 3; ring++) {                                                  // spikes in rings on the dome
            const n = ring === 0 ? 1 : ring * 6, rad = ring * .45 * r, h = r * (.42 - ring * .08);
            for (let i = 0; i < n; i++) {
                const a = i / n * Math.PI * 2 + ring * .3, x = Math.sin(a) * rad, z = Math.cos(a) * rad * 1.2;
                const y = -r * .15 + r * 1.55 * .62 * Math.sqrt(Math.max(0, 1 - (rad / (r * 1.55)) ** 2));
                const sp = add(J.body, G.cone(r * .12, h, 5), spike, x, y + h * .3, z);
                sp.rotation.set(Math.cos(a) * ring * .35, 0, -Math.sin(a) * ring * .35);
            }
        }
        for (let i = 0; i < 12; i++) {                                                          // rim spikes
            const a = i / 12 * Math.PI * 2, sp = add(J.body, G.cone(r * .08, r * .3, 5), spike, Math.sin(a) * r * 1.58, -r * .15, Math.cos(a) * r * 1.85);
            sp.rotation.set(Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4);
        }
    }

    buildHead(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, kind = this.kind, r = D.r;
        const eyeMat = mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .15 }), pupil = mat(0x0a0806);
        J.eyes = [];
        J.neck = grp(J.body, 0, kind === 'turtle' ? -r * .05 : 0, D.len / 2 + r * (kind === 'turtle' ? 1.1 : .6));
        const nr = kind === 'turtle' ? .55 : 1;
        add(J.neck, G.cyl(r * .45 * nr, r * .62 * nr, D.neck + .04, 10), M.skin, 0, D.neck / 2, 0).scale.z = kind === 'croc' ? .7 : 1;
        J.head = grp(J.neck, 0, D.neck, 0);
        const eye = (x, y, z, s, sz) => {
            const e = add(J.head, G.sph(sz, 8, 6), eyeMat, x * s, y, z);
            add(J.head, G.box(sz * .3, sz * 1.2, sz * .3), pupil, x * s + s * sz * .7, y, z + sz * .1);
            J.eyes.push(e);
        };
        if (kind === 'croc') {                                                                  // long flat snout, interlocking teeth
            const sn = r * 2.3;
            add(J.head, G.box(r * .95, r * .45, r * .7), M.skin, 0, r * .05, r * .2);
            const up = add(J.head, G.box(r * .8, r * .24, sn), M.skin, 0, 0, r * .4 + sn / 2);
            up.scale.x = 1;
            add(J.head, G.sph(r * .22, 8, 6), M.skin, 0, r * .06, r * .4 + sn).scale.set(1.3, .7, 1);          // nose knob
            J.jaw = grp(J.head, 0, -r * .12, r * .3);
            add(J.jaw, G.box(r * .76, r * .16, sn + r * .1), M.belly, 0, -r * .02, sn / 2 + r * .1);
            for (const s of [1, -1]) for (let i = 0; i < 8; i++) {
                add(J.head, G.cone(r * .035, r * .14, 4), M.tooth, s * r * .38, -r * .15, r * .5 + i * sn / 8).rotation.x = Math.PI;
                add(J.jaw, G.cone(r * .03, r * .12, 4), M.tooth, s * r * .36, r * .1, r * .3 + i * sn / 8);
                if (i === 0) eye(r * .3, r * .32, r * .22, s, r * .1);
            }
        } else if (kind === 'eft') {                                                            // round blunt head, wide mouth
            add(J.head, G.sph(r * .9, 12, 9), M.skin, 0, r * .05, r * .5).scale.set(1.1, .6, 1.2);
            J.jaw = grp(J.head, 0, -r * .15, 0);
            add(J.jaw, G.sph(r * .85, 12, 8), M.belly, 0, -r * .05, r * .5).scale.set(1.05, .35, 1.15);
            for (const s of [1, -1]) eye(r * .5, r * .45, r * .6, s, r * .17);
        } else if (kind === 'karialis') {                                                       // small beaked head
            add(J.head, G.sph(r * .45, 10, 8), M.skin, 0, 0, r * .2).scale.set(.9, .8, 1.2);
            add(J.head, G.cone(r * .25, r * .5, 8), M.dark, 0, -r * .05, r * .7).rotation.x = Math.PI / 2;
            J.jaw = grp(J.head, 0, -r * .2, r * .2);
            add(J.jaw, G.box(r * .3, r * .1, r * .5), M.skin, 0, 0, r * .25);
            for (const s of [1, -1]) eye(r * .3, r * .15, r * .35, s, r * .06);
        } else if (kind === 'turtle') {                                                         // big head with a hooked beak and fangs
            add(J.head, G.sph(r * .48, 12, 9), M.skin, 0, 0, r * .25).scale.set(1, .85, 1.15);
            const beak = add(J.head, G.cone(r * .3, r * .38, 8), mat(0x3a3a30, { roughness: .5 }), 0, -r * .02, r * .75);
            beak.rotation.x = Math.PI / 2 + .3;
            J.jaw = grp(J.head, 0, -r * .2, r * .2);
            add(J.jaw, G.box(r * .5, r * .14, r * .6), M.belly, 0, 0, r * .3);
            for (const s of [1, -1]) for (let i = 0; i < 3; i++) add(J.head, G.cone(r * .05, r * .18, 4), M.tooth, s * r * .2, -r * .2, r * .5 + i * r * .1).rotation.x = Math.PI;
            for (const s of [1, -1]) eye(r * .35, r * .18, r * .45, s, r * .09);
            for (let i = 0; i < 5; i++) add(J.head, G.cone(r * .06, r * .2, 4), M.spike, (i - 2) * r * .12, r * .38, r * .1 - Math.abs(i - 2) * r * .05).rotation.x = -.4;
        } else {                                                                                // basilisk: rooster head
            const comb = mat(c.comb, { roughness: .6 }), beakM = mat(c.beak, { roughness: .4 });
            add(J.head, G.sph(r * .75, 12, 9), M.skin, 0, r * .1, r * .3).scale.set(.9, 1, 1.1);
            const beak = add(J.head, G.cone(r * .3, r * .7, 8), beakM, 0, -r * .05, r * 1.15);
            beak.rotation.x = Math.PI / 2 + .25;
            J.jaw = grp(J.head, 0, -r * .2, r * .8);
            const lowB = add(J.jaw, G.cone(r * .22, r * .45, 8), beakM, 0, 0, r * .2);
            lowB.rotation.x = Math.PI / 2 - .15;
            for (let i = 0; i < 5; i++) add(J.head, G.sph(r * (.3 - Math.abs(i - 1.5) * .05), 8, 6), comb, 0, r * .85 + Math.sin(i * 1.2) * r * .06, r * .7 - i * r * .3).scale.set(.3, 1, .7);
            for (const s of [1, -1]) add(J.jaw, G.sph(r * .2, 8, 6), comb, s * r * .1, -r * .25, r * .05).scale.set(.5, 1.3, .7);   // wattles
            for (const s of [1, -1]) eye(r * .5, r * .4, r * .6, s, r * .22);                // bulging hypnotic eyes
            for (let i = 0; i < 6; i++) {                                                      // neck feathers
                const fe = add(J.neck, G.cone(r * .2, r * .5, 4), comb, Math.sin(i) * r * .3, D.neck * .6, -r * .3 + Math.cos(i) * r * .2);
                fe.rotation.x = -2.2;
            }
        }
    }

    // sprawled legs: swing around the vertical axis, splay out, knee bends the shin down
    applyLeg(L, a0, a1, a2, z, lift) {
        if (this.upright) return super.applyLeg(L, a0, a1, a2, z);
        L.top.rotation.y = a0 * L.side;
        L.top.rotation.z = (z + lift * .5) * L.side;
        L.knee.rotation.z = -(a1 + lift * .3) * L.side;
        L.low.rotation.x = a2;
        L.low.rotation.z = (a1 - z) * L.side;                                                  // keep the foot flat
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .18));
                if (p > .5) P = this.mix(P, this.A3, smooth((p - .5) / .12));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                this.club = this.upright ? Math.sin(Math.min(1, p / .6) * Math.PI) : 0;
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.jaw += Math.sin(t * 6) * .05;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return state === 'idle' ? this.idlePose() : this.STAND;
        }
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j, n = J.tail.length;
        if (state !== 'attack') this.club = 0;
        const wave = this.upright ? 0 : Math.sin(this.phase) * .14 * g;                     // body S-wave of a sprawling walker
        J.body.rotation.y = wave;
        J.neck.rotation.y = q.neckY - wave * 1.2;
        J.tailRoot.rotation.x = q.tailX;
        const still = state === 'death' || state === 'lie' || state === 'kneel';
        const curl = state === 'defend' ? .12 : 0;
        J.tail.forEach((seg, i) => {
            const f = i / n;
            seg.rotation.y = -Math.sin(this.phase - i * .5) * .12 * g + Math.sin(t * .9 - i * .4) * (still ? .01 : .04) + curl + this.club * 1.2 / n * (1 + f);
            seg.rotation.x = this.kind === 'turtle' ? .2 : this.upright ? -.01 : state === 'death' ? -.02 : i < 3 ? .06 : .01;   // drags on the ground
        });
    }
}
