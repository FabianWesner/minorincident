# s241 L8 route and street audit (in progress)

The [before map](barriers-before.png) overlays runtime barriers on the old layout. Brown marks the outer wall, orange connector gates, pink path walls, blue yard walls, cyan yard gates and purple plaza gates. The green line includes crossings from each entry marker to its exit and measures 567.5 m. It is a different distance convention from the original diagnostic below.

The [current map](route-after.png) uses the orchestrator's native navigation diagnostic: coloured lines lead from each preceding exit to the next stage's marker, without including the walk across each arena. It reports **299.59 m** (13 + 36 + 66 + 49 + 40 + 95 m; individual values rounded), within the 300 m target. Orange marks connector gates, pink path walls, blue yard walls, magenta yard gates, cyan plaza gates, brown the perimeter, black entries and white exits. Opened map: the Flamingo west and Lion east gates face one another; Zebra's west approach now reaches its gate. The Lion-to-Monkey leg cuts across the former verge fences, and the Gorilla-to-Elephant leg runs down the eastern edge. The map alone does not prove the route can be walked or that every former gap is closed.

A centreline scan of the final rebuilt road graph found the following 15 cuts. Jersey barriers are visible fixed concrete pieces; runtime path walls and connectors are drawn as 2.8 m keeper-fence panels. The Lion road endpoint now passes layout validation. The road list remains provisional until each street mouth has been visually inspected.

| Road graph segment | Cut on centreline | Disposition to verify |
| --- | --- | --- |
| p-96:-64--p-60:-64 | Jersey at x=-63 | Concrete barricade |
| p0:-64--p24:-64 | Jerseys at x=3 and x=14 | Concrete barricades |
| p-96:0--p-60:0 | Path wall at x=-63.1 | Drawn fence panel |
| p-24:0--p0:0 | Plaza west gate at x=-14 | Story seal |
| p0:0--p24:0 | Plaza east gate at x=14 | Story seal |
| p60:0--p96:0 | Jerseys at x=82 | Concrete barricade |
| p0:64--p24:64 | Connector at x=20.9 | Drawn keeper gate |
| p-96:-64--p-96:0 | Jerseys at z=-52 | Concrete barricade |
| p-96:0--p-96:64 | Jerseys at z=12 | Concrete barricade |
| p-24:-64--p-24:0 | Jerseys at z=-61 and z=-52 | Concrete barricades |
| p-24:0--p-24:64 | Path wall at z=32 | Drawn fence panel |
| p24:-64--p24:0 | Jerseys at z=-52 | Concrete barricade |
| p24:0--p24:64 | Plaza south gate at z=12 | Story seal |
| p96:-64--p96:0 | Jersey at z=-35 | Concrete barricade |
| p96:0--p96:64 | Yard gate at z=46 | Drawn keeper gate |

Five obsolete connector gates and three path walls were removed; a flood comparison with all eight absent kept each next cage reachable without reaching later cages. The scan covers 31 road-graph edges and detects centreline intersections; it does not prove reachability or cover every paved spur. Remaining paved approaches require visual inspection, and the list is not yet a completed whole-map audit.

The rebuilt D-ZOO layout passes the runtime validator. The native confinement probe passed all 17 edges, including links from each previous exit, and 12 shove checks. Mission interactions passed on the final layout after moving the pond keeper outside the closed north fence and updating the existing fixture for breach-time animal turns. The main worktree still has uncommitted animal-turn and camera changes that must be committed and merged. Native completion, the all-level threat audit, remote unit and the full street audit are outstanding.

The [door capture sheet](doors.jpg) is ordered HIGH then LOW, with new and old positions paired. Opened views show gaps at the Flamingo west exit, Lion east entry and Zebra west entry, and continuous inner fence at their former north or south openings. The shifted Lion outer south opening is visible beside the now-fenced former position. These captures use a paused inspection setup with the corresponding next gate open; they do not prove normal-play gate timing.
