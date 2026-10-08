# Combat proposal: clicks that fight, moves that read

Status: proposal for PO review (2026-10-07). No game code was changed. Research and citations: [`combat-feel.md`](combat-feel.md).

PO request (verbatim): "Fight system needs improvements. Do research about Diablo. I think when an attack is made then this click must not move the figure. I want more movements, cooler fight scenes etc. Do research about best practices."

## Rules this proposal keeps

- **Diablo-style mouse** (00 §5.3, PO 2026-10-06): LMB ground = walk; LMB infected = attack (approach if needed); hold LMB on an infected = keep attacking; Shift+LMB = swing in place, always; RMB cycles weapons; wheel zooms; middle-click interacts.
- **Fast clicks until dead** (00 §6.2): normal hits knock back ≤ 0.4 m and flinch ≤ 0.25 s, the next click always connects, knockdowns only on the kill, heavy finishers and specials; the courier auto-follows a target that slid slightly out of reach.
- **Bat roundhouse** (00 §6.2) and the **axe roundhouse** (E06, E20 §5.3): ≥ 3 infected within reach turns the same click into a 360° space-making swing.
- **Fight a few, flee from many** (E19 §5.6): 1–2 infected are beatable unarmed; 4+ kill a player who stands. Infected run 4.7–5.6 m/s, the courier 4.5 m/s, so the escape tools matter as much as the strikes.
- **Unarmed 7-move style** (00 §5.3, E03-AC20): equal damage, never the same move twice in a row, occasional flashier finisher.
- **Deterministic sim, presentation-only animation** (02): every rule below that changes outcomes lives in `src/sim` and is driven by `InputFrame` data; everything that only changes looks (highlight, trails, shake, hit-stop, death poses) lives in `src/render` / `src/audio` and never feeds back into the sim.
- **Budgets** (E18): sim p95 ≤ 4 ms at 200 infected, ≤ 600 draw calls, gibs/debris caps. No new post-processing pass.

## Priorities at a glance

| # | Item | Prio | Size | Where |
| --- | --- | --- | --- | --- |
| 1 | Click resolution: attack in place when the click is on or near an infected in reach; move only on empty ground or out-of-reach targets | P1 | M | `InputSystem`, `ControlIntent` |
| 2 | Feet planted during wind-up and strike (no sliding swings); move clicks queue to the cancel point | P1 | S | `ControlIntent`, `ActionRunner` |
| 3 | Hover and target highlight (rim tint + ground ring + attack cursor), sticky hover | P1 | M | `InputSystem` (pick), `CrowdView`, cursor CSS |
| 4 | Input buffer and cancel windows formalised (attack buffer 200 ms, move buffer, hit-confirm combo cancel) | P1 | S | `ActionRunner` |
| 5 | Bat/axe roundhouse implemented as specified, with per-target hit-stop and a shove | P1 | M | `meleeCombos`, `Combat`, `Damage`, render |
| 6 | Hit feedback pass: tiered hit-stop, trauma shake with directional kick, swing trails, layered SFX | P1 | M | `Vfx`, `HitStop`, `View`, audio cues |
| 7 | Contextual moves: too-close shove/elbow, behind-you backhand, downed-target ground strike, glowing-eyes finish | P2 | M | `meleeCombos`, `ControlIntent` |
| 8 | Evade step (short dash with brief bite immunity, cooldown) | P2 | M | sim (`Player`, `KinematicController`), bindings |
| 9 | Enemy reaction matrix (directional flinch, weighted knockdowns, kill-move-specific deaths) | P2 | M | `Damage` reaction data, `CrowdView` |
| 10 | Pistol and machine-gun move sets (double tap, point-blank bash, sweep, stock shove) | P2 | M | catalog, `ActionRunner`, render |
| 11 | Crowd camera (ease out within the zoom range when many infected are near), last-kill beat | P3 | S | `View` |
| 12 | Optional extras: Force-move key, damage-number toggle, kill-streak bark | P3 | S | bindings, UI |

P1 is one lane (input + feel) and fixes the PO's complaint directly. P2 adds the "more movements, cooler fight scenes". P3 is polish.

---

