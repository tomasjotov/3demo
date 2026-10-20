import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';
import { G, mat } from '../avatar/kit.js';
import { makeWing, glowMat, hornGeo } from './creatureParts.js';
import { humanTorso, skullGeo, jawGeo, vcMat, shadedTex, css, seeded } from './hybridParts.js';

/*
 * ProceduralSerpent — legless long bodies: snakes, worms, slugs, grubs and centipedes on one spine.
 *
 * The spine is rebuilt every frame from a few pose numbers:
 *   front part (neck): rises from the ground in an S-curve (rise), leans forward to strike (lean), sways (sway);
 *   ground part: trails behind with a sideways travelling wave (amp, the slither) or wound into a coil (coil);
 *   burrowers (sandworm, forest wurm) keep the rear under the ground (sink) and push out of a mound.
 * Segment frames (position + orientation from parallel-transported "back" vectors) are laid along the spine; the skin
 * is ONE deforming tube per chain whose rings follow those frames (two rings per segment, flat belly, closed tail
 * tip), painted with a canvas texture in tube UVs (scales with belly scutes and patterns, worm rings, chitin plates,
 * glowing slug spots) and a matching bump map. Worms / grubs / centipedes bulge per segment (annulated look).
 * Decorations (fins, crystals, moss, bones, legs) hang on the segment frames; the sea serpent has a red web crest
 * (a ribbon following the spine). The hydra has several necks (one tube each) on one body; the serpent guardian and
 * the goblin snake carry a scaly humanoid torso (hybridParts) on the raised front.
 *
 *   root (yaw, scale)
 *   ├─ tube meshes (body; hydra necks)       ├─ seg[i] frames ─ decoration
 *   ├─ head (skull, jaw, tongue / mandibles / maw petals / feelers; or torso with arms and head)
 *   └─ mound (burrowers)
 *
 * Kinds: snake (python, crystal snake, sea serpent, goblin snake, winged serpent, hydra, forest wurm, serpent guardian),
 * worm (aakf with feelers, corpse wurm, shuddering leech, sandworm, swamp worm), slug (cave slug), grub (cave worms),
 * centipede (nugotha with wings, sterenda).
 * States: idle (head raised, tongue / feelers, slow sway; the python lies coiled), walk / run (slither wave),
 * attack (draw back → strike with the jaws / maw / mandibles; hydra heads one after another, guardian slashes with the
 * sword, burrowers rise high and slam down), defend (rears up high, hisses), hit, kneel / lie (coiled or flat on the
 * ground), death (stretched out, rolled on the side, mouth open).
 */

const TAU = Math.PI * 2;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export const SERPENT_VARIANTS = {
    python: { kind: 'snake', head: 'snake', L: 11, R: .28, Lf: 2.4, color: 0x8a7a52, belly: 0xd8ccaa, mark: 0x2e2214, pattern: 'python', eye: 0xc09030, coilIdle: 1.1, rise: .62, cobra: .62, scale: 1 },
    'crystal-snake': { kind: 'snake', head: 'snake', L: 4, R: .1, Lf: 1.5, color: 0xc4e4ff, belly: 0xeef6ff, crystal: true, pattern: 'facets', eye: 0x40a0ff, fangs: true, coilIdle: .45, rise: .95, cobra: .55, scale: 1 },
    'sea-serpent': { kind: 'snake', head: 'dragon', L: 14, R: .42, Lf: 5.5, color: 0x1c2836, belly: 0x8a9488, mark: 0x101820, pattern: 'bands', fin: 0x8a1a3a, eye: 0xff2a20, horn: 0x101418, rise: 1, coilIdle: .25, scale: 1 },
    'goblin-snake': { kind: 'snake', head: 'goblin', L: 6, R: .16, Lf: .75, color: 0x3a6a34, belly: 0xc8b870, mark: 0x24401e, pattern: 'bands', skin: 0x5a7a44, eye: 0xe0c030, coilIdle: .3, rise: .75, upright: true, torso: 1.35, scale: 1 },
    'winged-serpent': { kind: 'snake', head: 'snake', L: 3, R: .08, Lf: 1.1, color: 0x24403a, belly: 0xc8a050, mark: 0x142824, pattern: 'bands', eye: 0xd0c020, fangs: true, wings: 0x3a2618, membrane: 0x7a4a24, rise: 1, cobra: .6, scale: 1 },
    hydra: { kind: 'snake', head: 'dragon', heads: 3, L: 6, R: .5, Lf: 3.2, neckR: .2, coilIdle: .35, color: 0x5e6a30, belly: 0xd4b464, mark: 0x3a4018, pattern: 'bands', horn: 0x3a2a18, spines: 0x8a3a20, eye: 0xff3018, mace: true, rise: 1, scale: 1 },
    'forest-wurm': { kind: 'snake', head: 'beast', L: 9, R: .5, Lf: 3.2, color: 0x464a2c, belly: 0x8a8056, mark: 0x2a2c1a, pattern: 'moss', moss: 0x5a7a26, eye: 0xc0a040, sink: .9, mound: 0x4a3a24, rise: .9, scale: 1 },
    'serpent-guardian': { kind: 'snake', head: 'naga', L: 5, R: .17, Lf: .9, color: 0x2a7470, belly: 0xc8b070, mark: 0x184a48, pattern: 'bands', skin: 0x34827a, crest: 0x1a5a58, eye: 0xd0b030, coilIdle: .4, rise: 1, upright: true, torso: 1.15, scale: 1 },
    aakf: { kind: 'worm', head: 'feelers', skin: 'plates', L: 4, R: .22, Lf: 1.4, color: 0x26282c, belly: 0x44464c, eye: 0x9aff40, legsFront: 5, rise: .9, cobra: .5, scale: 1 },
    'corpse-wurm': { kind: 'worm', head: 'skull', skin: 'corpse', L: 7, R: .48, Lf: 2.8, color: 0x4a3228, belly: 0x6a4a36, bone: 0xc8b8a0, corpse: true, rise: 1, cobra: .55, scale: 1 },
    'leech-shuddery': { kind: 'worm', head: 'sucker', skin: 'leech', L: 2, R: .12, Lf: .9, color: 0x8a5230, belly: 0xc89058, mark: 0x4a2a16, rise: 1, cobra: .6, scale: 1 },
    sandworm: { kind: 'worm', head: 'maw', skin: 'plates', petals: 3, L: 16, R: 1.05, Lf: 6, color: 0xb89a6a, belly: 0xd8c09a, mark: 0x7a6040, sink: 1, mound: 0xc8a870, rise: 1, scale: 1 },
    'swamp-worm': { kind: 'worm', head: 'maw', skin: 'scaly', L: 3, R: .3, Lf: 1.5, color: 0x50582c, belly: 0x9a945a, mark: 0x2e3418, bristle: true, sink: .4, mound: 0x3a3a22, rise: .85, scale: 1 },
    'cave-slug': { kind: 'slug', head: 'slug', L: 2.6, R: .32, Lf: .8, color: 0x2c2c50, belly: 0x5a5a7a, spots: 0x60c8ff, rise: .35, scale: 1 },
    'maggot-lair-1': { kind: 'grub', head: 'maggot', skin: 'grub', L: 1.1, R: .2, Lf: .55, color: 0x3a2c3c, belly: 0x9a6a7a, eye: 0xff2020, rise: .75, upright: true, scale: 1 },
    'maggot-lair-2': { kind: 'grub', head: 'mother', skin: 'grub', L: 3.4, R: .75, Lf: 1.5, color: 0xdcd6cc, belly: 0xf0ece4, eye: 0x101828, rise: .6, upright: true, scale: 1 },
    nugotha: { kind: 'centipede', head: 'centipede', skin: 'plates', L: 2.6, R: .12, Lf: .8, color: 0x3e4a26, belly: 0x6a5a34, eye: 0x101008, legs: 0x2a2a18, venom: 0x80ff40, insectWings: true, hover: .75, rise: .35, scale: 1 },
    sterenda: { kind: 'centipede', head: 'centipede', skin: 'plates', L: 3.6, R: .16, Lf: 1.5, color: 0x3a1e16, belly: 0x6a3a28, eye: 0xff2010, legs: 0x5a2a1a, antennae: 1.3, rise: .95, cobra: .55, scale: 1 }
};

// cross-section per kind: width, top and bottom (belly) half-heights in radii, segment bulge, radial vertices
const SECTION = {
    snake: { w: 1, top: .88, bot: .66, bulge: 0, n: 14 },
    worm: { w: 1, top: 1, bot: .86, bulge: .075, n: 14 },
    slug: { w: 1.12, top: .72, bot: .4, bulge: 0, n: 16 },
    grub: { w: 1, top: 1, bot: .84, bulge: .1, n: 16 },
    centipede: { w: 1.05, top: .66, bot: .55, bulge: .1, n: 10 }
};

// pose keys (damped); every state gives all of them
const KEYS = ['rise', 'lean', 'bz', 'headX', 'jaw', 'amp', 'coil', 'roll', 'sway', 'arm', 'guard', 'wing', 'fly'];

