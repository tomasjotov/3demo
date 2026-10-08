import * as THREE from 'three';

/*
 * Left click:
 *   on a character model or on a tile occupied by a character → onAvatar
 *   on a free tile                                             → onTile (path preview / go)
 * Ctrl (or ⌘) + left click: select only — never moves. Picks the character
 *   under the cursor, preferring one that is not already controlled, and falls
 *   back to whoever occupies the clicked tile.
 */
export class MouseController {
    constructor(camera, dom, world, handlers) {
        this.camera = camera;
        this.dom = dom;
        this.world = world;
        this.handlers = handlers;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.point = new THREE.Vector3();
        dom.addEventListener('pointermove', e => this.move(e));
        dom.addEventListener('pointerdown', e => this.down(e));
    }

    setMouse(e) {
        const r = this.dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        // Make sure the ray uses this frame's camera transform.
        this.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(this.mouse, this.camera);
    }

    tileAt() {
        if (!this.raycaster.ray.intersectPlane(this.plane, this.point)) return null;
        const x = Math.floor(this.point.x), y = Math.floor(this.point.z);
        return this.world.isInside(x, y) ? { x, y } : null;
    }

    // Character owning a scene object (walks up the parent chain).
    ownerOf(obj) {
        for (let o = obj; o; o = o.parent) {
            for (const c of this.world.characters) if (c.renderObject === o) return c;
        }
        return null;
    }

    // All characters under the cursor, nearest first (riders map to their horse).
    avatarsAt() {
        const roots = this.world.characters.map(c => c.renderObject).filter(Boolean);
        const hits = this.raycaster.intersectObjects(roots, true);
        const out = [];
        for (const h of hits) {
            let c = this.ownerOf(h.object);
            if (!c) continue;
            if (c.mountedOn) c = c.mountedOn;
            if (!out.includes(c)) out.push(c);
        }
        return out;
    }

    occupantAt(tile) {
        return tile ? this.world.getCharacterAt(tile.x, tile.y) : null;
    }

    move(e) {
        this.setMouse(e);
        this.handlers.onHover?.(this.tileAt(), this.avatarsAt()[0] || null);
    }

    down(e) {
        if (e.button !== 0) return;
        this.setMouse(e);
        const tile = this.tileAt();
        const avatars = this.avatarsAt();
        const active = this.world.getPlayer();

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const c = avatars.find(a => a !== active) || this.occupantAt(tile) || avatars[0] || null;
            this.handlers.onSelect?.(c, tile);
            return;
        }

        const c = avatars[0] || this.occupantAt(tile);
        if (c) { this.handlers.onAvatar?.(c, tile); return; }
        if (tile) this.handlers.onTile?.(tile);
    }
}
