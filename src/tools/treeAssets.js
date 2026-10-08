import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildTree, TREE_TYPES, treeAssetName } from '../renderer/TreeFactory.js';

// Gallery of every tree variant + export of each one as a binary glTF (.glb).
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c211b);
scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x4c5a3b, 2.1));
const sun = new THREE.DirectionalLight(0xfff1d2, 3);
sun.position.set(-8, 14, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshStandardMaterial({ color: 0x6a9a45, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const items = [];
const types = Object.keys(TREE_TYPES);
types.forEach((type, row) => {
    for (let v = 1; v <= TREE_TYPES[type]; v++) {
        const model = buildTree(type, v);
        model.position.set((v - 2) * 2.6, 0, (row - (types.length - 1) / 2) * 2.4);
        scene.add(model);
        items.push({ name: treeAssetName(type, v), model });
    }
});

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .1, 200);
camera.position.set(11, 15, 19);
camera.lookAt(0, 0.8, 0);
addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
});
(function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); })();

// Export one model (position reset to origin) → ArrayBuffer (.glb).
async function exportGLB(model) {
    const clone = model.clone(true);
    clone.position.set(0, 0, 0);
    clone.updateMatrixWorld(true);
    return new GLTFExporter().parseAsync(clone, { binary: true });
}

async function exportAll() {
    for (const it of items) {
        const buf = await exportGLB(it.model);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
        a.download = `${it.name}.glb`;
        a.click();
        await new Promise(r => setTimeout(r, 150));
    }
}
document.getElementById('export').onclick = exportAll;

// Used by automated tooling: returns { name: base64 } for every asset.
window.exportTreeAssets = async () => {
    const out = {};
    for (const it of items) {
        const buf = new Uint8Array(await exportGLB(it.model));
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        out[it.name] = btoa(s);
    }
    return out;
};
