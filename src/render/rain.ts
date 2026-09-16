import * as THREE from 'three';

interface WetMat {
  mat: THREE.MeshStandardMaterial;
  dry: number;
  wet: number;
}

export class RainFX {
  private lines: THREE.LineSegments;
  private offsets: number[] = [];
  private raining = false;
  private wetT = 0;
  private dryFogColor: number;
  private rainFogColor = 0x7a8a99;
  private dryNear = 40;
  private dryFar = 220;
  private rainNear = 25;
  private rainFar = 140;

  constructor(
    private scene: THREE.Scene,
    private mats: WetMat[],
    count = 1200,
  ) {
    this.dryFogColor = (scene.fog as THREE.Fog).color.getHex();
    this.dryNear = (scene.fog as THREE.Fog).near;
    this.dryFar = (scene.fog as THREE.Fog).far;

    const pos = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      this.offsets.push((Math.random() - 0.5) * 40, Math.random() * 30, (Math.random() - 0.5) * 40);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x9db8d9, transparent: true, opacity: 0.5 }),
    );
    this.lines.visible = false;
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  setRaining(on: boolean): void {
    this.raining = on;
  }

  private damp(t: number, dt: number, k: number): number {
    return t + (1 - t) * Math.min(1, dt * k);
  }

  update(dt: number, camPos: THREE.Vector3, wind: [number, number]): void {
    this.wetT = this.raining ? this.damp(this.wetT, dt, 0.25) : 1 - this.damp(1 - this.wetT, dt, 0.25);

    // wet ground/fog lerp
    const cDry = new THREE.Color(this.dryFogColor);
    const cRain = new THREE.Color(this.rainFogColor);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(cDry.clone().lerp(cRain, this.wetT));
    fog.near = this.dryNear + (this.rainNear - this.dryNear) * this.wetT;
    fog.far = this.dryFar + (this.rainFar - this.dryFar) * this.wetT;
    for (const w of this.mats) {
      (w.mat.color as THREE.Color)
        .copy(new THREE.Color(w.dry))
        .lerp(new THREE.Color(w.wet), this.wetT);
    }

    // rain lines follow the camera
    this.lines.visible = this.raining && this.wetT > 0.1;
    if (!this.lines.visible) return;
    const attr = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.offsets.length; i += 3) {
      let y = this.offsets[i + 1] - 11 * dt;
      if (y < -2) y += 32;
      let x = this.offsets[i] + wind[0] * dt * 0.5;
      if (x > 20) x -= 40;
      if (x < -20) x += 40;
      this.offsets[i] = x;
      this.offsets[i + 1] = y;
      const j = i * 2;
      arr[j] = camPos.x + x;
      arr[j + 1] = camPos.y + y;
      arr[j + 2] = camPos.z + this.offsets[i + 2];
      arr[j + 3] = camPos.x + x;
      arr[j + 4] = camPos.y + y - 1.6;
      arr[j + 5] = camPos.z + this.offsets[i + 2];
    }
    attr.needsUpdate = true;
  }
}
