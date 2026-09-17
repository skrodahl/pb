import { newRider, stepRider, landingPoint } from '../src/sim/rider';
import { ASSIST_X } from '../src/sim/types';
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

test('steering is screen-relative: D moves toward -x on the outbound leg (not charging)', () => {
  const r = newRider();
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeLessThanOrEqual(-3.1);
  expect(r.x).toBeGreaterThanOrEqual(-3.2);
});

test('steering flips with heading on the return leg (not charging)', () => {
  const r = newRider();
  r.heading = -1;
  r.z = 100;
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeGreaterThanOrEqual(3.1);
});

test('charging holds the lane: x does not drift while aiming', () => {
  const r = newRider();
  r.x = 1.5;
  for (let i = 0; i < 120; i++) stepRider(r, 1 / 60, act({ throwHeld: true, steer: 1 }));
  expect(r.x).toBeCloseTo(1.5, 5);
});

test('assistent aim: no steer pulls aim toward the assist side', () => {
  const r = newRider();
  for (let i = 0; i < 120; i++) stepRider(r, 1 / 60, act({ throwHeld: true }), -ASSIST_X);
  expect(r.aim).toBeLessThan(-2); // 0.25 * -9 = -2.25 target
});

test('charge ramps 0..1; charge curve is soft (half charge ~ 9.3 m)', () => {
  const r = newRider();
  for (let i = 0; i < 60; i++) stepRider(r, 1 / 60, act({ throwHeld: true }));
  expect(r.charge).toBeCloseTo(1, 1);
  r.charge = 0.5;
  expect(landingPoint(r).z - r.z).toBeCloseTo(4 + 14 * Math.pow(0.5, 1.4), 1);
  r.charge = 1;
  expect(landingPoint(r).z - r.z).toBeCloseTo(18, 1);
});

test('stagger freezes speed and aim', () => {
  const r = newRider();
  r.stagger = 1.2;
  r.speed = 9;
  stepRider(r, 1 / 60, act({ throttle: true, steer: 1 }));
  expect(r.speed).toBe(0);
  expect(r.stagger).toBeCloseTo(1.2 - 1 / 60, 3);
});
