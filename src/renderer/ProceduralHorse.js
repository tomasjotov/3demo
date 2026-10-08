import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';

/*
 * ProceduralHorse — runtime low-poly saddled horse, 2 grid cells long.
 *
 *   root (yaw, centred between the two occupied cells)
 *   └─ body (pitch / bob)
 *      ├─ torso, chest, rump, belly, saddle, blanket
 *      ├─ leg FL/FR/HL/HR: upper ─ knee/hock ─ cannon ─ fetlock ─ hoof
 *      ├─ neck ─ head (muzzle, ears, eyes, forelock, bridle), mane
 *      └─ tail (3 chained segments)
 *
 * States: idle (breathing, tail swish, ear twitch, periodic grazing),
 * walk (4-beat walk), run (trot). Same interface as ProceduralAvatar.
 */

const TAU = Math.PI * 2;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

const COAT = {
    coat: 0x7a4a2a, coatDark: 0x5e3820, mane: 0x1f1612, hoof: 0x2a2420,
    sock: 0xe8e0d0, muzzle: 0x3a2a22, blanket: 0x8e2a2a, trim: 0xd8b25a,
    leather: 0x4a2e1c, metal: 0xc9ced4
};

const matCache = new Map();
function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, ...opts }));
    return matCache.get(key);
}

export class ProceduralHorse {
    constructor(type = 'horse', colors = {}) {
        this.type = type;
        this.c = { ...COAT, ...colors };
        this.root = new THREE.Group();
        this.root.name = 'horse';
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.yaw = null;
        this.gait = 0;          // 0 = stand, 1 = walk, 2 = trot (smoothed)
        this.graze = 0;         // 0..1 head down
        this.grazeTimer = 4 + Math.random() * 4;
        this.grazing = false;
        this.ear = 0; this.earTimer = 1;
        this.build();
    }

    build() {
        const c = this.c, J = this.j;
        const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
            const mesh = new THREE.Mesh(geo, m);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };
        const grp = (parent, x = 0, y = 0, z = 0) => {
            const g = new THREE.Group();
            g.position.set(x, y, z);
            parent.add(g);
            return g;
        };
        const coat = mat(c.coat), dark = mat(c.coatDark), mane = mat(c.mane);

        J.body = grp(this.root, 0, 0, 0);

        // --- trunk -------------------------------------------------------------
        const torso = add(J.body, new THREE.CapsuleGeometry(.3, .78, 6, 14), coat, 0, 1.12, -.02);
        torso.rotation.x = Math.PI / 2;
        torso.scale.set(.86, 1, 1.05);                      // x = width, z(after rot) = height
        add(J.body, new THREE.SphereGeometry(.33, 14, 10), coat, 0, 1.16, .5).scale.set(.85, 1.05, .95);   // chest
        add(J.body, new THREE.SphereGeometry(.34, 14, 10), coat, 0, 1.2, -.55).scale.set(.92, .98, .95);   // rump
        add(J.body, new THREE.SphereGeometry(.3, 12, 8), coat, 0, 1.02, 0).scale.set(.82, .75, 1.6);       // belly
        add(J.body, new THREE.SphereGeometry(.16, 10, 8), coat, 0, 1.42, .38).scale.set(.8, .8, 1.5);      // withers

        // --- tack: blanket, saddle, stirrups ------------------------------------
        const blanket = add(J.body, new THREE.CylinderGeometry(.33, .33, .5, 16, 1, true, -1.25, 2.5),
            mat(c.blanket, { side: THREE.DoubleSide }), 0, 1.15, .02);
        blanket.rotation.x = -Math.PI / 2;   // axis along the body, open arc on top
        add(J.body, new THREE.TorusGeometry(.335, .012, 4, 20, 2.5), mat(c.trim), 0, 1.15, .27)
            .rotation.set(0, 0, Math.PI / 2 - 1.25);
        add(J.body, new THREE.BoxGeometry(.3, .07, .42), mat(c.leather), 0, 1.47, .02);                     // seat
        add(J.body, new THREE.BoxGeometry(.24, .13, .08), mat(c.leather), 0, 1.53, .2);                     // pommel
        add(J.body, new THREE.BoxGeometry(.28, .1, .07), mat(c.leather), 0, 1.52, -.18);                    // cantle
        add(J.body, new THREE.SphereGeometry(.035, 8, 6), mat(c.trim, { metalness: .7, roughness: .3 }), 0, 1.62, .22);
        for (const s of [1, -1]) {
            add(J.body, new THREE.BoxGeometry(.015, .36, .035), mat(c.leather), .31 * s, 1.24, .04);
            add(J.body, new THREE.TorusGeometry(.045, .012, 5, 10), mat(c.metal, { metalness: .8, roughness: .3 }), .31 * s, 1.03, .04)
                .rotation.y = Math.PI / 2;
        }
        add(J.body, new THREE.TorusGeometry(.29, .02, 5, 20), mat(c.leather), 0, 1.12, .1).rotation.y = Math.PI / 2;   // girth

