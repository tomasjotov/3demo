import { t } from './i18n.js';
import * as THREE from 'three';
import { Game } from './game/Game.js';
import { World } from './game/World.js';
import { InputManager } from './input/InputManager.js';
import { Renderer } from './renderer/Renderer.js';
import { mapData } from './data/map.js';
import { characterData, beastDemo } from './data/characters.js';
import { objectData } from './data/objects.js';
import { ServerApi, MockServer } from './server/ServerApi.js';
import { ServerGame } from './server/ServerGame.js';
import { configure } from './config.js';

// Server modes: only the basic info (position, movement, actions); controls are described in the docs.
const SERVER_HUD = () => '<div class="status"></div>';

/*
 * Creates one running instance of the 3D client inside `container`.
 *   mode: 'local' (offline prototype) | 'server' (hof) | 'mock' (recorded data)
 *   base: server context path ('/hof'), assetBase / objectsBase / charactersBase: model URLs (config.js)
 *   hud: existing HUD element, or 'create' to build one inside the container, or null
 *   hooks: { getView(), onTileClick(x, y) → handled? }
 * Returns { world, game, renderer, dispose() }.
 */
export function createApp(opts = {}) {
    const container = opts.container || document.body;
    const mode = opts.mode || 'local';
    configure({ assetBase: opts.assetBase, objectsBase: opts.objectsBase, charactersBase: opts.charactersBase });

    let hud = opts.hud;
    if (hud === 'create') {
        hud = document.createElement('div');
        hud.className = 'hud plan3d-hud';
        container.appendChild(hud);
    }
    if (hud && mode !== 'local') hud.innerHTML = SERVER_HUD(mode);
    const statusEl = () => hud?.querySelector('.status, #status');

    const input = new InputManager(container === document.body ? null : container);
    const clock = new THREE.Clock();
    let world, game, renderer;

    if (mode === 'local') {
        world = new World(mapData, opts.beasts ? [...characterData, ...beastDemo] : characterData, objectData);
        if (opts.night) demoNight(world, opts.night);
        game = new Game(world, input);
        renderer = new Renderer(world, input, game, { container });
        renderer.buildWorld(world);
    } else {
        const api = mode === 'server' ? new ServerApi(opts.base ?? '/hof') : new MockServer(opts.fixtures || './fixtures', { looks: opts.mockLooks, ride: opts.mockRide, night: opts.night, beasts: opts.beasts });
        world = new World({ width: 1, height: 1, tiles: [['grass']] }, [], []);
        game = new ServerGame(world, input, api, {
            ...(opts.hooks || {}),
            onPlan: () => renderer.buildStatic(world),
            onAdd: c => renderer.characterRenderer.build(renderer.scene, c),
            onRemove: c => renderer.characterRenderer.remove(c)
        });
        renderer = new Renderer(world, input, game, { container });
        renderer.buildStatic(world);
        game.start();
    }
    if (hud && container !== document.body) container.appendChild(hud);   // keep HUD above the canvas

    let running = true;
    function frame() {
        if (!running) return;
        // embedded page fragment was replaced (SPA navigation) → shut down
        if (container !== document.body && !container.isConnected) { dispose(); return; }
        requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), .05);
        game.update(dt);
        renderer.update(world, dt);
        renderer.render();
        const el = statusEl();
        if (el) el.textContent = statusText(mode, world, game);
    }
    requestAnimationFrame(frame);

    function dispose() {
        if (!running) return;
        running = false;
        game.stop?.();
        input.dispose();
        renderer.dispose();
        if (opts.hud === 'create') hud?.remove();
    }

    return { world, game, renderer, dispose };
}

// Offline light test (?night): darkness + a torch, a lantern and a light spell.
function demoNight(world, darkness) {
    world.map.darknessBasis = darkness;
    const give = (id, l) => { const c = world.characters.find(ch => ch.id === id); if (c) c.lights = [l]; };
    give('hero', { type: 'TORCH', power: 10, radius: 10 });
    give('guard', { type: 'LANTERN', power: 8, radius: 8 });
    give('merchant', { type: 'MAGIC', power: 10, radius: 10 });
    give('bandit', { type: 'TORCH', hand: 'R', power: 10, radius: 10 });
}

function statusText(mode, world, game) {
    const p = world.getPlayer();
    const path = game.previewPath?.length > 1 ? ` | ${t('PLAN3D_PATH', 'cesta: {n} polí', { n: game.previewPath.length - 1 })}` : '';
    const msg = game.getLastMessage() ? ' | ' + game.getLastMessage() : '';
    if (mode !== 'local') {
        const s = p.server;
        const info = s
            ? `${s.name}${s.positionType === 'HORSE_RIDE_RUN' ? ' (na koni, cval)' : s.positionType === 'HORSE_RIDE' ? ' (na koni)' : ''} · pole ${s.x}, ${s.y} · pohyb ${s.mp} (dosah ${s.mr}) · akce ${s.actions}+${s.speedActions}`
            : t('PLAN3D_NO_CHARACTER', 'žádná postava v aréně');
        const conn = game.connected ? '' : ` · ${t('PLAN3D_CONNECTION', 'spojení')}: ${game.error || t('PLAN3D_WAITING', 'čekám…')}`;
        return `${info}${conn}${msg}`;
    }
    const who = p.rider ? `${p.name} + ${p.rider.name}` : p.name;
    return `${t('PLAN3D_CONTROLLING', 'Ovládáš')}: ${who} | ${t('PLAN3D_FIELD', 'pole')} ${p.x}, ${p.y} | ${p.state} | ${t('PLAN3D_REACH', 'dosah')} ${p.move}${path}${msg}`;
}
