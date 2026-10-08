import * as THREE from 'three';
import { ProceduralAvatar } from '../renderer/ProceduralAvatar.js';
import { LAYER_KEYS } from '../avatar/layers.js';
import { LOOK_PRESETS } from '../avatar/looks.js';

// Šatník: one avatar dressed layer by layer with the 2D layer keys (+ the bases of bodies.js).
const BASES = ['male', 'female', 'skeleton-shambler', 'zombie-1', 'ghoul', 'mummy', 'goblin', 'uruk-soldier', 'ogre', 'troll',
    'brute-red', 'beastman', 'lizardman-normal', 'lizardman-red', 'daemon-lesser', 'fiend-green', 'shadow'];
const SLOTS = [
    ['Boty', k => k.startsWith('feet')],
    ['Nohy', k => k.startsWith('pants') || k.startsWith('bottom-')],
    ['Tělo', k => k.startsWith('top') || k.startsWith('body-')],
    ['Hlava', k => /^(hair|helmet-|crown|beard|hood|mask|hat)/.test(k)],
    ['Doplňky', k => /^(quiver|gauntlets|amulet|belt|cloak|tabard|robe|pack|pouch|bandolier)/.test(k)],
    ['Zbraň (pravá ruka)', k => k.startsWith('weapon-') && !/shield|-off$/.test(k)],
    ['Levá ruka', k => /^weapon-(shield|.*-off$)/.test(k)]
];
// one layer per slot (like the server: clothes OR armour, one helmet …) except accessories / head extras
const EXCLUSIVE = { 'Boty': 1, 'Nohy': 1, 'Tělo': 1, 'Zbraň (pravá ruka)': 1, 'Levá ruka': 1 };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c211b);
scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x5c4c3b, 2.1));
const sun = new THREE.DirectionalLight(0xfff1d2, 3);
sun.position.set(-4, 10, 6);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ color: 0x6a9a45, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 100);
let camAngle = .45, camDist = 5.2, camY = 1.0, camX = -.6;

const state = { base: 'male', variant: 'base01', layers: [...LOOK_PRESETS.hero.layers.filter(k => !['belt01', 'pouch', 'cloak01'].includes(k))] };
const ch = { state: 'idle', direction: 'S', speed: 3.2, runMultiplier: 1.6, actionTime: 0, actionDuration: 0 };
let avatar = null;
function rebuild() {
    if (avatar) scene.remove(avatar.root);
    avatar = new ProceduralAvatar({ base: state.base, variant: state.variant, layers: state.layers, twoHanded: state.twoHanded });
    avatar.root.position.x = 0;
    scene.add(avatar.root);
    camY = .9 * avatar.scale;
    document.getElementById('keys').textContent = JSON.stringify({ lookBase: state.base, lookVariant: state.variant, layers: state.layers, twoHanded: avatar.twoHanded });
    const g = document.getElementById('grip'); if (g) g.value = state.twoHanded === true ? '2H' : state.twoHanded === false ? '1H' : '';
    for (const cb of document.querySelectorAll('input[data-k]')) cb.checked = state.layers.includes(cb.dataset.k);
}

// ---------------------------------------------------------------- panel
const panel = document.getElementById('panel');
const h = (tag, txt, parent = panel) => { const e = document.createElement(tag); if (txt) e.textContent = txt; parent.appendChild(e); return e; };
h('h3', 'Tělo (lookBase / lookVariant)');
const sb = h('select'); for (const b of BASES) h('option', b, sb).value = b;
sb.onchange = () => { state.base = sb.value; rebuild(); };
const sv = h('select'); for (let i = 1; i <= 8; i++) h('option', 'base0' + i, sv).value = 'base0' + i;
sv.onchange = () => { state.variant = sv.value; rebuild(); };
h('h3', 'Předvolby');
for (const [name, look] of Object.entries(LOOK_PRESETS)) {
    const b = h('button', name); b.onclick = () => { Object.assign(state, { base: look.base, variant: look.variant || '', layers: [...look.layers], twoHanded: look.twoHanded }); sb.value = look.base; rebuild(); };
}
const nameOf = k => k.replace(/^weapon-/, '');
for (const [slot, test] of SLOTS) {
    h('h3', slot);
    for (const k of LAYER_KEYS.filter(test)) {
        const l = h('label');
        const cb = h('input', null, l); cb.type = 'checkbox'; cb.dataset.k = k;
        l.append(' ' + nameOf(k));
        cb.onchange = () => {
            let L = state.layers.filter(x => x !== k);
            if (cb.checked) {
                if (EXCLUSIVE[slot]) L = L.filter(x => !test(x));
                L.push(k);
                // keep the 2D drawing order of the server
                L.sort((a, b) => LAYER_KEYS.indexOf(a) - LAYER_KEYS.indexOf(b));
            }
            state.layers = L;
            rebuild();
        };
    }
    if (slot === 'Hlava') {
        const sel = h('select'); h('option', 'vlasy …', sel).value = '';
        for (let i = 1; i <= 16; i++) h('option', 'hair' + String(i).padStart(2, '0'), sel).value = 'hair' + String(i).padStart(2, '0');
        sel.onchange = () => { state.layers = state.layers.filter(x => !x.startsWith('hair')); if (sel.value) state.layers.push(sel.value); state.layers.sort((a, b) => LAYER_KEYS.indexOf(a.replace(/\d+$/, '01')) - LAYER_KEYS.indexOf(b.replace(/\d+$/, '01'))); rebuild(); };
        const bs = h('select'); h('option', 'vousy …', bs).value = '';
        for (let i = 1; i <= 4; i++) h('option', 'beard0' + i, bs).value = 'beard0' + i;
        bs.onchange = () => { state.layers = state.layers.filter(x => !x.startsWith('beard')); if (bs.value) state.layers.push(bs.value); rebuild(); };
    }
}
h('h3', 'Držení zbraně (PlanActor.twoHanded)');
const grip = h('select'); grip.id = 'grip';
for (const [v, t] of [['', 'auto (podle zbraně)'], ['1H', 'jednoručně'], ['2H', 'obouručně (2H)']]) h('option', t, grip).value = v;
grip.onchange = () => { state.twoHanded = grip.value === '2H' ? true : grip.value === '1H' ? false : undefined; rebuild(); };
h('h3', 'Vrstvy (PlanActor)');
h('div', '', panel).id = 'keys';
rebuild();

