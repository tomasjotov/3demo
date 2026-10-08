import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth } from './QuadrupedRig.js';
import { haloSprite } from './LightProps.js';
import { taperTube, hornGeo, makeWing, flameTongue, flickerFlames } from './creatureParts.js';

/*
 * ProceduralHoofed — hoofed beasts without a saddle (the riding horse stays ProceduralHorse), real size.
 * Kinds (proportions, head, tail, poses): horse (drakun, nightmare, unicorn), cattle (bull, cow, fire bull,
 * undead bull), boar. The heavy ones (elephant, hippo, rhino) extend this class: ProceduralPachyderm.
 *
 * States: idle (breathing, looking around, tail swish), walk, run (gallop), attack (horse: rears up, strikes with
 * the fore hooves, bites / horn thrust; cattle and boar: head down, charge, toss the head up), defend (horse: prances
 * with the ears back; cattle and boar: head low, horns forward, pawing the ground), hit, kneel (on the fore knees),
 * lie (legs folded under the body), death (on its side). Animation: QuadrupedRig.
 */

export const HOOFED_VARIANTS = {
    drakun: { kind: 'horse', coat: 0x4a3324, dark: 0x2a1d14, mane: 0x14100c, eye: 0xe0b040, scale: 1.12, horns: 'drakun', claws: true, fangs: true, bulk: 1.12 },
    nightmare: { kind: 'horse', coat: 0x19171d, dark: 0x0c0b0e, mane: 0x09080b, eye: 0xff3018, glow: 0xff3a20, hoofGlow: 0xff4a20,
        wings: { color: 0x221c26, membrane: 0x3a2440 }, scale: 1.05 },
    unicorn: { kind: 'horse', coat: 0xf3f1ec, dark: 0xd6d2ca, mane: 0xfbf9f2, muzzle: 0xd8c8c0, hoof: 0xc8b48a, eye: 0x3a5aa0, horn: 0xf2e4b8, scale: .95 },
    bull: { kind: 'cattle', coat: 0x241e1c, dark: 0x141110, muzzle: 0x3a302c, horns: 'bull', scale: 1.05, hump: 1 },
    cow: { kind: 'cattle', coat: 0x6e4c34, dark: 0x3a2a1e, light: 0xeadfce, muzzle: 0xc89a8e, horns: 'cow', udder: true, scale: .92, hump: .4 },
    'fire-bull': { kind: 'cattle', coat: 0x2e140c, dark: 0x1c0c08, muzzle: 0x2a120a, horns: 'bull', eye: 0xffd060, glow: 0xff8a20, fire: 0xff6a18,
        scale: 1.12, hump: 1 },
    'undead-bull': { kind: 'cattle', coat: 0x6c675a, dark: 0x3a3630, muzzle: 0x58524a, horns: 'bull', eye: 0xb8ff98, glow: 0x7aff50, undead: true,
        scale: 1.32, hump: 1.1 },
    boar: { kind: 'boar', coat: 0x2c2622, dark: 0x171311, muzzle: 0x4a3c36, eye: 0x1a120c, scale: 1 }
};
const BASE = { coat: 0x7a4a2a, dark: 0x4a2e1a, mane: 0x1f1612, muzzle: 0x3a2a22, hoof: 0x2a2420, eye: 0x1a120c, scale: 1, bulk: 1, hump: 0 };

// Proportions per kind (metres at scale 1): body centre H, torso radius r and length, leg placement and segment
// lengths [upper, middle, foot] (fore: straight legs, hind: hock bent by .3 rad), leg radius R.
export const HOOFED_KINDS = {
    horse: { H: 1.22, r: .29, len: .95, legX: .15, foreZ: .52, hindZ: -.55, legY: -.1, fore: [.5, .4, .22], hind: [.52, .42, .2], R: .062,
        gait: { walk: 1.6, run: 3, amp: .38, ampRun: .42, lift: .8, roll: .02 } },
    cattle: { H: 1.0, r: .37, len: 1.0, legX: .19, foreZ: .58, hindZ: -.6, legY: -.18, fore: [.36, .3, .16], hind: [.4, .3, .14], R: .07,
        gait: { walk: 1.4, run: 2.6, amp: .32, ampRun: .38, lift: .7, roll: .03 } },
    boar: { H: .5, r: .24, len: .48, legX: .1, foreZ: .3, hindZ: -.3, legY: -.1, fore: [.17, .14, .09], hind: [.18, .14, .08], R: .036,
        gait: { walk: .7, run: 1.3, amp: .4, ampRun: .4, lift: .8, roll: .03 } }
};

