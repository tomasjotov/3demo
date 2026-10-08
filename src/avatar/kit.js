import * as THREE from 'three';

// Shared geometry / material caches for avatars and their layers (all avatars reuse them).
export const TAU = Math.PI * 2;
const geoCache = new Map();
const matCache = new Map();

function geo(key, make) {
    if (!geoCache.has(key)) geoCache.set(key, make());
    return geoCache.get(key);
}

export const G = {
    box: (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
    sph: (r, ws = 12, hs = 8, ps = 0, pl = TAU, ts = 0, tl = Math.PI) =>
        geo(`s${r},${ws},${hs},${ps},${pl},${ts},${tl}`,
            () => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl)),
    cyl: (rt, rb, h, seg = 10, open = false, ts = 0, tl = TAU) =>
        geo(`c${rt},${rb},${h},${seg},${open},${ts},${tl}`,
            () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl)),
    cone: (r, h, seg = 8) => geo(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
    torus: (r, t, rs = 6, ts = 18, arc = TAU) =>
        geo(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
    // Flat pyramid tip pointing +Z (blades, spear head).
    tip: (r, h, flat = .25) => geo(`tip${r},${h},${flat}`,
        () => new THREE.ConeGeometry(r, h, 4).rotateX(Math.PI / 2).scale(1, flat, 1)),
    // Cape: plane hanging down from its top edge, wrapped around the back.
    cape: (w = .46, h = .82) => geo(`cape${w},${h}`, () => {
        const g = new THREE.PlaneGeometry(w, h, 4, 6);
        g.translate(0, -h / 2, 0);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i);
            p.setX(i, x * (1 + (-y) * .35));               // wider at the bottom
            p.setZ(i, -(x * x) * 1.4 - (-y) * .06);        // curve around the back
        }
        g.computeVertexNormals();
        return g;
    }),
    // Bow / crossbow prod: arc spanning Z with the MIDDLE OF THE FRAME (grip) at the origin; the tips bend
    // towards +Y, so the string (tip to tip) lies at y = +bend – on the archer's side of the fist.
    bow: (len, bend) => geo(`bow${len},${bend}`, () => {
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const t = i / 12 - .5;
            pts.push(new THREE.Vector3(0, bend * 4 * t * t, t * len));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .018, 5, false);
    }),
    line: (a, b) => geo(`l${a}${b}`, () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]))
};

export function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...opts }));
    }
    return matCache.get(key);
}
export const metalMat = color => mat(color, { roughness: .32, metalness: .75 });
export const clothMat = color => mat(color, { side: THREE.DoubleSide });

// ---------------------------------------------------------------- textures
// Small repeating canvas patterns (no files). null in a non-browser context.
const texCache = new Map();
function pattern(name, draw, repeat) {
    const key = name + repeat;
    if (texCache.has(key)) return texCache.get(key);
    let tex = null;
    if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        draw(c.getContext('2d'));
        tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(...repeat);
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(key, tex);
    return tex;
}

const PATTERNS = {
    chain: g => {                                     // interlocking rings
        g.fillStyle = '#5c6066'; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = '#c9ced4'; g.lineWidth = 2.2;
        for (let y = 0; y < 72; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 72; x += 8) {
            g.beginPath(); g.arc(x, y, 3.6, 0, TAU); g.stroke();
        }
    },
    scale: g => {                                     // overlapping scales
        g.fillStyle = '#3a3226'; g.fillRect(0, 0, 64, 64);
        for (let y = -8; y < 72; y += 10) for (let x = (y / 10) % 2 ? 8 : 0; x < 72; x += 16) {
            const gr = g.createLinearGradient(0, y, 0, y + 12);
            gr.addColorStop(0, '#e6e0d4'); gr.addColorStop(1, '#7f7a70');
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, 8, 0, Math.PI); g.fill();
            g.strokeStyle = '#2a241c'; g.lineWidth = 1; g.stroke();
        }
    },
    padded: g => {                                    // quilted diamonds
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = 'rgba(80,60,40,.55)'; g.lineWidth = 2;
        for (let i = -64; i < 128; i += 16) {
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
            g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke();
        }
    },
    leather: g => {                                   // stitched panels
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
        g.strokeStyle = 'rgba(40,24,12,.5)'; g.setLineDash([3, 3]); g.lineWidth = 1.5;
        for (let x = 4; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    }
};

// Material with a pattern; `color` tints it (padded / leather patterns are white-based).
export function patternMat(name, color, repeat = [6, 3], opts = {}) {
    const map = pattern(name, PATTERNS[name], repeat);
    return mat(color, { map, ...opts });
}
