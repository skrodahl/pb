import { newRider, stepRider, landingPoint } from '../src/sim/rider';
import type { InputActions } from '../src/sim/types';

const act = (o: Partial<InputActions> = {}): InputActions => ({
  throttle: false,
  brake: false,
  steer: 0,
  throwHeld: false,
  ...o,
});

test('throttle accelerates up to max', () => {
  const r = newRider();
  for (let i = 0; i < 360; i++) stepRider(r, 1 / 60, act({ throttle: true }));
  expect(r.speed).toBeCloseTo(9, 1);
});

test('brake stops faster than drag', () => {
  const r = newRider();
  r.speed = 9;
  for (let i = 0; i < 60; i++) stepRider(r, 1 / 60, act({ brake: true }));
  expect(r.speed).toBeLessThan(1.5);
});

test('turnaround at both ends', () => {
  const r = newRider();
  r.z = 238;
  r.speed = 9;
  stepRider(r, 1 / 60, act());
  expect(r.heading).toBe(-1);
  r.heading = -1;
  r.z = 3;
  r.speed = 9;
  stepRider(r, 1 / 60, act());
  expect(r.heading).toBe(1);
});

test('steering clamps to road', () => {
  const r = newRider();
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeLessThanOrEqual(3.2);
  expect(r.x).toBeGreaterThanOrEqual(3.1);
});

test('charge ramps 0..1 and aim slides', () => {
  const r = newRider();
  for (let i = 0; i < 60; i++) stepRider(r, 1 / 60, act({ throwHeld: true, steer: 1 }));
  expect(r.charging).toBe(true);
  expect(r.charge).toBeCloseTo(1, 1);
  expect(r.aim).toBeGreaterThan(3);
  const lp = landingPoint(r);
  expect(lp.z).toBeGreaterThan(r.z + 17); // full power => ~18 m out
  expect(lp.x).toBeCloseTo(r.aim);
});

test('stagger freezes speed and aim', () => {
  const r = newRider();
  r.stagger = 1.2;
  r.speed = 9;
  stepRider(r, 1 / 60, act({ throttle: true, steer: 1 }));
  expect(r.speed).toBe(0);
  expect(r.stagger).toBeCloseTo(1.2 - 1 / 60, 3);
});
