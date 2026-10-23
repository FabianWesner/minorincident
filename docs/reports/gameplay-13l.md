# Gameplay 13l — Q-131, Q-135 and asset validation

- Q-131: departure lane plus 2.5 m cleared; the reported wedge and all three steering-offset physics drives pass.
- Q-135: readable arrows and explicit 1 s prompts; [pharmacy](gameplay-13l/L5-rosa-first-frame.png) and [bus](gameplay-13l/L5-sam-first-frame.png) first-frame pixel checks pass. L5 tuning is unchanged.
- Assets: four school-bus node-contract reports and 18 uncompressed deliveries fixed; full validator: 1,262 reports, zero failures.
- Remote: 2,502 passed, 9 skipped, zero failures; at most four workers.
- Smoke: 6 simulation and 31 browser checks passed; at most two browser workers.
- Full invariants: 27 remote simulation tests, build and all 12 Mac WebGPU checks passed. Typecheck and lint passed.
- Fixes: `2b91a6c2a`, `e90965331`; marker fixture: `84ef69aac`. [Verification receipts](gameplay-13l/verification.json).
