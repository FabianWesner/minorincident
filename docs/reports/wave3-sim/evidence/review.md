# Game-camera review

The first WebGL/high/1.0 L6 capture shows the courier and pickup ring clearly inside a warm lantern pool. The shelter behind is dark after the second breach; the immediate foreground has no newly appeared infected. Numeric first-appearance evidence records all eight silhouette corners outside the real camera frame and every arrival within three metres of its maintenance or tunnel access.

The first WebGL/high/1.0 R6/R7 capture shows the courier standing on the continuous asphalt and white lane marking, with the dark grass verge on both sides. There is no exposed gap, floating courier or broken line at the streamed boundary. This capture is at the region transition's open road, so it does not establish visibility of the distant dispersal building.

All 44 modified GLBs were compared against HEAD: the BIN chunks/geometry are byte-identical and the only semantic JSON change is `ss_physics.reset = spawn`. The sim metadata was regenerated from the production GLBs; the collision registry was not regenerated.

The Hetzner calm fixture covered 51 inside occupants and four live exterior attackers for 3,600 ticks on each quality tier. No occupant lost HP or acquired an infected brain/infection; the maximum consecutive wrong-facing duration across 30 human routines and eight animals was 95 ticks (1.583 s), below the 180-tick limit. See calm-high.json and calm-low.json.

The tagged sim run passed seven regressions: every one of 33 movable definitions, remove behavior, L6 waves/telegraphs, both L8 calm tiers, and both D-CURE seam tiers. The latter walks/reverses across all six actual region boundaries, checks two-second support/nav every tick, and unloads/revisits each corpse and collected pickup with the same IDs while retaining one damaged persistent boss.
