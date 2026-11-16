# s147 — L4 cellar escape

HIGH now completes the escape within three attempts with the horde intact. The native skilled L4 bot completes with zero escape deaths; a headless real keyboard/mouse HIGH run completes with two escape deaths. LOW also completes, with six escape deaths. The three-attempt target was specified for HIGH.

## Diagnosis

Batch-113 reported 24 HIGH and 25 LOW escape death/input-release events. The new native baseline reproduced five HIGH escape deaths. Subsequent visible-input logs exposed four contributing design faults:

- The direct cellar bearing led northwest into the flooded camp and fences, while the usable route begins south toward Lakeshore. A 5 m observation heatmap clustered 73 of 191 hide observations near (-15,10). These are observation counts, not independent deaths.
- Street-corner markers required an exact junction arrival. The player stopped at the ring edge until killed. A 3 m arrival tolerance fixes the handoff.
- The horde diversion corridor ended on southern Lakeshore, omitting Metro Road and Harbor Street. The full route required about 71 seconds in native play, against the former 40-second window.
- The fixed line-break checkpoint replayed the entire route against an increasingly flooded live battlefield. Reached street turns now preserve progress.

The JSON includes death positions/ticks and nearby infected IDs/positions from failed browser runs, plus native death records with recent infected attack sources, archetypes, positions, damage and special moves. Nearby browser actors cannot establish a definitive killing blow. Native final-run deaths were all during defense; the escape had none.

## Changes

- Line-break checkpoint moved from (-4,16) to the open Lakeshore leg at (-4,28).
- Existing diversion extended to 75 seconds and its polyline aligned with the entire authored Lakeshore–Metro–Harbor route.
- Visible marker follows street corners and their reachable A* approaches around existing obstacles, advancing within 3 m of a corner; final guidance remains the cellar door.
- Reaching Metro Road (48.5,20), the Harbor turn (48.5,-37.4), or western Harbor (-44,-37.4) refreshes the existing line-break checkpoint at the actual player position. Death reopens the diversion through existing respawn logic. Live enemies and corpses remain.
- Existing L4 contact test extended with corridor equality, reached checkpoint and onward guidance assertions. The full mortal completion is recorded run evidence; duplicating it inside the existing long contact test exceeded its timeout. No pre-existing test or replay was trimmed; inventory stays at150 cases.

Wave sizes, Alpha counts, zombie stats, persistent corpses and `tools/playtest` are unchanged. No specs, prohibited reference files, main branch, deployment or remote publishing changed.

## Validation

| Evidence | Result |
| --- | --- |
| Native skilled HIGH, seed1, ordinary InputFrames | Complete, zero escape deaths; eight preceding defense deaths; 61 infected alive at line break |
| HIGH visible-input real keyboard/mouse | Complete in384 s, two escape deaths, 11 total deaths, 1256 MG attacks; no skips, assists or immortality |
| LOW visible-input real keyboard/mouse | Complete in458 s, six escape deaths, 13 total deaths, 1543 MG attacks; no skips, assists or immortality |
| Typecheck / lint | Passed |
| Required remote `sh tools/remote/run.sh "$PWD" -- npm test` | Passed, exit0, 187.1 s; 27 files, 105 tests passed, one skipped, 150-case inventory |

Earlier full-suite attempts timed out at240.4 s and were rerun unchanged. A focused contact-file run exposed the duplicated campaign replay cost; replacing only the newly added duplicate with focused assertions restored the full suite to its budget.

Browsers were headless, one at a time, admitted through `tools/e2e-lock.sh`/browser pool, with10-minute reservations and ports5031/5032. HIGH preceded LOW. The default driver reads authored anchors directly, bypassing displayed route guidance; final confirmation used its existing `PLAYTEST_VISIBLE_ONLY=1` mode to follow the actual minimap pin. The only warning in successful LOW was the known convoy empty-HUD navigation warning; successful HIGH additionally logged a provisional frozen actor during defense. Neither prevented completion.

Reviewed [escape contact sheet](corpse-persistence-sheet.jpg): successful HIGH line-break crowd and bodies, two street guidance views, and barred-cellar ending. One small sheet is committed. The filename is retained from the earlier corpse review.

Raw final runs: `test-results/s147-l4escape/high-street-checkpoints` and `test-results/s147-l4escape/low-nine-minute`. The committed JSON is below200 KB and retains failed-run observations, heatmap, native attribution and final results.

## Limits

HIGH satisfies the requested approximately three-attempt escape target. LOW completion is confirmed but took more retries. Defense remains punishing (eight native HIGH defense deaths); this task changes the escape. Historical killing blows cannot be reconstructed conclusively from browser proximity snapshots. Native attack-source records provide stronger attribution for the reproduced run.
