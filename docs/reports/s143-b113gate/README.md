# s143-b113gate — gate comparison

## Scope and source

Candidate: `7fb95a9159be6c3b38856a0071464d35f0de4396` (s140 changes on top of PROD 112, `cc2f7476c7e7834d5060b07a2b654a5d1cb1c873`). A disposable checkout at the baseline commit was used for the full native threat audit and removed after the run.

## Findings so far

- **L2-12:** candidate and baseline both report **21.93 attacks/min** for the same 3.08-second L2 bridge sample. The baseline full audit reports **zero fail flags**. This is existing short-sample reporting drift, not an s140 L2 behavior change; the criterion was not changed.
- **L4 threat:** candidate reports `breach-north` with 2 observed cohort attackers against the 3-member floor and adds `L4/wave/breach-north:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS`. The baseline full audit reports zero fail flags. This remains to be root-caused and fixed.
- **L4 vehicle motion:** candidate LOW `l4-tank` fails at `L4/hull-ground/225`: 272 frames, 13 contacts, 11 cm maximum slide, 9.8 cm P95, 59.3° yaw drift, 6.2 cm lift; worst frame 987. The browser pool failed to start locally (`listen EPERM` on `127.0.0.1:4329`; headless Chromium also failed its Mach port bootstrap), so baseline vehicle comparison and candidate rerun remain outstanding.
- `tests/engine/l4-contact.test.ts` passes (1 test); `npm run typecheck` and `npm run lint` pass.

No runtime fix has been made yet. The next step is to isolate the L4 routing edits responsible for the north-breach cohort and tank-adjacent foot slide, while retaining active L4 wire routing and grounded L7 wrecks. Then rerun the required gates and remote unit suite and update this report.

## Evidence

The concise machine-readable comparison is in [`gate-comparison.json`](gate-comparison.json). Full source logs supplied for batch 113 were read from the scheduler archive. The full baseline threat audit was run at `cc2f7476` using the current harness; its measured L2-12 value and zero-flag result are recorded above.

## Fresh candidate and isolation results

The tank fixture reran successfully on port 5024: HIGH passed and LOW reproduced the exact actor-225 failure. Its contact begins at tick 5307 as an LOD2 runner changes from `get-up` to `infected-search`, then turns beside an evacuation bus. Root travel on the first frame is 0.0222 cm.

The full candidate threat audit completed in about 300 seconds with only the north-breach cohort flag. A focused L4 comparison restoring only `L4Collapse.ts` to `cc2f7476` removed that flag (only the expected partial-level diagnostic notice remained). The candidate file was restored after the run. This isolates the threat regression to the breach-alignment change, but a routing-preserving correction remains open.

Main `792dde65` is merged. Focused L2/L4 and HIGH/LOW tank reruns retain the same failures. A 3 m-first breach landing experiment changed the failure to late first attack and sustained-horde failure; it was rejected and reverted.

## Vehicle foot-contact correction

The cheap world-space foot solver released a turning stance only after 0.5 radians. Releasing at 0.2 radians begins the lifted turn step before the stance strains. Both tank tiers pass; LOW worst P95 falls from 9.8 cm to 3.4 cm, maximum 10.1 cm. Simulation sample count and staged actor travel remain unchanged. Full gate and unit validation remain pending.

Remote `npm test` passes unchanged on retry: 171.7 seconds within the 240-second budget (first attempt timed out at 246.1 seconds). A radius-visible direct-crossing shortcut retained the north-breach cohort failure and was reverted.
