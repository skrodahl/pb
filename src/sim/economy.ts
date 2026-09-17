import type { HouseSim, Tally } from './types';

// points-only tally: houses earn points (delivery/smash), lost papers earn none
export function tallyFrom(houses: HouseSim[], lost: number): Tally {
  let clean = 0;
  let late = 0;
  let smashed = 0;
  let missed = 0;
  let score = 0;
  for (const h of houses) {
    if (h.state === 'clean') clean++;
    else if (h.state === 'late') late++;
    else if (h.state === 'smashed') smashed++;
    else if (h.state === 'missed') missed++;
    score += h.pts;
  }
  return { clean, late, smashed, missed, lost, score };
}
