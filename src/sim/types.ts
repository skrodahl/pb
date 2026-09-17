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
  charging: boolean;
  charge: number;
  aim: number;
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
}

export interface Car {
  id: number;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  active: boolean;
  colorIndex: number;
}

export type HouseState = 'pending' | 'clean' | 'late' | 'wrong' | 'missed';

export interface HouseSim {
  spec: HouseSpec;
  state: HouseState;
  pay: number;
}

export interface HouseSpec {
  pos: [number, number]; // [x, z] house center (x<0 left, x>0 right)
  customer: string;
  subscribes: boolean;
  window: [number, number]; // clock minutes [open, close]
  porch: { x: number; z: number; w: number; d: number }; // center + full extents
}

export interface DayConfig {
  id: string;
  name: string;
  time: { start: number; length: number }; // minutes: start = game-clock minutes at 07:00; length = total clock minutes
  houses: HouseSpec[];
  traffic: { interval: number; jitter: number; speed: number; seed: number };
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
  | { type: 'car_hit' }
  | { type: 'rain_start' }
  | { type: 'delivery'; houseIndex: number; kind: 'clean' | 'late' | 'wrong' }
  | { type: 'missed'; houseIndex: number }
  | { type: 'day_end'; tally: Tally };

export interface Tally {
  clean: number;
  late: number;
  wrong: number;
  missed: number;
  lost: number;
  hits: number;
  earned: number;
  fined: number;
  net: number;
}

export const ROUTE_LEN = 240;
export const MAX_SPEED = 9;
export const ACCEL = 8;
export const BRAKE_DECEL = 16;
export const DRAG = 2;
export const MIN_PER_SEC = 1; // 1 real second = 1 game minute
export const THROW_MIN = 4;
export const THROW_MAX = 18;
export const CHARGE_TIME = 1.0;
export const AIM_RATE = 6;
export const GRAV = 9.8;
export const YARD_IN = 4.6; // curb line (|x|)
export const YARD_OUT = 9; // yard outer edge (|x|)

// v2 window-delivery model (catch-column: the window catches the paper by x/z)
export const AIM_REACH = 9.5; // rider.aim max (lean); reaches face 8.5 + 1 m into the wall
export const ASSIST_X = 9.0; // gentle-assist target magnitude (face + 0.5)
export const WIN_Z_HALF = 1.2; // window z half-width
export const GROUND_Y = 0.1; // lost-paper settle height (lawn/road)
export const PAPER_Y0 = 2.5; // release height (flat high toss, descends by gravity)
export const WINDOW_Y_MID = 1.45; // delivered paper settles here, inside the glass

// street face of a house: body is 5 wide centered on pos[0] (±11)
export function faceX(pos: [number, number]): number {
  return pos[0] - Math.sign(pos[0]) * 2.5;
}
