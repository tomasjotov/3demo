import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, damp } from './QuadrupedRig.js';
import { taperTube, glowMat } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralDragon — dragons and their kin: adult / young / elder dragon, dragonlich (rotting undead dragon with the
 * rib cage showing and ghostly eyes), skeleton dragon (bones only, empty eye sockets, tattered wings), wyvern (two legs,
 * the bat wings serve as fore-limbs, long tail with a sting) and gargoyle (crouching stone beast with bat wings).
 *
 *   root (yaw, scale)
 *   └─ body (pitch bx: the wyvern and the gargoyle carry the chest high)
 *      ├─ legs top ─ knee ─ low ─ toe (the toe group keeps the foot flat on the ground); planted poses are solved by a
 *      │  small two-bone IK (plant()) so the feet stay on the ground while the body rears, lunges or crouches
 *      ├─ neck ─ neck segments (S-curve, pose key nS) ─ head ─ jaw, breath (fire / sickly green / steam cone)
 *      ├─ tailRoot ─ tail segments (droop tailC, sideways curl tailY, swish)
 *      └─ wings: shoulder (pitch) ─ arm ─ elbow ─ hand ─ 4 fingers; the membrane is one small mesh whose corners are
 *         moved every frame onto the bones (it folds with them), torn ones have holes (alpha-tested canvas texture)
 *   Neck, head and tail are kept above the ground by a cheap solver in the body plane (lying, dying, lunging).
 *
 * States: idle (breathing, neck sway, tail swish, wings folded), walk, run (wings half open, beating), attack (rears the
 * neck back, claw raised → lunges with the long neck, breath from the open jaws → bite snap → recover; skeleton,
 * wyvern and gargoyle only bite and claw), defend (rears up, wings spread high, roar), hit (flinch), kneel (crouched on
 * the belly, head up), lie (on the belly, head on the ground, tail curled), death (rolls on its side, wing limp, neck
 * on the ground). Animation: QuadrupedRig.
 */

export const DRAGON_VARIANTS = {
    // teal-green scales, gold belly, glowing orange membrane, fire
    dragon: { kind: 'dragon', scale: 2.2, skin: 0x2e6a5c, dark: 0x1a3a34, belly: 0xc8963c, spine: 0xc8862e, horn: 0x34281e,
        membrane: 0xb8662a, vein: 0x4a2412, eye: 0xffb020, breath: [0xff4a10, 0xff9a28, 0xfff0b0] },
    // grey-green, pale belly, amber membrane, smaller horns
    'dragon-young': { kind: 'dragon', scale: 1.4, skin: 0x63786a, dark: 0x3a4a40, belly: 0xcdbf98, spine: 0x8a7656, horn: 0x2c2824,
        membrane: 0xc68a4a, vein: 0x6a4424, eye: 0xf0a020, horns: .75, bulk: .92, breath: [0xff5a14, 0xffa030, 0xfff0b0] },
    // deep blue, cream belly, dark membrane, crown of horns, scalding steam
    'dragon-elder': { kind: 'dragon', scale: 2.8, skin: 0x1f4a6a, dark: 0x122638, belly: 0xd6cfb0, spine: 0x50708a, horn: 0x24242c,
        membrane: 0x2e4258, vein: 0x0e1622, eye: 0x9ae8ff, horns: 1.25, elder: true, bulk: 1.06, breath: [0x3a7aff, 0x9ad0ff, 0xf4fbff] },
    dragonlich: { kind: 'dragon', undead: 'lich', scale: 2.2, skin: 0x4a2c26, dark: 0x2a1614, belly: 0x5a1a16, bone: 0xd8ccb0, spine: 0xcfc2a4,
        horn: 0xcfc2a4, membrane: 0x3e2a24, vein: 0x140c0a, eye: 0x8aff6a, ghost: true, torn: .45, breath: [0x2a9a20, 0x7aff50, 0xe0ffd0] },
    'skeleton-dragon': { kind: 'dragon', undead: 'skeleton', scale: 2.0, bone: 0xd8cdb4, dark: 0x2a2628, spine: 0x2e2a2c, horn: 0x2e2a2c,
        membrane: 0x37323a, vein: 0x151214, torn: .75 },
    // charcoal scales, cream belly and crest, spotted cream membrane, poison sting
    wyvern: { kind: 'wyvern', scale: 1.15, skin: 0x34363c, dark: 0x1c1e22, belly: 0xd8cbb0, spine: 0xe0d6c0, horn: 0xe0d6c0,
        membrane: 0xd8c6a2, vein: 0x4a3a2c, spots: 0x2e241c, eye: 0xff6a20, sting: 0x1a1816 },
    gargoyle: { kind: 'gargoyle', scale: .72, skin: 0x7e7c78, dark: 0x4c4a48, belly: 0x8c8a86, spine: 0x5e5c58, horn: 0x6a6864,
        membrane: 0x6c6864, vein: 0x3c3a38, eye: 0xd8341c, stone: true }
};

// metres at scale 1: torso radius / length, body height and pitch, hips [y, z] (fore, hind), legs (upper, lower, foot),
// foot z offset from the hip, world angle of the foot bone, neck [segments, length, base / top radius] and its S-curve,
// tail [segments, length, base radius], wing (length, shoulder, membrane corners on the flank and hip, poses)
const KINDS = {
    dragon: {
        r: .27, len: .7, H: .72, hip: [[-.06, .34], [-.01, -.32]], legX: [.17, .18], legR: [.065, .08],
        fl: [.31, .3, .1], hl: [.33, .32, .17], foot: [.05, .03], toeA: [0, -.3],
        neckAt: [.12, .46], neck: [6, .13, .13, .08], neckProf: [.35, .25, 0, -.25, -.4, -.45],
        head: 1.25, tailAt: [.04, -.55], tail: [11, .16, .135],
        wing: { len: 1.55, at: [.1, .18, .28], hip: [.15, .04, -.44], flank: [.2, .12, -.08], bone: .02 },
        gait: { walk: 1.15, run: 2.3, amp: .36, ampRun: .38, lift: .7 }
    },
    wyvern: {
        r: .19, len: .5, H: .72, hip: [null, [-.03, -.1]], legX: [0, .15], legR: [0, .066],
        fl: null, hl: [.31, .3, .15], foot: [0, .06], toeA: [0, -.3],
        neckAt: [.08, .34], neck: [5, .12, .085, .05], neckProf: [.3, .2, -.05, -.3, -.4],
        head: 1.1, tailAt: [.02, -.4], tail: [13, .14, .085],
        wing: { len: 1.4, at: [.09, .12, .2], hip: [.12, -.06, -.26], flank: [.15, .04, -.02], bone: .022 },
        gait: { walk: .95, run: 1.8, amp: .45, ampRun: .3, lift: .8 }
    },
    gargoyle: {
        r: .15, len: .26, H: .48, hip: [[.02, .2], [-.02, -.15]], legX: [.15, .12], legR: [.042, .055],
        fl: [.3, .3, .07], hl: [.22, .22, .12], foot: [.1, .06], toeA: [0, -.35],
        neckAt: [.05, .3], neck: [2, .07, .075, .062], neckProf: [.25, -.1],
        head: 1, tailAt: [0, -.3], tail: [11, .1, .04],
        wing: { len: 1.0, at: [.07, .12, .1], hip: [.1, -.02, -.2], flank: [.13, .05, -.05], bone: .028 },
        gait: { walk: .7, run: 1.3, amp: .4, ampRun: .35, lift: .8 }
    }
};

