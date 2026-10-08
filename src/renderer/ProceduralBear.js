import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth } from './QuadrupedRig.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralBear — brown bear, big bear (grizzly / polar), cave bear, necrotaur (undead bear).
 * Heavy body with a shoulder hump, thick plantigrade legs with big clawed paws, small round ears,
 * long muzzle, stub tail. Animation: QuadrupedRig (heavy rolling walk, gallop).
 *
 * States: idle (breathing, sniffing, swaying head), walk, run, attack (rears up on the hind legs →
 * swipes down with both fore-paws → bite), defend (rears up and roars, paws raised), hit, kneel (sits on
 * the rump), lie (on the belly, head on the paws), death (on its side).
 */

export const BEAR_VARIANTS = {
    bear: { coat: 0x5e4128, dark: 0x3a2716, muzzle: 0x8a6a4a, scale: 1.25 },
    'bear-large': { coat: 0x4a3626, dark: 0x2a1e14, muzzle: 0x7a5e42, scale: 1.5, hump: 1.2 },
    'bear-polar': { coat: 0xe8e2d2, dark: 0xc8c0ac, muzzle: 0xd8d0be, nose: 0x101010, scale: 1.5 },
    'cave-bear': { coat: 0x6a4a2a, dark: 0x3a2814, muzzle: 0x9a7a52, scale: 1.65, hump: 1.3, brow: true },
    necrotaur: { coat: 0x4a3a2a, dark: 0x2a2018, muzzle: 0x6a5a48, moss: 0x55703a, eye: 0xc8ffb0, glow: 0x90ff70,
        scale: 1.45, undead: true }
};
const BASE = { coat: 0x5e4128, dark: 0x3a2716, muzzle: 0x8a6a4a, nose: 0x161210, eye: 0x140e0a, scale: 1, hump: 1 };

const H = .55;
const STAND = {
    ...BASE_STAND,
    FL0: .05, FL1: -.08, FL2: .05, HL0: -.12, HL1: .3, HL2: -.18,
    neckX: 1.32, headX: -1.25, jaw: .02, tailX: .4
};

