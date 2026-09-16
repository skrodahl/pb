import { Traffic } from '../src/sim/traffic';
import { newRider } from '../src/sim/rider';
import { ROUTE_LEN } from '../src/sim/types';
import type { SimEvent } from '../src/sim/types';

const cfg = { interval: 4, jitter: 2, speed: 7, seed: 7 };

test('spawn is deterministic per seed', () => {
  const a = new Traffic(cfg);
  const b = new Traffic(cfg);
  const r = newRider();
  for (let i = 0; i < 300; i++) {
    a.step(1 / 60, r, () => {});
    b.step(1 / 60, r, () => {});
  }
  const snap = (t: Traffic) =>
    t.cars
      .filter((c) => c.active)
      .map((c) => [Math.round(c.z * 100), c.colorIndex].join(','))
      .join('|');
  expect(snap(a)).toEqual(snap(b));
  expect(a.cars.length).toBeGreaterThan(0);
});

test('car collides with centered rider', () => {
  const t = new Traffic(cfg);
  const rider = newRider();
  rider.x = 0;
  rider.z = 10;
  t.cars.push({ id: 99, x: 0, z: 11, dir: -1, speed: 7, active: true, colorIndex: 0 });
  const events: SimEvent[] = [];
  t.step(1 / 60, rider, (e) => events.push(e));
  expect(rider.stagger).toBeCloseTo(1.2, 1);
  expect(events).toContainEqual({ type: 'car_hit' });
});

test('cars despawn beyond route', () => {
  const t = new Traffic(cfg);
  t.cars.push({
    id: 1,
    x: 0,
    z: ROUTE_LEN + 10,
    dir: -1,
    speed: 7,
    active: true,
    colorIndex: 0,
  });
  t.step(1 / 60, newRider(), () => {});
  expect(t.cars[0].active).toBe(false);
});
