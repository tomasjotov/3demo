import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';
import { G, mat } from '../avatar/kit.js';
import { makeWing, glowMat } from './creatureParts.js';

/*
 * ProceduralSerpent — legless long bodies: snakes, worms, slugs, grubs and centipedes on one spine.
 *
 * The body is a chain of segments laid along a spine that is rebuilt every frame from a few pose numbers:
 *   front part (neck): rises from the ground in an S-curve (rise), leans forward to strike (lean), sways (sway);
 *   ground part: trails behind with a sideways travelling wave (amp, the slither) or wound into a coil (coil);
 *   burrowers (sandworm, forest wurm) keep the rear under the ground (sink) and push out of a mound.
 * Each segment is placed on the spine (position + orientation from parallel-transported "back" vectors), so nothing
 * is parented in a long joint chain. The hydra has several necks on one body; the serpent guardian and the goblin
 * snake carry a torso / arms on the front.
 *
 *   root (yaw, scale)
 *   ├─ seg[i] (ground + neck segments, head first) ─ main ellipsoid (scaled), belly, decoration
 *   ├─ neck[k].seg[i] … (hydra)          └─ head (jaw, tongue / mandibles / maw petals / tentacles)
 *   └─ mound (burrowers)
 *
 * Kinds: snake (python, crystal snake, sea serpent, goblin snake, winged serpent, hydra, forest wurm, serpent guardian),
 * worm (aakf with feelers, corpse wurm, shuddering leech, sandworm, swamp worm), slug (cave slug), grub (cave worms),
 * centipede (nugotha with wings, sterenda).
 * States: idle (head raised, tongue / feelers, slow sway; the python lies coiled), walk / run (slither wave),
 * attack (draw back → strike with the jaws / maw / mandibles; hydra heads one after another, guardian slashes with the
 * sword, burrowers rise high and slam down), defend (rears up high, hisses), hit, kneel / lie (coiled or flat on the
 * ground), death (stretched out, rolled on the side, mouth open).
 */

const TAU = Math.PI * 2;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export const SERPENT_VARIANTS = {
    python: { kind: 'snake', head: 'snake', L: 11, R: .28, Lf: 2.2, color: 0x8aa860, belly: 0xd8d0a0, mark: 0x5a3a20, zigzag: true, eye: 0xc0a030, coilIdle: 1, rise: .4, scale: 1 },
    'crystal-snake': { kind: 'snake', head: 'snake', L: 4, R: .1, color: 0xb8dcff, belly: 0xe8f4ff, crystal: true, eye: 0x4080ff, coilIdle: .45, rise: .65, scale: 1 },
    'sea-serpent': { kind: 'snake', head: 'dragon', L: 14, R: .42, Lf: 5.5, color: 0x1c2a38, belly: 0x5a6a68, fin: 0x8a1a30, eye: 0xff2a20, rise: 1, scale: 1 },
    'goblin-snake': { kind: 'snake', head: 'goblin', L: 6, R: .12, Lf: 1.3, color: 0x3a7a3a, belly: 0xb8c070, skin: 0x7c7a6c, eye: 0xe0c030, arms: true, coilIdle: .3, rise: .75, upright: true, scale: 1 },
    'winged-serpent': { kind: 'snake', head: 'snake', L: 3, R: .075, color: 0x2a8a7a, belly: 0xb8d0a0, eye: 0xd0c020, fangs: true, wings: 0x2e4a44, rise: .75, scale: 1 },
    hydra: { kind: 'snake', head: 'dragon', heads: 5, L: 6, R: .5, Lf: 2.1, neckR: .19, coilIdle: .3, color: 0x9a7a3a, belly: 0xd8bc78, mark: 0x6a4a20, horn: 0x3a2a18, eye: 0xf0b020, mace: true, rise: .9, scale: 1 },
    'forest-wurm': { kind: 'snake', head: 'beast', L: 9, R: .5, Lf: 3, color: 0x4a4a2a, belly: 0x7a6a40, moss: 0x4a6a24, sink: .9, mound: 0x4a3a24, rise: .8, scale: 1 },
    'serpent-guardian': { kind: 'snake', head: 'naga', L: 5, R: .17, Lf: .9, color: 0x4a6a3a, belly: 0xc8b878, skin: 0xa07a58, eye: 0x2a1a10, coilIdle: .4, rise: 1, upright: true, scale: 1 },
    aakf: { kind: 'worm', head: 'feelers', L: 4, R: .22, Lf: 1.3, color: 0x1e1e22, belly: 0x3a3a42, rise: .5, scale: 1 },
    'corpse-wurm': { kind: 'worm', head: 'skull', L: 7, R: .48, Lf: 2.4, color: 0x4a3a30, belly: 0x6a5040, bone: 0xc8b8a0, corpse: true, rise: .7, scale: 1 },
    'leech-shuddery': { kind: 'worm', head: 'sucker', L: 2, R: .12, Lf: .8, color: 0x4a3024, belly: 0xb0784a, rise: .7, scale: 1 },
    sandworm: { kind: 'worm', head: 'maw', petals: 3, L: 16, R: 1.05, Lf: 6, color: 0xb89a6a, belly: 0xd8c09a, bands: 0x8a6a40, sink: 1, mound: 0xc8a870, rise: 1, scale: 1 },
    'swamp-worm': { kind: 'worm', head: 'maw', L: 3, R: .3, Lf: 1.4, color: 0x4a6a2a, belly: 0x8a9a4a, bristle: true, sink: .4, mound: 0x3a3a22, rise: .7, scale: 1 },
    'cave-slug': { kind: 'slug', head: 'slug', L: 2.6, R: .32, Lf: .8, color: 0x3a2a52, belly: 0x5a4a6a, spots: 0x60c8ff, rise: .3, scale: 1 },
    'maggot-lair-1': { kind: 'grub', head: 'maggot', L: 1.1, R: .2, Lf: .55, color: 0x3a2a38, belly: 0x8a5a6a, eye: 0xff2020, rise: .75, upright: true, scale: 1 },
    'maggot-lair-2': { kind: 'grub', head: 'mother', L: 3.4, R: .75, Lf: 1.5, color: 0xd8d4cc, belly: 0xece8e0, eye: 0x101828, rise: .6, upright: true, scale: 1 },
    nugotha: { kind: 'centipede', head: 'centipede', L: 2.6, R: .12, Lf: .8, color: 0x4a5a2a, belly: 0x6a5a34, eye: 0x101008, legs: 0x2a2a18, venom: 0x80ff40, insectWings: true, rise: .3, scale: 1 },
    sterenda: { kind: 'centipede', head: 'centipede', L: 3.6, R: .16, Lf: 1.1, color: 0x3a2018, belly: 0x6a3a28, eye: 0xff2010, legs: 0x5a2a1a, antennae: 1.3, rise: .65, scale: 1 }
};

// pose keys (damped); every state gives all of them
const KEYS = ['rise', 'lean', 'bz', 'headX', 'jaw', 'amp', 'coil', 'roll', 'sway', 'arm', 'guard', 'wing'];

