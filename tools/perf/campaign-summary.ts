import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = 'docs/reports/perf-sweep';
const phase = process.argv[2] ?? 'after';
type Row = { spot: { id: string }; p50: number; p95: number; p99: number; hitch: number; simMs: number; drawCalls: number; triangles: number; heapMB: number; updateMs: number; renderMs: number; backend: string };
type Cell = { level: string; tier: string; backend: string; sourceRevision?: string; rows: Row[] };
const cells: Cell[] = readdirSync(`${root}/${phase}`).filter(f => /^L\d+-(high|low)-(webgl|webgpu)\.json$/.test(f)).map(f => JSON.parse(readFileSync(`${root}/${phase}/${f}`, 'utf8')));
if (phase === 'after' && cells.length !== 40) throw new Error(`Incomplete campaign matrix: ${cells.length}/40 cells`);
for (const c of cells) {
  if (!c.rows.length || c.rows.some(r => ['p50', 'p95', 'p99', 'hitch', 'simMs', 'drawCalls', 'triangles', 'heapMB'].some(k => !Number.isFinite(r[k as keyof Omit<Row, 'spot' | 'backend'>])))) throw new Error(`Invalid measurements: ${c.level}-${c.tier}-${c.backend}`);
}
cells.sort((a,b) => Number(a.level.slice(1)) - Number(b.level.slice(1)) || a.backend.localeCompare(b.backend) || a.tier.localeCompare(b.tier));
const max = (c: Cell, key: keyof Omit<Row, 'spot' | 'backend'>) => Math.max(...c.rows.map(r => r[key]));
const lines = [
  `## ${phase} matrix`, '',
  'Each cell reports the worst spot percentile and maximum counters/retained heap. Times are milliseconds; heap is decimal MB. Raw JSON contains every spot and frame sample.', '',
  '| Level | Tier | Backend | Revision | p50 | p95 | p99 | Hitch | Sim p95 | Draws | Triangles | Heap MB | Result |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
];
const offenders: { cell: string; spot: string; metric: string; value: number; limit: number; ratio: number; updateMs: number; renderMs: number }[] = [];
for (const c of cells) {
  const low = c.tier === 'low';
  const limits = { p95: low ? 33.3 : 16.7, hitch: 50, simMs: low ? 6 : 4, drawCalls: low ? 300 : 600, triangles: low ? 500_000 : 1_500_000, heapMB: low ? 250 : 400 };
  const failures = Object.entries(limits).filter(([key, limit]) => max(c, key as keyof typeof limits) > limit).map(([key]) => key);
  if (c.rows.some(r => r.backend !== c.backend)) failures.push('backend fallback');
  const metrics = (['p50','p95','p99','hitch','simMs','drawCalls','triangles','heapMB'] as const).map(k => max(c,k).toFixed(k === 'drawCalls' || k === 'triangles' ? 0 : 2));
  lines.push(`| [${c.level}](${phase}/${c.level}-${c.tier}-${c.backend}.json) | ${c.tier} | ${c.backend} | ${c.sourceRevision ?? '—'} | ${metrics.join(' | ')} | ${failures.join(', ') || 'pass'} |`);
  for (const r of c.rows) for (const [metric, limit] of Object.entries(limits)) offenders.push({ cell: `${c.level}-${c.tier}-${c.backend}`, spot: r.spot.id, metric, value: r[metric as keyof typeof limits], limit, ratio: r[metric as keyof typeof limits] / limit, updateMs: r.updateMs, renderMs: r.renderMs });
}
lines.push('', `${cells.length}/40 cells recorded.`, '');
writeFileSync(`${root}/${phase}-table.md`, lines.join('\n'));
writeFileSync(`${root}/${phase}-ranked.json`, JSON.stringify(offenders.sort((a,b) => b.ratio-a.ratio), null, 2));
console.log(lines.join('\n'));
if (existsSync(`${root}/notes.md`)) writeFileSync(`${root}/README.md`, readFileSync(`${root}/notes.md`, 'utf8') + '\n' + lines.join('\n'));