// ---------------------------------------------------------------- animation bar (bottom of the view)
const ANIMS = [['idle', 'Klid'], ['walk', 'Chůze'], ['run', 'Běh'], ['attack', 'Útok'], ['defend', 'Obrana'],
    ['kneel', 'Klek'], ['lie', 'Leh'], ['hit', 'Zásah'], ['death', 'Smrt']];
const DURATION = { attack: 1.1, hit: .6 };                   // looped actions (s)
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
let speed = 1, playing = true, turntable = false;
const bar = document.getElementById('animbar');
const btn = (txt, title, fn) => { const b = h('button', txt, bar); if (title) b.title = title; b.onclick = fn; return b; };
function setAnim(st) {
    ch.state = st;
    ch.actionDuration = ch.actionTime = DURATION[st] || 0;
    avatar.state = null;
    for (const b of bar.querySelectorAll('button[data-s]')) b.classList.toggle('on', b.dataset.s === st);
}
for (const [st, label] of ANIMS) btn(label, st, () => setAnim(st)).dataset.s = st;
h('span', '', bar).className = 'sep';
const playBtn = btn('⏸', 'pozastavit / pokračovat', () => { playing = !playing; playBtn.textContent = playing ? '⏸' : '▶'; });
const speedSel = h('select', null, bar);
for (const v of [.25, .5, 1, 1.5]) h('option', `${v}×`, speedSel).value = v;
speedSel.value = 1;
speedSel.title = 'rychlost animace';
speedSel.onchange = () => { speed = +speedSel.value; };
btn('↻ 45°', 'otočit postavu', () => { ch.direction = DIRS[(DIRS.indexOf(ch.direction) + 1) % 8]; });
const turnBtn = btn('otáčet kamerou', 'kamera obíhá kolem postavy', () => { turntable = !turntable; turnBtn.classList.toggle('on', turntable); });
setAnim('idle');

// ---------------------------------------------------------------- loop
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = e.clientX; });
addEventListener('pointermove', e => { if (drag !== null) { camAngle -= (e.clientX - drag) * .008; drag = e.clientX; } });
addEventListener('pointerup', () => { drag = null; });
addEventListener('wheel', e => { if (e.target === renderer.domElement) camDist = THREE.MathUtils.clamp(camDist * (e.deltaY > 0 ? 1.1 : .9), 1.5, 14); });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const clock = new THREE.Clock();
let frozen = false;
function step(dt) {
    if (ch.actionTime > 0) { ch.actionTime -= dt; if (ch.actionTime <= 0) { ch.actionTime = ch.actionDuration; avatar.state = null; } }
    avatar.update(ch, dt);
}
function tick(dt) {
    if (turntable) camAngle += dt * .35;
    if (playing) step(dt * speed);
}
function render() {
    const d = camDist * Math.max(1, avatar.scale * .8);
    camera.position.set(Math.sin(camAngle) * d + camX, camY + d * .25, Math.cos(camAngle) * d);
    camera.lookAt(camX, camY, 0);
    renderer.render(scene, camera);
}
(function loop() { requestAnimationFrame(loop); const dt = Math.min(clock.getDelta(), .05); if (!frozen) tick(dt); render(); })();

// automation hooks
window.wardrobe = {
    state, rebuild, get avatar() { return avatar; },
    set(look) { state.twoHanded = undefined; Object.assign(state, look); rebuild(); },
    anim(s, t = 0) { setAnim(s); frozen = true; for (let i = 0; i < 60 * t; i++) step(1 / 60); render(); },
    camera(a, d, x = 0, y = null) { camAngle = a; camDist = d; camX = x; if (y !== null) camY = y; render(); }
};
