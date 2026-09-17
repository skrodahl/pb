import * as THREE from 'three';
import type { DayConfig, Paper } from '../sim/types';
import { ROUTE_LEN } from '../sim/types';
import type { GameSim } from '../sim/sim';
import {
  PALETTE,
  mat,
  createHouse,
  createTree,
  createMailbox,
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
  porchPads: THREE.Mesh[] = [];
  chimes: THREE.Group[] = [];
  carMeshes: THREE.Group[] = [];
  carAssign = new Map<number, number>(); // car id -> pool index
  bike: THREE.Group;
  paperMeshes: THREE.Mesh[] = [];
  birds: THREE.Group[] = [];
  groundMat: THREE.MeshStandardMaterial;
  roadMat: THREE.MeshStandardMaterial;
  private time = 0;

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
    this.scene.fog = new THREE.Fog(0xf0c898, 40, 220);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    this.camera.position.set(0, 4.5, -6);
    this.camera.lookAt(0, 1.2, 30);

    // lights
    this.sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
    this.sun.position.set(-45, 30, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.far = 150;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target, new THREE.HemisphereLight(0xbfd9f2, 0x5d944f, 0.5));

    // ground
    this.groundMat = mat(PALETTE.grass, { roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), this.groundMat);
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

    // houses + props
    cfg.houses.forEach((spec, i) => {
      const h = createHouse(spec, i);
      this.houseGroups.push(h);
      this.porchPads.push(h.userData.pad);
      this.chimes.push(h.userData.chime);
      this.scene.add(h);
      const box = createMailbox();
      box.position.set(spec.porch.x * 1.15, 0, spec.porch.z - 2.6);
      this.scene.add(box);
    });

    // trees: two rows
    for (let i = 0; i < 12; i++) {
      for (const sx of [-1, 1]) {
        const tree = createTree(i + (sx > 0 ? 1 : 2));
        tree.position.set(sx * 13.5, 0, 20 + i * 20);
        this.scene.add(tree);
      }
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

  updateBike(sim: GameSim): void {
    const r = sim.rider;
    this.bike.position.set(r.x, 0, r.z);
    this.bike.rotation.y = r.heading === 1 ? 0 : Math.PI;
    const stack = this.bike.userData.stack as THREE.Group;
    stack.children.forEach((p, i) => (p.visible = sim.held > i));
    // shadow camera follows the rider
    this.sun.target.position.set(0, 0, r.z);
  }

  updateCars(sim: GameSim): void {
    const active = sim.traffic.cars.filter((c) => c.active);
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
      m.rotation.y = car.dir === 1 ? 0 : Math.PI;
      void k;
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

  updatePorchMarks(sim: GameSim): void {
    const target = sim.nextTarget();
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 4);
    this.porchPads.forEach((pad, i) => {
      const m = pad.material as THREE.MeshStandardMaterial;
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
    this.sun.position.set(-45 + 25 * day, 30 + 40 * day, 20);
    this.sun.intensity = 1.6 + day * 0.5;
  }

  tick(dt: number): void {
    this.time += dt;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
