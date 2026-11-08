# L10 story and stalker lane

Status: timeboxed handoff committed. Isolated finale/ending proof passes; full-route acceptance remains open. No browser, push or deploy.

## Source and commits

Binding narrative: `docs/design/story-script.md`. Gameplay: the PO 2026-11-08 sections of `docs/design/endgame-story.md` and `docs/design/l9-l10-concept.md`.

- `4ee39020`: story route, six placed weapons and stalker presentation.
- `78656e6d`: merged main, including the orchestrator's story script and boss design.
- `3ec8cdca`: protected indoor hangar, cast, exact conversation, complete arsenal, physical escape gaps and moving route encounters.
- `387a8fa9`: permanently mortal installed-phase Mega and corrected mounted-gun input policy; passing 70/70 finale proof.
- `83099866`: latest farm/vignette main integration through `5de85117`; overview caps retain main's low-quality rules.
- The shared Walker experiment in `04548493` was reverted at handoff because its queued check never started. Its diagnostic evidence remains available for the follow-up lane.

## Implementation

- Objectives follow river escape → farms → restricted zone → hangar → cure delivery → installation → console defence → Mega → release. Seven underlying streaming regions retain their existing IDs and a 15-minute authored target. Optional weapons never gate the story.
- Six retained approach pickups: farmhouse hunting rifle, barn machete, workshop nail gun, shed Molotov, guard-tower assault rifle and checkpoint flashbangs. The selected assault rifle casts the existing directional torch beam. Existing dressing lanes remain separate; anchors are in `layouts/D-CURE/routes.json`.
- `src/levels/L10/layout.ts` composes gameplay structures before collision/nav assembly. The hangar occupies x2689.5–2724.5, z53–79, with a 2 m south doorway at x2707. Terminal and canister are indoors. Cast: Voss, Ruiz, another researcher, injured Sam or Private Reyes, and two guards. The post-crash survivor snapshot controls continuity.
- `LevelTenStory` plays the script's exact lines separately, preserves conversation progress in the checkpoint and pauses it if the courier leaves. The safe hangar suppresses incoming attacks and lowers the music; pursuit waits outside and resumes on departure.
- The handoff restores every lost/carried campaign weapon plus the authored arsenal and experimental flamethrower into selectable racks. The canister consumes no weapon slot. L10 racks allow all returned weapons. Save migration preserves L10's legitimate hunting rifle.
- Flamethrower: short burning cone, cover-clipped fire particles and fuel gauge. It uses a dedicated prototype model with a pilot-light nozzle and a matching HUD icon; the authored muzzle/flame origin is at the burner tip. The farm lane must connect its corn ignition to `weapon.flamethrower` attack events.
- Mega: 45-second introduction, 1.2× current progression run speed, one persistent identity, own 1.05 m clearance, three 2 m courier escape gaps and longer detour links. Walk damage cannot reduce its HP; weapon hits can briefly stagger it. Its real-position minimap dot pulses red. Its health bar remains hidden until cure installation. All damaging weapons hurt it in the finale.
- Route encounters are small moving groups admitted outside the widest zoom. Regional inventory does not release enemies. The final assault admits 9 high / 6 low per wave from three directions, within a 22 high / 14 low concurrency cap including the stalker. Admission lasts at most 5 s; the next wave is at least 30 s later and uncleared waves defer it. Reinforcements continue until both charge and boss are complete.
- Final defence radius is 40 m, fight radius 55 m. Existing machinery cover remains usable; fuel hazards and a one-use electric gate add environmental attacks. Charging preserves damage already dealt to the Mega.
- PO finale revision: the mounted gun has a rotating visible shield, blocks ground melee and frontal fire, and takes reduced damage from close stair climbers/behind. Its 20 rounds/s deal 18 HP each and permanently clear ordinary crowds. The bot now uses sustained bursts with cooling, climbs the platform, dismounts for stair pressure, and never uses close ground rockets. r14-height platform/stair fixes were merged through main at `32222f42`, including the corrected stair regression at `11ed92b9`. The gun aims down at visible ground crowds for height-aware hitscan.
- PO epilogue revision: 8 s of ordinary player control, living infected kneel then recover into same-ID healthy people; dead bodies remain dead. A green ground tide and shared surface tint replace death mist. The cinematic crosses asset-based journey tableaus and saved living survivors, then returns to the seated courier and corgi. Exact Delivered ✓ at 50 s starts a 15 s pullback framing the entire L10 rectangle. Title at 65 s, 90 s scrolling licensed credits, Thanks for playing, menu. Repeat cinematics and all credit rolls can be skipped.
- Optional R2 dead-house porch toy is a once-only item, outside weapon racks/objectives. The corgi carries it; its post-credits return shows it only if found. This uses the existing pickup transaction and code-native ball geometry.
- The panorama keeps coarse full-map terrain, forces LOD2 landmarks (8 low / 24 high instances per family) and retains large complex/crop landmarks while dropping small props/dressing; no simulation regions are loaded for cinematic travel. A bounded nine-voice procedural brass/choir resolution accompanies the finale recording through the existing music bus.
- L10 acceptance rows and native evaluation now follow PO 2026-11-08; retired horde ranges, four known-weapon checkpoint pickups and centered Mega ring expectations were removed. Compound visual checks remain open.

