import * as THREE from 'three';
import { G, TAU, mat } from './kit.js';

/*
 * Sculpted flesh of the bestiary monster bodies (avatar/beastBodies.js): smooth parametric surfaces instead of the
 * cylinders of the plain body, on the same joints of the shared ProceduralAvatar rig.
 *
 *   build (body.build)  'muscle'  broad V-shaped torso, pecs, abs, biceps, quads, calves (demons, beast men)
 *                       'female'  narrow waist, wide hips, slim limbs (succubi, fairy, mermaid)
 *                       'fat'     huge round belly and moobs, thick limbs (demons of gluttony; body.paunch sizes it)
 *                       'lean'    gaunt: sunken belly, thin bony limbs (possessed, rotting demons)
 *   every surface is a closed tube (u around, v along) with smooth radius profiles and muscle bulges;
 *   geometries are cached per build and size, so a pack of monsters shares them.
 *
 *   sculptPelvis(add, J, b, D, skin, under)       hips, glutes and briefs (pelvis joint)
 *   sculptTorso(add, J, b, D, skin)               waist up to the neck (spine joint), breasts
 *   sculptArm(add, J, s, side, b, skin, k, A)     deltoid, upper arm, forearm, hand with fingers (claws)
 *   sculptLeg(add, J, s, side, b, skin, k, L)     thigh, shin, foot (clawed toes) – human-shaped legs
 *   sculptHand(add, parent, b, skin, side)        hand of the extra arms too
 *   limbGeo(key, len, keys, top)                  tapered tube with front / back bulges (also the goat legs)
 */

const cache = new Map();

// Catmull-Rom interpolation of keys [[x, a, b, …], …] (x ascending) → [a, b, …] at x.
export function interp(keys, x) {
    const n = keys.length;
    if (x <= keys[0][0]) return keys[0].slice(1);
    if (x >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0;
    while (x > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const t = (x - k1[0]) / (k2[0] - k1[0]), t2 = t * t, t3 = t2 * t, out = [];
    for (let j = 1; j < k1.length; j++) {
        const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
        out.push(.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3));
    }
    return out;
}

// Closed tube surface: fn(u, v, out) writes the point (u around 0..1, v along 0..1). Normals point outwards,
// the seam (u = 0 / 1) and collapsed rings (poles) get averaged normals so the surface shades smoothly.
export function surface(key, nu, nv, fn) {
    if (cache.has(key)) return cache.get(key);
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), p = [0, 0, 0];
    for (let j = 0, n = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++, n++) {
            fn(i / nu, j / nv, p);
            pos[n * 3] = p[0]; pos[n * 3 + 1] = p[1]; pos[n * 3 + 2] = p[2];
            uv[n * 2] = i / nu; uv[n * 2 + 1] = j / nv;
        }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
            idx.push(a, b, c, b, d, c);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // outwards: compare the normal of a middle vertex with the direction from its ring centre
    const nrm = g.attributes.normal.array, jm = nv >> 1, ring = jm * (nu + 1);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < nu; i++) { cx += pos[(ring + i) * 3]; cy += pos[(ring + i) * 3 + 1]; cz += pos[(ring + i) * 3 + 2]; }
    cx /= nu; cy /= nu; cz /= nu;
    const vi = ring + (nu >> 2);
    if ((pos[vi * 3] - cx) * nrm[vi * 3] + (pos[vi * 3 + 1] - cy) * nrm[vi * 3 + 1] + (pos[vi * 3 + 2] - cz) * nrm[vi * 3 + 2] < 0) {
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        g.setIndex(idx);
        g.computeVertexNormals();
    }
    const N = g.attributes.normal.array;
    const avg = list => {
        let x = 0, y = 0, z = 0;
        for (const k of list) { x += N[k * 3]; y += N[k * 3 + 1]; z += N[k * 3 + 2]; }
        const l = Math.hypot(x, y, z) || 1;
        for (const k of list) { N[k * 3] = x / l; N[k * 3 + 1] = y / l; N[k * 3 + 2] = z / l; }
    };
    for (let j = 0; j <= nv; j++) {
        const r0 = j * (nu + 1);
        let flat = true;
        for (let i = 1; i <= nu && flat; i++) {
            flat = Math.abs(pos[(r0 + i) * 3] - pos[r0 * 3]) + Math.abs(pos[(r0 + i) * 3 + 2] - pos[r0 * 3 + 2]) < 1e-5;
        }
        if (flat) avg(Array.from({ length: nu + 1 }, (_, i) => r0 + i));
        else avg([r0, r0 + nu]);
    }
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
    cache.set(key, g);
    return g;
}

const gauss = x => Math.exp(-x * x);

