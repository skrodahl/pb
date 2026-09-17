import { tallyFrom } from '../src/sim/economy';
import { initHouses } from '../src/sim/houses';
import { DAY_1 } from '../src/data/days/day1';

test('tally sums house points into the day score', () => {
  const houses = initHouses(DAY_1);
  houses[0] = { ...houses[0], state: 'clean', pts: 250 };
  houses[1] = { ...houses[1], state: 'late', pts: 50 };
  const stopped = houses.find((h) => h.spec.role === 'stopped')!;
  stopped.state = 'smashed';
  stopped.pts = 200;
  houses[3] = { ...houses[3], state: 'missed' };
  const t = tallyFrom(houses, 2);
  expect(t.score).toBe(500);
  expect(t.clean).toBe(1);
  expect(t.late).toBe(1);
  expect(t.smashed).toBe(1);
  expect(t.missed).toBe(1);
  expect(t.lost).toBe(2);
});