// wing joint angles: shoulder pitch, raise (up), sweep (back), roll (membrane down when folded), elbow / hand fold
const WING_POSES = {
    dragon: {
        fold: { pitch: 0, raise: -.65, sweep: 1.2, roll: -1.3, elbow: 2.7, hand: 2.9 },
        open: { pitch: 0, raise: .3, sweep: .3, roll: .05, elbow: .55, hand: -.1 }
    },
    wyvern: {
        fold: { pitch: 0, raise: -.65, sweep: 1.2, roll: -1.3, elbow: 2.7, hand: 2.9 },
        open: { pitch: 0, raise: .3, sweep: .3, roll: .05, elbow: .55, hand: -.1 },
        ground: { pitch: .6, raise: -1.32, sweep: 0, roll: 0, elbow: .5, hand: 2.85 }       // wrist on the ground ahead of the shoulder
    },
    gargoyle: {
        fold: { pitch: 0, raise: .5, sweep: 1.3, roll: -1.2, elbow: 2.6, hand: 2.7 },
        open: { pitch: 0, raise: .35, sweep: .3, roll: .05, elbow: .55, hand: -.1 }
    }
};
const FAN_FOLD = [0, .04, .08, .12], FAN_OPEN = [-.1, .35, .8, 1.3];

// Pose tables per kind: o = keys over the stand pose, plant = legs kept on the ground by IK ('F' fore, 'H' hind),
// rest = belly on the ground (body lowered to this many torso radii), fw / hw = world angles of folded legs.
const EXTRA = { nS: 1, tailC: .03, tailY: 0, wS: 0, wF: 0, wG: 0 };
const POSES = {
    dragon: {
        stand: { o: { neckX: .55, headX: .25, jaw: .04, tailX: -.3, tailC: .035 }, plant: 'FH' },
        run: { o: { wS: .4, wF: .05, neckX: .75, headX: .2 }, plant: 'FH' },
        wind: { o: { by: .04, bz: -.1, bx: -.1, FRx: -.6, FRk: .9, neckX: -.05, nS: 1.5, headX: -.25, jaw: .4, wS: .4, wF: .25, tailX: -.15 }, plant: 'FH' },
        strike: { o: { by: -.05, bz: .22, bx: .14, FRx: .35, FRk: -.2, neckX: 1.25, nS: .1, headX: .2, jaw: .6, wS: .3, wF: -.1 }, plant: 'FH' },
        bite: { o: { by: -.03, bz: .18, bx: .1, neckX: 1.1, nS: .35, headX: .45, jaw: .02, wS: .2 }, plant: 'FH' },
        defend: { o: { by: .22, bz: -.15, bx: -.5, FRx: -.35, FRk: .3, neckX: .15, nS: 1.4, headX: .05, jaw: .6, wS: 1, wF: .45, tailX: -.05 },
            plant: 'H', fw: [-1, -1.7, -.6] },
        hit: { o: { by: -.02, bz: -.12, bx: -.08, neckX: .15, nS: 1.5, headX: -.1, jaw: .35, wS: .3, wF: .3 }, plant: 'FH' },
        kneel: { o: { neckX: .35, nS: 1.1, headX: .25, tailX: -.2, tailC: .02, tailY: .12, HLz: .2 }, rest: 1.02, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        lie: { o: { neckX: 1.4, nS: -.3, headX: .7, jaw: .02, tailX: -.2, tailC: .02, tailY: .16, HLz: .2 }, rest: 1.0, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        dead: { o: { roll: 1.3, FLz: -.15, HLz: -.15, neckX: 1.3, nS: -.4, headX: .3, jaw: .5, tailX: -.05, tailC: 0, tailY: 0, wS: .5, wF: -.3 }, rest: 1.3,
            fw: [-.3, .1, .3], hw: [.3, .6, .4] }
    },
    wyvern: {
        stand: { o: { bx: -.5, neckX: 1.15, nS: 1.4, headX: .7, jaw: .05, tailX: .3, tailC: .03, wG: 1 }, plant: 'H' },
        run: { o: { bx: -.35, neckX: 1.0, headX: .55, wG: .7, wS: .25 }, plant: 'H' },
        wind: { o: { bx: -.75, by: .06, bz: -.08, neckX: .5, nS: 1.6, headX: .7, jaw: .6, wG: .2, wS: .55, wF: .3, tailX: .7 }, plant: 'H' },
        strike: { o: { bx: -.2, by: -.08, bz: .22, neckX: 1.55, nS: .1, headX: .55, jaw: .9, wG: 0, wS: .6, wF: -.25, tailX: .2 }, plant: 'H' },
        bite: { o: { bx: -.25, by: -.07, bz: .2, neckX: 1.45, nS: .3, headX: .6, jaw: .02, wG: 0, wS: .5 }, plant: 'H' },
        defend: { o: { bx: -.85, by: .06, bz: -.08, neckX: .55, nS: 1.4, headX: .85, jaw: .7, wG: 0, wS: 1, wF: .5, tailX: .55 }, plant: 'H' },
        hit: { o: { bx: -.62, bz: -.1, neckX: .6, nS: 1.5, headX: .7, jaw: .4, wG: .5, wS: .3, wF: .2 }, plant: 'H' },
        kneel: { o: { bx: -.15, neckX: .8, headX: .4, wG: 0, tailY: .12, HLz: .2 }, rest: 1.0, hw: [-1.35, 1.45, -1.55] },
        lie: { o: { bx: 0, neckX: 1.4, nS: -.3, headX: .7, wG: 0, tailX: -.1, tailY: .16, HLz: .2 }, rest: 1.0, hw: [-1.35, 1.45, -1.55] },
        dead: { o: { bx: 0, roll: 1.3, HLz: -.15, neckX: 1.3, nS: -.4, headX: .3, jaw: .5, tailX: -.05, tailC: 0, tailY: 0, wG: 0, wS: .5, wF: -.3 }, rest: 1.3,
            hw: [.3, .6, .4] }
    },
    gargoyle: {
        stand: { o: { bx: -.75, neckX: .45, headX: .75, jaw: .05, tailX: .6, tailC: .02, tailY: .12, wS: .35 }, plant: 'FH' },
        walk: { o: { bx: -.25, neckX: .9, headX: .3 }, plant: 'FH', rel: true },
        run: { o: { bx: -.15, neckX: 1.0, headX: .25, wS: .3 }, plant: 'FH', rel: true },
        wind: { o: { bx: -.95, by: .05, FRx: -2.0, FRk: .4, neckX: .35, headX: .8, jaw: .5, wS: .5, wF: .2 }, plant: 'FH' },
        strike: { o: { bx: -.45, bz: .14, by: -.04, FRx: -.9, FRk: -.4, neckX: .8, nS: .6, headX: .55, jaw: .75, wS: .4 }, plant: 'FH' },
        bite: { o: { bx: -.5, bz: .12, by: -.04, FRx: -.4, neckX: .8, nS: .6, headX: .6, jaw: .05, wS: .3 }, plant: 'FH' },
        defend: { o: { bx: -1.05, by: .08, neckX: .4, headX: 1, jaw: .6, wS: 1, wF: .4, tailX: .4 }, plant: 'H', fw: [-1.6, -2.4, -2] },
        hit: { o: { bx: -.9, bz: -.06, neckX: .2, headX: .9, jaw: .35, wS: .3, wF: .2 }, plant: 'FH' },
        kneel: { o: { bx: -.8, by: -.06, neckX: .5, headX: .9, tailX: .5 }, plant: 'FH' },
        lie: { o: { bx: 0, neckX: 1.3, nS: -.2, headX: .5, tailX: -.1, tailY: .2, HLz: .2, wS: 0 }, rest: 1.0, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        dead: { o: { bx: 0, roll: 1.3, FLz: -.15, HLz: -.15, neckX: 1.3, nS: -.3, headX: .3, jaw: .4, tailX: -.05, tailC: 0, tailY: 0, wS: .45, wF: -.3 }, rest: 1.3,
            fw: [-.3, .1, .3], hw: [.3, .6, .4] }
    }
};

/* ------------------------------------------------------------------ textures (canvas, cached; null outside a browser) */

const texCache = new Map();
const hex = c => '#' + new THREE.Color(c).getHexString();
function canvasTex(key, size, draw, repeat = [1, 1]) {
    if (texCache.has(key)) return texCache.get(key);
    let tex = null;
    if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        let seed = 11;
        draw(cv.getContext('2d'), () => (seed = (seed * 16807) % 2147483647) / 2147483647);
        tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(...repeat);
        tex.colorSpace = THREE.SRGBColorSpace;
    }
    texCache.set(key, tex);
    return tex;
}
// overlapping scales
const scaleTex = (base, edge) => canvasTex('sc' + base + edge, 64, g => {
    g.fillStyle = hex(base); g.fillRect(0, 0, 64, 64);
    g.strokeStyle = hex(new THREE.Color(base).lerp(new THREE.Color(edge), .6)); g.lineWidth = 1.2;
    for (let y = 0; y <= 64; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x <= 68; x += 8) {
        g.beginPath(); g.arc(x, y, 4.6, 0, Math.PI); g.stroke();
    }
}, [7, 5]);
// belly plates: bands across the body
const plateTex = (base, edge) => canvasTex('pl' + base + edge, 32, g => {
    g.fillStyle = hex(base); g.fillRect(0, 0, 32, 32);
    g.fillStyle = hex(edge);
    for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 32, 1);
}, [1, 3]);
// weathered stone: speckles and hairline cracks
const stoneTex = (base, dark) => canvasTex('st' + base + dark, 64, (g, rnd) => {
    g.fillStyle = hex(base); g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) {
        g.fillStyle = rnd() < .5 ? hex(dark) : '#a8a6a0';
        g.globalAlpha = .12 + rnd() * .2;
        g.fillRect(rnd() * 64, rnd() * 64, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.globalAlpha = .5; g.strokeStyle = hex(dark); g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        let x = rnd() * 64, y = rnd() * 64;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (rnd() - .5) * 14; y += rnd() * 9; g.lineTo(x, y); }
        g.stroke();
    }
}, [2, 2]);
// wing membrane: veins (and spots); torn = ragged holes cut out (used with alphaTest)
const membraneTex = c => canvasTex('mb' + c.membrane + c.vein + (c.spots || 0) + (c.torn || 0), 128, (g, rnd) => {
    const gr = g.createLinearGradient(0, 0, 128, 128);
    gr.addColorStop(0, hex(new THREE.Color(c.membrane).multiplyScalar(.8)));
    gr.addColorStop(1, hex(c.membrane));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    if (c.spots) {
        g.fillStyle = hex(c.spots);
        for (let i = 0; i < 70; i++) {
            g.globalAlpha = .5 + rnd() * .4;
            g.beginPath(); g.ellipse(rnd() * 128, rnd() * 128, 2 + rnd() * 5, 2 + rnd() * 4, rnd() * 3, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
    }
    g.strokeStyle = hex(c.vein); g.globalAlpha = .55;
    for (let i = 0; i < 14; i++) {                                  // veins branching from the wrist corner (u .75, v 1)
        let x = 96, y = 0, a = .5 + rnd() * 2.2;
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) {
            a += (rnd() - .5) * .5; x += Math.cos(a) * 14; y += Math.sin(a) * 14;
            g.lineTo(x, y);
        }
        g.stroke();
    }
    g.globalAlpha = 1;
    if (c.torn) {                                                   // holes and a ragged trailing edge
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 26 * c.torn; i++) {
            g.beginPath();
            const x = rnd() * 128, y = 20 + rnd() * 108, r = 4 + rnd() * 12 * c.torn;
            g.moveTo(x + r, y);
            for (let k = 1; k <= 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (.5 + rnd() * .7); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 1.6); }
            g.fill();
        }
        for (let x = 0; x < 128; x += 6) {                          // bottom edge (trailing, v ≈ 0) torn into strips
            const h = rnd() * 40 * c.torn;
            g.fillRect(x, 128 - h, 3 + rnd() * 4, h);
        }
        g.globalCompositeOperation = 'source-over';
    }
});

