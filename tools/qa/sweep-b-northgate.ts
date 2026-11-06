/** Actual Northgate closure and production player-capsule sweep at exit elevation. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { relocatePlayer } from '../../src/sim/missions/missionHelpers';
import { emptyInput } from '../../src/input/InputFrame';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const w = await loadLevel('L6', 1, campaign, 0, { quality: tier });
  try {
    const m = w.missions!, s = m.state.l6!, blockers: unknown[] = [];
    w.events.on('world.blocker.changed', event => blockers.push(structuredClone(event)));
    const sweep = () => {
      relocatePlayer(w, 255.5, 15.9);
      const p = w.entities.get(1)!, body = w.physics.playerBody!, collider = w.physics.playerCollider!, controller = w.physics.characterController!;
      // Same supported body height as the actual ordinary open-route receipt.
      p.transform.y = 4.62; body.setTranslation(p.transform, true); w.physics.world!.propagateModifiedBodyPositionsToColliders();
      const before = { ...p.transform }, requested = { x: 6, y: 0, z: 0 };
      controller.computeColliderMovement(collider, requested, undefined, collider.collisionGroups());
      const movement = controller.computedMovement();
      return { before, requested, movement, crossed: before.x + movement.x > 258 };
    };
    const open = sweep();
    m.completeObjective('shelter'); m.completeObjective('stop'); m.completeObjective('retreat');
    for (const [i, r] of s.survivors.entries()) {
      const e = w.entities.get(r.id)!; r.status = 'following';
      Object.assign(e.transform, { x: 265 + Math.floor(i / 3), z: 15 + (i % 3) * .8, y: 4.62 }); w.solids.forget(e); w.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    relocatePlayer(w, 264, 15.9);
    for (let i = 0; i < 3 && !s.gateAt; i++) { w.applyInput(emptyInput(), 'keyboard'); w.update(); }
    const gate = [...w.entities.iterate()].find(e => e.barricade?.slot.id === 'l6-night-exit');
    if (!gate) throw new Error('Actual controller did not close Northgate');
    const closed = sweep();
    const gateWalls = blockers.filter(e => (e as { id: number }).id === gate.id);
    rows.push({ tier, gateAt: s.gateAt, gate: structuredClone(gate), gateWalls, open, closed, roster: s.survivors.map(r => ({ id: r.id, status: r.status })), result: m.state.result });
    console.log(tier, 'open', open.crossed, 'closed', closed.crossed, JSON.stringify(closed.movement));
  } finally { w.dispose(); }
}
writeFileSync('docs/reports/sweep-b/L6-northgate.json', JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-northgate.ts')).digest('hex'), method: 'Explicit fixture with all29 existing roster identities staged beyond the stairs; actual production controller creates the closed Northgate. Independent production Rapier character-controller capsule sweeps before/after closure at the measured4.62m exit body-centre height. This bypasses only cinematic input locking, preserving actual colliders/masks. Actual blocker event slab retained; no game parameters changed.', rows }, null, 2) + '\n');
