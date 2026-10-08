import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth } from './QuadrupedRig.js';

/*
 * ProceduralRat — giant rat (bred by magic or alchemy): hunched pear-shaped body, crouched legs with pink hands,
 * pointed snout with whiskers and yellow incisors, round naked ears, long scaly tail.
 *
 * States: idle (sniffing with a twitching nose, looking around), walk, run (bounding), attack (crouch → lunge with
 * the fore-paws forward → bite), defend (rears up on the hind legs, incisors bared), hit, kneel (sits up on the
 * haunches), lie, death. Animation: QuadrupedRig.
 */

export const RAT_VARIANTS = {
    'giant-rat': { coat: 0x4e443c, light: 0x8a7e70, skin: 0xc89090, eye: 0x100808, scale: 1.5 }
};
const BASE = { coat: 0x4e443c, light: 0x8a7e70, skin: 0xc89090, eye: 0x100808, scale: 1 };

const H = .22;
const STAND = {
    ...BASE_STAND,
    bx: -.08, FL0: .25, FL1: -.5, FL2: .25, HL0: -.75, HL1: 1.25, HL2: -.55,
    neckX: 1.35, headX: -1.2, jaw: .02, tailX: .2
};

export class ProceduralRat extends QuadrupedRig {
    constructor(variant = 'giant-rat', { scale = 1 } = {}) {
        super();
        this.variant = RAT_VARIANTS[variant] ? variant : 'giant-rat';
        this.c = { ...BASE, ...RAT_VARIANTS[this.variant] };
        this.init({ H, stand: STAND, gait: { walk: .55, run: 1.1, amp: .45, ampRun: .5, lift: .8, roll: .03, galOff: { HL: 0, HR: .05, FL: .5, FR: .55 } },
            sniff: 1, scale: this.c.scale * (scale || 1) });
        this.root.name = 'rat';
        const P = this.pose.bind(this);
        this.CROUCH = P({ by: -.06, bz: -.05, bx: .05, FL0: .5, FL1: -.9, FL2: .3, HL0: -1.0, HL1: 1.7, HL2: -.7, neckX: 1.45, headX: -1.3 });
        this.LUNGE = P({ by: .06, bz: .22, bx: -.2, FL0: -1.1, FL1: .2, FL2: .3, HL0: -.2, HL1: .6, HL2: -.3, neckX: 1.25, headX: -1.05, jaw: .6 });
        this.BITE = P({ by: -.02, bz: .18, bx: .08, FL0: -.4, FL1: -.2, HL0: -.55, HL1: 1.1, HL2: -.5, neckX: 1.5, headX: -1.35, jaw: .05 });
        this.REAR = P({ by: .1, bz: -.1, bx: -1.05, FL0: -.2, FL1: -1.4, FL2: .6, HL0: .25, HL1: 1.1, HL2: -1.1, neckX: 1.6, headX: -.9, jaw: .55, ear: .5, tailX: -.2 });
        this.HIT = P({ by: -.02, bz: -.06, bx: -.2, neckX: 1.1, headX: -.9, jaw: .4, ear: .6 });
        this.SIT = P({ by: .02, bz: -.1, bx: -1.1, FL0: -.3, FL1: -1.6, FL2: .9, HL0: .3, HL1: 1.6, HL2: -1.6, neckX: 1.7, headX: -1.0, tailX: -.3 });
        this.LIE = P({ by: -.16, FL0: -1.0, FL1: -.2, HL0: -1.4, HL1: 2.4, HL2: -2, HLz: .3, neckX: 1.45, headX: -1.35, tailX: 0 });
        this.DEAD = P({ by: -.2, roll: 1.45, FL0: -.4, FL1: .3, HL0: .3, HL1: .4, HL2: 0, neckX: 1.6, headX: -1.2, jaw: .4, tailX: .1 });
        this.build();
    }

