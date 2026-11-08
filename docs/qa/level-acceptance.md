# Level acceptance criteria (L1–L10)

Manual review decisions live in `docs/qa/reviews/<ROW-ID>.json` with row/status/reviewer/date/commit, exact criterion clause verdicts, and evidence file SHA-256 hashes; the tracker accepts a review only when the criterion text matches and the reviewed game commit is current for that level and shared render paths.

PO 2026-11-01 (verbatim): "So for evey level write down acceptance criterias, so you don't onmly observe but compare to whats' expected. Then do games yourself (scripted and unscripted with Luna) and compare results, fix, repeat until it's all the way it shouikld."

These are **absolute targets, not PROD parity**. A value equal to PROD that misses its target is a FAIL. A PO finding stays open until the PO confirms it. See [lessons-learned 2026-11-01](../process/lessons-learned.md).

**Precedence:** later PO feedback > PO level docs (`specs/po-levels-*.md`) > epic ACs > data defaults. Conflicts are flagged as "**Conflict:**" (one line each). "(tune)" marks an orchestrator value that is not yet calibrated. "Orch." = orchestrator default.

**Check codes**
- **S** = scripted sim/bot (`tools/playtest`, `npm run qa:threat` (being built), level sims, `npm run qa:invariants`).
- **L** = unscripted Luna screenshot play (`tools/playtest/luna-play.sh`): clarity, getting lost, readable route.
- **O** = Opus review of frames (glitches, "is it stunning?", "is anything boring, harmless or babysitting?").
- **P** = only the PO can judge (fun).

**Threat metrics (definitions used in every level; measured by `qa:threat`)**
- *spawned / alive*: infected entities created / alive in the phase, high and low tier.
- *reachable %*: share of alive infected within 30 m of the player that have a nav path to the player not longer than 2.5× the straight line (tune). Infected behind a barrier, wall, fence or platform edge are unreachable.
- *attacks/min*: infected attack windups that target the player (and, in escort levels, separately the group). Measured with two policies: **passive** (stands at the phase anchor, no fire, survival-protected) and **competent** (the `complete` bot or a human-like real-input run).
- *first attack*: seconds from phase start / wave announcement to the first attack windup on the player (passive policy).
- **Hard rule:** any 0 attacks/min in a phase marked *combat* = FAIL, whatever PROD shows.

---

## Global criteria (every level)

| ID | Criterion (expected value) | Source | Check |
|---|---|---|---|
| G-01 | Cold load, real level click → playable (loading card closed / Begin ready): **≤ 6.0 s worst of N**, every level, WebGPU + WebGL2, low + high. | regression-gate §1, P1-107 | S |
| G-02 | Campaign handover (level N complete → level N+1 playable): **≤ 6.0 s** on all nine edges (L8→L9 was 14.38 s, Q-272). | Q-272, orch. | S |
| G-03 | No gameplay frame **> 200 ms** after the card closes, including the first 10 s of movement and first pickup/equip/shot of each weapon (Q-309). | po-checklist Q-126/Q-180, Q-309 | S |
| G-04 | No frame **> 50 ms** at scripted transitions (objective change, blast, breach, power-off, crash, gate close). | E19-AC24, E20-AC20, E21-AC21, E24-AC19 | S |
| G-05 | Frame p95 **≤ 16.7 ms** desktop high, **≤ 33.3 ms** low/phone profile at each level's peak scene; draw calls ≤ 600 / 300, triangles ≤ 1.5 M / 500 k, sim p95 ≤ 4 / 6 ms, heap ≤ 400 / 250 MB, infected ≤ 200 / 100. | E18 budgets, E29-AC19/20 | S |
| G-06 | Zero visible defects on the player, the corgi and any vehicle the player uses (clipping, floating parts, detached limbs, pale/transparent heroine in fog, gear boxes). Any finding = **P1**. | CLAUDE.local rule, Q-315 | O |
| G-07 | The player is never fully hidden: camera-side fences, walls, hordes and corpses cut/dither or draw a silhouette (Q-314 alley fence, Q-318 horde). | Q-314, Q-318 | O, L |
| G-08 | **Markers only at fixed destinations / action points.** No ring or marker moves with the player or the group; no route steering; HUD arrow, distance and ring point at the real destination (distance = destination, not next waypoint, Q-277). PO: "Checkpoint should not move with me. Checkpoint should always be in places where I need to go to reach the level end or trigger some action." / "let the user find the way by themselves. You just show the final checkpoint". | Q-294, Q-306, Q-277 | S (marker position per tick vs anchor), O |
| G-09 | The objective marker is visible within 2 s of every step start, at zoom 1.5 and 1, not hidden inside a prop (Q-283). Orchestrator 2026-11-06: steps without a spatial destination (hold/defend in place, e.g. the L4 hold) show no world ring by design; the HUD objective text is the marker there. | regression-gate, Q-283 | S, O |
| G-10 | Pickups (weapons, medkits, headlamp, rocket) are taken **on approach** (≤ 1.5 m ground, ≤ 2.2 m shelf), no E/click/standing still. PO: "You should just take it when I come close to it". | Q-298 | S |
| G-11 | Survivor-only weapon pickups have no yellow checkpoint ring; a pickup never respawns (no "unlimited weapons"). | Q-300, Q-302 | S, O |
| G-12 | Every following survivor shows its health bar, at every group size (L6/L7 up to 35). | Q-323 | S, O |
| G-13 | **No single follower is slower than the group.** While the group moves, every follower's median speed ≥ 0.95× the group median (tune); time the player stands waiting for one follower > 10 m behind ≤ 10 % of escort time (tune). PO: "let me stay with the crowd for suvivor." | Q-328 | S, P |
| G-14 | Corpses persist for the whole level (no removal for perf). Piles settle on each other: no floating bodies, no stretched/spiky limbs, pile height ≤ ~1 m (orch. default until F-293 "climbable pile" is scheduled). | PO 10-14, Q-286, Q-287 | S, O |
| G-15 | Desktop controls are **WASD + mouse** only (click-to-move removed). The heroine faces her walk direction and turns to the cursor only during click/hold + 0.45 s; melee/shot/rocket go toward the click point. | F-288, F-288b, F-288c | S (real-input), P |
| G-16 | The weapon rack at level start offers only the weapons the story has given by that level: L1 none (bat in L1), L2 +axe, L3 +handgun, L4 +MG, L5 +shotgun, L6 none new, L7 +rocket, L8 none, L9 driving, L10 axe only. | Q-250, E31-AC15 | S |
| G-17 | Infected locomotion reads as walking/running bodies at the game camera (no tilt > 42°, no splayed legs, no sliding feet), checked as moving frame strips per variant at low quality. | Q-284, Q-292 | O |
| G-18 | Scripted infected keep normal perception: within aggro range they engage the player, companions and survivors, in every level. PO: "even when they walk somewhere, they should still act like Zombies". | Q-312 | S |
| G-19 | Corgi: never damaged, no HP bar, never targeted, never inside geometry or a vehicle hull, inside with the player when a door/shutter closes. | E19-AC17, PO #7, Q-137 | S, O |
| G-20 | Level-end run-out: if action is ongoing at the final objective, the world runs 5 s more (player invulnerable) before the transition. | PO 10-13 | S |
| G-21 | Death respawns at the last checkpoint with its snapshot (followers, pickups, gates); never at level start when a later checkpoint exists. Orchestrator 2026-11-06: per the E19 PO decision 10-07 (live world preserved), the courier position, followers and checkpoint objective restore from the snapshot, while world changes made after the checkpoint (opened gates, taken pickups) persist. | E20-AC17 … E32-AC27 | S |
| G-22 | Every phase announced as a threat ("Stop the infected", "Hold", "Cover the retreat", breach/alarm captions) starts with several infected that can reach the player; first attack ≤ 20 s after the announcement (tune). | Q-325, Q-327, Q-329 | S |
| G-23 | No geometry that looks meaningful but is not: no walk-through walls/gates (Q-289, Q-307), no dead-end street that looks like the route (Q-291), no untextured placeholder props or black voids at the map edge (Q-282). | Q-282, Q-289, Q-291, Q-307 | O, L |
| G-24 | Health bars: Alphas and infected zoo animals show the world-space bar (damaged or ≤ 15 m); dead ones show none; normal animals none. | E30-AC15, Q-125 | S, O |
| G-25 | Zero console errors over a full real-input play-through of the level. | E19-AC22 et al. | S |
| G-26 | Figures share the heroine's proportions and absolute height (no shrunken adults), accessories on heads, held props in hands, sitters on seats. | Q-249, Q-257, P1-108/112 | O |
| G-27 | Opus answers three questions per level: glitches (list), stunning (verdict + missing), **boring / harmless / babysitting** (list). Any "harmless" or "babysitting" finding blocks GO. | lessons 11-01 | O |

