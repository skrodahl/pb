import * as THREE from 'three';
import type { GameSim } from '../sim/sim';
import { landingPoint } from '../sim/rider';

export class LandingMarker {
  group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({
      color: 0x7cfc00,
      emissive: 0x3a8f00,
      emissiveIntensity: 1,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24), m);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 4), m);
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
    const lp = landingPoint(r);
    this.group.position.set(lp.x, 0.1, lp.z);
    this.group.scale.setScalar(1 + 0.15 * Math.sin(t * 8));
  }
}
