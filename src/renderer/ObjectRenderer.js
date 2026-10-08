import * as THREE from 'three';
import { buildObject, hasObjectModel } from './ObjectFactory.js';
import { CATALOG_BY_ID, legacyLocalId } from '../data/objectCatalog.js';
import { objectsBase } from '../config.js';

const hash = (x, y) => {
    const n = Math.sin(x * 91.7 + y * 47.3) * 43758.5453;
    return n - Math.floor(n);
};

// Catalogue id of a map object (server name, or offline prototype type + variant).
export function objectId(o) {
    if (o.model && CATALOG_BY_ID[o.model]) return o.model;
    if (CATALOG_BY_ID[o.type]) return o.type;
    return legacyLocalId(o.type, o.variant);
}

export class ObjectRenderer {
    constructor(modelManager = null) {
        this.modelManager = modelManager;
        this.swaying = [];       // { crown, phase, amp }
        this.time = 0;
    }

    reset() { this.swaying = []; }

    build(scene, o) {
        const id = objectId(o);
        const g = id && hasObjectModel(id) ? this.buildCatalogObject(o, id) : this.buildBasic(o);
        g.position.set(o.x + .5, 0, o.y + .5);
        g.userData.object = o;
        scene.add(g);
        o.renderObject = g;
    }

    // Catalogue object: GLB asset <objectsBase>/<id>.glb when present, otherwise
    // the identical procedural model (ObjectFactory). Same node names in both.
    buildCatalogObject(o, id) {
        const entry = CATALOG_BY_ID[id];
        const holder = new THREE.Group();
        const h = hash(o.x, o.y);
        holder.rotation.y = o.rot ?? (entry.rot === 'random' ? h * Math.PI * 2 : entry.rot === 'quarter' ? Math.floor(h * 4) * Math.PI / 2 : 0);
        const veg = entry.group === 'trees' || entry.group === 'bushes';
        holder.scale.setScalar(o.scale ?? (veg && entry.sway ? .9 + hash(o.y, o.x) * .2 : 1));
        const proc = buildObject(id);
        holder.add(proc);
        const sway = entry.sway ? this.registerSway(proc, o, entry.sway) : null;

        if (this.modelManager) {
            this.modelManager.load(`${objectsBase()}${id}.glb`).then(asset => {
                holder.remove(proc);
                holder.add(asset.scene);
                if (sway) sway.crown = asset.scene.getObjectByName('crown') || asset.scene;
            }).catch(() => {});
        }
        return holder;
    }

    // Semi-transparent copy of a catalogue model (editor preview under the cursor).
    buildGhost(id) {
        const g = buildObject(id);
        if (!g) return null;
        g.traverse(m => {
            if (!m.isMesh) return;
            m.castShadow = false;
            m.raycast = () => {};
            m.material = m.material.clone();
            m.material.transparent = true;
            m.material.opacity = .55;
            m.material.depthWrite = false;
        });
        return g;
    }

    registerSway(model, o, amp) {
        const entry = {
            crown: model.getObjectByName('crown') || model,
            phase: hash(o.x * 3, o.y * 7) * Math.PI * 2,
            amp
        };
        this.swaying.push(entry);
        return entry;
    }

    // Gentle wind on all crowns.
    update(dt) {
        this.time += dt;
        const t = this.time;
        for (const s of this.swaying) {
            const gust = .6 + .4 * Math.sin(t * .35 + s.phase * .2);
            s.crown.rotation.z = Math.sin(t * 1.3 + s.phase) * s.amp * gust;
            s.crown.rotation.x = Math.sin(t * .9 + s.phase * 1.7) * s.amp * .6 * gust;
        }
    }

