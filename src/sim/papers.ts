import type { Paper, Rider, HouseSim, SimEvent } from './types';
import {
  GRAV,
  WIN_Z_HALF,
  GROUND_Y,
  PAPER_Y0,
  WINDOW_Y_MID,
  YARD_IN,
  ROUTE_LEN,
  faceX,
} from './types';
import { landingPoint } from './rider';

export interface PaperWorld {
  rider: Rider;
  houses: HouseSim[];
  wind: [number, number];
  lost: number;
  hits: number;
  addEvent(e: SimEvent): void;
  deliver(i: number): void;
}

export const PAPER_FLIGHT_T = 0.7; // flight time (s)
const T = PAPER_FLIGHT_T;

// The window is a vertical catch column: if the paper's (x,z) enters the column,
// it is delivered (settling inside the glass). No height condition — arcade-faithful.
export function inWindowColumn(h: HouseSim, x: number, z: number): boolean {
  const fx = faceX(h.spec.pos);
  return (
    Math.sign(x) === Math.sign(fx) &&
    Math.abs(x) >= Math.abs(fx) - 0.3 &&
    Math.abs(x) <= Math.abs(fx) + 1.5 &&
    Math.abs(z - h.spec.pos[1]) <= WIN_Z_HALF
  );
}

export function launchPaper(w: PaperWorld, rider: Rider, id: number): Paper {
  const lp = landingPoint(rider); // uses rider.charge / rider.aim
  const z0 = rider.z + rider.heading * 0.6;
  const vx = (lp.x - rider.x) / T;
  const vz = (lp.z - z0) / T;
  const vy = (GROUND_Y - PAPER_Y0 + 0.5 * GRAV * T * T) / T;
  const side = Math.sign(lp.x);
  const target = w.houses.findIndex((h) => {
    const fx = faceX(h.spec.pos);
    return (
      side !== 0 &&
      Math.sign(h.spec.pos[0]) === side &&
      Math.abs(lp.x - fx) < 1.5 &&
      Math.abs(lp.z - h.spec.pos[1]) <= WIN_Z_HALF + 1
    );
  });
  return {
    id,
    x: rider.x,
    y: PAPER_Y0,
    z: z0,
    vx,
    vy,
    vz,
    state: 'flying',
    bounces: 0,
    target: target >= 0 ? target : null,
  };
}

export function stepPapers(w: PaperWorld, papers: Paper[], dt: number): void {
  for (const p of papers) {
    if (p.state !== 'flying') continue;

    if (p.bounces > 0) {
      // skid along the grass back toward the road, with friction
      const f = Math.max(0, 1 - 2 * dt);
      p.vx *= f;
      p.vz *= f;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y = GROUND_Y;
      p.vy = 0;
    } else {
      p.vy -= GRAV * dt;
      p.vx += w.wind[0] * dt;
      p.vz += w.wind[1] * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    // skidding (wall-bounced) papers can strike the rider
    if (
      p.bounces > 0 &&
      Math.abs(p.x - w.rider.x) < 2.0 &&
      Math.abs(p.z - w.rider.z) < 2.0
    ) {
      p.state = 'gone';
      w.hits++;
      w.lost++;
      w.addEvent({ type: 'paper_hit_rider', paperId: p.id });
      continue;
    }

    // a skid that has come to rest is simply lost on the grass
    if (p.bounces > 0 && Math.abs(p.vx) < 0.3 && Math.abs(p.vz) < 0.3) {
      p.state = 'gone';
      w.lost++;
      continue;
    }

    // 1) window column: delivered, settling inside the glass
    const hitHouse = p.bounces === 0 ? w.houses.findIndex((h) => inWindowColumn(h, p.x, p.z)) : -1;
    if (hitHouse >= 0) {
      const h = w.houses[hitHouse];
      p.state = 'settled';
      p.x = faceX(h.spec.pos) + Math.sign(p.x) * 0.25;
      p.y = WINDOW_Y_MID;
      p.z = h.spec.pos[1];
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      w.deliver(hitHouse);
      w.addEvent({ type: 'paper_landed', paperId: p.id, houseIndex: hitHouse, kind: 'window' });
      continue;
    }

    // 2) wall hit: crossed the face but missed the window's z-band — skid back
    const wallAt = w.houses.some((h) => {
      const fx = faceX(h.spec.pos);
      return (
        Math.sign(p.x) === Math.sign(fx) &&
        Math.abs(p.x) >= Math.abs(fx) - 0.3 &&
        Math.abs(p.z - h.spec.pos[1]) <= 3.0
      );
    });
    if (wallAt) {
      p.bounces++;
      p.x = Math.sign(p.x) * 8.0;
      p.y = GROUND_Y;
      p.vy = 0;
      p.vx = -Math.sign(p.vx || 1) * Math.abs(p.vx) * 0.55;
      p.vz *= 0.35;
      if (p.bounces === 1) {
        w.addEvent({ type: 'paper_landed', paperId: p.id, houseIndex: p.target, kind: 'yard' });
      }
      if (p.bounces > 2) {
        p.state = 'gone';
        w.lost++;
      }
      continue;
    }

    // 3) ground: lost (lawn or road)
    if (p.y <= GROUND_Y && p.vy < 0) {
      p.state = 'gone';
      w.lost++;
      w.addEvent({
        type: 'paper_landed',
        paperId: p.id,
        houseIndex: p.target,
        kind: Math.abs(p.x) < YARD_IN ? 'road' : 'yard',
      });
      continue;
    }

    if (Math.abs(p.x) > 30 || p.z < -10 || p.z > ROUTE_LEN + 10) {
      p.state = 'gone';
      w.lost++;
    }
  }
}
