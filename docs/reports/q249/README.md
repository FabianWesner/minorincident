# q249 — approved heroine proportions across the cast

PO approved pilot 2 on 10-30: **“Go, roll out.”** Rollout, visual review and final validation are complete. Both head-size upper limits pass for all adult figures; bodies and shoulders remain unchanged.

## Accepted policy

The later orchestrator decision supersedes the original lower bounds: head size wins. Both head/height ≤ **0.299787** and head-width/shoulders ≤ **0.959122**. A smaller head is accepted. Bodies and shoulder envelopes are preserved; leg lengths and all body joint positions remain authored. Total crown height naturally decreases when a head shrinks, so leg/total-height changes without lengthening legs.

The approved heroine and two children are unchanged. Every other adult human asset is covered: **65 variants / 68 figures / 394 source, high, low and LOD files**. Hair/hats/glasses follow their heads; hands are 0.75 about the wrists. Face and eye artwork/materials and texture pixels are retained; eye geometry follows the uniform head scale. Corrections and animation bakes are offline; no per-frame anatomy work is added.

## Measurement and source repair

Measurements use mesh vertices in the rig bind pose, including its joint×inverse-bind transforms. The complete head starts below the chin/beard; the shoulder band is frozen from the original arm pivots (−10%/+1.7% of original height). Width is the skull above the head joint; legs are ground to hip. The heroine ratios are head/height **0.272533**, head-width/shoulders **0.871929**, legs/height **0.427527**.

Two source weight maps include clothing in the head region: the long-haired suburban mom uses a reviewed 1.13 m neck plane and a welded neck transition; the crouched crawler uses its forward neck pivot and a front-head selection, rather than treating the shirt collar as its chin. Hooded hazmat/firefighter neck weights blend without widening or narrowing the shoulders. The full face/crown uses one XYZ head scale; the neck connection tapers. Exact per-file data and topology/texture checks are in [export-audit.json](rollout/export-audit.json).

The table compares pre-job geometry `4698e5aa0` with the delivered assets. Lineup before screenshots use the approved pilot-2 checkpoint `168a33a1e`; L1 before scenes and cold-load samples use original main `4698e5aa0`: the blue man is already fixed there; his earlier before/after is retained in [pilot 2](pilot-2/README.md). The legacy male courier row uses his actual `.skin.glb`, matching the in-game player.

## Before → after, every figure

