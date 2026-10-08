import * as THREE from 'three';
import { G, TAU, mat, metalMat, clothMat, patternMat } from './kit.js';

/*
 * Avatar layers — 1:1 with the layers of the 2D sprite (hof PersonWear.processImage).
 * The key is exactly the 2D layer name (file /opt/hof/chars/<base>/<key>/<anim>.png),
 * the server sends the list in PlanActor.layers in the 2D drawing order:
 *
 *   feet01                      shoes
 *   pants01 | bottom-scale | bottom-chainmail | bottom-plate                legs
 *   top01 | body-padded | body-leather | body-scale | body-chainmail | body-plate |
 *           body-ballistic-tshirt | body-ballistic-vest                       body
 *   quiver, gauntlets01, hairNN, helmet-light|medium|heavy|full|ballistic, crown01, amulet01
 *   weapon-<sword|longsword|broadsword|axe|battleaxe|broadaxe|pickaxe|dagger|whip|mace|staff|spear|
 *           knife|bow|bow-short|crossbow|musket|pistol|old-pistol|revolver|rifle|shotgun|machine-gun|auto-gun|uzi>
 *   weapon-<shield|shield-iron-small|shield-iron-medium|shield-iron-large|axe-off|dagger-off>   left hand
 *   beardNN
 *
 * 3D-only extras (local prototype presets, not sent by the server):
 *   belt01, cloak01, tabard, robe, hood, mask, hat, pack, pouch, bandolier, weapon-sabre, weapon-club
 *
 * Two-handed grip: look.twoHanded (server PlanActor.twoHanded) – the left hand holds the weapon (GRIP2).
 *
 * Every layer only adds meshes to the joints of the shared rig (ProceduralAvatar),
 * so all layers move with the same animation – like the aligned 2D sprite sheets.
 * Shells are a little larger than what lies under them (skin < cloth < armour).
 *
 * build(ctx): ctx = { J, body, look, has(key), tint(key, default), add(parent, geo, mat, x, y, z),
 *                     group(parent, x, y, z), hairColor, layerKey }
 */

// ------------------------------------------------------------------ helpers
const BROWN = 0x6b4527, DARK = 0x2b1d14, STEEL = 0xc4cad1, IRON = 0x8e9399, GOLD = 0xd8b25a;

// Torso shell (spine) – follows female / belly shape of the body.
function torso(ctx, m, pad, { shoulders = true, len = .44, y = .22 } = {}) {
    const { J, body, add } = ctx, d = ctx.dims;
    add(J.spine, G.cyl(d.chestR + pad, d.waistR + pad, len, 14), m, 0, y, 0).scale.z = .76;
    if (shoulders) add(J.spine, G.sph(d.chestR + pad, 14, 8), m, 0, .42, 0).scale.set(1, .5, .76);
    if (body.female) for (const s of [1, -1]) add(J.spine, G.sph(.08 + pad, 10, 8), m, .085 * s, .3, .11 + pad * .5).scale.set(1, .85, .7);
    if (body.belly) add(J.spine, G.sph(.215 + pad, 12, 8), m, 0, .13, .05).scale.set(1, .9, .88);
}
// Limb shells hug the limb: thinner on a skeleton (bones instead of flesh, avatar/undead.js).
const limbK = ctx => ctx.body.bone ? .62 : 1;
function sleeves(ctx, m, pad, full = true) {
    const { J, add } = ctx, k = limbK(ctx);
    for (const s of ['l', 'r']) {
        add(J[s + 'Sh'], G.sph(.088 * k + pad, 10, 8), m);
        add(J[s + 'Sh'], G.cyl(.072 * k + pad, .06 * k + pad, .25, 10), m, 0, -.125, 0);
        if (full) {
            add(J[s + 'El'], G.sph(.06 * k + pad, 8, 6), m);
            add(J[s + 'El'], G.cyl(.058 * k + pad, .05 * k + pad, .23, 10), m, 0, -.115, 0);
        }
    }
}
function pelvis(ctx, m, pad) {
    ctx.add(ctx.J.pelvis, G.cyl(.19 + pad, .205 + pad, .2, 12), m, 0, -.02, 0).scale.z = .8;
}
function legs(ctx, m, pad, { thigh = true, shin = true, mShin = m } = {}) {
    const { J, add } = ctx, k = limbK(ctx);
    for (const s of ['l', 'r']) {
        if (thigh) {
            add(J[s + 'Hip'], G.sph(.098 * k + pad, 10, 8), m);
            add(J[s + 'Hip'], G.cyl(.094 * k + pad, .074 * k + pad, .4, 10), m, 0, -.2, 0);
        }
        if (shin) {
            add(J[s + 'Knee'], G.sph(.074 * k + pad, 10, 8), mShin);
            add(J[s + 'Knee'], G.cyl(.07 * k + pad, .057 * k + pad, .36, 10), mShin, 0, -.18, 0);
        }
    }
}
// Skirt hanging from the hips (tunic hem, mail skirt, faulds, robe).
function skirt(ctx, m, top, bottom, len, y = -.07) {
    ctx.add(ctx.J.pelvis, G.cyl(top, bottom, len, 16, true), m, 0, y, 0).scale.z = .82;
}
function pauldrons(ctx, m, r = .125) {
    for (const [s, side] of [['l', 1], ['r', -1]]) {
        ctx.add(ctx.J[s + 'Sh'], G.sph(r, 12, 8, 0, TAU, 0, Math.PI * .5), m, .015 * side, .01, 0).scale.set(1, .85, 1.05);
    }
}
const xRot = (mesh, a = Math.PI / 2) => { mesh.rotation.x = a; return mesh; };

