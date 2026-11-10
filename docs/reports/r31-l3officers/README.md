# r31-l3officers: infected land normal hits on L3 squad officers

PO 2026-11-10 (PROD UAT): "L3 police team doesn't loose any health, which is strange". PO chose option B: keep the rescue rule, infected also land normal hits on officers.

## Cause
- `InfectedSystem.chaseL1` treated every non-courier human as a bite victim (`startBite`, 1 s grab). A hit on the biter cancels the grab; only completed bites cost officer health (`woundL3Officer`, 34).
- Even a normal swing would have done nothing: `Damage.apply` returns 0 for any `civilian` target that is not hit by a stagger-carrying infected move (it only plays the civilian hit reaction). So infected had no damaging melee path against officers.
- Seed 1 baseline: 69 grabs on the squad, 21 completed bites.

## Change (src/sim/ai/InfectedSystem.ts)
- At contact with a following L3 squad officer an infected alternates (deterministic, `(id + tick/120) & 1`) between the existing grab/bite and its normal melee windup + strike (`windup(e, officer)`).
- `attackVictim` applies that strike to the officer directly (`hitL3Officer`): `def.damage * damageMultiplier` (runner 10, same as on the courier), no new stats; the hit that empties health kills him (state `finished`, counted as a `kill` loss by the squad update). Bites unchanged. Checkpoint restore still resets the squad to 200/200.
- Test folded into the existing perception test in tests/engine/infected-ai.test.ts: six runners on one officer produce plain 10-damage hits and 34-damage bites and wear him from 200 to 0 within about 5 s.

## Numbers
tools/qa/diag/l3squadhp.ts (bot, 36000 ticks, low; the bot never finishes L3 so it idles after ~t6500; the `profile` argument made no difference):

| seed | grabs on squad before / after | officer hp drops before / after |
|---|---|---|
| 1 | 69 / 8 | 21 / 2 |
| 2 | 3 / 0 | 0 / 0 |
| 3 | 8 / 1 | 1 / 0 |

Honest reading: the bot timeline diverges after the change (infected die to the officers while swinging instead of grabbing, so fewer fights reach the officers); the bot's end hp is not a good wear metric because a courier respawn resets the squad. The mechanism proof is the unit test and the audit below.

`node --import tsx/esm tools/qa/threat-audit.ts --levels L3` (skilled complete, seeds 1-3):
- L3-06 squad at army line: before FAIL (0/3 seeds with >= 2 officers, all four losses bites); after PASS (s1 0 [4 separated], s2 2, s3 2 = 2/3).
- L3-07 officer hits stay PASS (192/155/157). Only remaining flag is PARTIAL_LEVEL_SELECTION.
- Seed 1 still loses all four squad members, now by separation, not bites (not part of this change).

## The "heal" 30 -> 56.25 at t5000 (seed 1)
Not a heal. The officer (30 hp, below one bite) was bitten and turned: at t5000 he is in the `rising` infection state and his health object is replaced by the infected one (56.25 = the infected runner's health with the level's scaling). At t5004 the courier respawn restores the checkpoint snapshot and the whole squad is 200/200 again. No medkit was consumed (33 left).

## Notes
- Hit rate depends on officers not killing the infected first; with 1-2 infected they usually do. If the PO wants more visible wear, raise the share of strikes (the `& 1` alternation), not any stat.

## Browser QA needed
- L3, squad of four following the courier, fresh save, zoom 1.5 and default, high and low: the bar over each officer drops when infected hit them in melee (not only after bites), an officer collapses at 0, no infected stands in front of an officer without swinging.
- After a courier death and respawn: squad bars back to full.
