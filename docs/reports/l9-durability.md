# L9-S1 · Shared APC durability

Scope: the L9-S1 systems row in E31. Reuses the shared E30 unarmed APC, E09 mass damage/recovery, fixed physics phases, spatial hash, infected awareness/status, and entity checkpoint snapshots.

The APC bills each infected contact onset at every speed, including active downed infected. Overlap stays one contact until the infected has separated from the hull by at least 0.5 m for 0.25 seconds. A local spatial query and exact rotated rectangular hull distance resolve contacts, including hull corners. Each event logs vehicle/infected IDs, distinct contact/attack IDs, source and before/after durability. Contact records expire after separation; checkpoints retain overlaps and remaining windup/cooldown, while campaign transfer clears old district infected references and retains the ID sequence.

Aware, living, unstunned infected can attack within 1.5 m of the hull when stopped or surrounded. Lost reach, awareness, visibility or the stopped/surrounded condition cancels the windup. Slow contacts separate living infected to the rotated hull surface, subject to existing nav clearance, keeping attackers visible outside the mesh. Infected melee cannot bypass the hull to damage hidden seated APC occupants; normal melee damage resumes on exit. APC damage bypasses ordinary vehicle armor upgrades; firing cannot grant vehicle boost or weapons. Existing sedan/bus/fire-engine behavior is retained.

| Parameter | Value | Measurement / effect |
| --- | --- | --- |
| Mass / ram strength | 6,000 kg / 3 | Existing E09 ram damage: speed × 30 × 3, at speed ≥ 4 m/s |
| Nominal road speed | 18 m/s | No APC firing-input boost |
| Maximum durability | 1,000 HP | Existing shared APC definition; transfer preserves current/max HP |
| Infected contact onset | 10 HP | Ten distinct collisions lose 100 HP, including stationary/slow contacts |
| Contact re-arm | ≥ 0.5 m gap for ≥ 0.25 s | Continuous overlap and brief separation never bill per tick |
| Stopped | Speed < 0.5 m/s | Any eligible nearby attacker can begin a hull attack |
| Surrounded | ≥ 4 attackers across ≥ 3 hull quadrants, within 3 m of hull | Enables attacks while moving; attackers must still be within 1.5 m to strike |
| Direct attack | 10 HP | Separate from contact damage; 0.6 s windup + 1 s cooldown after hit |
| Four sustained attackers | 120 HP in first 5 s; 25 HP/s steady state | Hits at approximately 0.6, 2.2, 3.8 s; 1.6 s between each attacker's hits |
| Ram endurance | 100 infected contacts | Twelve groups of eight cost 960 HP, leave 40 HP; fourth contact in group 13 exhausts it |

HUD, safe compulsory breakdown exit, zero-HP explosion override and on-foot arsenal restoration belong to L9-S2. Full district, route, streaming and campaign criteria belong to their named lanes; this report does not claim full E31 completion.

Validation and native game-camera review are recorded in `test-results/epics/E31/`; the reproducible Scene Lab fixtures are `tests/scenes/l9-apc/{ram,surrounded}.json`, driven by `tools/scenelab/l9-apc.ts`. The harness selects ordinary L9 chase brains because Scene Lab normally installs L1 civilian-search brains; it does not change game AI definitions or budgets.

Native WebGL2 on Apple M4 (headless ANGLE/Metal), after warmup:

| Isolated APC budget | High 1600×900 | Low 390×844, CPU ×4 | E18 high / low cap |
| --- | ---: | ---: | ---: |
| Concurrent infected | 200 | 100 | 200 / 100 |
| Frame p95 | 4.8 ms | 8.5 ms | 16.7 / 33.3 ms |
| Sim p95 | 0.9 ms | 1.9 ms | 4 / 6 ms |
| Draws | 49 | 39 | 600 / 300 |
| Triangles | 366,694 | 136,353 | 1,500,000 / 500,000 |
| Heap after GC | 116.6 MB | 73.8 MB | 400 / 250 MB |
| Console errors | 0 | 0 | 0 |

This is the populated APC systems probe, with ordinary chase AI running and fixture movement held at zero; full crossing route/streaming/device performance remains assigned to the later lanes.

Game-camera review: opened all four high/low ram/surrounded contact sheets. PASS: the military shell has a hatch/vent and no turret/barrel; the courier moves from the doorway into the visible glazed cab. PASS: moving through six infected leaves knocked-down bodies and blood on the APC, with no gun blast or muzzle flash. PASS: stopped attackers stay outside the hull and are readable beside the wheels; far-side attackers are naturally occluded by the vehicle. PASS: purple night ground and warm headlight pools retain the toy proportions and vehicle silhouette on both tiers. Scoped review: 8/10, no P0/P1. HUD review belongs to S2 and is excluded from these isolated scenes.

The saved state logs agree on both tiers: ram fixture 940 HP, six contact debits and six mass hits, zero direct attacks; surrounded fixture 840 HP, four contact debits plus twelve direct attacks, zero mass hits. Captures, sheets, event/state JSON and budget JSON are under `test-results/epics/E31/l9-s1/`.

Final Hetzner gates: typecheck, lint and production build pass; full unit suite 895/895 and vehicle simulations 57/57, zero failures (`full-unit.json`, `vehicles.json`, `final-gates.log`). Full `npm run verify -- E31` passes with the supported remote split: 24 selected simulation/smoke tests, 16 remote nonvisual browser checks (including WebKit), and 12 native headless screenshot checks. All commands in `checks.json` exit zero; complete log: `verify-green.log`. The remote runner needed WebKit v2359 and its system libraries installed; no tests, tolerances or budgets were loosened. The departure browser fixture uses a 300 m runway to avoid unrelated boundary crash damage.