---

## L1 · Stop the Outbreak (D-GROVE, morning, start unarmed)

Feel: "a normal living suburb → contained accident → too many, run". Competent time **75–180 s**, deaths **0–1** (E19-AC02/03).

| Step | Objective text | Player does |
|---|---|---|
| `pickup` | Pick up the package at the courier depot | walks to the depot counter (interact 1 s) |
| `deliver` | Deliver the package to the Medical Annex | walks/bikes to the Annex; technician takes the box |
| `escape` | Get away from the facility | flees the 5 infected after the blast |
| `weapon` | Find something to defend yourself | finds the bat in the Henderson garage (marker at garage door) |
| `firestation` | Get inside the fire station | runs into the open bay; shutter closes |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L1-01 | all | Mission graph completable, no fail timer; start loadout empty. | E19-AC01, AC15 | S |
| L1-02 | pickup | 50–60 civilians at start, none idle facing nowhere > 3 s; 0 infected; 0 `combat.*`. | E19-AC05, l1v2.civilians | S |
| L1-03 | pickup | Depot clerk scene plays: clerk hands over, walks back into the shop, closes the door; nobody vanishes. | P1-109 | O |
| L1-04 | deliver | Lab handover plays (technician takes the box and walks back in) at PROD quality or better. | P1-110 | O |
| L1-05 | deliver | After "Delivered" a 4–6 s window with no objective and no infected; flicker → blast → ringing → smoke → screams within 8 s; blast frame ≤ 50 ms. | E19-AC19, l1v2.accident | S |
| L1-06 | escape | Exactly 5 infected exit the Annex front door (technician first), ≥ 3 headings ≥ 60° apart. | E19-AC07 | S |
| L1-07 | escape | Spread: infected 5 → **≥ 15 at +120 s** (floor 12) → **≥ 25 at +240 s** with an idle remote observer; every new one from a bite. | E19-AC06 | S |
| L1-08 | escape | combat: reachable ≥ 90 %; passive first attack ≤ 20 s (measured 8.25 s); passive attacks ≥ 3/min (tune). | orch., release-ab 11-01 | S |
| L1-09 | escape | Infected speeds 4.4 m/s … tier × 1.04; ≥ 85 % faster than the 4.5 m/s run ("should be a bit faster than me"). | E19-AC12, PO 10-09 | S |
| L1-10 | escape | Corgi stiffen/growl/bark before an off-screen infected appears in ≥ 80 % of first encounters. | E19-AC17 | S |
| L1-11 | escape | Bicycle: 7.5 m/s, WASD relative to the bike; after dismount it stands on the player's side of any fence/wall. | E19-AC16, PO #6, P1-111 | S, O |
| L1-12 | escape | Backyard alleys on the depot/Annex line: no snag on trash bags/pallets/bench corners; the camera-side fence never hides the player. | Q-314, Q-319 | L, O |
| L1-13 | weapon | Bat only in the garage; unarmed needs 6–7 hits per infected, bat 2. | E19-AC14, AC15 | S |
| L1-14 | weapon | ≥ 6 infected near the garage after the pickup, all from refuge doors (visible ≤ 3 m from the door); at most 3 pursue within 20 m, the rest wait 16 m back. | E19-AC25, l1v2.forecourt | S |
| L1-15 | firestation | The bay stays open; firefighter repeats "Get in!"; infected stay live until entry; shutter closes with the corgi inside. | E19-AC22, PO #7 | S, O |
| L1-16 | all | Route readability: Luna reaches the depot, Annex and garage without > 60 s lost (tune). | orch. | L |
| L1-17 | all | Frames: morning suburb reads alive; spread reads "too many — run". | E19-AC23 | O, P |

## L2 · The Failed Rescue (D-GROVE, midday, bat → axe)

Feel: "brief success → instant chaos. You can kill zombies, you cannot kill the outbreak." Competent **105–210 s**, deaths **0–1** (l2.bots, E20-AC02/03).

