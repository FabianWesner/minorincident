/** Regression receipt: the distant walking cast must produce finite HDR on WebGL2. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RenderTarget } from 'three/webgpu';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, readSpec } from '../scenelab/session';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 960, height: 540 } });
const out = process.env.SLIM_HDR_OUT ?? 'docs/reports/slim/qa/ped-hdr-after.json', rows = [];
try {
  await session.open(); await session.load(readSpec('specs/scenes/catalog/ped-walk-all.json'));
  let previous = 0;
  for (const frame of [0, 60, 240, 420, 580]) {
    if (frame > previous) await session.step(frame - previous);
    previous = frame; await session.ready();
    const hdr = await session.page.evaluate(async () => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const target = (game.view as unknown as { postFx: { scenePass: { renderTarget: RenderTarget } } }).postFx.scenePass.renderTarget;
      const pixels = await game.view.renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
      let nonfinite = 0;
      for (const value of pixels) if (pixels instanceof Float32Array ? !Number.isFinite(value) : (value & 0x7c00) === 0x7c00) nonfinite++;
      return { nonfinite, samples: pixels.length };
    });
    rows.push({ frame, ...hdr }); console.log(frame, hdr); assert.equal(hdr.nonfinite, 0);
  }
  assert.deepEqual(session.errors, []); mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ backend: 'webgl2', tier: 'high', pass: true, rows, errors: session.errors }, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
