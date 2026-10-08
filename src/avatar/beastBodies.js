/*
 * Humanoid bodies of bestiary monsters (bestiary key → avatar/creatures.js BEAST_BODIES → lookBase here).
 * Looked up by exact name in bodies.js bodyFor() before the 2D bases; the parts are built by avatar/beastParts.js.
 *
 * Flags on top of the plain body (bodies.js):
 *   bulk, arm, leg            torso width, arm length, leg length multipliers
 *   hunch, gait: 'knuckle'    forward lean of the upright states; knuckle walk (gorilla)
 *   skinTex, texColor, glow   canvas skin pattern ('lava' 'rot' 'fur' 'scales' 'chitin' 'veins' 'sinew'),
 *                             its accent colour and the emissive glow of the accent (lava cracks)
 *   glowEyes                  emissive eye colour
 *   head                      'wolf' | 'bull' | 'insect' | 'ape' | 'skull' | 'none' (+ wolf: {coat, dark, light, ear})
 *   horn                      { len, r, up, fwd, curl, color, x, y, z } or a list of pairs
 *   wings                     { kind: 'bat' | 'feather' | 'insect', len, color, membrane, feather, inner, torn }
 *   legs                      'goat' (hooves) | 'digi' (paws, claws) | 'fish' (tail instead of legs), legColor, hoof
 *   fishTail                  { color, fin }
 *   tail                      { n, r, seg, color, tip: 'spade' | 'tuft' | 'brush' | 'spikes', lift (first segment), curve }
 *   tongue, fangs, eyesN      long tongue colour, open maw with fangs, extra eyes on the forehead
 *   paunch, paunchColor       huge belly (size), pustules: colour of boils
 *   smoke                     { color, n, tip } shadow tendrils from the back; shadowHead: horned shadow behind the head
 *   spikes, claws, fur        spike level 1..3, claw colour, fur tuft colour (shoulders, mane)
 *   extraArms, fins, carapace, collar, shroud, hover, skirt
 */

const DEMON = { ears: 'pointy', eyeWhite: 0x1a0806, underwear: 0x24140e };
const lava = (skin, crack, glow = crack) => ({ skin, skinTex: 'lava', texColor: crack, glow });
const hornPair = (len, r, up, fwd, color, curl = 0, x = .11, y = .17, z = .02) => ({ len, r, up, fwd, curl, color, x, y, z });

// Demons of wrath (gug): red / black, glowing lava cracks, big horns; III–V get bat wings and grow.
const ANGER = {
    'demon-anger-1': { ...DEMON, ...lava(0x5a1c1c, 0xff6a10), scale: 1.3, bulk: 1.1, glowEyes: 0xffb020, fangs: true, claws: 0x1a0c08,
        horn: hornPair(.34, .05, .95, .12, 0x2a1810) },
    'demon-anger-2': { ...DEMON, ...lava(0x231816, 0xff3a10), scale: 1.45, bulk: 1.15, limb: 1.15, glowEyes: 0xff4020, fangs: true, claws: 0x0e0808,
        horn: hornPair(.38, .055, .45, .55, 0x1a1210), spikes: 2 },
    'demon-anger-3': { ...DEMON, ...lava(0x3a1212, 0xff2a10), scale: 1.6, bulk: 1.12, limb: 1.1, glowEyes: 0xff3010, fangs: true, claws: 0x140808,
        horn: hornPair(.38, .055, .85, .3, 0x1e1412), spikes: 1,
        wings: { kind: 'bat', len: 1.15, color: 0x2a1010, membrane: 0x6a1414 } },
    'demon-anger-4': { ...DEMON, ...lava(0x3e3a3c, 0xff4a18), scale: 1.8, bulk: 1.25, limb: 1.2, glowEyes: 0xff3010, fangs: true, claws: 0x101010,
        horn: hornPair(.44, .065, .8, .2, 0x161212, .6), spikes: 2,
        wings: { kind: 'bat', len: 1.4, color: 0x1a1414, membrane: 0x2a2022 } },
    'demon-anger-5': { ...DEMON, ...lava(0x1a1214, 0xff2010), scale: 2.1, bulk: 1.22, limb: 1.2, glowEyes: 0xff2010, fangs: true, claws: 0x0a0606,
        horn: [hornPair(.46, .065, .9, .25, 0x120c0c), hornPair(.2, .035, .3, -.1, 0x120c0c, 0, .15, .05, -.06)], spikes: 3,
        wings: { kind: 'bat', len: 1.65, color: 0x160c0c, membrane: 0x3a0e10 }, tail: { n: 7, r: .07, color: 0x1a1214, tip: 'spikes' } }
};

