# PB

A 3D browser game inspired by Data East's 1987 arcade *Paperboy*.
You ride a bicycle down a cozy voxel suburb, throw newspapers
**through the street-side window** of each customer inside their
delivery window, dodge cars, and ride through the rain that's coming —
then watch your end-of-day tally.

## Run it

```bash
npm i
npm run dev            # dev server (Vite)
```

Production build + preview:

```bash
npm run build
npx vite preview
```

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` | pedal / brake |
| `A` / `D` | steer the bike (holds your lane while you're aiming) |
| `Space` (hold) | aim + charge the throw — release to throw |
| `Enter` | advance screens |

While charging, `A`/`D` lean the *throw*, not the bike: the paper
flies out at up to ~10 m sideways. A gentle assist eases your aim
toward the next subscriber's window, and the marker shows your
wind-corrected landing — green when the paper crosses the target
window, amber otherwise.

## Debug states

Load the page with `?debug=...` to jump straight to a game state
(deterministic, same seed):

| Flag | State |
| --- | --- |
| `?debug=ride` | auto-throttle — general framing check |
| `?debug=charge` | auto-throttle + auto-aimed throw cycles (leans toward the next subscriber's window) |
| `?debug=rain` | clock fast-forwarded to rain onset |
| `?debug=tally` | clock fast-forwarded to end of day — full tally screen |

A `window.__pb` debug hook is exposed in the browser console:
`{ sim, state, world, rain, chaseCam, marker, audio, toRain(), toCharge(), toTally() }`,
plus `window.__errcount` (uncaught error counter).

## Architecture

- **Pure simulation, no three.js.** The entire game state lives in
  `src/sim/` and steps at a fixed 60 Hz with a seeded RNG
  (`src/core/rng.ts`). It has zero renderer imports, so runs are
  deterministic and fully unit-testable (`tests/`, `npx vitest run`).
  The renderer (`src/render/`) only *reads* sim state each frame.
- **Window delivery model.** A paper is delivered when its (x,z) path
  enters the target window's *catch column* (street face of the house,
  ±1.2 m of the house's z) — it settles inside the glass at window
  height. Wall misses bounce back toward the road and skid; lawn and
  road landings are lost. Constants live in `src/sim/types.ts`
  (`faceX`, `WIN_Z_HALF`, `PAPER_Y0`, ...).
- **Camera:** a 3/4 diagonal chase cam (`src/render/camera.ts`) —
  the lateral offset follows the rider's heading, mirroring on the
  return leg.
- **Procedural assets.** Models, sky, audio are all generated in code
  (low-poly builders in `src/render/models.ts`, chiptune/ambience in
  `src/audio/engine.ts`) — no binary asset pipeline.
- **Seams for the next loop:**
  - *Economy / weekly loop:* all pay + penalty constants live in
    `src/sim/economy.ts`; `DayConfig` (`src/sim/types.ts`) +
    `src/data/days/day1.ts` are the per-day data shape a week scheduler
    would consume.
  - *Gamepad:* input is action-based — `KeyboardInput.readActions()`
    returns a device-neutral `InputActions`; a `GamepadInput` satisfies
    the same interface without touching the sim.
  - *Models:* `WorldScene` builds meshes from plain model-builder
    functions (`createHouse`, `createCar`, ...), so a glTF pipeline can
    swap in behind the same interface later.

## Credits

- [three.js](https://threejs.org/) — 3D rendering
- Inspired by *Paperboy* (Data East, 1987)
