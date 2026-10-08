import { t } from '../i18n.js';
import { DIR_NAMES, DIR_VEC, CARDINAL } from './Character.js';

export class Game {
    constructor(world, input) {
        this.world = world;
        this.input = input;
        this.previewPath = [];
        this.previewTarget = null;
        this.committedMoves = 0;
        this.lastMessage = '';
    }

    get active() { return this.world.getPlayer(); }

    // Kept for compatibility with the HUD / renderer.
    get movementPoints() { return this.active.move; }

    // ------------------------------------------------------------------ update
    update(dt) {
        const a = this.active;
        const input = this.input;

        if (input.consume('m')) this.toggleMount(a);
        // Light test (offline): N = darkness 0 → 4 → 7 → 10, V = light of the controlled character.
        if (input.consume('n')) {
            const steps = [0, 4, 7, 10];
            const d = this.world.map.darknessBasis || 0;
            this.world.map.darknessBasis = steps[(steps.findIndex(s => s >= d) + 1) % steps.length] ?? 0;
            this.lastMessage = t('PLAN3D_DARKNESS', 'tma') + ': ' + this.world.map.darknessBasis;
        }
        if (input.consume('v')) {
            const cycle = [null, { type: 'TORCH', power: 10, radius: 10 }, { type: 'LANTERN', power: 8, radius: 8 },
                { type: 'MAGIC', power: 10, radius: 10 }, { type: 'DARK', power: -6, radius: 5 }];
            const cur = a.lights?.[0]?.type || null;
            const next = cycle[(cycle.findIndex(l => (l?.type || null) === cur) + 1) % cycle.length];
            a.lights = next ? [next] : [];
            this.lastMessage = `${a.name}: ${next ? next.type : t('PLAN3D_NO_LIGHT', 'bez světla')}`;
        }

        // Combat actions and poses only for a humanoid on foot.
        const onFoot = (a.canRide || a.type === 'creature') && !a.mountedOn;
        if (onFoot && a.actionTime <= 0) {
            if (input.consume('r')) { a.clearPose(); a.startAction('attack', .55); }
            else if (input.consume('t')) { a.clearPose(); a.startAction('defend', .8); }
            else if (input.consume('k')) a.setPose(a.pose === 'kneel' ? null : 'kneel');
            else if (input.consume('l')) a.setPose(a.pose === 'lie' ? null : 'lie');
        }
        // Drop key presses that were not used this frame.
        for (const k of ['r', 't', 'k', 'l']) input.consume(k);

        const running = input.down('shift');
        for (const c of this.world.characters) {
            if (c.mountedOn) {
                c.x = c.mountedOn.x; c.y = c.mountedOn.y;
                c.direction = c.mountedOn.direction;
                c.setState('ride');
                continue;
            }
            if (c.updateAction(dt)) continue;
            if (c.pose) { c.setState(c.pose); continue; }
            if (!this.stepMovement(c, dt, running && c === a)) c.setState('idle');
        }
    }

    stepMovement(c, dt, running) {
        if (!c.hasPath()) return false;
        const next = c.path[c.pathIndex + 1];
        c.moveProgress += c.speed * (running ? c.runMultiplier : 1) * dt;
        c.setState(running ? 'run' : 'walk');
        if (c.moveProgress >= 1) {
            c.x = next.x; c.y = next.y; c.direction = next.dir;
            c.moveProgress = 0;
            c.pathIndex++;
            if (c.pathIndex >= c.path.length - 1) { c.clearPath(); c.setState('idle'); }
        }
        return true;
    }

