import { ProceduralCanine, CANINE_VARIANTS } from './ProceduralCanine.js';
import { ProceduralFeline, FELINE_VARIANTS } from './ProceduralFeline.js';
import { ProceduralBear, BEAR_VARIANTS } from './ProceduralBear.js';
import { ProceduralHoofed, HOOFED_VARIANTS } from './ProceduralHoofed.js';
import { ProceduralPachyderm, PACHYDERM_VARIANTS } from './ProceduralPachyderm.js';
import { ProceduralRat, RAT_VARIANTS } from './ProceduralRat.js';
import { ProceduralReptile, REPTILE_VARIANTS } from './ProceduralReptile.js';
import { ProceduralBiped, BIPED_VARIANTS } from './ProceduralBiped.js';

// Creature rigs by name (avatar/creatures.js picks rig + variant from the bestiary key).
export const CREATURE_RIGS = {
    canine: { Rig: ProceduralCanine, variants: CANINE_VARIANTS, title: 'ProceduralCanine' },
    feline: { Rig: ProceduralFeline, variants: FELINE_VARIANTS, title: 'ProceduralFeline' },
    bear: { Rig: ProceduralBear, variants: BEAR_VARIANTS, title: 'ProceduralBear' },
    hoofed: { Rig: ProceduralHoofed, variants: HOOFED_VARIANTS, title: 'ProceduralHoofed' },
    pachyderm: { Rig: ProceduralPachyderm, variants: PACHYDERM_VARIANTS, title: 'ProceduralPachyderm' },
    rat: { Rig: ProceduralRat, variants: RAT_VARIANTS, title: 'ProceduralRat' },
    reptile: { Rig: ProceduralReptile, variants: REPTILE_VARIANTS, title: 'ProceduralReptile' },
    biped: { Rig: ProceduralBiped, variants: BIPED_VARIANTS, title: 'ProceduralBiped' }
};

// creature = { rig, variant } or just a variant name ('wolf', 'lion', 'bear' …)
export function createCreature(creature, opts = {}) {
    const variant = creature?.variant || creature;
    const rig = creature?.rig || Object.keys(CREATURE_RIGS).find(r => CREATURE_RIGS[r].variants[variant]) || 'canine';
    return new CREATURE_RIGS[rig].Rig(variant, opts);
}
