/**
 * r9-l10pace: time the longest L10 stretch with nothing to look at or do, from a real-input playtest route trace
 * (PLAYTEST_ROUTE_TRACE=1 → log-*.jsonl `routeTrace` rows at 1 Hz: position + drawn living infected on screen).
 *
 *   node --import tsx/esm tools/qa/r9-l10pace-empty.ts <log.jsonl> [--without-crossings] [--zoom 1|1.5] [--decor-json snapshot.json]
 *
 * A second is "empty" when the frame holds no living infected (trace) and no story element: a solid placement at least
 * 1.4 m tall (building, vehicle, tent, tower, stack; ordinary fences and low decay excluded), a complete vignette core or a night-accent fire. The frame is
 * the iso ground footprint of the follow camera (zoom 1.5 normal framing: 26 x 15 m screen; the player zoom scales it, so zoom 1 is
 * 17 x 10 m; R1-R5 road framing a further 1.3x, src/levels/L10/cameraFraming.ts; a real zoom-1 R4 frame measured ~24 m wide). `--without-crossings` drops the r9 crossing stories, so the
 * same physical trace gives the before value of the dressing alone.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { districtDecor } from '../../src/levels/decor';
import { cureAccents } from '../../src/render/NightAccents';
import { l10RoadWeight } from '../../src/levels/L10/cameraFraming';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'without-crossings': { type: 'boolean', default: false }, zoom: { type: 'string', default: '1' }, tier:{type:'string',default:'high'}, json: { type: 'boolean', default: false }, 'decor-json': { type: 'string' } } });
if(!['high','low'].includes(values.tier!))throw Error('Use --tier high or low');
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
// A saved decor snapshot lets later lanes replay the same physical trace on
// their exact baseline, without a second checkout or changing this metric.
const source: Placement[] = values['decor-json'] ? JSON.parse(readFileSync(values['decor-json'], 'utf8')) : districtDecor('D-CURE', layout.placements);
const decor = source.filter(p => !(values['without-crossings'] && p.id.startsWith('decor-cure-cross-')) && !(values.tier==='low'&&p.highOnly));
const all: Placement[] = [...layout.placements, ...decor];
const fires = cureAccents(all).fires;
// Complete low story compositions (graves, bodies, bags) are now meaningful cues too.
// Loose scatter alone never makes a frame count as a vignette.
const story = all.filter(p => p.id.startsWith('decor-cure-vignette-') && !p.id.includes('-scatter-') ||
  p.paintedMessage !== undefined || p.visualAabb.max[1] - p.visualAabb.min[1] >= 1.4 && !p.assetId.startsWith('decay.') && !/fence|hedge|lamp|pole|barrier|wall/.test(p.assetId))
  .map(p => ({ x: (p.visualAabb.min[0]+p.visualAabb.max[0])/2, z: (p.visualAabb.min[2]+p.visualAabb.max[2])/2,
    radius: ((p.visualAabb.max[0]-p.visualAabb.min[0])+(p.visualAabb.max[2]-p.visualAabb.min[2]))/(2*Math.SQRT2) }));
const things = [...story, ...fires.map(f => ({ x: f.x, z: f.z, radius:0 }))];
const zoom = Number(values.zoom);
if (![1, 1.5].includes(zoom)) throw Error('Use --zoom 1 or 1.5');
const inFrame = (px: number, pz: number, x: number, z: number, radius=0) => {
  const wide = 1 + .3 * l10RoadWeight(px, pz, false), k = zoom / 1.5 * wide;
  const halfW = 13 * k, halfD = 7.5 * k / Math.sin(40.3 * Math.PI / 180);
  const dx = x - px, dz = z - pz, sx = (dx - dz) / Math.SQRT2, sy = (dx + dz) / Math.SQRT2;
  // Use the drawn footprint, not only the pivot: the finale platform's near edge is visible well before its centre.
  return Math.abs(sx) <= halfW+radius && Math.abs(sy) <= halfD+radius;
};
const rows: { tick: number; x: number; z: number; step: string; enemies: number }[] = [];
for (const file of positionals) for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.includes('"routeTrace"')) continue;
  const r = JSON.parse(line).routeTrace; if (r.level === 'L10') rows.push(r);
}
if (!rows.length) throw Error('No L10 routeTrace samples supplied');
// File order: a Resume session restarts the tick counter.
type Stretch = { seconds: number; from: typeof rows[0]; to: typeof rows[0] };
const longest = (pred: (r: typeof rows[0]) => boolean) => {
  const out: Stretch[] = []; let start: typeof rows[0] | null = null, prev: typeof rows[0] | null = null;
  for (const r of rows) {
    // A gap in the trace (Resume, checkpoint reload) ends a stretch.
    if (prev && (r.tick - prev.tick > 150 || r.tick < prev.tick)) { if (start) out.push({ seconds: (prev.tick - start.tick) / 60, from: start, to: prev }); start = null; }
    if (pred(r)) start ??= r; else if (start) { out.push({ seconds: (r.tick - start.tick) / 60, from: start, to: r }); start = null; }
    prev = r;
  }
  if (start && prev) out.push({ seconds: (prev.tick - start.tick) / 60, from: start, to: prev });
  return out.sort((a, b) => b.seconds - a.seconds);
};
const nothing = (r: typeof rows[0]) => things.every(t => !inFrame(r.x, r.z, t.x, t.z,t.radius));
const empty = longest(r => r.enemies === 0 && nothing(r));
const noScenery = longest(nothing), noEnemies = longest(r => r.enemies === 0);
const centerOnly = longest(r=>things.every(t=>!inFrame(r.x,r.z,t.x,t.z)));
const fmt = (s: Stretch) => `${s.seconds.toFixed(0)} s ${s.from.step} (${s.from.x.toFixed(0)},${s.from.z.toFixed(0)})→(${s.to.x.toFixed(0)},${s.to.z.toFixed(0)})`;
const summary = {
  samples: rows.length, zoom, tier:values.tier,crossings: !values['without-crossings'],
  longestEmptySeconds: empty[0]?.seconds ?? 0, longestNoScenerySeconds: noScenery[0]?.seconds ?? 0,
  centerOnlyNoScenerySeconds:centerOnly[0]?.seconds??0,
  emptySeconds: rows.filter(r => r.enemies === 0 && nothing(r)).length,
  longestEmpty: empty.slice(0, 5).map(fmt), longestNoScenery: noScenery.slice(0, 5).map(fmt), longestNoEnemies: noEnemies.slice(0, 5).map(fmt),
  byStep: Object.fromEntries([...new Set(rows.map(r => r.step))].map(step => {
    const own = rows.filter(r => r.step === step);
    return [step, { seconds: own.length, enemySeconds: own.filter(r => r.enemies > 0).length, sceneryless: own.filter(nothing).length, empty: own.filter(r => r.enemies === 0 && nothing(r)).length }];
  })),
};
console.log(values.json ? JSON.stringify(summary) : JSON.stringify(summary, null, 1));