// Demons of decay (gug): rotting, skull heads, horns, torn bat wings from II up.
const DECAY_BASE = { head: 'skull', skinTex: 'rot', ribs: true, claws: 0x1a1612, eyeWhite: 0x101010, underwear: 0x2a2a20, limb: .85 };
const DECAY = {
    'demon-decay-1': { ...DECAY_BASE, skin: 0x1e1a1c, texColor: 0xd8d0c0, skull: 0x2a2426, glowEyes: 0xffa020, scale: 1.25,
        horn: hornPair(.36, .045, 1.05, -.05, 0x141010, 0, .09, .17, 0) },
    'demon-decay-2': { ...DECAY_BASE, skin: 0x3e4a34, texColor: 0x6a5a30, skull: 0xc8d0a0, glowEyes: 0x90ff40, scale: 1.3, skirt: 0x2a2e22,
        wings: { kind: 'bat', len: 1.1, color: 0x2a2a20, membrane: 0x3a3428, torn: true } },
    'demon-decay-3': { ...DECAY_BASE, skin: 0x9ab890, texColor: 0x8a3020, skull: 0xd8e0c8, glowEyes: 0xff4020, scale: 1.35,
        horn: hornPair(.3, .05, .2, -.35, 0x6a5a40, 2.2, .12, .12, -.02),
        wings: { kind: 'bat', len: 1.2, color: 0x4a3020, membrane: 0x8a4a22, torn: true } },
    'demon-decay-4': { ...DECAY_BASE, skin: 0x6a6660, texColor: 0x7a2a20, skull: 0xe0dcd0, glowEyes: 0xff6040, scale: 1.4, spikes: 1,
        horn: [hornPair(.34, .03, .9, -.2, 0x5a2a20, 3.2), hornPair(.28, .025, .5, .1, 0x5a2a20, 2.6, .14, .08, -.06)],
        wings: { kind: 'bat', len: 1.3, color: 0x3a3634, membrane: 0x4a4644, torn: true } },
    'demon-decay-5': { ...DECAY_BASE, skin: 0x24281e, texColor: 0x9a2a1a, skull: 0x3a3a2c, glowEyes: 0xffe040, scale: 1.45, skirt: 0x22261c,
        horn: hornPair(.18, .04, .6, .2, 0x1a1a14), paunchWound: true,
        wings: { kind: 'bat', len: 1.45, color: 0x1e2414, membrane: 0x3a4a26, torn: true } }
};

