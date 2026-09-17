import { newRider, stepRider } from './rider';
import { launchPaper, scatterPapers, stepPapers } from './papers';
import { initHouses, stepHouses } from './houses';
import { ObstacleSim } from './obstacles';
import { BeeSim } from './bees';
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
import { MIN_PER_SEC, MAX_HELD, PTS, START_HELD, THROW_SPEED } from './types';
import { mulberry32 } from '../core/rng';

const PAPER_CAP = 80;

export class GameSim {
  clockMin = 0;
  done = false;
  rider: Rider = newRider();
  papers: Paper[] = [];
  held = START_HELD;
  houses: HouseSim[];
  lost = 0;
  obstacles: ObstacleSim;
  bees: BeeSim = new BeeSim();
  weather: WeatherSim;
  bundlesTaken = new Set<number>();
  private events: SimEvent[] = [];
  private prevThrowHeld = false;
  private paperId = 0;
  readonly config: DayConfig;
  private rng: () => number;

  constructor(config: DayConfig, seed = 1234) {
    this.config = config;
    this.houses = initHouses(config);
    this.obstacles = new ObstacleSim(config.obstacles, seed);
    this.weather = new WeatherSim(config.weather);
    this.rng = mulberry32(seed);
  }

  // PaperWorld seam (structural): wind comes from the weather sim
  get wind(): [number, number] {
    return this.weather.wind;
  }

  step(dt: number, input: InputActions): void {
    if (this.done) return;

    this.clockMin += dt * MIN_PER_SEC;
    this.weather.step(this.clockMin, (e) => this.addEvent(e));

    // tap-throw: a press edge fires one sideways paper at the next target
    const throwPressed = !this.prevThrowHeld && input.throwHeld;
    stepRider(this.rider, dt, input);

    if (throwPressed && this.held > 0) {
      const t = this.nextTarget();
      if (t !== null) {
        const p = launchPaper(this, this.rider, this.paperId++, t, this.houses[t]);
        this.papers.push(p);
        this.held--;
        // a flick slows the rider down a touch so the paper isn't left behind
        this.rider.speed = Math.min(this.rider.speed, THROW_SPEED);
        this.addEvent({ type: 'paper_thrown', paperId: p.id });
      }
    }
    this.prevThrowHeld = input.throwHeld;

    stepPapers(this, this.papers, dt);
    this.prunePapers();
    this.pickBundles();
    this.obstacles.step(dt, this.rider, (e) => this.addEvent(e), () => this.scatter());
    this.bees.step(dt, this.rider, (e) => this.addEvent(e));
    stepHouses(this.houses, this.clockMin, (e) => this.addEvent(e));
    this.checkEnd();
  }

  // a crash staggers the rider AND scatters papers off the rack
  private scatter(): void {
    const n = 1 + (this.rng() < 0.5 ? 0 : 1);
    this.papers.push(...scatterPapers(this, this.rider, this.paperId, n, this.rng));
    this.paperId += n;
  }

  private pickBundles(): void {
    this.config.bundles.forEach((b, i) => {
      if (this.bundlesTaken.has(i)) return;
      if (this.held >= MAX_HELD) return; // a full rack leaves the stack in place
      if (Math.abs(b[0] - this.rider.x) < 1.6 && Math.abs(b[1] - this.rider.z) < 1.6) {
        this.bundlesTaken.add(i);
        this.held = Math.min(MAX_HELD, this.held + PTS.bundle);
        this.addEvent({ type: 'bundle', index: i });
      }
    });
  }

  addEvent(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  tally(): Tally {
    return tallyFrom(this.houses, this.lost);
  }

  // next stop on the route: nearest actionable house (pending subscriber or
  // un-smashed STOPPED house) in the direction of travel.
  nextTarget(): number | null {
    const r = this.rider;
    let best = -1;
    let bestDist = Infinity;
    this.houses.forEach((h, i) => {
      if (h.state !== 'pending' || (h.spec.role !== 'sub' && h.spec.role !== 'stopped')) return;
      const ahead = r.heading === 1 ? h.spec.pos[1] - r.z : r.z - h.spec.pos[1];
      if (ahead < 0 || ahead >= bestDist) return;
      bestDist = ahead;
      best = i;
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
    const allResolved = this.houses.every(
      (h) => h.state !== 'pending' || h.spec.role === 'none',
    );
    if (allResolved || this.clockMin >= this.config.time.length) {
      this.done = true;
      this.addEvent({ type: 'day_end', tally: this.tally() });
    }
  }
}

