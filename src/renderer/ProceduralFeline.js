import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, furTexture, furMat } from './QuadrupedRig.js';
import { makeWing, scorpionTail, hornGeo } from './creatureParts.js';

/*
 * ProceduralFeline — big cats (lion, tiger, leopard, sabre-toothed tiger), 1 grid cell (bigger by scale).
 * Long supple body, deep chest, round head with a short muzzle, round ears, long tail (lion: tuft, tiger: rings).
 * Fur pattern from a canvas texture (tiger stripes, leopard rosettes), lion mane, sabre fangs.
 *
 * States: idle (breathing, looking around, tail tip flicks), walk, run (bounding gallop), attack (crouch,
 * rump wiggle → pounce with fore-paws reaching → bite), defend (low crouch, ears flat, hiss, right paw raised),
 * hit, kneel (sit), lie (sphinx pose), death (on its side). Animation: QuadrupedRig.
 */

export const FELINE_VARIANTS = {
    lion: { coat: 0xc49a5c, light: 0xe8d2a6, dark: 0x7a5530, mane: 0x6e4622, maneLight: 0x9a6a34, eye: 0xd8a030, scale: 1.25, tuft: true },
    lioness: { coat: 0xc8a066, light: 0xecd8b0, dark: 0x7a5530, eye: 0xd8a030, scale: 1.12, tuft: true },
    tiger: { coat: 0xd8782a, light: 0xf2ead8, dark: 0x2a1a10, ink: 0x1a1210, pattern: 'stripes', eye: 0xe0c040, scale: 1.3, earSpot: true },
    leopard: { coat: 0xd8b060, light: 0xf0e2c0, dark: 0x3a2a18, ink: 0x2a1e14, inner: 0xb88a40, pattern: 'spots', eye: 0xc8d050, scale: 1.0 },
    sabretooth: { coat: 0x75644f, light: 0xb0a088, dark: 0x3a3026, ink: 0x3a3028, pattern: 'stripes', faint: true, eye: 0xe0a030,
        scale: 1.42, sabre: true, bulk: 1.15, tail: 'short' },
    // lion-bodied composites
    chimera: { coat: 0xb08a50, light: 0xd8c098, dark: 0x6a4a28, mane: 0x3a2818, maneLight: 0x5a3e24, eye: 0xd89030, scale: 1.4,
        goat: { coat: 0xe2dccc, horn: 0x8a7a62 }, tail: 'snake', snake: 0x4a6a30 },
    manticore: { coat: 0xa86a3c, light: 0xd8a878, dark: 0x5a3018, mane: 0x4a2414, maneLight: 0x6a3a1e, eye: 0xe06020, scale: 1.3,
        wings: { kind: 'bat', color: 0x4a1e18, membrane: 0x8a2a1c }, tail: 'scorpion', sting: 0x6a3a22 },
    sphinx: { coat: 0xd0a868, light: 0xecd8b0, dark: 0x8a6a3a, eye: 0x3a2a1a, scale: 1.4, human: { skin: 0xc8946a, cloth: 0x2a4a8a, gold: 0xd8b040 },
        wings: { kind: 'feather', color: 0x9a7a4a, feather: 0xd8b878 }, tuft: true }
};
const BASE = { coat: 0xc49a5c, light: 0xe8d2a6, dark: 0x7a5530, nose: 0x5a3430, eye: 0xd8a030, scale: 1, bulk: 1, tail: 'long' };

const H = .5;
const TAIL_CURVE = [-.15, -.15, -.08, .25, .35, .42, .4];       // hangs down, the tip curls up and back
const STAND = {
    ...BASE_STAND,
    FL0: .22, FL1: -.3, FL2: -.1, HL0: -.5, HL1: 1.05, HL2: -.62,
    neckX: 1.2, headX: -1.15, jaw: .02, tailX: .55
};