// Demons of gluttony (gug): huge bellies, long tongues, horns on some.
const GLUTTONY = {
    'demon-gluttony-1': { scale: 1.35, bulk: 1.3, limb: 1.25, leg: .9, skin: 0xd8b8a8, eye: 0x6a2020, eyeWhite: 0xe0d0c0, brow: 0x9a7a70, ears: 'pointy',
        paunch: 1.3, tongue: 0xa83a3a, fangs: true, pustules: 0xd09080, claws: 0x5a4030, underwear: 0x4a3028 },
    'demon-gluttony-2': { scale: 1.4, bulk: 1.15, limb: 1.05, skin: 0x2e3440, eye: 0xd0d040, eyeWhite: 0x101010, brow: 0x1a1e26, ears: 'pointy',
        paunch: 1.25, paunchColor: 0xc8c4c8, fangs: true, claws: 0x1a1a1a, underwear: 0x3a1e1e,
        horn: hornPair(.26, .045, .9, .25, 0x2a2a2a, .4) },
    'demon-gluttony-3': { scale: 1.55, bulk: 1.35, limb: 1.3, leg: .88, skin: 0x3a2a22, skinTex: 'fur', texColor: 0x24180f, eye: 0x2a1a10, eyeWhite: 0xc0a080,
        brow: 0x1a120c, paunch: 1.45, paunchColor: 0x5a4234, tongue: 0xb04848, fangs: true, fur: 0x2a1c14, claws: 0x1a120c, underwear: null },
    'demon-gluttony-4': { scale: 1.5, bulk: 1.3, limb: 1.2, skin: 0x7a9a6a, eye: 0xe0e040, eyeWhite: 0x302810, brow: 0x3a4a2a, ears: 'pointy', eyesN: 2,
        paunch: 1.35, pustules: 0xd8d8b0, fangs: true, claws: 0x2a2a1a, underwear: 0x3a3a26,
        horn: hornPair(.32, .05, .7, .1, 0x3a3020, 1.2) },
    'demon-gluttony-5': { scale: 1.6, bulk: 1.4, limb: 1.3, leg: .9, skin: 0xd8d0b8, skinTex: 'veins', texColor: 0xa01810, eye: 0x400808, eyeWhite: 0xd8c8a8,
        brow: 0x8a7a68, paunch: 1.55, fangs: true, extraArms: true, claws: 0x5a3020, underwear: 0x5a2a20 }
};

// Demons of possession (gug): gaunt possessed people, black shadow tendrils, red eyes, horns on some.
const POSSESSED = { limb: .88, glowEyes: 0xff1a10, eyeWhite: 0x200404, underwear: 0x18121a };
const POSSESSION = {
    'demon-possession-1': { ...POSSESSED, skin: 0xd8ccc8, skinTex: 'veins', texColor: 0xd0102a, glow: 0x801020, brow: 0x2a1a1a, fangs: true,
        horn: hornPair(.3, .045, .9, .1, 0x141014, .5), smoke: { color: 0x120c12, n: 6, tip: 0xa01020 } },
    'demon-possession-2': { ...POSSESSED, female: true, scale: .95, skin: 0xe0dcd8, brow: 0x141014, smoke: { color: 0x0e0c10, n: 8 } },
    'demon-possession-3': { ...POSSESSED, skin: 0xb89a88, brow: 0x141010, fangs: true, claws: 0x2a1a14, scale: 1.05,
        horn: [hornPair(.24, .04, .9, .25, 0x1a1414, .8), hornPair(.12, .025, .5, .3, 0x1a1414, 0, .14, .08, .02)],
        smoke: { color: 0x141012, n: 5, tip: 0xff5010 } },
    'demon-possession-4': { ...POSSESSED, skin: 0xa8a098, brow: 0x2a2422, scale: 1.1, shadowHead: 0x0e0c10,
        smoke: { color: 0x0e0c10, n: 10 } },
    'demon-possession-5': { ...POSSESSED, skin: 0x7a6a8a, skinTex: 'veins', texColor: 0xff6020, glow: 0xff4010, brow: 0x2a2030, scale: 1.15, fangs: true, claws: 0x1a1420,
        ears: 'pointy', smoke: { color: 0x1a1220, n: 12, tip: 0x8a2a60 } }
};

