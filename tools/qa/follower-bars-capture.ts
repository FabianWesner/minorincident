import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';
import { loadLevel } from '../sim-runner/levels';

const backend = (process.argv[2] ?? 'webgl2') as Backend;
const tier = (process.argv[3] ?? 'low') as 'low' | 'high';
if (!['webgl2', 'webgpu'].includes(backend) || !['low', 'high'].includes(tier)) throw new Error('Expected backend and quality');
const out = `test-results/fix51-r10g/G-12-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend, tier });
type Bar = { id: number; x: number; y: number; width: number; height: number };
function pixels(buffer: Buffer, bars: Bar[]) {
  const png = PNG.sync.read(buffer);
  return bars.map(bar => {
    let teal = 0;
    for (let y = Math.max(0, Math.floor(bar.y - bar.height / 2)); y < Math.min(png.height, Math.ceil(bar.y + bar.height / 2)); y++) {
      for (let x = Math.max(0, Math.floor(bar.x - bar.width / 2)); x < Math.min(png.width, Math.ceil(bar.x + bar.width / 2)); x++) {
        const i = (y * png.width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (g > 90 && g > r * 1.4 && b > r * 1.3 && Math.abs(g - b) < 70) teal++;
      }
    }
    return { ...bar, tealPixels: teal, pass: teal >= bar.width * bar.height * .3 };
  });
}
const rows = [], shots: { frame: number; jpeg: Buffer }[] = [];
let negative: unknown;
try {
  const world = await loadLevel('L6', 1, undefined, 0, { quality: tier });
  const roster: { key: string; model: string }[] = [];
  try {
    for (const entry of world.missions!.state.l6!.survivors) {
      const model = world.entities.get(entry.id)?.civilian?.model;
      if (!model) throw new Error(`Missing actual survivor model: ${entry.key}`);
      roster.push({ key: entry.key, model });
    }
  } finally { world.dispose(); }
  if (roster.length > 35) throw new Error('Authored roster exceeds fixture capacity');
  while (roster.length < 35) roster.push({ key: `l7-extra-${roster.length}`, model: roster.length % 2 ? 'npc.civilian-man-b.aftermath' : 'npc.civilian-woman-b.aftermath' });
  await session.open();
  for (const zoom of [1.5]) {
    const spec: SceneSpec = { name: 'G-12-followers', ground: 'asphalt', time: 'L6', tier: 6,
      actors: [{ id: 'courier', kind: 'courier', at: [-8, 6] }, ...Array.from({ length: 35 }, (_, i) => ({ id: `follower-${i}`, kind: 'pedestrian' as const,
        at: [(i % 7 - 3) * 2, (Math.floor(i / 7) - 2) * 2] as [number, number], look: { model: roster[i].model }, state: { survivor: { slot: i } } }))],
      camera: { mode: 'game', target: [0, 0, 0], zoom }, frames: 1 };
    await session.load(spec); await session.step(1); await session.ready();
    const ids = await session.page.evaluate(() => [...(window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow').map(e => e.id).sort((a, b) => a - b));
    if (ids.length !== 35) throw new Error(`Fixture has ${ids.length} followers`);
    for (let count = 35; count >= 1; count--) {
      await session.ready();
      const state = await session.page.evaluate(() => { const render = window.__SS__!.getState().render; return { bars: render.healthBars, backend: render.backend, quality: render.quality, zoom: render.camera.zoom }; });
      const expected = ids.slice(0, count), rendered = state.bars?.bars ?? [];
      const missing = expected.filter(id => !rendered.some(bar => bar.id === id));
      let capture: unknown;
      if ([1, 5, 6, 35].includes(count)) {
        const file = join(out, `z${zoom}-n${count}.png`), buffer = await session.screenshot(file);
        const pixelRows = pixels(buffer, rendered);
        capture = { file, sha256: createHash('sha256').update(buffer).digest('hex'), pixelRows };
        shots.push({ frame: zoom * 100 + count, jpeg: buffer });
        if (backend === 'webgl2' && tier === 'low' && count === 35) {
          await session.page.evaluate(() => { const view = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.view as unknown as { probes: { hide: { bars: boolean } } }; view.probes.hide.bars = true; });
          try {
            const file = join(out, 'hidden-bars-negative-control.png'), hidden = await session.screenshot(file);
            negative = { file, sha256: createHash('sha256').update(hidden).digest('hex'), pixelRows: pixels(hidden, rendered) };
          } finally { await session.page.evaluate(() => { const view = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.view as unknown as { probes: { hide: { bars: boolean } } }; view.probes.hide.bars = false; }); }
        }
      }
      rows.push({ zoom, count, roster: roster.slice(0, count), runtime: state, expectedIds: expected, missing, capture });
      if (count > 1) await session.page.evaluate(id => { const world = (window as unknown as { __SCENE__: { game: Game } }).__SCENE__.game.world; world.spatial.delete(id); world.entities.remove(id); }, ids[count - 1]);
      await session.step(1);
    }
  }
  await session.makeSheet(shots, `test-results/fix51-r10g/G-12-${backend}-${tier}.jpg`, 640, 380);
} finally {
  writeFileSync(`docs/reports/fix51-r10g/G-12-${backend}-${tier}.json`, JSON.stringify({ ...provenance(), scriptSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), backend, tier, setup: 'isolated production renderer; actual L6 survivor model roster plus L7 fallback models up to35; healthy follow mode; remove one fixture entity per group-size sample; no gameplay route or timing claim', rows, negative, errors: session.errors }, null, 2) + '\n');
  await session.close(); stopServer();
}
console.log(`${backend}/${tier}: ${rows.length} group-size samples, ${shots.length} captures`);