// ------------------------------------------------------------------ clothes & armour
const L = {};

L.feet01 = ctx => {                                   // boots
    const { J, add } = ctx, m = mat(ctx.tint('feet01', DARK)), cuff = mat(ctx.tint('feet01.cuff', BROWN));
    for (const s of ['l', 'r']) {
        add(J[s + 'Knee'], G.cyl(.08, .071, .2, 10), m, 0, -.29, 0);
        xRot(add(J[s + 'Knee'], G.torus(.08, .018, 5, 14), cuff, 0, -.19, 0));
        add(J[s + 'Ankle'], G.box(.14, .09, .26), m, 0, -.05, .05);
        add(J[s + 'Ankle'], G.sph(.07, 8, 6, 0, TAU, 0, Math.PI / 2), m, 0, -.095, .175).scale.set(1, .9, .8);
    }
};

L.pants01 = ctx => {
    const m = mat(ctx.tint('pants01', 0x3a3f4a));
    pelvis(ctx, m, .01);
    legs(ctx, m, .01);
};

L.top01 = ctx => {                                    // tunic / shirt
    const c = ctx.tint('top01', 0x8a6a48);
    const m = mat(c), sl = mat(ctx.tint('top01.sleeve', c));
    torso(ctx, m, .012);
    sleeves(ctx, sl, .01);
    if (!ctx.has('robe')) skirt(ctx, clothMat(c), .205, .262, .24);
    xRot(ctx.add(ctx.J.spine, G.torus(.1, .028, 6, 14), mat(ctx.tint('top01.collar', BROWN)), 0, .47, 0));
};

L['body-padded'] = ctx => {                           // gambeson
    const m = patternMat('padded', ctx.tint('body-padded', 0xcdbb94), [6, 3]);
    torso(ctx, m, .03);
    sleeves(ctx, m, .025);
    skirt(ctx, patternMat('padded', ctx.tint('body-padded', 0xcdbb94), [8, 1], { side: THREE.DoubleSide }), .225, .28, .3, -.1);
    xRot(ctx.add(ctx.J.spine, G.torus(.11, .035, 6, 14), m, 0, .47, 0));
};

L['body-leather'] = ctx => {
    const c = ctx.tint('body-leather', 0x7a4e2a), m = patternMat('leather', c, [6, 2]);
    torso(ctx, m, .025);
    sleeves(ctx, mat(ctx.tint('body-leather.sleeve', 0x5a3a22)), .012);
    pauldrons(ctx, mat(c), .115);
    skirt(ctx, patternMat('leather', c, [10, 1], { side: THREE.DoubleSide }), .22, .27, .26);
    const strap = ctx.add(ctx.J.spine, G.box(.05, .5, .02), mat(DARK), .07, .24, .2);
    strap.rotation.z = .5;
};

L['body-scale'] = ctx => {
    const c = ctx.tint('body-scale', 0xb89a5a), m = patternMat('scale', c, [6, 3], { roughness: .45, metalness: .55 });
    torso(ctx, m, .032);
    sleeves(ctx, mat(0x5a4a3a), .014, false);
    pauldrons(ctx, m, .13);
    skirt(ctx, patternMat('scale', c, [8, 2], { roughness: .45, metalness: .55, side: THREE.DoubleSide }), .23, .3, .36, -.12);
};

L['body-chainmail'] = ctx => {
    const m = patternMat('chain', ctx.tint('body-chainmail', 0xe0e4ea), [7, 3], { roughness: .4, metalness: .7 });
    torso(ctx, m, .022);
    sleeves(ctx, m, .02);
    skirt(ctx, patternMat('chain', ctx.tint('body-chainmail', 0xe0e4ea), [9, 2], { roughness: .4, metalness: .7, side: THREE.DoubleSide }), .22, .285, .34, -.11);
    xRot(ctx.add(ctx.J.spine, G.torus(.105, .035, 6, 14), m, 0, .47, 0));
};

L['body-plate'] = ctx => {
    const { J, add } = ctx, c = ctx.tint('body-plate', STEEL), m = metalMat(c);
    sleeves(ctx, patternMat('chain', 0xe0e4ea, [6, 3], { roughness: .4, metalness: .7 }), .016);
    torso(ctx, m, .045);
    add(J.spine, G.box(.03, .36, .03), m, 0, .25, .2 + (ctx.body.belly ? .07 : 0));          // ridge
    pauldrons(ctx, m, .15);
    for (const s of ['l', 'r']) add(J[s + 'El'], G.cyl(.075, .066, .2, 10), m, 0, -.13, 0);  // vambraces
    xRot(add(J.spine, G.torus(.115, .04, 6, 16), m, 0, .47, 0));                            // gorget
    skirt(ctx, metalMat(c), .225, .265, .12, -.03);                                         // faulds
    skirt(ctx, metalMat(c), .245, .285, .11, -.13);
};

L['body-ballistic-tshirt'] = ctx => {
    const m = mat(ctx.tint('body-ballistic-tshirt', 0x24272a));
    torso(ctx, m, .014);
    sleeves(ctx, m, .012, false);
};

