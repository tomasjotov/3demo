import { buildTree } from './TreeFactory.js';
import { buildProp, isProp } from './PropFactory.js';
import { CATALOG_BY_ID } from '../data/objectCatalog.js';

/*
 * Procedural model for a catalogue id (src/data/objectCatalog.js).
 * Used directly as the fallback and by tools/object-assets to export
 * <id>.glb + previews/<id>.png.
 */
const TREE_IDS = {
    tree01: ['poplar', 1],
    tree02: ['spruce', 1],
    bush01: ['shrub', 1],
    tree_oak_1: ['oak', 1], tree_oak_2: ['oak', 2], tree_oak_3: ['oak', 3],
    tree_pine_1: ['pine', 1], tree_pine_2: ['pine', 2], tree_pine_3: ['pine', 3],
    tree_birch_1: ['birch', 1], tree_birch_2: ['birch', 2], tree_birch_3: ['birch', 3],
    tree_apple_1: ['apple', 1], tree_apple_2: ['apple', 2],
    tree_dead_1: ['deadtree', 1], tree_dead_2: ['deadtree', 2],
    bush_1: ['bush', 1], bush_2: ['bush', 2]
};

export function buildObject(id) {
    let g = null;
    if (TREE_IDS[id]) g = buildTree(...TREE_IDS[id]);
    else if (isProp(id)) g = buildProp(id);
    if (g) g.name = id;
    return g;
}

export const hasObjectModel = id => !!(CATALOG_BY_ID[id] && (TREE_IDS[id] || isProp(id)));
