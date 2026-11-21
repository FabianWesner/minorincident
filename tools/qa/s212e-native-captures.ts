import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const out = resolve(process.env.NATIVE_OUT ?? 'docs/reports/s212e-finale'); mkdirSync(out, { recursive: true });
const tier = process.env.NATIVE_TIER === 'low' ? 'low' : 'high';
const s = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1280, height: 720 } });
const beats = Number(process.env.NATIVE_BEATS ?? 10);
try {
  await s.open();
  await s.page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 1, checkpoint: 'cure-research' }); a.pause(); a.camera.follow(); a.camera.zoom(1); a.bot.start('complete'); });
  const cells: { frame: number; jpeg: Buffer }[] = [];
  let next = 0;
  for (let i = 0; i < 3000 && next < beats; i++) {
    const state = await s.page.evaluate(async () => { const game = (window.__SCENE__ as unknown as {game: Game}).game; game.view.frame(.5); await window.__SS__!.step(30); const w = game.world; const p = w.entities.get(1)!, bike = w.vehicles?.bicycle.entity, dog = [...w.entities.iterate()].find(e => e.companion); return { x: p.transform.x, z: p.transform.z, tick: w.tick, phase: w.missions!.state.phase, riding: !!w.vehicles?.bicycle.riding, bikeId: bike?.id, corgiPassengerOf: dog?.passengerOf, hospitalOpenAt: w.l10Encounters?.state.hospitalOpenAt, billboardFallAt: w.l10Encounters?.state.billboardFallAt, beats: Array.from({ length: 10 }, (_, n) => !!w.missions!.state.states[`l10-finale-beat-${n}`]) }; });
    const eventReady = next === 3 ? state.billboardFallAt !== undefined : next === 8 ? state.hospitalOpenAt !== undefined && state.tick >= state.hospitalOpenAt + 15 : true;
    if (state.beats[next] && eventReady) {
      await s.page.evaluate(async () => window.__SS__!.screenshotReady());
      cells.push({ frame: next, jpeg: await s.snapshot() }); console.log(JSON.stringify({ beat: next, ...state })); next++;
    }
  }
  if (process.env.NATIVE_RIDE === '1') {
    let mounted = false;
    for (let i = 0; i < 600 && !mounted; i++) mounted = await s.page.evaluate(async () => { await window.__SS__!.step(30); return !!(window.__SCENE__ as unknown as { game: Game }).game.world.vehicles?.bicycle.riding; });
    if (!mounted) throw new Error('Motorbike was not mounted');
    await s.page.evaluate(async () => window.__SS__!.screenshotReady());
    await s.screenshot(`${out}/native-motorbike.png`);
  }
  if (cells.length) console.log(JSON.stringify(await s.makeSheet(cells, `${out}/native-finale-high.jpg`, 480, 900)));
  if (cells.length !== beats) throw new Error(`Only ${cells.length}/${beats} beats reached`);
} finally { await s.close(); stopServer(); }
