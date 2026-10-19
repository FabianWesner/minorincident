# Browser QA continuation · 2026-10-19

Production build refreshed after the browser pause lifted. All runs use the worktree's production `dist`, headless native Metal rendering, `E2E_PORT=3681`, `SCENE_PORT=3682`, `E2E_UNITS=1`, and the shared admission wrapper. Scene/HUD batches are limited to 1,100 seconds and the final native timing attempt to 600 seconds, with slots released and review time between batches. No second browser is started by this lane.

## Fixture corrections found by opening the first captures

The initial high WebGL matrix passed 15/15 numeric gates. Every contact sheet was opened. Those passes were insufficient visual evidence for all six findings:

- The original gate camera at x91.3 showed the headlamp pickup and track, missing the reported gates. The fixture now uses the reported x149.37, z15 position.
- The original L2 location showed a clear fight in an alley, without the foreground pink crown from #38. The revised fixture adds a large foreground cherry at that same combat location, exercising the crown cut directly.
- The twelve-charge fixture showed three bright warning lanes, with repeated open chevrons, on a synthetic slab. It now uses the reported L3 bridge location (161.76, -2.71), the authored corridor ground and the same twelve attacks.
- The L5 static scene showed a centred courier in the lit cellar at every captured frame and all three zooms. A new browser regression additionally checks the first projected pose after loading the real L5 mission, then the first simulation frame after cellar emergence. Its captures include both sides of the transition.
- The fire-station sheets show a clear wall-mask centre without the floating dithered core at zooms 1.5, 1 and 0.5. The courier is still staged at the originally reported shutter position; this lane does not claim to resolve the separate shutter-placement finding #26.

## Revised evidence

Execution and visual review results are recorded below after each admitted batch. The earlier synthetic/incorrectly aimed fixtures are not counted toward the revised matrix.

### WebGL visual review, first revised pass

All thirty sheets were opened, including the six inadequate bridge views; that batch completed in 182 seconds and released its browser. Twenty-four rows are valid visual evidence for the gate, canopy, static L5 opening and wall. The bridge is excluded until rerun with the corrected follow target and visible-courier gate.

- **#30, gate:** zoom 1.5 establishes the tunnel and rails; zoom 1 shows the authored gate upright/leaf and yellow floor line; zoom 0.5 shows those physical pieces closely. Both tiers retain depth and warm environmental light. There are no cyan boxes, rings or floating arrow. The courier remains very bright under the tunnel lamp (separate PO finding #28), so this is not a claim that every tunnel lighting defect is solved.
- **#38, canopy:** a pink crown arches around a wide clear combat window at zooms 1.5 and 1; at zoom 0.5 the crown clears the close fight entirely. The courier, runner and axe motion stay visible throughout. The deliberately oversized trunk is prominent in this stress fixture. Low has lighter, simpler shadowing than high; neither tier leaves the old canopy-sized pink screen cover.
- **#33, static opening:** all three zooms keep the courier in the cellar light from frame zero through frame thirty. The warm pool, barrels, walls and front parapet remain steady. Low loses fine shadow detail but preserves framing. These images alone cannot prove the actual emergence transition; the browser regression supplies that check.
- **#39, wall:** the fire-station façade, shutter and paving remain stable through the complete sheet at every zoom. The central cut reveals the courier cleanly; its feathered edge does not retain a detached dark dithered core. The original shutter placement is retained to reproduce the mask complaint; this does not approve the separate #26 placement defect.
- **#31, rejected bridge framing:** the high and low captures showed road/railings with the courier and most attack lanes off screen. Numeric `undrawnFramesMax=0` did not catch an actor that never counted as in view. The corrected follow camera and 70% courier-pixel gate prevent that from being accepted again.

### Corrected WebGL bridge rerun

