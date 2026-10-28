# L9 all-new figures — rollout record
Status: conversion/build complete for six old rigid regular-infected identities; rollout acceptance is **incomplete** pending visual/runtime gates.
Census: [census.json](./census.json); 11 authored groups (78 runners, 2 Alphas); L8 passengers and zoo-staff bases checked against the v2 manifest; animals excluded.
Converted: `inf.jogger`, `inf.cashier`, `inf.delivery-driver`, `inf.suburban-mom`, `inf.bbq-dad`, `inf.bathrobe-neighbor`; no paid HF credits (€0).
Per L1 builder caps: each LOD file ≤600/250/150 kB; triangle caps are source registered values, with LOD1/2 hard-capped by each source record.
Built LOD0/1/2 triangles: jogger 6022/2517/909; cashier 5983/2505/893; delivery-driver 5982/2496/898.
Built LOD0/1/2 triangles: suburban-mom 6487/2786/1051; bbq-dad 5549/2350/835; bathrobe-neighbor 6018/2523/913; validator rows report zero errors.
`npm run typecheck`, `npm run lint`, `npm test` (144/150 budget) passed; direct `tools/assets/validate.ts` passed.
`test:smoke`, `scene:gate`, and L9 playtest are blocked by sandbox `listen EPERM` on the required shared browser/preview pool; pool log reports 127.0.0.1:4329.
No sheets, 30-figure crowd, scripted-scene captures, showcase image, or visual review are available; no perf measurement (pending).
Capture count: 0/14. Best showcase sources: pending captures; `l9-crowd-old-new.jpg` has not been produced.