    build() {
        const c = this.c, J = this.j, add = this.adder(), grp = this.grp.bind(this);
        const coat = mat(c.coat, { roughness: 1 }), light = mat(c.light, { roughness: 1 }), skin = mat(c.skin, { roughness: .6 });
        const tooth = mat(0xd8b860, { roughness: .4 }), claw = mat(0x2a2420, { roughness: .5 });

        J.body = grp(this.root, 0, H, 0);
        add(J.body, G.sph(.17, 14, 10), coat, 0, .02, -.12).scale.set(.95, 1, 1.25);                    // big rump
        add(J.body, G.sph(.13, 12, 9), coat, 0, .0, .1).scale.set(.9, .95, 1.2);                        // fore body
        add(J.body, G.sph(.12, 10, 8), light, 0, -.07, -.02).scale.set(.85, .6, 1.8);                   // belly
        for (let i = 0; i < 6; i++) add(J.body, G.cone(.03, .07, 4), coat, (i % 2 - .5) * .05, .17 - Math.abs(i - 2) * .01, .06 - i * .06).rotation.x = -1.1;   // ragged fur

        const legDef = [['FL', .07, -.04, .14, false], ['FR', -.07, -.04, .14, false], ['HL', .1, -.02, -.16, true], ['HR', -.1, -.02, -.16, true]];
        for (const [name, x, y, z, hind] of legDef) {
            const top = grp(J.body, x, y, z);
            let knee, low;
            if (hind) {
                add(top, G.sph(.08, 9, 7), coat, 0, -.03, .01).scale.set(.7, 1.1, 1.3);
                knee = grp(top, 0, -.12, 0);
                add(top, G.cyl(.035, .025, .12, 7), coat, 0, -.06, 0);
                add(knee, G.cyl(.022, .016, .12, 6), coat, 0, -.06, 0);
                low = grp(knee, 0, -.12, 0);
                add(low, G.box(.04, .015, .1), skin, 0, -.008, .04);                                    // long hind foot
            } else {
                add(top, G.sph(.045, 8, 6), coat, 0, -.02, 0).scale.set(.8, 1.3, 1);
                add(top, G.cyl(.026, .02, .1, 6), coat, 0, -.05, 0);
                knee = grp(top, 0, -.1, 0);
                add(knee, G.cyl(.017, .014, .1, 6), skin, 0, -.05, 0);
                low = grp(knee, 0, -.1, 0);
                add(low, G.sph(.022, 6, 5), skin, 0, -.006, .015).scale.set(1.2, .5, 1.4);              // little hand
            }
            for (const cx of [-.012, 0, .012]) add(low, G.cone(.004, .02, 4), claw, cx, -.01, hind ? .09 : .04).rotation.x = Math.PI / 2;
            J[name] = { top, knee, low, hind, side: x > 0 ? 1 : -1 };
        }

        J.neck = grp(J.body, 0, .04, .2);
        add(J.neck, G.cyl(.07, .1, .1, 9), coat, 0, .04, 0);
        J.head = grp(J.neck, 0, .09, 0);
        add(J.head, G.sph(.075, 12, 9), coat, 0, 0, 0).scale.set(.95, .85, 1.1);
        const snout = add(J.head, G.cone(.055, .16, 10), coat, 0, -.01, .12);
        snout.rotation.x = Math.PI / 2;
        snout.scale.set(1, .8, 1);
        add(J.head, G.sph(.016, 7, 5), skin, 0, -.012, .2);                                                // nose
        J.nose = J.head.children[J.head.children.length - 1];
        for (const s of [1, -1]) {
            add(J.head, G.box(.006, .02, .008), tooth, .005 * s, -.04, .17);                               // upper incisors
            for (let i = 0; i < 3; i++) {                                                                  // whiskers
                const w = add(J.head, G.cyl(.0015, .0015, .12, 3), mat(0xd8d0c0), .06 * s, -.015 + i * .008, .15);
                w.rotation.set(0, 0, s * (Math.PI / 2 - .25 + i * .15));
                w.castShadow = false;
            }
        }
        J.jaw = grp(J.head, 0, -.035, .05);
        add(J.jaw, G.box(.03, .015, .1), coat, 0, -.005, .05);
        for (const s of [1, -1]) add(J.jaw, G.box(.006, .022, .008), tooth, .005 * s, .008, .1);
        const eyeMat = mat(c.eye, { roughness: .15 });
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(.014, 7, 5), eyeMat, .045 * s, .025, .06));
            const ear = grp(J.head, .045 * s, .06, -.02);
            add(ear, G.sph(.03, 8, 6), skin, 0, .02, 0).scale.set(1, 1, .3);
            ear.rotation.z = -.4 * s;
            J['ear' + (s > 0 ? 'L' : 'R')] = ear;
        }

        // long naked tail
        J.tail = [];
        let parent = grp(J.body, 0, .02, -.3);
        J.tailRoot = parent;
        for (let i = 0; i < 9; i++) {
            const g = grp(parent), len = .09, r0 = .022 - i * .0022, r1 = .022 - (i + 1) * .0022;
            add(g, G.cyl(Math.max(.003, r1), r0, len, 6), skin, 0, -len / 2, 0);
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.CROUCH, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.LUNGE, smooth((p - .3) / .18));
                if (p > .5) P = this.mix(P, this.BITE, smooth((p - .5) / .12));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...this.REAR };
                P.jaw += Math.sin(t * 9) * .1;
                P.FL0 += Math.sin(t * 3) * .1;
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': {
                const P = { ...this.SIT };
                P.FL1 += Math.sin(t * 6) * .15;                                                     // grooming paws
                return P;
            }
            case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: return state === 'idle' ? this.idlePose() : this.STAND;
        }
    }

    animateExtras(q, state, t, dt, g) {
        const J = this.j, n = J.tail.length, dead = state === 'death' || state === 'lie';
        J.tailRoot.rotation.x = q.tailX + 1.35;                                                     // the tail trails behind along the ground
        J.tail.forEach((seg, i) => {
            seg.rotation.x = dead ? 0 : (i < 3 ? .1 : -.04);
            seg.rotation.z = Math.sin(t * 2.2 - i * .7) * (dead ? .02 : .12 + g * .08);
        });
        J.nose.scale.setScalar(1 + (state === 'idle' ? Math.max(0, Math.sin(t * 18)) * .25 : 0));
    }
}
