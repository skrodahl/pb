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

export const SKY_STEPS = 64;
let skyTextures: THREE.CanvasTexture[] = [];
let lastIdx = -1;

function ensureSkyTextures(): void {
  if (skyTextures.length) return;
  skyTextures = Array.from({ length: SKY_STEPS + 1 }, (_, i) => makeSkyTexture(i / SKY_STEPS));
}

export function buildSkydome(scene: THREE.Scene): THREE.Mesh {
  ensureSkyTextures();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 16, 12),
    new THREE.MeshBasicMaterial({
      map: skyTextures[0],
      side: THREE.BackSide,
      fog: false,
    }),
  );
  scene.add(dome);
  return dome;
}

export function updateSky(dome: THREE.Mesh, t: number, scene: THREE.Scene): void {
  ensureSkyTextures();
  const m = dome.material as THREE.MeshBasicMaterial;
  const idx = Math.round(Math.max(0, Math.min(1, t)) * SKY_STEPS);
  // swap between prebuilt textures — never dispose while the GL state is live
  if (idx !== lastIdx) {
    m.map = skyTextures[idx];
    lastIdx = idx;
  }
  if (scene.fog) {
    const fog = scene.fog as THREE.Fog;
    fog.color.setHex(lerpHex(0xf0c898, 0xa8d4f0, t));
  }
}
