/*
 * Creatures with a rig of their own (not the humanoid ProceduralAvatar).
 *
 * hof sends the bestiary key of a monster in PlanActor.beast (beast-wolf → 'wolf'). The 2D lookBase of a
 * monster is only the closest sprite (a bear or a lion is drawn as 'hound-large'), so the bestiary key decides;
 * the lookBase is used only when there is no key (characters, older server).
 * Overview of the bestiary and the rigs still missing: docs/bestiar-modely.md.
 *
 *   creatureFor(beast, lookBase) → { rig: 'canine' | 'feline' | 'bear' | 'rat' | 'hoofed' | 'pachyderm' | 'reptile' | 'biped' | 'arthropod'
 *       | 'serpent' | 'centaur' | 'flyer' | 'dragon' | 'elemental' | 'aquatic' | 'amorphous' | 'plant', variant } | null
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
    ghat: 'biped:ghat',                   // Ghat
    // ProceduralArthropod
    gargantula: 'arthropod:gargantula',   // Gargantula
    'giant-strider': 'arthropod:giant-strider', // Obří sekáč
    rahlog: 'arthropod:rahlog',           // Rahlog
    'rahlog-queen': 'arthropod:rahlog-queen', // Rahlog - královna
    sorog: 'arthropod:sorog',             // Sorog
    urax: 'arthropod:urax',               // Urax
    xur: 'arthropod:xur',                 // Xur
    zeghar: 'arthropod:zeghar',           // Ze’ghar
    ant: 'arthropod:ant',                 // Mravenec
    'beetle-1': 'arthropod:beetle-1',     // Brouk I
    'beetle-2': 'arthropod:beetle-2',     // Brouk II
    'beetle-3': 'arthropod:beetle-3',     // Brouk III
    'dune-reaper': 'arthropod:dune-reaper', // Pouštní zabiják
    mantis: 'arthropod:mantis',           // Kudlanka tropická
    'giant-scorpion': 'arthropod:giant-scorpion', // Štír obří
    'diamond-scorpion': 'arthropod:diamond-scorpion', // Diamantový štír
    'giant-crab': 'arthropod:giant-crab', // Obří krab
    'giant-spider-crab': 'arthropod:giant-spider-crab', // Giga Krabopavouk
    aku: 'arthropod:aku',                 // Aku
    sirii: 'arthropod:sirii',             // Sirii
    urxuquer: 'arthropod:urxuquer',       // Urxuquer (pavouk s lidským trupem)
    // ProceduralSerpent
    python: 'serpent:python',              // Python
    'crystal-snake': 'serpent:crystal-snake', // Křišťálový had
    'sea-serpent': 'serpent:sea-serpent',  // Mořský had
    'goblin-snake': 'serpent:goblin-snake', // Skřetohad
    'winged-serpent': 'serpent:winged-serpent', // Okřídlený had
    hydra: 'serpent:hydra',                // Hydra
    'forest-wurm': 'serpent:forest-wurm',  // Lesní červ
    'serpent-guardian': 'serpent:serpent-guardian', // Hadí strážce
    aakf: 'serpent:aakf',                  // Aakf
    'corpse-wurm': 'serpent:corpse-wurm',  // Mrtvočerv
    'leech-shuddery': 'serpent:leech-shuddery', // Pijavice hrozivá
    sandworm: 'serpent:sandworm',          // Písečný červ
    'swamp-worm': 'serpent:swamp-worm',    // Bahenní červ
    'cave-slug': 'serpent:cave-slug',      // Slimák jeskynní
    'maggot-lair-1': 'serpent:maggot-lair-1', // Jeskynní červ
    'maggot-lair-2': 'serpent:maggot-lair-2', // Jeskynní červ - matka
    nugotha: 'serpent:nugotha',            // Nugotha
    sterenda: 'serpent:sterenda',          // Sterenda
    // ProceduralCentaur
    centaur: 'centaur:centaur',            // Kentaur
    // ProceduralFlyer
    eagle: 'flyer:eagle',                  // Orel královský
    phoenix: 'flyer:phoenix',              // Fénix
    gryffon: 'flyer:gryffon',              // Gryf
    harpy: 'flyer:harpy',                  // Harpyje
    'giant-bat': 'flyer:giant-bat',        // Netopýr obří
    'vampire-bat-form': 'flyer:vampire-bat-form', // Upír (v podobě netopýra)
    'vampire-elder-bat-form': 'flyer:vampire-elder-bat-form', // Upír prastarý (v podobě netopýra)
    // ProceduralDragon
    dragon: 'dragon:dragon',               // Drak
    'dragon-young': 'dragon:dragon-young', // Drak mladý
    'dragon-elder': 'dragon:dragon-elder', // Drak prastarý
    dragonlich: 'dragon:dragonlich',       // Drakolich
    'skeleton-dragon': 'dragon:skeleton-dragon', // Kostlivý drak
    wyvern: 'dragon:wyvern',               // Wyvern
    gargoyle: 'dragon:gargoyle',           // Gargoyla
    // ProceduralElemental
    'earth-elemental': 'elemental:earth-elemental', // Zemní elementál
    'earth-elemental-greater': 'elemental:earth-elemental-greater', // Zemní elementál vyšší
    'earth-elemental-giant': 'elemental:earth-elemental-giant', // Zemní elementál obří
    golem: 'elemental:golem',              // Golem
    automaton: 'elemental:automaton',      // Automaton
    'fire-elemental-greater': 'elemental:fire-elemental-greater', // Ohnivý elementál vyšší
    'fire-elemental-giant': 'elemental:fire-elemental-giant', // Ohnivý elementál obří
    'water-elemental-greater': 'elemental:water-elemental-greater', // Vodní elementál vyšší
    'air-elemental-greater': 'elemental:air-elemental-greater', // Vzdušný elementál vyšší
    vestrad: 'elemental:vestrad',          // Vestrad
    'swarm-devil': 'elemental:swarm-devil', // Děsivý roj
    'maggot-man': 'elemental:maggot-man',  // Červicec
    // ProceduralAquatic
    shark: 'aquatic:shark',                // Žralok
    'octopuss-1': 'aquatic:octopuss-1',    // Chobotnice obří
    'octopuss-2': 'aquatic:octopuss-2',    // Chobotnice ďábelská
    'octopuss-3': 'aquatic:octopuss-3',    // Horor z hlubin
    kraken: 'aquatic:kraken',              // Kraken
    klobg: 'aquatic:klobg',                // Klobg
    manyhead: 'aquatic:manyhead',          // Mnohohlavec
    'illusion-beast': 'aquatic:illusion-beast', // Iluzní tvor
    'illusion-beast-2': 'aquatic:illusion-beast-2', // Iluzní tvor II
    // ProceduralAmorphous
    'air-elemental': 'amorphous:air-elemental', // Vzdušný elementál
    'air-elemental-giant': 'amorphous:air-elemental-giant', // Vzdušný elementál obří
    'water-elemental': 'amorphous:water-elemental', // Vodní elementál
    'water-elemental-giant': 'amorphous:water-elemental-giant', // Vodní elementál obří
    'fire-elemental': 'amorphous:fire-elemental', // Ohnivý elementál
    'cave-slime': 'amorphous:cave-slime',  // Sliz, jeskynní
    'living-jelly': 'amorphous:living-jelly', // Oživlý rosol
    chasfon: 'amorphous:chasfon',          // Chasfon
    'cloud-form': 'amorphous:cloud-form',  // Přeměna na oblak
    'vampire-cloud-form': 'amorphous:vampire-cloud-form', // Upír (v podobě oblaku)
    'vampire-elder-cloud-form': 'amorphous:vampire-elder-cloud-form', // Upír prastarý (v podobě oblaku)
    vermin: 'amorphous:vermin',            // Havěť
    // ProceduralPlant
    drischea: 'plant:drischea',            // Drischea
    gwanga: 'plant:gwanga',                // Gwanga
    'hungry-wine': 'plant:hungry-wine',    // Hladové víno
    mirocus: 'plant:mirocus',              // Mirocus
    rack: 'plant:rack',                    // Skřipec
    skorfan: 'plant:skorfan',              // Skorfan
    suotix: 'plant:suotix',                // Suotix
    waaz: 'plant:waaz',                    // Waaz
    'evil-tree': 'plant:evil-tree',        // Oživlý strom
    'tree-folk': 'plant:tree-folk',        // Stromový lid
    'nature-wrath': 'plant:nature-wrath',  // Zloba přírody
    'forest-phantom': 'plant:forest-phantom'  // Lesní přízrak
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

// Humanoid beasts whose 2D sprite is a stand-in of another body: bestiary key → body of avatar/bodies.js
// (monster bodies of avatar/beastBodies.js carry the bestiary key as their name).
const BEAST_BODY_KEYS = [
    // gugs: demons of wrath, decay, gluttony and possession I–V
    ...['anger', 'decay', 'gluttony', 'possession'].flatMap(g => [1, 2, 3, 4, 5].map(i => `demon-${g}-${i}`)),
    'demon-pride-1', 'demon-pride-2', 'demon-pride-3', 'demon-pride-4', 'demon-pride-5',   // succubi / incubi (wings, horns, tail)
    'demon-devourer-3', 'demon-devourer-4', 'demon-devourer-5',                           // draunug lords (wings, horns, maw)
    'fairy', 'fallen-angel', 'faun', 'cobold', 'werewolf', 'werewolf-elder', 'minotaur',  // wings, goat legs, wolf / bull heads
    'headless', 'mermaid', 'triton', 'ubeg', 'gorilla'                                     // no head, fish tails, insect head, ape
];
const BEAST_BODIES = {
    'skeleton-giant': 'skeleton-giant',   // Kostlivý obr (2D: troll)
    ...Object.fromEntries(BEAST_BODY_KEYS.map(k => [k, k]))
};
export function beastBody(beast) {
    return beast ? BEAST_BODIES[String(beast).replace(/^beast-/, '')] || null : null;
}
