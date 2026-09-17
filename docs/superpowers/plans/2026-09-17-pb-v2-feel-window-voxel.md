# PB v2 — Throw Feel, Window Delivery, 3/4 Camera, Cozy Voxel Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild PB's delivery loop around the original arcade fantasy — papers are thrown **through the houses' windows** — with a screen-consistent throw feel, a diagonal 3/4 camera, and cozy voxel-suburb houses.

**Architecture:** v1's split holds: pure-TS deterministic sim (`src/sim/`, zero three.js imports) + procedural three.js renderer (`src/render/`). This plan reworks the paper-flight resolution (window-crossing instead of porch-pad landing), the rider's charge/aim model (lane-hold while aiming + gentle assist), the camera framing, and the house model builders — without touching the route economy, day data, or day flow.

**Tech Stack:** TypeScript, three.js 0.186 (renderer only), Vite, vitest. Browserless headless Chromium on `http://172.22.0.1:41307` (dev) / `http://127.0.0.1:4173` (preview, serves `dist/`) for visual verification.

**Spec:** `docs/superpowers/specs/2026-09-16-paperboy3d-design.md` (v1 architecture — unchanged). v2 decisions below, from the 2026-09-17 play session:

| Decision | Choice |
| --- | --- |
| Delivery target | **Through the window** (original-faithful), not the porch pad |
| House style | **Cozy suburb** voxel cottages (warm palettes, gable roofs, chimneys, porch posts, shutters, fences, bushes) |
| Aiming while charging | A/D aim the throw only — **bike holds its lane** (no lateral drift) |
| Aim assist | **Gentle**: aim eases 25% toward the next subscriber's window |
| Charge curve | Softened: distance maps to `charge^1.4` (short throws controllable) |
| Landing marker | **Wind-corrected** predicted window-crossing; green when predicted clean |
| Camera | **3/4 view**: lateral offset + look shift so the road recedes diagonally, off-center vanishing point |
| Steering | Screen-relative (v1 fix `bc2a60d`), incl. return leg |

## Global Constraints

- Sim code (`src/sim/*`) keeps **zero three.js imports**; all new constants live in `src/sim/types.ts` and runs stay deterministic (same seed + inputs ⇒ identical run — covered by the determinism test).
- Fixed 60 Hz loop unchanged (`MIN_PER_SEC = 1`); `ROUTE_LEN`/`MAX_SPEED`/route layout unchanged.
- House footprint unchanged: body 5 wide × 6 deep centered at `pos` (±11), **street face at ±8.5** — the cozy rebuild may add detail but must keep the face at ±8.5 and the window centered on `pos[1]` (z) so sim geometry stays valid.
- HouseSpec's `window` field remains the **time** window [open, close] in minutes. The spatial window zone is *derived* (constants below), no new day data.
- After each task: `npx tsc --noEmit` clean, `npx vitest run` green, `npm run build` clean, then commit + `git push` (pre-approved, `skrodahl/pb` main).
- Visual checks: `npm run build`, then Browserless against the preview (`http://127.0.0.1:4173`, already running via `setsid`; rebuild `dist/` first). Screenshots via `browserless_browser_screenshot`.

## v2 Geometry (the numbers every task uses)

> **Execution note (T1):** the original "crossing height must be inside the window
> band" condition is physically impossible — with a fixed T=0.7 s flight the paper
> reaches the face in the last ~15% of flight, always at ground level. The delivery
> model is instead a **vertical catch column**: the window catches the paper by
> (x,z) proximity; the paper then settles inside the window (snap, like the arcade
> original). No height condition in the resolution. Constants: `PAPER_Y0 = 2.5`
> (flat high toss, descends by gravity), settle y = `WINDOW_Y_MID = 1.45`.
> `WIN_Y_LO/HI` were dropped; the window visual (T5) is drawn 0.6–2.2 m.

```
types.ts additions:
  AIM_REACH = 9.5        // rider.aim max (lean); reaches face 8.5 + 1 m into the wall
  ASSIST_X  = 9.0        // assist pull target magnitude (face + 0.5)
  WIN_Z_HALF= 1.2        // window z half-width (throw must cross within ±1.2 of house z)
  GROUND_Y  = 0.1        // lost-paper settle height (lawn/road)
  PAPER_Y0  = 2.5        // release height (flat ~2.5 m toss, descends by gravity)
  WINDOW_Y_MID = 1.45    // delivered paper settles here, inside the glass
  PAPER_FLIGHT_T = 0.7   // (moved out of papers.ts, exported)
  faceX(h)  = h.spec.pos[0] - Math.sign(h.spec.pos[0]) * 2.5   // ±8.5

Window column (catch):  |x| in [faceX-0.3, faceX+1.5]  AND  |z - house.z| <= WIN_Z_HALF
Wall (bounce):          |x| >= faceX-0.3  AND  |z - house.z| <= 3.0 (house depth), z-band miss
Ground (lost):          y <= GROUND_Y && vy < 0  ->  kind by |x| < YARD_IN

Marker prediction (per-frame, catch-column model):
  naive landing: lp = landingPoint(r)  (x = r.aim, z = r.z + heading*d)
  wind drift over the flight: dx = 0.5*wind[0]*T*T, dz = 0.5*wind[1]*T*T
  predicted point: (lp.x + dx, lp.z + dz)
  predicted CLEAN ⇔ |z_pred - h.z| ≤ WIN_Z_HALF && |x_pred| in [faceX-0.3, faceX+1.5]
                    && aim's side matches the target house's side
```

