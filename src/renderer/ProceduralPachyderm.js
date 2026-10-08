import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { BASE_STAND, smooth } from './QuadrupedRig.js';
import { ProceduralHoofed } from './ProceduralHoofed.js';
import { taperTube } from './creatureParts.js';

/*
 * ProceduralPachyderm — heavy beasts on column legs: elephant (trunk, tusks, fanning ears), hippopotamus
 * (huge gaping jaws), rhinoceros (two nose horns). Body, legs and the common poses come from ProceduralHoofed.
 *
 * States: idle, walk, run, attack (elephant: rises on the hind legs with the trunk up and the ears spread → stomps
 * → tusk thrust; hippo: opens the jaws wide → lunges → snaps; rhino: head down → charge → horn toss), defend
 * (elephant: ears spread, trunk up, trumpeting; hippo: gaping; rhino: head low, pawing), hit, kneel, lie, death.
 */

export const PACHYDERM_VARIANTS = {
    elephant: { kind: 'elephant', coat: 0x7a746c, dark: 0x5a554e, muzzle: 0x6e6860, hoof: 0xb8b0a0, eye: 0x1a1410, scale: 1 },
    hippopotamus: { kind: 'hippo', coat: 0x6e5e60, dark: 0x4a3e40, muzzle: 0xb08880, hoof: 0x3a3030, eye: 0x1a1210, scale: 1 },
    rhinoceros: { kind: 'rhino', coat: 0x5e5650, dark: 0x3e3832, muzzle: 0x6a625a, hoof: 0x2e2a26, horn: 0x8a7a64, eye: 0x140e0a, scale: 1 }
};

export const PACHYDERM_KINDS = {
    elephant: { H: 1.75, r: .62, len: 1.0, legX: .3, foreZ: .62, hindZ: -.6, legY: -.3, fore: [.65, .6, .2], hind: [.68, .58, .2], R: .14,
        gait: { walk: 2.4, run: 3.4, amp: .26, ampRun: .3, lift: .45, roll: .03 } },
    hippo: { H: .75, r: .5, len: .9, legX: .27, foreZ: .5, hindZ: -.5, legY: -.3, fore: [.22, .16, .07], hind: [.23, .16, .06], R: .1,
        gait: { walk: 1.0, run: 1.6, amp: .4, ampRun: .4, lift: .7, roll: .05 } },
    rhino: { H: 1.0, r: .45, len: .9, legX: .22, foreZ: .55, hindZ: -.55, legY: -.25, fore: [.36, .28, .11], hind: [.38, .27, .1], R: .09,
        gait: { walk: 1.5, run: 2.6, amp: .32, ampRun: .4, lift: .6, roll: .04 } }
};

