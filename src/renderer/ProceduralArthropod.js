import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, furTexture } from './QuadrupedRig.js';
import { scorpionTail, glowMat } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralArthropod — spiders, insects, scorpions, crabs and flying insects on one rig with N jointed legs.
 * Kinds: spider (8 legs; gargantula 6, strider = tiny body on very long legs), insect (6 legs: ant, beetles with horns,
 * dune reaper with scythes), mantis (4 walking legs + raptorial forelegs), scorpion (pincers, sting tail), crab (wide
 * shell, big claws, eye stalks; spider crab on long legs), flyer (aku wasp, sirii dragonfly: hovers, buzzing wings).
 *
 *   leg: top (rotation.y = fan angle + swing, rotation.z = femur raised up and out) ─ knee (tibia down) ─ low (tarsus)
 *   Legs walk in alternating sets (tripod / tetrapod gait).
 *
 * States: idle (twitching legs and feelers), walk, run, attack (spider: rears with the front legs up → lunge → bite;
 * insect: mandibles open → lunge → snap; scorpion and crab: claws open → pinch → sting; mantis: raptorial strike;
 * flyer: rises → dives with the sting), defend (threat pose: front legs / claws / tail up), hit, kneel / lie (body down,
 * legs splayed), death (on its back, legs curled). Animation: QuadrupedRig.
 */

export const ARTHROPOD_VARIANTS = {
    gargantula: { kind: 'spider', legs: 6, color: 0x18161a, mark: 0xb89030, eye: 0xff2010, glow: true, bristle: true, scale: 1.7 },
    'giant-strider': { kind: 'spider', color: 0x3a3028, mark: 0x5a4a3a, eye: 0x100808, strider: true, scale: 1.6 },
    rahlog: { kind: 'spider', color: 0x6a5e50, mark: 0x8a7e6a, eye: 0x100808, scale: 1 },
    'rahlog-queen': { kind: 'spider', color: 0x2a2450, mark: 0x7a40d0, eye: 0xff4060, glow: true, queen: true, veins: 0xc040ff, scale: 1.45 },
    sorog: { kind: 'spider', color: 0x7a5a38, mark: 0x3a2818, eye: 0x100808, spots: true, bristle: true, scale: 1.5 },
    urax: { kind: 'spider', color: 0x1a1c28, mark: 0x2a3048, eye: 0xff2010, glow: true, bristle: true, scale: 1.5 },
    xur: { kind: 'spider', color: 0x23408a, mark: 0x14244a, eye: 0x080810, gloss: true, scale: .65 },
    zeghar: { kind: 'spider', color: 0x6a645c, mark: 0x3a3630, eye: 0x080808, spots: true, scale: .85 },
    ant: { kind: 'insect', color: 0x3a2014, mark: 0x5a3020, eye: 0x080606, ant: true, scale: 1 },
    'beetle-1': { kind: 'insect', color: 0x14161a, mark: 0x2a2e36, eye: 0x080808, beetle: true, horn: 'rhino', scale: 1.2 },
    'beetle-2': { kind: 'insect', color: 0x1e2228, mark: 0x3a4048, eye: 0x080808, beetle: true, horn: 'stag', scale: 2.2 },
    'beetle-3': { kind: 'insect', color: 0x8a6a40, mark: 0xb08a58, eye: 0x100808, beetle: true, horn: 'great', scale: 3.2 },
    'dune-reaper': { kind: 'insect', color: 0x6a3020, mark: 0x9a5a3a, eye: 0x100808, reaper: true, scale: 1.35 },
    mantis: { kind: 'mantis', color: 0x4a8a2a, mark: 0x8ac040, eye: 0x9ad050, scale: 1.4 },
    'giant-scorpion': { kind: 'scorpion', color: 0x6a3020, mark: 0x8a4a30, eye: 0x080606, scale: 1.4 },
    'diamond-scorpion': { kind: 'scorpion', color: 0x8090c0, mark: 0x3040a0, eye: 0x80a0ff, crystal: true, glow: true, scale: 1.4 },
    'giant-crab': { kind: 'crab', color: 0x6a3a2a, mark: 0x9a6a50, eye: 0x101010, scale: 1.9 },
    'giant-spider-crab': { kind: 'crab', color: 0x3a1a18, mark: 0x6a2a24, eye: 0x101010, spiderLegs: true, scale: 2.2 },
    aku: { kind: 'flyer', color: 0x141214, mark: 0xb02018, eye: 0x080808, wasp: true, scale: 1.6 },
    sirii: { kind: 'flyer', color: 0x141a2a, mark: 0x2a4a8a, eye: 0x3a1010, dragonfly: true, scale: 1.5 }
};

