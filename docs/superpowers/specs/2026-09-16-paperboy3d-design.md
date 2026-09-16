# PB — Design Spec (v1: "One Great Day")

## 1. Overview

PB is a browser-based 3D game inspired by the classic arcade paperboy game
(*Paperboy: The Arcade Game*, Data East, 1987). The original is a 2D
behind-the-back bicycle ride down a suburban street: you throw newspapers at
houses on time, dodge cars, and papers that land in the yard bounce back and
can hit you.

This version keeps the same spirit and core fantasy, modernized:

- **Same spirit, modernized** — the paperboy fantasy and core loop (ride, throw,
  dodge, deliver-on-time, earn money) are preserved, but mechanics, pacing, and
  level design may evolve to play better in 3D.
- **v1 scope: one polished, replayable delivery day.** No weekly economy yet,
  but the architecture is built so the full weekly loop (rent, bike upgrades,
  subscriptions changing week-to-week) slots in later.
- **Immersive is the top priority** over raw asset fidelity. Low-poly / pixel-3D
  assets are acceptable; the feel (lighting, weather, sound, camera) must be
  genuinely immersive.

## 2. Platform & Tech Stack

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target | Browser (Web) | Runs anywhere, no install, verifiable with the in-session Browserless tooling. |
| Render | three.js | Clean imperative 60fps loop, smallest dependency surface, no React reconciler fighting the hot loop. |
| Language | TypeScript | Type safety across a long-lived project. |
| Build | Vite | Fast dev, simple static output. |
| Game loop | Vanilla TS, fixed-timestep simulation | No React in the hot loop; UI is a DOM overlay. |
| Physics | Hand-rolled (no engine) | PB physics are simple (kinematic bike, parabolic paper projectiles, AABB-ish car collisions) — a full engine is overkill. |
| Assets (v1) | Programmatic low-poly model library, Quaternius-style pixel-3D palette (no binary assets, git-friendly) | Fully self-contained in git; a `ModelProvider` abstraction allows swapping to a real asset pack or bespoke glTF later without touching game code. |
| Audio | WebAudio + CC0/generated SFX & chiptune | No licensed audio; layered ambience for immersion. |
| Testing | Vitest on pure `sim/` modules | Simulation has zero three.js imports, so it is unit-testable and deterministic. |

## 3. Architecture

**Principle: simulation is pure, rendering reads it.** Game logic (rider,
papers, houses, cars, weather, economy) lives in plain TypeScript with **zero
three.js imports** — a fixed-timestep (60 Hz) state update driven by an event
queue. The renderer reads that state each frame and draws. This yields:

- Unit-testable mechanics.
- Deterministic (seeded-RNG) runs.
- Clean seams to swap assets and add the weekly loop later.

### Project layout

```
src/
  main.ts               # bootstrap, wiring
  core/                 # loop (fixed-step + accumulator), clock, seeded RNG, events
  sim/
    rider.ts            # kinematic bike: throttle/brake, lateral lane, car collisions
    papers.ts           # throw charge -> projectile physics (gravity + wind + flutter)
    houses.ts           # customer state machines, delivery windows, porch zones
    traffic.ts          # seeded car spawner/movement
    weather.ts          # clear->rain schedule, wind vector
    economy.ts          # earnings/fines, end-of-day tally (weekly-loop hook)
  render/
    scene.ts, camera.ts, lighting.ts
    models/modelProvider.ts   # logical entity -> visual; v1: programmatic low-poly, later: pack/glTF
  audio/                # WebAudio: layered ambience + SFX + music bed
  input/                # action-based input (steer/throttle/throw); gamepad slots in here
  ui/                   # DOM overlay: HUD, briefing card, tally screen (retro type)
  data/days/            # data-driven DayConfig per day
tests/                  # vitest on sim/ (pure) — trajectories, windows, scoring
```

### Key abstractions

- **`ModelProvider`** — maps a logical entity (house, tree, car, bike) to a
  visual. v1 returns programmatic low-poly models; later returns pack/glTF
  assets. Game code never references a concrete model.
- **Action-based `input/`** — maps device input to named actions
  (`steer`, `throttle`, `throw`). Gamepad support later maps to the same
  actions without touching simulation.
- **`economy.ts` interface** — computes per-day earnings/fines. The weekly loop
  (rent, upgrades, subscription churn) will consume this interface later.

## 4. Gameplay

### Route
One long suburban street, out-and-back (down one side, back along the other).
~15–20 houses across both sides.

