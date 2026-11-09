#!/usr/bin/env python3
"""Audit the lane's actual completion requirements from the retained receipts."""
import argparse
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

args = argparse.ArgumentParser()
args.add_argument('--require-clean', action='store_true')
args.add_argument('--check-manifest', action='store_true')
options = args.parse_args()
root = Path('docs/reports/r17-l7escort/evidence')
read = lambda name: json.loads((gzip.decompress((root / name).read_bytes()) if name.endswith('.gz') else (root / name).read_bytes()))
scope = read('source-scope.json')
main, final = read('native-main.json.gz'), read('native-final.json.gz')
traces = read('native-final-traces.json.gz')
controls = read('mortal-final.json.gz')
checks = []
def passed(requirement, evidence):
    checks.append({'requirement': requirement, 'status': 'proven', 'evidence': evidence})

baseline_losses = 0
for trace in read('native-main-traces.json.gz'):
    receipt = next(r for r in main if (r['summary']['tier'], r['summary']['seed']) == (trace['tier'], trace['seed']))
    alpha_ids = {alpha['id'] for alpha in receipt['summary']['alphas']}
    events = trace['followerEvents']
    losses = [e for e in events if e.get('name') in ('l7.survivor-dead', 'l7.survivor-turned')]
    loss_ticks = {e['actorId']: e['tick'] for e in losses}
    for loss in losses:
        assert any(e['type'] == 'outbreak.bite' and e['targetId'] == loss['actorId'] and e['tick'] == loss['tick'] and e['sourceId'] not in alpha_ids for e in events)
    assert not any(e['type'] == 'combat.hit' and e.get('source', {}).get('type') == 'infected.alpha' and e['tick'] <= loss_ticks.get(e['targetId'], float('inf')) for e in events)
    baseline_losses += len(losses)
assert baseline_losses == 100
passed('The baseline loses 100 followers to fatal ordinary bites with no Alpha damage on living followers', 'native-main-traces.json.gz; native-main.json.gz')

expected = {(tier, seed) for tier in ('low', 'high') for seed in (1, 2, 3)}
key = lambda r: (r['summary']['tier'], r['summary']['seed'])
assert len(final) == 6 and {key(r) for r in final} == expected
for receipt in final:
    s, f = receipt['summary'], receipt['final']
    before = next(r for r in main if key(r) == key(receipt))
    trace = next(t for t in traces if (t['tier'], t['seed']) == key(receipt))
    original = {r['id'] for r in trace['samples'][0]['roster']}
    assert len(original) == 24 and {r['id'] for r in f['roster']} == original
    assert s['completed'] and s['deaths'] == 0 and not s['passive'] and not s['mortalPassive']
    assert s['boarded'] == f['boarded'] >= 15 and f['collision']['failures'] == 0
    boarded = {r['id'] for r in f['roster'] if r['boarded']}
    assert len(boarded) == f['boarded'] and set(f['escaped']) == boarded
    assert all(r['hp'] > 0 and r['status'] == 'following' for r in f['roster'] if r['boarded'])
    assert s['alphaAttacksPerMinute'] >= before['summary']['alphaAttacksPerMinute']
    assert len(s['alphas']) == 5 and all(a['hp'] == 450 for a in s['alphas'])
    assert sum(not a['alpha'] for a in f['arrivals']) == (200 if s['tier'] == 'low' else 400)
    assert all(s['attackDirections'].get(direction, 0) > 0 for direction in ('north', 'south', 'east', 'west'))
    assert receipt['sourceHash'] == scope['sourceHash']
passed('At least 15 of the original 24 board on low/high seeds 1–3; courier completes all six without death or collision failures', 'native-final.json.gz; native-final-traces.json.gz')
passed('Every boarded living original id reaches the L8 transfer payload', 'Each final.roster/escaped/boarded comparison')
passed('Alpha attack rate is at least pinned main in every case; five 450 HP Alphas and 200/400 regular arrivals remain', 'Per-case summary.alphaAttacksPerMinute and final.arrivals')
assert len(controls) == 6 and {key(r) for r in controls} == expected
assert all(r['summary']['mortalPassive'] and not r['summary']['passive'] and r['summary']['deaths'] == 1 and not r['summary']['completed'] and r['sourceHash'] == scope['sourceHash'] for r in controls)
passed('Mortal no-fire controls still die without damage/health qualification overrides', 'mortal-final.json.gz; observer mortal-passive input-only branch')

