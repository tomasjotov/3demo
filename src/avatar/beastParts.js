import * as THREE from 'three';
import { G, TAU, mat, clothMat } from './kit.js';
import { taperTube, hornGeo } from '../renderer/creatureParts.js';
import { boneMats, boneSkull } from './undead.js';
import { limbGeo, scaleKeys, sculptHand, sculptFoot, buildOf, beastHair, lingerie, armour, robe, tunic, skirtGroup } from './beastSculpt.js';

/*
 * Monster parts of the humanoid avatar (flags of avatar/beastBodies.js, built into the ProceduralAvatar rig):
 *
 *   skin patterns     canvas textures: lava cracks (glowing), rot, fur, scales, chitin, veins, sinew
 *   heads             wolf (jaw), bull (horns, nose ring), insect (mandibles, antennae), ape, bare skull, none (neck stump)
 *   legs              goat (hock + hoof), digitigrade (hock + clawed paw) – the shin bends back to a raised heel;
 *                     fish: the legs are hidden, a scaly tail hangs from the pelvis, bends onto the ground and undulates
 *   wings             bat (fingers + membrane, torn: missing panels), feather (primaries, secondaries, coverts),
 *                     insect (four translucent wings that buzz); humanoid wings fold down the back and open up and out
 *   extras            horns, open maw with fangs, extra eyes, long tongue, huge belly, boils, spikes, claws, fur tufts,
 *                     tails with spade / tuft / brush / spikes, shadow tendrils and a horned shadow, a second pair of arms,
 *                     fins, beetle carapace, collar + shroud, rag skirt, silver back
 *
 *   beastSkinMat(body)                           skin material of the body (plain or patterned)
 *   beastLeg(add, J, s, side, body, mat, k, L)   goat / digitigrade leg meshes on the leg joints
 *   beastHead(add, grp, J, body, skin)           replaces the human face (body.head)
 *   buildBeast(add, grp, J, body, dims, skin)    everything else → parts state (null when the body has none)
 *   animateBeast(avatar, state, c, dt)           wings, fish tail, tongue, jaw, mandibles, tendrils … per frame
 */

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), _d = new THREE.Vector3();
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, k) => a + (b - a) * k;
const hex = c => '#' + c.toString(16).padStart(6, '0');
const shadeHex = (c, k) => {
    const ch = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k)));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// Cylinder from point a to b (radius r0 at a, r1 at b).
function seg(add, parent, a, b, r0, r1, m, rad = 8) {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    const mesh = add(parent, G.cyl(r1, r0, len, rad), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
    return mesh;
}

const geoCache = new Map();
const cachedGeo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };

// Flat shape (x, y points) in the xy plane, double sided by the material.
function flatShape(key, pts) {
    return cachedGeo('fs' + key, () => {
        const sh = new THREE.Shape();
        pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
        return new THREE.ShapeGeometry(sh);
    });
}
function tri(a, b, c) {
    return cachedGeo('tri' + a + b + c, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
        g.computeVertexNormals();
        return g;
    });
}

// ------------------------------------------------------------------ skin patterns
function rng(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const texCache = new Map();
const SIZE = 128;
// Random walk polyline (cracks, veins); drawn on every given context.
function walkLine(ctxs, rnd, steps, step, turn, width) {
    let x = rnd() * SIZE, y = rnd() * SIZE, a = rnd() * TAU;
    for (const g of ctxs) { g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
    for (let j = 0; j < steps; j++) {
        a += (rnd() - .5) * turn;
        x += Math.cos(a) * step; y += Math.sin(a) * step;
        for (const g of ctxs) g.lineTo(x, y);
    }
    for (const g of ctxs) g.stroke();
}
const PATTERNS = {
    lava(g, e, rnd, base, acc) {
        for (let i = 0; i < 40; i++) {                                   // mottled skin
            g.fillStyle = hex(shadeHex(base, rnd() < .5 ? .7 : 1.25)); g.globalAlpha = .3;
            g.beginPath(); g.arc(rnd() * SIZE, rnd() * SIZE, 4 + rnd() * 10, 0, TAU); g.fill();
        }
        g.globalAlpha = 1; g.strokeStyle = hex(acc); e.strokeStyle = '#ffffff';
        for (let i = 0; i < 9; i++) walkLine([g, e], rnd, 5 + (rnd() * 5 | 0), 7 + rnd() * 6, 1.6, .7 + rnd() * 1.1);
    },
    rot(g, e, rnd, base, acc) {
        for (let i = 0; i < 30; i++) {
            g.fillStyle = hex(shadeHex(base, .55)); g.globalAlpha = .5;
            g.beginPath(); g.ellipse(rnd() * SIZE, rnd() * SIZE, 4 + rnd() * 12, 3 + rnd() * 8, rnd() * 3, 0, TAU); g.fill();
        }
        g.globalAlpha = .85; g.fillStyle = hex(acc);
        for (let i = 0; i < 11; i++) { g.beginPath(); g.ellipse(rnd() * SIZE, rnd() * SIZE, 3 + rnd() * 8, 2 + rnd() * 5, rnd() * 3, 0, TAU); g.fill(); }
        g.fillStyle = '#5a1a12';
        for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(rnd() * SIZE, rnd() * SIZE, 1 + rnd() * 2.5, 0, TAU); g.fill(); }
        g.globalAlpha = 1;
    },
    fur(g, e, rnd, base, acc) {
        g.lineWidth = 1.2;
        for (let i = 0; i < 1100; i++) {
            const r = rnd();
            g.strokeStyle = hex(r < .4 ? shadeHex(base, .62) : r < .75 ? shadeHex(base, 1.35) : acc);
            const x = rnd() * SIZE, y = rnd() * SIZE, a = Math.PI / 2 + (rnd() - .5) * .8, l = 3 + rnd() * 5;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
    },
    scales(g, e, rnd, base, acc) {
        for (let y = -8, row = 0; y < SIZE + 8; y += 8, row++) {
            for (let x = row % 2 ? 5 : 0; x < SIZE + 10; x += 10) {
                const gr = g.createLinearGradient(0, y - 6, 0, y + 6);
                gr.addColorStop(0, hex(shadeHex(base, 1.3))); gr.addColorStop(1, hex(acc));
                g.fillStyle = gr; g.beginPath(); g.arc(x, y, 6, 0, Math.PI); g.fill();
                g.strokeStyle = hex(shadeHex(acc, .6)); g.lineWidth = 1; g.stroke();
            }
        }
    },
    chitin(g, e, rnd, base, acc) {
        for (let i = 0; i < 20; i++) {
            g.fillStyle = hex(shadeHex(base, 1.4)); g.globalAlpha = .18;
            g.beginPath(); g.ellipse(rnd() * SIZE, rnd() * SIZE, 8 + rnd() * 14, 3 + rnd() * 5, 0, 0, TAU); g.fill();
        }
        g.globalAlpha = 1; g.strokeStyle = hex(acc); g.lineWidth = 2.5;
        for (let y = 10; y < SIZE; y += 21) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 4, 88, y - 4, SIZE, y); g.stroke(); }
    },
    veins(g, e, rnd, base, acc) {
        g.strokeStyle = hex(acc); e.strokeStyle = '#ffffff'; g.globalAlpha = .75;
        for (let i = 0; i < 14; i++) walkLine([g, e], rnd, 8, 6 + rnd() * 4, 1.1, .8 + rnd() * .9);
        g.globalAlpha = 1;
    },
    sinew(g, e, rnd, base, acc) {
        for (let i = 0; i < 70; i++) {
            g.strokeStyle = hex(rnd() < .5 ? acc : shadeHex(base, .6)); g.globalAlpha = .6; g.lineWidth = 1 + rnd() * 2;
            const x = rnd() * SIZE, w = (rnd() - .5) * 8;
            g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + w, SIZE * .33, x - w, SIZE * .66, x, SIZE); g.stroke();
        }
        g.globalAlpha = 1;
    }
};
// { map, emissiveMap } of a pattern (null outside a browser).
function patternTex(name, base, acc, glow) {
    const key = `${name}:${base}:${acc}:${!!glow}`;
    if (texCache.has(key)) return texCache.get(key);
    let out = null;
    if (typeof document !== 'undefined') {
        const mk = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; };
        const c = mk(), ce = mk(), g = c.getContext('2d'), e = ce.getContext('2d');
        g.fillStyle = hex(base); g.fillRect(0, 0, SIZE, SIZE);
        e.fillStyle = '#000000'; e.fillRect(0, 0, SIZE, SIZE);
        g.lineCap = e.lineCap = 'round';
        PATTERNS[name](g, e, rng(name.length * 977 + base % 7919), base, acc ?? shadeHex(base, .6));
        const tex = (cv, srgb) => {
            const t = new THREE.CanvasTexture(cv);
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(name === 'fur' ? 3 : 2, name === 'fur' ? 3 : 2);
            if (srgb) t.colorSpace = THREE.SRGBColorSpace;
            return t;
        };
        out = { map: tex(c, true), emissiveMap: glow ? tex(ce, false) : null };
    }
    texCache.set(key, out);
    return out;
}
function patternMat(name, base, acc, glow, opts = {}) {
    const t = patternTex(name, base, acc, glow);
    if (!t) return mat(base, opts);
    const o = { map: t.map, roughness: name === 'chitin' ? .38 : name === 'scales' ? .5 : .85, ...opts };
    if (glow) Object.assign(o, { emissive: glow, emissiveMap: t.emissiveMap, emissiveIntensity: 1.5 });
    return mat(0xffffff, o);
}
export function beastSkinMat(b) {
    return b.skinTex ? patternMat(b.skinTex, b.skin, b.texColor, b.glow) : mat(b.skin);
}
const glowMat = c => mat(c, { emissive: c, emissiveIntensity: 2.4, roughness: .3 });

