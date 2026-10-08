import { Character } from './Character.js';
import { GameObject } from './GameObject.js';

export class World {
    constructor(map, characters, objects) {
        this.map = map;
        this.characters = characters.map(c => new Character(c));
        this.objects = objects.map(o => new GameObject(o));
        this.active = this.characters.find(c => c.player) || this.characters[0] || null;
    }

    // Replace terrain + objects (server plan reload).
    setMap(map, objects) {
        this.map = map;
        this.objects = objects;
        this._solid = null;
    }

    solidCells() {
        if (!this._solid || this._solidSrc !== this.objects) {
            this._solid = new Set(this.objects.filter(o => o.solid).map(o => o.y * this.map.width + o.x));
            this._solidSrc = this.objects;
        }
        return this._solid;
    }

    // The character currently controlled by the user. Without any character
    // (empty arena) a camera focus at the map centre stands in.
    getPlayer() { return this.active || this.focusPoint(); }
    setActive(c) {
        for (const ch of this.characters) ch.player = ch === c;
        this.active = c || null;
    }

    focusPoint() {
        const x = Math.floor(this.map.width / 2), y = Math.floor(this.map.height / 2);
        if (!this._focus || this._focus.x !== x || this._focus.y !== y) {
            this._focus = {
                id: '__focus', name: '—', x, y, renderX: x + .5, renderY: y + .5, state: '', move: 0, isMulti: false,
                getCells: () => [], cellsAt: () => [], isBusy: () => true
            };
        }
        return this._focus;
    }

    isInside(x, y) {
        return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
    }

    getObjectAt(x, y) {
        return this.objects.find(o => o.x === x && o.y === y);
    }

    // Riders are not on the grid; the horse carries them.
    getCharacterAt(x, y) {
        return this.characters.find(c => !c.mountedOn && c.occupies(x, y));
    }

    isBlocked(x, y, ignoreCharacter = null) {
        if (!this.isInside(x, y)) return true;
        if (this.map.walkable && !this.map.walkable[y * this.map.width + x]) return true;
        if (this.solidCells().has(y * this.map.width + x)) return true;
        const c = this.getCharacterAt(x, y);
        return !!c && c !== ignoreCharacter;
    }

    // All cells of a footprint are inside the map and free (own cells allowed).
    canPlace(cells, self) {
        return cells.every(p => !this.isBlocked(p.x, p.y, self));
    }
}
