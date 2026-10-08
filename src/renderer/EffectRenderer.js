import * as THREE from 'three';
import { haloSprite } from './LightProps.js';
import { buildObject } from './ObjectFactory.js';

/*
 * Area effects of the arena (hof ArenaFields → PlanArena.spell "x,y:TYPE" cells, same as the 2D plan draws):
 *   SMOKE   thick grey smoke (blocks sight in the rules), puffs billowing up to ~2 m
 *   FOG     light pale mist close to the ground (weak smoke, attack <= 5)
 *   POISON  yellow-green gas
 *   FIRE    burning cells: flame tongues, glowing ground, sparks
 *   KINETIC force wall (translucent shimmering block)
 *   BLUNT   stone block (stone wall spell)
 * A fire area that appears while the plan is shown starts with an explosion (fireball, shock ring, debris, smoke);
 * explode(x, y, r) plays one on demand. Other cell types (SPELL = targeting) stay only as overlay markers.
 * Puffs are sprites with one shared material per type, they grow in, loop (rise, swell, shrink) and shrink out.
 */
export const EFFECT_TYPES = ['SMOKE', 'FOG', 'POISON', 'FIRE', 'KINETIC', 'BLUNT'];

const PUFF = {
    SMOKE: { color: 0x403b38, opacity: .85, n: 5, size: [1.1, 1.7], y: [.2, 2.0], rise: .22, blend: THREE.NormalBlending },
    FOG: { color: 0xe4eaee, opacity: .45, n: 3, size: [1.4, 1.9], y: [.1, .6], rise: .06, blend: THREE.NormalBlending },
    POISON: { color: 0x8fc02a, opacity: .6, n: 4, size: [1.0, 1.5], y: [.15, 1.1], rise: .14, blend: THREE.NormalBlending }
};

let puffTex = null;
function puffTexture() {
    if (puffTex) return puffTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    let a = 11;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 14; i++) {                                 // lumpy cloud from overlapping soft blobs
        const x = 64 + (rnd() - .5) * 50, y = 64 + (rnd() - .5) * 44, r = 22 + rnd() * 22;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,.55)');
        gr.addColorStop(.6, 'rgba(255,255,255,.22)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
    }
    puffTex = new THREE.CanvasTexture(c);
    puffTex.colorSpace = THREE.SRGBColorSpace;
    return puffTex;
}

// dense ball for the fireball (puffTexture is too thin: the colour would wash out over the ground)
let ballTex = null;
function ballTexture() {
    if (ballTex) return ballTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.55, 'rgba(255,255,255,.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    ballTex = new THREE.CanvasTexture(c);
    ballTex.colorSpace = THREE.SRGBColorSpace;
    return ballTex;
}

const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
});
const noRay = o => { o.traverse(m => { m.raycast = () => {}; }); return o; };
// geometries and materials owned by one explosion (the halo texture is shared and stays)
function disposeTree(root) {
    const seen = new Set();
    root.traverse(o => {
        for (const r of [o.geometry, o.material]) if (r && !seen.has(r)) { seen.add(r); r.dispose(); }
    });
}
const hash = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };

