"""Lists the static clipping pairs of a layout sweep run: python3 tools/scenelab/sweep-summary.py test-results/sweep-after"""
import glob, json, sys

root = sys.argv[1] if len(sys.argv) > 1 else 'test-results/scenes'
total = 0
for path in sorted(glob.glob(root + '/*/metrics.json')):
    m = json.load(open(path))
    static = m.get('clipping', {}).get('static', [])
    total += len(static)
    print('%s: %d' % (path.split('/')[-2], len(static)))
    for p in static:
        print('   %s x %s  (%s / %s)  tris %s  region %s' % (p['a'], p['b'], p.get('assetA', ''), p.get('assetB', ''), p.get('intersectingTriangles'), p.get('regionCm')))
print('total', total)
