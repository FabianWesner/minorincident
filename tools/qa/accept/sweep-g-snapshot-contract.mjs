/** Record literal global snapshot behaviour separately from authored live-world exceptions. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { runLevel, loadLevel } from '../../sim-runner/levels.ts';
import { newCampaign } from '../../../src/sim/progression/Campaign.ts';
import { emptyInput } from '../../../src/input/InputFrame.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { provenance } from './probe.ts';
const result = { ...provenance(), method: 'Naturally reached L1 checkpoints, read-only save capture and independent route-state control. Fresh world per actual mortal death. Record checkpoint snapshot, deliberately changed live gate/pickup/rack, and actual respawn event separately. No restore expectation rewritten to the dirty live world.', cells: [], controls: [], errors: [] };
for (const tier of ['low', 'high']) {
 const campaign = () => { const c = newCampaign('female', 1); c.settings.quality = tier; return c; };
 const snapshots = new Map(); let controlHash;
 try {
  await runLevel('L1', 'complete', 1, undefined, 'auto', campaign(), undefined, 0, {
   quality: tier,
   beforeBegin: w => w.events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set') snapshots.set(e.id, structuredClone(w.missions.saveResume().checkpoint)); }),
   beforeDispose: w => { controlHash = stateHash(w.getState()); },
  });
  result.controls.push({ tier, controlHash });
  for (const [id, checkpoint] of snapshots) {
   if (id === 'start') continue;
   const w = await loadLevel('L1', 1, campaign(), 0, { quality: tier });
   try {
    w.missions.loadResume({ current: structuredClone(checkpoint), checkpoint: structuredClone(checkpoint) }); w.missions.restore(id);
    const m = w.missions, p = w.entities.get(1), saved = m.saveResume().checkpoint;
    const inspect = () => ({ checkpoint: m.state.checkpoint, player: { ...w.entities.get(1).transform }, gates: { ...m.state.gates },
     pickups: [...w.entities.iterate()].filter(e => e.pickup).map(e => e.id).sort((a, b) => a - b), racks: w.entities.get(1).weapons && Object.fromEntries(['LEFT', 'RIGHT'].map(side => [side, w.entities.get(1).weapons[side].rack.map(x => x.id)])) });
    const before = inspect(), pickup = saved.entities.find(e => e.pickup && !('collected' in e.pickup && e.pickup.collected));
    for (const key of Object.keys(m.state.gates)) m.state.gates[key] = !m.state.gates[key];
    if (pickup) { w.entities.remove(pickup.id); w.spatial.delete(pickup.id); }
    w.combat.setLoadout(['weapon.fists'], ['weapon.kick']);
    const dirty = inspect(), anchor = { ...p.survivor.checkpoint }; let respawn;
    const stop = w.events.on('player.respawned', () => { respawn = inspect(); });
    const damage = w.player.damage(100000, w.tick, true);
    for (let tick = 0; tick < 360 && !respawn; tick++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); }
    stop();
    result.cells.push({ tier, id, snapshotSha256: createHash('sha256').update(JSON.stringify(checkpoint)).digest('hex'), before, dirty, respawn, anchor, removedPickupId: pickup?.id, damage,
     snapshotGatesRestored: !!respawn && JSON.stringify(respawn.gates) === JSON.stringify(before.gates), removedPickupRestored: pickup ? !!respawn?.pickups.includes(pickup.id) : null,
     positionErrorM: respawn && Math.hypot(respawn.player.x - anchor.x, respawn.player.z - anchor.z) });
   } finally { w.dispose(); }
  }
 } catch (error) { result.errors.push({ tier, error: String(error) }); }
}
writeFileSync(process.env.SWEEP_G_RECEIPT_OUT ?? 'docs/reports/sweep-g/G-21-literal-snapshot.json.gz', gzipSync(JSON.stringify(result)));
console.log(JSON.stringify({ controls: result.controls, cells: result.cells.map(({ tier, id, removedPickupId, snapshotGatesRestored, removedPickupRestored, positionErrorM }) => ({ tier, id, removedPickupId, snapshotGatesRestored, removedPickupRestored, positionErrorM })), errors: result.errors }));
process.exitCode = result.errors.length ? 1 : 0;