L['body-ballistic-vest'] = ctx => {
    const { J, add } = ctx, m = mat(ctx.tint('body-ballistic-vest', 0x4a5236), { roughness: .9 });
    torso(ctx, m, .045, { shoulders: false, len: .4, y: .24 });
    for (const s of [1, -1]) add(J.spine, G.box(.06, .2, .06), m, .1 * s, .43, 0);        // shoulder straps
    for (const x of [-.11, 0, .11]) add(J.spine, G.box(.08, .1, .04), mat(0x3a4228), x, .14, .225);   // pouches
};

L['bottom-chainmail'] = ctx => {
    const m = patternMat('chain', 0xe0e4ea, [8, 4], { roughness: .4, metalness: .7 });
    pelvis(ctx, m, .022);
    legs(ctx, m, .02);
};

L['bottom-scale'] = ctx => {
    const m = patternMat('scale', ctx.tint('bottom-scale', 0xb89a5a), [8, 4], { roughness: .45, metalness: .55 });
    pelvis(ctx, m, .03);
    legs(ctx, m, .028, { mShin: metalMat(0x9a8a6a) });
};

L['bottom-plate'] = ctx => {
    const m = metalMat(ctx.tint('bottom-plate', STEEL));
    pelvis(ctx, patternMat('chain', 0xe0e4ea, [8, 2], { roughness: .4, metalness: .7 }), .02);
    legs(ctx, m, .034);
    for (const s of ['l', 'r']) ctx.add(ctx.J[s + 'Knee'], G.sph(.1, 10, 8, 0, TAU, 0, Math.PI * .6), m, 0, .02, .03).rotation.x = Math.PI / 2;
};

L.quiver = ctx => {
    const { J, add } = ctx, leather = mat(BROWN);
    const q = ctx.group(J.spine, .12, .3, -.22);
    q.rotation.z = -.35;
    add(q, G.cyl(.065, .055, .52, 10), leather);
    xRot(add(q, G.torus(.066, .012, 5, 12), mat(DARK), 0, .24, 0));
    for (const [x, z, c] of [[-.025, .015, 0xe8e0d0], [.02, -.02, 0xb83a2a], [.0, .03, 0xe8e0d0], [.03, .02, 0x2a5a8a]]) {
        add(q, G.cyl(.006, .006, .16, 4), mat(0x8a6a40), x, .33, z);
        add(q, G.box(.004, .07, .03), mat(c), x, .38, z);
    }
    const strap = add(J.spine, G.torus(.24, .018, 5, 20), leather, 0, .26, 0);
    strap.rotation.set(Math.PI / 2, -.62, 0);
    strap.scale.set(1, .75, 1);
};

L.gauntlets01 = ctx => {
    const m = mat(ctx.tint('gauntlets01', 0x5a3a22));
    for (const s of ['l', 'r']) {
        ctx.add(ctx.J[s + 'El'], G.cyl(.072, .064, .12, 10), m, 0, -.17, 0);
        ctx.add(ctx.J[s + 'Hand'], G.sph(.064, 10, 8), m, 0, -.025, .005).scale.set(.95, 1.1, 1.15);
    }
};

// ------------------------------------------------------------------ head
export const HAIR_COLORS = [0x5b3822, 0x241b18, 0xd8b26a, 0x9a4a24, 0x8f8a84, 0x3a2618, 0xe8e2d4, 0x6e5a48];
const hairNo = key => parseInt((/(\d+)/.exec(key) || [0, 1])[1], 10) || 1;
export function hairColorOf(key) { return HAIR_COLORS[(hairNo(key) - 1) % HAIR_COLORS.length]; }

const HAIR_STYLES = ['short', 'long', 'ponytail', 'crop', 'mohawk', 'bun', 'curly', 'braids'];
function buildHair(ctx, key) {
    const F = ctx.J.face, add = ctx.add, m = mat(ctx.hairColor);
    const style = ctx.look.hairStyle || HAIR_STYLES[(hairNo(key) - 1) % HAIR_STYLES.length];
    const helmet = ctx.helmet;                        // under a helmet only what hangs below it
    const cap = (r = .214) => add(F, G.sph(r, 18, 10, 0, TAU, 0, Math.PI * .5), m, 0, .022, -.005).scale.set(1, 1.04, .97);
    const back = () => add(F, G.sph(.212, 16, 10, Math.PI, Math.PI, Math.PI * .3, Math.PI * .45), m, 0, 0, -.008);
    const temples = () => { for (const s of [1, -1]) add(F, G.box(.05, .12, .08), m, .18 * s, .05, .07); };
    const fringe = () => {
        for (const [x, rz] of [[-.07, .35], [0, -.1], [.075, -.4]]) {
            const lock = add(F, G.sph(.075, 8, 6), m, x, .135, .135);
            lock.scale.set(1, .55, .6);
            lock.rotation.z = rz;
        }
    };
    if (!helmet) {
        if (style === 'crop') cap(.207);
        else if (style === 'mohawk') { const c = add(F, G.box(.05, .1, .36), m, 0, .2, -.02); c.rotation.x = -.15; }
        else if (style === 'curly') {
            for (let i = 0; i < 14; i++) {
                const a = i / 14 * TAU, y = .1 + (i % 3) * .04;
                add(F, G.sph(.07, 8, 6), m, Math.sin(a) * .17, y, Math.cos(a) * .15 - .02);
            }
            cap(.215);
        } else { cap(); if (style === 'short' || style === 'ponytail' || style === 'bun') fringe(); }
        if (style !== 'mohawk') temples();
    }
    if (style === 'short' || style === 'crop' || style === 'curly') { if (!helmet) back(); }
    if (style === 'long' || style === 'braids') {
        add(F, G.sph(.218, 16, 10, Math.PI * .92, Math.PI * 1.16, Math.PI * .25, Math.PI * .55), m, 0, -.02, -.01).scale.set(1.04, 1.25, 1.05);
        if (style === 'long') add(F, G.sph(.19, 12, 8), m, 0, -.2, -.1).scale.set(1, 1.1, .5);
        else for (const s of [1, -1]) add(F, G.cyl(.03, .022, .36, 6), m, .15 * s, -.25, .02);
    }
    if (style === 'ponytail') { const p = add(F, G.cyl(.035, .02, .32, 6), m, 0, -.08, -.25); p.rotation.x = .35; }
    if (style === 'bun') add(F, G.sph(.07, 8, 6), m, 0, .12, -.2);
}

