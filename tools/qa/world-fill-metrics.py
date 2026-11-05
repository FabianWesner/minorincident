#!/usr/bin/env python3
"""world-fill: one line per captured scene (gate pass, failed gates, worst draw calls / triangles).
usage: world-fill-metrics.py <capture-root>"""
import glob, json, os, sys
for f in sorted(glob.glob(f'{sys.argv[1]}/*/metrics.json')):
    m = json.load(open(f))
    text = json.dumps(m)
    def find(o, key, acc):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == key and isinstance(v, (int, float)): acc.append(v)
                find(v, key, acc)
        elif isinstance(o, list):
            for v in o: find(v, key, acc)
        return acc
    draws, tris = find(m, 'drawCalls', []), find(m, 'triangles', [])
    checks = m.get('checks', {})
    failed = [k for k, v in checks.items() if isinstance(v, dict) and v.get('pass') is False]
    print(f"{os.path.basename(os.path.dirname(f)):48s} pass={checks.get('pass')} draws<={max(draws) if draws else '-'} tris<={max(tris) if tris else '-'} failed={failed} errors={len(m.get('consoleErrors', []))}")