Sanity check (outbound, no wind, rider x=0, charge 0.95, aim 9.0, T=0.7): paper enters the column at z ≈ 18.8 for a house at z=18 — inside the ±1.2 band; the marker shows the wind-corrected landing so the player leads into rain.

---

### Task 1: Window delivery model (sim)

**Files:**
- Modify: `src/sim/types.ts` (new constants + `faceX` helper + `Paper.kind` gets `'window'`)
- Modify: `src/sim/papers.ts` (launch from PAPER_Y0, window-crossing resolution, wall bounce, ground lost)
- Modify: `src/sim/sim.ts` (`assistX` → `ASSIST_X` toward the next target's side; deliver kind update)
- Test: `tests/papers.test.ts` (rewritten for the window model), `tests/sim.test.ts` (throw test re-targeted)

**Interfaces:**
- Consumes: v1 `HouseSim`, `Paper`, `SimEvent`, day data (unchanged).
- Produces: `faceX(h: HouseSim): number`, exported `PAPER_FLIGHT_T`, `launchPaper` with the new constants, `stepPapers` resolving to `kind: 'window' | 'yard' | 'road'` (window = delivered into the house; yard = wall-skid bounce-back; road = short throw), `SimEvent` kind union updated.

The resolution order per flight step: (1) **window crossing** — paper at/past the face slab (`|x|` within 0.2 of face outward, not deeper than face+2.0), y in [WIN_Y_LO, WIN_Y_HI], z within WIN_Z_HALF of the house → `settled` just inside the glass, `w.deliver(i)`, event `paper_landed kind:'window'`; (2) **wall hit** — at the face (z within house depth 3.0) but y outside the band → bounce: clamp x just outside the face, `vx = -sign(vx)*|vx|*0.55`, `vz *= 0.35`, small pop `vy = max(vy, 0.4)`, `bounces++`, first bounce emits `kind:'yard'` (skid sfx), `bounces > 2` → gone + lost (skidding papers can still strike the rider via the existing hit check); (3) **ground** — `y ≤ GROUND_Y && vy < 0` → gone + lost, `kind` by `|x| < YARD_IN ? 'road' : 'yard'` (yard bounce is GONE in v2 — landing on the lawn is a miss). Out-of-bounds and rider-hit checks carry over unchanged.

- [x] **Step 1: Rewrite `tests/papers.test.ts` for the window model** (fixture: house at `pos [11, 18]`, face 8.5, band z ∈ [16.8, 19.2], y ∈ [0.5, 2.4]; rider z=3):

```ts
import { launchPaper, stepPapers, PAPER_FLIGHT_T } from '../src/sim/papers';
import type { PaperWorld } from '../src/sim/papers';
import { newRider } from '../src/sim/rider';
import type { HouseSim, SimEvent, Rider } from '../src/sim/types';

function fixture(houseZ = 18, subscribes = true): PaperWorld & { events: SimEvent[]; rider: Rider } {
  const houses: HouseSim[] = [
    {
      spec: {
        pos: [11, houseZ],
        customer: 'T',
        subscribes,
        window: [0, 100],
        porch: { x: 6.2, z: houseZ, w: 2.8, d: 4.4 },
      },
      state: 'pending',
      pay: 0,
    },
  ];
  const rider = newRider();
  const events: SimEvent[] = [];
  const w: PaperWorld & { events: SimEvent[]; rider: Rider } = {
    rider,
    houses,
    wind: [0, 0],
    lost: 0,
    hits: 0,
    addEvent: (e) => events.push(e),
    deliver: () => {},
    events,
  };
  return w;
}

test('no wind: paper crosses the face inside the band and is delivered through the window', () => {
  const w = fixture();
  w.rider.z = 3;
  w.rider.x = 0;
  w.rider.charge = 1; // d = 18 m -> lands z~21, crosses face while descending
  w.rider.aim = 9.0; // just past face 8.5
  w.deliver = () => {};
  let delivered = false;
  (w as { deliver: () => void }).deliver = () => { delivered = true; };
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(delivered).toBe(true);
  expect(p.state).toBe('settled');
  expect(Math.abs(p.x)).toBeCloseTo(8.75, 1); // just inside the glass
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'window')).toBe(true);
});

test('wall hit: right z-band timing miss bounces back and skids toward the road', () => {
  const w = fixture(30); // house far ahead: crossing happens short of its z-band
  w.rider.charge = 0.55;
  w.rider.aim = 9.0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.bounces).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'yard')).toBe(true);
});

test('bounced paper can hit the rider', () => {
  const w = fixture(30);
  w.rider.charge = 0.55;
  w.rider.aim = 9.0;
  const p = launchPaper(w, w.rider, 1);
  w.rider.x = 3.2;
  w.rider.z = 16.5;
  w.rider.speed = 0;
  for (let i = 0; i < 120; i++) stepPapers(w, [p], 1 / 60);
  expect(w.hits).toBeGreaterThanOrEqual(1);
  expect(w.events.some((e) => e.type === 'paper_hit_rider')).toBe(true);
});

test('short aim lands on the lawn and is lost', () => {
  const w = fixture();
  w.rider.charge = 0.6;
  w.rider.aim = 7.5; // short of face 8.5
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
});

test('road landing is gone + lost', () => {
  const w = fixture();
  w.rider.charge = 0.2;
  w.rider.aim = 0;
  const p = launchPaper(w, w.rider, 1);
  for (let i = 0; i < 90; i++) stepPapers(w, [p], 1 / 60);
  expect(p.state).toBe('gone');
  expect(w.lost).toBe(1);
  expect(w.events.some((e) => e.type === 'paper_landed' && e.kind === 'road')).toBe(true);
});

test('wind shifts the crossing downwind', () => {
  const run = (wind: [number, number]) => {
    const w = fixture();
    w.wind = wind;
    w.rider.charge = 1;
    w.rider.aim = 9.0;
    const p = launchPaper(w, w.rider, 1);
    let maxX = -Infinity;
    for (let i = 0; i < 90; i++) {
      stepPapers(w, [p], 1 / 60);
      maxX = Math.max(maxX, p.x);
    }
    return maxX;
  };
  expect(run([4, 0])).toBeGreaterThan(run([0, 0]) + 0.5);
});
```

Note: the first test's numbers (charge 1, aim 9.0, house z=18) are the plan's worked example — if the crossing misses the z-band by a step, adjust `houseZ`/`charge` in the test until the geometry matches the worked example above (t_f ≈ 0.64 s, y_c ≈ 1.4 m); the assertions are about *behavior* (delivered, settled inside the glass, event kind), not the exact charge.

- [x] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/papers.test.ts`
Expected: FAIL (constants/functions not defined; old resolution still in place)

- [x] **Step 3: Implement in `types.ts`**

```ts
export const AIM_REACH = 9.5;
export const ASSIST_X = 9.0;
export const WIN_Y_LO = 0.5;
export const WIN_Y_HI = 2.4;
export const WIN_Z_HALF = 1.2;
export const GROUND_Y = 0.1;
export const PAPER_Y0 = 1.5;

export function faceX(pos: [number, number]): number {
  return pos[0] - Math.sign(pos[0]) * 2.5;
}
```

Update `SimEvent`'s `paper_landed` kind to `'window' | 'yard' | 'road'`. Remove `PAPER_Y_LAND` (replaced by `GROUND_Y`).

- [x] **Step 4: Rewrite the flight resolution in `papers.ts`**

```ts
import type { Paper, Rider, HouseSim, SimEvent } from './types';
import { GRAV, WIN_Y_LO, WIN_Y_HI, WIN_Z_HALF, GROUND_Y, PAPER_Y0, YARD_IN, ROUTE_LEN, faceX } from './types';
import { landingPoint } from './rider';

export interface PaperWorld {
  rider: Rider;
  houses: HouseSim[];
  wind: [number, number];
  lost: number;
  hits: number;
  addEvent(e: SimEvent): void;
  deliver(i: number): void;
}

export const PAPER_FLIGHT_T = 0.7;
const T = PAPER_FLIGHT_T;

export function launchPaper(w: PaperWorld, rider: Rider, id: number): Paper {
  const lp = landingPoint(rider);
  const z0 = rider.z + rider.heading * 0.6;
  const vx = (lp.x - rider.x) / T;
  const vz = (lp.z - z0) / T;
  const vy = (GROUND_Y - PAPER_Y0 + 0.5 * GRAV * T * T) / T;
  const side = Math.sign(lp.x);
  const target = w.houses.findIndex(
    (h) =>
      side !== 0 &&
      Math.sign(h.spec.pos[0]) === side &&
      Math.abs(lp.x - faceX(h.spec.pos)) < 1.5 &&
      Math.abs(lp.z - h.spec.pos[1]) <= WIN_Z_HALF + 1,
  );
  return {
    id,
    x: rider.x,
    y: PAPER_Y0,
    z: z0,
    vx,
    vy,
    vz,
    state: 'flying',
    bounces: 0,
    target: target >= 0 ? target : null,
  };
}

export function stepPapers(w: PaperWorld, papers: Paper[], dt: number): void {
  for (const p of papers) {
    if (p.state !== 'flying') continue;

    p.vy -= GRAV * dt;
    p.vx += w.wind[0] * dt;
    p.vz += w.wind[1] * dt;
    const px = p.x;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // bounced (wall-skid) papers can strike the rider
    if (
      p.bounces > 0 &&
      p.y < 1.6 &&
      Math.abs(p.x - w.rider.x) < 2.0 &&
      Math.abs(p.z - w.rider.z) < 2.0
    ) {
      p.state = 'gone';
      w.hits++;
      w.lost++;
      w.addEvent({ type: 'paper_hit_rider', paperId: p.id });
      continue;
    }

    // 1) window crossing: delivered into the house
    const hitHouse = w.houses.findIndex((h) => {
      const fx = faceX(h.spec.pos);
      return (
        Math.sign(p.x) === Math.sign(fx) &&
        Math.abs(p.x) >= Math.abs(fx) - 0.2 &&
        Math.abs(p.x) <= Math.abs(fx) + 2.0 &&
        Math.abs(p.z - h.spec.pos[1]) <= WIN_Z_HALF &&
        p.y >= WIN_Y_LO &&
        p.y <= WIN_Y_HI
      );
    });
    if (hitHouse >= 0) {
      const h = w.houses[hitHouse];
      p.state = 'settled';
      p.x = faceX(h.spec.pos) + Math.sign(p.x) * 0.25;
      p.y = (WIN_Y_LO + WIN_Y_HI) / 2;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      w.deliver(hitHouse);
      w.addEvent({ type: 'paper_landed', paperId: p.id, houseIndex: hitHouse, kind: 'window' });
      continue;
    }

    // 2) wall hit: face at the wrong height — skid back toward the road
    const wallAt = w.houses.some((h) => {
      const fx = faceX(h.spec.pos);
      return (
        Math.sign(p.x) === Math.sign(fx) &&
        Math.abs(p.x) >= Math.abs(fx) &&
        Math.abs(p.z - h.spec.pos[1]) <= 3.0 &&
        (p.y < WIN_Y_LO || p.y > WIN_Y_HI)
      );
    });
    if (wallAt) {
      p.bounces++;
      p.x = Math.sign(p.x) * (Math.abs(faceX(w.houses[0].spec.pos)) - 0.2);
      p.vx = -Math.sign(p.vx || 1) * Math.abs(p.vx) * 0.55;
      p.vz *= 0.35;
      p.vy = Math.max(p.vy, 0.4);
      if (p.bounces === 1) {
        w.addEvent({ type: 'paper_landed', paperId: p.id, houseIndex: p.target, kind: 'yard' });
      }
      if (p.bounces > 2) {
        p.state = 'gone';
        w.lost++;
      }
      continue;
    }

    // 3) ground: lost (lawn or road) — no more yard bounce
    if (p.y <= GROUND_Y && p.vy < 0) {
      p.state = 'gone';
      w.lost++;
      w.addEvent({
        type: 'paper_landed',
        paperId: p.id,
        houseIndex: p.target,
        kind: Math.abs(p.x) < YARD_IN ? 'road' : 'yard',
      });
      continue;
    }

    if (Math.abs(p.x) > 30 || p.z < -10 || p.z > ROUTE_LEN + 10) {
      p.state = 'gone';
      w.lost++;
    }
  }
}
```

`inPorch` stays exported (still used by tests/`PaperWorld` consumers) but is no longer in the resolution path.

- [x] **Step 5: `sim.ts` assist + kind wiring**

In `GameSim.step`, replace the porch-based assist source (there is none yet in v1 — add):

```ts
const nt = this.nextTarget();
const assistX =
  nt !== null ? Math.sign(this.houses[nt].spec.pos[0]) * ASSIST_X : 0;
stepRider(this.rider, dt, input, assistX);
```

(`stepRider` gains the `assistX` parameter in Task 2; until then pass it to the existing signature as the 4th arg and add the param in Task 2's first step — keep the tasks' commits independent by doing Task 2 immediately after.)

- [x] **Step 6: Update `tests/sim.test.ts`** — 'throwing a paper at a porch in window pays clean' becomes 'throwing through the window in-window pays clean': rider `z = 18`, `x = 0`, `heading = 1`, `clockMin = 25` (house 0 left, window [20,40]), 47 frames `act({ steer: 1, throwHeld: true })` then release — with Task 2's aim/assist in place the paper crosses the left face inside house 0's z-band (worked example: z_c ≈ 30.7, band [28.8, 31.2]). Keep the `pay ≥ 2` and `held < 16` assertions.

- [x] **Step 7: Run, verify green**

Run: `npx vitest run`
Expected: all papers + sim tests pass; determinism test still passes (all new logic is state-deterministic).

- [x] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: window delivery model (crossing, wall bounce, ground lost)"
git push
```

---

### Task 2: Throw feel — lane-hold, assist, charge curve

**Files:**
- Modify: `src/sim/rider.ts` (lane-hold while charging; `AIM_REACH`; `charge^1.4` curve; `assistX` param)
- Test: `tests/rider.test.ts`

**Interfaces:**
- Consumes: `AIM_REACH`, `ASSIST_X` (Task 1), `InputActions`.
- Produces: `stepRider(r, dt, input, assistX = 0)` — 4th param; `landingPoint` with the charge curve.

Semantics:
- **Not charging:** A/D steer the bike exactly as v1 (`s = -steer*heading`, screen-relative, both legs).
- **Charging (Space held):** no lateral drift (`r.x` frozen); `aim` eases toward `lean*0.75 + assistX*0.25` where `lean = -steer*heading*AIM_REACH`. Release: aim decays to 0 (as v1).
- **Charge curve:** `d = THROW_MIN + (THROW_MAX - THROW_MIN) * charge^1.4`.

- [x] **Step 1: Update `tests/rider.test.ts`** — replace the two steering/charge tests with:

```ts
test('steering is screen-relative: D moves toward -x on the outbound leg (not charging)', () => {
  const r = newRider();
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeLessThanOrEqual(-3.1);
  expect(r.x).toBeGreaterThanOrEqual(-3.2);
});

test('steering flips with heading on the return leg (not charging)', () => {
  const r = newRider();
  r.heading = -1;
  r.z = 100;
  r.speed = 5;
  for (let i = 0; i < 180; i++) stepRider(r, 1 / 60, act({ steer: 1 }));
  expect(r.x).toBeGreaterThanOrEqual(3.1);
});

test('charging holds the lane: x does not drift while aiming', () => {
  const r = newRider();
  r.x = 1.5;
  for (let i = 0; i < 120; i++) stepRider(r, 1 / 60, act({ throwHeld: true, steer: 1 }));
  expect(r.x).toBeCloseTo(1.5, 5);
});

test('assistent aim: no steer pulls aim toward the assist side', () => {
  const r = newRider();
  for (let i = 0; i < 120; i++) stepRider(r, 1 / 60, act({ throwHeld: true }), -ASSIST_X);
  expect(r.aim).toBeLessThan(-2); // 0.25 * -9 = -2.25 target
});

test('charge ramps 0..1; charge curve is soft (half charge ~ 9.3 m)', () => {
  const r = newRider();
  for (let i = 0; i < 60; i++) stepRider(r, 1 / 60, act({ throwHeld: true }));
  expect(r.charge).toBeCloseTo(1, 1);
  r.charge = 0.5;
  expect(landingPoint(r).z - r.z).toBeCloseTo(4 + 14 * Math.pow(0.5, 1.4), 1);
  r.charge = 1;
  expect(landingPoint(r).z - r.z).toBeCloseTo(18, 1);
});
```

(import `ASSIST_X` from `../src/sim/types`.)

- [x] **Step 2: Run, verify failure**

Run: `npx vitest run tests/rider.test.ts`
Expected: the new lane-hold/assist/curve tests FAIL.

- [x] **Step 3: Implement in `rider.ts`**

```ts
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
```

(import `AIM_REACH`; drop the old hardcoded `* 6`.)

- [x] **Step 4: Run, verify green**

Run: `npx vitest run`
Expected: all green (Task 1's sim throw test now passes with the real aim model).

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: lane-hold aiming, gentle assist, soft charge curve"
git push
```

---

### Task 3: Wind-corrected window marker + window glow

**Files:**
- Modify: `src/render/marker.ts` (predict the crossing, place marker at the window, green/amber state)
- Modify: `src/render/scene.ts` (`updatePorchMarks` → `updateWindowMarks` glows the target's window; new `winGlows` pool from `houseGroups` userData)
- Modify: `src/main.ts` (call `updateWindowMarks`; audio `kind: 'porch'` → `'window'`)

**Interfaces:**
- Consumes: `PAPER_FLIGHT_T`, `faceX`, `WIN_Y_LO/HI/Z_HALF`, `PAPER_Y0`, `GROUND_Y`, `GRAV`, `sim.wind`, `sim.nextTarget()`.
- Produces: marker at `(faceX+0.1·side, y_c, z_c)`; window glow on the next target.

- [x] **Step 1: Rewrite `marker.ts`**

```ts
import * as THREE from 'three';
import type { GameSim } from '../sim/sim';
import { landingPoint } from '../sim/rider';
import { PAPER_FLIGHT_T, faceX, WIN_Y_LO, WIN_Y_HI, PAPER_Y0, GROUND_Y, GRAV } from '../sim/types';

export class LandingMarker {
  group: THREE.Group;
  private mat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffa030,
      emissive: 0x7a4a00,
      emissiveIntensity: 1,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24), this.mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    const beacon = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 4), this.mat);
    beacon.position.y = 1.1;
    beacon.rotation.x = Math.PI;
    this.group.add(ring, beacon);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(sim: GameSim, t: number): void {
    const r = sim.rider;
    this.group.visible = r.charging;
    if (!this.group.visible) return;

    const T = PAPER_FLIGHT_T;
    const lp = landingPoint(r);
    const vx = (lp.x - r.x) / T;
    const z0 = r.z + r.heading * 0.6;
    const vz = (lp.z - z0) / T;
    const vy = (GROUND_Y - PAPER_Y0 + 0.5 * GRAV * T * T) / T;
    const side = Math.sign(lp.x);
    const target = sim.nextTarget();

    if (side === 0 || target === null || Math.sign(sim.houses[target].spec.pos[0]) !== side) {
      this.group.position.set(lp.x, 0.1, lp.z);
      this.setHot(false);
      return;
    }

    const h = sim.houses[target];
    const fx = faceX(h.spec.pos);
    const tF = T * (Math.abs(fx) - Math.abs(r.x)) / Math.max(0.001, Math.abs(lp.x) - Math.abs(r.x));
    const w = sim.wind;
    const xC = r.x + vx * tF + 0.5 * w[0] * tF * tF;
    const zC = z0 + vz * tF + 0.5 * w[1] * tF * tF;
    const yC = PAPER_Y0 + vy * tF - 0.5 * GRAV * tF * tF;
    const clean =
      Math.abs(zC - h.spec.pos[1]) <= 1.2 && yC >= WIN_Y_LO && yC <= WIN_Y_HI;

    this.group.position.set(fx + side * 0.1, Math.max(0.1, yC), zC);
    this.group.scale.setScalar(1 + 0.15 * Math.sin(t * 8));
    this.setHot(clean);
  }

  private setHot(clean: boolean): void {
    this.mat.color.setHex(clean ? 0x7cfc00 : 0xffa030);
    this.mat.emissive.setHex(clean ? 0x2f8f00 : 0x7a4a00);
  }
}
```

(import `WIN_Z_HALF` instead of the literal 1.2 — keep the constant single-source: use `WIN_Z_HALF`.)

- [x] **Step 2: Window glow in `scene.ts`**

Replace `updatePorchMarks` with:

```ts
updateWindowMarks(sim: GameSim): void {
  const target = sim.nextTarget();
  const pulse = 0.65 + 0.35 * Math.sin(this.time * 4);
  this.winGlows.forEach((m, i) => {
    if (i === target) {
      m.emissive.setHex(0xff9020);
      m.emissiveIntensity = pulse;
    } else {
      m.emissive.setHex(0x000000);
    }
  });
}
```

with `winGlows: THREE.MeshStandardMaterial[]` collected from `h.userData.winGlowMat` in the constructor (Task 5 adds the window mesh; until then, build the glow from the porch pad's material as a placeholder so this task stands alone: `h.userData.padMat`). Porch pads stay as visual set-dressing.

- [x] **Step 3: `main.ts`** — `world.updatePorchMarks(sim)` → `world.updateWindowMarks(sim)`; audio switch: `case 'paper_landed': audio.sfx(e.kind === 'window' ? 'thump' : e.kind === 'yard' ? 'bounce' : 'thud')`.

- [x] **Step 4: Verify** — `npx tsc --noEmit && npx vitest run && npm run build`; Browserless: load `?debug=charge`, wait for the charge cycle, screenshot: marker sits at the next house's window height, amber; while a clean crossing is predicted it turns green. Confirm no console errors.

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wind-corrected window marker, target window glow"
git push
```

