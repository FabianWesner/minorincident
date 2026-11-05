"""Build the release A/B verdict tables from retained, explicitly selected receipts."""
import json
from pathlib import Path

root = Path('test-results/release-ab-1101')
read = lambda name: json.loads((root / name).read_text())
selected = {1: 'L1-L4-L5', 2: 'L2-L4-L6', 3: 'L1-L2-L3', 4: 'L2-L4-L6', 5: 'L1-L4-L5', 6: 'L2-L4-L6', 7: 'L7-L8', 8: 'L7-L8', 9: 'L9-L10', 10: 'L9-L10'}
engagement = {n: 'L1-L2-L4' if n in (1, 2, 4) else 'L3-L4-L5' if n in (3, 5) else 'L6-L7-L8-L9-L10' for n in range(1, 11)}
notes = {
    1: 'Depot clerk, parcel exchange, lab sign/delivery and later closed-door views match. The accident/garage strip shows infected, bat swings and hit reactions. No floating destination.',
    2: 'Fire engine, real vehicle entry and rescue doors match. The strip starts after a native doors-open event, then follows the escape route. Destination remains the actual police checkpoint.',
    3: 'Army checkpoint and pullback remain populated and readable. Candidate removes the moving corridor guide and points to the actual destination. Defense strip retains visible attackers.',
    4: 'Quartermaster, reception, refugees, alarm and war remain present. The new yellow object is the authored portable light tower with a trailer base. Candidate infected interrupt their scripted approach to engage nearby party members.',
    5: 'Search capture has four PROD rings and zero candidate rings. All five survivors reach shelter in both native runs; both authored Alphas remain. Gate, metro shutter and onward scene match.',
    6: 'Shelter, retreat, gates, leader/column and exit remain functional. Physical movement plus held E acquires and lights the headlamp on both builds. Candidate markers point to the actual platform/gate or a survivor needing help.',
    7: 'Night rocket flight/exhaust and explosion remain visible; candidate flight is brighter. The candidate opens and crosses Northgate. Its native driver moves much farther during the strip; see the material-build investigation below.',
    8: 'Zoo route, pursuing animals, evacuation vehicle and boarding sequence match. The no-fire physical-input run has ten nearby infected drawn simultaneously on both builds, despite off-camera enemies in the escape strip.',
    9: 'APC drive, crash/wreck and onward destination match. The same carried save restores the courier driver plus fifteen seated passengers on both builds. Passengers are hidden while seated, as on PROD.',
    10: 'Research/cure carry, dense finale defense, Mega encounter, cure release, title and scrolling credits complete on both builds. Finale strip shows live attackers, explosions and the stationary console objective.',
}

native = {side: {r['level']: r for r in read(f'sim/{side}/summary.json')} for side in ('prod', 'candidate')}
loads = {(r['side'], r['level'], r['temperature']): r for f in ('loads/L1-L2-L3-L4-L5.json', 'loads/L6-L7-L8-L9-L10.json') for r in read(f)}
handover = {side: {r['from']: r for r in read(f'handovers/{side}/timings.json')} for side in ('prod', 'candidate')}
assert len(loads) == 40
assert all(not r['errors'] for r in loads.values())
assert all(r['completed'] and r['deaths'] == 0 and not r['failures'] for side in native.values() for r in side.values())
assert all(not r['errors'] and r['ms'] <= 6000 for side in handover.values() for r in side.values())
assert all(not r['errors'] and r['result']['hp'] == 0 and r['hits'] > 0 for r in read('weapons/physical-mouse-offaxis-ab.json'))
for backend in ('webgpu', 'webgl2'):
    effects = read(f'effects/{backend}/results.json')
    assert len(effects) == 16 and all(not r.get('failure') and not r['errors'] for r in effects)
for f in (root / 'scenes/webgpu').glob('*.json'):
    assert all(not r.get('failure') and not r['errors'] for r in json.loads(f.read_text()))
for r in read('scenes/webgpu/L9.json'):
    assert r['proof']['transportCount'] == len(r['proof']['occupants']) == 16
    assert len(r['proof']['passengers']) == 15 and r['proof']['driver'] == 1

