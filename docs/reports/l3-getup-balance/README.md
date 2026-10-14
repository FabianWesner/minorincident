# L3 get-up balance — 2026-10-14 (partial, balance gate remains red)

## Isolation on Hetzner

Base: `cd34d145f` (10-14 main, including nav corner recovery and gate-fix).
The remote runner copies each experiment into its own disposable job directory.
`tests/levels/L3.test.ts` assertions and limits were used without edits.

| Remote variant on the current tree | S1 damage | Squad fallback → army | T-E21-09 / 10 |
| --- | ---: | --- | --- |
| Current tree | 140.4 | 9 → 9 | fail / fail |
| Before the three 94704cbd AI/retirement hunks | 55 | 9 → 5 | pass / pass |
| Revert only the shared `seek()` flow-field hunk | 140.4 | 9 → 9 | fail / fail |
| Revert only the two recoverable-body retirement guards | 55 | 9 → 5 | pass / pass |

The new recoverable-body protections cause the balance change; the courier-flow-field
fix, nav capsule recovery and rendering changes remain present in the passing guard
control. The guard reversions are diagnostic controls only. Shipping those reversions
would violate the required get-up behavior.

The current complete bot dies in S1 (at about 62 s, x=-82, Oak Avenue). Checkpoint
restore resets the live squad roster and loss history, and the intended death-loop
mercy then changes subsequent pressure. Nine reaching the army therefore does not
mean the officers cannot be bitten: the same baseline run records four corridor
turn events before respawn resets the roster.

`bisect-and-tuning.json` records the complete-bot measurements for the three isolated controls. No diagnostic reversal or tuning candidate is committed. The baseline is captured in `test-results/l3-getup-balance/levels-other.json`.

## Visual evidence

The new catalog row `tests/scenes/catalog/l3-s1-getup-balance.json` reuses the existing
S1 district, police actors and follow scenario, with the production L3 layout copy.
Its two-backend matrix covers high/low quality and zoom 1.5, 1 and 0.5. The isolated
fixture is a formation/visibility check; it does not claim to reproduce mission
population timing or the production police damage scaling.

`tools/scenelab/l3-s1-balance.ts` separately drives the production L3 mission with
ordinary complete-bot inputs, pauses on Oak Avenue in S1, and captures the game
camera at high/low quality and zoom 1 and 0.5. It records the mission, actual backend,
actual quality, settled zoom, and draw/triangle counters, with no god mode.

Viewed WebGL and WebGPU catalog sheets at both required zooms and quality tiers:
the courier remains readable against the road, the squad follows from behind and
regroups around her, infected and downed figures are visible in the street, and the
parked van leaves a visible route. Close zoom crops the outer officers as expected;
the immediate courier and nearby threats remain readable. Low quality reduces
shadow/detail coverage while retaining the silhouettes and street geometry. Both
backends show matching formation and camera framing.

## Shared bug fixed in this commit

`WorldHumans.bitten` survives checkpoint restore, although the restored entities come
from the checkpoint. An officer bitten in the discarded timeline is healthy again
but remains excluded from human targeting. `Mission.restore()` now clears this
cache after restoring entities. Saved infections remain excluded by the existing
infection check. The new checkpoint regression covers both cases.

This corrects unintended restored-officer immunity; it does **not** restore L3
balance. Get-up timers, whole-level corpse retention, and police damage at 50% are
unchanged. No existing assertion, limit, budget, or source asset was edited.

## Rejected tuning and next investigation

The closest private candidate clamped existing squad formation slots inside the
configured follow band, used L3 maxFollowM=4.5, and changed street emergence from
3 to 6 ticks. It finished in 298.37 s with no death, S1 damage 0, officer/player
knockdowns 238/51, and squad 9 -> 6 -> 0. Four focused tests passed. T-E21-10
failed because bitten officers died without any corridor conversion. At 9 ticks
completion timed out; at 12 ticks density escalation failed. These candidates are
not committed.

A useful next investigation is conversion capacity: L3 fills the infected cap
without the pending-turn/headroom accounting used by L8. Check whether natural
bitten officers can convert while recoverable bodies occupy the cap. Do not retire
recoverable bodies, script infections, raise budgets, or change police damage.

## Validation and limitations

- Hetzner final full unit: 238 files / 1,441 tests pass, 1 file / 7 existing tests skipped.
- Hetzner final full sim: 132 files / 1,017 tests pass, including alpha-tank and the new checkpoint regression. Timing-isolated runner used for performance assertions.
- Hetzner final L4 battlefield lifecycle: all 6 high/low seed cases pass.
- Full baseline levels: 264 pass, only original L3 T-E21-09/10 fail, 2 existing skips. This is **not** a full-levels green result for this commit.
- Local typecheck and lint pass; fresh production build passes.
- Catalog matrix: 12 cases pass across WebGL/WebGPU, high/low, zoom 1.5/1/0.5. Viewed required eight game-camera sheets; description above.
- Native E18 timing and the aggregate `verify E21` gate are unmeasured for this commit. Capture draw/triangle counters and scene-matrix checks do not establish native timing budgets.

The requested all-levels-green success condition has not been achieved within the
three-hour allocation. This commit is a reproducible diagnosis and a separately
verified shared restore fix, not an approved balance/deployment result.

Production WebGL baseline captures were also viewed: high zoom 1 shows dense
threats and officers beside the fence with prone bodies underfoot; low zoom 0.5
shows the courier clearly against the sidewalk and persistent bodies lining the
street. This exposes crowd overlap at close zoom; it is not evidence that balance
is repaired. The checkpoint HUD objective is already active during S1.

Final production S1 captures pass on WebGL and WebGPU, high/low quality and zoom
1/0.5, after the fresh production build. All eight images were viewed. Both
backends match in framing, crowd overlap at the fence, and retained corpses along
the sidewalk. High quality has 222/196 draws and 837,184/732,128 triangles; low has
168/158 draws and 359,768/326,709 triangles (zoom 1/0.5 respectively). Console
errors: zero. `s1-capture-metrics.json` retains backend/quality/segment evidence and
local artifact paths. These are counter checks, not native timing measurements.

The final full L3 file rerun was started on Hetzner, waited for a slot, and was
interrupted at the allocation limit before producing a verdict. Final all-levels
validation is incomplete. Log: `/tmp/l3-final-l3.log`.
