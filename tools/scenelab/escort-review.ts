import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import type { Mesh } from 'three';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer, writeJson } from './session';

// Supplemental TestAPI setup from QA CF03; the standard pedestrian CLI does not create an Escort.
const out = resolve(process.argv[2] ?? 'test-results/escort-review');
const session = new SceneSession({ viewport: { width: 960, height: 540 } });
const records: unknown[] = [];
try {
  await session.open();
  for (const model of ['default', 'npc.civilian-man-b', 'npc.civilian-woman-b', 'child']) {
    await session.load({ name: 'escort-review', ground: 'sidewalk', size: 40,
      actors: [{ id: 'subject', kind: 'pedestrian', at: [0, 0], state: 'idle', look: { model: model.startsWith('npc.') ? model : 'npc.civilian-man-a' } },
        { id: 'courier', kind: 'courier', at: [5, 0], state: { walk: [[8, 0]] } }],
      camera: { mode: 'game', target: 'subject' } });
    await session.page.evaluate(model => {
      const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game;
      const subject = lab.actors.get('subject')!;
      if (model.startsWith('npc.')) game.world.npcs!.escorts.attach(game.world.entities.get(subject.entity)!);
      else {
        game.world.spatial.delete(subject.entity); game.world.entities.remove(subject.entity);
        subject.entity = window.__SS__!.npcs.escort({ x: 0, z: 0 }, model === 'child');
      }
    }, model);
    const cells = { game: [] as { frame: number; jpeg: Buffer }[], close: [] as { frame: number; jpeg: Buffer }[] };
    for (const [stage, ticks] of [['follow', 60], ['run', 45], ['wait', 45], ['down', 45], ['revive', 140]] as const) {
      await session.page.evaluate(stage => {
        const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game;
        const e = game.world.entities.get(lab.actors.get('subject')!.entity)!;
        if (stage === 'run') lab.command('courier', { run: [[12, 0]] });
        if (stage === 'wait') { lab.command('courier', 'idle'); e.escort!.order = e.escort!.state = 'wait'; }
        if (stage === 'down') { e.health.current = 0; game.world.npcs!.escorts.down(e); }
        if (stage === 'revive') window.__SS__!.teleport('player', { x: e.transform.x + .6, z: e.transform.z });
      }, stage);
      await session.step(ticks); await session.ready();
      const record = await session.page.evaluate(() => {
        const lab = window.__SCENE__!, game = (lab as unknown as { game: Game }).game;
        const id = lab.actors.get('subject')!.entity;
        const root = game.view.labProbes().npcs!.heroRoot(id)!;
        root.updateMatrixWorld(true);
        let lowest = Infinity;
        root.traverse(node => {
          const mesh = node as Mesh;
          if (!mesh.isMesh) return;
          for (let parent = node; parent; parent = parent.parent!) if (!parent.visible) return;
          mesh.geometry.computeBoundingBox();
          lowest = Math.min(lowest, mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).min.y);
        });
        return { tick: game.world.tick, entity: window.__SS__!.getEntity(id), hero: window.__SS__!.getState().render.npcs!.heroes.find(h => h.id === id),
          crowdCopies: window.__SS__!.crowdFigures().filter(f => f.id === id).length, soleAboveFloor: lowest - root.position.y };
      });
      records.push({ model, stage, ...record });
      if (process.argv.includes('--check')) {
        assert.equal(record.hero?.source, 'glb', `${model}/${stage}: asset`);
        assert.equal(record.hero?.model, model === 'default' ? 'npc.civilian-man-a' : model === 'child' ? 'npc.brother' : model);
        assert.equal(record.crowdCopies, 0, `${model}/${stage}: duplicate civilian`);
        assert.equal(record.entity?.escort?.state, stage === 'down' ? 'downed' : stage === 'wait' || stage === 'revive' ? 'wait' : 'follow');
        assert.equal(record.hero?.clip, stage === 'down' ? 'death-side' : stage === 'revive' ? 'idle' : stage === 'wait' ? 'npc-walk' : 'run');
        assert.ok(record.soleAboveFloor >= -1e-4, `${model}/${stage}: floor penetration ${record.soleAboveFloor}`);
        if (stage === 'revive') assert.equal(record.entity?.health.current, 50);
      }
      for (const mode of ['game', 'close'] as const) {
        await session.page.evaluate(mode => window.__SCENE__!.setCamera(mode === 'game' ? { mode, target: 'subject' } : { mode, target: 'subject', radius: 5, azimuth: 45 }), mode);
        cells[mode].push({ frame: record.tick, jpeg: await session.snapshot() });
      }
    }
    for (const mode of ['game', 'close'] as const) await session.makeSheet(cells[mode], `${out}/${model}-${mode}.jpg`, 480, 600);
  }
  writeJson(`${out}/states.json`, { records, errors: session.errors });
  if (session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
