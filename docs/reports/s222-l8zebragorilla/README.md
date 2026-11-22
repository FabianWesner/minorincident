# s222 — zebra and gorilla fights

## Feel notes

- **Zebra herd:** Read the shared hoofbeat tell and clear the dust lane as the herd commits. The fence makes its pass turn into a slowed straggler window; watch behind you for the separate rear kick. Each animal now has 360 authored HP, so a single close shotgun blast cannot erase a zebra.
- **Gorilla:** Interrupt the chest beat to earn a stagger window. If it completes, the gorilla enrages and its later attacks hit harder. Break line of sight for the ledge barrage, leave the pound radius, and punish after the slam or bluff stop. Its authored HP is 1,200. The close grab-and-slam is distinct from the ground-pound, and its throw barrage starts from a short climb to the house ledge before it drops back into the duel.

## Evidence

- `tests/nightly/mission-interactions.test.ts`: passed after moving per-cage story latches into serialized L8 state.
- `npm run typecheck`, `npm run lint`: passed.
- Latest focused L8 threat audit (`test-results/qa-threat-s222-pathfind`): skilled route completes. It still reports `step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS`, `step/escape:SLOW_FOLLOWER:354`, and `wave/tunnel-breach:WAVE_FIRST_ATTACK_OVER_20_SECONDS`. Passive route also has L8 follower flags and the kiting probe does not land hits. The full `npm run qa:threat` zero-flag gate remains open.
- `tests/nightly/mission-interactions.test.ts`: passed on the latest source. The separate `tools/qa/l8-boss-proof.ts` cue probe remains failing at its `escape.status === 'active'` assertion before reaching the animal proofs.
- Full remote unit suite: not run; `tools/remote/run.sh` reports that no healthy Hetzner runner is provisioned.
- D-ZOO rebuild: blocked; Blender 5.2.2 crashes during Metal backend initialization in this restricted session. The generated layout was not hand-edited.
- Native HIGH/LOW move and habitat captures, visual review, and contact sheet: outstanding.

This report records implementation intent and current validation only. It does not claim capture review or full acceptance.
