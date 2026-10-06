# E13 — Progression, Upgrades and Save

Implemented on `lane/e13-epic`, based on `ab7df4e`. Final gate results are
recorded below and in `completion-audit.json`.

## Built

- Added data-defined upgrade families, tier/action/level prerequisites and
  save-seeded, weapon-usage-weighted offers of three distinct cards.
- Added fixed story unlocks and the authored L1/L2/L3 weapon alternatives,
  two-card selection, level-dependent racks, monotonic weighted power and
  the existing survivor's cumulative gear tiers.
- Materialized modifiers at the load boundary: health, movement, melee,
  magazines/reload, throwable charges/radius, knockback, bat perks, nail-bat
  bleeding, specials and vehicle armor/boost. Base action data remains
  unchanged and the normal simulation tick does no progression allocation.
- Added validated localStorage schema v1 with settings, pending reward
  transactions, safe error recovery and a v0 migration hook. Continue resumes
  pending choices or restarts the selected level; it does not persist live
  physics, combat timers or position.
- Added character selection, continue, unlocked level selection and native
  button screens for unlocks, cards and rack setup. They pause simulation,
  trap keyboard focus, reject invalid selections and support touch scrolling.
  The existing E12 mission UI retains results and briefings.
- Added L2–L6 deterministic presets and additive debug API hooks. See
  `src/sim/progression/README.md` for integration details.

Bruno Simon's `Options.js` delegates storage to `Audio.js`; the browser-boundary
restore/store pattern was adapted from both, with an MIT attribution in
`THIRD_PARTY_NOTICES.md`. No new dependency or asset registration was added.

## Acceptance evidence

| Criterion | Tagged test and evidence |
| --- | --- |
| E13-AC01 | `tests/unit/progression/campaign.test.ts`: 1,000 seeds across all five reward rounds, unique eligible reproducible offers; statistical pistol and melee usage bias. |
| E13-AC02 | `tests/sim/progression.test.ts`: actual bat hit is 30 instead of 25; every firearm gains two rounds, including reload; nail-bat bleeding damages Hazmat without changing poison immunity. |
| E13-AC03 | Campaign unit test enumerates all 243 seeded two-of-three choice paths; each stage increases power and the final score is at least three times the initial score. |
| E13-AC04 | Unit and simulation capacity checks plus mouse, keyboard and touch browser tests rejecting a full rack; capacities are 1/1, 2/2, 2/2, 3/3, 3/3, 3/3. |
| E13-AC05 | `tests/e2e/save.spec.ts`: actual page reload and Continue deep-equal the entire saved campaign, including male survivor, upgrades, racks, settings and native Mono audio preference. |
| E13-AC06 | Unit corruption/version/migration/storage tests and browser recovery dialog with Start new; malformed data never reaches the simulation. |
| E13-AC07 | Valid reproducible L2–L6 presets; simulation and actual `loadLevel('L5', {progression:'L5-default'})` assert the expected loadout. |
| E13-AC08 | Unit/sim tier mapping and `tests/visual/progression.spec.ts` actual five-tier screenshots; existing E04-AC10 also passes for both survivors/four views. See `gear-sheet.png`, `gear-colors.json`, `gear-metrics.json` and `review.md`. |
| E13-AC09 | Three separate physical mouse/keyboard/touch flows through result, unlock, cards, racks, L2 briefing and Begin mission; only authored mission completion uses the test API. |

## Verification history and deviations

Work was delivered in independently checked slices: pure campaign/save data,
simulation application, browser screens/persistence, story choices and visual
evidence, action hooks and final integration corrections. The complete diff
was reviewed; integration hooks remain additive and no speculative framework
or asset pipeline was introduced.

- No acceptance criterion or specification Markdown was changed.
- The existing E17 standalone-export test incorrectly treated every committed
  production source as an integrated runtime asset. The tracked
  `bld.dugout/model.glb` was still reference-status. The test now enforces
  runtime exports/LODs for integrated/final assets while still requiring every
  referenced ID to be declared, matching the manifest contract and explicit
  placeholder policy. No runtime asset behavior was changed.
- The v0 migration fixture models the previous field name `level`; there was
  no previously shipped campaign schema to migrate. Unknown versions remain
  rejected rather than guessed.
