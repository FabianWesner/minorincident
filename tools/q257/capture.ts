import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, readSpec } from '../scenelab/session';

const phase = process.argv[2] ?? 'after', tier = process.argv[3] === 'low' ? 'low' : 'high';
const out = resolve(process.env.Q257_OUT ?? `docs/reports/q257/visual/${phase}-${tier}`); mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier, viewport: { width: 1400, height: 650 }, query: { skin: '1' } });
const groups = [
  ['npc.national-guard', 'npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.lab-tech-a'],
  ['npc.lab-tech-b', 'npc.lab-guard', 'npc.depot-clerk', 'npc.dale.aftermath', 'npc.rosa.aftermath', 'npc.mr-okafor.aftermath'],
  ['npc.mia.aftermath', 'npc.sam.aftermath', 'npc.civilian-elderly', 'npc.firefighter-alive', 'npc.civilian-kid', 'npc.brother'],
  ['npc.police-officer', 'npc.civilian-man-a.aftermath', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', 'npc.marcus.aftermath', 'npc.shelter-survivor.bandaged'],
  ['npc.shelter-survivor.lying', 'npc.shelter-survivor.sitting', 'npc.civilian-adult-m', 'npc.civilian-adult-f'],
];
const receipts: unknown[] = [];
async function shot(name: string, label: string) {
  await session.ready();
  await session.page.evaluate(text => { let label = document.getElementById('q257-label'); if (!label) { label = document.createElement('div'); label.id = 'q257-label'; label.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:#111d;color:white;font:14px sans-serif;padding:8px'; document.body.append(label); } label.textContent = text; }, `${phase} ${tier} · ${label}`);
  await session.page.screenshot({ path: resolve(out, `${name}.jpg`), type: 'jpeg', quality: 94 });
  receipts.push({ name, metrics: await session.metrics() });
  console.log(`${phase} ${tier} ${name}`);
}
async function forceLod(lod: 'lod0' | 'lod1' | 'lod2') {
  await session.page.evaluate(async lod => {
    const lab = window.__SCENE__ as unknown as { game: { view: { npcs: { civilians: { visibility: { band: () => string }; loadHero: (model: string) => void; loadTier: (model: string, lod: string) => void }; ready: () => Promise<void> } }; world: { entities: { iterate: () => Iterable<{ civilian?: { model?: string } }> } } } };
    const crowd = lab.game.view.npcs.civilians;
    for (const e of lab.game.world.entities.iterate()) if (e.civilian?.model) { if (lod === 'lod0') crowd.loadHero(e.civilian.model); else crowd.loadTier(e.civilian.model, lod); }
    await lab.game.view.npcs.ready(); crowd.visibility.band = () => lod;
  }, lod);
  await session.step(1); await session.ready();
}
try {
  await session.open();
  for (const [index, models] of groups.entries()) {
    if (process.argv.includes('--l5-only') || process.argv.includes('--details-only')) continue;
    if (process.env.Q257_GROUP && Number(process.env.Q257_GROUP) !== index + 1) continue;
    const spec: SceneSpec = { name: 'q257-height-lineup', ground: 'sidewalk', time: 'L1', dof: false, size: 40,
      actors: [...models.flatMap((model, i) => model === 'npc.brother' ? [] : [{ id: `npc-${i}`, kind: 'pedestrian' as const, at: [(i - 3) * 1.8, 0] as [number, number], yaw: 0, look: { model, accessories: ['none'] }, state: 'idle' as const }]), { id: 'heroine', kind: 'courier', at: [5.4, 0], yaw: 0, look: { model: 'female' }, state: 'idle' }],
      props: models.includes('npc.brother') ? [{ id: 'brother', asset: 'npc.brother', at: [3.6, 0], yaw: 0 }] : [],
      camera: { mode: 'pose', position: [0, 1, 15.6], target: [0, 1, 0] } };
    await session.load(spec); await forceLod('lod1');
    if (!process.argv.includes('--corpses-only')) await shot(`lineup-${index + 1}`, models.join(' · ') + ' | heroine');
    if (phase === 'after') {
      const adults = models.flatMap((model, i) => ['npc.brother', 'npc.civilian-kid'].includes(model) ? [] : [`npc-${i}`]);
      await session.page.evaluate(ids => { for (const id of ids) window.__SCENE__!.command(id, { infect: { instant: true } }); }, adults);
      await session.step(1);
      await session.page.evaluate(ids => { for (const id of ids) window.__SCENE__!.command(id, { corpse: true }); }, adults);
      await session.step(180);
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'pose', position: [0, 6, 15.6], target: [0, 0, 0] }));
      await shot(`corpses-${index + 1}`, models.join(' · ') + ' | grounded corpses');
    }
  }
  if (!process.argv.includes('--lineup-only') && !process.argv.includes('--corpses-only')) {
  if (!process.argv.includes('--l5-only')) {
  const dale: SceneSpec = { name: 'q257-dale-texture', ground: 'sidewalk', time: 'L1', dof: false, size: 20, actors: [{ id: 'dale', kind: 'pedestrian', at: [0, 0], yaw: 0, look: { model: 'npc.dale.aftermath', accessories: ['none'] }, state: 'idle' }], camera: { mode: 'pose', position: [2.6, 1.4, 3.5], target: [0, .8, 0] } };
  await session.load(dale);
  for (const lod of ['lod0', 'lod1', 'lod2'] as const) { await forceLod(lod); await shot(`dale-${lod}`, `Dale ${lod}`); }
  for (const model of ['npc.civilian-man-b', 'npc.civilian-woman-a']) {
    await session.load({ ...dale, name: 'q257-coffee-grip', actors: [{ id: 'holder', kind: 'pedestrian', at: [0, 0], yaw: 0, look: { model, accessories: ['none'], handProp: 'coffee' }, state: 'idle' }], camera: { mode: 'pose', position: [2.5, 1.4, 2.5], target: [0, .85, 0] } });
    await session.step(60);
    for (const lod of ['lod0', 'lod1', 'lod2'] as const) { await forceLod(lod); await shot(`coffee-${model}-${lod}`, `${model} coffee ${lod}`); }
  }
  const depot = readSpec('specs/scenes/qa-handover-depot.json'); depot.camera = { mode: 'close', target: [-37.4, 1, -36.2], radius: 7.5, azimuth: 55 };
  await session.load(depot); await session.step(150); await shot('l1-depot', 'L1 depot clerk handover');
  }
  if (phase === 'after') {
    const l5 = readSpec('tests/scenes/catalog/l5-po-dale-discovery.json'); l5.l5Aftermath = { found: ['dale', 'rosa', 'sam'] }; l5.hud = false;
    await session.load(l5); await session.step(150);
    const at = await session.page.evaluate(() => {
      const lab = window.__SCENE__ as unknown as { game: { world: { entities: { iterate: () => Iterable<{ transform: { x: number; y: number; z: number }; civilian?: { survivor?: { key: string } } }> } } } };
      const dale = [...lab.game.world.entities.iterate()].find(e => e.civilian?.survivor?.key === 'dale'); if (!dale) throw Error('L5 Dale missing'); return dale.transform;
    });
    await forceLod('lod1');
    for (const azimuth of [45, 135, 225, 315]) {
      await session.page.evaluate(({ p, azimuth }) => window.__SCENE__!.setCamera({ mode: 'close', target: [p.x, p.y + .1, p.z], radius: 5, azimuth }), { p: at, azimuth });
      await shot(`l5-dale-${azimuth}`, 'Production L5 Dale with mixed survivors, LOD1');
    }
  }
  }
  writeFileSync(resolve(out, process.argv.includes('--corpses-only') ? 'corpse-receipts.json' : process.argv.includes('--l5-only') ? 'l5-receipts.json' : process.argv.includes('--details-only') ? 'detail-receipts.json' : 'receipts.json'), JSON.stringify({ receipts, errors: session.errors }, null, 2) + '\n');
  if (session.errors.length) throw Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