**6/6 pass**, 105 seconds, including the 70% visible-courier gate at every sampled frame. Every corrected sheet was opened. The combined WebGL evidence index replaces the six rejected road-only rows with these results (the index's first-pass wall time is not a combined timing measurement).

At zoom 1.5 the full curved ramp, attackers and escape road remain readable; at 1 the courier sits clearly between the warning lanes and parapet; at 0.5 the close view shows a few thin red lane edges/chevrons rather than a solid carpet. The white road markings and yellow ramp edge remain visible through the warning fill. Low retains the same warnings and courier framing, with simpler parapets and shadow detail. The Scene Lab follow rig takes its requested zoom on the first stepped frame; frame zero is retained in each sheet as initialization evidence, not a separately certified settled-zoom sample. No dozens-of-lanes carpet is visible in the stepped frames.

### E18 remote timing

The fresh shared-runner probe failed three timing cases under load. Its isolated retry reserved both runner slots without changing tests or budgets: Alpha high **3.52/4 ms**, Alpha low **1.71/6 ms**, zoo low **2.08/6 ms** pass; zoo high **5.54/4 ms fails**. The earlier original-source comparison already reproduced that zoo failure. E18 remains failing; this is not a deploy-gate pass. See `browser-isolated-perf.log`, `browser-alpha-*.json` and `browser-zoo-*.json`.

### E18 browser counters

**7/7 pass** on native Metal WebGL after the interleaved-buffer fix, 40.5 seconds, one worker. Highest fresh high-tier case: **287 draws / 908,185 triangles** (limits 600 / 1,500,000). Highest low-tier case, including the male skin: **244 draws / 492,117 triangles** (limits 300 / 500,000). Both crowd caps remain 200/100. `browser-e18-counters.json` contains the seven fresh summaries; obsolete `perf-l5-bridge` artifacts were excluded.

The dedicated HUD config's first launch timed out because its nested config directory became Vite's working directory. Its preview server now explicitly uses the repository root; typecheck passes after that harness fix. That failed launch ran no HUD tests and supplies no HUD approval.

All seven counter screenshots were opened ([sheet](browser/e18-counters.jpg)). The horde fixtures show the complete 200/100 crowd blocks on the tiled slab; the L6 pair shows the sheltered crowd, warm light pools and the large interaction ring/disc over the headlamp. The L5 high, low and male fixtures use the intentionally distant performance camera over foggy Fairhaven with the “Hours later” overlay; they are counter evidence, not opening-camera approval. The ring/disc and tunnel courier lighting remain visible existing defects outside the six assigned findings.

### WebGPU regression found and fixed during QA

The first WebGPU attempt failed immediately with `Vertex buffer count (9) exceeds the maximum number of vertex buffers (8)` in the VFX pool's `MeshBasicNodeMaterial` pipelines. All five completed sheets were opened: the environment and figures largely looked intact, while small VFX were missing. Those captures are rejected. The run was stopped and its owned browser released; the full remaining matrix was not allowed to run with broken pipelines. `webgpu-buffer-failure.json` preserves the errors.

The priority fade's separate `fxVisibility` buffer was the ninth buffer. Colour and visibility now occupy separate attributes in one four-float instanced interleaved buffer, keeping the eight-buffer WebGPU limit. Both attribute names and pooled warning identities remain the same. The new regression checks the shared buffer and verifies that palette edits and visibility edits preserve each other's values. Production build, typecheck and lint pass after this fix. Both backend matrices and the HUD suites are rerun against that fresh build.

### Final production scene matrix

After rebuilding with the shared colour/visibility buffer, WebGPU passed **30/30 in 251 seconds** and WebGL passed **30/30 in 242 seconds**, with zero console errors and all existing counter gates intact. All sixty final sheets were opened, including all sixteen labelled samples in each. [Each row has its own review and capture link](captures.md). The descriptions above hold on both backends: physical lit gates, limited warning lanes, centred cellar courier, clear canopy combat window and clear wall-mask centre. Low simplifies shading without losing these fixes.

### HUD harness corrections

The first complete run passed all four L5 tests but failed twelve HUD cases in the measurement harness. Completing objectives while paused made mission state cinematic before the UI had presented a tick; the harness now explicitly presents that tick. Its overlap query also included a story bubble with CSS opacity zero, which is now excluded as invisible. Visible HUD panels remain subject to the same overlap assertions. No source layout rule or budget was relaxed.

### Expanded-panel story bubble correction

The next HUD pass exposed a real remaining overlap at 1280×720 with `ui=1`: a visible L6 story bubble projected into the expanded debug panel. The debug-only CSS now anchors that bubble below the reserved 320 px row while either details panel is open. Closing the panels restores its ordinary speaker projection. The regression retains its intersection assertion and now also captures each expanded Sound/Controls state in gameplay and cinematic presentation. The production build was refreshed after the CSS correction.

The L5 transition sheets retain the requested zoom ratio across the first emergence frame. Nearby building camera clearance can contract the outward 1.5 view to nearly the same composition as zoom 1; this is the existing camera collision behavior, not a missing zoom input.

Production [build log](browser-build.log) and [final scene execution log](browser-matrix.log) are retained with the capture metrics.

### Cinematic subtitle correction

Opening the complete HUD sheets exposed an additional clipped edge: at 1920×1080 with the compact HUD, the 108 px lower letterbox covered the bottom of a subtitle positioned 100 px above the viewport edge. Compact desktop subtitles now reserve the larger of 100 px and the 10% letterbox plus 12 px. Portrait and the full HUD retain their existing subtitle layout. Each cinematic quality/zoom row asserts that the subtitle's bottom stays above the letterbox.

The expanded portrait Controls capture also showed a full-HUD input wider than its reserved column. Controls inputs/selects now cap their border-box width to the column; both open panels assert no horizontal overflow.

## Retained validation proofs

- [Typecheck](browser-typecheck.log), [lint](browser-lint.log), [focused remote regression run](browser-focused.log), [machine-readable summary](browser-validation.json).
- [Shared remote timing execution](browser-shared-perf.log), [isolated remote timing execution](browser-isolated-perf.log).
- [Alpha high](browser-alpha-200.json), [Alpha low](browser-alpha-100.json), [zoo high](browser-zoo-200.json), [zoo low](browser-zoo-100.json).
- [E18 counter summaries](browser-e18-counters.json), [rejected WebGPU pipeline errors](webgpu-buffer-failure.json).

Only report evidence is retained from this lane's browser outputs. Obsolete failed traces and superseded fixture captures are removed after the final review; the current production build is kept until browser checks finish. No extra temporary baseline worktree was created.

### Final HUD / L5 result

**16/16 pass**, 2.7 minutes, one browser/worker, after the final CSS build. All 24 closed-panel sheets (both quality tiers), all 12 expanded-panel sheets and all four L5 transition sheets were opened. [The per-viewport/backend review links every sheet](hud-captures.md); [execution log](browser-hud.log). Both backends retain the separate top summaries across all zooms and presentation modes. Expanded controls fit in the reserved columns; the faint speaker bubble starts below the open tools; compact desktop subtitles now clear the lower bar. No console errors or failed-request guard failures remain. The first emergence frame keeps the courier visible and the requested player zoom on all twelve tier/backend/zoom combinations.

### Native desktop frame timing

Quiet preflight finally completed at 19:04 UTC with load 2.76, no other headless Chrome and no local Vitest. The wrapper reserved the legacy lock range for timing; this lane used exactly **one live browser**. Admission plus execution stayed within the outer 600-second cap; all locks were released after the run.

Headless Chrome on **Apple M4 / ANGLE Metal** passed the unchanged **16.7 ms p95** gate at **5.8 ms** (p50 4.1 ms), with 200 enemies, 12.002 seconds, 721 simulation ticks and 2,819 rendered frames. The suite reports **1 pass / 1 existing skip**: its old WebGPU-only parity test is still explicitly skipped; the sixty scene rows and sixteen HUD/L5 tests provide the actual native WebGPU evidence here. This is a desktop high-tier frame result, not a claim of unmeasured WebGPU or phone frame timing.

The [native performance capture](browser/native-headless.png) was opened: a dense moving crowd occupies the middle of the lit tiled slab, with individual outfits/heads visible and no blank or failed-render regions. This performance camera is separate from the six PO reproductions. Retained [frame measurements](browser-native-gpu.json), [execution log](browser-native.log) and [quiet conditions](browser-native-conditions.jsonl) identify the measurement conditions. The isolated zoo high **5.54/4 ms simulation failure remains unresolved**; E18 and the deploy gate are not declared green.

Final disk cleanup removed about **0.86 GiB** of obsolete lane outputs, including duplicate captures/traces and the production `dist` after all browser checks finished. Report-linked proofs and captures remain; tracked unrelated result files were restored. No temporary baseline worktree belongs to this lane.