// ------------------------------------------------------------------ legs
// Sculpted limb from point a to point b of the parent (keys of limbGeo, radius scaled by k).
function limbTo(add, parent, a, b, keys, key, m) {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length();
    const mesh = add(parent, limbGeo(key, len, keys, 0), m, a[0], a[1], a[2]);
    mesh.quaternion.setFromUnitVectors(DOWN, _d.normalize());
    return mesh;
}
// Leg material of goat / digitigrade legs: fur pattern (body.legFur) or plain.
export function legMat(b, skin) {
    if (b.legFur) return patternMat('fur', b.legColor ?? b.skin, shadeHex(b.legColor ?? b.skin, .55));
    return b.legColor ? mat(b.legColor) : skin;
}
// Goat / digitigrade leg on the joints of the shared rig: heavy thigh, shin back to a raised heel (hock),
// long thin cannon down to the hoof (shaggy fetlock, cloven hoof) or a clawed paw.
export function beastLeg(add, J, s, side, b, m, k, L) {
    const hip = J[s + 'Hip'], knee = J[s + 'Knee'], ankle = J[s + 'Ankle'], kk = k * (b.legK || 1);
    m = legMat(b, m);
    add(hip, G.sph(.112 * kk, 12, 9), m);
    add(hip, limbGeo('bth' + kk, .4 * L + .03, scaleKeys([[0, .118, 0, 0], [.22, .11, .036, .03], [.55, .094, .028, .02], [.85, .07, .01, .004], [1, .062, 0, 0]], kk), .03), m);
    const hock = [0, -.2 * L, -.13 * L], foot = [0, -.38 * L, 0];
    add(knee, G.sph(.064 * kk, 10, 8), m);
    limbTo(add, knee, [0, 0, 0], hock, scaleKeys([[0, .064, 0, 0], [.25, .06, 0, .018], [.7, .045, 0, .006], [1, .04, 0, 0]], kk), 'bsh' + kk, m);
    add(knee, G.sph(.04 * kk, 8, 6), m, ...hock);
    limbTo(add, knee, hock, foot, scaleKeys([[0, .038, 0, 0], [.5, .031, 0, 0], [1, .03, 0, 0]], kk), 'bmt' + kk, m);
    if (b.legs === 'goat') {
        const hoof = mat(b.hoof ?? 0x141010, { roughness: .45 });
        const tuft = cachedGeo('fetlock', () => {                     // shaggy fur around the fetlock
            const g = new THREE.SphereGeometry(.05, 12, 8), p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z);
                const shag = 1 + (y < 0 ? .35 * Math.max(0, Math.sin(a * 7)) * (-y / .05) : 0);
                p.setXYZ(i, x * shag, y * (y < 0 ? 1 + .5 * Math.max(0, Math.sin(a * 7 + 1)) : 1.3), z * shag);
            }
            g.computeVertexNormals();
            return g;
        });
        add(ankle, tuft, m, 0, .014, .005).scale.setScalar(kk);
        for (const x of [1, -1]) {                                       // cloven hoof
            const h = add(ankle, G.cyl(.02, .03, .062, 8), hoof, x * .019, -.059, .016);
            h.scale.set(1, 1, 1.35); h.rotation.x = -.18;
        }
    } else {
        sculptFoot(add, ankle, { ...b, female: false }, m, 1.15 * Math.sqrt(kk));
        if (b.claws) add(ankle, G.cone(.012, .05, 5), mat(b.claws, { roughness: .4 }), 0, -.03, -.04).rotation.x = -Math.PI / 2;   // dew claw
    }
}

