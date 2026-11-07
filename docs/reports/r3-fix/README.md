# r3-fix — four cause-level fixes

Baseline: `aab0aa35`. Game code under review: `d027afa4`. No criteria, targets, specs or reference assets changed. No push or deployment.

## Changes and direct evidence

| Row | Cause and fix | Commit |
| --- | --- | --- |
| L3-13 | The merged ramp used the plain asphalt swatch while the joining deck used the asphalt surface-detail shader. Apply that same world-space asphalt detail to the ramp's asphalt palette indices. | `f16d6570` |
| L3-14 | The two authored coaches had no passengers, and static merging flattened their transparent glazing into the opaque body. Preserve separate transparent glazing and load six existing seated civilian render models into each coach. | `6cb8dec7` |
| L5-06 | Inverse attenuation remained audible beyond the authored hearing boundary; spatial polling could also lag movement. Give survivor calls a linear 30 m limit, stop them every simulation tick when outside it, and make these calls dry so shared reverb cannot outlive the boundary. Cue-start radius remains 25 m. | `610218f1` |
| L3-06 | An officer ahead of the courier crossed her inner follow circle when heading directly toward a trailing formation slot; motor response lag compounded the start from rest. During calm L3 regrouping near the inner band, follow her actual swept step and circle toward the trailing slot with radial clearance. Use immediate motor response for that bounded local correction. A current-tick marker prevents reading an uninitialized player displacement. | `d027afa4` |

### L3-13: ramp joint

The original wedge remained with all shadow casting disabled. Raycasts into its dark and adjacent light pixels both hit upward-facing asphalt: ramp top near `(180.058, 5.699, -0.060)` versus layout top near `(179.541, 5.703, 0.023)`. That identified a material mismatch rather than missing filler geometry. The fix changes the ramp material before shader warm-up and retains its cutaway/disposal behavior.

Fresh seed-1 ordinary native routes reached x≈177 on both tiers with zero courier deaths; their official mission resumes supplied the browser scene. I opened all four final captures in `test-results/r3-fix/calm-ramp-proof-{low,high}/ramp-z{0.5,1.5}.png`. The close views show continuous asphalt across the broad joint area, with ordinary cracks, paint and cast shadows retained; wide views show the full transition without the reported broad dark wedge. These use the same isometric camera angle and radius `19 × zoom`, centered on `(177,6.4,0)`. Earlier follow-camera files had identical framing despite different zoom labels and are **excluded** from this matrix.

### L3-14: both coaches

I opened all eight final `test-results/r3-fix/calm-final-proof-{low,high}/bus-{north,south}-z{0.5,1.5}.png` captures. In each coach the close view shows seated torsos, bent knees and legs through several side windows; the wide view retains visible occupants along the windows and shows the coach in the checkpoint. The roof and pillars naturally occlude some heads at this angle. The inspection camera centers at interior height 1.4 m with the same isometric angle and radius `19 × zoom`.

The twelve passengers are presentation copies using the existing `VehicleOccupant` seated rig and civilian assets, with owned loading/disposal. They introduce no simulation actors or RNG changes. Glazing stays separate from opaque static batches. The offline baker skips this coach because its current format cannot retain alpha; no coach bake was present to regenerate.

### L5-06: active call crossing 30 m

Both live headless WebGL2 probes unlocked a running AudioContext, started Mia's production call at 24.9 m, attached an analyser after its production panner, then moved the courier to 31 m while the clip was still active. Audio was unmuted; only downstream host output was set to zero to keep the machine quiet.

| Tier | RMS at 24.9 m | RMS at 31 m | Explicit stop time | Scheduled natural end |
| --- | ---: | ---: | ---: | ---: |
| Low | 0.006204612 | 0 | 4.448 s | 7.149333 s |
| High | 0.008114061 | 0 | 3.925333 s | 6.701333 s |

Both voices stopped on the first simulation tick after crossing, at tick 663. The actual and graph-listener distances were 31 m, and the voice was removed from active playback. The high probe also records wet gain zero. This rules out natural clip expiry or a muted/suspended context as the reason for silence. Raw receipts: `test-results/r3-fix/audio-{low,high}/result.json`.

### L3-06: physical start from rest

The browser loaded each tier's seed-1 fallback resume, removed infected only to isolate the requested calm condition, waited 240 ticks (4 s), held the physical `KeyD`, and sampled every tick for 480 ticks (8 s). Officers retained their production HP, positions, speed limits, navigation and collision sweeps.

