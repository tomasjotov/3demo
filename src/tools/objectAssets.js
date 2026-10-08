import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJECT_CATALOG, OBJECT_GROUPS } from '../data/objectCatalog.js';
import { buildObject } from '../renderer/ObjectFactory.js';

// Gallery of every catalogue object + export as binary glTF (<id>.glb) and a
// transparent preview thumbnail (previews/<id>.png) for the editor palette.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const lights = () => {
    const g = new THREE.Group();
    g.add(new THREE.HemisphereLight(0xe8f0ff, 0x4c5a3b, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1d2, 3);
    sun.position.set(-8, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
    g.add(sun);
    return g;
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c211b);
scene.add(lights());
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x6a9a45, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const items = [];
const perRow = 9;
OBJECT_GROUPS.forEach(() => {});
let row = 0;
for (const grp of OBJECT_GROUPS) {
    const list = OBJECT_CATALOG.filter(o => o.group === grp.id);
    list.forEach((e, i) => {
        const model = buildObject(e.id);
        model.position.set((i % perRow - (perRow - 1) / 2) * 2.2, 0, (row + Math.floor(i / perRow)) * 2.4 - 6);
        scene.add(model);
        items.push({ name: e.id, model });
    });
    row += Math.ceil(list.length / perRow);
}

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .1, 200);
camera.position.set(12, 20, 22);
camera.lookAt(0, 0.5, 0);
addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
});
let paused = false;
(function loop() { requestAnimationFrame(loop); if (!paused) renderer.render(scene, camera); })();

function cloneAtOrigin(model) {
    const clone = model.clone(true);
    clone.position.set(0, 0, 0);
    clone.updateMatrixWorld(true);
    return clone;
}

async function exportGLB(model) {
    return new GLTFExporter().parseAsync(cloneAtOrigin(model), { binary: true });
}

// Thumbnail: isometric-ish view like the game camera, framed to the bounding box.
const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setPixelRatio(1);
function renderPreview(model, id = '', size = 128) {
    thumbRenderer.setSize(size, size);
    thumbRenderer.setClearColor(0x000000, 0);
    const s = new THREE.Scene();
    s.add(lights());
    const m = cloneAtOrigin(model);
    s.add(m);
    if (id.startsWith('wall-')) {          // tile plate shows which edge the wall is on
        const plate = new THREE.Mesh(new THREE.BoxGeometry(1, .04, 1), new THREE.MeshStandardMaterial({ color: 0x6a9a45, roughness: 1 }));
        plate.position.y = -.02;
        s.add(plate);
    }
    const box = new THREE.Box3().setFromObject(m);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const cam = new THREE.PerspectiveCamera(30, 1, .01, 100);
    const dir = new THREE.Vector3(1, .85, 1.15).normalize();
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
    cam.position.copy(sphere.center).addScaledVector(dir, dist);
    cam.lookAt(sphere.center);
    thumbRenderer.render(s, cam);
    return thumbRenderer.domElement.toDataURL('image/png').split(',')[1];
}

function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}
async function exportAll() {
    for (const it of items) {
        download(`${it.name}.glb`, new Blob([await exportGLB(it.model)], { type: 'model/gltf-binary' }));
        await new Promise(r => setTimeout(r, 150));
        const png = Uint8Array.from(atob(renderPreview(it.model, it.name)), c => c.charCodeAt(0));
        download(`${it.name}.png`, new Blob([png], { type: 'image/png' }));
        await new Promise(r => setTimeout(r, 150));
    }
}
document.getElementById('export').onclick = exportAll;

const b64 = buf => {
    const u = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
};

// Automated tooling: { id: { glb: base64, png: base64 } }.
window.exportObjectAssets = async () => {
    const out = {};
    for (const it of items) out[it.name] = { glb: b64(await exportGLB(it.model)), png: renderPreview(it.model, it.name) };
    return out;
};