| Step | Objective text | Player does |
|---|---|---|
| `axe` (+`calm`) | Take the fire axe | walks the station; optionally takes the axe; alarm at 20–30 s |
| `board` | Get on the fire truck | boards by interaction |
| `ride` | Ride with Engine 3 to Grove Market | seated, no input |
| `doors` | Cover the firefighters while they force the doors | guards the crew at the market |
| `bridge` | Reach the police checkpoint at the bridge | escapes through the streets, through the cluster, past the gate |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L2-01 | calm | 0 infected and 0 `combat.*` until the alarm; alarm at 20–30 s; crew at the truck ≤ 8 s later; 4 civilians on the 2 benches. | E20-AC04, l2.calm | S |
| L2-02 | axe | Axe rack ring visible from the game camera (not behind sign/bollard); axe optional (`no-axe` run finishes). | PO #8, E20-AC03 | S, O |
| L2-03 | ride | Truck route 15–25 s with player + 6 firefighters seated; all 7 out ≤ 4 s after arrival; control ≤ 0.5 s. Fire-engine crew visible, never hiding the courier. | E20-AC05, Q-273, Q-278 | S, O |
| L2-04 | doors | Order truckArrived → crewExit → atDoors → doorsOpen; no infected within 40 m before doors open; doors forced in 4 s. | E20-AC06, l2.rescue | S |
| L2-05 | doors | 30 (high) / 20 (low) trapped people visibly panic behind the glass (bang/press/plead loops); first one out ≤ 1.0 s after doorsOpen. | E20-AC06, PO 10-08 | S, O |
| L2-06 | doors | Ambush **24** (3 doors × 8, ≥ 3 directions ≥ 60° apart), first visible ≤ 0.5 s after doorsOpen; spread over directions, not one pack. | E20-AC06, PO #12 | S |
| L2-07 | doors | combat: reachable ≥ 90 %; passive first attack ≤ 15 s (measured 3.3 s); passive attacks ≥ 4/min (tune). | orch. | S |
| L2-08 | doors | Snowball: infected **≥ 20 at +60 s, ≥ 30 at +120 s** (idle bot); ≥ 2 firefighters turned by +90 s; firefighters fight (≥ 1 hit) and have no immunity. | E20-AC07, AC08 | S |
| L2-09 | doors | Lesson: staying within 15 m of the doors with the axe, live infected at +90 s ≥ value at +10 s and the player reaches 0 HP at least once within 120 s. | E20-AC09 | S |
| L2-10 | doors | Axe: single swing with 1–2 infected in 2.5 m; roundhouse hits all (≥ 3) and pushes ≥ 2 m with ≥ 3 in range. | E20-AC10 | S |
| L2-11 | bridge | Escape area holds ≥ 25 infected in ≥ 3 groups of ≥ 4, ≤ 20 % chasing at step start; plus **6 scattered singles** along the walk (high; low ≥ 4). PO: "Put a few ones here and there, no group." | E20-AC12, Q-155 | S |
| L2-12 | bridge | combat: competent run meets ≥ 1 infected per 30 m of route (tune); attacks on the player ≥ 2/min, ≤ 20/min (tune). | orch. | S |
| L2-13 | bridge | Panic spreads: a calm ped seeing running peds panics; no ped stays unaffected next to the chaos. | PO #11 | O |
| L2-14 | bridge | Cluster **12–16** (authored 13) on the Elm approach; passable killing ≤ 50 % of it; side path and car alarm each work. | E20-AC13 | S |
| L2-15 | bridge | Checkpoint: ≥ 3 police vehicles with light bars, ≥ 4 officers firing visibly, ≥ 8 civilians; gate closes ≤ 1.5 s after the player crosses; no infected crosses after. | E20-AC14 | S, O |
| L2-16 | all | Light reads clearly harder/higher than L1; streets "wounded, but still standing". | E20-AC16/19 | O |

**L2-09 clarification** (orchestrator decision 2026-11-04): recovering/downed bodies do not count against the living cap. They use a separate bounded pool (≤12 low, ≤24 high); over the limit, the oldest recovering body becomes a persistent corpse. Standing caps remain 30 low / 60 high; corpses persist per PO.

## L3 · The Police Collapse (D-CORRIDOR, late afternoon, +handgun)

Feel: "unusually safe squad → dangerous journey → increasingly alone; streets full of scattered infected". Competent **120–420 s**, deaths **0–2** (l3.bots, E21-AC02/03).

