import type { Paper, Rider, HouseSim, SimEvent } from './types';
import { GRAV, PAPER_Y_LAND, YARD_IN, YARD_OUT, ROUTE_LEN } from './types';
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

const T = 0.7; // flight time (s)
const Y0 = 1.1; // release height
const HIT_RADIUS = 2.0;

export function inPorch(h: HouseSim, x: number, z: number): boolean {
  const p = h.spec.porch;
  return Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2;
}

export function launchPaper(w: PaperWorld, rider: Rider, id: number): Paper {
  const lp = landingPoint(rider); // uses rider.charge / rider.aim
  const z0 = rider.z + rider.heading * 0.6;
  const vx = (lp.x - rider.x) / T;
  const vz = (lp.z - z0) / T;
  const vy = (PAPER_Y_LAND - Y0 + 0.5 * GRAV * T * T) / T;
  const target = w.houses.findIndex((h) => inPorch(h, lp.x, lp.z));
  return {
    id,
    x: rider.x,
    y: Y0,
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

    p.vy -= GRAV * dt;
    p.vx += w.wind[0] * dt;
    p.vz += w.wind[1] * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // bounced papers can strike the rider
    if (
      p.bounces > 0 &&
      p.y < 1.6 &&
      Math.abs(p.x - w.rider.x) < HIT_RADIUS &&
      Math.abs(p.z - w.rider.z) < HIT_RADIUS
    ) {
      p.state = 'gone';
      w.hits++;
      w.lost++;
      w.addEvent({ type: 'paper_hit_rider', paperId: p.id });
      continue;
    }

    if (p.y <= PAPER_Y_LAND && p.vy < 0) {
      const i = w.houses.findIndex((h) => inPorch(h, p.x, p.z));
      if (i >= 0) {
        p.state = 'settled';
        p.y = PAPER_Y_LAND;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        w.deliver(i);
        w.addEvent({ type: 'paper_landed', paperId: p.id, houseIndex: i, kind: 'porch' });
      } else if (Math.abs(p.x) >= YARD_IN && Math.abs(p.x) <= YARD_OUT) {
        // yard: bounce, skidding back toward the road
        p.y = 0.1;
        p.vy = 1.8;
        p.vx = -Math.sign(p.vx || 1) * Math.abs(p.vx) * 0.55;
        p.vz *= 0.35;
        p.bounces++;
        if (p.bounces === 1) {
          w.addEvent({
            type: 'paper_landed',
            paperId: p.id,
            houseIndex: p.target,
            kind: 'yard',
          });
        }
        if (p.bounces > 2) {
          p.state = 'gone';
          w.lost++;
        }
      } else {
        p.state = 'gone';
        w.lost++;
        w.addEvent({
          type: 'paper_landed',
          paperId: p.id,
          houseIndex: p.target,
          kind: 'road',
        });
      }
    }

    // out of bounds
    if (p.state === 'flying' && (Math.abs(p.x) > 30 || p.z < -10 || p.z > ROUTE_LEN + 10)) {
      p.state = 'gone';
      w.lost++;
    }
  }
}