### Riding
- `W`/`S` — pedal / brake.
- `A`/`D` — lean lateral position toward either curb (reach the far side's houses).
- Cars drive the opposite lane. A hit knocks you over: brief stagger, papers scatter.

v1 input is keyboard only. Because `input/` is action-based, mouse fine-aim
and gamepad can be mapped later without touching the simulation.

### Throwing (the core mechanic)
- Hold `Space` to charge. A landing marker shows the predicted arc
  (wind-corrected); `A`/`D` while holding slides the landing zone.
- Release to throw. The paper flutters in flight.
- Outcomes:
  - **On porch, in window** → clean delivery (money + points).
  - **In the yard** → it bounces; can hit you, a car, or fly off (fines, like the
    original's penalty rule).
  - **No subscription today** → delivering costs you money. The briefing card
    shows who is subscribed.
  - **Miss window (early/late)** → customer unhappy, reduced pay.

### Day flow
Briefing card (newspaper-styled schedule) → ride & deliver → **rain event
mid-route** (wet paper = reduced value, wind shifts throws) → end-of-day
tally screen (delivered / missed / fines / earnings).

### Economy (stub in v1)
Earnings are computed and displayed per day. `economy.ts` exposes the interface
the weekly loop will consume.

## 5. Immersion

### Visual
- Programmatic low-poly models in a Quaternius-style pixel-3D palette: limited
  retro colors, chunky proportions, flat + slight vertex-shaded lighting.
- Full "morning" light setup: low warm sun, long soft shadows (single
  directional shadow map), sky gradient, distance fog for depth.
- Weather: rain = particle streaks + wet-ground darkening + fog shift; wind
  visibly pushes paper flutter and sways trees.
- Living-world details: birds crossing, leaves drifting, mailboxes, wind
  chimes on porches — cheap instanced/animated touches that sell "a real
  street".
- Performance budget: integrated-GPU friendly (instancing for trees/bushes,
  capped shadow resolution, no LOD complexity).

### Audio (WebAudio)
- Music: gentle lo-fi/chiptune bed, morning mood; rain day gets a muffled
  variation.
- Ambience layers (crossfaded by state): wind, bicycle chain + tires, birds,
  distant traffic; rain loop on top of everything.
- SFX: throw whoosh, paper flutter, porch thump (clean), yard-bounce, car
  horn, crash + paper scatter, tally jingle.
- All CC0/generated; no licensed audio.

### Camera
- Chase cam: spring-damper follow, look-ahead that leans with lateral steering
  and speed, subtle height drop when charging a throw (focus pull), small
  shake on car hit.

## 6. Data Model

**DayConfig (data-driven, the weekly-loop hook):**

```ts
{
  id: string;
  time: { start: number; length: number };
  houses: [
    { pos: [x, z]; side: 'left' | 'right'; customer: string;
      subscribes: boolean; window: [t0, t1]; porch: [x, z, w, d] },
    ...
  ];
  traffic: { density: number; speed: number; seed: number };
  weather: { clearUntil: number; rain: boolean; wind: [vx, vz] };
}
```

## 7. Testing & Verification

### Unit tests (Vitest, on pure `sim/`)
- Throw-trajectory accuracy (gravity + wind + flutter produce expected landing).
- Delivery-window logic (in-window, early, late).
- Wrong-house and yard-bounce penalties.
- Economy totals (earnings vs fines).
- Deterministic seeded runs (same seed → same outcome).

No UI tests in v1; the DOM overlay is trivial.

### Visual verification (Browserless)
Screenshot passes checked against a visual checklist:
- Morning briefing card.
- Mid-throw with landing marker visible.
- Rain event.
- Yard-bounce miss.
- End-of-day tally screen.

Check camera framing, shadow quality, and rain legibility.

## 8. v1 Acceptance Criteria

- One full day playable start → tally.
- ~60fps on an integrated GPU.
- All original penalties present: late delivery, wrong house, yard-bounce.
- Rain + wind actually affect throws.
- Seams for the weekly loop, gamepad, and glTF swap are isolated in their
  respective modules (`economy.ts`, `input/`, `ModelProvider`).

## 9. Out of Scope for v1

- Full weekly economy (rent, bike upgrades, subscription churn).
- Gamepad input (seam exists, not wired).
- Bespoke glTF assets (seam exists, v1 uses the programmatic low-poly library).
- Multiple days/levels, leaderboards, persistence beyond a single day.