| Step | Objective text | Player does |
|---|---|---|
| `armory` | Take a handgun from the armory | walks to the armory table |
| `defend` | Help defend the station | fights with the police in the yard until the fallback |
| `checkpoint` | Get inside the army checkpoint | leads/leaves the squad down three parallel streets, over the highway ramp, into the army ring |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L3-01 | armory | Handgun only at the armory, within 40 s of start; no reload/ammo UI over 600 shots; 40 HP infected = 2 hits. | E21-AC04 | S |
| L3-02 | defend | Attack starts 5 s after pickup (latest 40 s); waves **15 / 25 / 35** at 0 / 20 / 40 s on both quality tiers (PO 2026-11-07, was 30 / 60 / 100, low ×0.5), streamed over 18 s from 5 directions, 20 % as police zombies from the station door; a quarter on screen within 2 s. | l3.attack, PO 10-12 | S |
| L3-03 | defend | combat: reachable ≥ 90 %; passive first attack ≤ 10 s (measured 3.4 s); attacks on the player ≥ 4/min (tune). | orch. | S |
| L3-04 | defend | The police lose without the player: fallback fires by its first-of rule (60 s / 3 turned / 8 inside) also with the idle bot; ≥ 1 officer turns (same id, uniform). PO: "Ideally the Zombies will win against police when the player isn't doing anything". | E21-AC07, PO 10-12 | S |
| L3-05 | defend | Camera pulls back ×1.5 while the attack runs and the player is in the yard (east-gate fights in frame). | l3.attack.viewScale | O |
| L3-06 | checkpoint | Squad of 3–4 forms, follows 3–6 m (officers fire while moving, PO 2026-11-05), never teleports; size non-increasing per segment; **≥ 2 officers at the army line for the competent run, ≥ 2 of 3 seeds per tier** (PO 2026-11-07: "The police crew that should follow me has zero chance to survive"; was ≤ 2). A bite on a following officer costs 40 HP first (third bite turns him, PO 2026-11-07). Careless play still loses them: the kiting run (L3-11) arrives with ≤ 1 officer on ≥ 1 seed per tier. Every loss a bite/kill/separation. | E21-AC08/10, PO 2026-11-07 | S |
| L3-07 | checkpoint | Segment 1: the squad visibly fights (officers fire at infected and land hits; kills not required); player damage < 100 HP (never a whole life). PO 2026-11-05 dropped the ≥ 60 % officer-kill share; PO 2026-11-07 supersedes "overwhelmed is the point": the squad must have a real chance (L3-06). | E21-AC09 | S |
| L3-08 | checkpoint | Pre-populated infected per segment **125 / 240 / 710 ±20 %** (PO 2026-11-07 "Far too many Zombies", was 250 / 625 / 1000; horde packs 2 × 60, spills 30 / 45); median live within 30 m rises from S1 to S3; live caps **140 high / 100 low** never exceeded (PO 2026-11-07, high was 200). | E21-AC12, PO 2026-11-07 | S |
| L3-09 | checkpoint | Regular infected ≤ 4.0 m/s, sprinters ≤ 5 % (fleeing with survivors possible). | PO-orch. 10-13, l3.infected | S |
| L3-10 | checkpoint | Forward pressure: idle 20 s behind the progress line → 25–75 infected per 10 s from 15–35 m behind, off-screen; stops when the player advances. | E21-AC13 | S |
| L3-11 | checkpoint | combat: attacks on the player ≥ 3/min, ≤ 25/min for the competent run (tune); medkits ≥ 2 per street (≥ 7 total), newbie below 20 % HP ≤ 10 % of the time. **Kiting is not a safe line** (PO 2026-11-07: "I walk and shoot backwards, so no Zombie can attack me"): a courier who runs the army route at full input while aiming and firing the handgun at the nearest infected (`tools/qa/r6-l3-kite.ts`, from the fallback to the army line) draws **≥ 5 infected windups/min** against her and **> 0 in segments 2–3**, ≥ 2 of 3 seeds per tier. The handgun never staggers or pushes back what it hits (PO 2026-11-07: "just modify the effect of the hand gun"); the retreat commit range (1.4 m) lies outside the 1.08 m melee separation ring. | E21-AC14, orch., PO 2026-11-07 | S |
| L3-12 | checkpoint | **Marker:** ring stays at `l3-zone` (army checkpoint), no corridor steer; HUD distance is the real ~360 m distance. Route to the checkpoint readable without steering (Q-270). | Q-294, Q-277, Q-270 | S, L |
| L3-13 | checkpoint | Raised corridor: no deck gaps or dark seams at the ramps; no infected clumps stuck between barrier rows; no body hanging on walls. | P1-113, Q-129, PO #16, Q-317 | S, O |
| L3-14 | checkpoint | Army compound: ≥ 8 soldiers, ≥ 2 military vehicles, ≥ 2 buses with civilians; no active infected in the 5 s rest; ring visible during the camera pull-back; evacuation wait **15 s**. | E21-AC17, P1-114, PO #17 | S, O |
| L3-15 | all | Player visible inside the 80-infected horde (silhouette/outline). | Q-318 | O |
| L3-16 | all | Late-afternoon light, ≥ 2 smoke columns in every street frame; streets read their damage type. | E21-AC16/20 | O |

L3-05 uses the actual scripted attack shot: its camera radius is 1.5× the pre-attack framing while the player is in the yard.

## L4 · The Safe City Falls (D-FAIR, false safety → war, +machine gun)

Feel: "we actually escaped" → "everyone is fighting, and it is still not enough". Competent **245–460 s** (l4.bots; spec 4:20–7:40), deaths **0–2** (E22-AC03).

| Step | Objective text | Player does |
|---|---|---|
| `ride` | Ride into Fairhaven with the convoy | seated in the first bus |
| `quartermaster` | Report to the quartermaster | walks the calm camp, takes the MG → alarm on the same tick |
| `hold` | Hold the plaza with the army | fights inside the perimeter while three lines fall |
| `hide` | Run to the cellar via Lakeshore, Metro Road and Harbor Street | escapes alone through the burning city |
| `bar` | Bar the cellar door | bars the door (1.0 s) |
| `wait` | Stay down | battle goes on above, then L5 |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L4-01 | ride | 5-vehicle convoy reaches the plaza in **20–35 s**; control ≤ 0.5 s after the stop; bus parks inside the military area. | E22-AC04, PO 10-13 | S |
| L4-02 | quartermaster | Until pickup: 0 infected, 0 combat, 0 damage decals; ≥ 40 civilians in routines at high, ≥ 30 at low (orchestrator 2026-11-04: low follows the L4-04 50 % low budget, 30–35; the old ≥ 40 at low contradicted L4-04); soldiers relaxed (chat/coffee/patrol). Civilians do not clump outside the camp or overlap. | E22-AC05, PO 10-13, Q-296 | S, O |
| L4-03 | quartermaster | Alarm (klaxon) and attack start **on the MG pickup tick**. PO: "start the alam and attack at the moment when I picked up the MP". | E22-AC07, PO #18 | S |
| L4-04 | hold | Scale: 18–22 soldiers, 60–70 civilians (40 + 24) high, ≥ 40 % armed; low 50 %; living infected plus reservations ≤ 120 / 80, living characters ≤ 190 / 120 (low budget amended 2026-11-02 to retain ≥60 living at first breach; downed/recoverable bodies excluded from low living cap). | E22-AC08, orchestrator decision 2026-11-02, l4.war.caps | S |
| L4-05 | hold | Infected arrive from ≥ 3 street edges ≥ 60° apart and through wall breaches, staggered groups of 2–5 (not bulk); **none from tents/inside buildings**. | E22-AC10, PO 10-13, Q-192 | S, O |
| L4-06 | hold | **Horde present:** first breach into the plaza at ~45 s (level clock, ±15 s) with ≥ 60 alive at once (~74 at the PO-accepted 10-27 level) (PO 10-27 accepted level); alive in the plaza ≥ 40 from +45 s to the line break (tune). PO: "Almost no fight action. Just two alphas, instead of the Zombie horede". | PO 10-27, Q-297 | S |
| L4-07 | hold | combat: reachable ≥ 90 % (no clumps locked at sheds/walls); passive first attack ≤ 10 s (measured 4.87 s); passive attacks ≥ 6/min (tune). PO: "they are not attacking me" / "The Zombies are somehow locked there". Clarification: score reachability from the first physical perimeter breach/gate opening onward; every infected must have a legal ground, vault, or attack-through-barrier path once the perimeter permits it, with no permanent geometry trap. | Q-279, Q-286 | S |
| L4-08 | hold | Alphas **8 high / 6 low**, staggered from ≥ 6 directions, ≥ 3 reach a line; no Alpha "appears out of nothing". | E22-AC12, Q-160 | S, O |
| L4-09 | hold | Lines fall on beats: line 1 at 50–62 s, nests 110–124 s, armour 170–182 s after the turn; "Fall back!" 8 s after the third; camera beats ≤ 2 s, skippable after 0.5 s. | E22-AC13, l4.director | S |
| L4-10 | hold | Spectacle: ≥ 2 HMGs fire, tank enters at +22 s and fires every 8–12 s (never within 15 m of player/ally), never through the barrier wall; helicopter orbits and withdraws. | E22-AC11, P1-116 | S, O |
| L4-11 | hold | Riot infected: frontal MG hits visibly chip HP + recoil at every range incl. point blank; frontal MG kill ≤ 6 s (measured 3.7 s), flank ≤ 2 s; health bar always shown; one riot cop alone does not down a full-HP player that keeps firing (tune). PO: "I feel I have zero effect when I shoot them." | Q-281, Q-285 | S, P |
| L4-12 | hold | Horde mix: ≥ 4 distinct infected looks in every 20-infected sample (not only suits). | Q-194 | O |
| L4-13 | hide | Escape gap on the route for 40 s, pursuers still chase; collapse waves 3 every 9 s; competent run meets ≥ 10 infected on the route (tune), never an empty street. PO: "The entire level is without zombies". | l4.director.escape, Q-297b | S |
| L4-14 | hide | Live damage at cellar entry: ≥ 4 fires, ≥ 2 burning vehicles, ≥ 10 shattered windows, ≥ 6 scorch decals. | E22-AC14 | S |
| L4-15 | hide | Camera never snaps to top-down; sandbag/pallet structures are textured, solid and readable (no void beyond). | PO #25, Q-282, Q-283 | O |
| L4-16 | bar/wait | Only the player (+ corgi) enters; door barred in 1.0 s; battle audible above ≥ 6 s (low-pass); L5 loads in the same basement. | E22-AC15 | S |
| L4-17 | all | Corpse piles ≤ ~1 m, no stretched limbs; player never drawn under a corpse. | Q-287, Q-286, Q-195 | O |
| L4-18 | all | Frames: `l4-plaza-safe` clean and alive; war frames read "huge mixed war"; player readable in the battle. | E22-AC19 | O, P |

