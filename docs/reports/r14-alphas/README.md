# r14-alphas — Alpha types and move sets

**Timebox handoff:** all five type move sets are implemented and committed. Typecheck, lint and 107 unit tests pass. The complete threat audit has **two new L10 gate flags and one new skilled diagnostic flag**; the requested zero-new-flags gate is not met. L10 integration is a follow-up lane.

Baseline: `a7b70c78`. Implementation commits: `6029cc13` (shared scheduler/Brute), `c60fbaf9` (Thrower), `f6c4a75f` (Screamer cues), `6e4632f8` (Leaper), `032cf3c2` (Armoured and move contracts). Integration/ownership/admission fixes and autonomous move tests are verified at `80fa7231`.

## Implementation

The old brain chose slam versus charge from distance and tried support moves before that choice. There was no type identity. Support moves depended on a nearby corpse/prop or another infected, so ordinary encounters repeatedly selected the same available move. L4's collapse director also hardcoded charge/slam orders, which blocked other type move sets. It now keeps the authored staging/entrances, lets non-Brutes strike wire with the existing ordinary attack, and delegates crew combat to their type brain. The new `src/data/alphaTypes.ts` registry provides serializable type identity and explicit move sets, selected deterministically without consuming a new RNG stream.

| Type | Moves and counters | Existing look |
|---|---|---|
| Brute | 0.8 s straight charge: sidestep; wall impact exposes it for 1.5 s. 1 s, 4 m slam: leave the ring. 0.6 s human grab, brief hold, 6 m throw: get out of reach/line of sight or shoot it to release the victim. | Base Alpha |
| Thrower | Walk to a real object, reserve and visibly lift it for 0.8 s, then throw up to 25 m: cover or dodge the landing marker. Living infected missile lands 1.8 m short, rolls for 0.6 s, then pursues. Close barrage uses three separately lifted light props. | Worker Alpha |
| Screamer | 1 s inhale; 1 s stun for visible humans within 8 m, calls up to 6–10 available nearby regular infected to the locked target position. A hit interrupts the inhale; cover blocks stun. | Hooded Alpha |
| Leaper | 0.6 s pounce at 8–12 m, pin and bite: sidestep, shoot during recovery; existing pin escape/rescue controls apply. Vaults authored low barricades/fences up to 1.2 m. | Suit Alpha |
| Armoured | 0.6 s forward shield bash: step back or flank; push and stagger. Front bullets deal 25%; flank retains the existing Alpha bullet resistance; explosives/fire bypass directional armour. | Helmeted firefighter Alpha |

Shared rules: one special per Alpha, at most two Alphas (including the Mega) starting within a rolling 60 ticks, camera-visible start gate, locked targets/ground markers, per-move cooldowns, 0.8 s minimum exposed recovery with 1.5× incoming damage. Identity, admission timestamps, pickup/projectile state and all timers live on serialized entities. Restore shifts each owner's timers once; physical projectile velocity is reconstructed when resuming a saved flight. Finished throws release projectile ownership before recovery, so a later cancellation cannot reclaim an object another Alpha has reused. Minimum activation-to-activation cooldowns: charge 8 s; slam 10 s; human/object throw 12 s; roar 15 s; living missile 14 s; barrage 12 s; pounce 9 s; bash 8 s. No new dependencies or assets.

Throwers borrow existing Rapier prop bodies below 1,500 kg; fixed/braced/disabled props are excluded. Corpses retain their identity and settle at their new position. A living missile remains attached during pickup/flight, can be shot, is released on landing/cancellation and does not turn into a corpse just from being thrown. Physics throws keep the original body and its final resting pose.

## Encounter scope

No encounter counts, wave schedules, population caps, level layouts, health or base movement speeds changed. Type pools: L3 Brute/Thrower; L4 Brute/Thrower/Armoured; L5 Brute/Thrower/Leaper; L6 Screamer/Leaper; L7 Brute/Thrower/Screamer; L9 Leaper/Thrower; L10 all five. L4's existing armour jobs explicitly select Armoured, line jobs Thrower and breach jobs Brute. L8/Mega ownership remains with its lane.

**Design/accepted-level conflict:** current L3 and L6 encounter sources contain no Alpha spawns. This lane supplies their requested type pools but preserves their accepted encounter populations. Adding the design's first yard Thrower/tunnel Screamer would require an encounter change. L5 has only two authored Alpha slots, so its three-type pool is available across deterministic assignments rather than three simultaneous spawns. No specs were changed.

The final audit fixes keep the visible-special rule without stalling L4 at an offscreen run-up: an offscreen Brute approaches and strikes the wire with its ordinary telegraphed attack. Type selection cycles through each level pool by entity ID; the earlier hash collapsed both native L5 slots to Leaper and omitted Screamer from the sampled L7 encounters. Native-ID regression assertions cover those mixtures. Screamer stun now also holds the existing NPC stagger clock and pauses civilian AI. Follower pace excludes actors with an active stun/stagger as incapacitated, alongside the existing grab/knockdown exclusions; speed thresholds, seeds, observation windows and the two-seed voting rule are unchanged.

The L4 generic melee contact fixture explicitly uses Brute and resets the courier between independent probes: a successful new grab moves her 6 m, which otherwise contaminates the next probe's starting distance. The original contact states, time limit and damage assertions remain.

## Missing animations for the asset lane

Shared windup, throw/swing, locomotion and knockdown/get-up clips plus procedural poses are reused. Dedicated Alpha pickup/lift, arm reach/grab, charge scrape, two-arm slam, inhale/jaw, pounce/eye-glint, shield-bash, landing roll and wall-climb clips are missing. Existing outfits provide the closest available silhouette cues; a dedicated helmet/vest soldier Alpha and long-limbed Thrower/Leaper silhouettes remain art work. No asset files were edited.