---

### Task 4: 3/4 diagonal camera

**Files:**
- Modify: `src/render/camera.ts` (lateral offset + look shift)

- [x] **Step 1: Modify `ChaseCamera.update`**

```ts
update(dt: number, sim: GameSim): void {
  const r = sim.rider;
  const f = r.heading;
  const speedK = r.speed / MAX_SPEED;
  const back = 7.5 + 2.5 * speedK;
  const up = 4.2 - (r.charging ? 0.9 : 0) - 0.4 * speedK;
  const side = 2.6 * f;
  const target = new THREE.Vector3(r.x + r.aim * 0.25 + side, up, r.z - f * back);
  this.pos.lerp(target, 1 - Math.exp(-4.5 * dt));
  if (this.shake > 0.001) {
    this.shake *= Math.exp(-6 * dt);
    this.pos.x += (Math.random() - 0.5) * this.shake;
    this.pos.y += (Math.random() - 0.5) * this.shake * 0.5;
  }
  this.cam.position.copy(this.pos);
  this.cam.lookAt(
    new THREE.Vector3(r.x + r.aim * 0.4 + f * 1.5, 1.2, r.z + f * (5 + 4 * speedK)),
  );
}
```

- [x] **Step 2: Screenshot tuning loop (Browserless, `npm run build` first)**

