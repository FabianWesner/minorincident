"""Reduce a V8 CPU profile to self/total samples, retaining source locations."""
import collections, json, sys
p=json.load(open(sys.argv[1])); nodes={n['id']:n for n in p['nodes']}; parents={c:n['id'] for n in p['nodes'] for c in n.get('children',[])}
self_us=collections.Counter();total_us=collections.Counter()
for sample,dt in zip(p['samples'],p['timeDeltas']):
 self_us[sample]+=dt
 while sample:
  total_us[sample]+=dt;sample=parents.get(sample)
def rows(counter):
 return [dict(ms=round(us/1000,2),**nodes[i]['callFrame']) for i,us in counter.most_common(40)]
print(json.dumps(dict(durationSeconds=(p['endTime']-p['startTime'])/1e6,self=rows(self_us),total=rows(total_us)),indent=2))
