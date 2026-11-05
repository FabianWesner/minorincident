/** vqa-fix-1: L10 console charge and Mega kill with the native L10 sim bot (vqa-1 P1 courier hidden at the console,
 * P2 Mega death flash). Fixed ticks, production follow camera; frames every VQA_EVERY ticks into git-ignored test-results. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l10hold';
const backend = (process.env.VQA_BACKEND ?? 'webgpu') as 'webgl2' | 'webgpu';
const tier = (process.env.VQA_TIER ?? 'high') as 'high' | 'low';
const zoom = Number(process.env.VQA_ZOOM ?? 1);
const every = Number(process.env.VQA_EVERY ?? 120), maxTicks = Number(process.env.VQA_TICKS ?? 6000);
const checkpoint = process.env.VQA_CHECKPOINT ?? 'cure-complex';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
  try {
    await s.open();
    await s.page.evaluate('window.__name = f => f');
    await s.page.evaluate(async ({ tier, zoom, checkpoint, start }) => {
      const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
      await a.loadLevel('L10', { seed: 32, checkpoint });
      a.pause(); a.cheats.god(true);
      if (start) { const g = (window.__SCENE__ as unknown as { game: Game }).game, c = g.world.missions!.def.anchors['cure-console']; a.teleport(1, { x: c.x + start[0], z: c.z + start[1] }); await a.step(30); }
      a.camera.follow(); a.camera.zoom(zoom); a.bot.start('complete');
    }, { tier, zoom, checkpoint, start: process.env.VQA_START ? process.env.VQA_START.split(',').map(Number) : null });
    let elapsed = 0, step = every, after = 0;
    for (let n = 0; elapsed < maxTicks; n++) {
      const info = await s.page.evaluate(async every => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        // The checkpoint fixture leaves the Mega dormant; introduce it beside the arena once its step is active.
        const active = g.world.missions!.def.steps.find(item => g.world.missions!.state.steps[item.id]?.status === 'active')?.id;
        const mp = g.world.megaPursuit;
        if (active === 'mega' && mp && mp.state.mode === 'dormant') { const c = g.world.missions!.def.anchors['cure-console']; mp.introduce({ x: c.x + 10, z: c.z + 8 }); }
        let blasts = 0; const off = g.world.events.on('explosion', () => { blasts++; });
        await a.step(every); off(); await a.screenshotReady();
        const p = g.world.entities.get(1)!.transform, m = g.world.megaPursuit?.state, st = g.world.missions?.state;
        const step = st && g.world.missions!.def.steps.find(item => st.steps[item.id]?.status === 'active')?.id;
        return { tick: g.world.tick, step, charge: st?.counters['charge-ticks'], player: [+p.x.toFixed(1), +p.z.toFixed(1)], mega: m ? { mode: m.mode, hp: m.hp, d: +Math.hypot(m.x - p.x, m.z - p.z).toFixed(1) } : null, blasts, zoom: +g.view.view.playerZoom.toFixed(2) };
      }, step);
      elapsed += step;
      // Dense frames around the kill: every 4 ticks once the Mega is below 15 % or dead, for 1.5 s.
      if (info.mega && info.mega.mode !== 'dormant' && info.mega.hp < 450) { step = 4; if ((after += 4) > 90) break; }
      const file = `${out}/${backend}-${tier}-z${zoom}-${String(n).padStart(3, '0')}-t${info.tick}.png`;
      await s.page.screenshot({ path: file });
      rows.push({ ...info, file });
      writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1));
      if (info.step === 'epilogue') break;
    }
    if (s.errors.length) rows.push({ errors: s.errors });
  } finally { await s.close(); }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
