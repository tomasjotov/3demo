import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';
import { mat } from '../avatar/kit.js';

/*
 * QuadrupedRig — shared animation of the procedural legged creatures (ProceduralFeline, ProceduralBear, ProceduralRat,
 * ProceduralHoofed / Pachyderm, ProceduralReptile, ProceduralBiped; any number of legs, see init({ legs })).
 * A subclass builds the meshes into the joints and gives the pose tables; this class runs the states,
 * the walk / gallop cycle, idle behaviour and facing. Same interface as ProceduralAvatar: `root`, `j`, `update(c, dt)`.
 *
 *   root (yaw, scale)
 *   └─ body (torso centre at H: bob, lunge, pitch `bx`, roll)
 *      ├─ leg FL/FR/HL/HR: top ─ knee ─ low (rotation.x from the pose keys FL0..2 / HL0..2; FRx/FRk raise the right fore-paw)
 *      ├─ neck ─ head ─ jaw, ears earL / earR
 *      └─ tailRoot ─ tail segments
 *
 * Pose = flat object of numbers; the subclass' STAND lists every key, other poses override some of them.
 */

export const TAU = Math.PI * 2;
export const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
export const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

// Pose keys every rig has (subclasses add their own in STAND).
export const BASE_STAND = {
    by: 0, bz: 0, bx: 0, roll: 0,
    FL0: 0, FL1: 0, FL2: 0, FLz: 0, HL0: 0, HL1: 0, HL2: 0, HLz: 0, FRx: 0, FRk: 0, FLx: 0,
    neckX: 1, neckY: 0, headX: -1, headY: 0, jaw: .03, ear: 0, tailX: .3
};

// Fur pattern drawn once per kind into a canvas: 'stripes' (rings along v: tiger) or 'spots' (rosettes: leopard).
const textures = new Map();
export function furTexture(kind, base, ink, { light = null, faint = false } = {}) {
    const key = [kind, base, ink, light, faint].join();
    if (textures.has(key)) return textures.get(key);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d');
    const hex = c => '#' + new THREE.Color(c).getHexString();
    g.fillStyle = hex(base);
    g.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = hex(ink);
    g.globalAlpha = faint ? .45 : 1;
    if (kind === 'stripes') {
        for (let i = 0; i < 14; i++) {                         // wavy broken stripes across u, stacked along v
            const y = (i + .3 + rnd() * .4) * 256 / 14;
            for (let u = 0; u < 256; u += 64) {
                const len = 30 + rnd() * 34, w = 4 + rnd() * 5, x0 = u + rnd() * 12;
                g.beginPath();
                g.moveTo(x0, y);
                for (let k = 0; k <= 8; k++) {
                    const x = x0 + len * k / 8;
                    g.lineTo(x, y + Math.sin(k * .9 + i) * 3 - w * Math.sin(Math.PI * k / 8) * .5);
                }
                for (let k = 8; k >= 0; k--) {
                    const x = x0 + len * k / 8;
                    g.lineTo(x, y + Math.sin(k * .9 + i) * 3 + w * Math.sin(Math.PI * k / 8) * .5);
                }
                g.fill();
            }
        }
    } else {
        for (let i = 0; i < 70; i++) {                         // rosettes: broken dark ring around a slightly darker centre
            const x = rnd() * 256, y = rnd() * 256, r = 5 + rnd() * 6;
            if (light !== null) { g.fillStyle = hex(light); g.globalAlpha = .5; g.beginPath(); g.arc(x, y, r * .7, 0, TAU); g.fill(); }
            g.fillStyle = hex(ink); g.globalAlpha = 1;
            for (let a = 0; a < TAU; a += TAU / 5) {
                g.beginPath();
                g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.8 + rnd() * 2.2, 0, TAU);
                g.fill();
            }
        }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, tex);
    return tex;
}
export const furMat = (color, tex) => tex ? mat(0xffffff, { roughness: .95, map: tex }) : mat(color, { roughness: .95 });

export class QuadrupedRig {
    // legs: names of the legs in this.j (bipeds HL/HR, basilisk 8); stand: full pose; gait: { walk, run } stride (m / cycle), amp, lift; sniff: 0..1 how much the idle sniffs
    init({ H, stand, gait = {}, sniff = .5, scale = 1, legs = ['FL', 'FR', 'HL', 'HR'] }) {
        this.H = H;
        this.STAND = stand;
        this.KEYS = Object.keys(stand);
        this.legNames = legs;
        this.gaitCfg = { walk: 1.1, run: 2, amp: .4, ampRun: .35, lift: .85, roll: .02, ...gait };
        this.sniffK = sniff;
        this.size = scale;
        this.root = new THREE.Group();
        this.root.scale.setScalar(scale);
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.yaw = null;
        this.gait = 0;
        this.state = null;
        this.stateTime = 0;
        this.p = { ...stand };
        this.sniff = 0; this.sniffing = false; this.sniffTimer = 3 + Math.random() * 4;
        this.earT = 0; this.earTimer = 1;
        this.look = 0; this.lookTimer = 2;
    }
    pose(over) { return { ...this.STAND, ...over }; }
    mix(A, B, k) { const o = {}; for (const key of this.KEYS) o[key] = A[key] + (B[key] - A[key]) * k; return o; }

