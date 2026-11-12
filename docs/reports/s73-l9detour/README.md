# S73 — L9 detour stalls

## Result

The native L9 matrix now passes **18/18**: every case completes with a maximum no-progress window of **0.32–3.27 simulated seconds** and **zero pose jumps**. The legacy `breakFree`/`placeCar` fallback remains, but does not fire in any matrix case. Its physical-reverse replacement was rejected because it failed the existing sealed-pocket escape test; the fallback was restored under the no-regression constraint.

The detour thrower target now alternates 10 m to either side of the authored lane when the APC is closer to that route's detour than its primary line. The obstacles remain in the world and retain their normal collision and damage behavior. Primary route throw targeting is unchanged. Full per-case windows and jump receipts are in [native-current.json](native-current.json).

## Before / after matrix

“Before” is the starting-main `43c79eb1` matrix recorded in [S67](../s67-l9stuck/README.md). “After” is this worktree with the detour throw targeting change and original recovery fallback, from `sh tools/qa/l9-progress-regression.sh`. Values are maximum no-progress seconds / pose-jump count.

| Path | Route | Seed | Before | After |
|---|---|---:|---:|---:|
| primary | road | 1 | 3.20 / 0 | 3.20 / 0 |
| primary | road | 2 | 3.22 / 0 | 3.22 / 0 |
| primary | road | 3 | 3.27 / 0 | 3.27 / 0 |
| primary | countryside | 1 | 0.35 / 0 | 0.35 / 0 |
| primary | countryside | 2 | 0.35 / 0 | 0.35 / 0 |
| primary | countryside | 3 | 0.35 / 0 | 0.35 / 0 |
| primary | dry-shortcut | 1 | 0.45 / 0 | 0.45 / 0 |
| primary | dry-shortcut | 2 | 1.83 / 0 | 1.83 / 0 |
| primary | dry-shortcut | 3 | 0.37 / 0 | 0.37 / 0 |
| detour | road | 1 | **9.00 / 1** | 0.37 / 0 |
| detour | road | 2 | **9.73 / 1** | 0.37 / 0 |
| detour | road | 3 | **9.37 / 1** | 0.37 / 0 |
| detour | countryside | 1 | 0.37 / 0 | 0.35 / 0 |
| detour | countryside | 2 | 0.35 / 0 | 0.35 / 0 |
| detour | countryside | 3 | 0.35 / 0 | 0.35 / 0 |
| detour | dry-shortcut | 1 | **5.42 / 0** | 0.32 / 0 |
| detour | dry-shortcut | 2 | **13.37 / 0** | 0.32 / 0 |
| detour | dry-shortcut | 3 | **6.05 / 0** | 0.32 / 0 |

## Evidence and constraints

The initial contact traces showed a thrown jersey barrier and barricade centered on the road detour near `(-8, -305)`, and a thrown barricade/trash-can pair on the dry-shortcut detour near `(291, 8)`. The APC had held throttle and steering with near-zero physical displacement; the road cases ended with the old relocation jump. Moving the detour lines was tested and reverted because it worsened other route windows. Moving only the detour throw landings to alternating shoulders cleared all six former failures without degrading any other matrix case.

No infected or prop/corpse removal, vehicle invulnerability, infected-stat changes, or player/actor pose writes were added. The original recovery fallback remains unchanged. Zero jumps is verified for the complete route matrix; this does not claim that the fallback can never teleport in another enclosure.

## Validation

- `sh tools/qa/l9-progress-regression.sh`: **pass**, 18/18 complete; maximum gap 3.27 s; 0 pose jumps.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: L9 skilled complete, **0 L9 flags**. The diagnostic selection exits nonzero only for `PARTIAL_LEVEL_SELECTION`; it is not the complete all-level gate.
- Required remote unit command `sh tools/remote/run.sh "$PWD" -- npm test`: **pass**, runner `94.130.181.173`, 214.7 s within the unchanged 240 s budget. 27 files passed; 106 tests passed / 1 skipped. The 150-case inventory was unchanged. An earlier physical-reverse trial failed the existing sealed-pocket assertion; restoring the original fallback resolved it without changing the test.

## Browser QA needed

Headless, real-input browser capture remains outstanding. Recheck the original HUD interval at 632–639 m / ticks 8195–8929 and the 121–122 m bus/roadside trap from [S66](../s66-b87qa/README.md), plus detour road around `(-8, -305)` and detour dry-shortcut around `(291, 8)`. Record held input, chassis displacement, wheel support, and bumper contacts through each interval. Use `tools/e2e-lock.sh` / the browser pool, one browser maximum, a 10-minute reservation and a unique 49xx port; keep Playwright headless. No browser capture was opened for this change, so no visual-fix claim is made.
