# Combat feel research: Diablo-style ARPGs and top-down brawlers

Date: 2026-10-07. Prepared for the PO request "Fight system needs improvements. Do research about Diablo. I think when an attack is made then this click must not move the figure. I want more movements, cooler fight scenes etc. Do research about best practices." The concrete plan is in [`combat-proposal.md`](combat-proposal.md).

How to read the sources:
- **Fetched**: the page was read.
- **Snippet**: only a search-result summary was available, because the page blocked automated reading (Fandom, diablowiki, Prima).
- **Memory, unverified**: no source was found. These points are common genre knowledge and are labelled so nobody quotes them as fact.

"Today" sections describe the code on `main` at `f4050eb6`.

---

## 1. Click-to-attack vs click-to-move

### What the best games do

- **Diablo II: the press decides the mode.**
  - LMB on a monster walks into range and attacks. LMB on the ground walks.
  - The official manual says: "When you want to attack without closing in on your target, hold down the Shift key." ([D2 LoD controls](https://classic.battle.net/diablo2exp/basics/controls.shtml), fetched)
  - Alt shows ground items as colour-coded clickable labels. They form a click layer above the ground (same source).
- **Sticky targeting (D2R).** A skill "will continue to target the selected monster even with the mouse moved off the target, so long as the button is not released." When a toggle broke this, melee players called the bug severe. ([Blizzard forum](https://us.forums.blizzard.com/en/d2r/t/show-items-breaks-sticky-targeting/175338), fetched)
- **When the held target dies (D2/D3):** "the game acts like you release the button and immediately clicked it again." Holding the button therefore re-targets whatever is under the cursor.
  - PoE1 instead falls back to "holding on the ground", which walks the character on. Players find this tiring. ([PoE forum](https://www.pathofexile.com/forum/view-thread/1118912), fetched)
- **Diablo III**
  - Holding the button on a monster attacks repeatedly.
  - Shift plus held button makes the hero stand and attack toward the cursor.
  - A "Force Move" command exists but is unbound by default ([D3 fundamentals](https://eu.diablo3.com/en/game/guide/gameplay/fundamentals), snippet).
  - Elective Mode bars some skills from LMB "since that controls movement as well" ([diablowiki](https://di.diablowiki.net/EM), snippet). LMB is treated as primarily a movement button.
- **Diablo IV**
  - "Combine Move/Interact/Basic Skill Slot" is on by default, so one LMB moves, interacts and attacks.
  - Force Move is a separate bind. Shift+LMB attacks in place ([Prima](https://primagames.com/tips/how-to-attack-without-a-target-in-diablo-4), snippet).
  - Players asked for force-move and interact *without* the basic attack, so accidental attacks are a known pain ([forum](https://us.forums.blizzard.com/en/d4/t/allow-force-move-interact-without-basic-attack/2550), fetched).
- **Path of Exile 1/2**
  - "Attack in Place" defaults to Shift. An option makes it also stop movement.
  - PoE1 has an "Always Attack Without Moving" option ([Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-poe2-attack-in-place-skill), snippet).
  - **Namelocking**: targeted skills snap to monsters near the cursor. Players complain that "the game frequently assumes it knows better than the direct input" around big monsters ([PoE forum](https://www.pathofexile.com/forum/view-thread/3615433), fetched). Magnetism needs an override and must not steal deliberate ground clicks.
- **Last Epoch** keeps LMB on Move/Interact even with WASD, and players asked for an "attack only" LMB ([Icy Veins](https://www.icy-veins.com/last-epoch/news/eleventh-hour-games-responds-to-wasd-feedback-in-last-epoch/), [forum](https://forum.lastepoch.com/t/left-click-attack/16346), snippets). **Torchlight** uses the D2 scheme (memory, unverified).
- **Highlight and click priority** (memory, unverified, but visible in every title):
  - The hovered monster gets a red outline or a name plate with HP.
  - Priority runs UI → hovered monster → item labels → interactables → ground.
  - The pick volume is larger than the mesh, so the hover tolerance is generous.

**Pattern:** the mouse press decides between "fight" and "go".
- A press that hits a monster never walks you past it.
- A held press keeps its first meaning.
- A modifier key (Shift) forces "fight here".
- Magnetism helps, but must not override a clear ground click.

### What Minor Incident does today

- **Pick** (`src/input/InputSystem.ts`): a click becomes an `attackTarget` only if it is within **18 px on screen** of the infected's origin, or within **1.5 × its radius (about 0.5 m) on the ground**. Otherwise it is a `moveTarget`.
  - The screen origin is the model's root point, so clicking the head or torso of a 1.7 m figure at the isometric camera often misses.
  - The pick only considers `faction === 'infected'`. Glowing-eyes bodies, which melee can hit and the spec says can be finished, are never click targets, so clicking one walks to it.
- **Move during swings** (`src/sim/entities/ControlIntent.ts`): a ground click sets `moveTarget` immediately, even while a swing is running. The courier keeps steering under the swing and slides into the crowd. Only Shift swings (`attackInPlace`) lock the feet.
- **Target attack:** clicking an out-of-reach infected walks to 85 % of reach and strikes inside 95 %. Holding repeats. The courier auto-follows when the target slides. This matches D2.
- **Shift+LMB** swings in place toward the cursor, always (PO rule), and locks movement for the swing.
- **No hover highlight and no attack cursor:** the player cannot tell before clicking whether a click will attack or walk. This is the root of "the click moved my figure".

---

## 2. Commitment, cancel windows, input buffering

### What the best games do

- **Diablo II** runs logic at 25 fps (40 ms per frame).
  - Attack speed only matters at **breakpoints**, where an animation loses one whole frame ([diablowiki Breakpoint](https://di.diablowiki.net/Breakpoint), snippet).
  - Typical fast melee is about 7–15 frames, 280–600 ms (memory, unverified).
  - Attacks are fully committed; speed comes from gear.
- **PoE2:** the dodge roll can cancel almost any animation, and its start avoids hits ([Sportskeeda](https://sportskeeda.com/mmo/path-exile-2-poe2-dodge-roll-system-iframes), snippet). Players call roll-cancelling melee recovery "effectively mandatory" ([PoE forum](https://de.pathofexile.com/forum/view-thread/3898098)).
- **Hades:** the dash is invincible, but i-frames end as soon as you act. The dash-strike has none ([Steam](https://steamcommunity.com/app/1145360/discussions/0/1736635816361430168), snippet).
- **D3:** movement can interrupt an attack after its damage point, so players move-cancel recovery (memory, unverified).
- **Input buffer windows:**

| Game or source | Window |
| --- | --- |
| General guidance ([bugnet](https://bugnet.io/blog/how-to-implement-input-buffering-for-responsive-controls)) | 50–150 ms |
| Worked example ([Wayline](https://www.wayline.io/blog/art-of-input-buffering)) | 100 ms, warns that longer feels sluggish |
| Brawl ([Smashboards](https://smashboards.com/threads/alaska-friend-codes-in-first-post.30941/page-155)) | 10 frames, about 167 ms |
| KOF XV ([dgmiwiki](https://dgmiwiki.wpi.edu/mechanic/input_buffer)) | 83–133 ms |

- **Game Feel** (Steve Swink): real-time control needs a correction cycle under about 100 ms ([Wikipedia](https://en.wikipedia.org/wiki/Game_feel), [Game Developer](https://www.gamedeveloper.com/design/game-feel-the-secret-ingredient)).

**Pattern:**
- Wind-up and strike are committed.
- Recovery is cancellable, by movement or dodge, and in action games by the next attack after a hit lands.
- A short buffer (100–200 ms) stores the next press so fast clicking never drops an input.

### What Minor Incident does today

- `src/sim/combat/ActionRunner.ts` buffers **one melee press per side for 12 ticks (200 ms)**. This is at the generous end of the band, which suits "fast clicks until dead".
- Combos chain within cooldown + 48 ticks. The unarmed order is fixed and never repeats a move.
- Attacks are never cancelled.
- Movement is not blocked during non-Shift swings, so the body drifts while striking. There is commitment on the attack but none on the feet.
- There is no hit-confirm cancel: a connecting swing and a whiff take the same time.

---

## 3. Aim assist, soft lock, target magnetism

### What the best games do

- **D4 controller:** R3 locks the nearest enemy with a big arrow, and a stick flick moves the lock. "Persist Target Lock" keeps the lock after a kill. One known flaw is that it can lock enemies off-screen ([forum](https://us.forums.blizzard.com/en/d4/t/controller-targeting-system-tips-and-tricks/8826), [Prima](https://primagames.com/tips/how-to-enable-auto-targeting-in-diablo-4)).
- **Hades:** aim assist is on for controller and can be turned off. It picks the nearest enemy in the facing direction and can snap the attack up to about 90°, which some players feel takes control away ([Steam](https://steamcommunity.com/app/1145360/discussions/0/3109143313939812952), snippet). Hades II players prefer mouse aim, and auto-aim sometimes prefers summons over bosses ([Steam](https://steamcommunity.com/app/1145350/discussions/0/4327475903877791642), fetched).
- **PoE namelocking** is mouse magnetism. Its failure mode is overriding deliberate ground clicks (§1).
- **Twin-stick convention** (memory, unverified): a 15–30° cone around the aim, nearest-in-cone wins weighted by angle and distance, plus "friction" near targets.

**Pattern:**
- Magnetism should be a **narrow cone toward the player's intent**, never a radius that grabs whatever is closest.
- Always offer an override.
- Mouse players need much less assist than pad or touch players.

### What Minor Incident does today

- `src/sim/combat/AimAssist.ts` has two paths:
  - **Ranged shots** snap to infected inside a cone: 12° at Default (6° Low, 18° High, Off).
  - **Keyboard and touch taps** pick the nearest visible infected in the facing half-plane.
- Melee with the mouse gets **no** assist. The swing goes where the cursor is, and a near-miss click becomes a walk (§1).
- The settings ladder and the "never mutate the remembered aim" rule are good and should stay.

---

## 4. Hit feedback (hit-stop, shake, flash, knockback, numbers, sound)

### What the best games do

- **Hitlag in Smash** freezes *attacker and victim* ([SmashWiki Hitlag](https://www.ssbwiki.com/Hitlag), fetched).
  - It scales with damage: Melee uses ⌊d/3+3⌋ frames, Ultimate uses d·0.65+6.
  - A 15 % hit freezes 8–15 frames (133–250 ms). The cap is 20–30 frames.
- **Sakurai on hitstop** ([Source Gaming translation](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/), fetched):
  - Both sides freeze to stress the impact.
  - The duration depends on damage and on the attack itself, e.g. a sword tip gets more than the blade.
  - He keeps hitstop low in free-for-alls because a third party can punish frozen fighters. **This is directly relevant to hordes.**
- **Street Fighter** uses about 8–13 frames of hitstop per hit by strength (memory, unverified).
- **Practical presets** ([Uhiyama Lab](https://uhiyama-lab.com/en/notes/unity/unity-game-feel-hit-feedback/), fetched):

| Effect | Weak | Strong | Critical |
| --- | --- | --- | --- |
| Hit stop | 0–30 ms | 50–80 ms | 100–150 ms |
| Shake | 0.1–0.2 | 0.3–0.5 | 0.6–1.0 |

  - A white hit flash lasts 80 ms.
  - The source's principle: "hit effects are not decoration but information".
- **Trauma shake** (Squirrel Eiserloh, "Juicing Your Cameras With Math", GDC 2016; [Game Developer](https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math)).
  - Trauma runs 0–1 and shake = trauma², because a linear ramp does not feel punchy.
  - Perlin noise replaces random jitter.
  - Only the render camera moves.
  - Bevy's reference implementation uses 0.5/s decay, max 10° rotation and max 20 px offset ([Bevy example](https://bevy.org/examples/camera/2d-screen-shake/), fetched).
- **Vlambeer, "The Art of Screenshake"** (Jan Willem Nijman, INDIGO 2013), as recreated in [dkliao's devlog](https://dkliao.itch.io/the-art-of-screenshake-recreation/devlog) (snippet). The checklist:
  - animation
  - lower TTK
  - higher fire rate
  - bigger and faster bullets
  - muzzle flash
  - impact effects
  - hit reaction
  - enemy knockback
  - permanence (corpses and shells stay)
  - camera lerp
  - screenshake
  - player knockback
  - hit pause
  - recoil
- **"Juice it or lose it"** (Martin Jonasson and Petri Purho, GDC Europe 2012): tweening, squash and stretch, particles and sound on a Breakout clone; juice is "maximum output for minimum input" ([Game Developer](https://www.gamedeveloper.com/design/video-is-your-game-juicy-enough-)).
- **D3 VFX** (Julian Love, GDC 2013): effects must carry gameplay information. Colours and blend modes must keep stacked effects from turning into "one large mass of white" ([JangaFX summary](https://jangafx.com/insights/diablo-3-vfx-experiments)).
- **Damage numbers:** Diablo shows them, but Hades and most brawlers lean on flash, knockback and sound instead (memory, unverified).
- **Sound layering** (memory, unverified, common practice):
  - Each hit is a transient click, a body thud and a material sweetener.
  - Windups get a whoosh.
  - Identical sounds are capped in crowds.

**Pattern:**
- Scale every channel (freeze, shake, flash, sound) with hit weight.
- Freeze both parties.
- Keep freezes short when many enemies are on screen.
- Use trauma-squared shake on the render camera only.

### What Minor Incident does today

- **Hit-stop**
  - Authored per move in `src/data/meleeCombos.ts`: 42–67 ms, default 50 ms, matching 00 §6.3 (40–70 ms).
  - `src/render/vfx/HitStop.ts` suppresses it at ≥ 8 hits in 200 ms, a good horde safeguard.
  - `src/render/GameView.ts` freezes **only the courier's render pose**. The victim keeps animating, so half of the Smash/Sakurai effect is missing.
- **Shake** (`src/render/View.ts`) is additive: strength += i·0.4, cap 0.4, decay e^(−8t), and the offset comes from two sines. Melee hits add 0.028, or 0.055 for kicks and hits of 30+.
  - It is not trauma-squared.
  - It has no directional kick.
  - It respects the camera-shake setting.
- **Flash:** a 0.45 per-instance flash for 100 ms (`Vfx.pulse`).
- **Blood:** bursts; dismemberment on heavy-blade or explosive kills; gore settings.
- **Knockback:** capped at 0.4 m and 0.25 s flinch for normal player melee (`Damage.ts`, PO rule).
- **Kicked bodies** bowl over others (stagger 0.9 s).
- **Damage numbers:** none (spec: only crits and specials).
- **Sound** (`src/data/audioCues.ts`): melee hits are already layered (`flesh.*` transient, `impact.body.*`, `impact.thump`) with anti-spam and pitch variation.
  - There is **no windup whoosh per weapon** and **no courier effort voice**.
- **Swing trails:** none.

---

## 5. Enemy hit reactions and stagger

### What the best games do

- **D4** bosses have a stagger bar that fills from crowd-control damage. When full, the boss is under every CC type at once for a short window ([PureDiablo](https://www.purediablo.com/diablo4/Stagger_Meter), fetched). "Unstoppable" removes CC and grants immunity ([Icy Veins](https://www.icy-veins.com/d4/guides/crowd-control-status-effects/)).
- **Diablo III ragdolls** (Erin Catto, GDC 2012, [PDF](https://box2d.org/files/ErinCatto_Ragdolls_GDC2012.pdf), fetched):
  - Ragdolls "make the player feel more powerful".
  - They give "lots of death variation" with less animator work.
  - The demo was titled "Zombie Fest".
- **D3 deaths** start as authored animations and hand off to physics: flung bodies, crits that blow enemies apart, shattering when frozen ([diablowiki Physics](https://di.diablowiki.net/Physics), snippet; [GameBanshee](https://www.gamebanshee.com/q8xf)).
- **Left 4 Dead shove** pushes and stuns commons for about 1–3 s, can knock them down, and does almost no damage ([L4D wiki](https://left4dead.fandom.com/wiki/Melee), snippet).
- **Pattern** (memory, unverified):
  - Light hits get a directional flinch.
  - Heavy hits get a stumble.
  - Killing blows pick a death that matches the attack: direction, weapon, force.
  - Knockback scales with enemy weight.

### What Minor Incident does today

- `Damage.ts` writes `combat.reaction`:
  - 6 rotating reaction indices
  - `heavy` for kills and specials, with 80 ticks of stagger
  - `groundDeath` for downed kills
  - the kicked-body bowling stagger
- Stagger interrupts infected attacks (E05-AC07).
- `CrowdView.ts` plays flinch or heavy-fall clips.
- Gaps:
  - Reactions rotate by index, **not by hit direction**.
  - Deaths do not depend on the killing move.
  - There is no wall-slam reaction.

---

## 6. Crowd combat and space-making

### What the best games do

- **L4D2 melee fatigue:** about 5 shoves in about 2 s tire you, and further shoves slow until you rest; a HUD shows it ([L4D wiki](https://left4dead.fandom.com/wiki/Melee), [KosGames](https://kosgames.com/left-4-dead-2-all-melee-weapons-guide-19689/), snippets). This is the canonical "space-making button" for zombie hordes.
- **Dead Rising:** "Swarm technology" put hundreds of zombies on screen, 7,000+ in DR2. Almost anything is a weapon, weapons break, and DR2 adds combo weapons ([Wikipedia](https://en.wikipedia.org/wiki/Dead_Rising)).
- **Diablo IV** (Joe Shely, [PCGamesN](https://www.pcgamesn.com/diablo-4/combat/), fetched): "make combat feel a little bit more intentional, add a little bit more stakes, and increase the clarity of the battlefield".
  - TTK is the key metric: too slow gives "meat sack" enemies, too fast weakens the power fantasy.
  - Evade and traversal keep players moving.
- **Cleave and whirlwind** (memory, unverified):
  - D2 Whirlwind hits along its path.
  - D3 Cleave hits a frontal arc.
  - Basic melee usually covers 90–120° and hits several targets.
  - Knockback creates space but hurts readability, so it scales with weight.

### What Minor Incident does today

- **Bat** (`meleeCombos.ts`): forehand and backhand (22 damage), plus an overhead finisher (30 damage, 3.3 m knockback, knockdown). The catalog arc is 100° with up to 3 targets.
- **The PO's bat roundhouse is not implemented yet:** ≥ 3 infected within reach should give a 360° swing (00 §6.2, 2026-10-07). There is no `roundhouse` beyond the unarmed kick in `src/`.
- **The L2 axe roundhouse** is specified (E06, E20 §5.3) but not built.
- **Unarmed:** the roundhouse kick and spinning backfist hit 2 targets.
- There is no shove and no dodge.
- The design intent "1–2 beatable, 4+ kill a standing player" (E19 §5.6) is right for the zombie fantasy. But with infected faster than the courier (4.7–5.6 vs 4.5 m/s), space-making tools are the missing half.

---

## 7. Animation variety: combos, directional attacks, finishers, evades

### What the best games do

- **Combo strings** (memory, unverified):
  - Most action games use a 3–4 hit chain whose last hit is slower and stronger, with more hitstop and knockback.
  - A pause of about 0.4–0.8 s resets the chain.
  - Context (distance, target state, enemies behind) picks alternate moves.
- **Doom Eternal glory kills:** a damaged enemy staggers with a blue flash, and up close the highlight turns orange. A melee press executes instantly and drops more health, a deliberate resource loop ([Wikipedia](https://en.wikipedia.org/wiki/Doom_Eternal), [Shacknews](https://shacknews.com/article/117039/how-to-do-glory-kills-doom-eternal), snippets). These are synced paired animations that stop the fight briefly. That works with a handful of demons but not with a horde.
- **D4 Evade:** Space on PC, available to every class, 5 s cooldown "preventing players from spamming" ([Fextralife](https://diablo4.wiki.fextralife.com/Evade), fetched).
- **Hades dash:** fully invincible, passes through enemies, chains into a dash-strike ([PC Gamer](https://www.pcgamer.com/hades-review)).
- **PoE2** is "designed around the dodge-roll" ([Sportskeeda](https://sportskeeda.com/mmo/path-exile-2-more-difficult-than-first-game)).
- **Last Epoch** uses traversal skills (Lunge, Shift) instead of a universal dodge (memory, unverified).
- **State of Decay:** stamina, executions on downed zombies (memory, unverified).

### What Minor Incident does today

- **Unarmed:** the PO's 7 moves (jab, cross, front kick, roundhouse kick, uppercut, knee, spinning backfist), never repeated. Timings run 50–133 ms windup and 50–83 ms active (`meleeCombos.ts`).
- **Bat:** a 3-beat chain with an overhead knockdown finisher.
- **Other melee** (crowbar, machete) use generic 3-beat timing.
- **Animation** (`src/render/characters/KeyframeAnimator.ts`) is presentation only:
  - contact is warped to the sim's active tick
  - the render lunge is 0.10–0.25 m
  - feet are planted for strikes, except kicks, the knee and the spinning backfist (Fable footwork report)
- **Missing:**
  - context moves: too close, behind, downed, crowd
  - finishers on downed or glowing bodies
  - a dodge or evade
  - gun-specific moves: pistol whip, MG sweep

---

## 8. Camera and readability in fights

### What the best games do

- **Eiserloh** covers lerped follow and framing as well as shake ([Game Developer](https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math)).
- **D4** removed D3-style monster glow for a grounded look, but keeps "clarity of the battlefield" as a goal ([PCGamesN](https://www.pcgamesn.com/diablo-4/combat/)). Quarterly updates describe frame-precise animation and VFX as what makes combat visceral ([GameBanshee](https://gamebanshee.com/ar4pw), snippet). No official hit-pause values are published.
- **Supergiant's Hades GDC talk** ("Breathing Life into Greek Myth", [GDC Vault](https://gdcvault.com/play/1026975/Breathing-Life-into-Greek-Myth)) is about narrative. No Supergiant combat-feel GDC talk was found.
- **Common practice** (memory, unverified):
  - slight zoom-out as the nearby enemy count grows
  - small directional camera kicks on heavy hits, rather than random shake
  - capped additive FX
  - distinct silhouettes and coloured ground telegraphs
  - outline or tint for elites and for the hovered target
  - capped duplicate sounds in crowds

### What Minor Incident does today

- **Camera:** fixed isometric. Wheel zoom is 0.85–1.35× (M1-05). Blasts add roll. There is no crowd-dependent framing.
- **Telegraphs:** cyan for lunges (a colour-blind option exists).
- **Blood coverage** builds up over a fight.
- **Readability gaps:**
  - no hover or target indicator
  - no "will this click attack or walk" cue
  - when 10+ infected are near, it is hard to see which one the courier is hitting

---

## 9. Summary: what to adopt

1. **Make the press decide.** A press on, or in a narrow cone toward, an infected in reach attacks in place. Only empty ground or an out-of-reach target moves. Shift forces in place. Holding keeps the first meaning. A held target's death re-targets only under the cursor. (D2/D3/D4, PoE lessons; §1)
2. **Show it before the click.** Add a hover highlight, a target ring that shows "in reach / will approach", and an attack cursor. (Genre standard; §1, §8)
3. **Commit the feet, not the player.** Feet are planted during windup and active frames, recovery can be cancelled by movement or evade, and a connecting hit gets an early combo cancel. Keep the 200 ms buffer. (§2)
4. **Scale feedback with weight, and freeze both parties briefly.** Use trauma-squared shake, swing trails, whooshes and effort voices; keep freezes short in crowds. (Smash, Sakurai, Eiserloh, Vlambeer; §4)
5. **Give the horde answers.** Build the roundhouse the PO asked for, an L4D-style shove with a lockout, and a short evade. (§6, §7)
6. **Vary by context, not by input complexity.** Downed → ground strike, close → elbow or knob jab, behind → turning backhand, crowd → roundhouse or shove, all from the same click. Doom-style paired glory kills do not fit a horde. (§7)
