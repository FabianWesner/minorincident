# s138-l9grab — L9 evacuation grab escape

Implementation committed through `99dd10e7`. Acceptance remains incomplete.

The active `Outbreak.held()` path now gives unboarded L9 roster members a three-second struggle after Defense complete, including interrupted APC disembarks. It interrupts the native infected hold via `grabHits`, then uses the ordinary saved/flee lifecycle. Zombies retain their stats and remain alive; corpses persist. No relocation or Defense-complete delay was added.

The existing L9 vehicle regression checks the AI-owned hold at ticks 179/180 and an actor outside the walking evacuation list, then requires native boarding within the deadline. Focused native fixtures pass. The latest required remote `npm test` passed: 105 passed, one platform skip, 133.9 seconds.

## Real input results

Three HIGH road runs observed completion at 0.78, 0.35 and 0.35 seconds after Defense complete on earlier revisions. Latest LOW road (`99dd10e7`) observed 0.57 seconds. Latest HIGH shortcut observed 12.88 seconds, with one stationary-infected P2. All use mortal real input and headless WebGPU via the browser pool, ports 5013/5014. Earlier shortcut evidence exposed two gaps subsequently fixed: AI-owned holds bypassed the deadline; interrupted disembarks were absent from the walking list.

## Remaining verification

The latest shortcut census has a same-attacker sampled grab span around 3.24 seconds. State-entry/event timing is needed to distinguish a continuous hold from repeated grabs; do not claim the three-second runtime requirement proven. The HIGH road matrix predates the last two corrections and needs final-revision confirmation. Vehicle-motion gate passed (HIGH/LOW native contact scenarios, exit 0). Final typecheck/lint/E31 and threat receipts need refreshing for the final revision.

I inspected [boarding.jpg](boarding.jpg), showing -1.6, +4.7 and +10.8 seconds around Defense complete, with progress from 0/4 to 3/4. The crowd and frame spacing prevent continuous individual boarding inspection; no claim of complete teleport/clipping verification is made. Raw captures remain under `test-results/playtest/s138-roster-high-shortcut/captures`.

[qa.json](qa.json) contains compact census evidence. No deployment, push or main move occurred.

A further HIGH shortcut with state-entry timing completed in 7.73 seconds, zero issues. Its sole post-defense grabbed sample was Okafor at age 10 ticks. The observer now logs `stateEnteredAt` and `grabAgeTicks`; no simulation state is changed. One-second sampling still cannot prove exact duration of every completed hold.