/* ------------------------------------------------------------------ shared geometry */

const geoCache = new Map();
// cone with its tip at the origin opening along +z (breath)
const breathCone = (r, h) => {
    const key = 'bc' + r + h;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.ConeGeometry(r, h, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, h / 2));
    return geoCache.get(key);
};
const puffGeo = () => {
    if (!geoCache.has('puff')) geoCache.set('puff', new THREE.IcosahedronGeometry(1, 0));
    return geoCache.get('puff');
};
// horn / spike curving back from the origin (side s mirrors x)
const backHorn = (len, r, s, up = .5, out = .2) => taperTube([[0, 0, 0], [s * out * .3 * len, up * .25 * len, -.3 * len],
    [s * out * .7 * len, up * .4 * len, -.65 * len], [s * out * len, up * .35 * len, -len]], r, r * .12, 8, 6);

/* ------------------------------------------------------------------ wing */

const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _m4 = new THREE.Matrix4(), _v = new THREE.Vector3();
// membrane: corners 0 shoulder, 1 elbow, 2 wrist, 3-6 finger tips, 7-9 scallops between the tips, 10 scallop to the hip, 11 hip, 12 flank
const MEM_UV = [0, 1, .4, 1, .75, 1, 1, .95, 1, .62, .9, .32, .62, .08, .92, .8, .88, .48, .74, .22, .32, .06, 0, 0, 0, .5];
const MEM_IDX = [0, 2, 1, 2, 3, 7, 2, 7, 4, 2, 4, 8, 2, 8, 5, 2, 5, 9, 2, 9, 6, 2, 6, 10, 2, 10, 11, 2, 11, 1, 1, 11, 12, 1, 12, 0];

/*
 * Bat / dragon wing on `body` (side +1 = left, +x). poses { fold, open, ground? } (WING_POSES).
 *   wing.set(spread 0..1, flap -1..1, ground 0..1 (wyvern: wrist on the ground as a fore-foot), swing (pitch, walking))
 */
