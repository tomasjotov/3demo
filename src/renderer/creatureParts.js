import * as THREE from 'three';
import { mat } from '../avatar/kit.js';

/*
 * Parts shared by the creature rigs: tapered tubes (horns, tusks, spikes), wings (bat membrane / feathers)
 * that fold along the flank and spread, scorpion sting.
 */

const cache = new Map();
const cached = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

// Tube along points (array of [x, y, z]) tapering from r0 to r1; closed tip.
export function taperTube(points, r0, r1, seg = 12, radial = 7) {
    return cached('tt' + JSON.stringify(points) + r0 + r1 + seg + radial, () => {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
        const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
        const pos = g.attributes.position, frames = curve.computeFrenetFrames(seg, false);
        const pt = new THREE.Vector3(), v = new THREE.Vector3();
        for (let i = 0; i <= seg; i++) {
            const t = i / seg, r = r0 + (r1 - r0) * t;
            curve.getPointAt(t, pt);
            for (let j = 0; j <= radial; j++) {
                const k = i * (radial + 1) + j;
                v.fromBufferAttribute(pos, k).sub(pt).multiplyScalar(r).add(pt);
                pos.setXYZ(k, v.x, v.y, v.z);
            }
        }
        g.computeVertexNormals();
        return g;
    });
}

// Horn growing from the origin outwards along +x, bending by `up` (y) and `fwd` (z); mirror with scale.x = -1.
export function hornGeo(len, r, up = .5, fwd = .3, curl = 0) {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const ang = t * curl;                                     // curl: spiral back (ram, chimera goat)
        pts.push([len * t * (1 - .35 * Math.sin(ang)), len * (up * t * t - .05 * t) + len * .3 * (1 - Math.cos(ang)), len * fwd * t * t - len * .35 * Math.sin(ang) * t]);
    }
    return taperTube(pts, r, r * .12, 14, 7);
}

// Flat triangle (membrane panel) a-b-c, double sided.
function tri(a, b, c) {
    return cached('tri' + a + b + c, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
        g.computeVertexNormals();
        return g;
    });
}

/*
 * Wing on `parent` at the shoulder (x, y, z), side +1 = left (+x). kind 'bat' (fingers + membrane) or 'feather'.
 *   wing.set(spread 0 folded along the flank .. 1 open, flap -1 down .. 1 up)
 * The membrane panels hang on the fingers, so they simply slide over each other when the wing folds.
 */
