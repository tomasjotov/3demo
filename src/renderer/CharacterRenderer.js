import * as THREE from 'three';
import { AnimationController } from './AnimationController.js';
import { ProceduralAvatar } from './ProceduralAvatar.js';
import { ProceduralHorse } from './ProceduralHorse.js';
import { createCreature } from './creatureRigs.js';
import { DIRECTIONS } from '../utils/constants.js';
import { charactersBase } from '../config.js';
import { syncCarriedLights, updateCarriedLights, removeCarriedLights } from './CarriedLights.js';

const ZERO = new THREE.Vector3();
const HORSE_SCALE = .82;          // a ridden server actor keeps its 1×1 footprint – a slightly smaller horse
const IDENTITY = new THREE.Quaternion();
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

export class CharacterRenderer {
    constructor(modelManager) {
        this.modelManager = modelManager;
        this.scene = null;
    }

    build(scene, c) {
        this.scene = scene;
        // Procedural rigged avatar is the fallback until (and unless) a GLB loads.
        const avatar = c.type === 'horse' ? new ProceduralHorse(c.type)
            : c.type === 'creature' ? createCreature(c.creature, { scale: c.modelScale })       // avatar/creatures.js
            : new ProceduralAvatar(c.look || c.type, { scale: c.modelScale });
        const fallback = avatar.root;
        fallback.position.set(c.renderX, 0, c.renderY);
        scene.add(fallback);
        c.avatar = avatar;
        c.renderObject = fallback;
        c.animationController = null;

        // Layered avatars are composed procedurally; a whole-character GLB only when the data asks for it (c.model).
        if (c.look || !c.model) return;
        const path = `${charactersBase()}${c.model}.glb`;
        this.modelManager.load(path).then(asset => {
            const root = asset.scene;
            const parent = fallback.parent || scene;
            root.position.copy(fallback.position);
            root.quaternion.copy(fallback.quaternion);
            parent.add(root);
            parent.remove(fallback);

            c.avatar = null;
            c.renderObject = root;
            c.animationController = new AnimationController(root, asset.animations);
            this.setAnimation(c);
        }).catch(() => {});
    }

    remove(c) {
        removeCarriedLights(c);
        c.horse?.renderObject.parent?.remove(c.horse.renderObject);
        c.horse = null;
        c.renderObject?.parent?.remove(c.renderObject);
        c.renderObject = null;
        c.avatar = null;
    }

    setAnimation(c) {
        const a = c.animationController;
        if (!a) return;
        const known = ['run', 'walk', 'kneel', 'lie', 'attack', 'defend', 'hit', 'death', 'ride'];
        const name = known.includes(c.state) ? c.state : 'idle';
        if (a.has(name)) a.play(name);
        else if (name !== 'idle' && a.has('idle')) a.play('idle');
    }

    // Where a rider sits: the horse's saddle group (procedural) or the GLB root.
    seatOf(horse) {
        return horse.avatar?.seat || horse.renderObject;
    }

    // Server actor in the saddle (c.riding from PlanActor.positionType): a horse is created under it,
    // follows the actor's position and gait; the rider is seated by the mountedOn logic below.
    updateServerMount(c, delta) {
        if (c.riding && !c.horse && c.avatar) {
            const avatar = new ProceduralHorse('horse');
            avatar.root.scale.setScalar(HORSE_SCALE);
            avatar.root.position.set(c.renderX, 0, c.renderY);
            this.scene.add(avatar.root);
            c.horse = { avatar, renderObject: avatar.root, state: 'idle', direction: c.direction, speed: c.speed, runMultiplier: 1 };
            c.mountedOn = c.horse;
        }
        const h = c.horse;
        if (!h) return;
        if (c.riding) {
            c.mountedOn = h;
            Object.assign(h, { state: c.horseGait || 'idle', direction: c.direction, facing: c.renderDirection || c.direction, speed: c.speed });
            h.renderObject.position.set(c.renderX, 0, c.renderY);
            h.avatar.update(h, delta);
        } else {
            c.mountedOn = null;                               // dismount (rider glides down below)
        }
    }

    update(c, delta) {
        c.updateRender(delta);
        const g = c.renderObject;
        if (!g) return;
        if (c.horse || c.riding) this.updateServerMount(c, delta);

        if (c.mountedOn) {
            // Re-parent into the saddle keeping the world transform, then glide in.
            const seat = this.seatOf(c.mountedOn);
            if (g.parent !== seat) {
                seat.attach(g);
                c.mountT = 0;
                c.mountFrom = g.position.clone();
            }
            c.mountT = Math.min(1, (c.mountT ?? 1) + delta / .45);
            const k = smooth(c.mountT);
            g.position.lerpVectors(c.mountFrom || ZERO, ZERO, k);
            g.position.y += Math.sin(k * Math.PI) * .35;          // small hop into the saddle
            g.quaternion.slerp(IDENTITY, 1 - Math.exp(-12 * delta));
        } else {
            const target = new THREE.Vector3(c.renderX, 0, c.renderY);
            if (g.parent && g.parent !== this.scene) {
                // Dismount: back to the scene, keep world transform, glide down.
                this.scene.attach(g);
                c.dismountT = 0;
                c.dismountFrom = g.position.clone();
                if (c.avatar) c.avatar.yaw = new THREE.Euler().setFromQuaternion(g.quaternion, 'YXZ').y;
                g.quaternion.setFromEuler(new THREE.Euler(0, c.avatar?.yaw ?? 0, 0));
            }
            if ((c.dismountT ?? 1) < 1) {
                c.dismountT = Math.min(1, c.dismountT + delta / .4);
                const k = smooth(c.dismountT);
                g.position.lerpVectors(c.dismountFrom, target, k);
                g.position.y += Math.sin(k * Math.PI) * .25;
            } else {
                g.position.copy(target);
            }
        }

        if (c.horse && !c.riding && g.parent !== this.seatOf(c.horse)) {
            c.horse.renderObject.parent?.remove(c.horse.renderObject);
            c.horse = null;
        }

        if (c.avatar) {
            if (c.look && c.avatar.look !== c.look) c.avatar.setLook?.(c.look);
            // Procedural avatar handles pose, smooth facing and secondary motion.
            c.avatar.update(c, delta);
            this.updateLights(c, delta);
            return;
        }

        // GLB model: smooth facing from the logical compass direction.
        if (!c.mountedOn) {
            const yaw = Math.PI - (DIRECTIONS[c.facing] ?? Math.PI);
            let d = yaw - g.rotation.y;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            g.rotation.y += d * (1 - Math.exp(-14 * delta));
        }
        this.setAnimation(c);
        c.animationController.update(delta);
        this.updateLights(c, delta);
    }

    // Torch, lantern, light spell (c.lights, see CarriedLights.js).
    updateLights(c, delta) {
        syncCarriedLights(c);
        updateCarriedLights(c, delta, performance.now() / 1000);
    }
}