    buildBasic(o) {
        const g = new THREE.Group();
        const add = (geo, color, x, y, z, basic = false) => {
            const m = new THREE.Mesh(geo, basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color }));
            m.position.set(x, y, z);
            m.castShadow = !basic;
            g.add(m);
            return m;
        };
        if (o.type === 'house') {
            add(new THREE.BoxGeometry(.9, .7, .9), 0x8b5a36, 0, .35, 0);
            add(new THREE.ConeGeometry(.72, .65, 4), 0x5d3827, 0, 1.02, 0).rotation.y = Math.PI / 4;
        } else if (o.type === 'palm') {
            add(new THREE.CylinderGeometry(.09, .13, .95, 8), 0x6b4327, 0, .48, 0);
            for (let i = 0; i < 6; i++) {
                const l = add(new THREE.BoxGeometry(.08, .08, .75), 0x3f6b35, 0, 1, 0);
                l.rotation.y = i * Math.PI / 3;
                l.rotation.x = .18;
            }
        } else if (o.type === 'cactus') {
            add(new THREE.CylinderGeometry(.16, .2, .85, 8), 0x477447, 0, .43, 0);
            add(new THREE.CylinderGeometry(.08, .1, .35, 8), 0x477447, .25, .45, 0).rotation.z = Math.PI / 2;
        } else if (o.type === 'campfire') {
            add(new THREE.ConeGeometry(.25, .65, 8), 0xff9d32, 0, .32, 0, true);
        } else if (o.type === 'stump') {
            add(new THREE.CylinderGeometry(.2, .26, .28, 9), 0x6b4a2e, 0, .14, 0);
            add(new THREE.CylinderGeometry(.19, .19, .02, 9), 0xc8a578, 0, .29, 0);
        } else if (o.type === 'column') {
            add(new THREE.CylinderGeometry(.18, .2, 1.6, 10), 0x9a9890, 0, .8, 0);
            add(new THREE.BoxGeometry(.46, .1, .46), 0x8a8880, 0, .05, 0);
            add(new THREE.BoxGeometry(.46, .1, .46), 0x8a8880, 0, 1.62, 0);
        } else if (o.type === 'wall') {
            // wall-n/e/s/w: a wall along that edge of the tile
            const w = add(new THREE.BoxGeometry(1, 1.2, .18), 0x8f8a80, 0, .6, 0);
            const side = { n: [0, -.41, 0], s: [0, .41, 0], e: [.41, 0, Math.PI / 2], w: [-.41, 0, Math.PI / 2] }[o.side] || [0, 0, 0];
            w.position.x = side[0]; w.position.z = side[1]; w.rotation.y = side[2];
        } else if (o.type === 'chest') {
            add(new THREE.BoxGeometry(.6, .34, .4), 0x7a4e2a, 0, .17, 0);
            add(new THREE.CylinderGeometry(.2, .2, .6, 10, 1, false, 0, Math.PI), 0x6b4224, 0, .34, 0).rotation.set(0, 0, Math.PI / 2);
        } else if (o.type === 'barrel') {
            add(new THREE.CylinderGeometry(.24, .24, .62, 12), 0x7d5530, 0, .31, 0).scale.set(1, 1, 1);
            add(new THREE.TorusGeometry(.245, .015, 4, 16), 0x3a3a3a, 0, .5, 0).rotation.x = Math.PI / 2;
            add(new THREE.TorusGeometry(.245, .015, 4, 16), 0x3a3a3a, 0, .12, 0).rotation.x = Math.PI / 2;
        } else if (o.type === 'boxes') {
            add(new THREE.BoxGeometry(.42, .42, .42), 0x9c7a4c, -.12, .21, .05);
            add(new THREE.BoxGeometry(.32, .32, .32), 0xa8865a, .2, .16, -.12);
            add(new THREE.BoxGeometry(.3, .3, .3), 0x8f6e42, -.08, .57, .02).rotation.y = .4;
        } else if (o.type === 'vase') {
            add(new THREE.SphereGeometry(.17, 10, 8), 0xa2593a, 0, .2, 0).scale.y = 1.2;
            add(new THREE.CylinderGeometry(.07, .1, .14, 10), 0xa2593a, 0, .42, 0);
        } else if (o.type === 'lantern') {
            add(new THREE.CylinderGeometry(.03, .04, 1.1, 6), 0x2b2b2b, 0, .55, 0);
            add(new THREE.BoxGeometry(.16, .2, .16), 0xffd27a, 0, 1.15, 0, true);
        } else if (o.type === 'item') {
            // something lying on the ground (weapon, shield, …): small, offset by slot
            const k = (o.slot || 0) * 1.7;
            const it = add(new THREE.BoxGeometry(.5, .04, .08), 0xb9c0c8, Math.cos(k) * .15, .03, Math.sin(k) * .15);
            it.rotation.y = k;
            it.material.metalness = .7; it.material.roughness = .35;
        } else {
            add(new THREE.DodecahedronGeometry(.35), 0x77706a, 0, .3, 0).scale.y = .7;
        }
        return g;
    }
}
