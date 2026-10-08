import { CATALOG_BY_ID } from '../data/objectCatalog.js';
import { bodyFor } from '../avatar/bodies.js';
import { lookSignature } from '../avatar/looks.js';
import { creatureFor, beastBody } from '../avatar/creatures.js';
export { lookSignature };
// Mappings between the hof server (2.5D Phaser data) and the 3D client.
// See docs/napojeni-na-server.md, chapters 6 and 7.

// Server direction r (0..7, iso screen based, verified in Calc.countAngle)
// → our compass direction. r = (index of our direction + 1) mod 8.
export const R_TO_DIR = ['NW', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W'];
export const DIR_TO_R = Object.fromEntries(R_TO_DIR.map((d, r) => [d, r]));

export const rToDir = r => (r >= 0 && r <= 7 ? R_TO_DIR[r] : null);

// Distance metric of the server: straight 10, diagonal 15 (Calc.countMapRange10).
export function range10(dx, dy) {
    dx = Math.abs(dx); dy = Math.abs(dy);
    const small = Math.min(dx, dy);
    return small * 15 + Math.abs(dx - dy) * 10;
}

// L1 ground gid (tileset iso-64x64-outside, firstgid 1; building firstgid 161) → tile type.
export function gidToTile(gid) {
    if (gid === 3 || gid === 4) return 'dirt';
    if ((gid >= 1 && gid <= 2) || (gid >= 5 && gid <= 7) || (gid >= 11 && gid <= 24)) return gid % 3 === 0 ? 'grass2' : 'grass';
    if (gid >= 31 && gid <= 44) return 'grass3';            // hills / slopes (no height yet)
    if (gid >= 51 && gid <= 80) return 'stone';             // rocks, cliffs
    if (gid >= 81 && gid <= 103) return 'water';
    if (gid >= 111 && gid <= 160) return 'grass3';          // tall grass, vegetation tiles
    if (gid >= 161) return 'floor';                          // building tileset
    return 'grass';
}

// objects[] names → model of ObjectRenderer. Catalogue ids (data/objectCatalog.js)
// are used 1:1; unknown names (weapons, items) become a generic item marker.
export function objectToModel(name) {
    if (CATALOG_BY_ID[name]) return { type: name, model: name };
    return { type: 'item', name };
}

// 3D model of an actor. With PlanActor.lookBase / layers (hof ≥ V21) the avatar is composed of the
// same layers as the 2D sprite; older servers → heuristic over name and footprint size.
const HUMAN_TYPES = ['hero', 'guard', 'bandit', 'merchant'];
export function actorArchetype(a, footprintWidth) {
    // creature with a rig of its own (PlanActor.beast = bestiary key, hof ≥ V29), see avatar/creatures.js
    const creature = creatureFor(a.beast, a.beast ? null : a.lookBase);
    if (creature) return { type: 'creature', creature, scale: footprintWidth >= 2 ? 1.5 : undefined };
    if (a.lookBase) {
        const body = bodyFor(beastBody(a.beast) || a.lookBase, a.lookVariant);
        if (body.type === 'horse') return { type: 'horse' };
        // the footprint (lookBase size on the server) wins over the default body scale
        const scale = footprintWidth >= 2 ? Math.min(2.8, .5 + .45 * Math.max(footprintWidth, 2)) : undefined;
        return { type: 'humanoid', scale, look: actorLook(a) };
    }
    const n = (a.name || '').toLowerCase();
    if (/kůň|kun|horse/.test(n)) return { type: 'horse' };
    if (/kostliv|skelet|kostr/.test(n)) return { type: 'skeleton' };
    if (footprintWidth >= 2 || /obr|troll|zlobr|ogre|giant|uruk/.test(n)) {
        return { type: 'giant', scale: Math.min(2.8, .5 + .45 * Math.max(footprintWidth, 2)) };
    }
    let h = 0;
    for (const ch of String(a.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { type: HUMAN_TYPES[h % HUMAN_TYPES.length] };
}

// PlanActor → look of the layered avatar (avatar/looks.js).
export function actorLook(a) {
    if (!a.lookBase) return null;
    return {
        base: beastBody(a.beast) || a.lookBase, variant: a.lookVariant || '', layers: Array.isArray(a.layers) ? a.layers : [],
        twoHanded: typeof a.twoHanded === 'boolean' ? a.twoHanded : undefined      // PlanActor.twoHanded (hof ≥ V23)
    };
}

// moveType → avatar state (while not moving between cells).
export function moveTypeToState(moveType) {
    if (!moveType) return 'idle';
    if (moveType === 'walk' || moveType === 'run') return 'idle';
    if (moveType === 'kneel' || moveType === 'pray') return 'kneel';
    if (moveType === 'lie') return 'lie';
    if (moveType.startsWith('attack')) return 'attack';
    if (moveType.startsWith('block') || moveType === 'evade') return 'defend';
    return 'idle';                                            // cast, use-item: no pose yet
}