export class ProceduralSerpent {
    constructor(variant = 'python', { scale = 1 } = {}) {
        this.variant = SERPENT_VARIANTS[variant] ? variant : 'python';
        const c = this.c = { heads: 1, Lf: null, sink: 0, coilIdle: 0, ...SERPENT_VARIANTS[this.variant] };
        c.Lf = c.Lf || Math.min(c.L * .32, 2);
        this.size = c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.name = 'serpent';
        this.root.scale.setScalar(this.size);
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.yaw = null;
        this.state = null;
        this.stateTime = 0;
        this.gait = 0;
        this.flick = 0; this.flickTimer = 1 + Math.random() * 2;
        this.STAND = { rise: c.rise, lean: 0, bz: 0, headX: 0, jaw: .02, amp: .12, coil: c.coilIdle, roll: 0, sway: 0, arm: 0, guard: 0, wing: 0 };
        this.p = { ...this.STAND };
        // spine sampling: ~1.4 radii per segment
        const n = Math.max(14, Math.min(40, Math.round(c.L / (c.R * 1.45))));
        this.ds = c.L / n;
        this.nf = Math.max(3, Math.round(c.Lf / this.ds));
        this.ng = n - this.nf;
        this.mats();
        this.build();
    }

    mats() {
        const c = this.c;
        const gl = c.crystal ? { roughness: .08, metalness: .1, transparent: true, opacity: .78, emissive: 0x3060a0, emissiveIntensity: .3 }
            : c.kind === 'slug' ? { roughness: .25, transparent: true, opacity: .9 } : { roughness: c.kind === 'snake' ? .55 : .7 };
        this.M = {
            body: mat(c.color, gl), belly: mat(c.belly, { ...gl, emissiveIntensity: c.crystal ? .15 : 0 }),
            mark: mat(c.mark || 0x202020, { roughness: .7 }), dark: mat(0x0a0806, { roughness: .9 }),
            tooth: mat(0xf0e8d0, { roughness: .35 }), bone: mat(c.bone || 0xd8cdb0, { roughness: .8 }),
            eye: mat(c.eye || 0x101010, { roughness: .15, emissive: c.eye || 0, emissiveIntensity: c.eye ? .45 : 0 }),
            mouth: mat(0x5a1a1e, { roughness: .6 }), tongue: mat(0xb02a3a, { roughness: .5 }),
            skin: mat(c.skin || 0x9a7a5a, { roughness: .7 })
        };
    }

    // radius along the body, s from the head (0) to the tail tip (L)
    radius(s, neck = false) {
        const c = this.c, u = Math.min(1, s / c.L);
        if (neck) return c.neckR * (1 + .45 * (s / c.Lf));
        switch (c.kind) {
            case 'worm': return c.R * (u < .06 ? .82 + u * 3 : 1) * (u > .8 ? 1 - (u - .8) / .2 * .5 : 1);
            case 'slug': return c.R * (.62 + .38 * smooth(u / .3)) * (u > .55 ? 1 - (u - .55) / .45 * .85 : 1);
            case 'grub': return c.R * (.72 + .28 * Math.sin(Math.PI * Math.min(1, u * 1.25))) * (u > .78 ? 1 - (u - .78) / .22 * .55 : 1);
            case 'centipede': return c.R * (u > .85 ? 1 - (u - .85) / .15 * .45 : 1);
            default: return c.R * Math.min(1, .55 + u * 2.4) * (u > .5 ? Math.max(.12, 1 - (u - .5) / .5 * .9) : 1);
        }
    }