export class ProceduralHoofed extends QuadrupedRig {
    constructor(variant = 'bull', { scale = 1 } = {}) {
        super();
        const V = this.constructor.VARIANTS;
        this.variant = V[variant] ? variant : Object.keys(V)[0];
        this.c = { ...BASE, ...V[this.variant] };
        this.kind = this.c.kind;
        this.D = this.constructor.KINDS[this.kind];
        const D = this.D;
        this.init({ H: D.H, stand: this.makePoses(), gait: D.gait, sniff: this.kind === 'boar' ? .9 : .5, scale: this.c.scale * (scale || 1) });
        this.root.name = this.kind;
        this.flames = [];
        this.build();
    }

    // pose tables of the kind; returns STAND, the others go to this.*
    makePoses() {
        const D = this.D, H = D.H;
        const S = { ...BASE_STAND, HL0: .3, HL1: -.3, tailX: .3 };
        const P = o => ({ ...S, ...o });
        const fold = { FL0: .15, FL1: 2.6, FL2: -.6, HL0: -1.15, HL1: 2.45, HL2: -.7, HLz: .25 };
        if (this.kind === 'horse') {
            Object.assign(S, { neckX: .78, headX: .2, tailX: .12 });
            this.A1 = P({ by: .36, bz: -.2, bx: -.8, FL0: -.35, FL1: 1.7, FL2: .2, HL0: 1.05, HL1: -.25, neckX: .2, headX: .4, jaw: .3, ear: .8, tailX: .7 });   // rear up
            this.A2 = P({ by: .02, bz: .22, bx: .08, FL0: -.55, FL1: .25, FL2: .1, HL0: .15, HL1: -.2, neckX: .7, headX: .5, jaw: .15, ear: .8 });              // strike
            this.A3 = P({ by: -.02, bz: .3, bx: .1, FL0: -.25, HL0: .1, HL1: -.2, neckX: 1.05, headX: .2, jaw: this.c.fangs ? .6 : .1, ear: .9 });               // bite / horn thrust
            this.DEFEND = P({ by: .12, bz: -.1, bx: -.28, FL0: -.2, FL1: 1.1, HL0: .55, HL1: -.3, neckX: .25, headX: .55, jaw: .2, ear: 1.1, tailX: .7 });
            this.HIT = P({ by: -.03, bz: -.1, bx: -.08, neckX: .2, headX: .45, jaw: .3, ear: .9 });
        } else {
            const boar = this.kind === 'boar';
            Object.assign(S, boar ? { neckX: 1.35, headX: -.55, tailX: .5 } : { neckX: 1.0, headX: -.1, tailX: .15 });
            this.A1 = P({ by: -.04, bz: -.08, bx: .1, FL0: -.15, FL1: .1, HL0: .45, HL1: -.2, neckX: S.neckX + .35, headX: S.headX + .35, ear: .6 });   // head down
            this.A2 = P({ by: -.02, bz: .38, bx: .12, FL0: -.45, FL1: .15, HL0: .7, HL1: -.3, neckX: S.neckX + .35, headX: S.headX + .3, ear: .6 });    // charge
            this.A3 = P({ by: .05, bz: .3, bx: -.12, FL0: -.2, HL0: .4, HL1: -.3, neckX: S.neckX - .45, headX: S.headX - .25, jaw: .2, ear: .6 });   // toss
            this.DEFEND = P({ by: -.05, bz: -.05, bx: .1, FL0: -.12, HL0: .4, HL1: -.25, neckX: S.neckX + .4, headX: S.headX + .25, ear: .8, tailX: .5 });
            this.HIT = P({ by: -.03, bz: -.1, bx: -.06, neckX: S.neckX - .4, headX: S.headX - .1, jaw: .25, ear: .8 });
        }
        const lieY = -(H - D.r * .95);
        this.KNEEL = P({ by: -(D.fore[0] + D.fore[1]) * .7, bz: .05, bx: .3, FL0: -.2, FL1: 2.5, FL2: -.4, HL0: .55, HL1: -.3, neckX: S.neckX - .1, headX: S.headX });
        this.LIE = P({ ...fold, by: lieY, neckX: S.neckX - .2, headX: S.headX + .1, tailX: .9 });
        this.DEAD = P({ by: -(H - D.r * .85), roll: 1.42, FL0: -.4, FL1: .5, FLz: .1, HL0: .55, HL1: .3, HL2: 0, neckX: S.neckX + .3, headX: S.headX - .3,
            jaw: .3, ear: .6, tailX: 1.3 });
        return S;
    }