// ------------------------------------------------------------------ heads (in the face group F, head centre at its origin)
function coatMat(b, color) {
    return b.skinTex === 'fur' ? patternMat('fur', color, shadeHex(color, .55)) : mat(color);
}
function wolfHead(add, grp, J, F, b, B) {
    const w = b.wolf || {}, coat = coatMat(b, w.coat ?? b.skin), dark = mat(w.dark ?? 0x2a2420), light = mat(w.light ?? 0xb0a890);
    const tooth = mat(0xf2ead8, { roughness: .4 }), e = w.ear || 1;
    add(F, G.sph(.165, 14, 10), coat, 0, .03, -.04).scale.set(.95, .88, 1.08);               // skull
    for (const s of [1, -1]) add(F, G.sph(.1, 10, 8), light, .095 * s, -.06, .0).scale.set(.8, .9, 1.15);   // cheek ruff
    const muzzle = add(F, G.cyl(.058, .1, .3, 10), coat, 0, -.055, .2);
    muzzle.rotation.x = Math.PI / 2; muzzle.scale.set(.92, 1, .85);
    add(F, G.cyl(.035, .065, .22, 8), dark, 0, -.01, .2).rotation.x = Math.PI / 2 + .25;     // nose bridge
    add(F, G.sph(.042, 8, 6), mat(0x141210, { roughness: .3 }), 0, -.035, .355).scale.set(1.1, .85, .9);
    B.bjaw = grp(F, 0, -.105, .06);
    add(B.bjaw, G.box(.1, .042, .27), light, 0, 0, .13);
    for (const s of [1, -1]) {
        add(F, G.cone(.012, .05, 5), tooth, .034 * s, -.105, .3).rotation.x = Math.PI;          // fangs
        add(B.bjaw, G.cone(.011, .04, 5), tooth, .03 * s, .035, .23);
        const eye = add(F, G.sph(.027, 8, 6), b.glowEyes ? glowMat(b.glowEyes) : mat(b.eye ?? 0xd8a23a, { roughness: .2 }), .078 * s, .045, .125);
        eye.scale.set(.8, .75, .6);
        J.eyes.push(eye);
        const ear = grp(F, .085 * s, .13, -.06);
        add(ear, G.cone(.06 * e, .17 * e, 4), coat, 0, .075 * e, 0).scale.set(1, 1, .45);
        add(ear, G.cone(.038 * e, .12 * e, 4), dark, 0, .065 * e, .012).scale.set(1, 1, .3);
        ear.rotation.z = -.25 * s;
    }
    for (let i = 0; i < 5; i++) {                                                             // mane down the nape
        const c = add(F, G.cone(.06, .2, 5), coat, (i % 2 ? .05 : -.05) * (i < 4 ? 1 : 0), .07 - i * .06, -.17 - i * .015);
        c.rotation.x = -2.1 + i * .1;
    }
}
function bullHead(add, grp, J, F, b, B) {
    const coat = mat(b.headColor ?? 0x2a1e18), pad = mat(shadeHex(b.headColor ?? 0x2a1e18, 1.7), { roughness: .6 });
    const dark = mat(0x0c0808), horn = mat(b.hornColor ?? 0xe0d4b0, { roughness: .45 });
    add(F, G.sph(.17, 14, 10), coat, 0, .03, -.03).scale.set(1, 1.05, 1.1);                   // skull
    add(F, G.sph(.13, 12, 9), coat, 0, -.075, .15).scale.set(1.05, .85, 1.1);                 // muzzle
    add(F, G.sph(.1, 10, 8), pad, 0, -.09, .245).scale.set(1.15, .72, .6);                    // nose pad
    for (const s of [1, -1]) {
        add(F, G.sph(.022, 6, 5), dark, .042 * s, -.075, .3);                                  // nostrils
        const eye = add(F, G.sph(.026, 8, 6), b.glowEyes ? glowMat(b.glowEyes) : mat(0x1a0c08, { roughness: .2 }), .12 * s, .05, .11);
        J.eyes.push(eye);
        const ear = add(F, G.cone(.05, .15, 6), coat, .19 * s, .06, -.02);
        ear.rotation.z = -s * Math.PI / 2; ear.scale.set(1, 1, .5);
        const h = add(F, hornGeo(.44, .05, .55, .4), horn, .12 * s, .13, 0);
        if (s < 0) h.scale.x = -1;
    }
    const ring = add(F, G.torus(.045, .008, 5, 14), mat(0xd8b25a, { roughness: .3, metalness: .8 }), 0, -.14, .285);
    ring.rotation.y = Math.PI / 2;
    B.bjaw = grp(F, 0, -.14, .07);
    add(B.bjaw, G.box(.15, .05, .2), coat, 0, -.01, .1);
    for (let i = 0; i < 4; i++) add(F, G.cone(.045, .12, 5), coat, (i - 1.5) * .04, .2, .04 - i * .01).rotation.x = .3;   // forelock
}
function insectHead(add, grp, J, F, b, B) {
    const shell = patternMat('chitin', b.skin, b.texColor, null), eyeM = mat(0x0a0806, { roughness: .15, metalness: .4 });
    const jaw = mat(shadeHex(b.skin, .6), { roughness: .35 });
    add(F, G.sph(.17, 14, 10), shell, 0, .03, -.01).scale.set(1.08, .85, 1.2);               // dome
    add(F, G.sph(.12, 12, 8), shell, 0, -.05, .1).scale.set(1, .9, .9);                      // face plate
    B.mandibles = []; B.antennae = [];
    for (const s of [1, -1]) {
        add(F, G.sph(.075, 12, 8), eyeM, .115 * s, .045, .1).scale.set(.8, 1, .9);            // compound eyes
        const m = grp(F, .06 * s, -.1, .16);
        add(m, taperTube([[0, 0, 0], [.09 * s, -.04, .06], [.085 * s, -.13, .11], [.01 * s, -.2, .1]], .04, .007, 10, 6), jaw);
        B.mandibles.push(m);
        const a = grp(F, .05 * s, .12, .14);
        add(a, taperTube([[0, 0, 0], [.03 * s, .12, .06], [.08 * s, .3, .02], [.15 * s, .44, -.1]], .012, .003, 10, 5), jaw);
        B.antennae.push(a);
    }
    add(F, G.box(.05, .05, .05), jaw, 0, -.12, .17);                                         // mouth parts
}
function apeHead(add, grp, J, F, b, B) {
    const fur = coatMat(b, b.skin), face = mat(0x2a2422, { roughness: .7 });
    add(F, G.sph(.18, 14, 10), fur, 0, .03, -.04).scale.set(1, 1, 1.05);                      // skull
    add(F, G.sph(.1, 10, 8), fur, 0, .15, -.08).scale.set(.75, 1, 1.25);                     // crest
    add(F, G.sph(.13, 12, 9), face, 0, -.02, .09).scale.set(1.1, 1, .8);                      // face
    add(F, G.box(.25, .055, .08), face, 0, .07, .15);                                         // brow ridge
    add(F, G.sph(.1, 10, 8), face, 0, -.09, .15).scale.set(1.25, .8, .9);                     // muzzle
    for (const s of [1, -1]) {
        add(F, G.sph(.02, 6, 5), mat(0x0a0808), .028 * s, -.05, .235);                        // nostrils
        const eye = add(F, G.sph(.021, 8, 6), mat(0x2a1a10, { roughness: .2 }), .06 * s, .025, .18);
        J.eyes.push(eye);
        add(F, G.sph(.04, 8, 6), face, .175 * s, 0, -.01).scale.set(.5, 1, .8);               // ears
    }
    B.bjaw = grp(F, 0, -.13, .08);
    add(B.bjaw, G.box(.15, .045, .13), face, 0, -.01, .07);
    for (const s of [1, -1]) add(B.bjaw, G.cone(.012, .045, 5), mat(0xe8e0c8), .045 * s, .03, .12);   // canines
}
function skullHead(add, grp, J, F, b) {
    boneSkull(add, grp, J, boneMats({ skin: b.skull ?? 0xd8d0b8 }));
    if (b.glowEyes) for (const s of [1, -1]) add(F, G.sph(.02, 6, 5), glowMat(b.glowEyes), .057 * s, .006, .125);
}
export function beastHead(add, grp, J, b, skin, B) {
    const F = J.face;
    if (b.head === 'none') {                                           // headless: neck stump, the face group stays hidden
        add(J.neck, G.cyl(.075, .085, .09, 10), skin, 0, .02, 0);
        add(J.neck, G.sph(.074, 10, 6), mat(0x5a1414, { roughness: .6 }), 0, .065, 0).scale.y = .25;
        add(J.neck, G.cyl(.02, .025, .04, 6), mat(0xd8d0b8), 0, .07, -.01);
        F.visible = false;
        return;
    }
    add(J.neck, G.cyl(.085, .1, .16, 10), b.head === 'wolf' || b.head === 'ape' ? coatMat(b, b.wolf?.coat ?? b.skin)
        : b.head === 'bull' ? mat(b.headColor ?? 0x2a1e18) : skin, 0, .05, 0);
    if (b.head === 'wolf') wolfHead(add, grp, J, F, b, B);
    else if (b.head === 'bull') bullHead(add, grp, J, F, b, B);
    else if (b.head === 'insect') insectHead(add, grp, J, F, b, B);
    else if (b.head === 'ape') apeHead(add, grp, J, F, b, B);
    else if (b.head === 'skull') skullHead(add, grp, J, F, b);
}