    // ------------------------------------------------------------- movement graph
    // A state is { x, y, dir } of the anchor (front cell). One step = 1 movement point.
    //  • w = 1 bodies (humanoid, horse): head moves to a neighbour cell and faces
    //    the step direction; the rest of the body follows (horse tail takes the
    //    old head cell).
    //  • w > 1 bodies (giant, 3×2 …): face N/E/S/W only. Cardinal step in a new
    //    direction = turn + step (centre moves one cell that way); diagonal steps
    //    strafe without turning.
    neighbors(c, s) {
        const W = this.world, out = [];
        for (const d of DIR_NAMES) {
            const [dx, dy] = DIR_VEC[d];
            const diag = !!(dx && dy);
            let next = null;
            if (c.footprint.w === 1) {
                next = { x: s.x + dx, y: s.y + dy, dir: d };
                if (!W.canPlace(c.cellsAt(next.x, next.y, d), c)) continue;
                if (diag && (W.isBlocked(s.x + dx, s.y, c) || W.isBlocked(s.x, s.y + dy, c))) continue;
            } else {
                const f = CARDINAL.includes(d) ? d : s.dir;
                if (f === s.dir) {
                    next = { x: s.x + dx, y: s.y + dy, dir: f };
                    if (!W.canPlace(c.cellsAt(next.x, next.y, f), c)) continue;
                    if (diag && (!W.canPlace(c.cellsAt(s.x + dx, s.y, f), c) || !W.canPlace(c.cellsAt(s.x, s.y + dy, f), c))) continue;
                } else {
                    const oc = c.centerAt(s.x, s.y, s.dir), tx = oc.x + dx, ty = oc.y + dy;
                    let bd = Infinity;
                    for (let ax = s.x - 2; ax <= s.x + 2; ax++) for (let ay = s.y - 2; ay <= s.y + 2; ay++) {
                        const cc = c.centerAt(ax, ay, f), dist = Math.hypot(cc.x - tx, cc.y - ty);
                        if (dist < bd - 1e-6 && W.canPlace(c.cellsAt(ax, ay, f), c)) { bd = dist; next = { x: ax, y: ay, dir: f }; }
                    }
                    if (!next || bd > .75) continue;
                }
            }
            out.push({ s: next, diag });
        }
        return out;
    }

    stateKey(c, s) { return c.isMulti ? `${s.x},${s.y},${s.dir}` : `${s.x},${s.y}`; }

    getPath(start, target, c = this.active) {
        // Fast reject: the anchor (front) cell itself must be free.
        if (this.world.isBlocked(target.x, target.y, c)) return [];
        const key = s => this.stateKey(c, s);
        const h = s => Math.max(Math.abs(s.x - target.x), Math.abs(s.y - target.y));
        const s0 = { x: start.x, y: start.y, dir: start.dir ?? c.direction };
        const open = [{ s: s0, g: 0, d: 0, f: h(s0) }];
        const came = new Map();
        const best = new Map([[key(s0), { g: 0, d: 0 }]]);
        const closed = new Set();
        while (open.length) {
            open.sort((a, b) => a.f - b.f || a.d - b.d);
            const cur = open.shift();
            const ck = key(cur.s);
            if (closed.has(ck)) continue;
            closed.add(ck);
            if (cur.s.x === target.x && cur.s.y === target.y) {
                const path = [cur.s];
                let k = ck;
                while (came.has(k)) { const p = came.get(k); path.push(p); k = key(p); }
                return path.reverse();
            }
            if (cur.g > 60) continue;
            for (const { s, diag } of this.neighbors(c, cur.s)) {
                const nk = key(s), g = cur.g + 1, d = cur.d + (diag ? 1 : 0);
                const old = best.get(nk);
                if (!old || g < old.g || (g === old.g && d < old.d)) {
                    best.set(nk, { g, d });
                    came.set(nk, cur.s);
                    open.push({ s, g, d, f: g + h(s) });
                }
            }
        }
        return [];
    }

    // Anchor cells reachable within the active character's movement points.
    // Cached: recomputed only when the active character or any occupied cell changes.
    getReachableTiles() {
        const sig = this.world.characters.map(ch => `${ch.id}:${ch.x},${ch.y},${ch.direction},${ch.mountedOn ? 1 : 0}`).join('|')
            + `#${this.active.id}`;
        if (this._reachSig !== sig) {
            this._reachSig = sig;
            this._reach = this.computeReachableTiles();
        }
        return this._reach;
    }

    computeReachableTiles() {
        const c = this.active;
        const result = new Map();
        const s0 = { x: c.x, y: c.y, dir: c.direction };
        const seen = new Map([[this.stateKey(c, s0), 0]]);
        result.set(`${c.x},${c.y}`, 0);
        const queue = [{ s: s0, d: 0 }];
        while (queue.length) {
            const cur = queue.shift();
            if (cur.d >= c.move) continue;
            for (const { s } of this.neighbors(c, cur.s)) {
                const k = this.stateKey(c, s), nd = cur.d + 1;
                if (nd < (seen.get(k) ?? Infinity)) {
                    seen.set(k, nd);
                    const tk = `${s.x},${s.y}`;
                    if (nd < (result.get(tk) ?? Infinity)) result.set(tk, nd);
                    queue.push({ s, d: nd });
                }
            }
        }
        return result;
    }

    previewTile(x, y) {
        const p = this.active;
        if (p.isBusy() || p.mountedOn) { this.lastMessage = t('PLAN3D_BUSY', '{name} je zaneprázdněn (pohyb / akce)', { name: p.name }); return []; }
        const path = this.getPath({ x: p.x, y: p.y, dir: p.direction }, { x, y }, p);
        this.previewPath = path;
        this.previewTarget = path.length ? { x, y } : null;
        // Single-cell characters turn toward the first step right away.
        if (path.length > 1 && !p.isMulti) p.direction = path[1].dir;
        return path;
    }

