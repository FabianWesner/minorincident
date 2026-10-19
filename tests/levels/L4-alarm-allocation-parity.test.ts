import { expect, test } from 'vitest';
import { balancedCrowdModel } from '../../src/data/crowdAppearance';
import { l1Pedestrians } from '../../src/data/npcs';
import { keepsLook } from '../../src/sim/outbreak/appearance';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { Rng } from '../../src/core/Rng';
import type { Point } from '../../src/sim/npc/types';
import type { Refuge } from '../../src/sim/outbreak/Outbreak';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

type Original = { world: SimWorld; rng: Rng; crowdModel(at: Point, infected?: boolean): string; refugeSpot(e: EntitySnapshot, refuge: Refuge): Point };

test('T-E22-20-refuge @E22-AC20 allocation changes retain every alarm identity, look, target, event and RNG outcome', async () => {
  const run = async (original: boolean) => {
    const { world, mission } = await loadL4(2, 'low');
    try {
      if (original) {
        const outbreak = world.npcs!.civilians.outbreak! as unknown as Original;
        outbreak.crowdModel = function (at, infected = false) {
          return balancedCrowdModel(l1Pedestrians.models,
            [...this.world.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 && Boolean(e.infected) === infected && keepsLook(e)).map(e => ({ model: e.appearance!.asset, x: e.transform.x, z: e.transform.z })), at, Math.floor(this.rng.next() * 0x100000000));
        };
        outbreak.refugeSpot = function (e, refuge) {
          const nav = this.world.infected!.nav, angle = Math.atan2(e.transform.z - refuge.z, e.transform.x - refuge.x);
          for (let radius = 1.4; radius <= 4; radius += .65) for (let k = 0; k < 9; k++) {
            const a = angle + ((k + e.id % 9) % 9 - 4) * Math.PI / 12;
            const p = { x: refuge.x + Math.cos(a) * radius, z: refuge.z + Math.sin(a) * radius };
            if (!nav.clear(p.x, p.z, .5) || !nav.visible(refuge, p, .35)) continue;
            let occupied = false;
            for (const other of this.world.entities.iterate()) if (other.id !== e.id && other.civilian && !other.hidden && other.health.current > 0) {
              const at = other.civilian.l1?.target ?? other.transform;
              if (Math.hypot(at.x - p.x, at.z - p.z) < .85) { occupied = true; break; }
            }
            if (!occupied) return p;
          }
          return { x: e.transform.x, z: e.transform.z };
        };
      }
      runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 180, stopWhen: () => mission.state.l4!.turnAt > 0 && world.tick >= mission.state.l4!.turnAt + 120 });
      expect(mission.state.l4!.turnAt).toBeGreaterThan(0);
      return { tick: world.tick, entities: world.query({}), mission: structuredClone(mission.state), events: world.events.events() };
    } finally { world.dispose(); }
  };
  expect(await run(false)).toEqual(await run(true));
}, 180_000);
