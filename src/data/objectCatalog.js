/*
 * Catalogue of static map objects — the single source of truth for
 *   • the 3D renderer   (model = <objectsBase>/<id>.glb, procedural fallback ObjectFactory)
 *   • the 3D terrain editor (planControl3d.jsp: graphical palette, previews/<id>.png)
 *   • the hof export     (WEB-INF/assets/objects/catalog.json)
 *
 * `id` is exactly the string the server stores in GamePlan.objects[] (arenaPaint val).
 * The server decides walkability by prefix (GamePlan.updateWalkable):
 *   wall*  → -1 (blocked)   tree*, stone*, brick*, bush*, stump* → 0 (blocked)   others → 1 (walkable)
 * so ids keep those prefixes.
 *
 * legacy: true  = 1:1 counterpart of an object of the old 2D (Phaser) editor (img/iso/objects/<id>.png)
 * legacy: false = new 3D object; the old 2D plan shows a stand-in sprite (`sprite2d`).
 * rot:  'random' (any angle) | 'quarter' (0/90/180/270°) | 'fixed'
 * hidden: rendered, but not offered in the editor palette (old name, replaced by a newer model)
 * sway: wind amplitude of the node "crown" (vegetation)
 * Weapons of the old editor (sword01, axe01, …) are intentionally not here yet.
 */
export const OBJECT_GROUPS = [
    { id: 'trees', label: 'Stromy' },
    { id: 'bushes', label: 'Keře a pařezy' },
    { id: 'stone', label: 'Kámen, zdi a sloupy' },
    { id: 'props', label: 'Předměty' }
];

export const OBJECT_CATALOG = [
    // --- trees ---------------------------------------------------------------
    { id: 'tree01', label: 'Strom listnatý', group: 'trees', legacy: true, rot: 'random', sway: .03 },
    { id: 'tree02', label: 'Smrk', group: 'trees', legacy: true, hidden: true, rot: 'random', sway: .02 },
    { id: 'tree_oak_1', label: 'Dub 1', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .03 },
    { id: 'tree_oak_2', label: 'Dub 2', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .03 },
    { id: 'tree_oak_3', label: 'Dub 3', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .03 },
    { id: 'tree_pine_1', label: 'Borovice 1', group: 'trees', sprite2d: 'tree02', rot: 'random', sway: .02 },
    { id: 'tree_pine_2', label: 'Borovice 2', group: 'trees', sprite2d: 'tree02', rot: 'random', sway: .02 },
    { id: 'tree_pine_3', label: 'Borovice 3', group: 'trees', sprite2d: 'tree02', rot: 'random', sway: .02 },
    { id: 'tree_birch_1', label: 'Bříza 1', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .035 },
    { id: 'tree_birch_2', label: 'Bříza 2', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .035 },
    { id: 'tree_birch_3', label: 'Bříza 3', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .035 },
    { id: 'tree_apple_1', label: 'Jabloň 1', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .03 },
    { id: 'tree_apple_2', label: 'Jabloň 2', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .03 },
    { id: 'tree_dead_1', label: 'Suchý strom 1', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .008 },
    { id: 'tree_dead_2', label: 'Suchý strom 2', group: 'trees', sprite2d: 'tree01', rot: 'random', sway: .008 },

    // --- bushes & stumps -----------------------------------------------------
    { id: 'bush01', label: 'Keř', group: 'bushes', legacy: true, rot: 'random', sway: .025 },
    { id: 'bush_1', label: 'Keř zelený', group: 'bushes', sprite2d: 'bush01', rot: 'random', sway: .02 },
    { id: 'bush_2', label: 'Keř s bobulemi', group: 'bushes', sprite2d: 'bush01', rot: 'random', sway: .02 },
    { id: 'stump01', label: 'Pařez', group: 'bushes', legacy: true, rot: 'random' },

    // --- stone, walls, columns ---------------------------------------------------
    { id: 'stone01', label: 'Kamenný blok', group: 'stone', legacy: true, rot: 'quarter' },
    { id: 'brick01', label: 'Cihlový blok', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'wall-n', label: 'Zeď sever', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'wall-e', label: 'Zeď východ', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'wall-s', label: 'Zeď jih', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'wall-w', label: 'Zeď západ', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'stone-col', label: 'Sloup', group: 'stone', legacy: true, rot: 'fixed' },
    { id: 'rock01', label: 'Kámen', group: 'stone', legacy: true, rot: 'random' },

    // --- props ---------------------------------------------------------------------
    { id: 'chest01', label: 'Truhla', group: 'props', legacy: true, rot: 'quarter' },
    { id: 'barrel01', label: 'Sud', group: 'props', legacy: true, rot: 'random' },
    { id: 'boxes01', label: 'Bedny', group: 'props', legacy: true, rot: 'quarter' },
    { id: 'vase01', label: 'Váza', group: 'props', legacy: true, rot: 'random' },
    // light: shines by itself (LightRenderer); power / radius must match hof PlanLight.objectPower (rules)
    { id: 'lantern01', label: 'Lucerna', group: 'props', legacy: true, rot: 'random', light: { type: 'LANTERN', power: 10, radius: 10, y: .16 } },
    { id: 'candlestick01', label: 'Svícen', group: 'props', legacy: true, rot: 'random', light: { type: 'CANDLE', power: 4, radius: 4, y: .5 } }
];

export const CATALOG_BY_ID = Object.fromEntries(OBJECT_CATALOG.map(o => [o.id, o]));

// Stand-in sprite for the old 2D plan (plan.jsp) for ids it does not know.
export function sprite2d(id) {
    const e = CATALOG_BY_ID[id];
    if (!e) return null;
    return e.legacy ? e.id : e.sprite2d;
}

// Ids used by the offline prototype (src/data/objects.js) before the catalogue.
export function legacyLocalId(type, variant = 1) {
    if (CATALOG_BY_ID[type]) return type;
    if (type === 'deadtree') return `tree_dead_${Math.min(variant, 2)}`;
    if (type === 'bush') return `bush_${Math.min(variant, 2)}`;
    const id = `tree_${type}_${variant}`;
    return CATALOG_BY_ID[id] ? id : null;
}
