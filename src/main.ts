import { WorldScene } from './render/scene';
import { ChaseCamera } from './render/camera';
import { RainFX } from './render/rain';
import { LandingMarker } from './render/marker';
import { PALETTE } from './render/models';
import { DAY_1 } from './data/days/day1';
import { GameSim } from './sim/sim';
import { FixedLoop } from './core/loop';
import { KeyboardInput } from './input/input';
import { AudioEngine } from './audio/engine';
import { createHud, minToTime } from './ui/hud';
import { showTitle, showBriefing, showTally } from './ui/screens';
import { debugState, applyDebug, autoInput } from './debug';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const world = new WorldScene(canvas, DAY_1);
const audio = new AudioEngine();
const input = new KeyboardInput();
input.attach(window);
const hudRoot = document.createElement('div');
const screensRoot = document.createElement('div');
uiRoot.append(hudRoot, screensRoot);
const hud = createHud(hudRoot);

const SEED = 7;
const DBG = debugState();

type GameState = 'title' | 'briefing' | 'riding' | 'tally';
let sim = new GameSim(DAY_1, SEED);
let state: GameState = 'title';
if (DBG) {
  state = 'riding';
  applyDebug(DBG, sim);
}
const chaseCam = new ChaseCamera(world.camera);
const rain = new RainFX(world.scene, [
  { mat: world.groundMat, dry: PALETTE.grass, wet: PALETTE.grassWet },
]);
const marker = new LandingMarker(world.scene);
const loop = new FixedLoop(1 / 60, 0.1);

// first user gesture unlocks audio
const unlock = () => {
  if (audio.ctxStarted) return;
  audio.ensure();
  audio.startMusic();
  audio.ctxStarted = true;
};
window.addEventListener('keydown', unlock, { once: false });
window.addEventListener('pointerdown', unlock, { once: true });

function enterBriefing(): void {
  state = 'briefing';
  hud.setEnabled(false);
  showBriefing(screensRoot, DAY_1);
}
function enterRiding(fresh: boolean): void {
  if (fresh) {
    sim = new GameSim(DAY_1, SEED);
    rain.setRaining(false);
    if (DBG) applyDebug(DBG, sim);
    audio.setRainMusic(false);
  }
  state = 'riding';
  screensRoot.innerHTML = '';
  hud.setEnabled(true);
}
function enterTally(): void {
  state = 'tally';
  hud.setEnabled(false);
  showTally(screensRoot, sim.tally());
}
if (state === 'title') showTitle(screensRoot);
else if (state === 'riding') enterRiding(false);

window.addEventListener('error', (e) => {
  (window as any).__errcount = ((window as any).__errcount ?? 0) + 1;
  void e;
});

let time = 0;
let last = performance.now();

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  if (input.consumePressed('Enter')) {
    const s = state as GameState;
    if (s === 'title') enterBriefing();
    else if (s === 'briefing') enterRiding(true);
    else if (s === 'tally') enterRiding(true);
  }

  loop.frame(dt, (sdt) => {
    if (state !== 'riding') return;
    let acts = input.readActions();
    if (DBG) acts = autoInput(DBG, time, acts);
    sim.step(sdt, acts);
    time += sdt;
    audio.chainTick(sim.rider.speed);
    for (const e of sim.drainEvents()) {
      switch (e.type) {
        case 'paper_thrown':
          audio.sfx('whoosh');
          break;
        case 'paper_landed':
          audio.sfx(e.kind === 'porch' ? 'thump' : 'bounce');
          break;
        case 'paper_hit_rider':
          audio.sfx('scatter');
          break;
        case 'car_hit':
          audio.sfx('crash');
          audio.sfx('scatter');
          chaseCam.addShake(0.5);
          break;
        case 'rain_start':
          rain.setRaining(true);
          audio.setRainMusic(true);
          break;
        case 'delivery':
          audio.sfx(e.kind === 'wrong' ? 'buzz' : 'ding');
          break;
        case 'missed':
          audio.sfx('buzz');
          break;
        case 'day_end':
          audio.sfx('jingle');
          enterTally();
          break;
      }
    }
    audio.setAmbience({ speed: sim.rider.speed, raining: sim.weather.raining });
  });

  world.tick(dt);
  world.updateBike(sim);
  world.updateCars(sim);
  world.updatePapers(sim);
  world.updatePorchMarks(sim);
  world.updateChimes(time, sim.weather.wind);
  world.updateBirds(time);
  world.setSun(sim.clockMin, sim.config.time.length);
  chaseCam.update(dt, sim);
  rain.update(dt, world.camera.position, sim.weather.wind);
  marker.update(sim, time);

  if (state === 'riding') {
    hud.setClock(DAY_1.time.start + sim.clockMin);
    hud.setNet(sim.tally().net);
    hud.setPapers(sim.held);
    hud.setCharge(sim.rider.charging ? sim.rider.charge : 0);
    const nt = sim.nextTarget();
    if (nt !== null) {
      const h = sim.houses[nt];
      const dist = Math.max(0, Math.round(Math.abs(h.spec.pos[1] - sim.rider.z)));
      const w0 = minToTime(DAY_1.time.start + h.spec.window[0]);
      const w1 = minToTime(DAY_1.time.start + h.spec.window[1]);
      hud.setNext(
        `${h.spec.customer} ${w0}–${w1}${h.spec.subscribes ? '' : ' (NO SUB)'} · ${dist}m`,
      );
    } else {
      hud.setNext(null);
    }
  }

  world.render();
}
frame();

(window as any).__pb = {
  get sim() {
    return sim;
  },
  get state() {
    return state;
  },
  world,
  rain,
  chaseCam,
  marker,
  audio,
  toRain() {
    sim.clockMin = sim.config.weather.rainAfter - 0.05;
  },
  toCharge() {
    sim.rider.charging = true;
    sim.rider.charge = 0.8;
  },
  toTally() {
    sim.clockMin = sim.config.time.length - 0.5;
  },
};
