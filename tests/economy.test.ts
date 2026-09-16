import { tallyFrom, PAY } from '../src/sim/economy';
import { initHouses } from '../src/sim/houses';
import { DAY_1 } from '../src/data/days/day1';

test('tally sums earnings and fines', () => {
  const houses = initHouses(DAY_1);
  houses[0] = { ...houses[0], state: 'clean', pay: PAY.clean };
  houses[1] = { ...houses[1], state: 'late', pay: PAY.late };
  houses[2] = { ...houses[2], state: 'wrong', pay: PAY.wrong };
  houses[3] = { ...houses[3], state: 'missed', pay: PAY.missed };
  const t = tallyFrom(houses, 2, 1);
  expect(t.earned).toBe(PAY.clean + PAY.late);
  expect(t.fined).toBe(3 + 2 + 2 * 1 + 1 * 1);
  expect(t.net).toBe(t.earned - t.fined);
  expect(t.lost).toBe(2);
  expect(t.hits).toBe(1);
});