Loads: `?debug=ride`, sleep ~8 s, screenshot at z≈30 (outbound) and z≈120; `?debug=charge` outbound; one return-leg frame (`__pb.sim.rider.heading === -1` via eval before shot). Acceptance: road vanishing point sits off-center (roughly the 1/3 line), bike in the lower third, houses readable on both sides, window marker not occluded by the camera angle. If the diagonal is too weak/strong, tune `side` (2.2–3.4) and the look shift (`f * 1.5` → `f * 1.0`–`f * 2.0`) and re-shoot. Both legs must look right (the offset sign follows `f` so it mirrors correctly).

- [x] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 3/4 diagonal chase camera"
git push
```

---

### Task 5: Cozy voxel house + prop pass

**Files:**
- Modify: `src/render/models.ts` (`createHouse` rebuild; `createTree` voxel; rider head → cube; keep `createCar`, `createMailbox`, `createPaperMesh`)
- Modify: `src/render/scene.ts` (collect `winGlowMat` from houses; optional fence/bush placement between lots)

Rules: **same footprint** (body 5×4×6 at `pos`, face at ±8.5, window centered on `pos[1]`); flat-shaded voxels only (`mat()` already flatShades); warm cozy palette; per-index variation.

- [x] **Step 1: Rebuild `createHouse`** (components, all `THREE.BoxGeometry`, positions relative to `spec.pos`):

- body: two stacked boxes — first floor 5×2×6, second floor 4.6×1.8×5.6 (slight set-back), palette `walls[i % 6]` (retune `PALETTE.walls` toward cozy creams/terracotta/sage: e.g. `0xe8d8b8, 0xc96f4a, 0x9db87a, 0x8f86c2, 0xd8a86a, 0xb8c4a8`);
- gable roof: three stacked shrinking boxes (5.6×0.5×6.6 → 4×0.5×5 → 2.4×0.5×3.4) in `roofs[i % 3]`, plus a chimney (0.5×1.2×0.5) on 2 of 3 variants;
- porch: platform box (porch.w × 0.15 × porch.d) + 2 post boxes + 3 step boxes at the curb side; keep `g.userData.pad` (the platform) for v1 compat;
- **window (the delivery target)**: on the street face at `z = spec.pos[1]`, frame box (1.9 × 2.2 × 0.15) straddling the face, glass inset (1.5 × 1.8 × 0.1) slightly darker; `g.userData.winGlowMat` = the frame's material (emissive-able). Window x-center = `faceX(spec.pos)` (import from sim/types);
- second-floor window pair (visual only, 0.9×0.9 each) on both floors, shutters as 0.2-thin side slabs on the main window;
- door + step on the porch platform (as v1);
- wind chimes: keep (porch corner), scale to the new porch;
- yard dressing (in `scene.ts` placement loop, not the house): a low fence run (post + rail boxes) along each lot's front edge between porches, and 2–3 cube-cluster bushes per lot (deterministic by index: `createBush(seedIndex)`).

- [x] **Step 2: Voxel `createTree`** — trunk: 0.3×1.6×0.3 box; canopy: 3 stacked boxes (2.4³, 1.8³, 1.2³) offset like a chunky oak, 3 leaf colors by variant; replace the cones.

- [x] **Step 3: Rider block** — head `SphereGeometry` → 0.36 cube; keep everything else.

- [x] **Step 4: `scene.ts`** — in the houses loop collect `h.userData.winGlowMat` into `this.winGlows` (replacing the Task 3 placeholder); add fences + bushes in the trees loop (positions: lot center z ± offsets, x = ±12.8; deterministic by index — no RNG in the renderer).

- [x] **Step 5: Verify** — `npm run build`; Browserless: `?debug=ride` screenshots at 3 house types + rain state + return leg: houses read cozy (roof/porch/window/door visible), windows glow on the next target, delivered papers sit in the window (visible in `updatePapers` settled meshes), no shadow acne regressions. No sim changes in this task, so tests stay green — run them anyway.

- [x] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: cozy voxel houses, fences, bushes, blocky trees/rider"
git push
```

