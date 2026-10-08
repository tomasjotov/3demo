import { t } from '../i18n.js';
import { Character, DIR_VEC, dirFromStep } from '../game/Character.js';
import { GameObject } from '../game/GameObject.js';
import { convertFullPlan, splitControlled, footprintWidth } from './PlanAdapter.js';
import { rToDir, range10, actorArchetype, actorLook, lookSignature, moveTypeToState } from './mappings.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const POLL_MS = 200;                 // same cadence as the Phaser client
const WALK_CELLS_PER_S = 2.1;        // server: 410 ms straight / 820 ms diagonal per step
const RUN_CELLS_PER_S = 3.2;

/*
 * Server-driven game controller. Drop-in replacement for Game (same interface
 * as used by Renderer / MouseController / main.js), but the server is
 * authoritative: it polls getPlanInfo, mirrors actors into World and only
 * sends commands (setDestination, selectPlanActor).
 */
export class ServerGame {
    constructor(world, input, api, hooks = {}) {
        this.world = world;
        this.input = input;
        this.api = api;
        this.hooks = hooks;
        this.previewPath = [];
        this.previewTarget = null;
        this.serverOverlays = { ring: [], extra: [], spell: [], pointers: [] };
        this.known = new Map();          // actor id → body cell count
        this.ver = -1;
        this.lastFull = null;
        this.connected = false;
        this.error = '';
        this.lastMessage = '';
        this.phase = '';
        this.polls = 0;
    }

    get active() { return this.world.getPlayer(); }
    get movementPoints() { return this.active?.move ?? 0; }

    // --------------------------------------------------------------- sync
    async start() {
        // retry until the plan loads (server down, not logged in, no game selected)
        while (!this.stopped) {
            try { await this.reloadPlan(); break; } catch (e) {
                this.connected = false;
                this.error = e.message;
                await sleep(2000);
            }
        }
        this.pollLoop();
    }

    async reloadPlan() {
        const plan = await this.api.loadFullPlan();
        const { map, objects } = convertFullPlan(plan);
        this.world.setMap(map, objects.map(o => new GameObject(o)));
        this.hooks.onPlan?.();
    }

    stop() { this.stopped = true; }

    async pollLoop() {
        while (!this.stopped) {
            if (typeof document === 'undefined' || !document.hidden) {
                try {
                    const data = await this.api.getPlanInfo(this.hooks.getView?.() ?? 1);
                    if (this.stopped) break;
                    this.apply(data);
                    this.connected = true;
                    this.error = '';
                } catch (e) {
                    this.connected = false;
                    this.error = e.message;
                    await sleep(1000);
                }
            }
            await sleep(POLL_MS);
        }
    }

    apply(d) {
        if (d.ver <= this.ver) return;                  // out-of-order response
        this.ver = d.ver;
        this.polls++;
        this.phase = d.plan;
        if (this.lastFull !== null && d.lastFullPlanVersion > this.lastFull) this.reloadPlan().catch(e => { this.error = e.message; });
        this.lastFull = d.lastFullPlanVersion;

        const { cells, pointers } = splitControlled(d.actors, d.controlled, this.known);
        const seen = new Set();
        for (const a of d.actors) {
            seen.add(a.id);
            let c = this.world.characters.find(ch => ch.id === a.id);
            const body = cells.get(a.id) || [{ x: a.x, y: a.y }];
            const dir = rToDir(a.r) || 'S';
            if (!c) {
                const arch = actorArchetype(a, footprintWidth(body, dir));
                c = new Character({ id: a.id, name: a.name, type: arch.type, creature: arch.creature, canRide: arch.type === 'creature' ? false : undefined, modelScale: arch.scale, look: arch.look, x: a.x, y: a.y, direction: dir, speed: WALK_CELLS_PER_S });
                c.externalRender = true;
                c.serverCells = body;
                const ctr = c.centerAt(a.x, a.y, dir);
                c.renderX = ctr.x; c.renderY = ctr.y;
                this.world.characters.push(c);
                this.hooks.onAdd?.(c);
            }
            c.server = a;
            c.name = a.name;
            c.x = a.x; c.y = a.y;
            c.direction = dir;
            c.serverCells = body;
            c.move = a.mr;
            c.mp = a.mp;
            c.own = a.own;
            c.lights = a.lights || [];                       // carried light sources (PlanActor.lights)
            // equipment changed (weapon drawn / dropped, armour, helmet …) → re-dress the avatar
            if (c.look && a.lookBase && lookSignature(actorLook(a)) !== lookSignature(c.look)) c.look = actorLook(a);
        }
        for (const c of [...this.world.characters]) {
            if (c.server && !seen.has(c.id)) {
                this.world.characters.splice(this.world.characters.indexOf(c), 1);
                this.hooks.onRemove?.(c);
            }
        }

        const act = d.actors.find(a => a.active);
        const cur = this.world.active;
        if (act) this.world.setActive(this.world.characters.find(c => c.id === act.id));
        else if (!cur || !seen.has(cur.id)) this.world.setActive(this.world.characters.find(c => c.own) || this.world.characters[0] || null);
        if (this.world.active !== cur) this.clearPreview();

        this.serverOverlays = {
            ring: d.blocked.filter(c => c.x >= 0),
            extra: d.extra.filter(c => c.x >= 0),
            spell: d.spell.filter(c => c.x >= 0),
            pointers
        };
        // lights placed on the plan (PlanArena.lights): keep the same array while unchanged
        const sig = JSON.stringify(d.lights || []);
        if (sig !== this._lightsSig) { this._lightsSig = sig; this.areaLights = d.lights || []; }
        this.vision = d.vision;
        this.visionType = d.visionType;
    }

