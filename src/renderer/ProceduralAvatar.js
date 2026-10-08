import * as THREE from 'three';
import { DIRECTIONS } from '../utils/constants.js';
import { G, TAU, mat } from '../avatar/kit.js';
import { bodyFor } from '../avatar/bodies.js';
import { layerBuilder, gearOf, hairColorOf } from '../avatar/layers.js';
import { presetLook, PRESET_NAMES, lookSignature } from '../avatar/looks.js';
import { boneMats, bonePelvis, boneLeg, boneTorso, boneArm, boneNeck, boneSkull, jawTarget, undeadFace, fleshRibs, mummyWraps } from '../avatar/undead.js';

/*
 * ProceduralAvatar — runtime low-poly humanoid composed of LAYERS like the 2D sprite
 * (hof PersonWear.processImage: body → shoes → legs → body armour/clothes → … → weapons → beard).
 *
 *   new ProceduralAvatar(look | presetName, { scale })
 *   look = { base: lookBase, variant: lookVariant, layers: [2D layer keys], tint? }   (avatar/looks.js)
 *   avatar.setLook(look)   – re-dress (equipment changed); the rig and the animation stay
 *
 * Rig (character faces +Z, right hand is -X) – shared by every layer, like the frames of the 2D sheets:
 *
 *   root (yaw, tile position)
 *   └─ body (whole-body lean / lying down)
 *      └─ pelvis ─┬─ hip L/R ─ knee ─ ankle (foot)
 *                 └─ spine ─┬─ neck ─ head ─ face (hair, helmet, beard)
 *                           ├─ shoulder L/R ─ elbow ─ hand (weapon mount R, off-hand mount L)
 *                           │                  └─ shield mount (L forearm)
 *                           └─ cape pivot (cloak)
 *
 * The bare body comes from avatar/bodies.js (lookBase/lookVariant), each layer key adds meshes
 * to the joints (avatar/layers.js). Weapon and shield layers also choose the combat poses.
 *
 * Every animation state produces a *pose* (flat object of joint angles).
 * State changes cross-fade from a snapshot of the previous pose, so cyclic
 * motions (walk/run) keep their exact amplitude while transitions stay smooth.
 */

const HIP_Y = 0.92;

// ---------------------------------------------------------------------------
// Pose helpers
// ---------------------------------------------------------------------------
const NEUTRAL = {
    bodyY: 0, bodyZ: 0, bodyRX: 0,
    hipsY: 0, hipsRX: 0, hipsRY: 0, hipsRZ: 0,
    spineX: 0, spineY: 0, spineZ: 0,
    neckX: 0, headX: 0, headY: 0, headZ: 0,
    lShX: 0, lShY: 0, lShZ: .12, lElX: -.18,
    rShX: 0, rShY: 0, rShZ: -.12, rElX: -.18,
    lHipX: 0, lHipZ: .03, lKnX: .05, lAnX: -.05,
    rHipX: 0, rHipZ: -.03, rKnX: .05, rAnX: -.05,
    wpnX: 0, wpnY: 0, shFace: 0
};
const POSE_KEYS = Object.keys(NEUTRAL);

const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

function lerpPose(a, b, w, out = {}) {
    for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * w;
    return out;
}

// keys: [[time, pose], ...] with full poses; eased interpolation between keys.
function sampleKeys(p, keys) {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
        const [t0, a] = keys[i], [t1, b] = keys[i + 1];
        if (p <= t1) return lerpPose(a, b, smooth((p - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
}

// How long the cross-fade INTO a given state lasts.
const BLEND_IN = {
    idle: .25, walk: .18, run: .18, attack: .1, defend: .12,
    kneel: .38, ride: .35, lie: .75, hit: .08, death: .6
};

const _ik = new THREE.Vector3(), _ik2 = new THREE.Vector3(), _ikQ = new THREE.Quaternion();
const _ikE = new THREE.Vector3(), _ikP = new THREE.Vector3(), _ikC = new THREE.Vector3(), _ikR = new THREE.Quaternion();
const IK_POLE = new THREE.Vector3(1, -.7, .05).normalize();     // left elbow: outwards and down (spine space)
const IK_POLE_R = new THREE.Vector3(-1, -.7, .05).normalize();   // right elbow: mirror
const IK_POLE2_L = new THREE.Vector3(.6, -.4, -.7).normalize(), IK_POLE2_R = new THREE.Vector3(-.6, -.4, -.7).normalize();   // fallback: back and out
// Two-handed holds in SPINE space (x = left, y = up from the waist, z = forward; shoulders at y .38, x ±.285):
// where the right hand is, where the weapon points, and the torso twist. Both arms are solved by IK
// (elbows out and down), the weapon is turned to `dir`, the left hand takes the second grip (GRIP2).
const H = (hand, dir, spineY = 0) => ({ hand: new THREE.Vector3(...hand), dir: new THREE.Vector3(...dir).normalize(), spineY });
// Values found by an optimiser on the rig (tools: no arm/weapon through the torso, left hand on the grip,
// close to the intended hand position and weapon direction).
const HOLDS = {
    melee: {                                                  // swords, axes, clubs: hands together in front
        idle: H([-.02, .21, .36], [-.11, -.62, .77]),
        ready: H([0, .32, .38], [0, .55, .84], -.15),
        defend: H([.02, .42, .35], [.8, .49, .34], -.1),
        windup: H([.02, .69, .08], [0, .45, -.89], -.3),
        strike: H([-.01, .29, .39], [-.01, -.42, .91], .2)
    },
    long: {                                                   // spear, staff: bladed stance, rear hand at the hip
        idle: H([-.16, -.01, .18], [.55, .57, .61], -.5),
        ready: H([-.16, .05, .18], [.66, .29, .69], -.6),
        defend: H([-.24, .25, .24], [.96, .25, .15], -.2),
        windup: H([-.19, .06, .1], [.7, .26, .67], -.75),
        strike: H([-.12, .17, .24], [.64, .11, .76], -.45)
    },
    gun: {                                                    // long guns, crossbow: stock at the shoulder
        idle: H([-.11, .17, .21], [.69, -.27, .67], -.5),
        ready: H([-.13, .3, .22], [.59, -.11, .8], -.6),
        defend: H([-.13, .3, .22], [.59, -.11, .8], -.6),
        raise: H([-.03, .55, .15], [.3, -.05, .95], -.62),     // in front of the chest, on the way to the shoulder
        aim: H([-.02, .56, .11], [.2, -.04, .98], -.65),
        recoil: H([-.04, .56, .09], [.28, .03, .96], -.65)
    },
    pistol: {
        idle: H([0, .31, .36], [.1, -.6, .79]),
        raise: H([-.01, .38, .4], [.05, -.2, .98]),
        ready: H([-.01, .42, .41], [0, 0, 1]),
        defend: H([-.01, .42, .41], [0, 0, 1]),
        aim: H([-.01, .42, .41], [0, 0, 1]),
        recoil: H([-.01, .45, .39], [0, .2, .98])
    }
};
const AXE_LIKE = new Set(['axe', 'battleaxe', 'broadaxe', 'pickaxe', 'mace', 'club']);
const _hv = new THREE.Vector3(), _hu = new THREE.Vector3(), _hx = new THREE.Vector3(), _hy = new THREE.Vector3();
const _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion();
function lerpHold(a, b, k, out) {
    out.hand.lerpVectors(a.hand, b.hand, k);
    out.dir.lerpVectors(a.dir, b.dir, k).normalize();
    out.spineY = a.spineY + (b.spineY - a.spineY) * k;
    return out;
}
const newHold = () => ({ hand: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), spineY: 0 });
const SEATED = {
    bodyY: 0, bodyZ: 0, bodyRX: 0, hipsY: 0, hipsRX: 0,
    lHipX: -1.2, lHipZ: .55, lKnX: 1.45, lAnX: -.25,
    rHipX: -1.2, rHipZ: -.55, rKnX: 1.45, rAnX: -.25
};
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const SHIELD_FORWARD = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));