function buildBeard(ctx, key) {
    const F = ctx.J.face, add = ctx.add, m = mat(ctx.hairColor);
    const n = hairNo(key);
    if (ctx.helmet === 'full') return;
    const style = ['full', 'goatee', 'moustache', 'long'][(n - 1) % 4];
    if (style === 'full' || style === 'long') {
        add(F, G.sph(.155, 12, 8, 0, TAU, Math.PI * .5, Math.PI * .5), m, 0, -.06, .07).scale.set(1.12, style === 'long' ? 1.8 : 1.25, .85);
    }
    if (style === 'goatee') add(F, G.cone(.05, .14, 6), m, 0, -.17, .15).rotation.x = Math.PI;
    const mus = add(F, G.box(.13, .03, .035), m, 0, -.06, .19);
    mus.rotation.x = .2;
}

L.helmet = (ctx, kind) => {
    const { J, add } = ctx, F = J.face;
    if (kind === 'light') {                           // leather cap
        const m = mat(ctx.tint('helmet-light', 0x6b4527));
        add(F, G.sph(.226, 18, 10, 0, TAU, 0, Math.PI * .52), m, 0, .06, 0);
        xRot(add(F, G.torus(.224, .018, 6, 22), mat(DARK), 0, .06, 0));
        return;
    }
    if (kind === 'ballistic') {
        const m = mat(ctx.tint('helmet-ballistic', 0x4a5236), { roughness: .85 });
        add(F, G.sph(.238, 18, 10, 0, TAU, 0, Math.PI * .5), m, 0, .065, -.01).scale.set(1, .95, 1.05);
        xRot(add(F, G.torus(.236, .02, 6, 22), m, 0, .06, -.01));
        return;
    }
    const steel = metalMat(ctx.tint(`helmet-${kind}`, STEEL));
    if (kind === 'full') {                            // great helm – hides the face
        add(F, G.cyl(.238, .238, .34, 18), steel, 0, .0, 0);
        add(F, G.sph(.238, 18, 8, 0, TAU, 0, Math.PI * .5), steel, 0, .17, 0).scale.y = .55;
        add(F, G.box(.3, .022, .03), mat(0x111111), 0, .03, .23);                                 // eye slit
        add(F, G.box(.022, .3, .03), steel, 0, .02, .245);                                        // nose ridge
        for (let i = 0; i < 3; i++) add(F, G.sph(.009, 4, 3), mat(0x111111), .05, -.06 - i * .035, .236);
        return;
    }
    add(F, G.sph(.232, 18, 10, 0, TAU, 0, Math.PI * .5), steel, 0, .075, 0);
    xRot(add(F, G.torus(.23, .022, 6, 22), steel, 0, .075, 0));
    add(F, G.box(.03, .12, .022), steel, 0, .02, .228);                                           // nasal
    if (kind === 'heavy') {
        for (const s of [1, -1]) {
            const cheek = add(F, G.box(.025, .17, .12), steel, .215 * s, -.03, .03);
            cheek.rotation.z = .1 * s;
        }
        add(F, G.cyl(.235, .25, .14, 16, true, Math.PI * .6, Math.PI * .8), steel, 0, -.02, 0);  // neck guard
        add(F, G.box(.03, .07, .34), steel, 0, .32, -.02);                                         // comb
    }
};

L.crown01 = ctx => {
    const F = ctx.J.face, g = metalMat(ctx.tint('crown01', GOLD)), y = ctx.helmet ? .2 : .17;
    xRot(ctx.add(F, G.cyl(.2, .2, .07, 18, true), g, 0, y, 0), 0);
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        ctx.add(F, G.cone(.03, .08, 5), g, Math.sin(a) * .2, y + .07, Math.cos(a) * .2);
        if (i % 2 === 0) ctx.add(F, G.sph(.018, 6, 4), mat(0xb02040, { roughness: .2 }), Math.sin(a) * .205, y, Math.cos(a) * .205);
    }
};

L.amulet01 = ctx => {
    const { J, add } = ctx, g = metalMat(ctx.tint('amulet01', GOLD));
    const chain = xRot(add(J.spine, G.torus(.13, .009, 4, 20), g, 0, .43, .03));
    chain.rotation.x = Math.PI / 2 - .5;
    add(J.spine, G.sph(.03, 8, 6), mat(0x3a7ac0, { roughness: .2, metalness: .3 }), 0, .34, .2);
};

