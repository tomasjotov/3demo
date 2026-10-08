import * as THREE from 'three';

/*
 * Isometric-like perspective camera (narrow FOV, view direction as before).
 *   MMB drag / Q,E — rotate around the controlled character
 *   RMB drag       — pan the whole map (offset from the character)
 *   wheel          — zoom
 *   C              — re-centre on the controlled character
 * Switching the controlled character re-centres smoothly.
 */
export class CameraController {
    constructor(camera, domElement, input) {
        this.camera = camera;
        this.input = input;
        this.dom = domElement;
        this.angle = Math.PI / 4;
        this.distance = 27;
        this.height = 23;
        this.zoom = 1;

        this.pan = new THREE.Vector3();        // user offset on the ground plane
        this.focus = null;                     // smoothed look-at point
        this.lastPlayer = null;

        this.rotating = false;
        this.panning = false;
        this.lastX = 0;
        this.lastY = 0;

        domElement.addEventListener('contextmenu', e => e.preventDefault());

        domElement.addEventListener('pointerdown', e => {
            if (e.button !== 1 && e.button !== 2) return;
            e.preventDefault();
            if (e.button === 1) this.rotating = true;
            else this.panning = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            domElement.setPointerCapture?.(e.pointerId);
        });

        domElement.addEventListener('pointermove', e => {
            const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
            if (!this.rotating && !this.panning) return;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            if (this.rotating) this.angle -= dx * 0.008;
            if (this.panning) this.panBy(dx, dy);
        });

        const end = e => {
            if (e.button === 1) this.rotating = false;
            if (e.button === 2) this.panning = false;
            if (!this.rotating && !this.panning) domElement.releasePointerCapture?.(e.pointerId);
        };
        domElement.addEventListener('pointerup', end);
        domElement.addEventListener('pointercancel', () => { this.rotating = this.panning = false; });
        // Never stay stuck in rotate/pan mode when the button is released outside the window.
        this.onBlur = () => { this.rotating = this.panning = false; };
        addEventListener('blur', this.onBlur);
        domElement.addEventListener('lostpointercapture', () => { this.rotating = this.panning = false; });

        // Not passive: Ctrl+wheel would otherwise zoom the whole browser page.
        domElement.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? .9 : 1.1), .55, 2.3);
        }, { passive: false });
    }

    // Drag the map so that the ground point under the cursor follows it.
    panBy(dx, dy) {
        const unitsPerPx = (16 / this.zoom) / this.dom.clientHeight;
        const right = new THREE.Vector3(Math.sin(this.angle), 0, -Math.cos(this.angle));
        const back = new THREE.Vector3(Math.cos(this.angle), 0, Math.sin(this.angle)); // toward the camera
        const sinElev = this.height / Math.hypot(this.height, this.distance);
        this.pan.addScaledVector(right, -dx * unitsPerPx);
        this.pan.addScaledVector(back, -dy * unitsPerPx / sinElev);
    }

    update(player, delta) {
        if (this.input.down('q')) this.angle += delta * 1.4;
        if (this.input.down('e')) this.angle -= delta * 1.4;
        if (this.input.consume('c')) this.pan.set(0, 0, 0);
        if (player !== this.lastPlayer) {        // new character → centre on it
            if (this.lastPlayer) this.pan.set(0, 0, 0);
            this.lastPlayer = player;
        }

        const desired = new THREE.Vector3(player.renderX, 0, player.renderY).add(this.pan);
        if (!this.focus) this.focus = desired.clone();
        // Follow tightly while dragging, glide otherwise (character switch, re-centre).
        this.focus.lerp(desired, this.panning ? 1 : 1 - Math.exp(-9 * delta));

        // Same view direction as the former orthographic camera; the distance is chosen so that
        // the visible height at the focus point is 16 / zoom tiles.
        const target = this.focus;
        const aspect = (this.dom.clientWidth || innerWidth) / (this.dom.clientHeight || innerHeight);
        const fov = this.camera.fov ?? 30;
        const dist = (16 / this.zoom) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
        const k = dist / Math.hypot(this.distance, this.height);
        this.camera.position.set(
            target.x + Math.cos(this.angle) * this.distance * k,
            this.height * k,
            target.z + Math.sin(this.angle) * this.distance * k
        );
        this.camera.lookAt(target);
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    dispose() { removeEventListener('blur', this.onBlur); }
}
