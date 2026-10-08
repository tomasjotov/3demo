import * as THREE from 'three';
import { G, mat, metalMat } from '../avatar/kit.js';

/*
 * Visible light sources: torch, lantern, magic orb, darkness orb.
 * Each prop has an `anchor` (where the PointLight sits, see LightRenderer) and `update(dt, t)`
 * for the flame flicker. Flames and orbs are unlit (MeshBasic, additive) so they glow in the dark.
 *
 * Light types (hof PlanLight.type): TORCH, LANTERN, MAGIC_ITEM (glowing item), MAGIC (light spell
 * on the person), AREA (light placed on the plan), DARK (negative light).
 */
export const LIGHT_LOOK = {
    TORCH: { color: 0xff8a2e, flicker: .16 },
    LANTERN: { color: 0xffbf6a, flicker: .05 },
    CANDLE: { color: 0xffb554, flicker: .09 },
    MAGIC_TORCH: { color: 0xd6e6ff, flicker: .02 },
    MAGIC_ITEM: { color: 0xcfe0ff, flicker: .02 },
    MAGIC: { color: 0xbfd6ff, flicker: .03 },
    AREA: { color: 0xfff0cc, flicker: .02 },
    DARK: { color: 0x6a5a8a, flicker: 0 }
};
export const lightLook = type => LIGHT_LOOK[type] || LIGHT_LOOK.MAGIC;

const noRay = o => { o.traverse(m => { m.raycast = () => {}; }); return o; };
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
});

// Soft round halo (canvas radial gradient), shared.
let haloTex = null;
function halo() {
    if (!haloTex) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(.25, 'rgba(255,255,255,.45)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        haloTex = new THREE.CanvasTexture(c);
        haloTex.colorSpace = THREE.SRGBColorSpace;
    }
    return haloTex;
}
export function haloSprite(color, size, opacity = .8) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: halo(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.setScalar(size);
    return s;
}

// Flame: two additive cones + halo, kept upright in world space by update().
function flame(color, size = 1) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(G.cone(.055 * size, .2 * size, 7), glowMat(color, .85));
    outer.position.y = .09 * size;
    const inner = new THREE.Mesh(G.cone(.03 * size, .12 * size, 6), glowMat(0xfff2c0, .95));
    inner.position.y = .06 * size;
    const glow = haloSprite(color, .65 * size, .55);
    glow.position.y = .08 * size;
    g.add(outer, inner, glow);
    g.userData.parts = { outer, inner, glow };
    return g;
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
// Keep an object's world orientation upright (only yaw of the avatar root survives).
function keepUpright(o, yawSource) {
    if (!o.parent) return;
    o.parent.getWorldQuaternion(_qp).invert();
    if (yawSource) {
        yawSource.getWorldQuaternion(_q);
        const e = new THREE.Euler().setFromQuaternion(_q, 'YXZ');
        _q.setFromAxisAngle(_up, e.y);
    } else _q.identity();
    o.quaternion.copy(_qp.multiply(_q));
}

function flicker(t, amount, seed) {
    if (!amount) return 1;
    const n = Math.sin(t * 9.1 + seed) * .5 + Math.sin(t * 23.7 + seed * 2.3) * .3 + Math.sin(t * 4.3 + seed * .7) * .2;
    return 1 + n * amount;
}

/* ------------------------------------------------------------------ props */

// Torch: wooden stick along +Z from the grip, burning head at the far end.
export function buildTorch(type = 'TORCH') {
    const look = lightLook(type);
    const root = new THREE.Group();
    const wood = mat(0x5b3a1e), rag = mat(0x3a2a1a, { roughness: 1 });
    const stick = new THREE.Mesh(G.cyl(.022, .018, .5, 7), wood);
    stick.rotation.x = Math.PI / 2;
    stick.position.z = .12;
    stick.castShadow = true;
    const head = new THREE.Mesh(G.cyl(.04, .03, .1, 8), rag);
    head.rotation.x = Math.PI / 2;
    head.position.z = .38;
    head.castShadow = true;
    root.add(stick, head);
    const fl = flame(look.color, 1.25);
    fl.position.z = .43;
    root.add(fl);
    const anchor = new THREE.Object3D();
    fl.add(anchor);
    anchor.position.y = .14;
    return prop(root, anchor, fl, look, { upright: [fl] });
}

