import { G, mat } from '../avatar/kit.js';
import { ProceduralHoofed, HOOFED_KINDS } from './ProceduralHoofed.js';
import { humanTorso, poseTorsoArms } from './hybridParts.js';

/*
 * ProceduralCentaur — horse body (ProceduralHoofed, kind horse) with a human upper body in place of the neck and head.
 * The torso hangs on the neck joint, so the horse poses keep it upright: rearing leans it forward, the strike thrusts
 * the spear. States as the horse: attack = rear up → hooves strike → spear thrust; defend = prancing with the spear
 * held across; kneel / lie with the torso upright; death on the side.
 */
export const CENTAUR_VARIANTS = {
    centaur: { kind: 'horse', coat: 0x7a3a1e, dark: 0x4a2412, mane: 0x1a120c, hoof: 0x2a2420, sock: 0xece6da, skin: 0xc8946a, scale: 1 }
};

export class ProceduralCentaur extends ProceduralHoofed {
    makePoses() {
        const S = super.makePoses();
        Object.assign(S, { neckX: .02, headX: 0, tailX: .25 });
        const fix = (P, o) => Object.assign(P, o);
        fix(this.A1, { neckX: .62, headX: -.1, jaw: .3 });
        fix(this.A2, { neckX: .2, headX: 0 });
        fix(this.A3, { neckX: .3, headX: .05 });
        fix(this.DEFEND, { neckX: .2, headX: -.05 });
        fix(this.HIT, { neckX: -.25, headX: -.15 });
        fix(this.KNEEL, { neckX: -.25, headX: 0 });
        fix(this.LIE, { neckX: .05, headX: 0 });
        fix(this.DEAD, { neckX: .9, headX: .5 });
        return S;
    }

    buildHead(add, grp) {
        const c = this.c, D = this.D, J = this.j;
        J.neck = grp(J.body, 0, D.r * .55, D.foreZ - .02);
        const H = this.torso = humanTorso(J.neck, { skin: c.skin, hair: 0x1a120c, eye: 0x3a2a1a, spear: true, scale: 1.3 });
        H.T.position.y = -.05;
        J.head = H.head;
        J.jaw = H.jaw;
        J.eyes = [];
        // white socks above the hooves
        const sock = mat(c.sock, { roughness: .9 });
        for (const name of ['FL', 'FR', 'HL', 'HR']) add(this.j[name].low, G.cyl(D.R * .95, D.R * 1.1, .12, 8), sock, 0, -.05, 0);
    }

    statePose(state, c, t) {
        this.atkP = state === 'attack' ? (c.actionDuration ? 1 - c.actionTime / (c.actionDuration || .7) : (this.stateTime / .7) % 1) : 0;
        return super.statePose(state, c, t);
    }

    animateExtras(q, state, t, dt, g, run) {
        super.animateExtras(q, state, t, dt, g, run);
        const p = this.atkP;
        const mode = state === 'death' ? 'dead' : state === 'attack' ? 'attack' : state === 'defend' ? 'defend' : state === 'hit' ? 'hit'
            : g > .3 ? 'walk' : 'idle';
        const k = state === 'attack' ? (p < .45 ? 0 : p < .62 ? (p - .45) / .17 : Math.max(0, 1 - (p - .62) / .3)) : 0;
        poseTorsoArms(this.torso, mode, k, t);
    }
}
ProceduralCentaur.VARIANTS = CENTAUR_VARIANTS;
ProceduralCentaur.KINDS = HOOFED_KINDS;
