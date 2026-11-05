/** Compare the former courier-alpha discard with current bars; record whether it reproduces Q-285. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { Mesh, MeshBasicNodeMaterial, Texture } from 'three/webgpu';
const out = 'test-results/uat-l4-infected';
const session = new SceneSession({ backend: 'webgl2', tier: 'high' });
try {
  await session.open(); const page = session.page;
  await page.addInitScript('window.__name = fn => fn');
  const rect = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L4', { seed: 1, progression: 'L4-default', checkpoint: 'turn' }); a.pause();
    const g = (window.__SCENE__ as unknown as { game: Game }).game, w = g.world;
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    for (const e of w.entities.iterate()) if (e.civilian || e.companion) e.hidden = true;
    a.teleport(1, { x: -17, z: 3 }); a.camera.zoom(.65);
    const id = a.spawn('infected.riot', { x: -16, z: 3 }), p = w.entities.get(1)!, camera = g.view.camera.position;
    const dx = camera.x - p.transform.x, dz = camera.z - p.transform.z, distance = Math.hypot(dx, dz);
    const character = g.view.labProbes().character!;
    const chest = (character.getObjectByName('torso') ?? character).getWorldPosition(camera.clone()); chest.y += .12;
    const torso = g.view.project(chest.x, chest.y, chest.z), tx = (torso[0] + 1) * innerWidth / 2, ty = (1 - torso[1]) * innerHeight / 2;
    let best = Infinity, at = { x: -16, z: 3 };
    for (let radius = .8; radius <= 3.2; radius += .2) for (const across of [-.4, 0, .4]) {
      const candidate = { x: p.transform.x + dx / distance * radius - dz / distance * across, z: p.transform.z + dz / distance * radius + dx / distance * across };
      a.teleport(id, candidate); await a.screenshotReady();
      const bar = g.view.getState().healthBars!.bars.find(b => b.id === id); if (!bar) continue;
      const score = Math.hypot(bar.x - tx, bar.y - ty); if (score < best) { best = score; at = candidate; }
    }
    a.teleport(id, at); await a.screenshotReady();
    return g.view.getState().healthBars!.bars.find(b => b.id === id)!;
  });
  assert.ok(rect, 'The living riot has a bar');
  const fixed = await session.screenshot(`${out}/bar-overlap-fixed.png`);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/render/HealthBars.ts')).text();
    const url = /from\s+["']([^"']*tsl[^"']*)["']/.exec(source)?.[1] ?? '/node_modules/three/build/three.tsl.js';
    const { Fn, Discard, texture, viewportUV } = await import(url) as typeof import('three/tsl');
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const v = g.view as unknown as { healthBars: { children: Mesh[] }; postFx: { sceneColor: Texture } };
    const mask = texture(v.postFx.sceneColor);
    for (const mesh of v.healthBars.children) {
      const m = mesh.material as MeshBasicNodeMaterial, fragment = m.fragmentNode!;
      m.fragmentNode = Fn(() => { Discard(mask.sample(viewportUV).a.lessThan(.5)); return fragment; })(); m.needsUpdate = true;
    }
  });
  const before = await session.screenshot(`${out}/bar-overlap-old-mask.png`);
  const pixels = (bytes: Buffer) => {
    const png = PNG.sync.read(bytes); let red = 0;
    for (let y = Math.floor(rect.y - rect.height / 2); y < rect.y + rect.height / 2; y++) for (let x = Math.floor(rect.x - rect.width / 2); x < rect.x + rect.width / 2; x++) {
      const i = (y * png.width + x) * 4; if (png.data[i] > 160 && png.data[i + 1] < 160 && png.data[i + 2] < 160 && Math.abs(png.data[i + 1] - png.data[i + 2]) < 15) red++;
    }
    return red;
  };
  const evidence = { rect, oldMaskRedPixels: pixels(before), fixedRedPixels: pixels(fixed), errors: session.errors };
  writeFileSync(`${out}/bar-overlap.json`, JSON.stringify(evidence, null, 2)); console.log(evidence);
  console.log({ maskReproduced: evidence.oldMaskRedPixels < evidence.fixedRedPixels * .7 });
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
