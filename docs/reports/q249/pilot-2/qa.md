# Pilot-2 validation

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 26 files / 110 tests; 30.1 s, maximum 4 Vitest workers.
- `E2E_PORT=3371 npm run test:smoke`: PASS, 6 QA smoke tests + 1 public smoke; 141.3 s. Includes crowd/corpse/accessory GPU limits on WebGL and WebGPU, L1 no shader builds after warm-up, on-screen pedestrians, and unflagged WebGPU. Browser pool, headless Metal, at most 2 workers. Initial run stopped because another job owned 3301; no other job's server was stopped.
- `SCENE_PORT=3351 npm run scene:gate -- --jobs 2 --out test-results/q249/pilot2-scene-gate`: PASS, **48/48**, zero known failures, zero rows missing; 3.2 min, two pooled contexts. See [gate summary](scene-gate-summary.md).
- `npx tsx tools/q249/audit-pilot.ts`: PASS; only one figure manifest and its six bake keys differ from baseline. All source/high/low LOD topology and attribute counts unchanged; approved heroine byte-identical.
- High Scene Lab before/after: 144 frames each, zero console errors, zero held-prop intersections, 0.3 cm maximum foot slide in both, 0 cm sinking, no missed in-view frames. Both requested sheets were visually inspected.

Raw QA logs remain in ignored `test-results/q249/pilot2-*.log`; render and measurement receipts are committed here. L1 load delta ±0.3 s and the full-cast acceptance work remain unverified pending the pilot decision. No requested full-cast completion is claimed.
