import { launchPaper, stepPapers, scatterPapers, PAPER_FLIGHT_T } from '../src/sim/papers';
import type { PaperWorld } from '../src/sim/papers';
import { newRider } from '../src/sim/rider';
import type { HouseSim, SimEvent, Rider, HouseRole } from '../src/sim/types';

function house(z: number, role: HouseRole = 'sub'): HouseSim {
  return {
    spec: {
      pos: [11, z],
      customer: 'T',
      role,
      window: role === 'sub' ? [0, 100] : [0, 0],
      porch: { x: 6.2, z, w: 2.8, d: 4.4 },
    },
    state: 'pending',
    pts: 0,
  };
}

function fixture(h = house(18), clockMin = 30): PaperWorld & { events: SimEvent[]; rider: Rider } {
  const houses = [h];
  const rider = newRider();
  const events: SimEvent[] = [];
  const w: PaperWorld & { events: SimEvent[]; rider: Rider } = {
    rider,
    houses,
    wind: [0, 0],
    lost: 0,
    clockMin,
    addEvent: (e) => events.push(e),
    events,
  };
  return w;
}

test('lined-up sideways throw enters the window column and delivers clean', () => {
  const w = fixture(house(18)); // house z=18, face x=8.5
  w.rider.z = 17.4; // z0 = 18.0 = house z: perfect parallel
  w.rider.x = 0;
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('settled');
  expect(Math.abs(p.x)).toBeCloseTo(8.75, 1);
  expect(p.y).toBeCloseTo(1.45, 2);
  expect(w.houses[0].state).toBe('clean');
  expect(w.events.some((e) => e.type === 'delivery' && e.kind === 'clean')).toBe(true);
});

test('perfect parallel pays base + full precision bonus', () => {
  const w = fixture(house(18));
  w.rider.z = 17.4;
  w.rider.x = 0;
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(w.houses[0].pts).toBe(250); // 100 base + 150 precision
});

test('out-of-window delivery is late and pays the late rate', () => {
  const w = fixture(house(18), 200); // window [0,100] already closed
  w.rider.z = 17.4;
  w.rider.x = 0;
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(w.houses[0].state).toBe('late');
  expect(w.houses[0].pts).toBe(50);
  expect(w.events.some((e) => e.type === 'delivery' && e.kind === 'late')).toBe(true);
});

test('throw at a stopped house smashes the window for the breakage bonus', () => {
  const w = fixture(house(18, 'stopped'));
  w.rider.z = 17.4;
  w.rider.x = 0;
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 60; i++) stepPapers(w, [p], 1 / 60);
  expect(w.houses[0].state).toBe('smashed');
  expect(w.houses[0].pts).toBe(200);
  expect(w.events.some((e) => e.type === 'smash')).toBe(true);
});

test('z-band miss: wind drifts the paper off-window; it hits the wall and skids to the yard', () => {
  const w = fixture(house(14));
  w.rider.z = 13.4; // z0 = 14.0: perfectly on the house
  w.rider.x = 0;
  // wind z drift = 0.5 * w * T^2 = 1.51m: past the 1.2m window band, inside the 3.0m wall band
  w.wind = [0, 10];
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.bounces).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'yard')).toBe(true);
});

test('throw past the house (already behind): paper flies off-route and is lost', () => {
  const w = fixture(house(18));
  w.rider.z = 30; // house is 12m behind: no wall in the paper's path
  w.rider.x = 0;
  const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
});

test('crash-scattered papers skid and can strike the rider', () => {
  const w = fixture();
  w.rider.x = 3.2;
  w.rider.z = 10.3;
  const p = scatterPapers(w, w.rider, 5, 1)[0];
  p.x = 3.4;
  p.z = 10.0;
  p.vx = -2;
  p.vz = 0;
  for (let i = 0; i < 30; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_hit_rider')).toBe(true);
});

test('wind shifts the landing downwind', () => {
  const run = (wind: [number, number]) => {
    const w = fixture(); // house z=18; throw from behind it: no wall in the path
    w.wind = wind;
    w.rider.z = 30;
    w.rider.x = 0;
    const p = launchPaper(w, w.rider, 1, 0, w.houses[0]);
    for (let i = 0; i < 240; i++) {
      stepPapers(w, [p], 1 / 60);
      if (p.state !== 'flying') break;
    }
    return p.x;
  };
  const noWind = run([0, 0]);
  const windy = run([4, 0]);
  expect(windy).toBeGreaterThan(noWind + 0.5);
});

test('flight time is the sideways constant', () => {
  expect(PAPER_FLIGHT_T).toBeCloseTo(0.55, 2);
});
