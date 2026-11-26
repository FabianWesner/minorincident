import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';

const cases = [
  { group: 'setpiece-quarantine-gate', x: 3010, z: 95 },
  { group: 'setpiece-burning-convoy', x: 3260, z: 95 },
  { group: 'setpiece-dark-underpass', x: 3390, z: 74 },
  { group: 'setpiece-field-hospital', x: 3502, z: 95 },
] as const;
const rows: unknown[] = [];
for (const tier of ['high', 'low'] as const) for (const item of cases) {
  const w = await loadLevel('L10', 1, undefined, 0, { quality: tier });
  try {
    const player = w.entities.get(1)!, bike = w.vehicles!.bicycle, bikeEntity = bike.entity!;
    const place = (z: number = item.z) => {
      const at = { x: item.x - 8, y: .7 + (w.districts?.groundHeight(item.x - 8, z) ?? 0), z };
      Object.assign(player.transform, at); w.physics.playerBody!.setTranslation(at, true); w.spatial.set(1, at.x, at.z);
      Object.assign(bikeEntity.transform, { ...at, yaw: 0 }); Object.assign(bikeEntity.bicycle!, { mounted: true, speed: 0, heading: 0, steer: 0 });
      player.riding = bikeEntity.id; w.player!.locomotion.reset(); w.previousPlayer = { ...player.transform };
    };
    place(); w.chunks!.update();
    // Spawn the production encounter gate from the normal release path.
    for (let i=0; i<20; i++) w.update();
    const id = w.l10Encounters!.state.roadblockGates?.[item.group];
    if (id === undefined) throw new Error(`${tier}/${item.group}: gate missing`);
    const gate = w.entities.get(id)!;
    if (gate.interactable?.open) throw new Error(`${tier}/${item.group}: gate unexpectedly open`);
    const wall = w.interactables!.walls.find(v => v.entityId === id);
    const drive = (z: number) => {
      place(z); w.chunks!.update(); let maxX = player.transform.x;
      for (let i=0; i<180; i++) { w.setInput({ drive: { throttle: 1, steer: 0 } }); w.update(); maxX = Math.max(maxX, player.transform.x); }
      return { maxX, endX: player.transform.x, endZ: player.transform.z, riding: bike.riding };
    };
    const lanes = [...new Set([item.z, 0, 40, 150])];
    const closed = lanes.map(z => ({ z, ...drive(z) }));
    gate.interactable!.open = true; gate.interactable!.completed = true; w.interactables!.unblock(id);
    const open = lanes.map(z => ({ z, ...drive(z) }));
    rows.push({ tier, ...item, wall, closed, open });
    console.log(JSON.stringify(rows.at(-1)));
  } finally { w.dispose(); }
}
writeFileSync('/tmp/s243-gate-collision.json', JSON.stringify(rows, null, 2));
