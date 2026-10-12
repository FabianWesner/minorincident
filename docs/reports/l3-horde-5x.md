# L3 horde and alarm corrections — 2026-10-12

**Acceptance incomplete.** No deployment or merge into main. Main was integrated at aadade74 as requested.

> "L3: Given the high number of policeman and the power of the guns (both is good, keep it), the nr of Zombies is far too low. We need 5x mor eZombies, so they havre a chance against the policeman group."

Implemented defence 30/60/100, horde packs 125, street multiplier 25, spill 50/75, pressure 25–75 (multiples of five), finale 40/60/75. Low totals retain previous rounding before multiplication. Replenishment queues retain entries at the strict 200/100 simulation caps. Police/soldier count, HP and gun strength remain unchanged. Five civilian variants wait safely at the relocated bus, excluded from target/infection selection.

The boom waits for the player, corgi and every surviving officer inside x=216, reopens on an outside survivor, and precedes rendezvous completion. Existing flow and pocket escape paths prevent abandoned officers; retreat retains defence shots. Far unattended crowds distribute decisions across six deterministic tick slots while retaining swept movement; nearby humans and the rescue stay full rate. Frozen bodies preserve drawn deaths while simulation slots replenish. Existing far geometry and low shadow paths reduce rendering cost.

## Investigation

Archived source builds were compared headlessly, then deleted; no baseline worktree remains. Same seed, at alarm+30 seconds:

| Build | L3 living / visible | L4 living / visible | L4 first visible |
| --- | --- | --- | --- |
| 52d66799 | 47 / 0 | 20 / 0 | none within 30 s |
| 87c1a896 | 35 / 0 | 17 / 1 | 17.83 s |

**No shared spawn-disable culprit is demonstrated between these builds.** L3 controller/director logic is unchanged. Exterior L3 goals date to dc224fa6; L4's 28-second war delay dates to f6fa190b (controller origin fd48f931). Living infected exist but do not enter the alarm camera promptly. L3 now approaches the visible yard; L4's first stream begins with the alarm through nearby authored doors.

Telemetry's `View.simCamera` approach now supplies a tick-driven frustum without presentation pull/shake/roll, retaining main's ramp height follow, aspect and zoom. Elevated silhouette checks include support height; rescue sources connect to the open checkpoint and stand on the ramp surface. Unit checks prove presentation effects cannot steer the simulation matrices. Historical data does not establish frustum rejection as the cause of all empty alarm views.

L3 real-input alarm after main passes at +5.52 s with officer engagement. Both alarm checks passed before main (+4.92/+3.52 s). The later L4 mouse route fails before the alarm at the quartermaster approach, so post-main L4 visibility is not yet proven. The physical keyboard/mouse policy check exercises the current route without injecting synthetic input frames.

## Seed 1 results

No player shooting during station observation or rendezvous idle. Before: PO 3-second finale; headless probe records zero visible army pressure and an early closed boom trapping the group. Headless completion 241.32 s.

Latest measured candidate: station first visible 4.10 s; first contact 5.42 s; line reached by 20/14/32 infected across the three waves, with 3/3/3 officers grabbed and zero permanent police losses. First-of fallback at 5.27 s (8 inside); idle player dies once. Defence peak simulated 142.

Finale: 78.4 s stream; 72.15 s first-visible-to-closure envelope, **53.5 s with living infected visible**, pursuit 0.033 s before closure. All surviving officers and corgi inside; police/soldier losses 0/0; **zero infected reach the final line at comparable elevation**. Rendezvous idle 66.75 s, zero player shots. Headless completion 320.33 s, zero deaths, peak 200.

The stricter final-line contact/pressure criterion remains unmet. All eight checkpoint soldiers use l4.soldiers.hmg at runtime rather than l3.soldiers.gun; their strength was preserved. Smaller bursts were tried and rejected because stragglers extended closure to 186.7 s. The final exact low rounding correction follows the PO specification; these measurements predate that arithmetic correction.

## Performance

Mac, headless Chrome/Metal, one worker, quiet-run owns all browser slots. Phone 390×844, low, DPR 1.5, 4× CPU throttle. World-tick time is separate from catch-up-frame time; the observer reads lightweight counters rather than cloning the world per frame.

Latest completed timing candidate (subsequent far decisions, merged shadow and downed-detail optimizations await a quiet rerun):

| Tier / phase | Peak | Frame p95 ms | World tick p95 ms | Draws | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| high defence | 131 | 8.5 | 1.9 | 187 | 1,337,179 |
| high horde | 200 | 12.1 | 3.8 | 195 | 1,508,195 |
| high rescue | 95 | 11.1 | 2.6 | 231 | 932,308 |
| low defence | 69 | 9.7 | 1.7 | 165 | 506,882 |
| low horde | 100 | 10.5 | 2.4 | 174 | 553,726 |
| low rescue | 56 | 11.5 | 2.1 | 202 | 546,119 |
| phone defence | 66 | 46.7 | 5.7 | 167 | 397,029 |
| phone horde | 100 | 61.4 | 10.45 | 171 | 517,069 |
| phone rescue | 38 | 55.4 | 9.53 | 193 | 444,916 |

Caps and draw budgets hold; **all budgets do not hold** in this completed candidate. Budgets were not raised. Subsequent quiet measurements waited on shared browser slots and Mac load and are not claimed as passes.

## Visual review and validation

Reviewed desktop rescue: open boom, army firing along the curved ramp, group inside, nearby ring and bus, drawn fallen infected on the approach. Bus/waiting civilians are partly cropped during wide rescue framing and need the safe-zone close capture. Horde views show drawn figures/corpses, but a large foreground roof hides part of the action. These captures do not prove no clipping at every spawn. Additional dense defence and bus captures are implemented; complete desktop/phone proof is outstanding. Evidence PNG/JSON files are adjacent to this report.

Full units on Hetzner: 896/896. Focused rescue/defence/camera checks: 9/9; later LOD/render checks pass in lod-validation.json. Full simulation after main: 775/795; failures are retained in full-sim-main.json (weapon/progression, shot-cover, layout/mock, L7 seam/roster and loaded-runner timing cases). Unrelated criteria were not weakened. Typecheck/lint passed after navigation/LOD fixes. Verify E21 was started remotely and stopped when main integration made its snapshot obsolete; it is not green verification.

Existing mouse completion fails with 15 deaths in Boulevard. Physical-policy browser completion/alarm checks are included; their final results must be taken from the recorded output when available. E21/E22 criteria corrections explicitly supersede old counts, empty alarm delay and player-only closure with the PO quotes.

Outstanding: final-line contact/sustained pressure, quiet performance pass, current real-input completion/L4 alarm, complete bus/crowd visual proof.

Final physical input probe reaches the rendezvous but waits with the zoomed spawn frustum covering every nearby source. An additional authored west-road fallback (126/129, three lanes), used only when nearby sources are all in the view, fixes that rejection path; its pursuers stay retained until death. This last zoom correction has not completed a browser rerun and is an explicit review risk.
