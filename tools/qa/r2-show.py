import json, sys
path = sys.argv[1]
models = sys.argv[2].split(',')
mode = sys.argv[3] if len(sys.argv) > 3 else 'max'
for r in json.load(open(path)):
    if r['key'].split(':')[0] in models:
        print(r['key'].split(':')[0], r['name'], 'hipY', r.get('hipY'), {k: (round(v['min'], 2), round(v['max'], 2)) for k, v in r['extents'].items()})
