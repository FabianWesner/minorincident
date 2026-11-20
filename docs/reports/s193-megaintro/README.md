# s193 — L10 Mega first reveal

## Change

The first close, visible Mega Alpha sighting now plays one five-second story beat. The courier asks what it is; Sam identifies the Mega Alpha and says it tracked the Annex sample and is hunting her. The existing Mega roar cue fires at the reveal. The camera eases to frame the courier and Mega together while player control stays live. Reveal and timer state are in the mission snapshot, so restoring a checkpoint captured after the reveal does not replay it.

The L10 threat score starts with the reveal. It uses the existing `score-combat-L10` recording, sourced from Kevin MacLeod's “Zombie Hoodoo” (CC-BY 4.0; already recorded in `assets/audio/imports.json` and `public/assets/audio/LICENSES.md`). L10's encounter hold is four seconds after danger leaves range; the score transition fades in over 0.8 seconds and the filtered accents ramp over one second. No music assets or license records were added.

No Mega health, damage, or other stats were changed. Zombie stats and corpse persistence are untouched.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test` (local fallback): passed, 106 tests across 27 files in 213.3 seconds. This does not replace the requested remote run.
- `npx vitest run tests/engine/l10-camera-framing.test.ts --project default --configLoader runner`: passed, 3 tests. The existing camera test now also checks one roar/reveal, five-second completion, and no replay after a later checkpoint restore.
- `npm run qa:threat -- --levels L10`: L10 has zero acceptance flags, including zero passive flags. The command exits 1 because this level-only diagnostic adds `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate` to the aggregate receipt; the L10 skilled route completed and the passive route hit its audit tick budget.
- Remote `npm test` was run twice unchanged; both runs hit the 240-second budget (241.0 and 241.1 s, exit 124). A green remote suite remains open.

## Visual capture and open work

The HIGH zoom-1 Scene Lab fixture produced frames 30, 150 and 299 in `/private/tmp/s193-captures/`. I inspected all three. Frame 30 shows the courier centered and the Mega cut off at the lower right; the opening farmstead caption has overwritten the courier's first line. Frames 150 and 299 show the Mega occupying the center and overlapping the courier, with the identification caption visible. The synthetic flat ground does not represent the authored farm environment. The camera composition and caption sequencing need correction and another visual review before this is ready.

The threat score's release behavior also needs direct audio verification. Finish these defects and obtain a green remote suite in a follow-up.