function makeDragonWing(body, s, o) {
    const len = o.len, a = len * .3, f = len * .36, fl = [len * .62, len * .6, len * .52, len * .42], br = len * o.bone;
    const add = (p, geo, m, x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        p.add(mesh);
        return mesh;
    };
    const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const bone = (g, l, r0, r1) => { add(g, G.cyl(r1, r0, l, 6), o.boneMat, s * l / 2, 0, 0).rotation.z = -s * Math.PI / 2; };
    const pitch = grp(body, s * o.at[0], o.at[1], o.at[2]);
    const root = grp(pitch);
    root.rotation.order = 'ZYX';
    add(root, G.sph(br * 1.6, 7, 5), o.boneMat);
    bone(root, a, br * 1.35, br);
    const elbow = grp(root, s * a, 0, 0);
    add(elbow, G.sph(br * 1.15, 6, 5), o.boneMat);
    bone(elbow, f, br, br * .8);
    const hand = grp(elbow, s * f, 0, 0);
    add(hand, G.sph(br * 1.1, 6, 5), o.boneMat);
    add(hand, G.cone(br * .8, len * .08, 5), o.clawMat, s * br, br, len * .03).rotation.x = Math.PI / 2 - .4;     // thumb claw
    const fingers = fl.map(l => {
        const fg = grp(hand);
        bone(fg, l, br * .7, br * .28);
        add(fg, G.cone(br * .35, len * .05, 4), o.clawMat, s * (l + len * .02), 0, 0).rotation.z = -s * Math.PI / 2;
        return fg;
    });
    let mem = null, pos = null;
    if (o.skinMat) {
        const geo = new THREE.BufferGeometry();
        pos = new THREE.BufferAttribute(new Float32Array(13 * 3), 3);
        pos.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', pos);
        geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(13 * 3).fill(0), 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(MEM_UV, 2));
        geo.setIndex(MEM_IDX);
        mem = new THREE.Mesh(geo, o.skinMat);
        mem.frustumCulled = false;
        mem.castShadow = true;
        body.add(mem);
        pos.setXYZ(0, s * o.at[0], o.at[1], o.at[2]);
        pos.setXYZ(11, s * o.hip[0], o.hip[1], o.hip[2]);
        pos.setXYZ(12, s * o.flank[0], o.flank[1], o.flank[2]);
    }
    const P = o.poses, cur = { ...P.fold };
    const mid = (i, j, w, k) => {                                   // scallop: middle of i-j pulled towards corner w
        const x = (pos.getX(i) + pos.getX(j)) / 2, y = (pos.getY(i) + pos.getY(j)) / 2, z = (pos.getZ(i) + pos.getZ(j)) / 2;
        pos.setXYZ(k, x + (pos.getX(w) - x) * .2, y + (pos.getY(w) - y) * .2, z + (pos.getZ(w) - z) * .2);
    };
    return {
        set(spread, flap = 0, ground = 0, swing = 0, drape = 0, dropTo = 0) {
            for (const key in cur) {
                let v = P.fold[key] + (P.open[key] - P.fold[key]) * spread;
                if (P.ground && ground > 0) v += (P.ground[key] - v) * ground;
                cur[key] = v;
            }
            pitch.rotation.x = cur.pitch + swing;
            const raise = cur.raise + flap * spread * .8;
            root.rotation.set(cur.roll, s * cur.sweep, s * (raise + (dropTo - raise) * drape));
            elbow.rotation.set(0, -s * cur.elbow, -s * flap * .3 * spread);
            hand.rotation.y = s * cur.hand;
            const fan = spread * (1 - ground);
            fingers.forEach((fg, i) => { fg.rotation.y = s * (FAN_FOLD[i] + (FAN_OPEN[i] - FAN_FOLD[i]) * fan); });
            if (!mem) return;
            pitch.updateMatrix(); root.updateMatrix(); elbow.updateMatrix(); hand.updateMatrix();
            _m1.multiplyMatrices(pitch.matrix, root.matrix);
            _v.copy(elbow.position).applyMatrix4(_m1); pos.setXYZ(1, _v.x, _v.y, _v.z);
            _m2.multiplyMatrices(_m1, elbow.matrix);
            _v.copy(hand.position).applyMatrix4(_m2); pos.setXYZ(2, _v.x, _v.y, _v.z);
            _m3.multiplyMatrices(_m2, hand.matrix);
            fingers.forEach((fg, i) => {
                fg.updateMatrix();
                _m4.multiplyMatrices(_m3, fg.matrix);
                _v.set(s * fl[i] * .97, 0, 0).applyMatrix4(_m4);
                pos.setXYZ(3 + i, _v.x, _v.y, _v.z);
            });
            mid(3, 4, 2, 7); mid(4, 5, 2, 8); mid(5, 6, 2, 9); mid(6, 11, 1, 10);
            pos.needsUpdate = true;
        }
    };
}

/* ------------------------------------------------------------------ rig */

export class ProceduralDragon extends QuadrupedRig {
    constructor(variant = 'dragon', { scale = 1 } = {}) {
        super();
        this.variant = DRAGON_VARIANTS[variant] ? variant : 'dragon';
        const c = this.c = { ...DRAGON_VARIANTS[this.variant] };
        this.kind = c.kind;
        const D = this.D = KINDS[this.kind];
        this.k = c.bulk ?? 1;
        this.skel = c.undead === 'skeleton';
        const T = POSES[this.kind];
        const stand = { ...BASE_STAND, ...EXTRA, ...T.stand.o };
        this.init({ H: D.H, stand, legs: D.fl ? ['FL', 'FR', 'HL', 'HR'] : ['HL', 'HR'], sniff: .2, scale: c.scale * (scale || 1), gait: { roll: .015, ...D.gait } });
        this.root.name = this.kind;
        // feet stay where the stand pose puts them; every pose is solved against them
        this.footZ = {};
        if (D.fl) this.footZ.FL = this.hipPos(stand, 'FL')[1] + D.foot[0];
        this.footZ.HL = this.hipPos(stand, 'HL')[1] + D.foot[1];
        this.STAND = this.makePose(T.stand);
        this.P = {};
        for (const name in T) this.P[name] = name === 'stand' ? this.STAND : this.makePose(T[name]);
        this.p = { ...this.STAND };
        this.breath = 0; this.breathK = 0; this.wingK = null;
        this.build();
    }

    hipPos(P, key) {
        const [hy, hz] = this.D.hip[key === 'FL' ? 0 : 1], cb = Math.cos(P.bx), sb = Math.sin(P.bx);
        return [this.H + P.by + hy * cb - hz * sb, P.bz + hy * sb + hz * cb];
    }
    // leg keys from world angles (0 = straight down, + = swung back)
    legsWorld(P, key, A0, A1, A2) {
        P[key + '0'] = A0 - P.bx; P[key + '1'] = A1 - A0; P[key + '2'] = A2 - A1;
    }
    // two-bone IK in the body plane: foot sole on the ground at its stand place (rel: under the hip)
    plant(P, key, rel) {
        const F = key === 'FL', D = this.D;
        const [hy, hz] = this.hipPos(P, key);
        const [l0, l1, l2] = F ? D.fl : D.hl, A2 = D.toeA[F ? 0 : 1];
        const fz = rel ? hz + D.foot[F ? 0 : 1] : this.footZ[key];
        const dy = l2 * Math.cos(A2) - hy, dz = fz + l2 * Math.sin(A2) - hz;
        const d = Math.min(Math.max(Math.hypot(dy, dz), Math.abs(l0 - l1) + .01), l0 + l1 - .002);
        const Ad = Math.atan2(-dz, -dy);
        const al = Math.acos((l0 * l0 + d * d - l1 * l1) / (2 * l0 * d)), ga = Math.acos((l1 * l1 + d * d - l0 * l0) / (2 * l1 * d));
        this.legsWorld(P, key, F ? Ad + al : Ad - al, F ? Ad - ga : Ad + ga, A2);
    }
    makePose({ o = {}, plant = '', rest, fw, hw, rel = false }) {
        const P = this.pose(o);
        if (rest !== undefined) P.by = -(this.H - this.D.r * this.k * rest * (this.skel && !o.roll ? 1.45 : 1));
        if (fw && this.D.fl) this.legsWorld(P, 'FL', ...fw);
        if (hw) this.legsWorld(P, 'HL', ...hw);
        if (plant.includes('F') && this.D.fl) this.plant(P, 'FL', rel);
        if (plant.includes('H')) this.plant(P, 'HL', rel);
        return P;
    }

    /* -------------------------------------------------------------- build */

