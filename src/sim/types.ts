export interface Vec2 {
  x: number;
  z: number;
}

export interface Rider {
  x: number;
  z: number;
  heading: 1 | -1;
  speed: number;
  stagger: number;
  steer: -1 | 0 | 1;
}

export interface Paper {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  state: 'flying' | 'settled' | 'gone';
  bounces: number;
  target: number | null;
  precision: number; // 1 - |dz|/WIN_Z_HALF at throw; drives the clean bonus
  zDecel: number; // flutter drag on the inherited forward speed (0 for skids)
}

// Street obstacles: cars cross at intersections (perpendicular to the route);
// skaters ride toward you down a lane; RC cars cross the road from a yard.
export interface CrossCar {
  id: number;
  z: number; // intersection z (fixed)
  x: number;
  dir: 1 | -1; // +1 = crossing in +x
  speed: number;
  active: boolean;
  colorIndex: number;
}

export interface Skater {
  id: number;
  x: number;
  z: number;
  active: boolean;
  age: number;
}

export interface Rccar {
  id: number;
  z: number; // crossing z (fixed)
  x: number;
  active: boolean;
}

export type HouseState = 'pending' | 'clean' | 'late' | 'smashed' | 'missed';

export interface HouseSim {
  spec: HouseSpec;
  state: HouseState;
  pts: number;
}

export type HouseRole = 'sub' | 'stopped' | 'none'; // deliver / smash target / scenery

export interface HouseSpec {
  pos: [number, number]; // [x, z] house center (x<0 left, x>0 right)
  customer: string;
  role: HouseRole;
  kind?: 'cottage' | 'apartment';
  window: [number, number]; // clock minutes [open, close] (subs only)
  porch: { x: number; z: number; w: number; d: number }; // center + full extents
}

export interface DayConfig {
  id: string;
  name: string;
  time: { start: number; length: number }; // minutes: start = game-clock minutes at 07:00; length = total clock minutes
  houses: HouseSpec[];
  obstacles: {
    crossZ: number[]; // intersection z positions (cars cross perpendicular to the route)
    crossEvery: number[]; // spawn interval (s) per intersection
    skaterEvery: [number, number]; // min/max seconds between skaters
    rcEvery: [number, number]; // min/max seconds between RC cars
    seed: number;
  };
  bundles: [number, number][]; // paper pickup stacks [x, z]
  weather: {
    rainAfter: number;
    windBefore: [number, number];
    windRain: [number, number];
  };
}

export interface InputActions {
  throttle: boolean;
  brake: boolean;
  steer: -1 | 0 | 1;
  throwHeld: boolean;
}

export interface Weather {
  raining: boolean;
  wind: [number, number];
}

export type SimEvent =
  | { type: 'paper_thrown'; paperId: number }
  | {
      type: 'paper_landed';
      paperId: number;
      houseIndex: number | null;
      kind: 'window' | 'yard' | 'road';
    }
  | { type: 'paper_hit_rider'; paperId: number }
  | { type: 'car_hit'; kind: 'cross' | 'skater' | 'rc' }
  | { type: 'horn'; z: number }
  | { type: 'bundle'; index: number }
  | { type: 'bee_hit' }
  | { type: 'rain_start' }
  | { type: 'delivery'; houseIndex: number; kind: 'clean' | 'late' }
  | { type: 'smash'; houseIndex: number }
  | { type: 'missed'; houseIndex: number }
  | { type: 'day_end'; tally: Tally };

export interface Tally {
  clean: number;
  late: number;
  smashed: number;
  missed: number;
  lost: number;
  score: number;
}

export const ROUTE_LEN = 240;
export const BASE_SPEED = 5; // the bike always rolls: W revs up, S eases off
export const MAX_SPEED = 9;
export const ACCEL = 8;
export const BRAKE_DECEL = 16;
export const DRAG = 2;
export const RECOVER_ACCEL = 4; // back up to cruise speed after a stop
export const MIN_PER_SEC = 1; // 1 real second = 1 game minute
export const GRAV = 9.8;
export const YARD_IN = 4.6; // curb line (|x|)
export const YARD_OUT = 9; // yard outer edge (|x|)

// v3 sideways-throw model: tap throw, paper flies laterally to the target's
// catch column while you keep riding. Lining up with the house = timing.
export const PAPER_T = 0.55; // sideways flight time (s)
export const WIN_Z_HALF = 1.2; // window z half-width
export const GROUND_Y = 0.1; // lost-paper settle height (lawn/road)
export const PAPER_Y0 = 2.5; // release height
export const WINDOW_Y_MID = 1.45; // delivered paper settles here, inside the glass
export const MAX_HELD = 16;
export const START_HELD = 10; // rack load at the start of the day
export const THROW_SPEED = 2; // a throw flattens you out (the paper stays with the bike)

// arcade scoring (points only)
export const PTS = {
  cleanBase: 100,
  cleanPrecision: 150, // bonus scaled by 1 - |dz|/WIN_Z_HALF at throw
  late: 50,
  smash: 200,
  bundle: 5, // papers gained per bundle (not points)
} as const;

// street face of a house: body is 5 wide centered on pos[0] (±11)
export function faceX(pos: [number, number]): number {
  return pos[0] - Math.sign(pos[0]) * 2.5;
}
