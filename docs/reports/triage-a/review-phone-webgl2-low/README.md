# #105 phone landscape Home button

Reproduced with actual full UI, touch device emulation, debug row visible, 844×390: Home overlapped 1,120 CSS pixels of the portrait. The shared debug-row margin rule omitted Home. Add Home to that existing selector so it moves down with the vitals panel.

Viewed `before/landscape.png` and `landscape.png`: portrait is unobstructed and Home sits below it with a 16 px gap. Bounding rectangles in `before/evidence.json` and `evidence.json` prove overlap 1,120→0; zero console errors. Existing collapsed debug row, canvas, touch controls and mission HUD are visible in both captures. No camera values changed.

Reproduce: `SCENE_PORT=4383 sh tools/e2e-lock.sh npx tsx tools/qa/triage-a-review.ts phone --low`.
