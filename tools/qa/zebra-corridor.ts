/** Read-only acceptance audit: nominal 1.5 m corridor versus physical contact.
 * Run on the remote runner; no tuning or existing test expectation is changed. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';

const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 7);
try {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x: 25, z: 0 }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, 25, 0);
  const source = w.infected!.spawn('infected.zebra', { x: 0, z: 0 }, { state: 'idle' });
  w.infected!.spawn('infected.zebra', { x: -2, z: 0 }, { state: 'idle' });
  const probes = [['inside', 5, .75], ['nominal-outside', 5, -.76], ['physical-outside', 8, -.88]] as const;
  const humans = probes.map(([name, x, z]) => {
    const id = w.npcs!.civilians.spawn('officer', { x, z }), e = w.entities.get(id)!;
    e.civilian!.state = 'annoyed'; e.civilian!.until = 10000;
    return { name, id, initial: { ...e.transform }, hpBefore: e.health.current };
  });
  assert.ok(w.infected!.startSpecial(source, 'zebra.stampede', { id: 1, x: 25, z: 0 }, { x: 0, z: 0, radius: .75, dx: 1, dz: 0 }));
  for (let i = 0; i < 138; i++) w.update();
  const results = humans.map(h => ({ ...h, hpAfter: w.entities.get(h.id)!.health.current,
    hits: w.events.events().filter(e => e.type === 'combat.hit' && e.targetId === h.id) }));
  assert.equal(results[0].hpAfter, 50); assert.equal(results[2].hpAfter, 100);
  const proof = { criterion: 'E07-AC19', seed: 7, nominalCorridorWidthM: 1.5, contactDecisionCommentCommit: '2e4df83867',
    nominalOutsideExpectedHp: 100, nominalOutsideActualHp: results[1].hpAfter, literalCorridorControlPass: results[1].hpAfter === 100, results };
  mkdirSync('test-results/ac-close-shared', { recursive: true });
  writeFileSync('test-results/ac-close-shared/zebra-corridor.json', JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { w.dispose(); }
