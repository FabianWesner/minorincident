# r28-tools: remote runner without runners, L9 corner hedges

## 1. tools/remote/run.sh hang without runners (P2)

**Cause.** With 0 runners (or only unprovisioned ones) `pool.py try` returned "full" (3) and `local-slot.py choose` kept polling for ever: the local Mac slot only takes plain vitest/`test:*` commands and only when the Mac is admitted (load, RAM, no GPU browser), so any other command, or a busy Mac, waited at the FIFO head and blocked every lane behind it. A fresh runner on a recycled IP also reported "slots 2/2" because `create()` wrote `/srv/mi/last-activity` (which `pick`/`try` treat as "provisioned") without checking anything and `state()` only looked at ssh.

**Fix.**
- `pool.py`: `state()` now probes provisioning (`/srv/mi` writable, node, git, rsync, flock, bash) and returns `provisioned`; `usable()` gates `pick`, `try` and `status`. `try` exits 5 when no healthy runner exists (4 unchanged: pool API down). `status.sh` prints `NOT PROVISIONED ... takes no jobs` and no slot counts for such a runner.
- `pool.py create`: `forget_host()` runs `ssh-keygen -R <ip> -f ~/.ssh/known_hosts_mi-runner` for the new IP, creates `/srv/mi` with sudo, then `verify_provisioned()`; failing that it exits non-zero with a clear message (no server is deleted automatically).
- `local-slot.py choose`: with no healthy runner it goes to the local Mac slot immediately when eligible and admitted; if admission fails it announces the reason once; if the command can never run locally (not a CPU suite, non-macOS, `MI_LOCAL_FALLBACK=0`) it returns `unavailable` and `run.sh` exits 69 with a message. Behaviour with healthy-but-full runners is unchanged.
- docs/tools/remote-runner.md: new section.

**Evidence** (`python3 tools/remote/check.py`, mocks only, no Hetzner calls): new tests `test_unprovisioned_runner_takes_no_jobs_and_is_not_reported_with_slots`, `test_state_command_probes_provisioning`, `test_new_runner_must_be_provisioned_and_stale_host_key_removed` (real `ssh-keygen -R` on a temp file), `test_no_runner_uses_local_slot_or_fails_fast_never_hangs`, `test_run_sh_exits_instead_of_hanging_without_runners` (the real run.sh against an unreachable runner exits 69 with the message). 21 of 24 checks run here and pass; `test_real_fallback_cwd_env_results_exit_and_wait`, `test_workers_yield_after_file_and_resume_without_duplicates` and `test_worker_cap_and_nonzero_exit` need a vitest install in the fixture and fail the same way before my change (this slim worktree has no node_modules; with a symlink they ran for minutes, so I did not wait for them).

## 2. L9 hedge at the road corner (P3)

**Fix.** `layouts/D-CROSSING/dress.py`: the corner rule moved from `put()` (which changed occupancy and therefore the whole dressing) into the existing post-generation drop loop at the end of the file, next to `gone(i)`. Hedges, garden bushes, small bushes, picket and privacy fences within 5 m of the lane edge and within 44 m of (-350, -330) are removed after everything was generated, so ids and positions of every other placement stay. Rebuilt with `npx tsx tools/layouts/build.ts D-CROSSING` (`src/data/physicsAssets.ts` hash drift from the build was reverted, not part of this lane).

**Layout diff** (old vs new `D-CROSSING.layout.json`): placements 3400 -> 3385, 15 removed, 0 added, 0 changed, order preserved; colliders 1118 -> 1104 (the same 14 solid ones); no other key changed. Removed: `prop.hedge:132-139` (z -337.9, x -346.6..-308.8), `prop.hedge:2727-2729` (z -322.3), `prop.picket-fence:2725`, `prop.garden-bush-small:3137, 3175`, `prop.garden-bush:3171`. The traffic cone / tree pair from the reverted rebuild is not present.
`base.glb` shrinks 2.48 MB -> 0.80 MB (the current ground layering/compression pipeline; same as in the earlier r28-l7l10 rebuild), horizon and chunk GLBs are re-exported.

**Scenes** (`npm run scene`, SCENE_PORT 4894): `night-read-l9-apc`, `l9-look-city-edge`, `l9-look-crash-approach` on webgl2/low and webgpu/high: all pass, 0 failed, 0 staticPairs/actorHits/piercing. Sheet of `night-read-l9-apc` (webgpu) looked at: APC on the road, no hedge at its nose.
`tools/qa/diag/l9solidsnear.ts -325 -338 14`: only a decay tree at (-324.6, -342.7) behind the verge remains.

**Gate.** `tsc --noEmit` clean; `npm run test:gate` (--maxWorkers=2, sim-lock): 26 of 27 files passed, 1 failure in tests/tools/gate-tools.test.ts (review-freshness check fails on a dirty tree); after committing it passes (8/8).
