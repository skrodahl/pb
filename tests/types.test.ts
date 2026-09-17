import { DAY_1 } from '../src/data/days/day1';

test('day1 shape: 8 left cottages + 3 right apartments, C-layout roles', () => {
  expect(DAY_1.houses).toHaveLength(11);
  for (const h of DAY_1.houses) {
    expect(Math.abs(h.porch.x)).toBeCloseTo(6.2);
    expect(h.porch.z).toBe(h.pos[1]);
    if (h.role === 'sub') expect(h.window[1]).toBeGreaterThan(h.window[0]);
  }
  const left = DAY_1.houses.filter((h) => h.pos[0] < 0);
  const right = DAY_1.houses.filter((h) => h.pos[0] > 0);
  expect(left).toHaveLength(8);
  expect(right).toHaveLength(3);
  expect(right.every((h) => h.kind === 'apartment')).toBe(true);
  expect(DAY_1.houses.filter((h) => h.role === 'sub')).toHaveLength(8);
  expect(DAY_1.houses.filter((h) => h.role === 'stopped')).toHaveLength(3);
});

test('day1 bundles and intersections are in route', () => {
  expect(DAY_1.bundles).toHaveLength(4);
  for (const [x, z] of DAY_1.bundles) {
    expect(Math.abs(x)).toBeCloseTo(3.0, 1);
    expect(z).toBeGreaterThanOrEqual(0);
    expect(z).toBeLessThanOrEqual(240);
  }
  expect(DAY_1.obstacles.crossZ).toEqual([105, 195]);
});
