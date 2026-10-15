import { expect, test } from 'vitest';
import { missionIds } from '../../src/levels/missions';
import { loadLevel } from '../../tools/sim-runner/levels';
import { loadL4 } from '../../tools/sim-runner/l4Bots';
import { pickupPlacementClear } from '../../src/sim/interact/PickupPlacement';
import { l4, l4Route, l4RoutePose, l4ConvoyStations } from '../../src/data/l4';

test('@pickup-solids PO13 every campaign ground pickup clears walls, props, vehicle hulls and convoy stop poses', async () => {
  const failures: string[] = [];
  for (const level of new Set([...missionIds, 'L7'] as const)) {
    const w = level === 'L4' ? (await loadL4(1)).world : await loadLevel(level, 1);
    try {
      // Give all authored solids their first nav update, before checking placements.
      w.props?.updateNavigation();
      for (const e of w.entities.iterate()) {
        if (!e.pickup || 'collected' in e.pickup && e.pickup.collected || 'surfaceY' in e.pickup && e.pickup.surfaceY !== undefined && e.pickup.surfaceY > (w.districts?.groundHeight(e.transform.x,e.transform.z) ?? 0) + .2) continue;
        if (!pickupPlacementClear(w, e.transform)) failures.push(`${level} ${e.archetype}#${e.id} (${e.transform.x},${e.transform.z})`);
      }
      if (level === 'L4') {
        const route = l4Route(), stations = l4ConvoyStations(route.length), bus = l4.convoy.vehicles.findIndex(v => v.player), stop = l4RoutePose(route, stations.start[bus] + stations.travel);
        // Scene Lab runs the real mission on a composition named scene-lab.
        const compositionId = w.districts!.composition.id; w.districts!.composition.id = 'scene-lab';
        const id = w.pickups!.spawn('medkit', stop), pack = w.entities.get(id)!;
        expect(pickupPlacementClear(w, stop), 'PO bus wheel/stop fixture is rejected').toBe(false);
        expect(pickupPlacementClear(w, pack.transform), 'med pack moves onto reachable open pavement').toBe(true);
        expect(Math.hypot(pack.transform.x - stop.x, pack.transform.z - stop.z)).toBeGreaterThan(2);
        w.districts!.composition.id = compositionId;
      }
    } finally { w.dispose(); }
  }
  expect(failures).toEqual([]);
}, 240000);