// ------------------------------------------------------------------ builds
// torso [y, half width, half depth, z centre] in spine space; pelvis the same in pelvis space;
// arm / forearm / thigh / shin [v (0 top .. 1 bottom), radius, front bulge, back bulge]
const BUILDS = {
    muscle: {
        torso: [[-.07, .203, .143, -.006], [-.02, .195, .136, -.003], [.04, .185, .128, 0], [.14, .2, .133, .005], [.24, .235, .143, .01], [.32, .262, .15, .012],
            [.39, .272, .138, 0], [.45, .22, .118, -.012], [.5, .12, .09, -.006], [.53, .07, .07, 0], [.545, 0, 0, 0]],
        pelvis: [[-.215, 0, 0, 0], [-.205, .07, .06, 0], [-.17, .15, .11, -.005], [-.1, .195, .14, -.012], [-.02, .2, .14, -.006],
            [.03, .18, .125, 0], [.09, .14, .1, 0], [.14, 0, 0, 0]],
        pec: .032, pecY: .335, pecX: .095, abs: .009, groove: .012, belly: 0,
        arm: [[0, .086, 0, 0], [.25, .068, .022, .017], [.55, .065, .017, .012], [.85, .055, .004, .004], [1, .052, 0, 0]],
        fore: [[0, .056, 0, 0], [.2, .064, .006, .012], [.5, .056, .002, .006], [.9, .04, 0, 0], [1, .04, 0, 0]],
        thigh: [[0, .112, 0, 0], [.25, .1, .022, .013], [.6, .088, .014, .006], [.9, .068, .005, 0], [1, .066, 0, 0]],
        shin: [[0, .066, 0, 0], [.12, .064, .004, .012], [.32, .061, .002, .026], [.6, .05, 0, .008], [.9, .042, 0, 0], [1, .042, 0, 0]],
        delt: .088, hand: 1.15, foot: 1.12
    },
    female: {
        torso: [[-.07, .208, .13, -.006], [-.02, .18, .118, -.003], [.05, .148, .108, 0], [.16, .163, .113, 0], [.28, .19, .122, .004], [.37, .208, .118, 0],
            [.44, .175, .1, -.01], [.5, .1, .075, -.004], [.53, .058, .058, 0], [.545, 0, 0, 0]],
        pelvis: [[-.215, 0, 0, 0], [-.2, .075, .06, 0], [-.16, .17, .112, -.008], [-.09, .215, .138, -.016], [-.01, .205, .127, -.006],
            [.03, .17, .11, 0], [.08, .12, .085, 0], [.14, 0, 0, 0]],
        pec: 0, pecY: .3, pecX: .09, abs: 0, groove: .008, belly: 0,
        arm: [[0, .07, 0, 0], [.3, .056, .005, .005], [.9, .044, 0, 0], [1, .042, 0, 0]],
        fore: [[0, .045, 0, 0], [.25, .048, 0, .004], [.9, .032, 0, 0], [1, .031, 0, 0]],
        thigh: [[0, .108, 0, 0], [.3, .09, .006, .009], [.9, .056, 0, 0], [1, .054, 0, 0]],
        shin: [[0, .054, 0, 0], [.3, .052, 0, .015], [.9, .033, 0, 0], [1, .033, 0, 0]],
        delt: .066, hand: .85, foot: .86
    },
    fat: {
        torso: [[-.07, .24, .2, .05], [0, .27, .26, .09], [.1, .285, .275, .095], [.2, .28, .24, .06], [.3, .27, .19, .025],
            [.4, .28, .16, 0], [.46, .22, .13, -.01], [.51, .12, .1, 0], [.54, .07, .07, 0], [.555, 0, 0, 0]],
        pelvis: [[-.215, 0, 0, 0], [-.2, .08, .07, 0], [-.16, .19, .15, 0], [-.08, .25, .2, .02], [0, .27, .23, .04],
            [.08, .26, .22, .05], [.14, .24, .2, .04], [.15, 0, 0, .04]],
        pec: .045, pecY: .3, pecX: .12, abs: 0, groove: .01, belly: .02,
        arm: [[0, .1, 0, 0], [.3, .095, .012, .03], [.8, .075, 0, .01], [1, .066, 0, 0]],
        fore: [[0, .068, 0, 0], [.3, .072, 0, .012], [.9, .052, 0, 0], [1, .05, 0, 0]],
        thigh: [[0, .15, 0, 0], [.3, .135, .02, .022], [.85, .092, 0, 0], [1, .086, 0, 0]],
        shin: [[0, .086, 0, 0], [.3, .088, 0, .02], [.9, .062, 0, 0], [1, .06, 0, 0]],
        delt: .096, hand: 1.15, foot: 1.2
    },
    lean: {
        torso: [[-.07, .173, .118, -.005], [-.02, .16, .105, -.008], [.05, .148, .092, -.012], [.16, .168, .108, 0], [.27, .212, .128, .006], [.36, .232, .122, 0],
            [.43, .198, .1, -.01], [.5, .1, .075, -.004], [.53, .06, .06, 0], [.545, 0, 0, 0]],
        pelvis: [[-.215, 0, 0, 0], [-.205, .065, .055, 0], [-.17, .135, .1, -.005], [-.1, .17, .12, -.01], [-.02, .17, .115, -.005],
            [.03, .15, .1, -.008], [.09, .12, .08, -.008], [.14, 0, 0, 0]],
        pec: .01, pecY: .33, pecX: .09, abs: 0, groove: .014, belly: -.018,
        arm: [[0, .062, 0, 0], [.3, .046, .004, .003], [.85, .036, 0, 0], [1, .04, 0, 0]],
        fore: [[0, .041, 0, 0], [.25, .043, 0, .004], [.9, .028, 0, 0], [1, .028, 0, 0]],
        thigh: [[0, .085, 0, 0], [.3, .066, .006, .004], [.88, .046, 0, 0], [1, .05, 0, 0]],
        shin: [[0, .05, 0, 0], [.3, .043, 0, .009], [.9, .03, 0, 0], [1, .03, 0, 0]],
        delt: .06, hand: 1.05, foot: 1
    }
};
export const buildOf = b => BUILDS[b.build || (b.female ? 'female' : 'muscle')];

