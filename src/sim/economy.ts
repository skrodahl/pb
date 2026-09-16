import type { HouseSim, Tally } from './types';

export const PAY = {
  clean: 5,
  late: 2,
  wet: 2.5,
  wrong: -3,
  missed: -2,
  lost: -1,
  hit: -1,
} as const;

export function tallyFrom(houses: HouseSim[], lost: number, hits: number): Tally {
  let clean = 0;
  let late = 0;
  let wrong = 0;
  let missed = 0;
  let earned = 0;
  let houseFined = 0;
  for (const h of houses) {
    if (h.state === 'clean') clean++;
    else if (h.state === 'late') late++;
    else if (h.state === 'wrong') wrong++;
    else if (h.state === 'missed') missed++;
    if (h.pay > 0) earned += h.pay;
    else houseFined += -h.pay;
  }
  const fined =
    houseFined + lost * Math.abs(PAY.lost) + hits * Math.abs(PAY.hit);
  return {
    clean,
    late,
    wrong,
    missed,
    lost,
    hits,
    earned,
    fined,
    net: earned - fined,
  };
}
