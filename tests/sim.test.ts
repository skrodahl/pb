import { GameSim } from '../src/sim/sim';
import { DAY_1 } from '../src/data/days/day1';
import { MAX_HELD } from '../src/sim/types';
import type { InputActions, SimEvent } from '../src/sim/types';

const act = (o: Partial<InputActions> = {}): InputActions => ({
  throttle: false,
  brake: false,
  steer: 0,
  throwHeld: false,
  ...o,
});

test('deterministic: same seed + inputs => identical run', () => {
  const run = (seed: number) => {
    const sim = new GameSim(DAY_1, seed);
    for (let i = 0; i < 9000; i++) {
      const t = i / 60;
      sim.step(
        1 / 60,
        act({
          throttle: t < 600,
          steer: (t % 20 < 10 ? 1 : -1) as -1 | 0 | 1,
          throwHeld: t % 30 < 4 && t > 10,
        }),
      );
      if (sim.done) break;
    }
    return JSON.stringify({
      r: sim.rider,
      held: sim.held,
      lost: sim.lost,
      p: sim.papers.map((p) =>
        [p.x, p.y, p.z, p.state].map((n) =>
          typeof n === 'number' ? Math.round(n * 1000) / 1000 : n,
        ),
      ),
      c: sim.obstacles.cars.map((c) =>
        [c.x, c.z, c.colorIndex, c.active].map((n) =>
          typeof n === 'number' ? Math.round(n * 1000) / 1000 : n,
        ),
      ),
      h: sim.houses.map((h) => h.state),
      ev: sim.drainEvents().map((e) => e.type),
    });
  };
  expect(run(7)).toBe(run(7));
  expect(run(7)).not.toBe(run(8));
});

test('day ends with day_end + tally, exactly once', () => {
  const sim = new GameSim(DAY_1, 7);
  const evs: SimEvent[] = [];
  for (let i = 0; i < 60 * 500; i++) {
    sim.step(1 / 60, act({ throttle: true }));
    for (const e of sim.drainEvents()) evs.push(e);
    if (sim.done) break;
  }
  expect(sim.done).toBe(true);
  const dayEnds = evs.filter((e) => e.type === 'day_end');
  expect(dayEnds).toHaveLength(1);
  expect(dayEnds[0].tally.score).toBeDefined();
});

test('nextTarget: nearest actionable house ahead (subs and stopped), skipping done houses', () => {
  const sim = new GameSim(DAY_1, 7);
  // outbound at the start: first house ahead is Hargitay (z=30, sub)
  sim.rider.z = 3;
  sim.rider.heading = 1;
  expect(sim.nextTarget()).toBe(0);
  // rider just past Okafor (idx 2, z=90, stopped): next actionable is Delgado (idx 3, z=120)
  sim.rider.z = 95;
  sim.rider.heading = 1;
  expect(sim.nextTarget()).toBe(3);
  // return leg: nearest actionable BEHIND (z < rider.z)
  sim.rider.z = 200;
  sim.rider.heading = -1;
  expect(sim.nextTarget()).toBe(10); // Reyes apartment (z=195, sub)
});

test('riding over a bundle restocks papers (capped) and emits bundle', () => {
  const sim = new GameSim(DAY_1, 7);
  sim.rider.z = 60;
  sim.rider.x = -5.8; // bundle 0 at (-5.8, 60)
  sim.held = 10;
  sim.step(1 / 60, act());
  expect(sim.held).toBe(15);
  expect(sim.bundlesTaken.has(0)).toBe(true);
  expect(sim.drainEvents().some((e) => e.type === 'bundle' && e.index === 0)).toBe(true);
});

test('stalling lets the bees show up and bump the rider', () => {
  const sim = new GameSim(DAY_1, 7);
  const evs: SimEvent[] = [];
  sim.rider.speed = 0;
  for (let i = 0; i < 60 * 8; i++) {
    sim.step(1 / 60, act());
    for (const e of sim.drainEvents()) evs.push(e);
  }
  expect(evs.some((e) => e.type === 'bee_hit')).toBe(true);
});

test('a full rack leaves the stack in place', () => {
  const sim = new GameSim(DAY_1, 7);
  sim.rider.z = 60;
  sim.rider.x = -3.0;
  sim.held = MAX_HELD;
  sim.step(1 / 60, act());
  expect(sim.held).toBe(MAX_HELD);
  expect(sim.bundlesTaken.has(0)).toBe(false);
  expect(sim.drainEvents().some((e) => e.type === 'bundle')).toBe(false);
});

test('a crash scatters papers off the rack', () => {
  const sim = new GameSim(DAY_1, 7);
  sim.rider.z = 105;
  sim.rider.x = 0;
  sim.obstacles.cars.push({
    id: 999,
    z: 105,
    x: 0,
    dir: 1,
    speed: 6,
    active: true,
    colorIndex: 0,
  });
  const before = sim.papers.length;
  sim.step(1 / 60, act());
  expect(sim.rider.stagger).toBeGreaterThan(0);
  expect(sim.papers.length).toBeGreaterThan(before);
});
