import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { SceneSession, stopServer } from './session';
import type { Object3D } from 'three';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { CameraSpec } from '../../src/debug/scenelab/spec';
import { catalog } from '../../src/data/actions/catalog';

interface PickupLab {
  game: { view: { actions: { init(): Promise<void>; pickups: Map<number, Object3D>; ground: ((x: number, z: number) => number | null) | null }; update(alpha: number): void } };
  world: SimWorld;
  setCamera(camera: CameraSpec): void;
}

const phase = process.argv[2] ?? 'after';
const out = resolve('test-results/fix-pickups', phase);
mkdirSync(out, { recursive: true });
const defs = [...new Map(Object.values(catalog).filter(d => d.viewAssetId.startsWith('wpn.')).map(d => [d.viewAssetId, d])).values()];
const session = new SceneSession({ viewport: { width: 960, height: 540 } });
const results: unknown[] = [];
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = (fn) => fn');
  for (let i = 0; process.argv[3] !== 'interactions' && i < defs.length; i++) {
    const def = defs[i];
    await session.load({ name: 'pickup-review', ground: 'asphalt', size: 20, actors: [{ id: 'courier', kind: 'courier', at: [3, 3] }], camera: { mode: 'game', target: [0, 0] } });
    await session.page.evaluate(async id => {
      const lab = window.__SCENE__ as unknown as PickupLab;
      window.__SS__!.spawn(id, { x: 0, z: 0 });
      await lab.game.view.actions.init(); lab.game.view.update(1);
    }, def.id);
    await session.step(2);
    const emptyVisible = await session.page.evaluate(() => (window.__SCENE__ as unknown as PickupLab).game.view.actions.pickups.size);
    if (phase === 'after') assert.equal(emptyVisible, 1, `${def.viewAssetId} visible with empty rack`);
    const cells = [{ frame: 0, jpeg: await session.snapshot() }];
    await session.page.evaluate(() => (window.__SCENE__ as unknown as PickupLab).setCamera({ mode: 'close', target: [0, .15, 0], radius: 4, azimuth: 100 }));
    cells.push({ frame: 1, jpeg: await session.snapshot() });
    await session.page.evaluate(() => { window.__SS__!.setLoadout(['weapon.fists'], ['weapon.kick']); (window.__SCENE__ as unknown as PickupLab).game.view.update(1); });
    cells.push({ frame: 2, jpeg: await session.snapshot() });
    await session.page.evaluate(() => (window.__SCENE__ as unknown as PickupLab).setCamera({ mode: 'game', target: [0, 0] }));
    cells.push({ frame: 3, jpeg: await session.snapshot() });
    await session.makeSheet(cells, `${out}/${def.viewAssetId}.jpg`, 480);
    const probe = await session.page.evaluate(async () => {
      const modulePath = '/node_modules/three/build/three.webgpu.js';
      const { Box3, Vector3 } = await import(modulePath);
      const lab = window.__SCENE__ as unknown as PickupLab, view = lab.game.view.actions;
      return [...view.pickups].map(([id, model]) => { const box = new Box3().setFromObject(model, true); return { id, ground: view.ground?.(model.position.x, model.position.z) ?? 0, min: box.min.toArray(), size: box.getSize(new Vector3()).toArray(), visible: model.visible, children: model.children.length }; });
    });
    results.push({ asset: def.viewAssetId, emptyVisible, probe });
    if (phase === 'after') { assert.equal(probe.length, 1); assert.ok(Math.abs(probe[0].min[1] - probe[0].ground) < .001, `${def.viewAssetId} grounded`); assert.equal(probe[0].children, 2); }
    console.log(`${phase}: ${i + 1}/${defs.length} ${def.viewAssetId}`);
  }
  // Full rack: actual collection drops the selected item, which must persist until departure.
  await session.load({ ground: 'asphalt', size: 20, actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }], camera: { mode: 'game', target: [0, 0] } });
  await session.page.evaluate(() => { window.__SS__!.setLoadout(['weapon.bat', 'weapon.knife', 'weapon.crowbar'], ['weapon.kick']); window.__SS__!.spawn('weapon.katana', { x: 0, z: 0 }); });
  await session.step(2);
  const swap = await session.page.evaluate(() => { const lab = window.__SCENE__ as unknown as PickupLab; return { current: lab.world.combat!.runner.loadout.current('LEFT').id, drops: window.__SS__!.query({ kind: 'pickup' }) }; });
  assert.equal(swap.current, 'weapon.katana'); assert.equal(swap.drops.length, 1);
  await session.page.evaluate(() => window.__SS__!.teleport('player', { x: 2, z: 0 })); await session.step(2);
  await session.screenshot(`${out}/full-rack-drop.png`);
  await session.page.evaluate(() => window.__SS__!.teleport('player', { x: 0, z: 0 })); await session.step(2);
  assert.equal(await session.page.evaluate(() => (window.__SCENE__ as unknown as PickupLab).world.combat!.runner.loadout.current('LEFT').id), 'weapon.bat');
  results.push({ swap, recollected: true });
  // The shipped garage uses interaction, with no street weapon pickups added.
  await session.inspectLevel('L1');
  await session.page.evaluate('globalThis.__name = (fn) => fn');
  await session.page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.inspect.enable(false); window.__SS__!.cheats.god(true); });
  assert.equal(await session.page.evaluate(() => window.__SS__!.getState().player!.weapons), undefined);
  await session.page.addStyleTag({ content: '.tp-dfwv{display:none!important}' });
  for (let i = 0; i < 6 && await session.page.evaluate(() => window.__SS__!.missions.state()!.steps.weapon.status !== 'active'); i++) await session.page.evaluate(() => window.__SS__!.cheats.completeObjective());
  for (let i = 0; i < 20 && await session.page.evaluate(() => !!window.__SS__!.missions.state()!.l1!.beat); i++) await session.page.evaluate(() => window.__SS__!.step(30));
  const garage = await session.page.evaluate(() => window.__SS__!.inspect.anchors().find((a) => a.id === 'mission/garage-bat'));
  const layout = await (await import('node:fs/promises')).readFile('public/assets/layouts/D-GROVE.layout.json', 'utf8');
  const at = JSON.parse(layout).anchors['garage-bat'].position;
  await session.page.evaluate(({ x, z }) => { window.__SS__!.teleport('player', { x, z }); window.__SS__!.camera.follow(); }, { x: at[0], z: at[2] });
  await session.page.evaluate(() => window.__SS__!.step(24));
  assert.equal(await session.page.evaluate(() => window.__SS__!.missions.state()!.steps.weapon.status), 'active');
  await session.screenshot(`${out}/garage-before-interact.png`);
  for (let i = 0; i < 4 && await session.page.evaluate(() => window.__SS__!.missions.state()!.steps.weapon.status !== 'completed'); i++) { await session.page.keyboard.down('e'); await session.page.evaluate(() => window.__SS__!.step(3)); await session.page.keyboard.up('e'); await session.page.evaluate(() => window.__SS__!.step(70)); }
  const mission = await session.page.evaluate(() => window.__SS__!.missions.state());
  assert.equal(mission!.steps.weapon.status, 'completed');
  assert.equal(await session.page.evaluate(() => window.__SS__!.query({ kind: 'pickup' }).filter((e) => e.pickup && 'actionId' in e.pickup).length), 0);
  await session.screenshot(`${out}/garage-after-interact.png`);
  results.push({ garage, acquired: true, streetWeaponPickups: 0, consoleErrors: session.errors });
  assert.equal(session.errors.length, 0);
} catch (error) { console.log(error); throw error; } finally { writeFileSync(`${out}/${process.argv[3] === 'interactions' ? 'interactions' : 'results'}.json`, JSON.stringify(results, null, 2)); await session.close(); stopServer(); }
