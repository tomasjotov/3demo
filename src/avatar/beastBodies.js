/*
 * Humanoid bodies of bestiary monsters (bestiary key → avatar/creatures.js BEAST_BODIES → lookBase here).
 * Looked up by exact name in bodies.js bodyFor() before the 2D bases. The flesh is sculpted by avatar/beastSculpt.js
 * (smooth torso, limbs, hands, face), the monster parts are built by avatar/beastParts.js.
 *
 * Flags on top of the plain body (bodies.js):
 *   build                     'muscle' (default) | 'female' (default of female) | 'fat' | 'lean' – shape of the sculpted body
 *   bulk, limb, arm, leg      torso width, limb thickness, arm length, leg length multipliers; headK head size (default by build)
 *   face                      'demon' | 'human' | 'female' | 'gaunt' sculpted face; maw: huge hinged jaw full of fangs
 *   hunch, gait: 'knuckle'    forward lean of the upright states; knuckle walk (gorilla, beetle)
 *   skinTex, texColor, glow   canvas skin pattern ('lava' 'rot' 'fur' 'scales' 'chitin' 'veins' 'sinew'),
 *                             its accent colour and the emissive glow of the accent (lava cracks)
 *   glowEyes                  emissive eye colour
 *   head                      'wolf' | 'bull' | 'insect' | 'ape' | 'skull' | 'none' (+ wolf: {coat, dark, light, ear})
 *   horn                      { len, r, up, fwd, curl, color, x, y, z } or a list of pairs
 *   hair                      { color, style: 'long' | 'wild' | 'curly' | 'short', len } own hair (hair layers are left out)
 *   wings                     { kind: 'bat' | 'feather' | 'insect', len, color, membrane, feather, inner, torn }
 *   legs                      'goat' (hooves) | 'digi' (paws, claws) | 'fish' (tail instead of legs), legColor, legFur, hoof;
 *                             hipFur: the hips carry the leg fur; legs and ownLegWear drop trousers / greaves / shoes layers
 *   fishTail                  { color, fin }
 *   tail                      { n, r, seg, color, tip: 'spade' | 'tuft' | 'brush' | 'spikes', lift (first segment), curve }
 *   tongue, fangs, eyesN      long tongue colour, fangs, extra eyes on the forehead
 *   paunch, paunchColor       belly size of a fat body and its paler colour; pustules: colour of boils; chest: paler chest
 *   smoke                     { color, n, tip } shadow tendrils from the back; shadowHead: horned shadow behind the head
 *   spikes, claws, clawLen    spike level 1..3, claw colour and length, fur: fur tuft colour (shoulders, mane)
 *   lingerie                  { color, corset, stockings, skirt, skirtLen, choker } black lace of the succubi
 *   armour                    { color, trim, chest, harness, pauldron, spikes, vambraces, greaves, belt, skirt, skirtLen }
 *   robe, tunic               long tattered robe { color, len, hood, belt } / shirt colour
 *   weapon                    layer key of a weapon of its own, taken when the look brings none
 *   extraArms, insectLegs, fins, carapace, collar, hover, skirt
 */

const DEMON = { ears: 'pointy', eyeWhite: 0x1a0806, underwear: 0x24140e, face: 'demon', brute: 1 };
const lava = (skin, crack, glow = crack) => ({ skin, skinTex: 'lava', texColor: crack, glow });
const hornPair = (len, r, up, fwd, color, curl = 0, x = .11, y = .17, z = .02) => ({ len, r, up, fwd, curl, color, x, y, z });