export class EffectRenderer {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.name = 'area-effects';
        scene.add(this.group);
        this.cells = new Map();              // "x,y:TYPE" → { root, type, t, k (grow 0..1), dying, parts }
        this.blasts = [];
        this.time = 0;
        this.ready = false;                  // the first plan only shows the state, without explosions
        this.puffMat = {};
        for (const [type, P] of Object.entries(PUFF)) {
            this.puffMat[type] = new THREE.SpriteMaterial({ map: puffTexture(), color: P.color, transparent: true, opacity: P.opacity,
                depthWrite: false, blending: P.blend });
        }
        this.flameGeo = new THREE.ConeGeometry(.09, .5, 7).translate(0, .25, 0);
        this.flameInGeo = new THREE.ConeGeometry(.05, .3, 6).translate(0, .15, 0);
        this.flameMat = additive(0xff5a10, .9);
        this.flameInMat = additive(0xffc860, .9);
        this.emberMat = new THREE.MeshBasicMaterial({ color: 0xc8401a, transparent: true, opacity: .75, depthWrite: false });
        this.emberGeo = new THREE.CircleGeometry(.46, 16).rotateX(-Math.PI / 2);
        this.sparkGeo = new THREE.SphereGeometry(.015, 4, 3);
        this.sparkMat = additive(0xffc060, .95);
        this.wallMat = new THREE.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: .22, depthWrite: false,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
        this.wallEdgeMat = new THREE.LineBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: .7 });
        this.wallGeo = new THREE.BoxGeometry(.96, 1.8, .96).translate(0, .9, 0);
        this.wallEdges = new THREE.EdgesGeometry(this.wallGeo);
    }

    // cells: [{ x, y, text }] (new array = new plan); lights: PlanArena.lights — a light spell is also sent as a FIRE cell
    // at its centre, the 3D client already draws it as a light, so that cell is skipped.
    setEffects(cells = [], lights = []) {
        if (cells === this._cells && lights === this._lights) return;
        this._cells = cells;
        this._lights = lights;
        const lit = new Set((lights || []).filter(l => !l.object).map(l => `${l.x},${l.y}`));
        const want = new Map();
        for (const c of cells) {
            const type = String(c.text || '').toUpperCase();
            if (!EFFECT_TYPES.includes(type)) continue;
            if (type === 'FIRE' && lit.has(`${c.x},${c.y}`)) continue;
            want.set(`${c.x},${c.y}:${type}`, { x: c.x, y: c.y, type });
        }
        const added = [];
        for (const [key, c] of want) {
            const e = this.cells.get(key);
            if (e) { e.dying = false; continue; }
            this.cells.set(key, this.buildCell(c));
            added.push(c);
        }
        for (const [key, e] of this.cells) if (!want.has(key)) e.dying = true;
        // a new fire area explodes first
        const fire = added.filter(c => c.type === 'FIRE');
        if (this.ready && fire.length) {
            const cx = fire.reduce((s, c) => s + c.x, 0) / fire.length, cy = fire.reduce((s, c) => s + c.y, 0) / fire.length;
            this.explode(cx, cy, Math.max(.8, Math.sqrt(fire.length / Math.PI)));
        }
        this.ready = true;
    }

    buildCell({ x, y, type }) {
        const root = new THREE.Group();
        root.position.set(x + .5, 0, y + .5);
        root.scale.setScalar(.001);
        const e = { root, type, k: 0, dying: false, parts: [], seed: hash(x, y) * 100 };
        if (PUFF[type]) {
            const P = PUFF[type];
            for (let i = 0; i < P.n; i++) {
                const s = new THREE.Sprite(this.puffMat[type]);
                const r = hash(x, y, i);
                e.parts.push({ s, ox: (hash(x, y, i + 7) - .5) * .5, oz: (hash(x, y, i + 9) - .5) * .5,
                    size: P.size[0] + r * (P.size[1] - P.size[0]), life: (i / P.n + r * .3) % 1, sp: .12 + r * .1 });
                root.add(s);
            }
        } else if (type === 'FIRE') {
            root.add(new THREE.Mesh(this.emberGeo, this.emberMat)).position.y = .02;
            for (let i = 0; i < 4; i++) {
                const a = i / 4 * Math.PI * 2 + e.seed, r = i ? .22 : 0;
                const f = new THREE.Group();
                f.position.set(Math.cos(a) * r, .02, Math.sin(a) * r);
                f.add(new THREE.Mesh(this.flameGeo, this.flameMat), new THREE.Mesh(this.flameInGeo, this.flameInMat));
                f.userData.sz = i ? 1.1 + hash(x, y, i) * .5 : 1.8;
                root.add(f);
                e.parts.push({ f, ph: i * 1.9 + e.seed });
            }
            const glow = e.glow = haloSprite(0xff7a24, 1.3, .35);
            glow.position.y = .4;
            root.add(glow);
            e.sparks = [];
            for (let i = 0; i < 3; i++) {
                const m = new THREE.Mesh(this.sparkGeo, this.sparkMat);
                root.add(m);
                e.sparks.push({ m, life: i / 3, x: 0, z: 0 });
            }
        } else if (type === 'KINETIC') {
            root.add(new THREE.Mesh(this.wallGeo, this.wallMat), new THREE.LineSegments(this.wallEdges, this.wallEdgeMat));
        } else if (type === 'BLUNT') {
            const stone = buildObject('stone01');
            if (stone) root.add(stone);
        }
        this.group.add(noRay(root));
        return e;
    }

    // Fireball at a cell (x, y may be fractional), radius r in cells.
    explode(x, y, r = 1) {
        const root = new THREE.Group();
        root.position.set(x + .5, 0, y + .5);
        const mk = (geo, color, op) => { const m = new THREE.Mesh(geo, additive(color, op)); root.add(m); return m; };
        const fireMat = new THREE.SpriteMaterial({ map: ballTexture(), color: 0xff7a18, transparent: true, opacity: 1, depthWrite: false });
        const hotMat = new THREE.SpriteMaterial({ map: ballTexture(), color: 0xffd060, transparent: true, opacity: .8, depthWrite: false,
            blending: THREE.AdditiveBlending });
        const ball = [];
        for (let i = 0; i < 14; i++) {                                   // billowing fireball: puffs flying outwards, hot core
            const s = new THREE.Sprite(i < 10 ? fireMat : hotMat);
            const a = Math.random() * Math.PI * 2, u = Math.random() * .9 + .1;
            s.userData.d = new THREE.Vector3(Math.cos(a) * (1 - u * .5), u, Math.sin(a) * (1 - u * .5)).normalize();
            s.userData.k = .6 + Math.random() * .6;
            root.add(s);
            ball.push(s);
        }
        const core = mk(new THREE.SphereGeometry(1, 14, 10), 0xffe8a0, 1);
        const ring = mk(new THREE.RingGeometry(.8, 1, 32).rotateX(-Math.PI / 2), 0xffb060, .8);
        ring.position.y = .03;
        const flash = haloSprite(0xffb060, r * 3, .8);
        flash.position.y = r * .6;
        root.add(flash);
        const debris = [];
        const dGeo = new THREE.SphereGeometry(.03, 4, 3), dMat = additive(0xffb050, 1);
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2, up = .4 + Math.random() * .9, sp = (1.5 + Math.random() * 2.5) * Math.sqrt(r);
            const m = new THREE.Mesh(dGeo, dMat);
            root.add(m);
            debris.push({ m, v: new THREE.Vector3(Math.cos(a) * sp, up * sp * 1.4, Math.sin(a) * sp) });
        }
        const smokeMat = new THREE.SpriteMaterial({ map: puffTexture(), color: 0x3a3532, transparent: true, opacity: 0, depthWrite: false });
        const smoke = [];
        for (let i = 0; i < 7; i++) {
            const s = new THREE.Sprite(smokeMat);
            const a = i / 7 * Math.PI * 2;
            s.userData.o = new THREE.Vector3(Math.cos(a) * r * .5, r * (.5 + Math.random() * .6), Math.sin(a) * r * .5);
            root.add(s);
            smoke.push(s);
        }
        this.group.add(noRay(root));
        this.blasts.push({ root, r, t: 0, ball, fireMat, hotMat, core, ring, flash, debris, smoke, smokeMat, dGeo, dMat });
    }

    // light: 0..1 daylight of the scene (smoke and fog are unlit sprites: darker at night, only the fire glows)
    update(dt, light = 1) {
        this.time += dt;
        const t = this.time;
        const lk = .22 + .78 * THREE.MathUtils.clamp(light, 0, 1);
        if (lk !== this._lk) {
            this._lk = lk;
            for (const [type, P] of Object.entries(PUFF)) this.puffMat[type].color.setHex(P.color).multiplyScalar(lk);
        }
        for (const [key, e] of this.cells) {
            e.k = THREE.MathUtils.clamp(e.k + (e.dying ? -dt / .6 : dt / .8), 0, 1);
            if (e.dying && e.k <= 0) {
                this.group.remove(e.root);
                if (e.glow) e.glow.material.dispose();
                this.cells.delete(key);
                continue;
            }
            e.root.scale.setScalar(Math.max(.001, e.type === 'KINETIC' || e.type === 'BLUNT' ? e.k : 1));
            const grow = e.k * e.k * (3 - 2 * e.k);
            const P = PUFF[e.type];
            if (P) {
                for (const p of e.parts) {
                    p.life = (p.life + dt * p.sp) % 1;
                    const l = p.life, swell = Math.sin(Math.PI * l);
                    const sc = Math.max(.001, p.size * (.55 + .6 * swell) * grow * (.25 + .75 * swell));
                    p.s.scale.setScalar(sc);
                    // keep the puff above the ground (a sprite cut by the ground shows a straight edge)
                    p.s.position.set(p.ox + Math.sin(t * .4 + p.size * 5) * .12,
                        Math.max(sc * .42, P.y[0] + (P.y[1] - P.y[0]) * l + Math.sin(t * .7 + p.ox * 9) * .05),
                        p.oz + Math.cos(t * .35 + p.size * 3) * .12);
                }
            } else if (e.type === 'FIRE') {
                for (const p of e.parts) {
                    const s = p.f.userData.sz * grow * (.85 + Math.sin(t * 9 + p.ph) * .15 + Math.sin(t * 23 + p.ph * 2) * .08);
                    p.f.scale.set(grow * p.f.userData.sz, Math.max(.001, s), grow * p.f.userData.sz);
                    p.f.rotation.z = Math.sin(t * 3 + p.ph) * .12;
                }
                for (const S of e.sparks) {
                    S.life += dt * .7;
                    if (S.life >= 1) { S.life -= 1; S.x = (Math.random() - .5) * .6; S.z = (Math.random() - .5) * .6; }
                    S.m.position.set(S.x, .3 + S.life * 1.4, S.z);
                    S.m.scale.setScalar(Math.max(.001, (1 - S.life) * grow));
                }
            }
        }
        this.wallMat.opacity = .18 + Math.sin(t * 2.4) * .06;
        this.wallEdgeMat.opacity = .55 + Math.sin(t * 3.1) * .2;

        for (let i = this.blasts.length - 1; i >= 0; i--) {
            const B = this.blasts[i];
            B.t += dt;
            const T = B.t, r = B.r;
            const e1 = Math.min(1, T / .35);                         // fireball grows fast, then fades and rises
            const ballR = r * (.3 + 1.1 * (1 - Math.pow(1 - e1, 3)));
            const lift = ballR * .5 + Math.max(0, T - .3) * .7;
            B.ball.forEach((s, i) => {
                const hot = i >= 10;
                s.position.copy(s.userData.d).multiplyScalar(ballR * (hot ? .3 : .75) * s.userData.k);
                s.position.y += lift;
                s.scale.setScalar(ballR * (hot ? .7 : .6 + s.userData.k * .35) * (1 + T * .35));
            });
            // orange → deep red → sooty brown, then the dark smoke takes over; the hot core burns out first
            const c = Math.min(1, T / 1.1);
            B.fireMat.color.setRGB(1 - c * .72, .5 - c * .4, .08 - c * .02, THREE.SRGBColorSpace);
            B.fireMat.opacity = Math.min(1, Math.max(0, 1.7 - T * 1.2));
            B.hotMat.opacity = Math.max(0, .8 - T * 1.3);
            B.core.scale.setScalar(Math.max(.001, ballR * .35 * Math.max(0, 1 - T / .3)));
            B.core.position.y = lift;
            B.core.visible = T < .4;
            B.ring.scale.setScalar(Math.max(.001, r * (.3 + T * 4)));
            B.ring.material.opacity = Math.max(0, .5 - T);
            B.flash.material.opacity = Math.max(0, .8 - T * 4);
            for (const d of B.debris) {
                d.v.y -= 9.8 * dt;
                d.m.position.addScaledVector(d.v, dt);
                if (d.m.position.y < .02) { d.m.position.y = .02; d.v.multiplyScalar(.3); d.v.y = Math.abs(d.v.y); }
            }
            B.dMat.opacity = Math.max(0, 1 - T / 1.2);
            const sm = THREE.MathUtils.clamp((T - .15) / .4, 0, 1) * Math.max(0, 1 - (T - 1) / 1.6);
            B.smokeMat.opacity = .65 * sm;
            for (const s of B.smoke) {
                s.position.copy(s.userData.o).addScaledVector(s.userData.o, T * .25);
                s.position.y += T * .6;
                s.scale.setScalar(r * (.8 + T * .9));
            }
            if (T > 2.7) {
                this.group.remove(B.root);
                disposeTree(B.root);
                this.blasts.splice(i, 1);
            }
        }
    }
}