export class ProceduralFeline extends QuadrupedRig {
    constructor(variant = 'lion', { scale = 1 } = {}) {
        super();
        this.variant = FELINE_VARIANTS[variant] ? variant : 'lion';
        this.c = { ...BASE, ...FELINE_VARIANTS[this.variant] };
        this.init({ H, stand: STAND, gait: { walk: 1.15, run: 2.3, amp: .38, ampRun: .45, roll: .03, galOff: { HL: 0, HR: .06, FL: .5, FR: .56 } },
            sniff: .25, scale: this.c.scale * (scale || 1) });
        this.root.name = 'feline';
        const P = this.pose.bind(this);
        this.CROUCH = P({ by: -.12, bz: -.1, bx: .1, FL0: .55, FL1: -.95, FL2: .3, HL0: -.8, HL1: 1.6, HL2: -.85, neckX: 1.45, headX: -1.35, ear: .4, tailX: .2 });
        this.POUNCE = P({ by: .14, bz: .42, bx: -.28, FL0: -1.35, FL1: .3, FL2: .55, HL0: .35, HL1: .45, HL2: -.25, neckX: 1.15, headX: -1.05, jaw: .55, ear: .5, tailX: .9 });
        this.BITE = P({ by: -.02, bz: .32, bx: .1, FL0: -.55, FL1: -.2, FL2: .25, HL0: -.35, HL1: 1, HL2: -.6, neckX: 1.35, headX: -1.25, jaw: .05, ear: .5, tailX: .7 });
        this.DEFEND = P({ by: -.1, bz: -.06, bx: .06, FL0: .45, FL1: -.85, FL2: .25, HL0: -.85, HL1: 1.6, HL2: -.8, FRx: -1.0, FRk: .9,
            neckX: 1.4, headX: -1.2, jaw: .42, ear: 1.1, tailX: .1 });
        this.HIT = P({ by: -.03, bz: -.1, bx: -.1, neckX: .75, headX: -.55, jaw: .3, ear: .9 });
        this.SIT = P({ by: -.17, bz: -.1, bx: -.55, FL0: .58, FL1: -.05, FL2: -.05, HL0: -1.6, HL1: 2.5, HL2: -1, HLz: .1, neckX: .75, headX: -.55, tailX: 1.45 });
        this.LIE = P({ by: -.36, bz: 0, bx: .02, FL0: -1.15, FL1: -.3, FL2: .1, HL0: -1.35, HL1: 2.55, HL2: -2.6, HLz: .3, neckX: .8, headX: -.75, tailX: 1.5 });
        this.DEAD = P({ by: -.44, roll: 1.45, FL0: -.4, FL1: .1, FLz: .1, HL0: .3, HL1: .3, HL2: 0, neckX: 1.6, headX: -1.2, jaw: .35, ear: .6, tailX: 1.5 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j, add = this.adder(), grp = this.grp.bind(this), k = c.bulk;
        const tex = c.pattern ? furTexture(c.pattern, c.coat, c.ink, { light: c.inner ?? null, faint: !!c.faint }) : null;
        const coat = furMat(c.coat, tex), plain = mat(c.coat, { roughness: .95 });
        const light = mat(c.light, { roughness: .95 }), dark = mat(c.dark, { roughness: .9 }), nose = mat(c.nose, { roughness: .4 });
        const claw = mat(0xe8e0d0, { roughness: .4 });
        const along = m => { m.rotation.x = Math.PI / 2; return m; };         // pattern rings run around the body axis

        J.body = grp(this.root, 0, H, 0);
        const torso = along(add(J.body, new THREE.CapsuleGeometry(.14 * k, .56, 6, 14), coat, 0, 0, -.03));
        torso.scale.set(.8, 1, 1);
        along(add(J.body, G.sph(.17 * k, 14, 10), coat, 0, -.02, .22)).scale.set(.84, 1.05, 1.12);    // deep chest
        along(add(J.body, G.sph(.145 * k, 12, 9), coat, 0, .02, -.3)).scale.set(.88, 1.05, .98);       // haunches
        for (const s of [1, -1]) add(J.body, G.sph(.05 * k, 8, 6), coat, .075 * s, .085, .2).scale.set(.8, .7, 1.4);  // shoulder blades
        add(J.body, G.sph(.13, 12, 8), light, 0, -.1, .02).scale.set(.66 * k, .42, 1.95);               // belly
        add(J.body, G.sph(.1, 10, 8), light, 0, -.06, .32).scale.set(.8 * k, .95, .5);                    // chest bib

        // legs: strong fore-legs with big round paws, digitigrade hind legs
        const legDef = [['FL', .085, -.03, .24, false], ['FR', -.085, -.03, .24, false], ['HL', .085, .0, -.32, true], ['HR', -.085, .0, -.32, true]];
        for (const [name, x, y, z, hind] of legDef) {
            const top = grp(J.body, x * k, y, z);
            let knee, low;
            if (hind) {
                along(add(top, G.sph(.1 * k, 10, 8), coat, 0, -.07, .01)).scale.set(.7, 1.15, 1.45);
                add(top, G.cyl(.068 * k, .046 * k, .22, 9), coat, 0, -.11, 0);
                knee = grp(top, 0, -.22, 0);
                add(knee, G.sph(.045 * k, 8, 6), coat);
                add(knee, G.cyl(.044 * k, .03 * k, .22, 8), coat, 0, -.11, -.005).scale.z = 1.25;
                low = grp(knee, 0, -.22, 0);
                add(low, G.sph(.03 * k, 7, 5), plain);
                add(low, G.cyl(.03 * k, .028 * k, .15, 7), coat, 0, -.075, 0);
                add(low, G.sph(.048 * k, 9, 7), light, 0, -.16, .025).scale.set(1, .55, 1.3);
            } else {
                add(top, G.sph(.085 * k, 10, 8), coat, 0, -.04, 0).scale.set(.72, 1.4, 1.05);
                add(top, G.cyl(.072 * k, .05 * k, .22, 9), coat, 0, -.11, 0);
                knee = grp(top, 0, -.22, 0);
                add(knee, G.sph(.046 * k, 8, 6), coat);
                add(knee, G.cyl(.046 * k, .038 * k, .19, 8), coat, 0, -.095, 0);
                low = grp(knee, 0, -.19, 0);
                add(low, G.sph(.036 * k, 8, 6), coat);
                add(low, G.cyl(.036 * k, .034 * k, .06, 8), coat, 0, -.03, 0);
                add(low, G.sph(.056 * k, 10, 7), light, 0, -.075, .03).scale.set(1, .5, 1.25);   // big round paw
            }
            for (const cx of [-.022, 0, .022]) {                                                  // claws
                const cl = add(low, G.cone(.006, .03, 4), claw, cx * k, hind ? -.168 : -.083, (hind ? .075 : .085) * k);
                cl.rotation.x = Math.PI / 2 + .5;
            }
            J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
        }

        // neck & head: round skull, short muzzle with whisker pads, round ears
        J.neck = grp(J.body, 0, .06, .31);
        add(J.neck, G.cyl(.08 * k, .115 * k, .24, 10), coat, 0, .11, 0).scale.z = .9;
        add(J.neck, G.sph(.085, 10, 8), light, 0, .08, .05).scale.set(.85 * k, 1.25, .6);
        J.head = grp(J.neck, 0, .23, 0);
        if (c.human) this.buildHumanHead(add, grp);
        else {
            J.head.scale.setScalar(1.2 * (c.sabre ? 1.08 : 1));
            add(J.head, G.sph(.09, 14, 10), plain, 0, .005, -.005).scale.set(1.02, .9, 1);
            add(J.head, G.sph(.06, 10, 8), plain, 0, .04, .045).scale.set(1, .6, 1);                     // brow
            for (const s of [1, -1]) {
                add(J.head, G.sph(.036, 9, 7), light, .027 * s, -.03, .083).scale.set(1, .85, .85);     // whisker pads
                add(J.head, G.sph(.04, 8, 6), plain, .06 * s, -.02, .03).scale.set(.8, 1, 1.1);          // cheeks
            }
            add(J.head, G.box(.04, .03, .05), plain, 0, .0, .085).rotation.x = .35;                       // nose bridge
            add(J.head, G.sph(.019, 8, 6), nose, 0, -.008, .118).scale.set(1.3, .75, .7);                 // nose pad
            J.jaw = grp(J.head, 0, -.05, .03);
            add(J.jaw, G.sph(.04, 8, 6), light, 0, -.008, .04).scale.set(1, .5, 1.25);                     // chin
            const tooth = mat(0xf2ead8, { roughness: .4 });
            for (const s of [1, -1]) {
                if (c.sabre) {
                    const f = add(J.head, G.cone(.011, .11, 6), tooth, .02 * s, -.09, .095);
                    f.rotation.set(Math.PI - .12, 0, 0);
                } else add(J.head, G.cone(.007, .03, 5), tooth, .02 * s, -.056, .1).rotation.x = Math.PI;
                add(J.jaw, G.cone(.006, .022, 5), tooth, .018 * s, .012, .07);
            }
            const eyeMat = mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .15 }), slit = mat(0x0a0806);
            J.eyes = [];
            for (const s of [1, -1]) {
                const eye = add(J.head, G.sph(.016, 8, 6), eyeMat, .036 * s, .025, .07);
                eye.scale.set(1, .75, .55);
                add(J.head, G.box(.004, .016, .004), slit, .036 * s, .025, .079);
                J.eyes.push(eye);
                const ear = grp(J.head, .055 * s, .07, -.01);
                add(ear, G.sph(.032, 8, 6), plain, 0, .02, 0).scale.set(1, 1, .35);
                add(ear, G.sph(.022, 8, 6), c.earSpot ? mat(0x141010) : dark, 0, .02, -.006).scale.set(1, 1, .3);
                ear.rotation.z = -.35 * s;
                J['ear' + (s > 0 ? 'L' : 'R')] = ear;
            }
        }

        // lion mane: around the head, down the neck and the chest
        if (c.mane) {
            const mane = mat(c.mane, { roughness: 1 }), mane2 = mat(c.maneLight, { roughness: 1 });
            add(J.head, G.sph(.13, 12, 10), mane, 0, -.01, -.05).scale.set(1.12, 1.2, .85);
            for (let i = 0; i < 14; i++) {                                                          // shaggy tufts around the face
                const a = i / 14 * Math.PI * 2;
                const tuft = add(J.head, G.cone(.05, .08, 5), i % 2 ? mane : mane2, Math.cos(a) * .125, Math.sin(a) * .135 - .02, -.05);
                tuft.rotation.set(-.6, 0, a - Math.PI / 2);
            }
            add(J.neck, G.sph(.15, 12, 9), mane, 0, .1, -.01).scale.set(1.05 * k, 1.2, 1.1);
            add(J.body, G.sph(.13, 10, 8), mane2, 0, -.06, .3).scale.set(.85, 1.1, .7);              // chest mane
        }

        // tail: long S-curve (lion tuft, ringed tiger tip) or short bob (sabretooth)
        J.tail = [];
        let parent = grp(J.body, 0, .07, -.47);
        J.tailRoot = parent;
        this.buildExtras(add, grp, k);
        if (c.tail === 'snake' || c.tail === 'scorpion') return;
        const n = c.tail === 'short' ? 3 : 7, len = c.tail === 'short' ? .075 : .095;
        for (let i = 0; i < n; i++) {
            const g = grp(parent, 0, 0, 0);
            const r0 = (.03 - i * .0022) * k, r1 = (.03 - (i + 1) * .0022) * k;
            add(g, G.cyl(r1, r0, len, 7), i === n - 1 && c.pattern === 'stripes' && !c.faint ? dark : coat, 0, -len / 2, 0);
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }
        if (c.tuft) add(parent, G.sph(.035, 8, 6), mat(c.mane || c.dark, { roughness: 1 }), 0, -.015, 0).scale.set(1, 1.5, 1);
    }