// Demons of wrath (gug): huge red / black muscle, glowing lava cracks, big crescent horns, claws; III–V get bat wings.
const ANGER = {
    'demon-anger-1': { ...DEMON, ...lava(0x5a1c1c, 0xff6a10), scale: 1.3, bulk: 1.28, limb: 1.25, arm: 1.08, glowEyes: 0xffb020, fangs: true,
        claws: 0x1a0c08, clawLen: 1.4, horn: hornPair(.58, .075, .6, .45, 0x2a1810, 1.2, .12, .14, .02), spikes: 1 },
    'demon-anger-2': { ...DEMON, ...lava(0x231816, 0xff3a10), scale: 1.45, bulk: 1.3, limb: 1.25, arm: 1.12, hunch: .12, glowEyes: 0xff4020,
        fangs: true, claws: 0x0e0808, clawLen: 1.6, horn: hornPair(.6, .075, .55, .6, 0x1a1210, 1.1, .12, .14, .02), spikes: 3, legs: 'digi', legK: 1.2 },
    'demon-anger-3': { ...DEMON, ...lava(0x4a1414, 0xff2a10), scale: 1.6, bulk: 1.25, limb: 1.2, arm: 1.12, glowEyes: 0xff3010, fangs: true,
        claws: 0x140808, clawLen: 1.5, horn: hornPair(.56, .072, .7, .4, 0x1e1412, 1.2, .12, .14, .02), spikes: 1,
        wings: { kind: 'bat', len: 1.35, color: 0x2a1010, membrane: 0x7a1414 } },
    'demon-anger-4': { ...DEMON, ...lava(0x3e3a3c, 0xff4a18), scale: 1.8, bulk: 1.35, limb: 1.3, arm: 1.12, hunch: .12, glowEyes: 0xff3010, fangs: true,
        claws: 0x101010, clawLen: 1.6, horn: hornPair(.64, .08, .6, .45, 0x161212, 1.3, .12, .14, .02), spikes: 2,
        wings: { kind: 'bat', len: 1.55, color: 0x1a1414, membrane: 0x3a2224 } },
    'demon-anger-5': { ...DEMON, ...lava(0x1a1214, 0xff2010), scale: 2.1, bulk: 1.35, limb: 1.3, arm: 1.12, glowEyes: 0xff2010, fangs: true,
        claws: 0x0a0606, clawLen: 1.7, horn: [hornPair(.64, .08, .65, .45, 0x120c0c, 1.2, .12, .14, .02), hornPair(.24, .04, .3, -.1, 0x120c0c, 0, .15, .05, -.06)],
        spikes: 3, armour: { color: 0x141012, trim: 0x5a1010, pauldron: .15, spikes: 3, vambraces: true, greaves: true, skirt: 0x120c0e, skirtLen: .38 },
        wings: { kind: 'bat', len: 1.75, color: 0x160c0c, membrane: 0x4a0e10 }, tail: { n: 7, r: .07, color: 0x1a1214, tip: 'spikes' } }
};

// Demons of decay (gug): gaunt rotting bodies, skull heads, horns, long claws, torn bat wings from II up.
const DECAY_BASE = { build: 'lean', head: 'skull', skinTex: 'rot', ribs: true, claws: 0x1a1612, clawLen: 1.6, eyeWhite: 0x101010, underwear: 0x2a2a20,
    hunch: .18, arm: 1.1 };
const DECAY = {
    'demon-decay-1': { ...DECAY_BASE, skin: 0x1a1618, texColor: 0xe0d8c8, skull: 0x2a2426, glowEyes: 0xffa020, scale: 1.25,
        horn: hornPair(.42, .045, 1.1, -.05, 0x141010, .3, .09, .17, 0), spikes: 1 },
    'demon-decay-2': { ...DECAY_BASE, skin: 0x3e4a34, texColor: 0x6a5a30, skull: 0xc8d0a0, glowEyes: 0x90ff40, scale: 1.3, skirt: 0x2a2e22,
        wings: { kind: 'bat', len: 1.25, color: 0x2a2a20, membrane: 0x3a3428, torn: true } },
    'demon-decay-3': { ...DECAY_BASE, skin: 0x9ab890, texColor: 0x8a3020, skull: 0xd8e0c8, glowEyes: 0xff4020, scale: 1.35,
        horn: hornPair(.34, .05, .2, -.35, 0x6a5a40, 2.2, .12, .12, -.02),
        wings: { kind: 'bat', len: 1.35, color: 0x4a3020, membrane: 0x8a4a22, torn: true } },
    'demon-decay-4': { ...DECAY_BASE, skin: 0x6a6660, texColor: 0x7a2a20, skull: 0xe0dcd0, glowEyes: 0xff6040, scale: 1.4, spikes: 1,
        horn: [hornPair(.4, .03, .9, -.2, 0x5a2a20, 3.2), hornPair(.32, .025, .5, .1, 0x5a2a20, 2.6, .14, .08, -.06)],
        wings: { kind: 'bat', len: 1.45, color: 0x3a3634, membrane: 0x4a4644, torn: true } },
    'demon-decay-5': { ...DECAY_BASE, skin: 0x24281e, texColor: 0x9a2a1a, skull: 0x3a3a2c, glowEyes: 0xffe040, scale: 1.45, skirt: 0x22261c,
        horn: hornPair(.22, .045, .6, .2, 0x1a1a14), paunchWound: true, hunch: .3,
        wings: { kind: 'bat', len: 1.6, color: 0x1e2414, membrane: 0x3a4a26, torn: true } }
};

