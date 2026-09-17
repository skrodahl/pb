import { initHouses, stepHouses, resolveDelivery, resolveSmash } from '../src/sim/houses';
import { DAY_1 } from '../src/data/days/day1';
import type { SimEvent } from '../src/sim/types';

test('in-window clean delivery pays base + precision bonus', () => {
  const houses = initHouses(DAY_1);
  const h = houses[0]; // window [20,80]
  expect(resolveDelivery(h, 30, 1)).toBe(250); // 100 + 150
  expect(h.state).toBe('clean');
  const h2 = initHouses(DAY_1)[0];
  expect(resolveDelivery(h2, 30, 0)).toBe(100); // grazed the window band
});

test('out-of-window delivery is late', () => {
  const h = initHouses(DAY_1)[1]; // window [60,120]
  expect(resolveDelivery(h, 140, 1)).toBe(50);
  expect(h.state).toBe('late');
});

test('smashing a stopped house pays the breakage bonus', () => {
  const h = initHouses(DAY_1).find((x) => x.spec.role === 'stopped')!;
  expect(resolveSmash(h)).toBe(200);
  expect(h.state).toBe('smashed');
});

test('window expiry marks subscribers missed (stopped houses never miss)', () => {
  const houses = initHouses(DAY_1);
  const events: SimEvent[] = [];
  stepHouses(houses, 90, (e) => events.push(e)); // house 0 window [20,80] closed
  expect(houses[0].state).toBe('missed');
  const stopped = houses.find((h) => h.spec.role === 'stopped')!;
  expect(stopped.state).toBe('pending');
  expect(events).toEqual([{ type: 'missed', houseIndex: 0 }]);
});
