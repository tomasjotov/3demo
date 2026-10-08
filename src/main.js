import { createApp } from './app.js';

/*
 * Standalone page (Vite):
 *   game.html            offline prototype (local data, local rules)
 *   game.html?server     hof server via Vite proxy /hof → localhost:8080 (login in hof first)
 *   game.html?mock       replay of recorded server data (public/fixtures); ?mock&looks with demo layered avatars, &ride = on horseback
 *   &night[=N]           darkness N (default 8) with demo light sources (torch, lantern, light spell); offline also keys N / V
 * index.html is the hub page linking all demo pages.
 * Embedded in hof: see src/embed.js and docs/napojeni-na-server.md.
 */
const params = new URLSearchParams(location.search);
const mode = params.has('server') ? 'server' : params.has('mock') ? 'mock' : 'local';

window.__rpg = createApp({
    container: document.body,
    mode,
    base: params.get('server') || '/hof',
    hud: document.querySelector('.hud'),
    mockLooks: params.has('looks'),
    mockRide: params.has('ride'),
    beasts: params.has('beasts'),
    night: params.has('night') ? (Number(params.get('night')) || 8) : 0
});