## L5 · Aftermath (D-FAIR W5, sunset, +shotgun)

Feel: "silent ruins, many scattered single infected everywhere, search by sound, protect a growing group". Competent **120–240 s**, deaths **0–1**, survivors rescued **≥ 4** (E23-AC02/03).

| Step | Objective text | Player does |
|---|---|---|
| `emerge` | Unbar the cellar door | takes the shotgun, unbars, fades out to the street |
| `look` | Look for anyone still alive | finds 5 survivors in any order by their sounds/captions |
| `metro` | Lead the survivors down into the Metro | leads the group into the station; shutter closes |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L5-01 | emerge | Shotgun within 3 m of the start, taken on approach; one close shell kills a 60 HP infected; 2 shells incapacitate an Alpha ≤ 0.6 s. | E23-AC12, Q-298 | S |
| L5-02 | emerge | Caption, then ~10 s without objective; no music until survivor 1; first 60 s no allies, vehicles or non-player gunfire. | l5.emerge, E23-AC04/14 | S |
| L5-03 | look | **Infected: ≥ 5× the 11-01 count, as singles/pairs (no group > 3, no horde), spread over all streets** → target ≥ 90 placed (high) / ≥ 60 (low) (tune; measured 18 on low). PO: "Nr can be 5x higher than it is. Like in L3. No hordes, just singles ones here and there, but many of them." | F-322 | S |
| | | **Conflict:** E23-AC04 "12–20 infected" and data cap 30 → F-322 (11-01) wins; caps stay within E18 200 / 100. | | |
| L5-04 | look | Alphas ≥ 2 present and reachable (authored 2). PO: "there are no alphas in this level anymore". | Q-301, l5Wanderers | S |
| L5-05 | look | combat: reachable ≥ 90 %; competent run meets ≥ 1 infected per 40 m of route (tune); attacks on player + group ≥ 3/min (tune); passive first attack ≤ 20 s (measured 10.8 s). PO: "I can just walk, pick up the survivors and walk away". | Q-301, orch. | S, P |
| L5-06 | look | Hiding places draw **no ring, arrow or pin**; found by sound + caption at the spot + edge direction; ♪ radar ping only while a call is heard; cue heard ≤ 25 m, never > 30 m. | Q-302, Q-313, Q-321, E23-AC08 | S, O |
| | | **Conflict:** E23-AC08 "ground ring" / Sam "objective distance or minimap ring" → Q-302 (no ring) wins. | | |
| L5-07 | look | A muted player still finds ≥ 4 / 5 (captions only). | Q-313 | S, L |
| L5-08 | look | Followers: 2–5 m behind (PO 2026-11-05 tolerance: ≥ 95 % of calm straight-walk ticks in 2–5 m and no out-of-band run longer than 2 s), within 8 m ≥ 80 % of non-combat time, run 3.8 m/s (0.84× player) in combat; outside combat a follower more than 5 m behind catches up at up to 1.05× the courier's current speed until back in the band (orchestrator 2026-11-04: a fixed 3.8 m/s could never hold 2–5 m behind a 4.5 m/s courier, fix53-b); none slower than the group (G-13); every follower's bar visible. | E23-AC09, l5.follow, Q-323 | S |
| L5-09 | look | Protection matters: an infected reaching an unprotected survivor bites ≤ 1.5 s; `evade-only` rescues ≤ 2, `complete` ≥ 4. | E23-AC10 | S |
| L5-10 | look | Armed survivors hold the gun in the hand; the corgi never fetches street weapons; no weapon respawns under the player. | Q-299, Q-300 | O |
| L5-11 | look | Heroine keeps her colour in fog (no pale/transparent hero); bus hiding place readable at zoom 1.5. | Q-315, Q-140 | O |
| L5-12 | metro | 20–30 occupants (24) visible inside; every living follower and the corgi cross before the shutter; no body overlap at the shutter; end camera frames the group naturally. | E23-AC15, Q-145, Q-324 | S, O |
| L5-13 | metro | Zero survivors still completes; result reports the rescued count. | E23-AC11 | S |
| L5-14 | all | Same city as L4 (pair cameras read "same place, fallen"); sun intensity falls ≥ 30 % to the metro. | E23-AC05/13/18 | O |

## L6 · The Subway (D-SUBWAY, underground → night, no new weapon)

