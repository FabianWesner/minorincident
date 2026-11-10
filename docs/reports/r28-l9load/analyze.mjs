import { readdirSync, readFileSync } from 'node:fs';
const dir = process.argv[2];
const rows = [];
for (const d of readdirSync(dir).sort()) {
  const label = d.split('-')[1];
  const f = readdirSync(`${dir}/${d}`).find(x => /^L9-.*-\d+\.json$/.test(x));
  if (!f) continue;
  const r = JSON.parse(readFileSync(`${dir}/${d}/${f}`, 'utf8'));
  rows.push({ d, label, ms: r.ms, bundle: r.bundle?.split('/').pop(), maxFrame: r.maxFrameMs, errors: r.errors?.length });
}
const med = a => { const s = [...a].sort((x, y) => x - y); return (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2; };
// warm = previous load same label
const out = {};
rows.forEach((r, i) => { r.state = i === 0 ? 'first' : rows[i - 1].label === r.label ? 'warm' : 'cold'; });
for (const l of ['a', 'b']) for (const st of ['warm', 'cold']) {
  const v = rows.filter(r => r.label === l && r.state === st).map(r => r.ms);
  out[`${l}.${st}`] = v.length ? { n: v.length, med: med(v), min: Math.min(...v), max: Math.max(...v) } : null;
}
console.log(JSON.stringify({ bundles: [...new Set(rows.map(r => r.label + ':' + r.bundle))], out, errors: rows.filter(r => r.errors).length }, null, 1));
if (process.argv[3]) console.log(rows.map(r => `${r.d} ${r.state} ${Math.round(r.ms)}`).join('\n'));
