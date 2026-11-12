# PO UAT 11–12 real-input QA — provisional HOLD

**Target:** `main` at `832d397886ede0042d3dc6867d4416238f48e507` (batch 89 / PROD 20984444), HIGH first at zoom 1 and 1.5, then LOW at zoom 1.

## Resumed execution

The sandbox was lifted. The pool is reachable and a fresh QA build passed. A bounded 60-second HIGH zoom-1 L6 real-input sample completed without deaths, assists, or objective skips (54 simulation seconds, 74 army-MG attacks); it reached retreat but did not complete L6 or measure post-hatch pressure. Receipt: `test-results/s88-b90high/high-z1-l6/summary.json`. The checkpoint-yield capture was opened: HUD shows the retreat objective, survivor-under-attack warning, a visible armed courier, and enemies on the minimap. The driver recorded 33 seconds without objective progress during the authored shelter rest; this needs review before classifying it as a defect. The automatic capture audit also changes quality/zoom for supplementary stills; these do not constitute the requested full HIGH/LOW passes. All remaining checks below remain open. No browser check is running.

## Verdict

**HOLD — QA incomplete.** No gameplay behavior has been observed in this run, so none of the PO findings can be marked fixed or reproduced. This is an execution hold, not a finding that the game itself failed.

## Evidence gathered

- `npm run build`: PASS (production build completed).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run browser:pool`: BLOCKED before startup; tsx could not create its IPC socket (`listen EPERM`). Retrying with `TMPDIR=/private/tmp` produced the same error.
- Pool health at `127.0.0.1:4329`: unavailable (`EPERM`). No pool daemon was already running.
- `sh tools/remote/run.sh "$PWD" -- npm test`: EXIT 69; scheduler reported no healthy Hetzner runner and that this command cannot use the local Mac fallback.
- Worktree was clean before this report; current revision is also `main`'s revision.

## UAT coverage

No browser session, real input, capture, or gameplay observation was made. HIGH zoom 1, HIGH zoom 1.5, and LOW zoom 1 remain unmeasured for every requested level and finding:

- L6: attack cadence after first hatch closure, including the required 30-second windows.
- L7: bus departure and collision with soldiers.
- L8: 14/14 boarding timing and driver-door marker.
- L9: rail-crossing hatch stall, final-bay controls, courier pose at handover, and school-bus/APC overlap.
- L10: hangar weapon selection by click and key, molotov return-to-previous-weapon behavior, Mega hit/recovery, and crops on roads.

The verbatim PO reports remain open: L6 “After I closed the first door, no more Zombies attacked the group, which made the game boring from there on”; L7 “The bus is crashing to soldiers”; L8 boarding stalled at 0/14; and all listed L9/L10 reports in the job request. They are not counted as reproduced findings because this run did not observe them.

## Open work

Restore the approved browser-pool startup and remote runner availability, then rerun the requested one-browser, headless, real-input QA using `tools/playtest` and capture/open the relevant images. Record observations, stuck moments over 10 seconds, and fun/boring/harmless notes per pass; create the requested contact sheet from inspected captures; then replace this provisional verdict with the evidence-based GO/HOLD and P1/P2 list.

No contact sheet is included: there are no captures from this run, and an empty or synthetic sheet would misrepresent visual QA evidence.