    // composites: goat head on the back + snake tail (chimera), wings, scorpion tail (manticore)
    buildExtras(add, grp, k) {
        const c = this.c, J = this.j;
        if (c.wings) this.wings = [1, -1].map(s => makeWing(J.body, s, { x: .07 * s, y: .12, z: .16, len: c.wings.kind === 'bat' ? .78 : .8, ...c.wings }));
        if (c.goat) {
            const coat = mat(c.goat.coat, { roughness: 1 }), horn = mat(c.goat.horn, { roughness: .5 });
            J.goat = grp(J.body, 0, .12, .05);
            J.goat.rotation.x = .35;
            add(J.goat, G.cyl(.04, .06, .26, 8), coat, 0, .12, 0);
            const head = grp(J.goat, 0, .26, 0);
            head.rotation.x = .9;
            J.goatHead = head;
            add(head, G.sph(.055, 10, 8), coat, 0, 0, 0).scale.set(.85, .9, 1.1);
            const muz = add(head, G.cyl(.028, .04, .1, 8), coat, 0, -.01, .07);
            muz.rotation.x = Math.PI / 2;
            add(head, G.cone(.02, .07, 5), coat, 0, -.06, .05).rotation.x = Math.PI;                // beard
            for (const s of [1, -1]) {
                const h = add(head, hornGeo(.16, .016, .6, -.4, 2.2), horn, .03 * s, .04, -.01);
                h.scale.x = s;
                add(head, G.sph(.009, 6, 5), mat(0xd8b020), .045 * s, .015, .03);
                add(head, G.cone(.015, .05, 5), coat, .055 * s, .02, -.02).rotation.z = -s * 1.4;    // floppy ears
            }
        }
        if (c.tail === 'scorpion') {
            J.sting = scorpionTail(J.tailRoot, { len: .62 * k, r: .03 * k, color: c.sting, n: 8 });
            J.tailRoot.rotation.x = 0;
        }
        if (c.tail === 'snake') {                                                               // snake for a tail, head at the end
            const sk = mat(c.snake, { roughness: .6 }), belly = mat(0xb8b070, { roughness: .6 });
            J.snake = [];
            let p = J.tailRoot;
            for (let i = 0; i < 9; i++) {
                const g = grp(p), len = .075, r0 = .03 - i * .0015;
                const m = add(g, G.cyl(r0 * .95, r0, len, 7), sk, 0, 0, -len / 2);
                m.rotation.x = Math.PI / 2;
                add(g, G.sph(r0, 7, 5), sk);
                J.snake.push(g);
                p = grp(g, 0, 0, -len);
            }
            J.snakeHead = grp(p);
            add(J.snakeHead, G.sph(.03, 8, 6), sk, 0, 0, -.02).scale.set(1.1, .7, 1.5);
            add(J.snakeHead, G.box(.035, .01, .05), belly, 0, -.017, -.04);
            for (const s of [1, -1]) add(J.snakeHead, G.sph(.007, 6, 5), mat(0xe0d020), .02 * s, .01, -.04);
        }
    }

