"""Recompute actual physical-input bicycle measurements; retain rejection controls."""
import copy, gzip, hashlib, json, math
from pathlib import Path
root = Path('docs/reports/sweep-a2')
runs = [json.loads(gzip.decompress((root / f'bike-{tier}-fence-ledger.json.gz').read_bytes())) for tier in ['low','high']]
def measure(run):
    commands = {c['command']['label']: c for c in run['commands']}
    caps = {c['label']: c['state'] for c in run['captures']}
    def samples(label):
        return [s for b in commands[label]['batches'] for s in b['samples']]
    road = samples('asphalt-ride') + samples('forward')
    streak = best = 0
    for s in road:
        streak = streak + 1 if s['mounted'] and s['carrying'] and abs(s['metresPerSecond']-7.5)<.02 else 0
        best = max(best, streak)
    def delta(label):
        a = samples(label)
        return math.atan2(math.sin(a[-1]['heading']-a[0]['heading']), math.cos(a[-1]['heading']-a[0]['heading']))
    reverse = [s for s in samples('reverse') if s['speed'] < -7.49 and abs(s['metresPerSecond']-7.5)<.02]
    wall, fence = caps['wall-dismount'], caps['fence-dismount']
    wall_box = next(w for w in wall['walls'] if w['id'].startswith('bld.courier-depot'))
    fence_box = next(w for w in fence['walls'] if w['id']=='prop.privacy-fence:85')
    # Both endpoints outside the same separating half-plane means their whole segment stays on that side.
    same_wall = min(wall['player']['z'],wall['bike']['at']['z']) > wall_box['max'][1]
    same_fence = min(fence['player']['x'],fence['bike']['at']['x']) > fence_box['max'][0]
    near_fence = 0 < fence['player']['x']-fence_box['max'][0] < 1.5 and fence_box['min'][1]-1 < fence['player']['z'] < fence_box['max'][1]
    valid = not run.get('failure') and best>=60 and delta('left')<-.2 and delta('right')>.2 and len(reverse)>=60 and same_wall and same_fence and near_fence and not wall['bike']['mounted'] and not fence['bike']['mounted']
    return {'tier':run['tier'],'speedActualMetresPerSecond':7.5,'consecutiveCruiseTicks':best,'leftHeadingDelta':delta('left'),'rightHeadingDelta':delta('right'),'fullReverseTicks':len(reverse),'wall':wall,'fence':fence,'sameWallSide':same_wall,'sameFenceSide':same_fence,'nearActualFence':near_fence,'pass':valid}
def qualify(rs):
    return len(rs)==2 and sorted(r['tier'] for r in rs)==['high','low'] and len({r['sourceHash'] for r in rs})==1 and all(measure(r)['pass'] for r in rs)
controls=[]
def reject(name, changed): controls.append({'test':name,'pass':not qualify(changed)})
reject('missing quality',runs[:1])
r=copy.deepcopy(runs); r[1]['tier']='low'; reject('duplicate quality',r)
r=copy.deepcopy(runs); r[0]['failure']='expired lease'; reject('expired trial',r)
r=copy.deepcopy(runs)
for c in r[0]['commands']:
    for b in c['batches']:
        for s in b['samples']: s['metresPerSecond']=0
reject('configured speed without actual movement',r)
r=copy.deepcopy(runs)
next(c for c in r[0]['captures'] if c['label']=='fence-dismount')['state']['bike']['at']['x']=8
reject('bicycle opposite fence side',r)
r=copy.deepcopy(runs)
next(c for c in r[0]['captures'] if c['label']=='wall-dismount')['state']['bike']['at']['z']=-40
reject('bicycle opposite wall side',r)
r=copy.deepcopy(runs)
next(c for c in r[0]['captures'] if c['label']=='fence-dismount')['state']['player']['x']=20
reject('distant fence mislabeled near',r)
assert qualify(runs) and all(c['pass'] for c in controls)
result={k:runs[0][k] for k in ['sourceHash','observerHash','revision']}
result.update({'method':'Actual displacement per fixed60Hz simulation tick after physical WASD/E. No frame-performance measurement. Native input prefix only obtains parcel; read-only world coordinates explicitly guide physical routes. Final low/high trials alone supply full-row proof. Mount reposition excluded from speed. All68 images personally reviewed separately.','runs':[measure(r) for r in runs],'controls':controls,'pass':True})
(root/'L1-11-measurement.json').write_text(json.dumps(result,indent=2)+'\n')
print([(r['tier'],r['consecutiveCruiseTicks'],r['leftHeadingDelta'],r['rightHeadingDelta'],r['fullReverseTicks']) for r in result['runs']])
