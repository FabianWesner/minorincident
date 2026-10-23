import gzip, hashlib, json, math, statistics, subprocess
from pathlib import Path
from urllib.request import urlopen

root = Path('docs/reports/load-stalls/evidence')
meta = json.loads((root / 'candidate-build.json').read_text())
for path, expected in meta['sources'].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, path
assert subprocess.check_output(['git', 'rev-parse', 'HEAD:src'], text=True).strip() == meta['srcTree']
assert subprocess.check_output(['git', 'rev-parse', 'HEAD:public'], text=True).strip() == meta['publicTree']
assert meta['bundle'] in urlopen('http://127.0.0.1:4222/').read().decode()
rows = []
frames = 0
for level in ['L1', 'L4', 'L7', 'L8', 'L10']:
    for backend in ['webgpu', 'webgl2']:
        for quality in ['low', 'high']:
            key = f'{level}-{backend}-{quality}'
            summaries = []
            for phase in ['before', 'after']:
                summary = json.loads((root / phase / (key + '-summary.json')).read_text())
                paths = list((root / phase).glob(key + '-[0-9]*.json'))
                assert len(paths) == summary['n'] == 20, (phase, key, len(paths))
                records = [json.loads(path.read_text()) for path in paths]
                assert {item['run'] for item in records} == set(range(20)), (phase, key)
                assert all(not item['diagnostic'] and not item['errors'] for item in records), (phase, key)
                times = sorted(item['ms'] for item in records)
                computed = {'median': statistics.median(times), 'p90': times[math.ceil(len(times)*.9)-1], 'max': max(times), 'maxFrameMs': max(item['maxFrameMs'] for item in records)}
                for name, value in computed.items():
                    assert abs(value-summary[name]) < .000001, (phase, key, name)
                for item in records:
                    assert (item['level'], item['backend'], item['quality']) == (level, backend, quality)
                    if backend == 'webgpu':
                        assert 'webgpu' in item['contexts'] and 'webgl2' not in item['contexts']
                        assert item['adapter']['vendor'] == 'apple' and item['adapter']['architecture'].startswith('metal')
                        assert item['adapter']['fallback'] is False
                    else:
                        assert 'webgl2' in item['contexts'] and 'Apple M4' in item['glRenderer'] and 'Metal' in item['glRenderer']
                    if phase == 'after':
                        assert item['bundle'] == 'http://127.0.0.1:4222/' + meta['bundle']
                        assert len(item['frames']) >= 2
                        assert abs(max(frame['ms'] for frame in item['frames']) - item['maxFrameMs']) < .000001
                        frames += len(item['frames'])
                if phase == 'after':
                    movement = [item for item in records if item['gameplayMs'] >= 10000]
                    assert movement and all(len(item['frames']) >= 100 for item in movement)
                    assert summary['max'] <= 6000 and summary['maxFrameMs'] <= 200 and summary['gate'] == 'PASS', key
                summaries.append(summary)
            before, after = summaries
            assert after['median'] <= before['median'], key
            rows.append({'configuration': key, 'nBefore': 20, 'nAfter': 20, 'before': {k: before[k] for k in ['median','p90','max']}, 'after': {k: after[k] for k in ['median','p90','max']}, 'maxFrameMs': after['maxFrameMs'], 'gate': 'PASS'})
smoke = json.loads((root / 'smoke-final.json').read_text())['stats']
assert smoke['expected'] == 31 and not smoke['unexpected'] and not smoke['flaky'] and not smoke['skipped']
assert json.loads((root / 'smoke-final-build.json').read_text())['sourceHash'] == meta['sourceHash']
replays = json.loads((root / 'l10-entry/summary.json').read_text())
assert len(replays) == 4
assert all(not value['hitches'] and value['max'] <= 200 and value['playableFrames'] > 10000 for value in replays.values())
assert json.loads((root / 'l10-entry/build.json').read_text())['sourceHash'] == meta['sourceHash']
remote = json.loads((root / 'remote-final-build.json').read_text())
assert remote['exitCode'] == 0 and remote['remoteSourcesVerified'] and remote['sources'] == meta['sources']
assert remote['sourceHash'] == meta['sourceHash']
assert '[remote] done exit=0' in gzip.decompress((root / 'remote-final.log.gz').read_bytes()).decode()
result = {'gate': 'PASS', 'runtimeCommit': meta['sourceCommit'], 'sourceHash': meta['sourceHash'], 'bundle': meta['bundle'], 'configurations': rows, 'nBefore': 400, 'nAfter': 400, 'worstCandidateMs': max(row['after']['max'] for row in rows), 'maxPostCardFrameMs': max(row['maxFrameMs'] for row in rows), 'coldLoadRecordedFrames': frames, 'lampReplayFrames': sum(value['playableFrames'] for value in replays.values()), 'lampReplayMaxFrameMs': max(value['max'] for value in replays.values()), 'remoteTestsPassed': remote['testsPassed'], 'smokeChecksPassed': 31}
(root / 'final-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'configurations'}, indent=2))
