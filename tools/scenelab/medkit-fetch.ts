import assert from 'node:assert/strict';
import { gameplay } from '../../src/levels/districts/D-GROVE';
import { l3 } from '../../src/data/l3';
import manifest from '../../src/assets/manifest.json';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson } from './session';

/** Replay: SCENE_PORT=3368 sh tools/e2e-lock.sh npx tsx tools/scenelab/medkit-fetch.ts
 * Actual route coordinates/layout crops, production pickups and corgi, game follow camera.
 * Full health: approach, touch, depart; partial health: approach again, heal, depart. */
const out = 'test-results/medkit-legs/scenes';
const grove = gameplay.interactions!.pickups![1].position as { x: number; z: number };
const route = l3.medkits.positions.find(([x, z]) => x === -66 && z > -10 && z < 10)!;
// Foreground fences screen the legs at the shipped camera angle; isolate the pickup/body relationship.
const visibleAssets = manifest.filter(a => !a.id.includes('fence')).map(a => a.id);
const session = new SceneSession();
const results: unknown[] = [], cells: { frame: number; jpeg: Buffer }[] = [];
try {
  await session.open();
  for (const level of ['L1', 'L2', 'L3'] as const) {
    const kit = level === 'L3' ? { x: route[0], z: route[1] } : grove;
    const start: [number, number] = level === 'L3' ? [kit.x - 3, kit.z] : [kit.x, kit.z + 3];
    const spec: SceneSpec = {
      name: `medkit-fetch-${level}`, ground: 'district', time: level, tier: level === 'L1' ? 0 : level === 'L2' ? 1 : 2,
      layout: { district: level === 'L3' ? 'D-CORRIDOR' : 'D-GROVE', ...(level !== 'L1' ? { level } : {}), assets: visibleAssets, bbox: [[kit.x - 10, kit.z - 10], [kit.x + 10, kit.z + 10]] },
      actors: [{ id: 'courier', kind: 'courier', at: start }, { id: 'dog', kind: 'corgi', at: [start[0] + 1, start[1] + 1] }],
      camera: { mode: 'follow', actor: 'courier', zoom: .5 }, frames: 720, expect: { consoleErrors: 0 },
    };
    await session.load(spec);
    const id = await session.page.evaluate(p => window.__SS__!.spawn('pickup.medkit', p), kit);
    const original = await session.page.evaluate(id => window.__SS__!.getEntity(id)!, id);
    const go = async (at: [number, number]) => {
      await session.page.evaluate(at => window.__SCENE__!.command('courier', { moveTo: at, pace: 'walk' }), at);
      await session.step(120);
      const player = await session.page.evaluate(() => window.__SS__!.getEntity(1)!);
      assert(Math.hypot(player.transform.x - at[0], player.transform.z - at[1]) < .5, `${level}: courier did not reach touch/exit position`);
    };
    await go([kit.x, kit.z]);
    await go(start);
    const full = await session.page.evaluate(id => window.__SS__!.getEntity(id)!, id);
    assert.deepEqual(full.transform, original.transform, `${level}: full-health kit moved`);
    assert(full.pickup && 'kind' in full.pickup && !full.pickup.collected);
    await session.screenshot(`${out}/${level}-full.png`);
    cells.push({ frame: cells.length, jpeg: await session.snapshot() });
    await session.page.evaluate(() => window.__SS__!.survivor.damage(70));
    await go([kit.x, kit.z]);
    const partial = await session.page.evaluate(id => ({ kit: window.__SS__!.getEntity(id)!, player: window.__SS__!.getEntity(1)!, events: window.__SS__!.events() }), id);
    assert(partial.kit.pickup && 'kind' in partial.kit.pickup && partial.kit.pickup.collected, `${level}: injured courier did not consume kit`);
    assert(partial.player.health.current >= 80);
    assert(!partial.events.some(e => e.type === 'corgi.fetched' && e.pickupId === id));
    await go(start);
    await session.screenshot(`${out}/${level}-partial.png`);
    cells.push({ frame: cells.length, jpeg: await session.snapshot() });
    results.push({ level, spec, kit: original, full, partial, metrics: await session.metrics() });
  }
  assert.equal(session.errors.length, 0);
  await session.makeSheet(cells, `${out}/sheet.jpg`);
  writeJson(`${out}/results.json`, { pass: true, consoleErrors: session.errors, order: ['L1 full', 'L1 partial', 'L2 full', 'L2 partial', 'L3 full', 'L3 partial'], results });
  console.log('L1/L2/L3: full-health kits remain in place; partial-health kits heal and disappear; no corgi fetch.');
} finally { await session.close(); stopServer(); }
