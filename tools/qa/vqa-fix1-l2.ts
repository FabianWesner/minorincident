/** vqa-fix-1: L2 fire-engine hull reveal (ride + doors on foot) and rescue-door camera radius.
 * Native no-axe bot, fixed ticks, production follow camera. Captures go to test-results (git-ignored). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.VQA_OUT ?? 'test-results/vqa-fix-1/l2';
const backends = (process.env.VQA_BACKENDS ?? 'webgpu,webgl2').split(',') as ('webgl2' | 'webgpu')[];
const tiers = (process.env.VQA_TIERS ?? 'high,low').split(',') as ('high' | 'low')[];
const zooms = (process.env.VQA_ZOOMS ?? '0.5,1.5').split(',').map(Number);
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const backend of backends) for (const tier of tiers) for (const zoom of zooms) {
    const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await s.open();
      await s.page.evaluate('window.__name = f => f');
      await s.page.evaluate(async ({ tier, zoom }) => {
        const a = window.__SS__!; a.settings.set({ quality: tier });
        await a.loadLevel('L2', { seed: 1, progression: 'L2-default' });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(zoom); a.bot.start('no-axe');
        for (let i = 0; i < 160 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
        while (a.getState().tick - a.missions.state()!.l2!.departAt < 180) await a.step(1);
        await a.screenshotReady();
      }, { tier, zoom });
      const shot = async (beat: string) => { const file = `${out}/${backend}-${tier}-z${zoom}-${beat}.png`; await s.page.screenshot({ path: file }); return file; };
      const reveal = () => s.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game;
        const l2 = g.world.missions!.state.l2!, p = g.world.entities.get(1)!.transform;
        return { tick: g.world.tick, phase: l2.phase, seated: l2.seated, player: [p.x, p.z], radius: g.view.view.getState().radius, actualZoom: g.view.view.playerZoom };
      });
      rows.push({ backend, tier, zoom, beat: 'ride3', ...(await reveal()), file: await shot('ride3') });
      const hull = () => s.page.evaluate(async () => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game as unknown as { view: { vehicles: { reveal: Map<number, { on: { value: number } }> } } };
        const st = (await import(/* @vite-ignore */ '/src/render/SeeThrough.ts' as string) as typeof import('../../src/render/SeeThrough')).seeThrough;
        const v = (u: { value: unknown }) => { const x = u.value as number | { x: number; y: number }; return typeof x === 'number' ? +x.toFixed(3) : [+x.x.toFixed(3), +x.y.toFixed(3)]; };
        return { on: [...g.view.vehicles.reveal].filter(([, r]) => r.on.value > .5).map(([id, r]) => [id, r.on.value]),
          clean: v(st.hullClean), hullCenter: v(st.hullCenter), hullRadius: v(st.hullRadius), center: v(st.center), solidRadius: v(st.solidRadius), retain: v(st.retain), strength: v(st.strength) };
      });
      await s.page.evaluate(async () => {
        const a = window.__SS__!;
        for (let i = 0; i < 4000 && a.missions.state()!.l2!.phase === 'ride'; i++) await a.step(2);
        await a.step(20); await a.screenshotReady();
      });
      rows.push({ backend, tier, zoom, beat: 'arrive', ...(await reveal()), hull: await hull(), file: await shot('arrive') });
      await s.page.evaluate(async () => { const a = window.__SS__!; await a.step(40); await a.screenshotReady(); });
      rows.push({ backend, tier, zoom, beat: 'arrive2', ...(await reveal()), hull: await hull(), file: await shot('arrive2') });
      // Arrival through doorsOpen + 4 s: radius trace every 6 ticks, captures at doors and +2 s.
      const trace = await s.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const l2 = () => g.world.missions!.state.l2!;
        const samples: [number, string, number][] = [];
        for (let i = 0; i < 4000 && l2().phase !== 'doors'; i++) { await a.step(6); samples.push([g.world.tick, l2().phase, +g.view.view.getState().radius.toFixed(2)]); }
        for (let i = 0; i < 90; i++) await a.step(1);
        await a.screenshotReady();
        return samples;
      });
      rows.push({ backend, tier, zoom, beat: 'doors', ...(await reveal()), hull: await hull(), file: await shot('doors') });
      const trace2 = await s.page.evaluate(async () => {
        const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
        const l2 = () => g.world.missions!.state.l2!;
        const samples: [number, string, number][] = [];
        for (let i = 0; i < 2000 && !l2().doorsOpenAt; i++) { await a.step(6); samples.push([g.world.tick, l2().phase, +g.view.view.getState().radius.toFixed(2)]); }
        for (let i = 0; i < 50; i++) { await a.step(6); samples.push([g.world.tick, l2().phase, +g.view.view.getState().radius.toFixed(2)]); }
        await a.screenshotReady();
        return samples;
      });
      rows.push({ backend, tier, zoom, beat: 'open5', ...(await reveal()), file: await shot('open5'), trace: [...trace, ...trace2] });
      // Natural follow-up: the bot fights around the engine after the doors open; one frame per second.
      for (let i = 1; i <= 6; i++) {
        await s.page.evaluate(async () => { const a = window.__SS__!; await a.step(60); await a.screenshotReady(); });
        rows.push({ backend, tier, zoom, beat: `fight${i}`, ...(await reveal()), hull: await hull(), file: await shot(`fight${i}`) });
      }
      if (s.errors.length) rows.push({ errors: s.errors });
    } finally { await s.close(); }
  }
} finally { stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