    build() {
        const c = this.c, D = this.D, J = this.j, add = this.adder(), grp = this.grp.bind(this), k = c.bulk;
        this.m = {
            coat: mat(c.coat, { roughness: .9 }), dark: mat(c.dark, { roughness: .9 }), mane: mat(c.mane, { roughness: 1 }),
            muzzle: mat(c.muzzle, { roughness: .8 }), hoof: c.hoofGlow ? mat(c.hoof, { emissive: c.hoofGlow, emissiveIntensity: .9 }) : mat(c.hoof, { roughness: .5 }),
            bone: mat(0xddd2b4, { roughness: .75 }), horn: mat(c.horn || 0xd8ccb0, { roughness: .45 }), black: mat(0x0a0806, { roughness: .6 })
        };
        if (c.fire) this.m.coat = mat(c.coat, { roughness: .8, emissive: c.fire, emissiveIntensity: .1 });
        const M = this.m;

        J.body = grp(this.root, 0, D.H, 0);
        this.buildBody(add, grp, k);
        const legs = [['FL', D.legX, D.foreZ, false], ['FR', -D.legX, D.foreZ, false], ['HL', D.legX, D.hindZ, true], ['HR', -D.legX, D.hindZ, true]];
        for (const [name, x, z, hind] of legs) this.buildLeg(name, x * k, D.legY, z, hind, add, grp);
        this.buildHead(add, grp);
        this.buildTail(add, grp);

        if (c.wings) {                                                                       // nightmare: bat wings
            this.wings = [1, -1].map(s => makeWing(J.body, s, { x: .12 * s, y: D.r * .85, z: .3, len: 1.45, kind: 'bat', ...c.wings }));
        }
        if (c.fire) {                                                                        // fire bull: flames along the back and the head
            for (let i = 0; i < 7; i++) this.flames.push(flameTongue(J.body, (i % 2 - .5) * .12, D.r * .9, D.foreZ + .1 - i * .19, .14 + (i % 3) * .03, c.fire));
            const h = haloSprite(c.glow, 1.6, .35);
            h.position.set(0, .2, 0);
            h.raycast = () => {};
            J.body.add(h);
        }
        if (c.undead) this.buildRot(add);
    }

