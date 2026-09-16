import { mulberry32 } from '../core/rng';
import type { Car, DayConfig, Rider, SimEvent } from './types';
import { ROUTE_LEN } from './types';

export class Traffic {
  cars: Car[] = [];
  private timer: number;
  private rng: () => number;
  private nextId = 0;
  private cfg: DayConfig['traffic'];

  constructor(cfg: DayConfig['traffic'], seed?: number) {
    this.cfg = cfg;
    this.rng = mulberry32(seed ?? cfg.seed);
    this.timer = cfg.interval;
  }

  step(dt: number, rider: Rider, addEvent: (e: SimEvent) => void): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.cfg.interval + this.rng() * this.cfg.jitter;
      this.spawn(rider);
    }

    for (const car of this.cars) {
      if (!car.active) continue;
      car.z += car.dir * car.speed * dt;
      if (car.z < -6 || car.z > ROUTE_LEN + 6) {
        car.active = false;
        continue;
      }
      if (
        rider.stagger === 0 &&
        Math.abs(car.x - rider.x) < 1.7 &&
        Math.abs(car.z - rider.z) < 2.4
      ) {
        this.hitRider(car, rider, addEvent);
      }
    }
  }

  private spawn(rider: Rider): void {
    const dir: 1 | -1 = rider.heading === 1 ? -1 : 1;
    this.cars.push({
      id: this.nextId++,
      x: 0,
      z: dir === -1 ? ROUTE_LEN + 4 : -4,
      dir,
      speed: this.cfg.speed,
      active: true,
      colorIndex: Math.floor(this.rng() * 6),
    });
  }

  private hitRider(
    car: Car,
    rider: Rider,
    addEvent: (e: SimEvent) => void,
  ): void {
    rider.stagger = 1.2;
    rider.speed = 0;
    car.active = false; // car swerves off; rider staggers
    addEvent({ type: 'car_hit' });
  }
}
