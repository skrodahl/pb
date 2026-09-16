import { initHouses, stepHouses, deliverHouse } from '../src/sim/houses';
import { DAY_1 } from '../src/data/days/day1';
import type { SimEvent } from '../src/sim/types';

test('clean delivery in window pays full (wet when raining)', () => {
  const houses = initHouses(DAY_1);
  const h = houses[0]; // window [20,40]
  expect(deliverHouse(h, 30, false).pay).toBe(5);
  expect(h.state).toBe('clean');
  const h2 = { ...h };
  h2.state = 'pending';
  expect(deliverHouse(h2, 30, true).pay).toBe(2.5);
});

test('out-of-window delivery is late', () => {
  const h = initHouses(DAY_1)[1]; // window [65,85]
  expect(deliverHouse(h, 90, false).pay).toBe(2);
  expect(h.state).toBe('late');
});

test('delivering to a non-subscriber is wrong', () => {
  const h = initHouses(DAY_1).find((x) => !x.spec.subscribes)!;
  const r = deliverHouse(h, h.spec.window[0], false);
  expect(r.kind).toBe('wrong');
  expect(r.pay).toBe(-3);
});

test('window expiry marks missed + event', () => {
  const houses = initHouses(DAY_1);
  const events: SimEvent[] = [];
  stepHouses(houses, 45, (e) => events.push(e)); // house 0 window [20,40] closed
  expect(houses[0].state).toBe('missed');
  expect(events).toEqual([{ type: 'missed', houseIndex: 0 }]);
});
