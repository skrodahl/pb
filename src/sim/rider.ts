import type { InputActions, Rider } from './types';
import {
  ROUTE_LEN,
  MAX_SPEED,
  ACCEL,
  BRAKE_DECEL,
  DRAG,
  THROW_MIN,
  THROW_MAX,
  CHARGE_TIME,
  AIM_RATE,
  AIM_REACH,
} from './types';

export function newRider(): Rider {
  return {
    x: 0,
    z: 3,
    heading: 1,
    speed: 0,
    stagger: 0,
    charging: false,
    charge: 0,
    aim: 0,
  };
}

export function stepRider(r: Rider, dt: number, input: InputActions, assistX = 0): void {
  if (r.stagger > 0) {
    r.stagger = Math.max(0, r.stagger - dt);
    r.speed = 0;
    r.charging = false;
    r.charge = 0;
    r.aim += (0 - r.aim) * Math.min(1, dt * AIM_RATE);
    return;
  }

  if (input.throttle) r.speed = Math.min(MAX_SPEED, r.speed + ACCEL * dt);
  else if (input.brake) r.speed = Math.max(0, r.speed - BRAKE_DECEL * dt);
  else r.speed = Math.max(0, r.speed - DRAG * dt);

  if (input.throwHeld) {
    // lane holds while aiming: steer drives the throw, not the bike
    r.charging = true;
    r.charge = Math.min(1, r.charge + dt / CHARGE_TIME);
    const lean = -input.steer * r.heading * AIM_REACH;
    const target = lean * 0.75 + assistX * 0.25;
    r.aim += (target - r.aim) * Math.min(1, dt * AIM_RATE);
  } else {
    r.charging = false;
    r.charge = 0;
    r.aim += (0 - r.aim) * Math.min(1, dt * AIM_RATE * 2);
    const s = -input.steer * r.heading; // screen-relative (chase cam mirrors x on return leg)
    r.x += s * 4.5 * dt;
    r.x = Math.max(-3.2, Math.min(3.2, r.x));
  }

  r.z += r.heading * r.speed * dt;
  if (r.z >= ROUTE_LEN - 3) {
    r.z = ROUTE_LEN - 3;
    r.heading = -1;
  }
  if (r.z <= 3) {
    r.z = 3;
    r.heading = 1;
  }
}

export function landingPoint(r: Rider): { x: number; z: number } {
  const d = THROW_MIN + (THROW_MAX - THROW_MIN) * Math.pow(r.charge, 1.4);
  return { x: r.aim, z: r.z + r.heading * d };
}
