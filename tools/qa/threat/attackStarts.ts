import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** Count the windup, including a subsequently interrupted attack. A resolved
 * hit is a different measurement. Grabs begin on physical contact; escort
 * contact uses a synchronous attack without a separate telegraph. */
export function observeAttackStarts(world: SimWorld, record: (sourceId: number, targetId: number, tick: number) => void): void {
  world.events.on('telegraph', event => {
    if (event.type !== 'telegraph' || !event.sourceId || !event.target || ['alpha.roar', 'scream', 'revive'].includes(event.special)) return;
    record(event.sourceId, event.target.id, event.tick);
  });
  world.events.on('civilian.grabbed', event => {
    if (event.type === 'civilian.grabbed') record(event.sourceId, event.targetId, event.tick);
  });
  world.events.on('infected.attack', event => {
    if (event.type === 'infected.attack' && event.special === 'escort-hit') record(event.sourceId, event.targetId, event.tick);
  });
}
