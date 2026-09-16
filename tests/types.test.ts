import { DAY_1 } from '../src/data/days/day1';

test('day1 shape', () => {
  expect(DAY_1.houses).toHaveLength(16);
  for (const h of DAY_1.houses) {
    expect(Math.abs(h.porch.x)).toBeCloseTo(6.2);
    expect(h.porch.z).toBe(h.pos[1]);
    expect(h.window[1]).toBe(h.window[0] + 20);
    expect(h.window[1]).toBeLessThan(DAY_1.time.length);
  }
  expect(DAY_1.houses.filter((h) => !h.subscribes)).toHaveLength(3);
});
