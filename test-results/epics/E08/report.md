# E08 — Civilians, Corgi Companion and Escorts

**E08 is done for its own scope**, per the orchestrator decision. All local implementation and tagged tests pass. Campaign-bot verification for AC11, AC15 and AC17 is explicitly deferred to E19–E24 and carried into their acceptance tables; the original E08 criteria remain unchanged. `specs/status.json` is `done`. Objective patrols are not claimed as completed campaign runs.

## Built

- Data-driven adult routines, panic/flee/hide, seeded grab/bite/down/get-up, rescue, eyes-phase finishing, exact clothing variant/body-position transfer to E07, concurrent cap and per-level chain reservations.
- Nonlethal living-civilian weapon behavior; protected child contexts and brother knockdown; owner-dependent pet infection and systemic stray cats/dogs. Civilian gasp/silence/growl uses existing E16 cues.
- Immune corgi with shared E07 pathing, crowd separation, courage/hide/recovery, offscreen directional bark/HUD, pickup fetch and E06 lure.
- Adult/child escorts with path following, stopped-player behavior, reachable cover, proximity/leave-latched wait/follow, timed knockdown/revive/failure and campaign checkpoint timer/brain rebinds.
- W0/W1 kinematic traffic braking and pedestrian collision prevention; HP-bearing L5 sampled Catmull–Rom convoy stop/go; W2+ traffic removal and navigation rebake on decay swaps.
- One GPU civilian batch using E07's rigid-part clip texture; normal corgi/escort hierarchies and projected badges. Placeholder art is selected for every NPC asset below `integrated`; no new assets or dependencies registered.

## Acceptance evidence

Every ID has a passing tagged test. PASS means E08 scope is satisfied; campaign verification marked deferred is an outstanding acceptance obligation of the named level epics, per the orchestrator decision.

| Criterion | Result | Evidence |
| --- | --- | --- |
| E08-AC01 | PASS | `tests/sim/npc/civilians.test.ts` T-E08-01: 30 W0 routines, 18,000 ticks, per-20-second displacement checks. |
| E08-AC02 | PASS | T-E08-02: real attack event, flee by tick 30, threat distance increases over 180 ticks. |
| E08-AC03 | PASS | T-E08-03: 50 seeded real cycles, exact phase/eyes boundaries, actual mapped infected component and spawn position. |
| E08-AC04 | PASS | `followers.test.ts` T-E08-04: 10,800 input/combat ticks, no god mode, ≥95% within 6m and ≤30 blocked ticks; `companion.json`. |
| E08-AC05 | PASS | T-E08-05 plus `tests/e2e/npc.spec.ts` T-E08-05-browser: actual frustum, bark direction, `corgi-warning.png`. |
| E08-AC06 | PASS | T-E08-06: real input through maze, continuous wall-clear assertions, ≤6m exit gap, no movement after stopping. |
| E08-AC07 | PASS | T-E08-07: 120-tick 50% revive and 1,200-tick unattended failure. |
| E08-AC08 | PASS | T-E08-08 browser stand/leave/stand toggles and `escort-wait.png`, `escort-follow.png`. |
| E08-AC09 | PASS | `traffic.test.ts`: normal/panic braking and 1,800-tick pedestrian crossing without overlap. |
| E08-AC10 | PASS (placeholder stage) | `tests/unit/render/npc.test.ts` T-E08-10 and runtime node test, four `corgi-*.png` captures; final S01 character proportions are conditional on final art, as the AC specifies. |
| E08-AC11 | PASS; campaign deferred | `campaign.test.ts` T-E08-11-high/low: 12 actual composition patrols ×10,800 ticks, exact density averages and active input; `campaign.json`. `complete` policy is still an E19 stub, so literal complete-bot evidence is pending. |
| E08-AC12 | PASS | T-E08-12: kill and real knockback rescue inside grab, no rescue after bite; L1 diner result counter integration test. |
| E08-AC13 | PASS | T-E08-13: ≥100 real pistol attacks/hits through living civilians with zero civilian damage; bullet and melee finishing, including rising-body vulnerability. |
| E08-AC14 | PASS | T-E08-14: full cap delays down→rising; two real 15-person bite waves, L1 cap 15 and chain 8 never exceeded. |
| E08-AC15 | PASS; campaign deferred | Protected fixture stress for 36,000 ticks, unattended brother stays downed, plus 36,000 actual L2-map patrol ticks with the scripted brother/checkpoint. No child target events, infection or gore. Full L2 complete-bot run pending E20. |
| E08-AC16 | PASS | Five deterministic `turning-*.png` frames, `frames.json`, `compare/turning-sequence.png`, structured image review in `review.md`. |
| E08-AC17 | PASS; campaign deferred | 100 owner-grab seeds test the pet probability and 120–240-tick down/rise; stray-cat systemic test; corgi immune across all six composition patrols in both quality tiers. Full completed L1–L6 campaign pending E19–E24. |

Additional passing checks cover fetch/courage/lure, escort cover, actual L1 diner/tier swap, L2 checkpoint restoration and L5 convoy actor references/spacing/stop/go/HP failure.

## Validation

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | Exit 0 | `checks.json`, `logs/verify.log` |
| `npm run lint` | Exit 0 | `checks.json`, `logs/verify.log` |
| `npm run build` | Exit 0 | `checks.json`, `logs/verify.log` |
| `npm run test:unit` | Exit 0, 98 passed | `unit.json`, `logs/unit.log` |
| `E2E_PORT=3327 npm run verify -- E08` | Exit 0; 30 selected Vitest tests, 24 browser tests | `checks.json`, `vitest.json`, `playwright.json`, `logs/verify.log` |
| `E2E_PORT=3327 npm run test:smoke` | Exit 0; 3 simulation checks and 19 browser tests | `logs/smoke.log`, `smoke-playwright.json` |