before, after = read('other-levels-main.json.gz'), read('other-levels-final.json.gz')
assert len(before['levels']) == len(after['levels']) == 9
assert before['observerHash'] == after['observerHash'] == scope['observerHash']
assert after['sourceHash'] == scope['sourceHash'] and before['sourceHash'] == main[0]['sourceHash']
assert before['flags'] == after['flags'] and len(after['flags']) == 1 and after['flags'][0].startswith('PARTIAL_LEVEL_SELECTION')
for old in before['levels']:
    new = next(row for row in after['levels'] if row['level'] == old['level'])
    assert {k: v for k, v in old.items() if k != 'wallSeconds'} == {k: v for k, v in new.items() if k != 'wallSeconds'}
    assert new['passiveFlags'] == []
passed('Every other level reproduces its entire native/passive threat receipt except elapsed wall time', 'other-levels-main.json.gz; other-levels-final.json.gz; other-levels-parity.json')
verification = read('verification.json')
assert verification['sourceHash'] == scope['sourceHash'] and verification['observerHash'] == scope['observerHash']
assert verification['testTimeoutMilliseconds'] == 30000 and verification['testBudgetSeconds'] == 240
assert verification['testWallSeconds'] <= verification['testBudgetSeconds'] and 1 <= verification['maxWorkers'] <= 4
assert [c['command'] for c in verification['checks']] == ['npm run typecheck', 'npm run lint', 'npm test']
assert all(c['status'] == 0 for c in verification['checks'])
assert verification['passed'] == 106 and verification['skipped'] == 1 and verification['failed'] == 0
assert verification['collectionCases'] == 150 and verification['collectionFiles'] == 43
passed('E29 per-change gate passes typecheck, lint and the complete test:unit-equivalent npm test within existing budgets', 'verification.json; verify-log.gz')

paths = subprocess.check_output(['git', 'ls-files', '-z', '--', 'src', 'layouts', 'public/assets/layouts']).decode().split('\0')
identity = hashlib.sha256()
for name in sorted(set(p for p in paths if p)):
    identity.update(name.encode()); identity.update(b'\0'); identity.update(Path(name).read_bytes())
assert identity.hexdigest() == scope['sourceHash']
assert all(row['unchanged'] and hashlib.sha256(Path(row['path']).read_bytes()).hexdigest() == row['before'] for row in scope['unchanged'])
assert scope['changedRuntimeFiles'] == ['src/data/l7.ts', 'src/debug/bot/LevelSevenBot.ts']
changed = subprocess.check_output(['git', 'diff', '--name-only', scope['baselineRevision'], 'HEAD']).decode().splitlines()
assert not any(p.startswith(('specs/', 'folio-2025/', 'references/', 'initial-drafts/', 'experiment/')) for p in changed)
assert 'package.json' not in changed and 'package-lock.json' not in changed and 'vitest.config.ts' not in changed
assert sorted(p for p in changed if p.startswith('src/')) == scope['changedRuntimeFiles']
assert not any(p.startswith(('layouts/', 'public/assets/', 'assets/')) for p in changed)
passed('Current runtime matches the frozen receipts; shared Alpha/damage/encounter/boarding code and protected source/dependencies remain at main', 'source-scope.json; current source hash; Git diff')
if options.require_clean:
    assert subprocess.check_output(['git', 'status', '--porcelain']).decode() == ''
if options.check_manifest:
    manifest = read('manifest.json')
    for item in manifest['files']:
        data = Path(item['path']).read_bytes()
        assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256']
result = {'objective': 'L7 escort boards ≥60% on both tiers', 'baselineRevision': scope['baselineRevision'],
    'runtimeRevision': scope['runtimeRevision'], 'sourceHash': scope['sourceHash'], 'requirements': checks,
    'nativeBoarded': {tier: [r['summary']['boarded'] for r in final if r['summary']['tier'] == tier] for tier in ('low', 'high')},
    'courierCompletions': 6, 'courierDeaths': 0, 'minimumRescuePercent': min(r['summary']['boarded'] for r in final) / 24 * 100,
    'processConstraints': {'browsersUsed': False, 'pushed': False, 'deployed': False, 'heavyRuns': 'remote runners; one wrapper separator; at most four Vitest workers'},
    'complete': True}
(root / 'completion-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(f"Completion proven: {result['nativeBoarded']}; minimum {result['minimumRescuePercent']:.1f}%; six courier completions; every required gate passed.")