export function makeWing(parent, side, { x = 0, y = 0, z = 0, len = 1, kind = 'bat', color = 0x3a2a30, membrane = 0x5a3038, feather = 0x6a5a4a } = {}) {
    const add = (p, geo, m, px = 0, py = 0, pz = 0) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(px, py, pz);
        mesh.castShadow = true;
        p.add(mesh);
        return mesh;
    };
    const grp = (p, px = 0, py = 0, pz = 0) => { const g = new THREE.Group(); g.position.set(px, py, pz); p.add(g); return g; };
    const bone = mat(color, { roughness: .8 });
    const skin = mat(membrane, { roughness: .9, side: THREE.DoubleSide });
    const fea = mat(feather, { roughness: .95, side: THREE.DoubleSide });
    const s = side, a = len * .34, f = len * .34;                 // upper arm, forearm (x outwards)
    const root = grp(parent, x, y, z);
    root.rotation.order = 'YZX';
    const arm = grp(root);
    const lim = (g, l, r) => { const m = add(g, new THREE.CylinderGeometry(r * .7, r, l, 6), bone, s * l / 2, 0, 0); m.rotation.z = Math.PI / 2; };
    lim(arm, a, len * .035);
    const elbow = grp(arm, s * a, 0, 0);
    lim(elbow, f, len * .025);
    const hand = grp(elbow, s * f, 0, 0);
    const fingers = [], inner = [], pivots = [];            // inner membrane shrinks when folded (it would poke out of the folded arm)
    if (kind === 'bat') {
        const fl = [len * .62, len * .55, len * .45, len * .36], fan = .42;
        // inner membrane: body → elbow → wrist (on the arm and forearm)
        inner.push(add(arm, tri([0, 0, 0], [s * a, 0, 0], [s * a * .2, -.02, -len * .42]), skin));
        inner.push(add(elbow, tri([0, 0, 0], [s * f, 0, 0], [-s * a * .8, -.02, -len * .42]), skin));
        inner.push(add(elbow, tri([s * f, 0, 0], [s * f + s * Math.cos(fan * 3) * fl[3], 0, -Math.sin(fan * 3) * fl[3]], [-s * a * .8, -.02, -len * .42]), skin));
        for (let i = 0; i < 4; i++) {
            const fg = grp(hand);
            lim(fg, fl[i], len * .014);
            if (i < 3) {                                          // panel from this finger to the next one (spread)
                const b = fl[i + 1];
                add(fg, tri([0, 0, 0], [s * fl[i], 0, 0], [s * Math.cos(fan) * b, 0, -Math.sin(fan) * b]), skin);
            }
            add(fg, new THREE.ConeGeometry(len * .012, len * .06, 4), bone, s * (fl[i] + len * .02), 0, 0).rotation.z = -s * Math.PI / 2;
            fingers.push(fg);
        }
        add(hand, new THREE.ConeGeometry(len * .015, len * .07, 4), bone, s * len * .03, len * .03, len * .02).rotation.z = -s * .6;   // thumb claw
        root.userData.fan = fan;
    } else {
        // feathers: secondaries along the forearm, primaries fanned from the hand
        const fl = [len * .5, len * .48, len * .45, len * .41, len * .36], fan = .2;
        // each feather hangs on a pivot that turns it from across the arm (open) to along it (folded)
        for (let i = 0; i < 6; i++) {
            const pv = grp(elbow, s * f * (i + .5) / 6, 0, 0);
            add(pv, new THREE.BoxGeometry(len * .1, len * .006, len * .36), fea, 0, 0, -len * .17).rotation.y = s * .1;
            pivots.push([pv, 1]);
        }
        for (let i = 0; i < 4; i++) {
            const pv = grp(arm, s * a * (i + .5) / 4, -.004, 0);
            add(pv, new THREE.BoxGeometry(len * .1, len * .006, len * .3), fea, 0, 0, -len * .14).rotation.y = s * .05;
            pivots.push([pv, -1]);
        }
        add(arm, new THREE.BoxGeometry(a, len * .03, len * .12), fea, s * a / 2, .005, -len * .04);    // coverts
        add(elbow, new THREE.BoxGeometry(f, len * .03, len * .1), fea, s * f / 2, .005, -len * .03);
        for (let i = 0; i < 5; i++) {
            const fg = grp(hand);
            const m = add(fg, new THREE.BoxGeometry(fl[i], len * .006, len * .085), fea, s * fl[i] / 2, -.002 * i, 0);
            m.rotation.y = 0;
            fingers.push(fg);
        }
        root.userData.fan = fan;
    }
    const fan = root.userData.fan;
    const wing = {
        root,
        set(spread, flap = 0) {
            const k = 1 - spread;
            root.rotation.y = s * k * 1.25;                       // folded: the arm points back along the flank
            root.rotation.z = s * (flap * .7 - k * .1 - .1);      // flap: up / down around the body axis
            root.rotation.x = k * (kind === 'bat' ? 1.35 : .3);   // folded: membrane rolled down against the flank
            elbow.rotation.y = -s * k * 2.5;                      // forearm folds forward
            elbow.rotation.z = -s * flap * .25 * spread;
            hand.rotation.y = s * k * 2.45;                       // hand folds back again
            for (const m of inner) m.scale.setScalar(.15 + .85 * spread);
            for (const [pv, dir] of pivots) pv.rotation.y = dir * s * k * 1.35;
            fingers.forEach((fg, i) => { fg.rotation.y = s * i * fan * (.15 + .85 * spread); });
        }
    };
    wing.set(0);
    return wing;
}

// Scorpion tail: chain of segments curling up over the back, sting at the end. Returns the segment groups.
export function scorpionTail(parent, { len = .8, r = .05, color = 0x5a3a28, sting = 0x1a1210, n = 7 } = {}) {
    const m = mat(color, { roughness: .6 }), st = mat(sting, { roughness: .4 });
    const segs = [];
    let p = parent;
    const l = len / n;
    for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        p.add(g);
        const rr = r * (1 - i * .06);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(rr, 8, 6), m);
        mesh.scale.set(1, 1, l / rr * .62);
        mesh.position.z = -l / 2;
        mesh.castShadow = true;
        g.add(mesh);
        segs.push(g);
        const next = new THREE.Group();
        next.position.z = -l;
        g.add(next);
        p = next;
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(r * .9, 8, 6), m);
    bulb.position.z = -r * .7;
    bulb.castShadow = true;
    p.add(bulb);
    const needle = new THREE.Mesh(new THREE.ConeGeometry(r * .3, r * 1.6, 6), st);
    needle.position.set(0, -r * .5, -r * 1.7);
    needle.rotation.x = -Math.PI / 2 - .8;
    p.add(needle);
    return segs;
}

// Additive flame tongue pointing up (+y); flickerFlames() animates a list of them.
const glow = new Map();
export const glowMat = (color, opacity = .85) => {
    const key = color + ':' + opacity;
    if (!glow.has(key)) glow.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    return glow.get(key);
};
export function flameTongue(parent, x, y, z, size = .1, color = 0xff7a20) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(size * .4, size * 1.6, 7), glowMat(color));
    outer.position.y = size * .7;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(size * .2, size, 6), glowMat(0xfff0b0, .9));
    inner.position.y = size * .45;
    g.add(outer, inner);
    g.traverse(m => { m.raycast = () => {}; });
    g.userData.seed = Math.random() * 10;
    parent.add(g);
    return g;
}
export function flickerFlames(list, t) {
    for (const f of list) {
        const s = f.userData.seed;
        f.scale.set(1, .75 + .35 * Math.sin(t * 11 + s) * Math.sin(t * 4.7 + s * 2) + .25, 1);
        f.rotation.z = Math.sin(t * 6 + s) * .15;
    }
}
