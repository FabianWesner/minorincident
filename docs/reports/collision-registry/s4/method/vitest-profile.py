from pathlib import Path
import subprocess,json,hashlib,sys
out=Path('test-results/collision-s4-canonical-profile');out.mkdir(parents=True,exist_ok=True)
(out/'source.json').write_text(json.dumps({str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in map(Path,['src/sim/spatial/SpatialHash.ts','src/sim/world/SolidRegistry.ts','src/sim/ai/CharacterSeparation.ts'])},indent=2))
p=Path('tests/sim/performance/zoo-s2.test.ts');s=p.read_text();s="import { Session } from 'node:inspector/promises';\n"+s
s=s.replace('  const w = new SimWorld();', "  const profiler = new Session(); profiler.connect(); await profiler.post('Profiler.enable'); await profiler.post('Profiler.setSamplingInterval', { interval: 100 });\n  const w = new SimWorld();")
s=s.replace('  const w = new SimWorld();', '''  const w = new SimWorld();
  let phaseCosts: Record<string, number> = {};
  const phaseTicks: {tick:number;ms:number;costs:Record<string,number>}[] = [];
  const on = w.events.on.bind(w.events);
  w.events.on = (type, callback, order = 1) => type !== 'sim.tick' ? on(type, callback, order) : on(type, event => { const t = performance.now(); callback(event); phaseCosts[order] = (phaseCosts[order] ?? 0) + performance.now() - t; }, order);''')
s=s.replace('      const t = performance.now();', "      phaseCosts = {}; if (tick === 120) await profiler.post('Profiler.start');\n      const t = performance.now();")
s=s.replace('    times.sort((a, b) => a - b);', "    const { profile } = await profiler.post('Profiler.stop'); profiler.disconnect(); mkdirSync('test-results/collision-s4-canonical-profile', { recursive: true }); writeFileSync(`test-results/collision-s4-canonical-profile/zoo-${count}.cpuprofile`, JSON.stringify(profile));\n    times.sort((a, b) => a - b);")
s=s.replace('      expect(ai.director.count).toBe(count);', '      if (tick >= 120) phaseTicks.push({ tick, ms: times[times.length - 1], costs: phaseCosts });\n      expect(ai.director.count).toBe(count);')
s=s.replace('    times.sort((a, b) => a - b);', '    writeFileSync(`test-results/collision-s4-canonical-profile/phases-${count}.json`, JSON.stringify(phaseTicks));\n    times.sort((a, b) => a - b);')
if '--isolated' in sys.argv:
 s=s.replace('test-results/collision-s4-canonical-profile','test-results/collision-s4-vitest-profile')
 out=Path('test-results/collision-s4-vitest-profile');out.mkdir(parents=True,exist_ok=True)
p.write_text(s)
with (out/'vmstat.log').open('w') as log:
 sampler=subprocess.Popen(['vmstat','1'],stdout=log)
 try:
  result=subprocess.run(['npx','vitest','run',*(['tests/sim/performance/zoo-s2.test.ts'] if '--isolated' in sys.argv else ['tests/unit','tests/sim']),'--project=timing','--maxWorkers=1','--reporter=json','--outputFile='+str(out/'tests.json')])
 finally:
  sampler.terminate();sampler.wait(timeout=10)
(out/'profiled-perf.json').write_text(Path('docs/reports/zoo-s2/perf-200.json').read_text())
(out/'exit.json').write_text(json.dumps(dict(exit=result.returncode,note='CPU profiling run for attribution, not uninstrumented budget evidence')))
raise SystemExit(result.returncode)
