# r32-alphas: every Alpha type has its own signature moves, body animation and look (2026-11-10)

PO (verbatim, 2026-11-10 UAT on PROD): "Make sure each type of alpha has it's own signature attacks and special moves. Right
now they all the same." Also: "'It's an Alpha' ok, but in the army level there are tons of them." and "This type of Zombie
again, which is ultra hard to kill" (an Alpha in the slim suit skin that looks like a regular zombie).

Spec: docs/design/boss-and-alpha-moves.md (common rules, Alpha types table, level mix). Inputs: r31-zombie-audit P1-A/P2-D,
r31-aggro finding 2b.

## What was wrong
- The sim already had a per-type move set (src/data/alphaTypes.ts: Brute charge/slam/grab-throw, Thrower grab-throw/living
  missile/barrage, Screamer roar, Leaper pounce + low-wall climb, Armoured shield bash + front armour) with the spec timings
  (charge 0.8 s, slam 1.0 s, grab 0.6 s, heave 0.8 s, roar 1.0 s, pounce 0.6 s, bash 0.6 s), markers, one-special-at-a-time
  and the two-starts-per-second limit. What the player saw was the same body for all of them: every telegraph drew the
  shared courier `windup` clip (4 arm/torso tracks authored for the arms-down library rest; on the hunched Alpha rig they
  mostly straightened it up) plus small lean layers, and the ordinary attack ended on the strike tick (r31 P1-A).
- The look was chosen by an id hash over five skins (alphaLook), so the slim `inf.alpha-suit` Leaper skin landed on Brutes,
  Throwers and Armoured too (r31-aggro 2b: "ultra hard to kill" suit zombie).
- Telegraph sounds: charge, slam and grab shared one Brute bellow; all three thrower moves shared the heave grunt.

## What changed (presentation only; no HP, damage, timing or AI numbers changed; sim untouched)
- **Authored Alpha move clips** (`src/render/characters/alphaMoveClips.ts`): 8 clips solved on the Alpha rig itself (its
  rest is the hunched brute stance with identity joint rotations): torso/head offsets, upper-arm/forearm directions and
  two-bone leg IK with planted feet (the pelvis drops, soles stay on the floor). Baked only into the five humanoid Alpha looks
  after the shared 35 clips (`alphaCrowdClips`, 43 x 24 frames; shared indices unchanged). Shipped bakes re-generated with
  `node --import tsx/esm tools/qa/r32/rebake-alphas.ts` (15 files; `tools/qa/r32/check-bake.ts` verifies 1032 frames).
- **Stage mapping** (`src/render/characters/AlphaMoves.ts`): telegraph -> windup section, active -> strike section (charge
  rush and barrage loop), recovery -> follow-through/punish pose. Moves the sim resolves in one tick (slam, roar, bash, single
  throws) play their strike section at the start of the 0.8 s recovery. A telegraph interrupted by a hit (roar inhale, arm
  shot during the grab) shows `stagger-left` instead of the move. The ordinary Alpha attack shows a coil during the sim windup
  and keeps the rake + bite snap playing for 0.45 s after the strike tick (fixes "attack ends on the strike tick" for Alphas).
  The generic lean/lunge/arm-raise layers are switched off while an authored clip plays.
- **Look per type**: `CrowdView.alphaKey` draws `alphaTypes[type].look` (untyped Alphas, e.g. L8, are Brutes =
  `inf.alpha`); the id hash only remains for the Mega's siblings. Silhouette scale per type (instance matrix):
  Brute 1.16 wide / 1.12 tall, Thrower 0.94 / 1.08 (lanky), Screamer 0.90 / 1.02 (thin), Leaper 0.97 / 1.0 and runs with a
  low forward lean and stands in a half crouch, Armoured 1.10 / 1.05.
- **Night cue for Alphas only**: eye emission x2 and a stronger moonlit rim (figureRim 0.7 vs 0.25 for the crowd).
- **Sound family per type** (`src/data/audioCues.ts`): Brute bellow for charge and grab, ground thud (gorilla pound cue) for
  the slam; Thrower heave grunt for all throws; Screamer inhale; Leaper pounce growl; Armoured shield step.
- Scene Lab foot metrics skip `alpha-pounce`/`alpha-charge` (airborne / 9 m/s rush).

