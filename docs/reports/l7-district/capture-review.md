# Game camera review

| Before / after set | Review |
| --- | --- |
| [Seven W5/W6 shells, high](w5-w6-shells.jpg), [low](w5-w6-shells-low.jpg) | W5 left, W6 right, equal-depth positions and game camera. Foundations stay fixed; ragged roof/facade loss preserves each landmark. All seven shells are framed, with no replacement box or panel geometry. |
| [W5 plaza](plaza-w5.png), [W6 plaza](plaza-w6.png) | Exact original pair pose and identical night light. Added craters, collapse kit, wrecks and fires. The solid slab and static frontage intersections belong to reused W5 dressing; these images retain them. |
| [Northgate before](northgate-before.png), [after](northgate-after.png), [low before](northgate-low-before.png), [low after](northgate-low-after.png) | Courier moves west across the 3.9 m apron. No actor clipping, sinking or missed visible frames; facing/velocity drift 0°, slide p95 0.2 cm, jitter run 1. Wreck wheels and rocket rest on the paving. Fire and smoke remain legible against the dark exit. |
| [Corgi before](corgi-before.png), [after](corgi-after.png), [low before](corgi-low-before.png), [low after](corgi-low-after.png) | Existing rigid-part batching retains the dog's coat, limb/head/tail pivots and grounded stance beside the truck. Courier remains grounded. No actor clipping in either tier. |
| [200-infected before](horde-high-before.png), [rocket after](horde-high-after.png), [100-infected before](horde-low-before.png), [rocket after](horde-low-after.png) | Bodies, knockback, fireball and debris are visible; the blast silhouette remains readable over persistent fire/smoke. The conservative Scene Lab visibility probe flags 66 undrawn frames for some peripheral actors, although actor clipping is 0. This remains a Q1 investigation; these stress captures are not claimed as a passing visibility gate. |

Northgate and all seven high/low shell isolation gates pass. Full production stress retains 22 fires, performs seven rocket blasts, and reaches the exact 200/100 concurrent caps. See `perf-high.json` and `perf-low.json`: low simulation/frame timing is still over its unchanged assertions. No Alpha telegraph is exercised by this district lane.