    // ------------------------------------------------------- per-frame motion
    update(dt) {
        for (const c of this.world.characters) {
            const a = c.server;
            if (!a) continue;
            const body = c.getCells();
            let cx = 0, cy = 0;
            for (const p of body) { cx += p.x; cy += p.y; }
            cx = cx / body.length + .5; cy = cy / body.length + .5;

            const stepping = a.tx >= 0 && (a.tx !== a.x || a.ty !== a.y);
            const tx = stepping ? cx + (a.tx - a.x) : cx;
            const ty = stepping ? cy + (a.ty - a.y) : cy;
            const dx = tx - c.renderX, dy = ty - c.renderY;
            const dist = Math.hypot(dx, dy);
            // Riding is a position of the actor (PositionType HORSE_RIDE / HORSE_RIDE_RUN), not a separate actor.
            c.riding = a.positionType === 'HORSE_RIDE' || a.positionType === 'HORSE_RIDE_RUN';
            const run = a.moveType === 'run' || a.positionType === 'HORSE_RIDE_RUN';
            const speed = run ? RUN_CELLS_PER_S : WALK_CELLS_PER_S;

            if (dist > 3) {                                  // teleport / big correction
                c.renderX = tx; c.renderY = ty;
            } else if (dist > .001) {
                const k = Math.min(1, speed * dt / dist);
                c.renderX += dx * k; c.renderY += dy * k;
            }
            const moving = stepping || dist > .06;
            c.speed = speed;
            c.runMultiplier = 1;

            c.horseGait = moving ? (run ? 'run' : 'walk') : 'idle';
            if (moving) {
                c.setState(c.riding ? 'ride' : run ? 'run' : 'walk');
                const md = dirFromStep(Math.round(Math.sign(dx) * (Math.abs(dx) > .2)), Math.round(Math.sign(dy) * (Math.abs(dy) > .2)));
                c.renderDirection = rToDir(a.tr) || md || c.direction;
            } else {
                const st = moveTypeToState(a.moveType);
                if (st === 'attack') {
                    // server keeps the attack state → loop the swing
                    if (c.state !== 'attack') { c.actionDuration = .7; c.actionTime = .7; }
                    c.actionTime -= dt;
                    if (c.actionTime <= 0) c.actionTime += c.actionDuration;
                }
                // in the saddle: no kneeling / lying, attacks and defence stay seated (ProceduralAvatar)
                c.setState(c.riding && (st === 'idle' || st === 'kneel' || st === 'lie') ? 'ride' : st);
                c.renderDirection = null;
            }
        }
    }

    // ------------------------------------------------------------ overlays
    // Inside of the move range (server sends only the ring, see blocked[]).
    getReachableTiles() {
        const c = this.active;
        const res = new Map();
        if (!c || !c.server || !this.serverOverlays.ring.length) return res;
        const sig = `${c.id}:${c.x},${c.y}:${c.move}:${this.world.characters.map(ch => ch.x + ',' + ch.y).join('|')}`;
        if (sig === this._reachSig) return this._reach;
        const r = c.move;
        for (let y = c.y - r - 1; y <= c.y + r + 1; y++) {
            for (let x = c.x - r - 1; x <= c.x + r + 1; x++) {
                if (!this.world.isInside(x, y)) continue;
                const d = Math.round(range10(x - c.x, y - c.y) / 10);
                if (d >= r || this.world.isBlocked(x, y, c)) continue;
                res.set(`${x},${y}`, d);
            }
        }
        this._reachSig = sig;
        this._reach = res;
        return res;
    }