// ------------------------------------------------------------------ wings
// Bat / feather wing on the shoulder blade, side +1 = left (+x). The wing lies in the plane behind the back:
// arm up and out, forearm, fingers fanning downwards. set(open 0 folded down the back .. 1 spread, flap, sweep back, tilt).
function humanWing(add, grp, parent, side, w) {
    const s = side, L = w.len, feather = w.kind === 'feather';
    const boneM = mat(w.color ?? 0x2a1c1c, { roughness: .8 });
    const memM = mat(w.membrane ?? 0x4a2a2a, { roughness: .9, side: THREE.DoubleSide });
    const feaM = mat(w.feather ?? 0x2a2426, { roughness: .95, side: THREE.DoubleSide });
    const innM = mat(w.inner ?? w.feather ?? 0x2a2426, { roughness: .95, side: THREE.DoubleSide });
    const root = grp(parent, s * .08, .36, -.17);
    root.rotation.order = 'YZX';
    const a = .32 * L, f = .36 * L;
    seg(add, root, [0, 0, 0], [s * a, 0, 0], .032 * L, .024 * L, boneM, 6);
    const elbow = grp(root, s * a, 0, 0);
    add(elbow, G.sph(.026 * L, 6, 5), boneM);
    seg(add, elbow, [0, 0, 0], [s * f, 0, 0], .024 * L, .016 * L, boneM, 6);
    const hand = grp(elbow, s * f, 0, 0);
    add(hand, G.cone(.018 * L, .08 * L, 4), boneM, s * .02 * L, .035 * L, 0).rotation.z = -s * .5;   // thumb claw
    const fingers = [], inner = [], arm = [], fore = [];
    let fan;
    if (!feather) {
        const fl = [.62, .56, .48, .4].map(x => x * L);
        fan = .36;
        inner.push(add(root, tri([0, 0, 0], [s * a, 0, 0], [s * a * .1, -.55 * L, 0]), memM));
        inner.push(add(elbow, tri([0, 0, 0], [s * f, 0, 0], [-s * a * .9, -.55 * L, 0]), memM));
        for (let i = 0; i < 4; i++) {
            const fg = grp(hand);
            seg(add, fg, [0, 0, 0], [s * fl[i], 0, 0], .014 * L, .007 * L, boneM, 5);
            const b2 = i < 3 ? fl[i + 1] : fl[3];
            const next = i < 3 ? [s * Math.cos(fan) * b2, -Math.sin(fan) * b2, 0]
                : [-s * (f * .95 + a * .9) * Math.cos(fan * 4.4), -.55 * L, 0];                // last panel: back to the body
            const panel = add(fg, tri([0, 0, 0], [s * fl[i], 0, 0], next), memM);
            if (i === 3) inner.push(panel);
            if (w.torn && (i === 1 || i === 3)) panel.visible = false;                         // torn membrane
            fingers.push(fg);
        }
        if (w.torn) inner[1].scale.set(1, .6, 1);
    } else {
        const fl = [.62, .6, .56, .5, .44].map(x => x * L);
        fan = .24;
        for (let i = 0; i < 5; i++) {                                                          // primaries
            const fg = grp(hand);
            add(fg, G.box(fl[i], .006 * L, .1 * L), feaM, s * fl[i] / 2, 0, -.003 * i).rotation.x = Math.PI / 2;
            fingers.push(fg);
        }
        for (let i = 0; i < 6; i++) {                                                          // secondaries on the forearm
            const pv = grp(elbow, s * f * (i + .5) / 6, 0, -.004);
            add(pv, G.box(.1 * L, .44 * L, .006 * L), i % 2 ? innM : feaM, 0, -.21 * L, 0);
            fore.push(pv);
        }
        for (let i = 0; i < 4; i++) {                                                          // tertials on the arm
            const pv = grp(root, s * a * (i + .5) / 4, 0, -.008);
            add(pv, G.box(.1 * L, .36 * L, .006 * L), innM, 0, -.17 * L, 0);
            arm.push(pv);
        }
        add(root, G.box(a, .1 * L, .03 * L), feaM, s * a / 2, -.03 * L, .005);                 // coverts
        add(elbow, G.box(f, .09 * L, .03 * L), feaM, s * f / 2, -.03 * L, .005);
    }
    return {
        root,
        set(open, flap = 0, sweep = 0, tilt = .25) {
            const k = 1 - open;
            root.rotation.z = s * (lerp(.35, 1.2, k) + flap * .55);
            root.rotation.y = s * (sweep + k * .45);
            root.rotation.x = tilt;
            elbow.rotation.z = s * lerp(.45, -2.75, k);
            hand.rotation.z = s * lerp(-.1, .25, k);
            const fn = lerp(.05, fan, open);
            fingers.forEach((fg, i) => { fg.rotation.z = -s * (i + (feather ? 0 : 1)) * fn; });
            for (const m of inner) m.scale.x = m.scale.z = .1 + .9 * open;
            for (const pv of fore) pv.rotation.z = s * k * 1.45;
            for (const pv of arm) pv.rotation.z = -s * k * 1.1;
        }
    };
}
// Two translucent wings per side, buzzing back and forth around the vertical.
function insectWing(add, grp, parent, side, w) {
    const s = side, L = w.len;
    const m = mat(w.membrane ?? 0xc0f0e0, { transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false,
        emissive: w.membrane ?? 0xc0f0e0, emissiveIntensity: .35, roughness: .2, metalness: .3 });
    const vein = mat(shadeHex(w.membrane ?? 0xc0f0e0, .7), { roughness: .4 });
    const root = grp(parent, s * .05, .36, -.15);
    const blade = (len, wid, ang, key) => {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const a = i / 16 * TAU, x = (1 - Math.cos(a)) / 2 * len;
            pts.push([x, Math.sin(a) * wid * (.45 + .55 * x / len)]);
        }
        const g = grp(root);
        g.rotation.z = s * ang;
        const mesh = add(g, flatShape(key + len + wid, pts), m);
        mesh.castShadow = false;
        if (s < 0) mesh.scale.x = -1;
        seg(add, g, [0, 0, 0], [s * len * .95, 0, 0], .006, .002, vein, 4);
        return g;
    };
    blade(.55 * L, .17 * L, .55, 'iw1'); blade(.4 * L, .13 * L, -.5, 'iw2');
    return {
        root,
        set(open, flap = 0) {
            root.rotation.y = s * (lerp(1.25, .35, open) + flap * .55);
            root.rotation.x = .15;
        }
    };
}

