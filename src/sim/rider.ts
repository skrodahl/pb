import type { InputActions, Rider } from './types';
import { ROUTE_LEN, MAX_SPEED, BASE_SPEED, ACCEL, BRAKE_DECEL, DRAG } from './types';

export function newRider(): Rider {
  return {
    x: 0,
    z: 3,
    heading: 1,
    speed: BASE_SPEED,
    stagger: 0,
    steer: 0,
  };
}

export function stepRider(r: Rider, dt: number, input: InputActions): void {
  r.steer = input.steer;
  if (r.stagger > 0) {
    r.stagger = Math.max(0, r.stagger - dt);
    r.speed = 0;
    return;
  }

  // the bike always rolls: throttle revs to max, brake eases to a cruise,
  // coasting relaxes back to the cruise speed.
  if (input.throttle) {
    r.speed = Math.min(MAX_SPEED, r.speed + ACCEL * dt);
  } else if (input.brake) {
    r.speed = Math.max(BASE_SPEED, r.speed - BRAKE_DECEL * dt);
  } else if (r.speed > BASE_SPEED) {
    r.speed = Math.max(BASE_SPEED, r.speed - DRAG * dt);
  } else {
    r.speed = Math.min(BASE_SPEED, r.speed + DRAG * dt);
  }

  const s = -input.steer * r.heading; // screen-relative (chase cam mirrors x on return leg)
  r.x += s * 4.5 * dt;
  r.x = Math.max(-3.2, Math.min(3.2, r.x));

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
