# Phone transition diagnosis (2026-10-11)

Initial combined run on `7510e7b2`: 15/16 passed; L2 low reveal 85.3 ms exceeded the unchanged 50 ms limit. The CPU profile identifies asynchronous TSL node construction/compilation for streamed district instances during gameplay. Material sharing alone cannot reuse instance render objects: Three includes instance object identity in its render-object key.

Changes:
- `ff466804`: extend existing static material sharing to separated roof and roof-light parts, preserving lighting feature keys. Existing regression expanded to all four supported static roles: 5 tests pass.
- `41b57aa2`: prepare phone district LODs before gameplay shader warm-up using the existing L6 preparation path. High-tier streaming remains as authored. This moves work to level loading/briefing and can lengthen that stage; it does not reduce geometry, effect counts or budgets.

A one-worker live preparation experiment (`308c2aa2`) did not remove the hitch and was reverted (`3fe52e7a`). Temporary profiling labels were removed. No renderer dependency, tolerance, frame budget, assertion or mission data was changed.

Phone preparation results: reveal 39.2 ms (targeted), 39.1 ms (profiled), 37.5 ms (final combined). All are within 50 ms. Gate-close maxima were 52.0, 53.5 and 51.1 ms respectively and remain failures. The profiled gate spike shows simulation/update/render work rather than the earlier long asynchronous node build; it does not establish a separate actionable root cause. Do not count the final combined gate as green.

Evidence: `perf-first/`, `phone-prepared-first/`, `phone-profile/`, `perf-phone-final.log`, and `perf-conditions.jsonl`. All browsers were headless Metal WebGL2, one worker. The quiet-run wrapper reserved both machine-wide browser slots and required load below 3 before starting. The known unrelated Oak travel and L6 straggler tests were not rerun.
