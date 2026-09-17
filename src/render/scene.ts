import * as THREE from 'three';
import type { DayConfig, Paper } from '../sim/types';
import { ROUTE_LEN } from '../sim/types';
import type { GameSim } from '../sim/sim';
import {
  PALETTE,
  mat,
  createHouse,
  createApartment,
  createTree,
  createFence,
  createBush,
  createMailbox,
  createScarecrow,
  createCropRow,
  createSheep,
  createWindmill,
  createBundle,
  createSkater,
  createRcCar,
  createBee,
  createCar,
  createBikeRider,
  createPaperMesh,
} from './models';
import { buildSkydome, updateSky } from './sky';

export function makeRoadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#343a45';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#3c4350' : '#2c313b';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.fillStyle = '#d8d8c8';
  for (let y = 8; y < 128; y += 42) ctx.fillRect(62, y, 4, 24); // center dashes
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 12);
  tex.anisotropy = 4;
  return tex;
}

export class WorldScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  skydome: THREE.Mesh;
  houseGroups: THREE.Group[] = [];
  winGlows: THREE.MeshStandardMaterial[] = [];
  chimes: THREE.Group[] = [];
  carMeshes: THREE.Group[] = [];
  carAssign = new Map<number, number>(); // car id -> pool index
  skaterMeshes: THREE.Group[] = [];
  rcMeshes: THREE.Group[] = [];
  beeMeshes: THREE.Group[] = [];
  sheep: THREE.Group[] = [];
  private windmillBlades: THREE.Group | null = null;
  bike: THREE.Group;
  paperMeshes: THREE.Mesh[] = [];
  birds: THREE.Group[] = [];
  groundMat: THREE.MeshStandardMaterial;
  roadMat: THREE.MeshStandardMaterial;
  private time = 0;
  private sunOff: [number, number, number] = [-45, 30, 20];

  constructor(canvas: HTMLCanvasElement, cfg: DayConfig) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf0c898, 55, 170);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.camera.position.set(0, 4.5, -6);
    this.camera.lookAt(0, 1.2, 30);

    // lights
    this.sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
    this.sun.position.set(-45, 30, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(4096);
    const sc = this.sun.shadow.camera;
    sc.left = -150;
    sc.right = 150;
    sc.top = 150;
    sc.bottom = -150;
    sc.near = 1;
    sc.far = 230;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target, new THREE.HemisphereLight(0xbfd9f2, 0x5d944f, 0.62));

    // ground
    this.groundMat = mat(PALETTE.grass, { roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 340), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 120;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // road + sidewalks + curbs
    this.roadMat = mat(0xffffff, { map: makeRoadTexture(), roughness: 0.95 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, ROUTE_LEN + 20), this.roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 120);
    road.receiveShadow = true;
    this.scene.add(road);
    const sideMat = mat(PALETTE.sidewalk);
    for (const sx of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, ROUTE_LEN + 20), sideMat);
      walk.position.set(sx * 5.4, 0.05, 120);
      walk.receiveShadow = true;
      this.scene.add(walk);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, ROUTE_LEN + 20), mat(PALETTE.curb));
      curb.position.set(sx * 4.5, 0.07, 120);
      this.scene.add(curb);
    }

    // houses + props (apartments reuse the cottage catch column at ground floor)
    const sx = (spec: { pos: [number, number] }) => (spec.pos[0] > 0 ? 1 : -1);
    cfg.houses.forEach((spec, i) => {
      const h = spec.kind === 'apartment' ? createApartment(spec, i) : createHouse(spec, i);
      this.houseGroups.push(h);
      this.winGlows.push(h.userData.winGlowMat as THREE.MeshStandardMaterial);
      const chime = h.userData.chime as THREE.Group | undefined;
      if (chime) this.chimes.push(chime);
      this.scene.add(h);
      if (spec.role !== 'none') {
        const box = createMailbox(spec.role === 'stopped');
        box.position.set(spec.porch.x * 1.15, 0, spec.porch.z - 2.6);
        this.scene.add(box);
      }
      // yard dressing: fence run along the lot front, bushes between lots
      const fence = createFence();
      fence.position.set(sx(spec) * 12.8, 0, spec.porch.z + 15);
      this.scene.add(fence);
      for (let b = 0; b < 3; b++) {
        const bush = createBush(i * 3 + b + (sx(spec) > 0 ? 0 : 5));
        bush.position.set(sx(spec) * (9.5 + ((i + b) % 3) * 1.6), 0, spec.porch.z + 5 + b * 8);
        this.scene.add(bush);
      }
    });

    // trees: left row along the whole route; right row only past the apartments
    for (let i = 0; i < 12; i++) {
      const tree = createTree(i + 2);
      tree.position.set(-13.5, 0, 20 + i * 20);
      this.scene.add(tree);
      if (i < 4) {
        const tr = createTree(i + 1);
        tr.position.set(13.5, 0, 20 + i * 20);
        this.scene.add(tr);
      }
    }

    // right-side town scenery: fields, a sheep meadow, windmill at the turnaround
    for (const z of [100, 115]) {
      const row = createCropRow();
      row.position.set(17, 0, z);
      this.scene.add(row);
    }
    const scarecrow = createScarecrow();
    scarecrow.position.set(21, 0, 105);
    this.scene.add(scarecrow);
    for (let i = 0; i < 4; i++) {
      const s = createSheep();
      const [sx, sz] = [
        [15, 158],
        [19, 168],
        [15, 178],
        [21, 188],
      ][i];
      s.position.set(sx, 0, sz);
      s.rotation.y = i * 1.3;
      this.sheep.push(s);
      this.scene.add(s);
    }
    const mill = createWindmill();
    mill.position.set(17, 0, 236);
    this.scene.add(mill);
    this.windmillBlades = mill.userData.blades as THREE.Group;

    // intersections: cross-street band + zebra stripes
    for (const z of [105, 195]) {
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(56, 8), mat(0x3a3f48));
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(0, 0.005, z);
      cross.receiveShadow = true;
      this.scene.add(cross);
      for (let s = 0; s < 6; s++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 3.4), mat(0xd8d8c8));
        stripe.position.set(-3.2 + s * 1.3, 0.03, z);
        this.scene.add(stripe);
      }
    }

    // paper bundles: ride over to restock
    for (const [bx, bz] of cfg.bundles) {
      const b = createBundle();
      b.position.set(bx, 0, bz);
      this.scene.add(b);
    }

    // obstacle pools: skaters, RC cars, bee swarm
    for (let i = 0; i < 2; i++) {
      const sk = createSkater();
      sk.visible = false;
      this.scene.add(sk);
      this.skaterMeshes.push(sk);
      const rc = createRcCar();
      rc.visible = false;
      this.scene.add(rc);
      this.rcMeshes.push(rc);
    }
    for (let k = 0; k < 4; k++) {
      const bee = createBee();
      bee.visible = false;
      this.scene.add(bee);
      this.beeMeshes.push(bee);
    }

    // birds
    for (let i = 0; i < 3; i++) this.scene.add((this.birds[i] = this.makeBird(i)));

    // dynamic pools
    for (let i = 0; i < 6; i++) {
      const car = createCar(i);
      car.visible = false;
      this.scene.add(car);
      this.carMeshes.push(car);
    }
    this.bike = createBikeRider();
    this.scene.add(this.bike);
    for (let i = 0; i < 40; i++) {
      const p = createPaperMesh();
      p.visible = false;
      this.scene.add(p);
      this.paperMeshes.push(p);
    }

    this.skydome = buildSkydome(this.scene);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private makeBird(i: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 4), mat(0x2a2f3a));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const wingGeo = new THREE.PlaneGeometry(0.9, 0.3);
    const wingMat = mat(0x2a2f3a, { side: THREE.DoubleSide });
    const w1 = new THREE.Mesh(wingGeo, wingMat);
    w1.position.x = -0.45;
    const w2 = new THREE.Mesh(wingGeo.clone(), wingMat);
    w2.position.x = 0.45;
    g.add(w1, w2);
    g.userData = { wingL: w1, wingR: w2, phase: i * 2.1, r: 45 + i * 12, y: 26 + i * 5 };
    return g;
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---- per-frame sync -------------------------------------------------

  updateBike(sim: GameSim, dt: number): void {
    const r = sim.rider;
    this.bike.position.set(r.x, 0, r.z);
    // binary steer yaw: the bike angles into the turn; the rider counterweights
    const turning = r.steer !== 0 && r.speed > 0.1;
    const yaw = turning ? -Math.sign(r.steer) * 0.35 : 0;
    this.bike.rotation.y = (r.heading === 1 ? 0 : Math.PI) + yaw;
    this.bike.rotation.z = turning ? -Math.sign(yaw) * 0.12 : 0; // lean into the turn
    const stack = this.bike.userData.stack as THREE.Group;
    stack.children.forEach((p, i) => (p.visible = sim.held > i));
    const riderG = this.bike.userData.rider as THREE.Group;
    riderG.rotation.z = turning ? Math.sign(yaw) * 0.06 : 0; // counterweight: opposite of the lean
    for (const p of this.bike.userData.wheels as THREE.Group[]) {
      p.rotation.x -= (r.speed / 0.35) * dt;
    }
    // shadow light + camera follow the rider (frustum stays centered on view)
    const [ox, oy, oz] = this.sunOff;
    this.sun.position.set(r.x + ox, oy, r.z + oz);
    this.sun.target.position.set(0, 0, r.z);
  }

  updateObstacles(sim: GameSim): void {
    const active = sim.obstacles.cars.filter((c) => c.active);
    for (const [id, idx] of this.carAssign) {
      if (!active.some((c) => c.id === id)) {
        this.carMeshes[idx].visible = false;
        this.carAssign.delete(id);
      }
    }
    active.forEach((car, k) => {
      let idx = this.carAssign.get(car.id);
      if (idx === undefined || this.carMeshes[idx].visible === false) {
        idx = this.carMeshes.findIndex((m) => !m.visible);
        if (idx === -1) idx = k % this.carMeshes.length;
        this.carAssign.set(car.id, idx);
        this.carMeshes[idx].visible = true;
      }
      const m = this.carMeshes[idx];
      m.position.set(car.x, 0, car.z);
      m.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2; // crossing perpendicular
      void k;
    });
    const skActive = sim.obstacles.skaters.filter((s) => s.active);
    this.skaterMeshes.forEach((m, i) => {
      const s = skActive[i];
      m.visible = s !== undefined;
      if (s) {
        m.position.set(s.x, 0, s.z);
        m.rotation.y = s.z > sim.rider.z ? Math.PI : 0; // rides toward the rider
      }
    });
    const rcActive = sim.obstacles.rccars.filter((c) => c.active);
    this.rcMeshes.forEach((m, i) => {
      const c = rcActive[i];
      m.visible = c !== undefined;
      if (c) {
        m.position.set(c.x, 0, c.z);
        m.rotation.y = -Math.PI / 2; // crosses in -x
      }
    });
    sim.bees.bees.forEach((b, i) => {
      const m = this.beeMeshes[i];
      m.visible = sim.bees.active;
      if (sim.bees.active) {
        m.position.set(b.x, 1.4 + Math.sin(this.time * 9 + b.phase) * 0.25, b.z);
      }
    });
  }

  updatePapers(sim: GameSim): void {
    const t = this.time;
    sim.papers.forEach((p: Paper, i: number) => {
      const m = this.paperMeshes[i % this.paperMeshes.length];
      if (p.state === 'gone') {
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      if (p.state === 'flying') {
        m.rotation.x = Math.sin(t * 7 + p.id) * 0.5;
        m.rotation.z = Math.cos(t * 5 + p.id) * 0.5;
      } else {
        m.rotation.set(0, 0, 0);
      }
    });
    for (let i = sim.papers.length; i < this.paperMeshes.length; i++) {
      this.paperMeshes[i].visible = false;
    }
  }

  updateWindowMarks(sim: GameSim): void {
    const target = sim.nextTarget();
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 4);
    this.winGlows.forEach((m, i) => {
      if (i === target) {
        m.emissive.setHex(0xff9020);
        m.emissiveIntensity = pulse;
      } else {
        m.emissive.setHex(0x000000);
      }
    });
  }

  updateChimes(t: number, wind: [number, number]): void {
    const k = 0.4 + Math.hypot(wind[0], wind[1]) / 8;
    this.chimes.forEach((chime, i) => {
      chime.rotation.x = Math.sin(t * 3 + i) * 0.25 * k;
      chime.rotation.z = Math.cos(t * 2.3 + i * 1.7) * 0.2 * k;
    });
  }

  updateBirds(t: number): void {
    for (const bird of this.birds) {
      const u = bird.userData as { wingL: THREE.Mesh; wingR: THREE.Mesh; phase: number; r: number; y: number };
      const a = t * 0.12 + u.phase;
      bird.position.set(Math.cos(a) * u.r, u.y + Math.sin(t + u.phase) * 1.5, 120 + Math.sin(a) * u.r);
      bird.rotation.y = -a;
      const flap = Math.sin(t * 6 + u.phase) * 0.6;
      u.wingL.rotation.y = flap;
      u.wingR.rotation.y = -flap;
    }
  }

  setSun(clockMin: number, dayLength: number): void {
    const day = Math.max(0, Math.min(1, clockMin / dayLength));
    updateSky(this.skydome, day, this.scene);
    this.sunOff = [-45 + 25 * day, 30 + 40 * day, 20];
    this.sun.intensity = 1.6 + day * 0.5;
  }

  tick(dt: number): void {
    this.time += dt;
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.8;
    this.sheep.forEach((s, i) => {
      const head = s.userData.head as THREE.Mesh;
      head.position.y = 0.5 + Math.sin(this.time * 2 + i * 1.7) * 0.04;
      head.rotation.x = Math.sin(this.time * 0.5 + i * 2.1) * 0.35;
    });
    this.beeMeshes.forEach((m, i) => {
      const u = m.userData as { wingL: THREE.Mesh; wingR: THREE.Mesh };
      const flap = Math.sin(this.time * 30 + i) * 0.8;
      u.wingL.rotation.x = flap;
      u.wingR.rotation.x = -flap;
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