Feel: "calm shelter → **a defence: waves pour in through the breaches** → fighting retreat in confined darkness". Competent **3:00–5:00**, deaths **0–1**, survivors out **60–90 %** (tune; Q-308 got 28/29 with 10 damage taken = too easy).

| Step | Objective text | Player does |
|---|---|---|
| `shelter` | Look around the shelter | walks among 24 + carried survivors; headlamp pickup |
| `stop` | Stop the infected | defends the shelter against the breaches |
| `retreat` | Cover the retreat through the tunnel | covers the group down the track tunnel, closes gates 90/150/210 |
| `exit` | Bring the survivors into the night | leads the group up the Northgate exit |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L6-01 | shelter | 24 occupants + 0–5 L5 survivors (same ids, full health); routines sit/talk/treat/rest/share; nobody idle > 3 s; no gun on seated/lying people. | E24-AC04, Q-304 | S, O |
| L6-02 | shelter | No new weapon anywhere; headlamp taken on approach; uncollected headlamp stays where it lies; beam follows the head (also moving one way, aiming another). | E24-AC05, Q-138, Q-303 | S, O |
| L6-03 | stop | Breach 1 at 30–40 s, telegraphed by door bangs ≥ 1.5 s before; **first breach is a real wave: ≥ 6 infected (tune) that reach the shelter floor**. PO: "the beginning is lame, since there is no wave of Zombies" / "Counter is down, but so far there was only a single Zombie". | Q-325, Q-329, l6.breach | S |
| | | **Conflict:** E24-AC06 / PO 10-07 "breach1 releases 1–2 infected" → Q-329 (11-01) wins. | | |
| L6-04 | stop | Breach 2 at +20–30 s from ≥ 2 accesses, ≥ 10 infected (tune); power off within 1 frame, red emergency light; abandon at breach 2 + 15 s or ≥ 3 bitten. | E24-AC06/07 | S |
| L6-05 | stop | combat: **reachable ≥ 95 %** (every infected spawns inside the walkable station/tunnel, none behind the tunnel wall); passive first attack ≤ 15 s after each breach caption; attacks on player ≥ 4/min (tune). | Q-326, Q-327 | S |
| L6-06 | retreat | Infected enter the tunnel from 6 side entries (2 each, alternating sides) **and reach the tracks**; reachable ≥ 95 %; none stand harmless behind the platform/gate line. PO: "Just let them enter and it's good." | Q-327, l6Entries | S |
| L6-07 | retreat | combat: attacks on player + group ≥ 4/min across the retreat (tune); competent damage taken ≥ 30 HP (tune); concurrent infected ≤ 60 / 30. | Q-308, E24-AC13 | S, P |
| L6-08 | retreat | Group walks at 2.2 m/s; **injured survivors at group speed** (no single straggler that needs babysitting); every follower's bar visible. | Q-328, Q-323 | S |
| | | **Conflict:** E24-AC10 "injured move at 1.4 m/s and become stragglers" → Q-328 (11-01) wins. | | |
| L6-09 | retreat | Gates: ≥ 3 chokepoints ≤ 2.5 m; a closed gate blocks movement + sight and holds 8–12 s vs 5 infected; refuses to close with a survivor ≤ 2 m; when everyone is through, its prompt and ring stay at the gate until closed (E or click). | E24-AC11, Q-305 | S |
| L6-10 | retreat | Markers fixed at the gate / exit platform; never walking ahead of the group. | Q-306 | S |
| L6-11 | retreat | Covering matters: `evade-only` ≤ 30 % out, `complete` ≥ 60 %. | E24-AC09 | S |
| L6-12 | exit | Northgate is solid when closed and drawn open when passable; night caption "Night. Still alive."; end shot frames the scene; result counts match the objective. | Q-307, Q-144, E24-AC14 | S, O |
| L6-13 | all | Fists-only run finishable (no soft-lock). | PO 10-22 | S |
| L6-14 | all | Underground readability: player contrast ≥ 3:1; infected eyes brightest pixels. | E24-AC15 | O |

## L7 · The Ruined City (D-FAIR W6, night, +rocket launcher)

Feel: "power fantasy: rockets blow gaps into enormous crowds while the group escapes". Competent **4–10 min** (tune), deaths **0–1** (tune), boarding **≥ 60 %** of starting followers (E29-AC02).

| Step | Objective text | Player does |
|---|---|---|
| `rocket` | Recover the rocket launcher beside the exit | takes the launcher at the wrecked truck |
| `corridor` | Bring the group to the evacuation corridor | blasts a route east through the horde |
| `departure` | Get everyone aboard the bus | holds the bus area until all board |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L7-01 | rocket | Launcher ≤ 5 m from the exit, taken on approach, no hitch (max frame ≤ 50 ms at pickup and first shot). | E29-AC04, Q-309, G-10 | S |
| L7-02 | rocket | All six weapons selectable; L6 roster arrives with same ids at full health in formation (no convergence through the courier). | E29-AC03/04/11 | S |
| L7-03 | corridor | Rocket: cadence **2.4/s**, no wait for impact; detonates at the clicked ground point (or first hit / max range); visible in the dark; one rocket kills ≥ 20/24 regulars within 3 m and opens a ≥ 3 m gap; no white-out at point blank. | E29-AC05/06, F-290, F-290b, Q-311, Q-148 | S, O |
| L7-04 | corridor | Over the run ≥ 400 / 200 regulars and **4–6 Alphas** arrive; concurrent ≤ 200 / 100. | E29-AC08 | S |
| L7-05 | corridor | combat: reachable ≥ 90 %; passive first attack ≤ 10 s (measured 4.6 s); attacks on player + group ≥ 6/min (tune). | orch. | S |
| L7-06 | corridor | ≥ 2 connected routes reach the corridor; no dead-end street that looks like the route; no meaningless walk-through wall/slab. PO: "This street feels like a trap". | E29-AC10, Q-291, Q-289 | L, O |
| L7-07 | corridor | Corridor ring fixed (not the nearest of several moving entrances); group counter "Group n/n" correct. | Q-306 | S |
| L7-08 | corridor | Final corridor starts blocked by ≥ 120 / 60 regulars + ≥ 2 Alphas; the player opens a gap ≥ 1 survivor uses. | E29-AC12 | S |
| L7-09 | corridor | Followers keep pace and show bars (G-12/13); pressing crowd never drawn tipped sideways. | Q-323, Q-292 | S, O |
| L7-10 | departure | Every living follower physically boards (one per 15 ticks, recovery after 20 s stall); boarding can finish with ≥ 10 infected alive elsewhere. | l7Departure, E29-AC12/13 | S |
| L7-11 | departure | Bus cinematic 6–10 s, bus moves ≥ 30 m, burning skyline shrinks; truck lit (not a black silhouette); gore reads as blood; no map edge in the end shot. | E29-AC13, Q-142/143, Q-127 | O |
| L7-12 | all | Frames: worst destruction so far, Alpha silhouettes human, player contrast ≥ 3:1. | E29-AC14/18 | O, P |

