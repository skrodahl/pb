import { WeatherSim } from '../src/sim/weather';
import type { SimEvent } from '../src/sim/types';

const cfg = {
  rainAfter: 10,
  windBefore: [0.8, 0.4] as [number, number],
  windRain: [3.5, 2.0] as [number, number],
};

test('rain starts exactly at rainAfter, once', () => {
  const w = new WeatherSim(cfg);
  const events: SimEvent[] = [];
  w.step(9.9, (e) => events.push(e));
  expect(w.raining).toBe(false);
  w.step(10, (e) => events.push(e));
  expect(w.raining).toBe(true);
  w.step(10.5, (e) => events.push(e));
  expect(events.filter((e) => e.type === 'rain_start')).toHaveLength(1);
  expect(w.wind).toEqual([3.5, 2.0]);
});
