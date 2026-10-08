import * as THREE from 'three';
import { buildProp, buildDarkSphere, buildFixtureLight, lightLook } from './LightProps.js';
import { CATALOG_BY_ID } from '../data/objectCatalog.js';

/*
 * Darkness and light sources of the arena (real three.js lights, no light map):
 *   - darkness: hof GamePlan.darknessBasis (0 = day … 10 = pitch dark, GM command DARKNESS) dims the sky
 *     light and the sun (dusk → night → darkness), the background and adds a little fog;
 *   - light sources: torches, lanterns and light spells carried by characters (CarriedLights.js) and lights
 *     placed on the plan (hof PlanArena.lights: light / darkness areas, lit items on the ground) and static objects
 *     that shine by themselves (objectCatalog.js `light`: lantern, candlestick – hof sends them as object: true).
 * A fixed pool of PointLights is always in the scene (changing the number of lights would recompile every
 * material); the nearest sources take them, unused ones are switched off. The first SHADOW_LIGHTS cast shadows.
 * Light strength `power` uses the darknessBasis units: 10 lights up full darkness at the source, falling to 0
 * at `radius` cells (hof ArenaFields.countPersonLight). Negative power = darkness (negative light).
 */
const SHADOW_LIGHTS = 3;     // typical arena: 1–3 light sources
const PLAIN_LIGHTS = 2;      // overflow and darkness (negative light, no shadow)
const BASE_CANDELA = 5;      // PointLight intensity for power 10
const DECAY = 1.2;

const DAY = { hemi: 2.1, sky: 0xe8f0ff, ground: 0x4c5a3b, sun: 3, sunColor: 0xfff1d2, bg: 0x1c211b, fog: 0 };
const DUSK = { hemi: .7, sky: 0xffc9a0, ground: 0x3a3a34, sun: .9, sunColor: 0xff9a5a, bg: 0x17151a, fog: .003 };
const NIGHT = { hemi: .16, sky: 0x6f84b8, ground: 0x15191f, sun: .22, sunColor: 0x9db2ff, bg: 0x07090d, fog: .008 };
const DARK = { hemi: .045, sky: 0x4a5272, ground: 0x08090b, sun: .03, sunColor: 0x8090c0, bg: 0x030405, fog: .014 };

const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3();
const lerp = (a, b, k) => a + (b - a) * k;
function mix(a, b, k) {
    const o = {};
    for (const key in a) {
        o[key] = typeof a[key] === 'number' && key !== 'sky' && key !== 'ground' && key !== 'sunColor' && key !== 'bg'
            ? lerp(a[key], b[key], k)
            : _c1.set(a[key]).lerp(_c2.set(b[key]), k).getHex();
    }
    return o;
}
// darkness 0..10 → ambient settings (day → dusk at 3 → night at 7 → darkness at 10)
function ambientFor(d) {
    d = Math.max(0, Math.min(10, d));
    if (d <= 3) return mix(DAY, DUSK, d / 3);
    if (d <= 7) return mix(DUSK, NIGHT, (d - 3) / 4);
    return mix(NIGHT, DARK, (d - 7) / 3);
}

export class LightRenderer {
    constructor(scene, hemi, sun) {
        this.scene = scene;
        this.hemi = hemi;
        this.sun = sun;
        this.darkness = 0;          // target (darknessBasis)
        this.shown = -1;            // currently shown, eases towards the target
        this.time = 0;
        scene.fog = new THREE.FogExp2(DAY.bg, 0);

        this.pool = [];
        for (let i = 0; i < SHADOW_LIGHTS + PLAIN_LIGHTS; i++) {
            const l = new THREE.PointLight(0xffffff, 0, 10, DECAY);
            const shadow = i < SHADOW_LIGHTS;
            l.castShadow = shadow;
            if (shadow) {
                l.shadow.mapSize.set(512, 512);
                l.shadow.bias = -.004;
                l.shadow.normalBias = .03;
                l.shadow.camera.near = .1;
                l.shadow.autoUpdate = false;
            }
            l.userData = { shadow, key: null };
            scene.add(l);
            this.pool.push(l);
        }

        this.areaGroup = new THREE.Group();
        this.areaGroup.name = 'area-lights';
        scene.add(this.areaGroup);
        this.areaProps = new Map();      // key → { light, prop }
        this.objectProps = [];           // lantern / candlestick objects of the plan
    }

    // Static objects with catalog `light` (rebuilt with the terrain).
    setObjectLights(objects = []) {
        for (const e of this.objectProps) this.areaGroup.remove(e.prop.root);
        this.objectProps = [];
        for (const o of objects) {
            const light = CATALOG_BY_ID[o.type]?.light;
            if (!light) continue;
            const prop = buildFixtureLight(light.type, light.y);
            prop.root.position.set(o.x + .5, 0, o.y + .5);
            this.areaGroup.add(prop.root);
            this.objectProps.push({ key: `obj:${o.x},${o.y}`, light, prop });
        }
    }

