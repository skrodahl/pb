import type { GameSim } from './sim/sim';
import type { InputActions } from './sim/types';

export type DebugState = 'ride' | 'charge' | 'rain' | 'tally';

export function debugState(): DebugState | null {
  const v = new URLSearchParams(location.search).get('debug') as DebugState | null;
  return v && ['ride', 'charge', 'rain', 'tally'].includes(v) ? v : null;
}

// ?debug hooks: deterministic inputs / clock jumps so every game state
// (marker mid-throw, rain, final tally) is screenshot-able.
export function applyDebug(state: DebugState, sim: GameSim): void {
  if (state === 'rain') sim.clockMin = sim.config.weather.rainAfter - 0.05;
  if (state === 'tally') sim.clockMin = sim.config.time.length - 0.5;
}

export function autoInput(state: DebugState, t: number, base: InputActions): InputActions {
  if (state === 'ride') return { ...base, throttle: true };
  if (state === 'charge') {
    return { ...base, throttle: true, throwHeld: t % 3 < 1.2 };
  }
  return base; // rain/tally: idle ride to the state
}