// Demons of gluttony (gug): enormous bellies on small heads, long tongues, horns on some.
const GLUTTONY = {
    'demon-gluttony-1': { build: 'fat', face: 'demon', brute: 1.2, scale: 1.35, bulk: 1.3, limb: 1.2, leg: .9, skin: 0xd8b8a8, eye: 0x6a2020, eyeWhite: 0xe0d0c0,
        brow: 0x9a7a70, ears: 'pointy', paunch: 1.35, tongue: 0xa83a3a, fangs: true, pustules: 0xd09080, claws: 0x5a4030, underwear: 0x4a3028, hunch: .1 },
    'demon-gluttony-2': { build: 'fat', face: 'demon', brute: 1.2, scale: 1.4, bulk: 1.15, limb: .85, skin: 0x2e3440, eye: 0xd0d040, eyeWhite: 0x101010,
        brow: 0x1a1e26, ears: 'pointy', paunch: 1.3, paunchColor: 0x7e7884, fangs: true, claws: 0x1a1a1a, underwear: 0x3a1e1e, hunch: .15,
        horn: hornPair(.34, .05, .9, .25, 0x2a2a2a, .4) },
    'demon-gluttony-3': { build: 'fat', face: 'demon', brute: 1.2, scale: 1.55, bulk: 1.4, limb: 1.3, leg: .88, skin: 0x3a2a22, skinTex: 'fur', texColor: 0x24180f,
        eye: 0x2a1a10, eyeWhite: 0xc0a080, brow: 0x1a120c, paunch: 1.45, tongue: 0xb04848, fangs: true, fur: 0x2a1c14, claws: 0x1a120c,
        underwear: null, hunch: .15 },
    'demon-gluttony-4': { build: 'fat', face: 'demon', brute: 1.2, scale: 1.5, bulk: 1.3, limb: 1.15, skin: 0x7a9a6a, eye: 0xe0e040, eyeWhite: 0x302810,
        brow: 0x3a4a2a, ears: 'pointy', eyesN: 2, paunch: 1.35, pustules: 0xd8d8b0, fangs: true, claws: 0x2a2a1a, underwear: 0x3a3a26,
        paunchWound: true, horn: hornPair(.4, .055, .7, .1, 0x3a3020, 1.2) },
    'demon-gluttony-5': { build: 'fat', face: 'demon', brute: 1.2, scale: 1.6, bulk: 1.4, limb: 1.25, leg: .9, skin: 0xd8d0b8, skinTex: 'veins', texColor: 0xa01810,
        eye: 0x400808, eyeWhite: 0xd8c8a8, brow: 0x8a7a68, paunch: 1.55, fangs: true, extraArms: true, claws: 0x5a3020, underwear: 0x5a2a20 }
};

// Demons of possession (gug): gaunt possessed people, black shadow tendrils and horned shadows, red eyes.
const POSSESSED = { build: 'lean', face: 'gaunt', glowEyes: 0xff1a10, eyeWhite: 0x200404, underwear: 0x18121a };
const POSSESSION = {
    'demon-possession-1': { ...POSSESSED, skin: 0xd8ccc8, skinTex: 'veins', texColor: 0xd0102a, glow: 0x801020, brow: 0x2a1a1a, fangs: true,
        shadowHead: 0x120c12, smoke: { color: 0x120c12, n: 6, tip: 0xa01020 } },
    'demon-possession-2': { ...POSSESSED, female: true, build: 'female', face: 'female', scale: .95, skin: 0xe0dcd8, brow: 0x141014, lips: 0x3a2a30,
        hair: { color: 0x0e0c10, style: 'wild', len: .55 }, lingerie: { color: 0x141014, corset: true, skirt: 0x0e0c10, skirtLen: .8, choker: false },
        smoke: { color: 0x0e0c10, n: 8 } },
    'demon-possession-3': { ...POSSESSED, skin: 0xb89a88, brow: 0x141010, fangs: true, claws: 0x2a1a14, scale: 1.05,
        hair: { color: 0x141010, style: 'wild', len: .12 },
        horn: [hornPair(.3, .045, .9, .25, 0x1a1414, .8), hornPair(.15, .025, .5, .3, 0x1a1414, 0, .14, .08, .02)],
        smoke: { color: 0x141012, n: 5, tip: 0xff5010 } },
    'demon-possession-4': { ...POSSESSED, skin: 0xa8a098, brow: 0x2a2422, scale: 1.1, shadowHead: 0x0e0c10, tunic: 0x6a625c,
        hair: { color: 0x2a2422, style: 'short' }, smoke: { color: 0x0e0c10, n: 10 } },
    'demon-possession-5': { ...POSSESSED, skin: 0x7a6a8a, skinTex: 'veins', texColor: 0xff6020, glow: 0xff4010, brow: 0x2a2030, scale: 1.15, fangs: true,
        claws: 0x1a1420, ears: 'pointy', smoke: { color: 0x1a1220, n: 12, tip: 0x8a2a60 } }
};