rows = []
for n in range(1, 11):
    level = f'L{n}'
    strips_file = f'strips/webgpu/{selected[n]}.json'
    strips = {r['side']: r for r in read(strips_file) if r['level'] == level}
    engage_file = f'engagement/{engagement[n]}.json'
    engage = {r['side']: r for r in read(engage_file) if r['level'] == level}
    assert set(strips) == set(engage) == {'prod', 'candidate'}
    row = {'level': level, 'verdict': 'PASS', 'stripReceipt': strips_file, 'engagementReceipt': engage_file, 'visualReview': notes[n]}
    for side in ('prod', 'candidate'):
        s, e, sim = strips[side], engage[side], native[side][level]
        assert not s.get('failure') and not s['errors'] and len(s['images']) == 6
        assert s['performance']['durationMs'] >= 30000
        assert not e.get('failure') and not e['errors']
        cold, warm = (loads[(side, level, t)] for t in ('cold', 'warm'))
        seconds = lambda r: (r['done'] - r['start']) / 1000
        live = [sample['alive'] for sample in s['samples']]
        drawn = [sample['drawn'] for sample in s['samples']]
        # Engagement trace includes civilian figures. Intersect with its known live infected
        # within 10 m; this is an explicit lower bound, never a count of all crowd figures.
        nearby_drawn = max([len(set(t['drawn']) & {v['id'] for v in t['near']}) for t in e['trace']] or [0])
        sample60 = next(v for v in sim['observed']['samples'] if v['seconds'] == 60)
        row[side] = {
            'coldSeconds': seconds(cold), 'warmSeconds': seconds(warm),
            'handoverSeconds': handover[side][level]['ms'] / 1000 if n < 10 else None,
            'completionSeconds': sim['time'], 'spawnCalls': sim['observed']['spawnCalls'],
            'alphaSpawnCalls': sim['observed']['alphaSpawnCalls'], 'at60': sample60,
            'stripAliveRange': [min(live), max(live)], 'stripDrawnRange': [min(drawn), max(drawn)],
            'nearbyDrawnInfectedMax': nearby_drawn,
            'firstPhysicalAttackSeconds': e['result']['firstAttackSeconds'], 'physicalAttacks': e['result']['courierAttacks'],
            'firstNativeRouteAttackSeconds': sim['observed']['firstCourierAttack'],
            'maxFrameMs': s['performance']['maxMs'], 'p95FrameMs': s['performance']['p95Ms'],
            'lateMaterialBuilds': len(s['performance']['builds']),
        }
    assert row['candidate']['coldSeconds'] <= 6 and row['candidate']['warmSeconds'] <= 6
    rows.append(row)
(root / 'comparison.json').write_text(json.dumps(rows, indent=2) + '\n')

