# R16 destruction rollout

Native destruction checks pass. Route and threat equivalence verification is still in progress.

The opt-in set is applied before district collision is built. L1/L2 use parked civilian cars; L4/L5 use ordinary neighborhood parked cars and small sheds, preserving authored combat dressing. L3 retains its reviewed pilot. L9 adds roadside cars, huts/sheds and barricades. L10 adds abandoned cars, rebuilt farm walls/roofs, checkpoint huts, and dispersal machinery/fuel tanks. The console and required supports retain their existing owners.

Rebuilt farm wall zones follow `tools/blender/sslib/farm_assets.py`; they supply hit geometry without adding solid colliders or closing the existing doorway gaps. District navigation cells change immediately during destruction; their unchanged FNV hash is recomputed once when read, avoiding a full-grid scan for every blocker edit.

## Native evidence

[Raw destruction receipt](evidence/destruction.json). Each weapon family starts from a native mission checkpoint, receives one normalized 3000-damage structural contact per target, then runs 721 destruction ticks. These are material-response fixtures, not player DPS or full playthrough claims. Complete collapse is separately exercised for one object of every policy present.

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

Broken-part and collapse counts are retained alongside each family in the raw receipt. Fire rows include native chain blasts.

## Remaining verification

- L9: Linux road route fails near evacuation departure; a receipt with actual courier damage events is running. An earlier Mac route completed but reported cleanup overlaps, so it is not a clean gate.
- L10: the mounted-gun stair diagnostic now completes the hold on both tiers with zero deaths, one mount each, and 207/430 native minigun hits. A full low/high route with the final farm zones is running.
- L1–L5: matched Mac threat receipts are exact for L1–L3 apart from wall time and expected destruction state hashes. L4/L5 combat dressing is preserved; a matching Linux baseline is running before claiming numeric equivalence.
- Typecheck and lint passed earlier; the current focused world-systems suite passes all five cases. The final isolated E31 verifier is running. Test registration remains 150/150.

**Browser QA needed:** new asset damage appearance, clipping and first-hit allocation remain visually unreviewed under this brief’s no-browser instruction. No deployment or push was performed.
