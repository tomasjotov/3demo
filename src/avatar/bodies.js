/*
 * Body = the base layer of the 2D sprite (`/opt/hof/chars/<lookBase>/<lookVariant>/<anim>.png`).
 * In 3D every humanoid shares one rig (ProceduralAvatar); the body only sets skin,
 * proportions and a few species features. All other layers are dressed on top (layers.js).
 *
 *   bodyFor(lookBase, lookVariant) → {
 *     skin, eye, eyeWhite, brow, underwear,      colours
 *     scale,                                     whole-rig scale (giants, goblins)
 *     female, belly,                             shape switches
 *     bone, sockets, nasal, ribs, wraps          undead (avatar/undead.js): skeleton, eyeless face, nose hole, ribs, bandages
 *     limb,                                      limb thickness multiplier
 *     horns, tail, ears: 'pointy', snout,        species extras
 *     humanoid: false                            → not a humanoid rig (horse, …)
 *   }
 */

// lookVariant base01, base02, … of male / female → skin tone.
export const SKIN_TONES = [0xdba77c, 0xc89469, 0xcf9a72, 0xc18a62, 0xe8bf98, 0xa8744e, 0x8a5a3a, 0x6b4430];

const HUMAN = { skin: SKIN_TONES[0], eye: 0x3b4f6a, eyeWhite: 0xf3eee2, brow: 0x4a3222, underwear: 0xd8cfbd, scale: 1, limb: 1 };

// Skeleton: bones instead of the flesh body, skull without eyes (avatar/undead.js).
const SKELETON = { bone: true, skin: 0xddd2b4, brow: 0xddd2b4, underwear: null };

// lookBase prefix → body (first match wins). Colours of the monster bases follow their 2D sprites.
const BASES = [
    ['male', {}],
    ['female', { female: true, scale: .95 }],
    ['skeleton-giant', { ...SKELETON, scale: 1.9 }],
    ['skeleton', SKELETON],
    // undead flesh (avatar/undead.js): no eyes, sunken sockets; ghoul with a nose hole and ribs, mummy in bandages
    ['mummy', { sockets: true, wraps: true, skin: 0xc9b98f, brow: 0xa89870, underwear: 0xb8a77c }],
    ['zombie', { sockets: true, skin: 0x8fa07a, brow: 0x3a3a2a, underwear: 0x5a5040 }],
    ['ghoul', { sockets: true, nasal: true, ribs: true, skin: 0x9a9c86, brow: 0x404038, ears: 'pointy', underwear: 0x4a4038 }],
    ['dead-gentleman', { sockets: true, skin: 0xb8b8a8, brow: 0x303030 }],
    ['goblin', { scale: .72, skin: 0x7a9a4a, eye: 0xe0c030, eyeWhite: 0x202010, brow: 0x3a3a1a, ears: 'pointy', underwear: 0x6a5030 }],
    ['ogre', { scale: 1.8, belly: true, skin: 0xb0967a, eye: 0x2a1a10, brow: 0x3a2a1e, underwear: 0x6b5338 }],
    ['troll', { scale: 1.9, belly: true, skin: 0x7f8f72, eye: 0xc8a030, eyeWhite: 0x302a20, brow: 0x3a3a30, ears: 'pointy', underwear: 0x5a4a38 }],
    ['brute-blue', { scale: 1.7, skin: 0x5f7fae, eye: 0xf0d040, eyeWhite: 0x202030, brow: 0x2a3550, horns: 0xd8d0b8 }],
    ['brute-brown', { scale: 1.7, skin: 0x8a6440, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x3a2818, horns: 0xd8d0b8 }],
    ['brute-dark-brown', { scale: 1.7, skin: 0x5e4430, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x2a1c10, horns: 0xd8d0b8 }],
    ['brute-green-light', { scale: 1.7, skin: 0x8fb070, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x3a4a2a, horns: 0xd8d0b8 }],
    ['brute-green', { scale: 1.7, skin: 0x5f8a4a, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x2a3a1e, horns: 0xd8d0b8 }],
    ['brute-purple', { scale: 1.7, skin: 0x7a5a90, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x3a2a48, horns: 0xd8d0b8 }],
    ['brute-red', { scale: 1.7, skin: 0xa8503e, eye: 0xf0d040, eyeWhite: 0x202020, brow: 0x4a2018, horns: 0xd8d0b8 }],
    ['uruk', { scale: 1.25, skin: 0x5a5e52, eye: 0xd03020, eyeWhite: 0x201810, brow: 0x202018, ears: 'pointy', underwear: 0x3a3028 }],
    ['giant', { scale: 2.2, skin: 0xa89070, brow: 0x3a2a1e }],
    ['juggernaut', { scale: 2, skin: 0x6a6a72, eye: 0xe05020, eyeWhite: 0x101010, brow: 0x303030 }],
    ['beastman', { scale: 1.15, skin: 0x7a5a3a, eye: 0xd0a030, eyeWhite: 0x201810, brow: 0x3a2818, horns: 0xd8c8a0, snout: true }],
    ['lizardman-red', { scale: 1.1, skin: 0xa04a30, eye: 0xf0d020, eyeWhite: 0x302010, brow: 0x702a18, tail: true, snout: true }],
    ['lizardman', { scale: 1.1, skin: 0x5f8a4a, eye: 0xf0d020, eyeWhite: 0x302010, brow: 0x3a5a2a, tail: true, snout: true }],
    ['daemon', { scale: 1.3, skin: 0x9a2e22, eye: 0xffd040, eyeWhite: 0x200808, brow: 0x3a0e08, horns: 0x2a2020, tail: true, ears: 'pointy' }],
    ['dameon', { scale: 1.3, skin: 0x8a2a20, eye: 0xffd040, eyeWhite: 0x200808, brow: 0x3a0e08, horns: 0x2a2020, tail: true, ears: 'pointy' }],
    ['fiend-blue', { scale: 1.6, skin: 0x3e5a8e, eye: 0xffe060, eyeWhite: 0x101020, brow: 0x1a2440, horns: 0x1a1a1a, tail: true }],
    ['fiend-brown', { scale: 1.6, skin: 0x6e4a30, eye: 0xffe060, eyeWhite: 0x101010, brow: 0x2a1a10, horns: 0x1a1a1a, tail: true }],
    ['fiend-green', { scale: 1.6, skin: 0x4a7a3a, eye: 0xffe060, eyeWhite: 0x101010, brow: 0x1a3010, horns: 0x1a1a1a, tail: true }],
    ['fiend-red', { scale: 1.6, skin: 0x9a3a2a, eye: 0xffe060, eyeWhite: 0x101010, brow: 0x3a1008, horns: 0x1a1a1a, tail: true }],
    ['plaguefiend', { scale: 1.3, skin: 0x7a8a50, eye: 0xd0e040, eyeWhite: 0x202010, brow: 0x3a4020, horns: 0x3a3020 }],
    ['shadow', { skin: 0x2a2a34, eye: 0xb0d0ff, eyeWhite: 0x0a0a10, brow: 0x1a1a20, underwear: null }],
    ['black-walker', { skin: 0x1e1e22, eye: 0xff4030, eyeWhite: 0x0a0a0a, brow: 0x101010, underwear: null }],
    ['gorgon', { skin: 0x6a8a6a, eye: 0xf0e040, eyeWhite: 0x102010, brow: 0x2a4a2a, female: true, tail: true }],
    ['horse', { humanoid: false, type: 'horse' }]
];