// Demons of pride: succubi (I, II, V) and incubi (III, IV) – wings, horns, thin tail with a spade.
const SUCCUBUS = { ears: 'pointy', underwear: 0x141012, tail: { n: 8, r: .03, seg: .12, color: null, tip: 'spade', lift: -.5, curve: -.18 } };
const PRIDE = {
    'demon-pride-1': { ...SUCCUBUS, female: true, scale: .95, skin: 0xe8d0c8, eye: 0x5a1a1a, brow: 0x141012,
        horn: hornPair(.24, .04, .35, -.4, 0x141012, 1.6, .1, .15, 0), wings: { kind: 'bat', len: .75, color: 0x1a1214, membrane: 0x2a1a20 } },
    'demon-pride-2': { ...SUCCUBUS, female: true, scale: .97, skin: 0xd8d4e8, eye: 0x7a1a3a, brow: 0x141012,
        horn: hornPair(.3, .04, .9, -.25, 0x141012, .4, .09, .16, 0), wings: { kind: 'bat', len: 1.0, color: 0x2a1418, membrane: 0x6a2a3a } },
    'demon-pride-3': { ...SUCCUBUS, scale: 1.05, skin: 0xd8c0b0, eye: 0x7a1a1a, brow: 0x141012,
        horn: hornPair(.3, .045, .8, -.3, 0x1a1214, .5, .09, .16, 0), wings: { kind: 'bat', len: 1.05, color: 0x1a1012, membrane: 0x3a2026 } },
    'demon-pride-4': { ...SUCCUBUS, scale: 1.1, skin: 0xa83030, glowEyes: 0xff3a20, eyeWhite: 0x300808, brow: 0x3a0a0a, fangs: true,
        horn: hornPair(.4, .05, .85, -.2, 0x141012, .6, .1, .16, 0), wings: { kind: 'bat', len: 1.25, color: 0x3a0e0e, membrane: 0x8a1a1a } },
    'demon-pride-5': { ...SUCCUBUS, female: true, scale: 1.0, skin: 0x8a4a3a, glowEyes: 0xffc040, eyeWhite: 0x201008, brow: 0x2a1410, claws: 0x1a0c08,
        horn: hornPair(.3, .04, .9, -.1, 0x1a1210, .3, .09, .16, 0), wings: { kind: 'bat', len: 1.3, color: 0x3a1410, membrane: 0x7a2a22 },
        tail: { n: 10, r: .04, seg: .15, color: null, tip: 'spikes' } }
};

// Draunug lords (devourer III–V): big horns, wings, a maw full of teeth; the terrible lord has four arms and a spiked tail.
const DEVOURER = {
    'demon-devourer-3': { ...DEMON, scale: 1.7, bulk: 1.2, limb: 1.15, skin: 0x3a4250, eye: 0xff2010, glowEyes: 0xff2010, brow: 0x1a2028, fangs: true,
        claws: 0x14161a, spikes: 2, horn: hornPair(.5, .07, .55, .45, 0x2a2a30, .3),
        wings: { kind: 'bat', len: 1.3, color: 0x22262c, membrane: 0x3a2a32 } },
    'demon-devourer-4': { ...DEMON, scale: 2.2, bulk: 1.15, limb: 1.15, skin: 0x7a2a2a, skinTex: 'sinew', texColor: 0xc05040, glowEyes: 0xffd040,
        brow: 0x3a0e0e, fangs: true, claws: 0x2a0e0a, horn: hornPair(.42, .06, .8, .35, 0x3a1a1a, .5),
        smoke: { color: 0x7a1c1c, n: 8, head: true }, wings: { kind: 'bat', len: 1.5, color: 0x4a1414, membrane: 0x5a1a1a } },
    'demon-devourer-5': { ...DEMON, scale: 2.7, bulk: 1.3, limb: 1.25, skin: 0x2a2a34, glowEyes: 0xff3010, brow: 0x14141a, fangs: true, tongue: 0xc06070,
        claws: 0x101014, spikes: 3, extraArms: true, horn: hornPair(.5, .07, .6, .4, 0x1a1a20, .4),
        tail: { n: 9, r: .1, seg: .2, color: null, tip: 'spikes' }, wings: { kind: 'bat', len: 1.8, color: 0x1a1a22, membrane: 0x3a2a34 } }
};