// Point of the torso / pelvis surface at height y, angle a (0 = front), pushed out by pad; muscle bumps of the build.
function trunkPoint(T, y, a, pad, o) {
    const { keys, B, sx, sz, belly, pelvis } = T, sa = Math.sin(a), ca = Math.cos(a);
    const [w, d, zc] = interp(keys, y);
    let x = w * sa, z = zc + d * ca, dd = pad;
    const front = Math.max(0, ca), back = Math.max(0, -ca);
    if (!pelvis) {
        dd += B.pec * Math.pow(front, 1.5) * gauss((Math.abs(x) - B.pecX) / .075) * gauss((y - B.pecY) / .06);
        if (B.abs) dd += B.abs * Math.pow(front, 4) * gauss((y - .14) / .09) * (.5 + .5 * Math.cos((y - .14) * TAU / .075)) * gauss(x / .06);
        dd -= B.groove * Math.pow(back, 10) * gauss((y - .25) / .18);
        dd += (B.belly + belly) * Math.pow(front, 1.5) * gauss((y - .08) / .13) * gauss(x / .3);
    } else {
        dd += .018 * Math.pow(back, 2) * gauss((y + .1) / .06) * gauss((Math.abs(x) - .08) / .07);        // glutes
        dd += belly * .6 * Math.pow(front, 2) * gauss((y - .08) / .08) * gauss(x / .2);                      // belly over the belt
    }
    if (w > 0) { x += sa * dd; z += ca * dd; }
    o[0] = x * sx; o[1] = y; o[2] = z * sz;
}
// Torso ('t') or pelvis ('p') shape of a body.
export function trunkOf(b, which) {
    const B = buildOf(b), bulk = b.bulk || 1, P = b.build === 'fat' ? (b.paunch || 1) : 1, t = which === 't';
    return {
        key: (b.build || '') + which + (b.female ? 'f' : '') + bulk + P, keys: t ? B.torso : B.pelvis, B, pelvis: !t,
        sx: bulk * (P > 1 ? (t ? .85 + .15 * P : .8 + .2 * P) : 1), sz: bulk * (P > 1 ? .8 + .2 * P : 1),
        belly: P > 1 ? (P - 1) * (t ? .06 : .2) : 0
    };
}
// Surface of a trunk between heights y0 .. y1 (whole trunk by default), pad outwards (clothes, armour).
export function trunkGeo(T, y0 = T.keys[0][0], y1 = T.keys[T.keys.length - 1][0], pad = 0, nu = 24, nv = 26) {
    return surface(`trunk${T.key}${y0}${y1}${pad}${nu}`, nu, nv, (u, v, o) => trunkPoint(T, y0 + (y1 - y0) * v, Math.PI + u * TAU, pad, o));
}

// Tapered limb from y = top down to y = top - len, closed by round caps; keys [v, r, front, back]; flat < 1 flattens the sides.
export function limbGeo(key, len, keys, top = 0, flat = 1, nu = 14, nb = 12, nc = 3) {
    const nv = nb + 2 * nc;
    return surface(`limb${key}${len}${top}${flat}${nu}`, nu, nv, (u, v, o) => {
        const a = Math.PI + u * TAU, sa = Math.sin(a), ca = Math.cos(a), j = Math.round(v * nv);
        let t, ck = 1, dy = 0;
        if (j < nc) { const th = (1 - j / nc) * Math.PI / 2; t = 0; ck = Math.cos(th); dy = Math.sin(th); }
        else if (j > nb + nc) { const th = (j - nb - nc) / nc * Math.PI / 2; t = 1; ck = Math.cos(th); dy = -Math.sin(th); }
        else t = (j - nc) / nb;
        const [r, f, bk] = interp(keys, t);
        const rr = (r + f * Math.pow(Math.max(0, ca), 2) + bk * Math.pow(Math.max(0, -ca), 2)) * ck;
        o[0] = rr * sa * flat; o[1] = top - len * t + dy * r * .7; o[2] = rr * ca;
    });
}
export const scaleKeys = (keys, k) => keys.map(([v, r, f, b]) => [v, r * k, f * k, b * k]);

// ------------------------------------------------------------------ body parts
export function sculptPelvis(add, J, b, D, skin, under, hips = skin) {
    add(J.pelvis, trunkGeo(trunkOf(b, 'p')), hips);
    if (b.underwear != null && !b.noBriefs) add(J.pelvis, trunkGeo(trunkOf(b, 'p'), -.215, -.005, .008, 20, 10), under);   // briefs
}

// Copy of a torso geometry with vertex colours: skin, blending into a paler belly (fat) or chest in front.
function tintedGeo(g, key, skin, belly, fat) {
    const k = 'tint' + key + skin + belly;
    if (cache.has(k)) return cache.get(k);
    const t = g.clone(), p = t.attributes.position, n = t.attributes.normal, col = new Float32Array(p.count * 3);
    const c0 = new THREE.Color(skin), c1 = new THREE.Color(belly), c = new THREE.Color();
    const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), w = ss(.05, .55, n.getZ(i)) * (fat ? ss(.36, .26, y) : ss(.46, .36, y) * ss(-.02, .08, y));
        c.copy(c0).lerp(c1, w);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    t.setAttribute('color', new THREE.BufferAttribute(col, 3));
    cache.set(k, t);
    return t;
}

export function sculptTorso(add, J, b, D, skin) {
    const T = trunkOf(b, 't'), belly = b.build === 'fat' ? b.paunchColor : b.chest;
    if (belly != null && !b.skinTex) add(J.spine, tintedGeo(trunkGeo(T), T.key, b.skin, belly, b.build === 'fat'), mat(0xffffff, { vertexColors: true }));
    else add(J.spine, trunkGeo(T), skin);
    if (b.female) {
        const g = surface('breast', 12, 8, (u, v, o) => {          // teardrop: fuller below, lifted
            const a = u * TAU, th = v * Math.PI, r = .082 * (1 + .12 * Math.sin(th) * Math.max(0, -Math.cos(th)));
            o[0] = r * Math.sin(th) * Math.sin(a); o[1] = -r * Math.cos(th) * .92; o[2] = r * Math.sin(th) * Math.cos(a) * .78;
        });
        for (const s of [1, -1]) add(J.spine, g, skin, .082 * s * (b.bulk || 1), .3, .085).rotation.y = .25 * s;
    }
}

