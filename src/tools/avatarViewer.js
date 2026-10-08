import * as THREE from 'three';
import { ProceduralAvatar, AVATAR_TYPES } from '../renderer/ProceduralAvatar.js';
import { ProceduralHorse } from '../renderer/ProceduralHorse.js';

// Stand-alone preview of the procedural avatars in every animation state.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c211b);
scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x5c4c3b, 2.1));
const sun = new THREE.DirectionalLight(0xfff1d2, 3);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ color: 0x6a9a45, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 100);
let camAngle = .5, camDist = 9.5, camHeight = 4.2;

const STATES = ['idle', 'walk', 'run', 'attack', 'defend', 'kneel', 'lie', 'hit', 'death'];
const DURATION = { attack: .55, defend: .8, hit: .45 };
const TYPES = [...AVATAR_TYPES, 'horse'];
// Lay the models out side by side according to their width.
const WIDTH = t => t === 'giant' ? 2.4 : t === 'horse' ? 1.6 : 1.5;
const SLOT_X = [];
{ let x = 0; for (const t of TYPES) { SLOT_X.push(x + WIDTH(t) / 2); x += WIDTH(t); }
  const mid = x / 2; for (let i = 0; i < SLOT_X.length; i++) SLOT_X[i] -= mid; }
const chars = TYPES.map((type, i) => {
    const avatar = type === 'horse' ? new ProceduralHorse() : new ProceduralAvatar(type);
    avatar.root.position.x = SLOT_X[i];
    scene.add(avatar.root);
    return { type, avatar, state: 'idle', direction: 'S', speed: 3.2, runMultiplier: 1.6, actionTime: 0, actionDuration: 0 };
});

let current = 'idle', loopAction = true, frozen = false;
function setState(s) {
    current = s;
    for (const c of chars) {
        c.state = s;
        c.actionDuration = c.actionTime = DURATION[s] || 0;
    }
    document.querySelectorAll('.bar button[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === s));
}
const bar = document.getElementById('bar');
for (const s of STATES) {
    const b = document.createElement('button');
    b.textContent = s; b.dataset.s = s;
    b.onclick = () => setState(s);
    bar.appendChild(b);
}
const dirBtn = document.createElement('button');
const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
dirBtn.textContent = 'otočit 45°';
dirBtn.onclick = () => chars.forEach(c => { c.direction = DIRS[(DIRS.indexOf(c.direction) + 1) % 8]; });
bar.appendChild(dirBtn);
setState('idle');

let drag = null;
addEventListener('pointerdown', e => { if (e.target === renderer.domElement) drag = e.clientX; });
addEventListener('pointermove', e => { if (drag !== null) { camAngle -= (e.clientX - drag) * .008; drag = e.clientX; } });
addEventListener('pointerup', () => { drag = null; });
addEventListener('wheel', e => { camDist = THREE.MathUtils.clamp(camDist * (e.deltaY > 0 ? 1.1 : .9), 2.5, 20); });
addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
});

function step(dt) {
    for (const c of chars) {
        if (c.actionTime > 0) {
            c.actionTime -= dt;
            if (c.actionTime <= 0) {
                if (loopAction) { c.actionTime = c.actionDuration; c.avatar.state = null; }
                else c.actionTime = 0;
            }
        }
        c.avatar.update(c, dt);
    }
}

const target = new THREE.Vector3(0, .9, 0);
function render() {
    camera.position.set(target.x + Math.sin(camAngle) * camDist, camHeight * camDist / 9.5, target.z + Math.cos(camAngle) * camDist);
    camera.lookAt(target);
    renderer.render(scene, camera);
}

const clock = new THREE.Clock();
(function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05);
    if (!frozen) step(dt);
    render();
})();

// Hooks for automated screenshots / debugging.
window.viewer = {
    setState, chars,
    freeze(v = true) { frozen = v; },
    // Advance the simulation deterministically by `seconds`.
    advance(seconds, fps = 60) { for (let i = 0; i < seconds * fps; i++) step(1 / fps); render(); },
    camera(angle, dist, height, tx = 0, ty = .9) { camAngle = angle; camDist = dist; camHeight = height; target.set(tx, ty, 0); render(); },
    setLoop(v) { loopAction = v; }
};