## Validation

All heavy checks run remotely with `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" -- ...`; no Mac fallback.

- Final remote typecheck and lint pass, including the epilogue, merged height/destruction changes and permanent finale Mega mortality (`387a8fa9`).
- `git diff --check`: passed.
- Controlled story fixture before the latest revisions: 44/44 checks passed across low/high; see evidence/story-probe.json.
- Initial ordinary-input route before defence changes: reached the hold but failed with 17 deaths; see evidence/native-low-initial.json. This failure prompted the PO defence revision, shield and bot fixes. It is not a completion proof.
- Final native proof: **70/70 checks pass**, low and high. Explicit one-time healthy arena setup is labelled separately from the full route; subsequent play uses ordinary inputs, no God mode, teleport or health resets. Both runs complete: low mounts 4 times, earns 9 mounted-gun kills; high mounts 2 times, earns 16. Both have zero deaths, zero damage taken and zero close rocket explosions; neither needs a rocket. Charge completes at 66.28 s; release at 68.62/69.13 s; title follows exactly 65 s later. Credits complete after the separate 5 s title, 90 s roll and 6 s Thanks phase. See `evidence/finale-proof.json`.
- The first finale fixture wrongly followed stale approach waypoints; corrected in `d9321a67`. The next run exposed actual Mega resurrection after conventional lethal hits and a bot stair approach overwritten by dodging. `387a8fa9` makes the installed-phase boss permanently mortal with all weapons and fixes the ordinary-input gun approach. Earlier failed receipts remain in Git history and `finale-proof-initial.json`.
- Full default unit suite: stopped by the required 150 s cap (150.7 s, exit 124; wrapper exit 1). No assertion failure appears before the timeout. This is incomplete, not a suite pass.
- Full-route acceptance: low/complete exhausts its 3,600 s simulation budget before the first farmhouse find (54 deaths, zero kills), while the early Mega appears at 51.92 s and ordinary idle arrivals remain zero. The other variants were stopped after that reproducible blocker; acceptance exit 143. Its receipt is preserved under `evidence/acceptance/receipts/L10-low-complete.json`.
- Threat audit was started remotely, then stopped after 179 s because its skilled/kiting policies repeat the same blocked approach. Exit 143; no valid final threat receipt is claimed.
- Short ordinary-input diagnostic on merged main confirms the stalled bot sends zero movement with no physical collision (x695.99/z−4.84, starting around 36 s, first death at 63.13 s). A candidate explicit player-grid change (`04548493`) waited over seven minutes in the shared FIFO without starting; it was cancelled (exit 130) under the orchestrator's time box and reverted. Root cause remains a follow-up. The merged vignette/farm source has not received a final green full-route acceptance receipt or a fresh typecheck/lint run.
- `tools/qa/l10-story.ts` labels injected fixtures separately from the ordinary-input route. It checks six actual pickups, gap clearance, exact Reyes dialogue, cast, indoor navigation, arsenal/save restoration, immunity, every damaging returned weapon, post-charge reinforcements and living-Sam continuity. The natural route separately measures completion, first widest-frame sighting, recurring close encounters and idle arrivals.

