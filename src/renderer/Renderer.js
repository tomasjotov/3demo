import * as THREE from 'three';
import { TerrainRenderer } from './TerrainRenderer.js';
import { ObjectRenderer } from './ObjectRenderer.js';
import { CharacterRenderer } from './CharacterRenderer.js';
import { CameraController } from './CameraController.js';
import { ModelManager } from './ModelManager.js';
import { MouseController } from '../input/MouseController.js';
import { LightRenderer } from './LightRenderer.js';

// Tile marker size: 90 % of a tile (square, axis-aligned with the tile).
const MARK = .9;
const BORDER = .05;

export class Renderer {
    constructor(world, input, game, opts = {}) {
        this.container = opts.container || document.body;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1c211b);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(...this.viewSize());
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.tabIndex = 0;            // can take keyboard focus
        this.renderer.domElement.style.outline = 'none';
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(30, 1, .5, 250);   // real perspective: the far side of the map gets smaller
        this.modelManager = new ModelManager();
        this.cameraController = new CameraController(this.camera, this.renderer.domElement, input);
        this.terrainRenderer = new TerrainRenderer();
        this.objectRenderer = new ObjectRenderer(this.modelManager);
        this.characterRenderer = new CharacterRenderer(this.modelManager);
        this.hover = null;
        this.game = game;

        this.selectionGroup = new THREE.Group();
        this.pathGroup = new THREE.Group();
        this.scene.add(this.selectionGroup, this.pathGroup);
        this.geoCache = new Map();
        this.matCache = new Map();

        new MouseController(this.camera, this.renderer.domElement, world, {
            onHover: (t, c) => this.setHover(t, c),
            onAvatar: (c, t) => game.clickAvatar(c, t),
            onSelect: (c, tile) => game.selectAt(c, tile),
            onTile: t => game.previewTarget && game.previewTarget.x === t.x && game.previewTarget.y === t.y
                ? game.commitPreview(t.x, t.y)
                : game.previewTile(t.x, t.y)
        });

