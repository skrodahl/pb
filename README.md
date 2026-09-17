# PB

A 3D browser game inspired by Data East's 1987 arcade *Paperboy*.
You ride a bicycle down a cozy voxel suburb, tap-throw newspapers
**sideways through the street-side window** of each customer inside
their delivery window, dodge crossing cars, skaters and RC cars,
grab paper bundles off the curbs, and ride through the rain that's
coming — then watch your end-of-day score and rank.

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
| `W` / `S` | pedal faster / ease off — the bike always rolls |
| `A` / `D` | steer the bike (it yaws and leans into the turn) |
| `Space` (tap) | sideways throw at the next house on the route |
| `Enter` | advance screens |

The throw is a fixed-force sideways flick: the paper flies laterally
from where you are, so **lining up with the house is the aim** —
throw when the house is beside you. The flick eases your speed down
a touch so the paper isn't left behind. A perfectly parallel throw pays
base + the full precision bonus; a window missed in z (wind drift or
late) hits the wall and skids back to the lawn. Paper stacks on the
curbs restock the rack (a full rack leaves them in place, and the
stacks come back when you ride the other way). STOPPED
mailboxes (gray box, red card) are smash targets: a paper through
their window pays the breakage bonus. Watch the road — crossing cars, skaters and
RC cars — a crash staggers you and blows papers off the rack. Ride
coast without pedaling long enough and the bees show up. Points only:
no money, no fines.

## Debug states

Load the page with `?debug=...` to jump straight to a game state
(deterministic, same seed):

| Flag | State |
| --- | --- |
| `?debug=ride` | full-auto demo — top speed, auto tap-throws, dodges skaters |
| `?debug=rain` | clock fast-forwarded to rain onset |
| `?debug=tally` | clock fast-forwarded to end of day — full tally screen |

A `window.__pb` debug hook is exposed in the browser console:
`{ sim, state, world, rain, chaseCam, audio, toRain(), toTally() }`,
plus `window.__errcount` (uncaught error counter).

## Architecture

- **Pure simulation, no three.js.** The entire game state lives in
  `src/sim/` and steps at a fixed 60 Hz with a seeded RNG
  (`src/core/rng.ts`). It has zero renderer imports, so runs are
  deterministic and fully unit-testable (`tests/`, `npx vitest run`).
  The renderer (`src/render/`) only *reads* sim state each frame.
- **Sideways tap-throw model.** A tap launch fires one paper laterally
  toward the next target's *catch column* (street face of the house,
  ±1.2 m of the house's z, `WIN_Z_HALF`). The paper keeps its z (plus
  wind drift) for the whole 0.55 s flight — so throw parallel to the
  house. A column hit settles in the glass (deliver or smash by
  house role); off-column wall hits bounce and skid; lawn/road
  landings are lost. Constants live in `src/sim/types.ts`
  (`faceX`, `WIN_Z_HALF`, `PAPER_T`, `PTS`, ...).
- **Point economy.** `src/sim/economy.ts` tallies the day's score:
  clean 100 + up to 150 precision, late 50, smash 200. The tally
  drives the end-of-day rank (S/A/B/C) in `src/ui/screens.ts`.
- **Street obstacles.** `src/sim/obstacles.ts` spawns crossing cars
  (two intersections), skaters and RC cars from the day's seed;
  `src/sim/bees.ts` handles the stall swarm. Crashes stagger the rider
  and scatter rack papers (`scatterPapers`) — obstacles are never
  consumed.
- **Camera:** a 3/4 diagonal chase cam (`src/render/camera.ts`) —
  the lateral offset follows the rider's heading, mirroring on the
  return leg. The bike model yaws ~20° into turns with a body lean
  and counterweighted rider, and the wheels spin with speed.
- **Procedural assets.** Models, sky, audio are all generated in code
  (low-poly builders in `src/render/models.ts`, chiptune/ambience in
  `src/audio/engine.ts`) — no binary asset pipeline.
- **Seams for the next loop:**
  - *Economy / weekly loop:* all point constants live in
    `src/sim/economy.ts` (`PTS` in `src/sim/types.ts`); `DayConfig`
    (`src/sim/types.ts`) + `src/data/days/day1.ts` are the per-day
    data shape a week scheduler would consume.
  - *Gamepad:* input is action-based — `KeyboardInput.readActions()`
    returns a device-neutral `InputActions`; a `GamepadInput`
    satisfies the same interface without touching the sim.
  - *Models:* `WorldScene` builds meshes from plain model-builder
    functions (`createHouse`, `createApartment`, `createCar`, ...),
    so a glTF pipeline can swap in behind the same interface later.

## Credits

- [three.js](https://threejs.org/) — 3D rendering
- Inspired by *Paperboy* (Data East, 1987)
