# L8 Night Zoo — redesign (orchestrator, 2026-11-11 ~23:30)

PO, verbatim (PROD batch 86 UAT):
- "This way of moving the yellow circle into the flamingo area does not make any sense. This is bad gameplay. I think you just give me a path that I cannot go away because maybe there are walls, because it's a zoo, and the zoo has walls or fences, so it can force me to walk a specific way."
- "While fighting them, it's not clear where to move. It's a pretty bad gameplay, I want you to rethink the whole level."
- "Flamingos are sliding, not walking, terrible." / "This also looks terrible." / "L8 lions look strange" / "they do not move smooth, they are more like flicker."

Kept: the story beats (arrive, Nadia's tour, the six animal Alphas, the breach and plaza defence, the sanctuary gate hand-in of the launcher), the arena order flamingo → lion → monkey → zebra → gorilla → elephant, zombies/animals identical everywhere (no stat tuning), corpses persist.

## 1. One fenced visitor path (no open void)
- The level is a single lit visitor path (3–5 m wide, paved, lamp posts every ~15 m, no lamp on a road lane) from the entrance plaza through six arena gates to the sanctuary gate. Everything off the path is fenced (zoo bars, hedges, enclosure walls, kiosks) — the player cannot walk into dark open ground.
- The path is one-way: a gate behind each section closes once the next section opens (reuse the L8 gate/barrier system; shoves never cross a closed gate — r36).
- The objective marker always sits ON the path at the next gate or at the next arena centre once inside; never in open ground. Objective text = one short verb line ("Enter the flamingo pond", "Kill the flamingos 3/8"). Tips appear once as a hint bubble, not in the objective line.

## 2. Arenas: compact, bounded, readable
- Each arena is a closed, lit pen of ~22–30 m diameter with one entry gate (closes behind her) and one exit gate (opens when the animal(s) die). The whole arena fits the default camera (zoom 1); the arena edge is a visible wall/fence with a light strip on the ground.
- Floor: light, even ground texture inside the pen so telegraphs (amber/red rings, lanes) read clearly; no dark grass in the fight area.
- The minimap draws the arena boundary; only enemies inside the arena show as red dots.
- Where to move must be obvious: every signature attack has a ground telegraph (ring/lane) with a clear safe side; cover pieces (pillars, rocks, feeding troughs) placed deliberately, 3–4 per arena.

## 3. Per-arena notes
- Flamingo pond: drop the "shadow lane" mechanic. Birds walk (real stepping gait, s57) and take off/land on visible lit landing spots around the pond rim; a dive is telegraphed by a red lane on the ground. HUD counter "Flamingos 3/8". No stacking.
- Lion/lioness: TRELLIS look (s52) and smooth motion (s55); pounce = amber ring, roar = wide ring.
- Monkey yard, zebra paddock, gorilla house, elephant ring: same rules; gorilla pillars stay (r42), zebras' charge lanes visible.
- Between arenas: short path fights with infected groups (2–4 per section) so the walk is never empty; Nadia's tour lines play while walking, short.

## 4. Breach and finale
Unchanged in story: the plaza breach with the group; the plaza is the last bounded arena on the path; hatches visible; "Back to the plaza!" rule stays (r36).

## 5. Acceptance
- Real-input play from L8 start to the sanctuary gate following only the marker: no stall > 10 s, the marker never in open ground, the player can't leave the path.
- Each arena: the whole arena visible at zoom 1; a first-time player can tell where to stand from the telegraphs (QA lane judges with captures).
- Threat audit L8 0 flags; nightly invariants (placement, waves) green; layout rebuild without id reshuffle; smoke after the rebuild.
- "Is it stunning?" ≥ 8/10 per arena in the QA lane's scoring.

## Lanes
1. s60-l8redesign (Sol): §1, §2, §4 — path, fences, gates, arena bounds, floors, markers, objective text, minimap boundary.
2. Running: s52 (TRELLIS lions/heavies), s55 (lion motion), s57 (flamingo walk + slide gate).
3. After 1–2: flamingo mechanic rework (§3) and per-arena cover/telegraph pass, then a full real-play QA with stunning scores.