| Figure | Head / height | Head width / shoulders | Legs / height | XYZ head scale | Binding constraint |
| --- | --- | --- | --- | --- | --- |
| Heroine (unchanged) | 0.2725 → 0.2725 | 0.8719 → 0.8719 | 0.4275 → 0.4275 | 1.0000 | approved target |
| char.survivor-male | 0.2635 → 0.2635 | 0.5831 → 0.5831 | 0.4505 → 0.4505 | 1.0000 | already within both caps |
| char.survivor-female | 0.3747 → 0.2942 | 1.3838 → 0.9583 | 0.4397 → 0.4970 | 0.6925 | headShoulder |
| inf.common-worker | 0.3794 → 0.2995 | 0.5413 → 0.3768 | 0.4037 → 0.4563 | 0.6962 | headHeight |
| inf.alpha | 0.2498 → 0.2498 | 0.5930 → 0.5930 | 0.3926 → 0.3926 | 1.0000 | already within both caps |
| inf.alpha-worker | 0.2768 → 0.2768 | 0.5922 → 0.5922 | 0.3863 → 0.3863 | 1.0000 | already within both caps |
| inf.alpha-hoodie | 0.2802 → 0.2802 | 0.6573 → 0.6573 | 0.3767 → 0.3767 | 1.0000 | already within both caps |
| inf.alpha-fire | 0.2736 → 0.2736 | 0.6573 → 0.6573 | 0.3801 → 0.3801 | 1.0000 | already within both caps |
| inf.alpha-suit | 0.2498 → 0.2498 | 0.5930 → 0.5930 | 0.3926 → 0.3926 | 1.0000 | already within both caps |
| inf.jogger | 0.5354 → 0.2995 | 1.4689 → 0.5381 | 0.2447 → 0.3704 | 0.3663 | headHeight |
| inf.baseball-cap | 0.4293 → 0.2995 | 0.8951 → 0.5051 | 0.4066 → 0.5002 | 0.5643 | headHeight |
| inf.suburban-mom | 0.3722 → 0.2991 | 1.0843 → 0.7802 | 0.4179 → 0.4666 | 0.7196 | headShoulder |
| inf.delivery-driver | 0.4360 → 0.2995 | 0.8069 → 0.4430 | 0.2901 → 0.3611 | 0.5490 | headHeight |
| inf.skater | 0.4448 → 0.2995 | 0.7153 → 0.3787 | 0.3241 → 0.4098 | 0.5295 | headHeight |
| inf.college-student | 0.3405 → 0.2995 | 0.9647 → 0.7970 | 0.4616 → 0.4906 | 0.8262 | headHeight |
| inf.bbq-dad | 0.3843 → 0.2995 | 0.6428 → 0.4382 | 0.3603 → 0.4106 | 0.6817 | headHeight |
| inf.cashier | 0.4919 → 0.2995 | 0.9119 → 0.3986 | 0.2532 → 0.3501 | 0.4372 | headHeight |
| inf.bathrobe-neighbor | 0.4875 → 0.2995 | 0.6894 → 0.3068 | 0.3003 → 0.4117 | 0.4451 | headHeight |
| inf.construction-worker | 0.4139 → 0.2995 | 0.7367 → 0.4432 | 0.3512 → 0.4205 | 0.6015 | headHeight |
| inf.crawler | 0.4920 → 0.2988 | 0.7456 → 0.6705 | 0.2718 → 0.3204 | 0.4696 | headHeight |
| inf.riot-cop | 0.3838 → 0.2995 | 0.6074 → 0.4150 | 0.3963 → 0.4511 | 0.6832 | headHeight |
| inf.hazmat | 0.3965 → 0.2993 | 0.6631 → 0.4639 | 0.4040 → 0.4698 | 0.6470 | headHeight |
| inf.firefighter | 0.4146 → 0.2995 | 0.6439 → 0.3862 | 0.2726 → 0.3269 | 0.5998 | headHeight |
| inf.bloated | 0.3595 → 0.2995 | 0.4630 → 0.3515 | 0.3549 → 0.3885 | 0.7592 | headHeight |
| inf.screamer | 0.4031 → 0.2995 | 0.6024 → 0.3792 | 0.4049 → 0.4760 | 0.6294 | headHeight |
| inf.sprinter | 0.4080 → 0.2995 | 0.7668 → 0.4729 | 0.3596 → 0.4262 | 0.6167 | headHeight |
| inf.armored-football | 0.3658 → 0.2995 | 0.5869 → 0.4333 | 0.3844 → 0.4251 | 0.7384 | headHeight |
| inf.butcher | 0.3906 → 0.2995 | 0.4867 → 0.3231 | 0.3739 → 0.4304 | 0.6638 | headHeight |
| inf.nurse | 0.4822 → 0.2995 | 0.7145 → 0.3249 | 0.2815 → 0.3820 | 0.4547 | headHeight |
| inf.brute | 0.2691 → 0.2691 | 0.3081 → 0.3081 | 0.3811 → 0.3811 | 1.0000 | already within both caps |
| npc.civilian-adult-m | 0.2922 → 0.2461 | 1.1381 → 0.8967 | 0.4156 → 0.4431 | 0.7879 | headShoulder |
| npc.civilian-adult-f | 0.3412 → 0.2995 | 0.8697 → 0.7163 | 0.4809 → 0.5117 | 0.8236 | headHeight |
| npc.civilian-kid | child anatomy retained | child anatomy retained | child anatomy retained | 1.0000 | child exception |
| npc.civilian-elderly | 0.3125 → 0.2749 | 1.0486 → 0.8719 | 0.4339 → 0.4580 | 0.8315 | headShoulder |
| npc.patient-zero-courier | 0.3181 → 0.2995 | 0.7507 → 0.6873 | 0.4794 → 0.4927 | 0.9155 | headHeight |
| npc.brother | child anatomy retained | child anatomy retained | child anatomy retained | 1.0000 | child exception |
| npc.mrs-alvarez | 0.3405 → 0.2995 | 0.7558 → 0.6243 | 0.3934 → 0.4181 | 0.8261 | headHeight |
| npc.police-officer | 0.2728 → 0.2728 | 0.6560 → 0.6560 | 0.4514 → 0.4514 | 1.0000 | already within both caps |
| npc.paramedic | 0.2961 → 0.2961 | 0.7560 → 0.7560 | 0.4541 → 0.4541 | 1.0000 | already within both caps |
| npc.firefighter-alive | 0.3564 → 0.2995 | 1.0187 → 0.7834 | 0.3983 → 0.4340 | 0.7690 | headHeight |
| npc.national-guard | 0.3040 → 0.2840 | 0.9621 → 0.8719 | 0.4480 → 0.4611 | 0.9063 | headHeight |
| npc.survivor-group / survivor01_root | 0.3105 → 0.2995 | 0.6268 → 0.5947 | 0.4204 → 0.4272 | 0.9487 | headHeight |
| npc.survivor-group / survivor02_root | 0.3105 → 0.2995 | 0.6264 → 0.5942 | 0.4204 → 0.4272 | 0.9487 | headHeight |
| npc.survivor-group / survivor03_root | 0.2973 → 0.2973 | 0.6272 → 0.6272 | 0.4285 → 0.4285 | 1.0000 | already within both caps |
| npc.survivor-group / survivor04_root | 0.3072 → 0.2995 | 0.6302 → 0.6074 | 0.4224 → 0.4272 | 0.9637 | headHeight |
| npc.helicopter-pilot | 0.3280 → 0.2998 | 0.9108 → 0.7977 | 0.4103 → 0.4277 | 0.8758 | headHeight |
| npc.civilian-man-a | 0.2922 → 0.2461 | 1.1381 → 0.8967 | 0.4156 → 0.4431 | 0.7879 | approved pilot 2 |
| npc.civilian-man-b | 0.3216 → 0.2995 | 0.5799 → 0.5223 | 0.4051 → 0.4184 | 0.9008 | headHeight |
| npc.civilian-woman-a | 0.3412 → 0.2995 | 0.8697 → 0.7163 | 0.4809 → 0.5117 | 0.8236 | headHeight |
| npc.civilian-woman-b | 0.3365 → 0.2995 | 0.8336 → 0.7013 | 0.4752 → 0.5020 | 0.8413 | headHeight |
| inf.teen-skater | 0.4168 → 0.2995 | 0.7139 → 0.4241 | 0.3486 → 0.4196 | 0.5941 | headHeight |
| char.courier-male | 0.2969 → 0.2969 | 0.9117 → 0.9117 | 0.4113 → 0.4113 | 1.0000 | already within both caps |
| npc.lab-tech-a | 0.3833 → 0.2995 | 1.1041 → 0.7547 | 0.3692 → 0.4202 | 0.6836 | headHeight |
| npc.lab-tech-b | 0.4027 → 0.2859 | 1.4813 → 0.8719 | 0.3653 → 0.4379 | 0.5886 | headHeight |
| npc.lab-guard | 0.3888 → 0.2995 | 0.5599 → 0.3739 | 0.3635 → 0.4174 | 0.6679 | headHeight |
| npc.depot-clerk | 0.3600 → 0.2897 | 1.2092 → 0.8719 | 0.3540 → 0.3935 | 0.7211 | headHeight |
| npc.dale.aftermath | 0.2927 → 0.2927 | 0.6995 → 0.6995 | 0.4254 → 0.4254 | 1.0000 | already within both caps |
| npc.rosa.aftermath | 0.3054 → 0.2718 | 1.1320 → 0.9583 | 0.4506 → 0.4727 | 0.8465 | headShoulder |
| npc.mr-okafor.aftermath | 0.2490 → 0.2258 | 1.0916 → 0.9583 | 0.5016 → 0.5173 | 0.8779 | headShoulder |
| npc.mia.aftermath | 0.3517 → 0.2995 | 1.1936 → 0.9369 | 0.4802 → 0.5195 | 0.7849 | headHeight |
| npc.sam.aftermath | 0.3130 → 0.2998 | 0.9039 → 0.8484 | 0.4204 → 0.4286 | 0.9386 | headHeight |
| npc.civilian-man-a.aftermath | 0.2929 → 0.2461 | 1.1381 → 0.8928 | 0.4156 → 0.4436 | 0.7845 | headShoulder |
| npc.civilian-man-b.aftermath | 0.3050 → 0.2995 | 0.6132 → 0.5972 | 0.4103 → 0.4136 | 0.9739 | headHeight |
| npc.civilian-woman-b.aftermath | 0.3584 → 0.2995 | 0.8336 → 0.6358 | 0.4752 → 0.5193 | 0.7627 | headHeight |
| npc.marcus.aftermath | 0.3098 → 0.2619 | 1.1064 → 0.8719 | 0.4125 → 0.4414 | 0.7881 | headShoulder |
| npc.shelter-survivor.bandaged | 0.2929 → 0.2461 | 1.1381 → 0.8928 | 0.4156 → 0.4436 | 0.7845 | headShoulder |
| npc.shelter-survivor.lying | 0.2929 → 0.2461 | 1.1381 → 0.8928 | 0.4156 → 0.4436 | 0.7845 | headShoulder |
| npc.shelter-survivor.sitting | 0.2929 → 0.2461 | 1.1381 → 0.8928 | 0.4156 → 0.4436 | 0.7845 | headShoulder |
| inf.mega-alpha | 0.3398 → 0.2703 | 0.2338 → 0.1857 | 0.4192 → 0.4192 | 0.7942 | headHeight |
| inf.mega-alpha-ashen | 0.3820 → 0.2640 | 0.5527 → 0.3811 | 0.4192 → 0.4192 | 0.6896 | headHeight |
| inf.mega-alpha-ember | 0.3693 → 0.2694 | 0.2404 → 0.1750 | 0.4278 → 0.4278 | 0.7282 | headHeight |

