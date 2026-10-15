# L10 shader and arrival hitches — 2026-10-15
The late program is an opaque `pal_picketWhite` body; the initial mounted-gun warm-up attempt still leaves it cold, so exact asset attribution and a corrected fix remain in progress.
Arrival profiling found repeated identical unbudgeted navigation floods; one copied result per grid is reused until topology/perimeter changes, with finite-budget search timing preserved.
Hetzner calibration: high **33.58 s**, low **18.30 s**, every recorded gameplay field exactly equal; normal full-sweep E3b tests also pass in **32.28 / 17.52 s** ([evidence](evidence/equivalence.json)).
First-fix quiet WebGL low zoom 1 max **9.6 ms**, but the late-program assertion fails; canonical verification stopped after a 30-minute slot wait. No deadline or budget was raised.
See [implementation and reproduction](evidence/implementation.md) and [game-camera review](evidence/review.md); commits remain isolated on `lane/astra-hitches`, with no deployment or merge.
