import { mulberry32 } from '../src/core/rng';

test('deterministic per seed', () => {
  const a = mulberry32(7), b = mulberry32(7), c = mulberry32(8);
  const ra = [a(), a(), a()], rb = [b(), b(), b()], rc = [c(), c()];
  expect(ra).toEqual(rb);
  expect(ra[0]).not.toBe(rc[0]);
});

test('outputs in [0,1)', () => {
  const r = mulberry32(1234);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
