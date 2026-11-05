import type { SimWorld } from '../../sim/world/SimWorld';
/** Shared Node/browser 60s tape; uses only production input and explosion APIs. */
export function propSequence(w: SimWorld): void {
  for (let tick = 0; tick < 3600; tick++) {
    if (tick === 0) w.setInput({ move: { x: 0, z: 1 }, aim: { x: 0, z: 1 } });
    if (tick === 180) w.setInput({ move: { x: 1, z: 0 }, aim: { x: 1, z: 0 } });
    if (tick === 240) w.props!.kick(w.props!.items[1].entityId, { x: 0, z: 1 });
    if (tick === 300) w.clearInput();
    if (tick === 360 || tick === 1800) w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { radius: 15, damage: false });
    w.update();
  }
}
