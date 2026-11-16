# s138-l9grab — L9 grabbed evacuation

Implemented and verified on simulation revision `7daf5712`. Living evacuees struggle free within 180 ticks after Defense complete, including AI-owned holds and hidden APC exit handoffs. The ordinary saved/flee lifecycle resumes their truck route. An occupied exit target can complete at the nearby clear position already reached by separation, preventing repeated reseating. No zombie stats, corpse persistence, Defense-complete timing, or invulnerability rules changed.

## Acceptance evidence

| Final simulation run | Last boarding observed after Defense complete | Maximum grabbed age |
| --- | ---: | ---: |
| HIGH road 1 | 0.35 s | 0 ticks |
| HIGH road 2 | 0.23 s | 0 ticks |
| HIGH road 3 | 1.07 s | 0 ticks |
| HIGH shortcut | 12.15 s | 180 ticks |
| LOW road | 0.72 s | 0 ticks |
| HIGH shortcut visual review | 10.75 s | 180 ticks |

All runs use mortal real input through tools/playtest, headless WebGPU and the browser pool, ports 5013/5014. Per-tick read-only grab tracking covers the post-defense window, including holds between census observations. HIGH road 1 passed evacuation but later stalled at the bridge; HIGH road 3 completed with four stationary-infected P2 observations. Other listed final runs completed with zero issues. These observations are retained in raw logs and are separate from the L9 threat audit.

The existing L9 vehicle test covers crowded native s124/s126 fixtures and the s136 completed-save load. Its added regression exercises an AI-owned grab outside the walking roster at ticks 179/180 and requires native boarding within the deadline. Hidden-passenger and exit-reset gaps found during runtime verification were corrected. Earlier failing runs remain in test-results; they are not counted as acceptance passes.

## Gates

- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: pass, 105 passed / one platform skip, 128.4 s, all 150 registered cases retained.
- `npm run verify -- E31`: pass, 106 tests / 27 files, 91.6 s (includes typecheck and lint).
- Latest standalone typecheck and lint: pass.
- L9 threat audit: skilled and passive complete, zero level flags. Aggregate PARTIAL_LEVEL_SELECTION reflects selecting only L9.
- Refreshed HIGH/LOW vehicle-motion gate: pass, exit 0.

## Visual review and artifacts

I inspected [boarding.jpg](boarding.jpg), a final-revision sequence from -0.52 through +11.43 seconds around Defense complete. Visible survivors travel along the ground toward the trucks, boarding advances from 1/4 to 3/4, then the APC departs after all four board. No visible teleport or solid-object clipping was seen in those frames; the dense crowd obscures parts of the doorway. The full frames are under `test-results/playtest/s138-visual-final/captures`.

[qa.json](qa.json) retains compact census evidence and final gate results under 200 KB. Native checks and per-tick timing support the numerical deadlines; the sheet records the inspected visual sequence. No deployment, push, main movement, zombie stat tuning, corpse deletion, or protected reference edits occurred.
