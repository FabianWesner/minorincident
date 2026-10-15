# Movement fixes — visual review

The required game-camera sheets were opened for all four scenes at high/low quality and zoom 1 / 0.5, on actual WebGL2 and WebGPU. Each backend/quality guard passed. The catalog also ran zoom 1.5 as an extra numerical check: 48/48 final matrix rows pass. See [matrix counters](matrix-summary.json) and the eight review montages in `review/`.

- **L8 corgi:** the dog remains visible behind the moving courier, catches up when she runs, and turns onto the grass with her. Both tiers keep its silhouette and backpack; no disappearance or visible floating in the sampled on-foot sequence. Maximum running lag: 2.877 m. The scene uses the shared follow system on zoo ground; sim tests separately exercise actual campaign installation, checkpoints and boarding.
- **L7 rocket:** the pickup ring stays behind at the wreck while the dog leaves with the courier and follows the turn beside the fence. It never doubles back to retrieve the authored launcher. Maximum running lag: 1.684 m. Sim tests also cover invalid restored targets, the player leash and ordinary dropped weapons.
- **L4 bus:** the bus moves through its turn onto the street; the front wheels steer, remain attached to their axles and settle straight. The nearest zoom deliberately shows the large vehicle at close range. The circular wheel faces alone cannot establish spin; the existing ride test now also asserts advancement of all four actual rendered wheel angles.
- **L7 bus:** the final fixture keeps the ordinary game camera centered on the bus throughout the production departure. Wheels remain on their axles as it travels past lights, parked vehicles and foliage. The corgi is hidden aboard, with entity identity preserved; bus-to-zoo and APC-to-crossing continuity are asserted in sim tests. Earlier cinematic/courier-target capture attempts are superseded by `webgl2-bus-final` / `webgpu-bus-final`.

The final matrix peaks at **72 draws / 212,229 triangles on high**, and **72 draws / 102,493 triangles on low**, below E18's 600/1.5M and 300/500k limits. These are deterministic scene counters, not a frame-time measurement. The 60 Hz quiet ride sample measured 0.142 px RMS bus jitter and 20.592 rad advancement for each wheel; the complete 17-config result is recorded in the final report.

Seeds: L4 convoy 1; L7 departure 29; L7 rocket and L8 follow 32. Production preview builds, headless Chromium, ANGLE Metal. No specs, forbidden reference assets, staticCollision data or budgets were edited.

## Quiet ride result

All **17/17** existing L4 ride configurations passed, including the added assertion that every rendered bus wheel advances. Maximum bus jitter was **0.5634 px RMS** against the unchanged 0.6 px limit. Minimum wheel advancement over any configuration was **20.3649 rad** for each wheel. Both tiers/backends and 60/120 Hz, uneven 120 Hz, 30 Hz and uneven phone cadence are represented. The single reservation lasted **376 s including preflight/admission**, then released; no second quiet batch was started. Evidence: [ride data](ride/) and `quiet-conditions.jsonl`.