export class ProceduralBear extends QuadrupedRig {
    constructor(variant = 'bear', { scale = 1 } = {}) {
        super();
        this.variant = BEAR_VARIANTS[variant] ? variant : 'bear';
        this.c = { ...BASE, ...BEAR_VARIANTS[this.variant] };
        this.init({ H, stand: STAND, gait: { walk: 1.25, run: 2.2, amp: .36, ampRun: .4, lift: .7, roll: .06 }, sniff: .8,
            scale: this.c.scale * (scale || 1) });
        this.root.name = 'bear';
        const P = this.pose.bind(this);
        // rearing: the body pitches up around the hips, the hind legs stay under it
        this.REAR = P({ by: .26, bz: -.18, bx: -1.0, FL0: -1.35, FL1: -.95, FL2: -.2, HL0: .9, HL1: .35, HL2: -.2,
            neckX: 1.55, headX: -.5, jaw: .45, ear: .4, tailX: .1 });
        this.SLAM = P({ by: .02, bz: .2, bx: .12, FL0: -.75, FL1: -.15, FL2: .35, HL0: -.25, HL1: .45, HL2: -.2, neckX: 1.4, headX: -1.25, jaw: .55, ear: .4 });
        this.BITE = P({ by: -.03, bz: .2, bx: .15, FL0: -.3, FL1: -.2, FL2: .2, HL0: -.25, HL1: .45, HL2: -.2, neckX: 1.5, headX: -1.35, jaw: .05, ear: .4 });
        this.ROAR = P({ by: .26, bz: -.18, bx: -1.0, FL0: -1.2, FL1: -1.05, FL2: -.3, HL0: .9, HL1: .35, HL2: -.2, FLz: .3,
            neckX: 1.3, headX: -.6, jaw: .7, ear: .9, tailX: .1 });
        this.HIT = P({ by: -.03, bz: -.1, bx: -.12, neckX: 1, headX: -.8, jaw: .4, ear: .8 });
        this.SIT = P({ by: -.18, bz: -.12, bx: -1.0, FL0: .95, FL1: -.1, FL2: .05, HL0: -.5, HL1: .2, HL2: .6, HLz: .2,
            neckX: 1.7, headX: -.75, tailX: .1 });
        this.LIE = P({ by: -.4, bz: 0, FL0: -1.3, FL1: -.2, FL2: .1, FLz: .1, HL0: 1.3, HL1: .2, HL2: .1, HLz: .2, neckX: 1.4, headX: -1.35 });
        this.DEAD = P({ by: -.4, roll: 1.4, FL0: -.4, FL1: .2, FLz: .15, HL0: .5, HL1: .3, HL2: 0, neckX: 1.7, headX: -1.3, jaw: .3, ear: .5 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j, add = this.adder(), grp = this.grp.bind(this);
        const coat = mat(c.coat, { roughness: 1 }), dark = mat(c.dark, { roughness: 1 }), muz = mat(c.muzzle, { roughness: .95 });
        const nose = mat(c.nose, { roughness: .35 }), claw = mat(0xd8d0bc, { roughness: .45 });

        J.body = grp(this.root, 0, H, 0);
        const torso = add(J.body, new THREE.CapsuleGeometry(.22, .42, 6, 14), coat, 0, 0, -.03);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(.95, 1, 1.05);
        add(J.body, G.sph(.21, 14, 10), coat, 0, .02, .18).scale.set(.98, 1.1, 1.05);                 // fore-quarters
        add(J.body, G.sph(.16 * c.hump, 12, 9), coat, 0, .14, .16).scale.set(.9, .8, 1.1);              // shoulder hump
        add(J.body, G.sph(.2, 14, 10), coat, 0, .02, -.26).scale.set(1, 1.02, .95);                    // rump
        add(J.body, G.sph(.17, 12, 8), dark, 0, -.1, -.02).scale.set(.95, .55, 1.6);                   // belly
        for (const s of [1, -1]) add(J.body, G.sph(.12, 10, 8), dark, .1 * s, -.13, .14).scale.set(.7, .7, 1.2);   // shaggy chest fur
        if (c.undead) {                                                                                // necrotaur: moss and an open flank with ribs
            const moss = mat(c.moss, { roughness: 1 });
            [[.1, .2, .12, .09], [-.12, .18, -.1, .1], [.05, .19, -.3, .08], [-.06, .26, .2, .07]].forEach(([x, y, z, r]) =>
                add(J.body, G.sph(r, 8, 6), moss, x, y, z).scale.set(1.2, .6, 1.3));
            const flesh = mat(0x5a1a18, { roughness: .7 }), bone = mat(0xd8cfb0, { roughness: .8 });
            add(J.body, G.sph(.13, 10, 8), flesh, .14, -.02, .02).scale.set(.45, .9, 1.4);
            for (let i = 0; i < 5; i++) {
                const rib = add(J.body, G.torus(.205, .012, 4, 10, 1.2), bone, 0, -.01, .14 - i * .065);
                rib.rotation.set(0, Math.PI / 2, -.6);
            }
        }

        // legs: thick, plantigrade (hind foot flat on the ground), big paws with claws
        const legDef = [['FL', .12, -.04, .2, false], ['FR', -.12, -.04, .2, false], ['HL', .12, -.02, -.28, true], ['HR', -.12, -.02, -.28, true]];
        for (const [name, x, y, z, hind] of legDef) {
            const top = grp(J.body, x, y, z);
            let knee, low;
            if (hind) {
                add(top, G.sph(.13, 10, 8), coat, 0, -.06, -.01).scale.set(.75, 1.25, 1.2);
                add(top, G.cyl(.11, .088, .24, 10), coat, 0, -.12, 0);
                knee = grp(top, 0, -.24, 0);
                add(knee, G.sph(.088, 9, 7), coat);
                add(knee, G.cyl(.085, .072, .2, 9), coat, 0, -.1, 0);
                low = grp(knee, 0, -.2, 0);
                add(low, G.sph(.07, 9, 7), dark);
                add(low, G.sph(.085, 10, 7), dark, 0, -.05, .06).scale.set(1, .45, 1.55);               // long flat sole
            } else {
                add(top, G.sph(.12, 10, 8), coat, 0, -.05, 0).scale.set(.75, 1.35, 1.05);
                add(top, G.cyl(.105, .085, .24, 10), coat, 0, -.12, 0);
                knee = grp(top, 0, -.24, 0);
                add(knee, G.sph(.085, 9, 7), coat);
                add(knee, G.cyl(.082, .075, .2, 9), coat, 0, -.1, 0);
                low = grp(knee, 0, -.2, 0);
                add(low, G.sph(.074, 9, 7), dark);
                add(low, G.sph(.085, 10, 7), dark, 0, -.05, .04).scale.set(1, .5, 1.3);                // big paw
            }
            for (const cx of [-.04, -.014, .014, .04]) {                                               // claws
                const cl = add(low, G.cone(.009, .05, 4), claw, cx, hind ? -.075 : -.07, hind ? .16 : .14);
                cl.rotation.x = Math.PI / 2 + .35;
            }
            J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
        }

        // neck & head
        J.neck = grp(J.body, 0, .06, .3);
        add(J.neck, G.cyl(.12, .16, .2, 10), coat, 0, .08, 0).scale.z = .95;
        J.head = grp(J.neck, 0, .2, 0);
        J.head.scale.setScalar(1.15);
        add(J.head, G.sph(.105, 14, 10), coat, 0, 0, 0).scale.set(1.08, .92, 1.05);                    // skull
        if (c.brow) add(J.head, G.sph(.07, 10, 8), coat, 0, .05, .05).scale.set(1.3, .6, 1);            // cave bear: high forehead
        for (const s of [1, -1]) add(J.head, G.sph(.06, 9, 7), coat, .07 * s, -.03, .01).scale.set(.9, 1, 1.1);   // cheeks
        const muzzle = add(J.head, G.cyl(.045, .065, .14, 10), muz, 0, -.03, .11);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.scale.set(1, 1, .85);
        add(J.head, G.sph(.032, 8, 6), nose, 0, -.015, .185).scale.set(1.25, .8, .8);                  // nose
        J.jaw = grp(J.head, 0, -.065, .04);
        add(J.jaw, G.box(.07, .025, .13), muz, 0, 0, .06);
        const tooth = mat(0xeee6d2, { roughness: .4 });
        for (const s of [1, -1]) {
            add(J.head, G.cone(.009, .034, 5), tooth, .025 * s, -.07, .155).rotation.x = Math.PI;
            add(J.jaw, G.cone(.008, .03, 5), tooth, .022 * s, .02, .11);
        }
        const eyeMat = c.glow ? mat(c.eye, { emissive: c.glow, emissiveIntensity: 2.2, roughness: .2 }) : mat(c.eye, { roughness: .2 });
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(.013, 8, 6), eyeMat, .045 * s, .03, .075));
            if (c.glow) {
                const h = haloSprite(c.glow, .08, .5);
                h.position.set(.045 * s, .03, .085);
                h.raycast = () => {};
                J.head.add(h);
            }
            const ear = grp(J.head, .075 * s, .08, -.02);
            add(ear, G.sph(.035, 8, 6), coat, 0, .015, 0).scale.set(1, 1, .5);
            add(ear, G.sph(.022, 8, 6), dark, 0, .015, .008).scale.set(1, 1, .3);
            ear.rotation.z = -.3 * s;
            J['ear' + (s > 0 ? 'L' : 'R')] = ear;
        }

