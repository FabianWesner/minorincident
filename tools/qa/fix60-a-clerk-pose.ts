/** Controlled regression at the actual physical low-tier approach; no route qualification. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { actorRadius } from '../../src/sim/world/SolidRegistry';
import { boxContact, type SolidBox } from '../../src/sim/world/SolidGeometry';
import type { EntitySnapshot, Transform } from '../../src/sim/world/types';
import { provenance } from './accept/probe';

const runs = [];
for (const tier of ['low', 'high'] as const) for (const dogBlocking of [false, true]) {
  const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
  try {
    const player = world.entities.get(1)!;
    Object.assign(player.transform, { x: -36.844383239746094, y: .7, z: -37.358184814453125 });
    world.physics.playerBody!.setTranslation(player.transform, true);
    world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    world.spatial.set(1, player.transform.x, player.transform.z);
    if (dogBlocking) {
      const dog = [...world.entities.iterate()].find(e => e.companion)!;
      Object.assign(dog.transform, { x: -38.3, z: player.transform.z, y: .3, yaw: 0 });
      dog.companion!.following = false;
      world.spatial.set(dog.id, dog.transform.x, dog.transform.z);
    }
    world.clearInput(); world.applyInput(emptyInput(), 'keyboard');
    world.missions!.completeObjective('pickup');
    const frames = [];
    for (let i = 0; i < 600 && world.missions!.state.l1!.clerkId; i++) {
      world.update();
      const entity = world.entities.get(world.missions!.state.l1!.clerkId ?? 0);
      if (!entity) break;
      const statics: unknown[] = [];
      const inspector = world.solids as unknown as { solids(at: Transform, radius: number, e: EntitySnapshot, visit: (box: SolidBox, id: string | number) => void): void };
      if (entity.pendingAdmission) inspector.solids(entity.transform, actorRadius(entity), entity, (box, id) => {
        const contact = boxContact(box, entity.transform.x, entity.transform.z, actorRadius(entity), { nx: 0, nz: 0, depth: 0, inside: false });
        if (contact.depth > .001 || contact.inside) statics.push({ id, box: { ...box }, contact });
      });
      frames.push({ tick: world.tick, hidden: !!entity.hidden, story: entity.civilian?.story,
        at: { ...entity.transform }, pending: entity.pendingAdmission && { ...entity.pendingAdmission }, statics });
    }
    const hiddenTransfer = frames.filter(f => f.hidden && ['npc-give', 'npc-wave'].includes(f.story?.clip ?? ''));
    runs.push({ tier, dogBlocking, completed: !world.missions!.state.l1!.clerkId, hiddenTransfer: hiddenTransfer.length, frames });
    console.log(JSON.stringify({ tier, dogBlocking, hiddenTransfer: hiddenTransfer.length, example: hiddenTransfer[0] }));
  } finally { world.dispose(); }
}
const path = process.env.CLERK_POSE_OUT ?? 'docs/reports/fix60-a/L1-03-pose.json.gz';
const json = JSON.stringify({ ...provenance(), method: 'Controlled placement at the physical low approach, normal pickup choreography and idle ticks; independent corgi-obstructed control.', runs }, null, 2) + '\n';
writeFileSync(path, path.endsWith('.gz') ? gzipSync(json) : json);
if (runs.some(run => !run.completed || run.hiddenTransfer)) process.exitCode = 1;
