# r31-zombie-audit: every infected type on the workbench, rated (2026-11-10)

PO (2026-11-10 UAT, verbatim): "L4, this type of Zombie looks great but movements are bad. I don't see actual bite or attack
moves. Also when I hit them the gun, they don't really react." / "For all Zombies, I want clear attack moves and getting hit
reactions. Also smooth walking/running." / "Let an agent check every Zombie in isolation on our workbench and rate them, so you
get a backlog."

Audit only, no game code changed. Inputs: a seeded census of what every level actually spawns, one isolated Scene Lab fixture
per type (close camera, video), a game-camera pass at zoom 1.5 on low and high, and a read of the clip-selection code.

## Method

- **Census** (`tools/qa/r31/zombie-census.ts`, seed 1, complete policy, 600 s cap per level): archetype x drawn asset x Alpha
  type x render path (`crowd` = CrowdView, `civ` = CivilianCrowd for turned pedestrians). See the table below.
- **Fixture** (`specs/scenes/r31-zombie-audit/<type>.json`, generator `tools/qa/r31/gen_specs.py`): god-mode courier with
  bat + army MG; the infected idles 0-120, chases and attacks 120-420, takes a short MG burst at 420 (bullet hits), a bat swing at
  510 (melee hit), a heavy kick at 600 (knockdown/get-up), then 3 s of MG at 780 (death, or sustained bullet hits on bosses).
  `trace: true` gives the drawn clip per frame. Close camera from the side at 1024x576, WebGL2, high tier, 20 fps video
  (raw MJPEG, see "Tooling notes"). `game/<type>.json` repeats it at the game camera, zoom 1.5, low and high (shots only).
- **Reading:** `python3 tools/qa/r31/timeline.py <scene dir> name:f0:f1[:full]` prints the clip runs and tiles every video
  frame of a window (one cell = 3 ticks); `python3 tools/qa/r31/summarize.py test-results/scenes` gives clip counts per phase,
  foot slide and outcome. I looked at the attack, hit, kick and death strips for every group named below.
- Sheets (one per group, every cell = 3 ticks; `*.jpg` under docs/reports is git-ignored by the 11-05 archive rule, so they
  sit next to this README in the worktree and in the scratchpad folder below): `sheet-humans-suit-attack.jpg` (suit worker, frames 155-275: two
  attack cycles), `sheet-alpha-brute-slam.jpg` (frames 128-300: slam ring, slam, charge lane), `sheet-animals-lion-pounce.jpg`
  (frames 150-300: pounce lane, arrival inside the courier).
- Captures (not in git): `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r31-zombies/scenes/r31-<type>/`
  (`strip-*.jpg`, `video.webm.mjpeg`, `metrics.json`), game camera in `.../scenes-game-low|high/`.

## Census: who appears where (seed 1)

| Type (drawn model) | Archetype | Levels | Path |
|---|---|---|---|
| Turned pedestrians (npc.civilian-*, police, lab, aftermath, firefighter-alive) | runner / sprinter | L1 L2 L3 L5 L6 L7 L8 L9 (L4 on crowd path) | civ |
| Suit office worker `inf.common-worker` | runner / sprinter | L4 L8 L9 L10 | crowd |
| Native runner looks (bbq-dad, jogger, cashier, suburban-mom, delivery-driver, bathrobe) | runner / sprinter | L8 L9 L10 | crowd |
| Riot `inf.riot-cop` | riot | L4 (12) L6 L10 | crowd |
| Firefighter | firefighter | L4 L9 L10 | crowd |
| Hazmat | hazmat | L4 (10) | crowd |
| Crawler | crawler | L4 (12) L10 | crowd |
| **Brute / armored / butcher / screamer / bloated roles** (no skinned asset; drawn as the suit worker) | brute, armored, butcher, screamer, bloated | brute L4 (12) L9 (25); armored L4 (10) L6 L8 L9 (17) L10 (11); butcher L4 (10) L5; screamer L9 (27) L10; bloated L9 L10 | crowd |
| Alpha brute / thrower / leaper / armoured / screamer | alpha | L4 L5 L7 L8 L9 L10 (screamer: L6/L7/L10 mix) | crowd |
| Mega Alpha | alpha + mega model | L9 L10 | crowd |
| Dog (+k9, cream, black coats) | dog | L8 L9 (57) L10 | crowd |
| Lion, lioness, gorilla, elephant, zebra, flamingo (6), monkey (7) | zoo roles | L8 (elephant, zebra also L9) | crowd |
| Nurse | nurse | none in seed 1 | crowd |

## Ratings (1 = absent/broken, 5 = shippable; full table with defects in `summary.json`)