// leg pairs: fan angle (+ forward), attach z on the body; legs [femur, tibia, tarsus]; femur raise z, knee k1, tarsus k2
const KINDS = {
    spider: { pairs: [[.75, .1], [.28, .04], [-.18, -.02], [-.6, -.08]], legs: [.42, .48, .18], R: .028, z: 2.15, k1: 1.85, k2: .25, body: .16 },
    insect: { pairs: [[.6, .12], [-.05, 0], [-.6, -.1]], legs: [.32, .36, .14], R: .024, z: 1.95, k1: 1.65, k2: .35, body: .14 },
    mantis: { pairs: [[.1, -.02], [-.5, -.12]], legs: [.34, .4, .14], R: .018, z: 1.9, k1: 1.65, k2: .3, body: .1 },
    scorpion: { pairs: [[.45, .14], [.15, .06], [-.15, -.02], [-.45, -.1]], legs: [.24, .28, .12], R: .026, z: 2.0, k1: 1.7, k2: .3, body: .15 },
    crab: { pairs: [[.55, .12], [.2, .05], [-.15, -.03], [-.5, -.1]], legs: [.3, .32, .16], R: .035, z: 2.1, k1: 1.75, k2: .35, body: .2 },
    flyer: { pairs: [[.4, .04], [0, 0], [-.4, -.04]], legs: [.16, .2, .08], R: .012, z: .7, k1: -.5, k2: -.2, body: .08 }
};

export class ProceduralArthropod extends QuadrupedRig {
    constructor(variant = 'rahlog', { scale = 1 } = {}) {
        super();
        this.variant = ARTHROPOD_VARIANTS[variant] ? variant : 'rahlog';
        const c = this.c = { ...ARTHROPOD_VARIANTS[this.variant] };
        this.kind = c.kind;
        const D = this.D = { ...KINDS[this.kind] };
        if (c.strider) { D.legs = D.legs.map(l => l * 1.9); D.body = .1; D.z = 2.35; D.k1 = 2.0; }
        if (c.spiderLegs) { D.legs = D.legs.map(l => l * 1.6); D.z = 2.2; D.k1 = 1.9; }
        if (c.legs === 6) D.pairs = [[.6, .08], [0, 0], [-.55, -.06]];
        if (c.beetle || c.reaper) Object.assign(D, { legs: [.2, .24, .1], z: 1.75, k1: 1.5, body: .2, R: .03 });   // low, heavy
        this.fly = this.kind === 'flyer';
        const [f, t, ts] = D.legs, th = [D.z, D.z - D.k1, D.z - D.k1 - D.k2];
        const legY = -D.body * .25;
        this.H = this.fly ? 1.05 : -legY + (f * Math.cos(th[0]) + t * Math.cos(th[1]) + ts * Math.cos(th[2])) + D.R;
        const legs = [];
        D.pairs.forEach((_, i) => legs.push('L' + i, 'R' + i));
        const S = {
            ...BASE_STAND, FLz: D.z, HLz: D.z, FL0: 0, HL0: 0, FL1: D.k1, HL1: D.k1, FL2: D.k2, HL2: D.k2,
            neckX: 0, headX: 0, jaw: 0, tailX: 0, front: 0, claw: 0, clawOpen: .15, sting: 0, abd: 0
        };
        if (this.kind === 'mantis') Object.assign(S, { neckX: -1.0, headX: 1.1 });
        this.init({ H: this.H, stand: S, legs, sniff: 0, scale: c.scale * (scale || 1),
            gait: this.fly ? { walk: 1, run: 2, amp: 0, ampRun: 0, lift: 0, roll: 0 }
                : { walk: (f + t) * 1.6, run: (f + t) * 2.6, amp: .32, ampRun: .1, lift: .45, roll: .0 } });
        this.root.name = this.kind;
        this.legY = legY;
        const P = this.pose.bind(this), k = this.kind;
        const low = -(this.H - D.body * .6), flat = { FLz: D.z - .45, HLz: D.z - .45, FL1: D.k1 - .9, HL1: D.k1 - .9 };
        if (k === 'spider') {
            this.A1 = P({ by: .06, bz: -.08, bx: -.4, front: 1.1, jaw: .8, abd: .2 });
            this.A2 = P({ by: -.02, bz: .32, bx: .1, front: .35, jaw: .8 });
            this.A3 = P({ by: -.04, bz: .26, bx: .15, front: .1, jaw: 0 });
            this.DEFEND = P({ by: .05, bz: -.05, bx: -.45, front: 1.25, jaw: .6, abd: .3 });
        } else if (k === 'insect' || k === 'mantis') {
            this.A1 = P({ by: .04, bz: -.06, bx: -.2, jaw: .9, claw: k === 'mantis' ? -.8 : .6, clawOpen: 1, front: .2 });
            this.A2 = P({ by: -.02, bz: .32, bx: .08, jaw: .9, claw: k === 'mantis' ? .9 : .9, clawOpen: 1 });
            this.A3 = P({ by: -.03, bz: .26, bx: .12, jaw: 0, claw: k === 'mantis' ? .3 : .4, clawOpen: 0 });
            this.DEFEND = P({ by: .04, bx: -.25, jaw: .7, claw: k === 'mantis' ? -1 : .5, clawOpen: 1, front: .3 });
        } else if (k === 'scorpion' || k === 'crab') {
            this.A1 = P({ by: .03, bz: -.05, bx: -.1, claw: .9, clawOpen: 1, sting: .3 });
            this.A2 = P({ by: -.02, bz: .3, bx: .05, claw: .3, clawOpen: 0, sting: 1 });
            this.A3 = P({ by: -.02, bz: .25, bx: .05, claw: .5, clawOpen: .1, sting: .2 });
            this.DEFEND = P({ by: .04, bx: -.12, claw: 1.1, clawOpen: .8, sting: .5 });
        } else {                                                                              // flyer: rise, dive with the sting
            this.A1 = P({ by: .35, bz: -.15, bx: -.3, abd: .5, sting: .5 });
            this.A2 = P({ by: -.35, bz: .45, bx: .35, abd: -.9, sting: 1 });
            this.A3 = P({ by: -.1, bz: .3, bx: .1, abd: -.3, sting: .2 });
            this.DEFEND = P({ by: .15, bx: -.25, abd: -.6, sting: .6 });
        }
        this.HIT = P({ by: .02, bz: -.1, bx: -.15, jaw: .4, front: .3, claw: .2 });
        this.LIE = P({ ...flat, by: this.fly ? -this.H + D.body * .9 : low, jaw: 0, front: 0, claw: -.2, sting: -.2 });
        if (this.fly) Object.assign(this.LIE, { FLz: 1.9, HLz: 1.9, FL1: 1.6, HL1: 1.6, FL2: .3, HL2: .3 });
        this.DEAD = P({ by: this.fly ? -this.H + D.body * 1.2 : -(this.H - D.body * 1.3), roll: Math.PI, FLz: 1.1, HLz: 1.1, FL1: 2.2, HL1: 2.2, FL2: 1.0, HL2: 1.0,
            jaw: .3, claw: -.4, clawOpen: .4, sting: -.3, abd: .1 });
        this.build();
    }

