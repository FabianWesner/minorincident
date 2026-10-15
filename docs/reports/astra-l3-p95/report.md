Status: BLOCKED on browser acceptance after the binding 30-minute slot-wait cutoff; success criteria are not yet met.
Profile: defence render submission dominates; cached camera footprints, sparse weather rows, and constant pose-atlas UV/flip work removed (cf2ae8b2).
Measured before pose optimization: phone defence/horde/rescue 34.1/32.8/32.3 ms; high 8.0/9.1/8.0 ms; defence still fails 33.33 ms.
Checks: production build/typecheck/lint pass; focused remote rendering tests pass; full remote suite: 2797 passed, 9 skipped, 3 failures (L3 newbie deaths, L4 tank interval, L10 timeout).
Visuals: initial WebGL2/WebGPU matrices 12/12 each, sheets inspected; opening-frame difference corrected; final matrix and pose sheets unmeasured after 30-minute slot wait.
Scope: no actors/corpses removed, throttle/budgets unchanged, Allies.ts/gameplay untouched; benchmark defence phase-label mismatch and existing final-frame wall obstruction remain recorded limitations.
