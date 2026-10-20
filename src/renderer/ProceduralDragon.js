import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';
import { QuadrupedRig, BASE_STAND, smooth, damp } from './QuadrupedRig.js';
import { taperTube, glowMat } from './creatureParts.js';
import { haloSprite } from './LightProps.js';

/*
 * ProceduralDragon — dragons and their kin: adult / young / elder dragon, dragonlich (charred undead dragon with the
 * rib cage open over raw flesh, bony fore-legs and tail, ghostly eyes), skeleton dragon (bones only, empty eye sockets,
 * black spines, tattered wings), wyvern (two legs, the bat wings serve as fore-limbs, long tail with a sting) and
 * gargoyle (crouching stone beast with a goblin head and bat wings).
 *
 *   root (yaw, scale)
 *   └─ body (pitch bx: the wyvern and the gargoyle carry the chest high) — torso: one smooth loft (belly plates, darker back)
 *      ├─ legs top ─ knee ─ low ─ toe (lofted muscles; the toe group keeps the foot flat on the ground); planted poses
 *      │  are solved by a small two-bone IK (plant()) so the feet stay on the ground while the body rears, lunges or crouches
 *      ├─ neck ─ neck segments (S-curve, pose key nS) ─ head ─ jaw, breath (fire / sickly green / steam cone)
 *      │  the neck skin is one skinned tube over body, segments and head, so it bends smoothly and grows out of the chest
 *      ├─ tailRoot ─ tail segments (droop tailC, sideways curl tailY, swish), also one skinned tube
 *      └─ wings: shoulder (pitch) ─ arm ─ elbow ─ hand ─ 4 fingers; the membrane is one small mesh whose corners are
 *         moved every frame onto the bones (it folds with them), torn ones have holes (alpha-tested canvas texture)
 *   Neck, head and tail are kept above the ground by a cheap solver in the body plane (lying, dying, lunging).
 *
 * States: idle (breathing, neck sway, tail swish, wings folded high), walk, run (wings half open, beating), attack
 * (rears the neck back, claw raised → lunges with the long neck, breath from the open jaws → bite snap → recover;
 * skeleton, wyvern and gargoyle only bite and claw), defend (rears up, wings spread high, roar), hit (flinch), kneel
 * (crouched on the belly, head up), lie (on the belly, head on the ground, tail curled), death (rolls on its side, wing
 * limp, neck on the ground). Animation: QuadrupedRig.
 * Sizes (nose to tail tip): the adult dragon ~12.5 m long and ~5 m tall, the young one ~8 m, the elder ~16 m.
 */

export const DRAGON_VARIANTS = {
    // teal-green scales, gold belly plates and frills, glowing orange membrane, fire
    dragon: { kind: 'dragon', scale: 2.35, skin: 0x2a6658, dark: 0x12322c, belly: 0xd29a3a, spine: 0xd88a26, horn: 0x3a2c1e,
        membrane: 0xb8662a, vein: 0x4a2412, eye: 0xffb020, breath: [0xff4a10, 0xff9a28, 0xfff0b0] },
    // sage green, pale gold belly, amber membrane, long slender horns
    'dragon-young': { kind: 'dragon', scale: 1.5, skin: 0x6e8a70, dark: 0x34483a, belly: 0xdcc890, spine: 0xb89a5a, horn: 0x3a3226,
        membrane: 0xc68a4a, vein: 0x6a4424, eye: 0xf0a020, horns: 1.05, bulk: .9, breath: [0xff5a14, 0xffa030, 0xfff0b0] },
    // deep blue to teal, pale teal belly, blue-green membrane, crown of horns, scalding steam
    'dragon-elder': { kind: 'dragon', scale: 2.9, skin: 0x1f4f7c, dark: 0x0e2238, belly: 0x76b4b0, spine: 0x3a9ab0, horn: 0x1c2430,
        membrane: 0x2c6474, vein: 0x0e1e2a, eye: 0x9ae8ff, horns: 1.2, elder: true, bulk: 1.04, tailK: 1.15, breath: [0x3a7aff, 0x9ad0ff, 0xf4fbff] },
    dragonlich: { kind: 'dragon', undead: 'lich', scale: 2.2, skin: 0x2e2b2a, dark: 0x121010, belly: 0x7a1e18, bone: 0xd8ccb0, spine: 0x1c1919,
        horn: 0x262222, membrane: 0x3e2a24, vein: 0x140c0a, eye: 0x8aff6a, ghost: true, torn: .45, bulk: .92, breath: [0x2a9a20, 0x7aff50, 0xe0ffd0] },
    'skeleton-dragon': { kind: 'dragon', undead: 'skeleton', scale: 2.4, bone: 0xd8cdb4, dark: 0x1e1c1e, spine: 0x1e1c1e, horn: 0x1e1c1e,
        membrane: 0x3a302c, vein: 0x151214, torn: .75 },
    // charcoal-navy scales, cream belly and crest, spotted cream membrane, poison sting
    wyvern: { kind: 'wyvern', scale: 1.2, skin: 0x2c313c, dark: 0x14171e, belly: 0xd8cbb0, spine: 0xe0d6c0, horn: 0xe0d6c0,
        membrane: 0xd8c6a2, vein: 0x4a3a2c, spots: 0x2e241c, eye: 0xff6a20, sting: 0x1a1816 },
    gargoyle: { kind: 'gargoyle', scale: .75, skin: 0x86847e, dark: 0x4c4a48, belly: 0x96948e, spine: 0x5e5c58, horn: 0x6a6864,
        membrane: 0x6e6862, vein: 0x3c3a38, eye: 0xd8341c, stone: true }
};

