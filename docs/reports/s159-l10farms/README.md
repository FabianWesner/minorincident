# S159 — L10 farm encounter qualification

## Kill and telegraph follow-up

Fresh HIGH then LOW 480-second real-input WebGPU samples used a temporary read-only observer for `combat.kill` and `telegraph` events. Group IDs were mapped from one-second actor samples; captures are under `test-results/playtest/s159-events-high/` and `s159-events-low/`, and event traces are `/tmp/s159-events-high.jsonl` and `/tmp/s159-events-low.jsonl`. Events are matched to mapped, present IDs in the immediately preceding sample (at most 62 ticks); IDs and checkpoint restores can still confound attribution. A `downed` field means a recoverable knockdown, so these are not permanent-clear receipts.

| Group | HIGH unique IDs with kill event / mapped IDs; last event tick; telegraphs | LOW unique IDs with kill event / mapped IDs; last event tick; telegraphs |
| --- | --- | --- |
| Corn | 13/15; 8632; 14 | 8/8; 7234; 2 |
| Farmhouse | 11/12; 10858; 34 | 10/10; 9362; 8 |
| Shed | 16/17; 13380; 5 | 12/12; 11526; 17 |
| Depot | 10/10; 18866; 4 | 8/8; 19252; 16 |

All HIGH corn, farmhouse and shed kill events were recoverable downs; nine of ten depot events were downs. LOW recorded recoverable downs for all corn, farmhouse and shed events and eight of nine depot events. Group telegraphs included scream at the farmhouse and Alpha pounce or charge at the depot. Event emission supports mechanical distinction, but does not prove the cue was visible or escapable. The fresh run's first release samples were HIGH corn 3359, farmhouse 6359, shed 11279, depot 17279; LOW 3241, 5701, 9781, 15481. Exact clear times remain unproven.

The initial LOW shed count used all IDs seen over the run and included events before that group released. Time-local matching corrects it from 19 to 12 kill events and 31 to 17 telegraphs. Opened event-adjacent frames `s159-events-high/captures/campaign-L10-t7429.jpg` and `t18270.jpg`, and `s159-events-low/captures/campaign-L10-t6849.jpg` and `t16693.jpg` (all under `test-results/playtest/`). Red warning rings are visible in the first three; the LOW depot frame shows pursuit. The frames do not coincide with the referenced event ticks, so they show cues in these fights rather than proving the specific emitted cue was displayed or avoided.

## Actor disappearance audit

`ChunkResidency.sleepOutside` serializes eligible actors outside resident chunks or over the cap, releases living infected and deletes their active entity lookup. `InfectedSystem.settle` instead replaces a dead infected with a persistent corpse under the same ID. Thus an absent lookup can reflect streaming; it cannot prove a kill or clear. The retained observer did not subscribe to target-specific `combat.kill` events, so the existing traces cannot resolve those outcomes retrospectively. This is a driver gap, not evidence that corpses were removed.

## Admission and movement review

Opened an uncommitted four-frame admission review: HIGH `campaign-L10-t4656.jpg` (corn; first admission sample 4559), `t5584.jpg` (farmhouse; 5579), `t8063.jpg` (shed; 8099), and `t17366.jpg` (depot; 17399), all under `test-results/playtest/s159-observed-high/captures/`. These are up to 97 ticks away from sampled admission and cannot establish whether any actor spawned in view. The farmhouse and shed frames show crop edges and an open approach; the depot frame shows a road and industrial props. The fight sheet shows different settings and crowd shapes; role-specific telegraphs, escape routes and fairness remain incompletely observed.

The trace contains actors moving less than 1 m between samples ten seconds apart, including actors initially about 120 m from the courier. This is a stationary candidate, not proof of being stuck. For example, HIGH farmhouse Screamer begins around (987,-7), later moves 43.5 m and approaches within 1.7 m; HIGH shed sprinter moves 79.4 m and approaches within 2.6 m. LOW shed sprinter moves 70.5 m and approaches within 2.2 m. One-second samples do not establish the reason for other stationary intervals. No confirmed spawn-in-view or permanent stuck defect is asserted.