// ------------------------------------------------------------------ tails
// Tail of segments from the pelvis (J.tail – swayed by ProceduralAvatar like the lizardman tail).
function beastTail(add, grp, J, b, skin) {
    const T = b.tail, m = T.color != null ? mat(T.color) : skin, n = T.n || 5, L = T.seg || .16;
    let seg_ = J.pelvis, r = T.r || .05;
    J.tail = [];
    for (let i = 0; i < n; i++) {
        seg_ = grp(seg_, 0, i ? -.01 : -.05, i ? -L : -.15);
        seg_.rotation.x = seg_.userData.rx = i ? -(T.curve ?? -.1) : (T.lift ?? -.4);   // + lifts the tail, - lets it hang
        const rr = T.tip === 'brush' ? r * (1 + Math.sin(i / (n - 1) * Math.PI) * .6) : r;
        add(seg_, G.cyl(rr * .8, rr, L * 1.12, 7), m, 0, 0, -L / 2).rotation.x = Math.PI / 2;
        if (T.tip === 'spikes' && i > 0) add(seg_, G.cone(r * .55, r * 2, 5), mat(0x161010), 0, rr * .8, -L / 2).rotation.x = -.5;
        if (T.tip !== 'brush') r *= n > 5 ? .86 : .78;
        J.tail.push(seg_);
    }
    const end = grp(seg_, 0, 0, -L);
    if (T.tip === 'spade') add(end, G.cone(.07, .14, 4), m, 0, 0, -.05).rotation.x = -Math.PI / 2;
    if (T.tip === 'spade') end.children[0].scale.set(1, 1, .25);
    if (T.tip === 'tuft') add(end, G.sph(.05, 8, 6), mat(shadeHex(T.color ?? b.skin, .7)), 0, 0, -.03).scale.set(1, 1, 1.6);
    if (T.tip === 'spikes') add(end, G.cone(r * 1.4, r * 5, 5), mat(0x161010), 0, 0, -r * 2).rotation.x = -Math.PI / 2;
    if (T.tip === 'brush') add(end, G.cone(r * 1.1, r * 2.6, 7), m, 0, 0, -r * 1.1).rotation.x = -Math.PI / 2;
}
// Fish tail instead of legs: chain hanging from the pelvis, bent onto the ground by animateBeast.
const FISH_N = 8, FISH_L = .17;
function fishTail(add, grp, J, b) {
    const ft = b.fishTail, m = patternMat('scales', ft.color, shadeHex(ft.color, .55), null), fin = mat(ft.fin, { side: THREE.DoubleSide, roughness: .55 });
    add(J.pelvis, G.sph(.205, 12, 8), m, 0, -.06, 0).scale.set(1, .9, .82);
    const segs = [];
    let p = grp(J.pelvis, 0, -.08, 0);
    for (let i = 0; i < FISH_N; i++) {
        const g = i ? grp(p, 0, -FISH_L, 0) : p;
        const r0 = .175 * (1 - i / FISH_N * .78), r1 = .175 * (1 - (i + 1) / FISH_N * .78);
        add(g, G.cyl(r0, r1, FISH_L, 10), m, 0, -FISH_L / 2, 0).scale.z = .82;
        add(g, G.sph(r0, 10, 6), m).scale.z = .82;
        if (i === 2 || i === 4) add(g, flatShape('dfin' + i, [[0, 0], [0, -FISH_L], [-.1, -FISH_L * .2]]), fin, 0, 0, -r0 * .8).rotation.y = Math.PI / 2;
        segs.push(g); p = g;
    }
    const end = grp(p, 0, -FISH_L, 0);
    const fluke = [[0, 0], [.12, -.06], [.24, -.18], [.3, -.32], [.16, -.24], [.05, -.2], [0, -.15]];
    for (const s of [1, -1]) add(end, flatShape('fluke', fluke), fin, 0, .02, 0).scale.x = s;
    segs.push(end);
    return segs;
}

// ------------------------------------------------------------------ other parts
// Ram horn: spirals back, down and forward around the ear, flaring outwards (left side, mirror with scale.x = -1).
function ramHornGeo(R, r) {
    return cachedGeo('ram' + R + r, () => {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10, f = t * Math.PI * 1.55, rr = R * (1 - .42 * t);
            pts.push([.03 + .13 * Math.sin(t * Math.PI * .6), rr * Math.cos(f) - R, -rr * Math.sin(f) + .02 * t]);
        }
        return taperTube(pts, r, r * .3, 20, 8);
    });
}
function horns(add, F, b) {
    for (const h of [].concat(b.horn)) {
        const m = mat(h.color ?? 0x2a2020, { roughness: .55 });
        for (const s of [1, -1]) {
            const g = h.ram ? ramHornGeo(h.len, h.r) : hornGeo(h.len, h.r, h.up, h.fwd, h.curl || 0);
            const mesh = add(F, g, m, (h.x ?? .11) * s, h.y ?? .17, h.z ?? .02);
            if (s < 0) mesh.scale.x = -1;
        }
    }
}
function fangs(add, F) {
    add(F, G.box(.11, .05, .02), mat(0x1a0606, { roughness: 1 }), 0, -.098, .17);
    const tooth = mat(0xece4cc, { roughness: .45 });
    for (const x of [-.04, -.014, .014, .04]) {
        add(F, G.cone(.009, Math.abs(x) > .03 ? .045 : .024, 4), tooth, x, -.082, .178).rotation.x = Math.PI;
        add(F, G.cone(.008, Math.abs(x) > .03 ? .035 : .02, 4), tooth, x * .9, -.116, .175);
    }
}
function tongue(add, grp, F, b, mouthY, mouthZ) {
    const m = mat(b.tongue, { roughness: .45 }), segs = [];
    let p = grp(F, 0, mouthY, mouthZ);
    for (let i = 0; i < 6; i++) {
        const g = i ? grp(p, 0, 0, .075) : p;
        add(g, G.sph(.042 * (1 - i * .09), 8, 6), m, 0, 0, .04).scale.set(1.25, .4, 1.9);
        segs.push(g); p = g;
    }
    return segs;
}
function spikes(add, J, b, D) {
    const m = mat(b.horn ? [].concat(b.horn)[0].color : 0x1a1414, { roughness: .5 }), lvl = b.spikes;
    for (const [s, side] of [['l', 1], ['r', -1]]) {
        for (let i = 0; i < (lvl > 1 ? 2 : 1); i++) {
            const c = add(J[s + 'Sh'], G.cone(.035, .16 - i * .04, 6), m, .05 * side - i * .03 * side, .07, -.02 - i * .05);
            c.rotation.z = -.6 * side; c.rotation.x = -.3 * i;
        }
        const n = lvl > 1 ? 3 : lvl > 0 ? 1 : 0;
        for (let i = 0; i < n; i++) add(J[s + 'El'], G.cone(.022, .11, 5), m, .02 * side, -.05 - i * .06, -.05).rotation.x = -1.9;
        if (lvl > 2) add(J[s + 'Knee'], G.cone(.03, .12, 5), m, 0, -.02, .07).rotation.x = 1.2;
    }
    if (lvl > 1) for (let i = 0; i < (lvl > 2 ? 5 : 3); i++) {                    // back spikes fold flat when lying
        const c = add(J.spine, G.cone(.03, .13, 5), m, 0, .4 - i * .09, -D.chestR * .74 - .02);
        c.rotation.x = -1.9; c.userData.fold = true;
    }
}
function furTufts(add, J, b, D) {
    const m = coatMat(b, b.fur);
    for (const [s, side] of [['l', 1], ['r', -1]]) {
        for (let i = 0; i < 3; i++) add(J[s + 'Sh'], G.cone(.05, .16, 5), m, .04 * side, .06 - i * .04, -.03 - i * .02).rotation.set(-.5 - i * .3, 0, -.7 * side);
        for (let i = 0; i < 2; i++) add(J[s + 'El'], G.cone(.035, .12, 5), m, .02 * side, -.05 - i * .07, -.04).rotation.x = -2.2;
    }
    for (let i = 0; i < 6; i++) add(J.spine, G.cone(.06, .2, 5), m, (i % 3 - 1) * .09, .5 - (i / 3 | 0) * .1, -D.chestR * .6).rotation.x = -2.3;
}
function pustules(add, J, b, D) {
    const m = mat(b.pustules, { roughness: .4 }), r = rng(7);
    for (let i = 0; i < 16; i++) {
        const a = (r() - .5) * 4.4, y = .05 + r() * .4, rad = (b.paunch ? .3 * b.paunch : D.chestR) * .98;
        add(J.spine, G.sph(.02 + r() * .02, 6, 5), m, Math.sin(a) * rad, y * (b.paunch && y < .3 ? .9 : 1), Math.cos(a) * rad * .85 + (b.paunch ? .1 : 0));
    }
}
function extraArms(add, grp, J, b, D, skin) {
    const k = (b.limb || 1) * .9, B = buildOf(b);
    for (const side of [1, -1]) {
        const s = side === 1 ? 'l2' : 'r2';
        const sh = grp(J.spine, (D.shoulderX - .02) * side, .2, .03, 'XZY');
        const el = grp(sh, 0, -.26, 0), hand = grp(el, 0, -.25, 0);
        J[s + 'Sh'] = sh; J[s + 'El'] = el; J[s + 'Hand'] = hand;
        add(sh, G.sph(B.delt * k * .9, 10, 8), skin);
        add(sh, limbGeo(b.build + 'ua2' + k, .3, scaleKeys(B.arm, k), .03), skin);
        add(el, G.sph(B.fore[0][1] * k, 8, 6), skin);
        add(el, limbGeo(b.build + 'fa2' + k, .25, scaleKeys(B.fore, k), .015, 1.08), skin);
        sculptHand(add, hand, b, skin, side, Math.sqrt(k));
    }
}
function smokeTendrils(add, grp, J, b, D) {
    const S = b.smoke, m = mat(S.color, { roughness: 1 }), tipM = S.tip ? mat(S.tip, { emissive: S.tip, emissiveIntensity: 1.2 }) : null;
    const r = rng(S.n * 13), list = [];
    if (!S.head) for (const [x, y, sc] of [[-.12, .44, 1], [.13, .4, .9], [0, .3, 1.1]]) {             // smoke clumps on the back
        add(J.spine, G.sph(.13 * sc, 8, 6), m, x, y, -D.chestR * .6).scale.set(1.2, .8, .7);
    }
    for (let i = 0; i < S.n; i++) {
        const onHead = S.head && (S.hang || i % 2 === 0), onArm = !S.head && i % 3 === 2;
        const side = i % 2 ? 1 : -1, x = side * (.06 + r() * .2), c = (r() - .5) * .3;
        let pv, pts, r0;
        if (onArm) {                                                   // wisps hanging from the forearms
            pv = grp(J[side > 0 ? 'lEl' : 'rEl'], .03 * side, -.06 - r() * .1, -.04);
            const l = .35 + r() * .25;
            pts = [[0, 0, 0], [x * .2, -l * .3, -l * .25], [x * .4 + c * .5, -l * .65, -l * .35], [x * .5 + c, -l, -l * .2]];
            r0 = .045;
            pv.userData.bx = .2; pv.userData.bz = 0;
        } else if (S.hang) {                                           // tentacle hair hanging around the head
            const a = (i / S.n - .5) * 4.4, l = .45 + r() * .3;
            pv = grp(J.face, Math.sin(a) * .15, .1 - Math.abs(Math.sin(a)) * .04, Math.cos(a) * .13 - .05);
            pts = [[0, 0, 0], [Math.sin(a) * .08, -l * .25, Math.cos(a) * .04 - .03], [Math.sin(a) * .12 + c * .3, -l * .6, -.06], [Math.sin(a) * .1 + c, -l, -.04]];
            r0 = .028;
            pv.userData.bx = .1; pv.userData.bz = Math.sin(a) * .25;
        } else {
            pv = onHead ? grp(J.face, x * .6, .12, -.08) : grp(J.spine, x * .7, .32 + r() * .14, -D.chestR * .62);
            pv.userData.back = !onHead;
            const l = (onHead ? .4 : .6) + r() * .4;
            pts = [[0, 0, 0], [x * .4, l * .3, -l * .18], [x * 1.1 + c, l * .62, -l * .26], [x * 1.9 + c, l, -l * .1]];
            r0 = onHead ? .035 : .08;
            pv.userData.bx = onHead ? -.4 : -.25 - r() * .3;
            pv.userData.bz = side * (.1 + r() * .3);
        }
        add(pv, taperTube(pts, r0, .005, 10, 6), m);
        if (tipM) add(pv, G.sph(.022, 6, 4), tipM, ...pts[3]);
        pv.userData.seed = r() * 10;
        list.push(pv);
    }
    return list;
}
function shadowHead(add, grp, J, b) {
    const m = mat(b.shadowHead, { roughness: 1 }), g = grp(J.spine, 0, .98, -.3);
    add(g, G.sph(.24, 12, 9), m).scale.set(1, 1.1, .9);
    add(g, G.sph(.3, 12, 8), m, 0, -.3, -.05).scale.set(1.5, .8, .7);                        // shoulders of the shadow
    for (const s of [1, -1]) {
        add(g, G.sph(.03, 6, 5), glowMat(0xff2010), .08 * s, .02, .2);
        const h = add(g, hornGeo(.42, .06, .9, .25, .4), m, .14 * s, .16, 0);
        if (s < 0) h.scale.x = -1;
    }
    return g;
}
function finsOf(add, J, b) {
    const m = mat(b.fins, { side: THREE.DoubleSide, roughness: .5 });
    for (const [s, side] of [['l', 1], ['r', -1]]) {
        const f = add(J[s + 'El'], flatShape('armfin', [[0, 0], [0, -.2], [-.12, -.05]]), m, .03 * side, -.02, -.04);
        f.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++) {                                                            // crest
        const c = add(J.face, G.cone(.02, .2 - Math.abs(i - 2) * .03, 4), m, (i - 2) * .05, .19, -.03 - Math.abs(i - 2) * .02);
        c.rotation.z = -(i - 2) * .3; c.scale.z = .3;
    }
}