- Initial verification exposed fixture issues: an overly short five-second
  wait during SwiftShader L5 loading, a survivor scenario lacking combat, and
  an uncleared reused pixelmatch mask. These were corrected without lowering
  damage, gear or navigation assertions. A later full run exposed a real
  settings race; aim assist now restores during simulation setup before the
  briefing appears. Failed-run evidence is retained separately from the final
  passing run.
- Per the latest lane instruction, main was not merged again and assets arriving
  on other lanes were not registered. Full central regression remains the
  integrator's responsibility; this lane ran the full unit suite, affected
  simulation/browser suites, E04 gear contract and the required final gates.

## Known limitations

No known E13 acceptance failure remains. Character art uses the existing code
placeholders until integrated art is available. Browser-local storage has one
campaign slot; unavailable/quota-limited storage displays recovery feedback.
The performance fixture is a warmed single-survivor combat arena, not a claim
about full-crowd district performance. Paused screenshot FPS is not used as a
gameplay performance measurement.

## Final validation and performance

All final commands exited **0** on runtime commit `9efce0a`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:unit` | 106 tests, 41 files PASS |
| `E2E_PORT=3329 npm run verify -- E13` | 19 headless + 29 browser tests PASS |
| `E2E_PORT=3329 npm run test:smoke` | 3 headless + 20 browser tests PASS |

The final browser runs have zero unexpected failures, zero flaky tests and
no retries. The final unit, verify and smoke logs contain no warnings. Every
criterion above is **PASS**; `completion-audit.json` maps each ID to its
actual passing result. Browser projects cover Chromium, Pixel 7 and iPhone
14 portrait/landscape, and WebKit; E13 navigation adds a 390×844 touch context.
Playwright used two workers under the machine-wide lock; Vitest was capped
at four. No dev server on port 3300 was started or modified.

Earlier integration evidence: 172 affected simulation tests across 12 files
pass (`logs/affected-sim.log`), 10 E03/E12/gear browser tests pass
(`affected-browser.json`), and the canonical E04-AC10 gear contract passes
(`gear-contract-browser.json`). Final smoke repeats earlier epic foundation,
driving and audio tests across their selected projects.

| Measurement | Result | Scope/budget |
| --- | --- | --- |
| Simulation p50 / p95 | 0.033 / 0.148 ms | 600 measured ticks after 120 warm-up ticks, L6-default combat-arena; p95 < 4 ms |
| Draw calls / triangles | 61 / 8,847 | Final gear photo fixture; ≤600 / ≤1,500,000 |
| Tier 0→4 changed character pixels | 25.69% | Correctly cleared ID-mask comparison; >5% |
| E04 female / male gear differences | 29.75% / 31.71% | Canonical two-survivor contract; >5% |
| Default end-of-level power | 210, 350, 440, 610, 665 | End L1–L5; gear 0, 1, 2, 3, 4 |
| Simulation fixture counters | 1 entity, 2 bodies, 6 colliders, 10 listeners | See `sim-perf.json` |

Final code review found no unnecessary abstraction to retain. Generated
artifacts from earlier epic runs were restored so this lane commits only
E13 evidence and its documented integration changes.

## Integrated branch validation

On `lane/integrate-m2`, E13 combines campaign application with E08's existing combat/navigation/NPC setup and E14's UI reset, pause, settings and title flow. E14's start/character/level menus create the same saved campaign; Continue and unlocked level selection use it. The real campaign hands results to E13 rewards without a competing E14 menu or keyboard focus trap. Isolated debug scenarios detach the campaign without deleting its save.

Campaign saves retain validated E14 text-size/colorblind settings and the Auto quality preference; effective quality also selects E08 civilian density. HUD layout and CSS files are unchanged. Test API 1.10.0 retains both NPC and campaign hooks, and the exact API harness checks both surfaces. Neither epic changed manifest fields versus its merge base; all 36 main reconciliation updates and the union of 275 IDs are retained. No binaries conflicted and no assets or dependencies were registered.

`npm run typecheck`, `npm run lint`, and `npm run test:unit` pass (112 tests / 44 files). `E2E_PORT=3332 npm run verify -- E13` exits 0 with 20 selected headless and 31 browser tests, two Playwright workers under the shared lock. The added full-UI regression starts through E14, reloads/continues saved settings, verifies 36 low-tier adult human civilians plus pets, and completes real two-card rewards into L2. Mouse-only, keyboard-only and touch reward flows also pass. An initial new-fixture assertion included pet dogs in the human count; the final assertion follows E08's existing kind=civilian density filter and separately preserves pet coverage. E13 status is done after integrated verification.