    setDarkness(d) { this.darkness = Number.isFinite(d) ? d : 0; }

    // Lights placed on the plan: [{ type, power, radius, x, y }] (hof PlanArena.lights).
    setAreaLights(list = []) {
        const seen = new Set();
        list.filter(l => !l.object).forEach(l => {                 // static objects come from the catalog (setObjectLights)
            const key = `${l.type}:${l.x},${l.y}:${l.power}:${l.radius}`;
            seen.add(key);
            if (this.areaProps.has(key)) return;
            let prop;
            if (l.type === 'DARK') prop = buildDarkSphere(l.radius);
            else {
                prop = buildProp(l.type, l.radius);
                if (l.type === 'TORCH') prop.root.rotation.x = -Math.PI / 2;          // torch stuck upright in the ground
                if (l.type === 'LANTERN') prop.root.position.y = .26;                // lantern standing on the ground
            }
            const y = l.type === 'AREA' ? 2.3 : 0;
            prop.root.position.add(_v.set(l.x + .5, y, l.y + .5));
            this.areaGroup.add(prop.root);
            this.areaProps.set(key, { light: l, prop });
        });
        for (const [key, e] of this.areaProps) {
            if (seen.has(key)) continue;
            this.areaGroup.remove(e.prop.root);
            e.prop.dispose?.();
            this.areaProps.delete(key);
        }
    }

    update(world, camTarget, dt) {
        this.time += dt;
        const t = this.time;

        // ease the ambient towards the darkness level (GM changes it → smooth fade)
        if (this.shown < 0) this.shown = this.darkness;
        this.shown += (this.darkness - this.shown) * (1 - Math.exp(-2.5 * dt));
        const a = ambientFor(this.shown);
        this.hemi.intensity = a.hemi;
        this.hemi.color.setHex(a.sky);
        this.hemi.groundColor.setHex(a.ground);
        this.sun.intensity = a.sun;
        this.sun.color.setHex(a.sunColor);
        this.scene.background?.setHex?.(a.bg);
        this.scene.fog.color.setHex(a.bg);
        this.scene.fog.density = a.fog;
        const night = Math.min(1, this.shown / 6);            // how much point lights matter

        // collect sources
        const src = [];
        for (const c of world.characters) {
            for (const e of c.lightProps || []) src.push({ key: `${c.id}:${e.light.type}:${e.light.hand || ''}`, light: e.light, prop: e.prop });
        }
        for (const [key, e] of this.areaProps) {
            e.prop.update(dt, t);
            src.push({ key, light: e.light, prop: e.prop });
        }
        for (const e of this.objectProps) {
            e.prop.update(dt, t);
            src.push(e);
        }
        for (const s of src) {
            s.prop.anchor.getWorldPosition(s.pos = new THREE.Vector3());
            s.dist = camTarget ? Math.hypot(s.pos.x - camTarget.x, s.pos.z - camTarget.z) : 0;
        }
        src.sort((p, q) => p.dist - q.dist);

        // assign: lit sources to the shadow lights first (keep the same light for the same source), the rest plain
        const lit = src.filter(s => s.light.power > 0), dark = src.filter(s => s.light.power < 0);
        const shadowPool = this.pool.filter(l => l.userData.shadow), plainPool = this.pool.filter(l => !l.userData.shadow);
        const want = new Map();
        lit.slice(0, shadowPool.length).forEach(s => want.set(s.key, s));
        const rest = [...lit.slice(shadowPool.length), ...dark];
        const free = shadowPool.filter(l => !want.has(l.userData.key));
        for (const l of shadowPool) {
            const s = want.get(l.userData.key);
            if (s) { this.drive(l, s, night, t); want.delete(s.key); }
        }
        for (const s of want.values()) { const l = free.shift(); if (l) { l.userData.key = s.key; this.drive(l, s, night, t); } }
        for (const l of free) this.off(l);
        plainPool.forEach((l, i) => rest[i] ? (l.userData.key = rest[i].key, this.drive(l, rest[i], night, t)) : this.off(l));
    }

    drive(l, s, night, t) {
        const { power, radius } = s.light;
        const look = lightLook(s.light.type);
        l.color.setHex(look.color);
        l.position.copy(s.pos);
        l.distance = Math.max(1.5, radius * 1.15 + 1);
        const k = s.prop.intensity ?? 1;
        // in daylight a torch hardly adds anything; keep a little so it still tints the bearer
        const strength = BASE_CANDELA * Math.abs(power) / 10 * (.25 + .75 * night) * k;
        l.intensity = power < 0 ? -strength * 1.4 : strength;
        if (l.userData.shadow) {
            l.shadow.camera.far = l.distance;
            l.shadow.autoUpdate = power > 0 && night > .3;
            if (!l.shadow.autoUpdate) l.shadow.needsUpdate = false;
        }
    }

    off(l) {
        l.intensity = 0;
        l.userData.key = null;
        if (l.userData.shadow) l.shadow.autoUpdate = false;
    }
}
