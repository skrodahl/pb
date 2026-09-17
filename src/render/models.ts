import * as THREE from 'three';
import type { HouseSpec } from '../sim/types';

export const PALETTE = {
  grass: 0x5d944f,
  grassWet: 0x41604a,
  road: 0x2e333d,
  roadWet: 0x1d2129,
  sidewalk: 0x9a9a8f,
  curb: 0xb5b5a8,
  walls: [0xa04430, 0x5f7a3f, 0x8a5f3f, 0x4a6a80, 0x7a4a68, 0xa0884a],
  roofs: [0x4a332a, 0x334a3a, 0x3a3a48],
  door: 0x3a2f2a,
  porch: 0xcfc8b4,
  cars: [0xc0392b, 0x2980b9, 0xf1c40f, 0x7f8c8d, 0x27ae60, 0x8e44ad],
  trunk: 0x5a4632,
  leaves: [0x3f7a3f, 0x4a8f3f, 0x5f9e4a],
  paper: 0xf5f0e6,
  bike: 0xc0392b,
  riderShirt: 0x2e86ab,
  riderPants: 0x34495e,
  skin: 0xe8b88a,
  mailbox: 0x2e86ab,
};

export function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...opts });
  m.flatShading = true;
  return m;
}

export function createHouse(spec: HouseSpec, i: number): THREE.Group {
  const g = new THREE.Group();
  const streetSide = Math.sign(spec.porch.x) || 1;

  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 6), mat(PALETTE.walls[i % 6]));
  body.position.set(spec.pos[0], 2, spec.pos[1]);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.6, 4), mat(PALETTE.roofs[i % 3]));
  roof.position.set(spec.pos[0], 5.3, spec.pos[1]);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.12), mat(PALETTE.door));
  door.position.set(spec.pos[0] - streetSide * 2.45, 0.9, spec.pos[1]);
  g.add(door);

  const padMat = mat(PALETTE.porch, { emissive: 0x000000 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(spec.porch.w, 0.12, spec.porch.d), padMat);
  pad.position.set(spec.porch.x, 0.06, spec.porch.z);
  pad.receiveShadow = true;
  g.add(pad);
  g.userData.pad = pad;

  // street-side window: the paper's catch target (Task 5 gives it cozy framing)
  const winMat = mat(0xffd9a0, { emissive: 0x000000, roughness: 0.6 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 2.2), winMat);
  win.position.set(spec.pos[0] - streetSide * 2.5, 1.45, spec.pos[1]);
  g.add(win);
  g.userData.winMat = winMat;

  // wind chimes on the porch corner
  const chime = new THREE.Group();
  chime.position.set(spec.porch.x + streetSide * -1.0, 2.2, spec.porch.z + spec.porch.d / 2 - 0.4);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), mat(PALETTE.trunk));
  chime.add(arm);
  for (let c = 0; c < 3; c++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0xd8c26a));
    bar.geometry.translate(0, -0.25, 0);
    bar.position.x = -0.2 + c * 0.2;
    chime.add(bar);
  }
  g.add(chime);
  g.userData.chime = chime;

  return g;
}

export function createTree(variant: number): THREE.Group {
  const g = new THREE.Group();
  const s = 0.85 + (variant % 3) * 0.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6), mat(PALETTE.trunk));
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);
  const leafColor = PALETTE.leaves[variant % 3];
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 6), mat(leafColor));
  c1.position.y = 2.4;
  c1.castShadow = true;
  g.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 6), mat(leafColor));
  c2.position.y = 3.4;
  c2.castShadow = true;
  g.add(c2);
  g.scale.setScalar(s);
  return g;
}

export function createMailbox(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), mat(PALETTE.trunk));
  post.position.y = 0.4;
  g.add(post);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), mat(PALETTE.mailbox));
  box.position.y = 0.9;
  box.castShadow = true;
  g.add(box);
  return g;
}

export function createCar(colorIndex: number): THREE.Group {
  const g = new THREE.Group();
  const color = PALETTE.cars[colorIndex % 6];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), mat(color));
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), mat(0xd8e8f0, { roughness: 0.4 }));
  cabin.position.set(0, 1.35, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = mat(0x22252a);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    g.add(wheel);
  }
  const lightMat = mat(0xfff2c0, { emissive: 0xfff2c0, emissiveIntensity: 0.7 });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.08), lightMat);
  l1.position.set(-0.6, 0.7, 2.12);
  const l2 = l1.clone();
  l2.position.x = 0.6;
  g.add(l1, l2);
  return g;
}

export function createBikeRider(): THREE.Group {
  const g = new THREE.Group();
  const wheelGeo = new THREE.TorusGeometry(0.35, 0.05, 8, 20);
  const wheelMat = mat(0x22252a);
  const front = new THREE.Mesh(wheelGeo, wheelMat);
  front.position.set(0, 0.35, 0.55);
  front.rotation.y = Math.PI / 2;
  front.castShadow = true;
  const rear = front.clone();
  rear.position.z = -0.55;
  g.add(front, rear);

  const frameMat = mat(PALETTE.bike);
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), frameMat);
  f1.position.set(0, 0.7, 0);
  const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), frameMat);
  f2.position.set(0, 0.85, 0.45);
  f2.rotation.x = 0.3;
  const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), frameMat);
  f3.position.set(0, 0.9, -0.5);
  g.add(f1, f2, f3);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), mat(PALETTE.riderShirt));
  torso.position.set(0, 1.35, -0.1);
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(PALETTE.skin));
  head.position.set(0, 1.78, -0.1);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), mat(PALETTE.riderPants));
  cap.position.set(0, 1.92, -0.1);
  g.add(torso, head, cap);

  // paper stack on the rear rack
  const stack = new THREE.Group();
  stack.position.set(0, 1.0, -0.62);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.6), mat(PALETTE.paper));
    p.position.y = i * 0.05;
    p.castShadow = true;
    stack.add(p);
  }
  g.add(stack);
  g.userData.stack = stack;
  return g;
}

export function createPaperMesh(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.6), mat(PALETTE.paper));
  m.castShadow = true;
  return m;
}