    // sphinx: human face with a striped royal headdress
    buildHumanHead(add, grp) {
        const H = this.c.human, J = this.j;
        const skin = mat(H.skin, { roughness: .7 }), cloth = mat(H.cloth, { roughness: .8 }), gold = mat(H.gold, { roughness: .35, metalness: .6 });
        J.head.scale.setScalar(1.25);
        add(J.head, G.sph(.07, 14, 10), skin, 0, .01, .02).scale.set(.9, 1.1, .95);
        add(J.head, G.sph(.016, 8, 6), skin, 0, -.002, .084).scale.set(.7, 1.1, .8);                // nose
        add(J.head, G.sph(.04, 8, 6), skin, 0, -.05, .045).scale.set(.9, .7, .8);                   // chin
        J.jaw = grp(J.head, 0, -.045, .05);
        add(J.jaw, G.box(.03, .006, .01), mat(0x8a4a3a), 0, 0, .02);                                // mouth
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(.008, 8, 6), mat(0xf0ece0), .025 * s, .02, .07));
            add(J.head, G.sph(.005, 6, 5), mat(this.c.eye), .025 * s, .02, .077);
            add(J.head, G.box(.022, .004, .004), mat(0x1a1410), .026 * s, .032, .072);             // brows
        }
        // nemes headdress: cap + side lappets down to the chest, gold stripes
        add(J.head, G.sph(.082, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), cloth, 0, .015, -.005).scale.set(1, 1.05, 1.05);
        for (let i = 0; i < 4; i++) add(J.head, G.torus(.08 - i * .008, .004, 4, 18), gold, 0, .02 + i * .022, -.005).rotation.x = Math.PI / 2;
        for (const s of [1, -1]) {
            const lap = add(J.head, G.box(.03, .14, .05), cloth, .07 * s, -.06, -.0);
            lap.rotation.z = s * .12;
            add(J.head, G.box(.032, .006, .052), gold, .07 * s, -.03, 0);
            add(J.head, G.box(.032, .006, .052), gold, .072 * s, -.08, 0);
        }
        add(J.head, G.cyl(.01, .015, .05, 6), cloth, 0, -.03, -.08).rotation.x = .5;                // queue at the back
        add(J.head, G.cone(.012, .03, 6), gold, 0, .085, .07).rotation.x = .3;                      // uraeus
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.CROUCH, smooth(p / .3));
                if (p < .3) P.roll = Math.sin(p * 60) * .05;                                    // rump wiggle
                if (p > .3) P = this.mix(P, this.POUNCE, smooth((p - .3) / .2));
                if (p > .5) P = this.mix(P, this.BITE, smooth((p - .5) / .14));
                if (p > .76) P = this.mix(P, this.STAND, smooth((p - .76) / .24));
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.jaw += Math.sin(t * 7) * .05;                                                 // hiss
                P.FRx += Math.sin(t * 3.1) * .12;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.SIT;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return state === 'idle' ? this.idlePose() : this.STAND;
        }
    }

    animateExtras(q, state, t, dt, g) {
        const J = this.j, n = J.tail.length;
        const fight = state === 'attack' || state === 'defend';
        if (this.wings) {
            let spread = fight ? 1 : state === 'run' ? .6 : 0, flap = 0;
            if (spread > .5) flap = Math.sin(t * (state === 'defend' ? 3 : 5)) * .6;
            this.wingK = (this.wingK ?? 0) + (spread - (this.wingK ?? 0)) * (1 - Math.exp(-5 * dt));
            for (const w of this.wings) w.set(this.wingK, flap * this.wingK);
        }
        if (J.goat) {
            J.goat.rotation.x = .35 + Math.sin(t * 1.1) * .06 + (fight ? -.25 : 0);
            J.goat.rotation.y = Math.sin(t * .7) * .3;
            J.goatHead.rotation.x = .9 + (fight ? .4 : 0);
        }
        if (J.sting) {                                                                          // scorpion tail curled over the back, strikes forward
            const strike = state === 'attack' ? Math.sin(Math.min(1, this.stateTime / .6) * Math.PI) : 0;
            J.tailRoot.rotation.x = .2;
            J.sting.forEach((seg, i) => {
                seg.rotation.x = .42 + (state === 'death' || state === 'lie' ? -.38 : 0) + strike * (i > 4 ? .3 : -.05) + Math.sin(t * 2 - i * .5) * .03;
                seg.rotation.y = Math.sin(t * 1.3 - i * .4) * .03;
            });
        }
        if (J.snake) {                                                                          // snake tail: raised, swaying, head looks forward
            const still = state === 'death' || state === 'lie';
            J.tailRoot.rotation.x = still ? -.1 : .5;
            J.snake.forEach((seg, i) => {
                seg.rotation.y = Math.sin(t * 2 - i * .6) * (still ? .05 : .22);
                seg.rotation.x = still ? .02 : i < 4 ? .18 : -.1;
            });
            J.snakeHead.rotation.x = still ? 0 : -.6;
            J.snakeHead.rotation.y = Math.PI + Math.sin(t * 1.4) * .4;
        }
        J.tailRoot.rotation.x = q.tailX;
        const sway = state === 'death' ? 0 : state === 'defend' ? .35 : state === 'idle' ? .12 : .08;
        J.tail.forEach((seg, i) => {
            const f = i / Math.max(1, n - 1);
            seg.rotation.z = Math.sin(t * (state === 'defend' ? 5 : 1.6) - i * .6) * sway * (.4 + f);
            // S-curve: hanging down, tip curling up (lying: along the ground)
            seg.rotation.x = n > 3 ? TAIL_CURVE[i] * (1 + g * .3) * (state === 'lie' || state === 'death' ? .3 : 1) : .1;
        });
    }
}
