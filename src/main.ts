import { WorldScene } from './render/scene';
import { DAY_1 } from './data/days/day1';
import { GameSim } from './sim/sim';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const world = new WorldScene(canvas, DAY_1);
const sim = new GameSim(DAY_1, 7);
sim.clockMin = 20;

world.setSun(sim.clockMin, sim.config.time.length);
world.updateBike(sim);
world.updateCars(sim);
world.updatePapers(sim);
world.updatePorchMarks(sim);
world.updateChimes(0, [0.8, 0.4]);
world.updateBirds(0);
world.render();

(window as any).__pb = { world, sim };
