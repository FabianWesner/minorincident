/** Paired Q-235 release/cast captures. Run through e2e-lock; no gameplay timing changes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';

const out = process.env.EPILOGUE_OUT ?? 'test-results/l10-epilogue';
const tier = (process.env.EPILOGUE_TIER ?? 'high') as 'high' | 'low';
const session = new SceneSession({ backend: 'webgl2', tier });
mkdirSync(out, { recursive: true });
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const spec = readSpec('tests/scenes/catalog/qa-l10-epilogue.json');
  spec.infectedCap = 200;
  spec.cureProgression!.epilogueElapsed = 0; spec.script = [];
  spec.actors![0].at = [4002, -27];
  await session.load(spec);
  const setup = await session.page.evaluate(() => {
    const a = window.__SS__!, w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    a.cheats.god(true);
    const ids: number[] = [];
    for (let i = 0; i < 72; i++) {
      const angle = i * 2.3999632297, r = 2 + Math.sqrt(i / 72) * 6;
      const cell = w.infected!.nav.nearestCell(4002 + Math.cos(angle) * r, -27 + Math.sin(angle) * r, .35);
      if (cell < 0) continue;
      ids.push(a.spawn('infected.runner', { x: w.infected!.nav.x(cell), z: w.infected!.nav.z(cell) }, { state: 'chase' }));
    }
    return { tick: a.tick(), ids };
  });
  const frames: unknown[] = [];
  let tick = 0;
  for (const target of (process.env.EPILOGUE_SHOTS ?? '180,900,1800,3600,6600').split(',').map(Number)) {
    await session.step(target - tick); tick = target;
    await session.screenshot(`${out}/release-${target}.png`);
    if (target === 1800) {
      await session.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.vfx!.blasts.visible = false; });
      await session.screenshot(`${out}/no-mist.png`);
      const masks = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game, rows: unknown[] = [], seen = new Set<import('three').Material>();
        game.view.scene.traverse(o => {
          const mesh = o as import('three').Mesh;
          if (!o.name.startsWith('corpses:') || !mesh.material || Array.isArray(mesh.material)) return;
          const material = mesh.material as import('../../src/render/PaletteMaterial').PaletteMaterial;
          if (seen.has(material)) return;
          seen.add(material);
          rows.push({ name: o.name, transparent: material.transparent, opacity: material.opacity, fade: material.fade?.value });
          material.userData.reviewMask = material.maskNode; material.maskNode = null; material.needsUpdate = true;
        });
        return rows;
      });
      writeFileSync(`${out}/materials.json`, JSON.stringify(masks, null, 2));
      await session.screenshot(`${out}/no-mist-no-corpse-cut.png`);
      await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: Game }).game;
        game.view.scene.traverse(o => {
          const mesh = o as import('three').Mesh;
          if (!o.name.startsWith('corpses:') || !mesh.material || Array.isArray(mesh.material)) return;
          const material = mesh.material as import('../../src/render/PaletteMaterial').PaletteMaterial;
          material.maskNode = material.userData.reviewMask; material.needsUpdate = true;
        });
        game.view.vfx!.blasts.visible = true;
      });
    }
    if (target >= 1800) {
      await session.page.evaluate(() => {
        const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
        const cast = w.missions!.state.epilogue!.survivors.map(id => w.entities.get(id)!.transform);
        const x = (Math.min(...cast.map(p => p.x)) + Math.max(...cast.map(p => p.x))) / 2;
        const z = (Math.min(...cast.map(p => p.z)) + Math.max(...cast.map(p => p.z))) / 2;
        window.__SCENE__!.setCamera({ mode: 'game', target: [x, z], zoom: 1.5 });
      });
      await session.screenshot(`${out}/survivors-${target}.png`);
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'game', target: 'courier', zoom: 1 }));
    }
    const frame = await session.page.evaluate(async () => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world;
      const survivors = w.missions!.state.epilogue!.survivors.map(id => w.entities.get(id)).filter(e => !!e);
      const module = '/src/render/characters/CorpseLayout.ts', { corpseLayout } = await import(module);
      return { scenario: w.scenario, renderTier: game.quality.tier, gameplayTier: w.infected!.director.tier, elapsed: w.missions!.state.cureFront!.elapsed, survivors: survivors.map(e => ({ id: e.id, at: e.transform, state: e.civilian!.state, waypoints: e.civilian!.waypoints })), affected: w.missions!.state.cureFront!.affectedIds.length, bodies: corpseLayout(w).audit(), metrics: window.__SCENE__!.metrics() };
    });
    assert.equal(frame.renderTier, tier); assert.equal(frame.gameplayTier, tier);
    if (target >= (tier === 'low' ? 1800 : 3600)) assert.equal(frame.survivors.length, tier === 'low' ? 3 : 6);
    frames.push(frame);
  }
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ tier, setup, frames, errors: session.errors }, null, 2));
  console.log(JSON.stringify({ out, tier, frames: frames.length, errors: session.errors }));
  if (session.errors.length) process.exitCode = 1;
} finally { await session.close(); stopServer(); }