    buildBody(add, grp, k) {
        const c = this.c, D = this.D, J = this.j, M = this.m, r = D.r;
        const torso = add(J.body, new THREE.CapsuleGeometry(r, D.len, 6, 14), M.coat, 0, 0, -.02);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(.86 * k, 1, 1);
        add(J.body, G.sph(r * 1.05, 14, 10), M.coat, 0, .02, D.foreZ - .02).scale.set(.85 * k, 1.05, .95);   // chest
        add(J.body, G.sph(r * 1.05, 14, 10), M.coat, 0, .04, D.hindZ + .02).scale.set(.9 * k, 1, .95);       // rump
        add(J.body, G.sph(r, 12, 8), M.coat, 0, -.1, 0).scale.set(.85 * k, .8, 1.7);                          // belly
        if (this.kind === 'horse') add(J.body, G.sph(r * .5, 10, 8), M.coat, 0, r * .8, D.foreZ - .1).scale.set(.8, .8, 1.5);   // withers
        if (c.hump) add(J.body, G.sph(r * .62 * c.hump, 12, 8), M.coat, 0, r * .72, D.foreZ - .05).scale.set(.9, .7, 1.3);    // cattle hump
        if (c.light) {                                                                       // cow: white patches
            const w = mat(c.light, { roughness: .9 });
            [[.27, .05, .1, .16], [-.28, .08, -.25, .18], [.25, .1, -.45, .12], [-.26, -.05, .4, .13]].forEach(([x, y, z, s]) =>
                add(J.body, G.sph(s, 10, 8), w, x * k, y, z).scale.set(.35, 1, 1.3));
            add(J.body, G.sph(r * .7, 10, 8), w, 0, -.22, -.05).scale.set(.85, .5, 1.6);
        }
        if (c.udder) {
            const u = mat(0xd8a8a0, { roughness: .7 });
            add(J.body, G.sph(.12, 10, 8), u, 0, -r - .02, D.hindZ + .22).scale.set(1, .8, 1.1);
            for (const s of [1, -1]) for (const z of [.18, .27]) add(J.body, G.cyl(.012, .016, .06, 6), u, .04 * s, -r - .1, D.hindZ + z);
        }
        if (this.kind === 'boar') {                                                          // bristly ridge along the spine
            for (let i = 0; i < 9; i++) {
                const b = add(J.body, G.cone(.03, .12 - Math.abs(i - 3) * .01, 4), M.dark, 0, r * .92, D.foreZ + .05 - i * .08);
                b.rotation.x = -.5;
            }
        }
    }

    buildLeg(name, x, y, z, hind, add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.m;
        const [l0, l1, l2] = hind ? D.hind : D.fore, R = D.R * (hind ? 1.1 : 1) * c.bulk;
        const top = grp(J.body, x, y, z);
        add(top, G.sph(R * 2.2, 10, 8), M.coat, 0, -l0 * .2, hind ? -.03 : 0).scale.set(.7, 1.5, 1.15);     // shoulder / thigh muscle
        add(top, G.cyl(R * 1.25, R * .8, l0, 9), M.coat, 0, -l0 / 2, 0);
        const knee = grp(top, 0, -l0, 0);
        add(knee, G.sph(R * .85, 8, 6), M.coat);
        add(knee, G.cyl(R * .62, R * .56, l1, 8), c.light && this.kind === 'cattle' ? mat(c.light) : M.coat, 0, -l1 / 2, 0);
        const low = grp(knee, 0, -l1, 0);
        add(low, G.sph(R * .66, 8, 6), M.coat);                                              // fetlock
        if (c.claws) {                                                                       // drakun: clawed paw instead of a hoof
            add(low, G.cyl(R * .55, R * .6, l2 * .6, 8), M.coat, 0, -l2 * .3, 0);
            add(low, G.sph(R * 1.05, 9, 7), M.dark, 0, -l2 * .82, R * .4).scale.set(1, .6, 1.4);
            for (const cx of [-.6, 0, .6]) {
                const cl = add(low, G.cone(R * .22, R * 1.1, 5), M.bone, cx * R, -l2 * .9, R * 1.6);
                cl.rotation.x = Math.PI / 2 + .55;
            }
        } else {
            add(low, G.cyl(R * .5, R * .58, l2 * .55, 8), M.coat, 0, -l2 * .3, .01);           // pastern
            const hoofH = l2 * .42;
            if (this.kind === 'horse') {
                add(low, G.sph(R * .75, 8, 6), M.mane, 0, -l2 * .45, -R * .3).scale.set(1, 1.2, 1);      // feathering
                add(low, G.cyl(R * .66, R * .86, hoofH, 10), M.hoof, 0, -l2 + hoofH / 2, R * .12);
            } else for (const s of [1, -1]) {                                                 // cloven hoof
                const h = add(low, G.cyl(R * .38, R * .5, hoofH, 7), M.hoof, s * R * .3, -l2 + hoofH / 2, R * .15);
                h.scale.z = 1.3;
            }
        }
        J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
    }