// Hand: palm facing the body, four fingers curling inwards, thumb in front; claws on the finger tips.
export function sculptHand(add, parent, b, skin, side, size = 1) {
    const B = buildOf(b), h = B.hand * size * (b.hand || 1);
    add(parent, G.sph(.05 * h, 10, 8), skin, 0, -.035 * h, .005).scale.set(.62, 1.15, 1.05);
    const finger = limbGeo('finger', .075, [[0, .0145, 0, 0], [.5, .012, 0, 0], [.9, .009, 0, 0], [1, .004, 0, 0]], 0, 1, 6, 4, 1);
    const clawM = b.claws ? mat(b.claws, { roughness: .35 }) : null, clawG = b.claws ? limbGeo('claw' + (b.clawLen || 1), .055 * (b.clawLen || 1),
        [[0, .011, 0, 0], [.6, .006, 0, 0], [1, .0005, 0, 0]], 0, 1, 6, 4, 1) : null;
    for (let i = 0; i < 4; i++) {
        const z = (.03 - i * .02) * h;
        const f = add(parent, finger, skin, 0, -.085 * h, z);
        f.scale.setScalar(h * (i === 3 ? .82 : 1));
        f.rotation.set(-.08 * (i - 1.5), 0, -side * .45);
        if (clawM) {
            const c = add(f, clawG, clawM, 0, -.07, 0);
            c.rotation.z = -side * .5;
        }
    }
    const th = add(parent, finger, skin, -side * .012 * h, -.045 * h, .045 * h);
    th.scale.setScalar(h * .85);
    th.rotation.set(.75, 0, -side * .35);
    if (clawM) add(th, clawG, clawM, 0, -.07, 0).rotation.z = -side * .4;
}

export function sculptArm(add, J, s, side, b, skin, k, A) {
    const B = buildOf(b), sh = J[s + 'Sh'], el = J[s + 'El'], hand = J[s + 'Hand'];
    add(sh, G.sph(B.delt * k, 12, 9), skin, .004 * side, .0, 0).scale.set(1.02, .92, 1.04);      // deltoid
    add(sh, limbGeo(b.build + 'ua' + k, .26 * A + .05, scaleKeys(B.arm, k), .03), skin);
    add(el, G.sph(interp(B.fore, 0)[0] * k * .98, 10, 8), skin);                                    // elbow
    add(el, limbGeo(b.build + 'fa' + k, .23 * A + .02, scaleKeys(B.fore, k), .015, 1.08), skin);
    sculptHand(add, hand, b, skin, side, Math.sqrt(k));
}

export function sculptLeg(add, J, s, side, b, skin, k, L) {
    const B = buildOf(b), hip = J[s + 'Hip'], knee = J[s + 'Knee'], ankle = J[s + 'Ankle'];
    add(hip, G.sph(interp(B.thigh, 0)[0] * k * .98, 12, 9), skin);
    add(hip, limbGeo(b.build + 'th' + k, .4 * L + .03, scaleKeys(B.thigh, k), .03), skin);
    add(knee, G.sph(interp(B.shin, 0)[0] * k * 1.02, 10, 8), skin, 0, 0, .004);
    add(knee, limbGeo(b.build + 'sh' + k, .38 * L, scaleKeys(B.shin, k), .02), skin);
    sculptFoot(add, ankle, b, skin, B.foot * Math.sqrt(k));
}

// Foot on the ankle joint (sole on the ground at y = -.09): instep + toes, claws for clawed bodies.
export function footGeo() {
    return surface('foot', 14, 10, (u, v, o) => {
        const a = Math.PI + u * TAU, z = -.065 + .21 * v, e = Math.pow(Math.sin(Math.PI * v), .45);
        const w = (.05 - .012 * v) * e, h = (.05 * (1 - .62 * v) + .006) * e;
        o[0] = w * Math.sin(a); o[1] = -.088 + h + h * Math.cos(a) * .98 + (1 - v) * .015 * Math.max(0, Math.cos(a)) * e; o[2] = z;
    });
}

export function sculptFoot(add, ankle, b, skin, f = 1) {
    const g = footGeo();
    const foot = add(ankle, g, skin, 0, 0, .01);
    foot.scale.set(f, 1, f);
    if (b.claws && !b.female) {
        const cm = mat(b.claws, { roughness: .35 });
        for (const x of [-.03, 0, .03]) add(ankle, G.cone(.012 * f, .05 * f, 5), cm, x * f, -.066, .15 * f + .012).rotation.x = Math.PI / 2 + .12;
    }
}

