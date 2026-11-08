# L10 story and stalker lane

Status: implementation committed; remote native validation in progress. No browser, push or deploy.

## Source and commits

Binding narrative: `docs/design/story-script.md`. Gameplay: the PO 2026-11-08 sections of `docs/design/endgame-story.md` and `docs/design/l9-l10-concept.md`.

- `4ee39020`: story route, six placed weapons and stalker presentation.
- `78656e6d`: merged main, including the orchestrator's story script and boss design.
- `3ec8cdca`: protected indoor hangar, cast, exact conversation, complete arsenal, physical escape gaps and moving route encounters.

## Implementation

- Objectives follow river escape → farms → restricted zone → hangar → cure delivery → installation → console defence → Mega → release. Seven underlying streaming regions retain their existing IDs and a 15-minute authored target. Optional weapons never gate the story.
- Six retained approach pickups: farmhouse hunting rifle, barn machete, workshop nail gun, shed Molotov, guard-tower assault rifle and checkpoint flashbangs. Existing dressing lanes remain separate; anchors are in `layouts/D-CURE/routes.json`.
- `src/levels/L10/layout.ts` composes gameplay structures before collision/nav assembly. The hangar occupies x2689.5–2724.5, z53–79, with a 2 m south doorway at x2707. Terminal and canister are indoors. Cast: Voss, Ruiz, another researcher, injured Sam or Private Reyes, and two guards. The post-crash survivor snapshot controls continuity.
- `LevelTenStory` plays the script's exact lines separately, preserves conversation progress in the checkpoint and pauses it if the courier leaves. The safe hangar suppresses incoming attacks and lowers the music; pursuit waits outside and resumes on departure.
- The handoff restores every lost/carried campaign weapon plus the authored arsenal and experimental flamethrower into selectable racks. The canister consumes no weapon slot. L10 racks allow all returned weapons. Save migration preserves L10's legitimate hunting rifle.
- Flamethrower: short burning cone, cover-clipped fire particles and fuel gauge. It currently reuses the machine-gun model/icon; a dedicated model/icon remains an asset-lane follow-up. The farm lane must connect its corn ignition to `weapon.flamethrower` attack events.
- Mega: 45-second introduction, 1.2× current progression run speed, one persistent identity, own 1.05 m clearance, three 2 m courier escape gaps and longer detour links. Walk damage cannot reduce its HP; weapon hits can briefly stagger it. Its real-position minimap dot pulses red. Its health bar remains hidden until cure installation. All damaging weapons hurt it in the finale.
- Route encounters are small moving groups admitted outside the widest zoom. Regional inventory does not release enemies. The final assault admits 9 high / 6 low per wave from three directions, within a 22 high / 14 low concurrency cap including the stalker. Admission lasts at most 5 s; the next wave is at least 30 s later and uncleared waves defer it. Reinforcements continue until both charge and boss are complete.
- Final defence radius is 40 m, fight radius 55 m. Existing machinery cover remains usable; fuel hazards and a one-use electric gate add environmental attacks. Charging preserves damage already dealt to the Mega.
- PO finale revision: the mounted gun has a rotating visible shield, blocks ground melee and frontal fire, and takes reduced damage from close stair climbers/behind. Its 20 rounds/s deal 18 HP each and permanently clear ordinary crowds. The bot now uses sustained bursts with cooling, climbs the platform, dismounts for stair pressure, and never uses close ground rockets. r14-height platform/stair fixes are pending main integration.
- PO epilogue revision: 8 s of ordinary player control, living infected kneel then recover into same-ID healthy people; dead bodies remain dead. A green ground tide and shared surface tint replace death mist. The cinematic crosses asset-based journey tableaus and saved living survivors, then returns to the seated courier and corgi. Exact Delivered ✓ at 50 s starts a 15 s pullback framing the entire L10 rectangle. Title at 65 s, 75 s scrolling licensed credits, Thanks for playing, menu. Repeat cinematics and all credit rolls can be skipped.
- The panorama keeps coarse full-map terrain, forces LOD2 landmarks (24 instances per family) and drops small props/dressing; no simulation regions are loaded for cinematic travel. A bounded nine-voice procedural brass/choir resolution accompanies the finale recording through the existing music bus.
- L10 acceptance rows and native evaluation now follow PO 2026-11-08; retired horde ranges, four known-weapon checkpoint pickups and centered Mega ring expectations were removed. Compound visual checks remain open.

## Validation

All heavy checks run remotely with `MI_LOCAL_FALLBACK=0 sh tools/remote/run.sh "$PWD" -- ...`; no Mac fallback.

- Earlier remote typecheck and lint passed. Final checks including the expanded epilogue and defence revisions are pending admission.
- `git diff --check`: passed.
- Controlled story fixture before the latest revisions: 44/44 checks passed across low/high; see evidence/story-probe.json.
- Initial ordinary-input route before defence changes: reached the hold but failed with 17 deaths; see evidence/native-low-initial.json. This failure prompted the PO defence revision, shield and bot fixes. It is not a completion proof.
- Final typecheck/lint, bounded full unit suite, updated native fixtures/competent finale, L10 acceptance and L10 threat audit: pending current remote queue.
- `tools/qa/l10-story.ts` labels injected fixtures separately from the ordinary-input route. It checks six actual pickups, gap clearance, exact Reyes dialogue, cast, indoor navigation, arsenal/save restoration, immunity, every damaging returned weapon, post-charge reinforcements and living-Sam continuity. The natural route separately measures completion, first widest-frame sighting, recurring close encounters and idle arrivals.

Remote infrastructure: newly created runners initially lacked `/srv/mi/locks` and `/srv/mi/queue`, so the pool treated idle runners as occupied. Those directories were created on runners 2 and 3, restoring dispatch. Earlier sandbox Git/network restrictions are resolved; they are not current blockers.

## Browser QA needed

The brief reserves browser work for the QA lane. Check both quality tiers and zoom extremes:

- Hangar enclosure, roof visibility/cutaway, entrance, indoor terminal/canister, cast spacing, exact subtitle timing and quiet music.
- Place-specific appearance of all six discoveries with the farm/vignette dressing, optional discovery markers and hostile dog marker shape.
- Mega's visible first encounter, repeated threatening gap escapes, real-position pulsing red dot, hidden walk HP bar, roar/footstep gain and no visible spawn pop.
- Whole arsenal selection, flamethrower fuel/readability and final machinery/fuel/electric-gate counters inside the enlarged zone.
- Green dust, kneeling/healthy recovery and dead-body preservation; staged journey shots; saved-survivor continuity; seated courier/corgi; Delivered ✓ phone buzz; 15 s full-map pullback at both aspect ratios; panorama draw/triangle budgets; triumphant hymn and readable 75 s credit roll, skip/thanks/menu.