    buildHead(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.m;
        const eyeMat = c.glow ? mat(c.eye, { emissive: c.glow, emissiveIntensity: 2.4, roughness: .2 }) : mat(c.eye, { roughness: .2 });
        const glowEye = (parent, x, y, z, size) => {
            if (!c.glow) return;
            const h = haloSprite(c.glow, size, .55);
            h.position.set(x, y, z);
            h.raycast = () => {};
            parent.add(h);
        };
        J.eyes = [];
        const ears = (x, y, z, geoFn, tilt) => {
            for (const s of [1, -1]) {
                const ear = grp(J.head, x * s, y, z);
                geoFn(ear, s);
                ear.rotation.z = -tilt * s;
                J['ear' + (s > 0 ? 'L' : 'R')] = ear;
            }
        };

        if (this.kind === 'horse') {
            J.neck = grp(J.body, 0, .16, D.foreZ + .12);
            const nk = add(J.neck, G.cyl(.12, .23, .72, 12), M.coat, 0, .32, 0);
            nk.scale.x = .72 * c.bulk;
            for (let i = 0; i < 8; i++) {                                                    // mane along the crest
                const m = add(J.neck, G.box(.05, .16, .12), M.mane, 0, .04 + i * .085, -.13 + i * .008);
                m.rotation.x = -.25;
                m.scale.y = 1 - i * .05;
            }
            J.head = grp(J.neck, 0, .68, 0);
            add(J.head, G.sph(.12, 12, 10), M.coat, 0, 0, 0).scale.set(.85, 1, 1.15);                  // skull
            add(J.head, G.sph(.11, 10, 8), M.coat, 0, -.04, .03).scale.set(.95, .9, 1);               // jowls
            const face = add(J.head, G.cyl(.075, .095, .36, 10), M.coat, 0, -.01, .2);
            face.rotation.x = Math.PI / 2;
            face.scale.set(.85, 1, 1.15);
            add(J.head, G.sph(.085, 10, 8), M.muzzle, 0, -.03, .39).scale.set(.85, .95, 1);           // muzzle
            for (const s of [1, -1]) add(J.head, G.sph(.018, 6, 5), M.black, .04 * s, -.02, .465).scale.set(.7, 1, .5);   // nostrils
            J.jaw = grp(J.head, 0, -.08, .1);
            add(J.jaw, G.box(.1, .04, .28), M.muzzle, 0, -.01, .16);
            if (c.fangs) {                                                                   // drakun: carnivore teeth
                const t = mat(0xeee6d0, { roughness: .4 });
                for (const s of [1, -1]) for (const zz of [.3, .36, .42]) {
                    add(J.head, G.cone(.011, .05, 5), t, .045 * s, -.085, zz).rotation.x = Math.PI;
                    add(J.jaw, G.cone(.01, .04, 5), t, .042 * s, .03, zz - .08);
                }
            }
            for (const s of [1, -1]) {
                const e = add(J.head, G.sph(.024, 8, 6), eyeMat, .095 * s, .04, .06);
                e.scale.set(.6, 1, 1);
                J.eyes.push(e);
                glowEye(J.head, .11 * s, .04, .07, .18);
            }
            ears(.055, .12, -.05, (ear, s) => {
                add(ear, G.cone(.035, .14, 6), M.coat, 0, .07, 0).scale.set(1, 1, .6);
            }, .2);
            add(J.head, G.cone(.045, .14, 5), M.mane, 0, .1, .02).rotation.x = .4;                    // forelock
            if (c.horn) {                                                                    // unicorn: spiral horn
                const hg = grp(J.head, 0, .12, .08);
                hg.rotation.x = .15;
                add(hg, G.cone(.03, .46, 10), M.horn, 0, .23, 0);
                for (let i = 0; i < 6; i++) add(hg, G.torus(.027 - i * .0042, .006, 4, 12), M.horn, 0, .04 + i * .065, 0).rotation.set(Math.PI / 2 + .25, 0, 0);
            }
            if (c.horns === 'drakun') {                                                      // drakun: long horns sweeping back
                for (const s of [1, -1]) {
                    const h = add(J.head, taperTube([[0, 0, 0], [.03 * s, .07, -.1], [.06 * s, .1, -.24], [.07 * s, .07, -.4]], .03, .006, 12, 7), M.horn, .05 * s, .1, -.02);
                    h.castShadow = true;
                }
            }
        } else if (this.kind === 'cattle') {
            J.neck = grp(J.body, 0, .08, D.foreZ + .2);
            add(J.neck, G.cyl(.2, .3, .4, 12), M.coat, 0, .14, 0).scale.x = .8;
            add(J.neck, G.sph(.16, 10, 8), M.coat, 0, .05, .14).scale.set(.45, 1.3, .9);               // dewlap
            J.head = grp(J.neck, 0, .36, 0);
            if (c.undead) { J.head.scale.setScalar(1.25); this.buildSkullHead(add, grp, eyeMat, glowEye); }
            else {
                add(J.head, G.sph(.15, 12, 10), M.coat, 0, .02, 0).scale.set(1.05, .95, 1);                 // forehead / poll
                const face = add(J.head, G.cyl(.09, .13, .3, 10), M.coat, 0, -.02, .18);
                face.rotation.x = Math.PI / 2;
                face.scale.set(1, 1, .9);
                add(J.head, G.sph(.1, 10, 8), M.muzzle, 0, -.04, .34).scale.set(1.1, .8, .8);               // broad muzzle
                for (const s of [1, -1]) add(J.head, G.sph(.02, 6, 5), M.black, .045 * s, -.02, .41);
                J.jaw = grp(J.head, 0, -.1, .14);
                add(J.jaw, G.box(.12, .04, .2), M.muzzle, 0, 0, .1);
                if (c.horns === 'bull' && !c.fire) add(J.head, G.torus(.03, .007, 4, 10), mat(0xc8a040, { metalness: .7, roughness: .3 }), 0, -.07, .42);   // nose ring
                for (const s of [1, -1]) {
                    const e = add(J.head, G.sph(.024, 8, 6), eyeMat, .115 * s, .03, .08);
                    J.eyes.push(e);
                    glowEye(J.head, .13 * s, .03, .09, .22);
                }
                add(J.head, G.sph(.08, 8, 6), M.dark, 0, .12, -.02).scale.set(1.4, .5, 1);                 // tuft between the horns
            }
            ears(.15, .07, -.04, (ear, s) => {
                add(ear, G.sph(.06, 8, 6), c.undead ? M.dark : M.coat, s * .04, 0, 0).scale.set(1, .45, .55);
            }, -.1);
            const hornLen = c.horns === 'cow' ? .2 : .36, hg = grp(J.head, 0, .1, -.02);
            hg.rotation.x = -.9;                                                            // horns in an upright frame (the head hangs down)
            for (const s of [1, -1]) {
                const h = add(hg, hornGeo(hornLen, c.horns === 'cow' ? .03 : .045, c.horns === 'cow' ? .9 : c.undead ? .85 : .5, c.horns === 'cow' ? .1 : c.undead ? .25 : .55), M.horn, .11 * s, 0, 0);
                h.scale.x = s;
                h.castShadow = true;
                if (c.fire) this.flames.push(flameTongue(hg, .34 * s, .2, .22, .07, c.fire));
            }
            if (c.fire) for (const s of [1, -1]) this.flames.push(flameTongue(J.head, .05 * s, .02, .42, .05, 0xffb040));   // fiery breath
        } else {                                                                             // boar: wedge head, no neck to speak of
            J.neck = grp(J.body, 0, .02, D.foreZ + .1);
            add(J.neck, G.cyl(.15, .2, .2, 10), M.coat, 0, .05, 0).scale.x = .85;
            J.head = grp(J.neck, 0, .14, 0);
            const head = add(J.head, G.cyl(.05, .15, .34, 10), M.coat, 0, 0, .14);
            head.rotation.x = Math.PI / 2;
            head.scale.set(.9, 1, 1.1);
            add(J.head, G.sph(.15, 10, 8), M.coat, 0, .02, -.02).scale.set(.9, 1, .8);
            const disc = add(J.head, G.cyl(.05, .05, .03, 12), M.muzzle, 0, -.01, .32);
            disc.rotation.x = Math.PI / 2;
            for (const s of [1, -1]) add(J.head, G.sph(.012, 6, 5), M.black, .02 * s, -.01, .336);
            J.jaw = grp(J.head, 0, -.06, .08);
            add(J.jaw, G.box(.07, .03, .18), M.muzzle, 0, 0, .1);
            for (const s of [1, -1]) {                                                       // tusks curling up from the mouth
                const t = add(J.head, taperTube([[0, 0, 0], [.02 * s, .03, .02], [.035 * s, .08, 0], [.03 * s, .11, -.03]], .016, .004, 10, 6), M.bone, .045 * s, -.05, .22);
                t.castShadow = true;
                const e = add(J.head, G.sph(.014, 7, 5), eyeMat, .07 * s, .06, .1);
                J.eyes.push(e);
            }
            ears(.08, .12, -.02, (ear, s) => {
                add(ear, G.cone(.04, .1, 5), M.coat, 0, .05, 0).scale.set(1, 1, .4);
            }, .35);
            for (let i = 0; i < 4; i++) add(J.head, G.cone(.025, .09, 4), M.dark, 0, .14, -.06 + i * .04).rotation.x = -.6;
        }
    }

