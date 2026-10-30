# q257 height census

Heroine skinned bind height: **1.454 m**. Delivered healthy women target 1.454 m; men 1.570 m (+8%); elderly man 1.492 m (male × 0.95). **0 class/child errors** across every delivered LOD.
PROD batch 40 = `fd8f56ca3`; main before q257 = `73a855ef6` (q249 rollout). GPU rows measure the actual encoded geometry referenced by each revision’s delivery manifest, after its offline normalizer; they do not assume a target was applied. The table uses the normal game LOD1; JSON records LOD0/1/2, ground planes and exact delivery files. Character/escort rows include their runtime uniform fit. Retained legacy assets have no production spawn and are measured separately; infected archetypes retain their authored heights/poses.

| Figure | Renderer | PROD 40 (m) | main (m) | after (m) |
|---|---|---:|---:|---:|
| Heroine | CharacterView | 1.454 | 1.454 | 1.454 |
| char.survivor-male | CharacterView | 1.800 | 1.800 | 1.570 |
| char.survivor-female | CharacterView | 1.800 | 1.592 | 1.454 |
| inf.common-worker | infected GPU | 1.833 | 1.691 | 1.691 |
| inf.alpha | infected GPU | 2.334 | 2.334 | 2.334 |
| inf.alpha-worker | infected GPU | 2.372 | 2.372 | 2.372 |
| inf.alpha-hoodie | infected GPU | 2.433 | 2.433 | 2.433 |
| inf.alpha-fire | infected GPU | 2.411 | 2.411 | 2.411 |
| inf.alpha-suit | infected GPU | 2.334 | 2.334 | 2.334 |
| inf.jogger | infected GPU | 1.800 | 1.158 | 1.158 |
| inf.baseball-cap | retained legacy asset | 1.800 | 1.463 | 1.463 |
| inf.suburban-mom | infected GPU | 1.800 | 1.612 | 1.612 |
| inf.delivery-driver | infected GPU | 1.800 | 1.399 | 1.399 |
| inf.skater | retained legacy asset | 1.800 | 1.423 | 1.423 |
| inf.college-student | retained legacy asset | 1.800 | 1.693 | 1.693 |
| inf.bbq-dad | infected GPU | 1.800 | 1.541 | 1.541 |
| inf.cashier | infected GPU | 1.799 | 1.272 | 1.272 |
| inf.bathrobe-neighbor | infected GPU | 1.799 | 1.321 | 1.321 |
| inf.construction-worker | retained legacy asset | 1.800 | 1.503 | 1.503 |
| inf.crawler | infected GPU | 1.014 | 0.861 | 0.861 |
| inf.riot-cop | infected GPU | 1.808 | 1.575 | 1.575 |
| inf.hazmat | infected GPU | 1.683 | 1.437 | 1.437 |
| inf.firefighter | infected GPU | 1.790 | 1.522 | 1.522 |
| inf.bloated | retained legacy asset | 1.800 | 1.644 | 1.644 |
| inf.screamer | retained legacy asset | 1.800 | 1.531 | 1.531 |
| inf.sprinter | retained legacy asset | 1.800 | 1.519 | 1.519 |
| inf.armored-football | retained legacy asset | 1.800 | 1.628 | 1.628 |
| inf.butcher | retained legacy asset | 1.800 | 1.564 | 1.564 |
| inf.nurse | infected GPU | 1.800 | 1.347 | 1.347 |
| inf.brute | retained legacy asset | 2.204 | 2.204 | 2.204 |
| npc.civilian-adult-m | civilian GPU | 1.800 | 1.685 | 1.570 |
| npc.civilian-adult-f | civilian GPU | 1.800 | 1.725 | 1.454 |
| npc.civilian-kid | civilian GPU | 1.474 | 1.474 | 1.474 |
| npc.civilian-elderly | civilian GPU | 1.800 | 1.339 | 1.492 |
| npc.patient-zero-courier | retained legacy asset | 1.800 | 1.752 | 1.752 |
| npc.brother | escort | 1.427 | 1.427 | 1.427 |
| npc.mrs-alvarez | escort | 1.800 | 1.693 | 1.454 |
| npc.police-officer | civilian GPU | 1.800 | 1.418 | 1.570 |
| npc.paramedic | retained legacy asset | 1.800 | 1.800 | 1.800 |
| npc.firefighter-alive | civilian GPU | 1.800 | 1.338 | 1.570 |
| npc.national-guard | civilian GPU | 1.800 | 1.386 | 1.570 |
| npc.survivor-group / survivor01_root | retained legacy asset | 1.800 | 1.771 | 1.771 |
| npc.survivor-group / survivor02_root | retained legacy asset | 1.800 | 1.771 | 1.771 |
| npc.survivor-group / survivor03_root | retained legacy asset | 1.766 | 1.766 | 1.766 |
| npc.survivor-group / survivor04_root | retained legacy asset | 1.791 | 1.771 | 1.771 |
| npc.helicopter-pilot | retained legacy asset | 1.800 | 1.727 | 1.727 |
| npc.civilian-man-a | civilian GPU | 1.800 | 1.685 | 1.570 |
| npc.civilian-man-b | civilian GPU | 1.806 | 1.764 | 1.570 |
| npc.civilian-woman-a | civilian GPU | 1.800 | 1.725 | 1.454 |
| npc.civilian-woman-b | civilian GPU | 1.800 | 1.650 | 1.454 |
| inf.teen-skater | retained legacy asset | 1.664 | 1.382 | 1.382 |
| char.courier-male | CharacterView | 1.398 | 1.398 | 1.570 |
| npc.lab-tech-a | civilian GPU | 1.800 | 1.240 | 1.570 |
| npc.lab-tech-b | civilian GPU | 1.800 | 1.150 | 1.454 |
| npc.lab-guard | civilian GPU | 1.800 | 1.302 | 1.570 |
| npc.depot-clerk | civilian GPU | 1.800 | 1.281 | 1.454 |
| npc.dale.aftermath | civilian GPU | 1.800 | 1.429 | 1.570 |
| npc.rosa.aftermath | civilian GPU | 1.800 | 1.371 | 1.454 |
| npc.mr-okafor.aftermath | civilian GPU | 1.800 | 1.529 | 1.570 |
| npc.mia.aftermath | civilian GPU | 1.800 | 1.285 | 1.454 |
| npc.sam.aftermath | civilian GPU | 1.800 | 1.444 | 1.570 |
| npc.civilian-man-a.aftermath | civilian GPU | 1.800 | 1.339 | 1.570 |
| npc.civilian-man-b.aftermath | civilian GPU | 1.800 | 1.780 | 1.570 |
| npc.civilian-woman-b.aftermath | civilian GPU | 1.791 | 1.726 | 1.454 |
| npc.marcus.aftermath | civilian GPU | 1.814 | 1.680 | 1.570 |
| npc.shelter-survivor.bandaged | civilian GPU | 1.800 | 1.339 | 1.570 |
| npc.shelter-survivor.lying | civilian GPU | 1.800 | 1.339 | 1.570 |
| npc.shelter-survivor.sitting | civilian GPU | 1.800 | 1.339 | 1.570 |
| inf.mega-alpha | infected GPU | 2.647 | 2.647 | 2.647 |
| inf.mega-alpha-ashen | infected GPU | 2.647 | 2.647 | 2.647 |
| inf.mega-alpha-ember | infected GPU | 2.594 | 2.594 | 2.594 |
