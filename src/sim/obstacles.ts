import { mulberry32 } from '../core/rng';
import type { CrossCar, Rccar, Skater, DayConfig, Rider, SimEvent } from './types';

// Street obstacles: cars cross at intersections (perpendicular to the route),
// skaters ride toward you down a lane, RC cars cross the road from a yard.
// Crashing staggers the rider; the obstacle keeps going (never consumed).
export class ObstacleSim {
  cars: CrossCar[] = [];
  skaters: Skater[] = [];
  rccars: Rccar[] = [];
  private rng: () => number;
  private cfg: DayConfig['obstacles'];
  private timers: number[];
  private skaterTimer: number;
  private rcTimer: number;
  private nextId = 0;

  constructor(cfg: DayConfig['obstacles'], seed?: number) {
    this.cfg = cfg;
    this.rng = mulberry32(seed ?? cfg.seed);
    this.timers = cfg.crossZ.map(
      (_, i) => 3 + i * 2.5 + this.rng() * this.cfg.crossEvery[i % this.cfg.crossEvery.length],
    );
    this.skaterTimer = rand(this.cfg.skaterEvery, this.rng);
    this.rcTimer = rand(this.cfg.rcEvery, this.rng);
  }

  step(
    dt: number,
    rider: Rider,
    addEvent: (e: SimEvent) => void,
    onCrash?: () => void,
  ): void {
    this.cfg.crossZ.forEach((z, i) => {
      this.timers[i] -= dt;
      if (this.timers[i] > 0) return;
      const interval = this.cfg.crossEvery[i % this.cfg.crossEvery.length];
      this.timers[i] = interval + this.rng() * interval * 0.5;
      const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
      this.cars.push({
        id: this.nextId++,
        z,
        x: dir === 1 ? -24 : 24,
        dir,
        speed: 6,
        active: true,
        colorIndex: Math.floor(this.rng() * 6),
      });
      if (Math.abs(z - rider.z) < 25) addEvent({ type: 'horn', z });
    });
    for (const c of this.cars) {
      if (!c.active) continue;
      c.x += c.dir * c.speed * dt;
      if (Math.abs(c.x) > 24) {
        c.active = false;
        continue;
      }
      this.maybeCrash(c.x, c.z, rider, 1.7, 2.4, 'cross', addEvent, onCrash);
    }

    this.skaterTimer -= dt;
    if (this.skaterTimer <= 0 && !this.skaters.some((s) => s.active)) {
      this.skaterTimer = rand(this.cfg.skaterEvery, this.rng);
      this.skaters.push({
        id: this.nextId++,
        x: this.rng() < 0.5 ? -2 : 2,
        z: rider.z + rider.heading * 30,
        active: true,
        age: 0,
      });
    }
    for (const s of this.skaters) {
      if (!s.active) continue;
      s.age += dt;
      s.z -= rider.heading * 4 * dt; // rides toward the rider
      if (s.age > 12 || Math.abs(s.z - rider.z) > 14) {
        s.active = false;
        continue;
      }
      this.maybeCrash(s.x, s.z, rider, 1.5, 1.8, 'skater', addEvent, onCrash);
    }

    this.rcTimer -= dt;
    if (this.rcTimer <= 0 && !this.rccars.some((r) => r.active)) {
      this.rcTimer = rand(this.cfg.rcEvery, this.rng);
      this.rccars.push({
        id: this.nextId++,
        z: rider.z + rider.heading * 25,
        x: 8,
        active: true,
      });
    }
    for (const r of this.rccars) {
      if (!r.active) continue;
      r.x -= 7 * dt; // crosses the road, yard to yard
      if (r.x < -8) {
        r.active = false;
        continue;
      }
      this.maybeCrash(r.x, r.z, rider, 1.2, 1.5, 'rc', addEvent, onCrash);
    }
  }

  private maybeCrash(
    ox: number,
    oz: number,
    rider: Rider,
    hx: number,
    hz: number,
    kind: 'cross' | 'skater' | 'rc',
    addEvent: (e: SimEvent) => void,
    onCrash?: () => void,
  ): void {
    if (rider.stagger > 0) return;
    if (Math.abs(ox - rider.x) < hx && Math.abs(oz - rider.z) < hz) {
      rider.stagger = 1.2;
      rider.speed = 0;
      addEvent({ type: 'car_hit', kind });
      onCrash?.();
    }
  }
}

function rand(range: [number, number], rng: () => number): number {
  return range[0] + (range[1] - range[0]) * rng();
}
