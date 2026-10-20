# E29 · Level 7: The Ruined City

> **New 2026-10-11 per product owner:** [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md) wins on any disagreement. All ACs are **NEW 2026-10-11**. Numeric tuning, layout extents and timing below are **orchestrator defaults**, changeable without changing the PO's scope. This is proposed work, not implemented behavior.

## 1. Goal

Continue directly from the L6 night exit into Fairhaven's most destroyed state, introduce the unlimited rocket launcher beside the exit, blast a route for the surviving group through huge regular-infected populations and multiple Alphas, then leave by bus with the burning skyline behind them.

> PO, verbatim: "This should be the most destroyed version of the city so far."
>
> "Immediately near the subway exit is a wrecked military vehicle or position where the player can obtain a rocket launcher."
>
> "The rocket launcher has unlimited ammunition."
>
> "Level 7 is deliberately a power-fantasy combat level after the quieter, tense Levels 5 and 6."
>
> "There are no infected zoo animals in Level 7."
>
> "The final section contains a huge horde blocking the exit. The player uses the rocket launcher and other weapons to open a path while survivors move through behind them."
>
> "The last view is the burning skyline disappearing behind them as they drive into the night."

## 2. Depends on / Enables

E24 (Northgate exit and living group), E06 (existing rocket catalog and accumulated arsenal), E07 (regular infected + Alpha bars/four specials), E08 (group follower), E09 (bus passenger/set-piece transport), E10 (D-FAIR decay layers), E12/E13 (flow/checkpoints/loadouts), E14/E16, E18, E25 (night, fire light), E26 (breakable line remnants), E27 (rocket blasts/fire/smoke), E28 (weather preset) / **E30**, M3.

## 3. Scope

**In:** D-FAIR **W6**, the heaviest decay tier at night; rocket pickup at the wrecked army vehicle beside the shared L6 exit; unlimited ammunition; all accumulated weapons; enormous regular-infected groups plus multiple Alphas; survivor route to the city-edge evacuation corridor; final exit-blocking horde; working bus departure and burning-skyline shot; pair cameras, Scene Lab, real-input e2e, mobile budgets.

**Out:** infected zoo animals, a new city layout replacing Fairhaven, a kill-all objective, a boss encounter. No further weapon introduction beyond the rocket launcher.

## 4. Level structure and story beats (~5 min, orchestrator default)

| # | Beat | Location (`D-FAIR`, W6) | What happens | Target time (default) |
| --- | --- | --- | --- | --- |
| 1 | Night exit | Northgate exit, exact L6 handover anchor | The player and surviving group emerge into completely overrun Fairhaven; the wrecked military vehicle with the rocket pickup is immediately beside the exit. | 0:00–0:20 |
| 2 | Rocket power | wrecked vehicle → ruined streets | Pickup auto-equips; dense regular infected are cleared in sections. Multiple Alphas resist ordinary gunfire. All earlier weapons stay selectable. Objective: reach the evacuation corridor with the group. | 0:20–1:00 |
| 3 | Blast a route | recognizable Fairhaven blocks → city edge | Huge populations amid major fires, collapsed buildings, destroyed streets and wrecked military equipment; almost no functioning defenses. Survivors follow behind the player. | 1:00–3:30 |
| 4 | Final horde | final evacuation corridor | A huge horde blocks the exit. The player opens a navigable gap while survivors move through behind them toward the working bus. Completion depends on passage/boarding, not exterminating every infected. | 3:30–4:40 |
| 5 | Departure | bus at far end → road out | The surviving group boards, the bus departs, and the burning skyline recedes into the night. Direct handover to the zoo arrival. | 4:40–5:00 |

**Checkpoints (orchestrator defaults):** `night-exit`, `rocket`, `corridor`. No fail timer; survivor deaths use the existing continuing-campaign rule (zero survivors remains completable). Times are provisional and never padded. Single-seed completion gate follows the existing PO 10-09 policy.

## 5. Systems

### 5.1 District and W6 decay

Reuse `src/levels/districts/D-FAIR.ts`, L4/L5 layout builders and hero transforms. Add Northgate/city-edge route anchors and only the required edge extension; do not relocate recognizable plaza, Harbor Street, metro or Kessler landmarks. **W6 is new work:** `Tier` and decay schema currently end at 5; extend existing layer contracts, asset variants, validators, Scene Lab and save serialization to 6, with existing W0–W5 unchanged. W6 is world decay, not a new quality tier.