    build() {
        const c = this.c, J = this.j, add = this.adder(), grp = this.grp.bind(this);
        const sTex = c.stone ? stoneTex(c.skin, c.dark) : c.skin !== undefined ? scaleTex(c.skin, c.dark) : null;
        const bTex = c.stone || c.undead ? null : plateTex(c.belly, c.dark);
        const opt = c.stone ? { roughness: 1, flatShading: true } : { roughness: .6 };
        const M = this.M = {
            skin: c.skin === undefined ? mat(c.bone, { roughness: .7 }) : sTex ? mat(0xffffff, { ...opt, map: sTex }) : mat(c.skin, opt),
            plain: mat(c.skin ?? c.bone, opt),
            belly: bTex ? mat(0xffffff, { roughness: .55, map: bTex }) : mat(c.belly ?? c.bone, opt),
            dark: mat(c.dark, { roughness: .8 }),
            spine: mat(c.spine, { roughness: .5 }),
            horn: mat(c.horn, { roughness: .45 }),
            bone: mat(c.bone ?? 0xd8ccb0, { roughness: .75 }),
            claw: mat(c.stone ? c.dark : c.undead ? 0x2a2420 : 0x1e1a16, { roughness: .4 }),
            tooth: mat(c.stone ? 0x9a9894 : 0xf0e8d0, { roughness: .4 }),
            hole: mat(0x060404, { roughness: 1 })
        };
        J.body = grp(this.root, 0, this.H, 0);
        if (this.skel) this.buildSkeletonTorso(add, grp); else this.buildTorso(add, grp);
        this.buildLegs(add, grp);
        this.buildNeck(add, grp);
        if (this.kind === 'gargoyle') this.buildGoblinHead(add, grp);
        else this.buildHead(add, grp);
        this.buildTail(add, grp);
        this.buildWings();
        if (c.breath) this.buildBreath(grp);
    }

    buildTorso(add, grp) {
        const c = this.c, D = this.D, J = this.j, M = this.M, r = D.r * this.k, len = D.len, lich = c.undead === 'lich';
        const along = m => { m.rotation.x = Math.PI / 2; return m; };
        along(add(J.body, new THREE.CapsuleGeometry(r * (lich ? .82 : 1), len, 4, 10), M.skin, 0, lich ? .03 : 0, 0)).scale.set(.9, 1, .95);
        J.chest = grp(J.body, 0, .02, len * .32);                                                 // breathes
        along(add(J.chest, G.sph(r * 1.08, 12, 9), M.skin)).scale.set(.95, 1.05, 1.1);
        along(add(J.body, G.sph(r * .95, 10, 8), M.skin, 0, .02, -len * .38)).scale.set(.98, 1.1, 1);   // haunches
        if (lich) {                                                                               // open rib cage over a dark cavity
            along(add(J.body, G.sph(r * .8, 10, 8), M.belly, 0, -r * .3, .05)).scale.set(.8, 1.5, .7);
            for (let i = 0; i < 7; i++) {
                const z = len * .5 - i * len * .13, rr = r * (.95 - Math.abs(i - 2) * .05);
                const rib = add(J.body, G.torus(rr, r * .055, 4, 10, Math.PI * 1.15), M.bone, 0, 0, z);
                rib.rotation.set(.25, 0, -Math.PI / 2 - Math.PI * .575);
                rib.scale.set(.95, 1, 1);
            }
            add(J.body, G.box(r * .2, r * .12, len * .9), M.bone, 0, -r * .98, .1);             // sternum
            for (let i = 0; i < 5; i++) add(J.body, G.sph(r * .2, 6, 5), M.dark, (i % 2 - .5) * r * .9, r * .5, len * .4 - i * len * .2).scale.set(1, .5, 1.4);  // rot patches
        } else {
            along(add(J.body, G.sph(r, 12, 8), M.belly, 0, -r * .42, .04)).scale.set(.78, (len + 2 * r) / (2 * r) * .92, .62);
        }
        if (this.kind === 'gargoyle') {                                                           // hunched shoulders
            for (const s of [1, -1]) add(J.body, G.sph(r * .65, 8, 6), M.skin, s * r * .55, r * .35, len * .3).scale.set(1, .9, 1.2);
        }
        // dorsal spikes
        const n = Math.round((len + r * 1.4) / (this.kind === 'gargoyle' ? .06 : .1));
        for (let i = 0; i < n; i++) {
            const z = len / 2 + r * .5 - i * (len + r * 1.2) / (n - 1), h = r * (this.kind === 'gargoyle' ? .2 : c.elder ? .62 : .42) * (1 - Math.abs(i / (n - 1) - .4) * .5);
            const sp = add(J.body, G.cone(h * .32, h, 4), this.kind === 'gargoyle' ? M.dark : M.spine, 0, r * .9, z);
            sp.rotation.x = -.5;
            sp.scale.x = .45;
        }
    }

    buildSkeletonTorso(add, grp) {
        const D = this.D, J = this.j, M = this.M, r = D.r, len = D.len;
        const n = 13;
        for (let i = 0; i < n; i++) {                                                             // spine with dark spines
            const z = len / 2 + r * .55 - i * (len + r * 1.1) / (n - 1);
            add(J.body, G.box(r * .26, r * .24, r * .28), M.bone, 0, r * .62, z);
            const sp = add(J.body, G.cone(r * .07, r * .5 * (1 - Math.abs(i / n - .4) * .6), 4), M.spine, 0, r * .9, z);
            sp.rotation.x = -.45;
        }
        for (let i = 0; i < 8; i++) {                                                             // rib cage
            const z = len * .5 - i * len * .1, rr = r * (.68 + .3 * Math.sin(Math.PI * (i + 1.2) / 9));
            const rib = add(J.body, G.torus(rr, r * .045, 4, 12, Math.PI * 1.7), M.bone, 0, r * .62 - rr, z);
            rib.rotation.set(.3, 0, Math.PI / 2 + Math.PI * .15);
            rib.scale.set(.92, 1, 1);
        }
        add(J.body, G.box(r * .18, r * .1, len * .7), M.bone, 0, -r * .72, len * .18).rotation.x = -.1;   // sternum
        for (const s of [1, -1]) {
            add(J.body, G.box(r * .08, r * .7, r * .5), M.bone, s * r * .55, r * .2, D.hip[0][1] + .02).rotation.z = s * .25;   // shoulder blades
            add(J.body, G.box(r * .1, r * .55, r * .7), M.bone, s * r * .45, r * .25, D.hip[1][1]).rotation.z = s * .4;        // pelvis
        }
        add(J.body, G.box(r * .9, r * .16, r * .3), M.bone, 0, r * .05, D.hip[1][1]);
    }

    buildLegs(add, grp) {
        const D = this.D, J = this.j, M = this.M, k = this.k, skel = this.skel, garg = this.kind === 'gargoyle';
        const flesh = skel ? M.bone : M.skin;
        for (const name of this.legNames) {
            const F = name[0] === 'F', side = name[1] === 'L' ? 1 : -1, i = F ? 0 : 1;
            const [l0, l1, l2] = F ? D.fl : D.hl, R = D.legR[i] * k, [hy, hz] = D.hip[i];
            const top = grp(J.body, side * D.legX[i] * k, hy, hz), knee = grp(top, 0, -l0, 0), low = grp(knee, 0, -l1, 0), toe = grp(low, 0, -l2, 0);
            // bones of the dragonlich's fore-legs show through
            const m = skel || (this.c.undead === 'lich' && F) ? M.bone : flesh, thin = skel || (this.c.undead === 'lich' && F) ? .45 : 1;
            if (thin === 1) add(top, G.sph(R * 1.55, 8, 6), m, 0, -l0 * .22, 0).scale.set(.85, 1.35, 1.15);   // muscle
            else add(top, G.sph(R * .7, 6, 5), m);
            add(top, G.cyl(R * .8 * thin, R * 1.05 * thin, l0, 7), m, 0, -l0 / 2, 0);
            add(knee, G.sph(R * .8 * (thin < 1 ? .8 : 1), 7, 5), m);
            add(knee, G.cyl(R * .6 * thin, R * .78 * thin, l1, 7), m, 0, -l1 / 2, 0);
            add(low, G.sph(R * .6, 6, 5), m);
            add(low, G.cyl(R * .5 * (thin < 1 ? .7 : 1), R * .58 * (thin < 1 ? .7 : 1), l2, 6), m, 0, -l2 / 2, 0);
            // foot (sole at the toe group origin, kept level)
            add(toe, G.sph(R * .95, 7, 5), skel ? M.bone : M.skin, 0, R * .42, R * .45).scale.set(1.1, .45, 1.35);
            const claws = garg && F ? 4 : 3, cl = (garg && F ? 1.4 : 1) * R;
            for (let t = 0; t < claws; t++) {
                const a = (t / (claws - 1) - .5) * 1.1;
                if (skel || garg) {                                                              // toe bones / long fingers
                    const tb = add(toe, G.cyl(R * .14, R * .2, cl * 1.1, 5), skel ? M.bone : M.skin, Math.sin(a) * R * .9, R * .25, R * .5 + Math.cos(a) * cl * .55);
                    tb.rotation.set(Math.PI / 2, 0, -a);
                }
                const cw = add(toe, G.cone(R * .17, cl * .85, 5), M.claw, Math.sin(a) * R * 1.2, R * .2, R * .45 + Math.cos(a) * cl * 1.15);
                cw.rotation.set(Math.PI / 2 + .45, 0, -a);
            }
            if (!F) add(toe, G.cone(R * .15, R * .6, 4), M.claw, 0, R * .5, -R * .55).rotation.x = -Math.PI / 2 - .4;   // dew claw
            J[name] = { top, knee, low, toe, hind: !F, side, key: F ? 'FL' : 'HL' };
        }
    }