// ---------------------------------------------------------------------------
export class ProceduralAvatar {
    constructor(typeOrLook, opts = {}) {
        const preset = typeof typeOrLook === 'string' ? presetLook(typeOrLook) : null;
        const look = preset || (typeof typeOrLook === 'object' && typeOrLook) || presetLook('hero');
        this.type = preset ? typeOrLook : (look.base || 'male');
        this.body = bodyFor(look.base, look.variant);
        if (look.belly) this.body.belly = true;
        this.root = new THREE.Group();
        this.root.name = `avatar-${this.type}`;
        this.scale = opts.scale || look.scale || this.body.scale || 1;
        this.j = {};
        this.fx = {};
        this.layerObjects = [];

        this.offset = Math.random() * 100;  // desync idle motion between NPCs
        this.time = 0;
        this.phase = 0;
        this.state = null;
        this.stateTime = 0;
        this.blendT = 1;
        this.blendDur = .2;
        this.yaw = null;
        this.capeAngle = .1;
        this.blinkIn = 1 + Math.random() * 3;
        this.blinkT = 0;

        this.buildRig();
        this.buildFx();
        this.setLook(look);
        this.pose = this.basePose();
        this.snapshot = { ...this.pose };
        this.root.scale.setScalar(this.scale);
        this.apply(this.pose);
    }

