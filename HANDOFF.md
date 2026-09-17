# PB — Handoff Note (2026-09-17, pre-reboot)

## State
- **v1 complete**: one full delivery day playable start→tally. All tests green (32), pushed to `skrodahl/pb` main.
- Fixed & pushed: screen-relative steering (left/right was mirrored), route-ordered next-target, visible next-stop glow (`bc2a60d`); Vite network exposure for tailnet play (`b8e56c2`).
- **v2 not started.** Detailed plan exists (uncommitted → now committed): `docs/superpowers/plans/2026-09-17-pb-v2-feel-window-voxel.md`.

## Agreed v2 decisions (high-level)
1. **Delivery target = through the window** (original-faithful): paper arcs from the road over the yard and through the house's window; misses hit the wall and skid back; the porch becomes set dressing.
2. **Aiming while charging**: A/D aim the throw only — the bike **holds its lane** (no drift). Gentle assist: aim eases ~25% toward the next subscriber's window. Soft charge curve (short throws controllable).
3. **Landing marker**: wind-corrected prediction at the window; green when a clean crossing is predicted.
4. **Camera**: 3/4 view (lateral offset) so the road recedes diagonally to an off-center vanishing point — the "original" feel.
5. **Graphics**: true voxel cubes, **cozy suburb** style — warm cottage houses (gable roofs, chimneys, porch posts, shutters, fences, bushes), blocky trees; delivered papers visibly sit in the windows.
6. Keep: screen-relative steering both legs, route-ordered next target (skips NO-SUB houses), rain/wind, deterministic sim.

## Build order agreed
Throw feel + camera first (playtest the feel) → then voxel/cozy pass → tune → docs.

## After reboot (env notes)
- Repo: `/home/skrodahl/projects/pb`, remote `skrodahl/pb` (everything above is pushed — safe to restart).
- Preview server (was running on all interfaces, port 4173 via `setsid`) dies on reboot. Restart:
  `cd /home/skrodahl/projects/pb && npx vite preview --port 4173 &`
  (Vite config now has `host: true` + `allowedHosts: true` for dev/preview, so other computers reach it at `http://100.106.108.87:4173/` over Tailscale.)
- Visual verification: Browserless Chromium (port 3002) → `browserless_browser_navigate` to the preview URL; screenshots.