Remote infrastructure: newly created runners initially lacked `/srv/mi/locks` and `/srv/mi/queue`, so the pool treated idle runners as occupied. Those directories were created on runners 2 and 3, restoring dispatch. Earlier sandbox Git/network restrictions are resolved; they are not current blockers.

## Done and open at handoff

**Done:** source-script hangar story/continuity, six retained finds and complete arsenal, flamethrower combat/VFX, early immortal stalker and narrow escapes, revised bounded defence and protected crowd-clearing gun, permanent finale Mega mortality, green-dust healthy recovery, 65 s release-to-title sequence, bounded whole-map pullback, procedural hymn, optional corgi toy and 90 s pausable/skippable licensed credits/Thanks/menu. The isolated low/high finale proof is green on `387a8fa9`, before the final vignette/main merge. Full campaign completion is unverified.

**Open / follow-up lanes:**

1. Resolve and verify the full-route navigation stall, then rerun L10 acceptance and threat policies on the integrated source. Preserve the honest failing receipts. The older threat audit still imposes a competent-policy hold attack floor; review that against the new protected gun/breather design before treating it as a balance target. Passive threat potential and stair reachability must remain checked.
2. Complete the default unit suite in bounded batches; the mandated 150 s whole-suite run timed out. Recheck typecheck/lint after the final main merge and route-policy changes.
3. Browser QA below owns actual visual/audio/performance approval. No GPU performance, first-view cinematography or hymn audition is claimed by this native lane.
4. Asset lane: the dedicated flamethrower model/icon is documented in [r15-flamer](../r15-flamer/README.md), including LOD and in-game firing evidence. Farm/destruction lane: connect dry-corn ignition and removal of its sight/movement cover to the flamethrower; this lane did not edit farm dressing ownership.

## Browser QA needed

The brief reserves browser work for the QA lane. Check both quality tiers and zoom extremes:

- Hangar enclosure, roof visibility/cutaway, entrance, indoor terminal/canister, cast spacing, exact subtitle timing and quiet music.
- Place-specific appearance of all six discoveries with the farm/vignette dressing, optional discovery markers and hostile dog marker shape.
- Mega's visible first encounter, repeated threatening gap escapes, real-position pulsing red dot, hidden walk HP bar, roar/footstep gain and no visible spawn pop.
- Whole arsenal selection, flamethrower fuel/readability and final machinery/fuel/electric-gate counters inside the enlarged zone.
- Green dust, kneeling/healthy recovery and dead-body preservation; staged journey shots; saved-survivor continuity; seated courier/corgi; Delivered ✓ phone buzz; 15 s full-map pullback at both aspect ratios; panorama draw/triangle budgets; triumphant hymn and readable 90 s credit roll, skip/thanks/menu.

## Handoff and reproduction

The orchestrator explicitly ended this lane at the ~3 h time box and assigned leftovers to follow-up lanes. All working implementation and existing receipts are committed. No check or queued job is left running. The overall full-route goal is not claimed complete.

Start the navigation follow-up with the short diagnostic, then run full acceptance/threat after resolving the approach:

```sh
MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" \
  --pull docs/reports/eg-l10-story/evidence -- \
  node --import tsx/esm tools/qa/l10-route-diagnostic.ts
```

`tools/qa/l10-final-checks.sh` contains the sequential typecheck, lint, finale proof, 150 s unit-suite attempt, full acceptance and threat commands. Keep all heavy commands remote, one at a time, with one Vitest worker. No Mac fallback or browser is authorized for this lane.
