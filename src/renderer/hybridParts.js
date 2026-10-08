import * as THREE from 'three';
import { G, mat } from '../avatar/kit.js';

/*
 * hybridParts — the human upper body of hybrid creatures (centaur on the horse rig, urxuquer on the spider rig).
 *
 *   humanTorso(parent, opts) → { T, neck, head, jaw, arms: [{ sh, el, hand, s }], spear }
 *   T is the waist pivot (torso up = +y, face = +z); right hand is -x like the avatar.
 *   poseTorsoArms(H, mode, k, t) — arms for 'idle' | 'walk' | 'attack' (k = strike 0..1) | 'defend' | 'hit' | 'dead'.
 */
export function humanTorso(parent, { skin = 0xc8946a, hair = 0x1a120c, eye = 0x3a2a1a, glowEye = false, gaunt = false, crown = null,
    plates = null, spear = false, claws = false, ears = 'round', scale = 1 } = {}) {
    const add = (p, geo, m, x = 0, y = 0, z = 0) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        p.add(mesh);
        return mesh;
    };
    const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const S = mat(skin, { roughness: .65 }), Hm = mat(hair, { roughness: .9 }), dark = mat(0x140c0a, { roughness: .8 });
    const P = plates ? mat(plates, { roughness: .35, metalness: .2 }) : null;
    const T = grp(parent);
    T.scale.setScalar(scale);
    const w = gaunt ? .85 : 1;
    add(T, G.sph(.14, 12, 9), S, 0, .03, 0).scale.set(1.05 * w, .7, .8);                            // waist
    add(T, G.sph(.14, 12, 9), S, 0, .17, .01).scale.set(.95 * w, 1.1, .75);                          // abdomen
    add(T, G.sph(.17, 14, 10), S, 0, .37, 0).scale.set(1.15 * w, .95, .72);                          // chest
    for (const s of [1, -1]) add(T, G.sph(.07, 8, 6), S, s * .07, .4, .085).scale.set(1.1, .75, .5);    // pecs
    if (gaunt) for (let i = 0; i < 3; i++) add(T, G.torus(.13, .008, 4, 14, Math.PI), dark, 0, .27 + i * .05, .02).rotation.set(Math.PI / 2, 0, 0);   // ribs showing
    if (P) for (const s of [1, -1]) {                                                               // chitin pads on the shoulders and the hips
        add(T, G.sph(.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), P, s * .2, .47, 0).scale.set(1, .7, 1.1);
        add(T, G.sph(.09, 8, 6), P, s * .1, .02, .03).scale.set(1.1, .6, .9);
    }
    const neck = grp(T, 0, .5, 0);
    add(neck, G.cyl(.048, .058, .1, 8), S, 0, .04, 0);
    const head = grp(neck, 0, .15, .01);
    add(head, G.sph(.1, 12, 10), S, 0, 0, .005).scale.set(.86, 1.06, .98);
    add(head, G.sph(.018, 6, 5), S, 0, -.012, .1).scale.set(.75, 1.1, .9);                            // nose
    add(head, G.sph(.045, 8, 6), S, 0, -.06, .05).scale.set(1, .7, .85);                              // chin
    const eyeM = glowEye ? mat(eye, { emissive: eye, emissiveIntensity: 1.6, roughness: .2 }) : mat(eye, { roughness: .2 });
    for (const s of [1, -1]) {
        if (!glowEye) add(head, G.sph(.012, 6, 5), mat(0xf0ece0), s * .033, .018, .082);
        add(head, G.sph(glowEye ? .013 : .007, 6, 5), eyeM, s * .033, .018, .089);
        add(head, G.box(.032, .006, .008), Hm, s * .034, .036, .09).rotation.z = s * (glowEye ? -.35 : .05);   // brows (angry)
        const ear = add(head, ears === 'pointy' ? G.cone(.02, .09, 4) : G.sph(.02, 6, 5), S, s * .085, .01, -.005);
        if (ears === 'pointy') ear.rotation.set(-.4, 0, -s * 1.1); else ear.scale.set(.5, 1, .8);
    }
    const jaw = grp(head, 0, -.05, .07);
    add(jaw, G.box(.035, .007, .01), mat(0x6a2a24), 0, 0, .014);
    if (crown) {                                                                                     // spiky crest / horns
        const cm = mat(crown, { roughness: .4, metalness: .2 });
        add(head, G.sph(.104, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), cm, 0, .01, -.005);
        for (let i = -2; i <= 2; i++) {
            const sp = add(head, G.cone(.02, .14 - Math.abs(i) * .02, 5), cm, i * .035, .1 - Math.abs(i) * .01, -.02);
            sp.rotation.set(-.35, 0, -i * .3);
        }
    } else {
        add(head, G.sph(.105, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), Hm, 0, .015, -.01);          // hair
        add(head, G.sph(.1, 10, 8), Hm, 0, -.01, -.045).scale.set(.9, 1, .6);
    }
    const arms = [];
    let spearG = null;
    for (const s of [1, -1]) {
        const sh = grp(T, s * .215, .44, 0);
        add(sh, G.sph(.066, 8, 6), P || S);
        add(sh, G.cyl(.05, .042, .29, 7), S, 0, -.145, 0);
        const el = grp(sh, 0, -.29, 0);
        add(el, G.sph(.042, 7, 5), S);
        add(el, G.cyl(.042, .032, .27, 7), S, 0, -.135, 0);
        const hand = grp(el, 0, -.28, 0);
        add(hand, G.sph(.04, 7, 5), S).scale.set(.9, 1.2, .8);
        if (claws) for (let k = -1; k <= 1; k++) add(hand, G.cone(.008, .07, 4), dark, k * .016, -.06, .01).rotation.x = Math.PI + .2;
        if (spear && s < 0) {                                                                        // spear in the right hand
            spearG = grp(hand, 0, -.02, 0);
            add(spearG, G.cyl(.014, .014, 1.9, 6), mat(0x6a4a2a, { roughness: .8 }), 0, 0, .2).rotation.x = Math.PI / 2;
            add(spearG, G.tip(.04, .2), mat(0xb8bcc0, { roughness: .3, metalness: .8 }), 0, 0, 1.25);
        }
        arms.push({ sh, el, hand, s });
    }
    return { T, neck, head, jaw, arms, spear: spearG };
}

