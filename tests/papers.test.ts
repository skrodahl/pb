import { launchPaper, stepPapers, inPorch } from '../src/sim/papers';
import type { PaperWorld } from '../src/sim/papers';
import { newRider } from '../src/sim/rider';
import type { HouseSim, SimEvent, Rider } from '../src/sim/types';

function fixture(houseZ = 18): PaperWorld & { events: SimEvent[]; rider: Rider } {
  const houses: HouseSim[] = [
    {
      spec: {
        pos: [11, houseZ],
        customer: 'T',
        subscribes: true,
        window: [0, 100],
        porch: { x: 6.2, z: houseZ, w: 2.8, d: 4.4 },
      },
      state: 'pending',
      pay: 0,
    },
  ];
  const rider = newRider();
  const events: SimEvent[] = [];
  const w: PaperWorld & { events: SimEvent[]; rider: Rider } = {
    rider,
    houses,
    wind: [0, 0],
    lost: 0,
    hits: 0,
    addEvent: (e) => events.push(e),
    deliver: () => {},
    events,
    rider: rider,
  };
  return w;
}

// charge giving a 15 m landing from z=3 (porch is at z=18)
const PORCH_CHARGE = 11 / 14;

test('no wind: paper lands on target porch and settles', () => {
  const w = fixture();
  w.rider.charge = PORCH_CHARGE;
  w.rider.aim = 6.2;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('settled');
  expect(inPorch(w.houses[0], p.x, p.z)).toBe(true);
  expect(p.z).toBeCloseTo(18, 0);
  expect(p.x).toBeCloseTo(6.2, 1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'porch')).toBe(true);
});

test('wind shifts the landing downwind', () => {
  const run = (wind: [number, number]) => {
    const w = fixture();
    w.wind = wind;
    w.rider.charge = PORCH_CHARGE;
    w.rider.aim = 6.2;
    const p = launchPaper(w, w.rider, 1);
    let maxX = -Infinity;
    for (let i = 0; i < 60; i++) {
      stepPapers(w, [p], 1 / 60);
      maxX = Math.max(maxX, p.x);
    }
    return maxX;
  };
  const noWind = run([0, 0]);
  const windy = run([4, 0]);
  expect(windy).toBeGreaterThan(noWind + 0.5);
});

test('yard landing bounces (skidding toward the road) then is lost', () => {
  const w = fixture(30); // house far ahead: the skid can not reach its porch
  w.rider.charge = 0.55; // 11.7 m out => z~14.8, inside the right yard
  w.rider.aim = 6.2;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.bounces).toBeGreaterThanOrEqual(1);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'yard')).toBe(true);
});

test('bounced paper can hit the rider', () => {
  const w = fixture();
  w.rider.charge = 0.55;
  w.rider.aim = 4.8; // lands on the yard next to the curb, skids back over the curb line
  const p = launchPaper(w, w.rider, 1);
  // rider rides up the right curb, under the skidding paper's path
  w.rider.x = 3.2;
  w.rider.z = 16.5;
  w.rider.speed = 0;
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(w.hits).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_hit_rider')).toBe(true);
});

test('road landing is gone + lost', () => {
  const w = fixture();
  w.rider.charge = 0.2; // short throw straight ahead, on the road (aim 0)
  w.rider.aim = 0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'road')).toBe(true);
});
