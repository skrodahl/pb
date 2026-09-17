import { launchPaper, stepPapers, PAPER_FLIGHT_T } from '../src/sim/papers';
import type { PaperWorld } from '../src/sim/papers';
import { newRider } from '../src/sim/rider';
import type { HouseSim, SimEvent, Rider } from '../src/sim/types';

function fixture(houseZ = 18, subscribes = true): PaperWorld & { events: SimEvent[]; rider: Rider } {
  const houses: HouseSim[] = [
    {
      spec: {
        pos: [11, houseZ],
        customer: 'T',
        subscribes,
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
  };
  return w;
}

test('no wind: paper enters the window column and is delivered through the window', () => {
  const w = fixture(); // house z=18, face x=8.5
  w.rider.z = 3;
  w.rider.x = 0;
  w.rider.charge = 0.95; // ~17 m forward: enters the column at z~19, inside the band
  w.rider.aim = 9.0; // just past the face
  let delivered = -1;
  w.deliver = (i) => {
    delivered = i;
  };
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(delivered).toBe(0);
  expect(p.state).toBe('settled');
  expect(Math.abs(p.x)).toBeCloseTo(8.75, 1); // just inside the glass
  expect(p.y).toBeCloseTo(1.45, 2); // settled at the window mid-height
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'window')).toBe(true);
});

test('wall hit: z-band timing miss bounces back and skids toward the road', () => {
  const w = fixture(14); // crossing lands at z~12, short of the window band [12.8, 15.2]
  w.rider.charge = 0.42;
  w.rider.aim = 9.0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.bounces).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'yard')).toBe(true);
});

test('skidding paper can hit the rider', () => {
  const w = fixture(14);
  w.rider.charge = 0.42;
  w.rider.aim = 9.0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.bounces).toBeGreaterThanOrEqual(1);
  // place the skidding paper on the rider's curb line
  p.x = 3.4;
  p.z = 10.0;
  p.vx = -2;
  p.vz = 0;
  p.vy = 0;
  p.y = 0.1;
  w.rider.x = 3.2;
  w.rider.z = 10.3;
  w.rider.speed = 0;
  for (let i = 0; i < 30; i++) stepPapers(w, [p], 1 / 60);
  expect(w.hits).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_hit_rider')).toBe(true);
});

test('short aim never reaches the house: lawn landing is lost', () => {
  const w = fixture();
  w.rider.charge = 0.6;
  w.rider.aim = 7.5; // short of the face at 8.5
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
});

test('road landing is gone + lost', () => {
  const w = fixture();
  w.rider.charge = 0.2; // short throw straight ahead, on the road (aim 0)
  w.rider.aim = 0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'road')).toBe(true);
});

test('wind shifts the landing downwind', () => {
  const run = (wind: [number, number]) => {
    const w = fixture();
    w.wind = wind;
    w.rider.charge = 1;
    w.rider.aim = 9.0;
    const p = launchPaper(w, w.rider, 1);
    let maxX = -Infinity;
    for (let i = 0; i < 90; i++) {
      stepPapers(w, [p], 1 / 60);
      maxX = Math.max(maxX, p.x);
    }
    return maxX;
  };
  const noWind = run([0, 0]);
  const windy = run([4, 0]);
  expect(windy).toBeGreaterThan(noWind + 0.5);
});

test('flight time is exported for the marker', () => {
  expect(PAPER_FLIGHT_T).toBeCloseTo(0.7, 2);
});
