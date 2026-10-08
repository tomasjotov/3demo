import { t } from '../i18n.js';
import { expandRecording } from './PlanAdapter.js';

/*
 * HTTP API of the hof server (ArenaController). All calls are GET and use the
 * browser session (JSESSIONID), so the 3D client must run on the same origin:
 * in development through the Vite proxy /hof → http://localhost:8080 (vite.config.js).
 */
export class ServerApi {
    constructor(base = '/hof') {
        this.base = base;
        this.mode = 'server';
    }

    async get(path, params = {}) {
        const q = new URLSearchParams(params).toString();
        const res = await fetch(`${this.base}/${path}${q ? '?' + q : ''}`, { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
        return res.text();
    }

    async getJson(path, params) {
        const text = await this.get(path, params);
        if (!text) throw new Error(`${path}: ${t('PLAN3D_EMPTY_RESPONSE', 'prázdná odpověď (není vybraná hra?)')}`);
        if (/^\s*</.test(text)) {
            throw new Error(/<!doctype html>[\s\S]*src\/main\.js/i.test(text)
                ? 'proxy /hof neběží – restartuj „npm run dev“ (načte vite.config.js)'
                : `${path}: ${t('PLAN3D_HTML_RESPONSE', 'server vrátil HTML (přihlášení? session vypršela?)')}`);
        }
        return JSON.parse(text);
    }

    // → GamePlan (Tiled JSON). Empty body = no game in session.
    loadFullPlan() { return this.getJson('game/loadFullPlan'); }

    // → PlanArena. Wrapped in { status, data: "<json string>" }.
    async getPlanInfo(view = 1) {
        const r = await this.getJson('game/getPlanInfo', { view });
        if (r.status !== 'OK') throw new Error('getPlanInfo: ' + (r.data || t('PLAN3D_NOT_LOGGED', 'ERROR (nepřihlášen / bez hry?)')));
        return JSON.parse(r.data);
    }

    // First call = point (turn), second call on the same cell = move. Server decides.
    async setDestination(id, x, y) {
        const r = await this.getJson('game/setDestination', { id, x, y });
        return { ok: r.status === 'OK', message: r.data || '' };
    }

    async sendCoords(x, y) { return this.getJson('game/sendCoords', { x, y }).catch(() => null); }

    // GM only: makes the actor the "override" actor controlled by the GM.
    async selectPlanActor(id) {
        const r = await this.getJson('game/selectPlanActor', { id });
        return { ok: r.status === 'OK' };
    }
}

/*
 * Offline replay of recorded server responses (public/fixtures/*). Plays the
 * frames with their recorded timing in a loop; commands only log.
 */
export class MockServer {
    constructor(base = './fixtures', { looks = false, ride = false, night = 0, beasts = false } = {}) {
        this.base = base;
        this.night = night;                // ?mock&night[=N] – darkness N with demo light sources (hof PlanActor.lights, PlanArena.lights)
        this.ride = ride;                  // ?mock&ride – Theralis on horseback (PlanActor.positionType)
        this.beasts = beasts;              // ?mock&beasts – a wolf pack next to the first actor (PlanActor.beast)
        this.looks = looks;                // ?mock&looks – add demo PlanActor.lookBase/layers (recording predates them)
        this.mode = 'mock';
        this.frames = null;
        this.start = performance.now();
    }

    async loadFullPlan() {
        const plan = await (await fetch(`${this.base}/loadFullPlan.json`)).json();
        if (this.night) plan.darknessBasis = this.night;
        return plan;
    }

    async getPlanInfo() {
        if (!this.frames) {
            const rec = await (await fetch(`${this.base}/getPlanInfo-session1.json`)).json();
            this.frames = expandRecording(rec);
            // squeeze long idle gaps of the recording (max 2.5 s between frames)
            let t = 0, prev = this.frames[0].t;
            for (const f of this.frames) { t += Math.min(2500, f.t - prev); prev = f.t; f.t = t; }
            this.t0 = 0;
            this.span = t + 3000;
        }
        const t = (performance.now() - this.start) % this.span + this.t0;
        let f = this.frames[0];
        for (const fr of this.frames) if (fr.t <= t) f = fr;
        this.label = f.label;
        // ver must grow even when the loop restarts
        const data = { ...f.data, ver: Math.floor(performance.now()) };
        if (this.looks) data.actors = data.actors.map(a => a.lookBase ? a : { ...a, ...demoLook(a.name) });
        if (this.night) {
            data.actors = data.actors.map((a, i) => a.lights ? a : { ...a, lights: [demoLight(a, i)] });
            const c = data.actors[0];
            if (c && !this.area) this.area = [{ type: 'AREA', power: 6, radius: 5, x: c.x + 3, y: c.y - 2 }];   // light placed on the plan
            if (!data.lights) data.lights = this.area || [];
        }
        if (this.beasts && data.actors.length) {
            const a0 = this.pack0 || (this.pack0 = { x: data.actors[0].x, y: data.actors[0].y });
            data.actors = [...data.actors, ...demoBeasts(a0)];
        }
        if (this.ride) data.actors = data.actors.map(a => /theralis/i.test(a.name)
            ? { ...a, positionType: a.moveType === 'run' ? 'HORSE_RIDE_RUN' : 'HORSE_RIDE' } : a);
        return data;
    }

    async setDestination(id, x, y) { console.info('[mock] setDestination', id, x, y); return { ok: true, message: 'mock: příkaz neodeslán' }; }
    async sendCoords() { return null; }
    async selectPlanActor(id) { console.info('[mock] selectPlanActor', id); return { ok: true }; }
}

// Demo monsters: wolves as hof sends them (bestiary key in PlanActor.beast, 2D lookBase only as a fallback).
function demoBeasts(a0) {
    const t = performance.now() / 1000;
    return [['wolf', 'Vlk obyčejný', 'wolf-black', 2, 2, 'walk'], ['wolf-ferocious', 'Vlk lítý', 'direwolf', 3, 0, 'attack-1'],
        ['hellhound', 'Pekelný pes', 'hound-large', 1, 3, (t % 8) < 4 ? 'block-unarmed' : 'walk'], ['spectral-wolf', 'Přízračný vlk', 'undeaddog', 4, 2, 'walk']]
        .map(([beast, name, lookBase, dx, dy, moveType], i) => ({
            id: 'demo-' + beast, name, beast, lookBase, lookVariant: '', layers: [], x: a0.x + dx, y: a0.y + dy, r: 2 + i, tx: -1, ty: -1,
            mp: 0, mr: 0, own: false, active: false, visibility: 100, moveType, imageSize: 128
        }));
}

// Demo light sources for the recorded actors (what hof sends in PlanActor.lights).
function demoLight(a, i) {
    const n = (a.name || '').toLowerCase();
    if (n.includes('theralis')) return { type: 'TORCH', hand: '', power: 10, radius: 10 };
    if (n.includes('kostliv')) return { type: 'DARK', hand: '', power: -5, radius: 4 };
    return i % 2 ? { type: 'LANTERN', hand: '', power: 8, radius: 8 } : { type: 'MAGIC', hand: '', power: 10, radius: 10 };
}

// Demo looks for the recorded actors (what hof ≥ V21 sends in PlanActor).
function demoLook(name = '') {
    const n = name.toLowerCase();
    if (n.includes('kostliv')) return { lookBase: 'skeleton-shambler', lookVariant: '', layers: ['body-chainmail', 'helmet-medium', 'weapon-sword', 'weapon-shield-iron-small'] };
    if (n.includes('obr')) return { lookBase: 'ogre', lookVariant: '', layers: ['pants01', 'body-leather', 'weapon-mace'] };
    return { lookBase: 'male', lookVariant: 'base03', twoHanded: true, layers: ['feet01', 'pants01', 'body-chainmail', 'gauntlets01', 'hair02', 'helmet-light', 'weapon-longsword', 'beard01'] };
}