// ------------------------------------------------------------------ 3D-only extras (presets)
L.belt01 = ctx => {
    const { J, add } = ctx, m = mat(ctx.tint('belt01', BROWN));
    const belt = xRot(add(J.pelvis, G.torus(.2, .03, 6, 20), m, 0, .075, 0));
    belt.scale.set(1, .8, 1);
    add(J.pelvis, G.box(.07, .055, .025), metalMat(ctx.tint('belt01.buckle', GOLD)), 0, .075, .168);
};
L.pouch = ctx => { ctx.add(ctx.J.pelvis, G.box(.09, .11, .06), mat(BROWN), .17, 0, .11).rotation.y = .5; };
L.bandolier = ctx => {
    const { J, add } = ctx, m = mat(ctx.tint('bandolier', 0x3b2a22));
    const strap = add(J.spine, G.torus(.245, .022, 5, 20), m, 0, .23, 0);
    strap.rotation.set(Math.PI / 2, .62, 0);
    strap.scale.set(1, .75, 1);
    add(J.pelvis, G.box(.05, .26, .04), m, -.2, -.1, .04).rotation.z = -.35;
};
L.cloak01 = ctx => {
    const { J, add } = ctx;
    J.cape = ctx.group(J.spine, 0, .43, -.16);
    add(J.cape, G.cape(), clothMat(ctx.tint('cloak01', 0x9b2b2b)));
    for (const s of [1, -1]) add(J.spine, G.sph(.04, 8, 6), metalMat(GOLD), .17 * s, .43, .12);
};
L.tabard = ctx => {
    const { J, add } = ctx, c = ctx.tint('tabard', 0x8c1f25);
    add(J.spine, G.box(.3, .44, .02), mat(c), 0, .2, .2);
    add(J.spine, G.box(.3, .44, .02), mat(c), 0, .2, -.2);
    add(J.pelvis, G.box(.26, .3, .02), clothMat(c), 0, -.18, .2);
    add(J.spine, G.box(.09, .09, .022), metalMat(0xd8c27a), 0, .27, .212).rotation.z = Math.PI / 4;
};
L.robe = ctx => {
    const c = ctx.tint('robe', 0x9a633d);
    skirt(ctx, clothMat(c), .215, .34, .62, -.25);
    xRot(ctx.add(ctx.J.pelvis, G.torus(.335, .02, 5, 20), mat(ctx.tint('robe.trim', 0xe0b468)), 0, -.55, 0));
};
L.hood = ctx => {
    const F = ctx.J.face, c = ctx.tint('hood', 0x5a2e36);
    ctx.add(F, G.sph(.248, 18, 12, Math.PI / 2 + .95, TAU - 1.9, 0, Math.PI * .8), clothMat(c), 0, .02, -.01);
    ctx.add(F, G.cyl(.12, .2, .26, 12), mat(c), 0, -.2, -.1).rotation.x = .5;
};
L.mask = ctx => {
    ctx.add(ctx.J.face, G.cyl(.198, .215, .13, 16, true, -1.35, 2.7), clothMat(ctx.tint('mask', 0x7a3540)), 0, -.075, 0).scale.z = .97;
};
L.hat = ctx => {
    const F = ctx.J.face, c = ctx.tint('hat', 0x6b4a2b);
    ctx.add(F, G.cyl(.36, .37, .025, 22), mat(c), 0, .15, 0);
    ctx.add(F, G.cyl(.165, .2, .17, 16), mat(c), 0, .25, 0);
    ctx.add(F, G.cyl(.203, .203, .04, 16), mat(ctx.tint('hat.band', 0xe0b468)), 0, .19, 0);
};
L.pack = ctx => {
    const { J, add } = ctx;
    add(J.spine, G.box(.34, .4, .2), mat(BROWN), 0, .24, -.27);
    add(J.spine, G.cyl(.075, .075, .42, 10), mat(0x8a7a5a), 0, .49, -.27).rotation.z = Math.PI / 2;
    add(J.spine, G.box(.36, .03, .21), mat(0x3a2718), 0, .3, -.27);
};

