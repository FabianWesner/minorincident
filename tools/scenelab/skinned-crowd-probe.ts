/** skinned-crowd prototype: load a spec with a flag and print the crowd batches (asset, lod, layout, skinned). */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { SceneSession, stopServer } from './session';
const [file, flag = '1', tier = 'low', backend = 'webgl2'] = process.argv.slice(2);
const session = new SceneSession({ backend: backend as 'webgl2' | 'webgpu', tier: tier as 'low' | 'high', query: flag === 'off' ? {} : { skinCrowd: flag } });
try {
  await session.open();
  await session.load(JSON.parse(readFileSync(resolve(file), 'utf8')));
  await session.step(30);
  const state = await session.page.evaluate(() => { const c = window.__SS__!.getState().render.crowd as { batches: { id: string; asset: string; lod: string; instances: number; layout: unknown; source: string }[]; assets: unknown[] }; return { batches: c.batches.filter(b => b.instances > 0 || /common-worker|woman-a/.test(b.id)), assets: c.assets, search: location.search }; });
  console.log(JSON.stringify(state, null, 1));
  for (let k = 0; k < 4; k++) {
    await session.step(30);
    // NaN audit: CPU pose rows, GPU copy and the static vertex data of every drawn crowd batch.
    const audit = await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: { view: { crowd: { batches: Map<string, { count: number; poses: { rows: Float32Array; gpu: Float32Array; clip: { frames: number } }; mesh: { geometry: { attributes: Record<string, { array?: ArrayLike<number>; data?: { array: ArrayLike<number> }; count: number }> } } }> } } } }).game;
      const bad = new Function("a", "let n = 0; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) n++; return n;") as (a: ArrayLike<number>) => number;
      const short = new Function("g", "const n = g.attributes.normal; let c = 0; for (let i = 0; i < n.count; i++) { const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); if (!(l > .5)) c++; } return c;") as (g: unknown) => number;
      return [...game.view.crowd.batches].filter(([, b]) => b.count > 0).map(([key, b]) => ({ key, shortNormals: short(b.mesh.geometry), rows: bad(b.poses.rows), gpu: bad(b.poses.gpu), attributes: Object.fromEntries(Object.entries(b.mesh.geometry.attributes).map(([name, a]) => [name, bad(a.data ? a.data.array : a.array!)])) }));
    });
    console.log(JSON.stringify(audit));
  }
  console.log('errors', session.errors);
} finally { await session.close(); stopServer(); }