Orchestrator defaults: ≥ 12 major/persistent fires, ≥ 6 smoke columns (puffs within E18), ≥ 8 collapsed/heavily damaged facades, ≥ 6 wrecked military vehicles, ≥ 4 damaged street segments with passable detours and ≤ 1 active defensive position. These exceed L5's minima; compare both frames and dressing counts. All four Fairhaven pair cameras retain their transforms; ruin silhouettes remain identifiable. ≥ 2 connected routes from exit to corridor; no mandatory kill counters or invisible combat gates.

### 5.2 Rocket and accumulated arsenal

Reuse `src/data/actions/catalog.ts` `weapon.rocket-launcher`, `wpn.rocket-launcher`, `icon.rocket-launcher`, pooled projectiles and E27 `explosion.rocket`. Pickup is on the existing `veh.military-truck`/`veh.military-apc` wreck within **5 m** of the L6 exit (orchestrator default); stand-to-interact 0.6 s / `E`, auto-equipped. No magazine, reload, reserve, ammo pickup or overheat; existing cadence 0.8 shots/s remains the limit (orchestrator default).

Orchestrator default crowd fixture: 180 base blast damage, radius **6 m**, falloff 0.6, LOS through existing E27 blast resolver. Update the catalog splash and its mirrored `ExplosionDef` together; current radius is 4 m, so the larger radius is pending implementation. One shot permanently kills ≥ 20 of 24 regular 60 HP infected packed within 3 m of the impact, within one sim tick of blast resolution, leaving a ≥ 3 m navigable opening. Alpha uses E07 resistance (2 center blasts at 300 HP). Reuse E27 pooled debris/smoke/light effects, accessibility gates and the existing campaign ally-damage policy; no per-infected projectile bodies.

The PO's accumulated arsenal is bat, axe, handgun, machine gun, shotgun and rocket launcher. The standalone `L7-default` carries all five previous pickups; campaign preserves acquired weapons/ownership (optional earlier pickups are not silently lost). The MG still pierces and handles groups; the shotgun stays strongest against a close single Alpha.

### 5.3 Encounters and survivor passage

Orchestrator defaults: concurrent infected caps **200 high / 100 low**, ≥ 400 / 200 regular arrivals across a full run, **4–6 Alphas on both tiers** within the caps (E07). Emergence obeys existing offscreen/LOS/no-omniscience rules. Final horde starts with ≥ 120 / 60 regular infected plus ≥ 2 of the level's Alphas; queue excess inside existing director budgets, never silently omit Alphas on low tier. No zoo animal spawn or turned-zoo mapping in this level.

Reuse `Survivors.ts` / `LevelSixSubway.ts` group formation, straggler and no-teleport rules. Living survivor ids/state carry from L6 and into L8. Player-blasted openings update actual collision/nav; followers route through them. Boarding finishes only after every living group member enters the bus trigger; wait/regroup for lagging followers. The gate is escape, not all enemies dead.

### 5.4 Lighting/weather preset, music/sound

Preset **`L7` night**, continuous with `L6` at the exit (orchestrator default: dry, light wind and ash, no compulsory rain). Cool moonlight and warm large fires; city power mostly dead. E25 player/background contrast ≥ 3:1 at battle spots; light-field fire/rocket flashes, hero lights ≤ 8/3 shadowed high and 3/1 low. Reuse `Lighting.ts`, `WeatherSystem.ts` / `WeatherView.ts`, existing smoke/fire presets; preserve flash/shake/blood settings.

Music: reuse E16 combat stems and the licensed CC0/CC-BY pool; high combat energy after L5/L6, dip into the departing-bus scene (orchestrator default, no new track commitment). Sound: rocket launch/impact, dense infected, Alpha exertion, fires/collapse, group footsteps/calls, bus engine, receding city roar. Existing captions/noise radii and voice caps apply; blast sound does not reveal the player's live position to unseen infected.

### 5.5 Bus departure

Reuse `veh.evac-bus`, L4 kinematic passenger transport and mission cinematic framework. Orchestrator default: 6–10 s shot with skyline occupying ≥ 25 % of the first frame and ≤ 10 % of the final frame as the bus moves ≥ 30 m. Group and loadout pass into L8 with no reward screen or credits.

## 6. Photo spots and pair cameras

`l7-night-exit`, `l7-rocket-pickup`, `l7-rocket-crowd-before/after`, `l7-alpha-line`, `l7-ruined-plaza`, `l7-evacuation-corridor`, `l7-final-horde-before/after`, `l7-bus-boarding`, `l7-burning-skyline-start/end`.

