# L10 shader and arrival hitches — 2026-10-15
The late white program is the mounted minigun's `pal_picketWhite` body; `GameView.load()` now loads and poses it before the existing warm-up.
Arrival profiling found repeated identical unbudgeted navigation floods; one copied result per grid is reused until topology/perimeter changes, with finite-budget search timing preserved.
Hetzner calibration: high **33.58 s**, low **18.30 s**, every recorded gameplay field exactly equal; normal full-sweep E3b tests also pass in **32.28 / 17.52 s** ([evidence](evidence/equivalence.json)).
Browser confirmation and the final full-suite summary are pending shared runner slots; no deadline or performance budget was raised.
See [implementation and reproduction](evidence/implementation.md) and [game-camera review](evidence/review.md); commits remain isolated on `lane/astra-hitches`, with no deployment or merge.
