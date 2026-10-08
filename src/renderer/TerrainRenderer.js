import * as THREE from 'three';

const COLORS = {
    grass: 0x6a9a45, grass2: 0x65953f, grass3: 0x71a14b,
    dirt: 0x9b7a4e, sand: 0xcaa66a, sand2: 0xbf9c62, sand3: 0xb98c53,
    water: 0x3f7fb5, stone: 0x8a8a84, floor: 0xa98b62
};

const hash = (x, y) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
};

export class TerrainRenderer {
    // All tiles are one InstancedMesh (one draw call) with a per-tile colour
    // jitter; grass tiles additionally get small instanced tufts.
    build(scene, map, objects = []) {
        const count = map.width * map.height;
        const tiles = new THREE.InstancedMesh(
            new THREE.BoxGeometry(.98, .12, .98),
            new THREE.MeshStandardMaterial({ roughness: 1 }),
            count
        );
        tiles.receiveShadow = true;
        const m = new THREE.Matrix4(), col = new THREE.Color();
        let i = 0;
        const tufts = [];
        const blocked = new Set(objects.map(o => `${o.x},${o.y}`));
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const type = map.tiles[y][x];
            m.makeTranslation(x + .5, type === 'water' ? -.11 : -.06, y + .5);
            tiles.setMatrixAt(i, m);
            col.setHex(COLORS[type] ?? COLORS.grass);
            col.offsetHSL(0, 0, (hash(x, y) - .5) * .025);
            tiles.setColorAt(i, col);
            i++;
            if (type.startsWith('grass') && !blocked.has(`${x},${y}`)) {
                const n = Math.floor(hash(y, x) * 3);
                for (let k = 0; k < n; k++) {
                    tufts.push([x + .15 + hash(x + k, y) * .7, y + .15 + hash(x, y + k) * .7, hash(x * k, y - k)]);
                }
            }
        }
        tiles.instanceColor.needsUpdate = true;
        tiles.raycast = () => {};
        scene.add(tiles);

        if (tufts.length) {
            const geo = new THREE.ConeGeometry(.04, .12, 4);
            geo.translate(0, .06, 0);
            const tuft = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), tufts.length * 3);
            const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
            let j = 0;
            for (const [tx, tz, r] of tufts) {
                for (let b = 0; b < 3; b++) {
                    e.set((b - 1) * .35, r * 6 + b, (b - 1) * .25);
                    q.setFromEuler(e);
                    const sc = .7 + r * .6;
                    s.set(sc, sc * (.8 + b * .15), sc);
                    p.set(tx + (b - 1) * .03, 0, tz);
                    m.compose(p, q, s);
                    tuft.setMatrixAt(j, m);
                    col.setHex(0x4f8034).offsetHSL(0, 0, (r - .5) * .12);
                    tuft.setColorAt(j, col);
                    j++;
                }
            }
            tuft.instanceColor.needsUpdate = true;
            tuft.castShadow = false;
            tuft.receiveShadow = true;
            tuft.raycast = () => {};
            scene.add(tuft);
        }
    }
}
