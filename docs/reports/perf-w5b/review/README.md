# Game-camera review

Inspected all sixteen comparison sheets below: high/low quality, zoom 1.0/0.5, WebGL2/WebGPU. Each sheet has eight labelled conditions and three captured samples per condition (384 sampled frames across the 128 required conditions). Full time sequences remain in the original catalog folders; zoom 1.5 has additional numeric coverage. Some follow-camera fixtures settle their zoom after frame 0; middle/final samples establish the close view.

These are sampled game captures. The comparison helper crops existing labelled cells without altering their pixels. It excludes unused JPEG padding. Input sheets and selected cell indices are recorded in `conditions.json`; the reproducible helper is archived in `../diagnostic/review.py.txt`.

| Scene / comparison | Observed result and limits |
| --- | --- |
| [Oblique bars](bars-oblique-conditions.jpg) | Roof hides the target/bar on both backends. The target head briefly peeks above the far edge at zoom 1. Close views are filled by the roof and do not establish courier readability. |
| [Occluded bars](bars-occluded-conditions.jpg) | Roof covers the hidden actor/bar consistently. Detailed tiles become the shipped flat roof on low. Close roof crops intentionally contain no courier. |
| [Visible bars](bars-visible-conditions.jpg) | Pink bar follows the rear actor in wide views; figures animate and remain drawn. At close zoom the bar/upper actor leaves the crop. |
| [Persistent bodies](corpse-pools-conditions.jpg) | Three distinct clothed/headwear looks survive the hit/fall sequence and remain on the ground at frame 360. Close crops trim some edge extremities. |
| [Held props](held-props-conditions.jpg) | Wide views retain officer, orange coffee holder and green rifle holder; props remain attached through sampled poses. Close views crop the upper actors and do not prove their complete readability. |
| [Navigation](l4-navigation-conditions.jpg) | Courier clears the armory table, reaches the green ring and stops consistently at both scales/tiers/backends. |
| [Convoy/setpieces](l4-setpieces-conditions.jpg) | Bus body, wheels and lamps persist along the road and through canopy/cutaway states. Close views crop the bus; the seated courier is intentionally hidden, so rider readability is not claimed. |
| [L5 ash](l5-ash-conditions.jpg) | Drifting ash/haze, burned bus, scattered bodies/debris and courier remain drawn. Close views exclude much of the surrounding wreckage. |
| [Light lab](light-lab-conditions.jpg) | Varied crowd clothes remain drawn; high has long purple shadows and low its simpler shadow treatment. The strongest pool washes out part of the foreground courier; close crops omit the courier. This existing readability limitation is not fixed here. |
| [Mounted HMG](mounted-gun-conditions.jpg) | Production mount is visible, with an early flash at its barrel; gunner keeps an aiming pose and target falls/remains drawn. Low uses its shipped simpler nest mesh. Close views partly crop the target. Every case also requires target HP 0. |
| [Refuge](refuge-conditions.jpg) | Human figures remain visible around the exterior refuge door, keeping their looks and shelter positions. Close views omit part of the group; these samples show the settled shelter, not the complete flight. Exact target/route outcomes are covered by the alarm parity test. |
| [Bounded reveal](reveal-conditions.jpg) | Courier remains visible against the foreground sedan while adjacent/rear cars stay whole; the silhouette/cut-region pixel gates pass. The close samples do not justify a claim that every foot pixel is readable. |
| [Rifle cover](rifle-cover-conditions.jpg) | Muzzle flash/near-cover glints precede the green dumpster, with hits beyond it and the same Alpha telegraphs. Close crops cut off part of the Alpha. Final HP 265 remains the unchanged numerical gate. |
| [Rocket](rocket-conditions.jpg) | Sedan becomes a burning wreck, with fragments, fallen figures, fire and smoke retained. High close smoke temporarily obscures most of the view; low has fewer puffs. No general combat-readability improvement is claimed. |
| [Storm](storm-conditions.jpg) | Courier moves through rain and wet reflection streaks beside the red sedan and warm windows; low reduces rain detail while retaining the same scene. |
| [Instance streams](streams-conditions.jpg) | Teal pedestrian, green runner and purple Alpha retain their looks and articulated poses on both backends. Pedestrian leaves the top crop at close zoom; Alpha/bar is partly cropped there. |

The first WebGL pass used an inherited checkpoint HMG fixture whose mount was hidden by scenery. Visual inspection caused its replacement with the isolated nest; `mounted-final-webgl2/` supersedes those six rows. The full WebGPU pass and all comparisons use the revised fixture. Original receipts remain intact; `../coverage-final.json` identifies the final 192 unique cases.
