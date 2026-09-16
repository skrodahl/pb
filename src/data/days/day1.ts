import type { DayConfig } from '../../sim/types';

const NAMES_L = [
  'Hargitay',
  'Miller',
  'Okafor',
  'Delgado',
  'Kim',
  'Novak',
  'Bishop',
  'Tanaka',
];
const NAMES_R = [
  'Alvarez',
  'Cho',
  'Reyes',
  'Whitfield',
  'Osei',
  'Lindqvist',
  'Marsh',
  'Petrov',
];
const NO_SUB = new Set(['Okafor', 'Novak', 'Reyes']);

export const DAY_1: DayConfig = {
  id: 'day1',
  name: 'Tuesday',
  time: { start: 420, length: 480 },
  houses: [
    ...NAMES_L.map((c, i) => ({
      pos: [-11, 30 + i * 30] as [number, number],
      customer: c,
      subscribes: !NO_SUB.has(c),
      window: [20 + i * 45, 40 + i * 45] as [number, number],
      porch: { x: -6.2, z: 30 + i * 30, w: 2.8, d: 4.4 },
    })),
    ...NAMES_R.map((c, i) => ({
      pos: [11, 30 + i * 30] as [number, number],
      customer: c,
      subscribes: !NO_SUB.has(c),
      window: [30 + i * 45, 50 + i * 45] as [number, number],
      porch: { x: 6.2, z: 30 + i * 30, w: 2.8, d: 4.4 },
    })),
  ],
  traffic: { interval: 10, jitter: 5, speed: 7, seed: 7 },
  weather: { rainAfter: 260, windBefore: [0.8, 0.4], windRain: [3.5, 2.0] },
};