// metres at scale 1: torso sections [z, half width, half height, centre y] and belly depth `low`, body height and pitch,
// hips [y, z] (fore, hind), legs (upper, lower, foot), foot z offset from the hip, world angle of the foot bone,
// neck [segments, length, base / top radius] and its S-curve, tail [segments, length, base radius], wing (length,
// shoulder, membrane corners on the flank and hip, poses)
const KINDS = {
    dragon: {
        r: .27, len: .7, low: .35, H: .74, hip: [[-.06, .36], [-.01, -.34]], legX: [.19, .2], legR: [.08, .095],
        torso: [[-.78, .04, .04, .06], [-.64, .17, .19, .04], [-.44, .245, .27, .01], [-.18, .24, .27, -.02], [.1, .275, .315, -.04],
            [.34, .275, .3, -.01], [.52, .215, .245, .05], [.66, .12, .14, .11], [.74, .03, .03, .12]],
        fl: [.31, .3, .1], hl: [.33, .32, .17], foot: [.05, .03], toeA: [0, -.3],
        neckAt: [.13, .5], neck: [6, .14, .155, .085], neckProf: [.35, .25, 0, -.25, -.4, -.45],
        head: 1.3, tailAt: [.04, -.6], tail: [12, .17, .16],
        wing: { len: 1.75, at: [.12, .22, .3], hip: [.16, .06, -.46], flank: [.21, .15, -.08], bone: .02 },
        gait: { walk: 1.2, run: 2.4, amp: .36, ampRun: .38, lift: .7 }
    },
    wyvern: {
        r: .19, len: .5, low: .22, H: .72, hip: [null, [-.03, -.1]], legX: [0, .15], legR: [0, .08],
        torso: [[-.44, .03, .03, .03], [-.34, .13, .14, .02], [-.16, .17, .19, 0], [.04, .185, .22, -.02], [.22, .175, .205, 0],
            [.36, .12, .14, .05], [.45, .03, .03, .07]],
        fl: null, hl: [.31, .3, .15], foot: [0, .06], toeA: [0, -.3],
        neckAt: [.08, .36], neck: [5, .12, .1, .055], neckProf: [.3, .2, -.05, -.3, -.4],
        head: 1.1, tailAt: [.02, -.38], tail: [13, .14, .1],
        wing: { len: 1.45, at: [.1, .13, .2], hip: [.12, -.04, -.26], flank: [.15, .06, -.02], bone: .022 },
        gait: { walk: .95, run: 1.8, amp: .45, ampRun: .3, lift: .8 }
    },
    gargoyle: {
        r: .15, len: .26, low: .15, H: .48, hip: [[.06, .2], [-.02, -.15]], legX: [.18, .12], legR: [.045, .058],
        torso: [[-.3, .03, .03, 0], [-.22, .11, .12, 0], [-.08, .125, .13, -.01], [.08, .15, .145, .01], [.2, .17, .14, .05],
            [.3, .13, .1, .08], [.36, .07, .06, .09], [.39, .02, .02, .09]],
        fl: [.3, .3, .07], hl: [.22, .22, .12], foot: [.1, .06], toeA: [0, -.35],
        neckAt: [.07, .3], neck: [2, .07, .1, .075], neckProf: [.25, -.1],
        head: 1, tailAt: [0, -.26], tail: [11, .1, .06],
        wing: { len: 1.05, at: [.08, .12, .12], hip: [.1, -.02, -.2], flank: [.13, .05, -.05], bone: .028 },
        gait: { walk: .7, run: 1.3, amp: .4, ampRun: .35, lift: .8 }
    }
};