    // undead bull: bare skull with green-glowing sockets
    buildSkullHead(add, grp, eyeMat, glowEye) {
        const J = this.j, M = this.m;
        add(J.head, G.sph(.14, 12, 10), M.bone, 0, .02, 0).scale.set(1.05, .9, 1);
        const face = add(J.head, G.cyl(.06, .11, .32, 8), M.bone, 0, -.02, .19);
        face.rotation.x = Math.PI / 2;
        face.scale.set(1, 1, .75);
        add(J.head, G.sph(.07, 8, 6), M.bone, 0, -.04, .35).scale.set(1.1, .7, .8);
        add(J.head, G.sph(.035, 6, 5), M.black, 0, .0, .32).scale.set(1, .8, 1.2);               // nasal hole
        J.jaw = grp(J.head, 0, -.09, .12);
        add(J.jaw, G.box(.1, .03, .26), M.bone, 0, 0, .12);
        const t = mat(0xc8bc98, { roughness: .6 });
        for (let i = 0; i < 6; i++) add(J.head, G.box(.012, .03, .012), t, (i % 2 ? 1 : -1) * .04, -.085, .2 + Math.floor(i / 2) * .05);
        for (const s of [1, -1]) {
            add(J.head, G.sph(.042, 8, 6), M.black, .09 * s, .04, .08).scale.set(.8, 1, .8);       // socket
            const e = add(J.head, G.sph(.013, 6, 5), eyeMat, .095 * s, .04, .1);
            J.eyes.push(e);
            glowEye(J.head, .1 * s, .04, .11, .16);
        }
    }