## Per type: telegraph, moves, animation, look
| Type | Look | Telegraph (pose + marker + sound) | Strike / recovery (punish window) |
|---|---|---|---|
| Brute | `inf.alpha`, biggest (x1.16) | Charge: head and torso lowered, arms hanging, right foot scrapes back twice (0.8 s), chevron lane, bellow. Slam: both fists raised overhead, back arched (1.0 s), 4 m ring, thud. Grab: arms reach out wide with a step in (0.6 s), reach ring. | Charge: head-down rush cycle, winded hunch after. Slam: both fists into the ground in a deep squat, slow rise (0.8 s exposed). Grab: hoist overhead, hurl to the side. |
| Thrower | `inf.alpha-worker` (hard hat), lanky | Squats to grab the prop/corpse/live infected, lifts it overhead and holds it (0.8 s), landing marker, heave grunt. | Whips it forward with a step; barrage loops the throw section. |
| Screamer | `inf.alpha-hoodie`, thin | Deep inhale: chest up, head thrown back, arms swept back (1.0 s), 8 m ring, inhale cue. A hit during the inhale makes it reel (stagger). | Roar: torso thrust forward, jaw out, arms flung wide, head shaking; the called infected arrive. |
| Leaper | `inf.alpha-suit`, half crouch, low run | Coils into a deep crouch, hands on the ground, eyes up (0.6 s), lane marker, growl. | Stretched horizontal flight, lands crouched over the victim, bite snaps; low-wall climb unchanged (Barricades.vault). |
| Armoured | `inf.alpha-fire` (helmet), bulky | Forearm guard up in front, left shoulder leading, crouch (0.6 s), 2.5 m arc, shield step. | Shoulder-first ram with a long step, recovers upright. Front armour (25 % bullets from the front) unchanged. |
| All | | Ordinary attack: shoulders twisted back, claw cocked high, staggered stance (the windup). | Lunge, rake across, bite snap, 0.45 s recovery after the hit tick. |

