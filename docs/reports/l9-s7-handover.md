# L9-S7 campaign handover

Scope: E31 §5.4, lane S7; handover portions of AC14/15/20. This does not claim
completion of the full all-route or L1–L9 epic gates.

The completed S6 crawl commits the campaign equipment reset before saving or UI
navigation. Both racks and selected combat actions become `weapon.fire-axe`; old
weapon magazines/charges, projectiles, reward transactions and pickup drops are
removed. Nonweapon upgrades and ability ownership survive. Full ordinary spawn
health is restored. The save records pre-crash durability, lost weapons, sheltered
living human passengers and protected corgi identity. The human history is not
installed as L10 followers. Loading cannot restore the old APC transport payload.

L10 was absent from this checkout. A minimal registered opening reuses the authored
safe `crawl-end` ground, existing combat/NPC systems and `cure-crash` checkpoint.
It gives campaign Continue a playable on-foot destination and safe corgi; E32 region,
encounter and finale work remains with its lanes. No credits/reward screen at L9.

Completed S6 saves migrate to the committed reset. Supported pre-finale broken
crash records migrate to the zero-HP floor at their stored position, without moving
them onto an on-foot route. Crash-phase persistence is retained until commit.

## Validation and evidence

`npm run typecheck` and `npm run lint` pass. Full unit tests on Hetzner:
1,312 passed / 7 skipped. `npm run verify -- E31` passes: 60 selected sim/unit
checks and 47 browser checks. The new desktop/high and 390×844/low handover
checks include a real page reload and the title-menu Continue button.

Both Scene Lab backends pass all eight rows (two scenes × two qualities ×
zoom 1.0/0.5). Numeric gates stay at zero console errors/clipping/missed actors,
300 draws and 500k triangles. The opening performance probe, under quiet-run:

| Quality | frame p95 | sim p95 | draws | triangles | JS heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| high | 5.2 ms | 0.60 ms | 167 | 103,886 | 149.7 MB |
| low | 4.7 ms | 0.60 ms | 157 | 43,424 | 114.8 MB |

These are S7 opening measurements, with zero infected; route/floor/crash stress
and real device gates remain with the encounter/performance lanes. The initial
WebGPU capture/build overlap caused transient missing assets and clipping reports;
a stable-build rerun passes all rows. No gates or budgets were loosened. Evidence directory:
`test-results/epics/E31/S7/`. Matrix catalog is `tests/scenes/l9-handover/`, run with
`--dir tests/scenes/l9-handover --matrix` on both backends. No source specs or assets
were changed, and no deploy or merge was performed.


## Visual review

Reviewed both backends at both quality tiers and both zooms, plus the real game
start/reload screenshots at 1600×900 and 390×844. The crash sheet reads as approach,
bridge impact/wreck, fire and a crawl onto free asphalt. The corgi stays outside
the fire. At the end there is no obsolete progression/reward panel. The isolated
sheet intentionally stays in the completed crawl; the axe-start sheet and real
campaign screenshots show the standing L10 survivor holding the red-headed axe,
with one weapon HUD icon, full health and corgi following. No firearm or human
follower appears. Close zoom preserves the axe, feet and corgi silhouette; low
quality simplifies the fire/smoke without losing the player. Scores for S7's
handover/readability/grounding/continuity checks: 8/10, no P0/P1 in the handover.
The existing phone home button touches the minimap edge; this is outside the
changed equipment/transition flow.

Catalog wrappers in `tests/scenes/catalog/` register both scenes in the default
matrix command without editing source specs. A supported save at L10 must carry
the committed handover marker; missing markers cannot bypass the equipment reset.


## Campaign regression follow-up

The initial combined `tests/unit tests/sim tests/levels` run on Hetzner completed
with 2,436 passed / 25 failed / 9 skipped (it captured an earlier implementation
snapshot). Its two S7 spawn-anchor failures and a MissionUI boolean type error
were fixed before the green E31 verification. The L7 “L9 ends the campaign”
assertion and the generic graph's old L10 cinematic expectation were updated to
the revised PO transition. The weather graph helper now advances the existing
five-second run-out before trying to complete another objective; its 100-step
and 120-second limits and weather comparisons remain intact. A fresh focused
run of handover, campaign, L7 departure and all weather tests passes all 42 tests.
The final save/progression follow-up also passes 28 tests.

The broad run still reports off-lane L1/L2/L3/L5/L6 bot/follower/continuity
failures, Alpha/zoo timing failures and asset/nav timeouts under shared-runner
load. They are recorded in `test-results/epics/E31/S7/logs/l9-s7-remote.log`;
no budgets, seeds or timeouts were changed. The fresh full-unit run passes the
asset checks. This lane does not claim a green full campaign or worst-case E18
stress gate.