lines = ['# Release A/B — PROD 793be6bd3 → main cdaed6356', '',
    '**COMPLETE: L1–L10 PASS for the measured A/B matrix. No new candidate regression was reproduced.** All twenty native level runs complete without deaths or mission failures. All candidate load samples and all eighteen paired campaign handovers meet 6 s. All ten paired 30-second strips were opened and visually inspected. No runtime fix was needed on this lane.', '',
    'This is evidence for the tested builds, routes and samples. It is not an exhaustive proof for every save, input sequence or GPU. No deployment, push or publication was performed.', '',
    '## Builds and method', '',
    '- Baseline: `793be6bd3f36370711fdc239cfef7e26b7c1b0ae`; candidate main: `cdaed6356808f1945fa3aea36a576ae8d6687df6`. Lane commits add QA tooling and evidence only. Both use `BRANCH=qa npm run build`; see [build identities and HTML hashes](builds.json).',
    '- Headless shared browser pool, low quality, 1280×720, DPR 1. WebGPU on Apple Metal 3, non-fallback adapter; WebGL2 effects/title spot check uses `--use-angle=metal`. Candidate port 4901, PROD 4902. Only one baseline worktree was used and removed after capture. The initial restricted runtime was replaced before measurement.',
    '- Loads: real menu click to playable loading-card closure / Begin availability. Cold = isolated HTTP context; warm = reload in that context. OS and GPU driver caches remain shared. One sample per cell, with quiet exclusive pool admission. These are diagnostic timings, not percentile estimates.',
    '- Handovers: actual saved campaign, outgoing level resident, 6 s background-prefetch opportunity, real `continueCampaign` to playable. All nine edges measured on each build. Same carried sixteen-person save exercises L8→L9.',
    '- Full native campaigns: low population, seed 1, each checkout’s own complete policy, no observation god mode. Main changed bot movement/aim and weapon choices, so completion times, damage and total streamed spawn calls are not a controlled difficulty comparison. Each level is run from its appropriate native preset; save continuity is additionally exercised by the handover suite.',
    '- Strips: six full-resolution source frames at approximately 0/6/12/18/24/30 wall seconds plus every RAF interval, input frame and material-build event. Native complete bot, ordinary InputFrames; observation god mode. L2/L4/L6/L7/L8 first reach the beat naturally, avoiding reconstructed checkpoint timing artifacts. L10 captures actual dense console defense.',
    '- Engagement: physical Playwright WASD plus cursor aim, no firing, 1800 native ticks (30 simulation seconds), survival protection only. It approaches native enemies near the route adaptively; it is not an identical geometric replay. L9 uses the native vehicle route because the courier is protected inside the APC. The full native route’s first-attack measurement is reported separately.',
    '- Combat: native damage/actions for ten weapons and front/flank riot fixtures; actual off-axis physical mouse fire for seven requested categories; separate paired weapon-effect frames and full gameplay combat. Isolated combat fixtures freeze/hide unrelated actors, without replacing damage, weapon, armor or hit logic.',
    '- `drawn` intersects live infected IDs with renderer crowd figures. Engagement visible counts below intersect nearby live infected with drawn IDs, a lower bound; civilian figures are excluded. A zero in a strip can mean enemies are off camera, not absent.',
    '- “Late builds” counts `renderer.onNodeBuilderCreated` after capture readiness: material graph builds outside loading. It is a shader-work indicator, not a direct count of GPU `createShaderModule` calls. Frame maxima cover the 30-second gameplay window; loading/handover intervals are in their separate receipts.', '',
    '## Per-level verdicts', '',
    '| Level | PROD cold / warm s | Candidate cold / warm s | Outgoing handover PROD → candidate s | Max frame ms PROD → candidate | Late builds PROD → candidate | Verdict |',
    '|---|---:|---:|---:|---:|---:|---|']
for row in rows:
    p, c = row['prod'], row['candidate']
    hand = f"{p['handoverSeconds']:.3f} → {c['handoverSeconds']:.3f}" if p['handoverSeconds'] is not None else 'credits; no L11'
    lines.append(f"| [{row['level']}](#{row['level'].lower()}) | {p['coldSeconds']:.3f} / {p['warmSeconds']:.3f} | {c['coldSeconds']:.3f} / {c['warmSeconds']:.3f} | {hand} | {p['maxFrameMs']:.1f} → {c['maxFrameMs']:.1f} | {p['lateMaterialBuilds']} → {c['lateMaterialBuilds']} | **PASS** |")
lines += ['', 'PROD L9 retains its 6.044 s cold outlier; candidate is 4.557 s. Small differences of tens of milliseconds are within the resolution of this single-sample audit. L7’s increased material-build count is investigated below.', '',
    '[Cold/warm L1–L5](loads/L1-L2-L3-L4-L5.json) · [L6–L10](loads/L6-L7-L8-L9-L10.json) · [PROD handovers](handovers/prod/timings.json) · [candidate handovers](handovers/candidate/timings.json) · [machine-readable comparison](comparison.json)', '']
