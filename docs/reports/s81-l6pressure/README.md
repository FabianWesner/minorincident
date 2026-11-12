# s81-l6pressure — L6 pressure after hatch closing

## Change

Tunnel pressure continues from another open service mouth when a preferred hatch is closed. The Northgate platform mouth tracks 18 meters ahead of the player, so the final retreat also has a source. Pressure members target the nearest living survivor or the player and include a runner in each pressure cohort. The mission recycles only living, idle, offscreen infected more than 30 meters from the walking leader and more than 25 meters from the player and survivors when the active pool needs room. Corpses are never removed.

Hatches remain safe for 15 seconds after closing, then take eight one-second bash hits to break. The prompt reaches the normal walking lane so the early-close policy can close each hatch while advancing. The two authored arrivals remain an exact-two cohort; a one-infected arrival released after a fully spent hatch breaks is observed separately. The shelter’s second breach now enters near the shelter and has three runners spaced through its ten arrivals, keeping its attack within the existing audit window. The infected cap is 66. Zombie stats are unchanged.

`tools/qa/l6-pressure.ts` records attack starts on the player or original survivor group in 30-second windows from the first closed hatch to exit, plus maximum attack-start gap, exit state, hatch closures/breaks, wave/source counts, cap and reservation refusals, offscreen/snap/closed-hatch refusals, and distant living actors recycled. It runs early-close, skilled complete, the threat audit’s passive behavior, and the evade-only bounded control for seeds 1–3.

## Before and after

Before the fallback and reservation changes, the early-close native route produced these 30-second attack-start counts: seed 1 `3, 7, 28, 23, 6, 4`; seed 2 `10, 5, 2`; seed 3 `6, 2, 1`. The last incomplete window on each route had no attack start before the run stopped. The pressure wave never admitted a wave-three cohort; cap refusals were 30, 24, and 290 for seeds 1–3. The original authored pressure interval was 40 seconds, already longer than the acceptance window.

After the fix, every early-close run, every skilled run, and every passive run exited with no 30-second attack gap. The arrays below are 30-second windows beginning at the first hatch close; the final window can be shorter. `max gap` also checks the interval from closure to first attack, between attacks, and from the last attack to exit.

| Policy | Seed | Attack starts per 30 s window | Max gap | Exit | Deaths |
|---|---:|---|---:|---|---:|
| Early-close | 1 | 8, 3, 19, 17 | 18.9 s | Yes | 0 |
| Early-close | 2 | 2, 5, 12, 4 | 22.1 s | Yes | 0 |
| Early-close | 3 | 1, 5, 16, 3 | 25.2 s | Yes | 0 |
| Skilled complete | 1 | 10, 2, 18, 2 | 19.9 s | Yes | 0 |
| Skilled complete | 2 | 2, 2, 21, 0 | 22.1 s | Yes | 0 |
| Skilled complete | 3 | 2, 6, 10, 1 | 24.6 s | Yes | 0 |
| Passive | 1 | 353, 281, 271, 48 | 0.8 s | Yes | 0 |
| Passive | 2 | 333, 222, 226, 29 | 0.7 s | Yes | 0 |
| Passive | 3 | 345, 234, 236, 26 | 0.9 s | Yes | 0 |

The early-close policy closed all six hatches in all three seeds. Five broke open before exit in each run; the final hatch remained secure through the exit. Skilled complete and passive controls also closed six hatches. `native.json` contains the complete tick-level windows and receipts for all 12 runs.

Early-close pressure refusals were cap `0/0/0`, reservation `0/0/0`, offscreen `0/0/0`, snap `0/0/0`, and closed-hatch candidate `0/0/0` for seeds 1–3. Skilled refusals were also zero. Passive refusals were cap `22/58/5`, reservation `8/17/1`, offscreen `0/0/6`, snap `0/0/0`, and closed-hatch candidate `0/0/0`. Idle, distant, offscreen infected recycled to make room were `12/11/8` early-close, `10/11/7` skilled, and `30/22/29` passive. The audit run separately confirmed the original two arrivals and any one-infected post-break arrival.

The evade-only bounded control does not close a hatch and does not reach the exit, so it has no hatch-close-to-exit window. It remains in the native receipt as a control and does not determine the completion acceptance.

## Threat audit

The L6 threat audit includes `L6/early-close/1` as an additional observed run, records its run and observation, and aggregates its phase and wave flags alongside a completion check. The L6 receipt has zero skilled, passive, and early-close threat flags. The top-level receipt retains its existing `PARTIAL_LEVEL_SELECTION` diagnostic because the command selects only L6.

## Browser QA needed

No browser was launched. PO review is still needed to confirm the wider hatch prompt feels natural, the 15-second safety reward and break telegraph read clearly, and platform-mouth arrivals feel like an intentional continuation of the encounter.

## Reproduction

```sh
node --import tsx/esm tools/qa/l6-pressure.ts
node --import tsx/esm tools/qa/threat-audit.ts --levels L6
```