## 1. Click rules (P1)

### 1.1 Today (code)

`InputSystem.sample()` picks an infected only if the click is within **18 px on screen** of its origin or within **1.5 × its radius (~0.5 m) on the ground**. Everything else becomes a `moveTarget`. `ControlIntent` then walks there, even while a swing is running (only `attackInPlace` swings lock the feet). So a click that lands on an infected's head, arm or shadow, or slightly beside a lunging infected, walks the courier into it: exactly the PO's complaint. Glowing-eyes bodies (hittable by melee in `HitQuery.melee`) are never click targets, so clicking one to finish it also walks.

### 1.2 Proposed resolution order for a plain LMB press (no Shift)

Evaluated once, on mouse-down, in this order. `R` is the current weapon's reach (`def.range`: fists 1.45 m, bat 1.9 m, axe 2.1 m, pistol 22 m, machine gun 25 m). "Attackable" = live, visible infected, plus glowing-eyes bodies and downed infected (ground hits).

| Step | Condition | Result | Moves? |
| --- | --- | --- | --- |
| A | Cursor **hovers** an attackable (see 1.3) | That entity is the target | — |
| B | No hover, and an attackable is **within `R + 0.3 m` of the courier** and **within 35° of the click direction** and the click point is **within `R + 2.0 m` of the courier** | Nearest such entity is the target (melee "magnet") | — |
| C | Target found and its distance ≤ `R + 0.3 m` | **Attack in place**: turn to it, swing; no `moveTarget` is created | **No** |
| D | Target found and it is farther | Approach to 85 % of `R`, then attack (today's behaviour) | Yes, toward the target only |
| E | No target | Ground click: walk there | Yes |

Consequences:

- A click on or near an infected that is already within reach **never moves the figure**. That is the PO rule.
- Clicking **away** from nearby infected (more than 35° off) is still a move, so fleeing is never blocked by the magnet. This is the important guard: the magnet is a cone toward the cursor, not a radius around the courier.
- Ranged weapons get the same rule with their long `R`: clicking an infected within 22 m shoots from where the courier stands. Only out-of-range targets approach.
- Step B uses the same visibility test as `AimAssist` (line of sight via `HitQuery.visible`).

### 1.3 Hover (pick) tolerance

- Pick against a **screen-space capsule** from the infected's feet to its head (project two points, distance to segment), radius **24 px at default zoom**, scaled by zoom (D2/D3 use the whole body as the click target; see research §1).
- **Sticky hover**: the currently hovered entity keeps the hover until the cursor is 1.5× the radius away from it (hysteresis), so a crowd does not make the highlight flicker.
- Tie-break: smallest screen distance, then the one closer to the courier, then the lower entity id (determinism for recordings).
- Pick runs per render frame on the cursor's ground point through the spatial hash (a 3 m query), not over all entities. Cost: tens of projections per frame.

### 1.4 Hold, Shift and the other modifiers

| Input | Behaviour |
| --- | --- |
| LMB press on target, hold | Attack that target repeatedly (sticky target, as today). The cursor may wander. Auto-follow if it slides ≤ 0.6 m out of reach; if it gets farther than `R + 1.5 m` (it was knocked back or ran), stop following and wait (no chase across the map). When the target dies while LMB is still held: if the cursor now hovers another attackable within reach, continue on it (D2/D3 "release and re-click" behaviour); otherwise stop and stand (never walk into the crowd, the PoE complaint inverted). Releasing finishes the current swing plus any buffered click. |
| LMB press on ground, hold | Walk toward the cursor (as today). Passing over infected does **not** start attacks (D2/D3 behaviour: the press decides the mode). |
| LMB press on ground, then hover an infected in reach while still held | Still walking. To fight, click. (Keeps fleeing predictable.) |
| Shift + LMB | Swing in place toward the cursor, always, even with nothing there (PO). Feet locked for the whole swing. |
| Shift + hold LMB | Repeated in-place swings, each one aimed at the cursor at its start. With a gun: stand and fire toward the cursor (the D3/PoE "stand still" behaviour). |
| Alt + click | Walk instead of run (unchanged). |
| WASD (mouse+keyboard) | Moves; cancels pending click commands (unchanged). During wind-up/active it is ignored for position (feet planted), during recovery it cancels the swing (see §2). |
| RMB | Cycles weapons (unchanged). |
| Optional, P3: **Force move** key (unbound by default; D4 has one) | Click always walks, ignoring targets. For players who want to run through a crowd. |

### 1.5 Tests

| Test | Kind |
| --- | --- |
| Courier with bat, infected at 1.6 m: injected clicks at the infected's head, at 0.4 m beside it and 25° off its direction each start a swing at it and move the courier < 2 cm over the whole swing | sim (`tests/sim/combat/click-rules.test.ts`, injected `InputFrame` + a pick stub) |
| Same setup, click 90° away from the infected 3 m out: courier walks, no swing | sim |
| Infected at 6 m, click on it: approach, then swing (today's AC15 stays green) | sim + e2e |
| Pistol, infected at 15 m: click → shot, courier displacement 0 | sim |
| Real Playwright mouse: click on an infected's head pixel (projected from the snapshot) in `combat-arena`, assert `combat.attack` and player displacement < 2 cm | e2e (`input-mouse.spec.ts`) |
| Hover flicker: sweep the cursor across a 10-infected crowd, hover id changes ≤ the number of distinct bodies crossed | e2e |
| Glowing-eyes body: click on it with the bat finishes it (`civilian.finished`) without walking when in reach | sim |

Spec impact: E03-AC15 gains "an attack click on or near an infected within reach never moves the survivor"; a new E03 criterion for hover highlight. Proposed wording is in §9.

---

## 2. Commitment, cancel windows and the input buffer (P1)

### 2.1 Today

`ActionRunner` buffers one melee press per side for 12 ticks (200 ms) and chains combos within cooldown + 48 ticks. A running swing is never cancelled, but the courier keeps moving under it (any new ground click or WASD steers the body mid-swing), which reads as sliding and lets the courier drift into a crowd while swinging.

### 2.2 Proposed phase rules

Times in ms at 60 Hz (1 tick = 16.7 ms).

| Phase | Movement input (click/WASD) | New attack click | Evade (§6) | Being hit |
| --- | --- | --- | --- | --- |
| Wind-up | Feet planted; a ground click is stored as the **pending move** | Buffered (200 ms) | Cancels the swing (evade-cancel) | Swing continues (no stagger on the courier in L1; the 0.6 s i-frames already exist) |
| Active (the strike frames) | Planted; pending move stored | Buffered | Not allowed (committed) | Continues |
| Recovery, first 50 ms (hit-confirm) | Planted | **Combo cancel**: if the swing connected, the next buffered attack starts now | Allowed | — |
| Recovery, rest | **Move cancels recovery**: the pending move (or WASD) starts immediately | Starts at the end of recovery, or now if the swing connected | Allowed | — |

- The pending move is "latest wins": one slot, overwritten by each new ground click, cleared by a target click.
- Hit-confirm cancel shortens a connecting bat forehand from 333 ms to about 233 ms between strikes; whiffs keep the full recovery. This rewards accurate fast clicking (the core loop) and punishes swinging at air, which is how PoE and Hades make speed feel earned (research §2).
- Unchanged: the 200 ms attack buffer (it sits in the 100–200 ms band that fighting and action games use; research §2).

### 2.3 Tests

| Test | Kind |
| --- | --- |
| Ground click during wind-up: player displacement during wind-up + active < 1 cm; movement starts within 1 tick of `recoveryAt + 3` | sim |
| WASD during recovery cancels it: `survivor.attack` cleared, next tick's velocity > 0 | sim |
| Connected forehand + buffered click: next `combat.attack` tick = `recoveryAt + 3` (± 1); whiffed: `endsAt` | sim |
| `fast-clicks.test.ts` still green (every click connects, never waits for a stand-up) | sim |
| Recorder round trip with pending moves | sim (E03-AC10) |

---

## 3. Target highlighting and readability (P1)

| Element | Look | Implementation and budget |
| --- | --- | --- |
| **Hover** | Warm off-white rim tint on the infected (not a full outline) + a thin ground ring under its feet | Reuse the packed per-instance flash channel in `CrowdView` (already in the vec4 attribute; no new attribute, no outline pass). Ring = the existing ground-marker mesh, one instance. |
| **Locked target** (held LMB or the current swing's target) | Ring turns red and tightens; rim stays | Same ring mesh, colour swap |
| **In reach** | Ring is solid when the target is within `R + 0.3 m` (click will not move), dashed when out of reach (click will approach) | Uniform on the ring material. This makes the new click rule readable. |
| **Cursor** | Default arrow on ground, a fist/bat/crosshair glyph when hovering an attackable (the D2 sword cursor) | CSS `cursor` on the canvas; 4 small SVG/PNG cursors in the UI atlas |
| **Threat** | Infected in attack wind-up toward the courier: brief cyan telegraph (exists) | Unchanged; keep colours distinct from the hover rim |
| **Colourblind / flash reduction** | Ring in white, rim off when flash reduction is on | Existing `VfxSettings` flags |

Tests: e2e asserts `__SS__` exposes `hoverId`/`lockId` and that the ring instance is visible at the infected's position; a vision check (screenshot of a 10-infected crowd with one hovered, judged by the vision reviewer) confirms the hovered one is identifiable at the default zoom; perf counters unchanged (E18-AC01: draw calls +1 at most).

---

## 4. Move sets per weapon class

Conventions: windup / active / recovery in **ms** (sim ticks in brackets, 60 Hz). Damage keeps the current balance (unarmed 9, bat 22/30, axe 45/25, pistol 2 hits per 40 HP, machine gun 10/s); knockback in m, flinch in s. "New" moves are marked. Normal beats obey fast clicks until dead (knockback ≤ 0.4 m, flinch ≤ 0.25 s); only rows marked **KD** knock down.

Move selection stays deterministic: the chain index from `ActionRunner` plus **context rules evaluated in the sim at attack start**, in this priority:

1. Target is downed or glowing-eyes → ground strike / finish.
2. ≥ 3 attackables within the weapon's crowd radius → roundhouse (bat, axe) or crowd move (unarmed shove, MG sweep).
3. Target closer than 0.7 m (too close for the weapon) → close-quarters move (elbow, knob jab, pistol whip, stock shove).
4. Target behind the courier (> 120° from facing) → turning backhand (no full turn first).
5. Otherwise the next beat of the chain.

### 4.1 Unarmed (7 PO moves kept, 3 contextual added)

| Move | Windup | Active | Recovery | Range / arc | Knockback / flinch | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 50 (3) | 50 (3) | 167 (10) | 1.45 / 80° | 0.15 / 0.15 | chain |
| Cross | 67 (4) | 67 (4) | 167 (10) | 1.45 / 80° | 0.2 / 0.2 | chain |
| Front kick | 100 (6) | 83 (5) | 283 (17) | 1.55 / 60° | 0.3 / 0.2 | chain |
| Roundhouse kick | 117 (7) | 83 (5) | 300 (18) | 1.6 / 110°, 2 targets | 0.3 / 0.2 | chain |
| Uppercut | 100 (6) | 83 (5) | 200 (12) | 1.45 / 80° | 0.25 / 0.25 | chain |
| Knee | 67 (4) | 67 (4) | 167 (10) | 1.45 / 80° | 0.2 / 0.2 | chain |
| Spinning backfist (finisher) | 133 (8) | 83 (5) | 233 (14) | 1.4 / 120°, 2 targets | 0.25 / 0.2 | occasional finisher |
| **New: Elbow** | 50 (3) | 50 (3) | 150 (9) | 0.9 / 90° | 0.35 / 0.2 | context 3 (too close); counts as a chain beat for "no repeat" |
| **New: Shoulder shove** | 83 (5) | 67 (4) | 250 (15) | 1.4 / 360°, 4 targets | 0.8 / 0.35, 0 damage | context 2 (≥ 3 within 1.5 m); space-maker, L4D-style shove (research §6). Max once per 1.5 s so it is not a stun-lock. |
| **New: Stomp** | 83 (5) | 67 (4) | 200 (12) | 1.2 / 90° | 0 / – | context 1 (downed or glowing-eyes); 9 damage, finishes a glowing body |

Tests: E03-AC20 ordering test extended (context moves never repeat back-to-back with the same chain beat); sim: shove moves 3 dummies ≥ 0.6 m apart, never kills, 1.5 s lockout; visual frame review of the three new clips (anticipation, 50–100 ms strike, follow-through, as AC20 requires).

### 4.2 Baseball bat (L1)

| Move | Windup | Active | Recovery | Range / arc | Knockback / flinch | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Forehand | 83 (5) | 67 (4) | 183 (11) | 1.9 / 100° | 0.25 / 0.2 | chain 1, 22 dmg |
| Backhand | 67 (4) | 67 (4) | 167 (10) | 1.9 / 100° | 0.3 / 0.2 | chain 2, 22 dmg |
| Overhead (finisher) | 150 (9) | 83 (5) | 233 (14) | 1.9 / 70° | 3.3 / 0.6 **KD** | chain 3, 30 dmg |
| **New: Roundhouse** | 150 (9) | 100 (6) | 300 (18) | 2.0 / 360°, all in reach | 0.9 shove / 0.35 | context 2 (≥ 3 within reach). 22 dmg each. Per-target hit-stop 25 ms, total capped 100 ms. The PO's "nice roundhouse beat". |
| **New: Knob jab** | 50 (3) | 50 (3) | 150 (9) | 0.8 / 60° | 0.4 / 0.2 | context 3; 11 dmg; pushes the target back into swing range |
| **New: Turning backhand** | 83 (5) | 67 (4) | 200 (12) | 1.9 / 120° behind | 0.3 / 0.2 | context 4; 22 dmg; the courier pivots on the planted foot (Fable footwork) |
| **New: Ground smash** | 117 (7) | 67 (4) | 250 (15) | 1.6 / 70° | 0 | context 1; 30 dmg on a downed infected; finishes glowing bodies |
| **New: Run-in swing** | 100 (6) | 67 (4) | 233 (14) | 1.9 + 0.5 lunge / 100° | 0.3 / 0.2 | when the attack starts after ≥ 0.6 s of running toward the target: a stepping swing that closes the last 0.5 m (sim moves 0.5 m during windup), so approach-then-attack has no stop-start hitch |

### 4.3 Fire axe (L2)

Slower, heavier, one-hit kill on 40 HP with the chop (E06).

| Move | Windup | Active | Recovery | Range / arc | Knockback / flinch | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Diagonal chop | 133 (8) | 83 (5) | 250 (15) | 2.1 / 90° | 0.35 / 0.25 | chain 1, 45 dmg |
| Rising cut | 117 (7) | 83 (5) | 250 (15) | 2.1 / 90° | 0.35 / 0.25 | chain 2, 45 dmg |
| Overhead cleave (finisher) | 200 (12) | 100 (6) | 300 (18) | 2.1 / 60° | 2.5 / 0.8 **KD** | chain 3, 65 dmg, heavy dismember chance (existing `heavyBlade` gore path) |
| Roundhouse | 200 (12) | 117 (7) | 350 (21) | 2.5 / 360° | 2–3 / 0.8 **KD** | context 2 (≥ 3 within 2.5 m), 25 dmg each (E06/E20 rule) |
| **New: Haft shove** | 67 (4) | 67 (4) | 183 (11) | 0.9 / 90° | 0.6 / 0.3 | context 3; 10 dmg; restores chopping distance |
| **New: Turning hook** | 117 (7) | 83 (5) | 250 (15) | 2.1 / 120° behind | 0.35 / 0.25 | context 4 |
| **New: Execution chop** | 167 (10) | 83 (5) | 300 (18) | 1.8 / 60° | 0 | context 1; kills a downed infected outright; render: camera kick + 90 ms hit-stop |
| **New: Wall pin** (presentation of an existing hit) | — | — | — | — | — | if the knockback path ends at a wall within 0.5 m, the reaction becomes "slammed against wall" + 0.2 s extra stagger (sim: knockback already sweeps walls) |

### 4.4 Pistol (L3)

Single target, 2 hits per infected, 22 m, no ammo, fire rate the only limit (E06).

| Move | Windup | Active | Recovery | Notes |
| --- | --- | --- | --- | --- |
| Aimed shot | 0 | 17 (1) | 233 (14) | click on target in range: fires in place (§1.2 C) |
| **New: Double tap** | 0 | 17 (1) | 133 (8) after the 1st, 300 (18) after the 2nd | a second click within 200 ms of the first fires early; average rate stays at today's 4/s so TTK bands hold |
| **New: Point-blank whip** | 50 (3) | 50 (3) | 167 (10) | context 3 (target ≤ 1.0 m): a melee bash, 8 dmg, 0.4 m / 0.25 s, so a gun user is never helpless in contact |
| **New: Turn shot** | 33 (2) | 17 (1) | 233 (14) | context 4: snap turn and shoot (upper-body twist, feet step after; Fable footwork) |
| **New: Finishing shot** | 83 (5) | 17 (1) | 250 (15) | context 1: downward shot on a downed / glowing body |
| **New: Shift-hold sweep** | – | – | – | Shift + hold LMB fires toward the moving cursor at the normal rate without moving |

### 4.5 Machine gun (L4)

10 rounds/s, pierce 1, unlimited (E06).

| Move | Windup | Active | Recovery | Notes |
| --- | --- | --- | --- | --- |
| Sustained fire | 67 (4) spin-up, first shot | 17 per shot | 150 (9) wind-down | hold LMB on a target: fires at it; the barrel tracks it |
| **New: Sweep** | – | – | – | Shift + hold: fires toward the cursor; the muzzle follows the cursor at max 180°/s (presentation and aim both), so a sweep across a crowd is a deliberate motion, not a teleport |
| **New: Walk-and-fire** | – | – | – | holding fire while a pending move exists: walk speed (2.0 m/s), aim stays on the target; the only weapon that fires while moving, which is what makes L4 feel like a war scene |
| **New: Stock shove** | 67 (4) | 67 (4) | 200 (12) | context 3 or 2: 120° frontal shove, 0.8 m / 0.35 s, 10 dmg; the MG's answer to being swarmed |
| **New: Burst tap** | 0 | 3 shots in 250 ms | 150 (9) | a single click (no hold) fires a 3-round burst, so click-click-click reads as controlled bursts |

Ranged tests: TTK table (E05-AC14) regenerated with the new timings and still in band; sim: pistol double tap never exceeds 4 shots in any 1 s window; MG walk-and-fire speed ≤ walk speed; whip/stock shove triggered only within 1.0 m; e2e: Shift-hold sweep turns the courier toward the cursor without displacement.

---

## 5. Finishers and contextual kills (P2)

| Situation | What happens | Sim / render split |
| --- | --- | --- |
| Last hit of a combo kills | Kill-move-specific death (§7) + 80–90 ms hit-stop + small camera kick | sim: normal kill; render: hit-stop tier "finisher" |
| Downed infected (from an overhead / roundhouse / kick) | Ground strike per weapon (stomp, ground smash, execution chop, finishing shot) chosen automatically by context 1 | sim chooses the move; damage as listed |
| Glowing-eyes body (00 §7: can be finished so it never rises) | Same ground strike; click picks the body (fixes today's gap) | sim: `civilian.finished` |
| Grabbed courier (later archetypes with grab) | Each click during a grab is a "break free" shove; 3 clicks break it (today's `grabHits ≥ 3`); render a struggle pose | sim exists; render pose new |
| Knockback into a wall | Wall slam reaction (+0.2 s stagger), dull thud SFX | sim: wall check on the existing knockback sweep |
| Kicked or roundhoused body hits another infected | Already in `Damage` (bowling stagger); give it a render beat: the second infected's stumble clip | render only |
| Last infected of an encounter dies | Optional 150 ms render slow-motion (respects the existing `slowMotion` setting) | render only, never the sim clock |

No synced paired animations (attacker and victim locked together, Doom-style glory kills): they need authored pairs per archetype and stop the action, which the hordes do not allow (research §7). The context strikes above give the same "I did that on purpose" feeling with single-character clips.

Tests: sim scenario per context (downed, glowing, wall within 0.5 m, grab) asserting the chosen move id and outcome; vision review of one capture per finisher.

---

## 6. Evade step (P2, needs a PO decision on the key)

Worth it: the infected are faster than the courier, so "flee from many" currently means taking bites. A short evade gives a skill answer without making fleeing free (research §7: D4 evade, Hades dash).

| Property | Value |
| --- | --- |
| Motion | 3.0 m in 250 ms toward the cursor (mouse) / move direction (keyboard, touch), along the nav grid, stops at walls |
| Bite immunity | first 150 ms (infected attacks resolving in that window miss); grabs cannot start |
| Shoulder-through | infected crossed by the path are pushed aside 0.4 m (no damage, no stagger) |
| Cooldown | 3.0 s (a HUD pip); no stamina system (L1 has none). D4 uses 5 s; shorter here because there are no other escape skills and the infected outrun the courier |
| Cancels | the wind-up of any attack and any recovery (§2) |
| Input | **Space** (D4 default; today Space is a second LEFT-attack key and would move to Evade, J stays attack), touch: a fourth small button or a double-tap on the stick zone, mouse-only: none by default (Space works with one hand on the keyboard) |

Tests: sim: evade distance 3.0 ± 0.1 m in 15 ticks on open ground, ≤ wall distance; an infected attack resolving at tick +5 deals 0; cooldown blocks a second evade for 180 ticks; E19 bot run: survival with evade improves vs. without on the 6-infected scenario (balance sanity, not a pass/fail gate). e2e: Space evades in mouse+keyboard, J still attacks.

---

## 7. Enemy reactions (P2)

Today `Damage` writes `combat.reaction` with 6 rotating indices, `heavy` for kills/specials, a bowling stagger for kicked bodies; `CrowdView` plays a flinch or a heavy fall. All of that stays; the proposal adds data, not systems.

| Reaction | Trigger | Clip / look | Sim effect |
| --- | --- | --- | --- |
| Light flinch L / R / front | normal hit; side from hit direction vs. infected facing | 3 short flinch clips (head snap + step) | flinch ≤ 0.25 s, knockback ≤ 0.4 m (unchanged rule) |
| Stagger back | heavy hit not killing (shove, haft shove, stock shove) | 2–3 step stumble | 0.35–0.8 s, interrupts wind-up (E05-AC07) |
| Knockdown | finisher, roundhouse (axe), kick kills | fall back / spin fall by attack arc | downed, stays hittable (00 §6.2) |
| Wall slam | knockback ends at a wall | slam + slide down | +0.2 s |
| Death by move | overhead → crumple; roundhouse → spin fall; kick → fly back; bullet → drop by hit side; axe execution → limp | death clip id derived from the killing action and direction | none (presentation) |
| Interrupted attacker | stagger during its wind-up | arms flail, telegraph cancels | existing |

The clip choice is a pure function of `(actionId, direction, heavy, wall)` in render, so determinism is untouched. Clip budget: about 8 new crowd clips, baked into the existing crowd pose palette (CPU skinning-free path), so draw calls do not grow.

Tests: unit for the reaction mapping; sim for wall slam; vision review strip "hit from left vs right vs front" at the game camera.

---

## 8. Juice list (VFX / SFX / camera)

All render/audio-side, toggles respect `cameraShake`, `flashReduction`, `slowMotion`, gore settings.

| Item | Spec | Prio | Today |
| --- | --- | --- | --- |
| Hit-stop tiers | light 40 ms, heavy 67 ms, finisher/kill 85 ms, roundhouse 25 ms per target capped at 100 ms; existing suppression (≥ 8 hits in 200 ms) stays so the MG never stutters | P1 | authored per move, default 50 ms |
| Hit-stop scope | freeze **attacker and victim** poses only (Smash freezes both, research §4), the rest of the crowd keeps moving; camera does not freeze | P1 | courier pose only (`GameView` freezes the courier's render pose); the victim keeps animating, so the impact half is missing |
| Trauma shake | replace additive strength with trauma 0..1, shake = trauma², decays ~1.5/s, Perlin-like noise instead of two sines (Eiserloh, research §4) | P1 | additive sine shake, cap 0.4 |
| Directional kick | 2–4 cm camera nudge along the hit direction on heavy hits, 80 ms return | P2 | none |
| Hit flash | keep 0.45 / 100 ms; finisher 0.7 | P1 | exists |
| Swing trails | ribbon on bat/axe tip during the active frames, roundhouse full circle | P1 | none; reuse Bruno `Trails.js` (reuse map) |
| Impact sparks/dust | blunt: dust puff + 3 debris flecks; blade: blood arc in swing direction | P2 | blood burst exists |
| Muzzle | flash + short shell eject per shot, MG barrel heat glow after 2 s of fire (cosmetic) | P2 | muzzle burst exists |
| Courier anticipation | shoulders load during windup; lunge 0.10–0.25 m in render (exists) | — | exists |
| SFX layers per hit | whoosh at windup start (pitch by weapon) + transient + body + low thump (exists) + courier effort grunt on finishers + infected pain vocal | P1 | impacts layered; whoosh and grunt missing |
| SFX roundhouse | one long whoosh + a quick ratchet of impacts (≤ 4, 25 ms apart) | P1 | — |
| Ducking | ambience ducks −3 dB for 150 ms on finisher hits | P3 | — |
| Damage numbers | none (00 §6.3: only crits/specials); optional setting "show damage numbers" off by default | P3 | none |
| Low-HP | red vignette + heartbeat under 30 % | P2 | check HUD |

Tests: unit for trauma math and hit-stop tier mapping; e2e asserts the event → effect wiring via `__SS__` counters (trail spawned on `combat.attack` for melee, shake trauma > 0 after a heavy hit, 0 with shake off); vision review of a 2 s fight capture against a checklist (trail visible, flash visible, target readable).

### 8.1 Camera in fights (P3)

- **Crowd ease-out**: when ≥ 5 infected are within 8 m, ease the zoom toward 1.15× over 0.6 s (inside the 0.85–1.35× range); return when the crowd thins; never fights the player's wheel zoom (the player's choice becomes the floor).
- **No lock-on camera**, no rotation: the isometric angle is the readability contract.
- Test: e2e spawns 8 infected around the courier and asserts zoom ≤ 1.2× and the courier stays within 10 % of screen centre.

---

## 9. Spec changes to propose (for the PO, not applied)

- E03-AC15, add: "An LMB press on or within the hover tolerance of an attackable infected that is within the active weapon's reach + 0.3 m, or a press within 35° of such an infected toward it, attacks in place; the survivor's displacement over that attack is < 2 cm. Clicks more than 35° away from every infected in reach move."
- E03 new: "Hovering an attackable infected highlights it (rim + ground ring), the ring shows whether a click attacks in place or approaches; hover is sticky with hysteresis."
- E05 new: "Feet are planted from attack start to recovery start; a movement command during that time starts at `recoveryAt + 3 ticks`; a connected melee attack can chain the buffered next attack from `recoveryAt + 3 ticks`."
- E05 new: "Context moves (downed / crowd / too close / behind) are chosen in the sim at attack start; the choice is reproduced by a recording."
- E15: hit-stop tiers, trauma shake, swing trails.
- Open question for the PO: Space becomes Evade (D4 parity) and stops being a second attack key.

## 10. Build order and budget

1. **Lane A (P1, ~1 lane-day each step):** click rules + planted feet + cancel windows (sim, with tests) → hover highlight (render) → roundhouse (sim + render) → juice pass (hit-stop tiers, trauma shake, trails, whoosh/grunt).
2. **Lane B (P2):** context moves + clips (unarmed elbow/shove/stomp, bat knob jab/turning backhand/ground smash/run-in, axe set) → enemy reaction clips → evade.
3. **Lane C (P2, with L3/L4):** pistol and machine-gun sets when those levels are built.

Budget check: hover pick is one spatial-hash query per frame; context rules are one `nearby()` query per attack start (already done by `HitQuery.melee`); trails are one ribbon mesh; reaction clips go into the existing crowd pose palette. No new post-processing, no new physics bodies, no new per-entity attributes.
