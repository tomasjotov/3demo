import { mapData } from './map.js';
import { characterData } from './characters.js';

// Hand-placed props.
const props = [
    { id: 'house1', type: 'house', x: 9, y: 5, solid: true },
    { id: 'house2', type: 'house', x: 10, y: 5, solid: true },
    { id: 'rock1', type: 'rock', x: 16, y: 4, solid: true },
    { id: 'rock2', type: 'rock', x: 17, y: 4, solid: true },
    { id: 'palm1', type: 'palm', x: 4, y: 4, solid: true },
    { id: 'palm2', type: 'palm', x: 26, y: 17, solid: true },
    { id: 'cactus1', type: 'cactus', x: 12, y: 15, solid: true },
    { id: 'cactus2', type: 'cactus', x: 18, y: 17, solid: true },
    { id: 'campfire', type: 'campfire', x: 22, y: 9, solid: false },
    // orchard by the houses
    { id: 'apple1', type: 'apple', variant: 1, x: 7, y: 4, solid: true },
    { id: 'apple2', type: 'apple', variant: 2, x: 12, y: 4, solid: true },
    { id: 'apple3', type: 'apple', variant: 1, x: 12, y: 2, solid: true },
    { id: 'deadtree1', type: 'deadtree', variant: 1, x: 15, y: 15, solid: true },
    { id: 'deadtree2', type: 'deadtree', variant: 2, x: 27, y: 12, solid: true }
];

// Procedural woods: clusters of trees + loose bushes, avoiding roads, sand,
// props and characters. Deterministic, so the map is the same every run.
const hash = (x, y, s = 0) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
};

const taken = new Set(props.map(p => `${p.x},${p.y}`));
const keepClear = [];
for (const c of characterData) keepClear.push([c.x, c.y]);
const nearCharacter = (x, y) => keepClear.some(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= 1);

const woods = [
    // [centre x, centre y, radius, mix]
    [3, 17, 4.2, ['oak', 'oak', 'pine', 'birch']],
    [26, 2.5, 3.6, ['pine', 'pine', 'pine', 'birch']],
    [14, 20, 2.6, ['birch', 'oak', 'birch']],
    [2, 2, 2.2, ['pine', 'oak']],
    [27, 20, 2.4, ['oak', 'birch', 'pine']]
];

const trees = [];
let id = 0;
for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x];
        if (!tile.startsWith('grass') || taken.has(`${x},${y}`) || nearCharacter(x, y)) continue;
        let placed = false;
        for (const [cx, cy, r, mix] of woods) {
            const d = Math.hypot(x - cx, y - cy);
            if (d > r) continue;
            const density = .75 - (d / r) * .45;
            if (hash(x, y) < density) {
                const type = mix[Math.floor(hash(x, y, 1) * mix.length)];
                trees.push({ id: `tree${id++}`, type, variant: 1 + Math.floor(hash(x, y, 2) * 3), x, y, solid: true });
                placed = true;
            }
            break;
        }
        // loose bushes / lone trees elsewhere on the grass
        if (!placed) {
            const h = hash(x, y, 5);
            if (h < .035) trees.push({ id: `bush${id++}`, type: 'bush', variant: 1 + Math.floor(hash(x, y, 6) * 2), x, y, solid: false });
            else if (h < .05) trees.push({ id: `tree${id++}`, type: hash(x, y, 7) < .5 ? 'oak' : 'birch', variant: 1 + Math.floor(hash(x, y, 8) * 3), x, y, solid: true });
        }
    }
}
// variants per type are limited (see TREE_TYPES)
const MAX_VARIANT = { oak: 3, pine: 3, birch: 3, apple: 2, bush: 2, deadtree: 2 };
for (const t of trees) t.variant = Math.min(t.variant, MAX_VARIANT[t.type]);

export const objectData = [...props, ...trees];