    // ---------------------------------------------------------------- rig + bare body
    buildRig() {
        const b = this.body, J = this.j, k = b.limb || 1;
        const skin = mat(b.skin), under = b.underwear != null ? mat(b.underwear) : skin;
        const add = (parent, g, m, x = 0, y = 0, z = 0) => {
            const mesh = new THREE.Mesh(g, m);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        };
        const grp = (parent, x = 0, y = 0, z = 0, order) => {
            const g = new THREE.Group();
            g.position.set(x, y, z);
            if (order) g.rotation.order = order;
            parent.add(g);
            return g;
        };
        this.dims = b.female ? { chestR: .228, waistR: .18, shoulderX: .262, hipX: .118 } : { chestR: .25, waistR: .2, shoulderX: .285, hipX: .112 };
        const D = this.dims;
        const M = b.bone ? boneMats(b) : null;           // skeleton: bones instead of the flesh body (avatar/undead.js)

        J.body = grp(this.root);
        J.pelvis = grp(J.body, 0, HIP_Y, 0);

        // pelvis (underwear) -------------------------------------------------
        if (b.bone) {
            bonePelvis(add, J, b, D, M);
        } else {
            add(J.pelvis, G.cyl(.19, b.female ? .215 : .205, .2, 12), under, 0, -.02, 0).scale.z = .8;
        }
        if (b.tail) {
            let seg = J.pelvis, r = .07;
            J.tail = [];
            for (let i = 0; i < 5; i++) {
                seg = grp(seg, 0, i ? -.02 : -.05, i ? -.16 : -.15);
                seg.rotation.x = i ? -.18 : .9;
                add(seg, G.cyl(r * .8, r, .18, 8), skin, 0, 0, -.08).rotation.x = Math.PI / 2;
                r *= .78;
                J.tail.push(seg);
            }
        }

        // legs -----------------------------------------------------------------
        for (const side of [1, -1]) {
            const s = side === 1 ? 'l' : 'r';
            const hip = grp(J.pelvis, D.hipX * side, -.05, 0);
            const knee = grp(hip, 0, -.4, 0);
            const ankle = grp(knee, 0, -.38, 0);
            J[s + 'Hip'] = hip; J[s + 'Knee'] = knee; J[s + 'Ankle'] = ankle;
            if (b.bone) { boneLeg(add, J, s, side, M); continue; }
            add(hip, G.sph(.098 * k, 10, 8), under);
            add(hip, G.cyl(.094 * k, .074 * k, .4, 10), skin, 0, -.2, 0);
            add(knee, G.sph(.074 * k, 10, 8), skin);
            add(knee, G.cyl(.07 * k, .057 * k, .36, 10), skin, 0, -.18, 0);
            add(ankle, G.box(.11, .07, .23), skin, 0, -.055, .05);
        }

        // torso ------------------------------------------------------------------
        J.spine = grp(J.pelvis, 0, .06, 0);
        if (b.bone) {
            boneTorso(add, J, b, D, M);
        } else {
            add(J.spine, G.cyl(D.chestR, D.waistR, .44, 14), skin, 0, .22, 0).scale.z = .74;
            add(J.spine, G.sph(D.chestR, 14, 8), skin, 0, .42, 0).scale.set(1, .48, .74);
            if (b.female) {
                for (const s of [1, -1]) add(J.spine, G.sph(.08, 10, 8), skin, .085 * s, .3, .11).scale.set(1, .85, .7);
                if (b.underwear != null) add(J.spine, G.cyl(D.chestR + .006, D.chestR - .005, .1, 14), under, 0, .3, 0).scale.z = .8;
            }
            if (b.belly) add(J.spine, G.sph(.215, 12, 8), skin, 0, .13, .05).scale.set(1, .9, .88);
            if (b.ribs) fleshRibs(add, J.spine, b, D);
        }

        // arms -------------------------------------------------------------------
        for (const side of [1, -1]) {
            const s = side === 1 ? 'l' : 'r';
            const sh = grp(J.spine, D.shoulderX * side, .38, 0, 'XZY');
            const el = grp(sh, 0, -.26, 0);
            const hand = grp(el, 0, -.25, 0);
            J[s + 'Sh'] = sh; J[s + 'El'] = el; J[s + 'Hand'] = hand;
            if (b.bone) { boneArm(add, J, s, side, M); continue; }
            add(sh, G.sph(.088 * k, 10, 8), skin);
            add(sh, G.cyl(.072 * k, .06 * k, .25, 10), skin, 0, -.125, 0);
            add(el, G.sph(.06 * k, 8, 6), skin);
            add(el, G.cyl(.058 * k, .05 * k, .23, 10), skin, 0, -.115, 0);
            add(hand, G.sph(.058, 10, 8), skin, 0, -.025, .005).scale.set(.95, 1.1, 1.15);
            add(hand, G.sph(.026, 6, 5), skin, -.045 * side, -.005, .04);             // thumb
        }
        J.weapon = grp(J.rHand, 0, -.03, .01);
        J.lWeapon = grp(J.lHand, 0, -.03, .01);
        J.lWeapon.rotation.x = 1.2;
        J.shield = grp(J.lEl, .075, -.14, 0);
        J.shieldRest = J.shield.quaternion.clone();

        // neck & head ----------------------------------------------------------------
        J.neck = grp(J.spine, 0, .46, 0);
        J.head = grp(J.neck, 0, .1, 0);
        const F = grp(J.head, 0, .17, 0);
        J.face = F;
        J.eyes = [];
        if (b.bone) {                                    // skull with empty sockets and a moving jaw, no eyes
            boneNeck(add, J, M);
            boneSkull(add, grp, J, M);
            return;
        }
        add(J.neck, G.cyl(.072, .085, .16, 10), skin, 0, .05, 0);
        add(F, G.sph(.2, 18, 14), skin).scale.set(1, 1.04, .94);
        add(F, G.sph(.13, 12, 8, 0, TAU, Math.PI * .5, Math.PI * .5), skin, 0, -.07, .045).scale.set(1.05, .9, 1);
        if (b.snout) add(F, G.box(.16, .1, .16), skin, 0, -.06, .18);

        if (b.sockets) undeadFace(add, F, b);           // undead: dark sunken sockets instead of eyes
        for (const side of [1, -1]) {
            if (!b.sockets) {
                const eye = grp(F, .074 * side, .02, .158);
                add(eye, G.sph(.042, 10, 8), mat(b.eyeWhite, { roughness: .4 }));
                add(eye, G.sph(.024, 8, 6), mat(b.eye, { roughness: .3 }), 0, 0, .03);
                add(eye, G.sph(.011, 6, 4), mat(0x0d0d0f), 0, 0, .049);
                J.eyes.push(eye);
                const brow = add(F, G.box(.085, .02, .022), mat(b.brow), .076 * side, .084, .18);
                brow.rotation.z = -.14 * side;
            }
            if (b.ears === 'pointy') {
                const ear = add(F, G.cone(.04, .16, 5), skin, .2 * side, .03, -.01);
                ear.rotation.z = -1.25 * side;
            } else {
                add(F, G.sph(.046, 8, 6), skin, .197 * side, 0, -.01).scale.set(.45, 1, .75);
            }
            if (b.horns) {
                const horn = add(F, G.cone(.045, .22, 7), mat(b.horns), .12 * side, .2, .02);
                horn.rotation.z = -.5 * side;
            }
        }
        if (!b.nasal) add(F, G.cyl(.012, .034, .085, 6), skin, 0, -.02, .2).rotation.x = .35;   // nose
        if (!b.sockets) add(F, G.box(.075, .014, .012), mat(0x6a3030), 0, -.092, .178);          // mouth
        if (b.wraps) mummyWraps(add, J, b, D);
    }