// Beetle body (ubeg): two pairs of jointed insect legs from the hips down to the ground, a segmented abdomen behind.
function insectLegs(add, grp, J, b) {
    const m = patternMat('chitin', b.skin, b.texColor, null), dark = mat(shadeHex(b.skin, .5), { roughness: .35 }), list = [];
    const h = .92 - .78 * (1 - (b.leg || 1));                         // hip height above the ground
    for (let i = 0; i < 2; i++) {
        for (const side of [1, -1]) {
            const g = grp(J.pelvis, side * .16, .0, i ? -.12 : .06);
            const knee = [side * .3, .14, i ? -.12 : .1], foot = [side * .46, -h + .03, i ? -.34 : .3];
            limbTo(add, g, [0, 0, 0], knee, [[0, .045, 0, 0], [.5, .04, 0, 0], [1, .03, 0, 0]], 'ilf', m);
            add(g, G.sph(.032, 8, 6), dark, ...knee);
            limbTo(add, g, knee, foot, [[0, .036, 0, 0], [.6, .027, 0, 0], [1, .01, 0, 0]], 'ilt' + i + h, m);
            for (let k = 1; k < 4; k++) {                               // spines along the shin
                const q = k / 4, c = add(g, G.cone(.008, .05, 4), dark, knee[0] + (foot[0] - knee[0]) * q, knee[1] + (foot[1] - knee[1]) * q, knee[2] + (foot[2] - knee[2]) * q);
                c.rotation.z = side * 1.2;
            }
            g.userData.side = side; g.userData.i = i; g.userData.h = h;
            list.push(g);
        }
    }
    const ab = grp(J.pelvis, 0, -.04, -.12);                          // abdomen segments behind the hips (folded down when lying)
    for (let i = 0; i < 4; i++) {
        const r = .2 - i * .035;
        add(ab, G.sph(r, 14, 9), m, 0, -i * .06, -.08 - i * .12).scale.set(1.15, .7, .75);
    }
    list.abdomen = ab;
    return list;
}

