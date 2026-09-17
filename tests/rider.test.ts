import { newRider, stepRider } from '../src/sim/rider';
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

test('brake eases down to the cruise speed, never below it', () => {
  const r = newRider();
  r.speed = 9;
  for (let i = 0; i < 60; i++) stepRider(r, 1 / 60, act({ brake: true }));
  expect(r.speed).toBeCloseTo(5, 1);
});

test('coasting relaxes back to the cruise speed; the bike never fully stops', () => {
  const r = newRider();
  r.speed = 0;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act());
  expect(r.speed).toBeCloseTo(5, 1);
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

test('steering is screen-relative: D moves toward -x on the outbound leg', () => {
  const r = newRider();
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeLessThanOrEqual(-3.1);
  expect(r.x).toBeGreaterThanOrEqual(-3.2);
});

test('steering flips with heading on the return leg', () => {
  const r = newRider();
  r.heading = -1;
  r.z = 100;
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeGreaterThanOrEqual(3.1);
});

test('rider.steer mirrors the input every step (for the render yaw)', () => {
  const r = newRider();
  stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.steer).toBe(1);
  stepRider(r, 1 / 60, act({ steer: -1 }));
  expect(r.steer).toBe(-1);
  stepRider(r, 1 / 60, act());
  expect(r.steer).toBe(0);
});

test('stagger freezes speed and steer', () => {
  const r = newRider();
  r.stagger = 1.2;
  r.speed = 9;
  stepRider(r, 1 / 60, act({ throttle: true, steer: 1 }));
  expect(r.speed).toBe(0);
  expect(r.stagger).toBeCloseTo(1.2 - 1 / 60, 3);
});
