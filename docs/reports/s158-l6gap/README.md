# s158 — L6 survivor gap and Northgate approach

## Findings and change

The native and real-input policies are materially different. Native saves 69–79% with its skilled policy, while the standard browser driver does not represent that policy. The driver scans 14 m instead of 22 m, prioritizes nearby courier threats before survivor attackers, backs away from shelter contacts, and stops moving during ranged tunnel combat. Native prioritizes group bite risk and fires while moving with the column. After 30 seconds without objective progress the driver's personal-threat scan falls to 3 m. These are **Driver gaps**; tools/playtest was not edited.

Fresh HIGH records the courier at (3,0) through tick 2219, then retreating to (3.05,9.26) by tick 2415, away from residents near z=-11. The first historical grab at tick2037 is at (8.58,-10.99). Native instead holds around (0,4) and proactively targets group threats. Both policies use ordinary input, but their positioning, range and priorities differ. The opening has no objective waypoint; it has positional survivor alarms with a screen-edge pointer. These reactive alarms do not grant the native bot's proactive threat selection. The available traces do not establish a separate shelter/follower defect or justify encounter tuning. No full positional input replay was available in the historical report; fresh logs retain sampled positions rather than a complete replay stream.

The stair issue is game-side guidance. The physical escalator spans x249.4–255.4 and z14.325–15.675. The old exit ring at (273,3.9,15) let players approach the solid stair side from z11–13. Fresh unmodified HIGH and LOW both capped beside it. The native route explicitly aligns first. `LevelSixSubway.guide` now selects fixed platform alignment (244,15), then first-stair waypoint (250,15), before returning to the street ring. The mission anchor, HUD and rendered ring agree. No movement is automatic and no collision geometry changed.

An initial render-only candidate revealed another Driver gap: standard mode reads `def.anchors[state.marker]`, bypassing rendered marker overrides. The final implementation uses the mission's existing fixed-waypoint pattern so both consumers agree.

## Browser receipts

All runs use headless WebGPU, zoom1.5, one browser through tools/e2e-lock.sh / pool, reservations capped at ten minutes, E2E_PORT5053 and SCENE_PORT5054. HIGH precedes LOW. Each starts at the level start without immortality or progression skips.

| Build / tier | Outcome | Survivors out | Player deaths | Counted assists |
| --- | --- | ---: | ---: | ---: |
| Baseline HIGH | 480s cap at stairs | 0 escaped at cap; 1 following | 17 | 1 |
| Baseline LOW | 482s cap at stairs | 0 escaped at cap; 2 following | 14 | 1 |
| Final HIGH | Complete, 222s | 7/29 | 2 | 1 |
| Final LOW | Complete, 197s | 1/29 | 1 | 1 |

The counted assist is the driver's logged retreat map route, not a manual stair alignment. Read-only nav-follow log entries also remain assists in the broader methodological sense. Final LOW uses 1,072 MG attacks. Final HIGH uses 1,256 MG attacks and needs no physical KeyA+KeyS stair correction. Its result reports `rescued=7`, `survivorsIn=29`, `survivorsLost=22`; the unrelated general stats rescued counter is not used as the denominator. The remaining P2 is the driver counting the intentional shelter rest as “stuck navigating”. These standard-driver runs are not proof that a competent human saves 60–90%.

Historical batch116 HIGH saved10/29; aligned LOW saved2/29. Historical and fresh samples differ, so this report does not claim a retention improvement from the marker change. The game-side stair defect is fixed independently of driver combat weakness.

Raw logs/captures: `test-results/playtest/s158-{high-l6,low-l6,final-high,final-low}/`. Compact receipts and full native rows are in [qa.json](qa.json). The single retained [sheet](evidence-sheet.png) is visually reviewed.

## Final regression gates

- Native s157 matrix, HIGH/LOW × skilled/walk × seeds1–3: 12/12 complete. Counts, deaths and completion times exactly match baseline. Skilled saves20/21/23 with zero deaths; walk saves21/17/21 with3/0/1 deaths, for each tier.
- Full `npm run qa:threat`: **0 fail flags**, 336.3s. Exact L6 line: `[qa:threat] L6: skilled complete, passive complete, 0 passive flags (91.7s)`.
- Prescribed unchanged `sh tools/remote/run.sh "$PWD" -- npm test`: passed on46.225.66.90, 105 passed / one platform skip, 150/150 inventory, 182.4s within240s.
- Typecheck and lint pass after the final source revision. Prior E24 per-change gate also passed; its checks cover the same static/unit suite. No tests were trimmed.

No zombie stats, survivor health, invulnerability, wave counts, corpses or targets changed. No specs/protected references or tools/playtest edits. No deployment, push or main movement. Earlier sandbox admission and remote-runner failures were superseded by these actual runs.