## L8 · The Zoo (D-ZOO, calm → breach, no new weapon)

Feel: "false sanctuary → internal mass outbreak with infected animals; fight to the APC". Competent **3–6 min** (tune), deaths **0–1** (tune), carried group survives **≥ 60 %** (E30-AC02).

| Step | Objective text | Player does |
|---|---|---|
| `escape` | Bring the survivors to the armored vehicle and board | 60 s free walk, then fights through the zoo to the APC |
| `depart` | Wait for everyone to board the armored vehicle | guards the boarding |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L8-01 | escape (calm) | L7 roster and arsenal arrive exactly; companions at full health; no weapon pickup in L8; start weapon = last weapon (not the bat). | E30-AC03, Q-198 | S |
| L8-02 | escape (calm) | Exactly 60 active sim seconds with the opening objective visible, without waypoint or scripted attack. | E30-AC04 | S |
| | | **Check:** the code starts `escape` (waypoint on) at level start; verify the marker/text stay hidden for the 60 s calm, else FAIL. | | |
| L8-03 | escape (calm) | ≥ 20 civilians, ≥ 6 soldiers, ≥ 4 staff, ≥ 8 animals (all 5 species, ≥ 2 zebras, ≥ 3 flamingos); outside-wall infected cannot cross; nobody idle > 3 s. | E30-AC05/06 | S, O |
| L8-04 | escape (breach) | Breach at 60 s ± 1 tick at ≥ 3 tunnel outlets ≥ 20 m apart within 1 s; **6 / 3 per point** (≥ 18 / ≥ 9); no pop-in. | E30-AC07 | S |
| L8-05 | escape (breach) | Attacks hit civilians, soldiers, staff and animals; animals turn in 2.5–3.5 s keeping id/species; 3–5 Alphas over the run; concurrent ≤ 200 / 100. | E30-AC08/09/11 | S |
| L8-06 | escape (breach) | combat: reachable ≥ 90 %; passive first attack ≤ 20 s after the breach (measured 15.7 s from level start sample); attacks on player + group ≥ 4/min (tune). | orch. | S |
| L8-07 | escape | ≥ 2 escape paths ≥ 2.5 m wide from each enclosure; marker points at the APC (fixed). | E30-AC12, Q-306 | S |
| L8-08 | escape | Infected animals read as enemies (lion snarl, wounds visible from the iso camera); zebra legs clean at PO zooms; player readable at night (rim/accents). | lessons 10-28, Q-175, Q-178 | O |
| L8-09 | depart | Every living group member boards; missing survivors visible or marked during the wait; APC has no gun. | E30-AC13/14, Q-141 | S, O |
| L8-10 | depart | L8 → L9 handover ≤ 6 s inside the same APC (durability kept). | Q-272, E30-AC14 | S |
| L8-11 | all | Frames: strong sanctuary, then mixed battle; Opus "is it stunning?" pass. | E30-AC19 | O, P |

## L9 · The Crossing (D-CROSSING, dry night, driving the APC)

Feel: "open-country drive: smash through or steer around; the APC survives until the forced crash". Competent **2–5 min** (tune; measured 128 s), deaths **0**.

| Step | Objective text | Player does |
|---|---|---|
| `approach` | Drive toward the city | drives road / countryside / dry shortcut |
| `reach-outskirts` | Get clear of the wreck | crash at the collapsed bridge, crawls away |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L9-01 | approach | Driving control ≤ 0.5 s after load; roster + durability carried; corgi never inside the hull; rider's legs inside the cab. | E31-AC02, Q-137, Q-316 | S, O |
| L9-02 | approach | Groups on routes: road 2 × 6, countryside 3 × 6, shortcut 6 × 8 incl. 2 Alphas; each avoidable by a detour ≥ 20 m. | l9Groups, E31-AC05 | S |
| L9-03 | approach | Threat present: on every route ≥ 1 group or wanderer in the camera frame per 60 s of driving (tune; 11-01 strip showed 0 in frame for 30 s). | orch. | S, O |
| L9-04 | approach | Every contact onset −10 durability (no per-tick billing); stopped/surrounded attacks 10 dmg, ≥ 0.6 s windup; safe route ends with more HP than the shortcut. | E31-AC06/07/11 | S |
| L9-05 | approach | **0 HP never breaks down:** speed 60 % ± 2 %, heavy smoke, still drivable. | PO 10-13, E31-AC09 | S |
| | | **Conflict:** PO 10-11 / epic-31 breakdown + on-foot → PO 10-13 "survives until the final scripted crash" wins. | | |
| L9-06 | approach | APC cannot wedge off-road before the bridge; no giant flat arrow over it; HUD bar matches durability. | Q-139, Q-146, E31-AC08 | S, O |
| L9-07 | reach-outskirts | Crash exactly once (full or 0 HP); APC falls whole (no floating wheels/vanishing hull); "Get clear of the wreck" appears only after the crash. | E31-AC15, Q-136, Q-273 | S, O |
| L9-08 | reach-outskirts | L10 starts on foot with exactly [axe], ordinary health, corgi safe. | E31-AC15 | S |
| L9-09 | all | Terrain seams ≤ 2 cm, ≤ 25 / 9 detailed chunks, no input freeze on streaming. | E31-AC12/13 | S |

## L10 · The Cure (D-CURE, 7 regions, axe → arsenal → minigun)

Feel: "vulnerable again → rebuild the arsenal → hunted by the Mega Alpha → stand your ground → the world becomes safe". Newbie no-death **45–50 min** incl. epilogue (E32-AC04); competent **25–50 min** (tune; complete bot 19.5 min); deaths competent **0–3** (tune).