    build() {
        const c = this.c, D = this.D, J = this.j, add = this.adder(), grp = this.grp.bind(this), k = this.kind, b = D.body;
        const tex = c.spots ? furTexture('spots', c.color, c.mark) : null;
        const chitin = c.crystal ? mat(c.color, { roughness: .08, metalness: .45, emissive: c.mark, emissiveIntensity: .25, flatShading: true })
            : mat(c.color, { roughness: c.gloss ? .2 : .42, metalness: .08 });
        const mark = mat(c.mark, { roughness: .45 });
        const shell = tex ? mat(0xffffff, { roughness: .5, map: tex }) : chitin;
        const dark = mat(0x0c0a0a, { roughness: .3 });
        this.mats = { chitin, mark, shell, dark };

        J.body = grp(this.root, 0, this.H, 0);
        J.neck = grp(J.body, 0, 0, b * 1.2);
        J.head = grp(J.neck);
        J.jaw = grp(J.head);                                                                // (pose 'jaw' drives fangs / mandibles below)
        J.abd = grp(J.body, 0, b * .2, -b * .9);
        J.fangs = []; J.claws = []; J.feelers = [];

        if (k === 'spider') this.buildSpider(add, grp);
        else if (k === 'insect') this.buildInsect(add, grp);
        else if (k === 'mantis') this.buildMantis(add, grp);
        else if (k === 'scorpion') this.buildScorpion(add, grp);
        else if (k === 'crab') this.buildCrab(add, grp);
        else this.buildFlyer(add, grp);

        // legs
        const [f, t, ts] = D.legs, R = D.R;
        const legMat = c.queen ? mat(c.color, { roughness: .3, emissive: c.veins, emissiveIntensity: .12 }) : chitin;
        D.pairs.forEach(([fan, z], pair) => {
            for (const side of [1, -1]) {
                const top = grp(J.body, side * b * (k === 'crab' ? 1.1 : .6), this.legY, z * (k === 'crab' ? 1.2 : 1) + (k === 'mantis' ? -.05 : 0));
                top.rotation.order = 'YZX';
                add(top, G.sph(R * 1.3, 7, 5), legMat);
                add(top, G.cyl(R * 1.1, R * .9, f, 6), legMat, 0, -f / 2, 0);
                const knee = grp(top, 0, -f, 0);
                add(knee, G.sph(R * 1.05, 7, 5), c.queen ? mat(c.veins, { emissive: c.veins, emissiveIntensity: .8 }) : legMat);
                add(knee, G.cyl(R * .85, R * .6, t, 6), legMat, 0, -t / 2, 0);
                if (c.bristle) for (let i = 0; i < 3; i++) add(knee, G.cone(R * .25, R * 2, 3), legMat, R * .7 * side, -t * (.25 + i * .25), 0).rotation.z = -side * 1.2;
                const low = grp(knee, 0, -t, 0);
                add(low, G.cyl(R * .55, R * .3, ts, 5), k === 'spider' && !c.strider ? mark : legMat, 0, -ts / 2, 0);
                if (c.spots || c.mark && k === 'spider' && pair % 2) add(knee, G.cyl(R * .9, R * .9, t * .15, 6), mark, 0, -t * .45, 0);   // banded legs
                J['LR'[side > 0 ? 0 : 1] + pair] = { top, knee, low, side, pair, hind: z < 0, key: z < 0 ? 'HL' : 'FL',
                    yaw0: -fan * side, walk: ((pair + (side < 0 ? 1 : 0)) % 2) * .5, gal: ((pair + (side < 0 ? 1 : 0)) % 2) * .5 };
            }
        });
    }