---

### Task 6: Feel tuning + full-day verification

**Files:**
- Modify: whatever the play-test reveals (expect: `AIM_REACH`, `ASSIST_X`, `WIN_*` constants in `types.ts`; `CHARGE_TIME`; marker lerp constants)

- [x] **Step 1: Auto-run sanity (Browserless)** — load `?debug=ride`, eval `window.__pb.autoRide = ...` (add a `?debug=ride+throw` auto-input: throttle always + `throwHeld = t % 3 < 1.2`, reuse `debug.ts autoInput` with the charge state's formula), let it run to day_end, eval the tally: expect `clean + late ≥ 6` of 13 subscribers, `wrong === 0` (auto-aim never targets NO-SUB houses because `nextTarget` skips them and the assist pulls toward subscribers only), no exceptions (`window.__errcount === 0`).
- [x] **Step 2: Manual-feel tuning targets** (screenshot + eval checks, not eyeball-only): from a clean start, with `toCharge()`-style forced state, confirm: (a) half-charge throw lands ~9 m out; (b) full lean (1 s of A) reaches face + 1 m; (c) in `?debug=rain` the wind-corrected marker visibly lags the naive landing and the throw still lands clean with the assist; (d) wall-skid bounce returns a paper toward the road and can hit the rider (reproduce the papers.test 'bounced paper can hit the rider' geometry live once).
- [x] **Step 3: Performance spot-check** — `?debug=ride`, rAF-count over 1 s in the Browserless eval (expect ≥ 45 fps on swiftshader; real check is the user's GPU). No new heavy materials (all `MeshStandardMaterial` flatShaded; one 2048 shadow map unchanged).
- [x] **Step 4: Full test + build green, commit any tuning constants**

```bash
npx vitest run && npx tsc --noEmit && npm run build
git add -A && git commit -m "tune: v2 feel constants from play test"
git push
```

---

### Task 7: README + final acceptance

**Files:**
- Modify: `README.md` (controls: "Space hold = aim+charge, release = throw; A/D steer (hold lane while aiming)"; target: "through the window"; `?debug=` table unchanged; architecture note: window-delivery model + 3/4 cam + voxel pass)

- [x] **Step 1: Update README** as above.
- [x] **Step 2: Full acceptance** (record output):

```bash
npx vitest run        # entire suite green
npx tsc --noEmit      # clean
npm run build         # clean
git log --oneline     # v2 story: window model -> throw feel -> marker -> camera -> voxel -> tune -> docs
```

Acceptance vs v1 spec §8 still holds: one day playable start→tally (flow unchanged), penalties all present (papers/sim tests), rain+wind affect throws (wind test + `?debug=rain`), seams isolated (`economy.ts`, `input.ts`, model builders).
- [x] **Step 3: Commit + push**

```bash
git add -A && git commit -m "docs: README v2 + acceptance"
git push -u origin main
```

## Plan Self-Review

- **Spec coverage:** window delivery → T1; lane-hold/assist/charge curve → T2; wind-corrected marker + window glow → T3; 3/4 camera → T4; cozy voxel → T5; tuning/verification → T6; docs/acceptance → T7. All session decisions in the header table map to a task. ✓
- **Type consistency:** `faceX` (T1) used by T1/T3/T5; `PAPER_FLIGHT_T` exported in T1, used by T3; `kind: 'window'` (T1) consumed by T3's audio mapping; `winGlowMat` produced in T5, consumed by T3 via the placeholder path (T3 works before T5 via `padMat` placeholder, T5 swaps the source) — T3's Step 2 must collect from `userData.padMat` until T5 lands. `stepRider(…, assistX)` param added in T2, wired in T1 Step 5 — T1's commit contains the call; TS passes the extra arg fine once T2 lands, but to keep each commit standalone, T1 Step 5 should *also* add the `assistX` param to `stepRider` (default 0, unused) so the tree compiles at T1's commit; T2 gives it meaning.
- **Known risk:** the exact crossing numbers in Task 1's test are worked estimates (t_f ≈ 0.64 s, y_c ≈ 1.4 m); if the first run misses the z-band, adjust the *test fixture's* `houseZ`/`charge` — never the resolution order. If wall-bounce geometry proves finicky (paper tunneling the face at high vx), add a face-slab substep check in `stepPapers` (check crossing at `px` and `p.x` both) — one-line change, noted here so the implementer doesn't rediscover it.