| Type | Walk/run | Attack | Hit reaction | Death | Look |
|---|---|---|---|---|---|
| Suit worker (L4) | 3 | 1 | 1 | 3 | 4 |
| Native runner looks | 3 | 1 | 1 | 3 | 4 |
| Turned pedestrians (civ path) | 3 | 1 | 1 | 3 | 4 |
| Riot | 3 | 2 | 2 | 3 | 4 |
| Firefighter / hazmat | 3 | 1 | 1 | 3 | 4 |
| Nurse | 2 | 1 | 1 | 3 | 4 |
| Crawler | 3 | 1 | 1 | 3 | 3 |
| Brute/armored/butcher/screamer/bloated roles | 3 | 1 | 1 | 2 | 1 |
| Alpha brute | 4 | 3 | 1 | - | 4 |
| Alpha thrower / leaper / screamer / armoured | 4 | 1-2 | 1 | - | 4 |
| Mega | 2 | 3 | 1 | - | 4 |
| Dog | 3 | 3 | 1 | 3 | 3 |
| Lion / lioness | 3 | 2 | 1 | - | 3 |
| Gorilla | 3 | 2 | 1 | - | 3 |
| Elephant | 3 | 2 | 1 | - | 2 |
| Zebra | 2 | 1 | 1 | 3 | 3 |
| Flamingo | 2 | 1 | 1 | 3 | 3 |
| Monkey | 2 | 1 | 1 | 3 | 3 |

"-" = not killed in the fixture (Alphas take 50 % bullet damage and never get a heavy reaction; bosses are arena-scripted).

## Backlog (prioritised; items grouped by shared root cause)

### P1-A. No visible strike or bite on any humanoid infected (all human types, all Alphas' ordinary attack)
- **Seen:** every attack cycle is `windup` (21 frames) then straight back to `infected-idle`; the `swing` clip never appears for
  an ordinary attack (suit: windup 160-180, idle 181-240, windup 241-261 ...; same pattern in all 14 humanoid fixtures). In the
  strip the suit worker *straightens up and drops his arms* during the windup (reads as relaxing), then nothing happens at the
  moment the red ring disappears and the hit lands; he never closes the last ~1 m to the courier
  (`scratchpad/r31-zombies/scenes/r31-suit-l4/strip-attack.jpg`, cells 4-10). Turned pedestrians hold the windup pose frozen
  (`r31-civ-man/strip-attack.jpg`).
- **Good looks like:** a 0.3-0.6 s readable coil (head down, shoulders back, arms up), then a lunge with both hands reaching and a
  head snap/bite at the contact tick, then a 0.3 s recovery; a light shove/grab when it misses. Different per family: bite-lunge
  (runners), two-handed claw swipe (heavies), shield shove (riot), grab-and-bite from the ground (crawler).
- **Causes (code):**
  1. Sim: `InfectedSystem` resolves the strike on the first tick after `b.until` and immediately sets `state = 'chase'`
     (src/sim/ai/InfectedSystem.ts:681-686 and the L1 brain 1162-1170). There is no post-strike "active/recovery" state for the
     renderer, so `swing` (CrowdView.ts:761, CivilianCrowd.ts:87) is selected for at most one tick.
  2. Both renderers only pick `windup`/`swing` while speed <= 0.06/0.1 m/s; lunges keep moving during the windup
     (InfectedSystem.ts:678, 1155), so a chasing infected keeps its run loop through the whole attack.
  3. CivilianCrowd freezes `windup` at phase 0.5 (CivilianCrowd.ts:423) and caps the lunge layer to 0.04 m at contact
     (CivilianCrowd.ts:440); `swing` phase runs on the idle clock, not on the strike tick (both renderers).
  4. Assets: the only attack clips are the shared courier `windup` (4 tracks: torso, armL, foreArmL, armR) and `swing`
     (3 tracks: torso, armR, foreArmR; 0.52 s) in src/render/characters/library.json. No head/jaw, no legs, no bite.
- **Fix scope:** wiring + new clips. (a) Publish a strike window from the sim (`b.strikeAt`/`b.recoverUntil`, render-only, no
  gameplay change) and drive `swing` phase from it; (b) allow the attack clips while moving as an upper-body layer over the gait;
  (c) author 3 infected attack clips (bite-lunge, two-hand swipe, ground grab) with full-body tracks in the clip library and bake
  them into the crowd atlas (`infectedClips` order in crowdClipNames.ts); (d) unfreeze the civ-path windup. One shared fix covers
  every humanoid type in both renderers.

### P1-B. Gun hits produce no body reaction (all types)
- **Seen:** the army-MG burst at 420 leaves the clip and pose unchanged on every type (suit `strip-hits.jpg` cells 5-12: blood
  puff + decal only); 3 s of continuous MG on Alphas, the butcher role, lion, gorilla, elephant and monkey shows 300 frames of
  `infected-idle` (`r31-role-butcher/strip-death.jpg`). Bat hits give a barely visible lean.
