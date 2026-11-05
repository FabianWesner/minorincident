// Summarise Scene Lab metrics for the L3 scenes: node tools/l3/scenes-summary.mjs qa-l3-a qa-l3-b ...
import { readFileSync } from 'node:fs';
for (const name of process.argv.slice(2)) {
  const m = JSON.parse(readFileSync(`test-results/scenes/${name}/metrics.json`, 'utf8'));
  const clips = (m.clipping?.static ?? []).map(c => `${c.a}|${c.b} tris=${c.intersectingTriangles} cm=${JSON.stringify(c.regionCm)}`);
  const actors = Object.entries(m.metrics?.actors ?? {}).slice(0, 12).map(([id, a]) => `${id}:${a.state}@${a.position?.map(v => v.toFixed(1)).join(',')} drawn=${a.drawnFrames}`);
  console.log(JSON.stringify({ name, checks: m.checks, errors: m.consoleErrors?.length, clips, perf: { draw: m.metrics?.perf?.drawCalls, tris: m.metrics?.perf?.triangles, step: m.metrics?.perf?.stepMs }, visibility: m.metrics?.visibility, actors }, null, 1));
}
