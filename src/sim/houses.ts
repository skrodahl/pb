import { PTS } from './types';
import type { DayConfig, HouseSim, SimEvent } from './types';

export function initHouses(cfg: DayConfig): HouseSim[] {
  return cfg.houses.map((spec) => ({ spec, state: 'pending', pts: 0 }));
}

// A paper settles in a subscriber's window: clean (in window) or late.
// Clean pays base + precision bonus (perfect parallel = PTS.cleanBase + cleanPrecision).
export function resolveDelivery(h: HouseSim, clockMin: number, precision: number): number {
  const [t0, t1] = h.spec.window;
  if (clockMin >= t0 && clockMin <= t1) {
    h.state = 'clean';
    h.pts = PTS.cleanBase + Math.round(PTS.cleanPrecision * precision);
  } else {
    h.state = 'late';
    h.pts = PTS.late;
  }
  return h.pts;
}

// A paper hits a STOPPED house's window: breakage bonus.
export function resolveSmash(h: HouseSim): number {
  h.state = 'smashed';
  h.pts = PTS.smash;
  return h.pts;
}

export function stepHouses(
  houses: HouseSim[],
  clockMin: number,
  addEvent: (e: SimEvent) => void,
): void {
  houses.forEach((h, i) => {
    if (h.state === 'pending' && h.spec.role === 'sub' && clockMin > h.spec.window[1]) {
      h.state = 'missed';
      addEvent({ type: 'missed', houseIndex: i });
    }
  });
}
