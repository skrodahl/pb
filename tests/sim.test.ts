import { GameSim } from '../src/sim/sim';
import { DAY_1 } from '../src/data/days/day1';
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
      c: sim.traffic.cars.map((c) =>
        [c.z, c.colorIndex, c.active].map((n) =>
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
  expect(dayEnds[0].tally.net).toBeDefined();
});

test('nextTarget: nearest pending subscriber ahead in travel direction, skipping NO-SUB', () => {
  const sim = new GameSim(DAY_1, 7);
  // outbound, at the start: first subscriber house ahead (z=30)
  sim.rider.z = 3;
  sim.rider.heading = 1;
  expect(sim.nextTarget()).toBe(0);
  // Okafor (idx 2, z=90) is NO-SUB: rider just past it must skip to Delgado (idx 3, z=120)
  sim.rider.z = 95;
  sim.rider.heading = 1;
  expect(sim.nextTarget()).toBe(3);
  // return leg: nearest pending subscriber BEHIND (z < rider.z)
  sim.rider.z = 200;
  sim.rider.heading = -1;
  expect(sim.nextTarget()).toBe(13); // Lindqvist, z=180
});

// NOTE: the end-to-end "throw through the window" test lands with Task 2,
// which is where the rider's aim model can actually reach the house faces.
