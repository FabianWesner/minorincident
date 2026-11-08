# r11 smoke

The L8 smoke fixture now exercises the mission's real breach transition, seats the living evacuation group through APC passenger entry, and then boards the courier through normal interaction after the existing shader warm-up snapshot. It asserts that the whole fixture roster is seated, that `vehicle.entered` records the courier, and that no courier, held weapon, or vehicle shader builds occur after warm-up. The helper is part of the query-gated QA test API.

`npm run typecheck` and `npm run lint` passed. `npm run build` passed, including `[public-build] PASS: 21 HTML/JS files contain no QA hooks`.

Two consecutive `E2E_PORT=4311 npm run test:smoke` runs passed through the shared headless browser pool (two QA workers, one public worker): **148.6 s** and **146.0 s**, each within the 240 s budget. Each passed all six QA smoke cases and the public smoke case, with 13/13 L8 passengers seated, a real courier boarding event, and zero late courier/weapon/vehicle shader builds. Port 4311 avoids another job's preview server on 3301. [Verification receipt](verification.json).
