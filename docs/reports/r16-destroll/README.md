# R16 destruction rollout

Native destruction, route completion, checkpoint/navigation/cap checks and exact L1–L5 threat equivalence pass. The final E32 verifier is running; E31 verification is green.

The opt-in set is applied before district collision is built. L1/L2 use parked civilian cars; L4/L5 use ordinary neighborhood parked cars and small sheds, preserving authored combat dressing. L3 retains its reviewed pilot. L9 adds roadside cars, huts/sheds and barricades. L10 adds abandoned cars, rebuilt farm walls/roofs, checkpoint huts, and dispersal machinery/fuel tanks. The console and required supports retain their existing owners.

Rebuilt farm wall zones follow `tools/blender/sslib/farm_assets.py`; they supply hit geometry without adding solid colliders or closing the existing doorway gaps. District navigation cells change immediately during destruction; their unchanged FNV hash is recomputed once when read, avoiding a full-grid scan for every blocker edit.

## Native evidence

[Raw destruction receipt](evidence/destruction.json). Each weapon family starts from a native mission checkpoint, receives one normalized 3000-damage contact per occupied part, then runs 721 destruction ticks. These are material-response fixtures, not player DPS or full playthrough claims. Complete collapse is separately exercised for one object of every policy present.

| Level | Live targets | Policies | Peak fires | Peak debris |
| --- | ---: | --- | ---: | ---: |
| L1 | 23 | vehicle: 23 | 24 | 32 |
| L2 | 34 | vehicle: 34 | 24 | 32 |
| L3 | 4 | timber: 2, vehicle: 2 | 21 | 32 |
| L4 | 9 | vehicle: 6, timber: 3 | 24 | 32 |
| L5 | 9 | vehicle: 6, timber: 3 | 24 | 32 |
| L9 | 195 | timber: 37, vehicle: 72, metal-prop: 86 | 24 | 32 |
| L10 | 104 | masonry: 2, vehicle: 75, fuel-tank: 5, machinery: 8, timber: 14 | 24 | 32 |

All seven levels pass pristine/damaged checkpoint restoration and the static-collapse check that navigation only opens. The existing 24-fire and 32-debris caps remain enforced.

| Level | Melee damaged | Sidearm | Shotgun | Automatic | Explosive | Fire |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| L1 | 23 | 23 | 23 | 23 | 23 | 23 |
| L2 | 34 | 34 | 34 | 34 | 34 | 34 |
| L3 | 4 | 4 | 4 | 4 | 4 | 4 |
| L4 | 9 | 9 | 9 | 9 | 9 | 9 |
| L5 | 9 | 9 | 9 | 9 | 9 | 9 |
| L9 | 195 | 195 | 195 | 195 | 195 | 115 |
| L10 | 104 | 104 | 104 | 104 | 104 | 94 |

Broken-part counts are retained alongside each family in the raw receipt. Fire rows include native chain blasts. Rockets demolish every opted-in target on every level.

| Level | Melee collapsed | Sidearm | Shotgun | Automatic | Explosive | Fire |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| L1 | 0 | 0 | 23 | 23 | 23 | 23 |
| L2 | 0 | 0 | 34 | 34 | 34 | 34 |
| L3 | 2 | 2 | 4 | 4 | 4 | 4 |
| L4 | 3 | 3 | 9 | 9 | 9 | 9 |
| L5 | 3 | 3 | 9 | 9 | 9 | 9 |
| L9 | 37 | 37 | 195 | 195 | 195 | 109 |
| L10 | 19 | 19 | 102 | 102 | 104 | 94 |

## Routes and verification

- L9: native road/low seed 1 completes in **221.75 s**, courier alive, Sam/corgi safe, **zero collision failures and admission violations**. Three civilians evacuate; this is a route-completion receipt, not a perfect crew-rescue claim. The input policy clears boarders and leaves along the camp’s open gate side before aligning with the bridge. [Route summary](evidence/routes.json), [raw receipt](evidence/l9-road.json.gz).
- L10: native seed 42 completes on **low/high in 1129.60/1117.17 s**, with **six finds each**, 3/1 deaths, content gaps **23.88/28.00 s**, and maximum checkpoint spacing **200.1 m**. The courier climbs the native stair, uses the gun for the hold, and descends through the ramp instead of asking a ground/deck grid for a mid-ramp route. The original weapon policy is retained. [Raw low/high receipt](evidence/l10-low-high.json.gz).
- Full routes use production input frames, mortal combat and ordinary retry/menu actions; no actor writes, immortality, objective skips or relocations. The separate [installed-checkpoint diagnostic](evidence/stair-check.json) exercises the stair/gun with zero deaths on both tiers.
- Native L9 completion scope is the road route. Earlier countryside/dry-shortcut debug attempts failed and were not rerun after the shared camp-exit correction; this increment does not close all L9 acceptance criteria.
- L1–L5: [all threat and route metrics match exactly](evidence/threat-comparison.json) against matching-architecture baselines, including L4 high hold and L5 three-seed follower pace. Only wall time and expected destruction state hashes are excluded. Raw baseline/rollout receipts are archived as `evidence/L*-{baseline,rollout}.json.gz`. The same two pre-existing L3 wave flags remain in both runs; partial selections intentionally exit 1 rather than claim the complete threat gate.
- [E31 verification passes](evidence/E31-checks.json): typecheck, lint, 106 unit cases passed and one skipped; unit command 87.4 s under the unchanged 240 s limit. The focused world-systems suite also passes after the farm-wall fix (5/5, 8.17 s). Test registration remains 150/150. The runner fixture stages/commits its disposable index before verification because the unchanged tooling tests require a Git HEAD.

**Browser QA needed:** new asset damage appearance, clipping and first-hit allocation remain visually unreviewed under this brief’s no-browser instruction. No deployment or push was performed.
