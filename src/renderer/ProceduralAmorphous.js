import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIRECTIONS } from '../utils/constants.js';
import { mat } from '../avatar/kit.js';
import { taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralAmorphous — creatures without a skeleton. The shapes themselves are animated: deformed lathe / sphere
 * geometry, scrolling canvas textures, orbiting debris (instanced), billboard puffs (sprites) and a swarm of tiny rats.
 *
 *   kind 'funnel' (air-elemental, air-elemental-giant): two nested open funnels with a scrolling wind-streak texture,
 *        bent per height ring; stones and leaves orbit inside, dust puffs at the foot, the giant has a storm cloud cap.
 *   kind 'water'  (water-elemental, -giant): water spirit rising from a wave — lathe body (head on top, glowing eyes),
 *        two arms, foam rings and spray droplets at the foot; the giant adds storm mist.
 *   kind 'fire'   (fire-elemental): burning pillar — additive lathe core with a rising flame texture, flame tongues,
 *        burning arms, sparks, glow halo and a scorch glow on the ground; attack shoots a fire jet forward.
 *   kind 'slime'  (cave-slime): glossy brown-green puddle with a wave crest and stinging pseudopods.
 *   kind 'jelly'  (living-jelly): translucent rounded cube, green fading to amber, a skull, bones, coins and a sword inside.
 *   kind 'orb'    (chasfon): hovering head-sized ball of blue light with swirls, halo, motes and lightning bolts.
 *   kind 'cloud'  (cloud-form, vampire-cloud-form, vampire-elder-cloud-form): smoke figure of puffs with a head,
 *        glowing eyes, arms ending in claws; vampires black with red glints, the elder darker and bigger.
 *   kind 'swarm'  (vermin): 5–8 tiny rats running around the cell (instanced bodies and legs).
 *
 * States (damped scalars move, lean, wind, surge, tight, scat, low, dead): idle (churning, breathing), walk / run (drift
 * forward with faster churn), attack (wind-up → surge forward → recover: funnel lashes, wave crashes, fire flares and
 * jets, slime engulfs with pseudopods, jelly bulges, orb fires a bolt, cloud envelops with its claws, rats swarm and leap),
 * defend (contracts / densifies), hit (scatters), kneel / lie (sinks low), death (dissipates / collapses to a puddle,
 * wisps, embers, fallen debris or dead rats; ends still). Same interface as the other rigs: `root`, `j`, `update(c, dt)`.
 */

export const AMORPHOUS_VARIANTS = {
    'air-elemental': { kind: 'funnel', scale: 1, color: 0xd4dce4, core: 0x9a9284, dust: 0xa89a80, stones: 10, leaves: 14 },
    'air-elemental-giant': { kind: 'funnel', scale: 3.4, color: 0xb4bcc4, core: 0x6a645a, dust: 0x8a7c66, stones: 16, leaves: 18, storm: 0x5a5f68 },
    'water-elemental': { kind: 'water', scale: 1.2, color: 0x4aa0d8, deep: 0x0c3a62, foam: 0xe4f4ff, eye: 0xd0ffff, spray: 18 },
    'water-elemental-giant': { kind: 'water', scale: 3.2, color: 0x4a8ab8, deep: 0x0e2e4c, foam: 0xd0e0ea, eye: 0xe8ffff, spray: 32, storm: 0x8aa2b6 },
    'fire-elemental': { kind: 'fire', scale: 1, color: 0xff7424, core: 0xffe08a },
    'cave-slime': { kind: 'slime', scale: 1, color: 0x5c6a2a, glow: 0x1c2a04 },
    'living-jelly': { kind: 'jelly', scale: 1, top: 0x7cc84a, bottom: 0xd8a83a },
    'chasfon': { kind: 'orb', scale: 1, color: 0x58aeff, bolt: 0xcfeaff },
    'cloud-form': { kind: 'cloud', scale: 1, color: 0x4e565f, eye: 0xc8dcff, glints: 0 },
    'vampire-cloud-form': { kind: 'cloud', scale: 1.05, color: 0x1e181c, eye: 0xff3434, glint: 0xff2638, glints: 7 },
    'vampire-elder-cloud-form': { kind: 'cloud', scale: 1.2, color: 0x150e19, eye: 0xff2020, glint: 0xff3a8c, glints: 11 },
    'vermin': { kind: 'swarm', scale: 1.1, count: 7, coat: 0x5c5048, skin: 0xc49088 }
};

const TAU = Math.PI * 2;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const lerp = (a, b, k) => a + (b - a) * k;
const dampAngle = (cur, target, k, dt) => {
    const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
    return cur + d * (1 - Math.exp(-k * dt));
};
const noRay = o => { o.traverse(m => { m.raycast = () => {}; }); return o; };

// ---------- canvas textures (drawn once, shared) ----------
const texCache = {};
function canvasTex(key, w, h, draw, repeat = false) {
    if (texCache[key]) return texCache[key];
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    let seed = 1234;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    draw(g, w, h, rnd);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (texCache[key] = t);
}
// soft billowy puff (several overlapping blobs), white with alpha
const puffTex = () => canvasTex('puff', 128, 128, (g, w, h, rnd) => {
    for (let i = 0; i < 10; i++) {
        const a = rnd() * TAU, d = rnd() * 24, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
        const R = Math.min(20 + rnd() * 18, 62 - d);
        const gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, 'rgba(255,255,255,.8)');
        gr.addColorStop(.5, 'rgba(255,255,255,.4)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    }
    // soften the outer edge of the whole puff
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(.45, 'rgba(0,0,0,.85)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m;
    g.fillRect(0, 0, 128, 128);
});
// round glow
const glowTex = () => canvasTex('glow', 64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.3, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
});
// diagonal wind streaks on a faint haze (tiles both ways)
const windTex = () => canvasTex('wind', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
        const x0 = rnd() * w, y0 = rnd() * h, len = 30 + rnd() * 70;
        g.strokeStyle = `rgba(255,255,255,${(.15 + rnd() * .5).toFixed(2)})`;
        g.lineWidth = 1 + rnd() * 3.5;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            g.beginPath(); g.moveTo(x0 + ox, y0 + oy); g.lineTo(x0 + ox + len, y0 + oy - len * .3); g.stroke();
        }
    }
}, true);
// wavy vertical light streaks on blue-grey (water flow)
const flowTex = () => canvasTex('flow', 64, 128, (g, w, h, rnd) => {
    g.fillStyle = 'rgb(150,178,205)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
        const x0 = rnd() * w, ph = rnd() * TAU, amp = 2 + rnd() * 5;
        g.strokeStyle = `rgba(255,255,255,${(.25 + rnd() * .55).toFixed(2)})`;
        g.lineWidth = .8 + rnd() * 2.5;
        for (const ox of [-w, 0, w]) {
            g.beginPath();
            for (let y = 0; y <= h; y += 4) {
                const x = x0 + ox + Math.sin(y / h * TAU * 2 + ph) * amp;
                if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.stroke();
        }
    }
}, true);
// flame tongues on black (for additive blending)
const flameTex = () => canvasTex('flame', 64, 128, (g, w, h, rnd) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
        const x0 = rnd() * w, y0 = rnd() * h, rx = 4 + rnd() * 6, ry = 12 + rnd() * 18;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            g.save();
            g.translate(x0 + ox, y0 + oy);
            g.scale(1, ry / rx);
            const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
            gr.addColorStop(0, 'rgba(255,236,170,.75)');
            gr.addColorStop(.5, 'rgba(255,130,40,.45)');
            gr.addColorStop(1, 'rgba(120,20,0,0)');
            g.fillStyle = gr;
            g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
            g.restore();
        }
    }
}, true);
// soft flame tongue (base at the bottom, tip at the top) on black
const tongueTex = () => canvasTex('tongue', 64, 128, g => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 64, 128);
    g.globalCompositeOperation = 'lighter';
    for (const [cy, rx, ry, c0, c1] of [[96, 30, 30, 'rgba(255,110,25,.55)', 'rgba(140,30,0,0)'], [62, 18, 60, 'rgba(255,120,30,.65)', 'rgba(140,30,0,0)'],
        [86, 10, 34, 'rgba(255,230,150,.85)', 'rgba(255,140,30,0)']]) {
        g.save();
        g.translate(32, cy);
        g.scale(1, ry / rx);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        gr.addColorStop(0, c0);
        gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
        g.restore();
    }
});
// curly light swirls on black (chasfon)
const swirlTex = () => canvasTex('swirl', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = '#081830';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
        const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 24, a = rnd() * TAU;
        g.strokeStyle = `rgba(${120 + (rnd() * 100) | 0},${200 + (rnd() * 55) | 0},255,${(.4 + rnd() * .5).toFixed(2)})`;
        g.lineWidth = 1 + rnd() * 2.5;
        for (const ox of [-w, 0, w]) {
            g.beginPath(); g.arc(x + ox, y, r, a, a + 1.5 + rnd() * 3); g.stroke();
        }
    }
}, true);

