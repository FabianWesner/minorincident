/** Q-187..189: production hat bounds, depth-tested native eye pixels, and face-paint continuity. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, writeJson } from './session';
import type { Game } from '../../src/Game';
import type { Group, InstancedMesh, BufferGeometry, Matrix4 } from 'three';
const out = resolve(process.env.HAT_OUT ?? 'test-results/l1-hats-faces');
const models = (process.env.HAT_MODELS ?? 'npc.civilian-man-a,npc.civilian-man-b,npc.civilian-woman-a,npc.civilian-woman-b,npc.civilian-elderly,npc.depot-clerk').split(',');
const hats = (process.env.HAT_IDS ?? 'baseball-cap,beanie,sun-hat,hard-hat,flat-cap,bucket-hat').split(',').map(id => `acc.hat-${id}`);
const tier = process.env.HAT_TIER === 'high' ? 'high' : 'low';
const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width: 1600, height: 900 }, seed: 18, query: { crowdProbe: 'full' } });
const continuity = new Map<string, { meanError: number; maxError: number; taggedVertices: number }>();
const receipts: { model: string; hat: string; infected: boolean; pass: boolean; [key: string]: unknown }[] = [];
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const luma = (r: number, g: number, b: number) => .2126 * linear(r / 255) + .7152 * linear(g / 255) + .0722 * linear(b / 255);
async function eyePass(name: string) {
  const native = PNG.sync.read(await session.screenshot(resolve(out, `${name}-native.png`)));
  await session.page.evaluate(async () => {
    const path = '/tools/scenelab/hat-eye-mask.ts';
    const { installEyeMask } = await import(path);
    (window as unknown as { eyeMask: ReturnType<typeof installEyeMask> }).eyeMask = installEyeMask((window.__SCENE__ as unknown as { game: Game }).game);
  });
  const capture = async (eyes: boolean, hats: boolean) => {
    await session.page.evaluate(({ eyes, hats }) => (window as unknown as { eyeMask: { set(eyes: boolean, hats: boolean): void } }).eyeMask.set(eyes, hats), { eyes, hats });
    return PNG.sync.read(await session.screenshot(resolve(out, `${name}-${eyes ? hats ? 'hat' : 'eyes' : 'black'}.png`)));
  };
  const black = await capture(false, false), naked = await capture(true, false), wearing = await capture(true, true);
  let reference = 0, retained = 0, pixels = 0, redPixels = 0, peak = 0;
  for (let i = 0; i < naked.data.length; i += 4) {
    const a = naked.data[i] + naked.data[i + 1] + naked.data[i + 2] - black.data[i] - black.data[i + 1] - black.data[i + 2];
    if (a < 6) continue;
    pixels++; reference += a;
    const b = wearing.data[i] + wearing.data[i + 1] + wearing.data[i + 2] - black.data[i] - black.data[i + 1] - black.data[i + 2];
    retained += Math.max(0, Math.min(a, b));
    const [r, g, blue] = native.data.subarray(i, i + 3);
    if (r - Math.max(g, blue) > 25) { redPixels++; peak = Math.max(peak, luma(r, g, blue)); }
  }
  await session.page.evaluate(() => (window as unknown as { eyeMask: { restore(): void } }).eyeMask.restore());
  return { pixels, reference, retained, visibility: reference ? retained / reference : 0, redPixels, peak };
}
try {
  await session.open();
  await session.page.evaluate("window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });");
  await session.load({ name: 'suit-eye-reference', ground: 'asphalt', time: 'L1', dof: false, size: 100,
    actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }, { id: 'figure', kind: 'infected', archetype: 'infected.sprinter', at: [0, 0], yaw: -45, look: { model: 'inf.common-worker' }, state: 'idle' }],
    camera: { mode: 'game', target: 'figure', zoom: 1.5 } });
  await session.step(60); await session.ready();
  await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: 'figure', radius: 5, azimuth: 45 }));
  const suitReference = await eyePass('suit-reference-close');
  assert.ok(suitReference.redPixels > 0 && suitReference.peak > 0, 'resolved suit-zombie reference eyes');
  for (const model of models) for (const hat of hats) for (const infected of [false, true]) {
    const name = `${model}-${hat}-${infected ? 'infected' : 'live'}`;
    await session.load({ name, ground: 'asphalt', time: 'L1', dof: false, size: 100,
      actors: [{ id: 'courier', kind: 'courier', at: [40, 40] }, { id: 'figure', kind: 'pedestrian', at: [0, 0], yaw: -45, look: { model, accessories: [hat], handProp: null }, state: 'idle' }],
      script: infected ? [{ frame: 1, actor: 'figure', do: { infect: { instant: true } } }] : [], camera: { mode: 'game', target: 'figure', zoom: 1.5 } });
    await session.step(infected ? 240 : 60); await session.ready();
    const fit = await session.page.evaluate(async ({ model, hat }) => {
      const path = '/src/render/characters/CrowdAccessories.ts', three = '/node_modules/three/build/three.webgpu.js';
      const { skinnedBrow, bakedSkull } = await import(path), { Box3, Matrix4, Vector3 } = await import(three);
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const view = game.view as unknown as { scene: Group; accessories: Group & { fit(id: string, model: string): void; fitTransform: Matrix4 } };
      let geometry: BufferGeometry | undefined;
      view.scene.traverse(node => { const mesh = node as InstancedMesh; if (mesh.count && mesh.geometry?.userData.crowdBinds && (mesh.parent as Group & { model?: string })?.model === model) geometry = mesh.geometry; });
      if (!geometry) throw Error(`No production geometry for ${model}`);
      const brow = skinnedBrow(geometry), skull = bakedSkull(geometry), accessory = view.accessories.children.find(n => n.name === `${hat}:lod0`) as InstancedMesh;
      view.accessories.fit(hat, model);
      const box = new Box3().setFromBufferAttribute(accessory.geometry.getAttribute('position')).applyMatrix4(view.accessories.fitTransform), matrix = new Matrix4(); accessory.getMatrixAt(0, matrix);
      const parts = geometry.getAttribute('_parts'), position = geometry.getAttribute('position'), inverse = new Matrix4().fromArray(geometry.userData.crowdBinds, 3 * 16), point = new Vector3();
      let forehead = 0, retainedForehead = 0;
      for (let i = 0; i < parts.count; i++) if (parts.getX(i) === 3 && parts.getY(i) !== -6 && !parts.getZ(i) && parts.getW(i) < 1024) {
        point.fromBufferAttribute(position, i).applyMatrix4(inverse);
        if (point.x > skull!.centre.x && point.y > brow!.y - .04 && point.y < brow!.y + .06) { forehead++; if (parts.getW(i) < 4) retainedForehead++; }
      }
      return { forehead, retainedForehead, brow, skull, width: box.getSize(new Vector3()).z, ratio: box.getSize(new Vector3()).z / brow!.width, bottom: box.min.y, top: box.max.y, forwardY: matrix.elements[1], accessoryInstances: accessory.count, lod: geometry.userData.crowdLod };
    }, { model, hat });
    await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: 'figure', radius: 5, azimuth: 45 }));
    const close = await eyePass(`${name}-close`), peakRatio = close.peak / suitReference.peak;
    if (infected && !continuity.has(model)) {
      const taggedVertices = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        const saved: { geometry: BufferGeometry; values: [number, number][] }[] = [];
        game.view.scene.traverse(node => {
          const mesh = node as InstancedMesh; if (!mesh.count || !mesh.geometry?.userData.crowdBinds) return;
          const parts = mesh.geometry.getAttribute('_parts'), values: [number, number][] = [];
          for (let i = 0; i < parts.count; i++) if (parts.getX(i) === 3 && (parts.getY(i) === -1 || parts.getY(i) === 0)) { values.push([i, parts.getY(i)]); parts.setY(i, 0); }
          parts.needsUpdate = true; saved.push({ geometry: mesh.geometry, values });
        });
        (window as unknown as { savedFaceTags: typeof saved }).savedFaceTags = saved;
        return saved.reduce((n, row) => n + row.values.length, 0);
      });
      const retagged = PNG.sync.read(await session.screenshot(resolve(out, `${model}-continuous-tint.png`)));
      const original = PNG.sync.read(readFileSync(resolve(out, `${name}-close-native.png`)));
      let error = 0, maxError = 0;
      for (let i = 0; i < original.data.length; i++) if (i % 4 !== 3) { const d = Math.abs(original.data[i] - retagged.data[i]); error += d; maxError = Math.max(maxError, d); }
      continuity.set(model, { meanError: error / (original.width * original.height * 3), maxError, taggedVertices });
      await session.page.evaluate(() => {
        const saved = (window as unknown as { savedFaceTags: { geometry: BufferGeometry; values: [number, number][] }[] }).savedFaceTags;
        for (const row of saved) { const parts = row.geometry.getAttribute('_parts'); for (const [i, y] of row.values) parts.setY(i, y); parts.needsUpdate = true; }
      });
    }

    const eyePixels = [];
    for (const zoom of [1, 1.5]) {
      await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: 'figure', zoom }), zoom);
      eyePixels.push({ zoom, ...await eyePass(`${name}-z${zoom}`) });
    }
    const pass = fit.accessoryInstances > 0 && fit.ratio <= 1.15 + 1e-6 && fit.bottom >= fit.brow!.y && fit.forwardY >= -1e-5 && fit.forehead > 0 && fit.retainedForehead / fit.forehead >= .95
      && eyePixels.every(e => e.pixels > 0 && e.visibility >= .95) && (!infected || peakRatio >= .95 && peakRatio <= 1.05 && continuity.get(model)!.taggedVertices > 10 && continuity.get(model)!.meanError < .25);
    receipts.push({ model, hat, infected, pass, ...fit, close, peakRatio: infected ? peakRatio : null, eyePixels });
    writeJson(resolve(out, 'hat-eye-gate.json'), { pass: false, tier, seed: 18, suitReference, continuity: Object.fromEntries(continuity), receipts, errors: session.errors });
    console.log(`${name}: ${pass ? 'PASS' : 'FAIL'} ratio=${fit.ratio.toFixed(3)} peak=${infected ? peakRatio.toFixed(3) : 'live'} eyes=${eyePixels.map(e => `${e.zoom}:${e.pixels}/${e.visibility.toFixed(2)}`).join(',')}`);
  }
  const pass = receipts.every(r => r.pass) && session.errors.length === 0;
  writeJson(resolve(out, 'hat-eye-gate.json'), { pass, tier, seed: 18, suitReference, continuity: Object.fromEntries(continuity), receipts, errors: session.errors });
  assert.ok(pass, `${receipts.filter(r => !r.pass).length}/${receipts.length} hat/eye cases failed; ${session.errors.length} GPU errors`);
} finally { await session.close(); stopServer(); }