// ------------------------------------------------------------------ faces
// Sculpted head (face group, centre at its origin, ~.2 radius like the human head so hair / helmets still fit):
// brow ridge, eye sockets, cheekbones, nose, chin and a tapering jaw; per kind of face.
const FACES = {
    //        brow  socket cheek nose  noseW chin  jaw  hollow ry   ears
    demon:  [.034, .024, .016, .022, .03, .026, .82, 0, .2, 1.2],
    maw:    [.04, .026, .02, .018, .034, 0, .74, 0, .2, 1.2],
    human:  [.014, .016, .012, .024, .018, .02, .84, 0, .2, 1],
    female: [.006, .012, .01, .016, .013, .012, .76, 0, .196, 1],
    gaunt:  [.024, .03, .022, .016, .016, .016, .8, .022, .204, 1]
};
function headGeo(kind) {
    const [brow, socket, cheek, nose, noseW, chin, jaw, hollow, ry] = FACES[kind];
    return surface('head' + kind, 30, 24, (u, v, o) => {
        const a = Math.PI + u * TAU, th = Math.PI * (1 - v), st = Math.sin(th);
        let x = .165 * st * Math.sin(a), y = ry * Math.cos(th), z = .182 * st * Math.cos(a);
        if (y < .02) x *= 1 - (1 - jaw) * Math.pow((.02 - y) / (ry + .02), 1.3) * 1.6;          // jaw tapers to the chin
        if (y < -.02 && z > 0) z *= 1 + .1 * Math.min(1, (-.02 - y) / .1);                       // muzzle a little forward
        const f = Math.max(0, Math.cos(a)), ax = Math.abs(x);
        let d = brow * Math.pow(f, 2) * gauss((y - .068) / .026) * gauss(x / .13)
            - socket * Math.pow(f, 3) * gauss((y - .022) / .03) * gauss((ax - .066) / .036)
            + cheek * Math.pow(f, 1.5) * gauss((y + .02) / .035) * gauss((ax - .1) / .04)
            + nose * Math.pow(f, 8) * gauss((y + .02) / .045) * gauss(x / noseW) * Math.min(1, Math.max(0, (.05 - y) / .04))
            + chin * Math.pow(f, 4) * gauss((y + .158) / .03) * gauss(x / .045)
            - hollow * Math.pow(f, 1.5) * gauss((y + .07) / .035) * gauss((ax - .1) / .035)
            - .006 * Math.pow(f, 6) * gauss((y + .095) / .01) * gauss(x / .05);                   // mouth line
        const l = Math.hypot(x, y * .5, z) || 1;
        o[0] = x + x / l * d; o[1] = y + y * .5 / l * d; o[2] = z + z / l * d;
    });
}
export function beastFace(add, grp, J, b, skin, Bs = {}) {
    const F = J.face, kind = b.maw ? 'maw' : b.face || (b.female ? 'female' : 'demon'), ears = FACES[kind][9];
    const neckR = b.build === 'fat' ? .11 : b.build === 'female' ? .066 : b.build === 'lean' ? .068 : .088 * (b.bulk || 1);
    add(J.neck, G.cyl(neckR * .92, neckR, .17, 12), skin, 0, .045, -.005);
    add(F, headGeo(kind), skin);
    if (kind === 'female') {                                          // lips, thin brows
        add(F, G.sph(.022, 10, 6), mat(b.lips ?? 0x8a2a3a, { roughness: .4 }), 0, -.097, .158).scale.set(1.3, .36, .45);
        for (const s of [1, -1]) {
            const br = add(F, G.box(.055, .006, .01), mat(b.brow), .066 * s, .058, .166);
            br.rotation.z = -.18 * s; br.rotation.y = .25 * s;
        }
    } else if (b.maw) {                                               // huge maw: hinged lower jaw, rows of fangs, red gullet
        const tooth = mat(0xe8e0c8, { roughness: .4 }), gum = mat(0x5a0e10, { roughness: .6 });
        add(F, G.sph(.1, 12, 8), gum, 0, -.1, .1).scale.set(1.1, .62, 1);
        for (let i = 0; i < 9; i++) {
            const a = (i / 8 - .5) * 2.2, l = i === 1 || i === 7 ? .075 : .045;
            add(F, G.cone(.012, l, 5), tooth, Math.sin(a) * .1, -.1 - l / 2 + .01, .07 + Math.cos(a) * .1).rotation.x = Math.PI;
        }
        Bs.bjaw = grp(F, 0, -.085, .0);
        const jaw = surface('mawjaw', 16, 6, (u, v, o) => {          // bowl of the lower jaw, open on top
            const a = u * TAU, th = Math.PI * (.5 + .5 * v), r = .135;
            o[0] = r * Math.sin(th) * Math.sin(a) * .95; o[1] = r * Math.cos(th) * .55; o[2] = r * Math.sin(th) * Math.cos(a) * 1.3;
        });
        add(Bs.bjaw, jaw, skin, 0, -.02, .07);
        add(Bs.bjaw, G.sph(.095, 10, 6, 0, TAU, Math.PI * .5, Math.PI * .5), gum, 0, -.015, .08).scale.set(1, .5, 1.25);
        for (let i = 0; i < 9; i++) {
            const a = (i / 8 - .5) * 2.4, l = i === 1 || i === 7 ? .065 : .04;
            add(Bs.bjaw, G.cone(.011, l, 5), tooth, Math.sin(a) * .12, -.02 + l / 2, .07 + Math.cos(a) * .165);
        }
    } else if (!b.fangs) {
        add(F, G.box(.07, .01, .01), mat(shadeHex(b.skin, .45)), 0, -.096, .17);
    }
    const glow = b.glowEyes ? mat(b.glowEyes, { emissive: b.glowEyes, emissiveIntensity: 2.6, roughness: .3 }) : null;
    for (const side of [1, -1]) {
        const eye = grp(F, .064 * side, .024, .15);
        if (glow) add(eye, G.sph(.023, 10, 8), glow).scale.set(1.25, .72, .6);
        else {
            add(eye, G.sph(.024, 10, 8), mat(b.eyeWhite, { roughness: .35 })).scale.set(1.2, .82, .7);
            add(eye, G.sph(.012, 8, 6), mat(b.eye, { roughness: .3 }), 0, 0, .012);
            add(eye, G.sph(.006, 6, 4), mat(0x0a0a0c), 0, 0, .019);
        }
        if (kind === 'female') add(eye, G.box(.05, .006, .012), mat(0x0e0a0a), 0, .014, .01).rotation.z = -.15 * side;   // lashes
        eye.rotation.z = (kind === 'demon' ? .22 : .08) * side;          // slanted, angry for demons
        J.eyes.push(eye);
        if (b.ears === 'pointy') {
            const ear = add(F, G.cone(.036, .15 * ears, 5), skin, .158 * side, .02, -.01);
            ear.rotation.set(-.35, 0, -1.2 * side); ear.scale.set(1, 1, .45);
        } else {
            add(F, G.sph(.04, 8, 6), skin, .16 * side, -.005, -.005).scale.set(.4, 1, .7);
        }
    }
}
const shadeHex = (c, k) => {
    const ch = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k)));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// ------------------------------------------------------------------ hair, clothes and armour of the monster bodies
