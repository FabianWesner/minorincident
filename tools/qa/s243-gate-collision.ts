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
    const place = (z: number = item.z, x: number = item.x - 8, heading = 0) => {
      const at = { x, y: .7 + (w.districts?.groundHeight(x, z) ?? 0), z };
      Object.assign(player.transform, at); w.physics.playerBody!.setTranslation(at, true); w.spatial.set(1, at.x, at.z);
      Object.assign(bikeEntity.transform, { ...at, yaw: 0 }); Object.assign(bikeEntity.bicycle!, { mounted: true, speed: 0, heading, steer: 0 });
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
    const detour = () => {
      place(95, item.x - 25, -Math.PI / 2); w.chunks!.update(); w.clearInput();
      const start = { x: player.transform.x, z: player.transform.z }, points = [{ x: item.x - 25, z: 40 }, { x: item.x + 15, z: 40 }];
      let waypoint = 0, ticks = 0, maxX = start.x, minZ = start.z;
      for (; ticks < 1800 && waypoint < points.length && bike.riding && !gate.interactable!.open; ticks++) {
        const target = points[waypoint], dx = target.x - player.transform.x, dz = target.z - player.transform.z, d = Math.hypot(dx, dz);
        if (d < 2) { waypoint++; continue; }
        w.setInput({ move: { x: dx / d, z: dz / d } }); w.update();
        maxX = Math.max(maxX, player.transform.x); minZ = Math.min(minZ, player.transform.z);
      }
      w.clearInput();
      return { start, end: { x: player.transform.x, z: player.transform.z }, ticks, waypoint, maxX, minZ, riding: bike.riding, gateOpen: gate.interactable!.open };
    };
    w.interactables!.unblock(id);
    w.interactables!.block(id, { x: item.x, z: 95, y: .7, halfX: .2, halfY: .7, halfZ: 50 });
    const oldDetour = detour();
    w.interactables!.unblock(id);
    w.interactables!.block(id, { x: item.x, z: 95, y: .7, halfX: .2, halfY: .7, halfZ: 396 });
    const stagedDetour = detour();
    const lanes = [...new Set([item.z, 0, 40, 150])];
    const closed = lanes.map(z => ({ z, ...drive(z) }));
    gate.interactable!.open = true; gate.interactable!.completed = true; w.interactables!.unblock(id);
    const open = lanes.map(z => ({ z, ...drive(z) }));
    rows.push({ tier, ...item, wall, oldDetour, detour: stagedDetour, closed, open });
    console.log(JSON.stringify(rows.at(-1)));
  } finally { w.dispose(); }
}
writeFileSync('/tmp/s243-gate-collision.json', JSON.stringify(rows, null, 2));
