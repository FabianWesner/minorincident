# s121 · Courier readability in dense hordes

## Change

Ordinary infected bars already appear for player-damaged infected and for infected engaging the courier within six metres. In a large horde, that can still produce a screen full of healthy attacker bars. `HealthBars` now keeps only the six closest healthy ordinary attackers in that local group. Player-damaged infected and mandatory bars (shielded infected, Alphas, pursuing Mega, and engaged arena bosses) keep their existing eligibility and are not counted against the cap. The change is render-only; it does not alter infected behavior, corpses, or the render pass count.

The focused L4 render-contract test now checks the six-actor cap and verifies damaged actors retain their bars. It passes. `npm run typecheck` and `npm run lint` pass.

## Visual evidence and open checks

No before/after contact sheet is included. The prescribed Scene Lab capture command exited before launching a browser: the sandbox denied the browser pool's loopback listener (`127.0.0.1:4329`, `listen EPERM`). Therefore there is no visual review of L4 hold at HIGH/LOW and zoom 1/1.5, L6 retreat, open-street courier appearance, menus/L1, or WebGPU/WebGL2 parity. The existing L4 hold and L6 retreat fixtures were identified but not captured.

The requested full remote unit suite did not start: `tools/remote/run.sh` reported no healthy/provisioned Hetzner runner and refused the Mac fallback for this wrapped command. No timeout occurred, so the suite was not rerun or trimmed.

**Performance: pending.** No L4 LOW p95 timing was collected. The new selection examines the entity list and retains at most six IDs; it adds no full-scene render pass. This is not a measured performance result.

## Verdict

Partial implementation only. The bar cap is a plausible, low-cost reduction to crowd clutter, but the requested one-glance courier and HP readability and artifact-free behavior remain unverified. Continue with browser-pool access, capture the four required L4 views and L6 retreat, compare open-street/L1/menu controls, exercise WebGL2 and WebGPU on HIGH and LOW, and measure L4 LOW p95 before claiming completion.

## Follow-up validation

Pool and Git access are restored. The source change was committed as de94c65f. The full remote unit suite passed unchanged on 46.225.66.90: 106 passed / 1 skipped, 28 files, 228.9 seconds within 240 seconds, exit 0.

The L6 HIGH WebGL2 capture completed under the pool. Reviewed shot-0029: courier and HUD HP are visible, but there is no dense horde near the courier; this fixture cannot prove the requested crowd behavior. Its healthBarsMin check failed (0 versus 1). Raw frames and metrics are in test-results/s121-courierread/l6-high/. No dense-crowd or backend-parity claim is made. The earlier capture delay was pool admission behind another active exclusive job, not a renderer hang.
