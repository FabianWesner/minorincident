import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';

/** First-frame LOD probe (lod-pop lane). SCENE_PORT=3491 sh tools/e2e-lock.sh npx tsx tools/qa/lod-pop-probe.ts [--tier high|low] [--backend webgl2|webgpu] [--level L10] [--checkpoint cure-residential] [x,z ...]
 *  --realtime --from 3660,-25 --to 3730 --reverse --seconds 30 --zoom 1 uses the live game clock and samples every browser frame (all drawn placements).
 *  Loads the level, then (at spawn and after each teleport) samples GameView.getState().placeholderDraws = building placements drawn from a tier
 *  whose real mesh has not arrived, within 30 m of the player, after 1/2/30/120/300 ticks. Game-camera screenshots at tick 1 and when settled. */
const args = process.argv.slice(2), flag = (n: string, d: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const pts = args.filter((a, i) => /^-?\d+(\.\d+)?,-?\d+/.test(a) && !args[i - 1]?.startsWith('--'));
const tier = flag('tier', 'high') as 'high' | 'low', backend = flag('backend', 'webgl2') as Backend, level = flag('level', 'L10'), ck = flag('checkpoint', 'cure-residential');
const out = flag('out', `test-results/lod-pop/${tier}-${backend}`); mkdirSync(out, { recursive: true });
const s = new SceneSession({ backend, tier, viewport: { width: 960, height: 540 } });
const sample = (radius: number) => s.page.evaluate(r => {
  const g = window.__SS__!.getState(), p = g.player!.transform;
  const list = (g.render as unknown as { placeholderDraws: { assetId: string; lod: string; x: number; z: number }[] }).placeholderDraws.filter(d => Math.hypot(d.x - p.x, d.z - p.z) <= r && !/^prop\./.test(d.assetId));
  return { tick: g.tick, near: list.length, assets: [...new Set(list.map(d => `${d.assetId}:${d.lod}`))].slice(0, 12) };
}, radius);
try {
  await s.open();
  await s.page.evaluate(async ({ level, ck }) => { await window.__SS__!.loadLevel(level, { seed: 32, checkpoint: ck }); window.__SS__!.pause(); window.__SS__!.cheats.god(true); window.__SS__!.camera.follow(); }, { level, ck });
  if (args.includes('--realtime')) {
    const zoom = Number(flag('zoom', '1'));
    if (zoom !== 1) {
      await s.page.mouse.move(480, 270);
      for (let i = 0; i < 5; i++) await s.page.mouse.wheel(0, zoom < 1 ? -100 : 100);
    }
    // Optional initial position establishes the starting camera/residency, never a mid-walk teleport.
    const from = flag('from', '');
    if (from) { const [x, z] = from.split(',').map(Number); await s.page.evaluate(p => window.__SS__!.teleport('player', p), { x, z }); }
    await s.page.evaluate(async () => { await window.__SS__!.step(120); await window.__SS__!.screenshotReady(); });
    await s.screenshot(`${out}/start.png`);
    const productionPacing = args.includes('--production-pacing');
    if (productionPacing) await s.page.evaluate(() => {
      // Keep the inspection API while exercising production swap admission.
      (window.__SCENE__ as unknown as { game: { view: { params: URLSearchParams } } }).game.view.params.delete('test');
    });
    const seconds = Number(flag('seconds', '30'));
    const [result] = await Promise.all([s.page.evaluate(async ({ seconds, to, reverse }) => {
      const a = window.__SS__!, start = a.getState().player!.transform;
      const origin = { x: start.x, z: start.z }, end = { x: to, z: start.z };
      const bad: { tick: number; x: number; assets: unknown }[] = [];
      let frames = 0, distance = 0, lastX = start.x, minX = start.x, maxX = start.x, returning = false;
      a.input.set({ moveTarget: end, pointerGround: true, navigation: true } as never); a.resume();
      const began = performance.now();
      while (performance.now() - began < seconds * 1000) {
        await new Promise<void>(r => requestAnimationFrame(() => r()));
        const g = a.getState(), p = g.player!.transform;
        const list = (g.render as unknown as { placeholderDraws: unknown[] }).placeholderDraws;
        frames++; distance += Math.abs(p.x - lastX); lastX = p.x; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        if (list.length) bad.push({ tick: g.tick, x: p.x, assets: list });
        if (reverse && !returning && Math.abs(p.x - to) < 1) { returning = true; a.input.set({ moveTarget: origin, pointerGround: true, navigation: true } as never); }
      }
      a.pause(); a.input.clear();
      return { reached: maxX >= to - 1, requestedReverse: reverse, quality: a.perf().quality.tier, frames, badFrames: bad.length, first: bad.slice(0, 12), distance, minX, maxX, returning, backend: a.perf().backend, camera: a.getState().render.camera, tick: a.tick() };
    }, { seconds, to: Number(flag('to', '3730')), reverse: args.includes('--reverse') }),
    new Promise(resolve => setTimeout(resolve, seconds * 500)).then(() => s.page.screenshot({ path: `${out}/mid.png` }))]);
    await s.screenshot(`${out}/end.png`);
    writeFileSync(`${out}/realtime.json`, JSON.stringify({ tier, requestedBackend: backend, zoom, productionPacing, ...result, errors: s.errors }, null, 2));
    console.log(JSON.stringify(result));
    if (result.badFrames || s.errors.length || result.distance < 10 || !result.reached || result.requestedReverse && !result.returning || result.quality !== tier || Math.abs(result.camera.zoom - zoom) > .01 || result.backend !== (backend === 'webgl2' ? 'webgl' : 'webgpu')) process.exitCode = 1;
    throw new Error('walk-done');
  }
  if (args.includes('--walk')) {
    // Accelerated streaming: click-to-move hops east along the route; sample every 20 ticks; screenshot the first frames that show a placeholder near the player.
    const to = Number(flag('to', '1257')); let shots = 0, prevX = -1, stuck = 0; const worst: unknown[] = [];
    for (let hop = 0; hop < 140; hop++) {
      const st = await s.page.evaluate(() => { const p = window.__SS__!.getState().player!.transform; return { x: p.x, z: p.z }; });
      if (st.x >= to) break;
      stuck = Math.abs(st.x - prevX) < 1 ? stuck + 1 : 0; prevX = st.x;
      await s.page.evaluate(({ x, z }) => { window.__SS__!.input.set({ moveTarget: { x, z }, pointerGround: true, navigation: true } as never); }, { x: st.x + 14, z: stuck >= 2 ? st.z + (stuck % 2 ? 10 : -10) : st.z });
      for (let k = 0; k < 8; k++) {
        await s.page.evaluate(() => window.__SS__!.step(20));
        const r = await sample(30);
        if (r.near > 0) { worst.push({ x: Math.round(st.x), ...r }); if (shots < 8) { await s.screenshot(`${out}/walk-x${Math.round(st.x)}-k${k}.png`); shots++; } }
      }
    }
    console.log('placeholder samples near player (30 m, non-prop)', worst.length, JSON.stringify(worst.slice(0, 12)));
    console.log('errors', s.errors.length); throw new Error('walk-done');
  }
  const spots: (string | null)[] = [null, ...pts];
  for (const spot of spots) {
    if (spot) { const [x, z] = spot.split(',').map(Number); await s.page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x, z }); }
    const label = spot ?? 'spawn', rows: unknown[] = [];
    for (const [i, step] of [1, 1, 28, 90, 180].entries()) {
      await s.page.evaluate(n => window.__SS__!.step(n), step);
      if (i === 0) await s.screenshot(`${out}/${label.replace(',', '_')}-f1.png`);
      rows.push(await sample(30));
    }
    await s.screenshot(`${out}/${label.replace(',', '_')}-settled.png`);
    console.log(label, JSON.stringify(rows));
  }
  console.log('errors', s.errors.length);
} catch (e) { if ((e as Error).message !== 'walk-done') throw e; } finally { await s.close(); await stopServer(); }