// wing joint angles: shoulder pitch, raise (up), sweep (back), roll (membrane down when folded), elbow / hand fold
const WING_POSES = {
    dragon: {
        fold: { pitch: 0, raise: .1, sweep: 1.1, roll: -1.2, elbow: 2.4, hand: 3.3 },
        open: { pitch: 0, raise: .3, sweep: .3, roll: .05, elbow: .55, hand: -.1 }
    },
    wyvern: {
        fold: { pitch: 0, raise: .1, sweep: 1.1, roll: -1.2, elbow: 2.4, hand: 3.3 },
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
// rest = belly on the ground (body lowered to this many belly depths), fw / hw = world angles of folded legs.
const EXTRA = { nS: 1, tailC: .03, tailY: 0, wS: 0, wF: 0, wG: 0 };
const POSES = {
    dragon: {
        stand: { o: { neckX: .5, headX: .35, jaw: .04, tailX: -.3, tailC: .035, wS: .22 }, plant: 'FH' },
        run: { o: { wS: .4, wF: .05, neckX: .75, headX: .2 }, plant: 'FH' },
        wind: { o: { by: .04, bz: -.1, bx: -.1, FRx: -.6, FRk: .9, neckX: -.05, nS: 1.5, headX: -.25, jaw: .4, wS: .4, wF: .25, tailX: -.15 }, plant: 'FH' },
        strike: { o: { by: -.05, bz: .22, bx: .14, FRx: .35, FRk: -.2, neckX: 1.25, nS: .1, headX: .2, jaw: .6, wS: .3, wF: -.1 }, plant: 'FH' },
        bite: { o: { by: -.03, bz: .18, bx: .1, neckX: 1.1, nS: .35, headX: .45, jaw: .02, wS: .2 }, plant: 'FH' },
        defend: { o: { by: .22, bz: -.15, bx: -.5, FRx: -.35, FRk: .3, neckX: .15, nS: 1.4, headX: .05, jaw: .6, wS: 1, wF: .45, tailX: -.05 },
            plant: 'H', fw: [-1, -1.7, -.6] },
        hit: { o: { by: -.02, bz: -.12, bx: -.08, neckX: .15, nS: 1.5, headX: -.1, jaw: .35, wS: .3, wF: .3 }, plant: 'FH' },
        kneel: { o: { neckX: .35, nS: 1.1, headX: .25, tailX: -.2, tailC: .02, tailY: .12, HLz: .2 }, rest: 1.0, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        lie: { o: { neckX: 1.4, nS: -.3, headX: .7, jaw: .02, tailX: -.2, tailC: .02, tailY: .16, HLz: .2, wS: 0 }, rest: .97, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        dead: { o: { roll: 1.3, FLz: -.15, HLz: -.15, neckX: 1.3, nS: -.4, headX: .3, jaw: .5, tailX: -.05, tailC: 0, tailY: 0, wS: .5, wF: -.3 }, rest: 1.0,
            fw: [-.3, .1, .3], hw: [.3, .6, .4] }
    },
    wyvern: {
        stand: { o: { bx: -.62, neckX: 1.1, nS: 1.4, headX: .75, jaw: .05, tailX: .35, tailC: .03, wS: .45 }, plant: 'H' },
        walk: { o: { bx: -.5, neckX: 1.15, nS: 1.4, headX: .7, jaw: .05, tailX: .3, tailC: .03, wG: 1 }, plant: 'H' },
        run: { o: { bx: -.35, neckX: 1.0, headX: .55, wG: .7, wS: .25 }, plant: 'H' },
        wind: { o: { bx: -.75, by: .06, bz: -.08, neckX: .5, nS: 1.6, headX: .7, jaw: .6, wG: .2, wS: .55, wF: .3, tailX: .7 }, plant: 'H' },
        strike: { o: { bx: -.2, by: -.08, bz: .22, neckX: 1.55, nS: .1, headX: .55, jaw: .9, wG: 0, wS: .6, wF: -.25, tailX: .2 }, plant: 'H' },
        bite: { o: { bx: -.25, by: -.07, bz: .2, neckX: 1.45, nS: .3, headX: .6, jaw: .02, wG: 0, wS: .5 }, plant: 'H' },
        defend: { o: { bx: -.85, by: .06, bz: -.08, neckX: .55, nS: 1.4, headX: .85, jaw: .7, wG: 0, wS: 1, wF: .5, tailX: .55 }, plant: 'H' },
        hit: { o: { bx: -.62, bz: -.1, neckX: .6, nS: 1.5, headX: .7, jaw: .4, wG: .5, wS: .3, wF: .2 }, plant: 'H' },
        kneel: { o: { bx: -.15, neckX: .8, headX: .4, wG: 0, tailY: .12, HLz: .2 }, rest: 1.0, hw: [-1.35, 1.45, -1.55] },
        lie: { o: { bx: 0, neckX: 1.4, nS: -.3, headX: .7, wG: 0, tailX: -.1, tailY: .16, HLz: .2 }, rest: 1.0, hw: [-1.35, 1.45, -1.55] },
        dead: { o: { bx: 0, roll: 1.3, HLz: -.15, neckX: 1.3, nS: -.4, headX: .3, jaw: .5, tailX: -.05, tailC: 0, tailY: 0, wG: 0, wS: .5, wF: -.3 }, rest: 1.1,
            hw: [.3, .6, .4] }
    },
    gargoyle: {
        stand: { o: { bx: -.6, by: -.07, neckX: .6, headX: .6, jaw: .22, tailX: .6, tailC: .02, tailY: .12, wS: .4 }, plant: 'FH' },
        walk: { o: { bx: -.25, neckX: .9, headX: .3 }, plant: 'FH', rel: true },
        run: { o: { bx: -.15, neckX: 1.0, headX: .25, wS: .3 }, plant: 'FH', rel: true },
        wind: { o: { bx: -.95, by: .05, FRx: -2.0, FRk: .4, neckX: .35, headX: .8, jaw: .5, wS: .5, wF: .2 }, plant: 'FH' },
        strike: { o: { bx: -.45, bz: .14, by: -.04, FRx: -.9, FRk: -.4, neckX: .8, nS: .6, headX: .55, jaw: .75, wS: .4 }, plant: 'FH' },
        bite: { o: { bx: -.5, bz: .12, by: -.04, FRx: -.4, neckX: .8, nS: .6, headX: .6, jaw: .05, wS: .3 }, plant: 'FH' },
        defend: { o: { bx: -1.05, by: .08, neckX: .4, headX: 1, jaw: .6, wS: 1, wF: .4, tailX: .4 }, plant: 'H', fw: [-1.6, -2.4, -2] },
        hit: { o: { bx: -.9, bz: -.06, neckX: .2, headX: .9, jaw: .35, wS: .3, wF: .2 }, plant: 'FH' },
        kneel: { o: { bx: -.8, by: -.06, neckX: .5, headX: .9, tailX: .5 }, plant: 'FH' },
        lie: { o: { bx: 0, neckX: 1.3, nS: -.2, headX: .5, tailX: -.1, tailY: .2, HLz: .2, wS: 0 }, rest: 1.0, fw: [1, -1.57, -1.57], hw: [-1.3, 1.2, -1.5] },
        dead: { o: { bx: 0, roll: 1.3, FLz: -.15, HLz: -.15, neckX: 1.3, nS: -.3, headX: .3, jaw: .4, tailX: -.05, tailC: 0, tailY: 0, wS: .45, wF: -.3 }, rest: 1.25,
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
// grey overlapping scales tinted by the vertex colours; u = once around a loft (0 = belly), v = along it.
// plates: the belly band (u < .17 or > .83) carries broad transverse plates instead.
const scaleTex = plates => canvasTex('gsc' + plates, 128, g => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    const cols = 24, rows = 6, cw = 128 / cols, rh = 128 / rows;
    for (let r = -1; r <= rows; r++) for (let c = -1; c <= cols; c++) {
        const x = (c + (r % 2 ? .5 : 0)) * cw, y = r * rh;
        const gr = g.createLinearGradient(0, y, 0, y + rh * 1.1);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(.75, '#d4d4d4'); gr.addColorStop(1, '#8a8a8a');
        g.fillStyle = gr; g.strokeStyle = '#6a6a6a'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, cw * .62, rh * 1.05, 0, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
    }
    if (plates) {
        for (const [x0, x1] of [[0, 22], [106, 128]]) {
            for (let y = 0; y < 128; y += 32) {
                const gr = g.createLinearGradient(0, y, 0, y + 32);
                gr.addColorStop(0, '#ffffff'); gr.addColorStop(.8, '#e6e6e6'); gr.addColorStop(1, '#9a9a9a');
                g.fillStyle = gr; g.fillRect(x0, y, x1 - x0, 32);
                g.fillStyle = '#707070'; g.fillRect(x0, y + 30, x1 - x0, 2);
            }
        }
    }
});
// weathered stone (grey, tinted by the vertex colours): speckles and hairline cracks
const stoneTex = () => canvasTex('gst', 128, (g, rnd) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
        const v = 150 + Math.floor(rnd() * 105);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.globalAlpha = .25 + rnd() * .35;
        g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.globalAlpha = .55; g.strokeStyle = '#5a5a5a'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
        let x = rnd() * 128, y = rnd() * 128;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 22; y += rnd() * 14; g.lineTo(x, y); }
        g.stroke();
    }
    g.globalAlpha = 1;
});
// wing membrane: veins (and spots); torn = ragged holes cut out (used with alphaTest)
const membraneTex = c => canvasTex('mb' + c.membrane + c.vein + (c.spots || 0) + (c.torn || 0), 128, (g, rnd) => {
    const gr = g.createLinearGradient(0, 0, 128, 128);
    gr.addColorStop(0, hex(new THREE.Color(c.membrane).multiplyScalar(.75)));
    gr.addColorStop(1, hex(c.membrane));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    if (c.spots) {
        g.fillStyle = hex(c.spots);
        for (let i = 0; i < 90; i++) {
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
const cachedGeo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
// cone with its tip at the origin opening along +z (breath)
const breathCone = (r, h) => cachedGeo('bc' + r + h, () => new THREE.ConeGeometry(r, h, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, h / 2));
const puffGeo = () => cachedGeo('puff', () => new THREE.IcosahedronGeometry(1, 0));
// horn / spike curving back from the origin (side s mirrors x)
const backHorn = (len, r, s, up = .5, out = .2) => taperTube([[0, 0, 0], [s * out * .3 * len, up * .25 * len, -.3 * len],
    [s * out * .7 * len, up * .4 * len, -.65 * len], [s * out * len, up * .35 * len, -len]], r, r * .12, 8, 6);
// flat blade spike (dorsal fins, frills): cone flattened sideways
const bladeGeo = (r, h) => cachedGeo('bl' + r + h, () => new THREE.ConeGeometry(r, h, 4).scale(.4, 1, 1));

const sstep = (a, b, x) => smooth((x - a) / (b - a));
// Catmull-Rom through column `col` of the sections at parameter f (0 .. sections - 1)
function crs(S, col, f) {
    const n = S.length, i = Math.min(n - 2, Math.floor(f)), t = f - i;
    const p0 = S[Math.max(0, i - 1)][col], p1 = S[i][col], p2 = S[i + 1][col], p3 = S[Math.min(n - 1, i + 2)][col];
    return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}
// linear look-up of a section [rx, ry, cy] at z (sections ascending in z)
function secAt(S, z, out = [0, 0, 0]) {
    let i = 0;
    while (i < S.length - 2 && z > S[i + 1][0]) i++;
    const a = S[i], b = S[i + 1], f = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0])));
    for (let k = 1; k <= 3; k++) out[k - 1] = (a[k] ?? a[1]) + ((b[k] ?? b[1]) - (a[k] ?? a[1])) * f;
    if (a.length < 4) out[2] = 0;
    return out;
}

const _ca = new THREE.Color(), _cs = new THREE.Color(), _cb = new THREE.Color(), _cd = new THREE.Color();
/*
 * Smooth closed loft along +z through sections [z, rx, ry, cy] (half width, half height, centre height; Catmull-Rom,
 * `sub` rings per span, small caps at the ends). Vertex colours: skin, a belly band underneath (-y; bellyAt = cosine of
 * its half angle, 2 = none), darker back (darkW); colFn(colour, z, sin, cos) may adjust them. u runs once around
 * (0 = middle of the belly, matching the plates of scaleTex(true)), v along the length (vk per metre).
 * rot: 'up' turns +z into +y (belly → +z), 'down' turns +z into -y (belly → -z), 'back' turns +z into -z.
 */
function loftGeo(key, sec, o = {}) {
    return cachedGeo(key, () => {
        const S = sec.map(s => [s[0], s[1], s[2] ?? s[1], s[3] ?? 0]);
        const radial = o.radial || 12, sub = o.sub || 3, vk = o.vk ?? 3, n = (S.length - 1) * sub + 1, R = radial + 1;
        _cs.set(o.skin ?? 0xffffff); _cb.set(o.belly ?? o.skin ?? 0xffffff); _cd.set(o.dark ?? o.skin ?? 0xffffff);
        const bAt = o.bellyAt ?? 2, dW = o.darkW ?? 0;
        const pos = [], uv = [], col = [], idx = [];
        let v = 0, pz = 0, pr = 0;
        for (let j = 0; j < n; j++) {
            const f = j / sub, z = crs(S, 0, f), rx = Math.max(.001, crs(S, 1, f)), ry = Math.max(.001, crs(S, 2, f)), cy = crs(S, 3, f);
            if (j) v += Math.hypot(z - pz, rx - pr) * vk;
            pz = z; pr = rx;
            for (let i = 0; i <= radial; i++) {
                const a = -Math.PI / 2 + i / radial * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
                pos.push(rx * ca, cy + ry * sa, z);
                uv.push(i / radial, v);
                _ca.copy(_cs).lerp(_cd, sstep(.15, 1, sa) * dW).lerp(_cb, sstep(bAt - .18, bAt + .12, -sa));
                if (o.colFn) o.colFn(_ca, z, sa, ca);
                col.push(_ca.r, _ca.g, _ca.b);
            }
        }
        for (let j = 0; j < n - 1; j++) for (let i = 0; i < radial; i++) {
            const a = j * R + i, b = a + R;
            idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
        for (const [ring, sg] of [[0, -1], [n - 1, 1]]) {                  // end caps
            const base = ring * R, c0 = pos.length / 3;
            let y = 0, r = 0, gg = 0, bb = 0;
            for (let i = 0; i < radial; i++) { y += pos[(base + i) * 3 + 1]; r += col[(base + i) * 3]; gg += col[(base + i) * 3 + 1]; bb += col[(base + i) * 3 + 2]; }
            pos.push(0, y / radial, pos[base * 3 + 2] + sg * .002);
            uv.push(.5, ring ? v : 0);
            col.push(r / radial, gg / radial, bb / radial);
            for (let i = 0; i < radial; i++) {
                if (sg > 0) idx.push(base + i, base + i + 1, c0); else idx.push(c0, base + i + 1, base + i);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const nm = g.attributes.normal;
        for (let j = 0; j < n; j++) {                                       // weld the normals along the u seam
            const a = j * R, b = a + radial;
            const x = nm.getX(a) + nm.getX(b), y = nm.getY(a) + nm.getY(b), z = nm.getZ(a) + nm.getZ(b), l = Math.hypot(x, y, z) || 1;
            nm.setXYZ(a, x / l, y / l, z / l); nm.setXYZ(b, x / l, y / l, z / l);
        }
        if (o.rot === 'up') g.rotateX(-Math.PI / 2);
        else if (o.rot === 'down') g.rotateX(Math.PI / 2);
        else if (o.rot === 'back') g.rotateY(Math.PI);
        if (o.skin2) skinAlong(g, ...o.skin2);
        if (o.at) g.translate(...o.at);
        return g;
    });
}
// skin weights along one axis (1 = y, 2 = z, sign flips it): bone k is centred at cs[k] (ascending), linear blend
function skinAlong(g, axis, sign, cs) {
    const p = g.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
        const s = (axis === 1 ? p.getY(i) : p.getZ(i)) * sign;
        let a = 0;
        while (a < cs.length - 2 && s > cs[a + 1]) a++;
        const f = Math.min(1, Math.max(0, (s - cs[a]) / (cs[a + 1] - cs[a])));
        si[i * 4] = a; si[i * 4 + 1] = a + 1;
        sw[i * 4] = 1 - f; sw[i * 4 + 1] = f;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

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

const _cf = new THREE.Color(), _cm = new THREE.Color(0x4a1414), _s3 = [0, 0, 0];

export class ProceduralDragon extends QuadrupedRig {
    constructor(variant = 'dragon', { scale = 1 } = {}) {
        super();
        this.variant = DRAGON_VARIANTS[variant] ? variant : 'dragon';
        const c = this.c = { ...DRAGON_VARIANTS[this.variant] };
        this.kind = c.kind;
        const D = this.D = KINDS[this.kind];
        this.k = c.bulk ?? 1;
        this.skel = c.undead === 'skeleton';
        this.tailL = D.tail[1] * (c.tailK || 1);
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
        if (rest !== undefined) P.by = -(this.H - (this.skel && !o.roll ? this.D.r * 1.45 : this.D.low * this.k) * rest);
        if (fw && this.D.fl) this.legsWorld(P, 'FL', ...fw);
        if (hw) this.legsWorld(P, 'HL', ...hw);
        if (plant.includes('F') && this.D.fl) this.plant(P, 'FL', rel);
        if (plant.includes('H')) this.plant(P, 'HL', rel);
        return P;
    }

    // skinned tube over a chain of joints, bound in the rest pose (built before the first update)
    skinned(geo, m, parent, bones) {
        const mesh = new THREE.SkinnedMesh(geo, m);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        parent.add(mesh);
        this.root.updateMatrixWorld(true);
        mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld);
        return mesh;
    }

    /* -------------------------------------------------------------- build */

    build() {
        const c = this.c, J = this.j, add = this.adder(), grp = this.grp.bind(this);
        const sTex = c.stone ? stoneTex() : scaleTex(false), hTex = c.stone ? stoneTex() : scaleTex(true);
        const rough = c.stone ? .95 : .55;
        const M = this.M = {
            lskin: mat(0xffffff, { vertexColors: true, map: sTex, roughness: rough }),        // lofts (vertex colours)
            lhide: mat(0xffffff, { vertexColors: true, map: hTex, roughness: rough }),        // lofts with belly plates
            lbone: mat(0xffffff, { vertexColors: true, roughness: .75 }),
            skin: mat(c.skin ?? c.bone, { roughness: rough, map: c.skin === undefined ? null : sTex }),
            dark: mat(c.dark, { roughness: .8 }),
            spine: mat(c.spine, { roughness: .45 }),
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
        const c = this.c, D = this.D, J = this.j, M = this.M, k = this.k, lich = c.undead === 'lich', garg = this.kind === 'gargoyle';
        const S = D.torso.map(([z, rx, ry, cy]) => [z, rx * k * (lich ? .9 : 1), ry * k * (lich ? .94 : 1), cy]);
        _cf.set(c.belly);
        // dragonlich: raw flesh under the open ribs, dark rot patches
        const colFn = lich ? (col, z, sa, ca) => {
            col.lerp(_cf, sstep(-.15, .35, -sa) * sstep(-.35, -.18, z) * (1 - sstep(.42, .56, z)));
            col.multiplyScalar(1 - .45 * sstep(.55, .95, Math.sin(z * 31 + ca * 4) * Math.sin(sa * 6 + z * 17)));
        } : null;
        J.chest = add(J.body, loftGeo('torso' + this.variant, S, { radial: 14, sub: 3, skin: c.skin, belly: c.belly, dark: c.dark,
            darkW: garg ? .3 : .55, bellyAt: lich ? 2 : garg ? .6 : .48, colFn }), M.lhide);
        if (lich) {                                                                               // open rib cage
            for (let i = 0; i < 7; i++) {
                const z = .44 - i * .095;
                secAt(S, z, _s3);
                const g = grp(J.body, 0, _s3[2], z);
                g.scale.set(_s3[0] * 1.04, _s3[1] * 1.04, .26);
                g.rotation.x = .12;
                add(g, G.torus(1, .07, 4, 14, Math.PI * 1.3), M.bone).rotation.z = -Math.PI / 2 - Math.PI * .65;
            }
            secAt(S, .1, _s3);
            add(J.body, G.box(.05, .03, .62), M.bone, 0, _s3[2] - _s3[1] * 1.02, .1);              // sternum
        }
        // dorsal spikes along the ridge
        const z0 = S[1][0] + .04, z1 = S[S.length - 2][0] - .03, n = Math.round((z1 - z0) / (garg ? .06 : .085));
        const h0 = garg ? .04 : (c.elder ? .17 : .12) * k;
        for (let i = 0; i <= n; i++) {
            const z = z1 - i * (z1 - z0) / n, h = h0 * (1 - Math.abs(i / n - .35) * .7);
            secAt(S, z, _s3);
            const sp = add(J.body, bladeGeo(h * .38, h), garg ? M.dark : M.spine, 0, _s3[2] + _s3[1] * .92 + h * .3, z);
            sp.rotation.x = -.6;
        }
    }

    buildSkeletonTorso(add, grp) {
        const D = this.D, J = this.j, M = this.M, r = D.r, len = D.len;
        const n = 13;
        for (let i = 0; i < n; i++) {                                                             // spine with black spines
            const z = len / 2 + r * .55 - i * (len + r * 1.1) / (n - 1);
            add(J.body, G.box(r * .28, r * .26, r * .3), M.bone, 0, r * .62, z);
            const sp = add(J.body, bladeGeo(r * .1, r * .7 * (1 - Math.abs(i / n - .4) * .6)), M.spine, 0, r * .95, z);
            sp.rotation.x = -.5;
        }
        for (let i = 0; i < 8; i++) {                                                             // rib cage
            const z = len * .5 - i * len * .1, rr = r * (.7 + .32 * Math.sin(Math.PI * (i + 1.2) / 9));
            const rib = add(J.body, G.torus(rr, r * .05, 4, 12, Math.PI * 1.7), M.bone, 0, r * .62 - rr, z);
            rib.rotation.set(.3, 0, Math.PI / 2 + Math.PI * .15);
            rib.scale.set(.92, 1, 1);
        }
        add(J.body, G.box(r * .2, r * .12, len * .7), M.bone, 0, -r * .76, len * .18).rotation.x = -.1;   // sternum
        for (const s of [1, -1]) {
            add(J.body, G.box(r * .08, r * .7, r * .5), M.bone, s * r * .55, r * .2, D.hip[0][1] + .02).rotation.z = s * .25;   // shoulder blades
            add(J.body, G.box(r * .1, r * .55, r * .7), M.bone, s * r * .45, r * .25, D.hip[1][1]).rotation.z = s * .4;        // pelvis
        }
        add(J.body, G.box(r * .9, r * .16, r * .3), M.bone, 0, r * .05, D.hip[1][1]);
    }

    buildLegs(add, grp) {
        const D = this.D, J = this.j, M = this.M, c = this.c, k = this.k, skel = this.skel, garg = this.kind === 'gargoyle', V = this.variant;
        const shade = (b, gr) => (col, z) => col.lerp(_cd, Math.min(.55, b + Math.max(0, z) * gr));
        for (const name of this.legNames) {
            const F = name[0] === 'F', side = name[1] === 'L' ? 1 : -1, i = F ? 0 : 1;
            const [l0, l1, l2] = F ? D.fl : D.hl, R = D.legR[i] * k, [hy, hz] = D.hip[i];
            const top = grp(J.body, side * D.legX[i] * k, hy, hz), knee = grp(top, 0, -l0, 0), low = grp(knee, 0, -l1, 0), toe = grp(low, 0, -l2, 0);
            const bony = skel || (c.undead === 'lich' && F), key = V + name[0];
            if (bony) {                                                                           // knobbly long bones
                const b = R * .55, bs = (l, e) => [[-b * 1.3, b * .4], [-b * .7, b * 1.3, b * 1.2], [l * .14, b * .72], [l * .5, b * .6], [l * .86, b * .72], [l + b * .5 * e, b * 1.25], [l + b * 1.2 * e, b * .35]];
                [[top, l0], [knee, l1], [low, l2]].forEach(([g, l], s) => add(g, loftGeo('lb' + s + key, bs(l, s < 2 ? 1 : -1), { rot: 'down', radial: 7, sub: 2, skin: c.bone }), M.lbone));
            } else {
                const dl = garg ? .95 : 1.55;
                const secs = F ? [
                    [[-.07, .3 * R], [-.02, dl * R, dl * 1.12 * R, 0], [.3 * l0, 1.5 * R, 1.7 * R, .15 * R], [.75 * l0, 1.0 * R, 1.15 * R, 0], [l0, .82 * R, .88 * R, 0], [l0 + .45 * R, .3 * R]],
                    [[-.4 * R, .3 * R], [0, .82 * R, .88 * R, 0], [.25 * l1, .92 * R, 1.05 * R, -.12 * R], [.8 * l1, .6 * R, .66 * R, 0], [l1, .55 * R], [l1 + .4 * R, .2 * R]],
                    [[-.3 * R, .3 * R], [0, .55 * R], [l2 * .8, .5 * R], [l2 - .05 * R, .3 * R]]
                ] : [
                    [[-.09, .4 * R], [-.03, 1.9 * R, 2.1 * R, 0], [.3 * l0, 1.8 * R, 2.0 * R, .35 * R], [.7 * l0, 1.1 * R, 1.2 * R, .1 * R], [l0, .8 * R, .85 * R, 0], [l0 + .45 * R, .3 * R]],
                    [[-.4 * R, .3 * R], [0, .8 * R, .85 * R, 0], [.3 * l1, .85 * R, .95 * R, -.25 * R], [.85 * l1, .5 * R, .55 * R, 0], [l1, .48 * R, .5 * R, 0], [l1 + .4 * R, .2 * R]],
                    [[-.3 * R, .3 * R], [0, .5 * R], [l2 * .8, .46 * R], [l2 - .05 * R, .3 * R]]
                ];
                [[top, 0, .1], [knee, .12, .4], [low, .3, .5]].forEach(([g, b, gr], s) =>
                    add(g, loftGeo('lg' + s + key, secs[s], { rot: 'down', radial: 10, sub: 2, skin: c.skin, dark: c.dark, colFn: shade(b, gr) }), M.lskin));
            }
            // foot (sole at the toe group origin, kept level)
            const footS = [[-.55 * R, .3 * R, .2 * R, .35 * R], [-.25 * R, .85 * R, .42 * R, .42 * R], [.45 * R, 1.0 * R, .36 * R, .36 * R], [1.0 * R, .85 * R, .24 * R, .25 * R], [1.3 * R, .4 * R, .1 * R, .14 * R]];
            add(toe, loftGeo('ft' + key, footS, { radial: 10, sub: 2, skin: bony ? c.bone : c.skin, dark: bony ? c.bone : c.dark, darkW: .3 }), bony ? M.lbone : M.lskin);
            const claws = garg && F ? 4 : 3, cl = (garg && F ? 1.4 : 1) * R;
            for (let t = 0; t < claws; t++) {
                const a = (t / (claws - 1) - .5) * 1.1;
                if (bony || garg) {                                                              // toe bones / long fingers
                    const tb = add(toe, G.cyl(R * .16, R * .24, cl * 1.1, 5), bony ? M.bone : M.skin, Math.sin(a) * R * .9, R * .25, R * .5 + Math.cos(a) * cl * .55);
                    tb.rotation.set(Math.PI / 2, 0, -a);
                } else {
                    const tg = add(toe, G.sph(R * .3, 7, 5), M.skin, Math.sin(a) * R * .85, R * .22, R * .95 + Math.cos(a) * R * .35);
                    tg.scale.set(1, .75, 2.2);
                    tg.rotation.y = a;
                }
                const cw = add(toe, G.cone(R * .17, cl * .85, 5), M.claw, Math.sin(a) * R * 1.25, R * .2, R * .45 + Math.cos(a) * cl * 1.2);
                cw.rotation.set(Math.PI / 2 + .45, 0, -a);
            }
            if (!F) add(toe, G.cone(R * .15, R * .6, 4), M.claw, 0, R * .5, -R * .55).rotation.x = -Math.PI / 2 - .4;   // dew claw
            J[name] = { top, knee, low, toe, hind: !F, side, key: F ? 'FL' : 'HL' };
        }
    }

    buildNeck(add, grp) {
        const D = this.D, J = this.j, M = this.M, c = this.c, skel = this.skel, k = this.k;
        const [n, L, r0, r1] = D.neck, top = n * L;
        const rAt = s => (r0 + (r1 - r0) * Math.min(1, Math.max(0, s) / top)) * k;
        J.neck = grp(J.body, 0, D.neckAt[0], D.neckAt[1]);
        J.neckSeg = [];
        this.neckR = [];
        let p = J.neck;
        for (let i = 0; i < n; i++) {
            const g = grp(p, 0, i === 0 ? 0 : L, 0), ra = rAt(i * L), rb = rAt((i + 1) * L);
            if (skel) {
                add(g, G.cyl(ra * .38, ra * .42, L * .8, 6), M.bone, 0, L * .5, 0);
                add(g, G.box(ra * .9, ra * .22, ra * .3), M.bone, 0, L * .5, 0);
                add(g, bladeGeo(ra * .2, ra * 1.1), M.spine, 0, L * .5, -ra * .6).rotation.x = -1.1;
            } else {
                const sp = add(g, bladeGeo(ra * .24, ra * (this.kind === 'gargoyle' ? .45 : .85)), M.spine, 0, L * .5, -rb * 1.02);
                sp.rotation.x = -1.1;
            }
            J.neckSeg.push(g);
            this.neckR.push(ra);
            p = g;
        }
        J.head = grp(p, 0, L, 0);
        J.head.rotation.order = 'YXZ';
        if (skel) return;
        // one smooth skinned tube: chest → segments → head
        const S = [[-.15, rAt(0) * .5], [-.09, rAt(0) * 1.04], [0, rAt(0)]];
        for (let i = 1; i <= n; i++) S.push([i * L, rAt(i * L)]);
        S.push([top + .045, r1 * k * .8], [top + .08, r1 * k * .3]);
        const cs = [.02];
        for (let i = 0; i < n; i++) cs.push((i + .5) * L);
        cs.push(top + .05);
        const geo = loftGeo('neck' + this.variant, S.map(([s, r]) => [s, r, r * 1.1, 0]), { radial: 12, sub: 2, rot: 'up',
            skin: c.skin, belly: c.belly, dark: c.dark, darkW: .5, bellyAt: .42, skin2: [1, 1, cs], at: [0, D.neckAt[0], D.neckAt[1]] });
        this.skinned(geo, M.lhide, J.body, [J.body, ...J.neckSeg, J.head]);
    }

    // long reptile head: wedge skull, tapering snout, brow ridges, swept-back horns, frill spikes
    buildHead(add, grp) {
        const c = this.c, J = this.j, M = this.M, skel = this.skel, lich = c.undead === 'lich', wy = this.kind === 'wyvern', V = this.variant;
        const hs = this.D.head * (c.headK || 1);
        const H = grp(J.head);
        H.scale.setScalar(hs);
        this.headLen = .3 * hs;
        const bone = skel || lich, sn = wy ? .82 : 1;
        const skullS = [[-.11, .015, .015, .045], [-.085, .055, .055, .045], [-.03, .075, .068, .04], [.03, .07, .06, .035],
            [.08, .058 * sn, .048 * sn, .028], [.15, .046 * sn, .036 * sn, .018], [.22, .04 * sn, .029 * sn, .013], [.27, .032 * sn, .022 * sn, .012], [.295, .008, .008, .012]];
        const mouthFn = (col, z, sa) => { if (z > .03) col.lerp(_cm, sstep(-.6, -.85, sa)); };
        add(H, loftGeo('skull' + V, skullS, { radial: 12, sub: 2, vk: 8, skin: bone ? c.bone : c.skin, dark: bone ? c.bone : c.dark,
            darkW: bone ? 0 : .5, colFn: mouthFn }), bone ? M.lbone : M.lskin);
        if (lich) {                                                                                // charred scales on the skull
            add(H, G.sph(.07, 8, 6), M.skin, 0, .05, -.04).scale.set(1.15, .75, 1.1);
            add(H, G.box(.05, .02, .1), M.skin, -.015, .05, .12).rotation.z = .2;
        }
        for (const s of [1, -1]) {
            const br = add(H, G.sph(.03, 7, 5), bone ? M.bone : M.skin, s * .05, .072, .055);    // brow ridge
            br.scale.set(.75, .5, 1.7);
            br.rotation.y = -s * .25;
            add(H, G.sph(.008, 5, 4), M.hole, s * .02 * sn, .03, .27);                            // nostril
            if (bone) add(H, G.sph(.012, 5, 4), M.hole, s * .022, .02, .22).scale.set(.7, 1, 1.6);   // nasal hole
        }
        // eyes: amber with a slit; dragonlich ghost glow; skeleton empty sockets
        J.eyes = [];
        for (const s of [1, -1]) {
            if (bone) add(H, G.box(.012, .014, .1), M.bone, s * .062, .026, .04).rotation.y = s * .12;   // cheekbone
            if (skel) { add(H, G.sph(.032, 7, 5), M.hole, s * .05, .048, .065).scale.set(.75, 1, 1.25); continue; }
            if (c.ghost) {
                add(H, G.sph(.03, 7, 5), M.hole, s * .05, .048, .065).scale.set(.75, 1, 1.25);
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
            add(H, G.cone(.006, wy ? .03 : .028, 4), M.tooth, s * .036 * sn, -.016, .1 + i * (wy ? .028 : .04)).rotation.x = Math.PI;
        }
        // lower jaw: belly-coloured underside, dark red mouth on top
        J.jaw = grp(H, 0, -.025, .02);
        const jawS = [[-.035, .012, .01, -.004], [-.01, .046, .028, -.008], [.06, .046 * sn, .022, -.01], [.14, .037 * sn, .018, -.009],
            [.21, .029 * sn, .014, -.007], [.245, .01, .007, -.005]];
        add(J.jaw, loftGeo('jaw' + V, jawS, { radial: 10, sub: 2, vk: 8, skin: bone ? c.bone : c.skin, belly: bone ? c.bone : c.belly,
            dark: skel ? c.bone : 0x4a1414, darkW: skel ? 0 : 1, bellyAt: .35 }), bone ? M.lbone : M.lskin);
        for (const s of [1, -1]) for (let i = 0; i < (wy ? 5 : 3); i++) add(J.jaw, G.cone(.005, .022, 4), M.tooth, s * .028 * sn, .008, .08 + i * (wy ? .03 : .045));
        if (c.elder) for (let i = 0; i < 3; i++) {                                                // chin spikes
            const sp = add(J.jaw, G.cone(.008, .06, 4), M.horn, (i - 1) * .02, -.03, .04 - Math.abs(i - 1) * .02);
            sp.rotation.x = Math.PI - .9;
        }
        // horns and frill
        const hl = .3 * (c.horns ?? 1);
        for (const s of [1, -1]) {
            add(H, backHorn(hl, .026, s, .6, .25), M.horn, s * .045, .08, -.02);
            if (c.elder) {
                add(H, backHorn(hl * .65, .018, s, .2, .55), M.horn, s * .065, .05, -.03);
                add(H, backHorn(hl * .4, .013, s, .9, .4), M.horn, s * .03, .1, .03);
            }
            for (let i = 0; i < (c.elder ? 4 : 3); i++) {                                       // cheek frill
                const sp = add(H, bladeGeo(.014, .075 + i * .014), skel ? M.spine : bone ? M.horn : M.spine, s * (.066 + i * .006), .0 - i * .022, -.03 - i * .012);
                sp.rotation.set(-Math.PI / 2 - .3 + i * .1, 0, s * .5);
            }
        }
        if (wy || bone) for (let i = 0; i < 5; i++) {                                            // crest: fan of long spikes behind the skull
            const a = (i - 2) * .32;
            const sp = add(H, G.cone(.01, (wy ? .17 : .12) - Math.abs(i - 2) * .02, 4), wy ? M.horn : M.spine, Math.sin(a) * .05, .07 + Math.cos(a) * .02, -.05);
            sp.rotation.set(-Math.PI / 2 - .55, 0, -a * 1.2);
        }
        for (let i = 0; i < 3; i++) add(H, bladeGeo(.012, .045), skel ? M.spine : M.horn, 0, .1 - i * .01, -.04 - i * .03).rotation.x = -1.2;
        this.mouth = [0, -.025, .26];
        this.headPts = [[0, .29], [-.05, -.08], [-.04, .02]];                                  // [y, z]: nose, back of the skull, jaw hinge
        this.jawLen = .24;
    }

    // gargoyle: goblin head with big pointed ears, curled horns, heavy brow and a fanged grin
    buildGoblinHead(add, grp) {
        const c = this.c, J = this.j, M = this.M, V = this.variant;
        const H = grp(J.head, 0, .03, 0);
        H.scale.setScalar(1.35);
        this.headLen = .2;
        _cf.set(0x2a2624);
        const gS = [[-.085, .02, .02, .03], [-.065, .06, .065, .03], [-.015, .075, .075, .028], [.035, .07, .066, .018], [.07, .064, .052, .002],
            [.098, .052, .038, -.012], [.112, .02, .015, -.014]];
        add(H, loftGeo('gskull' + V, gS, { radial: 12, sub: 2, vk: 8, skin: c.skin, dark: c.dark, darkW: .3,
            colFn: (col, z, sa) => { if (z > .03) col.lerp(_cf, sstep(-.6, -.85, sa)); } }), M.lskin);
        add(H, G.sph(.02, 7, 5), M.skin, 0, .02, .1).scale.set(1.2, .8, 1.1);                   // broad nose
        J.eyes = [];
        for (const s of [1, -1]) {
            const br = add(H, G.sph(.036, 8, 6), M.skin, s * .028, .054, .058);                  // heavy brow
            br.scale.set(1.15, .5, .8);
            J.eyes.push(add(H, G.sph(.011, 6, 5), mat(c.eye, { emissive: c.eye, emissiveIntensity: .7 }), s * .03, .034, .074));
            const ear = add(H, G.cone(.05, .2, 4), M.skin, s * .1, .05, -.02);                  // big pointed bat ear
            ear.rotation.set(-.25, 0, -s * 1.0);
            ear.scale.z = .3;
            add(H, backHorn(.12, .014, s, .9, .5), M.horn, s * .04, .078, 0);                  // small curled horns
            for (let i = 0; i < 3; i++) add(H, G.cone(.006, i ? .025 : .04, 4), M.tooth, s * (.014 + i * .016), -.03, .103 - i * .012).rotation.x = Math.PI;   // grin
        }
        J.jaw = grp(H, 0, -.035, .03);
        const jS = [[-.04, .01, .01, 0], [-.02, .05, .025, -.005], [.03, .06, .025, -.008], [.07, .045, .02, -.008], [.085, .015, .01, -.006]];
        add(J.jaw, loftGeo('gjaw' + V, jS, { radial: 10, sub: 2, vk: 8, skin: c.skin, dark: 0x2a2624, darkW: 1 }), M.lskin);
        for (const s of [1, -1]) for (let i = 0; i < 2; i++) add(J.jaw, G.cone(.006, i ? .022 : .032, 4), M.tooth, s * (.02 + i * .016), .01, .07 - i * .012);
        this.mouth = [0, -.04, .12];
        this.headPts = [[0, .17], [-.02, -.08], [0, .04]];
        this.jawLen = .09;
    }

    buildTail(add, grp) {
        const D = this.D, J = this.j, M = this.M, c = this.c, skel = this.skel, k = this.k, bony = skel || c.undead === 'lich';
        const [n, , r0] = D.tail, L = this.tailL, top = n * L;
        const rAt = s => s < 0 ? r0 * k * (1 + Math.min(.2, -s) * 1.4) : r0 * k * (.08 + .92 * Math.pow(1 - Math.min(1, s / top), 1.25));
        J.tailRoot = grp(J.body, 0, D.tailAt[0], D.tailAt[1]);
        J.tail = [];
        this.tailR = [];
        let p = J.tailRoot;
        for (let i = 0; i < n; i++) {
            const ra = rAt(i * L), g = grp(p);
            if (bony) {                                                                           // vertebrae with black spines
                const rb = ra * (skel ? 1 : 1.15);
                add(g, G.box(rb * .75, rb * .65, L * .78), M.bone, 0, 0, -L / 2);
                add(g, G.box(rb * 1.4, rb * .18, rb * .3), M.bone, 0, 0, -L * .3);
                add(g, bladeGeo(rb * .2, rb * 1.2), M.spine, 0, rb * .55, -L / 2).rotation.x = -.6;
            } else if (this.kind !== 'gargoyle' || i % 2 === 0) {
                const sp = add(g, bladeGeo(ra * .3, ra * .8 + .02), M.spine, 0, ra * .98, -L / 2);
                sp.rotation.x = -.6;
            }
            J.tail.push(g);
            this.tailR.push(ra);
            p = grp(g, 0, 0, -L);
        }
        if (!bony) {                                                                              // one smooth skinned tube
            const S = [[-.2, rAt(-.16) * .5], [-.14, rAt(-.14)], [-.06, rAt(-.06)]];
            for (let i = 0; i <= n; i++) S.push([i * L, rAt(i * L)]);
            S.push([top + .02, rAt(top) * .4]);
            const cs = [-.12];
            for (let i = 0; i < n; i++) cs.push((i + .5) * L);
            const geo = loftGeo('tail' + this.variant, S.map(([s, r]) => [s, r, r * 1.08, 0]), { radial: 10, sub: 2, rot: 'back',
                skin: c.skin, belly: c.belly, dark: c.dark, darkW: .55, bellyAt: .55, skin2: [2, -1, cs], at: [0, D.tailAt[0], D.tailAt[1]] });
            this.skinned(geo, M.lhide, J.body, [J.body, ...J.tail]);
        }
        const tr = r0 * k * .1;
        if (this.kind === 'wyvern') {                                                             // poison sting
            add(p, G.sph(tr * 2.4, 7, 5), M.skin, 0, 0, -tr * 1.5).scale.set(1, 1, 1.6);
            const st = add(p, G.cone(tr * 1.1, tr * 7, 6), mat(c.sting, { roughness: .35 }), 0, tr * 1.5, -tr * 6);
            st.rotation.x = -Math.PI / 2 + .5;
        } else if (this.kind === 'dragon') {                                                      // spiked tail tip
            const m = bony ? M.bone : M.spine;
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
            boneMat: c.undead ? mat(0x3a3430, { roughness: .7 }) : c.stone ? M.skin : M.dark, clawMat: M.claw, skinMat: skin, poses: WING_POSES[this.kind]
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
        const nt = D.tail[0], Lt = this.tailL;
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