// Other humanoids with a part the plain body has not got.
const OTHERS = {
    fairy: { female: true, scale: .7, skin: 0xf0d8c0, eye: 0x3a8a4a, brow: 0x8a6a3a, ears: 'pointy', underwear: 0x6aa86a, skirt: 0x7ab870,
        wings: { kind: 'insect', len: 1.25, membrane: 0xb8f0d8 }, hover: .22 },
    'fallen-angel': { scale: 1.15, skin: 0x8a96a8, eye: 0xff4030, glowEyes: 0xff3a20, eyeWhite: 0x101018, brow: 0x1a1a22, underwear: 0x1a1618,
        wings: { kind: 'feather', len: 1.5, color: 0x1a1618, feather: 0x1e1a1c, inner: 0x8a1a1e } },
    faun: { skin: 0xc89469, brow: 0x3a2a1a, ears: 'pointy', legs: 'goat', legColor: 0x3a2a20, hoof: 0x14100c, underwear: 0x6a5030,
        horn: hornPair(.26, .045, .3, -.35, 0x6a5a40, 2.6, .1, .16, -.02), tail: { n: 2, r: .035, seg: .1, color: 0x3a2a20, tip: 'tuft', lift: .3, curve: .3 } },
    cobold: { scale: .85, skin: 0x6f7a50, eye: 0xe0c020, head: 'wolf', wolf: { coat: 0x6f7a50, dark: 0x3e462c, light: 0xb0b088, ear: 1.35 },
        legs: 'digi', claws: 0x2a2418, underwear: 0x5a4636, tail: { n: 8, r: .05, seg: .15, color: null, lift: -.2, curve: -.04 } },
    werewolf: { scale: 1.3, bulk: 1.15, limb: 1.15, hunch: .25, skin: 0x3a2e24, skinTex: 'fur', texColor: 0x1e1812, glowEyes: 0xffc020,
        head: 'wolf', wolf: { coat: 0x3a2e24, dark: 0x1e1812, light: 0x6a5a48, ear: 1 }, legs: 'digi', claws: 0xd8d0c0, fur: 0x2e241c,
        underwear: 0x2a2420, tail: { n: 5, r: .07, seg: .14, color: null, tip: 'brush', lift: -.55, curve: -.1 } },
    'werewolf-elder': { scale: 1.5, bulk: 1.25, limb: 1.2, hunch: .35, skin: 0x7a7a78, skinTex: 'fur', texColor: 0x4a4a48, glowEyes: 0xe8e080,
        head: 'wolf', wolf: { coat: 0x7a7a78, dark: 0x3a3a3a, light: 0xb8b4a8, ear: 1 }, legs: 'digi', claws: 0xe0d8c8, fur: 0x8a8884,
        underwear: 0x2a2826, tail: { n: 5, r: .08, seg: .15, color: null, tip: 'brush', lift: -.55, curve: -.1 } },
    minotaur: { scale: 1.35, bulk: 1.22, limb: 1.15, skin: 0xa8784a, head: 'bull', headColor: 0x2a1e18, legs: 'goat', legColor: 0x2a1e18, hoof: 0x100c0a,
        fur: 0x2a1e18, underwear: 0x3a2a20, tail: { n: 4, r: .03, seg: .14, color: 0x2a1e18, tip: 'tuft', lift: -1.1, curve: -.08 } },
    headless: { skin: 0x9a9c86, brow: 0x404038, head: 'none', underwear: 0x1a1818, collar: 0x1e1a1c, shroud: 0x1e1a1c },
    mermaid: { female: true, skin: 0xd8dcd4, eye: 0x2a7a7a, brow: 0x3a2a20, underwear: 0x2a8a8a, legs: 'fish',
        fishTail: { color: 0x2a8a8a, fin: 0x5ac0b0 } },
    triton: { scale: 1.1, skin: 0x5a8aa0, skinTex: 'scales', texColor: 0x3a6a80, eye: 0xe0c020, eyeWhite: 0x20302a, brow: 0x2a4a5a, fangs: true,
        underwear: null, legs: 'fish', fishTail: { color: 0x2a6a6a, fin: 0x8ac0a0 }, fins: 0x8ac0a0 },
    ubeg: { scale: 1.5, bulk: 1.15, limb: 1.15, hunch: .2, skin: 0x6a4024, skinTex: 'chitin', texColor: 0x3a2010, head: 'insect', claws: 0x2a1408,
        carapace: 0x5a3018, underwear: null },
    gorilla: { scale: 1.25, bulk: 1.35, limb: 1.35, arm: 1.4, leg: .78, hunch: .45, gait: 'knuckle', skin: 0x2a2624, skinTex: 'fur', texColor: 0x161412,
        head: 'ape', silverback: 0x8a8a88, underwear: null }
};

export const BEAST_LOOKS = { ...ANGER, ...DECAY, ...GLUTTONY, ...POSSESSION, ...PRIDE, ...DEVOURER, ...OTHERS };
