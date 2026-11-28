# f9b-l10 verification

Source: implementation `07a04071`, handoff `7364a9f8`; source hash `4aaa00e41e75187952dacf7379c643b360ee61d87860717a3da1fa0e0e4dc9ea`. No gameplay changes were made in this follow-up. The full story and threat check summaries are retained in [evidence.json](evidence.json).

| Row | Before high / low | Current high / low | Remaining |
|---|---|---|---|
| L10-07 / 11 | Persistent Mega moved 372.9 / 203.9 m in one tick; L10-11 review recorded 314 / 292 m. | Acceptance maximum step 0.333 / 0.333 m. Both overpass crate-throw story checks pass. | Row-level acceptance still reports NOT CHECKED because other assault and visual clauses are incomplete. |
| L10-15 | Boss saved alive at 1072.8 / 1116 HP restored dead at 0. | Ready checkpoint fixture saved and restored 1108.65 / 1116 HP alive after a post-checkpoint kill; both clauses pass. | Five other checkpoint fixtures per tier error on missing `id`; row-level acceptance remains incomplete. |
| L10-09 | Both tiers had 0 container stacks, 1 tent, 1 generator and 1 light. | Both tiers have 3 scaled stacks, 3 tents, 3 generators and 4 lights. All story checks, including cast, handoff navigation and resume, pass in each tier. | Entry capture and no-infected safety still need independent visual review. |
| L10-03 | Complete route 1349.35 / 1194.37 s. | Acceptance complete route 1293.02 / 1307.02 s, 2 / 1 deaths. | Both exceed the fixed 1200 s limit. This follow-up prioritised story and threat gates; no fight or target was changed. |

The prior 86/92 story result failed three checks per tier: six living hangar cast, production resume of the cast and inventory, and controlled fixtures. Full-sized hangar props blocked cast spawn positions, causing the dependent fixture exception. The committed scaled and repositioned props resolve this: `L10_STORY_TIERS=high,low L10_STORY_SEED=0 node --import tsx/esm tools/qa/l10-story.ts` completed **51/51 high and 51/51 low**. High / low native routes in that checker completed at 1255 / 1131 s, with 3 / 1 deaths and 6 / 6 close Mega sightings. No checker was modified.

The fresh `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` audit reports **zero L10 flags** for both skilled and passive observations. Its only overall flag is `PARTIAL_LEVEL_SELECTION`, the explicitly ignored diagnostic notice. A previous assault-wave flag did not recur with the committed gate timing; the audit measures the actual route and the exact source hash above.

Both requested `qa:accept` runs completed: each reported 5 failing rows and 10 incomplete rows; each had 22 general fixture clauses with zero errors, 18 checkpoint clauses with 5 errors, and an identical control. `cure-disperse-ready` passes both tiers. The checkpoint errors are `Cannot read properties of undefined (reading 'id')` at cure-research, cure-corridor, quarantine-gate, field-hospital and cure-complex. Stationary policies hit their configured tick budget.

Typecheck and lint passed; focused `tests/engine/missions.test.ts` and `tests/engine/save-progression.test.ts` passed (12 tests). No `fix51-verify` receipt is committed in this follow-up. The prior [f9-l10 report](../f9-l10/README.md) describes source changes, visual captures and the remaining route-time investigation.
