"""Compact the batch's release-ab receipts without discarding failed samples."""
import json
import math
import sys
import gzip
import hashlib
from collections import Counter
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/reports/batch51-qa/perf')
raw_root = Path(sys.argv[2]) if len(sys.argv) > 2 else root if (root / 'low').exists() else Path('test-results/batch51/perf-raw')
label = sys.argv[3] if len(sys.argv) > 3 else 'Batch 51'
root.mkdir(parents=True, exist_ok=True)
rows = []
for tier in ('low', 'high'):
    for path in sorted((raw_root / tier / 'strips/webgpu').glob('L*.json')):
        loads = json.loads((raw_root / tier / 'loads' / path.name).read_text())
        for source in json.loads(path.read_text()):
            f = source.get('performance', {})
            samples = source.get('samples', [])
            elapsed, spikes = 0, []
            charge_frames = f.get('chargeFrames', [])
            charge_windows = {}
            for second in (43, 55):
                indices = [i for i, c in enumerate(charge_frames) if c['charge'] // 60 == second]
                values = sorted(f['frames'][i] for i in indices)
                if values:
                    charge_windows[str(second)] = dict(frames=len(values), maxMs=values[-1], p95Ms=values[math.ceil(len(values) * .95) - 1],
                                                       fromSeconds=charge_frames[indices[0]]['at'] / 1000,
                                                       toSeconds=charge_frames[indices[-1]]['at'] / 1000)
            for index, delta in enumerate(f.get('frames', [])):
                elapsed += delta
                if delta >= 66 and not f.get('nonGameplayFrames') and not source.get('failure'):
                    nearest = min(samples, key=lambda s: abs(s['wallSeconds'] - elapsed / 1000))
                    spikes.append(dict(atSeconds=round(elapsed / 1000, 3), ms=delta,
                                       objective=nearest.get('objective'), tick=charge_frames[index]['tick'] if charge_frames else nearest.get('tick'),
                                       chargeTicks=charge_frames[index]['charge'] if charge_frames else None,
                                       builds=[b for b in f['builds'] if abs(b['at'] - elapsed) < 1000]))
            row = dict(level=source['level'], quality=tier, side=source['side'],
                       sourceBuild=source.get('sourceBuild'), rawSource=source.get('rawSource'),
                       hardware=source.get('hardware'), measuredAt=source.get('measuredAt'),
                       backend=sorted(set(s['backend'] for s in samples)),
                       sampledQuality=sorted(set(s['quality'] for s in samples)),
                       durationMs=f.get('durationMs'), frames=len(f.get('frames', [])),
                       frameHistogram=dict(Counter(str(round(ms, 1)) for ms in f.get('frames', []))),
                       nonGameplayFrames=f.get('nonGameplayFrames', 0), terminalInputWithheld=source.get('terminalInputWithheld', False),
                       p95Ms=f.get('p95Ms'), maxMs=f.get('maxMs'), spikes=spikes, chargeWindows=charge_windows,
                       lateMaterialBuilds=[b for b in f.get('builds', []) if not b['loading']] if not f.get('nonGameplayFrames') else [],
                       drawnPeak=max((s.get('drawn',0) for s in samples),default=0),
                       sampledScenarios=sorted(set(s.get('scenario',source['level']) for s in samples)),
                       errors=source.get('errors'), failure=source.get('failure'), diagnostic=source.get('diagnostic', False),
                       startObjective=samples[0]['objective'] if samples else None,
                       endObjective=samples[-1]['objective'] if samples else None,
                       infectedAttacks=sum(e['type'] == 'infected.attack' for e in f.get('events', [])),
                       loads={r['temperature']:dict(seconds=r['ms']/1000,
                              firstFrameMaxMs=max(r['frames'], default=0), errors=r['errors'],
                              stages=r['stages'], measures=[m for m in r.get('loadMeasures', []) if m['name'].startswith(('level:', 'view:', 'transition:'))])
                              for r in loads if r['side'] == source['side'] and r['level'] == source['level']})
            rows.append(row)
            if '--frames' in sys.argv[4:]:
                trace_path = Path('frames') / f"{source['level']}-{tier}-{source['side']}.json.gz"
                trace = {key: source.get(key) for key in ('side', 'level', 'tier', 'hardware', 'measuredAt', 'control', 'terminalInputWithheld', 'errors', 'failure')}
                trace['performance'] = {key: f.get(key) for key in ('startedAt', 'tick', 'level', 'durationMs', 'endTick', 'nonGameplayFrames', 'frames', 'chargeFrames', 'builds', 'events')}
                trace['samples'] = [{key: sample.get(key) for key in ('wallSeconds', 'tick', 'scenario', 'backend', 'quality', 'phase', 'objective', 'alive', 'drawn')} for sample in samples]
                data = gzip.compress(json.dumps(trace, separators=(',', ':')).encode(), mtime=0)
                (root / trace_path).parent.mkdir(parents=True, exist_ok=True)
                (root / trace_path).write_bytes(data)
                row['frameTrace'] = str(trace_path)
                row['frameTraceSha256'] = hashlib.sha256(data).hexdigest()

comparisons, lines = [], [f'| Level / tier | PROD cold / warm s | {label} cold / warm s | p95 ms PROD → candidate | Max ms PROD → candidate | Late builds PROD → candidate | Result |',
                        '|---|---:|---:|---:|---:|---:|---|']
for number in range(1, 11):
    for tier in ('low', 'high'):
        cell = [r for r in rows if r['level'] == f'L{number}' and r['quality'] == tier]
        if len(cell) != 2:
            lines.append(f'| L{number} {tier} | — | — | — | — | — | NOT MEASURED |')
            continue
        p, c = [next(r for r in cell if r['side'] == side) for side in ('prod', 'candidate')]
        invalid = [r['side'] for r in (p, c) if r['diagnostic'] or r['failure'] or r['errors'] or r['backend'] != ['webgpu'] or r['sampledQuality'] != [tier] or not r['durationMs'] or r['durationMs'] < 60000 or r['nonGameplayFrames']]
        if invalid:
            comparisons.append(dict(level=f'L{number}', quality=tier, failures=['invalid gameplay window'], verdict='NOT CHECKED'))
            lines.append(f'| L{number} {tier} | see load receipt | see load receipt | — | — | — | NOT CHECKED: invalid gameplay window |')
            continue
        failures = []
        for temperature in ('cold', 'warm'):
            seconds = c['loads'][temperature]['seconds']
            if seconds > 6 or seconds > p['loads'][temperature]['seconds'] + .5:
                failures.append(f'{temperature} load')
        if c['p95Ms'] > p['p95Ms'] + 1 + 1e-6:
            failures.append('p95')
        if round(c['maxMs'] / (1000 / 60)) > max(round(p['maxMs'] / (1000 / 60)) + 1, 2):
            failures.append('relative max')
        inherited_spike = c['maxMs'] >= 66 and p['maxMs'] >= 66 and round(c['maxMs'] / (1000 / 60)) <= round(p['maxMs'] / (1000 / 60)) + 1
        if c['maxMs'] >= 66 and not inherited_spike:
            failures.append('new 66+ ms spike')
        comparisons.append(dict(level=f'L{number}', quality=tier, failures=failures, inheritedSpike=inherited_spike, absoluteSpikeFail=c['maxMs'] >= 66, transitionVerdict='FAIL' if c['maxMs'] >= 66 else 'PASS', verdict='FAIL' if failures else 'PASS'))
        load = lambda r: ' / '.join(f"{r['loads'][t]['seconds']:.3f}" for t in ('cold', 'warm'))
        verdict = 'FAIL: ' + ', '.join(failures) if failures else 'PASS A/B; FAIL transition ≥66 ms' if c['maxMs'] >= 66 else 'PASS'
        lines.append(f"| L{number} {tier} | {load(p)} | {load(c)} | {p['p95Ms']:.1f} → {c['p95Ms']:.1f} | {p['maxMs']:.1f} → {c['maxMs']:.1f} | {len(p['lateMaterialBuilds'])} → {len(c['lateMaterialBuilds'])} | {verdict} |")

(root / 'summary.json').write_text(json.dumps(dict(samples=rows, comparisons=comparisons), indent=2) + '\n')
(root / 'table.md').write_text('\n'.join(lines) + '\n')
print(f'{sum(c["verdict"] != "NOT CHECKED" for c in comparisons)}/20 valid cells; {sum(c["verdict"] == "FAIL" for c in comparisons)} FAIL; {sum(c["verdict"] == "NOT CHECKED" for c in comparisons)} NOT CHECKED')
