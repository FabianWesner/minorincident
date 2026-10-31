import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../../tools/scenelab/session';

const root = 'test-results/q276/occupants';
mkdirSync(root, { recursive: true });
const rows: unknown[] = [];
for (const quality of ['high', 'low'] as const) {
  const session = new SceneSession({ tier: quality, backend: 'webgl2', viewport: { width: 1600, height: 900 } });
  try {
    await session.open(); await session.page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1 }));
    await session.page.evaluate(async () => {
      const a = window.__SS__!;
      a.inspect.enable(true, { courier: 'unchanged' }); a.pause(); a.missions.begin();
      a.missions.completeObjective('axe'); a.missions.completeObjective('calm'); a.missions.completeObjective('board');
      await a.step(170); await a.screenshotReady();
      const g = (window.__SCENE__ as any).game, view = g.view.vehicles;
      (window as any).__q276OccupantClass = view.occupants.values().next().value.constructor;
      const t = a.getEntity(a.missions.state()!.l2!.truckId)!.transform;
      a.inspect.setCamera({ target: [t.x + 2, 1.8, t.z], position: [t.x + 8, 6.5, t.z + 6] });
    });
    await session.ready();
    await session.page.addStyleTag({content:'[data-testid=inspection] {visibility:hidden}'});
    await session.screenshot(`${root}/fire-engine-${quality}.png`);
    await session.page.evaluate(async () => {
      const g=(window.__SCENE__ as any).game, id=window.__SS__!.missions.state()!.l2!.truckId;
      const model=g.view.vehicles.records.get(id).model;
      for(const child of model.children) if(typeof child.actorId !== 'number') child.visible=false;
      await window.__SS__!.screenshotReady();
    });
    await session.screenshot(`${root}/fire-engine-${quality}-cutaway.png`);
    const fire = await session.page.evaluate(() => {
      const g = (window.__SCENE__ as any).game;
      return [...g.view.vehicles.occupants.values()].filter((o: any) => o.visible && o.parent).map((o: any) => {
        let texturedMeshes = 0, uvMeshes = 0;
        o.traverse((m: any) => { if (!m.isMesh) return; if ((Array.isArray(m.material) ? m.material : [m.material]).some((v: any) => v.map)) { texturedMeshes++; if (m.geometry.getAttribute('uv')) uvMeshes++; } });
        return { id: o.actorId, asset: o.asset, texturedMeshes, uvMeshes };
      });
    });
    const crew = fire.filter(o => o.asset === 'npc.firefighter-alive');
    assert.equal(crew.length, 6); assert.ok(crew.every(o => o.texturedMeshes > 0 && o.uvMeshes === o.texturedMeshes));
    rows.push({ vehicle: 'L2 fire engine', quality, occupants: fire });
    await session.load({ name: 'q276-bus-passengers', ground: 'asphalt', size: 24, time: 'L2', vehicles: [{ id: 'bus', asset: 'vehicle.school-bus', at: [0, 0] }], camera: { mode: 'orbit', target: [0, 1.6, 0], radius: 10, polar: 76, azimuth: 45 }, frames: 0 });
    const bus = await session.page.evaluate(async () => {
      const lab = window.__SCENE__ as any, g = lab.game, view = g.view.vehicles;
      const record = view.records.get(lab.vehicles.get('bus'));
      const seats = ['passengerSeat0L', 'passengerSeat0R'];
      const assets = ['npc.firefighter-alive', 'npc.civilian-woman-a'];
      const copies = [];
      for (const [i, name] of seats.entries()) {
        const seat = record.model.getObjectByName(name); if (!seat) throw new Error(`Missing bus seat ${name}`);
        // Art fixture: the production occupant class at the delivered bus sockets.
        const copy = await (window as any).__q276OccupantClass.load(view.registry, -100 - i, assets[i], g.view.materials);
        record.model.add(copy); copy.pose(seat); copies.push(copy);
      }
      (window as any).__q276Copies = copies;
      const p=copies[0].getWorldPosition(copies[0].position.clone());
      window.__SS__!.inspect.setCamera({target:[p.x,p.y+.35,p.z],position:[p.x+4,p.y+2,p.z+4]});
      await window.__SS__!.screenshotReady();
      return copies.map(o => {
        let texturedMeshes = 0, uvMeshes = 0;
        o.traverse((m: any) => { if (!m.isMesh) return; if ((Array.isArray(m.material) ? m.material : [m.material]).some((v: any) => v.map)) { texturedMeshes++; if (m.geometry.getAttribute('uv')) uvMeshes++; } });
        return { asset: o.asset, texturedMeshes, uvMeshes };
      });
    });
    await session.ready(); await session.screenshot(`${root}/bus-${quality}.png`);
    await session.page.evaluate(async () => {
      const lab=window.__SCENE__ as any, model=lab.game.view.vehicles.records.get(lab.vehicles.get('bus')).model;
      for(const child of model.children) if(typeof child.actorId !== 'number') child.visible=false;
      await window.__SS__!.screenshotReady();
    });
    await session.screenshot(`${root}/bus-${quality}-cutaway.png`);
    assert.equal(bus.length, 2); assert.ok(bus.every(o => o.texturedMeshes > 0 && o.uvMeshes === o.texturedMeshes));
    rows.push({ vehicle: 'bus passenger art fixture', quality, occupants: bus });
    await session.page.evaluate(() => { for (const copy of (window as any).__q276Copies) copy.dispose(); });
    assert.deepEqual(session.errors, []);
    writeFileSync(`${root}/summary.json`, JSON.stringify(rows, null, 2));
  } finally { await session.close(); }
}
stopServer();
console.log(JSON.stringify(rows));
