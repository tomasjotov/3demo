// footprint: { w: cells across the facing, l: cells along it }  (default 1×1)
// x/y = front (anchor) cell; the rest of the body trails behind it.
export const characterData = [
    { id: 'hero', name: 'Hero', type: 'hero', x: 5, y: 10, player: true, speed: 3.2, direction: 'S' },
    { id: 'guard', name: 'Guard', type: 'guard', x: 14, y: 7, speed: 3, direction: 'S' },
    { id: 'merchant', name: 'Merchant', type: 'merchant', x: 21, y: 13, speed: 3, direction: 'W' },
    { id: 'bandit', name: 'Bandit', type: 'bandit', x: 24, y: 6, speed: 3, direction: 'S' },
    { id: 'horse', name: 'Horse', type: 'horse', x: 7, y: 7, footprint: { w: 1, l: 2 }, mountable: true, move: 10, speed: 3.6, direction: 'E' },
    { id: 'giant', name: 'Giant', type: 'giant', x: 20, y: 18, footprint: { w: 2, l: 1 }, move: 5, speed: 2.4, direction: 'W' }
];

// ?beasts – monsters with a rig of their own (avatar/creatures.js): the wolf family, big cats, a bear, hoofed, reptiles, bipeds.
export const beastDemo = [
    { id: 'wolf', name: 'Vlk', type: 'creature', creature: 'wolf', x: 9, y: 12, speed: 3.6, direction: 'W', canRide: false },
    { id: 'wolf2', name: 'Vlk (černý)', type: 'creature', creature: 'wolf-black', x: 10, y: 14, speed: 3.6, direction: 'NW', canRide: false },
    { id: 'direwolf', name: 'Vlk lítý', type: 'creature', creature: 'direwolf', x: 12, y: 11, speed: 4, direction: 'W', canRide: false },
    { id: 'hellhound', name: 'Pekelný pes', type: 'creature', creature: 'hellhound', x: 12, y: 15, speed: 4, direction: 'W', canRide: false },
    { id: 'spectral', name: 'Přízračný vlk', type: 'creature', creature: 'spectral', x: 14, y: 13, speed: 4, direction: 'W', canRide: false },
    { id: 'dog', name: 'Pes', type: 'creature', creature: 'dog', x: 7, y: 13, speed: 3.4, direction: 'N', canRide: false },
    { id: 'lion', name: 'Lev', type: 'creature', creature: 'lion', x: 15, y: 10, speed: 4, direction: 'W', canRide: false },
    { id: 'tiger', name: 'Tygr', type: 'creature', creature: 'tiger', x: 16, y: 12, speed: 4, direction: 'W', canRide: false },
    { id: 'bear', name: 'Medvěd', type: 'creature', creature: 'bear', x: 15, y: 15, speed: 3.4, direction: 'W', canRide: false },
    { id: 'bull', name: 'Býk', type: 'creature', creature: 'bull', x: 18, y: 11, speed: 3.4, direction: 'W', canRide: false },
    { id: 'unicorn', name: 'Jednorožec', type: 'creature', creature: 'unicorn', x: 18, y: 14, speed: 4, direction: 'W', canRide: false },
    { id: 'crocodile', name: 'Krokodýl', type: 'creature', creature: 'crocodile', x: 13, y: 17, speed: 2.5, direction: 'W', canRide: false },
    { id: 'sagat', name: 'Sagat', type: 'creature', creature: 'sagat', x: 17, y: 17, speed: 4.5, direction: 'W', canRide: false }
];