        // --- legs ----------------------------------------------------------------
        const legDef = [
            ['FL', .15, 1.0, .5, false], ['FR', -.15, 1.0, .5, false],
            ['HL', .16, 1.06, -.55, true], ['HR', -.16, 1.06, -.55, true]
        ];
        for (const [name, x, y, z, hind] of legDef) {
            const top = grp(J.body, x, y, z);
            const upperLen = hind ? .5 : .45;
            if (hind) {
                // big gaskin / thigh muscle
                add(top, new THREE.SphereGeometry(.15, 10, 8), coat, 0, -.05, -.02).scale.set(.75, 1.4, 1.1);
            }
            add(top, new THREE.CylinderGeometry(hind ? .12 : .1, .066, upperLen, 9), coat, 0, -upperLen / 2, 0);
            const knee = grp(top, 0, -upperLen, 0);
            add(knee, new THREE.SphereGeometry(.064, 8, 6), coat);
            const cannonLen = hind ? .42 : .4;
            add(knee, new THREE.CylinderGeometry(.054, .048, cannonLen, 8), dark, 0, -cannonLen / 2, 0);
            const fet = grp(knee, 0, -cannonLen, 0);
            const white = name === 'HL' || name === 'FR';
            add(fet, new THREE.SphereGeometry(.055, 8, 6), white ? mat(c.sock) : dark);
            add(fet, new THREE.CylinderGeometry(.05, .058, .08, 8), white ? mat(c.sock) : dark, 0, -.05, .015);
            add(fet, new THREE.CylinderGeometry(.064, .072, .065, 10), mat(c.hoof), 0, -.11, .025);
            J[name] = { top, knee, fet, hind, rest: upperLen + cannonLen };
        }

        // --- neck & head -----------------------------------------------------------
        J.neck = grp(J.body, 0, 1.3, .66);
        add(J.neck, new THREE.CylinderGeometry(.13, .25, .68, 12), coat, 0, .3, 0).scale.z = .8;
        // mane: row of thin plates along the back of the neck
        for (let i = 0; i < 7; i++) {
            const m = add(J.neck, new THREE.BoxGeometry(.05, .14, .07), mane, 0, .08 + i * .095, -.15 + i * .012);
            m.rotation.x = -.35;
            m.scale.y = 1 - i * .06;
        }
        J.head = grp(J.neck, 0, .64, .02);
        const skull = add(J.head, new THREE.CylinderGeometry(.075, .12, .5, 10), coat, 0, 0, .2);
        skull.rotation.x = Math.PI / 2;
        skull.scale.set(.85, 1, 1.25);                     // taller than wide
        add(J.head, new THREE.SphereGeometry(.12, 12, 8), coat, 0, .015, 0).scale.set(.85, 1, 1);           // jowl
        add(J.head, new THREE.SphereGeometry(.088, 10, 8), mat(c.muzzle), 0, -.015, .44).scale.set(.85, .95, 1);
        for (const s of [1, -1]) {
            add(J.head, new THREE.SphereGeometry(.012, 6, 4), mat(0x0d0c0c), .04 * s, -.015, .52);          // nostril
            const eye = add(J.head, new THREE.SphereGeometry(.026, 8, 6), mat(0x120d0a, { roughness: .25 }), .095 * s, .05, .08);
            eye.scale.set(.6, 1, 1);
            const ear = grp(J.head, .06 * s, .1, -.02);
            add(ear, new THREE.ConeGeometry(.035, .14, 6), coat, 0, .07, 0).scale.set(1, 1, .6);
            ear.rotation.z = -.2 * s;
            J['ear' + (s > 0 ? 'L' : 'R')] = ear;
        }
        // blaze (white stripe) and forelock
        add(J.head, new THREE.BoxGeometry(.035, .012, .3), mat(c.sock), 0, .1, .26).rotation.x = .1;
        add(J.head, new THREE.BoxGeometry(.08, .1, .05), mane, 0, .1, .07).rotation.x = .6;
        // bridle
        const strap = mat(c.leather);
        add(J.head, new THREE.TorusGeometry(.1, .012, 5, 14), strap, 0, -.005, .36).scale.set(.85, 1, 1);
        add(J.head, new THREE.TorusGeometry(.115, .012, 5, 14), strap, 0, .03, .03).rotation.y = Math.PI / 2;

        // --- tail --------------------------------------------------------------------
        J.tail = [];
        let parent = grp(J.body, 0, 1.33, -.84);
        J.tailRoot = parent;
        const segs = [[.06, .07, .22], [.075, .06, .26], [.065, .03, .3]];
        for (const [rt, rb, len] of segs) {
            const g = grp(parent, 0, 0, 0);
            add(g, new THREE.CylinderGeometry(rt, rb, len, 8), mane, 0, -len / 2, 0).scale.x = .7;
            J.tail.push(g);
            parent = grp(g, 0, -len, 0);
        }