    buildNeck(add, grp) {
        const D = this.D, J = this.j, M = this.M, c = this.c, skel = this.skel, k = this.k;
        const [n, L, r0, r1] = D.neck;
        J.neck = grp(J.body, 0, D.neckAt[0], D.neckAt[1]);
        J.neckSeg = [];
        this.neckR = [];
        let p = J.neck;
        for (let i = 0; i < n; i++) {
            const g = grp(p, 0, i === 0 ? 0 : L, 0), ra = (r0 + (r1 - r0) * i / n) * k, rb = (r0 + (r1 - r0) * (i + 1) / n) * k;
            if (skel) {
                add(g, G.cyl(ra * .38, ra * .42, L * .8, 6), M.bone, 0, L * .5, 0);
                add(g, G.box(ra * .9, ra * .22, ra * .3), M.bone, 0, L * .5, 0);
                add(g, G.cone(ra * .14, ra * .9, 4), M.spine, 0, L * .5, -ra * .55).rotation.x = -1.1;
            } else {
                add(g, G.sph(ra, 8, 6), M.skin);
                add(g, G.cyl(rb, ra, L * 1.04, 8), M.skin, 0, L / 2, 0);
                if (c.undead !== 'lich' || i % 2) add(g, G.cyl(rb * 1.04, ra * 1.04, L * .9, 6, true, -Math.PI / 2, Math.PI), M.belly, 0, L / 2, 0);   // throat
                else add(g, G.box(ra * .5, L * .8, ra * .5), M.bone, 0, L / 2, -ra * .75);         // exposed vertebra
                const sp = add(g, G.cone(ra * .2, ra * (this.kind === 'gargoyle' ? .4 : .75), 4), M.spine, 0, L * .5, -rb * .85);
                sp.rotation.x = -1.1;
                sp.scale.x = .5;
            }
            J.neckSeg.push(g);
            this.neckR.push(ra);
            p = g;
        }
        J.head = grp(p, 0, L, 0);
        J.head.rotation.order = 'YXZ';
    }

    // long reptile head: skull, tapering snout, brow ridges, swept-back horns, frill spikes
    buildHead(add, grp) {
        const c = this.c, J = this.j, M = this.M, skel = this.skel, lich = c.undead === 'lich', wy = this.kind === 'wyvern';
        const hs = this.D.head * (c.headK || 1);
        const H = grp(J.head);
        H.scale.setScalar(hs);
        this.headLen = .3 * hs;
        const sk = skel || lich ? M.bone : M.skin, sn = wy ? .8 : 1;
        add(H, G.sph(.085, 10, 8), sk, 0, .035, 0).scale.set(1, .85, 1.2);                      // cranium
        add(H, G.cyl(.042 * sn, .06 * sn, .2, 8), sk, 0, .012, .15).rotation.x = Math.PI / 2;   // snout
        H.children[H.children.length - 1].scale.set(1.05, 1, .66);
        add(H, G.sph(.042 * sn, 8, 6), sk, 0, .014, .25).scale.set(1, .62, .8);                 // nose tip
        if (lich) {                                                                                // rags of flesh on the skull
            add(H, G.sph(.07, 8, 6), M.skin, .02, .05, -.03).scale.set(1.2, .7, 1.1);
            add(H, G.box(.05, .02, .1), M.skin, -.015, .042, .14).rotation.z = .2;
        }
        for (const s of [1, -1]) {
            add(H, G.box(.04, .022, .09), skel || lich ? M.bone : M.dark, s * .05, .078, .05).rotation.set(-.15, -s * .25, s * .2);   // brow ridge
            add(H, G.sph(.008, 5, 4), M.hole, s * .02 * sn, .03, .27);                            // nostril
        }
        // eyes: amber with a slit; dragonlich ghost glow; skeleton empty sockets
        J.eyes = [];
        for (const s of [1, -1]) {
            if (skel) { add(H, G.sph(.026, 7, 5), M.hole, s * .052, .048, .065).scale.set(.7, 1, 1.2); continue; }
            if (c.ghost) {
                add(H, G.sph(.024, 7, 5), M.hole, s * .052, .048, .065).scale.set(.7, 1, 1.2);
                const e = new THREE.Mesh(G.sph(.014, 6, 5), glowMat(c.eye, .95));
                e.position.set(s * .058, .048, .068);
                H.add(e);
                if (typeof document !== 'undefined') { const h = haloSprite(c.eye, .09, .7); h.position.copy(e.position); H.add(h); }
                J.eyes.push(e);
                continue;
            }
            const e = add(H, G.sph(.018, 8, 6), mat(c.eye, { roughness: .2, emissive: c.eye, emissiveIntensity: .6 }), s * .055, .05, .068);
            e.scale.set(.7, .8, 1);
            add(H, G.box(.004, .02, .006), M.hole, s * .067, .05, .07);
            J.eyes.push(e);
        }
        // upper teeth
        for (const s of [1, -1]) for (let i = 0; i < (wy ? 6 : 4); i++) {
            add(H, G.cone(.006, wy ? .03 : .028, 4), M.tooth, s * .036 * sn, -.018, .1 + i * (wy ? .028 : .04)).rotation.x = Math.PI;
        }
        // lower jaw
        J.jaw = grp(H, 0, -.025, .02);
        add(J.jaw, G.cyl(.03 * sn, .048 * sn, .23, 7), skel || lich ? M.bone : M.belly, 0, -.012, .11).rotation.x = Math.PI / 2;
        J.jaw.children[0].scale.set(1, 1, .55);
        for (const s of [1, -1]) for (let i = 0; i < (wy ? 5 : 3); i++) add(J.jaw, G.cone(.005, .022, 4), M.tooth, s * .028 * sn, .006, .08 + i * (wy ? .03 : .045));
        if (c.elder) for (let i = 0; i < 3; i++) {                                                // chin spikes
            const sp = add(J.jaw, G.cone(.008, .06, 4), M.horn, (i - 1) * .02, -.03, .04 - Math.abs(i - 1) * .02);
            sp.rotation.x = Math.PI - .9;
        }
        // horns and frill
        const hl = .3 * (c.horns ?? 1);
        for (const s of [1, -1]) {
            add(H, backHorn(hl, .022, s, .55, .25), M.horn, s * .045, .08, -.02);
            if (c.elder) {
                add(H, backHorn(hl * .65, .016, s, .2, .55), M.horn, s * .065, .05, -.03);
                add(H, backHorn(hl * .4, .012, s, .9, .4), M.horn, s * .03, .1, .03);
            }
            for (let i = 0; i < (c.elder ? 4 : 3); i++) {                                       // cheek frill
                const sp = add(H, G.cone(.009, .07 + i * .012, 4), skel ? M.spine : M.horn, s * (.065 + i * .006), .0 - i * .022, -.03 - i * .012);
                sp.rotation.set(-Math.PI / 2 - .3 + i * .1, 0, s * .5);
            }
        }
        if (wy) for (let i = 0; i < 5; i++) {                                                    // wyvern: fan of long pale crest spikes
            const a = (i - 2) * .32;
            const sp = add(H, G.cone(.01, .17 - Math.abs(i - 2) * .02, 4), M.horn, Math.sin(a) * .05, .07 + Math.cos(a) * .02, -.05);
            sp.rotation.set(-Math.PI / 2 - .55, 0, -a * 1.2);
        }
        for (let i = 0; i < 3; i++) add(H, G.cone(.008, .04, 4), skel ? M.spine : M.horn, 0, .1 - i * .01, -.04 - i * .03).rotation.x = -1.2;
        this.mouth = [0, -.025, .26];
        this.headPts = [[0, .29], [-.05, -.08], [-.04, .02]];                                  // [y, z]: nose, back of the skull, jaw hinge
        this.jawLen = .24;
    }