- **Good looks like:** every bullet: a 0.15-0.25 s directional flinch (torso + head kick away from the shot, one stumble step at
  higher damage); shotgun/rifle: a real stagger (`stagger-left/right`); sustained fire on tanks: a hunched "pushing through fire"
  walk with periodic flinches; bosses: a squash plus a hit-turn.
- **Causes (code):** every gun has `stagger: 0` (src/data/actions/catalog.ts:10 `gun()`; army-mg line 50; pistol fixture), so
  Damage.ts:236 creates a light reaction lasting `max(1, ceil(0*60))` = **1 tick**, and `InfectedMoves.flinch` caps the flinch to
  that duration (InfectedMoves.ts:29-35): the flinch is visible for one frame. The authored `hurt`, `stagger-left` and
  `stagger-right` clips are in the atlas but never selected for infected (CrowdView.ts:757-781 never assigns them; the phase code at
  786 handles them, so this is dead wiring). Alphas/Mega/bosses skip heavy reactions by design and get nothing in their place.
- **Fix scope:** data/state wiring only (no new clips needed for a first pass): give the renderer its own visual reaction window
  independent of gameplay stagger (e.g. `reaction.visualUntil = tick + 15` for bullets, still `staggerUntil` 0 so balance is
  unchanged), raise the flinch amplitude, and select `stagger-left/right` by hit side for shotgun/rifle/kick-class hits and on
  every Nth bullet. Add a "tank under fire" lean for Alphas/heavies. Keep the r26 boss squash.

### P1-C. Heavy roles have no body of their own (brute, armored, butcher, screamer, bloated)
- **Seen:** in isolation all five roles draw the suit office worker (`inf.common-worker`) - trace `appearance.model` and the
  strips agree. Census: L4 spawns 12 brutes, 10 armored, 10 butchers (vs 5 actual suit runners); L9 25 brutes, 27 screamers,
  17 armored; L10 11 armored. A 1,350 HP butcher looks and moves exactly like a 60 HP runner and stands still under fire.
  **The "suited office-worker" in the PO's L4 screenshot that "doesn't really react" is very likely one of these roles.**
- **Good looks like:** each heavy role has its own skinned silhouette (bigger frame, armour, apron, bloated belly), a heavier
  gait and its own attack (two-hand slam, shoulder charge, belly explode telegraph).
- **Cause:** their manifest assets (`inf.brute`, `inf.armored-football`, `inf.butcher`, `inf.screamer`, `inf.bloated`,
  `inf.sprinter`) are retired rigid figures without `crowdSkin` and without `public/assets/models/skinned/*` files; the crowd falls
  back to the runner batch. (Scene Lab refuses these roles unless `allowRigid: true`, added for this audit.)
- **Fix scope:** asset work (rig + skin 5 bodies on the crowd skeleton, or map each role to an existing skinned heavy look such as
  the Alpha siblings scaled down) plus a render-identity check in the level census. Verify the in-level drawn identity first with
  the L4 crowd probe (one capture) - Scene Lab shows the fallback, the level path uses the same `modelKey` fallback.

### P1-D. Big animals stop inside the courier; lion/zebra/monkey attacks are static poses
- **Seen:** zebra arrives and stands with the courier inside its body for the whole attack window
  (`r31-zebra/strip-run.jpg` rows 5-7); lion after the pounce stands in `corgi-idle` overlapping her (`r31-lion/strip-pounce.jpg`
  rows 4-8); monkey "cling" is a frozen idle pose glued onto her for 10 s (`r31-monkey/strip-a.jpg`). Scene Lab's
  `bodies`/`attackOverlap` probes report 0 because they only test humanoid capsules.
- **Good looks like:** quadrupeds stop at muzzle distance and strike (lion swipe/pin with a jaw open-close, zebra rear-kick turn,
  monkey clinging loop with arm grabs).
- **Causes:** (1) contact distance uses `combat.radius` (zebra 0.45 m, lion 0.6 m) from the body centre, although these bodies are
  2+ m long; (2) the crowd bake maps `windup`, `swing`, `zebra-*` (unless embedded), `hurt`, `stagger-*` on every animal rig to
  `corgi-idle`/`corgi-trot` (src/render/characters/bakeInfected.ts:141). Only the dog (dog-lunge-bite, dog-gallop) and zebra
  (zebra-rear-kick/stampede, special only) have authored attack clips; lion, lioness, elephant, flamingo, gorilla and monkey GLBs
  embed none.
- **Fix scope:** sim data (per-species contact/stop distance from the authored body length) + new animal clips (lion swipe/pin,
  lion/lioness hit-flinch, elephant trunk swipe and stomp, flamingo peck/dive, monkey cling loop, gorilla roar/pound/throw) +
  extend the Scene Lab body-overlap probe to animal rigs.