// ------------------------------------------------------------------ weapons
// Mount = J.weapon (right hand) / J.lWeapon (left hand); grip at the origin, weapon along +Z.
// style: chop | slash | thrust | bow | gun – picks the attack animation; long: held like a pole.
const W = {};
function blade(ctx, m, { len, width, guard = .21, tip = .1, curve = 0, pommel = true, grip = .15 }) {
    const add = (g, mt, x, y, z) => ctx.add(m, g, mt, x, y, z);
    const steel = metalMat(STEEL), gold = metalMat(GOLD), leather = mat(BROWN);
    xRot(add(G.cyl(.022, .022, grip, 8), leather, 0, 0, grip / 2 - .075));
    if (pommel) add(G.sph(.034, 8, 6), gold, 0, 0, -.09 - (grip - .15));
    add(G.box(guard, .03, .036), gold, 0, 0, .085);
    const b = add(G.box(width, .012, len), steel, 0, 0, .1 + len / 2);
    const t = add(G.tip(width / 2, tip, .25), steel, 0, 0, .1 + len + tip / 2);
    if (curve) { b.rotation.x = -curve; t.position.y += curve * .65; t.rotation.x = -curve * 2.3; }
    add(G.box(.008, .016, len * .8), mat(0x7d8288, { roughness: .4, metalness: .6 }), 0, .004, .1 + len * .45);
}
function haft(ctx, m, len, z0 = 0, r = .024, color = 0x6a4a2c) {
    return xRot(ctx.add(m, G.cyl(r, r, len, 8), mat(color), 0, 0, z0 + len / 2));
}
function axeHead(ctx, m, z, size, double = false) {
    const steel = metalMat(STEEL);
    for (const s of double ? [1, -1] : [1]) {
        const h = ctx.add(m, G.cyl(size, size, .02, 12, false, 0, Math.PI), steel, 0, .06 * s + size * .2 * s, z);
        h.rotation.set(0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    ctx.add(m, G.box(.05, .07, .07), steel, 0, 0, z);
}
const gunMat = () => mat(0x2a2c30, { roughness: .45, metalness: .6 });

W.sword = { style: 'chop', idle: 1.2, ready: .35, reach: .75, build: (c, m) => blade(c, m, { len: .62, width: .056 }) };
W.longsword = { style: 'chop', idle: 1.2, ready: .35, reach: .95, build: (c, m) => blade(c, m, { len: .82, width: .052, grip: .26, guard: .26 }) };
W.broadsword = { style: 'chop', idle: 1.2, ready: .35, reach: .85, build: (c, m) => blade(c, m, { len: .74, width: .085, guard: .28, grip: .2 }) };
W.sabre = { style: 'slash', idle: 1.2, ready: .35, reach: .75, build: (c, m) => blade(c, m, { len: .62, width: .066, curve: .07 }) };
W.dagger = { style: 'thrust', idle: 1.3, ready: 1.2, reach: .5, build: (c, m) => blade(c, m, { len: .28, width: .045, guard: .12 }) };
W.knife = { style: 'thrust', idle: 1.3, ready: 1.2, reach: .45, build: (c, m) => blade(c, m, { len: .2, width: .04, guard: .06, pommel: false }) };
W.axe = { style: 'chop', idle: 1.25, ready: .4, reach: .7, build: (c, m) => { haft(c, m, .62, -.12); axeHead(c, m, .44, .12); } };
W.battleaxe = { style: 'chop', idle: 1.25, ready: .4, reach: .95, build: (c, m) => { haft(c, m, .95, -.25); axeHead(c, m, .64, .16, true); } };
W.broadaxe = { style: 'chop', idle: 1.25, ready: .4, reach: .9, build: (c, m) => { haft(c, m, .9, -.22); axeHead(c, m, .58, .21); } };
W.pickaxe = {
    style: 'chop', idle: 1.25, ready: .4, reach: .75, build: (c, m) => {
        haft(c, m, .7, -.12);
        const p = c.add(m, G.cyl(.018, .006, .44, 6), metalMat(IRON), 0, 0, .52);
        p.rotation.z = Math.PI / 2; p.rotation.x = .15;
    }
};
W.mace = {
    style: 'chop', idle: 1.3, ready: .4, reach: .65, build: (c, m) => {
        haft(c, m, .52, -.08, .022, 0x4a3a2a);
        c.add(m, G.sph(.075, 8, 6), metalMat(IRON), 0, 0, .46);
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            c.add(m, G.box(.012, .06, .1), metalMat(IRON), Math.cos(a) * .07, Math.sin(a) * .07, .46).rotation.z = a;
        }
    }
};
W.club = {
    style: 'chop', idle: 1.35, ready: .4, reach: .8, build: (c, m) => {
        xRot(c.add(m, G.cyl(.032, .032, .26, 8), mat(BROWN), 0, 0, 0));
        xRot(c.add(m, G.cyl(.1, .045, .62, 9), mat(0x6a4a2c), 0, 0, .44));
        c.add(m, G.sph(.1, 9, 7), mat(0x6a4a2c), 0, 0, .75);
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            c.add(m, G.cyl(0, .022, .07, 5), metalMat(STEEL), Math.cos(a) * .085, Math.sin(a) * .085, .5 + (i % 2) * .16).rotation.set(0, 0, a - Math.PI / 2);
        }
    }
};
W.whip = {
    style: 'slash', idle: 1.4, ready: .5, reach: 1.2, build: (c, m) => {
        xRot(c.add(m, G.cyl(.02, .02, .18, 6), mat(BROWN), 0, 0, 0));
        for (let i = 0; i < 6; i++) c.add(m, G.torus(.07, .012, 4, 10), mat(0x4a3020), 0, -.05, .12 + i * .012).rotation.y = Math.PI / 2;
    }
};
W.staff = { style: 'thrust', long: true, idle: -1.0, ready: 1.4, reach: 1.3, build: (c, m) => { haft(c, m, 1.75, -.6, .026, 0x7a5a34); c.add(m, G.sph(.045, 8, 6), mat(0x7a5a34), 0, 0, 1.16); } };
W.spear = {
    style: 'thrust', long: true, idle: -1.0, ready: 1.4, reach: 1.5, build: (c, m) => {
        haft(c, m, 1.7, -.6);
        xRot(c.add(m, G.cyl(.034, .03, .08, 8), metalMat(STEEL), 0, 0, 1.1));
        c.add(m, G.tip(.06, .26, .3), metalMat(STEEL), 0, 0, 1.27);
        c.add(m, G.sph(.035, 8, 6), metalMat(STEEL), 0, 0, -.6);
    }
};
function bow(len, bend) {
    return {
        style: 'bow', idle: .6, ready: .6, reach: 3, build: (c, m) => {
            // Upright in the fist, the fist closes around the middle of the frame (grip wrap);
            // the string runs tip to tip on the archer's side.
            const g = c.group(m, 0, 0, 0);
            g.rotation.x = -Math.PI / 2;
            c.add(g, G.bow(len, bend), mat(0x7a5530));
            xRot(c.add(g, G.cyl(.024, .024, .13, 6), mat(DARK)));                   // leather grip
            xRot(c.add(g, G.cyl(.003, .003, len * .985, 3), mat(0xe8e0c8), 0, bend, 0));   // string
        }
    };
}
W.bow = bow(1.25, .16);
W['bow-short'] = bow(.95, .13);
W.crossbow = {
    style: 'gun', idle: 1.45, ready: 1.5, reach: 3, build: (c, m) => {
        c.add(m, G.box(.05, .06, .62), mat(0x6a4a2c), 0, .02, .18);                 // stock along the weapon
        // prod across the front of the stock: span sideways (X), tips bent back towards the shooter (-Z)
        const prod = c.group(m, 0, .05, .47);
        prod.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
            new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)));   // Z→X, Y→-Z
        c.add(prod, G.bow(.62, .09), mat(0x4a4a4e));
        const str = c.add(m, G.cyl(.003, .003, .6, 3), mat(0xe8e0c8), 0, .05, .38);
        str.rotation.z = Math.PI / 2;
    }
};
function gun(len, { stock = true, drum = false, wide = .045, wood = 0x6a4a2c } = {}) {
    return {
        style: 'gun', idle: 1.45, ready: 1.5, reach: 4, build: (c, m) => {
            const g = gunMat();
            xRot(c.add(m, G.cyl(.016, .016, len, 8), g, 0, .05, .06 + len / 2));
            c.add(m, G.box(wide, .07, Math.min(.3, len * .45)), stock ? mat(wood) : g, 0, .03, .1);
            if (stock) c.add(m, G.box(.05, .1, .26), mat(wood), 0, -.01, -.16);
            if (drum) c.add(m, G.cyl(.05, .05, .05, 10), g, 0, -.03, .2).rotation.z = Math.PI / 2;
        }
    };
}
W.musket = gun(1.0, { wood: 0x5a3a20 });
W.rifle = gun(.8);
W.shotgun = gun(.7, { wide: .05 });
W['machine-gun'] = gun(.75, { drum: true });
W['auto-gun'] = gun(.6, { stock: true });
function pistol(len, wood) {
    return {
        style: 'gun', idle: 1.45, ready: 1.5, reach: 3, build: (c, m) => {
            const g = gunMat();
            xRot(c.add(m, G.cyl(.014, .014, len, 8), g, 0, .045, .05 + len / 2));
            c.add(m, G.box(.035, .05, .12), g, 0, .04, .05);
            c.add(m, G.box(.03, .11, .045), wood ? mat(wood) : g, 0, -.02, 0).rotation.x = -.25;
        }
    };
}
W.pistol = pistol(.16);
W['old-pistol'] = pistol(.3, 0x5a3a20);
W.revolver = pistol(.2, 0x5a3a20);
W.uzi = { ...pistol(.18), build: (c, m) => { pistol(.18).build(c, m); c.add(m, G.box(.03, .14, .03), gunMat(), 0, -.06, .1); } };