// Part of a trunk shell between the angles a0 .. a1 (0 = front), e.g. a pale belly or a breastplate.
export function trunkPatch(T, y0, y1, pad, a0, a1, nu = 12, nv = 12) {
    return surface(`patch${T.key}${y0}${y1}${pad}${a0}${a1}`, nu, nv, (u, v, o) => trunkPoint(T, y0 + (y1 - y0) * v, a0 + (a1 - a0) * u, pad, o));
}
// Limb shell from v0 to v1 of the limb keys, pushed out by pad (open ends: sleeves, stockings, vambraces).
export function limbShell(key, len, keys, top, v0, v1, pad, flat = 1, nu = 14, nv = 8) {
    return surface(`shell${key}${len}${top}${v0}${v1}${pad}${flat}`, nu, nv, (u, v, o) => {
        const a = Math.PI + u * TAU, sa = Math.sin(a), ca = Math.cos(a), t = v0 + (v1 - v0) * v;
        const [r, f, bk] = interp(keys, t);
        const rr = r + f * Math.pow(Math.max(0, ca), 2) + bk * Math.pow(Math.max(0, -ca), 2) + pad;
        o[0] = rr * sa * flat; o[1] = top - len * t; o[2] = rr * ca;
    });
}
// Canvas textures of the clothes: lace (net with flowers), cloth with seams.
const texCache = new Map();
function clothTex(kind, color) {
    const key = kind + color;
    if (texCache.has(key)) return texCache.get(key);
    let t = null;
    if (typeof document !== 'undefined') {
        const c = document.createElement('canvas'), S = 64;
        c.width = c.height = S;
        const g = c.getContext('2d'), hex = v => '#' + v.toString(16).padStart(6, '0');
        g.fillStyle = hex(color); g.fillRect(0, 0, S, S);
        if (kind === 'lace') {
            g.strokeStyle = hex(shadeHex(color, 2.6) || 0x3a3a3a); g.lineWidth = 1;
            for (let i = -S; i < S * 2; i += 8) {
                g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
                g.beginPath(); g.moveTo(i, S); g.lineTo(i + S, 0); g.stroke();
            }
            g.fillStyle = hex(shadeHex(color, 3.2) || 0x4a4a4a);
            for (const [x, y] of [[16, 16], [48, 48], [48, 16], [16, 48]]) {
                for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 4, y + Math.sin(k * 1.256) * 4, 2.4, 0, TAU); g.fill(); }
            }
        } else {
            for (let i = 0; i < 260; i++) {
                g.fillStyle = hex(shadeHex(color, .75 + ((i * 37) % 50) / 100));
                g.fillRect((i * 53) % S, (i * 29) % S, 2, 6);
            }
        }
        t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(kind === 'lace' ? 3 : 2, kind === 'lace' ? 2 : 2);
        t.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(key, t);
    return t;
}
const laceMat = c => { const t = clothTex('lace', c); return t ? mat(0xffffff, { map: t, roughness: .55 }) : mat(c, { roughness: .55 }); };
const fabricMat = (c, side = THREE.DoubleSide) => { const t = clothTex('cloth', c); return t ? mat(0xffffff, { map: t, roughness: .9, side }) : mat(c, { roughness: .9, side }); };
const metal = (c, o = {}) => mat(c, { roughness: .38, metalness: .65, ...o });

// Own hair of a monster body (the hair layers are left out for it): cap + long curtain down the back / wild locks / curls.
export function beastHair(add, J, b) {
    const H = b.hair, F = J.face, m = mat(H.color, { roughness: .75, side: THREE.DoubleSide }), len = H.len ?? .5;
    const cap = surface('haircap', 20, 8, (u, v, o) => {             // hairline high on the forehead, low on the nape
        const a = Math.PI + u * TAU, f = (1 + Math.cos(a)) / 2, th = v * Math.PI * (.62 - .3 * f * f), r = .214;
        o[0] = r * Math.sin(th) * Math.sin(a) * 1.02; o[1] = .02 + r * Math.cos(th) * 1.04; o[2] = r * Math.sin(th) * Math.cos(a) - .012;
    });
    add(F, cap, m);
    for (const s of [1, -1]) add(F, G.sph(.06, 8, 6), m, .158 * s, .07, .03).scale.set(.55, 1, .9);      // temples
    if (H.style === 'long' || H.style === 'wild') {
        const wild = H.style === 'wild' ? 1 : 0;
        const g = surface(`hair${len}${wild}`, 20, 12, (u, v, o) => {
            const span = 1.5 - .2 * v, a = Math.PI + (u - .5) * 2 * span;
            const y = .08 - (len + .1) * v + (v > .7 ? (.03 + .05 * wild) * Math.sin(a * 11) * (v - .7) / .3 : 0);
            const rx = .21 + .05 * v + .04 * wild * v, rz = .2 - .03 * v, zc = -.02 - .1 * Math.min(1, v * 1.6);
            o[0] = rx * Math.sin(a); o[1] = y; o[2] = zc + rz * Math.cos(a);
        });
        const hg = new THREE.Group();                                 // long hair: flattened by animateBeast when lying
        hg.userData.flat = .4;
        F.add(hg);
        add(hg, g, m);
        for (const s of [1, -1]) {                                    // locks falling in front of the shoulders
            const lock = surface(`lock${len}${wild}`, 6, 8, (u, v, o) => {
                const a = u * TAU, r = .045 * (1 - .6 * v);
                o[0] = r * Math.sin(a) + .02 * v; o[1] = -(len * .75) * v; o[2] = r * Math.cos(a) * .6 + .03 * v;
            });
            add(hg, lock, m, .19 * s, .0, -.03).scale.x = s;
        }
        if (wild) for (let i = 0; i < 7; i++) {
            const c = add(hg, G.cone(.04, .2, 5), m, (i - 3) * .06, .1 - Math.abs(i - 3) * .03, -.17);
            c.rotation.set(-2.1 + Math.abs(i - 3) * .1, 0, (i - 3) * .35);
        }
    } else if (H.style === 'curly') {
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * TAU, y = .1 + (i % 3) * .035;
            add(F, G.sph(.058, 8, 6), m, Math.sin(a) * .17, y, Math.cos(a) * .16 - .03);
        }
        add(F, G.sph(.19, 12, 8), m, 0, .02, -.06).scale.set(1.02, 1, .9);
    } else {
        add(F, G.sph(.2, 14, 9, Math.PI, Math.PI, Math.PI * .3, Math.PI * .4), m, 0, 0, -.012);
    }
}