// arm angles: shoulder x (forward −), shoulder z (out), elbow x (bend −)
export function poseTorsoArms(H, mode, k = 0, t = 0) {
    for (const A of H.arms) {
        const right = A.s < 0;
        let sx = .05 + Math.sin(t * 1.3 + A.s) * .04, sz = A.s * .12, ex = -.25;
        if (mode === 'walk') { sx = Math.sin(t * 5 + (right ? 0 : Math.PI)) * .3; ex = -.4; }
        if (H.spear && right && mode !== 'dead') { sx = -.35; ex = -1.25; sz = -.1; }                       // spear held forward
        if (mode === 'attack') {
            if (H.spear) { if (right) { sx = -.35 - k * 1.0 + (1 - k) * -.2; ex = -1.25 + k * 1.2; } else { sx = -.6; ex = -.9; } }
            else { sx = -.4 - k * 1.5; ex = -1.3 + k * 1.1; sz = A.s * (.35 - k * .25); }                   // claws slash down
        } else if (mode === 'defend') {
            sx = -1.3; ex = -1.1; sz = A.s * .25;
            if (H.spear && right) { sx = -.8; ex = -.9; }
        } else if (mode === 'hit') { sx = .3; ex = -.6; sz = A.s * .4; }
        else if (mode === 'dead') { sx = .4; ex = -.1; sz = A.s * 1.0; }
        A.sh.rotation.set(sx, 0, sz);
        A.el.rotation.x = ex;
    }
    // the spear stays level (raised in idle / walk / defence) whatever the arm does
    if (H.spear) H.spear.rotation.x = -(H.arms[1].el.rotation.x + H.arms[1].sh.rotation.x) - (mode === 'idle' || mode === 'walk' ? 1.1 : mode === 'defend' ? .5 : 0);
}
