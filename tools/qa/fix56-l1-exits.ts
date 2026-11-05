/** Ordinary L1 opening: rendered exit stream plus an every-tick crossing ledger. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';

const out = process.env.L1_EXIT_OUT ?? 'test-results/fix56-a/L1-06-final';
const backend = process.env.L1_EXIT_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
  for (const tier of ['low', 'high'] as const) for (const zoom of [1.5]) {
    const session = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      await session.page.evaluate('window.__name = f => f');
      await session.page.evaluate(async ({ tier, zoom }) => {
        const a = window.__SS__!;
        a.settings.set({ quality: tier });
        await a.loadLevel('L1', { seed: 1 });
        a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(zoom); a.bot.start('complete');
        for (let i = 0; i < 720 && a.missions.state()!.l1!.phase !== 'accident'; i++) await a.step(10);
        if (a.missions.state()!.l1!.phase !== 'accident') throw new Error('Ordinary opening did not reach accident');
        for (let i = 0; i < 900 && a.missions.state()!.l1!.phase !== 'spread'; i++) await a.step(1);
        if (a.missions.state()!.l1!.phase !== 'spread') throw new Error('No infected exit');
        // Presentation-only inspection: keep the whole doorway in frame while
        // the ordinary bot continues to leave. No simulation state changes.
        const g = (window.__SCENE__ as unknown as { game: Game }).game, d = a.missions.state()!.l1!.labExit!;
        g.view.view.inspectionPose = { position: [d.x + 14, 18, d.z + 18], target: [d.x, 0, d.z + 3] };
        g.view.update(1);
      }, { tier, zoom });
      const samples = [], captures = [];
      for (let offset = 0; offset <= 360; offset++) {
        const sample = await session.page.evaluate(() => {
          const a = window.__SS__!, s = a.missions.state()!.l1!;
          return { tick: a.tick(), technicianId: s.techId, door: s.labExit,
            actors: s.exitIds.map(id => { const e = a.getEntity(id)!; return { id, hp: e.health.current, hidden: !!e.hidden, at: { ...e.transform } }; }) };
        });
        samples.push(sample);
        if ([0, 30, 60, 120, 180, 240, 360].includes(offset)) {
          await session.page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
          const file = `${out}/captures/${tier}-z${zoom}-${offset}.png`;
          await session.page.screenshot({ path: file });
          captures.push({ offset, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
        }
        if (offset < 360) await session.page.evaluate(async () => { await window.__SS__!.step(1); });
      }
      assert.deepEqual(session.errors, []);
      rows.push({ tier, backend, zoom, samples, captures });
      console.log(JSON.stringify({ tier, zoom, samples: samples.length, captures: captures.length }));
    } finally { await session.close(); }
  }
} finally {
  stopServer();
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...provenance(),
    toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    method: 'Ordinary native complete InputFrames in the real browser; fixed presentation-only doorway inspection camera (both requested zoom settings recorded, pose held fixed); no actor relocation or protection; every tick from release through six seconds. Native acceptance independently measures crossing order and four-metre departure headings.', rows }, null, 2) + '\n');
}