## Captures (raw, not in git; every sheet below was opened and described)
Root: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r32-alphas/`
- Before (r31 audit, same rig): `../r31-zombies/scenes/r31-alpha-brute/strip-slam.jpg`: slam windup = a small arm lift,
  charge telegraph = a slight lean; the other types never showed their own body motion.
- `scenes/r32-brute-ground-slam-close-day/sheet.jpg`: f8-56 fists climb overhead inside the 4 m ring; f64-88 fists on the
  ground, deep squat; f96-104 rising. (The AI then charges, f112+.)
- `scenes/r32-brute-charge-close-day/sheet.jpg`: f56-80 head-lowered hunch on the lane; f88-120 head-down horizontal rush.
- `scenes/r32-brute-grab-human-close-day/sheet.jpg`: f8-32 reach with the step in; f40 courier flung; f48 hoist pose.
- `scenes/r32-thrower-living-missile-close-day/sheet.jpg`, `scenes/r32-thrower-grab-throw-close-day/sheet.jpg`: lift
  overhead, the runner/corpse flies, lands by the courier and the runner attacks (f80-112).
- `scenes/r32-screamer-roar-close-day/sheet.jpg`: f8-56 rears up and back (inhale), f64-96 forward roar, called runners
  arrive f136+. `scenes/r32-screamer-roar-interrupted-close-night/sheet.jpg`: MG hit at f32 during the inhale, f40-72 the
  Screamer reels sideways (stagger), red eyes and the blue Alpha rim visible at night; the AI re-roars at f80.
- `scenes/r32-leaper-pounce-close-day/sheet.jpg`: f8-32 deep coil on the lane, f40-88 horizontal flight, f96-128 pinned
  crouch over the courier. `scenes/r32-leaper-strike-close-day/sheet.jpg`: ordinary attack coil (f56-80) and the visible
  lunge/rake into the courier (f88-96, f144-160), repeated.
- `scenes/r32-armoured-shield-bash-close-day/sheet.jpg` (+ `-close-night`): guard up f8-40, ram f48-64, recover.
- Game camera zoom 1.5: night low `scenes-low/r32-{brute-charge,leaper-pounce,screamer-roar}-game-night-low/sheet.jpg`
  (Brute reads ~2x the courier; coil/flight/pin of the Leaper and the Screamer's rear-up are visible at ~60 px figures; the
  Alphas stay darker than the pale runners at night, the eye glow is not resolvable at this zoom); day high
  `scenes-high/r32-{brute-ground-slam,thrower-living-missile,armoured-shield-bash}-game-day/sheet.jpg` (arms overhead and
  the slam squat read at game zoom).
- Fixtures: `specs/scenes/r32-alphas/*.json` (generator `tools/qa/r32/gen_alpha_specs.py`; the special starts on frame 0 through
  the same `startSpecial` the AI uses; the AI may chain its own next move afterwards).

## Native checks
- `tests/shared/render-contracts.test.ts` (folded into the existing skinned-crowd test, no new case): every shipped Alpha
  look/LOD carries the move set; the rake moves the hand forward > 0.25 m, slam fists go above the head then below the hip,
  pounce coil drops the hip > 0.12 m, heave lifts the hands over the head, bash drives the hip forward; each type's moves map
  to clips no other type uses (7 distinct); the strike survives the state flip; an interrupted roar staggers.
- Census (`tools/qa/r32/alpha-move-census.ts`, seed 1, complete policy): see below.

Seed 1, complete policy, 900 s cap (`test-results/r32-alpha-moves.json`; the Mega is excluded from the type checks):

| Level | Alphas spawned | Look drawn per type | Specials started | Ordinary strikes | Foreign moves |
|---|---|---|---|---|---|
| L3 | none in the 230 s complete run | - | - | - | 0 |
| L4 | brute 3, thrower 3, armoured 2 | inf.alpha / inf.alpha-worker / inf.alpha-fire | brute charge 1, brute slam 1, armoured bash 1 | brute 18, thrower 20, armoured 16 | 0 |
| L5 | thrower 1, leaper 1 | inf.alpha-worker / inf.alpha-suit | thrower grab-throw 1 | - | 0 |
| L6 | none | - | - | - | 0 |
| L7 | brute 3, thrower 2 | inf.alpha / inf.alpha-worker | brute charge 2 | brute 34 | 0 |
| L9 | leaper 1, thrower 1 (+ Mega) | inf.alpha-suit / inf.alpha-worker | - | - | 0 |
| L10 (tick budget) | leaper 1 (+ Mega) | inf.alpha-suit | Mega charge 3 | - | 0 |

Every Alpha wears its own type's look, and no Alpha ever starts another type's move (foreign = 0 everywhere). The bot route
meets few Alphas, so one run shows mostly the ordinary strike. The fixtures cover each special move by move, and so does
`tests/engine/infected-ai.test.ts` (unchanged).

Level mix vs the spec (`levelMix` data is unchanged and matches the spec). Open points, left unchanged here because they are spawn content (sim):
- **L6 spawns no Alpha** in the complete run, so the Screamer/Leaper tunnel mix never shows on that route.
- **L7 has no Screamer**: `LevelSevenEncounters` (around line 166) assigns `brute`/`thrower` explicitly, overriding the mix.
- **L3**: no Alpha met on the 230 s complete route.
- PO "tons of Alphas in the army level": L4 spawns 8 Alphas in one complete run (3 Brute, 3 Thrower, 2 Armoured, from the
  `armor`/`line` jobs in `LevelFourWar`). Orchestrator decision.

## Threat audit
`node --import tsx/esm tools/qa/threat-audit.ts --levels L3,L4,L5,L6,L7`, run locally on the Mac after the orchestrator's
pkill killed the remote run: **skilled complete on all five levels**, 18 fail flags (partial-selection diagnostic). This
lane's `src/sim`, `src/levels`, `tests/engine` and `tests/helpers` are identical to main; the only non-render data diff is
`src/data/audioCues.ts`. So these flags are main's own: L4 FIRST_ATTACK_OVER_10_SECONDS, breach-south
WAVE_FEWER_THAN_THREE, L4-06, L4-07; L6 breach2 first attack and 3x L6_ENTRY_COUNT_MISMATCH; L7 KITING x2 and
SLOW_FOLLOWER 96/98 x2; L5 look SKILLED_BELOW_ATTACKS_PER_MINUTE_3; L3/KITING_LANDED_HITS_BELOW_2 (the flag r31-aggro left
for the orchestrator). The batch-69 log had 21 flags.

## Validation
- `npm run typecheck` pass; `npm run lint` pass.
- `tests/shared/render-contracts.test.ts` 14/14. The Alpha checks are folded into the skinned-crowd test (no new case).
- `npm run test:gate` (remote, before the last main merge): 104 passed, 2 failed. Navigation A* timed out at 30 s under load
  and passes locally. `vehicles.test.ts` fails on an L8 breach assert; after the merge it still fails at
  `tests/helpers/l8BossShoot.ts:164` (`states.breached` false). Sim and tests are identical to main, so this is main's
  failure (batch 71 L8), not this lane's.
- Scene Lab, 0 gate failures on every run: WebGL2 high (close camera, day and night), low (game zoom 1.5, night), high (game camera, day), WebGPU
  (two night fixtures), and after the main merge (roar close day, pounce game night) the motion is unchanged.

## Browser QA needed (after merge)
- `npm run scene -- specs/scenes/r32-alphas/*-close-day.json --sheet 8` and the `-game-night` set with `--tier low`: each
  type plays its own telegraph and strike as described above. WebGPU is checked only for the Thrower and Leaper night fixtures.
- In levels: L4 breach (Armoured bash, Thrower), L5 (Leaper pounce), L6 tunnels at night (Screamer roar + call), L7 (Brute
  charge into a wall: the stun shows the winded hunch, not an idle), L8 (untyped Alphas now always the Brute look).
- Check the Brute's 1.16 scale against door frames/arches at L3/L4 (silhouette only, collision unchanged).