// Demons of pride: succubi – pale or red skin, long hair, horns, bat wings, a thin tail with a spade, black lace lingerie.
const SUCCUBUS = { female: true, face: 'female', ears: 'pointy', underwear: 0x141012, ownLegWear: true, lips: 0x6a1a2a,
    tail: { n: 8, r: .03, seg: .12, color: null, tip: 'spade', lift: -.5, curve: -.18 } };
const LACE = { color: 0x141012, corset: true, stockings: true };
const PRIDE = {
    'demon-pride-1': { ...SUCCUBUS, scale: .95, skin: 0xe8d0c8, eye: 0x2a6a4a, brow: 0x141012, hair: { color: 0x141012, style: 'long', len: .62 },
        horn: hornPair(.3, .045, .35, -.45, 0x141012, 1.7, .1, .15, 0), wings: { kind: 'bat', len: .85, color: 0x1a1214, membrane: 0x2a1a20 },
        lingerie: { ...LACE, skirt: 0x0e0c0e, skirtLen: .78 } },
    'demon-pride-2': { ...SUCCUBUS, scale: .97, skin: 0xd8d4e8, eye: 0x6a2a4a, brow: 0x141012, hair: { color: 0x141018, style: 'long', len: .55 },
        horn: hornPair(.4, .045, .95, -.3, 0x141012, .5, .09, .16, 0), wings: { kind: 'bat', len: 1.1, color: 0x2a1418, membrane: 0x7a3048 },
        lingerie: { ...LACE } },
    'demon-pride-3': { ...SUCCUBUS, scale: 1.0, skin: 0xe4d4cc, eye: 0x3a2a2a, brow: 0x141012, hair: { color: 0x100c0e, style: 'long', len: .58 },
        horn: hornPair(.36, .05, .7, -.35, 0x1a1214, 1.2, .09, .16, 0), wings: { kind: 'bat', len: 1.05, color: 0x1a1012, membrane: 0x3a2026 },
        lingerie: { ...LACE, stockings: false, skirt: 0x0c0a0c, skirtLen: .82 } },
    'demon-pride-4': { ...SUCCUBUS, scale: 1.05, skin: 0xb03030, glowEyes: 0xff3a20, eyeWhite: 0x300808, brow: 0x3a0a0a, fangs: true, lips: 0x2a0606,
        hair: { color: 0x8a8890, style: 'long', len: .6 }, horn: hornPair(.5, .06, .85, -.25, 0x141012, .7, .1, .16, 0),
        wings: { kind: 'bat', len: 1.35, color: 0x3a0e0e, membrane: 0x9a1a1a },
        lingerie: { ...LACE, choker: false }, armour: { color: 0x1a1416, trim: 0x8a1a1a, pauldron: .12, spikes: 2, vambraces: true } },
    'demon-pride-5': { ...SUCCUBUS, ownLegWear: false, scale: 1.0, skin: 0x8a3a2c, glowEyes: 0xffc040, eyeWhite: 0x201008, brow: 0x2a1410, claws: 0x1a0c08,
        clawLen: 1.3, fangs: true, hair: { color: 0x24120e, style: 'wild', len: .45 }, horn: hornPair(.4, .05, .9, -.1, 0x1a1210, .4, .09, .16, 0),
        wings: { kind: 'bat', len: 1.4, color: 0x3a1410, membrane: 0x7a2a22 }, underwear: 0x2a1410,
        armour: { color: 0x2a1a14, vambraces: true, skirt: 0x3a2018, skirtLen: .3 }, tail: { n: 10, r: .04, seg: .15, color: null, tip: 'spikes' } }
};