The first civilian batch retains the approved pilot scale where it is already smaller than both upper limits; the recorded binding constraint describes the limiting cap, not a requirement to enlarge that head. Source/LOD variation is checked independently in the JSON receipt.

## Visual evidence

- [Studio front before/after, all 68 figures](rollout/sheets/) — `studio-01.jpg` through `studio-17.jpg`; heroine is on the right within each pair, in the same game metres.
- [Game camera, high and low](rollout/lineup/) — zoom 1.5 and zoom 1 before/after; fixed camera/placement from the baseline. Contact pages are `game15-*`, `game1-*`, `low-game15-*`, `low-game1-*`.
- [L1 depot / PO bench / actual production bench](rollout/l1/) — same camera, seed and frames before/after; [L1 contact pages](rollout/sheets/l1-1.jpg). The morning sitter is already seated at the paused intro. Mugs are 10 cm, held by the updated grip. Caps have a crown and seat on the scalp.
- [Infected and retained corpse views](rollout/corpses/) — all 46 skinned adult variants at both quality tiers. The two original-main corpse comparisons retain the same authored folded poses; this anatomy change does not alter the body pose.
- The approved [pilot-2 studio and idle/walk close sheets](pilot-2/README.md) retain front, 3/4, side, zoom 1.5 and literal 3 m high-tier views. Full-cast extra close files retain a minimum 3 m radius, increased for large monsters; they are not all literal 3 m shots.

## Verification

See [QA results](rollout/qa.md). Geometry audit: **394 files, zero errors**, both head caps pass, every measured shoulder envelope is unchanged to the serialization tolerance, triangle counts do not increase, and original texture bytes match. The heroine and children match their original files.

Pipeline PLAYBOOK stage 1 now defines game proportions by the approved heroine and the shrink-only upper-limit rule, rather than the old chibi renders: local pipeline `lane/q249` commit **ce1843b**. No inference, push, GitHub publication or deployment was performed.