        // Rider attachment point (rider root = feet origin of the avatar).
        this.seat = grp(J.body, 0, .66, -.02);

        // Breathing chest reference
        this.baseNeckX = .82;
    }

    update(c, dt) {
        this.time += dt;
        const t = this.time, J = this.j;
        const state = c.state || 'idle';
        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 6, dt);

        if (target > 0) {
            // stride per full cycle: walk ~1.6 tiles, trot ~2.2 tiles
            const stride = target === 2 ? 2.2 : 1.6;
            const speed = (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) : 1);
            this.phase += dt * speed / stride * TAU;
            this.grazing = false;
        }

        // --- grazing behaviour while idle --------------------------------------
        if (target === 0) {
            this.grazeTimer -= dt;
            if (this.grazeTimer <= 0) {
                this.grazing = !this.grazing;
                this.grazeTimer = this.grazing ? 4 + Math.random() * 4 : 5 + Math.random() * 6;
            }
        }
        this.graze = damp(this.graze, this.grazing ? 1 : 0, 2.2, dt);

        const g = Math.min(1, this.gait);           // weight of locomotion
        const trot = Math.max(0, this.gait - 1);    // 0..1 extra for trot

        // --- legs ----------------------------------------------------------------
        // 4-beat walk: HL, FL, HR, FR evenly spaced. Trot: diagonal pairs.
        const walkOff = { HL: 0, FL: .25, HR: .5, FR: .75 };
        const trotOff = { HL: 0, FR: 0, HR: .5, FL: .5 };
        for (const name of ['FL', 'FR', 'HL', 'HR']) {
            const L = J[name];
            const off = walkOff[name] * (1 - trot) + trotOff[name] * trot;
            const p = this.phase + off * TAU;
            const s = Math.sin(p), co = Math.cos(p);
            const amp = (.32 + trot * .18) * g;
            // swing: negative = leg forward
            const swing = -s * amp;
            const lift = smooth(Math.max(0, co)) * g * (.9 + trot * .5);  // flex during forward swing
            // idle: rest a hind leg (hip-shot) now and then
            const rest = (1 - g) * (name === 'HL' ? (Math.sin(t * .21) > .3 ? .35 : 0) : 0);
            L.top.rotation.x = swing + (L.hind ? .02 : -.02) * (1 - g) + this.graze * (L.hind ? 0 : -.08);
            L.knee.rotation.x = L.hind ? -lift * .8 - rest * .6 : lift;
            L.fet.rotation.x = L.hind ? lift * .9 + rest : -lift * .4 + .1 * lift;
        }

        // --- body -----------------------------------------------------------------
        const bob = g * (trot > 0 ? Math.abs(Math.sin(this.phase * 2)) * .05 * trot : Math.sin(this.phase * 2) * .015);
        const breath = Math.sin(t * 1.4) * .006 * (1 - g);
        J.body.position.y = bob + breath - this.graze * .03;
        J.body.rotation.x = this.graze * .06 + Math.sin(this.phase * 2) * .015 * g;
        J.body.rotation.z = Math.sin(this.phase) * .02 * g;

        // --- neck / head ------------------------------------------------------------
        const nod = Math.sin(this.phase * 2) * (.06 + trot * .04) * g;
        const idleLook = Math.sin(t * .37) * .25 * (1 - g) * (1 - this.graze);
        J.neck.rotation.x = this.baseNeckX + nod + this.graze * 1.3 - trot * .1;
        J.neck.rotation.y = idleLook * .5;
        J.head.rotation.x = .35 - nod * .5 - this.graze * .75 + (this.grazing ? Math.sin(t * 6) * .04 * this.graze : 0);
        J.head.rotation.y = idleLook * .5;

        // ears twitch
        this.earTimer -= dt;
        if (this.earTimer <= 0) { this.ear = (Math.random() - .5) * 1.2; this.earTimer = .8 + Math.random() * 2.5; }
        J.earL.rotation.x = damp(J.earL.rotation.x, this.ear > 0 ? -this.ear : 0, 10, dt);
        J.earR.rotation.x = damp(J.earR.rotation.x, this.ear < 0 ? this.ear : 0, 10, dt);

        // --- tail -----------------------------------------------------------------------
        const swish = Math.sin(t * 2.3) * .25 * (1 - g) + Math.sin(this.phase) * .12 * g;
        J.tailRoot.rotation.x = .55 + g * .35 + trot * .2;
        J.tail.forEach((seg, i) => {
            seg.rotation.z = swish * (1 + i * .6);
            seg.rotation.x = i ? -.12 - g * .1 : 0;
        });

        // --- facing --------------------------------------------------------------------
        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }
}
