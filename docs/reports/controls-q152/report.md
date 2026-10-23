Q-152 · E03 input correction (2026-10-23)

- Fix: attack holds only aim between clicks; physical LMB alone retains ground dragging; fresh clicks and WASD retain their rules (runtime commit `703813ee7`).
- Red-first: initial 4/5 failed; expanded original code 7/8 failed; fix 8/8 passed. Real `tools/playtest` keyboard/mouse proof: 5/5 cases with bat, handgun and launcher via Space/J/K.
- Gates: complete input/controls 105/105; native E03 47 unit/sim + 171 browser; remote unit/levels 2,503 passed, 9 skipped; smoke 6 unit + 31 browser; typecheck/lint/build green.
- Phones: LEFT bat and RIGHT handgun/launcher drags aim and fire without movement on Pixel 7 and iPhone 14, portrait and landscape.
- AC14’s unconditional held-LMB clause was wrong under the orchestrator decision and now records the held-attack exception. The respawn fixture waits for the intentional garage lock and measures unobstructed ground; its travel threshold stays >0.5 m.
- E03 verification uses one worker for shared Mac capacity; final gates ran serially. [Evidence](evidence.json) records source hashes, commands, results, commits and earlier failed attempts.
