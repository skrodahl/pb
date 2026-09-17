import * as THREE from 'three';
import type { GameSim } from '../sim/sim';
import { MAX_SPEED } from '../sim/types';

export class ChaseCamera {
  private pos = new THREE.Vector3(0, 4.5, -6);
  private shake = 0;

  constructor(private cam: THREE.PerspectiveCamera) {}

  update(dt: number, sim: GameSim): void {
    const r = sim.rider;
    const f = r.heading;
    const speedK = r.speed / MAX_SPEED;
    const back = 7.5 + 2.5 * speedK;
    const up = 4.2 - 0.4 * speedK;
    const side = 3.4 * f;
    const target = new THREE.Vector3(r.x + side, up, r.z - f * back);
    this.pos.lerp(target, 1 - Math.exp(-4.5 * dt));
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-6 * dt);
      this.pos.x += (Math.random() - 0.5) * this.shake;
      this.pos.y += (Math.random() - 0.5) * this.shake * 0.5;
    }
    this.cam.position.copy(this.pos);
    this.cam.lookAt(new THREE.Vector3(r.x + f * 1.0, 1.2, r.z + f * (5 + 4 * speedK)));
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }
}
