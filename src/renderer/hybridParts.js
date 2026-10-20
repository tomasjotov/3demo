import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';

/*
 * hybridParts — the upper body of hybrid creatures (centaur on the horse rig, urxuquer on the spider rig, serpent guardian
 * and goblin snake on the serpent rig) plus small shared helpers (seeded random, painted canvas textures, snout heads).
 *
 *   humanTorso(parent, opts) → { T, neck, head, jaw, arms: [{ sh, el, hand, s }], spear }
 *   T is the waist pivot (torso up = +y, face = +z); right hand is -x like the avatar.
 *   The torso is one lathe-like mesh (hips → waist → chest → shoulders) with painted muscles (pecs, abs, obliques,
 *   ribs for gaunt bodies, belly scutes for reptiles) used as colour shading and bump; arms are tapered lathes
 *   (deltoid, biceps, forearm bulge), hands with fingers and thumb. Heads: 'human' (shaped skull with nose, brows,
 *   eye sockets, hair), 'demon' (gaunt pointed face, glowing eyes, spiky crown), 'lizard' (snout head with a crest),
 *   'goblin' (wide snout head, big ears, teeth).
 *   poseTorsoArms(H, mode, k, t) — arms for 'idle' | 'walk' | 'attack' (k = strike 0..1) | 'defend' | 'hit' | 'dead'.
 *   skullGeo(o) / jawGeo(o) — vertex coloured snout head halves (snakes, dragons, lizards) shared with the serpent rig.
 */

const TAU = Math.PI * 2;
const cache = new Map();
const cached = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const gauss = (x, w) => Math.exp(-(x / w) * (x / w));