**Pairs:** E22/E23 `pair-plaza`, `pair-harbor-street`, `pair-metro-entrance`, `pair-kessler-lane` at W0/W5/W6; `pair-northgate-exit` with E24; blast/horde pairs keep identical camera transforms before/after (orchestrator defaults). Store fixed seed/tick/camera, compare geometry and decay independently of lighting.

## 7. Bruno references

Reuse the repo's already adapted `DistrictView.ts` LOD batches and E27 first. Read-only references: `Explosions.js`, `World/Fireballs.js`, `Tornado.js`, `InstancedGroup.js`, `World/VisualVehicle.js`, `View.js` (see `08-bruno-reuse-map.md`). Never edit `folio-2025/`.

## 8. Acceptance criteria

All rows **NEW 2026-10-11**. Numeric fixture values are orchestrator defaults from §5. Each test carries its matching `@E29-ACxx` tag. Proposed files/fixtures are created during implementation.

| ID | Criterion | Verification |
| --- | --- | --- |
| E29-AC01 | Graph (exit → rocket → route → corridor → bus departure) is structurally completable with 0–35 living followers, no fail timer or kill-all condition. | sim (`T-E29-01`) |
| E29-AC02 | `complete` finishes one seed from `L7-default`, no cheats, boarding ≥ 60 % of its starting followers (orchestrator default); log timing without padding. | sim (`T-E29-02`) |
| E29-AC03 | L6→L7 preserves living survivor ids/state and acquired loadout; companions start at full health (orchestrator 2026-10-16: hours pass between levels); start is within 1 m of the shared exit anchor, preset remains night and no reward/menu interrupts. | sim + e2e (`T-E29-03`) |
| E29-AC04 | Rocket pickup on a wrecked army vehicle is ≤ 5 m from exit and usable before first required combat; interaction adds/equips rocket once. Default arsenal has all six PO-listed weapons selectable; campaign loses no prior ownership. | sim + e2e (`T-E29-04`) |
| E29-AC05 | 600 rocket shots produce no empty, reload, reserve, overheat or ammo HUD state; fire cadence is 0.8/s within one-tick tolerance. | sim + e2e (`T-E29-05`) |
| E29-AC06 | One rocket kills ≥ 20/24 regular 60 HP infected within 3 m of impact within one blast-resolution tick and opens a ≥ 3 m gap; E27 blast source/radius/falloff match the action and no recovered bodies re-block the gap. | sim (`T-E29-06`) |
| E29-AC07 | Default Alpha fixture follows E07: 2 center rocket blasts, 2 close shotgun shells (PO #37; unchanged Alpha HP/resistance), 43 army-MG hits to HP depletion; all four E07 special moves and shared world-space bar visibility/fill/phone readability pass. | sim + visual (`T-E29-07`) |
| E29-AC08 | Over one run 4–6 Alphas and ≥ 400/200 regular infected arrive high/low; concurrent total ≤ 200/100 including Alphas, offscreen emergence/LOS audit passes; no infected zoo animal ever exists. | sim (`T-E29-08`) |
| E29-AC09 | Composition uses D-FAIR W6; original four pair landmarks retain transforms/footprints (IoU ≥ 0.9); W0–W5 serialization still round-trips and W6 validates. | unit + static (`T-E29-09`) |
| E29-AC10 | W6 dressing meets §5.1 counts and exceeds W5 in fires, damaged/collapsed facades and wrecked military vehicles; ≥ 2 connected routes reach corridor, ≤ 1 active defensive position. | static + unit (`T-E29-10`) |
| E29-AC11 | Living survivors follow actual opened paths behind the player; **PO 2026-10-19 #37:** starts place the full roster in that same formation, with separate bodies through tick 66, so it does not converge through the stationary courier; no jump > 1 m/tick, losses logged by existing combat/infection rules, zero scripted roster deletion; zero survivors can still finish. | sim (`T-E29-11`) |
| E29-AC12 | Final corridor starts blocked by ≥ 120/60 regular infected + ≥ 2 Alphas; player opens a gap used by ≥ 1 survivor in the seeded fixture; boarding can complete while ≥ 10 infected remain alive elsewhere. | sim (`T-E29-12`) |
| E29-AC13 | A working bus stands at the corridor's far end; every living follower physically boards before departure; 6–10 s cinematic moves ≥ 30 m, skyline shrinks ≥ 25 %→≤ 10 % frame area; L8 receives exact roster/loadout. | sim + visual + e2e (`T-E29-13`) |
| E29-AC14 | `L7` is night, exit light matches L6; player contrast ≥ 3:1 at rocket/horde spots; dead street power, warm fires and cool moonlight render with E25 light caps on both tiers. | unit + visual (`T-E29-14`) |
| E29-AC15 | Music follows combat→departure phases; rocket/fire/bus cues, noise positions and captions are logged; E16 32/16 voice caps, mix and focus/pause rules hold. | unit + e2e (`T-E29-15`) |
| E29-AC16 | Death after `night-exit`, `rocket`, `corridor` restores weapon ownership, living/dead/turned roster, W6, encounter/director state and bus progress without duplicated pickup/actors. | sim (`T-E29-16`) |
| E29-AC17 | Headless Playwright real mouse/keyboard completes exit→pickup→horde→bus→L8 on one seed with zero console errors and all §6 captures; a mobile touch run reaches pickup/corridor with no HUD overflow. | real-input e2e (`T-E29-17`) |
| E29-AC18 | Pair-camera vision review A/D/E/G/H: recognizable Fairhaven, worst destruction so far, large rocket crowd clearance, Alpha human silhouette, followers escaping and receding burning skyline; each ≥ 7/10, all must items pass, no P0/P1. | vision (`T-E29-18`) |
| E29-AC19 | `perf-l7-final-horde` holds E18 high/low counters: draws ≤ 600/300, triangles ≤ 1.5M/500k, sim p95 ≤ 4/6 ms, infected ≤ 200/100, heap ≤ 400/250 MB; E18 lights/props/smoke/debris caps hold during repeated rocket blasts. | perf (`T-E29-19`) |
| E29-AC20 | In headless real-GPU WebGL2 desktop/phone profiles, peak-horde frame p95 ≤ 16.7/33.3 ms after warmup, transitions/blasts ≤ 50 ms desktop; settings for flash/shake/blood preserved and reload/disposal leaves resources within 10 % of initial load. | perf + e2e (`T-E29-20`) |

## 9. Notes and verification recipe

Use placeholders for pending W6 art without cutting counts/route/ending. Preserve E18 budgets by crowd/prop LOD, pooled blasts and time-sliced loading. Record counts and before/after blast frames, not just the rocket animation. Never claim the legacy test tags verify new behavior.

During implementation: `npm run typecheck`, `npm run lint`, `npm run test:unit -- --maxWorkers=4`, then `npm run verify -- E29`; Playwright workers ≤ 2, always headless. On macOS real-GPU WebGL2 use `--use-angle=metal`; WebGPU is manual. Save report/review, pair comparisons and performance counters under `test-results/epics/E29/`.

## 10. Implementation plan

Ordered lanes, each ≤ 3 h; add further lanes of ≤ 3 h if measured work grows, never compress the PO scope.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L7-S1 systems | 3 h | Extend existing `Tier`/layer validators and save/Scene Lab contracts to W6; reuse `DistrictWorld.ts`, `DistrictView.ts` and `src/assets/DistrictAssets.ts` decay variants. |
| L7-S2 systems | 3 h | Configure unlimited catalog rocket and mirrored `explosion.rocket` crowd radius; reuse `Combat.ts`, `Explosions.ts`, `Pickups.ts` and E07 Alpha. |
| L7-D1 district | 3 h | Reuse `src/levels/L4/layout.ts`, `src/levels/L5/layout.ts`, D-FAIR hero W5 assets, wrecked APC/truck/tank and collapse/rubble kit; build W6 variants + Northgate route extension. |
| L7-D2 district | 3 h | Dress city-edge corridor/bus point, connect ≥ 2 routes, fixed W0/W5/W6 and Northgate pairs; reuse `veh.evac-bus`, E25 night/fire and E28 ash. |
| L7-E1 encounters | 3 h | Reuse director/HouseEmergence, `Survivors.ts` and `LevelSixSubway.ts` group follower for dense groups, 4–6 Alphas, final horde/opened-gap traversal. |
| L7-E2 departure | 2 h | Reuse `LevelFourWar.ts` convoy pattern, mission cinematics and `CampaignUI.ts`: boarding roster, skyline departure, direct zoo handover. |
| L7-Q1 Scene Lab | 3 h | Proposed `qa-l7-{rocket,alpha,ruins,horde,departure}.json`, pair captures and E18 stress counters via existing Scene Lab tools. |
| L7-Q2 browser e2e | 3 h | Proposed `tests/levels/L7.test.ts`, `tests/e2e/levels/L7.spec.ts`, `tests/perf/l7-budgets.spec.ts`: real input, touch, all T-E29 ids, comparison/review/report. |