// Left hand (off-hand weapons / shields) – mounted on J.lWeapon or J.shield.
const SHIELDS = {
    shield: { form: 'round', r: .28, face: 0x7a5232, rim: IRON },
    'shield-iron-small': { form: 'round', r: .19, face: 0x6a6e74, rim: IRON },
    'shield-iron-medium': { form: 'round', r: .3, face: 0x7a2a26, rim: STEEL, boss: true },
    'shield-iron-large': { form: 'tower', face: 0x8c1f25, rim: STEEL }
};
function buildShield(ctx, key) {
    const s = SHIELDS[key], m = ctx.J.shield, add = (g, mt, x, y, z) => ctx.add(m, g, mt, x, y, z);
    const face = mat(ctx.tint(key, s.face)), rim = metalMat(s.rim);
    if (s.form === 'tower') {
        add(G.box(.05, .74, .46), face, .03, -.02, 0);
        for (const y of [.35, -.39]) add(G.box(.062, .035, .48), rim, .03, y, 0);
        for (const z of [.225, -.225]) add(G.box(.062, .76, .035), rim, .03, -.02, z);
        add(G.box(.012, .3, .08), metalMat(0xd8c27a), .062, 0, 0);
        add(G.box(.012, .08, .26), metalMat(0xd8c27a), .062, .07, 0);
        return;
    }
    add(G.cyl(s.r, s.r, .04, 22), face, .03, 0, 0).rotation.z = Math.PI / 2;
    add(G.torus(s.r, .022, 6, 26), rim, .03, 0, 0).rotation.y = Math.PI / 2;
    add(G.sph(s.r * .26, 10, 6, 0, TAU, 0, Math.PI / 2), rim, .05, 0, 0).rotation.z = -Math.PI / 2;
    if (key === 'shield' || s.boss) {
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            add(G.sph(.022, 6, 4), rim, .05, Math.sin(a) * s.r * .72, Math.cos(a) * s.r * .72);
        }
        add(G.box(.008, s.r * 1.5, .05), metalMat(GOLD), .052, 0, 0);
        add(G.box(.008, .05, s.r * 1.5), metalMat(GOLD), .052, 0, 0);
    }
}

