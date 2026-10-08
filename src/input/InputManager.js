/*
 * Keyboard state. When `scope` (the 3D container) is given, keys are only
 * taken while the mouse is over it or it has focus, and never while typing
 * into a form field — the 3D view shares the page with the HTML Arena.
 */
const FORM = /^(INPUT|TEXTAREA|SELECT)$/;

export class InputManager {
    constructor(scope = null) {
        this.keys = new Set();
        this.pressed = new Set();
        this.scope = scope;
        this.hover = false;

        this.onDown = e => {
            if (!this.accepts(e)) return;
            const key = e.key.toLowerCase();
            if (!e.repeat) this.pressed.add(key);
            this.keys.add(key);
        };
        this.onUp = e => { this.keys.delete(e.key.toLowerCase()); };
        this.onBlur = () => { this.keys.clear(); this.pressed.clear(); };
        window.addEventListener('keydown', this.onDown);
        window.addEventListener('keyup', this.onUp);
        window.addEventListener('blur', this.onBlur);
        if (scope) {
            this.onEnter = () => { this.hover = true; };
            this.onLeave = () => { this.hover = false; this.keys.clear(); };
            scope.addEventListener('pointerenter', this.onEnter);
            scope.addEventListener('pointerleave', this.onLeave);
        }
    }

    accepts(e) {
        const t = e.target;
        if (t && (FORM.test(t.tagName) || t.isContentEditable)) return false;
        if (!this.scope) return true;
        return this.hover || this.scope.contains(document.activeElement);
    }

    down(key) {
        return this.keys.has(key.toLowerCase());
    }

    consume(key) {
        key = key.toLowerCase();
        if (!this.pressed.has(key)) return false;
        this.pressed.delete(key);
        return true;
    }

    movement() {
        let x = 0;
        let y = 0;
        if (this.down('a') || this.down('arrowleft')) x -= 1;
        if (this.down('d') || this.down('arrowright')) x += 1;
        if (this.down('w') || this.down('arrowup')) y -= 1;
        if (this.down('s') || this.down('arrowdown')) y += 1;
        return { x, y };
    }

    dispose() {
        window.removeEventListener('keydown', this.onDown);
        window.removeEventListener('keyup', this.onUp);
        window.removeEventListener('blur', this.onBlur);
        if (this.scope) {
            this.scope.removeEventListener('pointerenter', this.onEnter);
            this.scope.removeEventListener('pointerleave', this.onLeave);
        }
    }
}
