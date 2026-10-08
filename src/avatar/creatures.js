/*
 * Creatures with a rig of their own (not the humanoid ProceduralAvatar).
 *
 * hof sends the bestiary key of a monster in PlanActor.beast (beast-wolf → 'wolf'). The 2D lookBase of a
 * monster is only the closest sprite (a bear or a lion is drawn as 'hound-large'), so the bestiary key decides;
 * the lookBase is used only when there is no key (characters, older server).
 * Overview of the bestiary and the rigs still missing: docs/bestiar-modely.md.
 *
 *   creatureFor(beast, lookBase) → { rig: 'canine' | 'feline' | 'bear' | 'rat' | 'hoofed' | 'pachyderm' | 'reptile' | 'biped', variant } | null
 *   (rigs: renderer/creatureRigs.js)
 *   beastBody(beast) → lookBase of the humanoid body to use instead of the 2D one | null
 */
const BEASTS = {
    wolf: 'wolf',                         // Vlk obyčejný
    'wolf-ferocious': 'direwolf',         // Vlk lítý
    dog: 'dog',                           // Pes
    hellhound: 'hellhound',               // Pekelný pes
    'hunting-hellbeast': 'hellhound',     // Pekelný honič
    'fire-dog': 'firedog',                // Ohnivý pes
    'spectral-wolf': 'spectral',          // Přízračný vlk
    'soul-hound': 'soulhound',            // Honič duší
    'vampire-wolf-form': 'vampirewolf',   // upír ve vlčí podobě
    'vampire-elder-wolf-form': 'vampirewolf',
    'undead-animals': 'undeadwolf',       // Nemrtvá zvířata
    // ProceduralFeline
    lion: 'feline:lion',                  // Lev
    tiger: 'feline:tiger',                // Tygr
    leopard: 'feline:leopard',            // Levhart
    sabretooth: 'feline:sabretooth',      // Tygr šavlozubý
    chimera: 'feline:chimera',            // Chiméra (kozí hlava, hadí ocas)
    manticore: 'feline:manticore',        // Mantikora (křídla, štíří ocas)
    sphinx: 'feline:sphinx',              // Sfinga (lidská hlava, křídla)
    // ProceduralBear
    bear: 'bear:bear',                    // Medvěd
    'bear-large': 'bear:bear-large',      // Medvěd velký
    'cave-bear': 'bear:cave-bear',        // Medvěd jeskynní
    necrotaur: 'bear:necrotaur',          // Nekrotaur (oživený medvěd)
    'giant-rat': 'rat:giant-rat',         // Krysa obří (ProceduralRat)
    // ProceduralHoofed
    drakun: 'hoofed:drakun',              // Drakůň
    nightmare: 'hoofed:nightmare',        // Noční můra
    unicorn: 'hoofed:unicorn',            // Jednorožec
    bull: 'hoofed:bull',                  // Býk
    cow: 'hoofed:cow',                    // Kráva
    'fire-bull': 'hoofed:fire-bull',      // Ohnivý býk
    'undead-bull': 'hoofed:undead-bull',  // Nemrtvý býk
    boar: 'hoofed:boar',                  // Prase divoké
    // ProceduralPachyderm
    elephant: 'pachyderm:elephant',       // Slon
    hippopotamus: 'pachyderm:hippopotamus', // Hroch
    rhinoceros: 'pachyderm:rhinoceros',   // Nosorožec
    // ProceduralReptile
    crocodile: 'reptile:crocodile',       // Krokodýl
    'giant-crocodille': 'reptile:giant-crocodille', // Gigakrokodýl
    'giant-eft': 'reptile:giant-eft',     // Gigamlok
    karialis: 'reptile:karialis',         // Karialis
    'dragon-turtle': 'reptile:dragon-turtle', // Drakoželva
    basilisk: 'reptile:basilisk',         // Bazilišek
    // ProceduralBiped
    sagat: 'biped:sagat',                 // Sagat
    uth: 'biped:uth',                     // Uth
    gauton: 'biped:gauton',               // Gauton
    terrorbird: 'biped:terrorbird',       // Hrůzopták
    ghat: 'biped:ghat'                    // Ghat
};
const spec = v => v.includes(':') ? { rig: v.split(':')[0], variant: v.split(':')[1] } : { rig: 'canine', variant: v };

const LOOK_BASES = [
    ['wolf-black', 'wolf-black'], ['wolf', 'wolf'], ['direwolf', 'direwolf'], ['dog-', 'dog'], ['undeaddog', 'undeadwolf']
];

export function creatureFor(beast, lookBase) {
    if (beast) {
        const v = BEASTS[String(beast).replace(/^beast-/, '')];
        return v ? spec(v) : null;
    }
    const base = String(lookBase || '');
    const hit = LOOK_BASES.find(([p]) => base.startsWith(p));
    return hit ? { rig: 'canine', variant: hit[1] } : null;
}

export const CREATURE_BEASTS = Object.keys(BEASTS);

// Humanoid beasts whose 2D sprite is a stand-in of another body: bestiary key → body of avatar/bodies.js.
const BEAST_BODIES = {
    'skeleton-giant': 'skeleton-giant'    // Kostlivý obr (2D: troll)
};
export function beastBody(beast) {
    return beast ? BEAST_BODIES[String(beast).replace(/^beast-/, '')] || null : null;
}