// Special lookVariant of the male / female base (2D: base-skeleton, base-orc …) → body.
const VARIANT_BODIES = {
    'base-skeleton': BASES.find(([p]) => p === 'skeleton')[1],
    'base-orc': { skin: 0x6f8a4a, eye: 0xd8c040, eyeWhite: 0x202010, brow: 0x2a3a1a, ears: 'pointy', underwear: 0x5a4636 },
    'base-blue': { skin: 0x7fa6d8, eye: 0xe8f4ff, eyeWhite: 0x9ec4ee, brow: 0x4a6a98 },
    'base-demon': { skin: 0x9a2e22, eye: 0xffd040, eyeWhite: 0x200808, brow: 0x3a0e08, horns: 0x2a2020, tail: true, ears: 'pointy', underwear: 0x3a1a14 }
};

// Not humanoid (2D sprite of an animal or a monster): no rig of ours yet, shown as a stand-in.
const NON_HUMANOID = ['buck', 'doe', 'cat-', 'dog-', 'hound', 'wolf', 'direwolf', 'undeaddog', 'donkey', 'chicken', 'turkey',
    'giantrat', 'giantbee', 'giantspider', 'gigacrab', 'gigascorpion', 'dragon', 'wyvern', 'slime', 'crawl', 'carniverous',
    'lizard-large', 'gug', 'ghlug', 'giant-dark-beast'];

export function bodyFor(lookBase = 'male', lookVariant = '') {
    const base = String(lookBase || 'male');
    // animal sprites first: 'giantrat', 'giantspider-*' or 'giant-dark-beast' must not become the humanoid 'giant'
    const animal = NON_HUMANOID.some(p => base.startsWith(p));
    const hit = animal ? null : BASES.find(([p]) => base === p || base.startsWith(p));
    const body = { ...HUMAN, base, ...(hit ? hit[1] : {}) };
    if (animal) {
        // stand-in: dark generic humanoid until a creature rig exists
        Object.assign(body, { creature: true, skin: 0x5a5048, eye: 0xd0a030, eyeWhite: 0x201810, brow: 0x2a2018, underwear: null });
    }
    const m = /(\d+)/.exec(lookVariant || '');
    if (m && (base === 'male' || base === 'female')) body.skin = SKIN_TONES[Math.max(0, parseInt(m[1], 10) - 1) % SKIN_TONES.length];   // base00 = base01
    if ((base === 'male' || base === 'female') && VARIANT_BODIES[lookVariant]) Object.assign(body, VARIANT_BODIES[lookVariant]);
    if (!hit || !('underwear' in hit[1])) { if (base !== 'male' && base !== 'female') body.underwear = 0x5a4636; }   // loincloth
    if (body.humanoid === undefined) body.humanoid = true;
    return body;
}