    // gargoyle: goblin head with pointed ears, curled horns, heavy brow and a fanged grin
    buildGoblinHead(add, grp) {
        const c = this.c, J = this.j, M = this.M;
        const H = grp(J.head, 0, .03, 0);
        H.scale.setScalar(1.35);
        this.headLen = .2;
        add(H, G.sph(.075, 9, 7), M.skin, 0, .02, 0).scale.set(1, .95, 1);                     // skull
        add(H, G.sph(.05, 8, 6), M.skin, 0, -.02, .065).scale.set(1.25, .8, .9);               // muzzle
        add(H, G.box(.12, .025, .04), M.skin, 0, .05, .055).rotation.x = -.2;                  // brow
        add(H, G.cone(.016, .04, 4), M.skin, 0, .0, .115).rotation.x = Math.PI / 2 + .6;       // nose
        J.eyes = [];
        for (const s of [1, -1]) {
            J.eyes.push(add(H, G.sph(.011, 6, 5), mat(c.eye, { emissive: c.eye, emissiveIntensity: .7 }), s * .03, .032, .072));
            const ear = add(H, G.cone(.025, .11, 4), M.skin, s * .085, .03, -.01);              // long pointed ear
            ear.rotation.set(-.4, 0, -s * 1.25);
            ear.scale.z = .4;
            add(H, backHorn(.1, .012, s, .9, .5), M.horn, s * .04, .08, .0);                    // small curled horns
            for (let i = 0; i < 2; i++) add(H, G.cone(.006, .035, 4), M.tooth, s * (.022 + i * .018), -.035, .1 - i * .01).rotation.x = Math.PI;   // fangs
        }
        J.jaw = grp(H, 0, -.035, .03);
        add(J.jaw, G.sph(.045, 8, 6), M.skin, 0, -.012, .035).scale.set(1.3, .5, 1.1);
        for (const s of [1, -1]) add(J.jaw, G.cone(.006, .03, 4), M.tooth, s * .03, .008, .065);
        this.mouth = [0, -.04, .12];
        this.headPts = [[0, .17], [-.02, -.08], [0, .04]];
        this.jawLen = .09;
    }

    buildTail(add, grp) {
        const D = this.D, J = this.j, M = this.M, c = this.c, skel = this.skel, k = this.k;
        const [n, L, r0] = D.tail;
        J.tailRoot = grp(J.body, 0, D.tailAt[0], D.tailAt[1]);
        J.tail = [];
        this.tailR = [];
        let p = J.tailRoot;
        for (let i = 0; i < n; i++) {
            const ra = r0 * k * (1 - i / n * .9), rb = r0 * k * (1 - (i + 1) / n * .9), g = grp(p);
            if (skel) {
                add(g, G.box(ra * .8, ra * .65, L * .7), M.bone, 0, 0, -L / 2);
                if (i % 2 === 0) add(g, G.cone(ra * .2, ra * 1.1, 4), M.spine, 0, ra * .5, -L / 2).rotation.x = -.6;
            } else {
                add(g, G.cyl(rb, ra, L * 1.04, 7), c.undead === 'lich' && i % 3 === 2 ? M.bone : M.skin, 0, 0, -L / 2).rotation.x = -Math.PI / 2;
                if (i > 0) add(g, G.sph(ra, 7, 5), M.skin);
                if (this.kind !== 'gargoyle' || i % 2 === 0) {
                    const sp = add(g, G.cone(ra * .3, ra * .8 + .015, 4), M.spine, 0, ra * .85, -L / 2);
                    sp.rotation.x = -.6;
                    sp.scale.x = .5;
                }
            }
            J.tail.push(g);
            this.tailR.push(ra);
            p = grp(g, 0, 0, -L);
        }
        const tr = r0 * k * .1;
        if (this.kind === 'wyvern') {                                                             // poison sting
            add(p, G.sph(tr * 2.4, 7, 5), M.skin, 0, 0, -tr * 1.5).scale.set(1, 1, 1.6);
            const st = add(p, G.cone(tr * 1.1, tr * 7, 6), mat(c.sting, { roughness: .35 }), 0, tr * 1.5, -tr * 6);
            st.rotation.x = -Math.PI / 2 + .5;
        } else if (this.kind === 'dragon') {                                                      // spiked tail tip
            const m = skel ? M.bone : M.spine;
            add(p, G.cone(tr * 2.4, tr * 9, 4), m, 0, 0, -tr * 4).rotation.x = -Math.PI / 2;
            for (const s of [1, -1]) add(p, G.cone(tr, tr * 5, 4), m, s * tr * 1.5, 0, -tr).rotation.set(-Math.PI / 2, 0, -s * .7);
        } else add(p, G.cone(tr * 2.5, tr * 6, 4), M.skin, 0, 0, -tr * 2).rotation.x = -Math.PI / 2;
    }

    buildWings() {
        const c = this.c, D = this.D, k = this.k, M = this.M;
        let skin = null;
        if (!this.skel || c.torn) {
            const tex = membraneTex(c);
            const o = { side: THREE.DoubleSide, roughness: .85, flatShading: true, emissive: c.membrane, emissiveIntensity: c.stone ? 0 : .18 };
            skin = tex ? mat(0xffffff, { ...o, map: tex, alphaTest: c.torn ? .5 : 0 }) : mat(c.membrane, o);
        }
        const w = D.wing, sc = k * (c.wingK || 1);
        this.wings = [1, -1].map(s => makeDragonWing(this.j.body, s, {
            len: w.len * sc, at: w.at.map(v => v * k), hip: w.hip, flank: w.flank, bone: w.bone,
            boneMat: this.skel || c.undead ? M.bone : c.stone ? M.skin : M.dark, clawMat: M.claw, skinMat: skin, poses: WING_POSES[this.kind]
        }));
    }

    // breath: nested additive cones from the mouth plus rolling puffs
    buildBreath(grp) {
        const c = this.c, J = this.j, [outer, mid, core] = c.breath;
        const g = J.breath = grp(J.jaw.parent, ...this.mouth);
        const len = .95;
        this.breathCones = [
            new THREE.Mesh(breathCone(.22, len), glowMat(outer, .38)),
            new THREE.Mesh(breathCone(.13, len * .8), glowMat(mid, .42)),
            new THREE.Mesh(breathCone(.05, len * .45), glowMat(core, .7))
        ];
        this.breathPuffs = [];
        for (let i = 0; i < 7; i++) {
            const m = new THREE.Mesh(puffGeo(), glowMat(i % 2 ? mid : outer, .4));
            m.userData.seed = i * 1.37;
            this.breathPuffs.push(m);
        }
        for (const m of [...this.breathCones, ...this.breathPuffs]) { m.renderOrder = 2; g.add(m); }
        if (typeof document !== 'undefined') { const h = haloSprite(mid, .45, .8); g.add(h); }
        g.traverse(m => { m.raycast = () => {}; });
        g.visible = false;
    }