export class ProceduralPachyderm extends ProceduralHoofed {
    makePoses() {
        const D = this.D, H = D.H, kind = this.kind;
        const S = { ...BASE_STAND, HL0: .1, HL1: -.1, tailX: .15, trunk: 0, earOut: 0 };
        const P = o => ({ ...S, ...o });
        if (kind === 'elephant') {
            Object.assign(S, { neckX: 1.4, headX: -1.25 });
            this.A1 = P({ by: .3, bz: -.25, bx: -.42, FL0: -.75, FL1: 1.2, HL0: .55, HL1: -.1, neckX: 1.1, headX: -1.25, trunk: 1, earOut: 1, jaw: .3 });
            this.A2 = P({ by: -.02, bz: .25, bx: .1, FL0: -.3, FL1: .1, HL0: .2, neckX: 1.6, headX: -1.1, trunk: -.3, earOut: .8 });
            this.A3 = P({ by: 0, bz: .3, bx: .05, FL0: -.2, neckX: 1.25, headX: -1.55, trunk: .4, earOut: .8 });
            this.DEFEND = P({ by: .02, bz: -.05, neckX: 1.15, headX: -1.25, trunk: 1, earOut: 1, jaw: .25 });
            this.HIT = P({ by: -.03, bz: -.1, bx: -.05, neckX: 1.2, headX: -1.2, trunk: .5, earOut: .6 });
        } else if (kind === 'hippo') {
            Object.assign(S, { neckX: 1.45, headX: -1.25, tailX: .3 });
            this.A1 = P({ by: .04, bz: -.08, bx: -.1, neckX: .9, headX: -1.0, jaw: 1.25, ear: .5 });
            this.A2 = P({ by: -.02, bz: .35, bx: .08, FL0: -.4, HL0: .4, neckX: 1.3, headX: -1.1, jaw: 1.1, ear: .5 });
            this.A3 = P({ by: -.03, bz: .32, bx: .1, FL0: -.3, HL0: .35, neckX: 1.55, headX: -1.3, jaw: .05, ear: .5 });
            this.DEFEND = P({ by: .02, bz: -.05, bx: -.05, neckX: .95, headX: -1.0, jaw: 1.1, ear: .6 });
            this.HIT = P({ by: -.03, bz: -.08, neckX: 1.2, headX: -1.1, jaw: .4, ear: .7 });
        } else {
            Object.assign(S, { neckX: 1.45, headX: -.85 });
            this.A1 = P({ by: -.03, bz: -.08, bx: .08, FL0: -.12, HL0: .3, neckX: 1.75, headX: -.75, ear: .6 });
            this.A2 = P({ by: -.02, bz: .4, bx: .1, FL0: -.45, FL1: .15, HL0: .55, HL1: -.2, neckX: 1.75, headX: -.75, ear: .6 });
            this.A3 = P({ by: .05, bz: .32, bx: -.12, FL0: -.2, HL0: .3, neckX: 1.05, headX: -.95, jaw: .2, ear: .6 });
            this.DEFEND = P({ by: -.04, bz: -.05, bx: .08, FL0: -.1, HL0: .3, neckX: 1.75, headX: -.8, ear: .8 });
            this.HIT = P({ by: -.03, bz: -.1, bx: -.06, neckX: 1.2, headX: -.9, jaw: .25, ear: .8 });
        }
        const lieY = -(H - D.r * .95);
        this.KNEEL = P({ by: -(D.fore[0] + D.fore[1]) * .7, bz: .05, bx: .3, FL0: -.2, FL1: 2.5, FL2: -.4, HL0: .3, HL1: -.1, neckX: S.neckX, headX: S.headX });
        this.LIE = P({ FL0: -1.35, FL1: .3, FL2: .1, HL0: 1.35, HL1: .1, HL2: .1, FLz: .15, HLz: .2, by: lieY, neckX: S.neckX + .1, headX: S.headX + .1 });
        this.DEAD = P({ by: -(H - D.r * .85), roll: 1.42, FL0: -.3, FL1: .3, FLz: .1, HL0: .3, HL1: .2, HL2: 0, neckX: S.neckX + .2, headX: S.headX,
            jaw: .3, ear: .6, tailX: 1.3 });
        return S;
    }

    buildLeg(name, x, y, z, hind, add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.m;
        const [l0, l1, l2] = hind ? D.hind : D.fore, R = D.R;
        const top = grp(J.body, x, y, z);
        add(top, G.sph(R * 1.9, 10, 8), M.coat, 0, -l0 * .15, 0).scale.set(.85, 1.4, 1.1);
        add(top, G.cyl(R * 1.15, R * .95, l0, 10), M.coat, 0, -l0 / 2, 0);
        const knee = grp(top, 0, -l0, 0);
        add(knee, G.sph(R * .98, 9, 7), M.coat);
        add(knee, G.cyl(R * .92, R * .9, l1, 10), M.coat, 0, -l1 / 2, 0);
        const low = grp(knee, 0, -l1, 0);
        if (this.kind === 'elephant') {                                                      // round column foot with toenails
            add(low, G.cyl(R * .92, R * 1.08, l2, 12), M.coat, 0, -l2 / 2, 0);
            for (const a of [-.6, -.2, .2, .6]) add(low, G.sph(R * .22, 6, 5), M.hoof, Math.sin(a) * R * 1.02, -l2 + R * .2, Math.cos(a) * R * 1.02).scale.set(1, .8, .5);
        } else {                                                                             // hippo / rhino: stubby toes
            add(low, G.cyl(R * .9, R * 1.0, l2, 10), M.coat, 0, -l2 / 2, 0);
            for (const a of [-.55, 0, .55]) add(low, G.sph(R * .32, 7, 5), M.hoof, Math.sin(a) * R * .8, -l2 + R * .25, Math.cos(a) * R * .85).scale.set(1, .75, 1);
        }
        J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
    }

