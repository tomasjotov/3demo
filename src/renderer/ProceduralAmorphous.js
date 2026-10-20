import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIRECTIONS } from '../utils/constants.js';
import { mat } from '../avatar/kit.js';
import { taperTube } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralAmorphous — creatures without a skeleton (or with a body made of an element). The shapes themselves are
 * animated: tubes along a moving spine, deformed lathe / sphere geometry, scrolling canvas textures, orbiting debris
 * (instanced), billboard puffs (sprites) and a swarm of tiny rats.
 *
 *   kind 'air'    (air-elemental, air-elemental-giant): misty humanoid of billowing cloud puffs (head, shoulders, arms)
 *        whose lower body is a whirling funnel with a scrolling wind texture; stones and leaves orbit in it, dust at the
 *        foot; the giant is a dense grey storm figure with dark clawed hands and dark eye hollows.
 *   kind 'water'  (water-elemental, -giant): translucent glowing water spirit with flowing streaks, glowing eyes, hair
 *        of water and clawed hands. The small one rises out of a curling wave (a wide tube along a moving spine, foam
 *        on the crest); the giant stands on a flowing robe of falling water with mist and spray at its foot.
 *   kind 'fire'   (fire-elemental): striding humanoid of flame — ember-red core under an additive flame shell, flame
 *        tongues on the head, body and limbs, sparks, glow halo and scorched glow on the ground; legs walk with 2-bone IK;
 *        attack is a burning claw strike with a fire jet.
 *   kind 'slime'  (cave-slime): glowing glossy blue slime shaped like a breaking wave: a tail creeping on the ground that
 *        rises into a crest curling forward; stinging pseudopods; blue glow on the cave floor.
 *   kind 'jelly'  (living-jelly): glossy lumpy jelly cube, green fading to amber with cells, a skull, bones, coins and a
 *        sword inside.
 *   kind 'orb'    (chasfon): hovering head-sized ball of blue light with swirls, halo, motes and lightning bolts.
 *   kind 'cloud'  (cloud-form, vampire-cloud-form, vampire-elder-cloud-form): hunched figure of dark billowing smoke that
 *        streams back into a tail, glowing eyes, arms ending in claws; vampires black with red-lit billow edges.
 *   kind 'swarm'  (vermin): 5–8 tiny rats running around the cell (instanced bodies and legs).
 *
 * States (damped scalars move, lean, wind, surge, tight, scat, low, dead): idle (churning, breathing), walk / run (drift
 * or stride forward with faster churn), attack (wind-up → strike → recover: the air figure lashes, the wave crashes and
 * the spirit thrusts its claws, the fire figure claws and jets, slime crest slams down with pseudopods, jelly bulges, orb
 * fires a bolt, cloud envelops with its claws, rats swarm and leap), defend (contracts / guards), hit (scatters /
 * flinches), kneel / lie (sinks low), death (dissipates / collapses to a puddle, embers, fallen debris or dead rats; ends
 * still). Same interface as the other rigs: `root`, `j`, `update(c, dt)`.
 */