// Everything else of the body → parts state for animateBeast (null for a plain body).
const HEAD_K = { muscle: .8, fat: .8, lean: .86, female: .88, animal: .94 };
export function buildBeast(add, grp, J, b, D, skin, B = {}) {
    const F = J.face;
    J.head.scale.setScalar(b.headK ?? HEAD_K[b.head && b.head !== 'skull' ? 'animal' : b.build || (b.female ? 'female' : 'muscle')]);   // monsters: smaller heads on big bodies
    B.wings = []; B.insect = false;
    if (b.hair) beastHair(add, J, b);
    if (b.horn && b.head !== 'none') horns(add, F, b);
    if (b.fangs && !b.head && !b.maw) fangs(add, F);
    if (b.eyesN) {
        for (let i = 0; i < b.eyesN; i++) {
            const eye = grp(F, (i - (b.eyesN - 1) / 2) * .07, .1, .175);
            add(eye, G.sph(.03, 8, 6), mat(b.eyeWhite, { roughness: .4 }));
            add(eye, G.sph(.017, 6, 5), mat(b.eye, { roughness: .3 }), 0, 0, .022);
            J.eyes.push(eye);
        }
    }
    if (b.tongue) B.tongue = b.maw ? tongue(add, grp, B.bjaw, b, -.02, .06) : tongue(add, grp, F, b, -.1, b.head ? .2 : .16);
    if (b.paunch && b.build !== 'fat') {
        const pm = b.paunchColor ? mat(b.paunchColor) : skin, P = b.paunch;
        add(J.spine, G.sph(.27 * P, 14, 10), pm, 0, .12, .07 * P).scale.set(1.05, .95, .92);
        add(J.spine, G.sph(.02, 6, 4), mat(0x3a2020), 0, .1, .07 * P + .245 * P);           // navel
    }
    if (b.paunchWound) {
        add(J.spine, G.sph(.14, 10, 8), mat(0x6a1410, { roughness: .5 }), 0, .16, D.chestR * .62).scale.set(1, 1.2, .35);
        for (let i = 0; i < 3; i++) add(J.spine, G.torus(.09, .012, 4, 10, 2.4), mat(0xc8c0a0), 0, .26 - i * .055, D.chestR * .66).rotation.z = Math.PI / 2 - 1.2;
    }
    if (b.pustules) pustules(add, J, b, D);
    if (b.extraArms) extraArms(add, grp, J, b, D, skin);
    if (b.spikes) spikes(add, J, b, D);
    if (b.fur) furTufts(add, J, b, D);
    if (b.tail && b.tail !== true) { beastTail(add, grp, J, b, skin); B.tail = J.tail; B.tailK = 0; }
    if (b.legs === 'fish') B.fish = fishTail(add, grp, J, b);
    if (b.wings) {
        const w = b.wings;
        for (const side of [1, -1]) B.wings.push(w.kind === 'insect' ? insectWing(add, grp, J.spine, side, w) : humanWing(add, grp, J.spine, side, w));
        B.insect = w.kind === 'insect';
        B.wingOpen = .5; B.wingFlap = 0; B.wingSweep = 0; B.wingTilt = .25;
    }
    if (b.smoke) B.smoke = smokeTendrils(add, grp, J, b, D);
    if (b.shadowHead) B.shadow = shadowHead(add, grp, J, b);
    if (b.fins) finsOf(add, J, b);
    if (b.carapace) {
        const m = mat(b.carapace, { roughness: .3, metalness: .15 });
        for (const s of [1, -1]) {
            const e = add(J.spine, G.sph(.24, 12, 9, 0, TAU, 0, Math.PI / 2), m, .1 * s, .25, -D.chestR * .55);
            e.rotation.set(-Math.PI / 2 - .12, 0, -.1 * s); e.scale.set(.5, .45, 1.3);
        }
    }
    B.skirts = []; B.folds = []; B.flats = [];
    B.hornTilt = Math.min(.6, Math.max(b.head === 'bull' ? .4 : 0, ...[].concat(b.horn || []).map(h => (h.len || 0) * 1.1)));
    if (b.lingerie) lingerie(add, J, b);
    if (b.armour) armour(add, J, b);
    if (b.robe) robe(add, J, b);
    if (b.tunic) tunic(add, J, b);
    if (b.insectLegs) { B.ilegs = insectLegs(add, grp, J, b); B.abdomen = B.ilegs.abdomen; }
    if (b.collar) add(J.spine, G.cyl(.17, .14, .2, 12, true), clothMat(b.collar), 0, .52, -.01).scale.z = .85;
    if (b.shroud) add(skirtGroup(J, .61, .26), G.cyl(.21, .3, .62, 14, true), clothMat(b.shroud), 0, -.3, 0).scale.z = .82;
    if (b.skirt) add(skirtGroup(J, .27, .23 * (b.bulk || 1)), G.cyl(.2 * (b.bulk || 1), .27 * (b.bulk || 1), .3, 10, true), clothMat(b.skirt), 0, -.12, 0).scale.z = .82;
    if (b.silverback) {
        const sb = add(J.spine, G.sph(D.chestR * .9, 12, 8), patternMat('fur', b.silverback, shadeHex(b.silverback, .6)), 0, .2, -D.chestR * .5);
        sb.scale.set(.95, 1.1, .6); sb.userData.flat = .6;
    }
    for (const c of J.pelvis.children) if (c.userData.skirt) B.skirts.push(c);
    for (const c of J.spine.children) if (c.userData.fold) B.folds.push(c);
    for (const c of [...J.face.children, ...J.spine.children]) if (c.userData.flat) { c.userData.sz = c.scale.z; B.flats.push(c); }
    return B;
}

