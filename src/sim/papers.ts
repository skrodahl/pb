import type { Paper, Rider, HouseSim, SimEvent } from './types';
import {
  GRAV,
  WIN_Z_HALF,
  GROUND_Y,
  PAPER_Y0,
  WINDOW_Y_MID,
  YARD_IN,
  ROUTE_LEN,
  PAPER_T,
  faceX,
} from './types';
import { resolveDelivery, resolveSmash } from './houses';

export interface PaperWorld {
  rider: Rider;
  houses: HouseSim[];
  wind: [number, number];
  lost: number;
  clockMin: number;
  addEvent(e: SimEvent): void;
}

export const PAPER_FLIGHT_T = PAPER_T; // sideways flight time (s)

// Catch column: a paper whose (x,z) enters the column of a house with a
// window is either DELIVERED (subscriber) or SMASHED (stopped house).
export function inWindowColumn(h: HouseSim, x: number, z: number): boolean {
  const fx = faceX(h.spec.pos);
  return (
    Math.sign(x) === Math.sign(fx) &&
    Math.abs(x) >= Math.abs(fx) - 0.3 &&
    Math.abs(x) <= Math.abs(fx) + 1.5 &&
    Math.abs(z - h.spec.pos[1]) <= WIN_Z_HALF
  );
}

// Sideways tap-throw: the paper flies laterally from the rider's position to
// the target's catch column while the rider keeps riding. Lining up with the
// house is the whole aim — throw when the house is beside you.
export function launchPaper(
  w: PaperWorld,
  rider: Rider,
  id: number,
  targetIdx: number,
  target: HouseSim,
): Paper {
  const side = Math.sign(target.spec.pos[0]) || 1;
  const fx = faceX(target.spec.pos);
  const z0 = rider.z + rider.heading * 0.6;
  const vx = (fx + side * 0.3 - rider.x) / PAPER_T;
  const vy = (WINDOW_Y_MID - PAPER_Y0 + 0.5 * GRAV * PAPER_T * PAPER_T) / PAPER_T;
  // the paper inherits the bike's forward speed, and flutter drag kills it
  // exactly at landing: it hangs ahead mid-flight but lands on the house
  const vz = rider.speed;
  const zDecel = (2 * rider.speed) / PAPER_T;
  const dz = Math.abs(z0 - target.spec.pos[1]);
  const precision = Math.max(0, 1 - dz / WIN_Z_HALF);
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
    target: targetIdx,
    precision,
    zDecel,
  };
}

// Crash scatter: papers blow off the rear rack and skid out.
export function scatterPapers(
  w: PaperWorld,
  rider: Rider,
  id: number,
  n: number,
  rng: () => number = Math.random,
): Paper[] {
  const out: Paper[] = [];
  for (let k = 0; k < n; k++) {
    out.push({
      id: id + k,
      x: rider.x + (rng() - 0.5) * 0.8,
      y: GROUND_Y,
      z: rider.z - rider.heading * 0.9,
      vx: (rng() - 0.5) * 3,
      vy: 0,
      vz: -rider.heading * (1 + rng() * 2),
      state: 'flying',
      bounces: 1,
      target: null,
      precision: 0,
      zDecel: 0,
    });
  }
  return out;
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
      if (p.zDecel > 0) p.vz = Math.max(0, p.vz - p.zDecel * dt); // flutter kills the inherited speed
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    // skidding (wall-bounced / scattered) papers can strike the rider
    if (
      p.bounces > 0 &&
      Math.abs(p.x - w.rider.x) < 2.0 &&
      Math.abs(p.z - w.rider.z) < 2.0
    ) {
      p.state = 'gone';
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

    // 1) window column: delivered (subscriber) or smashed (stopped house)
    if (p.bounces === 0) {
      const hit = w.houses.findIndex(
        (h) => h.state === 'pending' && h.spec.role !== 'none' && inWindowColumn(h, p.x, p.z),
      );
      if (hit >= 0) {
        const h = w.houses[hit];
        p.state = 'settled';
        p.x = faceX(h.spec.pos) + Math.sign(p.x) * 0.25;
        p.y = WINDOW_Y_MID;
        p.z = h.spec.pos[1];
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        if (h.spec.role === 'stopped') {
          resolveSmash(h);
          w.addEvent({ type: 'smash', houseIndex: hit });
        } else {
          resolveDelivery(h, w.clockMin, p.precision);
          w.addEvent({
            type: 'delivery',
            houseIndex: hit,
            kind: h.state === 'clean' ? 'clean' : 'late',
          });
        }
        continue;
      }
    }

    // 2) wall hit: crossed the face but missed the window's z-band — skid back
    const wallAt = w.houses.some((h) => {
      const fx = faceX(h.spec.pos);
      return (
        h.spec.role !== 'none' &&
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