// Group under the pelvis for a hanging skirt: animateBeast shortens it so it never reaches into the ground.
export function skirtGroup(J, len, zr) {
    const g = new THREE.Group();
    g.userData.skirt = [len, zr];
    J.pelvis.add(g);
    return g;
}

// Lingerie of the succubi: corset, cups, straps, choker, stockings with lace tops, sheer skirt panels.
export function lingerie(add, J, b) {
    const W = b.lingerie, m = laceMat(W.color), T = trunkOf(b, 't'), B = buildOf(b), k = b.limb || 1, L = b.leg || 1, bulk = b.bulk || 1;
    if (W.corset) add(J.spine, trunkGeo(T, -.072, .25, .009, 24, 10), m);
    const cup = surface('cup', 12, 6, (u, v, o) => {
        const a = u * TAU, th = v * Math.PI * .62, r = .088;
        o[0] = r * Math.sin(th) * Math.sin(a); o[1] = r * Math.sin(th) * Math.cos(a) * .92; o[2] = r * Math.cos(th) * .8;
    });
    for (const s of [1, -1]) {
        add(J.spine, cup, m, .082 * s * bulk, .3, .088).rotation.y = .25 * s;
        const st = add(J.spine, G.box(.012, .17, .012), mat(W.color), .1 * s * bulk, .43, .04);
        st.rotation.x = -.5;
    }
    if (W.choker !== false) add(J.neck, G.torus(.07, .012, 6, 16), m, 0, .06, 0).rotation.x = Math.PI / 2;
    if (W.stockings) {
        const sm = mat(W.color, { roughness: .42, metalness: .1 });
        for (const s of ['l', 'r']) {
            add(J[s + 'Hip'], limbShell('st' + k + L, .4 * L + .03, scaleKeys(B.thigh, k), .03, .5, 1, .005), sm);
            add(J[s + 'Hip'], limbShell('stb' + k + L, .4 * L + .03, scaleKeys(B.thigh, k), .03, .47, .56, .009), m);   // lace top
            add(J[s + 'Knee'], limbShell('ss' + k + L, .38 * L, scaleKeys(B.shin, k), .02, 0, 1, .005), sm);
            add(J[s + 'Knee'], G.sph(B.shin[0][1] * k + .006, 10, 8), sm, 0, 0, .004);
            const f = add(J[s + 'Ankle'], footGeo(), sm, 0, .004, .01);
            f.scale.set(B.foot * 1.07, 1.06, B.foot * 1.05);
        }
    }
    if (W.skirt != null) {                                           // sheer panels from the hips, open in front
        const sk = mat(W.skirt, { roughness: .6, side: THREE.DoubleSide, transparent: true, opacity: .82, depthWrite: false });
        const g = surface(`skirt${W.skirtLen || .7}`, 14, 6, (u, v, o) => {
            const a = Math.PI + (u - .5) * 4.4, r = .22 + .2 * v, y = -.02 - (W.skirtLen || .7) * v + .025 * Math.sin(a * 7) * v;
            o[0] = r * Math.sin(a) * bulk; o[1] = y; o[2] = r * Math.cos(a) * .85 * bulk - .02;
        });
        add(skirtGroup(J, (W.skirtLen || .7) + .05, .36 * bulk), g, sk).castShadow = false;
    }
}

