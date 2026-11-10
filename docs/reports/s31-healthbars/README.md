# s31-healthbars — incomplete

Cause: infected eligibility used any damage or proximity within 15 m, then nearest-N caps (6 normally, 5 on L10) could discard player-hit targets.

Partial change: added a serializable infected hitByPlayer flag in the shared damage path for positive damage sourced by entity 1. Removed nearest-N selection from the renderer and replaced proximity/any-damage eligibility with player-hit or courier-targeted interaction within 6 m, retaining mandatory bars.

Before: ordinary idle infected within 15 m eligible; only nearest 6/5 selected. After (code, not visually verified): ordinary eligibility requires attributed player damage or courier targeting within 6 m; no nearest-N selection.

Checks: typecheck PASS; lint PASS; focused l4-contact test FAIL at line 302 (converted npc.national-guard expected eligible, received false). No checks remain running. Gate and Scene Lab were not run. Captures were not produced or opened.

Outstanding: update existing assertions to new contract, verify all damage branches and secondary fire/explosion attribution, verify ally follow variants, ensure pool capacity bounds, add the requested night scene and execute low/high × zoom 1/1.5 matrix. This commit is partial work and is not ready to merge.