    buildSpider(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.sph(b, 12, 9), M.chitin, 0, 0, b * .2).scale.set(1, .7, 1.15);                 // cephalothorax
        add(J.abd, G.sph(b * (c.queen ? 2.3 : c.strider ? 1.3 : 1.75), 14, 10), M.shell, 0, 0, -b * (c.queen ? 1.9 : 1.4)).scale.set(.95, .82, 1.15);
        const ab = b * (c.queen ? 2.3 : c.strider ? 1.3 : 1.75), az = -b * (c.queen ? 1.9 : 1.4);
        if (!c.spots && !c.strider) {                                                         // markings on the abdomen
            for (let i = 0; i < 3; i++) add(J.abd, G.sph(ab * .2, 8, 6), M.mark, 0, ab * .76, az + ab * (.45 - i * .45)).scale.set(1.5 - i * .3, .25, .8);
            for (const s of [1, -1]) add(J.abd, G.sph(ab * .14, 8, 6), M.mark, s * ab * .4, ab * .6, az).scale.set(1, .3, 1.6);
        }
        if (c.veins) for (let i = 0; i < 7; i++) {                                           // queen: glowing veins
            const vg = grp(J.abd, 0, 0, az);
            vg.scale.set(.95, .82, 1.15);                                                    // same squash as the abdomen
            const v = add(vg, G.torus(ab * 1.0, ab * .022, 4, 18, 1.2 + (i % 3) * .3), glowMat(c.veins, .9));
            v.rotation.set(i * .9, i * 1.3, i * .7);
        }
        if (c.bristle) for (let i = 0; i < 24; i++) {                                         // bristles
            const a = i * 2.4, r = ab * .95, y = Math.cos(i * .7) * .6;
            const dir = new THREE.Vector3(Math.sin(a) * Math.sqrt(1 - y * y), y, Math.cos(a) * Math.sqrt(1 - y * y));
            const br = add(J.abd, G.cone(ab * .03, ab * .2, 3), M.chitin, dir.x * r * .95, dir.y * r * .8 + ab * .05, az + dir.z * r * 1.1);
            br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        }
        // head: eyes, fangs, pedipalps
        const eyeM = c.glow ? mat(c.eye, { emissive: c.eye, emissiveIntensity: 2, roughness: .2 }) : mat(c.eye, { roughness: .08, metalness: .3 });
        const eyes = [[.32, .45, .95, .2], [-.32, .45, .95, .2], [.13, .55, 1.05, .14], [-.13, .55, 1.05, .14], [.5, .38, .8, .1], [-.5, .38, .8, .1], [.22, .62, .9, .09], [-.22, .62, .9, .09]];
        J.eyes = [];
        for (const [x, y, z, r] of eyes) J.eyes.push(add(J.head, G.sph(b * r, 7, 5), eyeM, x * b, y * b * .7, z * b * .3 + b * .1));
        if (c.glow) for (const s of [1, -1]) { const h = haloSprite(c.eye, b * 1.2, .45); h.position.set(s * b * .25, b * .35, b * .5); h.raycast = () => {}; J.head.add(h); }
        for (const s of [1, -1]) {
            const fang = grp(J.head, s * b * .2, -b * .1, b * .55);
            add(fang, G.sph(b * .17, 8, 6), M.chitin, 0, -b * .05, 0).scale.set(1, 1.4, 1);
            add(fang, G.cone(b * .06, b * .3, 5), M.dark, -s * b * .05, -b * .32, b * .05).rotation.set(.3, 0, s * .4);
            J.fangs.push([fang, s]);
            const palp = grp(J.head, s * b * .35, -b * .05, b * .5);
            add(palp, G.cyl(D.R * .8, D.R * .6, b * .6, 5), M.chitin, 0, -b * .3, b * .1).rotation.x = -.5;
            J.feelers.push([palp, s]);
        }
    }

    buildInsect(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.sph(b, 12, 9), M.chitin, 0, 0, b * .1).scale.set(.85, .8, 1.3);                // thorax
        if (c.ant) {
            add(J.abd, G.sph(b * .45, 8, 6), M.chitin, 0, -b * .1, -b * .3);                         // waist node
            add(J.abd, G.sph(b * 1.3, 12, 9), M.shell, 0, b * .15, -b * 1.4).scale.set(.85, .8, 1.2);
        } else if (c.beetle) {
            add(J.abd, G.sph(b * 1.6, 14, 10), M.mark, 0, -b * .1, -b * .95).scale.set(.9, .62, 1.25);
            const el = add(J.abd, G.sph(b * 1.65, 16, 10), M.chitin, 0, b * .05, -b * .95);         // elytra: shiny shell
            el.scale.set(.92, .66, 1.27);
            const seam = add(J.abd, G.sph(b * 1.67, 16, 10), M.dark, 0, b * .05, -b * .95);
            seam.scale.set(.03, .66, 1.27);
        } else if (c.reaper) {
            add(J.abd, G.sph(b * 1.6, 12, 9), M.shell, 0, b * .3, -b * 1.0).scale.set(1, .9, 1.2);   // hunched armoured back
            for (let i = 0; i < 5; i++) add(J.abd, G.torus(b * 1.3 - i * b * .1, b * .06, 4, 14, Math.PI), M.mark, 0, b * .3, -b * (.2 + i * .4)).rotation.set(0, Math.PI / 2, 0);
        }
        // head with mandibles and feelers
        const hb = c.ant ? b * .85 : b * .7;
        add(J.head, G.sph(hb, 12, 9), M.chitin, 0, 0, hb * .7).scale.set(1, .85, 1);
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(hb * .28, 8, 6), mat(c.eye, { roughness: .1, metalness: .3 }), s * hb * .75, hb * .2, hb * .9));
            const m = grp(J.head, s * hb * .35, -hb * .4, hb * 1.4);
            add(m, G.cone(hb * .12, hb * .8, 5), M.dark, -s * hb * .15, 0, hb * .3).rotation.set(Math.PI / 2, 0, s * .6);
            J.fangs.push([m, s]);
            const fe = grp(J.head, s * hb * .3, hb * .55, hb * 1.2);
            add(fe, G.cyl(D.R * .35, D.R * .25, hb * 2.2, 4), M.dark, 0, hb * 1.1, 0);
            fe.rotation.set(.9, 0, -s * .4);
            J.feelers.push([fe, s]);
        }
        if (c.horn) {                                                                               // beetle horns
            const hm = M.chitin;
            if (c.horn === 'rhino') add(J.head, G.cone(hb * .25, hb * 2.4, 6), hm, 0, hb * 1.1, hb * 1.6).rotation.x = .45;
            else if (c.horn === 'stag') for (const s of [1, -1]) add(J.head, G.cone(hb * .15, hb * 1.8, 6), hm, s * hb * .4, 0, hb * 2.0).rotation.set(Math.PI / 2, 0, -s * .35);
            else add(J.head, G.cone(hb * .4, hb * 3.4, 6), hm, 0, hb * 1.5, hb * 1.9).rotation.x = .55;
        }
        if (c.reaper) for (const s of [1, -1]) {                                                    // scythe forelegs
            const sc = grp(J.body, s * b * .6, b * .1, b * .9);
            add(sc, G.cyl(D.R * 1.4, D.R, b * 1.4, 6), M.chitin, 0, -b * .7, 0);
            const bl = add(sc, G.cone(D.R * 1.6, b * 1.8, 4), M.mark, 0, -b * 1.4, b * .7);
            bl.rotation.x = Math.PI / 2 + .4;
            bl.scale.set(.4, 1, 1);
            J.claws.push({ g: sc, s, kind: 'scythe' });
        }
    }

    buildMantis(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.cyl(b * .7, b * .8, b * 2.2, 8), M.chitin, 0, 0, 0).rotation.x = Math.PI / 2;
        add(J.abd, G.sph(b * 1.2, 12, 8), M.chitin, 0, b * .2, -b * 2.2).scale.set(.8, .7, 2.2);
        for (const s of [1, -1]) add(J.abd, G.sph(b * 1.1, 10, 6), M.mark, s * b * .35, b * .7, -b * 1.9).scale.set(.45, .12, 2.1);   // folded wings
        // raised prothorax (neck) with the triangular head
        J.neck.position.set(0, b * .2, b * 1.1);
        add(J.neck, G.cyl(b * .45, b * .6, b * 3, 7), M.chitin, 0, 0, b * 1.5).rotation.x = Math.PI / 2;
        J.head.position.set(0, 0, b * 3.1);
        const hd = add(J.head, G.cone(b * 1.0, b * 1.4, 3), M.chitin, 0, 0, b * .3);
        hd.rotation.set(-Math.PI / 2 + .3, 0, Math.PI);
        hd.scale.set(1, 1, .5);
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(b * .38, 8, 6), mat(c.eye, { roughness: .15, emissive: c.eye, emissiveIntensity: .15 }), s * b * .8, b * .2, b * .15));
            const fe = grp(J.head, s * b * .2, b * .5, b * .1);
            add(fe, G.cyl(D.R * .4, D.R * .3, b * 4, 4), M.chitin, 0, b * 2, 0);
            fe.rotation.set(.5, 0, -s * .35);
            J.feelers.push([fe, s]);
            const m = grp(J.head, s * b * .15, -b * .5, b * .4);
            add(m, G.cone(b * .1, b * .4, 4), M.dark, 0, -b * .1, 0).rotation.x = Math.PI;
            J.fangs.push([m, s]);
            // raptorial foreleg: coxa → femur with spines → tibia hook (folded "praying")
            const sh = grp(J.neck, s * b * .5, -b * .3, b * 2.2);
            add(sh, G.cyl(D.R * 1.5, D.R * 1.2, b * 2.2, 6), M.chitin, 0, -b * 1.1, 0);
            const el = grp(sh, 0, -b * 2.2, 0);
            add(el, G.cyl(D.R * 1.8, D.R * 1.3, b * 2.6, 6), M.mark, 0, b * 1.3, 0);
            for (let i = 0; i < 4; i++) add(el, G.cone(D.R * .5, b * .35, 4), M.dark, 0, b * (.4 + i * .5), -D.R * 1.6).rotation.x = -2.2;
            const hook = grp(el, 0, b * 2.6, 0);
            add(hook, G.cyl(D.R, D.R * .5, b * 1.8, 5), M.chitin, 0, -b * .9, 0);
            J.claws.push({ g: sh, el, hook, s, kind: 'raptor' });
        }
    }

    buildScorpion(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.sph(b, 12, 9), M.chitin, 0, 0, b * .3).scale.set(1.1, .55, 1.4);              // carapace
        for (let i = 0; i < 6; i++) add(J.abd, G.sph(b * (1.05 - i * .05), 10, 7), i % 2 ? M.mark : M.chitin, 0, 0, -b * (.1 + i * .45)).scale.set(1.15, .5, .55);
        J.tailBase = grp(J.abd, 0, b * .15, -b * 2.6);
        J.sting = scorpionTail(J.tailBase, { len: b * 6, r: b * .3, color: c.crystal ? c.color : c.mark, sting: c.crystal ? 0x2030a0 : 0x1a1008, n: 6 });
        if (c.crystal) J.sting.forEach(seg => seg.traverse(m => { if (m.isMesh) m.material = M.chitin; }));
        J.eyes = [];
        const eyeM = c.glow ? mat(c.eye, { emissive: c.eye, emissiveIntensity: 1.5 }) : mat(c.eye, { roughness: .1, metalness: .3 });
        for (const s of [1, -1]) J.eyes.push(add(J.head, G.sph(b * .1, 6, 5), eyeM, s * b * .15, b * .45, b * .8));
        this.buildClaws(add, grp, b * 1.15, b * .9, 1.7);
    }

    buildCrab(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.sph(b * 1.6, 16, 10), M.chitin, 0, 0, 0).scale.set(1.25, .45, .95);           // wide carapace
        add(J.body, G.sph(b * 1.3, 12, 8), M.mark, 0, -b * .15, 0).scale.set(1.3, .3, .9);
        for (let i = 0; i < 9; i++) add(J.body, G.cone(b * .1, b * .25, 4), M.mark, (i - 4) * b * .38, b * .45 - Math.abs(i - 4) * b * .06, b * .9 - Math.abs(i - 4) * b * .12).rotation.x = .6;   // rim spikes
        if (c.spiderLegs) for (let i = 0; i < 10; i++) add(J.body, G.cone(b * .1, b * .3, 4), M.mark, Math.sin(i) * b * 1.3, b * .6, Math.cos(i * 1.7) * b * .9);
        J.eyes = [];
        for (const s of [1, -1]) {                                                                    // eye stalks
            const st = grp(J.head, s * b * .35, b * .4, b * 1.2);
            add(st, G.cyl(b * .05, b * .06, b * .4, 5), M.chitin, 0, b * .2, 0);
            J.eyes.push(add(st, G.sph(b * .1, 7, 5), mat(c.eye, { roughness: .1 }), 0, b * .42, 0));
            J.feelers.push([st, s]);
        }
        this.buildClaws(add, grp, b * 1.6, b * 1.3, 1.1);
    }

    // pincers on two-segment arms (scorpion pedipalps, crab claws)
    buildClaws(add, grp, x, z, size) {
        const D = this.D, J = this.j, M = this.mats, b = D.body * size;
        for (const s of [1, -1]) {
            const sh = grp(J.body, s * x * .6, 0, z);
            add(sh, G.cyl(D.R * 1.6, D.R * 1.3, b * 1.1, 6), M.chitin, 0, 0, b * .55).rotation.x = Math.PI / 2;
            const el = grp(sh, 0, 0, b * 1.1);
            add(el, G.sph(D.R * 1.6, 7, 5), M.chitin);
            add(el, G.cyl(D.R * 1.5, D.R * 1.8, b * .9, 6), M.chitin, 0, 0, b * .45).rotation.x = Math.PI / 2;
            const hand = grp(el, 0, 0, b * .9);
            add(hand, G.sph(b * .38, 10, 8), M.mark, 0, 0, b * .25).scale.set(.75, .6, 1.2);       // palm
            const fixed = add(hand, G.cone(b * .14, b * .7, 5), M.chitin, s * b * .1, 0, b * .8);
            fixed.rotation.set(Math.PI / 2, 0, 0);
            const finger = grp(hand, -s * b * .12, 0, b * .5);
            add(finger, G.cone(b * .12, b * .65, 5), M.chitin, 0, 0, b * .3).rotation.x = Math.PI / 2;
            sh.rotation.y = s * .5;
            el.rotation.y = -s * 1.1;
            J.claws.push({ g: sh, el, finger, s, kind: 'pincer' });
        }
    }

    buildFlyer(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.mats, b = D.body;
        add(J.body, G.sph(b * 1.3, 12, 9), M.chitin, 0, 0, 0).scale.set(1, 1, 1.2);                 // thorax
        J.wings = [];
        if (c.wasp) {
            add(J.abd, G.sph(b * .3, 6, 5), M.chitin, 0, 0, -b * .4);                                 // wasp waist
            for (let i = 0; i < 4; i++) add(J.abd, G.sph(b * (1.4 - Math.abs(i - 1.2) * .25), 12, 8), i % 2 ? M.mark : M.chitin, 0, -b * .1 * i, -b * (1.0 + i * .7)).scale.set(1, .95, .6);
            J.stinger = add(J.abd, G.cone(b * .15, b * .7, 6), M.dark, 0, -b * .4, -b * 3.7);
            J.stinger.rotation.x = -Math.PI / 2 - .3;
        } else {                                                                                       // dragonfly: long thin abdomen
            for (let i = 0; i < 9; i++) add(J.abd, G.cyl(b * .32, b * .36, b * .62, 7), i % 2 ? M.mark : M.chitin, 0, 0, -b * (.5 + i * .6)).rotation.x = Math.PI / 2;
            J.stinger = add(J.abd, G.cone(b * .12, b * .6, 5), M.dark, 0, 0, -b * 6);
            J.stinger.rotation.x = -Math.PI / 2;
        }
        const wingM = new THREE.MeshStandardMaterial({ color: c.wasp ? 0xc8c0b0 : 0x6a2a2a, transparent: true, opacity: .35, roughness: .2, side: THREE.DoubleSide, depthWrite: false });
        const nw = c.dragonfly ? 2 : 1;
        for (let w = 0; w < nw; w++) for (const s of [1, -1]) {
            const root = grp(J.body, s * b * .6, b * .9, b * (.3 - w * .7));
            const len = b * (c.dragonfly ? 6 : 4.5) * (1 - w * .08);
            const m = new THREE.Mesh(G.sph(1, 10, 6), wingM);
            m.scale.set(len / 2, .004, b * (c.dragonfly ? .7 : 1.2));
            m.position.set(s * len / 2, 0, -b * .2);
            m.castShadow = false;
            root.add(m);
            root.rotation.y = s * (c.wasp ? -.5 : -.12 + w * .2);
            J.wings.push({ root, s, w });
        }
        const hb = b * 1.0;
        add(J.head, G.sph(hb, 10, 8), M.chitin, 0, 0, hb * .9);
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(J.head, G.sph(hb * (c.dragonfly ? .75 : .55), 10, 8), mat(c.eye, { roughness: .1, metalness: .4 }), s * hb * .55, hb * .2, hb * 1.0));
            const m = grp(J.head, s * hb * .3, -hb * .6, hb * 1.5);
            add(m, G.cone(hb * .12, hb * .5, 4), M.dark, 0, -hb * .1, 0).rotation.x = Math.PI;
            J.fangs.push([m, s]);
            if (c.wasp) {
                const fe = grp(J.head, s * hb * .25, hb * .6, hb * 1.4);
                add(fe, G.cyl(D.R * .6, D.R * .4, hb * 2, 4), M.dark, 0, hb, 0);
                fe.rotation.set(.8, 0, -s * .5);
                J.feelers.push([fe, s]);
            }
        }
    }

    applyLeg(L, a0, a1, a2, z, lift) {
        const front = L.pair === 0 ? this.p.front : L.pair === 1 ? this.p.front * .35 : 0;
        L.top.rotation.y = L.yaw0 + a0 * L.side + front * -.3 * L.side;
        L.top.rotation.z = (z + lift * .35 + front) * L.side;
        L.knee.rotation.z = -(a1 + lift * .2 - front * .5) * L.side;
        L.low.rotation.z = -a2 * L.side;
    }

    statePose(state, c, t) {
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || .7;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .7) % 1;
                let P = this.mix(this.STAND, this.A1, smooth(p / .3));
                if (p > .3) P = this.mix(P, this.A2, smooth((p - .3) / .16));
                if (p > .5) P = this.mix(P, this.A3, smooth((p - .5) / .14));
                if (p > .74) P = this.mix(P, this.STAND, smooth((p - .74) / .26));
                return P;
            }
            case 'defend': {
                const P = { ...this.DEFEND };
                P.front += Math.sin(t * 3) * .12;
                P.jaw += Math.sin(t * 8) * .1;
                P.clawOpen = Math.max(0, P.clawOpen + Math.sin(t * 4) * .3);
                return P;
            }
            case 'hit': return this.HIT;
            case 'kneel': case 'lie': return this.LIE;
            case 'death': return this.DEAD;
            default: {
                const P = state === 'idle' ? this.idlePose() : { ...this.STAND };
                if (state === 'idle') P.clawOpen += Math.max(0, Math.sin(t * .9)) * .2;
                return P;
            }
        }
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j, dead = state === 'death', grounded = state === 'death' || state === 'lie' || state === 'kneel';
        J.abd.rotation.x = q.abd + (state === 'idle' ? Math.sin(t * 1.6) * .03 : 0);
        for (const [f, s] of J.fangs) f.rotation.y = s * q.jaw * .6 * (this.kind === 'spider' ? -1 : 1);
        for (const [f, s] of J.feelers) {
            f.rotation.y = Math.sin(t * 3.1 + s) * .15 * (dead ? 0 : 1);
            if (this.kind === 'spider') f.rotation.x = -.3 - q.jaw * .4 + Math.sin(t * 2.3 + s * 2) * .15;
        }
        for (const C of J.claws) {
            if (C.kind === 'pincer') {
                C.g.rotation.x = -q.claw * .35;
                C.g.rotation.y = C.s * (.5 - q.claw * .3);
                C.el.rotation.y = -C.s * (1.1 - q.claw * .5);
                C.el.rotation.x = -q.claw * .35;
                C.finger.rotation.y = -C.s * q.clawOpen * .7;
            } else if (C.kind === 'raptor') {                                                         // mantis: folded → strike out → snap shut
                C.g.rotation.x = -.4 - q.claw * .9;
                C.el.rotation.x = 2.6 - Math.max(0, q.claw) * 1.4 + Math.min(0, q.claw) * .4;
                C.hook.rotation.x = 2.4 - q.clawOpen * 1.6;
            } else C.g.rotation.x = -q.claw * 1.4 + Math.sin(t * 1.5) * .05;                            // reaper scythes
        }
        if (J.sting) {
            J.tailBase.rotation.x = .2;
            J.sting.forEach((seg, i) => {
                seg.rotation.x = (dead ? .1 : .55) + q.sting * (i > 3 ? .45 : -.12) + Math.sin(t * 1.8 - i * .5) * .03;
                seg.rotation.y = Math.sin(t * 1.2 - i * .4) * .04;
            });
        }
        if (J.wings) {                                                                                  // buzzing wings, hovering bob
            const buzz = grounded ? 0 : 1;
            for (const W of J.wings) {
                W.root.rotation.z = W.s * (buzz ? Math.sin(t * 47 + W.w * 1.6) * .7 + .1 : -.05);
                W.root.rotation.y = W.s * (buzz ? (this.c.wasp ? -.25 : -.1 + W.w * .2) : (this.c.wasp ? -1.3 : -.15 + W.w * .3));
            }
            if (buzz) J.body.position.y += Math.sin(t * 2.2) * .04 + Math.sin(t * 5.3) * .01;
            if (J.stinger) J.abd.rotation.x += q.sting * .3;
        }
        if (!grounded && state === 'idle' && !this.fly) {                                               // restless leg twitches
            const L = J['L' + Math.floor((t * .7) % this.D.pairs.length)];
            if (L) L.top.rotation.z += Math.max(0, Math.sin(t * 9)) * .08 * L.side;
        }
    }
}
