import { newRider, stepRider, landingPoint } from './rider';
import { launchPaper, stepPapers } from './papers';
import { initHouses, stepHouses, deliverHouse } from './houses';
import { Traffic } from './traffic';
import { WeatherSim } from './weather';
import { tallyFrom } from './economy';
import type {
  DayConfig,
  HouseSim,
  InputActions,
  Paper,
  Rider,
  SimEvent,
  Tally,
} from './types';
import { MIN_PER_SEC } from './types';

const PAPER_CAP = 80;

export class GameSim {
  clockMin = 0;
  done = false;
  rider: Rider = newRider();
  papers: Paper[] = [];
  held = 16;
  houses: HouseSim[];
  lost = 0;
  hits = 0;
  traffic: Traffic;
  weather: WeatherSim;
  private events: SimEvent[] = [];
  private prevThrowHeld = false;
  private paperId = 0;
  readonly config: DayConfig;

  constructor(config: DayConfig, seed = 1234) {
    this.config = config;
    this.houses = initHouses(config);
    this.traffic = new Traffic(config.traffic, seed);
    this.weather = new WeatherSim(config.weather);
  }

  // PaperWorld seam (structural): wind comes from the weather sim
  get wind(): [number, number] {
    return this.weather.wind;
  }

  step(dt: number, input: InputActions): void {
    if (this.done) return;

    this.clockMin += dt * MIN_PER_SEC;
    this.weather.step(this.clockMin, (e) => this.addEvent(e));

    // capture release + held charge before the rider step resets them
    const release = this.prevThrowHeld && !input.throwHeld;
    const savedCharge = this.rider.charge;
    const savedAim = this.rider.aim;

    stepRider(this.rider, dt, input);

    if (release && this.held > 0) {
      this.rider.charge = savedCharge;
      this.rider.aim = savedAim;
      const p = launchPaper(this, this.rider, this.paperId++);
      this.papers.push(p);
      this.rider.charge = 0;
      this.rider.aim = 0;
      this.held--;
      this.addEvent({ type: 'paper_thrown', paperId: p.id });
    }
    this.prevThrowHeld = input.throwHeld;

    stepPapers(this, this.papers, dt);
    this.prunePapers();
    this.traffic.step(dt, this.rider, (e) => this.addEvent(e));
    stepHouses(this.houses, this.clockMin, (e) => this.addEvent(e));
    this.checkEnd();
  }

  addEvent(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  deliver(i: number): void {
    const r = deliverHouse(this.houses[i], this.clockMin, this.weather.raining);
    this.addEvent({ type: 'delivery', houseIndex: i, kind: r.kind });
  }

  tally(): Tally {
    return tallyFrom(this.houses, this.lost, this.hits);
  }

  nextTarget(): number | null {
    const r = this.rider;
    let best = -1;
    let bestScore = Infinity;
    this.houses.forEach((h, i) => {
      if (h.state !== 'pending') return;
      const [t0, t1] = h.spec.window;
      const open = this.clockMin >= t0 && this.clockMin <= t1;
      const score = (open ? 0 : 1000) + Math.abs(h.spec.pos[1] - r.z);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best === -1 ? null : best;
  }

  private prunePapers(): void {
    while (this.papers.length > PAPER_CAP) {
      const idx = this.papers.findIndex(
        (p) => p.state === 'gone' || p.state === 'settled',
      );
      if (idx === -1) break;
      this.papers.splice(idx, 1);
    }
  }

  private checkEnd(): void {
    if (this.done) return;
    const allResolved = this.houses.every((h) => h.state !== 'pending');
    if (allResolved || this.clockMin >= this.config.time.length) {
      this.done = true;
      this.addEvent({ type: 'day_end', tally: this.tally() });
    }
  }
}
