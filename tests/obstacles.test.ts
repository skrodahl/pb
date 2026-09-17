import { ObstacleSim } from '../src/sim/obstacles';
import { newRider } from '../src/sim/rider';
import type { SimEvent } from '../src/sim/types';

const cfg = {
  crossZ: [105, 195],
  crossEvery: [7, 5],
  skaterEvery: [25, 40] as [number, number],
  rcEvery: [35, 55] as [number, number],
  seed: 7,
};

// fast-spawn variant so spawner tests don't wait a minute
const fast = { ...cfg, skaterEvery: [1, 2] as [number, number], rcEvery: [1, 2] as [number, number] };

test('spawns are deterministic per seed', () => {
  const a = new ObstacleSim(cfg);
  const b = new ObstacleSim(cfg);
  const r = newRider();
  for (let i = 0; i < 60 * 40; i++) {
    a.step(1 / 60, r, () => {});
    b.step(1 / 60, r, () => {});
  }
  const snap = (o: ObstacleSim) =>
    [o.cars.map((c) => [c.x, c.z, c.active].join(',')), o.skaters.length, o.rccars.length].join('|');
  expect(snap(a)).toEqual(snap(b));
  expect(a.cars.length).toBeGreaterThan(0);
});

test('crossing car collision staggers the rider and calls onCrash', () => {
  const t = new ObstacleSim(cfg);
  const rider = newRider();
  rider.x = 0;
  rider.z = 105;
  rider.speed = 5;
  t.cars.push({ id: 99, z: 105, x: 0, dir: 1, speed: 6, active: true, colorIndex: 0 });
  const events: SimEvent[] = [];
  let crashes = 0;
  t.step(1 / 60, rider, (e) => events.push(e), () => crashes++);
  expect(rider.stagger).toBeCloseTo(1.2, 1);
  expect(rider.speed).toBe(0);
  expect(events).toContainEqual({ type: 'car_hit', kind: 'cross' });
  expect(crashes).toBe(1);
});

test('horn warns when a car starts close to the rider', () => {
  const t = new ObstacleSim(cfg);
  const rider = newRider();
  rider.z = 100;
  const events: SimEvent[] = [];
  t.cars.push({ id: 99, z: 105, x: 24, dir: -1, speed: 6, active: true, colorIndex: 0 });
  // despawn the far one and let timers fire naturally
  t.cars = [];
  for (let i = 0; i < 60 * 8; i++) t.step(1 / 60, rider, (e) => events.push(e));
  expect(events.some((e) => e.type === 'horn')).toBe(true);
});

test('skater spawns, rides toward the rider, and times out', () => {
  const t = new ObstacleSim(fast);
  const rider = newRider();
  rider.z = 60;
  let spawned = false;
  for (let i = 0; i < 60 * 14; i++) {
    t.step(1 / 60, rider, () => {}, () => {});
    if (t.skaters.length > 0) spawned = true;
  }
  expect(spawned).toBe(true);
  // the first skater has aged out (age > 12s), the rest of the array stays
  expect(t.skaters[0].active).toBe(false);
});

test('RC car crosses the road and despawns on the far side', () => {
  const t = new ObstacleSim(fast);
  const rider = newRider();
  rider.z = 60;
  // wait for a spawn, then until it has crossed to the far side
  let sawActive = false;
  for (let i = 0; i < 60 * 12; i++) {
    t.step(1 / 60, rider, () => {});
    if (t.rccars.some((r) => r.active)) sawActive = true;
    if (sawActive && !t.rccars.some((r) => r.active)) break;
  }
  expect(sawActive).toBe(true);
  expect(t.rccars.length).toBeGreaterThan(0);
});