    // undead bull: exposed ribs, rotten flesh, torn hide
    buildRot(add) {
        const J = this.j, M = this.m, D = this.D;
        const flesh = mat(0x5a1c18, { roughness: .7 }), dark = mat(0x2a1210, { roughness: .8 });
        add(J.body, G.sph(.2, 10, 8), flesh, .22, -.04, .07).scale.set(.45, .95, 1.6);
        add(J.body, G.sph(.2, 10, 8), flesh, -.22, -.04, .07).scale.set(.45, .95, 1.6);
        add(J.body, G.sph(.13, 10, 8), dark, -.25, .05, -.45).scale.set(.4, .8, 1.2);
        add(J.body, G.sph(.12, 10, 8), dark, .24, .12, -.5).scale.set(.4, .7, 1.3);
        for (let i = 0; i < 6; i++) {
            for (const s of [1, -1]) add(J.body, G.torus(D.r * .93, .018, 4, 12, 1.5), M.bone, 0, -.02, .32 - i * .1).rotation.z = s > 0 ? -.75 : Math.PI - .75;
        }
        for (let i = 0; i < 5; i++) add(J.body, G.sph(.04, 6, 5), M.bone, 0, D.r * 1.0, .4 - i * .2).scale.set(.8, 1.2, 1);   // spine knobs
    }