// Lantern: hangs from its handle (origin), the body below it; always hangs vertically.
export function buildLantern(type = 'LANTERN') {
    const look = lightLook(type);
    const root = new THREE.Group();
    const hang = new THREE.Group();
    root.add(hang);
    const iron = metalMat(0x2d2a26);
    const handle = new THREE.Mesh(G.torus(.045, .008, 4, 10, Math.PI), iron);
    handle.position.y = -.01;
    const top = new THREE.Mesh(G.cone(.075, .06, 6), iron);
    top.position.y = -.075;
    const glass = new THREE.Mesh(G.cyl(.05, .05, .12, 6), new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: .75 }));
    glass.position.y = -.16;
    const base = new THREE.Mesh(G.cyl(.065, .07, .025, 6), iron);
    base.position.y = -.235;
    for (const m of [handle, top, base]) m.castShadow = true;
    hang.add(handle, top, glass, base);
    for (let i = 0; i < 4; i++) {
        const bar = new THREE.Mesh(G.box(.008, .12, .008), iron);
        const a = i * Math.PI / 2 + Math.PI / 4;
        bar.position.set(Math.cos(a) * .052, -.16, Math.sin(a) * .052);
        hang.add(bar);
    }
    const fl = flame(look.color, .55);
    fl.position.y = -.2;
    hang.add(fl);
    const anchor = new THREE.Object3D();
    anchor.position.y = -.16;
    hang.add(anchor);
    return prop(root, anchor, fl, look, { upright: [hang], glass });
}

// Magic light / darkness: floating orb that bobs and slowly circles.
export function buildOrb(type = 'MAGIC') {
    const look = lightLook(type);
    const dark = type === 'DARK';
    const root = new THREE.Group();
    const bob = new THREE.Group();
    root.add(bob);
    const core = new THREE.Mesh(G.sph(.07, 12, 8), dark
        ? new THREE.MeshBasicMaterial({ color: 0x050308, transparent: true, opacity: .85 })
        : glowMat(0xffffff, .95));
    const shell = new THREE.Mesh(G.sph(.12, 12, 8), dark
        ? new THREE.MeshBasicMaterial({ color: 0x120a1c, transparent: true, opacity: .35, depthWrite: false })
        : glowMat(look.color, .35));
    const glow = dark ? null : haloSprite(look.color, .9, .7);
    bob.add(core, shell);
    if (glow) bob.add(glow);
    const anchor = new THREE.Object3D();
    bob.add(anchor);
    const p = prop(root, anchor, null, look, {});
    const seed = Math.random() * 10;
    p.update = (dt, t) => {
        bob.position.y = Math.sin(t * 1.7 + seed) * .06;
        bob.position.x = Math.cos(t * .6 + seed) * .05;
        bob.position.z = Math.sin(t * .6 + seed) * .05;
        const k = 1 + Math.sin(t * 2.3 + seed) * .08;
        shell.scale.setScalar(k);
        p.intensity = dark ? 1 : 1 + Math.sin(t * 2.3 + seed) * look.flicker;
    };
    return p;
}

// Darkness area: dark translucent dome (negative light has no mesh of its own).
export function buildDarkSphere(radius) {
    const root = new THREE.Group();
    const r = Math.max(.8, radius * .55);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x07040c, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide }));
    root.add(dome);
    const orb = buildOrb('DARK');
    orb.root.position.y = Math.min(2.2, r * .8);
    root.add(orb.root);
    const p = prop(root, orb.anchor, null, lightLook('DARK'), {});
    p.update = (dt, t) => orb.update(dt, t);
    p.dispose = () => dome.geometry.dispose();
    return p;
}

function prop(root, anchor, fl, look, { upright = [], glass = null }) {
    noRay(root);
    const seed = Math.random() * 100;
    const p = {
        root, anchor, look, intensity: 1, yawSource: null,
        update(dt, t) {
            const k = flicker(t, look.flicker, seed);
            p.intensity = k;
            for (const o of upright) keepUpright(o, p.yawSource);
            if (fl) {
                const { outer, inner, glow } = fl.userData.parts;
                const s = .85 + (k - 1) * 2 + Math.sin(t * 17 + seed) * .06;
                outer.scale.set(1, Math.max(.6, s), 1);
                inner.scale.set(1, Math.max(.6, s * .95), 1);
                glow.material.opacity = .45 + (k - 1) * 1.5;
            }
            if (glass) glass.material.opacity = .65 + (k - 1) * 2;
        }
    };
    return p;
}

// Light of a static plan object (lantern / candlestick model drawn by ObjectRenderer): only a halo + the anchor.
export function buildFixtureLight(type, y) {
    const look = lightLook(type);
    const root = new THREE.Group();
    const glow = haloSprite(look.color, type === 'CANDLE' ? .35 : .6, .6);
    glow.position.y = y;
    const anchor = new THREE.Object3D();
    anchor.position.y = y + .05;
    root.add(glow, anchor);
    const p = prop(root, anchor, null, look, {});
    const base = p.update;
    p.update = (dt, t) => { base(dt, t); glow.material.opacity = .45 + (p.intensity - 1) * 1.5; };
    return p;
}

export function buildProp(type, radius = 1) {
    if (type === 'TORCH' || type === 'MAGIC_TORCH') return buildTorch(type);
    if (type === 'LANTERN') return buildLantern(type);
    return buildOrb(type);
}
