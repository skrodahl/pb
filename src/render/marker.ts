import * as THREE from 'three';
import type { GameSim } from '../sim/sim';
import { landingPoint } from '../sim/rider';
import { faceX, WIN_Z_HALF, WINDOW_Y_MID } from '../sim/types';
import { PAPER_FLIGHT_T } from '../sim/papers';

export class LandingMarker {
  group: THREE.Group;
  private mat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffa030,
      emissive: 0x7a4a00,
      emissiveIntensity: 1,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24), this.mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 4), this.mat);
    beacon.position.y = 1.1;
    beacon.rotation.x = Math.PI;
    this.group.add(ring, beacon);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(sim: GameSim, t: number): void {
    const r = sim.rider;
    this.group.visible = r.charging;
    if (!this.group.visible) return;

    // wind-corrected predicted landing (the sim adds 0.5*w*t^2 drift)
    const T = PAPER_FLIGHT_T;
    const lp = landingPoint(r);
    const xP = lp.x + 0.5 * sim.wind[0] * T * T;
    const zP = lp.z + 0.5 * sim.wind[1] * T * T;
    const side = Math.sign(lp.x);
    const target = sim.nextTarget();
    const h = target !== null ? sim.houses[target] : null;

    // clean ⇔ the predicted landing is inside the target's window catch column
    let clean = false;
    if (h && side !== 0 && Math.sign(h.spec.pos[0]) === side) {
      const fx = Math.abs(faceX(h.spec.pos));
      clean =
        Math.abs(xP) >= fx - 0.3 &&
        Math.abs(xP) <= fx + 1.5 &&
        Math.abs(zP - h.spec.pos[1]) <= WIN_Z_HALF;
    }

    if (clean && h) {
      const fx = faceX(h.spec.pos);
      this.group.position.set(fx + side * 0.25, WINDOW_Y_MID, h.spec.pos[1]);
    } else {
      this.group.position.set(xP, 0.1, zP);
    }
    this.group.scale.setScalar(1 + 0.15 * Math.sin(t * 8));
    this.setHot(clean);
  }

  private setHot(clean: boolean): void {
    this.mat.color.setHex(clean ? 0x7cfc00 : 0xffa030);
    this.mat.emissive.setHex(clean ? 0x2f8f00 : 0x7a4a00);
  }
}
