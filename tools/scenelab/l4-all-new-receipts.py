"""Summarize the integrated, pooled L4 review receipts without another browser."""
import json
from pathlib import Path

ROOT = Path('test-results/l4-all-new')
OUT = Path('docs/reports/l4-all-new')
BASE = '82b4a2664'
CONFIGS = ['high-webgl2', 'high-webgpu', 'low-webgl2', 'low-webgpu']

def read(path):
    return json.loads(path.read_text())

def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n')

crowd, battle, comparisons, scenes, weapons, corpses = [], [], [], [], [], []
for config in CONFIGS:
    pair = {}
    for variant in ['old', 'new']:
        folder = ROOT / f'crowd-{variant}-{config}'
        r = read(folder / 'receipt.json')
        assert r['result']['pass'] and len(r['metrics']['actors']) == 30
        if variant == 'old':
            assert r['base'] == BASE
        pair[variant] = {
            'revision': r['revision'],
            'drawsP95': r['metrics']['perf']['drawCalls']['p95'],
            'trianglesP95': r['metrics']['perf']['triangles']['p95'],
            'decodedTextureBytes': r['resources']['decodedBytes'],
            'textureCount': r['resources']['textureCount'],
            'actors': len(r['metrics']['actors']),
            'submittedModelBatches': [b['id'] for b in r['resources']['render']['crowd']['batches'] if b['instances'] > 0],
        }
        r = read(ROOT / f'corpses-{variant}-{config}/corpse-proof.json')
        assert len(r['proof']) == 5 and all(p['solid'] and p['radius'] == 1 and p['occupancyBlocked'] and p['staticsClear'] for p in r['proof'])
        assert r['cut']['relocated'] and r['cut']['cutStrength'] > 0
        corpses.append({'config': config, 'variant': variant, **r})
    crowd.append({'config': config, **pair, 'deltaDecodedBytes': pair['new']['decodedTextureBytes'] - pair['old']['decodedTextureBytes']})
    rows, sample = {}, {'config': config}
    for variant in ['old', 'new']:
        folder = ROOT / f'battle-{variant}-{config}'
        rows[variant] = read(folder / 'receipts.json')
        assert len(rows[variant]) == 4
        if variant == 'old':
            assert all(r['base'] == BASE for r in rows[variant])
        r = read(folder / 'cadence.json')
        c = r['cadence']
        assert c['count'] == 600 and not c['builds'] and c['over200'] == 0
        sample[variant] = {'revision': r['revision'], 'hostLoad': r['hostLoad'], 'p95Ms': c['p95'], 'maxMs': c['max'], 'lateShaderBuilds': c['builds'], 'framesOver200ms': c['over200'], 'drawCalls': c['perf']['drawCalls'], 'triangles': c['perf']['triangles'], 'decodedTextureBytes': rows[variant][-1]['resources']['decodedBytes'], 'frameCount': c['count']}
    frames = []
    for old, new in zip(rows['old'], rows['new']):
        assert old['seconds'] == new['seconds']
        row = {'seconds': old['seconds'], 'sameTick': old['state']['tick'] == new['state']['tick'], 'sameMission': old['state']['mission'] == new['state']['mission'], 'samePhysicalState': old['gameplaySha256'] == new['gameplaySha256'], 'oldPhysicalSha256': old['gameplaySha256'], 'newPhysicalSha256': new['gameplaySha256'], 'sameCorpseLayout': old['state']['layout'] == new['state']['layout']}
        assert row['sameTick'] and row['sameMission'] and row['samePhysicalState'], row
        frames.append(row)
    comparisons.append({'config': config, 'frames': frames})
    battle.append(sample)
    r = read(ROOT / f'story-new-{config}/receipts.json')
    assert len(r) == 7 and all(s['pass'] for s in r)
    scenes.append({'config': config, 'results': r})
    r = read(ROOT / f'guns-new-{config}/receipts.json')
    assert len(r) == 20 and all(s['result']['pass'] for s in r)
    weapons.append({'config': config, 'views': [{'prop': s['prop'], 'yaw': s['yaw'], 'file': s['file'], 'pass': s['result']['pass']} for s in r]})

write('performance.json', {
    'scope': 'Matched 30-figure D-FAIR L4 street and production turn checkpoint, same game code/camera. Old assets from main 82b4a2664 retain the corrected L3 Guard on both sides. Scene Lab preloads its catalog; texture bytes count bound 2D allocations including compressed mip chains, excluding render targets/background. These are neither download bytes nor an isolated production memory total.',
    'timingStatus': 'PERF PENDING: shared host; refresh-capped RAF samples are diagnostic. PO quiet-window gate remains low p95 <= main +1ms and worst of five cold loads <= PROD *1.10.',
    'baselineAssets': BASE,
    'crowd': crowd,
    'productionBattleDiagnostic': battle,
    'productionScope': 'Production L4 turn checkpoint seed3, 30/60/120/180s after turn, zoom1/1.5. Real mission, horde and solid corpses; god/camera-position fixture only, separate from the real-input playthrough.',
})
write('gameplay-comparison.json', {'scope': 'Same production L4 fixture and sim state; only asset manifests/bakes vary. Full physical-state SHA256 includes all entity, collision, mission and RNG snapshots. CorpseLayout is render-only and may change overlap counts with silhouettes.', 'baselineAssets': BASE, 'comparisons': comparisons})
write('runtime-checks.json', {'baselineAssets': BASE, 'scriptedScenes': scenes, 'weaponChecks': weapons, 'corpseChecks': corpses})
print(json.dumps({'configs': len(CONFIGS), 'scriptedSceneChecks': 28, 'weaponViews': 80, 'corpseConfigurations': 8, 'identicalPhysicalStatePairs': 16, 'warmFrames': 4800}))
