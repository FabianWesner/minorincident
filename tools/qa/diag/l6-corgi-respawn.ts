// PO 11-26: L6 retreat, the corgi respawned outside the tunnel at gate-90 (player 110.18, 15.62, y 1.27).
import { loadLevel } from '../../sim-runner/levels';
const w = await loadLevel('L6', 1);
const p = w.entities.get(1)!; Object.assign(p.transform, { x: 110.18, z: 15.62, y: 1.27 });
const nav = w.infected!.nav;
console.log('player navClear', nav.clear(p.transform.x, p.transform.z, .35), 'cell', nav.nearestCell(p.transform.x, p.transform.z, .35));
w.npcs!.companion.respawnNear();
for (const e of w.entities.iterate()) if (e.companion) {
  const t = e.transform;
  console.log('corgi', t.x.toFixed(2), t.z.toFixed(2), t.y.toFixed(2), 'navClear', nav.clear(t.x, t.z, .3), 'visibleFromPlayer', nav.visible(p.transform, t, .3), 'hidden', e.hidden, 'pending', !!e.pendingAdmission);
}
process.exit(0);
