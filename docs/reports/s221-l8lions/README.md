# L8 animal fights — s221 implementation notes

The all-cage solo rule is in place: survivor followers stage outside the next entry, their attack controller is suppressed while staged, the corgi remains with the courier, and follower wait samples ignore only explicitly marked cage waits. The flamingo cage no longer adds replacement birds. Lions now stalk in pairs, coordinate a front roar with a rear approach, telegraph pounces, pin and bite the courier, recover after a broken/missed pounce, swipe at close range, and enrage when their partner dies. Pin release clears the matching player knockdown; an ally or corgi hit frees her immediately.

## Feel notes

- **Lions:** Keep the pair in view. The frontal roar signals the flank; dodge the crouch and tail lash, then punish the skid. While pinned, mash melee; a companion hit releases immediately.
- **Flamingos:** Read the dive lane, step aside, and shoot the grounded bird before the flock cycles again. The authored flock is finite; dead birds stay dead.
- **Zebras:** Read the herd lane and leave it before the pass; use the turn at the fence to punish stragglers. The rear kick rewards not standing behind one.
- **Gorilla:** Interrupt the chest display, leave the ground-pound ring, and use the recovery after a bluff or slam. Throws make cover and spacing matter.
- **Monkeys:** The solo cage prevents soldiers from clearing the pack for the courier. Their animal-specific gameplay remains for the next lane.
- **Elephant:** Stay outside the charge line and bait it into heavy yard objects. The survivor group waits outside the entry while the courier and corgi handle the animal.

## Verification status

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node node_modules/vitest/vitest.mjs run --project nightly tests/nightly/mission-interactions.test.ts`: passed.
- Final two-shard threat merge: 0 acceptance flags. The L8 skilled route completed in 402.37 s with 0 deaths and 20 damage taken. A comparable main-branch run was not available in this workspace, so the requested deaths-vs-main comparison remains open.
- The requested native HIGH zoom 1 capture sheet is still open. Isolated headless Scene Lab captures ran successfully, but the reviewed pounce frame showed the courier standing and does not prove the arena pin. Native fight captures and visual review remain necessary.
- The required remote `npm test` ran twice unchanged and exceeded the 240 s budget both times (244.5 and 245.5 s). Both runs reported a vehicle test failure before timeout; the first also reported a save progression failure. Final assertion details were not emitted before termination.
- Licensed animal recordings and their processed voice sets remain open. Five candidate previews were downloaded to temporary storage after network access returned; their provenance, processing, integration and license snapshots remain to be completed.

- A focused remote rerun isolated the failures: save progression exceeded its 30 s per-test timeout, and the vehicle fixture failed the Hale charge assertion (`distance` remained Infinity). Moving Hale to the outside entry in that fixture alone did not fix it; that experiment was reverted. The finale handoff needs further investigation.