    // Path exactly as the server will walk it (ArenaActor.updateT): straight
    // towards the target one cell per step, stopping on a blocked cell.
    serverPath(c, x, y) {
        const path = [{ x: c.x, y: c.y, dir: c.direction }];
        let px = c.x, py = c.y;
        for (let i = 0; i < 60 && (px !== x || py !== y); i++) {
            const nx = px + Math.sign(x - px), ny = py + Math.sign(y - py);
            if (this.world.isBlocked(nx, ny, c)) break;
            path.push({ x: nx, y: ny, dir: dirFromStep(nx - px, ny - py) });
            px = nx; py = ny;
        }
        return path;
    }

    // ------------------------------------------------------------ commands
    async previewTile(x, y) {
        // host page hook (hof GM terrain editor: planControl.jsp sendTerrainChange)
        if (this.hooks.onTileClick?.(x, y)) { this.clearPreview(); return; }
        const c = this.active;
        if (!c) return;
        this.previewPath = this.serverPath(c, x, y);
        this.previewTarget = { x, y };
        const last = this.previewPath[this.previewPath.length - 1];
        if (last.x !== x || last.y !== y) this.message(t('PLAN3D_PATH_STOPS', 'Cesta se zastaví na {x}, {y} (překážka)', { x: last.x, y: last.y }));
        await this.send(c, x, y);                      // 1st click on the server: point + turn
    }

    async commitPreview(x, y) {
        if (this.hooks.onTileClick?.(x, y)) { this.clearPreview(); return; }
        const c = this.active;
        if (!c) return;
        this.clearPreview();
        await this.send(c, x, y);                      // 2nd click on the same cell: move
    }

    async send(c, x, y) {
        try {
            await this.api.sendCoords(x, y);
            const r = await this.api.setDestination(c.id, x, y);
            if (r.message) this.message(r.message);
        } catch (e) {
            this.message('Chyba: ' + e.message);
        }
    }

    // Plain click on another character = ordinary click on its cell (target / attack
    // via the server two-click). Taking over control (GM) is Ctrl+click only.
    clickAvatar(c, tile) {
        if (!c) return;
        if (c === this.active) { this.message(`${c.name}: ${c.server?.moveType || ''} · mp ${c.mp} · dosah ${c.move}`); return; }
        const t = tile && this.world.getCharacterAt(tile.x, tile.y) === c ? tile : { x: c.x, y: c.y };
        return this.previewTarget && this.previewTarget.x === t.x && this.previewTarget.y === t.y
            ? this.commitPreview(t.x, t.y)
            : this.previewTile(t.x, t.y);
    }

    async selectActor(c) {
        if (c === this.active) return;
        try {
            const r = await this.api.selectPlanActor(c.id);
            this.message(r.ok ? t('PLAN3D_TAKE_CONTROL', 'Převzetí ovládání: {name} (potvrdí server)', { name: c.name }) : t('PLAN3D_TAKE_CONTROL_DENIED', '{name}: převzetí ovládání odmítnuto (jen GM)', { name: c.name }));
        } catch (e) {
            this.message('Chyba: ' + e.message);
        }
    }

    selectAt(c) {
        if (!c) { this.message(t('PLAN3D_NO_CHAR_ON_FIELD', 'Ctrl+klik: na poli není žádná postava')); return; }
        this.selectActor(c);
    }

    clearPreview() { this.previewPath = []; this.previewTarget = null; }

    message(m) { this.lastMessage = m; this._msgAt = performance.now(); }

    getLastMessage() {
        if (this.lastMessage && performance.now() - (this._msgAt || 0) > 5000) this.lastMessage = '';
        return this.lastMessage;
    }

    status() {
        const conn = this.connected ? `${this.api.mode} ✓` : `${this.api.mode} ✗ ${this.error}`;
        const lbl = this.api.label ? ` · ${this.api.label}` : '';
        return `${conn} · ${t('PLAN3D_PHASE', 'fáze')} ${this.phase === 'X' ? t('PLAN3D_PHASE_PREP', 'příprava') : this.phase === 'S' ? t('PLAN3D_PHASE_FIGHT', 'boj') : '—'} · ver ${this.ver}${lbl}`;
    }
}

// re-export for convenience
export { DIR_VEC };