    commitPreview(x, y) {
        if (!this.previewTarget || this.previewTarget.x !== x || this.previewTarget.y !== y) {
            this.previewTile(x, y);
            return false;
        }
        const p = this.active;
        if (this.previewPath.length > 1) {
            this.committedMoves = this.previewPath.length - 1;
            p.clearPose();
            p.setPath(this.previewPath);
            p.setState(this.input.down('shift') ? 'run' : 'walk');
        }
        this.clearPreview();
        return true;
    }

    clearPreview() { this.previewPath = []; this.previewTarget = null; }

    // ------------------------------------------------------------- control & mount
    // Clicking another avatar takes control of it; a rider redirects to the horse.
    clickAvatar(c) {
        const target = c.mountedOn || c;
        if (target === this.active) {
            this.lastMessage = `Dummy metoda avatara: ${c.name}`;
            return;
        }
        this.world.setActive(target);
        this.clearPreview();
        const who = target.rider ? `${target.name} (jezdec: ${target.rider.name})` : target.name;
        this.lastMessage = `${t('PLAN3D_CONTROLLING', 'Ovládáš')}: ${who}`;
    }

    // Ctrl+click: select only.
    selectAt(c) {
        if (!c) { this.lastMessage = t('PLAN3D_NO_CHAR_ON_FIELD', 'Ctrl+klik: na poli není žádná postava'); return; }
        const target = c.mountedOn || c;
        if (target === this.active) { this.lastMessage = t('PLAN3D_ALREADY_CONTROLLING', 'Už ovládáš: {name}', { name: target.name }); return; }
        this.clickAvatar(target);
    }

    toggleMount(a) {
        // Dismount: active is a horse with a rider, or the rider itself.
        const horse = a.rider ? a : a.mountedOn;
        if (horse) {
            if (horse.isBusy()) { this.lastMessage = t('PLAN3D_STOP_HORSE_FIRST', 'Nejdřív zastav koně'); return; }
            this.dismount(horse);
            return;
        }
        if (!a.canRide) { this.lastMessage = t('PLAN3D_CANNOT_RIDE', '{name} nemá jezdce', { name: a.name }); return; }
        if (a.isBusy() || a.pose) { this.lastMessage = t('PLAN3D_NO_MOUNT_IN_ACTION', 'Nelze nasednout během akce'); return; }
        const near = this.world.characters.find(h => h.mountable && !h.rider && !h.isBusy() &&
            h.getCells().some(p => Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y)) <= 1));
        if (!near) { this.lastMessage = t('PLAN3D_NO_HORSE_NEAR', 'Žádný kůň vedle avatara (M = nasednout)'); return; }
        a.mountedOn = near;
        near.rider = a;
        a.clearPath();
        a.setState('ride');
        this.world.setActive(near);
        this.clearPreview();
        this.lastMessage = t('PLAN3D_MOUNTED', '{name} nasedl na koně', { name: a.name });
    }

    dismount(horse) {
        const r = horse.rider;
        // Prefer the horse's left side, then right, then anything around it.
        const [fx, fy] = DIR_VEC[horse.direction];
        const rx = -fy, ry = fx;
        const cells = horse.getCells();
        const candidates = [];
        for (const c of cells) {
            candidates.push({ x: c.x - rx, y: c.y - ry }, { x: c.x + rx, y: c.y + ry });
        }
        for (const c of cells) for (const [dx, dy] of Object.values(DIR_VEC)) candidates.push({ x: c.x + dx, y: c.y + dy });
        const spot = candidates.find(p => !this.world.isBlocked(p.x, p.y, null));
        if (!spot) { this.lastMessage = t('PLAN3D_NO_DISMOUNT_SPOT', 'Není kam sesednout'); return; }
        horse.rider = null;
        r.mountedOn = null;
        r.x = spot.x; r.y = spot.y;
        r.direction = horse.direction;
        r.setState('idle');
        this.world.setActive(r);
        this.clearPreview();
        this.lastMessage = `${r.name} sesedl`;
    }

    // Messages expire after 4 s so a stale one is never mistaken for the current state.
    getLastMessage() {
        if (this.lastMessage !== this._msg) { this._msg = this.lastMessage; this._msgAt = performance.now(); }
        if (this.lastMessage && performance.now() - this._msgAt > 4000) this.lastMessage = '';
        return this.lastMessage || '';
    }
}