// ---------- geometry helpers ----------
const _o = new THREE.Object3D(), _mb = new THREE.Matrix4(), _ml = new THREE.Matrix4(), _col = new THREE.Color();
function setInst(mesh, i, x, y, z, rx, ry, rz, sx, sy = sx, sz = sx, order = 'XYZ') {
    _o.position.set(x, y, z);
    _o.rotation.set(rx, ry, rz, order);
    _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    mesh.setMatrixAt(i, _o.matrix);
}
// groups of vertices sharing a position (uv seams, poles) – their normals are averaged
function weldGroups(geo) {
    const p = geo.attributes.position.array, map = new Map(), out = [];
    for (let i = 0; i < p.length / 3; i++) {
        const k = Math.round(p[i * 3] * 1e4) + ',' + Math.round(p[i * 3 + 1] * 1e4) + ',' + Math.round(p[i * 3 + 2] * 1e4);
        const g = map.get(k);
        if (g) g.push(i); else map.set(k, [i]);
    }
    for (const g of map.values()) if (g.length > 1) out.push(g);
    return out;
}
// smooth normals of an indexed geometry without allocating
function recomputeNormals(geo, weld) {
    const p = geo.attributes.position.array, n = geo.attributes.normal.array, idx = geo.index.array;
    n.fill(0);
    for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
        const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
        n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
        n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    for (const g of weld) {
        let x = 0, y = 0, z = 0;
        for (const v of g) { x += n[v * 3]; y += n[v * 3 + 1]; z += n[v * 3 + 2]; }
        for (const v of g) { n[v * 3] = x; n[v * 3 + 1] = y; n[v * 3 + 2] = z; }
    }
    for (let i = 0; i < n.length; i += 3) {
        const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
        n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    geo.attributes.normal.needsUpdate = true;
}
// Lathe body from a profile [[r, y] …] (bottom → top); per row ring centre / height / radius factor are filled each frame.
function latheBody(profile, segs, H) {
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    const np = profile.length, n = geo.attributes.position.count;
    const L = {
        geo, np, n, segs, weld: weldGroups(geo),
        R0: Float32Array.from(profile.map(p => p[0])), Y0: Float32Array.from(profile.map(p => p[1])),
        SA: new Float32Array(n), CA: new Float32Array(n), ANG: new Float32Array(n),
        cx: new Float32Array(np), cz: new Float32Array(np), y: new Float32Array(np), rm: new Float32Array(np)
    };
    for (let v = 0; v < n; v++) {
        const a = Math.floor(v / np) / segs * TAU;
        L.ANG[v] = a; L.SA[v] = Math.sin(a); L.CA[v] = Math.cos(a);
    }
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .5, 0), H * 1.1);
    return L;
}
// tiny rat (body centre at the origin, facing +z), vertex coloured
function ratGeo(coat, skin) {
    const parts = [];
    const part = (g, color, sx, sy, sz, x, y, z, rx = 0) => {
        g = g.clone();
        if (g.attributes.uv) g.deleteAttribute('uv');
        g.scale(sx, sy, sz);
        if (rx) g.rotateX(rx);
        g.translate(x, y, z);
        _col.set(color);
        const n = g.attributes.position.count, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        parts.push(g);
    };
    const ear = new THREE.Color(coat).lerp(new THREE.Color(skin), .6).getHex();
    part(new THREE.SphereGeometry(.05, 9, 6), coat, .8, .72, 1.5, 0, 0, -.012);                 // body
    part(new THREE.SphereGeometry(.032, 8, 6), coat, .9, .85, 1.25, 0, .012, .07);              // head
    part(new THREE.ConeGeometry(.019, .05, 6), coat, 1, 1, 1, 0, .006, .112, Math.PI / 2);      // snout
    part(new THREE.SphereGeometry(.0075, 5, 4), skin, 1, 1, 1, 0, .006, .138);                  // nose
    part(new THREE.SphereGeometry(.016, 6, 4), ear, 1, 1, .35, .022, .04, .064);                // ears
    part(new THREE.SphereGeometry(.016, 6, 4), ear, 1, 1, .35, -.022, .04, .064);
    part(new THREE.SphereGeometry(.0065, 5, 4), 0x080606, 1, 1, 1, .019, .022, .094);          // eyes
    part(new THREE.SphereGeometry(.0065, 5, 4), 0x080606, 1, 1, 1, -.019, .022, .094);
    part(taperTube([[0, 0, -.075], [0, -.012, -.13], [.02, -.022, -.19], [.045, -.026, -.24]], .008, .0025, 8, 4), skin, 1, 1, 1, 0, 0, 0);
    return mergeGeometries(parts);
}

export class ProceduralAmorphous {
    constructor(variant = 'cave-slime', { scale = 1 } = {}) {
        this.variant = AMORPHOUS_VARIANTS[variant] ? variant : 'cave-slime';
        this.c = { ...AMORPHOUS_VARIANTS[this.variant] };
        this.kind = this.c.kind;
        this.size = this.c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.name = 'amorphous';
        this.root.scale.setScalar(this.size);
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.j = { body: this.body };
        this.time = Math.random() * 50;
        this.lt = this.time;              // "live" time: stops when the creature is dead (everything ends still)
        this.live = 1;
        this.spin = 0;
        this.churn = 1;
        this.phase = 0;
        this.p = 0;
        this.yaw = null;
        this.state = null;
        this.stateTime = 0;
        this.q = { move: 0, lean: 0, wind: 0, surge: 0, tight: 0, scat: 0, low: 0, dead: 0 };
        this.T = { ...this.q };
        this.KEYS = Object.keys(this.q);
        this._cx = 0; this._cz = 0; this._y = 0; this._r = 0; this._rm = 1;
        const build = { funnel: this.buildFunnel, water: this.buildWater, fire: this.buildFire, slime: this.buildSlime,
            jelly: this.buildJelly, orb: this.buildOrb, cloud: this.buildCloud, swarm: this.buildSwarm }[this.kind];
        build.call(this);
        if (!this.j.head) this.j.head = this.body;
    }

    mesh(parent, geo, m, shadow = true) {
        const o = new THREE.Mesh(geo, m);
        o.castShadow = shadow;
        o.receiveShadow = shadow;
        parent.add(o);
        return o;
    }
    puff(parent, color, opacity, tex = puffTex(), additive = false) {
        const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
        const s = new THREE.Sprite(m);
        s.raycast = () => {};
        parent.add(s);
        return s;
    }

    update(c, dt) {
        this.time += dt;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;
        const p = this.p = c.actionDuration ? 1 - c.actionTime / c.actionDuration : (this.stateTime / .9) % 1;

        // state → targets of the damped scalars
        const T = this.T, q = this.q;
        T.move = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        T.lean = T.move * .11;
        T.wind = T.surge = T.tight = T.scat = T.low = T.dead = 0;
        if (state === 'attack') {
            T.wind = smooth(p / .38) * (1 - smooth((p - .38) / .12));
            T.surge = smooth((p - .36) / .14) * (1 - smooth((p - .64) / .36));
            T.lean = -.18 * T.wind + .5 * T.surge;
        } else if (state === 'defend') T.tight = 1;
        else if (state === 'hit') { T.scat = 1; T.lean = -.15; }
        else if (state === 'kneel') T.low = .5;
        else if (state === 'lie') T.low = .9;
        else if (state === 'death') T.dead = 1;
        const k = state === 'attack' ? 30 : state === 'hit' ? 18 : state === 'death' ? 3 : state === 'lie' || state === 'kneel' ? 4 : 7;
        for (const key of this.KEYS) q[key] = damp(q[key], T[key], key === 'dead' && state !== 'death' ? 8 : k, dt);

        this.live = 1 - smooth(Math.min(1, q.dead * 1.05));
        this.lt += dt * this.live;
        this.churn = (1 + q.move * .7 + q.surge * 1.6 + q.tight * .6 + q.scat * .8) * this.live;
        this.spin += dt * this.churn;
        if (T.move) this.phase += dt * (c.speed || 3) * (state === 'run' ? (c.runMultiplier || 1) : 1);

        this[this.anim](dt, state);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }

    // ================= air: whirlwind funnel =================
    buildFunnel() {
        const c = this.c, H = this.H = 2, SEG = 18, ROWS = 12;
        this.anim = 'animFunnel';
        this.ROWS = ROWS;
        this.RX = new Float32Array(ROWS + 1); this.RZ = new Float32Array(ROWS + 1);
        this.RY = new Float32Array(ROWS + 1); this.RR = new Float32Array(ROWS + 1);
        const shell = (color, opacity, rf, rep, speed) => {
            const geo = new THREE.CylinderGeometry(1, 1, 1, SEG, ROWS, true);
            geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .5, 0), H * 1.2);
            const tex = windTex().clone();
            tex.needsUpdate = true;
            tex.repeat.set(rep, 1);
            tex.offset.set(Math.random(), Math.random());
            const m = new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
            const mesh = this.mesh(this.body, geo, m, false);
            const n = geo.attributes.position.count, row = new Uint8Array(n), sa = new Float32Array(n), ca = new Float32Array(n), ang = new Float32Array(n);
            for (let v = 0; v < n; v++) {
                row[v] = Math.floor(v / (SEG + 1));
                ang[v] = (v % (SEG + 1)) / SEG * TAU;
                sa[v] = Math.sin(ang[v]); ca[v] = Math.cos(ang[v]);
            }
            return { mesh, geo, m, tex, row, sa, ca, ang, opacity, rf, speed };
        };
        this.shells = [shell(c.core, .62, .5, 3, .55), shell(c.color, .5, 1, 2, .3)];

        // debris: stones and leaves orbiting inside the funnel, falling to the ground when it dies
        const NS = c.stones, NL = c.leaves;
        this.stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.045, 0), mat(0x6e665c, { roughness: .95, flatShading: true }), NS);
        this.leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(.045, 6).scale(1, .55, 1), mat(0xffffff, { roughness: .9, side: THREE.DoubleSide }), NL);
        const leafCols = [0x6a8a2a, 0x8a9a3a, 0xa07a2a, 0x7a5a24, 0x4a6a24];
        this.debris = [];
        for (const [inst, n] of [[this.stones, NS], [this.leaves, NL]]) {
            inst.castShadow = true;
            inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .5, 0), H * 1.3);
            noRay(inst);
            this.body.add(inst);
            for (let i = 0; i < n; i++) {
                const leaf = inst === this.leaves, ga = Math.random() * TAU, gr = .15 + Math.random() * .6;
                if (leaf) inst.setColorAt(i, _col.set(leafCols[i % leafCols.length]));
                this.debris.push({ inst, i, leaf, f: .06 + Math.random() * .9, a: Math.random() * TAU, w: (2.2 + Math.random() * 2.4) * (Math.random() < .15 ? -.6 : 1),
                    rm: .75 + Math.random() * .5, s: leaf ? .8 + Math.random() * .5 : .5 + Math.random() * .9, gx: Math.sin(ga) * gr, gz: Math.cos(ga) * gr,
                    gy: leaf ? .006 : .025, tr: Math.random() * TAU, ts: 2 + Math.random() * 4 });
            }
        }
        // dust at the foot, storm cloud cap on the giant
        this.dust = [];
        for (let i = 0; i < 6; i++) this.dust.push({ sp: this.puff(this.body, c.dust, .45), a: i / 6 * TAU, r: .25 + Math.random() * .25, y: .12 + Math.random() * .16, s: .5 + Math.random() * .35, rot: Math.random() * TAU });
        this.cap = [];
        if (c.storm) for (let i = 0; i < 6; i++) this.cap.push({ sp: this.puff(this.body, c.storm, .75), a: i / 6 * TAU, r: .45 + Math.random() * .3, y: Math.random() * .2, s: .8 + Math.random() * .5, rot: Math.random() * TAU });
        this.j.head = new THREE.Group();
        this.body.add(this.j.head);
    }
    funnelAt(f) {
        const q = this.q, t = this.lt, H = this.H;
        const hMul = (1 - q.low * .5) * (1 + q.tight * .08 + q.wind * .12) * (1 - q.dead * .93);
        const prof = .08 + .68 * Math.pow(f, 1.4) + .1 * Math.pow(1 - f, 8);
        this._r = prof * (1 + .07 * Math.sin(t * 3.1 + f * 7)) * (1 - q.tight * .4 * f) * (1 + q.scat * .35 + q.low * .35 + q.dead * .7) * (1 + q.surge * .2 * f);
        this._y = f * H * hMul;
        this._cx = (Math.sin(t * 1.9 + f * 3.8) * .1 * f + Math.sin(t * 4.3 + f * 6) * .03) * (1 + q.scat * 2);
        this._cz = Math.cos(t * 1.5 + f * 3.1) * .08 * f + q.lean * H * .6 * f * f + q.surge * .35 * Math.sin(f * Math.PI) - q.wind * .15 * f;
    }
    animFunnel(dt) {
        const q = this.q, t = this.lt, ROWS = this.ROWS, live = this.live, dead = q.dead;
        for (let j = 0; j <= ROWS; j++) {
            this.funnelAt(1 - j / ROWS);
            this.RX[j] = this._cx; this.RZ[j] = this._cz; this.RY[j] = this._y; this.RR[j] = this._r;
        }
        for (const s of this.shells) {
            const pos = s.geo.attributes.position.array;
            for (let v = 0; v < s.row.length; v++) {
                const j = s.row[v];
                const r = this.RR[j] * s.rf * (1 + .09 * Math.sin(s.ang[v] * 3 + j * .8 - t * 5));
                pos[v * 3] = this.RX[j] + s.sa[v] * r;
                pos[v * 3 + 1] = this.RY[j];
                pos[v * 3 + 2] = this.RZ[j] + s.ca[v] * r;
            }
            s.geo.attributes.position.needsUpdate = true;
            s.tex.offset.x += dt * this.churn * s.speed;
            s.tex.offset.y -= dt * this.churn * .12;
            s.m.opacity = Math.min(.9, s.opacity * (1 - .85 * dead) * (1 - .3 * q.scat) * (1 + .3 * q.tight));
        }
        // debris
        const d = smooth(Math.min(1, dead * 1.4));
        for (const D of this.debris) {
            this.funnelAt(D.f);
            const a = D.a + this.spin * D.w, r = this._r * D.rm * (1 + q.scat * .9) + .03;
            const x = lerp(this._cx + Math.sin(a) * r, D.gx, d);
            const y = lerp(this._y + Math.sin(t * 2 + D.a) * .05, D.gy * D.s, d);
            const z = lerp(this._cz + Math.cos(a) * r, D.gz, d);
            const tr = D.tr + this.spin * D.ts;
            setInst(D.inst, D.i, x, y, z, lerp(tr, D.leaf ? -Math.PI / 2 : D.tr, d), lerp(tr * .7, D.tr, d), lerp(tr * .4, 0, d), D.s);
        }
        this.stones.instanceMatrix.needsUpdate = true;
        this.leaves.instanceMatrix.needsUpdate = true;
        // dust and storm cap
        const foot = 1 + q.scat * .8 + q.low * .4 + dead * .8 - q.tight * .3;
        for (const P of this.dust) {
            const a = P.a + this.spin * 1.4;
            P.sp.position.set(Math.sin(a) * P.r * foot + q.lean * .1, P.y * (1 - dead * .5), Math.cos(a) * P.r * foot);
            P.sp.scale.setScalar(P.s * (1 + dead * .5 + q.move * .15));
            P.rot += dt * this.churn * .8;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .45 * (1 - .55 * dead) * (1 + q.move * .3);
        }
        this.funnelAt(1);
        this.j.head.position.set(this._cx, this._y, this._cz);
        for (const P of this.cap) {
            const a = P.a + this.spin * .8;
            P.sp.position.set(this._cx + Math.sin(a) * P.r * this._r * 1.4, this._y + P.y, this._cz + Math.cos(a) * P.r * this._r * 1.4);
            P.sp.scale.setScalar(P.s * (1 + q.surge * .3 + dead * .4));
            P.rot += dt * this.churn * .4;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .75 * (1 - .9 * dead);
        }
    }

    // ================= water spirit =================
    buildWater() {
        const c = this.c, H = this.H = 2;
        this.anim = 'animWater';
        const prof = [[0, 0], [.62, .01], [.6, .05], [.48, .14], [.34, .3], [.25, .52], [.2, .8], [.23, 1.04], [.28, 1.26], [.25, 1.42],
            [.15, 1.52], [.09, 1.58], [.13, 1.66], [.15, 1.76], [.13, 1.86], [.07, 1.94], [0, 1.98]];
        const L = this.lath = latheBody(prof, 18, H);
        this.flow = flowTex().clone();
        this.flow.needsUpdate = true;
        this.flow.repeat.set(2, 1);
        this.wmat = new THREE.MeshStandardMaterial({ color: c.color, map: this.flow, emissive: c.deep, emissiveIntensity: .9, roughness: .08,
            metalness: .25, transparent: true, opacity: .74 });
        this.mesh(this.body, L.geo, this.wmat, false);
        // arms (left +x, right mirrored), head with glowing eyes
        this.arms = [1, -1].map(side => {
            const g = new THREE.Group();
            this.body.add(g);
            this.mesh(g, taperTube([[0, 0, 0], [side * .1, -.1, .03], [side * .16, -.3, .06], [side * .18, -.52, .1], [side * .17, -.7, .14]], .062, .032, 12, 6), this.wmat, false);
            this.mesh(g, new THREE.SphereGeometry(.05, 8, 6), this.wmat, false).position.set(side * .17, -.73, .15);
            g.userData.side = side;
            return g;
        });
        const head = this.j.head = new THREE.Group();
        this.body.add(head);
        const eyeM = new THREE.MeshBasicMaterial({ color: c.eye });
        for (const s of [1, -1]) {
            this.mesh(head, new THREE.SphereGeometry(.022, 6, 4), eyeM, false).position.set(s * .052, .012, .128);
            const glow = noRay(haloSprite(c.eye, .2, .7));
            glow.position.set(s * .052, .012, .15);
            head.add(glow);
        }
        // water "hair" streaming back from the head
        this.hair = new THREE.Group();
        head.add(this.hair);
        for (const x of [-.07, 0, .07]) this.mesh(this.hair, taperTube([[x, .12, -.02], [x * 1.3, .1, -.15], [x * 1.6, -.05, -.24], [x * 1.8, -.3, -.27], [x * 2, -.58, -.22]], .045, .012, 12, 6), this.wmat, false);
        // foam rings and spray at the foot
        const foam = mat(c.foam, { roughness: .5, emissive: 0x1e3a4a });
        this.foam = [[.56, .055], [.38, .045]].map(([r, tube]) => {
            const m = this.mesh(this.body, new THREE.TorusGeometry(r, tube, 5, 26), foam, false);
            m.rotation.x = -Math.PI / 2;
            return m;
        });
        // two spiralling foam streams wound around the lower body
        this.swirl = new THREE.Group();
        this.body.add(this.swirl);
        for (const a0 of [0, Math.PI]) {
            const pts = [];
            for (let i = 0; i <= 16; i++) {
                const u = i / 16, a = a0 + u * TAU * 1.3, r = .5 - u * .26;
                pts.push([Math.sin(a) * r, u * .95, Math.cos(a) * r]);
            }
            this.mesh(this.swirl, taperTube(pts, .028, .006, 32, 5), foam, false);
        }
        this.spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.028, 0), mat(c.foam, { roughness: .3, emissive: 0x2a5068 }), c.spray);
        this.spray.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .5, 0), 2);
        noRay(this.spray);
        this.body.add(this.spray);
        this.drops = [];
        for (let i = 0; i < c.spray; i++) this.drops.push({ a: Math.random() * TAU, rate: .55 + Math.random() * .6, ph: Math.random(), rmax: .25 + Math.random() * .35, h: .25 + Math.random() * .35 });
        this.mist = [];
        if (c.storm) for (let i = 0; i < 6; i++) this.mist.push({ sp: this.puff(this.body, c.storm, .35), a: i / 6 * TAU, r: .6 + Math.random() * .35, y: .3 + Math.random() * 1.1, s: .8 + Math.random() * .5, rot: 0 });
    }
    waterAt(y0) {
        const q = this.q, t = this.lt, H = this.H, f = y0 / H, ff = f * f;
        const hMul = (1 - q.low * .45) * (1 + q.wind * .12) * (1 - q.dead * .94);
        this._y = y0 * hMul - q.surge * .22 * ff * f * H;
        this._cx = Math.sin(t * 1.3 + f * 2.5) * .06 * f + q.scat * Math.sin(t * 20 + f * 5) * .07 * f;
        this._cz = q.lean * H * .4 * ff + q.surge * .8 * ff * f - q.wind * .22 * ff + Math.cos(t * 1.1 + f * 2) * .04 * f
            + Math.pow(1 - f, 4) * (q.surge * .3 + q.move * .1);
        this._rm = (1 - q.tight * .18) * (1 + q.scat * .15) * (1 + Math.pow(1 - f, 3) * (q.move * .25 + q.surge * .5 + q.low * .3 + q.dead * .75));
    }
    deformLathe(L, a1, k1, ky, w1, a2, k2, w2) {
        const pos = L.geo.attributes.position.array, t = this.lt;
        for (let v = 0; v < L.n; v++) {
            const j = v % L.np, ang = L.ANG[v], y0 = L.Y0[j];
            const r = L.R0[j] * L.rm[j] * (1 + a1 * Math.sin(ang * k1 + y0 * ky - t * w1) + a2 * Math.sin(ang * k2 + t * w2));
            pos[v * 3] = L.cx[j] + L.SA[v] * r;
            pos[v * 3 + 1] = L.y[j];
            pos[v * 3 + 2] = L.cz[j] + L.CA[v] * r;
        }
        L.geo.attributes.position.needsUpdate = true;
    }
    animWater(dt) {
        const q = this.q, L = this.lath, t = this.lt, live = this.live, dead = q.dead;
        for (let j = 0; j < L.np; j++) {
            this.waterAt(L.Y0[j]);
            L.cx[j] = this._cx; L.cz[j] = this._cz; L.y[j] = this._y; L.rm[j] = this._rm;
        }
        this.deformLathe(L, .07, 2, 5, 3.5, .03, 5, 6);
        recomputeNormals(L.geo, L.weld);
        this.flow.offset.y -= dt * this.churn * .35;
        this.flow.offset.x += dt * this.churn * .05;
        // head and arms ride on the deformed body
        this.waterAt(1.76);
        const head = this.j.head;
        head.position.set(this._cx, this._y, this._cz);
        head.rotation.set(q.lean * .5 + q.surge * .4 - q.wind * .3, Math.sin(t * .7) * .25 * live, 0);
        head.scale.setScalar(Math.max(.001, 1 - dead));
        this.waterAt(1.4);
        for (const g of this.arms) {
            const s = g.userData.side;
            g.position.set(this._cx + s * .25 * this._rm, this._y, this._cz);
            g.rotation.set(-(.1 + q.wind * 2.4 + q.surge * 1.0 + q.tight * 1.0 + q.move * .25) + q.scat * .5 + q.low * .3,
                0, s * (.45 + Math.sin(t * 1.6 + s) * .12 * live + q.wind * .9 + q.scat * .6 - q.tight * .55 + q.low * .4));
            g.scale.setScalar(Math.max(.001, 1 - dead * .97));
        }
        this.hair.rotation.set(-q.move * .3 - q.surge * .4 + q.wind * .3 + Math.sin(t * 1.8) * .1 * live, Math.sin(t * 1.3) * .2 * live, 0);
        // foam swirl, foam rings and spray at the foot
        this.waterAt(.3);
        this.swirl.position.set(this._cx, 0, this._cz);
        this.swirl.rotation.y = -this.spin * 1.6;
        this.swirl.visible = dead < .5;
        this.swirl.scale.set(this._rm, (1 - q.low * .45) * (1 - dead * .93) * (1 + q.wind * .1), this._rm);
        this.waterAt(0);
        const base = this._rm;
        this.foam.forEach((m, i) => {
            const fb = Math.min(base, 1.35);
            m.position.set(this._cx, .05 - dead * .07, this._cz);
            m.scale.set(fb * (1 + .04 * Math.sin(t * 3 + i)), fb * (1 + .04 * Math.cos(t * 2.6 + i)), 1 - dead * .7);
            m.rotation.z = this.spin * (i ? -.8 : .5);
        });
        for (let i = 0; i < this.drops.length; i++) {
            const D = this.drops[i], u = (t * D.rate + D.ph) % 1, a = D.a + this.spin * .3;
            const rr = (.42 + u * D.rmax) * (1 + q.scat * .7 + q.surge * .3) * base;
            const s = (1 - u * .6) * live;
            setInst(this.spray, i, Math.sin(a) * rr, .04 + 4 * u * (1 - u) * D.h * (1 + q.surge * 1.2 + q.move * .4), Math.cos(a) * rr + q.surge * u * .9 + this._cz,
                0, 0, 0, Math.max(.001, s));
        }
        this.spray.instanceMatrix.needsUpdate = true;
        for (const P of this.mist) {
            const a = P.a + this.spin * .6;
            P.sp.position.set(Math.sin(a) * P.r, P.y * (1 - q.low * .4 - dead * .8), Math.cos(a) * P.r + q.lean * .4);
            P.sp.scale.setScalar(P.s * (1 + dead * .5));
            P.rot += dt * this.churn * .5;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .35 * (1 - .75 * dead);
        }
    }

    // ================= fire pillar =================
    buildFire() {
        const c = this.c, H = this.H = 1.9;
        this.anim = 'animFire';
        const prof = [[0, 0], [.22, .02], [.26, .2], [.25, .5], [.28, .8], [.33, 1.04], [.38, 1.24], [.27, 1.37], [.13, 1.46], [.16, 1.57],
            [.15, 1.69], [.08, 1.82], [0, 1.95]];
        const add = THREE.AdditiveBlending;
        const fmat = (color, opacity, tex) => new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity, blending: add, depthWrite: false, side: THREE.DoubleSide });
        this.ftex = [flameTex().clone(), flameTex().clone()];
        this.ftex.forEach((tx, i) => { tx.needsUpdate = true; tx.repeat.set(2 + i, 1.3); tx.offset.x = i * .37; });
        this.core = [latheBody(prof, 14, H), latheBody(prof, 12, H)];
        this.coreMat = [fmat(c.color, .95, this.ftex[0]), fmat(c.core, .85, this.ftex[1])];
        this.core.forEach((L, i) => { const m = this.mesh(this.body, L.geo, this.coreMat[i], false); m.renderOrder = i; });
        this.core[1].R0 = this.core[1].R0.map(r => r * .55);
        // flame tongues (soft additive sprites, always upright): along the body, big ones in the core, head "hair", hands
        this.tongues = [];
        const tongue = (parent, y0, a, rf, w, h) => {
            const sp = this.puff(parent, 0xffffff, .9, tongueTex(), true);
            sp.center.set(.5, .08);
            sp.scale.set(w, h, 1);
            const T = { sp, y0, a, rf, w, h, seed: Math.random() * 10 };
            if (parent === this.body) this.tongues.push(T);
            return T;
        };
        for (let i = 0; i < 10; i++) tongue(this.body, .08 + i * .13, i * 2.4, 1, .34, .62);
        for (let i = 0; i < 4; i++) tongue(this.body, .1 + i * .3, i * 1.7, .25, .62, 1.05);
        for (let i = 0; i < 6; i++) tongue(this.body, 1.58 + (i % 2) * .1, i / 6 * TAU, .7, .32, .7);
        // burning arms with a flame licking up from each hand
        this.arms = [1, -1].map(side => {
            const g = new THREE.Group();
            this.body.add(g);
            const arm = this.mesh(g, new THREE.CylinderGeometry(.08, .035, .66, 7, 1, true).translate(0, -.33, 0), this.coreMat[0], false);
            arm.rotation.z = side * .15;
            const hand = new THREE.Group();
            hand.position.set(side * .05, -.62, .02);
            g.add(hand);
            g.userData = { side, hand: tongue(hand, 0, 0, 0, .3, .55), seed: Math.random() * 10 };
            return g;
        });
        // forward fire jet (attack)
        this.jet = new THREE.Group();
        this.body.add(this.jet);
        this.mesh(this.jet, new THREE.ConeGeometry(.26, 1.0, 8).translate(0, .5, 0).rotateX(Math.PI / 2), fmat(c.color, .8, this.ftex[0]), false);
        this.mesh(this.jet, new THREE.ConeGeometry(.12, .75, 6).translate(0, .375, 0).rotateX(Math.PI / 2), fmat(c.core, .85, this.ftex[1]), false);
        // sparks, glow halo, scorch glow on the ground
        this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.018, 0),
            new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, blending: add, depthWrite: false }), 16);
        this.sparks.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2);
        noRay(this.sparks);
        this.body.add(this.sparks);
        this.sparkD = [];
        for (let i = 0; i < 16; i++) this.sparkD.push({ x: (Math.random() - .5) * .4, z: (Math.random() - .5) * .4, rate: .35 + Math.random() * .4, ph: Math.random() });
        this.halo = noRay(haloSprite(0xff7020, 2.4, .35));
        this.body.add(this.halo);
        this.scorch = this.mesh(this.body, new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff5a14, transparent: true, opacity: .5, blending: add, depthWrite: false }), false);
        this.scorch.position.y = .015;
        noRay(this.scorch);
        this.j.head = new THREE.Group();
        this.body.add(this.j.head);
    }
    fireAt(y0) {
        const q = this.q, t = this.lt, H = this.H, f = y0 / H;
        const hMul = (1 - q.low * .45) * (1 + q.surge * .22 + q.wind * .1 - q.tight * .1) * (1 - q.dead * .9);
        this._y = y0 * hMul;
        this._cx = Math.sin(t * 2.3 + f * 3) * .05 * f + q.scat * Math.sin(t * 23 + f * 4) * .06;
        this._cz = q.lean * H * .45 * f * f + q.surge * .25 * f + Math.cos(t * 1.9 + f * 2.6) * .04 * f;
        this._rm = (1 - q.tight * .25) * (1 + q.scat * .2 + q.surge * .15) * (1 + (q.low * .4 + q.dead * 1.2) * (1 - f));
    }
    animFire(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead;
        for (const L of this.core) {
            for (let j = 0; j < L.np; j++) {
                this.fireAt(L.Y0[j]);
                L.cx[j] = this._cx; L.cz[j] = this._cz; L.y[j] = this._y; L.rm[j] = this._rm;
            }
            this.deformLathe(L, .14, 3, 6, 9, .07, 5, 13);
        }
        const flick = .85 + .15 * Math.sin(t * 17) * Math.sin(t * 7.3);
        this.ftex[0].offset.y -= dt * 1.3 * live * (1 + q.surge);
        this.ftex[1].offset.y -= dt * 1.7 * live * (1 + q.surge);
        this.coreMat[0].opacity = .95 * (1 - .55 * dead);
        this.coreMat[1].opacity = .85 * (1 + q.tight * .2) * (1 - .6 * dead);
        // tongues
        const grow = (1 + .5 * q.surge + .3 * q.wind + .3 * q.scat) * (1 - .72 * dead);
        for (const T of this.tongues) {
            this.fireAt(T.y0);
            const r = .27 * this._rm * T.rf * (T.y0 > 1.5 ? .5 : 1) + q.scat * .1, sa = Math.sin(T.a), ca = Math.cos(T.a);
            T.sp.position.set(this._cx + sa * r, this._y, this._cz + ca * r);
            const s = grow * (T.y0 > 1.5 ? 1 + q.surge * .5 : 1);
            T.sp.scale.set(T.w * s * (.9 + .15 * Math.sin(t * 8 + T.seed)), T.h * s * (.7 + .4 * Math.abs(Math.sin(t * 9 + T.seed)) + .15 * Math.sin(t * 14 + T.seed * 2)), 1);
            T.sp.material.rotation = Math.sin(t * 6 + T.seed) * .15 - sa * .2;
            T.sp.material.opacity = .9 * (1 - .35 * dead);
        }
        // arms
        this.fireAt(1.3);
        for (const g of this.arms) {
            const { side: s, hand, seed } = g.userData;
            g.position.set(this._cx + s * .34 * this._rm, this._y, this._cz);
            g.rotation.set(-(.1 + q.wind * 2.2 + q.surge * 1.3 + q.tight * .9 + q.move * .2) + q.scat * .5 + q.low * .3,
                0, s * (.25 + Math.sin(t * 2.2 + s) * .1 * live + q.wind * .7 + q.scat * .6 - q.tight * .5 + q.low * .4));
            g.scale.setScalar(Math.max(.001, 1 - dead * .9));
            hand.sp.scale.set(hand.w * (1 + q.surge * .5), hand.h * (.8 + .4 * Math.abs(Math.sin(t * 10 + seed)) + q.surge), 1);
            hand.sp.material.rotation = Math.sin(t * 7 + seed) * .2;
        }
        // jet
        this.fireAt(1.15);
        const js = q.surge * (1 - dead);
        this.jet.visible = js > .02;
        this.jet.position.set(this._cx, this._y, this._cz + .15);
        this.jet.scale.set(js * (1 + .2 * Math.sin(t * 21)), js * (1 + .2 * Math.sin(t * 17)), js * (1.2 + .25 * Math.sin(t * 13)));
        // sparks
        for (let i = 0; i < this.sparkD.length; i++) {
            const D = this.sparkD[i], u = (t * D.rate + D.ph) % 1;
            const s = (1 - u) * live * (1 + q.scat + q.surge);
            setInst(this.sparks, i, D.x * (1 + u + q.scat * 2) + Math.sin(t * 3 + D.ph * 9) * .08, .2 + u * 2.3 * (1 - q.low * .4),
                D.z * (1 + u + q.scat * 2) + q.lean * u * 1.2 + q.surge * u, t * 3, t * 2, 0, Math.max(.001, s));
        }
        this.sparks.instanceMatrix.needsUpdate = true;
        this.fireAt(1.0);
        this.halo.position.set(this._cx, this._y, this._cz);
        this.halo.material.opacity = .35 * flick * (1 + .7 * q.surge) * (1 - .85 * dead);
        this.halo.scale.setScalar(2.4 * (1 + .3 * q.surge - .2 * q.tight) * (1 - .5 * dead));
        this.scorch.material.opacity = .5 * flick * (1 - .45 * dead);
        this.scorch.scale.setScalar(1 + q.low * .2 + q.surge * .3);
        this.fireAt(1.65);
        this.j.head.position.set(this._cx, this._y, this._cz);
    }

    // ================= cave slime =================
    buildSlime() {
        const c = this.c;
        this.anim = 'animSlime';
        const geo = this.sgeo = new THREE.SphereGeometry(1, 26, 14);
        this.sbase = Float32Array.from(geo.attributes.position.array);
        this.sweld = weldGroups(geo);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .2, 0), 1.2);
        this.smat = new THREE.MeshStandardMaterial({ color: c.color, roughness: .16, metalness: .05, emissive: c.glow, emissiveIntensity: .6 });
        this.mesh(this.body, geo, this.smat);
        // stinging pseudopods
        const tg = taperTube([[0, 0, 0], [0, .03, .1], [0, .035, .2], [0, .012, .3]], .035, .008, 8, 5);
        this.tent = [-1.9, -.8, 0, .8, 1.9].map((th, i) => {
            const g = new THREE.Group();
            this.mesh(g, tg, this.smat);
            this.body.add(g);
            return { g, th, e: .3, timer: 1 + Math.random() * 3, lash: 0, seed: i * 1.7, front: Math.abs(th) < 1 };
        });
    }
    animSlime(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead;
        const pos = this.sgeo.attributes.position.array, B = this.sbase;
        const R = .46, Hb = .12;
        const crest = Math.max(.02, (.22 + q.wind * .3 - q.tight * .14 + q.surge * .08) * (1 - dead));
        const curl = Math.max(0, .2 + q.surge * 1.1 + q.move * .06 - q.tight * .3);
        const hMul = (1 - q.low * .55) * (1 - dead * .72) * (1 + q.tight * .35);
        const spread = (1 + q.low * .12 + dead * .35 + q.scat * .15) * (1 - q.tight * .15);
        const shift = q.surge * .28 - q.wind * .08;
        for (let v = 0; v < B.length; v += 3) {
            const ux = B[v], uy = B[v + 1], uz = B[v + 2];
            const bump = Math.exp(-((uz + .4) * (uz + .4) / .4 + ux * ux / .7));       // crest towards the back
            let h = (Hb + crest * bump) * hMul * (1 + .12 * Math.sin(ux * 5 + 1) * Math.sin(uz * 4 + 2));
            h *= 1 + q.move * .15 * Math.sin(uz * 3.5 - this.phase * 6) + .07 * Math.sin(t * 2.2 + ux * 3 + uz * 2) + q.scat * .3 * Math.sin(t * 19 + ux * 5) * live;
            const Y = uy > 0 ? .012 + uy * h : (1 + uy) * .012, yn = uy > 0 ? uy * bump : 0;
            pos[v] = ux * R * spread * (1 + .05 * Math.sin(t * 1.7 + uz * 4));
            pos[v + 1] = Y;
            pos[v + 2] = uz * R * 1.12 * spread * (1 + q.move * .12 + q.surge * .3 * (uz > 0 ? uz : 0)) + shift + curl * yn * yn * yn * crest * hMul * 1.6;
        }
        this.sgeo.attributes.position.needsUpdate = true;
        recomputeNormals(this.sgeo, this.sweld);
        // pseudopods: idle lashes on own timers, attack shoots the front ones forward
        for (const P of this.tent) {
            P.timer -= dt * live;
            if (P.timer <= 0) { P.lash = 1; P.timer = 2 + Math.random() * 4; }
            P.lash = Math.max(0, P.lash - dt * 1.3 * live);
            let e = .3 + .9 * Math.sin(P.lash * Math.PI) + q.move * .15, lift = .3 * Math.sin(P.lash * Math.PI), yaw = P.th;
            if (P.front) {
                e += q.surge * 2.2 + q.wind * .3;
                lift += q.wind * .7 - q.surge * .55;
                yaw *= 1 - q.surge * .6;
            }
            e = lerp(e, .12, q.tight);
            e = lerp(e, .22, q.low);
            e = lerp(e, .35, dead) + q.scat * .4 * Math.abs(Math.sin(t * 13 + P.seed));
            lift = lerp(lift, -.15, Math.max(q.low, dead)) + .2 * Math.sin(t * 3 + P.seed) * live;
            const rx = Math.sin(P.th) * R * .8 * spread, rz = Math.cos(P.th) * R * .85 * spread + shift;
            P.g.position.set(rx, .05 * (1 - dead), rz);
            P.g.rotation.set(-lift, yaw + Math.sin(t * 4 + P.seed) * .25 * live, 0);
            P.g.scale.set(.7 + .3 * e, .7 + .3 * e, e);
        }
    }

    // ================= living jelly (gelatinous cube) =================
    buildJelly() {
        const c = this.c;
        this.anim = 'animJelly';
        this.E = 1.5;
        const geo = this.jgeo = new THREE.SphereGeometry(1, 20, 14);
        const P = geo.attributes.position.array, n = P.length / 3;
        // superquadric mapping: unit sphere → rounded cube (-.5 … .5)
        const sq = x => Math.sign(x) * Math.pow(Math.abs(x), .28) * .5;
        this.jbase = new Float32Array(P.length);
        const col = new Float32Array(P.length), top = new THREE.Color(c.top), bot = new THREE.Color(c.bottom);
        for (let i = 0; i < n; i++) {
            const x = sq(P[i * 3]), y = sq(P[i * 3 + 1]), z = sq(P[i * 3 + 2]);
            this.jbase[i * 3] = x; this.jbase[i * 3 + 1] = y; this.jbase[i * 3 + 2] = z;
            _col.copy(bot).lerp(top, smooth((y + .5) * 1.3 - .1));
            col[i * 3] = _col.r; col[i * 3 + 1] = _col.g; col[i * 3 + 2] = _col.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.jweld = weldGroups(geo);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .75, 0), 1.6);
        this.jmat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .52, roughness: .08, metalness: .05,
            emissive: 0x2a4a0c, emissiveIntensity: .45, depthWrite: false });
        const m = this.mesh(this.body, geo, this.jmat, false);
        m.renderOrder = 2;
        // things floating inside
        const bone = mat(0xd8cfae, { roughness: .7 }), gold = mat(0xd8a830, { roughness: .3, metalness: .8 }), steel = mat(0x8a8e94, { roughness: .35, metalness: .7 });
        const dark = mat(0x201810, { roughness: 1 }), bub = mat(0xeaffd0, { roughness: .1, emissive: 0x3a5a20 });
        this.items = [];
        const item = (g, x, y, z, rx = 0, ry = 0) => { g.rotation.set(rx, ry, 0); this.body.add(g); this.items.push({ g, x, y, z, rx, ry, ph: Math.random() * TAU, sp: (Math.random() - .5) * .6 }); return g; };
        const skull = new THREE.Group();
        this.mesh(skull, new THREE.SphereGeometry(.09, 10, 8), bone).scale.set(.9, .95, 1.05);
        this.mesh(skull, new THREE.BoxGeometry(.08, .04, .07), bone).position.set(0, -.07, .03);
        for (const s of [1, -1]) this.mesh(skull, new THREE.SphereGeometry(.022, 6, 4), dark).position.set(s * .033, .0, .078);
        item(skull, -.12, .55, .05, .3, .6);
        for (const [x, y, z, ry] of [[.15, .3, -.15, .9], [-.2, .2, -.2, -.4]]) {
            const b = new THREE.Group();
            this.mesh(b, new THREE.CylinderGeometry(.017, .017, .28, 6), bone).rotation.z = Math.PI / 2;
            for (const s of [1, -1]) for (const k of [1, -1]) this.mesh(b, new THREE.SphereGeometry(.026, 6, 4), bone).position.set(s * .14, 0, k * .015);
            item(b, x, y, z, .2, ry);
        }
        const coin = new THREE.CylinderGeometry(.035, .035, .008, 10);
        for (let i = 0; i < 5; i++) {
            const g = new THREE.Group();
            this.mesh(g, coin, gold);
            item(g, (Math.random() - .5) * .7, .06 + Math.random() * .25, (Math.random() - .5) * .7, Math.random() * 2, 0);
        }
        const sword = new THREE.Group();
        this.mesh(sword, new THREE.BoxGeometry(.035, .5, .007), steel).position.y = .28;
        this.mesh(sword, new THREE.BoxGeometry(.13, .02, .025), steel);
        this.mesh(sword, new THREE.CylinderGeometry(.013, .013, .1, 6), mat(0x4a3020)).position.y = -.06;
        item(sword, .18, .45, .1, .4, 1.2).rotation.z = 1.1;
        for (let i = 0; i < 7; i++) {
            const g = new THREE.Group();
            this.mesh(g, new THREE.SphereGeometry(.015 + Math.random() * .03, 6, 4), bub, false);
            item(g, (Math.random() - .5) * .75, .15 + Math.random() * .65, (Math.random() - .5) * .75);
        }
        this.j.head = this.items[0].g;
    }
    animJelly(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead, E = this.E;
        const pos = this.jgeo.attributes.position.array, B = this.jbase;
        const hMul = (1 - q.low * .4) * (1 - dead * .82) * (1 + q.tight * .06 + q.wind * .07);
        const wide = (1 + q.low * .12 + dead * .42 + q.scat * .08) * (1 - q.tight * .1);
        const jig = .025 * live + q.scat * .07;
        const shear = q.lean * .3 - q.wind * .12;
        for (let v = 0; v < B.length; v += 3) {
            const bx = B[v], by = B[v + 1], bz = B[v + 2], u = by + .5;
            let X = bx * E * wide, Y = u * E * hMul, Z = bz * E * wide;
            X += (Math.sin(t * 2.1 + u * 2) * jig + Math.sin(t * 23) * q.scat * .04) * u * E;
            Z += (shear + Math.sin(t * 1.7 + u * 2.5) * jig * .7) * u * E;
            Y *= 1 + q.move * .03 * Math.sin(bz * 5 - this.phase * 5) + .015 * Math.sin(t * 2.6 + bx * 4) * live;
            if (bz > 0) Z += q.surge * .55 * E * bz * 2 * Math.sin(Math.min(1, u) * Math.PI * .85 + .25);
            pos[v] = X; pos[v + 1] = Y; pos[v + 2] = Z;
        }
        this.jgeo.attributes.position.needsUpdate = true;
        recomputeNormals(this.jgeo, this.jweld);
        this.jmat.opacity = .52 * (1 + q.tight * .3) * (1 - .25 * dead);
        // floating things follow the jelly's shape
        for (const I of this.items) {
            const u = I.y / E + .0;
            const y = Math.max(.04, (I.y + Math.sin(t * .9 + I.ph) * .03) * hMul);
            const x = I.x * wide + Math.sin(t * 2.1 + u * 2) * jig * u * E;
            const z = I.z * wide + shear * u * E + (I.z > 0 ? q.surge * .25 * E : 0);
            I.g.position.set(x, y, z);
            I.g.rotation.set(I.rx + Math.sin(t * .5 + I.ph) * .3 * live, I.ry + t * I.sp, lerp(0, 1.4 * Math.sign(I.sp), dead * (I.y > .3 ? 1 : 0)));
        }
    }

    // ================= chasfon: ball of magic light =================
    buildOrb() {
        const c = this.c;
        this.anim = 'animOrb';
        const add = THREE.AdditiveBlending;
        this.orb = new THREE.Group();
        this.body.add(this.orb);
        this.j.head = this.orb;
        this.stex = swirlTex().clone();
        this.stex.needsUpdate = true;
        this.coreM = new THREE.MeshBasicMaterial({ color: c.color, map: this.stex, transparent: true, opacity: .95, blending: add, depthWrite: false });
        this.coreMesh = this.mesh(this.orb, new THREE.IcosahedronGeometry(.13, 2), this.coreM, false);
        this.mesh(this.orb, new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaf6ff }), false);
        this.halos = [noRay(haloSprite(c.color, .9, .75)), noRay(haloSprite(c.color, 2.2, .22))];
        for (const h of this.halos) this.orb.add(h);
        // lightning: NB bolts of NS segments, regenerated every few frames
        this.NB = 5; this.NS = 6;
        this.boltPos = new Float32Array(this.NB * this.NS * 6);
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3));
        this.boltM = new THREE.LineBasicMaterial({ color: c.bolt, transparent: true, opacity: .9, blending: add, depthWrite: false });
        this.bolts = new THREE.LineSegments(bg, this.boltM);
        this.bolts.frustumCulled = false;
        noRay(this.bolts);
        this.orb.add(this.bolts);
        this.boltT = 0;
        // motes on tilted orbits
        this.motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.016, 0),
            new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, blending: add, depthWrite: false }), 10);
        this.motes.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
        noRay(this.motes);
        this.orb.add(this.motes);
        this.moteD = [];
        for (let i = 0; i < 10; i++) this.moteD.push({ r: .2 + Math.random() * .16, w: (1.5 + Math.random() * 2) * (i % 2 ? 1 : -1), a: Math.random() * TAU, tilt: (Math.random() - .5) * 2.4 });
    }
    regenBolts(ty, tz) {
        const q = this.q, P = this.boltPos, NS = this.NS;
        for (let b = 0; b < this.NB; b++) {
            let dx, dy, dz, len;
            if (b < 2 && q.surge > .3) {                 // aimed at the victim in front
                const l = Math.hypot(ty, tz);
                dx = (Math.random() - .5) * .1; dy = ty / l; dz = tz / l; len = l * Math.min(1, q.surge * 1.4);
            } else {
                dx = Math.random() * 2 - 1; dy = Math.random() * 2 - 1; dz = Math.random() * 2 - 1;
                const l = Math.hypot(dx, dy, dz) || 1;
                dx /= l; dy /= l; dz /= l;
                len = (.22 + Math.random() * .45) * (1 + q.scat * .6 + q.wind * .4) * (1 - q.tight * .55) * (1 - q.low * .5);
            }
            let px = dx * .12, py = dy * .12, pz = dz * .12;
            const j = len / NS * .7;
            for (let k = 0; k < NS; k++) {
                const f = (k + 1) / NS;
                const nx = dx * (.12 + len * f) + (k < NS - 1 ? (Math.random() - .5) * j : 0);
                const ny = dy * (.12 + len * f) + (k < NS - 1 ? (Math.random() - .5) * j : 0);
                const nz = dz * (.12 + len * f) + (k < NS - 1 ? (Math.random() - .5) * j : 0);
                const o = (b * NS + k) * 6;
                P[o] = px; P[o + 1] = py; P[o + 2] = pz; P[o + 3] = nx; P[o + 4] = ny; P[o + 5] = nz;
                px = nx; py = ny; pz = nz;
            }
        }
        this.bolts.geometry.attributes.position.needsUpdate = true;
    }
    animOrb(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead;
        const hover = lerp(1.3 + Math.sin(t * 1.6) * .09 + q.wind * .15 - q.surge * .1, .06, Math.max(q.low * .85, smooth(dead)));
        const s = (1 + q.surge * .4 + q.wind * .15) * (1 - q.tight * .25) * (1 - q.scat * .2) * (1 - dead * .72) * (1 + .05 * Math.sin(t * 7));
        this.orb.position.set(Math.sin(t * .9) * .06 * live + q.scat * Math.sin(t * 30) * .04, hover, q.surge * .25 - q.wind * .1 + q.lean * .2);
        this.orb.scale.setScalar(s);
        this.coreMesh.rotation.y += dt * this.churn * 1.2;
        this.coreMesh.rotation.x += dt * this.churn * .5;
        this.stex.offset.x += dt * this.churn * .2;
        const flick = q.scat > .2 ? (Math.random() < .5 ? .3 : 1) : 1;
        this.coreM.opacity = .95 * flick * (1 - .4 * dead);
        this.halos[0].material.opacity = .75 * flick * (1 + q.tight * .3 + q.surge * .3) * (1 - .6 * dead);
        this.halos[1].material.opacity = .22 * (1 + q.surge) * (1 - .7 * dead);
        this.halos[1].scale.setScalar(2.2 * (1 + q.surge * .5) * (1 - q.low * .55));
        // lightning
        this.boltT -= dt;
        if (this.boltT <= 0 && live > .05) {
            this.regenBolts((1 - hover) / s, (1.1 - this.orb.position.z) / s);
            this.boltT = .05 + Math.random() * .08;
            this.boltM.opacity = (.35 + Math.random() * .65) * (1 + q.surge);
        }
        this.bolts.visible = live > .4;
        for (let i = 0; i < this.moteD.length; i++) {
            const M = this.moteD[i], a = M.a + this.spin * M.w, r = M.r * (1 + q.scat * 1.5 - q.tight * .3);
            setInst(this.motes, i, Math.cos(a) * r, Math.sin(a) * r * Math.sin(M.tilt), Math.sin(a) * r * Math.cos(M.tilt), a, a, 0, Math.max(.001, live));
        }
        this.motes.instanceMatrix.needsUpdate = true;
    }

    // ================= clouds of mist (cloud form, vampires) =================
    buildCloud() {
        const c = this.c;
        this.anim = 'animCloud';
        this.puffs = [];
        const P = (x, y, z, s, kind, idx = 0, o = .9) => {
            const sp = this.puff(this.body, new THREE.Color(c.color).multiplyScalar(.8 + Math.random() * .4), o);
            const D = { sp, x, y, z, s, kind, idx, o, ph: Math.random() * TAU, w: (Math.random() - .5) * 1.2, rot: Math.random() * TAU };
            this.puffs.push(D);
            return D;
        };
        for (let k = 0; k < 9; k++) P(Math.sin(k * 1.7) * .06, .2 + k * .15, Math.cos(k * 1.3) * .05 - .02 * k, .38 + .09 * k, 0);
        P(.24, 1.42, -.02, .72, 0);
        P(-.24, 1.42, -.02, .72, 0);
        this.headPuff = P(0, 1.76, .1, .62, 1);
        P(0, 1.88, -.1, .7, 0);
        this.handPuff = {};
        for (const side of [1, -1]) {
            P(side * .42, 1.36, .06, .55, 2, 0);
            P(side * .6, 1.18, .16, .46, 2, 1);
            this.handPuff[side] = P(side * .7, .98, .26, .38, 2, 2);
        }
        for (let i = 0; i < 5; i++) P(Math.sin(i * 1.3) * .32, .4 + i * .26, Math.cos(i * 1.3) * .24, 1.25, 3, i, .3);
        // eyes, glints
        this.eyes = [1, -1].map(s => { const e = this.puff(this.body, c.eye, 1, glowTex(), true); e.userData.side = s; return e; });
        this.glints = [];
        for (let i = 0; i < c.glints; i++) this.glints.push({ sp: this.puff(this.body, c.glint, 0, glowTex(), true), host: this.puffs[(i * 7) % 19], ox: (Math.random() - .5) * .3, oy: (Math.random() - .5) * .3, s: .1 + Math.random() * .14, ph: Math.random() * TAU, w: 2 + Math.random() * 4 });
        // clawed hands at the ends of the arms
        const claw = new THREE.ConeGeometry(.02, .19, 4).translate(0, .095, 0).rotateX(Math.PI);
        const cm = mat(0x0e0c10, { roughness: .45 });
        this.hands = [1, -1].map(side => {
            const g = new THREE.Group();
            for (let i = 0; i < 4; i++) {
                const m = this.mesh(g, claw, cm);
                m.position.x = (i - 1.5) * .035;
                m.rotation.z = (i - 1.5) * .2;
            }
            g.userData.side = side;
            this.body.add(g);
            return g;
        });
        this.j.head = new THREE.Group();
        this.body.add(this.j.head);
    }
    cloudPos(D, out) {
        const q = this.q, t = this.lt, live = this.live;
        let x = D.x, y = D.y, z = D.z;
        const f = D.y / 1.9;
        x += Math.sin(t * 1.1 + D.ph) * .05 * live;
        y += Math.cos(t * .9 + D.ph) * .04 * live;
        z += Math.sin(t * .8 + D.ph * 1.3) * .04 * live;
        if (D.kind === 2) {
            const a = D.idx + 1, side = Math.sign(D.x);
            y += q.wind * .2 * a - q.surge * .06 * a - q.tight * .1 * a;
            z += -q.wind * .08 * a + q.surge * (.25 + .22 * a) + q.tight * .12 * a;
            x += side * (q.wind * .1 * a - q.surge * .13 * a - q.tight * .12 * a + q.scat * .15 * a);
        } else if (D.kind === 1) {
            z += q.surge * .35 - q.wind * .12;
            y -= q.surge * .1;
        } else z += q.surge * .3 * f;
        z += q.lean * D.y * .45 - q.move * .18 * (1 - f) * (1 - f);
        x *= 1 - .3 * q.tight;
        z *= 1 - .2 * q.tight;
        x += Math.sin(D.ph * 7) * q.scat * .35;
        z += Math.cos(D.ph * 5) * q.scat * .3;
        y += Math.sin(D.ph * 3) * q.scat * .15;
        y = y * (1 - q.low * .6);
        x *= 1 + q.low * .3;
        const d = smooth(q.dead);
        out.x = x * (1 + d * 1.2); out.y = lerp(y, .12 + D.s * .32 + f * .1, d); out.z = z * (1 + d * .8);
        return out;
    }
    animCloud(dt) {
        const q = this.q, t = this.lt, live = this.live, d = smooth(q.dead), o = this._v || (this._v = { x: 0, y: 0, z: 0 });
        for (const D of this.puffs) {
            this.cloudPos(D, o);
            const s = D.s * (1 + q.surge * .25 - q.tight * .1 + d * .55 + q.low * .15) * (1 + .06 * Math.sin(t * 1.7 + D.ph));
            D.sp.position.set(o.x, o.y, o.z);
            D.sp.scale.set(s, s, 1);
            D.rot += dt * D.w * live;
            D.sp.material.rotation = D.rot;
            D.sp.material.opacity = Math.min(1, D.o * (1 + q.tight * .15) * (1 - .72 * d) * (1 - .25 * q.scat));
        }
        const head = this.headPuff.sp.position;
        this.j.head.position.copy(head);
        for (const e of this.eyes) {
            e.position.set(head.x + e.userData.side * .075, head.y + .02, head.z + .26);
            e.scale.setScalar(.11 * (1 + q.surge * .4 + q.wind * .3));
            e.material.opacity = (1 - d) * (.8 + .2 * Math.sin(t * 5));
        }
        for (const G of this.glints) {
            const hp = G.host.sp.position;
            G.sp.position.set(hp.x + G.ox, hp.y + G.oy, hp.z + .15);
            G.sp.scale.setScalar(G.s * (1 + q.surge * .5));
            const f = Math.max(0, Math.sin(t * G.w + G.ph));
            G.sp.material.opacity = f * f * (1 - d) * (1 + q.surge * .5);
        }
        for (const h of this.hands) {
            const tip = this.handPuff[h.userData.side].sp.position;
            h.position.set(tip.x + h.userData.side * .06, tip.y - .08, tip.z + .05);
            h.rotation.set(-.4 - q.surge * 1.2 - q.wind * .3 + q.tight * .3, 0, h.userData.side * (.3 + q.wind * .4));
            h.scale.setScalar(Math.max(.001, 1 - d));
        }
    }

    // ================= vermin: swarm of tiny rats =================
    buildSwarm() {
        const c = this.c, N = c.count;
        this.anim = 'animSwarm';
        this.ratBodies = new THREE.InstancedMesh(ratGeo(c.coat, c.skin), mat(0xffffff, { vertexColors: true, roughness: .9 }), N);
        this.ratLegs = new THREE.InstancedMesh(new THREE.BoxGeometry(.011, .034, .011).translate(0, -.017, 0), mat(c.skin, { roughness: .8 }), N * 4);
        for (const m of [this.ratBodies, this.ratLegs]) {
            m.castShadow = true;
            m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .1, 0), .8);
            this.body.add(m);
        }
        this.rats = [];
        for (let i = 0; i < N; i++) {
            const a = i / N * TAU + Math.random() * .4, r = .12 + (i % 3) * .1;
            const hx = Math.sin(a) * r, hz = Math.cos(a) * r;
            this.ratBodies.setColorAt(i, _col.setScalar(.8 + Math.random() * .35));
            this.rats.push({ x: hx, z: hz, hx, hz, ang: a, h: Math.random() * TAU, tx: hx, tz: hz, timer: Math.random(), pause: 0,
                ph: Math.random() * TAU, amp: 0, pitch: 0, roll: 0, y: .045, s: .85 + Math.random() * .3,
                dr: Math.random() < .5 ? (Math.random() < .5 ? 1.5 : -1.5) : 2.8, seed: Math.random() * 10 });
        }
        this.hips = [[.022, -.012, .04, 0], [-.022, -.012, .04, Math.PI], [.025, -.012, -.04, Math.PI], [-.025, -.012, -.04, 0]];
    }
    animSwarm(dt, state) {
        const q = this.q, t = this.lt, dead = q.dead, moving = state === 'walk' || state === 'run';
        const run = state === 'run';
        for (let i = 0; i < this.rats.length; i++) {
            const R = this.rats[i];
            let tx = R.x, tz = R.z, th = null, spd = 0, pitch = 0, roll = 0, y = .045, k = 6, amp = 0;
            if (state === 'idle') {                    // scurry about with pauses, sniffing
                R.timer -= dt;
                if (R.timer <= 0) {
                    const a = Math.random() * TAU, r = Math.random() * .34;
                    R.tx = Math.sin(a) * r; R.tz = Math.cos(a) * r;
                    R.pause = Math.random() < .45 ? .4 + Math.random() * .9 : 0;
                    R.timer = 1 + Math.random() * 1.6;
                }
                R.pause -= dt;
                const dx = R.tx - R.x, dz = R.tz - R.z, dist = Math.hypot(dx, dz);
                if (R.pause <= 0 && dist > .03) {
                    R.h = dampAngle(R.h, Math.atan2(dx, dz), 9, dt);
                    spd = .35;
                    R.x += Math.sin(R.h) * spd * dt; R.z += Math.cos(R.h) * spd * dt;
                    amp = 1;
                } else pitch = -.15 - .15 * Math.max(0, Math.sin(t * 9 + R.seed));
                tx = R.x; tz = R.z;
            } else if (moving) {                       // run along with the group, weaving
                tx = R.hx + Math.sin(t * 1.3 + i) * .08;
                tz = R.hz + Math.sin(t * .9 + i * 2) * .12;
                th = Math.sin(t * 3 + i) * .35;
                amp = 1; spd = run ? 1.6 : 1; k = 3;
            } else if (state === 'attack') {           // swarm forward and leap at the victim
                tx = R.hx * .8;
                tz = .26 + .2 * q.surge + R.hz * .25;
                th = -R.hx * 1.2;
                y += q.surge * .07 * Math.abs(Math.sin(this.time * 12 + R.seed));
                pitch = -.5 * q.surge + .3 * q.wind;
                amp = .8; spd = 1.2; k = 10;
            } else if (state === 'defend') {           // bunch up, face outwards, rear up
                tx = Math.sin(R.ang) * .13; tz = Math.cos(R.ang) * .13;
                th = R.ang; pitch = -.55; amp = .3; spd = .6; k = 8;
            } else if (state === 'hit') {              // scatter
                const r = Math.hypot(R.hx, R.hz) || .1;
                tx = R.hx / r * .42; tz = R.hz / r * .42;
                th = Math.atan2(R.hx, R.hz); amp = 1; spd = 1.6; k = 9; roll = .3 * Math.sin(R.seed);
            } else if (state === 'kneel') { pitch = -.6; }
            else if (state === 'lie') { y = .03; }
            else if (state === 'death') { roll = R.dr; y = Math.abs(R.dr) > 2 ? .036 : .04; }
            if (state !== 'idle') {
                const ox = R.x, oz = R.z;
                R.x = damp(R.x, tx, k, dt); R.z = damp(R.z, tz, k, dt);
                const mx = R.x - ox, mz = R.z - oz;
                if (th === null && Math.hypot(mx, mz) > dt * .05) th = Math.atan2(mx, mz);
                if (th !== null && state !== 'death') R.h = dampAngle(R.h, th, 8, dt);
            }
            const lim = Math.hypot(R.x, R.z);
            if (lim > .45) { R.x *= .45 / lim; R.z *= .45 / lim; }
            R.amp = damp(R.amp, amp * (1 - dead), 10, dt);
            R.ph += dt * (spd || .4) * 26 * (amp > 0 ? 1 : 0);
            R.pitch = damp(R.pitch, pitch, 10, dt);
            R.roll = damp(R.roll, roll, state === 'death' ? 6 : 10, dt);
            R.y = damp(R.y, y + Math.max(0, -R.pitch) * .04 + Math.abs(Math.sin(R.ph)) * .008 * R.amp, 12, dt);
            setInst(this.ratBodies, i, R.x, R.y * R.s, R.z, R.pitch, R.h, R.roll, R.s, R.s, R.s, 'YXZ');
            this.ratBodies.getMatrixAt(i, _mb);
            for (let l = 0; l < 4; l++) {
                const H = this.hips[l], hx = H[0], hy = H[1], hz = H[2], off = H[3];
                let a = Math.sin(R.ph + off) * .8 * R.amp;
                if (state === 'lie') a = hz > 0 ? -1.3 : 1.3;
                else if (state === 'death') a = (hz > 0 ? -.6 : .6) + Math.sin(R.seed + l) * .3;
                else if (state === 'kneel' && hz > 0) a = -.9;
                _o.position.set(hx, hy, hz);
                _o.rotation.set(a - (hz > 0 ? 0 : R.pitch * .8), 0, 0);
                _o.scale.set(1, 1, 1);
                _o.updateMatrix();
                _ml.multiplyMatrices(_mb, _o.matrix);
                this.ratLegs.setMatrixAt(i * 4 + l, _ml);
            }
        }
        this.ratBodies.instanceMatrix.needsUpdate = true;
        this.ratLegs.instanceMatrix.needsUpdate = true;
    }
}
