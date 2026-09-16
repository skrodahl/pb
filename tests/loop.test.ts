import { FixedLoop } from '../src/core/loop';

test('fixed-step batching', () => {
  const loop = new FixedLoop(0.01, 0.1);
  let calls = 0;
  loop.frame(0.035, () => calls++);
  expect(calls).toBe(3);
  loop.frame(0.004, () => calls++);
  expect(calls).toBe(3);
  loop.frame(0.002, () => calls++);
  expect(calls).toBe(4);
});

test('frame clamped to maxFrame', () => {
  const loop = new FixedLoop(0.01, 0.1);
  let calls = 0;
  loop.frame(5, () => calls++);
  expect(calls).toBe(10);
});
