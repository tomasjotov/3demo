import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, mat } from './kit.js';

/*
 * Undead bodies for ProceduralAvatar (flags of avatar/bodies.js):
 *
 *   bone: true     skeleton – skull with empty eye sockets and a moving jaw (J.jaw), vertebrae, rib cage,
 *                  sternum, clavicles, shoulder blades, pelvis, paired forearm / shin bones, bony hands and feet
 *   sockets: true  undead flesh face (zombie, ghoul, mummy): no eyes, dark sunken sockets, dark mouth with teeth
 *   nasal: true    nose hole instead of a nose (ghoul)
 *   ribs: true     ribs showing through the skin (ghoul)
 *   wraps: true    bandages on the head, torso and limbs (mummy)
 *
 * All pieces of one joint are merged into one mesh per material and cached, so a skeleton costs
 * a few draw calls per joint and every skeleton shares the same geometry.
 * Joint layout (positions of the groups) is the shared rig of ProceduralAvatar, only the meshes differ.
 */

export const BONE = 0xddd2b4;          // default bone colour (skin of the skeleton body)
const DARK = 0x0b0807;
const TEETH = 0xf1ead6;
const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
const merged = new Map();

// Collects transformed geometries of one joint + material, merged on flush.
class Part {
    constructor() { this.list = []; }
    put(g, pos = [0, 0, 0], rot = null, scale = null, quat = null) {
        _p.set(pos[0], pos[1], pos[2]);
        if (quat) _q.copy(quat);
        else if (rot) _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'XYZ'));
        else _q.identity();
        if (scale) _s.set(scale[0], scale[1], scale[2]); else _s.set(1, 1, 1);
        this.list.push(g.clone().applyMatrix4(_m.compose(_p, _q, _s)));
        return this;
    }
    raw(g) { this.list.push(g); return this; }
    // bone shaft from a to b, radius r at a and r2 at b
    bone(a, b, r, r2 = r, seg = 6) {
        _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
        const d = _b.clone().sub(_a), len = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
        return this.put(G.cyl(r2, r, len, seg), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], null, null, q);
    }
    // curved bone through points (ribs, clavicle, jaw)
    curve(pts, r, seg = 12, radial = 5) {
        const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
        return this.raw(new THREE.TubeGeometry(c, seg, r, radial, false));
    }
}

// Merged + cached mesh of one joint: build(part) is called once per key.
function flush(add, parent, key, m, build) {
    let g = merged.get(key);
    if (!g) {
        const p = new Part();
        build(p);
        if (!p.list.length) return null;
        g = mergeGeometries(p.list.map(x => x.index ? x : x.toNonIndexed()).map(x => {
            for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
            return x;
        }), false);
        merged.set(key, g);
    }
    return add(parent, g, m);
}

const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const zSpine = y => -.06 - .012 * Math.sin((y - .12) * 6);       // spine curve (lordosis / kyphosis) in spine space

// ------------------------------------------------------------------ skeleton
export function boneMats(b) {
    return { bone: mat(b.skin ?? BONE, { roughness: .88 }), dark: mat(DARK, { roughness: 1 }), teeth: mat(TEETH, { roughness: .6 }) };
}

export function bonePelvis(add, J, b, D, M) {
    flush(add, J.pelvis, `pelvis${D.hipX}`, M.bone, p => {
        p.put(G.box(.075, .11, .035), [0, .005, -.075], [-.35, 0, 0]);               // sacrum
        p.bone([0, -.05, -.093], [0, -.09, -.072], .012, .006);                       // coccyx
        for (const s of [1, -1]) {
            p.put(G.sph(.066, 10, 8), [.088 * s, .045, -.03], [0, 1.0 * s, -.25 * s], [1, .8, .22]);      // iliac wing
            p.bone([D.hipX * s * .9, -.05, .01], [.03 * s, -.078, .055], .019, .015);                   // pubis
            p.bone([D.hipX * s, -.06, -.02], [.05 * s, -.105, -.03], .021, .017);                       // ischium
            p.put(G.sph(.034, 8, 6), [D.hipX * s * 1.08, -.035, -.005]);                                 // hip socket rim
        }
        p.put(G.sph(.02, 6, 5), [0, -.078, .06], null, [1.5, 1, .8]);               // pubic symphysis
    });
}