// ------------------------------------------------------------------ registry
export function weaponSpec(key) {
    const name = key?.startsWith('weapon-') ? key.slice(7) : key;
    return W[name] || null;
}
const OFFHAND = { 'axe-off': 'axe', 'dagger-off': 'dagger', 'sickle-off': 'dagger' };

// What the layers mean for the animation: main weapon spec, shield, off-hand weapon.
export function gearOf(layers = []) {
    let weapon = null, shield = null, offhand = null;
    for (const k of layers) {
        if (!k.startsWith('weapon-')) continue;
        const n = k.slice(7);
        if (SHIELDS[n]) shield = n;
        else if (OFFHAND[n]) offhand = OFFHAND[n];
        else if (W[n] && !weapon) weapon = n;
    }
    // 2H: the server's flag wins; otherwise typical two-handers with a free left hand
    return { weaponKey: weapon, weapon: W[weapon] || W.fist, shield, offhand,
        twoHandedDefault: !!weapon && TWO_HANDED_DEFAULT.has(weapon) && !shield && !offhand };
}
W.fist = { style: 'chop', idle: .3, ready: .2, reach: .5, build: () => {} };

// Two-handed grip (2H): where the LEFT hand holds the weapon, in the weapon mount space (grip of the
// right hand = origin, weapon along +Z). The server decides whether the weapon is held in two hands
// (PlanActor.twoHanded = Item.isTwoHanded(), also after the player switches the grip); TWO_HANDED_DEFAULT
// is only used when the server does not send it (older hof, offline prototype).
const GRIP2 = {
    sword: [0, 0, -.11], longsword: [0, 0, -.13], broadsword: [0, 0, -.13], sabre: [0, 0, -.11],
    axe: [0, 0, -.1], battleaxe: [0, 0, -.19], broadaxe: [0, 0, -.17], pickaxe: [0, 0, -.1],
    mace: [0, 0, -.07], club: [0, 0, -.1], staff: [0, 0, .34], spear: [0, 0, .34],
    crossbow: [0, -.02, .25], musket: [0, .02, .34], rifle: [0, .02, .3], shotgun: [0, .02, .28],
    'machine-gun': [0, 0, .3], 'auto-gun': [0, .02, .26],
    pistol: [0, -.06, .0], 'old-pistol': [0, -.06, .0], revolver: [0, -.06, .0], uzi: [0, -.06, .05]
};
for (const [k, v] of Object.entries(GRIP2)) W[k].grip2 = v;
export const TWO_HANDED_DEFAULT = new Set(['longsword', 'broadsword', 'battleaxe', 'broadaxe', 'club', 'staff', 'spear',
    'bow', 'bow-short', 'crossbow', 'musket', 'rifle', 'shotgun', 'machine-gun', 'auto-gun']);

// Builder of one layer key (null = unknown key → ignored, like a missing 2D file).
export function layerBuilder(key) {
    if (L[key]) return L[key];
    if (key.startsWith('helmet-')) return ctx => L.helmet(ctx, key.slice(7));
    if (key.startsWith('hair')) return ctx => buildHair(ctx, key);
    if (key.startsWith('beard')) return ctx => buildBeard(ctx, key);
    if (key.startsWith('top')) return L.top01;
    if (key.startsWith('pants')) return L.pants01;
    if (key.startsWith('feet')) return L.feet01;
    if (key.startsWith('gauntlets')) return L.gauntlets01;
    if (key.startsWith('crown')) return L.crown01;
    if (key.startsWith('amulet') || key.startsWith('necklace')) return L.amulet01;
    if (key.startsWith('weapon-')) {
        const n = key.slice(7);
        if (SHIELDS[n]) return ctx => buildShield(ctx, n);
        if (OFFHAND[n]) return ctx => W[OFFHAND[n]].build(ctx, ctx.J.lWeapon);
        if (W[n]) return ctx => W[n].build(ctx, ctx.J.weapon);
    }
    return null;
}

// Every layer key known to the 3D client (wardrobe page, docs).
export const LAYER_KEYS = [
    'feet01', 'pants01', 'bottom-scale', 'bottom-chainmail', 'bottom-plate',
    'top01', 'body-padded', 'body-leather', 'body-scale', 'body-chainmail', 'body-plate', 'body-ballistic-tshirt', 'body-ballistic-vest',
    'quiver', 'gauntlets01', 'hair01', 'helmet-light', 'helmet-medium', 'helmet-heavy', 'helmet-full', 'helmet-ballistic',
    'crown01', 'amulet01',
    ...Object.keys(W).filter(k => k !== 'fist').map(k => 'weapon-' + k),
    ...Object.keys(SHIELDS).map(k => 'weapon-' + k), 'weapon-axe-off', 'weapon-dagger-off',
    'beard01',
    'belt01', 'cloak01', 'tabard', 'robe', 'hood', 'mask', 'hat', 'pack', 'pouch', 'bandolier'
];
