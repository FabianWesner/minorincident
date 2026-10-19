import json, sys, collections
p = json.load(open(sys.argv[1]))
nodes = {n['id']: n for n in p['nodes']}
self_t = collections.Counter()
dt = p['timeDeltas']
for s, d in zip(p['samples'], dt):
    n = nodes[s]['callFrame']; self_t[(n['functionName'], n['url'].split('/')[-1], n['lineNumber'])] += d
tot = sum(dt)
for k, v in self_t.most_common(25): print(f'{v/tot*100:5.1f}% {k}')