// Armour pieces: breastplate, layered (spiked) pauldrons, vambraces, greaves, belt, tattered skirt strips.
export function armour(add, J, b) {
    const A = b.armour, m = metal(A.color), trim = metal(A.trim ?? A.color, { roughness: .3 }), B = buildOf(b), k = b.limb || 1, L = b.leg || 1;
    const T = trunkOf(b, 't');
    if (A.chest) {
        add(J.spine, trunkGeo(T, A.chestY0 ?? .02, .47, .022, 24, 12), m);
        add(J.spine, trunkPatch(T, .3, .44, .03, -.9, .9, 10, 3), trim);            // collar rim of the plate
    }
    if (A.harness) {                                                  // straps over a bare (bony) chest
        for (const s of [1, -1]) {
            const st = add(J.spine, G.box(.05, .5, .02), mat(A.harness), .02 * s, .25, .19);
            st.rotation.z = .55 * s;
        }
        add(J.spine, G.cyl(.05, .05, .02, 12), trim, 0, .25, .2).rotation.x = Math.PI / 2;
    }
    const spikeM = metal(A.trim ?? 0x8a8a8a, { roughness: .3 });
    for (const [s, side] of [['l', 1], ['r', -1]]) {
        if (A.pauldron) {
            const P = A.pauldron;
            for (let i = 0; i < 3; i++) {
                const p = add(J[s + 'Sh'], G.sph(P * (1 - i * .12), 14, 8, 0, TAU, 0, Math.PI * .5), i ? m : trim, .02 * side, .03 - i * .045, 0);
                p.rotation.z = -.35 * side - i * .12 * side; p.scale.set(1.08, .75, 1.1);
            }
            if (A.spikes) for (let i = 0; i < A.spikes; i++) {
                const c = add(J[s + 'Sh'], G.cone(.025, .14 * P / .13, 6), spikeM, (.04 + i * .035) * side, .1 - i * .02, -.03 + i * .03);
                c.rotation.z = -(.55 + i * .2) * side;
            }
        }
        if (A.vambraces) add(J[s + 'El'], limbShell('vb' + b.build + k, .23 + .02, scaleKeys(B.fore, k), .015, .3, .95, .014, 1.08), m);
        if (A.kneeGuards) add(J[s + 'Knee'], G.sph(.085, 10, 8, 0, TAU, 0, Math.PI * .6), trim, 0, .02, .03).rotation.x = Math.PI / 2;
        if (A.greaves && !b.legs) {
            add(J[s + 'Knee'], limbShell('gr' + b.build + k + L, .38 * L, scaleKeys(B.shin, k), .02, .22, .82, .014), trim);
            add(J[s + 'Knee'], G.sph(B.shin[0][1] * k + .03, 10, 8, 0, TAU, 0, Math.PI * .6), trim, 0, .02, .03).rotation.x = Math.PI / 2;
        }
    }
    if (A.belt) {
        add(J.pelvis, trunkGeo(trunkOf(b, 'p'), .02, .085, .016, 20, 2), mat(A.belt, { roughness: .6 }));
        add(J.pelvis, G.cyl(.045, .045, .02, 12), trim, 0, .052, (b.bulk || 1) * .16).rotation.x = Math.PI / 2;
    }
    if (A.skirt != null) {                                           // tattered strips (tassets) hanging from the belt
        const sm = fabricMat(A.skirt), n = 9, sg = skirtGroup(J, (A.skirtLen ?? .42) * 1.07 - .03, .2 * (b.bulk || 1));
        for (let i = 0; i < n; i++) {
            const a = (i / n - .5) * TAU + Math.PI / n * .5, len = (A.skirtLen ?? .42) * (.75 + ((i * 7) % 5) * .08);
            const strip = add(sg, G.box(.1, len, .008), sm, Math.sin(a) * .215 * (b.bulk || 1), .04 - len / 2, Math.cos(a) * .17 * (b.bulk || 1));
            strip.rotation.y = a; strip.rotation.x = .12 * Math.cos(a); strip.castShadow = false;
        }
    }
}

// Long robe of the headless: tattered skirt to the ankles (slit in front), mantle over the shoulders, sleeves, hood on the back.
export function robe(add, J, b) {
    const R = b.robe, m = fabricMat(R.color), B = buildOf(b), k = b.limb || 1, len = R.len ?? .8, bulk = b.bulk || 1;
    const g = surface(`robe${len}`, 22, 8, (u, v, o) => {
        const a = Math.PI + (u - .5) * (TAU - .5), r = .215 + .2 * v;
        const y = .02 - len * v + (v > .8 ? .05 * Math.sin(a * 9 + 1) * Math.sin(a * 4) * (v - .8) / .2 : 0);
        o[0] = r * Math.sin(a) * bulk; o[1] = y; o[2] = (r * Math.cos(a) * .85 - .01) * bulk;
    });
    add(skirtGroup(J, len, .36 * bulk), g, m).castShadow = true;
    const T = trunkOf(b, 't');
    add(J.spine, trunkGeo(T, -.07, .5, .012, 24, 12), fabricMat(R.color, THREE.FrontSide));        // tunic
    const mantle = surface('mantle', 18, 6, (u, v, o) => {                                          // cape over the shoulders
        const a = (u - .5) * TAU, r = .3 + .06 * v, y = .5 - .42 * v + (v > .6 ? .04 * Math.sin(a * 7) : 0);
        o[0] = r * Math.sin(a) * bulk * 1.05; o[1] = y; o[2] = r * Math.cos(a) * .7 * bulk - .02;
    });
    add(J.spine, mantle, m);
    for (const s of ['l', 'r']) {
        add(J[s + 'Sh'], limbShell('rs' + b.build + k, .31, scaleKeys(B.arm, k), .03, 0, .95, .014), m);
        add(J[s + 'El'], limbShell('rf' + b.build + k, .25, scaleKeys(B.fore, k), .015, 0, .8, .016, 1.08), m);
    }
    if (R.hood) {
        const h = add(J.spine, G.sph(.16, 12, 8, 0, TAU, 0, Math.PI * .6), m, 0, .5, -.13);
        h.rotation.x = -1.9; h.scale.set(1.2, 1, .8);
    }
    if (R.belt) {
        add(J.pelvis, trunkGeo(trunkOf(b, 'p'), .03, .1, .02, 20, 2), mat(R.belt, { roughness: .6 }));
        add(J.pelvis, G.box(.08, .06, .02), metal(0x8a7a5a), 0, .065, .16 * bulk);
    }
}

// Shirt of a possessed man: torso shell, short sleeves, collar (blood stains are part of its colour).
export function tunic(add, J, b) {
    const m = fabricMat(b.tunic, THREE.FrontSide), B = buildOf(b), k = b.limb || 1;
    add(J.spine, trunkGeo(trunkOf(b, 't'), -.072, .5, .012, 24, 12), m);
    add(J.pelvis, trunkGeo(trunkOf(b, 'p'), -.08, .1, .014, 20, 4), m);
    for (const s of ['l', 'r']) add(J[s + 'Sh'], limbShell('ts' + b.build + k, .31, scaleKeys(B.arm, k), .03, 0, .55, .012), m);
}