// Draunug lords (devourer III–V): huge, hunched, a maw full of fangs, big horns, long claws; the terrible lord has four arms.
const DEVOURER = {
    'demon-devourer-3': { ...DEMON, underwear: null, maw: true, scale: 1.7, bulk: 1.32, limb: 1.25, arm: 1.15, hunch: .3, skin: 0x3a4250, glowEyes: 0xff2010,
        brow: 0x1a2028, claws: 0x14161a, clawLen: 1.8, spikes: 2, legs: 'digi', legK: 1.25,
        horn: hornPair(.62, .08, .35, -.45, 0x2a2a30, 1.1, .12, .13, -.01), wings: { kind: 'bat', len: 1.45, color: 0x22262c, membrane: 0x3a2a32 } },
    'demon-devourer-4': { ...DEMON, underwear: null, maw: true, scale: 2.2, bulk: 1.2, limb: 1.15, arm: 1.2, hunch: .35, skin: 0x7a2a2a, skinTex: 'sinew',
        texColor: 0xc05040, glowEyes: 0xffd040, brow: 0x3a0e0e, claws: 0x2a0e0a, clawLen: 1.8, legs: 'digi', legK: 1.15,
        smoke: { color: 0x8a2420, n: 16, head: true, hang: true } },
    'demon-devourer-5': { ...DEMON, underwear: null, maw: true, scale: 2.7, bulk: 1.35, limb: 1.3, arm: 1.12, hunch: .42, skin: 0x2a2a34, glowEyes: 0xff3010,
        brow: 0x14141a, tongue: 0xc06070, claws: 0x101014, clawLen: 1.8, spikes: 3, extraArms: true, legs: 'digi', legK: 1.3,
        horn: [hornPair(.3, .05, .6, .2, 0x1a1a20, .3), hornPair(.16, .03, .4, .1, 0x1a1a20, 0, .16, .06, -.04)],
        tail: { n: 9, r: .1, seg: .2, color: null, tip: 'spikes' }, wings: { kind: 'bat', len: 1.9, color: 0x1a1a22, membrane: 0x4a3038 } }
};

