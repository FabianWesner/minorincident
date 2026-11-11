# s43-l10fence

Status: implementation committed; full browser matrix and final visual acceptance are still required.

## Changes prepared

- Replaced the plain gray L10 arena rails with a single instanced batch of battered jersey barriers, alternating concrete tones, hazard marks and patched chain-link frames. It still follows `perimeterBoxes`, retains the existing ±55 m footprint, gate opening, arm condition and `perimeter-up` timing. The barrier remains one draw submission (the old mesh was also one submission); verify the measured draw count in browser QA.
- Raised the human civilian night figure fill from 1 to 4, matching the existing L6/L7 `NpcView` figure-fill treatment. This is a moon-fill uniform, so the authored daylight shading path is unchanged. Nadia is created through the civilian renderer.
- Removed proximity alone as a reason to foreground the courier. A live Mega now triggers the gold depth slice only when it intersects the camera-to-courier segment. The render contract covers front, side and behind positions.
- L10 unseen corgi catch-up now requires a direct clear route before relocation. It can walk around a barrier through normal navigation but cannot teleport to the opposite side. Regression assertions are folded into the existing NPC test to keep the suite at 150 cases.

## Evidence so far

- Nadia current-build check: eight-second real-input L8 start, low WebGL2 zoom 1, follow-marker, god mode; zero page errors. Opened `/private/tmp/s43-nadia-low-gl/s002-t250.jpg`. Nadia is inside the marker ring beside the courier; face, arms, teal clothing and headwear remain visible under the L8 night preset. This supports L8 low-tier readability only; L10 preset and daylight comparison remain pending. Owned preview stopped after the run.

- Fixed the missing perimeter colors: `Materials.fromColor(..., world=true)` selected a single palette swatch and ignored the intended instance tint. The perimeter now supplies `_edgeColor` directly to the shared shaded-material graph. ESLint and QA build passed. The repeated four-second low WebGL2 zoom-1 edge run completed with zero errors; opened `/private/tmp/s43-edge-color-low-gl/s001-t188.jpg`. Dark steel, lighter concrete and a muted yellow hazard mark are now distinct under night lighting. The owned preview was stopped. Other matrix rows and gameplay pressure remain unverified.

- Corrected perimeter transforms: vertical sides previously applied both swapped dimensions and a quarter-turn; braces previously rotated about Y. Pieces now use local width with side yaw, and braces rise in the fence plane. ESLint and QA build passed. A four-second headless low WebGL2 zoom-1 edge run completed with zero page errors; opened `/private/tmp/s43-edge-low-gl/s001-t187.jpg`. Concrete bases and diagonal braces now face correctly, with open ground inside the east edge. The intended instance color variation still appears uniformly pale gray and needs correction before visual acceptance. Owned preview stopped.

- Resume with unrestricted permissions: `slim-worktree.sh --no-assets` succeeded. Headless real-input `r28-vqa-fixture-play.ts` ran on preview port 4938 through `e2e-lock.sh`, low WebGL2 zoom 1, for 8 seconds with god mode and no kiting. It completed with zero page errors. Opened `/private/tmp/s43-resume-l10/s003-t431.jpg`: courier and corgi are visible beside the tank during a Mega attack; the boundary is outside this frame. This is a runtime sanity check, not acceptance of the edge or the full matrix. The owned preview server was stopped after the run. Earlier sandbox limitations below are historical and no longer block local browser work.

- Opened the prior `r42-arenas` sheet at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r42/sheet-l10.jpg`. Its four panels show the former gray diagonal pipe fence crossing the fight and horde; it reads as a detached railing and overlaps the courier's fighting space. This is baseline evidence only, not a same-build comparison.
- Focused render/NPC and review-freshness suites passed after consolidation: 25 tests across 3 files. `npm run typecheck` passed; `npm run lint` passed; the final QA build passed.
- `npm test` passed: 107 tests across 27 files, 150/150 registered cases, within the 240 s budget (79.8 s).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` completed. L10 recorded no gameplay flags. The only report flag was `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, emitted because the command selected only L10.
- Native clearance measurement against the L10 district colliders found the closest static solid 3.65 m from the north arena barrier (the service-building collider); the other four sides measure 7.47–21.50 m. This misses the lane's suggested ≥4 m spacing by 0.35 m. The corridor has not been accepted as safe without visual gameplay review, and moving that layout solid would require a layout rebuild plus the smoke gate.
- The initial full suite run exposed a review-freshness expectation that assumed a clean L1 render tree. The test now compares the saved commit digest with the current source digest when `sourceDigest` is absent; this preserves the real stale-source behavior. `git diff --check` passed before final report creation.

## Browser QA still needed

Capture and open the before/after L10 console scene at zoom 1 and 1.5, high and low, WebGL2 and WebGPU. Review the perimeter look and courier clearance; verify the line stays at least 4 m from other solids, the draw-call delta is at most +2, and the courier is not pinned. Capture Nadia under L8/L10 night presets and by day, verify the tank has no gold outline without a real foreground blocker, and exercise the corgi at the L10 railings. Current required headless browser admission could not start: Vite preview on `127.0.0.1:4938` failed with `listen EPERM` under the managed sandbox. The baseline sheet above is the only image opened so far; no after captures are claimed.

## Environment limits

- The required `slim-worktree.sh` could not update the shared `.git/worktrees/.../config.worktree` outside the writable workspace. The checkout was already populated and `node_modules` existed. The QA build cache lock is also outside the writable workspace; `MI_BUILD_CACHE=off` successfully bypassed that cache for the final build.
- `git restore` and browser preview binding were also denied by the sandbox. The remote runner reported no healthy Hetzner runner and rejected the Mac fallback for the `npm test` wrapper. A local `npm test` initially detected 151/150 cases; the new corgi assertion has since been folded into an existing test, so rerun the full suite and record the final result.
- Changes and this report are committed in the current lane commit (`Improve L10 arena edge and character readability`). The commit records the implementation and the outstanding browser QA; it does not claim the overall goal is complete.
