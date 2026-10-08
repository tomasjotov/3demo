import { buildProp } from './LightProps.js';

/*
 * Light sources carried by a character (hof PlanActor.lights, offline: Character.lights):
 *   [{ type: 'TORCH'|'LANTERN'|'MAGIC_ITEM'|'MAGIC'|'DARK', hand: 'R'|'L'|'', power, radius }]
 * Torch and lantern go into the hand that holds the item (a torch in the right hand replaces the
 * weapon model, the 2D sprite shows it as a mace), with no hand into a free left hand, else to the belt (right hip).
 * Spells float as an orb above the shoulder. c.lightProps = [{ light, prop }] is read by LightRenderer.
 */
export function syncCarriedLights(c) {
    const lights = c.lights || [];
    const sig = JSON.stringify(lights.map(l => [l.type, l.hand || '', l.power, l.radius])) + ':' + (c.renderObject?.uuid || '');
    if (sig !== c.lightSig) {
        removeCarriedLights(c);
        c.lightSig = sig;
        if (c.renderObject) c.lightProps = lights.map((l, i) => ({ light: l, prop: attach(c, l, i) })).filter(e => e.prop);
    }
}

export function removeCarriedLights(c) {
    for (const e of c.lightProps || []) {
        e.prop.root.parent?.remove(e.prop.root);
        if (e.prop.hideMount) for (const o of e.prop.hideMount.children) o.visible = true;
    }
    c.lightProps = [];
    c.lightSig = null;
    if (c.avatar?.setCarry) c.avatar.setCarry(null);
}

export function updateCarriedLights(c, dt, t) {
    const av = c.avatar;
    for (const e of c.lightProps || []) {
        e.prop.update(dt, t);
        // the torch is the weapon: keep the weapon layer meshes of that hand hidden (re-dressing re-adds them)
        const m = e.prop.hideMount;
        if (m) for (const o of m.children) if (o !== e.prop.root) o.visible = false;
    }
}

function attach(c, l, i) {
    const av = c.avatar, J = av?.j;
    const prop = buildProp(l.type, l.radius);
    prop.yawSource = c.renderObject;
    const entry = (parent, x, y, z) => { prop.root.position.set(x, y, z); parent.add(prop.root); return prop; };
    const torch = l.type === 'TORCH' || l.type === 'MAGIC_TORCH';
    const lantern = l.type === 'LANTERN';

    // GLB / horse / non-humanoid: generic spots around the body.
    if (!J || !J.lHand) {
        return entry(c.renderObject, torch || lantern ? .35 : -.4, torch || lantern ? 1.1 : 1.9 + i * .25, .25);
    }

    const leftFree = !av.gear?.shield && !av.gear?.offhand;
    const hand = l.hand === 'R' || l.hand === 'L' ? l.hand : (torch || lantern) && leftFree ? 'L' : '';
    if (torch) {
        if (hand === 'R') {
            const p = entry(J.weapon, 0, 0, 0);
            hideIn(c, p, J.weapon);
            return p;
        }
        if (hand === 'L') {
            av.setCarry?.({ left: 'torch' });
            hideIn(c, prop, J.lWeapon);
            prop.root.rotation.x = -.25;                       // stick along the hand's +Z ≈ up when the forearm points forward
            return entry(J.lHand, 0, -.04, 0);
        }
        prop.root.rotation.set(-Math.PI / 2 + .3, 0, .35);        // tucked into the belt on the right hip, burning upwards and outwards
        return entry(J.pelvis, -.26, -.05, -.04);
    }
    if (lantern) {
        if (hand === 'R') { hideIn(c, prop, J.weapon); return entry(J.rHand, 0, -.07, .02); }
        if (hand === 'L') { av.setCarry?.({ left: 'lantern' }); hideIn(c, prop, J.lWeapon); return entry(J.lHand, 0, -.07, .02); }
        return entry(J.pelvis, -.23, -.01, .06);                  // on the belt, right hip (the shield is on the left)
    }
    if (l.type === 'MAGIC_ITEM' && (l.hand === 'R' || l.hand === 'L')) {
        prop.root.scale.setScalar(.55);                            // glowing weapon / item: small orb at the hand
        return entry(l.hand === 'R' ? J.rHand : J.lHand, 0, -.08, .1);
    }
    // light (or darkness) spell on the person: orb above the right shoulder
    return entry(av.root, -.42 + i * .1, 2.0 + i * .2, .1);
}

function hideIn(c, prop, mount) {
    prop.hideMount = mount;
}
