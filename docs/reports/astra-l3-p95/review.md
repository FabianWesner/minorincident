# Historical visual review (initial candidate 97345172)

Final committed-renderer visual acceptance is recorded in [sol-review.md](sol-review.md): 18/18 WebGL2 and 18/18 WebGPU, captured and inspected on 2026-10-15. The pending statements below describe the earlier Astra attempt.

Both actual backends passed the two-scene matrix: 12/12 WebGL2 and 12/12 WebGPU, high/low at zoom 1.5, 1 and 0.5. The game-camera sheets were opened and inspected. Boulevard shows warm paving, long purple building shadows, the bus and sandbags, fences, and the moving courier. The close ash scene shows the courier, parked car and visible footprints; all six WebGL2 ash sheets are pixel-identical to the baseline after JPEG decoding.

The initial camera sheets exposed a changed opening frame: an inherited paused-camera snap removed a foreground fence before time advanced. This unrelated behavior was removed in 2a10b2fe. The remaining sampled walking frames matched the baseline. At frame 840 a foreground wall hides the courier in both the baseline and initial candidate; that existing obstruction is not claimed as a visibility pass. The comparison values are in initial-visual-comparison.json; they describe the initial candidate, not final acceptance.

Final captures of the corrected camera and cf2ae8b2 pose texture path are pending. A one-browser matrix request waited from approximately 06:03:50 to 06:33:50 UTC without admission and was stopped at the binding 30-minute queue limit. No final visual or performance pass is inferred from the earlier candidate.
