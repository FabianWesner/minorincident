# r31-megafight: the L10 Mega fight (main a0957730)

Findings from r30-finale-qa: Mega drawn as a see-through ghost, fight leaves the arena and "Back to the dispersal arena" shows in melee,
arena tools not discoverable, no boss bar, courier pale in tank shadow. Raw captures (not in git):
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r31-megafight/`
(`before2-high-z15-gl`, `exp1-nofg`, `exp2` = before; `exp3-crops.jpg`, `final-high-z1-gl`, `final-low-z15-gpu`, `after-gate*` = after).

## 1. Ghost Mega: cause and fix
Not an occluder/see-through treatment (nothing applies `seeThrough('boss')`, `fade` is 0, the Mega drew at LOD0/1, not LOD2) and not the
courier foreground slice (switching `megaForegroundM` to 0 changed nothing). Cause: `CrowdView` gave every Alpha look except the
*regular* Alpha the full night figure fill (`figureFill = 1`, atlas fill 0.18). The Mega is an Alpha look but not `regularAlpha`. That fill
is added on top of the lit colour regardless of light, so wherever the Mega stands in shadow (the tank shadows of the arena, the
shadow of the sphere tank) it turns into a flat pale-lavender, speckled "ghost" (it was solid while north of the courier in sun, ghost
once it stood in the sphere shadow; r30 saw it "when the courier is behind it" because that is when the fight moves there).
Fix: `regularAlpha` now includes the Mega looks (fill 0.25, atlas fill 0.04, same as the Alpha). Same scene before/after
(`before2-high-z15-gl/s017-t1676.jpg` vs `exp3-crops.jpg`): the Mega is a solid dark body in shadow and in light.
Not fixed: the courier pale under a tank shadow (P3). The courier uses the hero fill path, not touched here.

## 2. Fight stays in the arena
- `src/sim/ai/MegaPursuit.ts drive`: new leash (`finale.leashRadius` 25 m). Once the charge runs and the Mega has entered the yard
  (`mega-in-arena` state), a courier outside the leash disc does not drag it out: it walks to the leash edge on the line to her and
  fights her there if she is within 8 m; beyond leash+4 it always goes back. It follows her back in. Replaces the old charge-ready only
  55 m rule. HP, damage and cooldowns untouched.
- HUD: "Back to the dispersal arena" only for a courier more than 33 m out and only while the Mega is not within 10 m of her.
- "Stands idle at the console": measured with the probe, a god courier parked inside the console solid is only reachable by slams (the
  console blocks melee) and the Mega spends most of the time between its 6-8 s specials. A non-god courier standing there dies in
  16 s (probe, `god=0`), so the Mega is not harmless. No stat changes made.

| (`tools/qa/r31-megafight-probe.ts`, god courier, 180 s, runs 70 m west at 65-95 s) | before | after |
|---|---|---|
| max Mega distance from console | 66.2 m | 26.1 m |
| "Back" text while Mega within 6 m | 0 | 0 |

Test (folded into the existing missions interactions test, `tests/helpers/l10MegaFight.ts`; 150-case budget unchanged): 110 s fight,
courier out to 69 m: max Mega 30.5 m (assert < 34), "back" in melee 0, switch by interact done, a tank next to the Mega costs it
134 HP (blast), the electric gate 900 HP, gate spent. `node --import tsx/esm tools/qa/r31-arena-tools.ts` prints the numbers.

## 3. Discoverable tools (`src/render/InteractionView.ts`, `Hud.ts`, `LevelTenFinale.ts`, `HealthBars.ts`)
- Gate switch: a pedestal with yellow cap and plate, a status lamp (red off, cyan armed), a cyan beacon column visible from afar, the
  console-style ground ring within 16 m, and the prompt "Press E: electrify the gate, then lure the Mega through it (one use)".
- Electrified gate: two pylons with hazard bands and lamps and three wires between them at the gate (console x, +28 m); armed = wires
  flicker bright, sparks, lamps blink; spent = dark.
- Fuel tanks: pulsing red ground ring at the 5 m blast radius; objective line appends "Shoot the fuel tank!" while the Mega is within
  blast radius + 2 m; "Lure the Mega through the electric gate" once the gate is armed and not spent.
- Weak spot: the existing red marker is larger (0.42 m), drawn through the body so it shows from the front ("WEAK SPOT" also in the bar).
- Boss bar: screen-wide top bar "Mega Alpha · phase n/3" with health fill, shown while it is alive, installed cure, within 60 m.
Evidence (high/zoom 1/WebGL2 and low/zoom 1.5/WebGPU, real input, opened): `after-gate-sheet.jpg`, `after-gate3-sheet.jpg` (switch ring, beacon,
pylon with lamp, weak spot red marker, hint), `final-low-sheet.jpg` (armed cyan lamp, gate hint, boss bar, solid Mega in the fight),
`final-high-sheet.jpg`. 0 page errors in all runs.

## Checks
- `npx tsc --noEmit`, eslint on touched files: clean. `npm run test:gate`: 27 files / 107 tests pass.
- `threat-audit.ts --levels L10`: skilled complete, passive tick-budget, 0 passive flags (only PARTIAL_LEVEL_SELECTION diagnostic).
- Tooling: `tools/qa/r31-megafight-probe.ts`, `r31-arena-tools.ts`; `r28-vqa-fixture-play.ts` logs Mega LOD and drawn-figure count.

## Browser QA needed
- Gate wires/sparks while armed with the Mega walking through (only the lamps and switch were captured armed); touch layout of the boss bar;
  courier pale in tank shadow (P3, not changed); a non-god fight on a real device.