// ---------------------------------------------------------------- skin textures (u around from the belly, v along)
const BELLY = .17;                                                     // belly band: u < BELLY or u > 1 - BELLY
function blotch(g, x, y, rx, ry, rot, fill, edge, H) {
    for (const dy of [-H, 0, H]) {
        g.save(); g.translate(x, y + dy); g.rotate(rot);
        if (edge) { g.fillStyle = edge; g.beginPath(); g.ellipse(0, 0, rx + 2.5, ry + 2.5, 0, 0, TAU); g.fill(); }
        g.fillStyle = fill; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
        g.restore();
    }
}
function bellyBand(g, W, H, belly) {
    for (const [x0, x1] of [[0, W * BELLY], [W * (1 - BELLY), W]]) {
        g.fillStyle = css(belly);
        g.fillRect(x0, 0, x1 - x0, H);
    }
    for (const s of [0, 1]) {                                          // soft edge
        const xe = s ? W * (1 - BELLY) : W * BELLY, gr = g.createLinearGradient(xe - 6, 0, xe + 6, 0);
        gr.addColorStop(s ? 0 : 1, css(belly, .9).replace('rgb', 'rgba').replace(')', ',0)'));
        gr.addColorStop(s ? 1 : 0, css(belly, .9));
        g.fillStyle = gr; g.fillRect(xe - 6, 0, 12, H);
    }
}
function noise(g, W, H, n, a, seed) {
    const r = seeded(seed);
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${a})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
}
// scaled snake skin: one tile = 2 circumferences along the body
function scaleSkin(key, c) {
    const W = 120, H = 240, pat = c.pattern;
    return shadedTex('serp-' + key, W, H, (g) => {
        g.fillStyle = css(c.color); g.fillRect(0, 0, W, H);
        const r = seeded(key.length * 31 + 5), mark = css(c.mark || 0x202020);
        const gr = g.createLinearGradient(0, 0, W, 0);                 // flanks a little lighter than the spine
        gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(.5, 'rgba(0,0,0,.1)'); gr.addColorStop(1, 'rgba(255,255,255,.12)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        if (pat === 'python') {                                        // big dark saddles with pale rims, lateral blotches
            for (let y = 0; y < H; y += 40) {
                blotch(g, W / 2 + (r() - .5) * 8, y + r() * 6, 15 + r() * 5, 10 + r() * 4, (r() - .5) * .6, mark, css(c.color, 1.35), H);
                for (const s of [1, -1]) blotch(g, W / 2 + s * W * .22, y + 20 + r() * 6, 7 + r() * 3, 9 + r() * 3, (r() - .5), mark, css(c.color, 1.3), H);
            }
        } else if (pat === 'bands') {                                  // dark saddles across the back
            for (let y = 0; y < H; y += 30) blotch(g, W / 2, y, W * .26, 6 + r() * 3, 0, css(c.mark, 1), null, H);
        } else if (pat === 'moss') {
            for (let i = 0; i < 26; i++) blotch(g, W / 2 + (r() - .5) * W * .5, r() * H, 5 + r() * 9, 4 + r() * 8, r() * 3, css(c.moss, .5 + r() * .3), null, H);
        } else if (pat === 'facets') {                                 // crystal: random pastel facets
            const pal = [0xd8f0ff, 0xb0d8ff, 0xe8d8ff, 0xffd8f0, 0xc8fff0, 0xffffff];
            for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W + 12; x += 12) {
                g.fillStyle = css(pal[(r() * pal.length) | 0]);
                g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); g.fill();
            }
        }
        if (!c.crystal) bellyBand(g, W, H, c.belly);
        noise(g, W, H, 700, .05, 11);
    }, (g) => {
        if (c.crystal) {                                               // facet edges
            g.strokeStyle = '#303030'; g.lineWidth = 1.5;
            for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W + 12; x += 12) {
                g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.closePath(); g.stroke();
            }
            return;
        }
        const sw = W / 20;                                             // 20 scales around
        for (let y = -sw; y < H + sw; y += sw) for (let x = ((y / sw) & 1) ? sw / 2 : 0; x < W + sw; x += sw) {
            if (x < W * BELLY - 2 || x > W * (1 - BELLY) + 2) continue;
            const gr = g.createLinearGradient(0, y - sw * .6, 0, y + sw * .7);
            gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(1, '#383838');
            g.fillStyle = gr;
            g.beginPath(); g.ellipse(x, y, sw * .55, sw * .75, 0, 0, TAU); g.fill();
        }
        for (let y = 0; y < H; y += 8) for (const [x0, x1] of [[0, W * BELLY], [W * (1 - BELLY), W]]) {   // belly scutes
            const gr = g.createLinearGradient(0, y, 0, y + 8);
            gr.addColorStop(0, '#c8c8c8'); gr.addColorStop(.8, '#808080'); gr.addColorStop(1, '#303030');
            g.fillStyle = gr; g.fillRect(x0, y, x1 - x0, 8);
        }
    }, c.crystal ? .85 : .62, c.crystal ? 1.12 : 1.25);
}
// ringed skin (worms, grubs, centipedes): one tile = one segment
function ringSkin(key, c) {
    const W = 120, H = 30, st = c.skin;
    return shadedTex('serp-' + key, W, H, (g) => {
        g.fillStyle = css(c.color); g.fillRect(0, 0, W, H);
        if (st === 'corpse') {                                         // ribs of the swallowed dead along the flanks, rot
            const r = seeded(9);
            for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(20,8,4,${.2 + r() * .3})`; g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 4, 0, TAU); g.fill(); }
            g.strokeStyle = css(c.bone, .62); g.lineWidth = 3.5; g.lineCap = 'round';
            for (const s of [1, -1]) { g.beginPath(); g.moveTo(W / 2 + s * 10, H * .45); g.quadraticCurveTo(W / 2 + s * W * .2, H * .2, W / 2 + s * W * .3, H * .5); g.stroke(); }
            g.fillStyle = css(c.bone, .55);
            g.beginPath(); g.ellipse(W / 2, H * .45, 5, 4, 0, 0, TAU); g.fill();                      // vertebra
        }
        if (st === 'leech') { g.fillStyle = css(c.mark); g.fillRect(0, H * .44, W, H * .12); }
        if (st === 'plates' || st === 'scaly') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
        if (c.mark && st !== 'leech') {                                // darker spine stripe
            const gr = g.createLinearGradient(0, 0, W, 0);
            gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(.5, css(c.mark).replace('rgb', 'rgba').replace(')', ',.5)')); gr.addColorStop(.7, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, W, H);
        }
        bellyBand(g, W, H, c.belly);
        noise(g, W, H, 160, .07, 5);
    }, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, H);
        if (st === 'plates') { gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(.75, '#707070'); gr.addColorStop(.9, '#202020'); gr.addColorStop(1, '#101010'); }
        else { gr.addColorStop(0, '#303030'); gr.addColorStop(.18, '#a0a0a0'); gr.addColorStop(.5, '#c8c8c8'); gr.addColorStop(.82, '#a0a0a0'); gr.addColorStop(1, '#303030'); }
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        if (st === 'scaly') for (let y = 0; y < H + 6; y += 6) for (let x = ((y / 6) & 1) ? 3 : 0; x < W + 6; x += 6) {
            g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI); g.fill();
        }
        if (st === 'corpse') {
            g.strokeStyle = '#f0f0f0'; g.lineWidth = 3;
            for (const s of [1, -1]) { g.beginPath(); g.moveTo(W / 2 + s * 10, H * .45); g.quadraticCurveTo(W / 2 + s * W * .2, H * .2, W / 2 + s * W * .3, H * .5); g.stroke(); }
        }
    }, st === 'grub' ? .74 : .55, st === 'grub' ? 1.12 : 1.25);
}
// slug: mottled glossy skin, glowing spots as an emissive map
function slugSkin(key, c) {
    const W = 128, H = 128, r = seeded(21), spots = [];
    for (let i = 0; i < 22; i++) spots.push([W * (.3 + r() * .4), r() * H, 1.2 + r() * 2.2]);
    const tex = shadedTex('serp-' + key, W, H, (g) => {
        g.fillStyle = css(c.color); g.fillRect(0, 0, W, H);
        for (let i = 0; i < 60; i++) blotch(g, r() * W, r() * H, 3 + r() * 10, 3 + r() * 8, r() * 3, `rgba(${r() < .5 ? '0,0,0' : '160,170,255'},.12)`, null, H);
        bellyBand(g, W, H, c.belly);
        for (const [x, y, s] of spots) blotch(g, x, y, s, s, 0, css(c.spots), null, H);
    }, null, .9, 1.05);
    if (!tex.emis && typeof document !== 'undefined') {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        for (const [x, y, s] of spots) for (const dy of [-H, 0, H]) {
            const gr = g.createRadialGradient(x, y + dy, 0, x, y + dy, s * 2.2);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, css(c.spots)); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y + dy, s * 2.2, 0, TAU); g.fill();
        }
        tex.emis = new THREE.CanvasTexture(cv);
        tex.emis.wrapS = tex.emis.wrapT = THREE.RepeatWrapping;
        tex.emis.colorSpace = THREE.SRGBColorSpace;
    }
    return tex;
}

const HEAD_MATS = new Map();

export class ProceduralSerpent {
    constructor(variant = 'python', { scale = 1 } = {}) {
        this.variant = SERPENT_VARIANTS[variant] ? variant : 'python';
        const c = this.c = { heads: 1, Lf: null, sink: 0, coilIdle: 0, ...SERPENT_VARIANTS[this.variant] };
        c.Lf = c.Lf || Math.min(c.L * .32, 2);
        this.sec = SECTION[c.kind];
        this.size = c.scale * (scale || 1);
        this.root = new THREE.Group();
        this.root.name = 'serpent';
        this.root.scale.setScalar(this.size);
        this.j = {};
        this.time = Math.random() * 50;
        this.phase = 0;
        this.yaw = null;
        this.state = null;
        this.stateTime = 0;
        this.gait = 0;
        this.flick = 0; this.flickTimer = 1 + Math.random() * 2;
        this.STAND = { rise: c.rise, lean: 0, bz: 0, headX: 0, jaw: .02, amp: .12, coil: c.coilIdle, roll: 0, sway: 0, arm: 0, guard: 0, wing: 0, fly: c.hover ? 1 : 0 };
        this.p = { ...this.STAND };
        // spine sampling: ~1.4 radii per segment
        const n = Math.max(14, Math.min(40, Math.round(c.L / (c.R * 1.45))));
        this.ds = c.L / n;
        this.nf = Math.max(3, Math.round(c.Lf / this.ds));
        this.ng = n - this.nf;
        this.mats();
        this.build();
    }

    mats() {
        const c = this.c, ringed = c.kind === 'worm' || c.kind === 'grub' || c.kind === 'centipede';
        const skin = c.kind === 'slug' ? slugSkin(this.variant, c) : ringed ? ringSkin(this.variant, c) : scaleSkin(this.variant, c);
        this.tileLen = ringed ? this.ds : c.kind === 'slug' ? TAU * c.R : 2 * TAU * c.R;
        const body = { map: skin.map, bumpMap: skin.bump, bumpScale: c.kind === 'grub' ? .5 : c.R > .4 ? 2 : 1, roughness: c.kind === 'snake' ? .5 : c.kind === 'centipede' ? .35 : .65 };
        if (c.crystal) Object.assign(body, { roughness: .1, metalness: .15, transparent: true, opacity: .82, emissive: 0x3070b0, emissiveIntensity: .35, flatShading: true, bumpScale: .5 });
        if (c.kind === 'slug') Object.assign(body, { roughness: .22, emissive: 0xffffff, emissiveMap: skin.emis, emissiveIntensity: 1.1 });
        if (c.kind === 'grub' && c.head === 'mother') Object.assign(body, { roughness: .35 });
        this.M = {
            skinTube: new THREE.MeshStandardMaterial({ color: 0xffffff, ...body }),
            body: mat(c.color, c.crystal ? { roughness: .1, metalness: .15, transparent: true, opacity: .82, emissive: 0x3070b0, emissiveIntensity: .35, flatShading: true } : { roughness: .55 }),
            belly: mat(c.belly, { roughness: .6 }),
            mark: mat(c.mark || 0x202020, { roughness: .7 }), dark: mat(0x0a0806, { roughness: .9 }),
            tooth: mat(0xf0e8d0, { roughness: .35 }), bone: mat(c.bone || 0xd8cdb0, { roughness: .8 }),
            eye: mat(c.eye || 0x101010, { roughness: .15, emissive: c.eye || 0, emissiveIntensity: c.eye ? .5 : 0 }),
            mouth: mat(0x5a1a1e, { roughness: .6 }), tongue: mat(0xb02a3a, { roughness: .5 }),
            vc: vcMat({ roughness: c.kind === 'snake' ? .5 : .6 })
        };
    }

    // radius along the body, s from the head (0) to the tail tip (L)
    radius(s, neck = false) {
        const c = this.c, u = Math.min(1, s / c.L);
        if (neck) return c.neckR * (1 + .45 * (s / c.Lf));
        switch (c.kind) {
            case 'worm': return c.R * (u < .06 ? .82 + u * 3 : 1) * (u > .8 ? 1 - (u - .8) / .2 * .55 : 1);
            case 'slug': return c.R * (.62 + .38 * smooth(u / .3)) * (u > .55 ? 1 - (u - .55) / .45 * .88 : 1);
            case 'grub': return c.R * (.72 + .28 * Math.sin(Math.PI * Math.min(1, u * 1.25))) * (u > .78 ? 1 - (u - .78) / .22 * .6 : 1);
            case 'centipede': return c.R * (u > .85 ? 1 - (u - .85) / .15 * .45 : 1);
            default: return c.R * Math.min(1, (c.torso ? .8 : .45) + u * 2.6) * (u > .45 ? Math.max(.06, 1 - (u - .45) / .55 * .94) : 1);
        }
    }

    build() {
        const c = this.c, M = this.M, J = this.j, ds = this.ds;
        this.tmp = { f: new THREE.Vector3(), x: new THREE.Vector3(), m: new THREE.Matrix4(), v: new THREE.Vector3(), h: new THREE.Vector3(), u: new THREE.Vector3(0, 1, 0),
            a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };
        this._d = new THREE.Vector3();
        this._dBase = new THREE.Vector3();
        // necks: one for most, several for the hydra; the body behind them is shared
        this.necks = [];
        for (let k = 0; k < c.heads; k++) {
            const off = k - (c.heads - 1) / 2;
            const neck = { k, pts: [], segs: [], yaw0: c.heads > 1 ? off * .9 : 0, rise: 1.12 - Math.abs(off) * .14, att: 0 };
            for (let i = 0; i <= this.nf; i++) neck.pts.push(new THREE.Vector3());
            for (let i = 0; i < this.nf; i++) neck.segs.push(this.segment(i * ds, c.heads > 1, i));
            neck.head = this.buildHead(neck);
            this.necks.push(neck);
        }
        J.head = this.necks[0].head.thead || this.necks[0].head.g;
        this.gpts = [];
        for (let i = 0; i <= this.ng; i++) this.gpts.push(new THREE.Vector3());
        this.gS = i => c.heads > 1 ? c.L * (.22 + .78 * i / this.ng) : (this.nf + i) * ds;   // body arc length at ground point i
        this.gsegs = [];
        for (let i = 0; i < this.ng; i++) this.gsegs.push(this.segment((this.gS(i) + this.gS(i + 1)) / 2 - ds / 2, false, this.nf + i));
        this.gTurn = new Float32Array(this.ng + 1);
        this.gYaw = new Float32Array(this.ng + 1);
        this.buildTubes();
        if (c.heads > 1) {                                                           // hydra: heavy shoulders where the necks start
            this.shoulder = this.add(this.root, new THREE.SphereGeometry(1, 18, 12).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), M.skinTube);
            this.shoulder.scale.set(c.R * 1.3, c.R * .95, c.R * 1.35);
        }
        if (c.mace) {                                                                // hydra: spiked mace at the tail tip
            const tip = this.gsegs[this.ng - 1].g;
            const mz = -ds * .7, mr = c.R * .3;
            this.add(tip, G.sph(mr, 12, 9), M.body, 0, 0, mz);
            for (let i = 0; i < 10; i++) {
                const a = i / 10 * TAU, y = i % 2 ? .5 : -.2;
                const sp = this.add(tip, G.cone(mr * .22, mr * .9, 5), M.bone, Math.cos(a) * mr * .9, Math.sin(a) * mr * .9, mz + y * mr * .5);
                sp.quaternion.setFromUnitVectors(this.tmp.u, this.tmp.v.set(Math.cos(a), Math.sin(a), y * .4).normalize());
            }
            this.add(tip, G.cone(mr * .25, mr * 1.1, 5), M.bone, 0, 0, mz - mr * 1.2).rotation.x = -Math.PI / 2;
        }
        if (c.sink && c.mound) {                                                     // burrowers: earth mounds where the body enters the ground
            const dirt = mat(c.mound, { roughness: 1 });
            this.mounds = [0, 1].map(() => {
                const m = this.add(this.root, G.cyl(c.R * 1.2, c.R * 2.1, c.R * .5, 14), dirt);
                m.receiveShadow = true;
                for (let i = 0; i < 7; i++) this.add(m, G.sph(c.R * .32, 6, 5), dirt, Math.cos(i * .9) * c.R * 1.75, c.R * .2, Math.sin(i * .9) * c.R * 1.75).scale.set(1, .5, 1);
                return m;
            });
        }
        if (c.wings) {                                                               // winged serpent: big membrane wings just behind the head
            const r = this.necks[0].segs[2].r;
            this.wingG = this.grp(this.root);
            J.wings = [1, -1].map(s => makeWing(this.wingG, s, { x: s * r * .7, y: 0, z: -r, len: c.L * .42, kind: 'bat', color: c.wings, membrane: c.membrane }));
        }
        if (c.insectWings) {                                                         // nugotha: two pairs of long veined wings on the back
            const wm = mat(0xc8d0b8, { roughness: .3, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false });
            const vein = mat(0x2a2a1a, { roughness: .6 });
            const wseg = this.gsegs[1].g;
            J.iwings = [];
            for (const s of [1, -1]) for (const k of [0, 1]) {
                const g = this.grp(wseg, s * c.R * .4, c.R * .7, -k * c.R * 1.4);
                const len = c.L * (.4 - k * .05);
                const w = this.add(g, G.sph(1, 10, 4), wm, s * len * .5, 0, 0);
                w.scale.set(len * .5, .004, len * .15);
                w.castShadow = false;
                this.add(g, G.cyl(.006, .004, len, 4), vein, s * len * .5, 0, len * .05).rotation.z = Math.PI / 2;
                J.iwings.push({ g, s, k });
            }
        }
    }

    add(parent, geo, m, x = 0, y = 0, z = 0) {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
    }
    grp(parent, x = 0, y = 0, z = 0) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        return g;
    }

    // one body segment frame placed on the spine every frame (z = towards the head, y = back); carries decoration
    segment(s, neck, idx) {
        const r = this.radius(s + this.ds / 2, neck);
        const g = this.grp(this.root);
        const S = { g, r, s, bx: new THREE.Vector3(1, 0, 0), by: new THREE.Vector3(0, 1, 0), bf: new THREE.Vector3(0, 0, 1) };
        S.deco = this.decorate(g, r, this.sec.top, idx, neck);
        return S;
    }

    decorate(g, r, ft, i, neck) {
        const c = this.c, M = this.M, ds = this.ds, add = this.add.bind(this), out = [];
        const tail = !neck && i > this.nf + this.ng * .85;
        if (c.crystal && i % 3 === 1 && !tail) for (const s of [1, -1]) {           // crystal shards on the flanks
            const sh = add(g, G.cone(r * .26, r * 1.0, 4), M.body, s * r * .55, r * .55, 0);
            sh.rotation.set(-.7, 0, -s * .6);
        }
        if (c.crystal && i % 2 === 0 && !tail) add(g, G.cone(r * .2, r * .8, 4), M.belly, 0, r * ft * .95, 0).rotation.x = -.8;
        if (c.moss && i % 2 === 0 && !tail) {                                        // moss tufts and hanging strands
            const mm = mat(c.moss, { roughness: 1, side: THREE.DoubleSide });
            const m = add(g, G.sph(r * .45, 7, 5), mm, (i % 4 ? .35 : -.35) * r, r * ft * .8, 0);
            m.scale.set(1, .35, 1.3);
            if (i % 4 === 0) for (const s of [1, -1]) {
                const st = add(g, G.cone(r * .14, r * 1.2, 4), mm, s * r * .85, r * .1, 0);
                st.rotation.set(0, 0, Math.PI + s * .25);
                st.scale.set(1, 1, .25);
            }
        }
        if (c.bristle && i % 2) for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI - Math.PI / 2 + .2, b = add(g, G.cone(r * .035, r * .4, 3), M.belly, Math.sin(a) * r, Math.cos(a) * r * ft, 0);
            b.rotation.z = -a;
        }
        if (c.corpse && !tail) {                                                     // corpse wurm: spines of bone, skulls of the swallowed
            const sp = add(g, G.cone(r * .12, r * .7, 4), M.bone, 0, r * ft * 1.15, -ds * .1);
            sp.rotation.x = -.6;
            if (i % 3 === 0) {
                const sk = add(g, G.sph(r * .24, 8, 6), M.bone, (i % 2 ? .75 : -.75) * r, r * .45, 0);
                sk.scale.set(.9, .85, 1);
                add(sk, G.sph(r * .06, 5, 4), M.dark, r * .09, .02 * r, r * .2);
                add(sk, G.sph(r * .06, 5, 4), M.dark, -r * .09, .02 * r, r * .2);
            }
            if (i % 3 === 1) {
                const b = add(g, G.cyl(r * .05, r * .05, r * 1.2, 5), M.bone, (i % 2 ? -.6 : .6) * r, r * .55, 0);
                b.rotation.set(.4, 0, 1.1);
            }
        }
        const legs = c.kind === 'centipede' && !neck ? 1 : c.legsFront && !neck && i < this.nf + c.legsFront ? 2 : 0;
        if (legs) {                                                                  // a pair of legs on the segment
            const lm = mat(c.legs || c.belly, { roughness: .55 }), thin = legs === 2 ? .55 : 1, long = legs === 2 ? 1.6 : 1;
            for (const s of [1, -1]) {
                const hip = this.grp(g, s * r * .8, -r * .1, 0);
                const up = this.add(hip, G.cyl(r * .1 * thin, r * .08 * thin, r * 1.3 * long, 5), lm, s * r * .5 * long, r * .3 * long, 0);
                up.rotation.z = s * (Math.PI / 2 - .55);
                const knee = this.grp(hip, s * r * 1.05 * long, r * .62 * long, 0);
                const lo = this.add(knee, G.cyl(r * .07 * thin, r * .025, r * 1.5 * long, 5), lm, s * r * .2 * long, -r * .7 * long, 0);
                lo.rotation.z = s * .28;
                out.push({ hip, s, i });
            }
        }
        if (c.kind === 'grub' && c.head === 'maggot' && i % 2) for (const s of [1, -1]) {   // fleshy pink legs
            const lg = add(g, G.cone(r * .13, r * .55, 5), M.belly, s * r * .78, -r * .5, 0);
            lg.rotation.z = s * 2.4;
        }
        if (c.kind === 'grub' && c.head === 'mother' && i % 2) for (const s of [1, -1]) {
            const lg = add(g, G.cone(r * .08, r * .35, 5), M.belly, s * r * .85, -r * .55, 0);
            lg.rotation.z = s * 2.5;
        }
        return out;
    }

    // ---------------------------------------------------------------- the skin tube(s)
    buildTubes() {
        const c = this.c, ds = this.ds, chains = [];
        const gsR = [...this.gsegs].reverse(), gpR = [...this.gpts].reverse(), gsS = this.gpts.map((_, i) => this.gS(i)).reverse();
        if (c.heads > 1) {
            chains.push({ segs: gsR, pts: gpR, sp: gsS, neck: false, open: false });
            for (const N of this.necks) chains.push({ segs: [...N.segs].reverse(), pts: [...N.pts].reverse(), sp: N.pts.map((_, i) => i * ds).reverse(), neck: true, open: true });
        } else {
            const N = this.necks[0];
            chains.push({ segs: gsR.concat([...N.segs].reverse()), pts: gpR.concat([...N.pts].reverse().slice(1)),
                sp: gsS.concat(N.pts.map((_, i) => i * ds).reverse().slice(1)), neck: false, open: false });
        }
        const sec = this.sec, n = sec.n;
        // radial tables: offsets (in radii) and normals in the (x, back) plane; u = 0 is the belly line
        this.ex = new Float32Array(n + 1); this.ey = new Float32Array(n + 1);
        this.nx = new Float32Array(n + 1); this.ny = new Float32Array(n + 1);
        for (let j = 0; j <= n; j++) {
            const a = j / n * TAU - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), hy = sa > 0 ? sec.top : sec.bot;
            this.ex[j] = ca * sec.w; this.ey[j] = sa * hy;
            const nl = Math.hypot(ca / sec.w, sa / hy) || 1;
            this.nx[j] = ca / sec.w / nl; this.ny[j] = sa / hy / nl;
        }
        this.tubes = chains.map(ch => {
            const m = ch.segs.length, rings = [], rps = sec.bulge ? 6 : 2;      // rings per segment
            for (let k = 0; k <= m; k++) for (let q = 0; q < (k < m ? rps : 1); q++) {
                const f = q / rps, s = k < m ? ch.sp[k] + (ch.sp[k + 1] - ch.sp[k]) * f : ch.sp[m];
                let r = this.radius(Math.max(0, s), ch.neck) * (1 - sec.bulge * Math.cos(TAU * f));
                if (k === 0 && f === 0 && !ch.open) r *= .1;
                if (k === m) r = this.radius(Math.max(0, s), ch.neck);
                rings.push({ t: 'R', k, f, s, r });
            }
            const r0 = rings[rings.length - 1].r;
            rings.push({ t: 'C', off: .28, s: -r0 * .28, r: r0 * .78, k: m, f: 0 }, { t: 'C', off: .42, s: -r0 * .42, r: 0, k: m, f: 0 });
            rings.forEach((rg, i) => {                                         // radius slope along the body (tilts the normals)
                const a = rings[Math.max(0, i - 1)], b = rings[Math.min(rings.length - 1, i + 1)];
                rg.sl = Math.max(-3, Math.min(3, (b.r - a.r) / (Math.abs(a.s - b.s) || 1e-3)));
            });
            const R = rings.length, V = R * (n + 1);
            const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = [];
            rings.forEach((rg, i) => { for (let j = 0; j <= n; j++) { uv[(i * (n + 1) + j) * 2] = j / n; uv[(i * (n + 1) + j) * 2 + 1] = -rg.s / this.tileLen; } });
            for (let i = 0; i < R - 1; i++) for (let j = 0; j < n; j++) {
                const a = i * (n + 1) + j, b = a + n + 1;
                idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
            geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
            geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
            geo.setIndex(idx);
            const mesh = this.add(this.root, geo, this.M.skinTube);
            mesh.frustumCulled = false;
            return { ...ch, rings, mesh, pos, nor };
        });
        if (c.fin) this.buildCrest(this.tubes[0]);
    }

    // sea serpent: red web crest with spines along the neck and the back
    buildCrest(T) {
        const c = this.c, list = T.rings.filter(r => r.t !== 'C' && r.s < c.L * .82 && r.s > c.Lf * .05);
        const V = list.length * 2, pos = new Float32Array(V * 3), idx = [];
        for (let i = 0; i < list.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setIndex(idx);
        const m = this.add(this.root, geo, mat(c.fin, { roughness: .6, side: THREE.DoubleSide }));
        m.frustumCulled = false;
        m.castShadow = false;
        this.crest = { list, pos, geo, rings: T.rings, T };
    }

    // ring frame: position P, side X, back Y, forward F (into tmp a, b, c, f)
    ringFrame(T, rg) {
        const Tm = this.tmp, segs = T.segs, m = segs.length;
        if (rg.t === 'C') {
            const S = segs[m - 1], r0 = T.rings[T.rings.length - 3].r;
            Tm.b.copy(S.bx); Tm.c.copy(S.by); Tm.f.copy(S.bf);
            Tm.a.copy(T.pts[m]).addScaledVector(Tm.f, rg.off * r0);
            return;
        }
        const k = Math.min(rg.k, m - 1), f = rg.k === m ? 1 : rg.f;
        const P = segs[Math.max(0, k - 1)], S = segs[k], N = segs[Math.min(m - 1, k + 1)];
        // basis blended prev → segment → next (boundary frames are the average of the two segments)
        const wp = f < .5 ? (1 - 2 * f) / 2 : 0, wn = f < .5 ? 0 : (f - .5), ws = 1 - wp - wn;
        if (rg.k === m) Tm.a.copy(T.pts[m]); else Tm.a.lerpVectors(T.pts[k], T.pts[k + 1], f);
        Tm.b.copy(S.bx).multiplyScalar(ws).addScaledVector(P.bx, wp).addScaledVector(N.bx, wn).normalize();
        Tm.c.copy(S.by).multiplyScalar(ws).addScaledVector(P.by, wp).addScaledVector(N.by, wn).normalize();
        Tm.f.copy(S.bf).multiplyScalar(ws).addScaledVector(P.bf, wp).addScaledVector(N.bf, wn).normalize();
    }

    updateTubes() {
        const Tm = this.tmp, n = this.sec.n, ex = this.ex, ey = this.ey, nx = this.nx, ny = this.ny;
        for (const T of this.tubes) {
            const pos = T.pos, nor = T.nor;
            let o = 0;
            for (const rg of T.rings) {
                this.ringFrame(T, rg);
                const P = Tm.a, X = Tm.b, Y = Tm.c, F = Tm.f, r = rg.r, sl = -rg.sl;
                for (let j = 0; j <= n; j++, o += 3) {
                    const ox = ex[j] * r, oy = ey[j] * r;
                    pos[o] = P.x + X.x * ox + Y.x * oy; pos[o + 1] = P.y + X.y * ox + Y.y * oy; pos[o + 2] = P.z + X.z * ox + Y.z * oy;
                    const a = X.x * nx[j] + Y.x * ny[j] + F.x * sl, b = X.y * nx[j] + Y.y * ny[j] + F.y * sl, cz = X.z * nx[j] + Y.z * ny[j] + F.z * sl;
                    const il = 1 / Math.sqrt(a * a + b * b + cz * cz);
                    nor[o] = a * il; nor[o + 1] = b * il; nor[o + 2] = cz * il;
                }
            }
            T.mesh.geometry.attributes.position.needsUpdate = true;
            T.mesh.geometry.attributes.normal.needsUpdate = true;
        }
        if (this.crest) {
            const C = this.crest, pos = C.pos, L = this.c.L, ft = this.sec.top;
            let o = 0;
            for (const rg of C.list) {
                this.ringFrame(C.T, rg);
                const env = smooth(rg.s / (this.c.Lf * .25)) * (1 - smooth((rg.s - L * .55) / (L * .27)));
                const h = rg.r * (rg.f === .5 ? 1.25 : .55) * env, b = rg.r * ft * .8;
                const P = Tm.a, Y = Tm.c, F = Tm.f;
                pos[o++] = P.x + Y.x * b; pos[o++] = P.y + Y.y * b; pos[o++] = P.z + Y.z * b;
                pos[o++] = P.x + Y.x * (b + h) - F.x * h * .7; pos[o++] = P.y + Y.y * (b + h) - F.y * h * .7; pos[o++] = P.z + Y.z * (b + h) - F.z * h * .7;
            }
            C.geo.attributes.position.needsUpdate = true;
            C.geo.computeVertexNormals();
        }
    }

    // ---------------------------------------------------------------- heads
    buildHead(neck) {
        const c = this.c, M = this.M, add = this.add.bind(this), grp = this.grp.bind(this);
        const r0 = c.heads > 1 ? c.neckR : this.radius(0);
        const head = grp(this.root), H = { g: head, r0 };
        const hr = c.heads > 1 ? c.neckR * 1.7 : c.kind === 'worm' || c.kind === 'grub' ? r0 * 1.05 : c.head === 'dragon' ? c.R * 1.0 : c.head === 'beast' ? c.R * .85 : c.kind === 'snake' ? c.R * .9 : r0 * 1.5;
        H.hr = hr;
        switch (c.head) {
            case 'snake':
            case 'dragon':
            case 'beast': this.snoutHead(H, hr); break;
            case 'goblin':
            case 'naga': this.buildTorso(H, c.head === 'goblin'); break;
            case 'skull': {                                                         // corpse wurm: a big horned skull, dark sockets
                const len = hr * 2;
                add(head, skullGeo({ len, wB: hr * .95, wF: hr * .6, hB: hr * .85, hF: hr * .4, under: hr * .15, top: c.bone, low: 0xa89880, mouth: 0x2a1410, brow: hr * .15, cheek: .2 }), M.vc, 0, hr * .1, 0);
                for (const s of [1, -1]) {
                    add(head, G.sph(hr * .2, 8, 6), M.dark, s * hr * .42, hr * .55, len * .32).scale.set(1, .85, .6);
                    const horn = add(head, hornGeo(hr * 1.1, hr * .12, .4, -.2), M.bone, s * hr * .55, hr * .7, len * .05);
                    horn.rotation.y = Math.PI / 2 - s * .5;
                    for (let k = 0; k < 3; k++) add(head, G.cone(hr * .07, hr * .5, 4), M.bone, s * hr * (.3 + k * .15), hr * (.85 - k * .1), -len * (.05 + k * .08)).rotation.set(-1.2, 0, s * .4);
                }
                add(head, G.cone(hr * .08, hr * .15, 3), M.dark, 0, hr * .35, len * .82).rotation.x = Math.PI / 2;
                H.jaw = grp(head, 0, -hr * .05, 0);
                add(H.jaw, jawGeo({ len: len * .95, wB: hr * .85, wF: hr * .55, depth: hr * .35, low: c.bone, top: c.bone, mouth: 0x2a1410 }), M.vc);
                for (let i = 0; i < 7; i++) for (const s of [1, -1]) {
                    const t = .35 + i * .085, w = hr * (.95 + (.6 - .95) * Math.pow(t, 1.35));
                    add(head, G.cone(hr * .05, hr * .26, 4), M.tooth, s * w * .8, hr * .06, t * len - len * .12).rotation.x = Math.PI;
                    add(H.jaw, G.cone(hr * .045, hr * .22, 4), M.tooth, s * w * .7, hr * .06, t * len - len * .08);
                }
                break;
            }
            case 'maw':
            case 'sucker': {                                                        // round mouth ringed with teeth; sandworm: three lips open like petals
                const sucker = c.head === 'sucker', mh = grp(head);
                mh.rotation.x = c.petals ? 0 : -.45;                              // mouth tilted up towards the viewer
                const lip = new THREE.LatheGeometry([new THREE.Vector2(hr * .5, hr * .3), new THREE.Vector2(hr * .78, hr * .22), new THREE.Vector2(hr * .95, 0), new THREE.Vector2(hr * .92, -hr * .3)], 18).rotateX(Math.PI / 2);
                add(mh, lip, M.belly, 0, 0, hr * .1);
                add(mh, G.cyl(hr * .62, hr * .62, hr * .08, 18), M.mouth, 0, 0, hr * .1).rotation.x = Math.PI / 2;
                add(mh, G.cyl(hr * .38, hr * .38, hr * .1, 14), M.dark, 0, 0, hr * .12).rotation.x = Math.PI / 2;
                const ring = sucker ? 10 : 18;
                H.teeth = [];
                for (let k = 0; k < (sucker ? 1 : 3); k++) for (let i = 0; i < ring; i++) {
                    const a = (i + k * .5) / ring * TAU, rr = hr * (.62 - k * .12);
                    const t = add(mh, G.cone(hr * (sucker ? .05 : .07 - k * .01), hr * (sucker ? .2 : .32 - k * .05), 4), M.tooth, Math.cos(a) * rr, Math.sin(a) * rr, hr * (.18 - k * .03));
                    t.rotation.order = 'ZXY';
                    t.rotation.set(1.0, 0, a + Math.PI / 2);
                    H.teeth.push(t);
                }
                if (sucker) {                                                       // leech: two long fangs, small eyes, a tongue
                    for (const s of [1, -1]) {
                        add(mh, G.cone(hr * .07, hr * .5, 5), M.tooth, s * hr * .35, hr * .4, hr * .25).rotation.set(Math.PI - .5, 0, 0);
                        add(mh, G.sph(hr * .09, 6, 5), mat(0x101010, { roughness: .1 }), s * hr * .55, hr * .62, -hr * .1);
                    }
                    H.tongue = grp(mh, 0, -hr * .2, hr * .15);
                    add(H.tongue, G.cyl(hr * .07, hr * .04, hr * 1.1, 6), M.tongue, 0, 0, hr * .55).rotation.x = Math.PI / 2;
                    H.tongue.scale.z = .01;
                }
                if (c.petals) {                                                     // sandworm: armoured beak of three plates that open like petals
                    H.petals = [];
                    const pg = new THREE.ConeGeometry(hr * 1.02, hr * 1.7, 6, 1, true, Math.PI * 2 / 3, Math.PI * 2 / 3).rotateX(Math.PI / 2).translate(0, 0, hr * .85);
                    const pm = mat(c.color, { roughness: .6, side: THREE.DoubleSide });
                    for (let i = 0; i < c.petals; i++) {
                        const pv = grp(mh, 0, 0, hr * .1);
                        pv.rotation.z = i / c.petals * TAU;
                        const hinge = grp(pv, 0, hr * .95, 0);
                        add(hinge, pg, pm, 0, -hr * .95, 0);
                        for (let k = 0; k < 4; k++) {
                            const tt = add(hinge, G.cone(hr * .06, hr * .3, 4), M.tooth, (k - 1.5) * hr * .22, -hr * (.3 + Math.abs(k - 1.5) * .05), hr * (.4 + k % 2 * .3));
                            tt.rotation.x = Math.PI;
                        }
                        H.petals.push(hinge);
                    }
                }
                break;
            }
            case 'feelers': {                                                       // aakf: armoured blunt head, glowing eyes, ten long feelers round the mouth
                add(head, G.sph(1, 14, 10), M.skinTube, 0, 0, hr * .2).scale.set(hr * .98, hr * .9, hr * .85);
                add(head, G.sph(hr, 14, 8, 0, TAU, 0, Math.PI / 2), mat(0x3a3c42, { roughness: .3 }), 0, hr * .05, hr * .1).scale.set(1.05, .75, 1.1);   // helmet plate
                add(head, G.cyl(hr * .4, hr * .4, hr * .1, 10), M.mouth, 0, -hr * .1, hr * .98).rotation.x = Math.PI / 2;
                for (const s of [1, -1]) add(head, G.sph(hr * .16, 8, 6), glowMat(c.eye, .95), s * hr * .45, hr * .3, hr * .85);
                H.feelers = [];
                const fm = mat(0x3a3438, { roughness: .6 });
                for (let i = 0; i < 10; i++) {
                    const a = i / 10 * TAU;
                    let p = grp(head, Math.cos(a) * hr * .5, Math.sin(a) * hr * .45 - hr * .1, hr * .9);
                    const chain = [];
                    for (let k = 0; k < 6; k++) {
                        const g = grp(p), l = .17;
                        add(g, G.cyl(hr * .06 * (1 - k * .13), hr * .07 * (1 - k * .13), l, 5), fm, 0, 0, l / 2).rotation.x = Math.PI / 2;
                        chain.push(g);
                        p = grp(g, 0, 0, l);
                    }
                    H.feelers.push({ chain, a });
                }
                break;
            }
            case 'slug': {                                                          // cave slug: eye stalks and feelers
                add(head, G.sph(1, 14, 10), M.skinTube, 0, 0, hr * .25).scale.set(hr * .85, hr * .55, hr * .85);
                H.stalks = [];
                for (const s of [1, -1]) {
                    const st = grp(head, s * hr * .3, hr * .3, hr * .5);
                    add(st, G.cyl(hr * .05, hr * .08, hr * .7, 6), M.body, 0, hr * .35, 0);
                    add(st, G.sph(hr * .1, 6, 5), glowMat(c.spots, .95), 0, hr * .72, 0);
                    st.rotation.set(.5, 0, -s * .35);
                    const fe = grp(head, s * hr * .35, -hr * .15, hr * .85);
                    add(fe, G.cyl(hr * .03, hr * .05, hr * .35, 5), M.body, 0, hr * .17, 0);
                    fe.rotation.set(1.2, 0, -s * .5);
                    H.stalks.push(st);
                }
                H.jaw = grp(head, 0, -hr * .3, hr * .55);
                add(H.jaw, G.box(hr * .4, hr * .05, hr * .25), M.mouth, 0, 0, 0);
                break;
            }
            case 'maggot':
            case 'mother': {
                const mother = c.head === 'mother';
                if (mother) {                                                       // big pale head, two huge dark blue eyes
                    add(head, G.sph(1, 18, 14), M.skinTube, 0, hr * .15, hr * .25).scale.set(hr * 1.05, hr * .98, hr * .9);
                    for (const s of [1, -1]) {
                        add(head, G.sph(hr * .32, 14, 10), mat(0x0a1428, { roughness: .05, metalness: .3 }), s * hr * .5, hr * .25, hr * .78).scale.set(1, 1.1, .75);
                        add(head, G.sph(hr * .08, 6, 5), mat(0xc0d8ff, { emissive: 0x4060ff, emissiveIntensity: .8 }), s * hr * .56, hr * .4, hr * 1.0);
                    }
                } else {                                                            // armoured helmet head, one big red eye, pink feelers
                    add(head, G.sph(1, 16, 12), M.skinTube, 0, hr * .1, hr * .2).scale.set(hr, hr * .9, hr * .85);
                    add(head, G.sph(hr * 1.06, 16, 10, 0, TAU, 0, Math.PI * .5), mat(0x4a4458, { roughness: .25, metalness: .2 }), 0, hr * .2, hr * .1).scale.set(1, .9, 1.05);
                    for (const s of [1, -1]) add(head, hornGeo(hr * .9, hr * .1, .9, -.3), mat(0x2a2430, { roughness: .4 }), s * hr * .6, hr * .6, -hr * .1).scale.x = s;
                    add(head, G.sph(hr * .3, 10, 8), mat(0x2a1a20), 0, hr * .32, hr * .8);
                    add(head, G.sph(hr * .26, 10, 8), M.eye, 0, hr * .34, hr * .9).scale.set(1, 1, .8);
                    add(head, G.sph(hr * .09, 6, 5), M.dark, 0, hr * .34, hr * 1.1);
                }
                H.jaw = grp(head, 0, -hr * .3, hr * .5);
                add(H.jaw, G.sph(1, 10, 8), M.mouth, 0, 0, hr * .2).scale.set(hr * .5, hr * .22, hr * .35);
                for (let i = -2; i <= 2; i++) add(H.jaw, G.cone(hr * .05, hr * .2, 4), M.tooth, i * hr * .15, hr * .1, hr * .4);
                H.feelers = [];
                const n = mother ? 4 : 8, fm = mat(mother ? c.belly : 0xc87088, { roughness: .5 });
                for (let i = 0; i < n; i++) {
                    const a = Math.PI + (i + .5) / n * Math.PI;
                    let p = grp(head, Math.cos(a) * hr * .5, Math.sin(a) * hr * .35 - hr * .2, hr * .6);
                    const chain = [];
                    for (let k = 0; k < 3; k++) {
                        const g = grp(p), l = hr * (mother ? .3 : .38);
                        add(g, G.cyl(hr * .045, hr * .07, l, 5), fm, 0, 0, l / 2).rotation.x = Math.PI / 2;
                        chain.push(g);
                        p = grp(g, 0, 0, l);
                    }
                    H.feelers.push({ chain, a });
                }
                break;
            }
            case 'centipede': {
                add(head, G.sph(1, 14, 10), M.skinTube, 0, 0, hr * .3).scale.set(hr * .95, hr * .55, hr * .8);
                add(head, G.sph(hr, 12, 8, 0, TAU, 0, Math.PI / 2), mat(c.color, { roughness: .3 }), 0, hr * .05, hr * .25).scale.set(1, .6, .9);
                for (const s of [1, -1]) {
                    add(head, G.sph(hr * .14, 8, 6), M.eye, s * hr * .5, hr * .22, hr * .7);
                    const mand = grp(head, s * hr * .35, -hr * .1, hr * .85);
                    const m1 = add(mand, hornGeo(hr * 1.0, hr * .13, 0, .9), mat(0x1a1410, { roughness: .35 }), 0, 0, 0);
                    m1.rotation.y = -Math.PI / 2 - s * .25;
                    m1.scale.z = s;
                    (H.mand = H.mand || []).push({ g: mand, s });
                    if (c.venom) add(mand, G.sph(hr * .07, 5, 4), glowMat(c.venom, .9), s * hr * .1, 0, hr * .8);
                    const ant = grp(head, s * hr * .3, hr * .25, hr * .8);
                    const al = (c.antennae || .6) * c.R * 3;
                    add(ant, G.cyl(hr * .02, hr * .04, al, 4), mat(c.legs, { roughness: .6 }), 0, al / 2, 0);
                    ant.rotation.set(1.0, 0, -s * .5);
                    (H.ant = H.ant || []).push({ g: ant, s });
                }
                break;
            }
        }
        return H;
    }

    // snake / dragon / beast head: shaped skull and jaw, eyes with slit pupils, teeth or fangs, horns and frills
    snoutHead(H, hr) {
        const c = this.c, M = this.M, add = this.add.bind(this), grp = this.grp.bind(this), head = H.g;
        const dragon = c.head === 'dragon', beast = c.head === 'beast';
        const D = dragon ? { len: 2.9, wB: .74, wF: .42, hB: .55, hF: .27, brow: .2, cheek: .14 }
            : beast ? { len: 2.5, wB: 1, wF: .62, hB: .62, hF: .34, brow: .14, cheek: .18 }
                : { len: 2.3, wB: .8, wF: .34, hB: .5, hF: .22, brow: .12, cheek: .12 };
        const len = hr * D.len, mouth = 0x7a2a30;
        const wSurf = t => hr * (D.wB + (D.wF - D.wB) * Math.pow(t, 1.35)) * (1 + D.cheek * Math.exp(-(((t - .22) / .18) ** 2)));
        const wAt = t => hr * (D.wB + (D.wF - D.wB) * Math.pow(Math.max(0, t), 1.35)), hAt = t => hr * (D.hB + (D.hF - D.hB) * Math.pow(Math.max(0, t), .9)), zAt = t => t * len - len * .12;
        const hm = this.headMat(len), tc = hm === M.vc ? c.color : 0xffffff, lc = hm === M.vc ? c.belly : 0xffffff;
        const skull = add(head, skullGeo({ len, wB: hr * D.wB, wF: hr * D.wF, hB: hr * D.hB, hF: hr * D.hF, under: hr * .12, top: tc, low: lc, mouth,
            brow: hr * D.brow, cheek: D.cheek, snoutUp: dragon ? hr * .06 : 0 }), hm);
        H.jaw = grp(head, 0, -hr * .04, -len * .02);
        const jaw = add(H.jaw, jawGeo({ len: len * .95, wB: hr * D.wB * .86, wF: hr * D.wF * .84, depth: hr * (beast ? .42 : dragon ? .34 : .28), low: lc, top: tc, mouth }), hm);
        if (c.crystal) { skull.material = M.body; jaw.material = M.body; }
        const te = dragon ? .44 : .4, ey = hAt(te) * .45 + (dragon ? hr * .06 * te * te : 0);
        for (const s of [1, -1]) {
            const er = hr * (beast ? .11 : .13), ex = s * (wSurf(te) * Math.sqrt(1 - .45 * .45) - er * .35);
            add(head, G.sph(er, 10, 8), M.eye, ex, ey, zAt(te)).scale.set(.75, .85, 1);
            const pu = add(head, G.sph(er, 8, 6), M.dark, ex + s * er * .62, ey, zAt(te) + er * .1);
            pu.scale.set(.18, .75, .32);
            add(head, G.sph(hr * .045, 5, 4), M.dark, s * wAt(.95) * .45, hAt(.95) * .7 + (dragon ? hr * .05 : 0), zAt(.96));   // nostril
            const nT = dragon || beast ? 8 : 0;
            for (let i = 0; i < nT; i++) {
                const t = .32 + i * .075;
                add(head, G.cone(hr * .045, hr * (beast ? .3 : .22) * (i > 5 ? .8 : 1), 4), M.tooth, s * wAt(t) * .8, -hr * .02, zAt(t)).rotation.x = Math.PI;
                add(H.jaw, G.cone(hr * .04, hr * (beast ? .26 : .18), 4), M.tooth, s * wAt(t) * .72, hr * .04, zAt(t) + len * .02);
            }
            if (!dragon && !beast) {                                                // snake fangs
                const f = add(head, G.cone(hr * .045, hr * (c.fangs ? .42 : .24), 5), M.tooth, s * wAt(.8) * .6, -hr * .04, zAt(.8));
                f.rotation.x = Math.PI - .2;
            }
            if (dragon) {                                                           // swept-back horns, cheek frills
                const horn = add(head, hornGeo(hr * (c.heads > 1 ? 1.0 : 1.4), hr * .12, .25, -.05), mat(c.horn, { roughness: .55 }), s * wAt(.12) * .55, hAt(.1) * .85, zAt(.1));
                horn.rotation.y = Math.PI / 2 - s * .35;
                horn.rotation.z = .25;
                const fm = mat(c.fin || c.spines || c.horn, { roughness: .6, side: THREE.DoubleSide });
                if (c.fin) for (let k = 0; k < 3; k++) {
                    const fr = add(head, G.cone(hr * .14, hr * (1.0 - k * .2), 3), fm, s * wAt(.15) * .95, -hr * .05 + k * hr * .15, zAt(.08 + k * .05));
                    fr.rotation.set(-1.75 + k * .2, 0, s * (1.0 - k * .15));
                    fr.scale.set(1, 1, .2);
                }
            }
        }
        if (dragon) {                                                               // spines along the top of the head
            const sm = mat(c.fin || c.spines, { roughness: .6 });
            for (let k = 0; k < 5; k++) add(head, G.cone(hr * .08, hr * (.6 - k * .06), 4), sm, 0, hAt(.3 - k * .08) * .9, zAt(.3 - k * .1)).rotation.x = -1.1;
            if (!c.fin) for (const s of [1, -1]) for (let k = 0; k < 4; k++) {         // hydra: fan of dark spines behind the jaws
                const sp = add(head, G.cone(hr * .05, hr * (.75 - k * .1), 4), sm, s * wAt(.1) * (.7 + k * .08), hAt(.1) * (.5 - k * .3), zAt(.05));
                sp.rotation.set(-1.9 + k * .15, 0, s * (.5 + k * .3));
            }
        }
        if (beast) {                                                                // moss and slime hanging from the jaws
            const mm = mat(c.moss, { roughness: 1, side: THREE.DoubleSide });
            for (let i = 0; i < 5; i++) add(head, G.sph(hr * .26, 6, 5), mm, (i % 2 - .5) * hr * .7, hAt(.3) * .9, zAt(.1 + i * .17)).scale.set(1, .4, 1.3);
            for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
                const st = add(head, G.cone(hr * .1, hr * (.9 + i * .3), 4), mm, s * wAt(.3 + i * .2) * .9, -hr * .1, zAt(.3 + i * .2));
                st.rotation.x = Math.PI; st.scale.set(1, 1, .3);
            }
        }
        if (c.head === 'snake') {                                                   // forked tongue
            H.tongue = grp(head, 0, -hr * .08, zAt(.85));
            for (const s of [1, -1]) add(H.tongue, G.box(hr * .03, hr * .02, hr * .6), M.tongue, s * hr * .03, 0, hr * .3).rotation.y = s * .15;
            H.tongue.scale.z = .01;
        }
    }

    // head material: the body skin (scales, belly) mapped over the snout, tinted by the vertex colours (mouth)
    headMat(len) {
        const c = this.c, key = this.variant + len.toFixed(3);
        if (!this.M.skinTube.map || c.crystal) return this.M.vc;
        if (!HEAD_MATS.has(key)) {
            const map = this.M.skinTube.map.clone(), bump = this.M.skinTube.bumpMap.clone();
            for (const t of [map, bump]) { t.repeat.set(1, len / this.tileLen * 1.4); t.needsUpdate = true; }
            HEAD_MATS.set(key, new THREE.MeshStandardMaterial({ color: 0xffffff, map, bumpMap: bump, bumpScale: this.M.skinTube.bumpScale * .6, vertexColors: true, roughness: .5 }));
        }
        return HEAD_MATS.get(key);
    }

    // serpent guardian / goblin snake: scaly humanoid torso with arms on top of the raised snake body
    buildTorso(H, goblin) {
        const c = this.c, add = this.add.bind(this), grp = this.grp.bind(this);
        const T = humanTorso(H.g, { skin: c.skin, reptile: c.belly, head: goblin ? 'goblin' : 'lizard', crest: c.crest, claws: goblin, scale: c.torso,
            headScale: goblin ? 1.45 : 1.05, eye: c.eye, mouth: 0x7a2a30 });
        T.T.position.y = -c.R * .4;
        H.torso = T.T; H.thead = T.head; H.jaw = T.jaw; H.arms = T.arms;
        if (goblin) return;
        const gold = mat(0xc8a040, { roughness: .35, metalness: .6 });
        add(T.T, G.torus(.12, .02, 5, 16), gold, 0, .52, 0).rotation.x = Math.PI / 2;        // golden collar
        for (const A of T.arms) add(A.el, G.torus(.034, .01, 4, 12), gold, 0, -.2, 0).rotation.x = Math.PI / 2;
        // straight sword with a pale blue blade in the right hand (-x), a war ring in the left
        const right = T.arms[1], left = T.arms[0];
        const blade = grp(right.hand, 0, -.075, .01);
        add(blade, G.cyl(.016, .016, .13, 6), mat(0x3a2a1a), 0, 0, 0).rotation.x = Math.PI / 2;
        add(blade, G.box(.16, .022, .025), gold, 0, 0, .07);
        add(blade, G.box(.045, .01, .78), mat(0xb8d8e8, { roughness: .2, metalness: .7, emissive: 0x2a6080, emissiveIntensity: .35 }), 0, 0, .47);
        add(blade, G.tip(.03, .1, .25), mat(0xb8d8e8, { roughness: .2, metalness: .7 }), 0, 0, .9).scale.set(.8, .35, 1);
        add(left.hand, G.torus(.1, .012, 5, 20), mat(0x2a3434, { roughness: .35, metalness: .6 }), 0, -.08, .07).rotation.y = Math.PI / 2;
    }

    // ---------------------------------------------------------------- states
    statePose(state, c, t) {
        const S = this.STAND, V = this.c, P = { ...S };
        switch (state) {
            case 'idle':
                P.sway = Math.sin(t * .7) * .25;
                P.headX = Math.sin(t * .9) * .08;
                P.lean = Math.sin(t * .5) * .08;
                return P;
            case 'walk': return { ...P, rise: S.rise * .55, amp: .6, coil: 0, sway: 0 };
            case 'run': return { ...P, rise: S.rise * .35, amp: .75, coil: 0, lean: .2, sway: 0, wing: V.wings || V.insectWings ? 1 : 0 };
            case 'attack': {
                const dur = c.actionDuration || .8;
                const p = c.actionDuration ? 1 - c.actionTime / dur : (this.stateTime / .8) % 1;
                const W = { ...P, rise: Math.min(1.2, S.rise + .3), lean: -.4, bz: -.15, headX: .35, jaw: .3, coil: 0, amp: .05, arm: -1, guard: 0, wing: 1 };
                const K = { ...P, rise: Math.min(1.2, S.rise + .25), lean: 1.05, bz: .45, headX: -.15, jaw: 1, coil: 0, amp: .05, arm: 1, wing: 1 };
                const B = { ...K, jaw: .08, lean: .8, bz: .35 };
                if (V.sink) { W.rise = 1.15; W.lean = -.5; K.lean = 1.35; K.rise = .9; }
                else if (!V.upright) { K.lean = .5; K.headX = .15; K.rise = Math.min(1.2, S.rise + .35); B.lean = .4; B.rise = K.rise; }
                if (V.kind === 'centipede') { W.rise = 1; K.lean = .3; K.rise = .8; B.lean = .25; B.rise = .75; }
                let A = this.mixP(P, W, smooth(p / .32));
                if (p > .32) A = this.mixP(A, K, smooth((p - .32) / .14));
                if (p > .5) A = this.mixP(A, B, smooth((p - .5) / .12));
                if (p > .72) A = this.mixP(A, S, smooth((p - .72) / .28));
                this.atkP = p;
                return A;
            }
            case 'defend': return { ...P, rise: Math.min(1.25, S.rise + .35), lean: -.25, headX: .35, jaw: .75 + Math.sin(t * 10) * .1, coil: S.coil * .5, sway: Math.sin(t * 2.6) * .25, guard: 1, wing: 1 };
            case 'hit': return { ...P, rise: S.rise * .8, lean: -.6, headX: .5, jaw: .55, guard: .5, fly: S.fly * .6 };
            case 'kneel': return { ...P, rise: S.rise * .4, amp: 0, coil: Math.max(.55, S.coil), headX: -.1, fly: 0 };
            case 'lie': return { ...P, rise: .06, amp: .08, coil: Math.max(.6, S.coil), headX: -.15, jaw: .02, fly: 0 };
            case 'death': return { ...P, rise: 0, lean: .2, amp: .28, coil: 0, roll: 1.9, headX: -.3, jaw: .6, sway: .3, arm: 0, guard: 0, fly: 0 };
            default: return P;
        }
    }
    mixP(A, B, k) { const o = {}; for (const key of KEYS) o[key] = A[key] + (B[key] - A[key]) * k; return o; }

    update(c, dt) {
        this.time += dt;
        const t = this.time, V = this.c;
        const state = c.state || 'idle';
        if (state !== this.state) { this.state = state; this.stateTime = 0; }
        this.stateTime += dt;
        const target = state === 'run' ? 2 : state === 'walk' ? 1 : 0;
        this.gait = damp(this.gait, target, 5, dt);
        const lambda = Math.max(1, V.L * .3);
        if (target > 0) this.phase += dt * (c.speed || 3) * (target === 2 ? (c.runMultiplier || 1) * 1.4 : 1) / this.size / lambda * TAU;
        else if (state !== 'death') this.phase += dt * .25;

        const P = this.statePose(state, c, t);
        const k = state === 'attack' ? 22 : state === 'hit' ? 16 : state === 'death' ? 2.5 : state === 'lie' || state === 'kneel' ? 3 : 6;
        for (const key of KEYS) this.p[key] = damp(this.p[key], P[key], k, dt);
        const q = this.p;
        this.spine(q, t, lambda, state);
        this.place(q, t, dt, state);
        this.updateTubes();

        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        const yaw = Math.PI - compass;
        if (this.yaw === null) this.yaw = yaw;
        let d = yaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-6 * dt));
        this.root.rotation.y = this.yaw;
    }

    // build the spine points: ground part from the neck base backwards, then each neck forwards and up
    spine(q, t, lambda, state) {
        const V = this.c, ds = this.ds, K = TAU / lambda, ng = this.ng, nf = this.nf, fb = this.sec.bot;
        const Lg = ng * ds, rise = Math.max(0, q.rise);
        // ground part: heading = travelling wave + coil curvature (the coil winds inward and stacks, neck on top)
        const kc = q.coil * TAU * 1.1 / Lg;
        let yaw = 0, turn = 0;
        for (let i = 0; i <= ng; i++) {
            const s = i * ds;
            this.gYaw[i] = yaw + q.amp * Math.sin(K * s + this.phase) * smooth(s / (lambda * .5));
            this.gTurn[i] = turn;
            const kap = kc * (1 + s / Lg * 1.3);
            yaw += kap * ds;
            turn += kap * ds / TAU;
        }
        const T = turn, sink = V.sink, z0 = V.Lf * .25 + q.bz * V.Lf, hov = V.hover ? V.hover * q.fly * (1 + .1 * Math.sin(t * 2.3)) : 0;
        const r0 = this.gsegs[0].r;
        const y0 = r0 * fb * (1 - sink) + (T > .3 ? T * r0 * 1.6 : 0) + hov;
        let x = 0, z = z0, sank = -1;
        for (let i = 0; i <= ng; i++) {
            const r = this.gsegs[Math.min(i, ng - 1)].r;
            const stack = T > .3 ? (T - this.gTurn[i]) * r * 1.6 : 0;
            const under = sink ? sink * smooth(i * ds / Math.max(1, V.L * .12)) * r * 2.4 : 0;
            this.gpts[i].set(x, i === 0 ? y0 : r * fb * (1 - sink) + stack - under + hov * (1 - .25 * i / ng) + (hov ? Math.sin(t * 3 - i * .5) * .03 : 0), z);
            if (sank < 0 && sink && this.gpts[i].y < -r * .2) sank = i;
            const a = this.gYaw[i];
            x -= Math.sin(a) * ds;
            z -= Math.cos(a) * ds;
        }
        this.sankAt = sank;
        // necks: S-curve up from the neck base, leaning forward to strike; flat poses continue the ground wave
        for (const N of this.necks) {
            const pts = N.pts, nr = rise * N.rise;
            let px = 0, py = y0, pz = z0;
            pts[nf].set(px, py, pz);
            let lean = q.lean, nYaw = N.yaw0 * (.4 + .6 * Math.min(1, nr));
            if (V.heads > 1) {                                                      // hydra heads strike one after another
                const p = state === 'attack' ? this.atkP || 0 : -1;
                const pk = p < 0 ? 0 : smooth(Math.max(0, Math.min(1, (p - .3 - N.k * .07) / .16))) * (1 - smooth((p - .62 - N.k * .05) / .2));
                N.att = pk;
                lean = q.lean * .3 + pk * 1.1 + Math.sin(t * 1.3 + N.k * 1.7) * .08;
                nYaw += Math.sin(t * .8 + N.k * 2.1) * .12;
            }
            for (let i = nf - 1; i >= 0; i--) {
                const u = (nf - i - .5) / nf;
                const start = sink ? 1 : smooth(u / .25);
                let pitch = V.upright ? nr * start * 1.5 - lean * u * u * 1.2
                    : nr * start * (1.55 - 1.75 * u * u) - lean * u * 1.4;
                if (V.kind === 'centipede' || V.kind === 'slug') pitch = nr * start * (1.3 - 1.6 * u) - lean * u;
                if (V.heads > 1) pitch = nr * start * (1.45 - 1.55 * u * u) - lean * u * 1.4;
                if (V.cobra) pitch = nr * smooth(u / .4) * 1.45 * (1 - smooth((u - V.cobra) / (1 - V.cobra)) * 1.05) - lean * u * 1.5;
                const flatWave = (1 - Math.min(1, nr)) * q.amp * Math.sin(-K * (nf - i) * ds + this.phase);
                const yw = nYaw + q.sway * u + flatWave;
                const cp = Math.cos(pitch);
                px += Math.sin(yw) * cp * ds;
                py += Math.sin(pitch) * ds;
                pz += Math.cos(yw) * cp * ds;
                const rr = this.radius((i + .5) * ds, V.heads > 1);
                pts[i].set(px, Math.max(rr * fb, py), pz);
            }
        }
    }

    // put every segment frame on the spine, then the heads
    place(q, t, dt, state) {
        const V = this.c, ng = this.ng;
        // ground part: tail → neck base, parallel transport of the back vector
        const d = this._d.set(0, 1, 0);
        for (let i = ng - 1; i >= 0; i--) this.orient(this.gsegs[i], this.gpts[i + 1], this.gpts[i], d, q.roll, t, state);
        const dBase = this._dBase.copy(d);
        for (const N of this.necks) {
            d.copy(dBase);
            for (let i = this.nf - 1; i >= 0; i--) this.orient(N.segs[i], N.pts[i + 1], N.pts[i], d, q.roll, t, state);
            this.placeHead(N, q, t, dt, state, d);
        }
        if (this.shoulder) {
            this.shoulder.position.copy(this.gpts[0]);
            this.shoulder.position.y = Math.max(this.shoulder.position.y, V.R * .8);
            this.shoulder.rotation.y = this.gYaw[0];
        }
        if (this.mounds) {
            this.mounds[0].position.set(this.gpts[0].x, V.R * .15, this.gpts[0].z);
            const sa = Math.max(1, this.sankAt);
            this.mounds[1].position.set(this.gpts[sa].x, V.R * .1, this.gpts[sa].z);
            this.mounds[1].visible = this.sankAt > 0;
        }
        const J = this.j;
        if (this.wingG) {                                                            // wings ride level on the upper neck
            const S = this.necks[0].segs[Math.min(this.nf - 1, 2)];
            this.wingG.position.copy(S.g.position);
            const h = this.tmp.h.set(S.bf.x - S.by.x, 0, S.bf.z - S.by.z);
            this.wingG.rotation.set(0, Math.atan2(h.x, h.z), q.roll * .8);
        }
        if (J.wings) {
            const flap = state === 'run' || state === 'attack' ? Math.sin(t * 9) : state === 'defend' ? Math.sin(t * 5) * .6 : 0;
            for (const w of J.wings) w.set(state === 'death' ? .9 : Math.min(1, q.wing + .7), state === 'death' ? -.3 : flap + Math.sin(t * 1.5) * .1 + .45);
        }
        if (J.iwings) for (const w of J.iwings) {
            const open = Math.max(q.wing, q.fly), buzz = open > .3 ? Math.sin(t * 60 + w.k) * .5 : 0;
            w.g.rotation.set(0, w.s * (1 - open) * (1.3 - w.k * .15), w.s * (.15 + (.25 + buzz) * open));
        }
    }

    orient(S, a, b, d, roll, t, state) {
        const Tm = this.tmp, f = Tm.f.subVectors(b, a);
        const len = f.length() || 1e-4;
        f.divideScalar(len);
        // parallel transport of the back vector along the chain
        d.addScaledVector(f, -d.dot(f));
        if (d.lengthSq() < 1e-6) d.set(0, 1, 0).addScaledVector(f, -f.y);
        d.normalize();
        const dr = Tm.v.copy(d);
        if (roll) dr.multiplyScalar(Math.cos(roll)).addScaledVector(Tm.x.crossVectors(f, d), Math.sin(roll));
        const x = Tm.x.crossVectors(dr, f).normalize();
        Tm.m.makeBasis(x, dr, f);
        S.g.quaternion.setFromRotationMatrix(Tm.m);
        S.g.position.addVectors(a, b).multiplyScalar(.5);
        S.bx.copy(x); S.by.copy(dr); S.bf.copy(f);
        if (S.deco.length) {                                                       // legs: ripple wave
            const g = Math.min(1, this.gait), dead = state === 'death';
            for (const L of S.deco) {
                const ph = this.phase * 2.2 - L.i * .9 + (L.s > 0 ? 0 : Math.PI);
                L.hip.rotation.y = dead ? .3 * L.s : Math.sin(ph) * (.25 + .3 * g) + Math.sin(t * 3 + L.i) * .03;
                L.hip.rotation.z = dead ? -L.s * .9 : L.s * Math.max(0, Math.cos(ph)) * .3 * g;
            }
        }
    }

    placeHead(N, q, t, dt, state, d) {
        const V = this.c, H = N.head, Tm = this.tmp, pts = N.pts;
        const f = Tm.f.subVectors(pts[0], pts[1]).normalize();
        d.addScaledVector(f, -d.dot(f)).normalize();
        const dr = Tm.v.copy(d);
        if (q.roll) dr.multiplyScalar(Math.cos(q.roll)).addScaledVector(Tm.x.crossVectors(f, d), Math.sin(q.roll));
        if (V.upright) {                                                            // upright bodies: level head looking forward
            const h = Tm.h.set(f.x - dr.x, 0, f.z - dr.z);
            if (h.lengthSq() < 1e-6) h.set(0, 0, 1);
            h.normalize();
            const x = Tm.x.crossVectors(Tm.u, h).normalize();
            Tm.m.makeBasis(x, Tm.u, h);
            H.g.quaternion.setFromRotationMatrix(Tm.m);
            if (q.roll) H.g.rotateZ(q.roll);
        } else {
            const x = Tm.x.crossVectors(dr, f).normalize();
            Tm.m.makeBasis(x, dr, f);
            H.g.quaternion.setFromRotationMatrix(Tm.m);
        }
        H.g.position.copy(pts[0]);
        const att = V.heads > 1 ? N.att : 0;
        H.g.rotateX(-(q.headX + att * -.2));
        const jaw = Math.min(1, q.jaw + att * .9);
        if (H.jaw) H.jaw.rotation.x = jaw * (V.head === 'naga' ? .35 : V.head === 'goblin' ? .55 : .85);
        if (H.tongue) {                                                             // tongue flicks
            this.flickTimer -= dt;
            if (this.flickTimer <= 0) { this.flick = 1; this.flickTimer = 1.2 + Math.random() * 2.5; }
            this.flick = Math.max(0, this.flick - dt * 2.5);
            const out = state === 'death' ? 0 : Math.max(Math.sin(this.flick * Math.PI), V.head === 'sucker' ? jaw * .8 : 0);
            H.tongue.scale.z = .01 + out;
            H.tongue.rotation.x = Math.sin(t * 40) * .15 * out;
        }
        if (H.petals) H.petals.forEach(p => { p.rotation.x = -jaw * 1.1; });
        if (H.teeth && !H.petals) H.teeth.forEach(tt => { tt.rotation.x = 1.0 + jaw * .5; });
        if (H.mand) for (const m of H.mand) m.g.rotation.y = m.s * (.15 + jaw * .7 - (state === 'idle' ? Math.max(0, Math.sin(t * 4)) * .1 : 0));
        if (H.ant) for (const a of H.ant) { a.g.rotation.x = 1.0 + Math.sin(t * 3 + a.s) * .2; a.g.rotation.z = -a.s * (.5 + Math.sin(t * 2.3 + a.s * 2) * .2); }
        if (H.stalks) H.stalks.forEach((s, i) => { s.rotation.x = .5 + Math.sin(t * 1.7 + i * 2) * .2 - (state === 'hit' || state === 'death' ? .6 : 0); });
        if (H.feelers) {
            const dead = state === 'death', lash = state === 'attack' ? Math.max(0, q.lean) : 0;
            for (const F of H.feelers) F.chain.forEach((g, k) => {
                const w = dead ? .05 : .3 + lash * .2;
                g.rotation.x = Math.sin(t * 2.4 + F.a * 3 - k * .8) * w + (k === 0 ? Math.sin(F.a) * (.45 - lash * .45) : -lash * .05);
                g.rotation.y = Math.cos(t * 2 + F.a * 2 - k * .7) * w + (k === 0 ? -Math.cos(F.a) * (.45 - lash * .45) : 0);
            });
        }
        if (H.arms) {
            const naga = V.head === 'naga';
            for (const A of H.arms) {
                const right = A.s < 0;
                if (naga) {
                    let sx = -.25 + Math.sin(t * 1.2 + A.s) * .05, sz = A.s * .25, ex = -.5;
                    if (right) { sx = -.9 - q.arm * .9 + q.guard * -.6; ex = -.6 + q.arm * .4; sz = -.2; }
                    else { sx += -q.guard * 1.1 - .3; ex += -q.guard * .9 - .4; }
                    if (state === 'death') { sx = .3; ex = -.1; sz = A.s * .8; }
                    A.sh.rotation.set(sx, 0, sz);
                    A.el.rotation.x = ex;
                } else {                                                            // goblin snake: claws held ready, slash in the attack
                    const claw = state === 'attack' ? q.arm : 0;
                    A.sh.rotation.set(state === 'death' ? .3 : -.35 - claw * 1.1 - q.guard * .8, 0, A.s * (.22 + Math.sin(t * 2 + A.s) * .05));
                    A.el.rotation.x = state === 'death' ? -.1 : -.65 + claw * .35 - q.guard * .5;
                }
            }
            if (H.torso) {
                H.torso.rotation.x = q.lean * .35 + (1 - Math.min(1, q.rise * 2.5)) * (state === 'death' ? -1.2 : .9);
                H.thead.rotation.set(-q.headX * .8 + (state === 'death' ? .5 : 0), q.sway * -.5, 0);
            }
        }
    }
}