## Verification

- Typecheck: passed.
- Lint: passed.
- Move contracts: passed in the existing infected AI test, including autonomous AI selection of all nine special moves, no effects before windup, real effects, recovery/cooldowns, overlap/admission limits, counters, three real physics barrage throws, live landing and directional armour.
- L4 contact regression: passed.
- Full `npm test -- --maxWorkers=1`: **107/107 passed**, 27 files, 85.6 s (240 s budget), at `80fa7231`.
- Full baseline threat audit: **31 stages / 10 levels**, 1,218.0 s, 5 existing gate flags.
- Full candidate threat audit at `80fa7231`: **31 stages / 10 levels**, 863.6 s, 7 gate flags; **2 new gate flags and 1 new skilled diagnostic flag**. Both audits exit 1 for their recorded gate flags. The before/after comparison **fails** because the L10 flags are new.
- L1/L2 native runs complete with identical full-state hashes: L1 `9b4431c2`, L2 `618cb09e`.
- Baseline sources were exported from `a7b70c78`; SHA verification matched all 3,241 files under src/tools/tests. Compact receipts, all 31 stage times, outcomes, hashes and flag sets are in [evidence.json](evidence.json).
- The prescribed `npm run qa:threat -- --maxWorkers=1` wrapper timed out at 601.0 s against its fixed 600 s limit. Complete serial audits use the same underlying `node --import tsx/esm tools/qa/threat-audit.ts --maxWorkers=1` command without that watchdog.
- Test collection: **150/150 cases, 43/45 files**. No browser was launched.

## Threat numbers

Native **skilled** phase receipts (seed 1, low tier). APM is attacks against courier / followers per minute; alive is the last path-census sample, not the peak. A dash means that phase has no path-census sample.

| Phase | Baseline seconds | Candidate seconds | Baseline APM courier / group | Candidate APM courier / group | Last alive baseline → candidate |
|---|---:|---:|---:|---:|---:|
| L3 defend | 26.2 | 26.2 | 16.03 / 0.00 | 16.03 / 0.00 | 18 → 18 |
| L3 checkpoint | 154.3 | 154.3 | 1.56 / 0.78 | 1.56 / 0.78 | 35 → 35 |
| L3 corridor | 145.9 | 145.9 | 0.82 / 0.00 | 0.82 / 0.00 | 35 → 35 |
| L4 hold | 183.2 | 184.3 | 166.00 / 0.00 | 257.56 / 0.00 | 80 → 79 |
| L4 hide | 732.8 | 107.7 | 324.42 / 0.00 | 54.05 / 0.00 | 65 → 76 |
| L5 look | 139.3 | 136.5 | 6.03 / 0.00 | 8.79 / 0.00 | 47 → 42 |
| L5 metro | 44.1 | 48.8 | 10.88 / 0.00 | 1.23 / 0.00 | 32 → 24 |

L4 high-tier passive hold: first breach **52.72 → 50.08 s** on the level clock; **63 → 68 alive** at breach. Minimum living plaza crowd after alarm +45 s: **54 → 47** (gate ≥40). Authored line break remains **190 s** after the alarm.

Existing baseline flags:

- `L3/criterion/L3-08 segment density and concurrent cap:FAIL` (also present in candidate)
- `L3/criterion/L3-11 native competent rate:FAIL` (also present in candidate)
- `L6/KITING_BELOW_ATTACKS_PER_MINUTE_2:0.00` (also present in candidate)
- `L8/phase/breached:SLOW_FOLLOWER:364` (also present in candidate)
- `L8/FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (also present in candidate)

Native skilled L8 and L10 reach their tick budget in both receipts. L10 progress regresses from `hold` to `dispersal-complex`: at 3,600 simulated seconds the courier is at x=3007.96, z=-5.10, 689.33 m from its objective, so hold/kiting samples are absent. The earlier `2ede5d03` full run reached `hold` without new L10 flags; type-assignment changes in `80fa7231` are a useful starting point for the follow-up. No previously completed native route regressed.

## Open items / follow-up lanes

**L10 integration / bot progression:** new threat flags remain. This lane stops after the completed full audit per the orchestrator’s timebox handoff; no further audit was started. Follow up on the dispersal-complex route/type interaction:

- `L10/MISSING_KITING_ON_FOOT_SAMPLE`
- `L10/step/hold:SKILLED_BELOW_ATTACKS_PER_MINUTE_8`
- `L10/UNOBSERVED_THREAT_STEP:hold`

Other follow-ups:

- Asset lane: dedicated silhouettes, accessories and clips listed above.
- Encounter-authoring decision: reconcile the design’s L3/L6 placements and three-type L5 mix with the accepted Alpha slot counts. This implementation preserves those counts.
- QA infrastructure: the 600 s threat wrapper budget is too short for the complete serial audit; both full receipts use its underlying runner.
- Browser verification remains open by instruction; use the checklist below.

## Browser QA needed

- Read each type and its windup/landing marker at gameplay zoom, low/high quality and night lighting; verify pose, sound/caption, counters and exposed recovery.
- Verify walk-up, overhead pickup, projectile collision/knockdown and persistent landing poses with a pushable, corpse and living infected; kill the missile in the air and during its landing roll.
- Check Screamer's blocked/clear sight, bounded call group and hit interruption.
- Check Leaper low fence traversal, sidestep/pin/escape and landing recovery.
- Check L9 APC pounce/hull contact and thrown wrecks in the road; the existing APC system owns hull damage.
- Run browser smoke/`verify -- E07` and review the affected Scene Lab captures; this lane launched no browsers.
- Check Armoured front/flank bullet feedback and forward bash arc.
- Review all five reused look variants; confirm that the helmeted firefighter is an acceptable temporary Armoured cue.
