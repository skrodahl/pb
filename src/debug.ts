import type { GameSim } from './sim/sim';
import type { InputActions } from './sim/types';

export type DebugState = 'ride' | 'rain' | 'tally';

export function debugState(): DebugState | null {
  const v = new URLSearchParams(location.search).get('debug') as DebugState | null;
  return v && ['ride', 'rain', 'tally'].includes(v) ? v : null;
}

// ?debug hooks: deterministic inputs / clock jumps so every game state is
// screenshot-able.
export function applyDebug(state: DebugState, sim: GameSim): void {
  if (state === 'rain') sim.clockMin = sim.config.weather.rainAfter - 0.05;
  if (state === 'tally') sim.clockMin = sim.config.time.length - 0.5;
}

// full-auto demo: top speed, tap-throw when lined up with the next target,
// steer away from skaters.
export function autoInput(
  state: DebugState,
  t: number,
  base: InputActions,
  sim?: GameSim,
): InputActions {
  if (state !== 'ride' || !sim) return base;
  void t;
  const r = sim.rider;
  const nt = sim.nextTarget();
  let throwHeld = false;
  if (nt !== null && sim.held > 0) {
    const h = sim.houses[nt];
    const ahead = r.heading === 1 ? h.spec.pos[1] - r.z : r.z - h.spec.pos[1];
    // impact z = throw z + 0.6 lead; the clean band is ±1.2 around the house
    throwHeld = ahead < 1.0 && ahead > -0.4;
  }
  let steer: -1 | 0 | 1 = 0;
  for (const s of sim.obstacles.skaters) {
    if (s.active && Math.abs(s.x - r.x) < 1.5 && Math.abs(s.z - r.z) < 12) {
      steer = (Math.sign(s.x) * r.heading) as -1 | 1;
    }
  }
  return { ...base, throttle: true, throwHeld, steer };
}
