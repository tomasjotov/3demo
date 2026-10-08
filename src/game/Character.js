// Grid step vectors for the 8 compass directions (grid Y grows downward).
export const DIR_VEC = {
    N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
    S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1]
};
export const DIR_NAMES = Object.keys(DIR_VEC);
export const CARDINAL = ['N', 'E', 'S', 'W'];

export function dirFromStep(dx, dy) {
    for (const d of DIR_NAMES) if (DIR_VEC[d][0] === Math.sign(dx) && DIR_VEC[d][1] === Math.sign(dy)) return d;
    return null;
}

/*
 * Logical character on the 2D grid.
 *
 * Footprint `{ w, l }`: w = cells across the facing, l = cells along it.
 *   humanoid 1×1, horse 1×2, giant 2×1, big monster 3×2 …
 * `x/y` is the ANCHOR = front cell (for w > 1 the front-row cell at index
 * floor((w-1)/2) from the left). The other cells trail behind / to the side
 * according to `direction`. Creatures with w > 1 can only face N/E/S/W.
 */
export class Character {
    constructor(data) {
        Object.assign(this, data);
        const fp = data.footprint || { w: 1, l: data.size ?? 1 };
        this.footprint = { w: fp.w ?? 1, l: fp.l ?? 1 };
        this.state = 'idle';
        this.previousState = 'idle';
        this.path = [];
        this.pathIndex = 0;
        this.moveProgress = 0;
        this.actionTime = 0;
        this.actionDuration = 0;
        this.pose = null;
        this.animationTime = 0;
        // Shift = run: ground speed multiplier (the avatar's cadence follows it).
        this.runMultiplier = data.runMultiplier ?? 1.6;
        // Movement points per turn.
        this.move = data.move ?? 6;
        // Mounting: horses are mountable, 1×1 humanoids can ride.
        this.mountable = data.mountable ?? false;
        this.canRide = data.canRide ?? (!this.mountable && this.footprint.w === 1 && this.footprint.l === 1);
        this.mountedOn = null;
        this.rider = null;
        this.renderDirection = null;
        if (this.cardinalOnly && !CARDINAL.includes(this.direction)) this.direction = 'S';
        const c = this.centerAt(this.x, this.y, this.direction);
        this.renderX = c.x;
        this.renderY = c.y;
    }

    get isMulti() { return this.serverCells ? this.serverCells.length > 1 : this.footprint.w > 1 || this.footprint.l > 1; }
    get cardinalOnly() { return this.footprint.w > 1; }

    // ---------------------------------------------------------------- footprint
    cellsAt(x, y, dir = this.direction) {
        // Server mode: the server sends the real cells (rotated footprint).
        if (this.serverCells) {
            const dx = x - this.x, dy = y - this.y;
            return this.serverCells.map(c => ({ x: c.x + dx, y: c.y + dy }));
        }
        const { w, l } = this.footprint;
        if (w === 1 && l === 1) return [{ x, y }];
        const [fx, fy] = DIR_VEC[dir] || DIR_VEC.S;
        const rx = -fy, ry = fx;                 // right-hand vector of the facing
        const base = Math.floor((w - 1) / 2);
        const cells = [];
        for (let i = 0; i < l; i++) {
            for (let j = 0; j < w; j++) {
                const a = j - base;
                cells.push({ x: x - fx * i + rx * a, y: y - fy * i + ry * a });
            }
        }
        return cells;
    }

    getCells() { return this.cellsAt(this.x, this.y, this.direction); }

    occupies(x, y) {
        if (!this.isMulti) return this.x === x && this.y === y;
        return this.getCells().some(c => c.x === x && c.y === y);
    }

    // Render-space centre of the body for an anchor + facing.
    centerAt(x, y, dir = this.direction) {
        const cells = this.cellsAt(x, y, dir);
        let sx = 0, sy = 0;
        for (const c of cells) { sx += c.x; sy += c.y; }
        return { x: sx / cells.length + .5, y: sy / cells.length + .5 };
    }

    // ---------------------------------------------------------------- facing
    setDirection(dx, dy) {
        if (!dx && !dy) return;
        const d = dirFromStep(dx, dy);
        if (d && !(this.cardinalOnly && !CARDINAL.includes(d))) this.direction = d;
    }

    // ---------------------------------------------------------------- state
    setState(s) {
        if (this.state !== s) {
            this.previousState = this.state;
            this.state = s;
            this.animationTime = 0;
        }
    }

    startAction(s, d) { this.clearPath(); this.pose = null; this.actionTime = d; this.actionDuration = d; this.setState(s); }
    setPose(pose) { if (this.actionTime > 0) return false; this.clearPath(); this.pose = pose; this.setState(pose || 'idle'); return true; }
    clearPose() { this.pose = null; if (this.actionTime <= 0) this.setState('idle'); }
    updateAction(dt) {
        if (this.actionTime <= 0) return false;
        this.actionTime -= dt;
        if (this.actionTime <= 0) { this.actionTime = 0; this.actionDuration = 0; this.setState('idle'); }
        return true;
    }

    // ---------------------------------------------------------------- path
    // Path nodes: { x, y, dir } — anchor position and facing after each step.
    setPath(path) {
        this.path = path || [];
        this.pathIndex = 0;
        this.moveProgress = 0;
        if (this.path.length > 1) this.setState('walk');
    }

    clearPath() { this.path = []; this.pathIndex = 0; this.moveProgress = 0; }
    hasPath() { return this.pathIndex < this.path.length - 1; }
    isBusy() { return this.hasPath() || this.actionTime > 0; }

    // Visual position: the body centre glides from one footprint to the next.
    updateRender() {
        if (this.externalRender) return;            // position driven by ServerGame
        if (this.hasPath()) {
            const a = this.path[this.pathIndex], b = this.path[this.pathIndex + 1];
            const t = Math.max(0, Math.min(1, this.moveProgress));
            const ca = this.centerAt(a.x, a.y, a.dir), cb = this.centerAt(b.x, b.y, b.dir);
            this.renderX = ca.x + (cb.x - ca.x) * t;
            this.renderY = ca.y + (cb.y - ca.y) * t;
            this.renderDirection = b.dir;
        } else {
            const c = this.centerAt(this.x, this.y, this.direction);
            this.renderX = c.x;
            this.renderY = c.y;
            this.renderDirection = null;
        }
    }

    get facing() { return this.renderDirection || this.direction; }
}