    buildTail(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.m;
        J.tail = [];
        J.tailRoot = grp(J.body, 0, D.r * .7, D.hindZ - D.r * .9);
        let parent = J.tailRoot;
        const horse = this.kind === 'horse', boar = this.kind === 'boar';
        const n = boar ? 2 : 4, len = horse ? .17 : boar ? .06 : .16;
        for (let i = 0; i < n; i++) {
            const g = grp(parent);
            if (horse) add(g, G.cyl(.035 + (i + 1) * .014, .035 + i * .014, len + .03, 8), M.mane, 0, -len / 2, 0).scale.set(.6, 1, 1);
            else add(g, G.cyl(.012, .016, len, 6), M.coat, 0, -len / 2, 0);
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }
        if (!horse) add(parent, G.sph(boar ? .025 : .04, 7, 5), M.dark, 0, -.03, 0).scale.set(.8, 1.6, .8);   // tuft
    }

    attackPose(p) {
        let P = this.mix(this.STAND, this.A1, smooth(p / .32));
        if (p > .32) P = this.mix(P, this.A2, smooth((p - .32) / .18));
        if (p > .5) P = this.mix(P, this.A3, smooth((p - .5) / .14));
        if (p > .72) P = this.mix(P, this.STAND, smooth((p - .72) / .28));
        return P;
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                return this.attackPose(c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1);
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                if (this.kind === 'horse') {                                                 // prancing
                    P.FL1 += Math.max(0, Math.sin(t * 4)) * .6;
                    P.FRk = Math.max(0, -Math.sin(t * 4)) * .6;
                    P.by += Math.abs(Math.sin(t * 4)) * .03;
                } else {                                                                     // pawing the ground, snorting
                    const s = Math.sin(t * 3.2);
                    P.FRx = -.35 - s * .35;
                    P.FRk = .6 + s * .5;
                    P.neckY = Math.sin(t * 1.3) * .08;
                }
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.KNEEL;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return state === 'idle' ? this.idlePose() : this.STAND;
        }
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j, n = J.tail.length;
        J.tailRoot.rotation.x = q.tailX + run * .5;
        const swish = state === 'death' ? 0 : state === 'defend' ? .45 : .2;
        J.tail.forEach((seg, i) => {
            seg.rotation.z = Math.sin(t * (this.kind === 'boar' ? 6 : 1.7) - i * .7) * swish * (.4 + i / n);
            seg.rotation.x = (this.kind === 'horse' ? .12 : .05) * i * (1 - run * .5);
        });
        if (this.wings) {
            let spread = state === 'attack' || state === 'defend' ? 1 : run * .9, flap = 0;
            if (state === 'death' || state === 'lie') spread = .1;
            if (spread > .5) flap = Math.sin(t * (state === 'defend' ? 3.5 : 5)) * (state === 'attack' ? .8 : .6);
            this.wingK = (this.wingK ?? 0) + (spread - (this.wingK ?? 0)) * (1 - Math.exp(-5 * dt));
            for (const w of this.wings) w.set(this.wingK, flap * this.wingK);
        }
        if (this.flames.length) flickerFlames(this.flames, t);
    }
}
ProceduralHoofed.VARIANTS = HOOFED_VARIANTS;
ProceduralHoofed.KINDS = HOOFED_KINDS;