export function boneLeg(add, J, s, side, M) {
    const k = `leg${side}`;
    flush(add, J[s + 'Hip'], k + 'femur', M.bone, p => {
        p.put(G.sph(.042, 10, 8));                                                    // femoral head
        p.bone([0, 0, 0], [.04 * side, -.045, 0], .02, .022);                         // neck
        p.put(G.sph(.03, 8, 6), [.05 * side, -.04, -.006]);                           // greater trochanter
        p.bone([.04 * side, -.05, 0], [.008 * side, -.36, .004], .023, .02, 7);       // shaft (slants towards the knee)
        for (const c of [1, -1]) p.put(G.sph(.023, 8, 6), [(.008 + .016 * c) * side, -.378, -.004]);    // condyles
    });
    flush(add, J[s + 'Knee'], k + 'shin', M.bone, p => {
        p.put(G.sph(.024, 8, 6), [0, .0, .045], null, [1, 1.25, .6]);                 // kneecap
        p.put(G.sph(.03, 10, 6), [0, -.022, 0], null, [1.35, .6, 1.1]);                // tibial plateau
        p.bone([0, -.03, .006], [0, -.34, 0], .021, .016, 7);                         // tibia
        p.put(G.sph(.02, 6, 5), [-.016 * side, -.352, .002]);                         // medial malleolus
        p.bone([.03 * side, -.04, -.012], [.026 * side, -.35, -.008], .009, .008);    // fibula
        p.put(G.sph(.016, 6, 5), [.029 * side, -.358, -.006]);                        // lateral malleolus
    });
    flush(add, J[s + 'Ankle'], k + 'foot', M.bone, p => {
        p.put(G.sph(.026, 8, 6), [0, -.03, 0], null, [1, .8, 1.2]);                   // talus
        p.put(G.sph(.03, 8, 6), [0, -.058, -.035], null, [.9, .95, 1.3]);              // heel
        p.put(G.box(.06, .028, .05), [0, -.058, .03], [-.15, 0, 0]);                  // tarsus
        [-.033, -.016, 0, .016, .031].forEach((x, i) => {
            const xm = x * side, r = i === 0 ? .009 : .0072;                         // big toe medial
            p.bone([xm * .7, -.062, .05], [xm, -.08, .125], r, r * .9, 5);           // metatarsals
            p.bone([xm, -.08, .125], [xm * 1.05, -.084, i === 0 ? .17 : .16], r * .85, r * .75, 5);   // toes
        });
    });
}

export function boneTorso(add, J, b, D, M) {
    flush(add, J.spine, `torso${D.shoulderX}`, M.bone, p => {
        // vertebrae: body + spinous process (+ transverse processes of the lumbar spine)
        for (let i = 0; i < 13; i++) {
            const y = .01 + i * .036, r = .036 - i * .0011, z = zSpine(y);
            p.put(G.cyl(r, r * 1.05, .024, 8), [0, y, z]);
            p.put(G.box(.012, .014, .04), [0, y - .008, z - .038], [.45, 0, 0]);
            if (y < .17) p.put(G.box(.08, .01, .014), [0, y, z - .01]);
        }
        // ribs: 5 true ribs reach the sternum, 2 floating ribs end at the side
        const W = [.6, .8, .93, 1, 1.03, 1.02, .95];
        for (let i = 0; i < 7; i++) {
            const yb = .42 - i * .038, zb = zSpine(yb), ys = yb - (.05 + i * .006), w = W[i], yf = .405 - i * .035;
            for (const s of [1, -1]) {
                const pts = [[.022 * s, yb, zb], [.08 * s, yb - .01, zb - .03], [.165 * w * s, ys + .012, zb + .035]];
                if (i < 5) pts.push([.15 * w * s, ys, zb + .125], [.075 * w * s, (ys + yf) / 2, .132], [.03 * s, yf, .143]);
                else pts.push([.14 * w * s, ys - .005, zb + .1]);
                p.curve(pts, i ? .011 : .0095, 14, 5);
            }
        }
        p.put(G.box(.066, .055, .02), [0, .405, .14]);                               // manubrium
        p.put(G.box(.042, .165, .018), [0, .3, .147], [-.1, 0, 0]);                   // sternum
        p.put(G.cone(.016, .04, 4), [0, .2, .155], [Math.PI, 0, 0]);                  // xiphoid
        for (const s of [1, -1]) {
            p.curve([[.035 * s, .43, .135], [.13 * s, .435, .105], [.24 * s, .42, .0]], .012, 8, 5);          // clavicle
            p.put(G.cone(.062, .14, 3), [.12 * s, .33, -.118], [Math.PI, .3 * s, 0], [1, 1, .2]);             // shoulder blade
            p.bone([.07 * s, .375, -.122], [.235 * s, .41, -.055], .01, .012, 5);                              // its spine → acromion
        }
    });
}