## Sampled encounter windows

These windows run from the first release sample to the first sample with no living recorded group members. At each first no-living sample every mapped actor lookup lacks HP and position; none is observed at zero HP in that sample. These are disappearance times from the entity store, not proof of death or a player clear. Mapped IDs did not change while continuously present in these traces, but checkpoint restores can alter the ledger. Damage is the sum of all `player.damaged` events during the window; the event has no attacker ID and overlapping windows double-count damage and deaths.

| Group | HIGH elapsed / all damage / deaths | LOW elapsed / all damage / deaths |
| --- | --- | --- |
| Corn | 186 s / 477.9 / 3 | 78 s / 50 / 0 |
| Farmhouse | 148 s / 437.9 / 3 | 69 s / 80 / 0 |
| Shed | 155 s / 387.9 / 3 | 77 s / 100 / 0 |
| Depot | 100 s / 145 / 0 | 117 s / 240 / 1 |

LOW medkit transactions occurred at tick 3522 near (731.47,28.32) and tick 18703 near (1516.47,-55.70). HIGH collected the service medkit at tick 19148. HIGH death samples were ticks 9059, 10379 and 11459 near x1066–1095; LOW's first was tick 16020 near x1474. Exact killing-blow attribution remains open. First sampled spawn positions form rings around each lane-shifted station; for example HIGH corn begins near (843,17), (817,29), (832,-3), while LOW depot begins near (1585,-60), (1575,-55), (1581,-69). These coordinates do not establish whether the actors appeared on screen.

## LOW retained-profile follow-up

A second LOW physical-input run retained its profile and resumed after a 480-second reservation. The first segment passed the farms with three deaths. The temporary observer recorded all four groups: corn release sample tick 3240, 8 slot keys, closest 1.1 m; farmhouse tick 5340, 10 keys, 1.1 m; shed tick 7980, 12 keys, 1.2 m; depot tick 14400, 8 keys, 1.0 m. Release positions and raw samples are in `/tmp/s159-low-resume-observer.jsonl`; captures are in `test-results/playtest/s159-observed-low-resume/`. Last samples with living members were ticks 7860, 9420, 12540 and 21360 respectively; at the next sample all corresponding entity lookups were absent, so these are not proven clear times. The prior LOW sample remains evidence of a ten-death retry loop. Per-encounter damage, peak capture inspection, fairness and threat-free travel remain open.

## Attributed real-input follow-up

A temporary read-only browser-context observer attached at tick 0 in each fresh WebGPU session, with physical-input driver, zoom 1.5 and five-second capture cadence. Its one-second samples record encounter slot keys, actor positions/health, nearest living infected, damage and pickup events. Raw traces are `/tmp/s159-high-observer.jsonl` and `/tmp/s159-low-observer.jsonl`; captures are in `test-results/playtest/s159-observed-high/` and `s159-observed-low/`. These are sample bounds, not exact admission ticks. Checkpoint rewinds can reuse keys and actors.

| Group | HIGH first release sample / distinct slot keys / closest sampled distance | LOW first release sample / distinct slot keys / closest sampled distance |
| --- | --- | --- |
| Corn horde | 3299 / 15 / 1.5 m | 3239 / 8 / 1.1 m |
| Farmhouse | 5579 / 12 / 1.1 m | 5459 / 10 / 0.3 m |
| Shed crossing | 8099 / 17 / 0.3 m | 28200 / 12 / 23.4 m |
| Depot Alpha | 17399 / 10 / 1.4 m | Not released by tick 28620 |

HIGH first observed corn admission at tick 4559, after release; other groups had admitted slots in the first release sample. HIGH recorded three deaths and one medkit at tick 19148 near (1516.32,-55.55). LOW recorded ten deaths and no medkit transaction; repeated machete pickups show checkpoint retries. LOW ended at (1039.36,-10.94), after the shed group released but before it reached the sampled player. This sample does not qualify LOW shed or depot. The per-second distance does not prove contact or visibility at spawn; clear times, encounter-specific damage, escape and threat-free travel still require analysis. No product severity is asserted from the death count alone because input policy and retry behavior are confounded.