        this.hemi = new THREE.HemisphereLight(0xe8f0ff, 0x4c5a3b, 2.1);
        this.scene.add(this.hemi);
        const sun = new THREE.DirectionalLight(0xfff1d2, 3);
        sun.castShadow = true;
        sun.shadow.mapSize.set(4096, 4096);
        sun.shadow.bias = -.0005;
        sun.shadow.normalBias = .02;
        this.sun = sun;
        this.scene.add(sun, sun.target);
        this.lightRenderer = new LightRenderer(this.scene, this.hemi, sun);
        this.onResize = () => this.resize();
        addEventListener('resize', this.onResize);
        if (typeof ResizeObserver !== 'undefined' && this.container !== document.body) {
            this.resizeObserver = new ResizeObserver(this.onResize);
            this.resizeObserver.observe(this.container);
        }
    }

    buildWorld(world) {
        this.buildStatic(world);
        for (const c of world.characters) this.characterRenderer.build(this.scene, c);
    }

    // Terrain + objects live in one group so a server plan reload can rebuild them.
    buildStatic(world) {
        if (this.staticGroup) {
            this.scene.remove(this.staticGroup);
            this.staticGroup.traverse(o => { if (o.isMesh || o.isInstancedMesh) o.geometry?.dispose?.(); });
        }
        this.staticGroup = new THREE.Group();
        this.scene.add(this.staticGroup);
        this.objectRenderer.reset?.();
        const W = world.map.width, H = world.map.height;
        this.terrainRenderer.build(this.staticGroup, world.map, world.objects);
        for (const o of world.objects) this.objectRenderer.build(this.staticGroup, o);

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(W, H),
            new THREE.MeshStandardMaterial({ color: 0x3f5a2c, roughness: 1 })
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(W / 2, -.17, H / 2);
        plane.receiveShadow = true;
        this.staticGroup.add(plane);

        // Shadow frustum covers the whole map.
        const r = Math.hypot(W, H) / 2 + 2;
        Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 120 });
        this.sun.shadow.camera.updateProjectionMatrix();
        this.sun.target.position.set(W / 2, 0, H / 2);
        this.sun.position.set(W / 2 - 18, 40, H / 2 + 14);
        this.lightRenderer.setDarkness(world.map.darknessBasis || 0);
        this.lightRenderer.setObjectLights(world.objects);
    }

    setHover(tile) { this.hover = tile; }

    update(world, delta) {
        const p = world.getPlayer();
        this.cameraController.update(p, delta);
        this.objectRenderer.update(delta);
        for (const c of world.characters) this.characterRenderer.update(c, delta);
        // darkness: server plan (GamePlan.darknessBasis) or offline N key; lights placed on the plan (PlanArena.lights)
        this.lightRenderer.setDarkness(world.map.darknessBasis || 0);
        if (this.game.areaLights !== this._areaLights) {
            this._areaLights = this.game.areaLights;
            this.lightRenderer.setAreaLights(this._areaLights || []);
        }
        this.lightRenderer.update(world, p ? { x: p.renderX, z: p.renderY } : null, delta);
        this.drawOverlays(world);
    }

    // Geometries and materials are cached: overlays are rebuilt every frame,
    // but no new GPU resources are allocated.
    geometry(size, shape) {
        const key = `${shape}:${size}`;
        if (!this.geoCache.has(key)) {
            let g;
            const h = size / 2;
            if (shape === 'ring') {
                // square frame
                const outer = new THREE.Shape([[-h, -h], [h, -h], [h, h], [-h, h]].map(p => new THREE.Vector2(...p)));
                const i = h - BORDER;
                outer.holes.push(new THREE.Path([[-i, -i], [-i, i], [i, i], [i, -i]].map(p => new THREE.Vector2(...p))));
                g = new THREE.ShapeGeometry(outer);
            } else g = new THREE.PlaneGeometry(size, size);
            this.geoCache.set(key, g);
        }
        return this.geoCache.get(key);
    }

    material(color, opacity) {
        const key = `${color}:${opacity}`;
        if (!this.matCache.has(key)) {
            this.matCache.set(key, new THREE.MeshBasicMaterial({
                color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false
            }));
        }
        return this.matCache.get(key);
    }

    tileMesh(x, y, color, opacity, size = MARK, shape = 'square', lift = 0) {
        const m = new THREE.Mesh(this.geometry(size, shape), this.material(color, opacity));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x + .5, .045 + lift, y + .5);
        m.raycast = () => {};
        return m;
    }

    // Filled marker + crisp border, so it stays readable on any tile colour.
    marker(group, x, y, color, opacity, size = MARK, border = color, borderOpacity = .95) {
        group.add(this.tileMesh(x, y, color, opacity, size, 'square'));
        group.add(this.tileMesh(x, y, border, borderOpacity, size, 'ring', .002));
    }

    drawOverlays(world) {
        this.selectionGroup.clear();
        this.pathGroup.clear();

        const player = world.getPlayer();
        const reachable = this.game.getReachableTiles();
        const own = new Set(player.getCells().map(c => `${c.x},${c.y}`));

        // Reachable tiles — light green fill with a green border.
        for (const [key] of reachable) {
            if (own.has(key)) continue;
            const [x, y] = key.split(',').map(Number);
            this.marker(this.selectionGroup, x, y, 0xc8ffd8, .22, MARK, 0x2fd67a, .55);
        }

        // Controlled character — blue, every occupied cell.
        for (const cell of player.getCells()) this.marker(this.selectionGroup, cell.x, cell.y, 0x248cff, .55, MARK, 0x7cc0ff);

        // Other characters — red, every occupied cell (horse 2, giant 2 …).
        for (const c of world.characters) {
            if (c === player || c.mountedOn) continue;
            for (const cell of c.getCells()) this.marker(this.selectionGroup, cell.x, cell.y, 0xff3f4f, .5, MARK, 0xff8a94);
        }

        // Solid objects — orange.
        for (const o of world.objects) {
            if (!o.solid || (o.x === player.x && o.y === player.y)) continue;
            this.marker(this.selectionGroup, o.x, o.y, 0xff9f32, .45, MARK, 0xffc27a);
        }

        // Current path preview — yellow (highest priority, drawn slightly higher).
        const path = this.game.previewPath || [];
        path.forEach((p, i) => {
            if (i === 0) return;
            this.pathGroup.add(this.tileMesh(p.x, p.y, 0xffd43b, .7, MARK, 'square', .004));
            this.pathGroup.add(this.tileMesh(p.x, p.y, 0xfff3b0, .95, MARK, 'ring', .006));
        });

        if (this.game.serverOverlays) this.drawServerOverlays(this.game.serverOverlays);

        if (this.hover) {
            this.selectionGroup.add(this.tileMesh(this.hover.x, this.hover.y, 0xfff1a8, .95, .98, 'ring', .009));
        }
        // Destination: whole footprint of the final state (horse = 2 cells).
        if (this.game.previewTarget && path.length) {
            const end = path[path.length - 1];
            for (const cell of player.cellsAt(end.x, end.y, end.dir)) {
                this.selectionGroup.add(this.tileMesh(cell.x, cell.y, 0x7cffb2, .4, MARK, 'square', .007));
                this.selectionGroup.add(this.tileMesh(cell.x, cell.y, 0xffffff, .9, MARK, 'ring', .008));
            }
        }
    }

    // Server overlays: move-range ring, opponent / spell areas, pointed cells.
    drawServerOverlays(o) {
        for (const c of o.ring) this.selectionGroup.add(this.tileMesh(c.x, c.y, 0x2fd67a, .95, MARK, 'ring', .003));
        for (const c of o.extra) this.marker(this.selectionGroup, c.x, c.y, 0xb06cff, .28, MARK, 0xd6b3ff, .7);
        for (const c of o.spell) this.marker(this.selectionGroup, c.x, c.y, 0xff4fd8, .35, MARK, 0xff9be9, .9);
        for (const c of o.pointers) this.selectionGroup.add(this.tileMesh(c.x, c.y, 0xffffff, .95, .98, 'ring', .009));
    }

    render() { this.renderer.render(this.scene, this.camera); }

    viewSize() {
        if (this.container === document.body) return [innerWidth, innerHeight];
        return [Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight)];
    }

    resize() { this.renderer.setSize(...this.viewSize()); }

    dispose() {
        removeEventListener('resize', this.onResize);
        this.resizeObserver?.disconnect();
        this.cameraController.dispose?.();
        this.renderer.domElement.remove();
        this.renderer.dispose();
    }
}
