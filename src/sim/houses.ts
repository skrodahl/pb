import { PAY } from './economy';
import type { DayConfig, HouseSim, SimEvent } from './types';

export function initHouses(cfg: DayConfig): HouseSim[] {
  return cfg.houses.map((spec) => ({ spec, state: 'pending', pay: 0 }));
}

export function deliverHouse(
  h: HouseSim,
  clockMin: number,
  raining: boolean,
): { kind: 'clean' | 'late' | 'wrong'; pay: number } {
  const [t0, t1] = h.spec.window;
  if (!h.spec.subscribes) {
    h.state = 'wrong';
    h.pay = PAY.wrong;
    return { kind: 'wrong', pay: PAY.wrong };
  }
  if (clockMin >= t0 && clockMin <= t1) {
    h.state = 'clean';
    h.pay = raining ? PAY.wet : PAY.clean;
    return { kind: 'clean', pay: h.pay };
  }
  h.state = 'late';
  h.pay = PAY.late;
  return { kind: 'late', pay: PAY.late };
}

export function stepHouses(
  houses: HouseSim[],
  clockMin: number,
  addEvent: (e: SimEvent) => void,
): void {
  houses.forEach((h, i) => {
    if (h.state === 'pending' && clockMin > h.spec.window[1]) {
      h.state = 'missed';
      h.pay = PAY.missed;
      addEvent({ type: 'missed', houseIndex: i });
    }
  });
}