    /* -------------------------------------------------------------- animation */

    statePose(state, c, t) {
        const P = this.P;
        this.breath = 0;
        switch (state) {
            case 'attack': {
                const dur = c.actionDuration || 1;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / 1) % 1;
                let Q = this.mix(this.STAND, P.wind, smooth(p / .3));
                if (p > .3) Q = this.mix(Q, P.strike, smooth((p - .3) / .14));
                if (p > .56) Q = this.mix(Q, P.bite, smooth((p - .56) / .07));
                if (p > .72) Q = this.mix(Q, this.STAND, smooth((p - .72) / .28));
                if (this.c.breath) this.breath = smooth((p - .32) / .08) * (1 - smooth((p - .52) / .07));
                return Q;
            }
            case 'defend': {
                const Q = { ...P.defend };
                Q.jaw += Math.sin(t * 5) * .06;
                Q.by += Math.sin(t * 2.4) * .01;
                return Q;
            }
            case 'hit': return P.hit;
            case 'kneel': return P.kneel;
            case 'lie': return P.lie;
            case 'death': return P.dead;
            case 'walk': return P.walk || this.STAND;
            case 'run': return P.run;
            default: {
                const Q = this.idlePose();
                Q.by += Math.sin(t * 1.3) * .006;
                Q.neckY += Math.sin(t * .45) * .12;
                Q.nS += Math.sin(t * .8) * .06;
                return Q;
            }
        }
    }

    animateExtras(q, state, t, dt, g, run) {
        const J = this.j, D = this.D, dead = state === 'death', still = dead || state === 'lie' || state === 'kneel';
        const cr = Math.cos(q.roll), cb = Math.cos(q.bx), sb = Math.sin(q.bx), Yc = this.H + q.by;
        if (J.chest) { const b = Math.sin(t * 1.3) * (dead ? 0 : 1); J.chest.scale.set(1 + b * .025, 1 + b * .035, 1); }
        // feet level with the ground
        for (const name of this.legNames) {
            const L = J[name];
            L.toe.rotation.x = dead ? 0 : Math.max(-1.6, Math.min(1.6, -(q.bx + L.top.rotation.x + L.knee.rotation.x + L.low.rotation.x)));
        }

        // neck: S-curve + sway, kept above the ground (body plane; roll squeezes heights)
        const [, L] = D.neck, prof = D.neckProf, n = J.neckSeg.length;
        const sway = dead ? 0 : Math.sin(t * .7) * (state === 'idle' ? .05 : .02) + (state === 'defend' ? Math.sin(t * 2) * .03 : 0);
        let A = q.bx + q.neckX, y = Yc + (D.neckAt[0] * cb - D.neckAt[1] * sb) * cr;
        J.neckSeg.forEach((seg, i) => {
            let rx = q.nS * prof[i] + (state === 'idle' ? Math.sin(t * 1.1 - i * .5) * .015 : 0);
            A += rx;
            const lo = this.neckR[i] * .9, ye = y + L * Math.cos(A) * cr;
            if (ye < lo + .01 && cr > .3) {
                const A2 = Math.acos(Math.max(-1, Math.min(1, (lo + .01 - y) / (L * cr)))) * Math.sign(A || 1);
                rx += A2 - A; A = A2;
            }
            y += L * Math.cos(A) * cr;
            seg.rotation.set(rx, 0, sway * (i + 1) / n);
        });
        // head: headX is the pitch relative to the body; nose / skull / chin stay above the ground
        let hp = q.headX - (A - q.bx);
        const jawA = J.jaw ? J.jaw.rotation.x : 0, hs = this.D.head;
        for (let it = 0; it < 3; it++) {
            const Ch = A + hp;
            const [[ny, nz], [by, bz], [jy, jz]] = this.headPts, c0 = Math.cos(Ch), s0 = Math.sin(Ch);
            const cy = jy - this.jawLen * Math.sin(jawA), cz = jz + this.jawLen * Math.cos(jawA);
            const low = Math.min(ny * c0 - nz * s0, by * c0 - bz * s0, cy * c0 - cz * s0) * hs;
            const yy = y + low * cr;
            if (yy >= .015 || cr < .3) break;
            hp -= (.015 - yy) / (this.headLen * cr) * 1.1;
        }
        J.head.rotation.x = hp;

        // tail: droop, curl and swish; segments rise where they would touch the ground
        const [nt, Lt] = D.tail;
        const swish = dead ? 0 : (state === 'defend' ? .1 : state === 'idle' ? .06 : still ? .015 : .04);
        const freq = state === 'defend' ? 3 : 1.2;
        J.tailRoot.rotation.x = q.tailX;
        let At = q.bx + q.tailX, yt = Yc + (D.tailAt[0] * cb - D.tailAt[1] * sb) * cr;
        J.tail.forEach((seg, i) => {
            const f = i / nt;
            let rx = q.tailC * (i < 3 ? -.5 : 1) * (1 + f);
            At += rx;
            const lo = this.tailR[i] * .9 + .005, ye = yt + Lt * Math.sin(At) * cr;
            if (ye < lo && cr > .3) {
                const A2 = Math.asin(Math.max(-1, Math.min(1, (lo - yt) / (Lt * cr))));
                rx += A2 - At; At = A2;
            }
            yt += Lt * Math.sin(At) * cr;
            seg.rotation.set(rx, Math.sin(t * freq - i * .45) * swish * (.4 + f) + q.tailY - Math.sin(this.phase - i * .4) * .05 * g, 0);
        });

        // wings
        let wF = q.wF, sw = 0;
        if (state === 'run' && q.wS > .1) wF += Math.sin(this.phase) * .35;
        if (state === 'defend') wF += Math.sin(t * 2.4) * .12;
        if (this.wingK === null) this.wingK = q.wS;
        this.wings.forEach((w, i) => {
            if (q.wG > .01) sw = Math.sin(this.phase + (i ? Math.PI : 0) + Math.PI / 2) * .35 * g * q.wG;
            // dying: the lower wing stays folded under the body, the upper one flops over onto the ground
            const roll = Math.max(0, q.roll / 1.3);
            w.set(i === 1 ? q.wS * (1 - roll) : q.wS, wF, q.wG, sw, roll, i === 0 ? 1.45 : .6);
        });

        // breath
        if (J.breath) {
            this.breathK = damp(this.breathK, this.breath, 25, dt);
            const b = this.breathK;
            J.breath.visible = b > .02;
            if (J.breath.visible) {
                J.breath.rotation.x = q.jaw * .2 - .12;
                J.breath.scale.set(.5 + .5 * b, .5 + .5 * b, b);
                this.breathCones.forEach((m, i) => {
                    const fl = 1 + Math.sin(t * (17 + i * 5)) * .08 + Math.sin(t * 7.3 + i) * .05;
                    m.scale.set(fl, fl, 1 + Math.sin(t * 13 + i * 2) * .06);
                });
                this.breathPuffs.forEach(m => {
                    const s = m.userData.seed, f = (t * 2.6 + s * .37) % 1;
                    m.position.set(Math.sin(s * 3 + t * 9) * .09 * f, Math.cos(s * 2 + t * 7) * .07 * f, .1 + f * .8);
                    m.scale.setScalar(.03 + f * .11);
                    m.rotation.set(t * 3 + s, t * 2, 0);
                });
            }
        }
    }
}