export function boneArm(add, J, s, side, M) {
    const k = `arm${side}`;
    flush(add, J[s + 'Sh'], k + 'humerus', M.bone, p => {
        p.put(G.sph(.04, 10, 8));                                                     // humeral head
        p.bone([0, -.02, 0], [0, -.235, 0], .02, .017, 7);                            // shaft
        p.put(G.sph(.026, 8, 6), [0, -.25, 0], null, [1.5, .8, 1]);                   // epicondyles
    });
    flush(add, J[s + 'El'], k + 'forearm', M.bone, p => {
        p.put(G.sph(.021, 8, 6), [0, .004, -.02]);                                   // olecranon (elbow tip)
        p.bone([0, -.005, -.013], [0, -.225, -.009], .011, .008);                     // ulna
        p.bone([0, -.012, .012], [0, -.225, .015], .009, .012);                       // radius (thumb side)
    });
    flush(add, J[s + 'Hand'], k + 'hand', M.bone, p => {
        p.put(G.sph(.02, 8, 6), [0, -.012, 0], null, [.8, .7, 1.4]);                  // wrist bones
        [-.021, -.007, .007, .021].forEach(z => {
            p.bone([0, -.018, z * .6], [0, -.058, z], .0062, .0056, 5);              // metacarpals
            p.bone([0, -.058, z], [-.013 * side, -.08, z], .0056, .005, 5);          // fingers curl to the palm
            p.bone([-.013 * side, -.08, z], [-.024 * side, -.088, z * .95], .005, .0042, 5);
        });
        p.bone([-.004 * side, -.014, .018], [-.02 * side, -.035, .04], .0065, .006, 5);   // thumb
        p.bone([-.02 * side, -.035, .04], [-.032 * side, -.05, .05], .006, .005, 5);
    });
}

export function boneNeck(add, J, M) {
    flush(add, J.neck, 'neck', M.bone, p => {
        [.012, .045, .078, .111].forEach((y, i) => {
            const z = -.055 + i * .006;
            p.put(G.cyl(.022, .024, .022, 7), [0, y, z]);
            p.put(G.box(.01, .012, .028), [0, y - .005, z - .028], [.3, 0, 0]);
        });
    });
}

// Skull in the face group F (centre of the old head sphere, face +Z); jaw on its own pivot J.jaw.
export function boneSkull(add, grp, J, M) {
    const F = J.face;
    flush(add, F, 'skull', M.bone, p => {
        p.put(G.sph(.15, 18, 14), [0, .045, -.01], null, [.95, 1, 1.08]);             // cranium
        p.put(G.sph(.1, 14, 10), [0, -.05, .062], null, [1.08, .74, .85]);            // upper jaw + cheeks
        for (const s of [1, -1]) {
            p.put(G.sph(.032, 8, 6), [.078 * s, -.036, .09], null, [.9, .6, 1.1]);    // cheekbone
        }
        p.put(G.sph(.1, 14, 6), [0, .056, .098], null, [1.02, .26, .42]);              // brow ridge over both sockets
    });
    flush(add, F, 'skullHoles', M.dark, p => {
        for (const s of [1, -1]) p.put(G.sph(.046, 12, 8), [.057 * s, .006, .122], null, [1, .9, .42]);   // empty eye sockets
        p.put(G.cone(.024, .052, 3), [0, -.042, .148], [0, Math.PI, 0], [1, 1, .45]);                    // nose hole
        p.put(G.box(.07, .05, .03), [0, -.112, .12]);                                                    // mouth (behind the teeth)
    });
    flush(add, F, 'skullTeeth', M.teeth, p => {
        for (let i = 0; i < 8; i++) {
            const a = -.78 + i * (1.56 / 7);
            p.put(G.box(.0135, .023, .012), [.07 * Math.sin(a), -.099, .075 + .07 * Math.cos(a)], [0, a, 0]);
        }
    });
    J.jaw = grp(F, 0, -.06, -.005);
    flush(add, J.jaw, 'jaw', M.bone, p => {
        p.raw(new THREE.TorusGeometry(.066, .018, 5, 14, 3).rotateZ(Math.PI / 2 - 1.5).rotateX(Math.PI / 2).scale(1, 1, 1.3).translate(0, -.075, .06));
        p.put(G.sph(.03, 8, 6), [0, -.08, .135], null, [1.25, .85, .7]);              // chin
        for (const s of [1, -1]) p.bone([.066 * s, -.075, .06], [.082 * s, .0, -.005], .016, .014, 5);     // ramus up to the joint
    });
    flush(add, J.jaw, 'jawTeeth', M.teeth, p => {
        for (let i = 0; i < 8; i++) {
            const a = -.74 + i * (1.48 / 7);
            p.put(G.box(.013, .02, .011), [.064 * Math.sin(a), -.056, .08 + .064 * Math.cos(a)], [0, a, 0]);
        }
    });
}

