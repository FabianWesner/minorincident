# Minor Incident

Minor Incident is a browser based isometric zombie action RPG built with TypeScript, Vite, three.js, and Rapier.

## Get started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The development server uses port 3300.

## Build and checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
E2E_PORT=4871 SCENE_PORT=4872 npm run test:smoke
npm run scene:gate
npm run qa:threat
```

Acceptance reports are generated with `npm run qa:accept -- --level all`. See [the specs index](specs/README.md) for project requirements, [the acceptance guide](docs/reports/fix51-verify/README.md) for evidence and review status, and [acceptance review freshness](docs/reports/fix51-r9i/README.md) for review source digests.

## L6 PO changes (2026-11-25)

The PO requested approximately half as many infected and a closed tunnel whose pressure enters through closable hatches. **The lane is not accepted yet:** the western end remains open, the current threat gate reports three L6 retreat flags, and the full remote unit suite has not completed after the latest changes.

### Authored changes

- First shelter breach 8 → 4; second breach 10 → 5, with 1.5 s spacing within the existing 10 s stream. Pre-stream reservations now use the authored second count instead of 10.
- Director setting 66 → 33 on both tiers; low retains its existing ×2 scaling, making its effective cap 132 → 66. Recurring pressure is 4 → 2 per cohort, with the 14 s interval unchanged. Ahead/behind source distance is 18 → 8 m from the walking tail.
- Six maintenance/side arrivals are 2 → 1 each; the old one-member duplicate on hatch break is removed. Authored Alpha roles remain. The original service-gate durability and 8–12 s versus five infected criterion were restored: gate HP is not part of the requested count change.
- Pressure candidates exclude tunnel ends and shelter doors. Story waves accept only their requested shelter door (0 or 1); unknown waves have no candidates. Existing zombie stats, speed, damage and AI were not modified by this lane. The base already contains L6-specific AI branches, including a −6 m player target-selection bias, so literal identical AI across levels is not established.
- Infected track-edge navigation has apertures at six service doors. Closing a hatch installs an infected blocker until its eighth bash breaks it. Restores reconcile blockers with the saved hatch states. The human navigation grid remains open for the escort. An infected-only eastern boundary blocks the exit end; **the western end is still open**. The current subway layout has no terrain chunks, so L6 does not instantiate `ChunkResidency`.
- [L6 acceptance rows](docs/qa/level-acceptance.md), wave counts and existing assertions were updated for the PO counts. The threat gate also checks the retained skilled retreat attack-rate floors and a 20 s first-player-attack limit. No new test cases were added; the budget remained 148/150.

### Evidence and open work

- [Native trace receipt](docs/reports/s239-l6half/native-trace.json): reconstructed base/current skilled seed 1 full-route births **79 → 38**, peak concurrent infected **41 → 20**, duration **203.85 → 192.50 s**. The bot's shelter weapon and positioning policy also changed, so this is not an isolated controlled comparison. The historical pressure receipt separately records retreat births 96 → 26 and peak 30 → 20, with different route durations. The archived base wrapper could not read Git provenance after writing the native receipt.
- The skilled and early-close seed 1 traces each record **35** authored admissions: nine through shelter doors 0/1 and 26 through service doors 2–7; none through endpoint 8. In a separate native probe, six switch completion states installed eight-hit blockers; no arrivals occurred before door 2 broke at tick 1321, then two entered through it at tick 1681. The fixture set switch completion directly and held other bash timers; it did not simulate walking to each switch. The existing checkpoint test covers restoring both open and closed hatch blockers.
- All six skilled routes in the latest pressure matrix completed and recorded both ahead and behind arrivals. The direction classifier uses service-door x against the walking tail sampled before the update, so classification is approximate within one tick. Player attacks were **0.45–1.77/min**, follower attacks **2.21–4.54/min**, and seeds 2 and 3 took 20 and 10 HP damage. These miss the retained L6-07 floors of 11/min, 5/min and 30 HP. Skilled seed 1's first player attack came **90.43 s** into retreat; 29/36 observed infected were reachable at least once and 2/36 came within 2.5 m.
- The most recent completed all-level two-shard audit predates the checkpoint fix and restored gate; it failed with three L6 retreat flags. The later focused L6 audit still reports the same three flags, plus its expected partial-selection flag. The earlier zero-flag verdict predates the strengthened engagement checks and is not current acceptance evidence. The L8 skilled receipt has 12 diagnostic flags reproduced on the base revision; the separate threat proof stops at the pre-existing L9 `road-2` safe-detour assertion.
- The eastern boundary blocks infected in native grid and solid-registry probes while allowing human crossings; both skilled and passive routes complete. However, after the courier exits, the recorded passive snapshot has 26 living infected and none reachable, and the skilled snapshot has three and none reachable. Exit lasts less than the gate's 20 s sustained-unreachability threshold. The western end needs a design that preserves the shelter breach without stranding recoverable infected; a design choice is pending. Five visible maintenance-corridor placements do not align one-to-one with the six authored service-door x positions, so visual alignment remains to be reviewed.
- The restored gates held **9.82 s** against five runners at all three gates and both tiers in the existing controlled native fixture; closed gates blocked sight and movement, open gates allowed both. This is a fixture, not a full route.
- Typecheck and lint passed after the checkpoint fix; the existing focused mission test passed, including restoring open and closed hatch states. The local wave invariant passes the L6 hatch and eastern-wall assertions, then fails a threatened-escort one-tick assertion reproduced identically on the base revision. L4 low also fails 35/36 alarm arrivals, identically on base. The full remote unit command repeatedly hit its 240 s budget under runner load; the last completed remote pass predates later gameplay changes. A local NPC diagnostic passed 3/3 and does not replace the required remote suite.
- Timing and placement experiments were discarded: nearest-door ranking, proximity windows, player-proximity ranking and a 7 s first-pressure offset did not meet the engagement floors; the proximity window also lost behind arrivals and the offset produced zero player attacks in seed 3. Fixed and conditional western walls either stranded infected or stayed open for much of the retreat. No experimental routing or seal remains in the source.

A separate native seed 1 identity probe tracked 20 recurring pressure admissions until each left the active pool or its ID was reused by a logged wave. None came within 2.5 m of the player or recorded a player/escort attack; one came within 2.5 m of an escort. This points to an actual pressure-contact gap, not merely a low aggregate attack-rate threshold. The probe samples living visible actors and does not attribute unlogged later reuse.

A 45 m eligible-door window was also tested across six skilled routes. It improved follower attack rates to 5.56–7.20/min and damage on seeds 1–2, but seed 3 still had 0.45 player attacks/min and 10 HP damage; direction counts became 13–14 ahead versus 2–5 behind rather than alternating. The experiment was discarded.

The existing wave invariant was instrumented to print its interim L6 census before the later escort assertion fails. On both tiers, breach cohorts, the retreat probe and all six service-entry actors were admitted and reached an attack in isolation. The hatch probes make arrivals immortal, restrict targets to the courier and renew press/rush cues; this does not establish natural combat-route contact, which remains failing.

A native passage probe found that existing static colliders still block the outer side of service doors (for example x=54 around z=11), even though the track-edge aperture is open; current cohorts spawn on the track side. An experiment cut those colliders only for infected and opened all six sampled passages, with closed hatch blockers sealing them, but introduced early-close follower pace flags. A further outer-side spawn experiment left several isolated wave actors unreached. Both experiments were discarded; actual passage traversal and its interaction with pacing remain unresolved.

### PO decision and follow-up (2026-11-26)

The PO chose “Match live, then ship”: L6’s blocking skilled retreat floor is **7.5 player attacks/min**, first player attack ≤ 20 s, follower attacks ≥ 5/min, and `qa:threat` must have zero flags. **11/min remains the reported target.** The gate and L6-07 acceptance row now reflect that decision. The seed 1 retreat probe after halving and pressure-source work measured **0.98 player attacks/min, 3.90 follower attacks/min, first attack 2.78 s**, with two retreat reachability flags; it does not pass. Three bounded placement variants were tried, including live courier-position admissions. A separate target-selection diagnostic made first contact later. None reached the attack-rate floors. L6 level checks, `mission-interactions`, typecheck and lint pass locally; all-level `qa:threat`, remote unit, and the final commit remain open. Git merge/commit metadata is outside this managed worktree’s writable boundary, so the required `own/l6press` merge was applied as tracked worktree edits without advancing refs.