### P2-A. Crawler never animates an attack or a hit
- `clip = 'crawl'` wins over every state for the crawler (CrowdView.ts:759-760): attacks and MG hits show the same crawl loop in
  place (`r31-crawler`: crawl 18-534, then death-side). Fix: crawler-specific grab/bite-from-ground clip and a prone flinch;
  select them before the crawl fallback. Wiring + 2 clips.

### P2-B. Arrival skating and gliding lunges
- Foot slide p95 (Scene Lab contact metric, >3 cm reads as skating): nurse 12.8 cm, Mega 18.4 cm, lion 14.8 cm, jogger/sprinter
  4.4 cm, bbq-dad 3.9 cm; dog 93 cm and zebra 163 cm (the dog glides ~2 m holding the lunge pose; the zebra slides into the
  courier). Humans skate when braking from a run into the standing windup (`r31-nurse/strip-run.jpg`, the last 4 cells before the
  ring). Good: a 2-3 step deceleration (or plant-and-slide clip) and a lunge whose travel is in the clip root, not the transform.
  Cause: `infected-sprint` -> `infected-idle` switch at the 0.06/0.1 m/s gate with no stop clip; dog pounce travels on the sim
  transform while `dog-lunge-bite` phase is fixed. Scope: wiring (deceleration blend, phase from travel distance) + one stop clip.

### P2-C. Infected stand idle for seconds after getting up (all humanoids, lion, zebra)
- After the heavy kick's get-up (frame 680) every humanoid stays in `infected-idle` for 120-400 frames while being shot, facing
  away (`r31-riot/strip-after.jpg` rows 4-8). Reads as harmless. May be the fixture's script state (`chase` given once at 120);
  confirm in a level with the L4 threat audit before fixing. Scope: brain state after `recover`/heavy reaction -> re-acquire.

### P2-D. Alpha specials: good markers, little body
- Alpha brute slam (`r31-alpha-brute/strip-slam.jpg`): 4 m ring + slow arm raise, arms come down on recovery - readable. Charge:
  chevron lane is clear, body only leans. Roar, shield bash, pounce and grab-throw all reuse the generic `windup` clip plus small
  procedural layers. The thrower and leaper never triggered a special alone (needs props / a second infected / range); their
  ordinary attack is the P1-A windup-to-idle. Good: one authored telegraph + action clip per move as listed in
  docs/design/boss-and-alpha-moves.md (0.5-1 s windup pose). Scope: new clips (6-8 Alpha moves) + per-move clip mapping.

### P3-A. Look issues seen on the way
- Elephant wounds read as flat red oval stickers at close range (`r31-elephant/strip-swipe.jpg`).
- Riot shield and lion/zebra bodies visually pass through the courier at contact (see P1-D).
- Scene Lab cannot isolate the national-guard or other named-npc infected looks (its L1 dressing replaces them with
  npc.civilian-*); add a `keepLook` fixture flag.

### Game camera (zoom 1.5, low tier) - what the player sees
- Done for suit, civ, riot, crawler, butcher role, Alpha brute, Mega, dog, lion, gorilla, elephant (`scenes-game-low/`; the
  high-tier and remaining low runs were stopped at the time box). Scene Lab's zoom 1.5 is a 28.5 m radius: figures are ~60 px tall.
  At that scale the suit worker's windup and the MG hits are indistinguishable from idle (`r31-suit-l4-game-low/shot-0190.png`
  vs `shot-0435.png`: only the health bar changes) - the P1-A/P1-B fixes need exaggerated, whole-body motion to read in play.
  The gorilla also ends its pound standing inside the courier (`r31-gorilla-game-low/shot-0435.png`), same cause as P1-D.

## Tooling notes for the follow-up lanes
- The Scene Lab browser-pool context closes if the CLI blocks for > ~60 s: the in-process VP8 encode of an 18 s video at high load
  did that ("Target page, context or browser has been closed" before metrics). Workaround used here: `FFMPEG_BIN` pointing at a
  script that stores the raw MJPEG stream (`video.webm.mjpeg`); `timeline.py` reads it. The same happens with `--sheet`.
- Keep batches to 3 specs with 18 s video (~2 min each) to stay under the 595 s reservation cap.
- `allowRigid: true` on an infected actor (src/debug/scenelab/spec.ts) admits the retired rigid role archetypes for audits.

## Browser QA needed after fixes
- Re-run `specs/scenes/r31-zombie-audit/*.json` with `--video 18` and compare against this table; gate: `swing`/attack clip
  frames > 0 in the 120-420 window for every humanoid, a reaction clip or flinch within 2 frames of every bullet hit, and slide p95
  < 3 cm. Game camera zoom 1.5, low and high: `game/*.json`.
