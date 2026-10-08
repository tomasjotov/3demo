import * as THREE from 'three';

export class AnimationController {
    constructor(root, animations = []) {
        this.mixer = new THREE.AnimationMixer(root);
        this.actions = new Map();
        this.currentName = null;

        for (const clip of animations) {
            this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
        }
    }

    has(name) {
        return this.actions.has(name.toLowerCase());
    }

    play(name, fade = 0.15) {
        const key = name.toLowerCase();
        const next = this.actions.get(key);
        if (!next || this.currentName === key) return false;

        if (this.currentName) {
            const current = this.actions.get(this.currentName);
            if (current) current.fadeOut(fade);
        }

        next.reset().fadeIn(fade).play();
        this.currentName = key;
        return true;
    }

    update(delta) {
        this.mixer.update(delta);
    }
}
