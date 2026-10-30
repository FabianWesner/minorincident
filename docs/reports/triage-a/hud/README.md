# Q-167 vehicle onboarding

Fix: e140344a8; pooled probe: `SCENE_PORT=4382 E2E_PORT=4381 sh tools/e2e-lock.sh npx tsx tools/qa/triage-a.ts hud`.

Viewed `hint-visible.png` and `hint-retired.png`: the actual HUD instruction under the corgi card appears initially and is absent after 180 active ticks (three seconds), while vehicle interaction remains available. Other HUD panels remain readable. `evidence.json` records both states and zero console errors. A temporary sedan was staged solely to hold the interaction condition; its placement is not production vehicle evidence. Simulation pause freezes the lesson timer.