// ------------------------------------------------------------------ animation
// Pelvis height above the avatar's ground and the world-up components of its y / z axes (avatar units, no allocation).
const GF = { y: 0, a: 1, c: 0 };
function groundFrame(av) {
    av.j.pelvis.updateWorldMatrix(true, false);
    const r = av.root.matrixWorld.elements, p = av.j.pelvis.matrixWorld.elements, s = Math.hypot(r[4], r[5], r[6]) || 1;
    GF.y = (p[13] - r[13]) / s; GF.a = p[5] / s; GF.c = p[9] / s;
    return GF;
}
const WING_POSE = {                                                    // open, flap, sweep
    walk: [.12, .04, 0], kneel: [.08, 0, 0], hit: [.8, -.35, 0], lie: [1, -.62, 0], death: [1, -.62, 0]
};
export function animateBeast(av, state, c, dt) {
    const B = av.beast;
    if (!B) return;
    const J = av.j, P = av.pose, t = av.time + av.offset;
    const p = state === 'attack' ? 1 - c.actionTime / Math.max(c.actionDuration, .001) : 0;
    const k = 1 - Math.exp(-7 * dt), kf = 1 - Math.exp(-18 * dt);
    const lying = state === 'lie' || state === 'death';
    const flat = Math.min(1, Math.abs(P.bodyRX) / (Math.PI / 2));   // 1 when lying on the back

    if (B.wings.length) {
        let open, flap, sweep = 0;
        if (B.insect) {
            open = lying ? 1.67 : state === 'kneel' ? 0 : 1;              // flat on the ground when lying
            flap = open ? Math.sin(t * 31) * (state === 'idle' ? .5 : .35) : 0;
        } else if (state === 'attack') {
            open = 1; sweep = -.15;
            flap = p < .36 ? .2 + .6 * (p / .36) : p < .56 ? .8 - 1.3 * ((p - .36) / .2) : -.5 + .7 * ((p - .56) / .44);
        } else if (state === 'defend') { open = 1; flap = .3 + Math.sin(t * 3) * .05; sweep = -.4; }
        else if (state === 'run') { open = .3; flap = .1 + Math.sin(av.phase) * .25; }
        else if (WING_POSE[state]) [open, flap, sweep] = WING_POSE[state];
        else { open = .55 + Math.sin(t * 1.3) * .06; flap = .15 * Math.sin(t * 1.3); }
        B.wingOpen += (open - B.wingOpen) * k;
        B.wingFlap += (flap - B.wingFlap) * (B.insect ? 1 : kf);
        B.wingSweep += (sweep - B.wingSweep) * k;
        B.wingTilt += ((lying ? 0 : .25) - B.wingTilt) * k;
        for (const w of B.wings) w.set(B.wingOpen, B.wingFlap, B.wingSweep, B.wingTilt);
    }

    const gf = B.fish || B.skirts.length || B.ilegs ? groundFrame(av) : null;
    if (B.fish) {                                                    // tail down to the ground, then along it; straight when lying
        const h = av.hipY + P.hipsY * av.legK + P.bodyY;
        const R = .28, s0 = (h - .14 - R) * (1 - flat), arc = Math.PI / 2 * R;
        const moving = state === 'walk' || state === 'run';
        const amp = moving ? (state === 'run' ? .32 : .22) : lying ? .05 : .08;
        const ph = moving ? av.phase * 1.5 : t * 1.4;
        const Rr = Math.hypot(gf.a, gf.c) || 1, d = Math.atan2(gf.c, gf.a);
        let prev = 0, y = gf.y - .08 * gf.a;
        B.fish.forEach((g, i) => {
            const n = B.fish.length - 1, len = i < n ? FISH_L : .32;
            let A = (Math.PI / 2) * clamp01(((i + .5) * FISH_L - s0) / arc) * (1 - flat) + (i >= n - 1 ? (.22 + Math.sin(t * 1.7) * .1) * (1 - flat) : 0);
            const need = ((i < n ? .175 * (1 - (i + 1) / FISH_N * .78) * .82 : .01) + .005 - y) / len;   // lowest slope that stays above the ground
            if (-Rr * Math.cos(A - d) < need) {
                const w = Math.acos(Math.max(-1, Math.min(1, -need / Rr)));
                A = d + (A - d >= 0 ? w : -w);
            }
            y -= len * Rr * Math.cos(A - d);
            g.rotation.x = A - prev;
            prev = A;
            g.rotation.z = Math.sin(ph - i * .8) * amp * (i / n) * (i > 2 || flat > .5 ? 1 : .3);
        });
    }

    if (B.tail) {                                                    // lifted when kneeling, laid out sideways on the ground when lying
        B.tailK += ((state === 'kneel' ? 1 : 0) - B.tailK) * k;
        B.tail.forEach((g, i) => {
            const rx = g.userData.rx, kneel = i ? rx : Math.max(rx, -.05);
            g.rotation.x = lerp(lerp(rx, kneel, B.tailK), 0, flat);       // lying: straight out to the side, a little raised
            g.rotation.y = lerp(g.rotation.y, i ? 0 : 1.8, Math.min(1, flat * 2.5));
        });
    }

    if (B.hornTilt) J.head.rotation.x += B.hornTilt * flat;         // big horns: chin tucked when lying on the back
    if (B.hornTilt || B.flats.length) J.head.rotation.y *= 1 - .7 * flat;   // and the head barely turned (horns, long hair)
    for (const f of B.folds) f.scale.setScalar(1 - .8 * flat);       // back spikes fold, long hair flattens
    for (const f of B.flats) { f.scale.z = f.userData.sz * (1 - f.userData.flat * flat); if (f.parent === J.face) f.scale.x = 1 - .2 * flat; }
    if (B.abdomen) B.abdomen.rotation.x = -1.3 * flat;
    if (B.skirts.length) {                                           // skirts never reach below the ground
        const avail = gf.y - .015, uy = Math.max(0, gf.a), uz = Math.abs(gf.c);
        for (const g of B.skirts) {
            const [len, zr] = g.userData.skirt, f = Math.min(1, Math.max(.12, avail / (len * uy + zr * uz + 1e-3)));
            g.scale.set(1, f, lerp(1, f, uz));
        }
    }

    if (B.tongue) {
        const lash = state === 'attack' ? Math.max(0, Math.sin(clamp01((p - .3) / .4) * Math.PI)) : 0;
        const sway = Math.sin(t * (state === 'walk' || state === 'run' ? 6 : 1.6));
        B.tongue.forEach((g, i) => {
            const want = i === 0 ? lerp(1.15, .05, lash) : lerp(.16 + sway * .06, -.02, lash);
            g.rotation.x += (want - g.rotation.x) * kf;
            g.rotation.y = sway * .12 * (1 - lash);
        });
        B.tongue[0].scale.z = 1 + lash * .9;
    }

    if (B.bjaw) {                                                    // animal jaw: snarl, bite, hang open
        const maw = av.body.maw ? .22 : 0;                           // a monster maw hangs half open
        const want = state === 'attack' ? (p > .25 && p < .62 ? .55 + maw * 1.5 : .08 + maw) : state === 'defend' ? .3 + maw + Math.sin(t * 9) * .04
            : state === 'hit' ? .4 + maw : lying ? (state === 'death' ? .45 : .06) : state === 'run' ? .22 + maw : .05 + maw + Math.max(0, Math.sin(t * .7)) * .05;
        B.bjaw.rotation.x += (want - B.bjaw.rotation.x) * kf;
    }
    if (B.mandibles) {
        const open = state === 'attack' ? (p < .4 ? .55 : p < .55 ? -.12 : .1) : state === 'defend' ? .45 : .1 + Math.abs(Math.sin(t * 3)) * .08;
        B.mandibles.forEach((m, i) => { const s = i ? -1 : 1; m.rotation.y += (s * open - m.rotation.y) * kf; });
        B.antennae.forEach((a, i) => {
            a.rotation.x = Math.sin(t * 2.1 + i) * .2 - (state === 'defend' ? .4 : 0);
            a.rotation.z = Math.sin(t * 1.3 + i * 2) * .15;
        });
    }
    if (B.ilegs) {                                                   // beetle legs: tripod gait while moving, twitching at rest
        const moving = state === 'walk' || state === 'run';
        B.ilegs.forEach(g => {
            const u = g.userData, ph = (moving ? av.phase * 1.5 : t * 2) + (u.i ? Math.PI : 0) + (u.side > 0 ? 0 : Math.PI);
            const a = moving ? .32 : lying ? .05 : .04;
            g.rotation.y = Math.sin(ph) * a * u.side;
            g.rotation.z = (moving ? Math.max(0, Math.cos(ph)) * .18 : 0) * u.side + (state === 'defend' ? .2 * u.side : 0);
            g.rotation.x = -.6 * flat; g.scale.z = 1 - .7 * flat;    // lying on the back: legs drawn in, up in the air
            g.scale.y = Math.min(1, Math.max(.3, (gf.y - .01) / (u.h - .02)) + flat);   // knees spread when the body sinks
        });
    }
    if (B.smoke) {
        const lean = state === 'run' ? -.5 : state === 'walk' ? -.25 : 0, size = lying ? .55 : state === 'attack' || state === 'defend' ? 1.25 : 1;
        B.smoke.forEach(pv => {
            const u = pv.userData;
            pv.rotation.x = lerp(u.bx + lean, u.back ? 1.1 : u.bx - .5, flat) + Math.sin(t * 1.1 + u.seed) * .22;
            pv.rotation.z = u.bz + Math.sin(t * 1.5 + u.seed * 2) * .25;
            pv.scale.setScalar(pv.scale.x + (size - pv.scale.x) * k);
        });
    }
    if (B.shadow) {
        B.shadow.position.y = .98 + Math.sin(t * 1.2) * .04;
        B.shadow.position.z = lerp(-.3, .3, flat);                   // rises above the body lying on its back
        B.shadow.rotation.y = Math.sin(t * .5) * .3;
        const s = state === 'attack' ? 1.2 : lying ? .4 : 1;
        B.shadow.scale.setScalar(B.shadow.scale.x + (s - B.shadow.scale.x) * k);
    }
    if (J.l2Sh) {                                                    // second pair of arms follows the first a little lower and wider
        J.l2Sh.rotation.set(P.lShX * .75 - .15, P.lShY * .5, P.lShZ + .35);
        J.r2Sh.rotation.set(P.rShX * .75 - .15 + (state === 'attack' ? Math.sin(p * Math.PI) * -.6 : 0), P.rShY * .5, P.rShZ - .35);
        J.l2El.rotation.x = P.lElX - .35;
        J.r2El.rotation.x = P.rElX - .35;
    }
}
