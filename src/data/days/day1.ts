import type { DayConfig, HouseSpec } from '../../sim/types';

// C-layout: the delivery lane is the LEFT — every cottage is a route stop.
// The RIGHT side is town scenery: apartment blocks (a few take the paper),
// fields, a sheep meadow, and a windmill at the turnaround.
// role: sub = deliver in-window, stopped = smash target, none = scenery.
const L: HouseSpec[] = [
  { pos: [-11, 30], customer: 'Hargitay', role: 'sub', window: [20, 80], porch: { x: -6.2, z: 30, w: 2.8, d: 4.4 } },
  { pos: [-11, 60], customer: 'Miller', role: 'sub', window: [60, 120], porch: { x: -6.2, z: 60, w: 2.8, d: 4.4 } },
  { pos: [-11, 90], customer: 'Okafor', role: 'stopped', window: [0, 0], porch: { x: -6.2, z: 90, w: 2.8, d: 4.4 } },
  { pos: [-11, 120], customer: 'Delgado', role: 'sub', window: [140, 200], porch: { x: -6.2, z: 120, w: 2.8, d: 4.4 } },
  { pos: [-11, 150], customer: 'Kim', role: 'sub', window: [180, 240], porch: { x: -6.2, z: 150, w: 2.8, d: 4.4 } },
  { pos: [-11, 180], customer: 'Novak', role: 'stopped', window: [0, 0], porch: { x: -6.2, z: 180, w: 2.8, d: 4.4 } },
  { pos: [-11, 210], customer: 'Bishop', role: 'sub', window: [260, 320], porch: { x: -6.2, z: 210, w: 2.8, d: 4.4 } },
  { pos: [-11, 235], customer: 'Tanaka', role: 'sub', window: [300, 360], porch: { x: -6.2, z: 235, w: 2.8, d: 4.4 } },
];

const R: HouseSpec[] = [
  { pos: [11, 75], customer: 'Alvarez', role: 'sub', kind: 'apartment', window: [100, 160], porch: { x: 6.2, z: 75, w: 2.8, d: 4.4 } },
  { pos: [11, 135], customer: 'Cho', role: 'stopped', kind: 'apartment', window: [0, 0], porch: { x: 6.2, z: 135, w: 2.8, d: 4.4 } },
  { pos: [11, 195], customer: 'Reyes', role: 'sub', kind: 'apartment', window: [240, 300], porch: { x: 6.2, z: 195, w: 2.8, d: 4.4 } },
];

export const DAY_1: DayConfig = {
  id: 'day1',
  name: 'Tuesday',
  time: { start: 420, length: 480 },
  houses: [...L, ...R],
  obstacles: {
    crossZ: [105, 165],
    crossEvery: [7, 5],
    skaterEvery: [25, 40],
    rcEvery: [35, 55],
    seed: 7,
  },
  bundles: [
    [-3.0, 60],
    [3.0, 120],
    [-3.0, 180],
    [3.0, 232],
  ],
  weather: { rainAfter: 260, windBefore: [0.8, 0.4], windRain: [3.5, 2.0] },
};
