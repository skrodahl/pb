import * as THREE from 'three';
import type { HouseSpec } from '../sim/types';

export const PALETTE = {
  grass: 0x5d944f,
  grassWet: 0x41604a,
  road: 0x2e333d,
  roadWet: 0x1d2129,
  sidewalk: 0x9a9a8f,
  curb: 0xb5b5a8,
  walls: [0xe8d8b8, 0xc96f4a, 0x9db87a, 0x8f86c2, 0xd8a86a, 0xb8c4a8],
  roofs: [0x4a332a, 0x334a3a, 0x3a3a48],
  door: 0x3a2f2a,
  porch: 0xcfc8b4,
  post: 0x8a6f4a,
  chimney: 0x9a6a55,
  shutter: 0xd8d4c4,
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
  const px = spec.pos[0];
  const pz = spec.pos[1];
  const wallMat = mat(PALETTE.walls[i % 6]);
  const roofMat = mat(PALETTE.roofs[i % 3]);
  const faceX = px - streetSide * 2.5; // street face

  // body: two stacked floors (same 5x6 footprint, face at ±8.5)
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 6), wallMat);
  f1.position.set(px, 1.1, pz);
  f1.castShadow = true;
  f1.receiveShadow = true;
  const f2 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 5.6), wallMat);
  f2.position.set(px, 3.1, pz);
  f2.castShadow = true;
  g.add(f1, f2);

  // gable roof: three stacked shrinking slabs + chimney on 2 of 3 variants
  for (const [w, d, y] of [
    [5.6, 6.6, 4.25],
    [4, 5, 4.75],
    [2.4, 3.4, 5.25],
  ] as const) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), roofMat);
    slab.position.set(px, y, pz);
    slab.castShadow = true;
    g.add(slab);
  }
  if (i % 3 !== 0) {
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), mat(PALETTE.chimney));
    chim.position.set(px + 1.2, 4.9, pz - 1.5);
    chim.castShadow = true;
    g.add(chim);
  }

  // porch: platform + posts + steps down to the curb
  const padMat = mat(PALETTE.porch, { emissive: 0x000000 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(spec.porch.w, 0.15, spec.porch.d), padMat);
  pad.position.set(spec.porch.x, 0.075, spec.porch.z);
  pad.receiveShadow = true;
  g.add(pad);
  g.userData.pad = pad;
  const postMat = mat(PALETTE.post);
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), postMat);
    post.position.set(spec.porch.x - streetSide * 1.05, 0.75, pz + sz * (spec.porch.d / 2 - 0.3));
    post.castShadow = true;
    g.add(post);
  }
  for (const [sx, sy] of [
    [5.0, 0.09],
    [4.55, 0.06],
    [4.1, 0.03],
  ] as const) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, sy * 2, 2.4), mat(PALETTE.porch));
    step.position.set(streetSide * sx, sy, pz);
    g.add(step);
  }

  // door on the far end of the street face
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.9), mat(PALETTE.door));
  door.position.set(faceX + streetSide * 0.05, 0.9, pz + 2.0);
  g.add(door);

  // main window: the delivery target — frame straddles the face, glass inset
  const winGlowMat = mat(0xf0e2c8, { emissive: 0x000000 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 2.6), winGlowMat);
  frame.position.set(faceX, 1.45, pz);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 2.3), mat(0x9fc8d8, { roughness: 0.35 }));
  glass.position.set(faceX + streetSide * 0.04, 1.45, pz);
  g.add(frame, glass);
  g.userData.winGlowMat = winGlowMat;

  // shutters flanking the main window
  const shutMat = mat(PALETTE.shutter);
  for (const sz of [-1, 1]) {
    const shut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.5), shutMat);
    shut.position.set(faceX + streetSide * 0.08, 1.45, pz + sz * 1.55);
    g.add(shut);
  }

  // second-floor window pair (visual only)
  const upMat = mat(0xcfe4ee, { roughness: 0.4 });
  for (const sz of [-1, 1]) {
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.9), upMat);
    w2.position.set(faceX + streetSide * 0.02, 3.1, pz + sz * 1.5);
    g.add(w2);
  }

  // wind chimes on the porch corner
  const chime = new THREE.Group();
  chime.position.set(spec.porch.x - streetSide * 1.0, 1.15, pz + spec.porch.d / 2 - 0.4);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), mat(PALETTE.post));
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
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), mat(PALETTE.trunk));
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);
  const leafColor = PALETTE.leaves[variant % 3];
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), mat(leafColor));
  c1.position.y = 2.3;
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), mat(leafColor));
  c2.position.y = 3.4;
  c2.castShadow = true;
  const c3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat(leafColor));
  c3.position.y = 4.3;
  c3.castShadow = true;
  g.add(c1, c2, c3);
  g.scale.setScalar(s);
  return g;
}

export function createFence(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(0xb8a888);
  for (let i = 0; i < 7; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wood);
    post.position.set(0, 0.45, -12 + i * 4);
    post.castShadow = true;
    g.add(post);
  }
  for (const ry of [0.35, 0.7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 24), wood);
    rail.position.set(0, ry, 0);
    g.add(rail);
  }
  return g;
}

export function createBush(seed: number): THREE.Group {
  const g = new THREE.Group();
  const leaf = PALETTE.leaves[seed % 3];
  const n = 2 + (seed % 2);
  for (let i = 0; i < n; i++) {
    const s = 0.5 + ((seed + i) % 3) * 0.25;
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(leaf));
    b.position.set(i * 0.7 - 0.35, s / 2, i * 0.45 - 0.2);
    b.castShadow = true;
    g.add(b);
  }
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
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mat(PALETTE.skin));
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
