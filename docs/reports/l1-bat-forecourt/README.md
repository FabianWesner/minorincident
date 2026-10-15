# L1 bat forecourt — PO 2026-10-15

Scope: intake #3 (cannot leave the garage), #5 (bench blocks the bicycle), #4b (spread the horde, keep its population), and #3's unrelated-building transparency note. Source: `epics-pipeline/po-bugs-1015.md`; the binding #4b quote is “Overall L1 is fine, keep the nr of Zombies; just don#t put them all to the place where I get the baseball stick, since I cannot freely move there and cannot escape”.

## Changes

- `f03a2c655`: the rotated physics footprint of displaced furniture cannot occupy the garage's required fence opening. Physics motion, explicit placement and checkpoint restoration return an obstructing prop to its authored home before its blocker is published. Other prop movement remains physical. The navigation regression tips a bench through four orientations and restores a blocked saved pose.
- `390a5715e`: three local pursuers may approach the courier at the bat forecourt. Excess approaches are distributed over the existing street groups. The rule ends outside the garage area; civilian fights outside it continue. Population, spawn counts/caps, damage, speeds and recovery tuning are unchanged. The regression uses checkpoint `bat`, seed 1, courier `(22.94,35.60)`, 28 live infected and a toppled bench, on both quality tiers. It measures stationary pressure, then walks to the bicycle with 90 HP and normal damage, requiring a fence crossing and bicycle interaction within 20 seconds.
- `3aa041b05`: solid see-through eligibility follows the particular placement between camera and courier, across all LODs. Other placements sharing its material stay opaque. Window power and occlusion share an instance buffer to preserve the portable WebGPU vertex-buffer limit. The focused regression [fails on the original source](seethrough-before.txt) because the unrelated neighbour remains eligible, and [passes after the change](seethrough-after.txt).

## Validation

Typecheck, lint and fresh production build pass. Remote simulation and full unit/sim/level runs, Scene Lab matrices, L1 browser checks and E18 measurements are pending shared runner/browser capacity. Results and capture review will be recorded here as each run finishes.

Scene Lab catalog: `tests/scenes/catalog/l1-bat-forecourt-bench.json` and `l1-bat-forecourt-crowd.json`. Both use the game camera, the shipped Grove layout and production L1 simulation rules. The crowd scene retains all 28 infected at either quality tier. The bench scene tips the shipped bench into the gap and exercises the production clearance guard. Matrix coverage includes high/low, zoom 1.0/0.5 (plus the standard far zoom) on WebGL2 and WebGPU.