fmt = lambda v: 'none within sample' if v is None else f'{v:.2f} s'
for row in rows:
    n = int(row['level'][1:]); level = row['level']; p, c = row['prod'], row['candidate']
    lines += [f'### {level}', '', f"**PASS.** {notes[n]}", '', '| Measurement | PROD | Candidate |', '|---|---|---|',
        f"| Native completion | {p['completionSeconds']:.2f} s; no failure | {c['completionSeconds']:.2f} s; no failure |",
        f"| Entire native run: successful spawn calls / Alphas | {p['spawnCalls']} / {p['alphaSpawnCalls']} | {c['spawnCalls']} / {c['alphaSpawnCalls']} |",
        f"| At 60 s: spawned / alive / spawned Alphas | {p['at60']['spawned']} / {p['at60']['alive']} / {p['at60']['alphaSpawned']} | {c['at60']['spawned']} / {c['at60']['alive']} / {c['at60']['alphaSpawned']} |",
        f"| Strip alive range / drawn infected range | {p['stripAliveRange']} / {p['stripDrawnRange']} | {c['stripAliveRange']} / {c['stripDrawnRange']} |",
        f"| Physical no-fire: first courier attack / attacks | {fmt(p['firstPhysicalAttackSeconds'])} / {p['physicalAttacks']} | {fmt(c['firstPhysicalAttackSeconds'])} / {c['physicalAttacks']} |",
        f"| Nearby infected simultaneously drawn in physical sample (at least) | {p['nearbyDrawnInfectedMax']} | {c['nearbyDrawnInfectedMax']} |",
        f"| Full native route: first courier attack | {fmt(p['firstNativeRouteAttackSeconds'])} | {fmt(c['firstNativeRouteAttackSeconds'])} |",
        f"| Strip max / p95 frame; late material builds | {p['maxFrameMs']:.1f} / {p['p95FrameMs']:.1f} ms; {p['lateMaterialBuilds']} | {c['maxFrameMs']:.1f} / {c['p95FrameMs']:.1f} ms; {c['lateMaterialBuilds']} |", '',
        f"Evidence: [30-second paired strip](review/{level}-strips-webgpu.jpg), [strip receipt]({row['stripReceipt']}), [scripted scenes](review/{level}-scenes-webgpu.jpg), [physical inputs/attacks]({row['engagementReceipt']}), [PROD native state](sim/prod/{level}.json), [candidate native state](sim/candidate/{level}.json).", '']
    if n == 4:
        lines += ['Finite quotas independently pass on main: high 48/72/90/108 (seven breaches: 8/12/15/18 each); low 24/36/48/54 (4/6/8/9 each). Collapse batches 9 high / 6 low. Every authored batch spawns, is admitted and reaches its goal area; all contact archetypes interrupt approach/lure and attack within 3 s. [3 passing exact tests](checks/waves-contact.json), [detailed quota output](checks/waves-contact.log). Different whole-run totals reflect encounter duration/driver behavior, not failed quota assertions.', '']
    if n == 9:
        lines += ['Direct courier attacks are N/A while seated. The 30-second driving strip has no infected in the camera frustum on either build; the full route spawns 51, including one Alpha. The [passenger receipt](scenes/webgpu/L9.json) proves all 16 entities exist, courier is the driver and 15 passengers are seated, hidden and alive on both builds. This separately checks continuity beyond a default L9 preset.', '']