The documentation/status finish was checked with the existing traceability suite: 2/2 pass (`finish-traceability.json`). Implementation and runtime evidence below is unchanged.

No browser failures, skips or retries in the final verifier; desktop Chromium, four mobile orientations and WebKit smoke run through the existing machine-wide lock with two workers. The visual captures and structured review pass the current-stage E08 checks. `acceptance.json` maps every criterion to its passing test titles and explicitly records the three campaign-verification deferrals.

## Performance

Actual first-three-minute values from `campaign.json`; these are E08 objective-patrol loads, not the 200-infected peak benchmark. High/low sim p95 budgets are 4/6 ms.

| Level | Tier | Average ambient adults | Target | Sim p95 ms | Input-driven distance m | Attacks |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | high | 60.0 | 60.0 | 0.497 | 758.5 | 360 |
| L2 | high | 40.0 | 40.0 | 0.385 | 758.6 | 360 |
| L3 | high | 24.0 | 24.0 | 0.237 | 756.5 | 360 |
| L4 | high | 12.0 | 12.0 | 0.135 | 746.5 | 360 |
| L5 | high | 6.0 | 6.0 | 0.132 | 739.9 | 360 |
| L6 | high | 3.0 | 3.0 | 0.154 | 736.3 | 360 |
| L1 | low | 36.0 | 36.0 | 0.130 | 758.5 | 360 |
| L2 | low | 24.0 | 24.0 | 0.102 | 758.6 | 360 |
| L3 | low | 14.4 | 14.4 | 0.112 | 756.5 | 360 |
| L4 | low | 7.2 | 7.2 | 0.087 | 746.5 | 360 |
| L5 | low | 3.6 | 3.6 | 0.067 | 739.9 | 360 |
| L6 | low | 1.8 | 1.8 | 0.094 | 736.3 | 360 |

Low-tier fractional targets alternate counts over a ten-second cycle; all twelve averages match their targets. `render-perf.json` records 30 civilian instances in one crowd draw, 96 total draws and 54,007 triangles (budgets 600 / 1.5 million). The paused SwiftShader probe's FPS/frame interval is not a hardware frame-rate measurement. The isolated earlier-epic 200-infected regression passes at 3.244417 ms p95, budget 4 ms (`earlier-sim-perf.json`).

The combat companion run records 100.0% of 10,800 ticks within 6 metres, maximum player obstruction 3 ticks (0.05 s), and corgi/player HP 100/100 (`companion.json`).

## Decisions and deviations

- Scope prose calls the finish window “last 50%”, while AC03 and the turning recipe require exactly the last 2 seconds. Implementation follows the explicit 120-tick AC03 flag; the 50 seeded boundary test verifies it. No criterion changed.
- Corrected the pre-existing E17 runtime-export unit test to gate source/LOD export requirements to `integrated`/`final`. It previously demanded runtime integration for committed unfinished reference/modeling output (`bld.dugout`); the asset pipeline and this job explicitly require placeholders below integrated. No asset status or runtime registration changed.
- Bruno `Bubble.js` and `InteractivePoints.js` were read and adapted to the event-driven TypeScript view/interaction lifecycle; notices added. E07 GPU crowd/NavGrid/AI and E04 survivor hierarchy are reused.
- Latest lane instructions explicitly prohibit a second main merge and defer full regression centrally. Kept the branch isolated; read-only inspection of current main still confirms the complete-bot stub. Earlier unit tests and the isolated E07 peak regression pass locally.

## Approved dependency-stage deferral

The orchestrator explicitly accepted E08 as done for its own scope and deferred only the campaign-bot verification portions of E08-AC11, E08-AC15 and E08-AC17. The original criterion text, density tolerances, timing windows, protection rules and immunity requirements are unchanged. No campaign-completion evidence is fabricated.

The E08 spec now has a short note for each deferral. Matching “Carried over from E08” acceptance items are added to E19–E24: AC11 density at both tiers in every level; AC15 child protection across full L2 in E20; AC17 corgi immunity in each level and throughout the continuous L1–L6 campaign in E24. Seeded pet-turn checks remain passing E08 evidence.

| Deferred verification | Carried acceptance items |
| --- | --- |
| E08-AC11 | E19-AC14, E20-AC13, E21-AC10, E22-AC12, E23-AC12, E24-AC12 |
| E08-AC15 | E20-AC14 |
| E08-AC17 | E19-AC15, E20-AC15, E21-AC11, E22-AC13, E23-AC13, E24-AC13 |

No remaining E08 scope issues. Campaign-stage checks remain mandatory for those later epics. Placeholder art is an authorized current-stage result; final corgi checklist B remains its explicitly conditional art follow-up. Main was not merged.

## Integrated branch validation

On `lane/integrate-m2`, E08 preserves E14 UI resets and its HUD photo spot alongside the NPC API/presets. No assets were registered or replaced: both manifests have the same 275 unique IDs. Incoming spec Markdown changes were excluded per the integration instruction; the dependency-stage deferrals above remain recorded in this report.

`npm run typecheck`, `npm run lint`, and `npm run test:unit` pass (101 tests / 42 files). `E2E_PORT=3332 npm run verify -- E08` exits 0: 30 selected headless tests and 25 browser tests, with two Playwright workers under the shared lock. E08 status is done after that integrated verification.
