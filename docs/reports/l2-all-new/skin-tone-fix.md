# L2 skin-tone correction

- Face-led skin masks and shared luminance normalisation now give officer and child matching face/arm/hand tones per person; uniform shoulder gold, gloves and garments remain separate. Added a shared regression test.
- Rebuilt all 12 LOD/tier deliveries; regenerated and inspected sheets [01](01-npc.civilian-kid.jpg), [02](02-npc.police-officer.jpg), [03](03-l2-crowd-old-new.jpg) and [10](10-states-and-motion.jpg). Native sheets use production skin tint (tone 0); tone-5 check confirms variation. Production crowd/states and showcase image refreshed.
- Validator: 1262 rows, 0 errors; npm test: 87 pass; typecheck/lint/verify E20 pass; smoke: 7 pass, including freeze/GPU limits. Budgets unchanged and met; no new inference or HF spend. [Evidence](gates/summary.json).