    buildHead(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.m;
        const eyeMat = mat(c.eye, { roughness: .25 });
        J.eyes = [];
        if (this.kind === 'elephant') {
            J.neck = grp(J.body, 0, .12, D.foreZ + .28);
            add(J.neck, G.cyl(.36, .46, .4, 12), M.coat, 0, .12, 0).scale.x = .85;
            J.head = grp(J.neck, 0, .32, 0);
            J.head.scale.setScalar(1.15);
            add(J.head, G.sph(.44, 14, 12), M.coat, 0, .05, 0).scale.set(.95, 1.05, .95);              // dome
            add(J.head, G.sph(.3, 12, 10), M.coat, 0, -.12, .26).scale.set(.9, 1.1, .8);                 // face
            for (const s of [1, -1]) add(J.head, G.sph(.13, 10, 8), M.coat, .14 * s, .28, .14);         // forehead bulges
            J.jaw = grp(J.head, 0, -.32, .2);
            add(J.jaw, G.sph(.14, 10, 8), M.muzzle, 0, -.02, .05).scale.set(1, .6, 1.2);
            // trunk: chain hanging from the face, curls up when raised
            J.trunk = [];
            let p = grp(J.head, 0, -.2, .48);
            const n = 9;
            for (let i = 0; i < n; i++) {
                const g = grp(p), l = .17 - i * .006, r0 = .13 - i * .011, r1 = .13 - (i + 1) * .011;
                add(g, G.cyl(r1, r0, l + .02, 10), M.coat, 0, -l / 2, 0);
                if (i % 2 === 0) add(g, G.torus(r0 * .98, .008, 4, 12), M.dark, 0, -l * .3, 0).rotation.x = Math.PI / 2;   // wrinkles
                J.trunk.push(g);
                p = grp(g, 0, -l, 0);
            }
            add(p, G.cyl(.03, .035, .03, 8), M.dark, 0, -.01, 0);
            for (const s of [1, -1]) {
                const t = add(J.head, taperTube([[0, 0, 0], [.02 * s, -.18, .1], [.05 * s, -.34, .32], [.06 * s, -.34, .56]], .055, .018, 12, 8), M.bone, .17 * s, -.3, .3);
                t.castShadow = true;
                J.eyes.push(add(J.head, G.sph(.03, 8, 6), eyeMat, .3 * s, .02, .27));
                // ears: big flat flaps hinged at the front edge, fan out (earOut) and flap
                const ear = grp(J.head, .3 * s, .12, -.02);
                add(ear, G.sph(.42, 12, 10), M.coat, .02 * s, -.12, -.3).scale.set(.12, 1, .78);
                add(ear, G.sph(.36, 12, 10), M.dark, .05 * s, -.12, -.3).scale.set(.06, .9, .7);
                J['ear' + (s > 0 ? 'L' : 'R')] = ear;
            }
        } else if (this.kind === 'hippo') {
            J.neck = grp(J.body, 0, .05, D.foreZ + .2);
            add(J.neck, G.cyl(.36, .44, .3, 12), M.coat, 0, .08, 0).scale.x = .9;
            J.head = grp(J.neck, 0, .26, 0);
            add(J.head, G.sph(.32, 14, 10), M.coat, 0, .06, .05).scale.set(1, .85, 1.05);                // skull
            add(J.head, G.box(.46, .26, .44), M.coat, 0, .03, .38);                                       // upper muzzle
            for (const s of [1, -1]) add(J.head, G.sph(.18, 10, 8), M.coat, .13 * s, .03, .55).scale.set(1, .9, .8);   // muzzle lobes
            for (const s of [1, -1]) {
                add(J.head, G.sph(.045, 8, 6), M.coat, .15 * s, .3, .1);                               // eye bumps on top
                J.eyes.push(add(J.head, G.sph(.025, 8, 6), eyeMat, .17 * s, .31, .13));
                add(J.head, G.sph(.03, 6, 5), M.dark, .07 * s, .17, .64).scale.set(1, .6, 1);            // nostrils
                const ear = grp(J.head, .18 * s, .32, 0);
                add(ear, G.sph(.04, 8, 6), M.coat, 0, .03, 0).scale.set(1, 1.2, .6);
                ear.rotation.z = -.3 * s;
                J['ear' + (s > 0 ? 'L' : 'R')] = ear;
            }
            const pink = mat(0xc89088, { roughness: .6 }), tusk = mat(0xeee4c8, { roughness: .4 });
            add(J.head, G.box(.4, .02, .4), pink, 0, -.1, .4);                                           // palate (seen when gaping)
            J.jaw = grp(J.head, 0, -.1, .14);
            add(J.jaw, G.box(.44, .14, .52), M.coat, 0, -.06, .26);
            add(J.jaw, G.box(.38, .02, .46), pink, 0, .015, .27);                                        // tongue / mouth floor
            for (const s of [1, -1]) {
                for (const [x, z, h] of [[.17, .48, .16], [.1, .52, .1]]) add(J.jaw, G.cone(.026, h, 6), tusk, x * s, .01 + h / 2, z);   // lower tusks
                add(J.head, G.cone(.02, .08, 6), tusk, .16 * s, -.14, .5).rotation.x = Math.PI;
            }
        } else {                                                                             // rhino
            J.neck = grp(J.body, 0, .1, D.foreZ + .2);
            add(J.neck, G.cyl(.28, .36, .32, 12), M.coat, 0, .1, 0).scale.x = .85;
            J.head = grp(J.neck, 0, .3, 0);
            add(J.head, G.sph(.24, 12, 10), M.coat, 0, .04, 0).scale.set(.85, .95, 1.05);
            const face = add(J.head, G.cyl(.13, .2, .5, 10), M.coat, 0, 0, .3);
            face.rotation.x = Math.PI / 2;
            face.scale.set(.85, 1, 1);
            add(J.head, G.sph(.13, 10, 8), M.muzzle, 0, -.04, .55).scale.set(.9, .85, .9);
            const horn = mat(c.horn, { roughness: .6 });
            const h1 = add(J.head, taperTube([[0, 0, 0], [0, .16, .02], [0, .32, -.03], [0, .44, -.12]], .1, .012, 12, 8), horn, 0, .08, .52);
            const h2 = add(J.head, taperTube([[0, 0, 0], [0, .1, 0], [0, .18, -.04]], .07, .01, 8, 7), horn, 0, .12, .32);
            h1.castShadow = h2.castShadow = true;
            J.jaw = grp(J.head, 0, -.12, .25);
            add(J.jaw, G.box(.16, .06, .3), M.muzzle, 0, 0, .16);
            for (const s of [1, -1]) {
                J.eyes.push(add(J.head, G.sph(.022, 8, 6), eyeMat, .15 * s, .05, .22));
                const ear = grp(J.head, .12 * s, .22, -.08);
                add(ear, G.cyl(.05, .02, .16, 8), M.coat, 0, .08, 0).scale.z = .6;
                ear.rotation.z = -.35 * s;
                J['ear' + (s > 0 ? 'L' : 'R')] = ear;
            }
            add(J.body, G.sph(.16, 10, 8), M.coat, 0, D.r * .78, D.foreZ - .12).scale.set(1.2, .6, 1.4);          // shoulder hump
        }
    }