export const AMORPHOUS_VARIANTS = {
    'air-elemental': { kind: 'air', scale: 1, color: 0xdce4ec, core: 0xa8a294, dust: 0xa89a80, stones: 8, leaves: 12, puff: 'air', top: .3, eye: 0, bulk: .78 },
    'air-elemental-giant': { kind: 'air', scale: 3.4, color: 0xc8c4bc, core: 0x7a746a, dust: 0x8a7c66, stones: 14, leaves: 16, puff: 'airG', top: .36,
        bulk: 1.25, hands: 0x26262a, sockets: 0x1a1a1e },
    'water-elemental': { kind: 'water', wave: true, scale: 1.2, color: 0xc8f4ff, glow: 0x3a98d4, face: 0, deep: 0x1a5a9a, foam: 0xeaf8ff, eye: 0xd8ffff, spray: 22 },
    'water-elemental-giant': { kind: 'water', scale: 3.2, color: 0xb4e2f4, glow: 0x2a6e9a, face: 0x3a6a8a, foam: 0xe4f2fa, eye: 0xf0ffff, spray: 30, storm: 0xc8dce8 },
    'fire-elemental': { kind: 'fire', scale: 1, color: 0xff8a2c, core: 0xffd070, ember: 0xffb878 },
    'cave-slime': { kind: 'slime', scale: 1, color: 0xa0f2ff, glow: 0x0e98c4 },
    'living-jelly': { kind: 'jelly', scale: 1, top: 0x3c9a22, bottom: 0xd0901c },
    'chasfon': { kind: 'orb', scale: 1, color: 0x58aeff, bolt: 0xd8f0ff },
    'cloud-form': { kind: 'cloud', scale: 1, puff: 'cloud', eye: 0xc8dcff, glints: 0, hands: 0x101216 },
    'vampire-cloud-form': { kind: 'cloud', scale: 1.05, puff: 'vamp', eye: 0xff3434, glint: 0xff2638, glints: 5, hands: 0x0c080c },
    'vampire-elder-cloud-form': { kind: 'cloud', scale: 1.2, puff: 'vampE', eye: 0xff2020, glint: 0xff3a8c, glints: 8, hands: 0x0a060c, bulk: 1.1 },
    'vermin': { kind: 'swarm', scale: 1.1, count: 7, coat: 0x6c655e, skin: 0xdc9a94 }
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
// piecewise linear profile [[s, v] …] sampled at s
const profAt = (P, s) => {
    for (let i = 1; i < P.length; i++) if (s <= P[i][0]) return lerp(P[i - 1][1], P[i][1], (s - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
    return P[P.length - 1][1];
};

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
// turbulence noise field (n × n, 0..1): sum of |2·valueNoise − 1| octaves → billows with dark creases
function turbField(n, rnd, oct = 5, base = 3) {
    const out = new Float32Array(n * n);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
        const g = base << o, G = new Float32Array((g + 1) * (g + 1));
        for (let i = 0; i < G.length; i++) G[i] = rnd();
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const fx = x / n * g, fy = y / n * g, ix = Math.floor(fx), iy = Math.floor(fy);
            const tx = smooth(fx - ix), ty = smooth(fy - iy), r0 = iy * (g + 1), r1 = r0 + g + 1;
            const v = lerp(lerp(G[r0 + ix], G[r0 + ix + 1], tx), lerp(G[r1 + ix], G[r1 + ix + 1], tx), ty);
            out[y * n + x] += amp * Math.abs(2 * v - 1);
        }
        tot += amp;
        amp *= .55;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
}
// billowing smoke puff: turbulent billows lit from above, ragged soft edge; rim = glow in the creases (vampires)
const PUFFS = {
    air: [[250, 252, 255], [128, 146, 170]],
    airG: [[248, 246, 240], [112, 108, 100]],
    cloud: [[96, 108, 126], [12, 14, 20]],
    vamp: [[56, 44, 58], [6, 4, 8], [255, 46, 78]],
    vampE: [[48, 36, 58], [5, 3, 9], [236, 56, 140]]
};
const billowTex = key => canvasTex('billow-' + key, 128, 128, (g, w, h, rnd) => {
    const [light, shade, rim] = PUFFS[key], N = 128;
    const T = turbField(N, rnd), M = turbField(N, rnd, 2, 2), img = g.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, t = T[i], r = Math.hypot(x - 64, y - 64) / 64;
        const k = smooth(t * 1.5 + .05) * (1.08 - .45 * y / N);
        let R = lerp(shade[0], light[0], k), G = lerp(shade[1], light[1], k), B = lerp(shade[2], light[2], k);
        if (rim) {
            const c = Math.max(0, 1 - Math.abs(t - .16) / .1) * smooth((M[i] - .35) / .3);
            R = lerp(R, rim[0], c); G = lerp(G, rim[1], c); B = lerp(B, rim[2], c);
        }
        d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = B;
        d[i * 4 + 3] = 255 * Math.min(1, Math.max(0, (1 - r) * 2.4 + (t - .45) * 1.6)) * smooth((1 - r) / .35);
    }
    g.putImageData(img, 0, 0);
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
    g.fillStyle = 'rgba(255,255,255,.12)';
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
// flowing water: dark blue with bright wavy streaks and swirls (used as map and emissive map)
const flowTex = () => canvasTex('flow2', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = 'rgb(140,186,220)';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
        const x0 = rnd() * w, ph = rnd() * TAU, amp = 3 + rnd() * 9, k = 1 + Math.floor(rnd() * 2);
        g.strokeStyle = `rgba(${200 + (rnd() * 55) | 0},245,255,${(.25 + rnd() * .6).toFixed(2)})`;
        g.lineWidth = .8 + rnd() * 3;
        for (const ox of [-w, 0, w]) {
            g.beginPath();
            for (let y = 0; y <= h; y += 4) {
                const x = x0 + ox + Math.sin(y / h * TAU * k + ph) * amp;
                if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.stroke();
        }
    }
    for (let i = 0; i < 10; i++) {
        const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 10;
        g.strokeStyle = 'rgba(230,250,255,.5)';
        g.lineWidth = 1.2;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 4); g.stroke(); }
    }
}, true);
// glossy slime: blue-white streaks and bright specks
const slimeTex = () => canvasTex('slime', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = 'rgb(150,200,232)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
        const x0 = rnd() * w, ph = rnd() * TAU;
        g.strokeStyle = `rgba(225,248,255,${(.08 + rnd() * .2).toFixed(2)})`;
        g.lineWidth = 2 + rnd() * 6;
        for (const ox of [-w, 0, w]) {
            g.beginPath();
            for (let y = 0; y <= h; y += 4) {
                const x = x0 + ox + Math.sin(y / h * TAU + ph) * 8;
                if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
            }
            g.stroke();
        }
    }
    for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${(.5 + rnd() * .5).toFixed(2)})`;
        g.beginPath(); g.arc(rnd() * w, rnd() * h, .6 + rnd() * 1.6, 0, TAU); g.fill();
    }
}, true);
// jelly cells: faint rings and pale bubbles on white (multiplies the vertex colours)
const cellTex = () => canvasTex('cells', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
        const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 11;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            g.fillStyle = rnd() < .5 ? 'rgba(120,150,20,.22)' : 'rgba(255,250,170,.35)';
            g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(60,90,10,.14)';
            g.lineWidth = 1.2;
            g.stroke();
        }
    }
}, true);
// flame tongues on black (for additive blending); horiz = tongues stretched along u (tubes)
const flameTex = (horiz = false, base = '#000') => canvasTex('flame' + horiz + base, horiz ? 128 : 64, horiz ? 64 : 128, (g, w, h, rnd) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
        const x0 = rnd() * w, y0 = rnd() * h, rx = 4 + rnd() * 6, ry = 12 + rnd() * 18;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            g.save();
            g.translate(x0 + ox, y0 + oy);
            if (horiz) g.scale(ry / rx, 1); else g.scale(1, ry / rx);
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
// curly light filaments on dark blue (chasfon)
const swirlTex = () => canvasTex('swirl2', 128, 128, (g, w, h, rnd) => {
    g.fillStyle = '#0a1c38';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
        const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 26, a = rnd() * TAU;
        g.strokeStyle = `rgba(${150 + (rnd() * 105) | 0},${215 + (rnd() * 40) | 0},255,${(.45 + rnd() * .5).toFixed(2)})`;
        g.lineWidth = .8 + rnd() * 2.2;
        for (const ox of [-w, 0, w]) {
            g.beginPath(); g.arc(x + ox, y, r, a, a + 1.5 + rnd() * 3.5); g.stroke();
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
// Tube along a spine that moves every frame (slime, wave): N rings of S segments; ring i sits at spine point
// (X, Y, Z)[i] (spine in the y-z plane) with an elliptic section RX (sideways) × RN (in-plane normal). The first and last
// rings must have radius 0 (closed tips). Vertices below the ground are flattened onto it.
function spineTube(N, S, H) {
    const n = N * (S + 1), uv = new Float32Array(n * 2), idx = [], weld = [];
    for (let i = 0; i < N; i++) for (let k = 0; k <= S; k++) {
        const v = i * (S + 1) + k;
        uv[v * 2] = k / S; uv[v * 2 + 1] = i / (N - 1);
    }
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < S; k++) {
        const a = i * (S + 1) + k, b = a + S + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    for (let i = 0; i < N; i++) {
        if (i === 0 || i === N - 1) { const g = []; for (let k = 0; k <= S; k++) g.push(i * (S + 1) + k); weld.push(g); }
        else weld.push([i * (S + 1), i * (S + 1) + S]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .4, 0), H * 1.2);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-H * .4, 0, -H * .5), new THREE.Vector3(H * .4, H, H * .4));
    const T = { geo, N, S, weld, X: new Float32Array(N), Y: new Float32Array(N), Z: new Float32Array(N),
        RX: new Float32Array(N), RN: new Float32Array(N), CA: new Float32Array(S + 1), SA: new Float32Array(S + 1) };
    for (let k = 0; k <= S; k++) { T.CA[k] = Math.cos(k / S * TAU); T.SA[k] = Math.sin(k / S * TAU); }
    return T;
}
function updateSpineTube(T, floor = .004) {
    const P = T.geo.attributes.position.array, N = T.N, S = T.S;
    // round tip: the closing ring sits beyond the last ring by its radius, along the spine
    {
        const a = N - 2, b = N - 3, ty = T.Y[a] - T.Y[b], tz = T.Z[a] - T.Z[b], l = Math.hypot(ty, tz) || 1, r = Math.min(T.RN[a], T.RX[a]) * .95;
        T.Y[N - 1] = T.Y[a] + ty / l * r; T.Z[N - 1] = T.Z[a] + tz / l * r; T.X[N - 1] = T.X[a];
    }
    for (let i = 0; i < N; i++) {
        const i0 = i > 0 ? i - 1 : 0, i1 = i < N - 1 ? i + 1 : N - 1;
        const ty = T.Y[i1] - T.Y[i0], tz = T.Z[i1] - T.Z[i0], l = Math.hypot(ty, tz) || 1;
        const ny = tz / l, nz = -ty / l;
        for (let k = 0; k <= S; k++) {
            const v = (i * (S + 1) + k) * 3, rn = T.SA[k] * T.RN[i];
            P[v] = T.X[i] + T.CA[k] * T.RX[i];
            P[v + 1] = Math.max(floor, T.Y[i] + rn * ny);
            P[v + 2] = T.Z[i] + rn * nz;
        }
    }
    T.geo.attributes.position.needsUpdate = true;
    recomputeNormals(T.geo, T.weld);
}
// integrate a spine from direction angles: ground part (s < s1, nearly flat) then a rising arc th0 → th1
function integrateSpine(T, s1, Lg, Lr, th0, th1, ripple, ph, curl = 1) {
    const N = T.N;
    T.Y[0] = 0; T.Z[0] = 0;
    for (let i = 1; i < N; i++) {
        const s = (i - .5) / (N - 1);
        let th, len;
        if (s < s1) { th = ripple * Math.sin(s * 14 - ph); len = Lg / (s1 * (N - 1)); }
        else {
            const w = (s - s1) / (1 - s1);
            th = w < .2 ? th0 * smooth(w / .2) : lerp(th0, th1, Math.pow((w - .2) / .8, curl));
            len = Lr / ((1 - s1) * (N - 1));
        }
        T.Z[i] = T.Z[i - 1] + Math.cos(th) * len;
        T.Y[i] = T.Y[i - 1] + Math.sin(th) * len;
    }
}
// clawed hand hanging down (-y): palm and four curled fingers
function clawHand(len, r) {
    const parts = [new THREE.SphereGeometry(r * 1.3, 8, 6).scale(1, 1.25, .55).translate(0, -r * .7, 0)];
    for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * r * .72;
        parts.push(taperTube([[x, -r * 1.2, 0], [x * 1.4, -r * 1.2 - len * .5, len * .12], [x * 1.6, -r * 1.2 - len, len * .34]], r * .34, r * .07, 5, 4));
    }
    parts.push(taperTube([[r * .9, -r * .6, r * .2], [r * 1.5, -r * 1.2, len * .3], [r * 1.5, -r * 1.6 - len * .3, len * .45]], r * .34, r * .07, 5, 4));
    return mergeGeometries(parts);
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
    const ear = new THREE.Color(coat).lerp(new THREE.Color(skin), .75).getHex();
    const belly = new THREE.Color(coat).lerp(new THREE.Color(0xd8ccc0), .45).getHex();
    part(new THREE.SphereGeometry(.05, 9, 6), coat, .82, .74, 1.5, 0, 0, -.012);                // body
    part(new THREE.SphereGeometry(.045, 8, 5), belly, .75, .5, 1.25, 0, -.014, -.008);          // pale belly
    part(new THREE.SphereGeometry(.032, 8, 6), coat, .9, .85, 1.25, 0, .012, .07);              // head
    part(new THREE.ConeGeometry(.019, .05, 6), coat, 1, 1, 1, 0, .006, .112, Math.PI / 2);      // snout
    part(new THREE.SphereGeometry(.0075, 5, 4), skin, 1, 1, 1, 0, .006, .138);                  // nose
    part(new THREE.SphereGeometry(.019, 6, 4), ear, 1, 1, .35, .023, .042, .062);               // ears
    part(new THREE.SphereGeometry(.019, 6, 4), ear, 1, 1, .35, -.023, .042, .062);
    part(new THREE.SphereGeometry(.0065, 5, 4), 0x080606, 1, 1, 1, .019, .022, .094);          // eyes
    part(new THREE.SphereGeometry(.0065, 5, 4), 0x080606, 1, 1, 1, -.019, .022, .094);
    part(taperTube([[0, 0, -.075], [0, -.012, -.13], [.02, -.022, -.19], [.045, -.026, -.24]], .01, .003, 8, 4), skin, 1, 1, 1, 0, 0, 0);
    return mergeGeometries(parts);
}
// invisible pick / framing proxy (renders nothing; gives the rig a body for raycasts and bounding boxes)
let proxyMat = null;
function pickProxy(r, h, y0 = 0) {
    proxyMat = proxyMat || new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8).translate(0, y0 + h / 2, 0), proxyMat);
    m.castShadow = m.receiveShadow = false;
    return m;
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
        this.figX = 0; this.figZ = 0;
        this.anim = [];
        const build = { air: this.buildAir, water: this.buildWater, fire: this.buildFire, slime: this.buildSlime,
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
    puff(parent, color, opacity, tex, additive = false) {
        const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
        const s = new THREE.Sprite(m);
        s.raycast = () => {};
        parent.add(s);
        return s;
    }
    // arm hanging down (-y) from a shoulder group: shoulder → upper arm → elbow → forearm → hand; side +1 = left (+x)
    arm(parent, side, m, L1, L2, r0, r1, r2, handGeo, handMat) {
        const sh = new THREE.Group();
        parent.add(sh);
        this.mesh(sh, taperTube([[0, 0, 0], [0, -L1 * .5, .012], [0, -L1, 0]], r0, r1, 6, 7), m, false);
        const el = new THREE.Group();
        el.position.y = -L1;
        sh.add(el);
        this.mesh(el, taperTube([[0, 0, 0], [0, -L2 * .5, .012], [0, -L2, 0]], r1, r2, 6, 7), m, false);
        const hd = new THREE.Group();
        hd.position.y = -L2;
        el.add(hd);
        if (handGeo) this.mesh(hd, handGeo, handMat || m, false);
        return { sh, el, hd, side, seed: Math.random() * 10 };
    }
    // shoulder pitch (negative = forward / up), abduction (outwards), elbow bend (negative = forearm forward)
    poseArm(A, pitch, abduct, elbow) {
        A.sh.rotation.set(pitch, 0, A.side * abduct);
        A.el.rotation.set(elbow, 0, 0);
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

        for (const a of this.anim) this[a](dt, state);

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-8 * dt));
        this.root.rotation.y = this.yaw;
    }

    // ================= air: misty figure on a whirling funnel =================
    buildAir() {
        this.buildFunnel();
        this.buildCloud();
    }
    buildFunnel() {
        const c = this.c, H = this.H = 1.3, SEG = 18, ROWS = 12;
        this.anim.push('animFunnel');
        this.ROWS = ROWS;
        this.fTop = c.top - .08;
        this.RX = new Float32Array(ROWS + 1); this.RZ = new Float32Array(ROWS + 1);
        this.RY = new Float32Array(ROWS + 1); this.RR = new Float32Array(ROWS + 1);
        const shell = (color, opacity, rf, rep, speed) => {
            const geo = new THREE.CylinderGeometry(1, 1, 1, SEG, ROWS, true);
            geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .5, 0), H * 1.2);
            geo.boundingBox = new THREE.Box3(new THREE.Vector3(-c.top, 0, -c.top), new THREE.Vector3(c.top, H, c.top));
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
        this.shells = [shell(c.core, .62, .55, 3, .55), shell(c.color, .55, 1, 2, .3)];

        // debris: stones and leaves orbiting inside the funnel, falling to the ground when it dies
        const NS = c.stones, NL = c.leaves;
        this.stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.04, 0), mat(0x6e665c, { roughness: .95, flatShading: true }), NS);
        this.leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(.04, 6).scale(1, .55, 1), mat(0xffffff, { roughness: .9, side: THREE.DoubleSide }), NL);
        const leafCols = [0x6a8a2a, 0x8a9a3a, 0xa07a2a, 0x7a5a24, 0x4a6a24];
        this.debris = [];
        for (const [inst, n] of [[this.stones, NS], [this.leaves, NL]]) {
            inst.castShadow = true;
            inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * .5, 0), H * 1.3);
            noRay(inst);
            this.body.add(inst);
            for (let i = 0; i < n; i++) {
                const leaf = inst === this.leaves, ga = Math.random() * TAU, gr = .15 + Math.random() * .5;
                if (leaf) inst.setColorAt(i, _col.set(leafCols[i % leafCols.length]));
                this.debris.push({ inst, i, leaf, f: .06 + Math.random() * .85, a: Math.random() * TAU, w: (2.2 + Math.random() * 2.4) * (Math.random() < .15 ? -.6 : 1),
                    rm: .8 + Math.random() * .6, s: leaf ? .8 + Math.random() * .5 : .5 + Math.random() * .9, gx: Math.sin(ga) * gr, gz: Math.cos(ga) * gr,
                    gy: leaf ? .006 : .025, tr: Math.random() * TAU, ts: 2 + Math.random() * 4 });
            }
        }
        // dust at the foot
        const dtex = billowTex(c.puff);
        this.dust = [];
        for (let i = 0; i < 6; i++) this.dust.push({ sp: this.puff(this.body, c.dust, .5, dtex), a: i / 6 * TAU, r: .22 + Math.random() * .22, y: .1 + Math.random() * .14, s: .45 + Math.random() * .3, rot: Math.random() * TAU });
    }
    funnelAt(f) {
        const q = this.q, t = this.lt, H = this.H;
        const hMul = (1 - q.low * .5) * (1 + q.tight * .06 + q.wind * .1) * (1 - q.dead * .93);
        const prof = .07 + this.fTop * Math.pow(f, 1.3) + .1 * Math.pow(1 - f, 8);
        this._r = prof * (1 + .08 * Math.sin(t * 3.1 + f * 7)) * (1 - q.tight * .3 * f) * (1 + q.scat * .35 + q.low * .35 + q.dead * .7) * (1 + q.surge * .2 * f);
        this._y = f * H * hMul;
        this._cx = (Math.sin(t * 1.9 + f * 3.8) * .08 * f + Math.sin(t * 4.3 + f * 6) * .03) * (1 + q.scat * 2);
        this._cz = Math.cos(t * 1.5 + f * 3.1) * .06 * f + q.lean * H * .5 * f * f + q.surge * .25 * Math.sin(f * Math.PI) - q.wind * .12 * f;
    }
    animFunnel(dt) {
        const q = this.q, t = this.lt, ROWS = this.ROWS, dead = q.dead;
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
        // dust
        const foot = 1 + q.scat * .8 + q.low * .4 + dead * .8 - q.tight * .3;
        for (const P of this.dust) {
            const a = P.a + this.spin * 1.4;
            P.sp.position.set(Math.sin(a) * P.r * foot + q.lean * .1, P.s * .3 + P.y * (1 - dead * .5), Math.cos(a) * P.r * foot);
            P.sp.scale.setScalar(P.s * (1 + dead * .5 + q.move * .15));
            P.rot += dt * this.churn * .8;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .5 * (1 - .55 * dead) * (1 + q.move * .3);
        }
        // the cloud figure rides on the funnel top
        this.funnelAt(1);
        this.figX = this._cx; this.figZ = this._cz;
    }

    // ================= water spirit (small one rides a wave) =================
    buildWater() {
        const c = this.c, H = this.H = 2, wave = !!c.wave;
        this.anim.push('animWater');
        this.robe = wave ? .25 : 1;
        this.depth = wave ? .85 : .72;          // bodies are flatter front-to-back than wide
        this.flow = flowTex().clone();
        this.flow.needsUpdate = true;
        this.flow.repeat.set(2, wave ? 1.2 : 1.6);
        this.wmat = new THREE.MeshStandardMaterial({ color: c.color, map: this.flow, emissive: c.glow, emissiveMap: this.flow, emissiveIntensity: 1.1,
            roughness: .06, metalness: .15, transparent: true, opacity: wave ? .8 : .7 });
        // body: torso rising from the wave, or a robe of falling water from the ground to the shoulders
        const prof = wave
            ? [[0, .5], [.2, .52], [.17, .66], [.15, .82], [.18, .98], [.21, 1.1], [.22, 1.2], [.17, 1.3], [.1, 1.36], [.055, 1.43], [0, 1.47]]
            : [[0, .3], [.1, .31], [.13, .45], [.18, .65], [.21, .82], [.21, .95], [.24, 1.1], [.28, 1.25], [.29, 1.36], [.2, 1.45], [.1, 1.52], [.06, 1.58], [0, 1.62]];
        this.headY = wave ? 1.56 : 1.71;
        this.shY = wave ? 1.24 : 1.4;
        const L = this.lath = latheBody(prof, 20, H);
        this.mesh(this.body, L.geo, this.wmat, false);
        // head (the giant has a dark face) with glowing eyes and streaming water hair
        const head = this.j.head = new THREE.Group();
        this.body.add(head);
        const faceM = c.face ? new THREE.MeshStandardMaterial({ color: c.face, map: this.flow, roughness: .1, metalness: .1, emissive: 0x0e2a40, transparent: true, opacity: .85 }) : this.wmat;
        this.mesh(head, new THREE.SphereGeometry(.12, 14, 10).scale(.82, 1.08, .95), faceM, false);
        const eyeM = new THREE.MeshBasicMaterial({ color: c.eye });
        for (const s of [1, -1]) {
            this.mesh(head, new THREE.SphereGeometry(.019, 6, 4).scale(1.3, .7, .6), eyeM, false).position.set(s * .042, .012, .105);
            const glow = noRay(haloSprite(c.eye, .22, .8));
            glow.position.set(s * .042, .012, .13);
            head.add(glow);
        }
        this.hair = new THREE.Group();
        head.add(this.hair);
        const hair = wave
            ? x => [[x, .1, -.03], [x * 1.6, .08, -.16], [x * 2.2, -.08, -.28], [x * 2.6, -.32, -.36], [x * 3, -.6, -.38]]
            : a => { const sa = Math.sin(a), ca = Math.cos(a);
                return [[sa * .07, .08, -ca * .07], [sa * .15, .12, -ca * .17], [sa * .23 + .03, .04, -ca * .26], [sa * .29 + .06, -.16, -ca * .3], [sa * .33 + .1, -.38, -ca * .28]]; };
        for (const x of wave ? [-.07, -.025, .025, .07] : [-1.2, -.7, -.2, .3, .8, 1.3]) this.mesh(this.hair, taperTube(hair(x), .045, .01, 12, 6), this.wmat, false);
        // arms with clawed hands
        const hand = clawHand(wave ? .09 : .11, wave ? .03 : .034);
        const [L1, L2] = wave ? [.32, .3] : [.38, .36];
        this.arms = [1, -1].map(s => this.arm(this.body, s, this.wmat, L1, L2, wave ? .058 : .07, wave ? .042 : .052, wave ? .028 : .034, hand));
        // giant: the lower body dissolves into streams of falling water
        if (!wave) {
            const parts = [];
            for (let i = 0; i < 9; i++) {
                const a = i / 9 * TAU + .3, r0 = .06 + (i % 2) * .04, r1 = .2 + (i % 3) * .1, w = (i % 2 ? 1 : -1) * .04, y0 = .5 + (i % 3) * .08;
                const sa = Math.sin(a), ca = Math.cos(a);
                parts.push(taperTube([[sa * r0, y0, ca * r0], [sa * (r0 + .03) + w, y0 * .66, ca * (r0 + .03)], [sa * r1 * .6 - w, y0 * .33, ca * r1 * .6],
                    [sa * r1, .02, ca * r1]], .055, .02, 10, 5));
            }
            this.streams = this.mesh(this.body, mergeGeometries(parts), this.wmat, false);
        }
        // foam ring at the foot, spray
        this.splash = [];
        for (let i = 0; i < 8; i++) this.splash.push({ sp: this.puff(this.body, c.foam, .75, billowTex('air')), a: i / 8 * TAU, r: .3 + Math.random() * .16,
            y: .03 + Math.random() * .05, s: .22 + Math.random() * .14, rot: Math.random() * TAU });
        this.spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.026, 0), mat(c.foam, { roughness: .3, emissive: 0x2a5068 }), c.spray);
        this.spray.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .8, 0), 2.2);
        noRay(this.spray);
        this.body.add(this.spray);
        this.drops = [];
        for (let i = 0; i < c.spray; i++) this.drops.push({ a: Math.random() * TAU, rate: .55 + Math.random() * .6, ph: Math.random(), rmax: .25 + Math.random() * .35, h: .25 + Math.random() * .35, lip: wave && i % 2 === 0 });
        this.mist = [];
        if (c.storm) for (let i = 0; i < 7; i++) this.mist.push({ sp: this.puff(this.body, c.storm, .4, billowTex('air')), a: i / 7 * TAU, r: .45 + Math.random() * .3, y: .1 + Math.random() * .35, s: .7 + Math.random() * .5, rot: Math.random() * TAU });
        if (wave) this.buildWave();
    }
    // the breaking wave the small spirit rises from: wide flat tube along a spine, foam towards the crest
    buildWave() {
        const c = this.c;
        const deep = new THREE.Color(c.deep), light = new THREE.Color(c.color), foam = new THREE.Color(c.foam);
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        this.wvMat = this.wmat.clone();
        this.wvMat.vertexColors = true;
        this.wvMat.color.set(0xffffff);
        this.wvMat.side = THREE.DoubleSide;
        // wave body (rises from behind into the spirit's waist) and the breaking crest behind her, foam on edges and crest
        const tube = (crest) => {
            const T = spineTube(crest ? 24 : 22, 18, 2.2), n = T.geo.attributes.position.count, col = new Float32Array(n * 3);
            for (let i = 0; i < T.N; i++) {
                const s = i / (T.N - 1);
                for (let k = 0; k <= T.S; k++) {
                    _col.copy(deep).lerp(light, smooth(s * 1.3));
                    const edge = smooth((Math.abs(T.CA[k]) - .7) / .3) * .9, top = crest ? smooth((s - .72) / .2) : 0;
                    _col.lerp(foam, Math.max(edge, top, rnd() < .16 ? .6 : 0, s < .1 ? .6 : 0));
                    const v = (i * (T.S + 1) + k) * 3;
                    col[v] = _col.r; col[v + 1] = _col.g; col[v + 2] = _col.b;
                }
            }
            T.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
            this.mesh(this.body, T.geo, this.wvMat, false);
            return T;
        };
        this.wv = tube(false);
        this.cr = tube(true);
    }
    waveSpine() {
        const q = this.q, T = this.wv, N = T.N, t = this.lt, dead = q.dead, live = this.live;
        const s1 = .25;
        const hm = Math.max(.12, (1 - q.low * .45) * (1 - dead * .9) * (1 + q.wind * .12));
        const flat = Math.max(q.low * .3, dead);
        const th0 = lerp(.62 + q.wind * .35 + q.tight * .3 - q.surge * .25 + .05 * Math.sin(t * 1.3), .2, flat);
        const th1 = lerp(1.2 + q.wind * .2 - q.surge * .3 + .1 * Math.sin(t * 1.1), .3, flat);
        integrateSpine(T, s1, .55 * (1 + dead * .5 + q.low * .3), 1.25 * hm, th0, th1, .03, t * 2);
        this.waterAt(.6);
        const zOff = this._cz - T.Z[N - 1];
        for (let i = 0; i < N; i++) {
            const s = i / (N - 1);
            T.Z[i] += zOff;
            T.Y[i] += .03;
            T.X[i] = Math.sin(t * 1.4 + s * 4) * .04 * s * live + q.scat * Math.sin(t * 19 + s * 5) * .05;
            const w = profAt(WAVE_W, s) * (1 + .06 * Math.sin(t * 2.3 + s * 7) * live) * (1 + dead * .6 + q.low * .2 + q.surge * .12 - q.tight * .12);
            T.RX[i] = w;
            T.RN[i] = profAt(WAVE_T, s) * (1 + .1 * Math.sin(t * 3.1 + s * 9) * live) * (1 - dead * .4);
        }
        updateSpineTube(T, .01);
        // breaking crest: rises from the wave's foot behind the spirit and curls forward over her back
        const C = this.cr, M = C.N;
        const ch = Math.max(.1, (1 - q.low * .45) * (1 - dead * .92) * (1 + q.wind * .15 + q.surge * .1));
        const c0 = lerp(1.45 + q.wind * .2 + q.tight * .1 + .04 * Math.sin(t * 1.2), .3, flat);
        const c1 = lerp(-1.05 + q.wind * .55 - q.surge * .9 - q.tight * .3 + .15 * Math.sin(t * .9), 0, flat);
        integrateSpine(C, .12, .22, 2.1 * ch, c0, c1, 0, 0, 2.6);
        const cz = T.Z[4] + .05 - C.Z[2];
        for (let i = 0; i < M; i++) {
            const s = i / (M - 1);
            C.Z[i] += cz;
            C.Y[i] += .03;
            C.X[i] = Math.sin(t * 1.2 + s * 3) * .05 * s * live;
            C.RX[i] = profAt(CREST_W, s) * (1 + .07 * Math.sin(t * 2.7 + s * 8) * live) * (1 + dead * .5 + q.surge * .15);
            C.RN[i] = profAt(CREST_T, s) * (1 + .1 * Math.sin(t * 3.3 + s * 7) * live) * (1 - dead * .4);
        }
        updateSpineTube(C, .01);
    }
    waterAt(y0) {
        const q = this.q, t = this.lt, H = this.H, f = y0 / H, ff = f * f;
        const hMul = (1 - q.low * .45) * (1 + q.wind * .12) * (1 - q.dead * .94);
        const base = this.wv ? -.14 + q.surge * .3 - q.wind * .08 : 0;
        this._y = y0 * hMul - q.surge * .2 * ff * f * H;
        this._cx = Math.sin(t * 1.3 + f * 2.5) * .06 * f + q.scat * Math.sin(t * 20 + f * 5) * .07 * f;
        this._cz = base + (this.wv ? .3 * ff : 0) + q.lean * H * .4 * ff + q.surge * .7 * ff * f - q.wind * .22 * ff + Math.cos(t * 1.1 + f * 2) * .04 * f
            + Math.pow(1 - f, 4) * (q.surge * .3 + q.move * .1);
        this._rm = (1 - q.tight * .15) * (1 + q.scat * .15) * (1 + Math.pow(1 - f, 3) * (q.move * .25 + q.surge * .4 + q.low * .3 + q.dead * .75));
    }
    animWater(dt) {
        const q = this.q, L = this.lath, t = this.lt, live = this.live, dead = q.dead, H = this.H;
        if (this.wv) this.waveSpine();
        for (let j = 0; j < L.np; j++) {
            this.waterAt(L.Y0[j]);
            L.cx[j] = this._cx; L.cz[j] = this._cz; L.y[j] = this._y; L.rm[j] = this._rm;
        }
        // flowing streams: ripples around the body grow towards the hem
        const pos = L.geo.attributes.position.array;
        for (let v = 0; v < L.n; v++) {
            const j = v % L.np, ang = L.ANG[v], y0 = L.Y0[j], f = y0 / H, a = .025 + .17 * (1 - f) * (1 - f) * this.robe;
            const r = L.R0[j] * L.rm[j] * (1 + a * Math.sin(ang * 6 + y0 * 4 - t * 2.4) + .035 * Math.sin(ang * 3 - y0 * 6 + t * 3.1));
            pos[v * 3] = L.cx[j] + L.SA[v] * r;
            pos[v * 3 + 1] = L.y[j];
            pos[v * 3 + 2] = L.cz[j] + L.CA[v] * r * this.depth;
        }
        L.geo.attributes.position.needsUpdate = true;
        recomputeNormals(L.geo, L.weld);
        this.flow.offset.y -= dt * this.churn * .3;
        this.flow.offset.x += dt * this.churn * .04;
        // head and arms ride on the deformed body
        this.waterAt(this.headY);
        const head = this.j.head;
        head.position.set(this._cx, this._y, this._cz);
        head.rotation.set(q.lean * .4 + q.surge * .3 - q.wind * .3 + (this.wv ? .2 : 0), Math.sin(t * .7) * .25 * live, 0);
        head.scale.setScalar(Math.max(.001, 1 - dead));
        this.hair.rotation.set(-q.move * .3 - q.surge * .4 + q.wind * .3 + Math.sin(t * 1.8) * .1 * live, Math.sin(t * 1.3) * .2 * live, Math.sin(t * 1.1) * .08 * live);
        this.waterAt(this.shY);
        const giant = !this.wv;
        for (const A of this.arms) {
            const s = A.side, sway = Math.sin(t * 1.6 + A.seed) * .12 * live;
            let pitch = giant ? -.15 : -.5, ab = giant ? .85 : .4, el = giant ? -.35 : -.5;
            pitch = lerp(pitch, -.55, Math.min(1, q.move)); ab = lerp(ab, .45, Math.min(1, q.move));
            pitch = lerp(pitch, -2.7, q.wind); ab = lerp(ab, .45, q.wind); el = lerp(el, -.7, q.wind);
            pitch = lerp(pitch, -1.45, q.surge); ab = lerp(ab, .12, q.surge); el = lerp(el, -.08, q.surge);
            pitch = lerp(pitch, -1.45, q.tight); ab = lerp(ab, -.4, q.tight); el = lerp(el, -1.5, q.tight);
            pitch = lerp(pitch, .4, q.scat); ab = lerp(ab, 1.1, q.scat); el = lerp(el, -.2, q.scat);
            pitch = lerp(pitch, -.6, q.low); ab = lerp(ab, .35, q.low); el = lerp(el, -.9, q.low);
            A.sh.position.set(this._cx + s * .22 * this._rm, this._y, this._cz);
            this.poseArm(A, pitch + sway * .5, ab + sway, el);
            A.hd.rotation.set(-.2 - q.surge * .5, 0, 0);
            A.sh.scale.setScalar(Math.max(.001, 1 - dead * .97));
        }
        // foam rings and spray at the foot
        this.waterAt(0);
        const base = this._rm, fb = Math.min(base, 1.35);
        for (const P of this.splash) {
            const a = P.a + this.spin * .7, wv = this.wv ? 1.3 : 1;
            P.sp.position.set(this._cx + Math.sin(a) * P.r * fb * wv, P.s * .36 + P.y * (1 - dead * .6), this._cz + Math.cos(a) * P.r * fb * wv * (this.wv ? 1.3 : 1) - (this.wv ? .3 : 0));
            P.sp.scale.setScalar(P.s * (1 + .15 * Math.sin(t * 4 + P.a) + q.surge * .4 + q.move * .2));
            P.rot += dt * this.churn;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .5 * (1 - .7 * dead);
        }
        if (this.streams) {
            this.waterAt(.6);
            const sy = this._y / .6;
            this.streams.position.set(this._cx * .6, 0, this._cz * .6);
            this.streams.scale.set(this._rm, sy, this._rm);
            this.streams.rotation.set(0, Math.sin(t * .9) * .1 * live, 0);
            this.waterAt(0);
        }
        const W = this.wv, lip = W ? 9 : 0;
        for (let i = 0; i < this.drops.length; i++) {
            const D = this.drops[i], u = (t * D.rate + D.ph) % 1, a = D.a + this.spin * .3, s = Math.max(.001, (1 - u * .6) * live);
            if (D.lip) {
                const sx = Math.sin(a);
                setInst(this.spray, i, W.X[lip] + Math.sign(sx) * (W.RX[lip] + u * .3), W.Y[lip] + u * .5 - u * u * .9, W.Z[lip] + u * (.1 + q.surge * .5) + sx * .2, 0, 0, 0, s);
            } else {
                const rr = (.4 + u * D.rmax) * (1 + q.scat * .7 + q.surge * .3) * base;
                setInst(this.spray, i, Math.sin(a) * rr, .04 + 4 * u * (1 - u) * D.h * (1 + q.surge * 1.2 + q.move * .4), Math.cos(a) * rr + q.surge * u * .9 + this._cz, 0, 0, 0, s);
            }
        }
        this.spray.instanceMatrix.needsUpdate = true;
        for (const P of this.mist) {
            const a = P.a + this.spin * .6;
            P.sp.position.set(Math.sin(a) * P.r, P.s * .36 + P.y * (1 - q.low * .4 - dead * .6), Math.cos(a) * P.r + q.lean * .4);
            P.sp.scale.setScalar(P.s * (1 + dead * .5));
            P.rot += dt * this.churn * .5;
            P.sp.material.rotation = P.rot;
            P.sp.material.opacity = .4 * (1 - .75 * dead);
        }
    }

    // ================= fire: striding humanoid of flame =================
    buildFire() {
        const c = this.c;
        this.anim.push('animFire');
        const add = THREE.AdditiveBlending;
        this.ftexV = flameTex(false).clone();
        this.ftexV.needsUpdate = true;
        this.ftexV.repeat.set(2, 1.2);
        this.ftexH = flameTex(true).clone();
        this.ftexH.needsUpdate = true;
        this.ftexH.repeat.set(1.2, 2);
        const shellV = this.shellV = new THREE.MeshBasicMaterial({ color: c.color, map: this.ftexV, transparent: true, opacity: .95, blending: add, depthWrite: false });
        const shellH = this.shellH = new THREE.MeshBasicMaterial({ color: c.color, map: this.ftexH, transparent: true, opacity: .95, blending: add, depthWrite: false });
        this.etex = flameTex(false, '#4a0c04').clone();
        this.etex.needsUpdate = true;
        this.etex.repeat.set(3, 2.5);
        const ember = this.emberM = new THREE.MeshBasicMaterial({ color: c.ember, map: this.etex });
        const fig = this.fig = new THREE.Group();
        this.body.add(fig);
        // hips (legs hang from here) → torso (leans) → head, shoulders
        const hips = this.hips = new THREE.Group();
        fig.add(hips);
        const torso = this.torso = new THREE.Group();
        hips.add(torso);
        const tprof = [[0, -.08], [.15, -.06], [.18, .05], [.16, .2], [.19, .34], [.25, .47], [.24, .55], [.13, .62], [.06, .66], [0, .68]];
        const tgeo = new THREE.LatheGeometry(tprof.map(([r, y]) => new THREE.Vector2(r, y)), 12);
        this.mesh(torso, tgeo.clone().scale(.8, .97, .72), ember, false);
        this.mesh(torso, tgeo.clone().scale(1, 1, .82), shellV, false);
        const head = this.j.head = new THREE.Group();
        head.position.set(0, .78, .03);
        torso.add(head);
        const hg = new THREE.SphereGeometry(.12, 10, 8).scale(.82, 1.1, .92);
        this.mesh(head, hg.clone().scale(.8, .8, .8), ember, false);
        this.mesh(head, hg, shellV, false);
        // limbs: ember core + flame shell
        const limb = (parent, L, r0, r1) => {
            const pts = [[0, 0, 0], [0, -L * .5, .012], [0, -L, 0]];
            this.mesh(parent, taperTube(pts, r0 * .66, r1 * .66, 6, 7), ember, false);
            this.mesh(parent, taperTube(pts, r0, r1, 6, 7), shellH, false);
        };
        const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
        this.legs = [1, -1].map(s => {
            const hip = joint(hips, s * .1, 0, 0);
            limb(hip, .44, .11, .075);
            const knee = joint(hip, 0, -.44, 0);
            limb(knee, .44, .075, .05);
            const foot = joint(knee, 0, -.44, 0);
            this.mesh(foot, new THREE.SphereGeometry(.06, 8, 5).scale(.8, .55, 1.6).translate(0, -.015, .05), ember, false);
            return { hip, knee, foot, side: s };
        });
        const claws = clawHand(.09, .03);
        this.arms = [1, -1].map(s => {
            const A = this.arm(torso, s, shellH, .34, .32, .085, .062, .045, claws, ember);
            A.sh.position.set(s * .22, .52, 0);
            this.mesh(A.sh, taperTube([[0, 0, 0], [0, -.17, .012], [0, -.34, 0]], .06, .045, 6, 7), ember, false);
            this.mesh(A.el, taperTube([[0, 0, 0], [0, -.16, .012], [0, -.32, 0]], .045, .032, 6, 7), ember, false);
            return A;
        });
        // flame tongues (soft additive sprites, always upright)
        this.tongues = [];
        const tongue = (parent, x, y, z, w, h, k = 1) => {
            const sp = this.puff(parent, 0xffffff, .9, tongueTex(), true);
            sp.center.set(.5, .1);
            sp.position.set(x, y, z);
            this.tongues.push({ sp, w: w * 1.3, h: h * 1.35, k, seed: Math.random() * 10 });
        };
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * TAU * 2.3, y = .0 + (i % 5) * .12, r = .25;
            tongue(torso, Math.sin(a) * r, y, Math.cos(a) * r * .8, .36, .62);
        }
        tongue(torso, 0, .15, -.06, .62, 1.0);
        tongue(torso, .12, .45, -.04, .4, .7);
        tongue(torso, -.12, .45, -.04, .4, .7);
        for (let i = 0; i < 7; i++) tongue(head, Math.sin(i / 7 * TAU) * .06, .02 + (i % 2) * .05, Math.cos(i / 7 * TAU) * .05 - .02, .3, .6, 1.4);
        for (const A of this.arms) {
            tongue(A.sh, 0, -.02, 0, .32, .5);
            tongue(A.sh, 0, -.2, 0, .26, .42);
            tongue(A.el, 0, 0, 0, .24, .4);
            tongue(A.el, 0, -.18, 0, .22, .38);
            tongue(A.hd, 0, -.06, .02, .26, .48, 1.3);
        }
        for (const Lg of this.legs) {
            tongue(Lg.hip, 0, -.05, 0, .34, .55);
            tongue(Lg.hip, 0, -.28, 0, .3, .5);
            tongue(Lg.knee, 0, 0, 0, .26, .45);
            tongue(Lg.knee, 0, -.25, 0, .24, .4);
            tongue(Lg.foot, 0, 0, .04, .26, .36);
        }
        // forward fire jet (attack) from the chest
        this.jet = new THREE.Group();
        this.jet.position.set(0, .42, .15);
        torso.add(this.jet);
        const fmat = (color, opacity) => new THREE.MeshBasicMaterial({ color, map: this.ftexV, transparent: true, opacity, blending: add, depthWrite: false, side: THREE.DoubleSide });
        this.mesh(this.jet, new THREE.ConeGeometry(.24, 1.0, 8).translate(0, .5, 0).rotateX(Math.PI / 2), fmat(c.color, .8), false);
        this.mesh(this.jet, new THREE.ConeGeometry(.11, .75, 6).translate(0, .375, 0).rotateX(Math.PI / 2), fmat(c.core, .85), false);
        // sparks, glow halo, scorched glow on the ground
        this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.016, 0),
            new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, blending: add, depthWrite: false }), 16);
        this.sparks.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2);
        noRay(this.sparks);
        this.body.add(this.sparks);
        this.sparkD = [];
        for (let i = 0; i < 16; i++) this.sparkD.push({ x: (Math.random() - .5) * .5, z: (Math.random() - .5) * .4, rate: .35 + Math.random() * .4, ph: Math.random() });
        this.halo = noRay(haloSprite(0xff6a1c, 2.2, .3));
        this.body.add(this.halo);
        this.scorch = this.mesh(this.body, new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff5a14, transparent: true, opacity: .5, blending: add, depthWrite: false }), false);
        this.scorch.position.y = .015;
        noRay(this.scorch);
    }
    // two-bone leg IK in the sagittal plane: foot at (fz forward, dy below the hip)
    legIK(Lg, fz, dy, L) {
        const D = Math.min(Math.hypot(fz, dy), 2 * L * .999), a = Math.atan2(fz, dy), k = Math.acos(D / (2 * L));
        Lg.hip.rotation.set(-(a + k), 0, Lg.side * .05);
        Lg.knee.rotation.set(2 * k, 0, 0);
        Lg.foot.rotation.set(a - k, 0, 0);
    }
    animFire(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead, d = smooth(dead);
        const mv = Math.min(1, q.move), run = Math.max(0, q.move - 1), ph = this.phase * 2.2;
        const flick = .85 + .15 * Math.sin(t * 17) * Math.sin(t * 7.3);
        // body
        const crouch = q.low * .56 + d * .55 + q.tight * .08 + q.wind * .05;
        const hip = .9 * (1 - crouch) - Math.abs(Math.sin(ph)) * .035 * mv + .015 * Math.sin(t * 2.1) * live;
        this.hips.position.set(Math.sin(t * 1.3) * .02 * live + q.scat * Math.sin(t * 25) * .03, hip, q.surge * .12 - q.wind * .05);
        const lean = .1 * mv + .1 * run + q.surge * .4 - q.wind * .25 + q.tight * .12 - q.scat * .3 + q.low * .3 + d * .7;
        this.torso.rotation.set(lean, Math.sin(ph) * .12 * mv + q.wind * .5 - q.surge * .55, Math.sin(t * 1.4) * .04 * live);
        this.fig.scale.set(1 + d * .25, 1 - d * .55, 1 + d * .25);
        // legs: stride, planted feet when standing / crouching
        const stride = mv * .24 + run * .12;
        for (const Lg of this.legs) {
            const o = Lg.side > 0 ? 0 : Math.PI, s = Math.sin(ph + o);
            let fz = s * stride + (Lg.side > 0 ? .12 : -.1) * (q.surge + q.tight * .6 + q.low * .5) + (Lg.side > 0 ? .05 : -.04) * (1 - mv);
            const lift = Math.max(0, Math.cos(ph + o)) * (.1 + run * .06) * mv;
            this.legIK(Lg, fz, hip - .03 - lift, .44);
        }
        // arms
        for (const A of this.arms) {
            const s = A.side, swing = Math.sin(ph + (s > 0 ? Math.PI : 0)) * .55 * mv, sway = Math.sin(t * 2.2 + A.seed) * .08 * live;
            let pitch = -.2 + swing + sway, ab = .3, el = -.45;
            if (s < 0) {   // striking arm
                pitch = lerp(pitch, .9, q.wind); ab = lerp(ab, .7, q.wind); el = lerp(el, -1.5, q.wind);
                pitch = lerp(pitch, -1.75, q.surge); ab = lerp(ab, .05, q.surge); el = lerp(el, -.1, q.surge);
            } else {
                pitch = lerp(pitch, -.9, q.wind); el = lerp(el, -1.3, q.wind);
                pitch = lerp(pitch, .4, q.surge); el = lerp(el, -.6, q.surge);
            }
            pitch = lerp(pitch, -1.35, q.tight); ab = lerp(ab, -.25, q.tight); el = lerp(el, -1.9, q.tight);
            pitch = lerp(pitch, .5, q.scat); ab = lerp(ab, 1, q.scat); el = lerp(el, -.2, q.scat);
            pitch = lerp(pitch, -.6, q.low); ab = lerp(ab, .25, q.low); el = lerp(el, -.8, q.low);
            pitch = lerp(pitch, -1.1, d); ab = lerp(ab, .8, d); el = lerp(el, -.3, d);
            this.poseArm(A, pitch, ab, el);
            A.hd.rotation.set(-.3 - q.surge * .6, 0, 0);
        }
        this.j.head.rotation.set(-lean * .4 + q.wind * .2, Math.sin(t * .8) * .25 * live, 0);
        // flames
        this.ftexV.offset.y -= dt * 1.3 * live * (1 + q.surge);
        this.ftexH.offset.x += dt * 1.2 * live * (1 + q.surge);
        this.etex.offset.y -= dt * .8 * live;
        this.shellV.opacity = this.shellH.opacity = .95 * (1 - .5 * d);
        this.emberM.color.setHex(this.c.ember).multiplyScalar(1 - .45 * d);
        const grow = (1 + .45 * q.surge + .3 * q.wind + .3 * q.scat) * (1 - .6 * d);
        for (const T of this.tongues) {
            const g = grow * (T.k > 1 ? 1 + q.surge * .4 : 1);
            T.sp.scale.set(T.w * g * (.9 + .15 * Math.sin(t * 8 + T.seed)), T.h * g * (.7 + .4 * Math.abs(Math.sin(t * 9 + T.seed)) + .15 * Math.sin(t * 14 + T.seed * 2)), 1);
            T.sp.material.rotation = Math.sin(t * 6 + T.seed) * .15;
            T.sp.material.opacity = .9 * (1 - .35 * d);
        }
        // jet
        const js = q.surge * (1 - dead);
        this.jet.visible = js > .02;
        this.jet.rotation.set(-lean * .6, q.surge * .5, 0);
        this.jet.scale.set(js * (1 + .2 * Math.sin(t * 21)), js * (1 + .2 * Math.sin(t * 17)), js * (1.2 + .25 * Math.sin(t * 13)));
        // sparks, halo, scorch
        for (let i = 0; i < this.sparkD.length; i++) {
            const D = this.sparkD[i], u = (t * D.rate + D.ph) % 1;
            const s = (1 - u) * live * (1 + q.scat + q.surge);
            setInst(this.sparks, i, D.x * (1 + u + q.scat * 2) + Math.sin(t * 3 + D.ph * 9) * .08, .3 + u * 2.1 * (1 - q.low * .4),
                D.z * (1 + u + q.scat * 2) + q.lean * u * 1.2 + q.surge * u, t * 3, t * 2, 0, Math.max(.001, s));
        }
        this.sparks.instanceMatrix.needsUpdate = true;
        this.halo.position.set(this.hips.position.x, hip + .35 * (1 - d), this.hips.position.z + lean * .2);
        this.halo.material.opacity = .3 * flick * (1 + .7 * q.surge) * (1 - .8 * d);
        this.halo.scale.setScalar(2.2 * (1 + .3 * q.surge - .2 * q.tight) * (1 - .45 * d));
        this.scorch.material.opacity = .5 * flick * (1 - .4 * d);
        this.scorch.scale.setScalar(1 + q.low * .2 + q.surge * .3 + d * .2);
    }

    // ================= cave slime: a glowing breaking wave =================
    buildSlime() {
        const c = this.c;
        this.anim.push('animSlime');
        const T = this.sl = spineTube(26, 16, 1.1);
        this.slTex = slimeTex().clone();
        this.slTex.needsUpdate = true;
        this.slTex.repeat.set(3, 2);
        this.smat = new THREE.MeshStandardMaterial({ color: c.color, map: this.slTex, emissive: c.glow, emissiveMap: this.slTex, emissiveIntensity: .9,
            roughness: .1, metalness: .1, transparent: true, opacity: .9 });
        this.mesh(this.body, T.geo, this.smat);
        // stinging pseudopods along the sides and at the front of the crest
        const tg = taperTube([[0, 0, 0], [0, .03, .1], [0, .035, .2], [0, .012, .3]], .032, .007, 8, 5);
        this.tent = [[8, 1], [8, -1], [11, 1], [11, -1], [13, 0]].map(([i, side], n) => {
            const g = new THREE.Group();
            this.mesh(g, tg, this.smat);
            this.body.add(g);
            return { g, i, side, timer: 1 + Math.random() * 3, lash: 0, seed: n * 1.7, front: side === 0 };
        });
        // blue glow on the cave floor
        this.pool = this.mesh(this.body, new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: glowTex(), color: c.color, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }), false);
        noRay(this.pool);
        this.j.head = new THREE.Group();
        this.body.add(this.j.head);
    }
    animSlime(dt) {
        const q = this.q, T = this.sl, N = T.N, t = this.lt, live = this.live, dead = q.dead;
        const s1 = .5, iJ = Math.round(s1 * (N - 1));
        const flat = Math.max(q.low * .62, smooth(dead));
        const hump = (1 + q.wind * .25 + q.tight * .12 + q.surge * .15) * (1 - .3 * flat);
        const th0 = lerp(1.75 + q.wind * .3 - q.move * .25 + .05 * Math.sin(t * 1.6), .1, flat);
        const th1 = lerp(-.35 + q.wind * .45 - q.surge * 1.25 - q.tight * .4 + .12 * Math.sin(t * 1.2), -.04, flat);
        const crawl = this.phase * 7;
        integrateSpine(T, s1, .7 * (1 + q.move * .12 + dead * .35 + q.low * .15), .7 * hump, th0, th1, .02 * q.move, crawl, 1.4);
        const zOff = .05 + q.surge * .25 - q.wind * .08 - T.Z[iJ];
        for (let i = 0; i < N; i++) {
            const s = i / (N - 1);
            T.Z[i] += zOff;
            T.Y[i] += .02;
            T.X[i] = Math.sin(s * 4 + t * 1.3) * .025 * live + Math.sin(s * 7 - crawl) * .04 * q.move + q.scat * Math.sin(t * 21 + s * 6) * .04;
            let r = profAt(SLIME_R, s);
            r *= 1 + .07 * Math.sin(s * 11 - t * 2.6) * live + .13 * q.move * Math.sin(s * 9 - crawl) + q.scat * .1;
            r *= 1 + q.low * .18 + dead * .45 - q.tight * .1;
            T.RX[i] = r;
            T.RN[i] = r * lerp(.62, .85, smooth((s - .4) / .2) * (1 - flat)) * (1 - dead * .35);
        }
        updateSpineTube(T);
        this.slTex.offset.y -= dt * .05 * (1 + q.move) * live;
        this.j.head.position.set(T.X[N - 3], T.Y[N - 3], T.Z[N - 3]);
        // pseudopods: idle lashes on own timers, attack shoots the front one forward
        for (const P of this.tent) {
            P.timer -= dt * live;
            if (P.timer <= 0) { P.lash = 1; P.timer = 2 + Math.random() * 4; }
            P.lash = Math.max(0, P.lash - dt * 1.3 * live);
            let e = .3 + .9 * Math.sin(P.lash * Math.PI) + q.move * .15, lift = .3 * Math.sin(P.lash * Math.PI);
            const yaw = P.front ? 0 : P.side * (1.45 - q.surge * .6);
            if (P.front || q.surge > 0) {
                const k = P.front ? 1 : .5;
                e += (q.surge * 2.2 + q.wind * .3) * k;
                lift += (q.wind * .7 - q.surge * .55) * k;
            }
            e = lerp(e, .12, q.tight);
            e = lerp(e, .22, q.low);
            e = lerp(e, .35, dead) + q.scat * .4 * Math.abs(Math.sin(t * 13 + P.seed));
            lift = lerp(lift, -.15, Math.max(q.low, dead)) + .2 * Math.sin(t * 3 + P.seed) * live;
            const i = P.i;
            if (P.front) P.g.position.set(T.X[i], .05 * (1 - dead) + .02, T.Z[i] + T.RN[i] * .8);
            else P.g.position.set(T.X[i] + P.side * T.RX[i] * .85, .04 * (1 - dead) + .01, T.Z[i]);
            P.g.rotation.set(-lift, yaw + Math.sin(t * 4 + P.seed) * .25 * live, 0);
            P.g.scale.set(.7 + .3 * e, .7 + .3 * e, e);
        }
        this.pool.position.set(0, .012, T.Z[iJ] - .1);
        this.pool.material.opacity = .35 * (1 + q.surge * .5 + q.wind * .3) * (1 - .45 * dead);
    }

    // ================= living jelly (gelatinous cube) =================
    buildJelly() {
        const c = this.c;
        this.anim.push('animJelly');
        this.E = 1.5;
        const geo = this.jgeo = new THREE.SphereGeometry(1, 22, 16);
        const P = geo.attributes.position.array, n = P.length / 3;
        // superquadric mapping: unit sphere → rounded, slightly lumpy cube (-.5 … .5) that narrows a little upwards
        const sq = x => Math.sign(x) * Math.pow(Math.abs(x), .5) * .5;
        this.jbase = new Float32Array(P.length);
        const col = new Float32Array(P.length), top = new THREE.Color(c.top), bot = new THREE.Color(c.bottom);
        const yel = new THREE.Color(0xd8d030), dark = new THREE.Color(0x1a3a0a);
        for (let i = 0; i < n; i++) {
            let x = sq(P[i * 3]), y = sq(P[i * 3 + 1]), z = sq(P[i * 3 + 2]);
            const lump = 1 + .045 * Math.sin(x * 9 + 1) * Math.sin(y * 7 + 2) * Math.sin(z * 8 + 3) + .025 * Math.sin(x * 17 + z * 13 + y * 5);
            const u = y + .5;
            x *= lump * (1 - .22 * u * u); z *= lump * (1 - .22 * u * u); y = (y + .5) * (y > -.45 ? lump : 1) - .5;
            this.jbase[i * 3] = x; this.jbase[i * 3 + 1] = y; this.jbase[i * 3 + 2] = z;
            _col.copy(bot).lerp(top, smooth((y + .5) * 1.8 - .35));
            const patch = Math.sin(x * 11 + z * 7) * Math.sin(y * 9 + x * 5);
            if (patch > .25) _col.lerp(yel, (patch - .25) * .9);
            const spot = Math.sin(x * 23) * Math.sin(z * 19 + 1) * Math.sin(y * 21 + 2);
            if (spot > .55) _col.lerp(dark, (spot - .55) * 1.6);
            col[i * 3] = _col.r; col[i * 3 + 1] = _col.g; col[i * 3 + 2] = _col.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.jweld = weldGroups(geo);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .7, 0), 1.6);
        geo.boundingBox = new THREE.Box3(new THREE.Vector3(-.78, 0, -.78), new THREE.Vector3(.78, 1.3, .78));
        const tex = cellTex().clone();
        tex.needsUpdate = true;
        tex.repeat.set(3, 2);
        this.jmat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, transparent: true, opacity: .72, roughness: .05, metalness: .08,
            emissive: 0x3a4a06, emissiveIntensity: .45, depthWrite: false });
        const m = this.mesh(this.body, geo, this.jmat, false);
        m.renderOrder = 2;
        // things floating inside
        const bone = mat(0xd8cfae, { roughness: .7 }), gold = mat(0xd8a830, { roughness: .3, metalness: .8 }), steel = mat(0x8a8e94, { roughness: .35, metalness: .7 });
        const darkM = mat(0x201810, { roughness: 1 }), bub = mat(0xeaffd0, { roughness: .1, emissive: 0x3a5a20 });
        this.items = [];
        const item = (g, x, y, z, rx = 0, ry = 0) => { g.rotation.set(rx, ry, 0); this.body.add(g); this.items.push({ g, x, y, z, rx, ry, ph: Math.random() * TAU, sp: (Math.random() - .5) * .6 }); return g; };
        const skull = new THREE.Group();
        this.mesh(skull, new THREE.SphereGeometry(.09, 10, 8), bone).scale.set(.9, .95, 1.05);
        this.mesh(skull, new THREE.BoxGeometry(.08, .04, .07), bone).position.set(0, -.07, .03);
        for (const s of [1, -1]) this.mesh(skull, new THREE.SphereGeometry(.022, 6, 4), darkM).position.set(s * .033, .0, .078);
        item(skull, -.12, .5, .05, .3, .6);
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
        item(sword, .18, .42, .1, .4, 1.2).rotation.z = 1.1;
        for (let i = 0; i < 9; i++) {
            const g = new THREE.Group();
            this.mesh(g, new THREE.SphereGeometry(.015 + Math.random() * .035, 6, 4), bub, false);
            item(g, (Math.random() - .5) * .75, .15 + Math.random() * .6, (Math.random() - .5) * .75);
        }
        this.j.head = this.items[0].g;
    }
    animJelly(dt) {
        const q = this.q, t = this.lt, live = this.live, dead = q.dead, E = this.E, EY = E * .8;
        const pos = this.jgeo.attributes.position.array, B = this.jbase;
        const hMul = (1 - q.low * .4) * (1 - dead * .82) * (1 + q.tight * .06 + q.wind * .07);
        const wide = (1 + q.low * .12 + dead * .42 + q.scat * .08) * (1 - q.tight * .1);
        const jig = .025 * live + q.scat * .07;
        const shear = q.lean * .3 - q.wind * .12;
        for (let v = 0; v < B.length; v += 3) {
            const bx = B[v], by = B[v + 1], bz = B[v + 2], u = by + .5;
            let X = bx * E * wide, Y = u * EY * hMul, Z = bz * E * wide;
            X += (Math.sin(t * 2.1 + u * 2) * jig + Math.sin(t * 23) * q.scat * .04) * u * E;
            Z += (shear + Math.sin(t * 1.7 + u * 2.5) * jig * .7) * u * E;
            Y *= 1 + q.move * .03 * Math.sin(bz * 5 - this.phase * 5) + .015 * Math.sin(t * 2.6 + bx * 4) * live;
            if (bz > 0) Z += q.surge * .55 * E * bz * 2 * Math.sin(Math.min(1, u) * Math.PI * .85 + .25);
            pos[v] = X; pos[v + 1] = Math.max(.003, Y); pos[v + 2] = Z;
        }
        this.jgeo.attributes.position.needsUpdate = true;
        recomputeNormals(this.jgeo, this.jweld);
        this.jmat.opacity = .72 * (1 + q.tight * .2) * (1 - .25 * dead);
        // floating things follow the jelly's shape
        for (const I of this.items) {
            const u = I.y / E;
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
        this.anim.push('animOrb');
        const add = THREE.AdditiveBlending;
        this.orb = new THREE.Group();
        this.body.add(this.orb);
        this.j.head = this.orb;
        this.stex = swirlTex().clone();
        this.stex.needsUpdate = true;
        this.coreM = new THREE.MeshBasicMaterial({ color: c.color, map: this.stex, transparent: true, opacity: .95, blending: add, depthWrite: false });
        this.coreMesh = this.mesh(this.orb, new THREE.IcosahedronGeometry(.13, 2), this.coreM, false);
        this.innerMesh = this.mesh(this.orb, new THREE.IcosahedronGeometry(.095, 2), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, map: this.stex, transparent: true,
            opacity: .8, blending: add, depthWrite: false }), false);
        this.mesh(this.orb, new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2faff }), false);
        this.halos = [noRay(haloSprite(c.color, .9, .75)), noRay(haloSprite(c.color, 2.2, .22))];
        for (const h of this.halos) this.orb.add(h);
        // lightning: NB bolts of NS segments, regenerated every few frames
        this.NB = 8; this.NS = 7;
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
        this.motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.009, 0),
            new THREE.MeshBasicMaterial({ color: 0x8fcfff, transparent: true, blending: add, depthWrite: false }), 12);
        this.motes.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
        noRay(this.motes);
        this.orb.add(this.motes);
        this.moteD = [];
        for (let i = 0; i < 12; i++) this.moteD.push({ r: .18 + Math.random() * .2, w: (1.5 + Math.random() * 2) * (i % 2 ? 1 : -1), a: Math.random() * TAU, tilt: (Math.random() - .5) * 2.4 });
        this.body.add(pickProxy(.16, .32, 1.14));
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
                len = (.3 + Math.random() * .7) * (1 + q.scat * .6 + q.wind * .4) * (1 - q.tight * .55) * (1 - q.low * .5);
            }
            let px = dx * .12, py = dy * .12, pz = dz * .12;
            const j = len / NS * .8;
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
        this.innerMesh.rotation.y -= dt * this.churn * 1.7;
        this.innerMesh.rotation.z += dt * this.churn * .6;
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
            this.boltM.opacity = (.4 + Math.random() * .6) * (1 + q.surge);
        }
        this.bolts.visible = live > .4;
        for (let i = 0; i < this.moteD.length; i++) {
            const M = this.moteD[i], a = M.a + this.spin * M.w, r = M.r * (1 + q.scat * 1.5 - q.tight * .3);
            setInst(this.motes, i, Math.cos(a) * r, Math.sin(a) * r * Math.sin(M.tilt), Math.sin(a) * r * Math.cos(M.tilt), a, a, 0, Math.max(.001, live));
        }
        this.motes.instanceMatrix.needsUpdate = true;
    }

    // ================= smoke figures (cloud form, vampires; upper body of the air elemental) =================
    buildCloud() {
        const c = this.c, air = this.kind === 'air', bulk = c.bulk || 1, tex = billowTex(c.puff);
        this.anim.push('animCloud');
        this.puffs = [];
        const P = (x, y, z, s, kind, idx = 0, o = .95) => {
            const sp = this.puff(this.body, new THREE.Color(1, 1, 1).multiplyScalar(.82 + Math.random() * .18), o, tex);
            const D = { sp, x, y, z, s: s * bulk * 1.3, kind, idx, o, ph: Math.random() * TAU, w: (Math.random() - .5) * 1.2, rot: Math.random() * TAU };
            this.puffs.push(D);
            return D;
        };
        let hand;
        if (air) {
            // upright misty torso on top of the funnel
            for (const [x, y, z, s] of [[0, 1.08, 0, .42], [.1, 1.2, -.03, .44], [-.1, 1.24, .02, .44], [0, 1.36, .02, .5], [.08, 1.5, -.05, .52],
                [-.08, 1.5, -.02, .5], [.25, 1.58, 0, .4], [-.25, 1.58, 0, .4], [0, 1.66, -.04, .36]]) P(x, y, z, s, 0);
            this.headPuff = P(0, 1.86, .06, .34, 1);
            hand = [[.38, 1.52, .04, .34], [.52, 1.38, .1, .32], [.64, 1.22, .16, .3], [.7, 1.04, .22, .26]];
            for (let i = 0; i < 4; i++) P(Math.sin(i * 1.7) * .3, 1.15 + i * .2, Math.cos(i * 1.7) * .22, 1.1, 3, i, .28);
        } else {
            // hunched smoke figure streaming back into a tail
            for (let k = 0; k < 13; k++) {
                const u = k / 12;
                P(Math.sin(k * 2.1) * .08 * (1 - u), .14 + 1.12 * Math.pow(u, .85), -.8 * Math.pow(1 - u, 1.5) + .02, .28 + .38 * u, 0);
            }
            for (const [x, y, z, s] of [[.26, 1.4, .06, .52], [-.26, 1.4, .06, .52], [0, 1.48, -.1, .6], [.12, 1.12, -.02, .46], [-.12, 1.0, -.08, .46]]) P(x, y, z, s, 0);
            this.headPuff = P(0, 1.58, .24, .46, 1);
            P(0, 1.68, .06, .5, 0);
            hand = [[.34, 1.34, .12, .44], [.46, 1.18, .26, .38], [.53, 1.02, .4, .32], [.56, .9, .5, .26]];
            for (let i = 0; i < 5; i++) P(Math.sin(i * 1.3) * .3, .35 + i * .26, Math.cos(i * 1.3) * .22 - (5 - i) * .08, 1.15, 3, i, .3);
        }
        this.handPuff = {};
        for (const side of [1, -1]) hand.forEach(([x, y, z, s], i) => { const D = P(side * x, y, z, s, 2, i); if (i === hand.length - 1) this.handPuff[side] = D; });
        // eyes (glowing, or dark hollows on the air giant), glints
        this.eyes = [];
        if (c.eye || c.sockets) this.eyes = [1, -1].map(s => {
            const e = c.eye ? this.puff(this.body, c.eye, 1, glowTex(), true) : this.puff(this.body, c.sockets, .9, glowTex());
            e.userData.side = s;
            return e;
        });
        this.eyeS = c.eye ? .11 : .1;
        this.glints = [];
        for (let i = 0; i < (c.glints || 0); i++) this.glints.push({ sp: this.puff(this.body, c.glint, 0, glowTex(), true), host: this.puffs[(i * 7) % 18], ox: (Math.random() - .5) * .3, oy: (Math.random() - .5) * .3, s: .1 + Math.random() * .14, ph: Math.random() * TAU, w: 2 + Math.random() * 4 });
        // clawed hands at the ends of the arms
        this.hands = [];
        if (c.hands) {
            const claw = new THREE.ConeGeometry(.016, .2, 4).translate(0, .1, 0).rotateX(Math.PI);
            const palm = new THREE.SphereGeometry(.045, 7, 5).scale(1, .8, .6);
            const cm = mat(c.hands, { roughness: .45 });
            this.hands = [1, -1].map(side => {
                const g = new THREE.Group();
                this.mesh(g, palm, cm);
                for (let i = 0; i < 4; i++) {
                    const m = this.mesh(g, claw, cm);
                    m.position.set((i - 1.5) * .025, -.02, .01);
                    m.rotation.set(.35, 0, (i - 1.5) * .22);
                }
                g.userData.side = side;
                this.body.add(g);
                return g;
            });
        }
        if (!air) this.body.add(pickProxy(.4, 1.6, .1));
        else this.body.add(pickProxy(.32, 1.95, 0));
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
            y += Math.sin(t * 1.5 + side + a * .5) * .04 * a * live;
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
        out.x = x * (1 + d * 1.2) + this.figX * (1 - d); out.y = lerp(y, .12 + D.s * .32 + f * .1, d); out.z = z * (1 + d * .8) + this.figZ * (1 - d);
        return out;
    }
    animCloud(dt) {
        const q = this.q, t = this.lt, d = smooth(q.dead), o = this._v || (this._v = { x: 0, y: 0, z: 0 });
        const live = this.live;
        for (const D of this.puffs) {
            this.cloudPos(D, o);
            const s = D.s * (1 + q.surge * .25 - q.tight * .1 + d * .55 + q.low * .15) * (1 + .06 * Math.sin(t * 1.7 + D.ph));
            D.sp.position.set(o.x, Math.max(o.y, s * .36), o.z);
            D.sp.scale.set(s, s, 1);
            D.rot += dt * D.w * live;
            D.sp.material.rotation = D.rot;
            D.sp.material.opacity = Math.min(1, D.o * (1 + q.tight * .15) * (1 - .72 * d) * (1 - .25 * q.scat));
        }
        const head = this.headPuff.sp.position, hs = this.headPuff.s;
        this.j.head.position.copy(head);
        for (const e of this.eyes) {
            e.position.set(head.x + e.userData.side * .075 * hs / .44, head.y + .02, head.z + .22 * hs / .44);
            e.scale.setScalar(this.eyeS * hs / .44 * (1 + q.surge * .4 + q.wind * .3));
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
            h.position.set(tip.x + h.userData.side * .03, tip.y - .1, tip.z + .06);
            h.rotation.set(-.3 - q.surge * 1.2 - q.wind * .3 + q.tight * .3, 0, h.userData.side * (.2 + q.wind * .4));
            h.scale.setScalar(Math.max(.001, (1 - d) * (this.c.bulk || 1)));
        }
    }

    // ================= vermin: swarm of tiny rats =================
    buildSwarm() {
        const c = this.c, N = c.count;
        this.anim.push('animSwarm');
        this.ratBodies = new THREE.InstancedMesh(ratGeo(c.coat, c.skin), mat(0xffffff, { vertexColors: true, roughness: .85 }), N);
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

// cross-section profiles along the spine (s = 0 tail … 1 tip)
const SLIME_R = [[0, 0], [.05, .035], [.15, .07], [.3, .13], [.45, .2], [.55, .23], [.65, .21], [.78, .17], [.9, .13], [.96, .11], [1, 0]];
const WAVE_W = [[0, 0], [.06, .42], [.25, .62], [.5, .52], [.75, .36], [.9, .24], [.97, .16], [1, 0]];
const CREST_W = [[0, 0], [.06, .34], [.3, .5], [.6, .46], [.82, .36], [.94, .24], [1, 0]];
const CREST_T = [[0, 0], [.06, .1], [.3, .13], [.6, .11], [.82, .08], [.94, .06], [1, 0]];
const WAVE_T = [[0, 0], [.06, .12], [.25, .22], [.5, .2], [.75, .17], [.9, .15], [.97, .1], [1, 0]];