lines += ['## Combat and visible effects', '',
    '| Controlled ordinary infected, 60 HP | PROD kill time | Candidate kill time |', '|---|---:|---:|',
    '| Fists | 2.483 s | 2.483 s |', '| Bat | 0.767 s | 0.767 s |', '| Axe | 0.617 s | 0.617 s |',
    '| Handgun / pistol | 0.783 / 0.617 s | 0.783 / 0.617 s |', '| MP / SMG | 0.517 s | 0.517 s |',
    '| Shotgun | 0.117 s | 0.117 s |', '| Assault rifle / army MG | 0.383 / 0.600 s | 0.383 / 0.600 s |', '| Rocket | 0.500 s | 0.500 s |', '',
    '[Native weapon/riot A/B](weapons/native-ab.json) retains attacks, positive-damage hits and kills. L4 frontal riot: PROD 299 MG attacks over 30 s, zero damage, 225 HP remaining; candidate 37 attacks, 36 positive hits, permanent kill in 3.717 s. Flank kills in 1.800 s on both (17 hits); candidate kill is permanent.', '',
    '[Physical mouse, off-axis](weapons/physical-mouse-offaxis-ab.json): bat 3/3 attacks/hits; handgun 3/3; SMG 4/4; shotgun 1/1; rifle 3/3; MG 5/5, all kill on both. Rocket first shot hits/kills on both; candidate fires a second rocket already in flight before that kill because its cadence is faster. Aim is established before mouse-down; first attack direction agrees on both. No unexplained shot-without-effect was reproduced in these aimed tests. Natural spread, shield reactions and shots still in flight are not counted as missing effects.', '',
    'Paired WebGPU effects inspected: [bat](review/weapon-bat-effects-webgpu.jpg), [handgun](review/weapon-handgun-effects-webgpu.jpg), [SMG](review/weapon-smg-effects-webgpu.jpg), [shotgun](review/weapon-shotgun-effects-webgpu.jpg), [rifle](review/weapon-assault-rifle-effects-webgpu.jpg), [MG](review/weapon-army-mg-effects-webgpu.jpg), [night rocket](review/weapon-rocket-launcher-effects-webgpu.jpg), [title/credits](review/qa-l10-title-credits-effects-webgpu.jpg). Muzzle light, hit reactions, blood/HP change, rocket flight and night explosion remain visible. Red ground outlines are Alpha attack telegraphs, present in both.', '',
    'WebGL2: all seven weapon fixtures plus title/credits run on both builds, 16 cases, zero page errors. [Handgun](review/weapon-handgun-effects-webgl2.jpg), [night rocket](review/weapon-rocket-launcher-effects-webgl2.jpg) and [credits](review/qa-l10-title-credits-effects-webgl2.jpg) were additionally opened for visual spot review. Full [WebGPU](effects/webgpu/results.json) and [WebGL2 receipts](effects/webgl2/results.json) retain backend and damage proof.', '',
    '## Marker audit', '',
    'L1/L2/L4/L5/L7/L8/L9 destination markers stay at authored action locations. L3 candidate has no moving-corridor anchor flags (PROD 45). L5 search has no candidate hint rings. L6’s old walking-ahead guide is replaced by actual platform/gate anchors; the remaining `l6-help` moves with a real survivor/column needing help. Marker transitions between distinct gates are destination changes. L10 `cure-mega` tracks the real boss. No candidate marker was found anchored to or continuously moving with the courier. Raw anchor changes and objective states remain in the per-level native receipts; moving actor destinations are distinguished from the removed route-steering pins.', '',
    '## Investigated differences and discarded attempts', '',
    '1. **Directed infected engage more often.** Main calls `noticeDuringApproach` before `followScript` can return early ([InfectedSystem](../../../src/sim/ai/InfectedSystem.ts)). PROD’s scripted approach could bypass party perception. Physical L4 sample changes from no courier attacks to 25, first at 4.87 s; all authored contact checks pass. Native L4 courier damage rises 17→39 without death/failure. This matches the requested engagement repair.',
    '2. **L4 riot becomes killable from the front.** Main adds shield chip/stress/break windows and a permanent MG finish ([Damage](../../../src/sim/combat/Damage.ts)). The measured front/flank result above confirms the intended fix, with unchanged ordinary-infected kill times.',
    '3. **L7 material builds 39→52.** Candidate native route travels about 115.6 m versus 17.5 m during the same wall window, firing 59 versus 21 rockets. It reaches additional building/corpse variants (`pal_brick`, `pal_woodWarm`, `pal_static-colors:uncut`) absent from PROD’s exposure. Main changed bot movement/aim, rocket cadence 0.8→2.4/s and late-streamed Northgate pose application. This is a route/exposure difference, not evidence of slower equivalent rendering: max frame improves 200→33.3 ms, p95 is 16.7 ms on both. Late work remains nonzero and is retained; no claim of zero runtime shader work is made. [Exact material names/ticks and positions](strips/webgpu/L7-L8.json).',
    '4. **Search/escort differences.** L5 native bot uses different weapons, but all five survivors shelter on both builds. L6 native final escort has 20→22 survivors out of 29, zero courier damage on both. Reconstructed visual checkpoint rosters differ and are not used as a causal survival comparison. Headlamp acquisition is separately exercised through physical input.',
    '5. **Initial measurement fixtures were invalid.** A synthetic L2 `doors` checkpoint at tick zero retained a zero sentinel; it was replaced by naturally reaching doors-open. A reconstructed L4 turn produced the same renderer `.clear`-before-backend-ready error on both builds and advanced only about one simulated second in 30 wall seconds; both were replaced by native-route beats with renderer readiness. The first L1 bat strip reached a result before 30 seconds; the final accident/garage strip remains gameplay for the full window. Raw attempts remain under `strips/webgpu/attempt*` and earlier batch receipts, excluded by the explicit final receipt selection in [comparison.json](comparison.json).',
    '6. **Initial mouse fixture fired before aiming.** It pressed fire while the cursor was still at the top-left, then moved the cursor. Main correctly used the press position for its first queued attack; PROD’s legacy resolver retargeted it. The corrected physical off-axis check moves first, then presses fire, and confirms matching first-shot directions and all kills. Both receipts are retained. This was a harness ordering artifact.',
    '7. **Shared pool admission.** Initial `.mjs` invocations were classified as opaque external jobs and displaced shared leases. The small TypeScript entry point makes the existing pool wrapper recognize these as pool clients. Terminal failed attempts were resumed; final selected rows have zero page errors. Shared pool services and other jobs were left running.', '',
    'No reproduced candidate runtime regression requires a fix in this branch. The candidate already includes the source fixes above; this lane adds reproducible evidence drivers and report artifacts.', '',
    '## Checks and visual review ledger', '',
    '- Both QA production builds succeed. `npm run typecheck`, `npm run lint`, `npm run test:unit` pass: 106 passed / 1 platform skip, 27 files. The skip is the macOS-only legacy lock-fallback test on the Linux runner.',
    '- `npm run verify -- E18` passes its typecheck/lint/test commands: [receipt](checks/verify-E18.json), [log](checks/verify-E18.log). This is the repository per-change gate, not a claim of executing every historical E18 acceptance scenario.',
    '- Exact high/low L4 wave and contact suite: three tests pass, two files, capped at two workers on the Hetzner runner. [JSON](checks/waves-contact.json), [log](checks/waves-contact.log). Unit suite capped at four workers. All remote checks finished before task completion.',
    '- Every L1–L10 strip sheet and every named scene sheet linked above was visually opened and compared. All eight WebGPU effect/title sheets were inspected; WebGL2 handgun/night-rocket/credits were inspected as the fallback spot check. [All 36 paired sheets and source-image paths](review/manifest.json). Per-level review observations are recorded above and in [comparison.json](comparison.json).',
    '- Large browser receipts retain dense raw arrays in adjacent `.full.json.gz` archives; readable JSON omits only dense input-frame/numeric RAF arrays and links its raw archive. Samples, damage events, material names, timings and screenshots remain available. Native simulation receipts are unabridged.', '',
    '## Reproduction', '',
    'Start/discover the daemon with `npm run browser:pool`, then run `E2E_PORT=4901 SCENE_PORT=4902 sh tools/perf/quiet-run.sh npx tsx tools/qa/release-ab.ts <command> [levels/backend]`; inspect `tools/qa/release-ab.ts` for commands (`load`, `scenes`, `strips`, `effects`, `engage`, `handover`, `mouse`). Sources are fixed to PROD 4902 and candidate 4901. Build both revisions with `BRANCH=qa npm run build`, run preview servers on those ports, prepare the baseline worktree with `tools/worktree-setup.sh`, and cap GPU browsers at two. Native sim driver is `tools/qa/release-ab-sim.mjs`, run within each checkout so imports resolve to that revision. `release-ab-sheets.py` regenerates pairs; `release-ab-report.py` validates the final matrix and regenerates this report. No deploy command is part of this workflow.', '']
(root / 'README.md').write_text('\n'.join(lines))
print('Validated 10 paired levels, 40 loads, 18 handovers, 14 physical weapon kills, 32 renderer cases; wrote report.')
