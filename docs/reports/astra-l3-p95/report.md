Status: BLOCKED on throttled-phone acceptance: no new p95 was measured; the committed pose optimization is not performance-approved.
Source/profile: retained cf2ae8b20 (camera/weather/pose-atlas changes); saved throttled CPU profiles identify render submission/uniform updates as dominant; no further source change before the required baseline.
Performance: historical camera/weather-only phone defence/horde/rescue 34.1/32.8/32.3 ms; current pose state unmeasured after 29m48s slot waiting; both quiet requests exited 124 and released locks within the 20-minute batch cap.
Visual QA: final WebGL2 18/18 and WebGPU 18/18 pass at high/low, zoom 1.5/1/0.5; sheets inspected, eight camera/weather sheets byte-identical to baseline, grounded bodies and return poses intact (8696a6de).
Checks: fresh production build/typecheck/lint pass; full Hetzner unit/sim/levels suite and E21 verification are still running; final counts will follow in continuation.md.
Scope: actors/corpses, Allies.ts, L3 tuning, throttle and budgets unchanged; no staticCollision.ts churn, deployment or merge; inherited final-frame wall obstruction remains.
