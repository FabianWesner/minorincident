# r31-aggro: shot infected turn to the courier; suited infected hit detection

## PO findings (2026-11-10 UAT, L4)
1. "Super strange. I shot at this Zombie, but it's not attack me, actually turning away from me."
2. "This type of Zombie is sometimes super hard to kill. Something is wrong with hit detection I guess."

## Causes (finding 1)
The suited office infected is an `infected.runner` with the `inf.common-worker` look (L4 `l4InfectedLooks`), human brain (`b.l1`).
- `provoke()` only called `rush()`, and `goTo()` refuses to redirect a brain that is already in `chase`/`bite`. A runner chasing a survivor stayed on the survivor after the courier shot it and ran away from her.
- A director `pressureTarget` / `l1.focusId` assigned to a survivor made `provoke()` return before doing anything (`pressureTarget` early return), so a courier hit was fully ignored.
- Even after a retarget, `Perception.closest()` dropped the courier when she was behind the infected (the current target must pass `tracks()`, which needs the facing cone), so the 0.25 s re-evaluation switched back to the nearest survivor.
- Turning used the 3.2 rad/s look rate, so a 110-180 degree turn took ~0.7 s.

## Fix (shared AI, all levels, no stat changes)
- `InfectedSystem.provoke`: a courier hit clears `pressureTarget`; new `engageCourier()` sets `l1.focusId=1` (12 s, bias 12 m), and unless mid-bite/mid-attack switches the brain to `chase` on her with a short fast snap (9 ticks at the hearing turn rate). A bite in contact already breaks off through the existing `grabHits` rescue rule, then `closest()` prefers her via the focus bias.
- `Perception.closest`: the shooter that provoked this infected is always accepted as a candidate (no facing/notice requirement) while the provocation lasts.
- Test: `tests/engine/infected-ai.test.ts` (perception test) asserts a courier hit overrides a pressure assignment.
- Probe: `tools/qa/aggro-probe.ts` (loads the real level, a runner/firefighter 3-6 m from the courier next to a survivor that it is already chasing/biting, courier shot with audible gunfire, pass = faces her < 45 deg within 0.5 s and targets her within 1 s).

## Probe numbers (before -> after)
| Scenario | Before | After |
|---|---|---|
| L4 runner | 0-17 % | 10/10 (100 %) |
| L1 runner | not measured | 20/20 (100 %) |
| L7 runner | 35 % (7/20) | 19/20 (95 %); the miss is an infected in its attack windup, which finishes first by design |
| L4 firefighter (archetype brain) | 3/6 | 6/8 (2 skipped: spawn boxed in). The two misses walk a nav detour around an obstacle, not a target problem |

(L4 trials of 20 were cut to 10 because the Mac was at load 25 from other lanes.)

## Finding 2: hit detection vs hits-to-kill (`tools/qa/hit-rate-probe.ts`, standing target, 5 lateral offsets -0.4..0.4 m)
Runner = 40 hp x INFECTED_TOUGHNESS 1.5 = 60 hp, capsule radius 0.35 m, ray tested at y in [-0.7, +1.1] around the 0.7 m centre.

| Weapon | Hits to kill runner | Firefighter (140 hp base) | Armored (400 hp base) |
|---|---|---|---|
| handgun | 3 | 11 | never killed in 90 shots (armour reduction by design) |
| army MG | 5 | 15 | never killed in 295 hits |
| shotgun | 1 | 1-3 | 3-5 at 3-5 m, none at 8 m |

Aimed-shot hit rate on the runner at 3, 5, 8 m: assist Default 100 %; assist Off (straight along the facing, targets 0.4 m off line) 71-79 %, which is the 0.35 m capsule vs the lateral offset, i.e. correct geometry. Moving runner/sprinter from 8 and 12 m: Default 100 % at 8 m, 80-83 % at 12 m, killed before contact in all trials.
Conclusion: no hit-detection bug found for the runner. "Hard to kill" is toughness (60 hp = 5 MG hits, 3 handgun hits) plus, before this fix, the infected running past the courier to a survivor. If the PO saw an armoured/firefighter-class body in a suit look, the numbers above are the by-design armour (not changed). Nothing changed in HitQuery.

## Threat audit
See the section appended below (L3,L4,L5,L7 skilled).

## Browser QA needed
- L4 war, WebGPU high and low, zoom 1.5: shoot a suited runner that is chasing a survivor from 3-6 m; it must turn to the courier within ~0.5 s and run at her (no turning away). Also a runner mid-bite: the bite breaks off when hit.
- L1 and L7: same check with a pedestrian-look infected next to a civilian/evacuee.
- Check the snap turn (9 ticks) does not look like a pop on the runner animation (animation clips are not changed by this lane).