    buildFx() {
        const fxMat = color => new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0, depthWrite: false,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        const noRay = m => { m.raycast = () => {}; m.castShadow = false; return m; };
        const grp = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); this.root.add(g); return g; };

        this.fx.arcPivot = grp(-.28, 1.12, .12);
        this.fx.arc = noRay(new THREE.Mesh(new THREE.TorusGeometry(.66, .045, 6, 28, Math.PI * .9), fxMat(0xffd36a)));
        this.fx.arcPivot.add(this.fx.arc);

        this.fx.streak = noRay(new THREE.Mesh(
            new THREE.ConeGeometry(.07, 1.1, 8, 1, true).rotateX(-Math.PI / 2), fxMat(0xffe7a0)));
        this.root.add(this.fx.streak);

        this.fx.guard = noRay(new THREE.Mesh(
            new THREE.SphereGeometry(.72, 18, 12, 0, TAU, 0, Math.PI * .62),
            new THREE.MeshBasicMaterial({ color: 0x72b7ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false })));
        this.fx.guard.position.y = .55;
        this.root.add(this.fx.guard);
    }

    // ---------------------------------------------------------------- layers
    // Dress the rig. Keys the 3D client does not know are skipped (like a missing 2D file).
    setLook(look) {
        const sig = lookSignature(look) + JSON.stringify(look?.tint || {});
        this.look = look;
        if (sig === this.lookSig) return;
        this.lookSig = sig;
        for (const o of this.layerObjects) o.parent?.remove(o);
        this.layerObjects = [];
        this.j.cape = null;

        const layers = look.layers || [];
        const J = this.j, objs = this.layerObjects, tint = look.tint || {};
        const hairKey = layers.find(k => k.startsWith('hair'));
        const helmetKey = layers.find(k => k.startsWith('helmet-'));
        const ctx = {
            J, body: this.body, look, dims: this.dims,
            has: key => layers.includes(key),
            tint: (key, def) => tint[key] ?? def,
            hairColor: tint.hair ?? (hairKey ? hairColorOf(hairKey) : this.body.brow),
            helmet: helmetKey ? helmetKey.slice(7) : null,
            add(parent, g, m, x = 0, y = 0, z = 0) {
                const mesh = new THREE.Mesh(g, m);
                mesh.position.set(x, y, z);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                parent.add(mesh);
                objs.push(mesh);
                return mesh;
            },
            group(parent, x = 0, y = 0, z = 0) {
                const g = new THREE.Group();
                g.position.set(x, y, z);
                parent.add(g);
                objs.push(g);
                return g;
            }
        };
        for (const key of layers) {
            const build = layerBuilder(key);
            if (!build) continue;
            ctx.layerKey = key;
            build(ctx);
        }

        this.gear = gearOf(layers);
        this.weapon = this.gear.weapon;
        // 2H: from the server (PlanActor.twoHanded), otherwise typical two-handers with a free left hand
        this.twoHanded = !!(look.twoHanded ?? this.gear.twoHandedDefault) && !this.gear.shield && !this.gear.offhand && !!this.gear.weaponKey
            && !this.carryLeft;                       // torch / lantern in the left hand (renderer/CarriedLights.js)
        this.grip2 = this.twoHanded ? this.weapon.grip2 || null : null;
        this.pistolGrip = !!this.grip2 && Math.abs(this.grip2[2]) < .1 && this.weapon.style === 'gun';
        this.hold = null; this.holdTarget = null; this._holdKeys = null;
        this._attackKeys = null;
        const style = this.weapon.style;
        if (style === 'slash') this.fx.arcPivot.rotation.set(Math.PI / 2, 0, 0);
        else this.fx.arcPivot.rotation.set(0, Math.PI / 2, 0);
        const reach = Math.min(this.weapon.reach || .75, 2.5);
        this.fx.streak.position.set(-.22, 1.0, .35 + reach * .55);
        this.fx.streak.userData.len = reach;
        if (this.state) this.state = null;           // re-enter the current state with the new gear
    }

    // Left hand carries a light ('torch' | 'lantern' | null, renderer/CarriedLights.js): no 2H grip, arm held forward.
    setCarry(carry) {
        const left = carry?.left || null;
        if (left === (this.carryLeft || null)) return;
        this.carryLeft = left;
        this.lookSig = null;
        this.setLook(this.look);
    }

    // ------------------------------------------------------------ animation
    basePose() {
        const P = { ...NEUTRAL, wpnX: this.weapon.idle };
        // Arms hold the equipment slightly away from the body.
        P.rShX = -.12; P.rElX = -.45;
        if (this.gear.shield) { P.lShZ = .2; P.lShX = -.08; P.lElX = -.35; }
        if (this.twoHanded) this.twoHandPose(P, false);
        return P;
    }

    // Two-handed hold set of the current weapon (HOLDS), null = no 2H grip.
    holdSet() {
        if (!this.grip2) return null;
        if (this.weapon.style === 'gun') return this.pistolGrip ? HOLDS.pistol : HOLDS.gun;
        return this.weapon.long ? HOLDS.long : HOLDS.melee;
    }

    // Two-handed carry / guard: only the torso twist is a pose value, the arms are solved by IK (solveHold).
    twoHandPose(P, ready) {
        const set = this.holdSet();
        if (set) P.spineY = (ready ? set.ready : set.idle).spineY;
        return P;
    }

    // Attacks with both hands: pose keys (legs, torso) + hold keys (hands and weapon).
    attackKeys2H() {
        const R = this.readyPose(), set = this.holdSet();
        const k = (o, h) => ({ ...R, ...o, spineY: h.spineY });
        const legs = { lHipX: -.72, lKnX: .88, lAnX: -.15, rHipX: .42, rKnX: .3, rAnX: -.4, hipsY: -.11 };
        if (this.weapon.style === 'gun') {
            const aim = k({ headY: .25, lHipX: -.25, lKnX: .3, rHipX: .15, rKnX: .2 }, set.aim);
            const recoil = { ...aim, spineX: R.spineX - .07 };
            this._holdKeys = [[0, set.ready], [.16, set.raise], [.32, set.aim], [.5, set.aim], [.58, set.recoil], [.76, set.aim], [.88, set.raise], [1, set.ready]];
            return [[0, R], [.32, aim], [.5, aim], [.58, recoil], [.76, aim], [1, R]];
        }
        const windup = k(this.weapon.long ? { hipsRY: -.05, rHipX: .25, lHipX: -.2, lKnX: .35 } : { spineX: -.1, headX: -.08 }, set.windup);
        const strike = k({ spineX: this.weapon.long ? .22 : .3, hipsRY: .2, ...legs }, set.strike);
        this._holdKeys = [[0, set.ready], [.36, set.windup], [.56, set.strike], [.76, set.strike], [1, set.ready]];
        return [[0, R], [.36, windup], [.56, strike], [.76, strike], [1, R]];
    }

    readyPose() {
        const P = this.basePose();
        Object.assign(P, {
            hipsY: -.04, lHipX: -.2, lKnX: .26, lAnX: -.06, rHipX: .14, rKnX: .2, rAnX: -.3,
            rShX: -.35, rElX: -.75, wpnX: this.weapon.ready, spineX: .05, hipsRY: .12, spineY: -.1
        });
        if (this.twoHanded) this.twoHandPose(P, true);
        return P;
    }

    computePose(state, c) {
        const t = this.time + this.offset;
        const P = this.basePose();

        switch (state) {
            case 'walk':
            case 'run': {
                const run = state === 'run';
                const s = Math.sin(this.phase), co = Math.cos(this.phase);
                const A = run ? .78 : .5;
                const K = run ? 1.45 : .85;
                P.lHipX = -s * A;
                P.rHipX = s * A;
                P.lKnX = .08 + K * smooth(Math.max(0, co));
                P.rKnX = .08 + K * smooth(Math.max(0, -co));
                P.lAnX = -(P.lHipX + P.lKnX) * .55 + .05;
                P.rAnX = -(P.rHipX + P.rKnX) * .55 + .05;
                P.hipsY = -(run ? .07 : .035) * s * s - (run ? .06 : 0);
                P.hipsRY = -s * (run ? .14 : .1);
                P.hipsRZ = co * .035;
                P.spineY = s * (run ? .22 : .16);
                P.spineX = run ? .26 : .04;
                P.headX = run ? -.18 : -.02;
                P.lShX = s * A * .85;
                P.rShX = -s * A * .85 - .1;
                P.lElX = (run ? -1.25 : -.3) - .3 * Math.max(0, -s);
                P.rElX = (run ? -1.25 : -.5) - .3 * Math.max(0, s);
                if (this.gear.shield && !run) P.lShZ = .2;
                // Keep the weapon's angle stable relative to the torso instead of
                // letting it whip around with the arm swing.
                const carry = this.weapon.long ? -1.45 : run ? 1.9 : 1.15;
                P.wpnX = carry - (P.rShX + P.rElX);
                break;
            }
            case 'attack': {
                const p = 1 - c.actionTime / Math.max(c.actionDuration, .001);
                P.headY = 0;
                Object.assign(P, sampleKeys(p, this.attackKeys()));
                break;
            }
            case 'defend': {
                Object.assign(P, this.readyPose());
                const pulse = Math.sin(this.stateTime * TAU * 1.2) * .015;
                Object.assign(P, { hipsY: -.08 + pulse, lHipX: -.35, lKnX: .5, rHipX: .2, rKnX: .35, spineX: .14, headX: .06 });
                if (this.gear.shield) {
                    Object.assign(P, { lShX: -1.15, lShZ: .32, lShY: -1.15, lElX: -1.55, shFace: 1 });
                } else {
                    Object.assign(P, {
                        lShX: -1.25, lShZ: .1, lShY: -1.2, lElX: -1.8,
                        rShX: -1.25, rShZ: -.1, rShY: 1.2, rElX: -1.8, wpnX: .2
                    });
                }
                break;
            }
            case 'ride': {
                // Seated in the saddle: thighs forward and apart, shins down the flanks,
                // hands forward on the reins.
                const b = Math.sin(t * 1.6) * .01;
                Object.assign(P, {
                    hipsY: b, spineX: .08 + b, headX: -.05,
                    lHipX: -1.2, lHipZ: .55, lKnX: 1.45, lAnX: -.25,
                    rHipX: -1.2, rHipZ: -.55, rKnX: 1.45, rAnX: -.25,
                    lShX: -.55, lShZ: .1, lElX: -.95,
                    rShX: -.5, rShZ: -.1, rElX: -.9
                });
                P.wpnX = (this.weapon.long ? -1.45 : 2.0) - (P.rShX + P.rElX);
                break;
            }
            case 'kneel': {
                const b = Math.sin(t * 1.5) * .008;
                Object.assign(P, {
                    hipsY: -.405 + b, spineX: .12 + b, headX: -.08,
                    lHipX: -1.55, lKnX: 1.55, lAnX: 0, lHipZ: .06,
                    rHipX: .14, rKnX: 1.45, rAnX: -.05, rHipZ: -.06,
                    lShX: -.62, lElX: -.75, lShZ: .1,
                    rShX: -.18, rElX: -.3, rShZ: -.15, wpnX: this.weapon.long ? -1.2 : 1.55
                });
                break;
            }
            case 'lie':
            case 'death': {
                const b = Math.sin(t * 1.3) * .012;
                Object.assign(P, {
                    bodyRX: -Math.PI / 2, bodyY: .17, bodyZ: .92,
                    spineX: -.04 + b, headX: -.15, headY: state === 'death' ? .7 : .25,
                    lShZ: .45, rShZ: -.55, lShX: .1, rShX: .05, lElX: -.35, rElX: -.25,
                    lHipZ: .14, rHipZ: -.1, lHipX: -.06, lKnX: .12, rHipX: .1, rKnX: .3,
                    lAnX: .6, rAnX: .6
                });
                P.wpnX = 1.75 - (P.rShX + P.rElX);
                if (state === 'death') Object.assign(P, { lShZ: 1.1, rShZ: -1.2, rElX: -.05 });
                break;
            }
            case 'hit': {
                const k = Math.sin(Math.min(1, this.stateTime / .4) * Math.PI);
                Object.assign(P, {
                    spineX: -.35 * k, headX: -.35 * k, hipsY: -.05 * k,
                    lShZ: .2 + .5 * k, rShZ: -.2 - .5 * k, lHipX: .25 * k, lKnX: .3 * k
                });
                break;
            }
            default: { // idle
                const breath = Math.sin(t * 1.7);
                const sway = Math.sin(t * .55);
                P.spineX = -.015 + breath * .018;
                P.neckX = -breath * .012;
                P.lShZ += breath * .015;
                P.rShZ -= breath * .015;
                P.hipsY = -.012 + breath * .004;
                P.hipsRZ = sway * .025;
                P.spineZ = -sway * .03;
                P.lHipZ -= sway * .025; P.rHipZ -= sway * .025;
                P.lKnX = .05 + Math.max(0, sway) * .06;
                P.rKnX = .05 + Math.max(0, -sway) * .06;
                P.headY = Math.sin(t * .31) * .35 * Math.max(0, Math.sin(t * .13));
                P.headX = Math.sin(t * .47) * .04;
            }
        }
        // Torch raised in front / lantern held out (the left arm swings only a little while walking).
        if (this.carryLeft && (state === 'idle' || state === 'walk' || state === 'run' || state === 'kneel' || state === 'ride' || state === 'attack')) {
            const lantern = this.carryLeft === 'lantern';
            const swing = state === 'walk' || state === 'run' ? Math.sin(this.phase) * (lantern ? .18 : .08) : 0;
            Object.assign(P, lantern
                ? { lShX: -.32 + swing, lShY: 0, lShZ: .2, lElX: -.55 }
                : { lShX: -.55 + swing, lShY: .15, lShZ: .22, lElX: -1.1 });
        }
        // In the saddle every action (attack, defence, hit …) keeps the legs around the horse.
        if (c.mountedOn && state !== 'ride') Object.assign(P, SEATED);

        const set = this.holdSet();
        if (set) {
            const tgt = this.holdTarget || (this.holdTarget = newHold());
            if (state === 'attack') {
                this.attackKeys();
                const p = 1 - c.actionTime / Math.max(c.actionDuration, .001);
                const K = this._holdKeys;
                let i = 0;
                while (i < K.length - 2 && p > K[i + 1][0]) i++;
                const [t0, h0] = K[i], [t1, h1] = K[i + 1];
                lerpHold(h0, h1, smooth(Math.min(1, Math.max(0, (p - t0) / (t1 - t0)))), tgt);
            } else {
                const h = state === 'defend' ? set.defend : set.idle;
                lerpHold(h, h, 0, tgt);
                if (state === 'walk' || state === 'run') tgt.hand.y += Math.sin(this.phase * 2) * .02;
            }
            P.spineY = tgt.spineY + (state === 'walk' || state === 'run' ? P.spineY * .4 : 0);
        }
        return P;
    }

    attackKeys() {
        if (this._attackKeys) return this._attackKeys;
        if (this.grip2) return (this._attackKeys = this.attackKeys2H());
        const R = this.readyPose();
        const k = o => ({ ...R, ...o });
        const style = this.weapon.style;
        let windup, strike;
        if (style === 'bow' || style === 'gun') {
            // Aim, hold, release / recoil. Weapon world angle = rShX + rElX + wpnX (0 = horizontal forward).
            const bow = style === 'bow';
            const aim = k({
                rShX: -1.5, rShZ: bow ? -.05 : .12, rElX: -.05, spineY: bow ? -.5 : -.2, hipsRY: bow ? -.3 : -.1,
                lShX: -1.45, lShZ: bow ? -.55 : -.45, lShY: bow ? .3 : .5, lElX: bow ? -1.7 : -.55,
                lHipX: -.25, lKnX: .3, rHipX: .15, rKnX: .2, headY: bow ? .35 : .15, headX: .05
            });
            aim.wpnX = 0 - (aim.rShX + aim.rElX);              // forward: the bow stands upright, the string towards the archer
            const release = { ...aim, rShX: aim.rShX - .12, spineX: R.spineX - .06, lElX: bow ? -1.0 : aim.lElX - .1 };
            this._attackKeys = [[0, R], [.32, aim], [.5, aim], [.58, release], [.76, aim], [1, R]];
            return this._attackKeys;
        }
        if (style === 'thrust') {
            windup = k({ rShX: .35, rElX: -1.55, spineY: -.4, hipsRY: -.05, hipsY: -.05, rHipX: .25, lHipX: -.2, lKnX: .35 });
            strike = k({
                rShX: -1.4, rElX: -.12, spineY: .42, spineX: .26, hipsY: -.11, hipsRY: .2,
                lHipX: -.78, lKnX: .95, lAnX: -.15, rHipX: .48, rKnX: .25, rAnX: -.4, wpnX: this.weapon.ready + .05
            });
        } else if (style === 'slash') {
            windup = k({ rShX: -2.0, rShZ: -1.15, rElX: -1.1, spineY: -.45, spineZ: .1, wpnX: .2, lShX: -.4, lElX: -.6 });
            strike = k({
                rShX: -1.0, rShZ: .55, rShY: .4, rElX: -.2, spineY: .55, spineX: .2, spineZ: -.08, hipsY: -.1,
                lHipX: -.65, lKnX: .8, rHipX: .4, rKnX: .3, wpnX: .3, lShX: .25, lElX: -.4
            });
        } else { // chop
            windup = k({ rShX: -3.25, rShZ: -.28, rElX: -1.45, spineY: -.4, spineX: -.12, headX: -.08, wpnX: .3, lShX: -.45, lElX: -.6 });
            strike = k({
                rShX: -.55, rShZ: -.12, rElX: -.12, spineY: .35, spineX: .3, hipsY: -.11,
                lHipX: -.72, lKnX: .88, lAnX: -.15, rHipX: .42, rKnX: .3, rAnX: -.4, wpnX: .25, lShX: .2, lElX: -.4
            });
        }
        this._attackKeys = [[0, R], [.36, windup], [.56, strike], [.76, strike], [1, R]];
        return this._attackKeys;
    }

    apply(P) {
        const J = this.j;
        J.body.position.set(0, P.bodyY, P.bodyZ);
        J.body.rotation.x = P.bodyRX;
        J.pelvis.position.y = HIP_Y + P.hipsY;
        J.pelvis.rotation.set(P.hipsRX, P.hipsRY, P.hipsRZ);
        J.spine.rotation.set(P.spineX, P.spineY, P.spineZ);
        J.neck.rotation.x = P.neckX;
        J.head.rotation.set(P.headX, P.headY, P.headZ);
        J.lSh.rotation.set(P.lShX, P.lShY, P.lShZ);
        J.rSh.rotation.set(P.rShX, P.rShY, P.rShZ);
        J.lEl.rotation.x = P.lElX;
        J.rEl.rotation.x = P.rElX;
        J.lHip.rotation.set(P.lHipX, 0, P.lHipZ);
        J.rHip.rotation.set(P.rHipX, 0, P.rHipZ);
        J.lKnee.rotation.x = P.lKnX;
        J.rKnee.rotation.x = P.rKnX;
        J.lAnkle.rotation.x = P.lAnX;
        J.rAnkle.rotation.x = P.rAnX;
        J.weapon.rotation.set(P.wpnX, P.wpnY, 0);          // pitch (X) of the yawed (Y) weapon

        // Shield: blend from "strapped to forearm" to "face forward" in root space.
        if (J.shield) {
            J.shield.quaternion.copy(J.shieldRest);
            if (P.shFace > .001) {
                this.root.updateMatrixWorld(true);
                J.lEl.getWorldQuaternion(_q1);
                this.root.getWorldQuaternion(_q2);
                // parentInRoot = root^-1 * parentWorld ; local = parentInRoot^-1 * forward
                _q1.premultiply(_q2.invert()).invert().multiply(SHIELD_FORWARD);
                J.shield.quaternion.slerp(_q1, P.shFace);
            }
        }
    }

    // Two-bone IK of one arm: hand to `target` (spine space), elbow towards `pole`; weight w blends from the pose.
    solveArm(side, target, pole, w) {
        const J = this.j, sh = J[side + 'Sh'], el = J[side + 'El'];
        const t = _ik.copy(target).sub(sh.position);
        const a = .26, b = .28;                                 // upper arm, forearm + palm
        const d = THREE.MathUtils.clamp(t.length(), .08, a + b - .002);
        const cosE = THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1);
        const elX = -(Math.PI - Math.acos(cosE));               // bend forward (negative X like the poses)
        _ik2.set(0, -a - b * Math.cos(elX), -b * Math.sin(elX)).normalize();   // shoulder → hand in arm space
        t.normalize();
        _ikQ.setFromUnitVectors(_ik2, t);
        // twist around shoulder→hand so the elbow points to the pole (out and down, never into the torso)
        const e = _ikE.set(0, -1, 0).applyQuaternion(_ikQ);
        e.addScaledVector(t, -e.dot(t));
        const pl = _ikP.copy(pole).addScaledVector(t, -pole.dot(t));
        // near-degenerate (arm pointing along the pole, e.g. rifle at the shoulder): blend in elbow back and out
        const weak = Math.max(0, .6 - pl.length()) / .6;
        if (weak > 0) {
            const p2 = side === 'l' ? IK_POLE2_L : IK_POLE2_R;
            pl.addScaledVector(_ikC.copy(p2).addScaledVector(t, -p2.dot(t)), weak * 2);
        }
        if (e.lengthSq() > 1e-6 && pl.lengthSq() > 1e-6) {
            e.normalize(); pl.normalize();
            _ikQ.premultiply(_ikR.setFromAxisAngle(t, Math.atan2(_ikC.crossVectors(e, pl).dot(t), e.dot(pl))));
        }
        sh.quaternion.slerp(_ikQ, w);
        el.rotation.x += (elX - el.rotation.x) * w;
    }

    // Two-handed hold: right hand to hold.hand, weapon along hold.dir, left hand on the second grip.
    solveHold(hold, w) {
        const J = this.j;
        this.solveArm('r', hold.hand, IK_POLE_R, w);
        this.root.updateMatrixWorld(true);
        // weapon orientation in spine space: Z = dir; blades / axe heads face down-forward, guns sit upright
        const z = hold.dir, up = _hu.set(0, 1, 0).addScaledVector(z, -z.y);
        if (up.lengthSq() < 1e-4) up.set(0, 0, -1);
        up.normalize();
        let x, y;
        if (this.weapon.style === 'gun' || this.weapon.long) { y = _hy.copy(up); x = _hx.crossVectors(y, z); }
        else if (AXE_LIKE.has(this.gear.weaponKey)) { y = _hy.copy(up).negate(); x = _hx.crossVectors(y, z); }
        else { x = _hx.copy(up).negate(); y = _hy.crossVectors(z, x); }
        _hq.setFromRotationMatrix(_hm.makeBasis(x, y, z));                       // spine → weapon
        J.spine.getWorldQuaternion(_hq2).multiply(_hq);                          // world
        J.weapon.parent.getWorldQuaternion(_q1).invert();
        _hq2.premultiply(_q1);                                                   // in the hand
        J.weapon.quaternion.slerp(_hq2, w);
        this.root.updateMatrixWorld(true);
        // left hand on the second grip
        const g = this.grip2;
        J.spine.worldToLocal(J.weapon.localToWorld(_hv.set(g[0], g[1], g[2])));
        this.solveArm('l', _hv, IK_POLE, w);
    }

    // `c` is the logical Character (state, direction, speed, action timers).
    update(c, dt) {
        this.time += dt;
        const state = c.state || 'idle';

        if (state !== this.state) {
            this.snapshot = { ...this.pose };
            this.blendT = 0;
            this.blendDur = BLEND_IN[state] ?? .2;
            this.state = state;
            this.stateTime = 0;
        }
        this.stateTime += dt;
        this.blendT += dt;

        if (state === 'walk' || state === 'run') {
            // Cadence follows ground speed so the feet do not slide.
            const stride = (state === 'run' ? 2.5 : 1.9) * this.scale;
            const speed = (c.speed || 3) * (state === 'run' ? (c.runMultiplier || 1) : 1);
            this.phase += dt * (speed / stride) * TAU;
        }

        const target = this.computePose(state, c);
        const w = smooth(this.blendT / this.blendDur);
        this.pose = w >= 1 ? target : lerpPose(this.snapshot, target, w);
        this.apply(this.pose);
        if (this.holdTarget && this.grip2) {
            const want = state === 'lie' || state === 'death' ? 0 : 1;
            this.gripW = (this.gripW ?? want) + (want - (this.gripW ?? want)) * (1 - Math.exp(-10 * dt));
            if (!this.hold) this.hold = { hand: this.holdTarget.hand.clone(), dir: this.holdTarget.dir.clone(), spineY: 0 };
            lerpHold(this.hold, this.holdTarget, 1 - Math.exp(-(state === 'attack' ? 40 : 12) * dt), this.hold);
            if (this.gripW > .01) this.solveHold(this.hold, this.gripW);
        }

        this.updateFacing(c, dt);
        this.updateSecondary(state, c, dt);
    }

    updateFacing(c, dt) {
        if (c.mountedOn) return;            // the saddle orients a rider
        const compass = DIRECTIONS[c.facing ?? c.direction] ?? Math.PI;
        // Compass 0 = north = -Z in world, model faces +Z.
        const target = Math.PI - compass;
        if (this.yaw === null) this.yaw = target;
        let d = target - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-14 * dt));
        this.root.rotation.y = this.yaw;
    }

    updateSecondary(state, c, dt) {
        const J = this.j;
        const t = this.time + this.offset;

        // Cape lags behind body motion.
        if (J.cape) {
            const moving = state === 'run' ? .95 : state === 'walk' ? .38 : 0;
            const lying = state === 'lie' || state === 'death';
            const target = lying ? .02 : .1 + moving + Math.sin(t * (moving ? 9 : 1.4)) * (moving ? .07 : .025);
            this.capeAngle += (target - this.capeAngle) * (1 - Math.exp(-6 * dt));
            J.cape.rotation.x = this.capeAngle;
        }

        // Tail sway (lizardmen, daemons).
        if (J.tail) {
            const amp = state === 'run' ? .35 : state === 'walk' ? .22 : .1;
            J.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(t * (state === 'idle' ? 1.3 : 5) - i * .6) * amp; });
        }

        // Blinking.
        this.blinkIn -= dt;
        if (this.blinkIn <= 0) { this.blinkT = .13; this.blinkIn = 2.2 + Math.random() * 3.5; }
        this.blinkT = Math.max(0, this.blinkT - dt);
        const lid = this.blinkT > 0 ? .12 : 1;
        for (const e of J.eyes) e.scale.y = lid;

        // Skeleton jaw: chatters, bites with the attack, hangs open when hit or dead.
        if (J.jaw) {
            const p = state === 'attack' ? 1 - c.actionTime / Math.max(c.actionDuration, .001) : 0;
            const want = jawTarget(state, t, p);
            J.jaw.rotation.x += (want - J.jaw.rotation.x) * (1 - Math.exp(-18 * dt));
        }

        // Attack trail.
        const fx = this.fx;
        if (state === 'attack') {
            const p = 1 - c.actionTime / Math.max(c.actionDuration, .001);
            const flash = Math.max(0, Math.sin(((p - .38) / .32) * Math.PI));
            if (this.weapon.style === 'thrust' || this.weapon.style === 'bow' || this.weapon.style === 'gun') {
                fx.streak.material.opacity = p > .38 && p < .7 ? flash * .55 : 0;
                fx.streak.scale.set(1, 1, (fx.streak.userData.len / 1.1) * (.5 + flash * .6));
                fx.arc.material.opacity = 0;
            } else {
                fx.arc.material.opacity = p > .38 && p < .7 ? flash * .75 : 0;
                fx.arc.rotation.z = .6 - smooth((p - .3) / .45) * 1.3;
                fx.streak.material.opacity = 0;
            }
        } else {
            fx.arc.material.opacity = 0;
            fx.streak.material.opacity = 0;
        }

        // Defence field.
        if (state === 'defend') {
            const k = Math.min(1, this.stateTime / .15);
            fx.guard.material.opacity = .16 * k;
            fx.guard.scale.setScalar(1 + Math.sin(this.stateTime * TAU * 1.2) * .03);
        } else fx.guard.material.opacity = 0;
    }
}

export const AVATAR_TYPES = PRESET_NAMES;
