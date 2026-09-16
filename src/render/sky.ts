import * as THREE from 'three';

function lerpHex(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return ca.getHex();
}

export function makeSkyTexture(t: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const horizon = lerpHex(0xffd9a0, 0xcfe8ff, t);
  const mid = lerpHex(0xf0c898, 0xa8d4f0, t);
  const zenith = lerpHex(0x9fc8e8, 0x6fa8d8, t);
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, `#${horizon.toString(16).padStart(6, '0')}`);
  grad.addColorStop(0.45, `#${mid.toString(16).padStart(6, '0')}`);
  grad.addColorStop(1, `#${zenith.toString(16).padStart(6, '0')}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSkydome(scene: THREE.Scene): THREE.Mesh {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 16, 12),
    new THREE.MeshBasicMaterial({
      map: makeSkyTexture(0),
      side: THREE.BackSide,
      fog: false,
    }),
  );
  scene.add(dome);
  return dome;
}

export function updateSky(dome: THREE.Mesh, t: number, scene: THREE.Scene): void {
  const m = dome.material as THREE.MeshBasicMaterial;
  m.map?.dispose();
  m.map = makeSkyTexture(Math.max(0, Math.min(1, t)));
  m.needsUpdate = true;
  if (scene.fog) {
    const fog = scene.fog as THREE.Fog;
    fog.color.setHex(lerpHex(0xf0c898, 0xa8d4f0, t));
  }
}
