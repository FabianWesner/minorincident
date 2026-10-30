# Q-168 low-tier escape population

Source fix checkpoint: 055ef7fa2 (`src/data/l2.ts`). Probe: `SCENE_PORT=4382 E2E_PORT=4381 sh tools/e2e-lock.sh npx tsx tools/qa/triage-a.ts route`.

Viewed `juniper.png` and `elm.png`: solitary route encounters occupy separated street points, with courier and street geometry readable. The six authored homes have static clearance at actor height; six actual low-tier arrivals exist by tick 120. The receipt retains their homes, spawned positions and health. Static-only clearance deliberately excludes those actors themselves. High still has six route infected, low increases from four to six; director caps and bridge quota are unchanged. L5 is untouched. Zero console errors.
