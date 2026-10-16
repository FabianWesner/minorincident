import pathlib,subprocess,json,hashlib
root=pathlib.Path.cwd();out=root/'test-results/collision-s4-full-context-profile';out.mkdir(parents=True,exist_ok=True)
p=root/'tests/sim/performance/zoo-s2.test.ts';original=p.read_text()
s="import { Session } from 'node:inspector/promises';\nimport { getHeapStatistics } from 'node:v8';\n"+original
s=s.replace('  const w = new SimWorld();', '''  const profiler = count === 200 ? new Session() : null;
  if (profiler) { profiler.connect(); await profiler.post('Profiler.enable'); await profiler.post('Profiler.setSamplingInterval', { interval: 100 }); await profiler.post('Profiler.start'); }
  const beforeHeap = getHeapStatistics(); let measuredStart = 0;
  const w = new SimWorld();''')
s=s.replace('      const t = performance.now();', '      if (tick === 120) measuredStart = Number(process.hrtime.bigint() / 1000n);\n      const t = performance.now();')
s=s.replace('    times.sort((a, b) => a - b);', '''    const measuredEnd = Number(process.hrtime.bigint() / 1000n), afterHeap = getHeapStatistics();
    if (profiler) {
      const { profile } = await profiler.post('Profiler.stop'); profiler.disconnect();
      mkdirSync('test-results/collision-s4-full-context-profile', { recursive: true });
      writeFileSync('test-results/collision-s4-full-context-profile/high.cpuprofile', JSON.stringify(profile));
      writeFileSync('test-results/collision-s4-full-context-profile/measured.json', JSON.stringify({ measuredStart, measuredEnd, beforeHeap, afterHeap, times }));
    }
    times.sort((a, b) => a - b);''')
(out/'source.json').write_text(json.dumps({str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in [p,root/'src/sim/world/SolidRegistry.ts',root/'src/sim/spatial/SpatialHash.ts']},indent=2)+'\n')
p.write_text(s)
with (out/'vmstat.log').open('w') as log:
 sampler=subprocess.Popen(['vmstat','1'],stdout=log)
 try:result=subprocess.run(['npx','vitest','run','tests/unit','tests/sim','--project=timing','--maxWorkers=4','--reporter=default','--reporter=json','--outputFile='+str(out/'tests.json')])
 finally:sampler.terminate();sampler.wait(timeout=10);p.write_text(original)
(out/'profiled-perf.json').write_text((root/'docs/reports/zoo-s2/perf-200.json').read_text())
(out/'exit.json').write_text(json.dumps({'exit':result.returncode,'instrumented':True,'note':'Full timing-project attribution with unaltered source; profiling overhead is not an acceptance measurement'})+'\n')
raise SystemExit(result.returncode)