    build() {
        const c = this.c, M = this.M, J = this.j, ds = this.ds;
        this.sph = G.sph(1, c.R > .4 ? 14 : 10, c.R > .4 ? 10 : 8);
        this.ico = new THREE.IcosahedronGeometry(1, 0);
        this.tube = c.kind === 'snake' || c.kind === 'slug';
        this.cyl = c.crystal ? new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2) : new THREE.CylinderGeometry(1, 1, 1, c.R > .4 ? 14 : 10, 1, true).rotateX(Math.PI / 2);
        this.tmp = { f: new THREE.Vector3(), x: new THREE.Vector3(), m: new THREE.Matrix4(), v: new THREE.Vector3(), h: new THREE.Vector3(), u: new THREE.Vector3(0, 1, 0) };
        this._d = new THREE.Vector3();
        this._dBase = new THREE.Vector3();
        // necks: one for most, several for the hydra; the body behind them is shared
        this.necks = [];
        for (let k = 0; k < c.heads; k++) {
            const neck = { k, pts: [], segs: [], yaw0: c.heads > 1 ? (k - (c.heads - 1) / 2) * .55 : 0, rise: 1.1 - Math.abs(k - (c.heads - 1) / 2) * .16, att: 0 };
            for (let i = 0; i <= this.nf; i++) neck.pts.push(new THREE.Vector3());
            for (let i = 0; i < this.nf; i++) neck.segs.push(this.segment(i * ds, c.heads > 1, i));
            neck.head = this.buildHead(neck);
            this.necks.push(neck);
        }
        this.gpts = [];
        for (let i = 0; i <= this.ng; i++) this.gpts.push(new THREE.Vector3());
        this.gsegs = [];
        for (let i = 0; i < this.ng; i++) this.gsegs.push(this.segment(c.heads > 1 ? c.L * (.22 + .78 * i / this.ng) : (this.nf + i) * ds, false, this.nf + i));
        this.gTurn = new Float32Array(this.ng + 1);
        this.gYaw = new Float32Array(this.ng + 1);
        if (c.heads > 1) {                                                           // hydra: heavy shoulders where the necks start
            this.shoulder = this.add(this.root, this.sph, M.body);
            this.shoulder.scale.set(c.R * 1.25, c.R * 1.0, c.R * 1.4);
        }
        if (c.mace) {                                                                // hydra: mace at the tail tip
            const tip = this.gsegs[this.ng - 1].g;
            this.add(tip, G.sph(c.R * .32, 10, 8), M.body, 0, 0, -ds * .6);
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * TAU, sp = this.add(tip, G.cone(c.R * .07, c.R * .3, 5), M.bone, Math.cos(a) * c.R * .3, Math.sin(a) * c.R * .3, -ds * .6);
                sp.rotation.set(0, 0, a - Math.PI / 2);
            }
            this.add(tip, G.cone(c.R * .08, c.R * .35, 5), M.bone, 0, 0, -ds * .6 - c.R * .4).rotation.x = -Math.PI / 2;
        }
        if (c.sink && c.mound) {                                                     // burrowers: earth mounds where the body enters the ground
            const dirt = mat(c.mound, { roughness: 1 });
            this.mounds = [0, 1].map(() => {
                const m = this.add(this.root, G.cyl(c.R * 1.2, c.R * 2.1, c.R * .5, 14), dirt);
                m.receiveShadow = true;
                for (let i = 0; i < 6; i++) this.add(m, G.sph(c.R * .3, 6, 5), dirt, Math.cos(i) * c.R * 1.7, c.R * .2, Math.sin(i) * c.R * 1.7).scale.set(1, .5, 1);
                return m;
            });
        }
        if (c.wings) {                                                               // winged serpent: membrane wings just behind the head
            const hd = this.necks[0].head, hr = hd.hr;
            J.wings = [1, -1].map(s => makeWing(hd.g, s, { x: s * hr * .7, y: hr * .2, z: -hr * 2.2, len: c.L * .3, kind: 'bat', color: c.wings, membrane: 0x3a6a5a }));
        }
        if (c.insectWings) {                                                         // nugotha: two pairs of thin wings on the back
            const wm = mat(0xd8e0c8, { roughness: .3, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false });
            const wseg = this.gsegs[1].g;
            J.iwings = [];
            for (const s of [1, -1]) for (const k of [0, 1]) {
                const g = this.grp(wseg, s * c.R * .4, c.R * .8, -k * c.R * 1.4);
                const w = this.add(g, G.sph(1, 8, 4), wm, s * c.L * .14, 0, 0);
                w.scale.set(c.L * .14, .005, c.L * .045);
                w.castShadow = false;
                J.iwings.push({ g, s, k });
            }
        }
    }

    add(parent, geo, m, x = 0, y = 0, z = 0) {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }
    grp(parent, x = 0, y = 0, z = 0) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        return g;
    }

    // one body segment: group placed on the spine every frame (z = towards the head, y = back)
    segment(s, neck, idx) {
        const c = this.c, M = this.M, ds = this.ds;
        const r = this.radius(s + ds / 2, neck);
        const g = this.grp(this.root);
        const len = Math.max(ds * .7, r * .9);
        const flat = c.kind === 'slug' ? .62 : c.kind === 'centipede' ? .7 : c.kind === 'snake' && !c.crystal ? .85 : 1;
        const band = c.kind === 'grub' && idx % 2 ? 1.08 : 1;
        let main;
        if (this.tube) {                                                           // smooth tube: cylinder + round joint at the front end
            main = this.add(g, this.cyl, M.body);
            main.scale.set(r, r * flat, ds * 1.02);
            this.add(g, c.crystal ? this.ico : this.sph, M.body, 0, 0, ds / 2).scale.set(r, r * flat, r);
            if (!c.crystal) this.add(g, this.cyl, M.belly, 0, -r * flat * .42, 0).scale.set(r * .8, r * flat * .6, ds * 1.02);
        } else {                                                                   // ringed body: overlapping ellipsoids
            main = this.add(g, this.sph, M.body);
            main.scale.set(r * band, r * flat * band, len);
            const belly = this.add(g, this.sph, M.belly, 0, -r * flat * .38, 0);
            belly.scale.set(r * .82 * band, r * flat * .62 * band, len * .96);
        }
        const deco = this.decorate(g, r, flat, idx, neck);
        return { g, r, main, deco };
    }

    decorate(g, r, flat, i, neck) {
        const c = this.c, M = this.M, ds = this.ds, add = this.add.bind(this), out = [];
        if (c.zigzag) add(g, G.box(r * .5, r * .05, ds * .95), M.mark, 0, r * flat * .97, 0).rotation.y = i % 2 ? .55 : -.55;
        if (c.mark && c.heads > 1 && i % 2) add(g, G.box(r * .6, r * .06, ds * .5), M.mark, 0, r * flat * .97, 0);
        if (c.crystal && i % 3 === 1) for (const s of [1, -1]) {
            const sh = add(g, G.cone(r * .28, r * .9, 4), M.belly, s * r * .55, r * .55, 0);
            sh.rotation.set(-.6, 0, -s * .7);
        }
        if (c.fin && (neck || i < this.nf + this.ng * .7)) {                     // sea serpent: red dorsal spines with a web
            const sp = add(g, G.cone(r * .2, r * 1.1, 4), mat(c.fin, { roughness: .6 }), 0, r * flat * 1.25, -ds * .1);
            sp.rotation.x = -.5;
        }
        if (c.moss && i % 2 === 0) {
            const m = add(g, G.sph(r * .5, 7, 5), mat(c.moss, { roughness: 1 }), (i % 4 ? .3 : -.3) * r, r * flat * .82, 0);
            m.scale.set(1, .35, 1.2);
        }
        if (c.bands) add(g, G.torus(r * .97, r * .07, 5, 18), mat(c.bands, { roughness: .9 }), 0, 0, -ds * .45);
        if (c.bristle && i % 2) for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI - Math.PI / 2 + .2, b = add(g, G.cone(r * .04, r * .45, 3), M.belly, Math.sin(a) * r, Math.cos(a) * r * flat, 0);
            b.rotation.z = -a;
        }
        if (c.spots && i % 2) for (let k = 0; k < 3; k++) {
            const sp = add(g, G.sph(r * .07, 6, 4), glowMat(c.spots, .9), (k - 1) * r * .45, r * flat * .9, (k % 2 - .5) * ds * .4);
            sp.castShadow = false;
        }
        if (c.corpse) {                                                           // corpse wurm: ribs, bones and skulls of the swallowed
            add(g, G.torus(r * .95, r * .06, 4, 12, Math.PI), M.bone, 0, 0, ds * .2).rotation.z = 0;
            if (i % 3 === 0) {
                const sk = add(g, G.sph(r * .26, 8, 6), M.bone, (i % 2 ? .6 : -.6) * r, r * .55, 0);
                add(sk, G.sph(r * .06, 5, 4), M.dark, r * .1, .02 * r, r * .22);
                add(sk, G.sph(r * .06, 5, 4), M.dark, -r * .1, .02 * r, r * .22);
            }
            if (i % 3 === 1) {
                const b = add(g, G.cyl(r * .05, r * .05, r * 1.2, 5), M.bone, (i % 2 ? -.5 : .5) * r, r * .6, 0);
                b.rotation.set(.4, 0, 1.1);
            }
        }
        if (c.kind === 'centipede' && !neck) {                                    // a pair of legs on every body segment
            const lm = mat(c.legs, { roughness: .6 });
            for (const s of [1, -1]) {
                const hip = this.grp(g, s * r * .8, -r * .1, 0);
                const up = this.add(hip, G.cyl(r * .1, r * .08, r * 1.3, 5), lm, s * r * .5, r * .3, 0);
                up.rotation.z = s * (Math.PI / 2 - .55);
                const knee = this.grp(hip, s * r * 1.05, r * .62, 0);
                const lo = this.add(knee, G.cyl(r * .07, r * .03, r * 1.5, 5), lm, s * r * .2, -r * .7, 0);
                lo.rotation.z = s * .28;
                out.push({ hip, s, i });
            }
        }
        if (c.kind === 'grub' && c.head === 'maggot' && i % 2) for (const s of [1, -1]) {   // little fleshy feet
            add(g, G.cone(r * .12, r * .4, 5), M.belly, s * r * .7, -r * .65, 0).rotation.z = s * 2.6;
        }
        return out;
    }

    // ---------------------------------------------------------------- heads
    buildHead(neck) {
        const c = this.c, M = this.M, add = this.add.bind(this), grp = this.grp.bind(this);
        const r0 = c.heads > 1 ? c.neckR : this.radius(0);
        const head = grp(this.root), H = { g: head, r0 };
        const hr = c.head === 'goblin' ? .17 : r0 * (c.kind === 'worm' || c.kind === 'grub' ? 1.05 : c.head === 'dragon' ? 1.9 : 1.55);
        H.hr = hr;
        switch (c.head) {
            case 'snake':
            case 'dragon':
            case 'beast': {
                const dragon = c.head === 'dragon', beast = c.head === 'beast';
                add(head, this.sph, M.body, 0, 0, hr * .5).scale.set(hr * .92, hr * .52, hr * (dragon ? 1.45 : 1.15));
                if (dragon || beast) add(head, G.box(hr * 1.1, hr * .42, hr * 1.3), M.body, 0, hr * .02, hr * 1.25);   // snout
                add(head, this.sph, M.belly, 0, -hr * .2, hr * .4).scale.set(hr * .8, hr * .3, hr * 1.1);
                H.jaw = grp(head, 0, -hr * .22, hr * .1);
                add(H.jaw, this.sph, M.belly, 0, -hr * .06, hr * (dragon || beast ? .9 : .55)).scale.set(hr * .78, hr * .2, hr * (dragon || beast ? 1.25 : 1));
                add(H.jaw, this.sph, M.mouth, 0, hr * .06, hr * (dragon || beast ? .9 : .55)).scale.set(hr * .62, hr * .08, hr * (dragon || beast ? 1.1 : .85));
                const teeth = dragon || beast ? 6 : 0;
                for (const s of [1, -1]) {
                    for (let i = 0; i < teeth; i++) {
                        add(head, G.cone(hr * .05, hr * .2, 4), M.tooth, s * hr * .42, -hr * .26, hr * (.55 + i * .22)).rotation.x = Math.PI;
                        add(H.jaw, G.cone(hr * .04, hr * .16, 4), M.tooth, s * hr * .36, hr * .08, hr * (.5 + i * .22));
                    }
                    if (c.fangs || c.head === 'snake') {
                        const f = add(head, G.cone(hr * .045, hr * (c.fangs ? .45 : .2), 5), M.tooth, s * hr * .3, -hr * .3, hr * 1.25);
                        f.rotation.x = Math.PI - .25;
                    }
                    if (!beast) {
                        const e = add(head, G.sph(hr * .16, 8, 6), M.eye, s * hr * .5, hr * .22, hr * (dragon ? .55 : .7));
                        e.scale.set(.8, .9, 1);
                        add(head, G.box(hr * .03, hr * .2, hr * .05), M.dark, s * hr * .62, hr * .22, hr * (dragon ? .58 : .73));
                        add(head, G.box(hr * .25, hr * .08, hr * .3), M.body, s * hr * .45, hr * .36, hr * (dragon ? .5 : .66)).rotation.z = s * .35;   // brow
                    }
                    if (dragon) {
                        const horn = add(head, G.cone(hr * .1, hr * .9, 6), mat(c.horn || c.fin || 0x2a2018, { roughness: .6 }), s * hr * .35, hr * .4, -hr * .25);
                        horn.rotation.set(-1.9, 0, s * .25);
                    }
                    if (c.fin) {                                                     // sea serpent: frills behind the jaws
                        const fr = add(head, G.cone(hr * .35, hr * 1.2, 3), mat(c.fin, { roughness: .6, side: THREE.DoubleSide }), s * hr * .75, 0, -hr * .2);
                        fr.rotation.set(-1.6, 0, s * 1.1);
                        fr.scale.set(1, 1, .15);
                    }
                }
                if (beast) for (let i = 0; i < 4; i++) add(head, G.sph(hr * .25, 6, 5), mat(c.moss, { roughness: 1 }), (i % 2 - .5) * hr * .6, hr * .4, hr * (.2 + i * .35)).scale.set(1, .4, 1.2);
                if (c.head === 'snake') {                                            // forked tongue
                    H.tongue = grp(head, 0, -hr * .2, hr * 1.2);
                    for (const s of [1, -1]) add(H.tongue, G.box(hr * .03, hr * .02, hr * .6), M.tongue, s * hr * .03, 0, hr * .3).rotation.y = s * .15;
                    H.tongue.scale.z = .01;
                }
                if (c.crystal) head.traverse(m => { if (m.isMesh && m.geometry === this.sph && m.material === M.body) m.geometry = this.ico; });
                break;
            }
            case 'goblin': {                                                        // goblin head: grey rough skin, flat wide nose, big teeth
                add(head, this.sph, M.skin, 0, hr * .1, hr * .2).scale.set(hr * .9, hr * .95, hr * .9);
                add(head, G.sph(hr * .28, 8, 6), M.skin, 0, -hr * .05, hr * .95).scale.set(1.5, .8, .9);     // nose
                for (const s of [1, -1]) {
                    add(head, G.sph(hr * .08, 6, 5), M.dark, s * hr * .14, -hr * .1, hr * 1.12);               // nostrils
                    const e = add(head, G.sph(hr * .17, 8, 6), M.eye, s * hr * .38, hr * .35, hr * .82);
                    e.scale.set(1, .8, .6);
                    add(head, G.sph(hr * .07, 6, 5), M.dark, s * hr * .38, hr * .35, hr * .92);
                    add(head, G.box(hr * .4, hr * .1, hr * .2), M.skin, s * hr * .35, hr * .55, hr * .78).rotation.z = -s * .3;
                    const ear = add(head, G.cone(hr * .2, hr * .9, 4), M.skin, s * hr * .95, hr * .3, -hr * .1);
                    ear.rotation.set(0, 0, -s * 1.25);
                    ear.scale.set(1, 1, .4);
                }
                H.jaw = grp(head, 0, -hr * .35, hr * .3);
                add(H.jaw, this.sph, M.skin, 0, -hr * .1, hr * .4).scale.set(hr * .78, hr * .35, hr * .7);
                add(H.jaw, this.sph, M.mouth, 0, hr * .05, hr * .5).scale.set(hr * .6, hr * .12, hr * .55);
                for (let i = -3; i <= 3; i++) {
                    add(head, G.cone(hr * .06, hr * .25, 4), M.tooth, i * hr * .12, -hr * .38, hr * .95 - Math.abs(i) * hr * .06).rotation.x = Math.PI;
                    add(H.jaw, G.cone(hr * .055, hr * .22, 4), M.tooth, i * hr * .12, hr * .08, hr * .85 - Math.abs(i) * hr * .06);
                }
                break;
            }
            case 'naga': this.buildTorso(H, hr); break;
            case 'skull': {                                                         // corpse wurm: a big skull, dark sockets (undead: no eyes)
                add(head, this.sph, M.bone, 0, hr * .25, hr * .3).scale.set(hr * .85, hr * .8, hr * .95);
                add(head, G.box(hr * 1.1, hr * .35, hr * .8), M.bone, 0, -hr * .15, hr * .75);
                for (const s of [1, -1]) {
                    add(head, G.sph(hr * .2, 8, 6), M.dark, s * hr * .32, hr * .3, hr * 1.05).scale.set(1, .9, .5);
                    const horn = add(head, G.cone(hr * .08, hr * .8, 5), M.bone, s * hr * .5, hr * .7, 0);
                    horn.rotation.set(-1.2, 0, s * .5);
                }
                add(head, G.cone(hr * .08, hr * .15, 3), M.dark, 0, hr * .02, hr * 1.18).rotation.x = Math.PI / 2;
                H.jaw = grp(head, 0, -hr * .3, hr * .3);
                add(H.jaw, G.box(hr * .95, hr * .18, hr * .9), M.bone, 0, -hr * .05, hr * .45);
                for (let i = -3; i <= 3; i++) {
                    add(head, G.box(hr * .1, hr * .16, hr * .08), M.tooth, i * hr * .14, -hr * .38, hr * 1.13);
                    add(H.jaw, G.box(hr * .1, hr * .14, hr * .08), M.tooth, i * hr * .13, hr * .1, hr * .88);
                }
                break;
            }
            case 'maw':
            case 'sucker': {                                                        // round mouth ringed with teeth; sandworm: three lips open like petals
                const sucker = c.head === 'sucker';
                add(head, G.torus(hr * .82, hr * .2, 6, 18), M.body, 0, 0, hr * .15);
                add(head, G.cyl(hr * .75, hr * .75, hr * .1, 16), M.mouth, 0, 0, 0).rotation.x = Math.PI / 2;
                add(head, G.cyl(hr * .45, hr * .45, hr * .12, 12), M.dark, 0, 0, hr * .02).rotation.x = Math.PI / 2;
                const ring = sucker ? 12 : 16;
                H.teeth = [];
                for (let k = 0; k < 2; k++) for (let i = 0; i < ring; i++) {
                    const a = (i + k * .5) / ring * TAU, rr = hr * (.62 - k * .2);
                    const t = add(head, G.cone(hr * (sucker ? .04 : .07), hr * (sucker ? .12 : .3), 4), M.tooth, Math.cos(a) * rr, Math.sin(a) * rr, hr * .12);
                    t.rotation.set(Math.PI / 2, 0, 0);
                    t.rotation.order = 'ZXY';
                    t.rotation.z = a + Math.PI / 2;
                    t.rotation.x = 1.0;
                    H.teeth.push(t);
                }
                if (c.petals) {
                    H.petals = [];
                    for (let i = 0; i < c.petals; i++) {
                        const pv = grp(head, 0, 0, hr * .2);
                        pv.rotation.z = i / c.petals * TAU;
                        const hinge = grp(pv, 0, hr * .85, 0);
                        const pl = add(hinge, G.sph(hr * .95, 10, 6, 0, TAU, 0, Math.PI / 2), M.body, 0, -hr * .45, hr * .3);
                        pl.scale.set(.85, .7, 1.1);
                        pl.rotation.x = Math.PI / 2;
                        for (let k = 0; k < 4; k++) add(hinge, G.cone(hr * .07, hr * .35, 4), M.tooth, (k - 1.5) * hr * .28, -hr * .3, hr * .9).rotation.x = Math.PI / 2 + .8;
                        H.petals.push(hinge);
                    }
                }
                break;
            }
            case 'feelers': {                                                       // aakf: blind blunt head with ten long feelers round the mouth
                add(head, this.sph, M.body, 0, 0, hr * .2).scale.set(hr * .95, hr * .9, hr * .8);
                add(head, G.cyl(hr * .4, hr * .4, hr * .1, 10), M.mouth, 0, 0, hr * .95).rotation.x = Math.PI / 2;
                H.feelers = [];
                const fm = mat(0x3a3438, { roughness: .6 });
                for (let i = 0; i < 10; i++) {
                    const a = i / 10 * TAU;
                    let p = grp(head, Math.cos(a) * hr * .55, Math.sin(a) * hr * .55, hr * .9);
                    const chain = [];
                    for (let k = 0; k < 6; k++) {
                        const g = grp(p), l = .17;
                        add(g, G.cyl(hr * .07 * (1 - k * .13), hr * .08 * (1 - k * .13), l, 5), fm, 0, 0, l / 2).rotation.x = Math.PI / 2;
                        chain.push(g);
                        p = grp(g, 0, 0, l);
                    }
                    H.feelers.push({ chain, a });
                }
                break;
            }
            case 'slug': {                                                          // cave slug: eye stalks and feelers
                add(head, this.sph, M.body, 0, 0, hr * .25).scale.set(hr * .8, hr * .55, hr * .8);
                H.stalks = [];
                for (const s of [1, -1]) {
                    const st = grp(head, s * hr * .3, hr * .3, hr * .5);
                    add(st, G.cyl(hr * .05, hr * .08, hr * .7, 6), M.body, 0, hr * .35, 0);
                    add(st, G.sph(hr * .1, 6, 5), glowMat(c.spots, .95), 0, hr * .72, 0);
                    st.rotation.set(.5, 0, -s * .35);
                    const fe = grp(head, s * hr * .35, -hr * .15, hr * .85);
                    add(fe, G.cyl(hr * .03, hr * .05, hr * .35, 5), M.body, 0, hr * .17, 0);
                    fe.rotation.set(1.2, 0, -s * .5);
                    H.stalks.push(st);
                }
                H.jaw = grp(head, 0, -hr * .3, hr * .55);
                add(H.jaw, G.box(hr * .4, hr * .05, hr * .25), M.mouth, 0, 0, 0);
                break;
            }
            case 'maggot':
            case 'mother': {
                const mother = c.head === 'mother';
                add(head, this.sph, M.body, 0, hr * .1, hr * .2).scale.set(hr, hr * .9, hr * .85);
                if (mother) {
                    for (const s of [1, -1]) {
                        add(head, G.sph(hr * .26, 10, 8), M.eye, s * hr * .45, hr * .3, hr * .72).scale.set(1, 1.1, .7);
                        add(head, G.sph(hr * .07, 6, 5), mat(0x8ab0ff, { emissive: 0x4060ff, emissiveIntensity: .6 }), s * hr * .5, hr * .42, hr * .9);
                    }
                } else {                                                            // one big red eye on the crown
                    add(head, G.sph(hr * .48, 10, 8), mat(0x2a1a20), 0, hr * .5, hr * .55);
                    add(head, G.sph(hr * .4, 10, 8), M.eye, 0, hr * .55, hr * .7).scale.set(1, 1, .8);
                    add(head, G.sph(hr * .14, 6, 5), M.dark, 0, hr * .55, hr * 1.0);
                }
                H.jaw = grp(head, 0, -hr * .3, hr * .5);
                add(H.jaw, this.sph, M.mouth, 0, 0, hr * .2).scale.set(hr * .5, hr * .22, hr * .35);
                for (let i = -2; i <= 2; i++) add(H.jaw, G.cone(hr * .05, hr * .2, 4), M.tooth, i * hr * .15, hr * .1, hr * .4);
                H.feelers = [];
                const n = mother ? 4 : 6, fm = mat(c.belly, { roughness: .6 });
                for (let i = 0; i < n; i++) {
                    const a = Math.PI + (i + .5) / n * Math.PI;
                    let p = grp(head, Math.cos(a) * hr * .5, Math.sin(a) * hr * .4 - hr * .2, hr * .6);
                    const chain = [];
                    for (let k = 0; k < 3; k++) {
                        const g = grp(p), l = hr * .3;
                        add(g, G.cyl(hr * .05, hr * .07, l, 5), fm, 0, 0, l / 2).rotation.x = Math.PI / 2;
                        chain.push(g);
                        p = grp(g, 0, 0, l);
                    }
                    H.feelers.push({ chain, a });
                }
                break;
            }
            case 'centipede': {
                add(head, this.sph, M.body, 0, 0, hr * .3).scale.set(hr * .9, hr * .5, hr * .75);
                for (const s of [1, -1]) {
                    add(head, G.sph(hr * .13, 6, 5), M.eye, s * hr * .45, hr * .2, hr * .65);
                    const mand = grp(head, s * hr * .35, -hr * .1, hr * .85);
                    const m1 = add(mand, G.cone(hr * .12, hr * .9, 5), mat(0x1a1410, { roughness: .4 }), 0, 0, hr * .4);
                    m1.rotation.set(Math.PI / 2, 0, 0);
                    m1.rotation.y = 0;
                    (H.mand = H.mand || []).push({ g: mand, s });
                    if (c.venom) add(mand, G.sph(hr * .06, 5, 4), glowMat(c.venom, .9), 0, 0, hr * .85);
                    const ant = grp(head, s * hr * .3, hr * .25, hr * .8);
                    const al = (c.antennae || .6) * c.R * 3;
                    add(ant, G.cyl(hr * .02, hr * .04, al, 4), mat(c.legs, { roughness: .6 }), 0, al / 2, 0);
                    ant.rotation.set(1.0, 0, -s * .5);
                    (H.ant = H.ant || []).push({ g: ant, s });
                }
                break;
            }
        }
        if (c.arms) this.buildArms(H, neck);
        return H;
    }

    // goblin snake: two small clawed arms just below the head
    buildArms(H) {
        const c = this.c, M = this.M, hr = H.hr;
        H.arms = [];
        for (const s of [1, -1]) {
            const sh = this.grp(H.g, s * (c.R + .04), -hr * 1.5, 0);
            this.add(sh, G.cyl(hr * .12, hr * .1, hr * 1.1, 6), M.skin, 0, -hr * .55, 0);
            const el = this.grp(sh, 0, -hr * 1.1, 0);
            this.add(el, G.cyl(hr * .1, hr * .08, hr * 1.0, 6), M.skin, 0, -hr * .5, 0);
            for (let k = -1; k <= 1; k++) this.add(el, G.cone(hr * .04, hr * .3, 4), M.tooth, k * hr * .08, -hr * 1.1, hr * .05).rotation.x = Math.PI + .3;
            H.arms.push({ sh, el, s });
        }
    }

    // serpent guardian: human torso with arms and a curved sword on top of the raised snake body
    buildTorso(H, hr) {
        const c = this.c, M = this.M, add = this.add.bind(this), grp = this.grp.bind(this);
        const T = grp(H.g), skin = M.skin, gold = mat(0xc8a040, { roughness: .35, metalness: .6 }), hair = mat(0x14100c, { roughness: .9 });
        // the head frame of upright bodies is level (y up, z forward): the torso stands on the raised snake body
        H.torso = T;
        add(T, this.sph, skin, 0, .12, 0).scale.set(.17, .2, .12);                 // belly → chest
        add(T, this.sph, skin, 0, .32, 0).scale.set(.21, .17, .13);
        add(T, G.torus(.13, .025, 5, 16), gold, 0, .42, .0).rotation.x = Math.PI / 2;   // golden collar
        const neck = grp(T, 0, .45, 0);
        add(neck, G.cyl(.05, .06, .1, 8), skin, 0, .05, 0);
        const head = grp(neck, 0, .17, 0);
        add(head, G.sph(.1, 12, 9), skin, 0, 0, .01).scale.set(.9, 1.1, 1);
        add(head, G.sph(.105, 12, 8, 0, TAU, 0, Math.PI * .55), hair, 0, .02, -.01);
        add(head, G.sph(.1, 10, 8), hair, 0, -.07, -.05).scale.set(.85, 1.1, .55);
        add(head, G.sph(.02, 6, 5), skin, 0, -.01, .1).scale.set(.7, 1, .8);
        for (const s of [1, -1]) {
            add(head, G.sph(.012, 6, 5), mat(0xd0b030, { emissive: 0x806000, emissiveIntensity: .5 }), s * .035, .02, .085);
            add(head, G.box(.03, .006, .006), hair, s * .036, .036, .088);
        }
        H.jaw = grp(head, 0, -.055, .07);
        add(H.jaw, G.box(.04, .008, .01), M.mouth, 0, 0, .015);
        H.thead = head;
        H.arms = [];
        for (const s of [1, -1]) {
            const sh = grp(T, s * .23, .38, 0);
            add(sh, G.sph(.065, 8, 6), skin);
            add(sh, G.cyl(.05, .042, .3, 7), skin, 0, -.15, 0);
            const el = grp(sh, 0, -.3, 0);
            add(el, G.cyl(.042, .034, .28, 7), skin, 0, -.14, 0);
            add(el, G.torus(.04, .012, 4, 12), gold, 0, -.22, 0).rotation.x = Math.PI / 2;
            const hand = grp(el, 0, -.3, 0);
            add(hand, G.sph(.04, 7, 5), skin);
            if (s < 0) {                                                            // curved sword in the right hand (-x)
                const blade = grp(hand, 0, 0, .02);
                add(blade, G.cyl(.018, .018, .12, 6), mat(0x3a2a1a), 0, 0, 0).rotation.x = Math.PI / 2;
                add(blade, G.box(.12, .02, .02), gold, 0, 0, .06);
                for (let k = 0; k < 6; k++) {
                    const b = add(blade, G.box(.012, .055, .14), mat(0xc8ccd0, { roughness: .25, metalness: .8 }), 0, k * .012, .13 + k * .12);
                    b.rotation.x = -k * .06;
                }
            }
            H.arms.push({ sh, el, s });
        }
    }

    // ---------------------------------------------------------------- states
    statePose(state, c, t) {
        const S = this.STAND, V = this.c, P = { ...S };
        switch (state) {
            case 'idle':
                P.sway = Math.sin(t * .7) * .25;
                P.headX = Math.sin(t * .9) * .08;
                P.lean = Math.sin(t * .5) * .08;
                return P;
            case 'walk': return { ...P, rise: S.rise * .55, amp: .6, coil: 0, sway: 0 };
            case 'run': return { ...P, rise: S.rise * .35, amp: .75, coil: 0, lean: .2, sway: 0, wing: V.wings || V.insectWings ? 1 : 0 };
            case 'attack': {
                const dur = c.actionDuration || .8;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .8) % 1;
                const W = { ...P, rise: Math.min(1.2, S.rise + .3), lean: -.4, bz: -.15, headX: .35, jaw: .3, coil: 0, amp: .05, arm: -1, guard: 0, wing: 1 };
                const K = { ...P, rise: Math.min(1.2, S.rise + .25), lean: 1.05, bz: .45, headX: -.15, jaw: 1, coil: 0, amp: .05, arm: 1, wing: 1 };
                const B = { ...K, jaw: .08, lean: .8, bz: .35 };
                if (V.sink) { W.rise = 1.15; W.lean = -.5; K.lean = 1.35; K.rise = .9; }
                else if (!V.upright) { K.lean = .5; K.headX = .15; K.rise = Math.min(1.2, S.rise + .35); B.lean = .4; B.rise = K.rise; }
                if (V.kind === 'centipede') { W.rise = 1; K.lean = .3; K.rise = .8; B.lean = .25; B.rise = .75; }
                let A = this.mixP(P, W, smooth(p / .32));
                if (p > .32) A = this.mixP(A, K, smooth((p - .32) / .14));
                if (p > .5) A = this.mixP(A, B, smooth((p - .5) / .12));
                if (p > .72) A = this.mixP(A, S, smooth((p - .72) / .28));
                this.atkP = p;
                return A;
            }
            case 'defend': return { ...P, rise: Math.min(1.25, S.rise + .4), lean: -.25, headX: .35, jaw: .75 + Math.sin(t * 10) * .1, coil: S.coil * .5, sway: Math.sin(t * 2.6) * .25, guard: 1, wing: 1 };
            case 'hit': return { ...P, rise: S.rise * .8, lean: -.6, headX: .5, jaw: .55, guard: .5 };
            case 'kneel': return { ...P, rise: S.rise * .4, amp: 0, coil: Math.max(.55, S.coil), headX: -.1 };
            case 'lie': return { ...P, rise: .06, amp: .08, coil: Math.max(.6, S.coil), headX: -.15, jaw: .02 };
            case 'death': return { ...P, rise: 0, lean: .2, amp: .28, coil: 0, roll: 1.9, headX: -.3, jaw: .6, sway: .3, arm: 0, guard: 0 };
            default: return P;
        }
    }
    mixP(A, B, k) { const o = {}; for (const key of KEYS) o[key] = A[key] + (B[key] - A[key]) * k; return o; }

    update(c, dt) {
        this.time += dt;
        const t = this.time, V = this.c;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;
        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 5, dt);
        const lambda = Math.max(1, V.L * .3);
        if (target > 0) this.phase += dt * (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) * 1.4 : 1) / this.size / lambda * TAU;
        else if (state !== 'death') this.phase += dt * .25;

        const P = this.statePose(state, c, t);
        const k = state === 'attack' ? 22 : state === 'hit' ? 16 : state === 'death' ? 2.5 : state === 'lie' || state === 'kneel' ? 3 : 6;
        for (const key of KEYS) this.p[key] = damp(this.p[key], P[key], k, dt);
        const q = this.p;
        this.spine(q, t, lambda, state);
        this.place(q, t, dt, state);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-6 * dt));
        this.root.rotation.y = this.yaw;
    }

    // build the spine points: ground part from the neck base backwards, then each neck forwards and up
    spine(q, t, lambda, state) {
        const V = this.c, ds = this.ds, K = TAU / lambda, ng = this.ng, nf = this.nf;
        const Lg = ng * ds, rise = Math.max(0, q.rise);
        // ground part: heading = travelling wave + coil curvature (the coil winds inward and stacks, neck on top)
        const kc = q.coil * TAU * 1.1 / Lg;
        let yaw = 0, turn = 0;
        for (let i = 0; i <= ng; i++) {
            const s = i * ds;
            this.gYaw[i] = yaw + q.amp * Math.sin(K * s + this.phase) * smooth(s / (lambda * .5));
            this.gTurn[i] = turn;
            const kap = kc * (1 + s / Lg * 1.3);
            yaw += kap * ds;
            turn += kap * ds / TAU;
        }
        const T = turn, sink = V.sink, z0 = V.Lf * .25 + q.bz * V.Lf;
        const r0 = this.gsegs[0].r;
        const y0 = r0 * (1 - sink) + (T > .3 ? T * r0 * 1.1 : 0);
        let x = 0, z = z0, sank = -1;
        for (let i = 0; i <= ng; i++) {
            const r = this.gsegs[Math.min(i, ng - 1)].r;
            const stack = T > .3 ? (T - this.gTurn[i]) * r * 1.1 : 0;
            const under = sink ? sink * smooth(i * ds / Math.max(1, V.L * .12)) * r * 2.4 : 0;
            this.gpts[i].set(x, i === 0 ? y0 : r * (1 - sink) + stack - under, z);
            if (sank < 0 && sink && this.gpts[i].y < -r * .2) sank = i;
            const a = this.gYaw[i];
            x -= Math.sin(a) * ds;
            z -= Math.cos(a) * ds;
        }
        this.sankAt = sank;
        // necks: S-curve up from the neck base, leaning forward to strike; flat poses continue the ground wave
        for (const N of this.necks) {
            const pts = N.pts, nr = rise * N.rise;
            let px = 0, py = y0, pz = z0;
            pts[nf].set(px, py, pz);
            let lean = q.lean, nYaw = N.yaw0 * (.4 + .6 * Math.min(1, nr));
            if (V.heads > 1) {                                                      // hydra heads strike one after another
                const p = state === 'attack' ? this.atkP || 0 : -1;
                const pk = p < 0 ? 0 : smooth(Math.max(0, Math.min(1, (p - .3 - N.k * .07) / .16))) * (1 - smooth((p - .62 - N.k * .05) / .2));
                N.att = pk;
                lean = q.lean * .3 + pk * 1.1 + Math.sin(t * 1.3 + N.k * 1.7) * .08;
                nYaw += Math.sin(t * .8 + N.k * 2.1) * .12;
            }
            for (let i = nf - 1; i >= 0; i--) {
                const u = (nf - i - .5) / nf;
                const start = sink ? 1 : smooth(u / .25);
                let pitch = V.upright ? nr * start * 1.5 - lean * u * u * 1.2
                    : nr * start * (1.55 - 1.75 * u * u) - lean * u * 1.4;
                if (V.kind === 'centipede' || V.kind === 'slug') pitch = nr * start * (1.3 - 1.6 * u) - lean * u;
                if (V.heads > 1) pitch = nr * start * (1.3 - 1.5 * u) - lean * u * 1.4;
                const flatWave = (1 - Math.min(1, nr)) * q.amp * Math.sin(-K * (nf - i) * ds + this.phase);
                const yw = nYaw + q.sway * u + flatWave;
                const cp = Math.cos(pitch);
                px += Math.sin(yw) * cp * ds;
                py += Math.sin(pitch) * ds;
                pz += Math.cos(yw) * cp * ds;
                const rr = this.radius((i + .5) * ds, V.heads > 1);
                pts[i].set(px, Math.max(rr * .8, py), pz);
            }
        }
    }

    // put every segment on the spine, then the heads
    place(q, t, dt, state) {
        const V = this.c, Tm = this.tmp, ng = this.ng;
        // ground part: tail → neck base, parallel transport of the back vector
        const d = this._d.set(0, 1, 0);
        for (let i = ng - 1; i >= 0; i--) this.orient(this.gsegs[i], this.gpts[i + 1], this.gpts[i], d, q.roll, i, t, state);
        const dBase = this._dBase.copy(d);
        for (const N of this.necks) {
            d.copy(dBase);
            for (let i = this.nf - 1; i >= 0; i--) this.orient(N.segs[i], N.pts[i + 1], N.pts[i], d, q.roll, -1, t, state);
            this.placeHead(N, q, t, dt, state, d);
        }
        if (this.shoulder) {
            this.shoulder.position.copy(this.gpts[0]);
            this.shoulder.position.y = Math.max(this.shoulder.position.y, V.R * .9);
            this.shoulder.rotation.y = this.gYaw[0];
        }
        if (this.mounds) {
            this.mounds[0].position.set(this.gpts[0].x, V.R * .15, this.gpts[0].z);
            const sa = Math.max(1, this.sankAt);
            this.mounds[1].position.set(this.gpts[sa].x, V.R * .1, this.gpts[sa].z);
            this.mounds[1].visible = this.sankAt > 0;
        }
        const J = this.j, g = Math.min(1, this.gait);
        if (J.wings) {
            const flap = state === 'run' || state === 'attack' ? Math.sin(t * 9) : state === 'defend' ? Math.sin(t * 5) * .6 : 0;
            for (const w of J.wings) w.set(state === 'death' ? .9 : Math.min(1, q.wing + .55), state === 'death' ? -.3 : flap + Math.sin(t * 1.5) * .1);
        }
        if (J.iwings) for (const w of J.iwings) {
            const open = q.wing, buzz = open > .3 ? Math.sin(t * 60 + w.k) * .5 : 0;
            w.g.rotation.set(0, w.s * (1 - open) * (1.3 - w.k * .15), w.s * (.15 + buzz * open));
        }
    }

    orient(S, a, b, d, roll, gi, t, state) {
        const Tm = this.tmp, f = Tm.f.subVectors(b, a);
        const len = f.length() || 1e-4;
        f.divideScalar(len);
        // parallel transport of the back vector along the chain
        d.addScaledVector(f, -d.dot(f));
        if (d.lengthSq() < 1e-6) d.set(0, 1, 0).addScaledVector(f, -f.y);
        d.normalize();
        const dr = Tm.v.copy(d);
        if (roll) dr.multiplyScalar(Math.cos(roll)).addScaledVector(Tm.x.crossVectors(f, d), Math.sin(roll));
        const x = Tm.x.crossVectors(dr, f).normalize();
        Tm.m.makeBasis(x, dr, f);
        S.g.quaternion.setFromRotationMatrix(Tm.m);
        S.g.position.addVectors(a, b).multiplyScalar(.5);
        if (S.deco.length) {                                                       // centipede legs: ripple wave
            const g = Math.min(1, this.gait), dead = state === 'death';
            for (const L of S.deco) {
                const ph = this.phase * 2.2 - L.i * .9 + (L.s > 0 ? 0 : Math.PI);
                L.hip.rotation.y = dead ? .3 * L.s : Math.sin(ph) * (.25 + .3 * g) + Math.sin(t * 3 + L.i) * .03;
                L.hip.rotation.z = dead ? -L.s * .9 : L.s * Math.max(0, Math.cos(ph)) * .3 * g;
            }
        }
    }

    placeHead(N, q, t, dt, state, d) {
        const V = this.c, H = N.head, Tm = this.tmp, pts = N.pts;
        const f = Tm.f.subVectors(pts[0], pts[1]).normalize();
        d.addScaledVector(f, -d.dot(f)).normalize();
        const dr = Tm.v.copy(d);
        if (q.roll) dr.multiplyScalar(Math.cos(q.roll)).addScaledVector(Tm.x.crossVectors(f, d), Math.sin(q.roll));
        if (V.upright) {                                                            // upright bodies: level head looking forward
            const h = Tm.h.set(f.x - dr.x, 0, f.z - dr.z);
            if (h.lengthSq() < 1e-6) h.set(0, 0, 1);
            h.normalize();
            const x = Tm.x.crossVectors(Tm.u, h).normalize();
            Tm.m.makeBasis(x, Tm.u, h);
            H.g.quaternion.setFromRotationMatrix(Tm.m);
            if (q.roll) H.g.rotateZ(q.roll);
        } else {
            const x = Tm.x.crossVectors(dr, f).normalize();
            Tm.m.makeBasis(x, dr, f);
            H.g.quaternion.setFromRotationMatrix(Tm.m);
        }
        H.g.position.copy(pts[0]);
        const att = V.heads > 1 ? N.att : 0;
        H.g.rotateX(-(q.headX + att * -.2));
        const jaw = Math.min(1, q.jaw + att * .9);
        if (H.jaw) H.jaw.rotation.x = jaw * (V.head === 'naga' ? .3 : V.head === 'goblin' ? .7 : .85);
        if (H.tongue) {                                                             // tongue flicks
            this.flickTimer -= dt;
            if (this.flickTimer <= 0) { this.flick = 1; this.flickTimer = 1.2 + Math.random() * 2.5; }
            this.flick = Math.max(0, this.flick - dt * 2.5);
            const out = state === 'death' ? 0 : Math.sin(this.flick * Math.PI);
            H.tongue.scale.z = .01 + out;
            H.tongue.rotation.x = Math.sin(t * 40) * .15 * out;
        }
        if (H.petals) H.petals.forEach(p => { p.rotation.x = -jaw * 1.1; });
        if (H.teeth && !H.petals) H.teeth.forEach(tt => { tt.rotation.x = 1.0 + jaw * .5; });
        if (H.mand) for (const m of H.mand) m.g.rotation.y = m.s * (.15 + jaw * .7 - (state === 'idle' ? Math.max(0, Math.sin(t * 4)) * .1 : 0));
        if (H.ant) for (const a of H.ant) { a.g.rotation.x = 1.0 + Math.sin(t * 3 + a.s) * .2; a.g.rotation.z = -a.s * (.5 + Math.sin(t * 2.3 + a.s * 2) * .2); }
        if (H.stalks) H.stalks.forEach((s, i) => { s.rotation.x = .5 + Math.sin(t * 1.7 + i * 2) * .2 - (state === 'hit' || state === 'death' ? .6 : 0); });
        if (H.feelers) {
            const dead = state === 'death', lash = state === 'attack' ? Math.max(0, q.lean) : 0;
            for (const F of H.feelers) F.chain.forEach((g, k) => {
                const w = dead ? .05 : .3 + lash * .2;
                g.rotation.x = Math.sin(t * 2.4 + F.a * 3 - k * .8) * w + (k === 0 ? Math.sin(F.a) * (.45 - lash * .45) : -lash * .05);
                g.rotation.y = Math.cos(t * 2 + F.a * 2 - k * .7) * w + (k === 0 ? -Math.cos(F.a) * (.45 - lash * .45) : 0);
            });
        }
        if (H.arms) {
            const naga = V.head === 'naga';
            for (const A of H.arms) {
                const right = A.s < 0;
                if (naga) {
                    let sx = -.25 + Math.sin(t * 1.2 + A.s) * .05, sz = A.s * .25, ex = -.5;
                    if (right) { sx = -.9 - q.arm * .9 + q.guard * -.6; ex = -.6 + q.arm * .4; sz = -.2; }
                    else { sx += -q.guard * 1.1; ex += -q.guard * .9; }
                    if (state === 'death') { sx = .3; ex = -.1; sz = A.s * .8; }
                    A.sh.rotation.set(sx, 0, sz);
                    A.el.rotation.x = ex;
                } else {
                    const claw = state === 'attack' ? q.arm : 0;
                    A.sh.rotation.set(-1.0 - claw * .6 - q.guard * .5, 0, A.s * (.3 + Math.sin(t * 2 + A.s) * .08));
                    A.el.rotation.x = -.9 + claw * .5;
                }
            }
            if (naga && H.torso) {
                H.torso.rotation.x = q.lean * .35 + (1 - Math.min(1, q.rise * 2.5)) * (state === 'death' ? -1.2 : .9);
                H.thead.rotation.set(-q.headX * .8 + (state === 'death' ? .5 : 0), q.sway * -.5, 0);
            }
        }
    }
}