// Other humanoids with a part the plain body has not got.
const OTHERS = {
    fairy: { female: true, face: 'female', scale: .7, skin: 0xf0d8c0, eye: 0x3a8a4a, brow: 0x8a6a3a, ears: 'pointy', underwear: 0x4a9a7a,
        hair: { color: 0x9a7444, style: 'long', len: .55 }, lips: 0xb05a5a, ownLegWear: true,
        lingerie: { color: 0x3a8a70, corset: true, skirt: 0x7ad0b0, skirtLen: .62, choker: false },
        wings: { kind: 'insect', len: 1.45, membrane: 0xc8f4e8 }, hover: .22 },
    'fallen-angel': { face: 'demon', scale: 1.15, bulk: 1.18, limb: 1.12, skin: 0x8a96a8, eye: 0xff4030, glowEyes: 0xff3a20, eyeWhite: 0x101018,
        brow: 0x1a1a22, underwear: 0x1a1618, hair: { color: 0x141216, style: 'wild', len: .3 },
        horn: hornPair(.18, .03, .9, .1, 0x2a2630, .2, .1, .16, .02),
        armour: { color: 0x221e26, trim: 0x4a4250, pauldron: .15, spikes: 2, vambraces: true, greaves: true, belt: 0x1a1618, skirt: 0x141216, skirtLen: .58 },
        wings: { kind: 'feather', len: 1.75, color: 0x1a1618, feather: 0x1e1a1c, inner: 0x4a1418 } },
    faun: { face: 'human', bulk: 1.05, skin: 0xc89469, brow: 0x2a1a10, eye: 0x3a2a1a, ears: 'pointy', legs: 'goat', legColor: 0x3a2a20, legFur: true,
        hipFur: true, hoof: 0x14100c, underwear: 0x7a5a38, hair: { color: 0x2a1c12, style: 'curly' },
        horn: { ram: true, len: .11, r: .045, color: 0x8a7a5a, x: .09, y: .15, z: -.01 }, tail: { n: 2, r: .035, seg: .1, color: 0x3a2a20, tip: 'tuft', lift: .3, curve: .3 } },
    cobold: { scale: .85, skin: 0x6f7a50, skinTex: 'scales', texColor: 0x4a5434, eye: 0xe0c020, head: 'wolf',
        wolf: { coat: 0x6f7a50, dark: 0x3e462c, light: 0xb0b088, ear: 1.5 }, legs: 'digi', claws: 0x2a2418, underwear: 0x5a4636,
        armour: { color: 0x5a3a22, trim: 0x8a6a48, pauldron: .1, vambraces: true, belt: 0x3a2618, skirt: 0x4a3424, skirtLen: .3 },
        tail: { n: 8, r: .05, seg: .15, color: null, lift: -.2, curve: -.04 } },
    werewolf: { brute: 1, scale: 1.3, bulk: 1.25, limb: 1.2, arm: 1.3, hunch: .52, skin: 0x3a2e24, skinTex: 'fur', texColor: 0x1e1812, glowEyes: 0xffc020,
        head: 'wolf', wolf: { coat: 0x3a2e24, dark: 0x1e1812, light: 0x6a5a48, ear: 1 }, legs: 'digi', legK: 1.15, claws: 0xd8d0c0, clawLen: 1.6,
        fur: 0x2e241c, underwear: null, tail: { n: 5, r: .07, seg: .14, color: null, tip: 'brush', lift: -.55, curve: -.1 } },
    'werewolf-elder': { brute: 1, scale: 1.5, bulk: 1.32, limb: 1.25, arm: 1.32, hunch: .6, skin: 0x7a7a78, skinTex: 'fur', texColor: 0x4a4a48, glowEyes: 0xe8e080,
        head: 'wolf', wolf: { coat: 0x7a7a78, dark: 0x3a3a3a, light: 0xb8b4a8, ear: 1 }, legs: 'digi', legK: 1.2, claws: 0xe0d8c8, clawLen: 1.7,
        fur: 0x8a8884, underwear: null, tail: { n: 5, r: .08, seg: .15, color: null, tip: 'brush', lift: -.55, curve: -.1 } },
    minotaur: { brute: 1, scale: 1.35, bulk: 1.35, limb: 1.28, hunch: .15, skin: 0x4a3426, chest: 0x7a5a40, head: 'bull', headColor: 0x2a1e18,
        legs: 'goat', legColor: 0x2a1e18, legFur: true, legK: 1.25, hoof: 0x100c0a, fur: 0x2a1e18, underwear: 0x3a2a20,
        tail: { n: 4, r: .03, seg: .14, color: 0x2a1e18, tip: 'tuft', lift: -1.1, curve: -.08 } },
    headless: { skin: 0x4a4a52, brow: 0x404038, head: 'none', underwear: 0x1a1818, robe: { color: 0x1e1c22, len: .84, hood: true, belt: 0x2a2018 } },
    mermaid: { female: true, face: 'female', skin: 0xc8d8d4, eye: 0x2a7a7a, brow: 0x2a2a20, underwear: 0x2a8a8a, legs: 'fish', lips: 0x6a4a5a,
        hair: { color: 0x1a2426, style: 'long', len: .7 }, lingerie: { color: 0x2a8a8a, choker: false },
        fishTail: { color: 0x2a8a8a, fin: 0x5ac0b0 }, fins: 0x5ac0b0 },
    triton: { face: 'human', scale: 1.1, bulk: 1.12, skin: 0x5a8aa0, skinTex: 'scales', texColor: 0x3a6a80, eye: 0xe0c020, eyeWhite: 0x20302a,
        brow: 0x2a4a5a, fangs: true, underwear: null, legs: 'fish', fishTail: { color: 0x2a6a6a, fin: 0x8ac0a0 }, fins: 0x8ac0a0,
        weapon: 'weapon-spear' },
    ubeg: { scale: 1.5, bulk: 1.15, limb: 1.1, arm: 1.5, leg: .7, gait: 'crawl', skin: 0x6a4024, skinTex: 'chitin', texColor: 0x3a2010,
        head: 'insect', claws: 0x2a1408, clawLen: 1.05, carapace: 0x5a3018, underwear: null, insectLegs: true, legs: 'digi' },
    gorilla: { brute: 1, scale: 1.25, bulk: 1.4, limb: 1.35, arm: 1.4, leg: .78, hunch: .45, gait: 'knuckle', skin: 0x2a2624, skinTex: 'fur', texColor: 0x161412,
        head: 'ape', silverback: 0x6e6c6a, underwear: null },
    'skeleton-giant': { bone: true, skin: 0xddd2b4, brow: 0xddd2b4, underwear: null, scale: 1.9, headK: 1, weapon: 'weapon-mace',
        armour: { color: 0x3a3634, trim: 0x6a625a, pauldron: .16, spikes: 3, harness: 0x3a2618, vambraces: true, kneeGuards: true, belt: 0x3a2618,
            skirt: 0x5a3a22, skirtLen: .5 } }
};

export const BEAST_LOOKS = { ...ANGER, ...DECAY, ...GLUTTONY, ...POSSESSION, ...PRIDE, ...DEVOURER, ...OTHERS };
