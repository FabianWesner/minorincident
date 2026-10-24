/** Reproducible common-worker A/B camera and motion captures. Run through e2e-lock.
 * TEX_ROOT selects the pinned main worktree; TEX_VARIANT labels its receipt.
 * SCENE_SERVER=preview uses the remotely built production output. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
const worktree = resolve(import.meta.dirname, '../..');
const report = resolve(worktree, 'docs/reports/tex-infected');
const raw = '/private/tmp/tex-infected-captures';
const variant = process.env.TEX_VARIANT ?? 'after';
const motion = process.env.TEX_MODE === 'motion';
if (process.env.TEX_ROOT) process.chdir(process.env.TEX_ROOT);
mkdirSync(raw, { recursive: true }); mkdirSync(report, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const receipts: unknown[] = [];
const backends: Backend[] = process.env.TEX_BACKEND ? [process.env.TEX_BACKEND as Backend] : ['webgl2', 'webgpu'];
try {
for (const backend of backends) for (const tier of (motion ? ['high'] : ['high', 'low']) as ('high' | 'low')[]) {
  const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
  try {
    await session.open();
    if (motion) {
      await session.load({ name: 'textured-infected-motion', ground: 'asphalt', time: 'L1', dof: false, trace: true,
        camera: { mode: 'game', target: [0, .8, 0], zoom: 1.5 },
        actors: [
          { id: 'courier', kind: 'courier', at: [2.8, 0], god: true },
          { id: 'suit', kind: 'infected', archetype: 'infected.sprinter', at: [-2, 0], look: { model: 'inf.common-worker' }, state: { walk: [[-2, 0], [0, 0]], loop: true } },
        ], script: [
          { frame: 90, actor: 'suit', do: { run: [[-2, 0], [0, 0]], loop: true } },
          { frame: 180, actor: 'suit', do: { attack: 'courier', seconds: 1 } },
        ] });
      const images: Buffer[] = [], samples: unknown[] = [];
      for (const frame of [30, 120, 210, 241, 420, 540]) {
        const current = await session.page.evaluate(() => window.__SCENE__!.frame);
        if (frame === 241) {
          await session.step(240 - current);
          await session.page.evaluate(() => {
            const a = window.__SS__!, e = a.query({ kind: 'infected' })[0];
            a.explosions.blast('explosion.rocket', { x: e.transform.x, z: e.transform.z });
          });
          await session.step(1);
        } else await session.step(frame - current);
        await session.ready();
        await session.page.evaluate(label => {
          let el = document.getElementById('tex-receipt'); if (!el) { el = document.createElement('div'); el.id = 'tex-receipt'; el.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#111b;padding:6px;font:16px monospace;z-index:9999'; document.body.append(el); } el.textContent = label;
        }, `${variant} ${backend} ${tier} frame ${frame}`);
        images.push(await session.page.screenshot());
        samples.push(await session.page.evaluate(() => ({ frame: window.__SCENE__!.frame, infected: window.__SS__!.query({ kind: 'infected' }), crowd: window.__SS__!.getState().render.crowd })));
      }
      const sheet = new PNG({ width: 2560, height: 2160 });
      images.forEach((bytes, i) => PNG.bitblt(PNG.sync.read(bytes), sheet, 0, 0, 1280, 720, i % 2 * 1280, Math.floor(i / 2) * 720));
      writeFileSync(`${report}/motion-${backend}.png`, PNG.sync.write(sheet));
      receipts.push({ backend, tier, samples, metrics: await session.metrics(), errors: session.errors });
    } else for (const zoom of [1, 1.5]) {
      await session.load({ name: 'common-infected-ab', ground: 'asphalt', time: 'L1', dof: false, trace: true,
        camera: { mode: 'game', target: [0, .8, 0], zoom },
        actors: [{ id: 'suit', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], yaw: 315, look: { model: 'inf.common-worker' }, state: 'idle' }] });
      await session.step(1); await session.ready();
      await session.page.evaluate(label => {
        const el = document.createElement('div'); el.style.cssText = 'position:fixed;top:0;left:0;color:white;background:#111b;padding:6px;font:16px monospace;z-index:9999'; el.textContent = label; document.body.append(el);
      }, `${variant} ${revision.slice(0, 8)} ${backend} ${tier} zoom ${zoom}`);
      await session.page.screenshot({ path: `${raw}/${variant}-${backend}-${tier}-z${zoom}.png` });
      receipts.push({ revision, backend, tier, zoom, metrics: await session.metrics(), render: await session.page.evaluate(() => window.__SS__!.getState().render), errors: session.errors });
    }
    if (session.errors.length) throw new Error(session.errors.join('\n'));
  } finally { await session.close(); }
}
} finally { stopServer(); writeJson(`${report}/${variant}-${motion ? 'motion' : 'visual'}.json`, receipts); }
