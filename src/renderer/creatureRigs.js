import { ProceduralCanine, CANINE_VARIANTS } from './ProceduralCanine.js';
import { ProceduralFeline, FELINE_VARIANTS } from './ProceduralFeline.js';
import { ProceduralBear, BEAR_VARIANTS } from './ProceduralBear.js';
import { ProceduralHoofed, HOOFED_VARIANTS } from './ProceduralHoofed.js';
import { ProceduralPachyderm, PACHYDERM_VARIANTS } from './ProceduralPachyderm.js';
import { ProceduralRat, RAT_VARIANTS } from './ProceduralRat.js';
import { ProceduralReptile, REPTILE_VARIANTS } from './ProceduralReptile.js';
import { ProceduralBiped, BIPED_VARIANTS } from './ProceduralBiped.js';
import { ProceduralArthropod, ARTHROPOD_VARIANTS } from './ProceduralArthropod.js';
import { ProceduralSerpent, SERPENT_VARIANTS } from './ProceduralSerpent.js';
import { ProceduralFlyer, FLYER_VARIANTS } from './ProceduralFlyer.js';
import { ProceduralDragon, DRAGON_VARIANTS } from './ProceduralDragon.js';
import { ProceduralAquatic, AQUATIC_VARIANTS } from './ProceduralAquatic.js';
import { ProceduralAmorphous, AMORPHOUS_VARIANTS } from './ProceduralAmorphous.js';
import { ProceduralElemental, ELEMENTAL_VARIANTS } from './ProceduralElemental.js';
import { ProceduralPlant, PLANT_VARIANTS } from './ProceduralPlant.js';
import { ProceduralCentaur, CENTAUR_VARIANTS } from './ProceduralCentaur.js';

// Creature rigs by name (avatar/creatures.js picks rig + variant from the bestiary key).
export const CREATURE_RIGS = {
    canine: { Rig: ProceduralCanine, variants: CANINE_VARIANTS, title: 'ProceduralCanine' },
    feline: { Rig: ProceduralFeline, variants: FELINE_VARIANTS, title: 'ProceduralFeline' },
    bear: { Rig: ProceduralBear, variants: BEAR_VARIANTS, title: 'ProceduralBear' },
    hoofed: { Rig: ProceduralHoofed, variants: HOOFED_VARIANTS, title: 'ProceduralHoofed' },
    pachyderm: { Rig: ProceduralPachyderm, variants: PACHYDERM_VARIANTS, title: 'ProceduralPachyderm' },
    rat: { Rig: ProceduralRat, variants: RAT_VARIANTS, title: 'ProceduralRat' },
    reptile: { Rig: ProceduralReptile, variants: REPTILE_VARIANTS, title: 'ProceduralReptile' },
    biped: { Rig: ProceduralBiped, variants: BIPED_VARIANTS, title: 'ProceduralBiped' },
    arthropod: { Rig: ProceduralArthropod, variants: ARTHROPOD_VARIANTS, title: 'ProceduralArthropod' },
    serpent: { Rig: ProceduralSerpent, variants: SERPENT_VARIANTS, title: 'ProceduralSerpent' },
    flyer: { Rig: ProceduralFlyer, variants: FLYER_VARIANTS, title: 'ProceduralFlyer' },
    dragon: { Rig: ProceduralDragon, variants: DRAGON_VARIANTS, title: 'ProceduralDragon' },
    aquatic: { Rig: ProceduralAquatic, variants: AQUATIC_VARIANTS, title: 'ProceduralAquatic' },
    amorphous: { Rig: ProceduralAmorphous, variants: AMORPHOUS_VARIANTS, title: 'ProceduralAmorphous' },
    elemental: { Rig: ProceduralElemental, variants: ELEMENTAL_VARIANTS, title: 'ProceduralElemental' },
    plant: { Rig: ProceduralPlant, variants: PLANT_VARIANTS, title: 'ProceduralPlant' },
    centaur: { Rig: ProceduralCentaur, variants: CENTAUR_VARIANTS, title: 'ProceduralCentaur' }
};

// creature = { rig, variant } or just a variant name ('wolf', 'lion', 'bear' …)
export function createCreature(creature, opts = {}) {
    const variant = creature?.variant || creature;
    const rig = creature?.rig || Object.keys(CREATURE_RIGS).find(r => CREATURE_RIGS[r].variants[variant]) || 'canine';
    return new CREATURE_RIGS[rig].Rig(variant, opts);
}
