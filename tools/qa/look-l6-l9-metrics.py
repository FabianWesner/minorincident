#!/usr/bin/env python3
"""look-l6-l9: pass / draw calls / triangles / clipping per capture, tag by tag. usage: look-l6-l9-metrics.py <tag> [tag2 ...]"""
import glob, json, os, sys
root = 'test-results/look'
def load(tag):
    out = {}
    for p in sorted(glob.glob(f'{root}/{tag}-*-webgpu/*/metrics.json')):
        m = json.load(open(p)); c = {k['name']: k['value'] for k in m['checks']['checks']}
        name = os.path.basename(os.path.dirname(p)).replace('-webgpu', '')
        out[name] = f"{'ok' if m['checks']['pass'] else 'FAIL'} d{c.get('drawCallsMax')} t{round((c.get('trianglesMax') or c.get('trianglesMaxLow') or 0) / 1000)}k c{c.get('clipping')}"
    return out
tags = sys.argv[1:]
data = [load(t) for t in tags]
print(f'{"scene":44s}', '  '.join(f'{t:22s}' for t in tags))
for name in sorted(data[0]):
    print(f'{name:44s}', '  '.join(f'{str(d.get(name)):22s}' for d in data))
