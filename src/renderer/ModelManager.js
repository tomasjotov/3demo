import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.pending = new Map();
    }

    async load(path) {
        if (this.cache.has(path)) return this.clone(this.cache.get(path));
        if (this.pending.has(path)) return this.clone(await this.pending.get(path));

        const promise = new Promise((resolve, reject) => {
            this.loader.load(path, resolve, undefined, reject);
        });
        this.pending.set(path, promise);

        try {
            const gltf = await promise;
            this.cache.set(path, gltf);
            return this.clone(gltf);
        } finally {
            this.pending.delete(path);
        }
    }

    clone(gltf) {
        const root = gltf.scene.clone(true);
        root.traverse(o => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        return { scene: root, animations: gltf.animations || [] };
    }
}