// Jaw opening (radians) for a state: chattering idle, wide open bite / hit, slack when dead.
export function jawTarget(state, t, p) {
    if (state === 'attack') return p > .3 && p < .65 ? .5 : .1;
    if (state === 'hit') return .42;
    if (state === 'death' || state === 'lie') return .38;
    if (state === 'defend') return .02;
    if (state === 'walk' || state === 'run') return .06 + Math.abs(Math.sin(t * 5)) * .05;
    const c = t % 5.3;                                                               // chatter now and then
    return c < .55 ? .04 + Math.abs(Math.sin(c * 30)) * .14 : .04;
}

// ------------------------------------------------------------------ undead flesh
// Face of a zombie / ghoul / mummy in F: sunken dark sockets instead of eyes, dark mouth with teeth.
export function undeadFace(add, F, b) {
    const rim = mat(shade(b.skin, .5), { roughness: 1 }), hole = mat(DARK, { roughness: 1 });
    for (const s of [1, -1]) {
        add(F, G.sph(.058, 10, 8), rim, .074 * s, .02, .15).scale.set(1, .85, .5);
        add(F, G.sph(.047, 10, 8), hole, .074 * s, .018, .162).scale.set(1, .85, .45);
    }
    if (b.nasal) add(F, G.cone(.026, .056, 3), hole, 0, -.03, .178).scale.set(1, 1, .4);
    add(F, G.box(.09, .036, .02), hole, 0, -.095, .172);                             // open mouth
    add(F, G.box(.074, .012, .012), mat(0xcfc4a2, { roughness: .7 }), 0, -.082, .178);   // upper teeth
    add(F, G.box(.066, .01, .012), mat(0xcfc4a2, { roughness: .7 }), 0, -.11, .176);     // lower teeth
}

// Ribs under the skin of a gaunt body (ghoul): arcs on the chest of the flesh torso.
export function fleshRibs(add, spine, b, D) {
    flush(add, spine, `fleshRibs${D.chestR}`, mat(shade(b.skin, .92)), p => {
        for (let i = 0; i < 4; i++) {
            const y = .33 - i * .045, r = D.waistR + (D.chestR - D.waistR) * (y / .44) + .004;
            p.raw(new THREE.TorusGeometry(r, .009, 4, 16, 2.3).rotateZ(Math.PI / 2 - 1.15).rotateX(Math.PI / 2)
                .scale(1, 1, .76).rotateX(.18).translate(0, y, 0));
        }
    });
}

// Bandages of a mummy: tilted rings on the head, torso and limbs (radii of the flesh body in ProceduralAvatar).
export function mummyWraps(add, J, b, D) {
    const m = mat(shade(b.skin, 1.06), { roughness: .95 }), m2 = mat(shade(b.skin, .82), { roughness: .95 });
    const ring = (p, r, y, tilt, roll, sz = 1) => p.raw(new THREE.TorusGeometry(r, .011, 4, 18).rotateX(Math.PI / 2 + tilt)
        .rotateZ(roll).scale(1, 1, sz).translate(0, y, 0));
    const limb = (p, r0, r1, len, n, seed) => {
        for (let i = 0; i < n; i++) {
            const f = (i + .5) / n, r = r0 + (r1 - r0) * f + .004;
            ring(p, r, -len * f, ((i + seed) % 2 ? .3 : -.25), ((i + seed) % 3 - 1) * .2);
        }
    };
    for (const s of ['l', 'r']) {
        flush(add, J[s + 'Hip'], 'wrapThigh' + s, m, p => limb(p, .094, .074, .4, 4, s === 'l' ? 0 : 1));
        flush(add, J[s + 'Knee'], 'wrapShin' + s, m2, p => limb(p, .07, .057, .36, 4, s === 'l' ? 1 : 0));
        flush(add, J[s + 'Sh'], 'wrapArm' + s, m2, p => limb(p, .072, .06, .25, 3, 0));
        flush(add, J[s + 'El'], 'wrapForearm' + s, m, p => limb(p, .058, .05, .23, 3, 1));
    }
    flush(add, J.spine, `wrapTorso${D.chestR}`, m, p => {
        for (let i = 0; i < 6; i++) {
            const y = .04 + i * .07, r = D.waistR + (D.chestR - D.waistR) * (y / .44) + .005;
            ring(p, r, y, (i % 2 ? .22 : -.18), 0, .74);
        }
    });
    flush(add, J.face, 'wrapHead', m2, p => {
        [[.13, .25], [.08, -.2], [-.05, .15], [-.1, -.22]].forEach(([y, tilt]) => {
            const r = Math.sqrt(Math.max(.001, .2 * .2 - y * y)) + .006;
            ring(p, r, y, tilt, 0, .94);
        });
    });
}
