/** Live current-renderer tank muzzle/tracer-to-wall supplement. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import type { installTankProbe } from './sweep-b-tank-probe';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const requested = process.argv[2]; if (requested !== 'low' && requested !== 'high') throw new Error('Expected low/high');
const tier: 'low' | 'high' = requested, out = `test-results/sweep-b/L4-tank-${tier}`; mkdirSync(`${out}/captures`, { recursive: true });
const session = new SceneSession({ tier, backend: 'webgl2', query: { profile: '0', ui: '1' } });
try {
  await session.open(); const save = preset('L4-default'); save.settings.quality = tier;
  await session.page.evaluate(async ({ tier, save }) => {
    const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false }); a.campaign.restore(save); await a.loadLevel('L4', { seed: 1 });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(1.5);
    const path = '/tools/qa/sweep-b-tank-probe.ts'; const { installTankProbe } = await import(path);
    (window as unknown as { sweepTank: ReturnType<typeof installTankProbe> }).sweepTank = installTankProbe((window.__SCENE__ as unknown as { game: Game }).game);
    a.bot.start('complete');
  }, { tier, save });
  const captures = [];
  let previous = 0;
  for (let i = 0; i < 2500; i++) {
    const state = await session.page.evaluate(async () => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world, s = w.missions!.state.l4!;
      const until = s.tankPhase === 'hold' ? s.tankFireAt - w.tick : 60;
      await a.step(Math.max(1, Math.min(60, until)));
      const probe = (window as unknown as { sweepTank: ReturnType<typeof installTankProbe> }).sweepTank;
      return { tick: w.tick, phase: s.phase, shots: probe.rows.length, tank: s.tankId ? { ...w.entities.get(s.tankId)!.transform } : null };
    });
    if (state.shots > previous) {
      console.log(tier, state.tick, state.phase, state.shots);
      if (state.shots <= 3) {
        await session.page.evaluate(tank => { window.__SS__!.camera.cinematic({ position: [tank!.x + 14, 18, tank!.z + 14], target: [tank!.x, 0, tank!.z] }, true); }, state.tank);
        const file = `${out}/captures/${tier}-shot-${state.shots}.png`; await session.ready(); await session.page.screenshot({ path: file }); captures.push({ file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
        await session.page.evaluate(() => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game; a.camera.follow(); g.view.snapCamera(); g.view.update(1); });
      }
      previous = state.shots;
    }
    if (state.phase === 'collapse' || state.tick > 240 * 60) break;
  }
  const state = await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; return { tick: g.world.tick, actualTier: g.world.infected!.director.tier, renderTier: g.view.getState().quality, phase: g.world.missions!.state.l4!.phase, rows: (window as unknown as { sweepTank: ReturnType<typeof installTankProbe> }).sweepTank.rows }; });
  writeFileSync(`${out}/ledger.json`, JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-tank.ts')).digest('hex'), probeSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-tank-probe.ts')).digest('hex'),
    method: 'Actual protected-courier native complete input through current production renderer, no objective advance or actor relocation. Event-time exact Vfx.shots muzzle/tracerStart/end after real Vfx.gunshot clipping, not an assumed fallback height. Current MilitaryPerimeter concrete/wire/sign instance triangles tested by production three.js Raycaster at the exact event tick; a deliberate across-concrete ray is the positive geometry control. Only presentation is updated in the observer. First three shots inspected with camera-only photos while simulation is paused, then original follow camera restored before next sim tick. Not a mortal protection benchmark or performance test.', state, captures, errors: session.errors }, null, 2)+'\n');
  console.log(tier, 'done', state.rows.length);
} finally { await session.close(); stopServer(); }
