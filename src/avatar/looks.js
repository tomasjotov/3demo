/*
 * Look = what the 2D sprite is composed of, the 3D avatar is dressed by it:
 *   { base: lookBase, variant: lookVariant, layers: [2D layer keys…], twoHanded?, tint?: { key: colour }, scale?, hairStyle? }
 *   twoHanded – weapon held in both hands (server PlanActor.twoHanded); missing → typical two-handers without a shield
 * The server sends base/variant/layers in PlanActor (lookBase, lookVariant, layers).
 * The presets below are the characters of the offline prototype.
 */
export const LOOK_PRESETS = {
    hero: {
        base: 'male', variant: 'base01',
        layers: ['feet01', 'pants01', 'top01', 'belt01', 'pouch', 'cloak01', 'hair01', 'weapon-sword', 'weapon-shield'],
        tint: { top01: 0x2f5f9e, 'top01.sleeve': 0x2a5590, pants01: 0x3a3f4a, cloak01: 0x9b2b2b }
    },
    guard: {
        base: 'male', variant: 'base02',
        layers: ['feet01', 'pants01', 'body-chainmail', 'belt01', 'tabard', 'hair02', 'helmet-medium', 'weapon-spear', 'weapon-shield-iron-large'],
        tint: { pants01: 0x30353d, 'feet01': 0x1e1a17 }
    },
    merchant: {
        base: 'male', variant: 'base03', belly: true,
        layers: ['feet01', 'pants01', 'top01', 'robe', 'belt01', 'pouch', 'pack', 'hair08', 'hat', 'weapon-dagger', 'beard01'],
        tint: { top01: 0x9a633d, 'top01.sleeve': 0x8a5835, robe: 0x9a633d, pants01: 0x5b4636 }
    },
    bandit: {
        base: 'male', variant: 'base04',
        layers: ['feet01', 'pants01', 'body-leather', 'bandolier', 'hair02', 'hood', 'mask', 'weapon-sabre', 'weapon-shield-iron-small'],
        tint: { pants01: 0x2b2527, 'body-leather': 0x4a3436, 'feet01': 0x1a1414 }
    },
    skeleton: {
        base: 'skeleton-shambler',
        layers: ['body-chainmail', 'helmet-light', 'weapon-sword', 'weapon-shield-iron-small'],
        tint: { 'body-chainmail': 0x9a948a, 'helmet-light': 0x4a3b2c }
    },
    giant: {
        base: 'ogre',
        layers: ['feet01', 'pants01', 'top01', 'belt01', 'pouch', 'bandolier', 'hair01', 'weapon-club', 'beard01'],
        tint: { top01: 0x6b5338, 'top01.sleeve': 0xb0967a, pants01: 0x4a3a2a, feet01: 0x5a4532 }
    },
    // female preset – shows the female body with the same layers
    ranger: {
        base: 'female', variant: 'base05',
        layers: ['feet01', 'pants01', 'body-leather', 'quiver', 'gauntlets01', 'hair03', 'weapon-bow'],
        tint: { pants01: 0x4a4a38, 'body-leather': 0x5a6a3a }
    },
    warrior: {
        base: 'male', variant: 'base07', twoHanded: true,
        layers: ['feet01', 'bottom-chainmail', 'body-scale', 'gauntlets01', 'hair05', 'weapon-battleaxe', 'beard04'],
        tint: { 'body-scale': 0x8a8f96 }
    },
    knight: {
        base: 'male', variant: 'base06',
        layers: ['feet01', 'bottom-plate', 'body-plate', 'gauntlets01', 'hair02', 'helmet-full', 'weapon-longsword', 'weapon-shield-iron-medium'],
        tint: { gauntlets01: 0xb8bec6 }
    }
};

export const PRESET_NAMES = Object.keys(LOOK_PRESETS);

export function presetLook(name) {
    return LOOK_PRESETS[name] || null;
}

export function lookSignature(look) {
    if (!look) return '';
    return [look.base, look.variant, look.twoHanded ? '2H' : look.twoHanded === false ? '1H' : '', ...(look.layers || [])].join('|');
}