| Tier | Officer 32 at 0.4 s | Entire moving-sample band, all four officers | Violations | Minimum officer HP |
| --- | ---: | ---: | ---: | ---: |
| Low | 3.350350 m | 3.226274–5.995843 m | 0 / 1,916 | 100 |
| High | 3.526017 m | 3.251576–5.995843 m | 0 / 1,916 | 100 |

Each officer contributes 479 samples with courier intent speed >1 m/s; the acceleration tick is excluded from that count. Raw samples include the whole rest and movement interval. Maximum observed officer step was 0.123720 m low / 0.103320 m high, with no repositioning by the probe. I opened the formed, 0.4 s and eight-second high views, and the corresponding low views. This is the specified calm fixture, not a claim of universal spacing during combat.

Receipts and images: `test-results/r3-fix/calm-final-proof-{low,high}/`. The final player current-tick marker was added after those browser captures to fix an initialization-only unit regression; the same native fallback probe before and after the marker produced byte-identical JSON on both tiers (`native-before-marker.json` and `native-radial.json`). Earlier failed controller trials are excluded from these results.

## Verification

- `npm run verify -- E21`: **PASS**, including typecheck, lint and all 107 unit tests in 27 files. The initial run caught an initialization edge in `l4-contact.test.ts`; the current-tick marker fixed it, and both the focused test and the full final gate pass. No test or target changed.
- `npm run qa:accept -- --level L3 --tier both --skip-browser`: **exit 1**; one fresh failing row (`L3-08`, high-tier segment-pressure vote), eleven incomplete rows. Both complete routes finish with zero deaths and zero collision failures. Both tiers have 21 fixture clauses with zero harness errors; all 12 checkpoint checks pass with identical controls. The low-tier coupled L3-06/07/08/11 fixture checks pass. High-tier L3-08 records 0/2 valid-seed votes (one mortal seed route times out); the high-tier calm-distance clause has no samples. The separate physical probe above supplies the requested calm spacing evidence.
- `npm run qa:accept -- --level L5 --tier both --skip-browser`: **exit 1**; one fresh failing row (`L5-08`, low-tier calm straight-walk follower tolerance), nine incomplete rows. Both complete routes finish; both tiers have 10 fixture clauses with zero harness errors; all 12 checkpoint checks pass with identical controls. The failing L5-08 measurements are exactly equal to the baseline report's failing measurements.
- Both remaining failing row IDs are also failing in the baseline report. These acceptance commands are **not green** and do not automatically close the manual visual/audio clauses. Their complete current reports and generated receipts are retained in `test-results/r3-fix/acceptance/`; generated central QA reports were restored after extraction.
- Final threat audit: the combined remote `qa:threat -- --levels L3,L5 --maxWorkers 1` completed L3 in 369.5 s with **zero skilled flags and zero passive flags**, including the seeds 1–3 army-line vote, then exceeded the 600 s batch budget while processing L5. The complete L3 receipt is retained at `test-results/r3-fix/threat/L3.json`. The queued remote L5-only retry was canceled before admission when local load fell below 6 (4.89 at launch). The completed local `qa:threat -- --levels L5 --maxWorkers 1` then finished in 219.1 s with **zero skilled flags, zero passive flags, and zero skilled/passive follower-pace flags** over seeds 1–3. Its exit 1 is solely the mandatory `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate` flag; it has no L5 failure flags. Receipt: `test-results/r3-fix/threat-L5/audit.json`. This is evidence for the two requested levels, not an all-level gate pass.

The initial remote acceptance attempt could not run because its manifest checkout has no Git HEAD; the reported acceptance results come from completed local reruns. All owned checks have exited. No running or timed-out L5 segment is treated as a completed result.

Logs and raw evidence are under `test-results/r3-fix/`; images remain there only. [evidence.json](evidence.json) preserves the exact direct-probe summaries and SHA-256 manifest for the twelve opened visual-matrix captures. The visual checks use headless Chromium with Metal/WebGL2; WebGPU is not claimed.

## Closeout

All four requested causes are fixed in separate commits, with the direct reproductions above verified. The report and evidence manifest are committed separately. The remaining acceptance failures/incomplete clauses are disclosed above; no target was relaxed to make them green. Images remain exclusively under `test-results/`.