    buildTail(add, grp) {
        const D = this.D, J = this.j, M = this.m;
        J.tail = [];
        J.tailRoot = grp(J.body, 0, D.r * .6, D.hindZ - D.r * .9);
        let parent = J.tailRoot;
        const n = this.kind === 'hippo' ? 1 : 3, len = this.kind === 'hippo' ? .1 : this.kind === 'elephant' ? .26 : .16;
        for (let i = 0; i < n; i++) {
            const g = grp(parent);
            add(g, G.cyl(.02, .03, len, 6), M.coat, 0, -len / 2, 0);
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }
        if (this.kind !== 'hippo') add(parent, G.sph(.04, 7, 5), M.dark, 0, -.04, 0).scale.set(.7, 1.6, .7);
    }

    animateExtras(q, state, t, dt, g, run) {
        super.animateExtras(q, state, t, dt, g, run);
        const J = this.j;
        if (J.trunk) {                                                                       // trunk: hangs and sways, curls up (trunk 1) or tucks back (-)
            const n = J.trunk.length, up = q.trunk;
            J.trunk.forEach((seg, i) => {
                const f = i / (n - 1);
                const sway = Math.sin(t * 1.2 - i * .45) * (.05 + .05 * f) * (state === 'death' ? 0 : 1);
                seg.rotation.x = (up > 0 ? -up * (.12 + .35 * f) : -up * .15) + .06 + g * Math.sin(this.phase * 2 - i * .5) * .05 + (state === 'defend' ? Math.sin(t * 4) * .06 * f : 0);
                seg.rotation.z = sway;
            });
            const fan = q.earOut;
            for (const [ear, s] of [[J.earL, 1], [J.earR, -1]]) {
                ear.rotation.y = -s * (fan * .9 + Math.max(0, Math.sin(t * (fan > .5 ? 5 : 1.4) + s)) * (.1 + fan * .2));
            }
        }
    }
}
ProceduralPachyderm.VARIANTS = PACHYDERM_VARIANTS;
ProceduralPachyderm.KINDS = PACHYDERM_KINDS;
