// @ts-nocheck -- temporary browser experiment, retained under the report's method/ directory
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import { measureCourierShare } from '../scenelab/run';
const out = 'test-results/collision-s4-reveal-probe'; mkdirSync(out, { recursive: true });
const moduleUrl = '/build/' + readdirSync('/tmp/collision-s4-qa-dist/build').find(n => /^registry-.*\.js$/.test(n));
const rows = [];
for (const tier of ['high', 'low']) {
  const s = new SceneSession({ backend: 'webgpu', tier, viewport: { width: 960, height: 540 } });
  try {
    await s.open();
    await s.page.evaluate(`(async () => {
      const module = await import(${JSON.stringify(moduleUrl)}), hole = Object.values(module).find(v => v && typeof v === 'object' && 'bossRadius' in v);
      if (!hole) throw new Error('compiled reveal uniforms not exported');
      window.__revealSweep = { factor: 1 / .6 };
      Object.defineProperty(hole.bossRadius, 'value', { configurable: true, get: () => hole.solidRadius.value * .85 * window.__revealSweep.factor, set: () => {} });
    })()`);
    for (const zoom of [1.5, 1, .5]) {
      const spec = readSpec('tests/scenes/catalog/l10-mega-close-contact.json');
      await s.load({ ...spec, camera: { ...spec.camera, zoom } }); let previous = 0;
      for (const frame of [120, 440, 520]) {
        await s.step(frame - previous); previous = frame;
        for (const factor of [0, .5, .75, 1, 1 / .6]) {
          await s.page.evaluate(factor => { window.__revealSweep.factor = factor; }, factor);
          const proof = await measureCourierShare(s, true); rows.push({ tier, zoom, frame, factor, ...proof });
          writeFileSync(`${out}/samples.json`, JSON.stringify(rows, null, 2));
          console.log(JSON.stringify(rows.at(-1)));
          if (frame === 440 && [0, .5, .75].includes(factor)) await s.screenshot(`${out}/${tier}-z${zoom}-r${factor}.png`);
        }
      }
    }
  } finally { await s.close(); stopServer(); }
}
