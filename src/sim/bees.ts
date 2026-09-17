import { BASE_SPEED } from './types';
import type { Rider, SimEvent } from './types';

// Cruise without pedaling and a bee swarm shows up ahead to push you on.
// ~3s at the cruise speed (or slower) => spawn; the swarm bumps you
// (stagger) if you're still slow, and disperses once you rev up.
export interface Bee {
  x: number;
  z: number;
  phase: number;
}

export class BeeSim {
  active = false;
  bees: Bee[] = [];
  private stallT = 0;
  private cooldown = 0;

  step(dt: number, rider: Rider, addEvent: (e: SimEvent) => void): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      this.active = false;
      return;
    }
    if (this.active) {
      for (const b of this.bees) {
        b.z -= rider.heading * 5 * dt;
        b.x = rider.x + Math.sin(b.phase) * 1.2;
        if (Math.abs(b.x - rider.x) < 0.9 && Math.abs(b.z - rider.z) < 1.2 && rider.stagger === 0) {
          rider.stagger = 0.9;
          rider.speed *= 0.4;
          this.active = false;
          this.cooldown = 4;
          addEvent({ type: 'bee_hit' });
          return;
        }
      }
      // rider revved up: the swarm loses interest
      if (rider.speed > BASE_SPEED + 1) {
        this.active = false;
        this.stallT = 0;
      }
      return;
    }
    if (rider.stagger === 0 && rider.speed < BASE_SPEED + 1) {
      this.stallT += dt;
      if (this.stallT >= 3) {
        this.active = true;
        this.bees = [0, 1, 2, 3].map((i) => ({
          x: rider.x,
          z: rider.z + rider.heading * (12 + i * 1.5),
          phase: i * 1.7,
        }));
      }
    } else {
      this.stallT = 0;
    }
  }
}
