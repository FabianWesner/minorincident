# Deploy gate (PROD batches)

The orchestrator runs this on `main` before every PROD deploy (PO rules 10-07 / 10-09; long bot batteries are not part of it).

1. `npm run typecheck`, `npm run lint`
2. `npm run test:unit` (Hetzner: `sh tools/remote/run.sh $PWD -- npm run test:unit`). Since 2026-10-13 it includes the static QA guards:
   - `tests/unit/assets/lod-fidelity.test.ts`: every static prop/building/vehicle LOD against LOD0 (extent, silhouettes, vanished materials; backlog in `lod-fidelity.baseline.json`).
   - `tests/unit/levels/decoration-surface.test.ts`: drawn decorations only on soil, every district and tier.
   - `tests/sim/world/support-seams.test.ts`: no seam in raised walkable supports, every district.
3. `npm run build`, `npm run test:smoke`
4. Scene Lab for the touched areas, **both quality tiers and both zooms**: `npm run scene:matrix` (props, seats, hand props, peds, corgi, Grove areas) plus `npm run scene:catalog -- --matrix --filter '<area>*'` for other touched areas (L9 crash site: `--filter 'l9-crash-*'`; L9 drive/damage/handover QA: `--filter 'qa-l9-*,l9-enc-*,veh-apc-*,area-l9-*'`, on both `--backend webgl2` and `webgpu`). Open the sheets of both tiers. L10 cure-* scenes also gate `lodPlaceholderFramesMax: 0` (no placement drawn from a coarser stand-in mesh than its LOD band); `--throttle 4` slows the CPU to expose load-dependent races, and `tools/qa/lod-pop-probe.ts --walk` samples `placeholderDraws` while walking a streamed level.
5. L1/L2 browser e2e; for vehicle/ride changes `tests/e2e/levels/l4-bus-ride-smooth.spec.ts` (all 17 configs: both tiers, both backends, 60/120 Hz, uneven 120 Hz, 30 Hz, uneven phone cadence).

Details and the reasoning behind each guard: `docs/tools/scene-lab.md`, section "Quality x zoom matrix".
