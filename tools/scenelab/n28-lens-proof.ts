import type { Game } from '../../src/Game';
import type { LodBatch } from '../../src/render/district/DistrictBuild';
import { PNG } from 'pngjs';
import { measureCut } from './run';
import { SceneSession, readSpec, stopServer, writeJson } from './session';

/** Negative control for the real convoy/bike mask. Force every tall solid to
 * clear its foreground without a disc, then measure with the same strict gate. */
const out = 'test-results/n28-followups/lens-proof';
const session = new SceneSession({ backend: 'webgpu', tier: 'high', viewport: { width: 960, height: 540 } });
declare global { interface Window { __n28RestoreCut?: () => void } }
try {
  await session.open();
  const results = [];
  for (const [name, zoom, frame] of [['seethrough-scripted-convoy', 1.5, 300], ['seethrough-scripted-convoy', 1.5, 360], ['seethrough-bike-ride', .5, 0], ['seethrough-bike-ride', .5, 240]] as const) {
    const spec = readSpec(`tests/scenes/catalog/${name}.json`);
    spec.camera = { ...spec.camera!, zoom } as typeof spec.camera;
    await session.load(spec);
    if (frame) await session.step(frame);
    await session.screenshot(`${out}/${name}-${frame}-normal.png`);
    const normal = await measureCut(session, spec.expect?.seeThroughLensPlacements);
    let compositorAudit;
    if (name === 'seethrough-scripted-convoy' && frame === 300) {
      const cut = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
      const hole = await session.page.evaluate(() => window.__SCENE__!.cutProbe(true));
      await session.ready();
      const full = PNG.sync.read(await session.page.screenshot({ type: 'png' }));
      await session.page.evaluate(() => window.__SCENE__!.cutProbe(false));
      let outside = 0, maxBeyondRadiusPx = 0;
      if (!hole) throw new Error('Missing compositor audit disc');
      for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) {
        const i = (y * cut.width + x) * 4;
        const delta = Math.abs(cut.data[i] - full.data[i]) + Math.abs(cut.data[i + 1] - full.data[i + 1]) + Math.abs(cut.data[i + 2] - full.data[i + 2]);
        const beyond = Math.hypot(x + .5 - hole.center[0] * cut.width, y + .5 - hole.center[1] * cut.height) - hole.solidRadius * cut.height;
        if (delta >= 36 && beyond > 1.5) { outside++; maxBeyondRadiusPx = Math.max(maxBeyondRadiusPx, beyond); }
      }
      compositorAudit = { outside, maxBeyondRadiusPx, surfaceOutside: normal.outside, cover: hole.cover };
    }
    await session.page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const occlusion = game.view.labProbes().districts!.occlusion;
      const parts = (occlusion as unknown as { parts: { lodBatches: LodBatch[] } }).parts;
      const update = occlusion.update;
      window.__n28RestoreCut = () => { occlusion.update = update; };
      occlusion.update = function (...args) {
        update.apply(this, args);
        for (const entry of parts.lodBatches) if (entry.height >= 1.1) for (const ref of entry.refs) {
          for (const batch of [entry.hero, entry.near, entry.far]) batch.seeThrough(true, ref, true);
        }
      };
    });
    let injected;
    try {
      injected = await measureCut(session, spec.expect?.seeThroughLensPlacements);
      await session.screenshot(`${out}/${name}-${frame}-injected.png`);
    } finally {
      await session.page.evaluate(() => { window.__n28RestoreCut?.(); delete window.__n28RestoreCut; window.__SCENE__!.cutProbe(false); });
    }
    const normalPass = normal.outside === 0 && !normal.unexpectedLensPlacements?.length;
    const injectedPass = injected.outside === 0 && !injected.unexpectedLensPlacements?.length;
    const metrics = await session.metrics(), consoleErrors = session.errors.slice();
    if (metrics.backend !== 'webgpu' || metrics.quality !== 'high' || consoleErrors.length) throw new Error(`Invalid render control: ${name}: ${JSON.stringify(consoleErrors)}`);
    const result = { name, zoom, frame, backend: metrics.backend, quality: metrics.quality, consoleErrors, compositorAudit, normal: { ...normal, pass: normalPass }, injected: { ...injected, pass: injectedPass } };
    results.push(result); writeJson(`${out}/proof.json`, results);
    console.log(JSON.stringify({ name, zoom, frame, normalOutside: normal.outside, injectedOutside: injected.outside, unexpectedLensPlacements: injected.unexpectedLensPlacements.length, compositorAudit, normalPass, injectedPass }));
    if (!normalPass || injectedPass) throw new Error(`Lens-mask control failed: ${name} f${frame}`);
  }
} finally { await session.close(); stopServer(); }