## Validation and attribution follow-up

The required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90: 27 files, 105 tests passed and one skipped, 170.5 s within the 240 s budget. Typecheck and lint passed in the initial attempt.

Source inspection shows each group is released within 120 m on the X axis and individual admitted actors are recorded in `l10Encounters.state.spawned`; cap, placement, residency and safety can defer individual slots. The existing session logs do not retain those group-to-actor mappings, so source census and proximity cannot establish the observed fights. A subsequent real-input observer must record these mappings and checkpoint rewinds while sampling threat distance and captures.

## Inspected encounter sample sheet

[HIGH sheet](sample-sheet.jpg) was opened. Each panel is the available five-second capture nearest the highest one-second sample of living group members within 15 m: corn tick 4960 (sample peak 4919: 7), farmhouse 6817 (6899: 5), shed 11463 (11459: 9), depot 18302 (18299: 5). The corn panel shows threats in crop rows; the shed panel shows the courier dead amid a crowd; the depot panel shows several close attackers near containers. The farmhouse image precedes its peak by 82 ticks and shows little of that fight. This sheet does not prove admission visibility or a continuous fairness assessment.

LOW maximum sampled group members within 15 m: corn 2 at tick 4140, farmhouse 3 at 6660, shed 5 at 9060, depot 3 at 18120. The longest sampled spans without a living infected within 15 m were 19 s in each observed run (HIGH ticks 19079–20219, x1513–1596; LOW ticks 16140–17280, x1386–1433). No sampled span exceeded 45 s. This is sampled proximity, with transient threats and sampling gaps limiting precision; it does not prove absence of every longer quiet interval.

P2 provisional: the HIGH shed frame `test-results/playtest/s159-observed-high/captures/campaign-L10-t11463.jpg` shows death among a crowd, and the other LOW sample had ten deaths while repeatedly returning to the farmhouse. Driver behavior and overlapping groups prevent assigning a definitive balance cause. Visual distinction is supported by crops, shed clearing and containers, but fairness, spawn-in-view and stuck checks remain unqualified.

## Follow-up: incomplete real-input samples

The environment restrictions below were lifted. HIGH then LOW standard physical-input WebGPU sessions ran at zoom 1.5 on candidate `9dced069`, each for 480 seconds. HIGH recorded eight deaths and reached x≈1694; LOW recorded five deaths and reached the restricted zone at tick 25165. Neither completed the level in its sample. Raw logs and periodic captures: `test-results/playtest/s159-l10farms-high/` and `test-results/playtest/s159-l10farms-low/`. The initial renderer receipts say `webgpu`.

P3 driver gap: periodic samples cannot attribute infected to individual encounters or establish trigger, peak, clear time, damage, pickup transactions, spawn visibility, or continuous threat-free travel. No peak sheet has been produced. Four-fight fairness and distinctness remain unqualified. LOW navigation warning at tick 19434 near x1497 recovered to x1723 by tick 22742, where another warning occurred; HIGH warning at tick 26440 near x1694. These are progress-observer warnings, not established geometry defects.

## Earlier infrastructure attempt

The first sandboxed launch failed before gameplay: the default shared build cache was unwritable, `tsx` IPC binding failed, and the preview listener on port 5055 failed with `EPERM`. After sandbox permissions changed, the subsequent HIGH and LOW sessions above ran successfully. This history does not describe the current results.

## Remaining driver gaps

- Exact admission frames and continuous visibility are missing, so spawn-in-view is not qualified.
- The farmhouse peak capture misses the sampled peak; no continuous telegraph and escape review covers every fight in both tiers.
- Damage events lack attacker identity and encounter windows overlap; actor disappearance and checkpoint restoration prevent a proven player-clear time.
- Stationary samples need continuous context to determine whether an actor is stuck.

The report, JSON and inspected sheet are committed. Acceptance remains incomplete; no source or playtest tool was edited.
