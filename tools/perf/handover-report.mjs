// Summarize level-handover timing runs (tests/perf/level-handover.spec.ts) and compare post-load frames pixel by pixel.
// Usage: node tools/perf/handover-report.mjs <dir> <beforePhase> <afterPhase>
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [dir, before = 'before', after = 'after'] = process.argv.slice(2);
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN; };
const load = (phase, config) => { const file = `${dir}/${phase}-${config}.json`; return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null; };
const configs = [...new Set(readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/^[^-]+-/, '').replace(/\.json$/, '')))].sort();
const fmt = (n, digits = 0) => Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
for (const config of configs) {
  const a = load(before, config), b = load(after, config);
  if (!a && !b) continue;
  console.log(`\n## ${config}  (${before} runs: ${a ? new Set(a.rows.map(r => r.run)).size : 0}, ${after} runs: ${b ? new Set(b.rows.map(r => r.run)).size : 0})`);
  console.log('| handover | playable before | after | delta | first frame b/a | max frame b/a | over50 b/a | heap MB b/a | geometries b/a | textures b/a |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  const levels = [...new Set([...(a?.rows ?? []), ...(b?.rows ?? [])].map(r => `${r.from}->${r.level}`))];
  for (const key of levels) {
    const ra = (a?.rows ?? []).filter(r => `${r.from}->${r.level}` === key), rb = (b?.rows ?? []).filter(r => `${r.from}->${r.level}` === key);
    const m = (rows, field) => median(rows.map(r => r[field]));
    const pa = m(ra, 'playable'), pb = m(rb, 'playable');
    console.log(`| ${key} | ${fmt(pa)} | ${fmt(pb)} | ${Number.isFinite(pa) && Number.isFinite(pb) ? `${fmt(pb - pa)} (${fmt((pb - pa) / pa * 100)}%)` : 'n/a'} | ${fmt(m(ra, 'firstFrame'))}/${fmt(m(rb, 'firstFrame'))} | ${fmt(m(ra, 'maxFrame'))}/${fmt(m(rb, 'maxFrame'))} | ${fmt(m(ra, 'over50'))}/${fmt(m(rb, 'over50'))} | ${fmt(m(ra, 'heapMB'), 1)}/${fmt(m(rb, 'heapMB'), 1)} | ${fmt(m(ra, 'geometries'))}/${fmt(m(rb, 'geometries'))} | ${fmt(m(ra, 'textures'))}/${fmt(m(rb, 'textures'))} |`);
  }
  if (a?.errors?.length || b?.errors?.length) console.log(`errors: before ${JSON.stringify(a?.errors ?? [])} after ${JSON.stringify(b?.errors ?? [])}`);
}
// Pixel compare: <phase>-<backend>-<tier>-x1-<level>.png pairs.
const pngs = readdirSync(dir).filter(f => f.startsWith(`${before}-`) && f.endsWith('.png'));
if (pngs.length) {
  console.log('\n## pixel compare (post-load frame, same seed and tick)');
  console.log('| frame | differing pixels | of | share |');
  console.log('|---|---|---|---|');
  for (const file of pngs.sort()) {
    const other = `${dir}/${file.replace(`${before}-`, `${after}-`)}`;
    if (!existsSync(other)) { console.log(`| ${file} | missing ${after} | | |`); continue; }
    const x = PNG.sync.read(readFileSync(`${dir}/${file}`)), y = PNG.sync.read(readFileSync(other));
    if (x.width !== y.width || x.height !== y.height) { console.log(`| ${file} | size mismatch | | |`); continue; }
    const diff = pixelmatch(x.data, y.data, null, x.width, x.height, { threshold: 0 });
    console.log(`| ${file.replace(`${before}-`, '')} | ${diff} | ${x.width * x.height} | ${(diff / (x.width * x.height) * 100).toFixed(3)}% |`);
  }
}
