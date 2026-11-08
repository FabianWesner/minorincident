/** E25 sixty-second real-input walk: forty anchors, hysteresis, blend duration and pool-centre pixels. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Lighting } from '../../src/render/Lighting';
import type { FieldLight } from '../../src/render/LightField';
const tier = process.argv.includes('--low') ? 'low' : 'high';
const out = `test-results/epics/E25/walk-${tier}`; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier, backend: 'webgl2' });
try {
  await session.open();
  // tsx preserves local function names with this identity helper inside serialized callbacks.
  await session.page.evaluate('globalThis.__name = (fn) => fn');
  await session.load({ name: 'forty-lights', size: 300, ground: 'asphalt', time: 'night', dof: false, actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'follow', actor: 'courier', zoom: 1 } });
  await session.ready();
  const result = await session.page.evaluate(async () => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const lighting = (game.view as unknown as { lighting: Lighting }).lighting;
    const fields: FieldLight[] = Array.from({ length: 40 }, (_, i) => ({ id: `walk-${i}`, x: i * 3, y: 3.4, z: 3.5, radius: 5, aimX: 0, aimZ: 0, stretch: 1, r: 1, g: .9, b: .7, on: true, hero: true, flicker: 0, strobe: false, seed: i }));
    for (const f of fields) game.world.lightPower!.register({ id: f.id!, group: 'walk', x: f.x, y: f.y!, z: f.z, range: 10, breakable: true }, true);
    lighting.field.setStatic(fields); lighting.set('night');
    const gl = (game.view.renderer.backend as unknown as { gl: WebGL2RenderingContext }).gl, pixel = new Uint8Array(16);
    const width = game.view.renderer.domElement.width, height = game.view.renderer.domElement.height;
    const linear = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
    const frames: { frame: number; x: number; id: string | null; blend: number; lights: number; maps: number; samples: { light: number; luminance: number }[] }[] = [];
    let maxDelta = 0, worst: unknown = null;
    const previous = new Map<number, { frame: number; luminance: number }>();
    for (let frame = 0; frame < 3600; frame++) {
      game.world.setInput({ move: { x: 1, z: 0 }, walk: true }); game.world.update(); game.view.advance(1 / 60); game.view.renderer.nextNodeFrame(); game.view.update(1);
      const state = lighting.getState(), samples: { light: number; luminance: number }[] = [];
      for (const [i, f] of fields.entries()) {
        const q = game.view.project(f.x, .05, f.z);
        const sx = (q[0] + 1) * width / 2 - .5, sy = (1 - q[1]) * height / 2 - .5, x = Math.floor(sx), y = Math.floor(sy), tx = sx - x, ty = sy - y;
        if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4 || q[2] < -1 || q[2] > 1) continue;
        gl.readPixels(x, height - 2 - y, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        const levels = [0, 4, 8, 12].map(i => .2126 * linear(pixel[i]) + .7152 * linear(pixel[i + 1]) + .0722 * linear(pixel[i + 2]));
        const luminance = (levels[2] * (1 - tx) + levels[3] * tx) * (1 - ty) + (levels[0] * (1 - tx) + levels[1] * tx) * ty;
        const last = previous.get(i);
        if (last?.frame === frame - 1 && last.luminance > .001) { const delta = Math.abs(luminance - last.luminance) / last.luminance; if (delta > maxDelta) { maxDelta = delta; worst = { frame, light: i, before: last.luminance, after: luminance, hero: state.heroLight }; } }
        previous.set(i, { frame, luminance }); samples.push({ light: i, luminance });
      }
      frames.push({ frame, x: game.world.entities.get(1)!.transform.x, id: state.heroLight, blend: state.promotionBlend, lights: state.heroLights, maps: state.heroShadowMaps, samples });
      if (frame % 60 === 0) await new Promise<void>(r => requestAnimationFrame(() => r()));
    }
    game.world.clearInput();
    const changes = frames.filter((f, i) => i === 0 || f.id !== frames[i - 1].id);
    const rollingMax = Math.max(...changes.map(c => changes.filter(d => d.frame >= c.frame && d.frame < c.frame + 60).length));
    const fades = changes.filter(c => c.id !== null).map(c => ({ frame: c.frame, id: c.id, start: c.blend, completeFrame: frames.find(f => f.frame >= c.frame && f.id === c.id && f.blend >= 1)?.frame ?? null }));
    return { seconds: 60, anchors: 40, backend: game.view.renderer.selectedBackend, actualTier: game.view.getState().quality, distanceM: frames.at(-1)!.x - frames[0].x, rollingMax, maxLights: Math.max(...frames.map(f => f.lights)), maxMaps: Math.max(...frames.map(f => f.maps)), readback: 'bilinear linear luminance at the projected world pool centre', maxPixelDelta: maxDelta, worst, changes, fades, frames };
  });
  writeFileSync(`${out}/measurements.json`, JSON.stringify({ ...result, errors: session.errors }, null, 2) + '\n');
  await session.screenshot(`${out}/end.png`);
  console.log(JSON.stringify({ tier, distanceM: result.distanceM, rollingMax: result.rollingMax, maxLights: result.maxLights, maxMaps: result.maxMaps, maxPixelDelta: result.maxPixelDelta, worst: result.worst, frames: result.frames.length, file: `${out}/measurements.json`, errors: session.errors }));
} finally { await session.close(); stopServer(); }
