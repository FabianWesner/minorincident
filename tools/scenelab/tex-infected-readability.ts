/** Presented-pixel photometry, using the production depth/pose preserving ID pass.
 * E2E_UNITS=1, SCENE_PORT=4492; TEX_ROOT/TEX_VARIANT select the pinned A/B build. */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import type { Game } from '../../src/Game';
import type { InstancedMesh, InterleavedBufferAttribute } from 'three';
import type { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson, type Backend } from './session';

const worktree = resolve(import.meta.dirname, '../..');
const report = resolve(worktree, 'docs/reports/tex-infected');
const raw = '/private/tmp/tex-infected-readability';
const variant = process.env.TEX_VARIANT ?? 'after';
if (process.env.TEX_ROOT) process.chdir(process.env.TEX_ROOT);
mkdirSync(raw, { recursive: true });
const rows: unknown[] = [];
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const luma = (r: number, g: number, b: number) => .2126 * linear(r / 255) + .7152 * linear(g / 255) + .0722 * linear(b / 255);
const backends: Backend[] = process.env.TEX_BACKEND ? [process.env.TEX_BACKEND as Backend] : ['webgl2', 'webgpu'];
try {
  for (const backend of backends) for (const tier of ['low', 'high'] as const) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      for (const framing of ['z1', 'z1.5', 'close', 'crowd30'] as const) {
        const crowd = framing === 'crowd30';
        const models = ['inf.common-worker', 'inf.jogger', 'inf.delivery-driver'];
        const actors: NonNullable<SceneSpec['actors']> = crowd ? Array.from({ length: 30 }, (_, i) => ({
          id: `infected-${i}`, kind: 'infected', archetype: 'infected.sprinter',
          at: [(i % 6 - 2.5) * 1.35, (Math.floor(i / 6) - 2) * 1.35], yaw: 315,
          look: { model: models[i % models.length] }, state: 'idle',
        })) : [{ id: 'suit', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], yaw: 315, look: { model: 'inf.common-worker' }, state: 'idle' }];
        await session.load({ name: `suit-readability-${framing}`, ground: 'asphalt', time: 'L1', dof: false, infectedCap: 60,
          camera: framing === 'close' || crowd ? { mode: 'close', target: [0, .8, 0], radius: crowd ? 24 : 9 } : { mode: 'game', target: [0, .8, 0], zoom: framing === 'z1' ? 1 : 1.5 }, actors });
        await session.step(1); await session.ready();
        const eyeRegions = crowd ? [] : await session.page.evaluate(() => {
          const view = (window.__SCENE__ as unknown as { game: Game }).game.view;
          const batches = (view as unknown as { crowd: { batches: Map<string, { mesh: InstancedMesh; poses: CrowdPosePalette; state: InterleavedBufferAttribute; tint: InterleavedBufferAttribute }> } }).crowd.batches;
          const batch = [...batches.values()].find(b => b.mesh.count > 0)!;
          const geometry = batch.mesh.geometry, positions = geometry.getAttribute('position'), parts = geometry.getAttribute('_parts');
          const head = batch.poses.clip.parts.indexOf('head');
          const explicit = Array.from({ length: parts.count }, (_, i) => parts.getZ(i)).some(n => n > 1.5);
          const eyes = Array.from({ length: parts.count }, (_, i) => i).filter(i => parts.getX(i) === head && parts.getZ(i) >= (explicit ? 1.5 : .5));
          const zs = eyes.map(i => positions.getZ(i)), middle = (Math.min(...zs) + Math.max(...zs)) / 2;
          const instance = batch.mesh.matrix.clone(), pose = instance.clone(); batch.mesh.getMatrixAt(0, instance);
          batch.poses.part(batch.state.getX(0), Math.floor(batch.tint.getW(0) / 2), batch.tint.getW(0) % 2, head, pose);
          const point = view.camera.position.clone();
          return [false, true].map(side => {
            const projected = eyes.filter(i => (positions.getZ(i) >= middle) === side).map(i => {
              point.fromBufferAttribute(positions, i).applyMatrix4(pose).applyMatrix4(instance).project(view.camera);
              return [(point.x + 1) / 2 * innerWidth, (1 - point.y) / 2 * innerHeight];
            });
            return [Math.floor(Math.min(...projected.map(p => p[0]))), Math.floor(Math.min(...projected.map(p => p[1]))), Math.ceil(Math.max(...projected.map(p => p[0]))), Math.ceil(Math.max(...projected.map(p => p[1])))];
          });
        });
        const prefix = `${raw}/${variant}-${backend}-${tier}-${framing}`;
        const bytes = await session.page.screenshot({ path: `${prefix}.png` });
        await session.page.evaluate(() => {
          const view = (window.__SCENE__ as unknown as { game: Game }).game.view;
          // The ID pass also paints the transparent contact-shadow quad. Exclude
          // that receiver: it is ground, and would inflate body area/luminance.
          (view as unknown as { crowd: { shadows: { layers: { mask: number } } } }).crowd.shadows.layers.mask = 0;
          view.probeCrowdMask(true);
        });
        const mask = PNG.sync.read(await session.page.screenshot({ path: `${prefix}-mask.png` }));
        await session.page.evaluate(() => {
          const view = (window.__SCENE__ as unknown as { game: Game }).game.view;
          (view as unknown as { crowd: { shadows: { layers: { mask: number } } } }).crowd.shadows.layers.mask = 1;
          view.probeCrowdMask(false);
        });
        const image = PNG.sync.read(bytes), pixels: number[] = [];
        let x0 = image.width, y0 = image.height, x1 = 0, y1 = 0;
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
          const p = (y * image.width + x) * 4;
          if (mask.data[p] > 180 && mask.data[p + 1] < 60 && mask.data[p + 2] > 180) {
            pixels.push(p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
        }
        if (!pixels.length) throw new Error('Empty production crowd silhouette');
        const figureLuminance = pixels.reduce((n, p) => n + luma(image.data[p], image.data[p + 1], image.data[p + 2]), 0) / pixels.length;
        // Top 48% contains the head in both rigs. Saturated bright red rejects skin,
        // hair, shirt and the lower tie. Report area as well as the brightest pixel.
        const eyes = pixels.filter(p => Math.floor(p / 4 / image.width) < y0 + (y1 - y0) * .48 && image.data[p] >= 180 && image.data[p] - Math.max(image.data[p + 1], image.data[p + 2]) >= 45);
        const eyeLuminance = eyes.length ? Math.max(...eyes.map(p => luma(image.data[p], image.data[p + 1], image.data[p + 2]))) : 0;
        const eyeCores = eyeRegions.map(bounds => {
          const values: number[] = []; let redPixels = 0, peakRed = 0;
          for (let y = bounds[1]; y <= bounds[3]; y++) for (let x = bounds[0]; x <= bounds[2]; x++) {
            const p = (y * image.width + x) * 4, r = image.data[p], g = image.data[p + 1], b = image.data[p + 2];
            if (r >= 180 && r - Math.max(g, b) >= 45) { redPixels++; values.push(luma(r,g,b)); peakRed = Math.max(peakRed,r); }
          }
          return { bounds, redPixels, peakLuminance: Math.max(0,...values), meanLuminance: values.reduce((n,v)=>n+v,0) / Math.max(1, values.length), peakRed };
        });
        if (framing === 'close' && y1 - y0 < 150) throw new Error(`Close figure only ${y1 - y0}px tall`);
        const render = await session.page.evaluate(() => window.__SS__!.getState().render);
        rows.push({ variant, backend, tier, framing, bounds: [x0, y0, x1, y1], heightPx: y1 - y0 + 1,
          figurePixels: pixels.length, figureLuminance, eyeCores, eyePixels: eyes.length, eyePeakLuminance: eyeLuminance,
          eyePeakRGB: eyes.length ? eyes.map(p => Array.from(image.data.subarray(p, p + 3))).sort((a,b) => luma(...b as [number,number,number])-luma(...a as [number,number,number]))[0] : null,
          figures: render.crowd?.figures.length, meshDraws: render.crowd?.meshDrawCalls, errors: session.errors.slice() });
        console.log(JSON.stringify(rows.at(-1)));
        if (session.errors.length) throw new Error(session.errors.join('\n'));
      }
    } finally { await session.close(); }
  }
} finally { stopServer(); writeJson(`${report}/${variant}-readability.json`, rows); }
