#!/usr/bin/env python3
"""Summarize the read-only six-seed native receipts, retaining failed trials."""
import gzip
import json
from pathlib import Path

out = Path('docs/reports/r17-l7escort/evidence')
results = Path('test-results/r17-l7diff')
tags = ['main', 'focus', 'focus2', 'trail', 'cover', 'shove', 'bite17', 'breakfree', 'rally', 'compact', 'guard', 'contact', 'bite10', 'bite8', 'bite5', 'rescue10', 'final', 'mortal-final']
matrix = {}
for tag in tags:
    rows = []
    for tier in ('low', 'high'):
        for seed in (1, 2, 3):
            path = results / f'escort-{tag}-{tier}-{seed}.json'
            if not path.exists():
                continue
            receipt = json.loads(path.read_text())
            s, final = receipt['summary'], receipt['final']
            trace_path = path.with_name(path.stem + '-trace.json.gz')
            trace = json.loads(gzip.decompress(trace_path.read_bytes())) if trace_path.exists() else {}
            events = trace.get('followerEvents', [])
            losses = [e for e in events if e.get('name') in ('l7.survivor-dead', 'l7.survivor-turned')]
            loss_ticks = {e['actorId']: e['tick'] for e in losses}
            alpha_hits = [e for e in events if e['type'] == 'combat.hit' and e.get('source', {}).get('type') == 'infected.alpha' and e['tick'] <= loss_ticks.get(e['targetId'], float('inf'))]
            rows.append({
                'tier': tier, 'seed': seed, 'mortalPassive': s['mortalPassive'], 'sourceHash': receipt['sourceHash'], 'completed': s['completed'],
                'seconds': s['seconds'], 'deaths': s['deaths'], 'boarded': final['boarded'],
                'startingRoster': len(trace.get('samples', [{}])[0].get('roster', [])),
                'collisionFailures': final['collision']['failures'], 'acceptedCourierDamage': s['acceptedDamage'],
                'courierAttacks': s['courierAttacks'], 'groupAttacks': s['groupAttacks'], 'alphaAttacks': s['alphaAttacks'],
                'courierAPM': s['courierAttacksPerMinute'], 'groupAPM': s['groupAttacksPerMinute'], 'alphaAPM': s['alphaAttacksPerMinute'],
                'losses': len(losses), 'lossesBy30s': sum(e['tick'] <= 1800 for e in losses),
                'lossesWithFatalBite': sum(any(e['type'] == 'outbreak.bite' and e['targetId'] == loss['actorId'] and e['tick'] == loss['tick'] for e in events) for loss in losses),
                'alphaFollowerHits': len(alpha_hits), 'alphaFollowerDamage': sum(e['amount'] for e in alpha_hits),
                'alphaHP': sorted(set(e['hp'] for e in s['alphas'])), 'alphaCount': len(s['alphas']),
                'nativeStateHash': s['nativeStateHash'],
            })
    tiers = {}
    for tier in ('low', 'high'):
        selected = [r for r in rows if r['tier'] == tier]
        tiers[tier] = {'observed': len(selected), 'boarded': [r['boarded'] for r in selected],
            'rescueAndCompletionPass': len(selected) == 3 and all(not r['mortalPassive'] and r['completed'] and r['deaths'] == 0 and r['boarded'] >= 15 and r['startingRoster'] == 24 and r['collisionFailures'] == 0 for r in selected),
            'alphaAPM': sum(r['alphaAttacks'] for r in selected) * 60 / sum(r['seconds'] for r in selected) if selected else None}
        if tag != 'main' and tiers[tier]['alphaAPM'] is not None:
            tiers[tier]['alphaRateAtLeastMain'] = tiers[tier]['alphaAPM'] >= matrix['main']['tiers'][tier]['alphaAPM']
    matrix[tag] = {'rows': rows, 'tiers': tiers}
(out / 'native-matrix.json').write_text(json.dumps(matrix, indent=2) + '\n')
for tag, entry in matrix.items():
    print(tag, ' '.join(f"{tier}={entry['tiers'][tier]['boarded']}" for tier in ('low', 'high')))
