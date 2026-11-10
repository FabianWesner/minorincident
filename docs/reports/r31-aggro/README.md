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
- `InfectedSystem.provoke`: a courier hit clears `pressureTarget`; new `engageCourier()` sets `l1.focusId=1` (4 s, bias 12 m, only for shots within 8 m), and unless mid-bite/mid-attack switches the brain to `chase` on her with a short fast snap (9 ticks at the hearing turn rate). A bite in contact already breaks off through the existing `grabHits` rescue rule, then `closest()` prefers her via the focus bias.
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

(Final code: L4 runner 10/10, L7 runner 9/10. L4 trials of 20 were cut to 10 because the Mac was at load 25 from other lanes.)

## Finding 2: hit detection vs hits-to-kill (`tools/qa/hit-rate-probe.ts`, standing target, 5 lateral offsets -0.4..0.4 m)
Runner = 40 hp x INFECTED_TOUGHNESS 1.5 = 60 hp, capsule radius 0.35 m, ray tested at y in [-0.7, +1.1] around the 0.7 m centre.

| Weapon | Hits to kill runner | Firefighter (140 hp base) | Armored (400 hp base) |
|---|---|---|---|
| handgun | 3 | 11 | never killed in 90 shots (armour reduction by design) |
| army MG | 5 | 15 | never killed in 295 hits |
| shotgun | 1 | 1-3 | 3-5 at 3-5 m, none at 8 m |

Aimed-shot hit rate on the runner at 3, 5, 8 m: assist Default 100 %; assist Off (straight along the facing, targets 0.4 m off line) 71-79 %, which is the 0.35 m capsule vs the lateral offset, i.e. correct geometry. Moving runner/sprinter from 8 and 12 m: Default 100 % at 8 m, 80-83 % at 12 m, killed before contact in all trials.
Conclusion: no hit-detection bug found for the runner. "Hard to kill" is toughness (60 hp = 5 MG hits, 3 handgun hits) plus, before this fix, the infected running past the courier to a survivor. If the PO saw an armoured/firefighter-class body in a suit look, the numbers above are the by-design armour (not changed). Nothing changed in HitQuery.


## Finding 2b: "ultra hard to kill" suited zombie in L8 (PO 11-10, night, red eyes) = an Alpha in the suit skin
Cause found: `src/data/alphaLooks.ts` draws every `infected.alpha` with one of five skins chosen by a hash of the entity id (`alphaLook(asset, id)`, CrowdView lines 310/635), independent of its Alpha type. `inf.alpha-suit` is a slim jacketed body that reads like a regular infected; it is the Leaper's own look in `alphaTypes`, but the id hash can put it on a Brute, Thrower or Armoured too (L8 has no authored Alpha mix, so Brutes there get any skin). The PO cannot tell it is an Alpha.

Multipliers vs a runner (60 hp, no resist): Alpha base 200 hp x INFECTED_TOUGHNESS 1.5 = 300 hp (L7 x1.5 more = 450); bullets x0.5, shotgun x0.8 (`alphaDamageMultiplier`); Armoured type takes x0.25 from bullets hitting its front half (dot >= 0.5); x1.5 during a special's recovery. Capsule radius 0.55 (runner 0.35), so hit detection is not the issue.

Measured standing targets (5 lateral offsets, 3-8 m), hits needed:
| Weapon | Runner | Alpha brute | Alpha leaper (suit look) | Alpha armoured (facing the shooter) |
|---|---|---|---|---|
| handgun | 3 | 25 | 30 | 56 |
| army MG | 5 | 37 | 43 | 76 |
| shotgun (3 m / 8 m) | 1 | 2 / 6 | 2 / 6 | 2 / 6 |

Hit rate 100 % for every Alpha trial (assist Off and Default). So: no hit-detection bug, it is a 7-15x tougher enemy that looks like a regular zombie. Stats unchanged.

Proposal (not implemented here: render change, needs browser QA): make the skin a function of the Alpha type, as docs/design/boss-and-alpha-moves.md 'Look cue' says (Brute biggest, Thrower lankier with long arms, Screamer thin jaw open, Leaper crouched, Armoured helmet/vest), i.e. use `alphaTypes[type].look` in CrowdView instead of the id hash, and keep the hash only for variation inside a type. Add an Alpha-only cue visible at distance and at night: a larger world-space health bar / red-orange rim or eye glint that regular infected lack, and a one-time "ALPHA" ping when one first sees the courier. Also the night figure fill (pale blue) hides skin differences, so the shape cue matters most.

## Role HP table (from `src/data/infected.ts`, x INFECTED_TOUGHNESS 1.5) and the L4 "suit" soaker
Runner 60, sprinter 45, crawler 37, screamer 90, firefighter 210, hazmat 180, bloated 180 (explodes), riot 225 (shield), brute 450, armored 600 (front half x0.25 from non-explosive), butcher 1350, Alpha 300 (bullets x0.5). Only runner/sprinter get the `inf.common-worker`/civilian looks in L4 (`LevelFourWar.emerge`); the orchestrator's Opus audit reports brute/armored/butcher/screamer/bloated have no skin of their own and render as the office worker, which fits the PO's "ultra hard to kill suit zombie" (butcher = 22x a runner, brute 7.5x). I did not re-verify the draw fallback in a browser (no browsers in this lane). The stats are by design (see tables above); the fix is a distinct look per role (separate asset lane). Hit detection is fine in all measured cases (100 % with assist, geometry-correct without).

## Threat audit (skilled, no flags beyond the Mac baseline, plus one)
Final code (engage range 8 m, focus 4 s):
- L4: FIRST_ATTACK_OVER_10_SECONDS, WAVE_FEWER_THAN_THREE_COHORT_MEMBERS (breach-south), L4-06, L4-07 = baseline.
- L7: KITING (attacks/min, landed hits), SLOW_FOLLOWER 96/98 = baseline. L5 not re-run on the final code; the first version (focus 12 s, no range limit) matched baseline there (KITING only).
- L3: L3-06 (baseline) **plus L3/KITING_LANDED_HITS_BELOW_2 (0 landed in the 20 s kiting probe: 2 attack starts, 0 hits, baseline 3 starts / 2 hits)**. This is a 20 s single-seed probe that any AI perturbation shifts; the first version also failed L3-11 attack rate (seed 1 65/min vs 24/min baseline), which is why the engage is limited to shots within 8 m and a 4 s focus (now seeds 30 / 12 / 15 per min, all within 3-25). Orchestrator decision needed on the kiting flag.
- No follower/survivor-loss changes observed in L4/L5/L7 follower pace (0 skilled flags); L3 army line: seed 2 army 3 (baseline 0), seeds 1 and 3 army 0 (baseline 0), so L3-06 stays failing as on baseline.


## Browser QA needed
- L4 war, WebGPU high and low, zoom 1.5: shoot a suited runner that is chasing a survivor from 3-6 m; it must turn to the courier within ~0.5 s and run at her (no turning away). Also a runner mid-bite: the bite breaks off when hit.
- L1 and L7: same check with a pedestrian-look infected next to a civilian/evacuee.
- Check the snap turn (9 ticks) does not look like a pop on the runner animation (animation clips are not changed by this lane).