export function seeded(seed = 1) {
    let s = (seed >>> 0) || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/*
 * Painted texture pair: drawColor paints the colours, drawHeight a grey height field (128 = flat); the colour map is
 * shaded by the height (grooves dark, bulges light) so the relief reads even without light, and the height is the bump.
 * Returns { map, bump } (nulls without a DOM). Cached by key.
 */
export function shadedTex(key, w, h, drawColor, drawHeight, lo = .62, hi = 1.22) {
    return cached('shTex' + key, () => {
        if (typeof document === 'undefined') return { map: null, bump: null };
        const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
        const cc = mk(), hc = mk();
        const cg = cc.getContext('2d'), hg = hc.getContext('2d');
        drawColor(cg, w, h);
        hg.fillStyle = '#808080';
        hg.fillRect(0, 0, w, h);
        if (drawHeight) drawHeight(hg, w, h);
        const ci = cg.getImageData(0, 0, w, h), hi2 = hg.getImageData(0, 0, w, h).data, d = ci.data;
        for (let i = 0; i < d.length; i += 4) {
            const k = lo + (hi - lo) * (hi2[i] / 255);
            d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
        }
        cg.putImageData(ci, 0, 0);
        const map = new THREE.CanvasTexture(cc), bump = new THREE.CanvasTexture(hc);
        for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
        map.colorSpace = THREE.SRGBColorSpace;
        return { map, bump };
    });
}
export const css = (hex, k = 1) => {                                                     // sRGB hex → canvas colour
    const ch = sh => Math.min(255, ((hex >> sh) & 255) * k) | 0;
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const lerpColor = (a, b, k, out) => out.copy(a).lerp(b, Math.max(0, Math.min(1, k)));

/*
 * Snout head, upper half: a sphere stretched along +z (back of the skull at z ≈ -0.12 len, nose at len) that narrows
 * from wB to wF and flattens from hB to hF; the underside is a shallow palate (under). Vertex colours: top → low on
 * the flanks → mouth on the palate. brow lifts a ridge over the eyes, cheek bulges the jaw muscles.
 */
export function skullGeo(o) {
    return cached('skull' + JSON.stringify(o), () => {
        const { len = 1, wB = .5, wF = .22, hB = .32, hF = .14, under = .08, top = 0x808080, low = 0xc0c0c0, mouth = 0x5a1a1e,
            brow = 0, cheek = .1, snoutUp = 0, ws = 20, hs = 14 } = o;
        const g = new THREE.SphereGeometry(1, ws, hs).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);   // poles on z, uv seam on the underside
        const p = g.attributes.position, col = [], ct = new THREE.Color(top), cl = new THREE.Color(low), cm = new THREE.Color(mouth), c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (z + 1) / 2;
            const w = (wB + (wF - wB) * Math.pow(t, 1.35)) * (1 + cheek * gauss(t - .22, .18));
            const hgt = y >= 0 ? hB + (hF - hB) * Math.pow(t, .9) + brow * gauss(t - .55, .12) * (.4 + .6 * Math.abs(x)) : under * (1 - .35 * t);
            p.setXYZ(i, x * w, y * hgt + snoutUp * t * t, t * len - len * .12);
            if (y > .3) c.copy(ct); else if (y > -.15) lerpColor(cl, ct, (y + .15) / .45, c); else if (y > -.45) c.copy(cl); else c.copy(cm);
            col.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        return g;
    });
}
// lower jaw: flat top (mouth colour), rounded underside (low colour); hinge at z = 0
export function jawGeo(o) {
    return cached('jaw' + JSON.stringify(o), () => {
        const { len = 1, wB = .45, wF = .2, depth = .14, low = 0xc0c0c0, mouth = 0x5a1a1e, top = null } = o;
        const g = new THREE.SphereGeometry(1, 16, 10).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
        const p = g.attributes.position, col = [], cl = new THREE.Color(low), cm = new THREE.Color(mouth), ct = new THREE.Color(top ?? low), c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (z + 1) / 2;
            const w = wB + (wF - wB) * Math.pow(t, 1.2);
            const hgt = y >= 0 ? depth * .25 : depth * (1 - .45 * t);
            p.setXYZ(i, x * w, y * hgt, t * len - len * .06);
            if (y > .45) c.copy(cm); else if (y > -.2) lerpColor(ct, cm, (y + .2) / .65, c); else lerpColor(cl, ct, (y + .6) / .4, c);
            col.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        return g;
    });
}
// point on the skull surface: t along (0 back .. 1 nose), yf height fraction of the top half (0 = lip line, 1 = crown)
export function skullAt(o, t, yf, out) {
    const { len = 1, wB = .5, wF = .22, hB = .32, hF = .14, brow = 0, cheek = .1 } = o;
    t = Math.max(0, Math.min(1, t));
    const w = (wB + (wF - wB) * Math.pow(t, 1.35)) * (1 + cheek * gauss(t - .22, .18));
    const h = hB + (hF - hB) * Math.pow(t, .9) + brow * gauss(t - .55, .12) * .5;
    return out.set(w * Math.sqrt(Math.max(0, 1 - yf * yf)), h * yf, t * len - len * .12);
}
export const vcMat = (opts = {}) => mat(0xffffff, { vertexColors: true, roughness: .6, ...opts });

// ---------------------------------------------------------------- torso geometry and paint
const PROF = [[-.04, .15, .106, 0], [.06, .133, .093, 0], [.16, .146, .099, .004], [.26, .168, .107, .008], [.34, .188, .113, .01],
    [.42, .203, .109, .008], [.48, .2, .097, 0], [.53, .15, .08, -.006], [.565, .062, .056, 0]];
const TY0 = PROF[0][0], TY1 = PROF[PROF.length - 1][0];
function profAt(y) {
    for (let i = 0; i < PROF.length - 1; i++) {
        const a = PROF[i], b = PROF[i + 1];
        if (y <= b[0]) { const k = (y - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k); return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s]; }
    }
    const l = PROF[PROF.length - 1];
    return [l[1], l[2], l[3]];
}
function torsoGeo(gaunt) {
    return cached('torso' + gaunt, () => {
        const NY = 26, NA = 28, pos = [], uv = [], idx = [];
        for (let i = 0; i <= NY; i++) {
            const v = i / NY, y = TY0 + (TY1 - TY0) * v;
            let [w, d, zo] = profAt(y);
            if (gaunt) { w *= y < .3 ? .8 : .9; d *= y < .3 ? .82 : .92; }
            for (let j = 0; j <= NA; j++) {
                const u = j / NA, a = u * TAU - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
                const x = w * ca;
                let z = d * sa + zo;
                if (sa > 0) {                                                           // pecs, abs block
                    for (const s of [1, -1]) z += (gaunt ? .008 : .022) * sa * gauss(y - .375, .055) * gauss(x - s * .08, .065);
                    if (!gaunt) z += .006 * sa * gauss(y - .2, .09) * gauss(x, .06);
                    else z -= .012 * sa * gauss(y - .16, .07) * gauss(x, .08);              // sunken belly
                } else {                                                                // shoulder blades, spine groove
                    for (const s of [1, -1]) z -= .011 * -sa * gauss(y - .4, .07) * gauss(x - s * .085, .06);
                    z += .007 * gauss(x, .022) * gauss(y - .3, .2);
                }
                pos.push(x, y, z);
                uv.push(u, v);
            }
        }
        for (let i = 0; i < NY; i++) for (let j = 0; j < NA; j++) {
            const a = i * (NA + 1) + j, b = a + NA + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    });
}
// texture pixel of a torso point: x lateral offset on the front (m), y height
const TW = 256, TH = 256;
const tX = x => TW * (.5 - Math.asin(Math.max(-1, Math.min(1, x / .175))) / TAU);
const tY = y => TH * (1 - (y - TY0) / (TY1 - TY0));
function blob(g, x, y, rx, ry, k) {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(255,255,255,${k})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(x, y); g.scale(rx, ry); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
}
function line(g, pts, wdt, a) {
    g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = wdt; g.lineCap = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
}
function torsoHeight(gaunt, reptile) {
    return (g) => {
        if (!gaunt) {
            for (const s of [1, -1]) {
                blob(g, tX(s * .08), tY(.38), 30, 20, .55);                                  // pecs
                line(g, [[tX(s * .02), tY(.335)], [tX(s * .08), tY(.32)], [tX(s * .14), tY(.35)], [tX(s * .16), tY(.4)]], 4, .55);
                for (let r = 0; r < 3; r++) {                                            // six-pack
                    blob(g, tX(s * .03), tY(.27 - r * .065), 11, 11, .5);
                    line(g, [[tX(s * .005), tY(.24 - r * .065)], [tX(s * .055), tY(.237 - r * .065)]], 2.5, .45);
                }
                line(g, [[tX(s * .075), tY(.31)], [tX(s * .068), tY(.14)], [tX(s * .03), tY(.03)]], 3, .45);   // obliques edge
                for (let k = 0; k < 3; k++) line(g, [[tX(s * .1), tY(.3 - k * .03)], [tX(s * .125), tY(.315 - k * .03)]], 2.5, .35);   // serratus
                line(g, [[tX(s * .015), tY(.53)], [tX(s * .12), tY(.5)]], 2, .35);       // clavicles
                const bx = TW * Math.asin(.085 / .175) / TAU;                               // shoulder blades (seam = spine)
                blob(g, s > 0 ? bx : TW - bx, tY(.4), 22, 26, .35);
            }
            line(g, [[tX(0), tY(.33)], [tX(0), tY(.08)]], 3, .5);                        // linea alba
        } else {
            for (const s of [1, -1]) for (let r = 0; r < 6; r++) {                       // ribs
                const y = .43 - r * .045;
                line(g, [[tX(s * .02), tY(y)], [tX(s * .07), tY(y - .012)], [tX(s * .13), tY(y - .03)], [tX(s * .17), tY(y - .05)]], 3.5, .6);
                blob(g, tX(s * .08), tY(y - .02), 14, 4, .35);
            }
            line(g, [[tX(0), tY(.46)], [tX(0), tY(.25)]], 4, .5);                        // sternum groove
            line(g, [[tX(-.06), tY(.16)], [tX(.06), tY(.16)]], 9, .25);                 // sunken belly
        }
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.beginPath(); g.ellipse(tX(0), tY(.07), 3, 4, 0, 0, TAU); g.fill();             // navel
        line(g, [[0, tY(.5)], [0, tY(.05)]], 5, .4);                                     // spine (seam at the back)
        line(g, [[TW, tY(.5)], [TW, tY(.05)]], 5, .4);
        if (reptile) for (let y = 6; y < TH; y += 11) for (let x = (y / 11) % 2 ? 5.5 : 0; x < TW + 6; x += 11) {   // scales
            const gr = g.createLinearGradient(0, y - 5, 0, y + 6);
            gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, 5.6, 0, Math.PI); g.fill();
        }
    };
}
function torsoColor(skin, reptile) {
    return (g) => {
        g.fillStyle = css(skin);
        g.fillRect(0, 0, TW, TH);
        const r = seeded(7);
        for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},.04)`; g.fillRect(r() * TW, r() * TH, 2, 2); }
        if (reptile) {                                                                    // pale belly scutes down the front
            g.fillStyle = css(reptile);
            g.fillRect(tX(-.055), tY(.5), tX(.055) - tX(-.055), tY(-.04) - tY(.5));
            g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
            for (let y = .48; y > -.04; y -= .035) { g.beginPath(); g.moveTo(tX(-.055), tY(y)); g.quadraticCurveTo(tX(0), tY(y - .012), tX(.055), tY(y)); g.stroke(); }
        }
    };
}
const scaleTex = (color, rep) => {
    const t = shadedTex('scl' + color, 64, 64, (g, w, h) => { g.fillStyle = css(color); g.fillRect(0, 0, w, h); }, (g) => {
        for (let y = 0; y < 72; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 72; x += 8) {
            const gr = g.createLinearGradient(0, y - 4, 0, y + 5);
            gr.addColorStop(0, '#d0d0d0'); gr.addColorStop(1, '#404040');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, 4.3, 0, Math.PI); g.fill();
        }
    }, .7, 1.2);
    return t;
};

// lathe limb hanging down from the origin; prof = [[t 0..1 from the top, radius], ...]
function limbGeo(prof, L, seg = 10) {
    return cached('limb' + JSON.stringify(prof) + L + seg, () => {
        const pts = [new THREE.Vector2(0, -L - prof[prof.length - 1][1] * .3)];
        for (let k = prof.length - 1; k >= 0; k--) pts.push(new THREE.Vector2(prof[k][1], -prof[k][0] * L));
        pts.push(new THREE.Vector2(0, prof[0][1] * .3));
        return new THREE.LatheGeometry(pts, seg);
    });
}

// human-ish head shape: skull, narrower jaw and chin, nose, brow ridge, eye sockets, cheekbones
function deformHead(x, y, z, demon, out) {
    const front = Math.max(0, z);
    let X = x, Y = y * (y > 0 ? 1.04 : 1), Z = z;
    if (y < -.1) { const k = (-y - .1) / .9; X *= 1 - (demon ? .5 : .36) * k * k; Z = z * (1 - .12 * k) + .1 * k * front; }
    if (z < 0) Z *= 1.1;
    if (z > .55) Z = .55 + (z - .55) * .62;
    X *= 1 + .06 * gauss(y + .02, .16) * (demon ? 1.6 : 1);
    if (demon) X *= 1 - .1 * gauss(y + .3, .14) * front;
    Z += (demon ? .3 : .26) * gauss(x, .11) * gauss(y + .06, .15) * front * front;    // nose
    Z += .05 * gauss(y - .2, .07) * front;                                        // brow ridge
    Z -= .035 * gauss(Math.abs(x) - .36, .14) * gauss(y - .07, .1) * front;        // eye sockets
    Z += .03 * gauss(y + .45, .12) * gauss(x, .3) * front;                         // lips / chin
    return out.set(X * .085, Y * .11, Z * .098);
}
// face point: unit sphere direction (x, y) on the front → position on the deformed head surface
const facePt = (x, y, demon) => deformHead(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)), demon, new THREE.Vector3());
function headGeo(kind) {
    return cached('head' + kind, () => {
        const g = new THREE.SphereGeometry(1, 26, 20), p = g.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            deformHead(p.getX(i), p.getY(i), p.getZ(i), kind === 'demon', v);
            p.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        return g;
    });
}

// short wavy hair: a lumpy shell over the skull above the hairline, tucked inside the head below it
function hairGeo() {
    return cached('hair', () => {
        const g = new THREE.SphereGeometry(1, 22, 16), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const line = z > 0 ? .42 - .1 * Math.abs(x) - .3 * (1 - z) : .1 + z * .6;           // forehead high, nape low
            const k = Math.max(0, Math.min(1, (y - line) / .12 + .5));
            const wave = .05 * Math.sin(x * 9 + z * 5) * Math.sin(y * 7 + x * 3);
            const r = .72 + k * (.38 + wave + .06 * Math.max(0, y));
            p.setXYZ(i, x * r * .088, y * r * .112 + .006, (z < 0 ? z * 1.1 : z) * r * .1 - .004);
        }
        g.computeVertexNormals();
        return g;
    });
}

// ---------------------------------------------------------------- the torso
export function humanTorso(parent, { skin = 0xc8946a, hair = 0x1a120c, eye = 0x3a2a1a, glowEye = false, gaunt = false, crown = null,
    plates = null, spear = false, claws = false, ears = 'round', scale = 1, head: headKind = null, reptile = null, crest = null,
    mouth = 0x5a1a1e, headScale = 1 } = {}) {
    const add = (p, geo, m, x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        p.add(mesh);
        return mesh;
    };
    const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const hk = headKind || (crown ? 'demon' : 'human');
    const T = grp(parent);
    T.scale.setScalar(scale);
    // materials: painted torso, plain skin (or scales) for limbs and head
    const tex = shadedTex(`torso${skin}${gaunt}${reptile}`, TW, TH, torsoColor(skin, reptile), torsoHeight(gaunt, reptile));
    const torsoM = mat(0xffffff, { map: tex.map, bumpMap: tex.bump, bumpScale: 1.2, roughness: reptile ? .5 : .62 });
    const sc = reptile ? scaleTex(skin) : null;
    const S = reptile ? mat(0xffffff, { map: sc.map, bumpMap: sc.bump, bumpScale: .8, roughness: .5 }) : mat(skin, { roughness: .62 });
    const Hm = mat(hair, { roughness: .9 }), dark = mat(0x140c0a, { roughness: .8 });
    const P = plates ? mat(plates, { roughness: .35, metalness: .2 }) : null;
    add(T, torsoGeo(gaunt), torsoM);
    if (P) for (const s of [1, -1]) {                                                               // chitin pads on the shoulders and the hips
        const pad = add(T, G.sph(.1, 10, 6, 0, TAU, 0, Math.PI / 2), P, s * .2, .47, 0);
        pad.scale.set(1, .75, 1.15); pad.rotation.z = -s * .35;
        add(T, G.sph(.09, 8, 6), P, s * .1, .0, .03).scale.set(1.1, .6, .9);
        for (let k = 0; k < 2; k++) add(pad, G.cone(.018, .09, 4), P, s * .03, .08 - k * .01, -.03 + k * .06).rotation.z = -s * .5;
    }
    // neck and head
    const neck = grp(T, 0, .53, 0);
    const snout = hk === 'lizard' || hk === 'goblin';
    add(neck, limbGeo([[0, .058], [.5, .05], [1, .055]], .12, 10), S, 0, .13, -.005).scale.set(snout ? 1.35 : 1, snout ? .85 : 1, snout ? 1.3 : 1);
    const head = grp(neck, 0, snout ? .1 : .14, snout ? .02 : .01);
    head.scale.setScalar(headScale);
    let jaw;
    const eyeM = glowEye ? mat(eye, { emissive: eye, emissiveIntensity: 1.8, roughness: .2 }) : mat(eye, { roughness: .15 });
    if (hk === 'human' || hk === 'demon') {
        const demon = hk === 'demon';
        add(head, headGeo(hk), S);
        for (const s of [1, -1]) {
            const E = facePt(s * .36, .08, demon), B = facePt(s * .37, .23, demon);
            if (!glowEye) add(head, G.sph(.0095, 8, 6), mat(0xe8e2d6, { roughness: .3 }), E.x, E.y, E.z - .004).scale.set(1.2, .72, .6);
            add(head, G.sph(glowEye ? .011 : .0052, 6, 5), eyeM, E.x * .98, E.y, E.z + (glowEye ? -.002 : .0015)).scale.set(1, glowEye ? .6 : 1, .5);
            const br = add(head, G.box(.03, .005, .006), demon ? S : Hm, B.x, B.y, B.z - .002);
            br.rotation.set(0, s * .35, s * (demon ? -.45 : .1));
            if (ears === 'pointy' || demon) {
                const ear = add(head, G.cone(.022, .1, 4), S, s * .083, .02, -.01);
                ear.rotation.set(-.5, 0, -s * 1.15); ear.scale.set(1, 1, .35);
            } else add(head, G.sph(.022, 6, 5), S, s * .084, .0, -.004).scale.set(.45, 1, .75);
        }
        const Mo = facePt(0, -.44, demon);
        add(head, G.box(.028, .0035, .004), mat(demon ? 0x2a0a0a : 0x7a3a30, { roughness: .6 }), 0, Mo.y, Mo.z - .002);   // mouth line
        jaw = grp(head, 0, Mo.y - .003, Mo.z - .02);
        add(jaw, G.box(.024, .004, .006), mat(0x3a1010), 0, 0, .012);
        if (demon) for (let i = -2; i <= 2; i++) add(jaw, G.cone(.004, .012, 3), mat(0xe8e0d0), i * .007, .004, .014);   // grin
        if (crown) {                                                                                     // spiky crest / horns (urxuquer)
            const cm = mat(crown, { roughness: .4, metalness: .2 });
            add(head, G.sph(.1, 14, 8, 0, TAU, 0, Math.PI * .45), cm, 0, .025, -.01).scale.set(.95, .95, 1.1);
            for (let i = -3; i <= 3; i++) {
                const sp = add(head, G.cone(.017, .17 - Math.abs(i) * .025, 4), cm, i * .03, .1 - Math.abs(i) * .012, -.01 - Math.abs(i) * .008);
                sp.rotation.set(-.3, 0, -i * .26);
            }
            for (const s of [1, -1]) add(head, G.cone(.012, .1, 4), cm, s * .07, .02, .05).rotation.set(.6, 0, -s * .9);   // cheek spikes
        } else {                                                                                         // short wavy hair
            add(head, hairGeo(), Hm);
        }
    } else {                                                                                             // reptile snout heads
        const goblin = hk === 'goblin', hr = goblin ? .1 : .09, belly = reptile || skin;
        const vc = vcMat({ roughness: .55 });
        const so = goblin ? { len: hr * 2.1, wB: hr * .95, wF: hr * .6, hB: hr * .78, hF: hr * .3, under: hr * .14, top: skin, low: belly, mouth, brow: hr * .16, cheek: .14 }
            : { len: hr * 2.5, wB: hr * .72, wF: hr * .36, hB: hr * .6, hF: hr * .24, under: hr * .12, top: skin, low: belly, mouth, brow: hr * .12, cheek: .12 };
        const sk = grp(head, 0, 0, -hr * .3);
        add(sk, skullGeo(so), vc);
        jaw = grp(sk, 0, -hr * .05, 0);
        add(jaw, jawGeo({ len: so.len * .92, wB: so.wB * .88, wF: so.wF * .86, depth: hr * .32, low: belly, top: skin, mouth }), vc);
        const tooth = mat(0xf0e8d0, { roughness: .35 });
        const eyeC = mat(goblin ? 0xd8c040 : 0xd8b030, { roughness: .2, emissive: glowEye ? eye : 0, emissiveIntensity: .4 });
        const er = hr * (goblin ? .2 : .14), te = goblin ? .38 : .4, P = new THREE.Vector3();
        for (const s of [1, -1]) {
            skullAt(so, te, goblin ? .62 : .48, P);
            const ex = s * (P.x - er * .3);
            add(sk, G.sph(er, 10, 8), eyeC, ex, P.y, P.z).scale.set(.8, .9, .9);
            const pu = add(sk, G.sph(er, 8, 6), dark, ex + s * er * .66, P.y, P.z + er * .1);
            pu.scale.set(.16, .75, .3);
            add(sk, G.sph(er * 1.2, 8, 6), S, ex * .9, P.y + er * .65, P.z).scale.set(.9, .38, 1.2);              // brow ridge
            skullAt(so, .95, .55, P);
            add(sk, G.sph(hr * .045, 5, 4), dark, s * P.x * .5, P.y, P.z);                                     // nostril
            const nT = goblin ? 7 : 5;
            for (let i = 0; i < nT; i++) {
                skullAt(so, .35 + i * .085, 0, P);
                add(sk, G.cone(hr * .04, hr * (goblin ? .17 : .13), 4), tooth, s * P.x * .86, -hr * .02, P.z).rotation.x = Math.PI;
                add(jaw, G.cone(hr * .035, hr * (goblin ? .15 : .11), 4), tooth, s * P.x * .76, hr * .04, P.z - hr * .05);
            }
            if (goblin) {                                                                            // big pointed ears sticking out sideways
                skullAt(so, .12, .45, P);
                const ear = add(sk, G.cone(hr * .34, hr * 1.5, 4), S, s * (P.x + hr * .45), P.y + hr * .2, P.z);
                ear.rotation.set(-.15, 0, -s * 1.3); ear.scale.set(1, 1, .25);
            }
        }
        if (crest || !goblin) {                                                                      // lizard crest: spines with a web
            const cm = mat(crest || skin, { roughness: .5, side: THREE.DoubleSide });
            for (let i = 0; i < 6; i++) {
                skullAt(so, .55 - i * .12, 1, P);
                add(sk, G.cone(hr * .08, hr * (.5 - i * .03), 4), cm, 0, P.y * .92, P.z).rotation.x = -.8 - i * .1;
            }
            for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
                skullAt(so, .1, .3 - i * .3, P);
                const f = add(sk, G.cone(hr * .07, hr * .45, 4), cm, s * P.x * .95, P.y, P.z);
                f.rotation.set(-1.8, 0, s * (.8 + i * .25));
            }
        }
    }
    // arms
    const arms = [];
    let spearG = null;
    const m = gaunt ? .8 : 1;
    const upper = limbGeo([[0, .056 * m], [.15, .06 * m], [.42, .053 * m], [.7, .046 * m], [1, .037 * m]], .27, 10);
    const fore = limbGeo([[0, .041 * m], [.18, .046 * m], [.45, .039 * m], [.8, .03 * m], [1, .027 * m]], .25, 10);
    for (const s of [1, -1]) {
        const sh = grp(T, s * .195, .465, 0);
        add(sh, G.sph(.058 * m, 10, 8), P || S, s * .006, -.012, 0).scale.set(1, 1.05, 1.05);           // deltoid
        add(sh, upper, S);
        const el = grp(sh, 0, -.27, 0);
        add(el, G.sph(.04 * m, 7, 5), S);
        add(el, fore, S);
        const hand = grp(el, 0, -.25, 0);
        add(hand, G.sph(1, 8, 6), S, 0, -.035, 0).scale.set(.024, .04, .014);                          // palm
        const fi = add(hand, G.sph(1, 7, 5), S, 0, -.078, .005);                                     // fingers
        fi.scale.set(.022, .03, .012); fi.rotation.x = -.25;
        const th = add(hand, G.sph(1, 6, 4), S, -s * .02, -.04, .016);                               // thumb
        th.scale.set(.009, .022, .009); th.rotation.z = s * .4;
        if (claws) for (let k = -1; k <= 1; k++) add(hand, G.cone(.007, .06, 4), dark, k * .013, -.11, .012).rotation.x = Math.PI + .3;
        if (spear && s < 0) {                                                                        // spear in the right hand
            spearG = grp(hand, 0, -.05, 0);
            add(spearG, G.cyl(.014, .014, 1.9, 6), mat(0x6a4a2a, { roughness: .8 }), 0, 0, .2).rotation.x = Math.PI / 2;
            add(spearG, G.tip(.04, .2), mat(0xb8bcc0, { roughness: .3, metalness: .8 }), 0, 0, 1.25);
        }
        arms.push({ sh, el, hand, s });
    }
    return { T, neck, head, jaw, arms, spear: spearG, S };
}

// arm angles: shoulder x (forward −), shoulder z (out), elbow x (bend −)
export function poseTorsoArms(H, mode, k = 0, t = 0) {
    for (const A of H.arms) {
        const right = A.s < 0;
        let sx = .05 + Math.sin(t * 1.3 + A.s) * .04, sz = A.s * .12, ex = -.25;
        if (mode === 'walk') { sx = Math.sin(t * 5 + (right ? 0 : Math.PI)) * .3; ex = -.4; }
        if (H.spear && right && mode !== 'dead') { sx = -.35; ex = -1.25; sz = -.1; }                       // spear held forward
        if (mode === 'attack') {
            if (H.spear) { if (right) { sx = -.35 - k * 1.0 + (1 - k) * -.2; ex = -1.25 + k * 1.2; } else { sx = -.6; ex = -.9; } }
            else { sx = -.4 - k * 1.5; ex = -1.3 + k * 1.1; sz = A.s * (.35 - k * .25); }                   // claws slash down
        } else if (mode === 'defend') {
            sx = -1.3; ex = -1.1; sz = A.s * .25;
            if (H.spear && right) { sx = -.8; ex = -.9; }
        } else if (mode === 'hit') { sx = .3; ex = -.6; sz = A.s * .4; }
        else if (mode === 'dead') { sx = .4; ex = -.1; sz = A.s * 1.0; }
        A.sh.rotation.set(sx, 0, sz);
        A.el.rotation.x = ex;
    }
    // the spear stays level (raised in idle / walk / defence) whatever the arm does
    if (H.spear) H.spear.rotation.x = -(H.arms[1].el.rotation.x + H.arms[1].sh.rotation.x) - (mode === 'idle' || mode === 'walk' ? 1.1 : mode === 'defend' ? .5 : 0);
}
