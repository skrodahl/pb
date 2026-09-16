import { WorldScene } from './render/scene';
import { ChaseCamera } from './render/camera';
import { RainFX } from './render/rain';
import { LandingMarker } from './render/marker';
import { PALETTE } from './render/models';
import { DAY_1 } from './data/days/day1';
import { GameSim } from './sim/sim';
import { FixedLoop } from './core/loop';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = new WorldScene(canvas, DAY_1);
let simRef = new GameSim(DAY_1, 7);
const camera = new ChaseCamera(world.camera);
const rain = new RainFX(world.scene, [
  { mat: world.groundMat, dry: PALETTE.grass, wet: PALETTE.grassWet },
]);
const marker = new LandingMarker(world.scene);
const loop = new FixedLoop(1 / 60, 0.1);

// keyboard stub (full input module lands in Task 13)
const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener(
  'keyup',
  (e) => {
    keys.delete(e.code);
  },
);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && simRef.done) {
    simRef = new GameSim(DAY_1, 7);
    rain.setRaining(false);
  }
});

let time = 0;
let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  loop.frame(dt, (sdt) => {
    const input = {
      throttle: keys.has('KeyW') || keys.has('ArrowUp'),
      brake: keys.has('KeyS') || keys.has('ArrowDown'),
      steer: ((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)) as -1 | 0 | 1,
      throwHeld: keys.has('Space'),
    };
    simRef.step(sdt, input);
    time += sdt;
    for (const e of simRef.drainEvents()) {
      if (e.type === 'rain_start') rain.setRaining(true);
      if (e.type === 'car_hit') camera.addShake(0.5);
    }
  });

  world.tick(dt);
  world.updateBike(simRef);
  world.updateCars(simRef);
  world.updatePapers(simRef);
  world.updatePorchMarks(simRef);
  world.updateChimes(time, simRef.weather.wind);
  world.updateBirds(time);
  world.setSun(simRef.clockMin, simRef.config.time.length);
  camera.update(dt, simRef);
  rain.update(dt, world.camera.position, simRef.weather.wind);
  marker.update(simRef, time);
  world.render();
}
frame();

(window as any).__pb = {
  get sim() {
    return simRef;
  },
  world,
  rain,
  chaseCam: camera,
  marker,
};