| Step | Objective text | Player does |
|---|---|---|
| `crash` | Leave the wreck on foot | R1 crash outskirts, axe only |
| `residential-fringe` | Recover the handgun at the checkpoint | R2 |
| `industrial-area` | Recover the shotgun at the checkpoint | R3 |
| `military-zone` | Recover the machine gun at the checkpoint | R4 |
| `research-campus` | Reach the research campus | R5 entry |
| `research` | Play the research recording | terminal |
| `cure` | Pack the cure canister | backpack |
| `research-exit` | Get the cure out of the laboratory | lab exit |
| `destroyed-corridor` | Carry the cure down the corridor and grab the rocket launcher | R6 |
| `dispersal-complex` | Bring the cure to the dispersal complex | R7 |
| `install` | Install the cure in the dispersal device | install point |
| `hold` | Charge the dispersal system | 60 s within 25 m, minigun |
| `mega` | Kill the Mega Alpha | ~10 direct rockets |
| `release` | Release the cure at the console | interaction |
| `epilogue` | Watch the cure spread | free walk 120–180 s |
| `credits` | Minor Incident | title + credits |

| ID | Step | Criterion (expected value) | Source | Check |
|---|---|---|---|---|
| L10-01 | crash | First minute ≤ 8 regulars, no dogs/Alphas; R1 concurrent 4–8 (both tiers), singles/pairs. | E32-AC02, §4 | S |
| L10-02 | crash | Mega Alpha introduced by roar/impact by 2:00 (authored 1:30), ≥ 80 m behind on a reachable route. | E32-AC10, megaAlpha | S |
| L10-03 | regions | Concurrent local infected per region (high / low): R2 12–24 / 8–16 (+1–2 dogs after pickup); R3 25–45 / 16–28 (2–4 dogs, 1 Alpha); R4 45–75 / 28–45 (groups 10–20, 2–4 dogs, 1–2 Alphas); R5 55–85 / 35–55 (2–4 dogs, 1–2 Alphas); R6 80–130 / 50–75 (groups 20–35, 3–5 dogs, 2–3 Alphas); R7 peak 140–190 / 75–95. | E32 §4 | S |
| L10-04 | regions | combat in every region: reachable ≥ 90 %; attacks on player ≥ 2/min in R1–R2, ≥ 4/min from R3 (tune); no region crossable with 0 attacks. | orch. | S |
| L10-05 | regions | Weapons only at their named checkpoints, taken on approach, snapshot with the pickup; picking one up spawns nothing. | E32-AC05/06, G-10 | S |
| L10-06 | regions | Dogs: 1.1× run, ≥ 0.6 s telegraph, ≤ 2 m reach, ≥ 2 s cooldown, 10 HP/bite; low, distinct from the corgi. | E32-AC07 | S, O |
| L10-07 | regions | Mega: cruise 0.7× run ± 2 % whenever it is on camera or within 200 m of the courier (orchestrator 2026-11-04: hidden far pursuit beyond 200 m may run faster than cruise (up to 1.15× in the regions, up to 1.35× catch-up on the final delivery approach, sweep-c6 (was 6×)) so the walking arrival of L10-11 holds; it follows connected nav links, never relocates, and the player never sees that speed), always pursuing (no LOS), never trapped, never teleports; minimap shows only a pulsing distance ring; roar/impacts every 20–35 s, louder when closer. | E32-AC10/13/14 | S |
| L10-08 | regions | Road regions framed ×1.3 (verges/fields in frame), base × max zoom ≤ 2.0; not in the finale. Suit crowds readable at night, slam telegraph is a ground effect. | lessons 10-30, Q-179, Q-147 | O |
| L10-09 | research → corridor | Recording explains the airborne cure (subtitles); canister is a visible backpack, no slot, no slowdown, restored on death. | E32-AC15/16 | S, O |
| L10-10 | hold | Charge = exactly 3,600 ticks while alive within 25 m; pauses outside with an instruction; minigun 20 rounds/s, heat +12.5 %/s, lock at 100 %, unlock < 40 %. | E32-AC19/20 | S |
| L10-11 | hold | Assault: infected at the capped peak (140–190 / 75–95), reachable ≥ 90 %, attacks on player ≥ 8/min (tune); Mega reaches the arena ~140 s after activation (orchestrator 2026-11-04: "~140 s" = 120–160 s, by walking; no relocation). | E32-AC21, PO 10-16 | S |
| | | **Conflict:** E32 §5.7 "Mega arrives 10–40 s after activation" → PO 10-16 "keep the current ~143 s build-up" wins. | | |
| L10-12 | mega | Mega survives 9 direct rockets, dies on the 10th; conventional/minigun never below 90 % HP; charge/slam/grab only inside 12 m; no frame > 200 ms at fight and death; corpse reads as the creature. | E32-AC11/12, Q-180, Q-124 | S, O |
| L10-13 | release | Release only with charge 60 + Mega dead + cure installed, player at the console. | E32-AC22 | S |
| L10-14 | epilogue | Mist front ~10 m/s; every touched infected dies within 1 tick (dogs, Alphas, zoo species); no harm to healthy/player/corgi; player keeps control 120–180 s; camera pulls out in the last 30–45 s; then title and credits. | E32-AC23/25/26 | S, O, P |
| L10-15 | all | Death in any region respawns at that region's checkpoint (never level start), with the loadout, cure and boss state of that checkpoint. | E32-AC27 | S |

---

## Criteria count

| Level | Criteria |
|---|---|
| Global | 27 |
| L1 | 17 |
| L2 | 16 |
| L3 | 16 |
| L4 | 18 |
| L5 | 14 |
| L6 | 14 |
| L7 | 12 |
| L8 | 11 |
| L9 | 9 |
| L10 | 15 |

## How to use

1. `qa:threat` (S) fills a per-level/per-phase table of spawned / alive / reachable % / attacks per min / first attack; compare every row with the targets above. A miss = FAIL, regardless of PROD.
2. Luna (L) plays each level from screenshots; every "lost > 60 s", "where do I go?" or "this looks like a wall/route" goes against L*-route rows and G-08 / G-23.
3. Opus (O) reviews the frames against the rows marked O plus G-27's three questions.
4. Fix, rerun, repeat. Rows marked "(tune)" get their measured value written next to them once the PO accepts the feel (P).
5. Every new PO finding adds a row here (and a po-checklist line).

**Immortal test mode (PO 11-01: "a mode where the user cannot die, so an agent has a chance to play it. This is not for judging fun but to check the acceptance criterias").** Agent runs that check criteria play with the courier unable to die: Luna screen play is immortal by default (`tools/playtest/live.ts --screen`, `LUNA_MORTAL=1` to disable), scripted bots use `PLAYTEST_GOD=1`, `qa:threat` passive runs use survival protection. Attacks still land and are counted, so threat criteria stay measurable; deaths bands and difficulty are judged only in mortal skilled runs and by the PO.
