# s224 L8 animal looks — work in progress

The requested scope names seven asset IDs: `inf.lion`, `inf.lioness`, `inf.flamingo`, `inf.zebra`, `inf.gorilla`, `inf.monkey`, and `inf.elephant`. Lioness and monkey are derivatives of lion and gorilla respectively; both still require separate game-camera review.

## Evidence and open work

The current zoo skin builder applies authored infection colours to TRELLIS-derived sources. Existing reviews do not establish the requested old/new comparison at zoom 1 and 1.5, every LOD and both quality tiers for all seven IDs. In particular, the zebra notes describe a desaturated atlas with red eyes; the PO screenshot explicitly rejects its zombie read. Do not treat existing reviews as acceptance of this request. Generate and inspect the combined sheet, improve each failing variant, and record actual triangles and bytes per tier against the pre-change files. Confirm rigs and motions after rebuilding.

The corpse layout is presentation code in `src/render/characters/CorpseLayout.ts`. Normal candidates sample navigation clearance along a conservative footprint, but the fallback calls `evaluateCandidate(..., false)`, which skips that clearance, and the final fallback can retain a rejected footprint. This is a plausible placement route to clipping, not yet a reproduction of the reported zebra screenshot. Reproduce beside an actual L8 fence, inspect the selected path and rendered footprint, then fix and verify clearance without removing corpses. Check whether the zebra silhouette is damaged in a static bind pose and in animation before attributing it to decimation.

At revision `f7f41a1c`, the focused scene gate selection (`animal-zoo-healthy`, `night-boss-lion`, `foot-slide-flamingo-day`, `foot-slide-flamingo-night`, `flamingo-flock-contact`) passed 14/14 rows. This selection does not cover all animals or prove appearance. Typecheck and lint passed; remote `npm test` passed 105 tests with one skipped (198.2 s). These are baseline results and must be repeated after changes.

## Current baseline observation

A fresh `tools/qa/zoo-delivery-ab.ts` capture at zoom 1.5 drew the healthy and infected zebra in HIGH and LOW. I opened the HIGH zebra image: the infected animal reads mostly as a dark striped zebra from this view, with no clearly visible red wounds or bloody muzzle at the displayed scale. The outline has angular protrusions around the head, but this single view cannot distinguish geometry from a pose issue. This confirms the need to change and inspect the asset. The capture process stalled after the HIGH mixed scene and was interrupted; its partial output is under `test-results/followups-25/zoo-ab/s224-baseline/` and is not a completed acceptance sheet. It compares healthy with infected, rather than old with new, and omits lioness, monkey, zoom 1, and explicit LOD coverage.