        // stub tail
        J.tail = [];
        J.tailRoot = grp(J.body, 0, .1, -.44);
        const tail = grp(J.tailRoot);
        add(tail, G.sph(.05, 8, 6), coat, 0, -.03, 0).scale.set(.9, 1.2, .9);
        J.tail.push(tail);
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.REAR, smooth(p / .35));
                if (p > .35) P = this.mix(P, this.SLAM, smooth((p - .35) / .17));
                if (p > .55) P = this.mix(P, this.BITE, smooth((p - .55) / .12));
                if (p > .72) P = this.mix(P, this.STAND, smooth((p - .72) / .28));
                return P;
            }
            case 'defend': {
                const P = { ...this.ROAR };
                P.FL0 += Math.sin(t * 2.6) * .15;                                    // paws pawing the air
                P.FRx = Math.sin(t * 2.6 + 1.5) * .25;
                P.by += Math.sin(t * 1.3) * .01;
                P.jaw += Math.sin(t * 5) * .06;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': return this.SIT;
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                if (state !== 'idle') return this.STAND;
                const P = this.idlePose();
                P.neckY += Math.sin(this.time * .7) * .12;                           // slow head sway
                return P;
            }
        }
    }

    animateExtras(q, state, t) {
        const J = this.j;
        J.tailRoot.rotation.x = q.tailX;
        J.tail[0].rotation.z = Math.sin(t * 1.3) * .1;
    }
}
