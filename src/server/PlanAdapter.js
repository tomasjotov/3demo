import { gidToTile, objectToModel } from './mappings.js';

// GamePlan (loadFullPlan, Tiled isometric JSON) → { map, objects } for World.
export function convertFullPlan(plan) {
    const W = plan.width, H = plan.height;
    const l1 = plan.layers?.find(l => l.name === 'L1')?.data || plan.layers?.[0]?.data || [];
    const tiles = [];
    for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) row.push(gidToTile(l1[y * W + x] ?? 1));
        tiles.push(row);
    }
    const walkable = plan.walkable ? plan.walkable.map(v => v > 0) : null;

    const objects = [];
    (plan.objects || []).forEach((name, k) => {
        if (!name) return;
        const x = k % W, y = Math.floor(k / W);
        objects.push({
            id: `obj-${k}`, x, y, source: name,
            solid: walkable ? !walkable[k] : true,
            ...objectToModel(name, x, y)
        });
    });
    // Items lying on the ground (SoftMap { items: [...] }), several per tile.
    (plan.softObjects || []).forEach((soft, k) => {
        if (!soft || !soft.items) return;
        const x = k % W, y = Math.floor(k / W);
        soft.items.forEach((name, i) => objects.push({ id: `soft-${k}-${i}`, x, y, type: 'item', name, slot: i, solid: false }));
    });

    return {
        map: { width: W, height: H, tiles, walkable, darkness: plan.darkness || null, darknessBasis: plan.darknessBasis || 0 },
        objects
    };
}

// Assign controlled[] cells to actors. The server appends, for every actor in
// the same order as actors[], its whole footprint (getWorldMatrix, rows of the
// rotated rectangle, so NOT starting at the centre) and, right after the
// ACTIVE actor, its pointed cell. Boundaries between consecutive actors are
// found by proximity; `known` (id → body cell count, learned from frames
// where the actor was not active) separates the pointed cell from the body.
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function splitControlled(actors, controlled, known = new Map()) {
    const valid = (controlled || []).filter(c => c.x >= 0 && c.y >= 0);
    const segs = actors.map(() => []);
    const pointers = [];
    let k = 0;
    for (const c of valid) {
        if (!actors.length) break;
        // move on to the next actor when the cell is closer to it (ties go to
        // the next actor once the current one already has its centre cell)
        while (k + 1 < actors.length) {
            const dn = cheb(c, actors[k + 1]), dc = cheb(c, actors[k]);
            const hasCentre = segs[k].some(p => p.x === actors[k].x && p.y === actors[k].y);
            if (dn < dc || (dn === dc && hasCentre)) k++; else break;
        }
        if (cheb(c, actors[k]) > 4) { pointers.push({ x: c.x, y: c.y }); continue; }
        const seg = segs[k];
        if (!seg.some(p => p.x === c.x && p.y === c.y)) seg.push({ x: c.x, y: c.y });
    }
    const cells = new Map();
    actors.forEach((a, i) => {
        let body = segs[i];
        const n = known.get(a.id);
        const prevActive = i > 0 && actors[i - 1].active;
        if (a.active) {
            const m = n ?? (body.length === 2 ? 1 : body.length);
            pointers.push(...body.slice(m));
            body = body.slice(0, m);
        } else if (prevActive && n !== undefined && body.length === n + 1) {
            pointers.push(body[0]);                 // previous actor's pointer landed here
            body = body.slice(1);
        } else if (body.length) {
            known.set(a.id, body.length);
        }
        if (!body.some(p => p.x === a.x && p.y === a.y)) body.unshift({ x: a.x, y: a.y });
        cells.set(a.id, body);
    });
    return { cells, pointers };
}

// Footprint width across the facing (for choosing the model scale).
export function footprintWidth(cells, dir) {
    if (cells.length <= 1) return 1;
    const xs = new Set(cells.map(c => c.x)), ys = new Set(cells.map(c => c.y));
    if (dir === 'N' || dir === 'S') return xs.size;
    if (dir === 'E' || dir === 'W') return ys.size;
    return Math.max(xs.size, ys.size);
}

// Compact recording format (binding/fixtures/getPlanInfo-session1.json) → PlanArena objects.
export function expandRecording(rec) {
    const keys = rec.actorKeys;
    const coords = s => (s ? s.split(' ').map(p => {
        const [xy, text] = p.split(':');
        const [x, y] = xy.split(',').map(Number);
        return { x, y, text: text || '' };
    }) : []);
    return rec.frames.map(f => {
        const off = typeof f[0] === 'string' ? 1 : 0;             // optional label
        const [t, ver, plan, lastFullPlanVersion, vision, visionType, actors, blocked, controlled, extra, spell] = f.slice(off);
        return {
            label: off ? f[0] : '',
            t,
            data: {
                ver, plan, userId: 1, lastFullPlanVersion, vision, visionType,
                actors: actors.map(v => {
                    const a = {};
                    keys.forEach((k, i) => { a[k] = v[i]; });
                    a.own = !!a.own; a.active = !!a.active;
                    return a;
                }),
                blocked: coords(blocked), controlled: coords(controlled), extra: coords(extra), spell: coords(spell)
            }
        };
    });
}