    // helpers for the subclass build()
    adder(shadow = true) {
        return (parent, geo, m, x = 0, y = 0, z = 0) => {
            const mesh = new THREE.Mesh(geo, m);
            mesh.position.set(x, y, z);
            mesh.castShadow = shadow;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };
    }
    grp(parent, x = 0, y = 0, z = 0) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        return g;
    }

    statePose(state) { return state === 'idle' ? this.idlePose() : this.STAND; }
    idlePose() {
        const P = { ...this.STAND };
        P.neckX += this.sniff * .6;
        P.headX += this.sniff * .3;
        P.neckY = this.look * .45 * (1 - this.sniff);
        P.headY = this.look * .35;
        P.by += Math.sin(this.time * 1.5) * .004;
        return P;
    }
    // one leg: swing a0 / knee a1 / lower joint a2 (rotation.x), splay z; a sprawled rig (reptile) overrides it
    applyLeg(L, a0, a1, a2, z) {
        L.top.rotation.x = a0;
        L.knee.rotation.x = a1;
        L.low.rotation.x = a2;
        L.top.rotation.z = z * L.side;
    }
    // subclass hook: tail, ears, extras (q = current pose incl. locomotion, g = walk 0..1, run 0..1)
    animateExtras() {}

    update(c, dt) {
        this.time += dt;
        const t = this.time, J = this.j, G = this.gaitCfg;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;

        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 6, dt);
        if (target > 0) {
            const stride = (target === 2 ? G.run : G.walk) * this.size;
            const speed = (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) : 1);
            this.phase += dt * speed / stride * TAU;
        }

        if (state === 'idle') {
            this.sniffTimer -= dt;
            if (this.sniffTimer <= 0) {
                this.sniffing = !this.sniffing && Math.random() < this.sniffK + .2;
                this.sniffTimer = this.sniffing ? 1.5 + Math.random() * 2 : 3 + Math.random() * 5;
            }
            this.lookTimer -= dt;
            if (this.lookTimer <= 0) { this.lookTarget = (Math.random() - .5) * 2; this.lookTimer = 1.5 + Math.random() * 3; }
        } else this.sniffing = false;
        this.sniff = damp(this.sniff, this.sniffing ? this.sniffK : 0, 3, dt);
        this.look = damp(this.look, state === 'idle' ? (this.lookTarget || 0) : 0, 2.5, dt);
        this.earTimer -= dt;
        if (this.earTimer <= 0) { this.earT = (Math.random() - .5) * 1.2; this.earTimer = .7 + Math.random() * 2.5; }

        const P = this.statePose(state, c, t);
        const k = state === 'attack' ? 30 : state === 'hit' ? 18 : state === 'death' ? 3.5 : state === 'lie' || state === 'kneel' ? 4 : 8;
        for (const key of this.KEYS) this.p[key] = damp(this.p[key], P[key], k, dt);
        const q = { ...this.p };

        // locomotion: 4-beat walk blending into a gallop (a leg may carry its own phase offsets: L.walk / L.gal)
        const g = Math.min(1, this.gait), run = Math.max(0, this.gait - 1);
        const walkOff = { HL: 0, FL: .25, HR: .5, FR: .75 }, galOff = G.galOff || { HL: 0, HR: .1, FL: .48, FR: .58 };
        for (const name of this.legNames) {
            const L = J[name], b = L.key || (L.hind ? 'HL' : 'FL');
            let a0 = q[b + '0'], a1 = q[b + '1'], a2 = q[b + '2'], lift = 0;
            if (name === 'FR') { a0 += q.FRx; a1 += q.FRk; }
            if (name === 'FL') a0 += q.FLx;
            if (g > .001) {
                const off = (L.walk ?? walkOff[name]) * (1 - run) + (L.gal ?? galOff[name]) * run;
                const ph = this.phase + off * TAU, s = Math.sin(ph), co = Math.cos(ph);
                const amp = (G.amp + run * G.ampRun) * g;
                lift = smooth(Math.max(0, co)) * g * (G.lift + run * .6);
                a0 -= s * amp;
                a1 += L.hind ? lift * .7 : lift * 1.1;
                a2 += L.hind ? -lift * .55 : lift * .55;
            }
            this.applyLeg(L, a0, a1, a2, q[b + 'z'], lift);
        }
        if (g > .001) {
            q.by += run > 0 ? Math.abs(Math.sin(this.phase)) * .06 * run : Math.sin(this.phase * 2) * .012 * g;
            q.bx += Math.sin(this.phase) * .1 * run + Math.sin(this.phase * 2) * .015 * g * (1 - run);
            q.neckX += -Math.sin(this.phase) * .08 * run - .15 * run + Math.sin(this.phase * 2) * .04 * g * (1 - run);
            q.headX += .12 * run;
            q.roll += Math.sin(this.phase) * G.roll * g * (1 - run);
        }

        J.body.position.set(0, this.H + q.by, q.bz);
        J.body.rotation.set(q.bx, 0, q.roll);
        J.neck.rotation.set(q.neckX, q.neckY, 0);
        J.head.rotation.set(q.headX, q.headY, 0);
        if (J.jaw) J.jaw.rotation.x = q.jaw + (this.sniffing ? Math.max(0, Math.sin(t * 14)) * .02 : 0);
        if (J.earL) {
            J.earL.rotation.x = damp(J.earL.rotation.x, -q.ear - (this.earT > 0 ? this.earT * .5 : 0), 10, dt);
            J.earR.rotation.x = damp(J.earR.rotation.x, -q.ear - (this.earT < 0 ? -this.earT * .5 : 0), 10, dt);
        }
        this.animateExtras(q, state, t, dt, g, run);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }
}
