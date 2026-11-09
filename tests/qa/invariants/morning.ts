import { oracle } from './oracles';
import { loadLevel } from './world';
import { seatAnchor, seatSpecs, sitHipHeight } from '../../../src/sim/npc/seats';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import type { EntitySnapshot } from '../../../src/sim/world/types';
const sceneActor = (e: EntitySnapshot) => !!(e.civilian?.story || e.civilian?.ally || e.civilian?.survivor || e.civilian?.routine === 'staff');

// Shard the same 90-second, every-frame sweep so one fixture no longer monopolizes the nightly queue.
export async function morningSweep(level: Parameters<typeof loadLevel>[0], tier: 'high' | 'low') {
    const failures = new Set<string>(), actorFailures = new Set<string>();
    const cast: Record<string, number> = {};
    {
      const world = await loadLevel(level, 1, tier);
      const tracked = new Map<number, { seen: boolean }>();
      for (const e of world.entities.iterate()) if (sceneActor(e)) tracked.set(e.id, { seen: !e.hidden && !e.pendingAdmission });
      cast[`${level}/${tier}`] = tracked.size;
      const propById = new Map(world.props!.items.map(p => [p.id, p]));
      const placementById = new Map<string, DistrictLayout['placements'][number]>(world.districts!.districts.flatMap(d => d.layout.placements.map(p => [`${d.id}/${p.id}`, p] as const)));
      for (let i = 0; i < 90 * 60; i++) {
        world.update();
        for (const [id, watch] of tracked) {
          const e = world.entities.get(id);
          if (!e) { actorFailures.add(`${level}/${tier}: scripted actor ${id} removed before its exit`); continue; }
          if (!e.civilian || e.health.current <= 0 || e.civilian.state === 'finished' || e.civilian.survivor?.mode === 'hidden' || e.passengerOf !== undefined || e.corpse || e.infected) { tracked.delete(id); continue; }
          if (watch.seen && oracle.actor({ inScriptedScene: true, exists: true, hidden: !!e.hidden })) actorFailures.add(`${level}/${tier}: scripted actor ${id} (${e.civilian.story?.clip ?? e.civilian.ally?.role ?? 'cast'}) hidden mid-scene at tick ${world.tick}`);
          if (!e.hidden && !e.pendingAdmission) watch.seen = true;
        }
        if (i % 60) continue;
        for (const e of world.entities.iterate()) {
          const c = e.civilian, action = c?.schedule?.[c.scheduleStep ?? 0];
          if (!c) continue;
          if (sceneActor(e) && !tracked.has(e.id)) tracked.set(e.id, { seen: !e.hidden && !e.pendingAdmission });
          if (e.hidden || e.health.current <= 0 || !(c?.story?.clip === 'npc-sit' || action?.activity === 'sit' && c.activityUntil)) continue;
          const target = action?.seat ?? e.transform;
          const prop = action?.seatProp ? propById.get(action.seatProp) : world.props!.items.filter(p => seatSpecs[p.assetId] && Math.hypot(p.pose.p[0] - target.x, p.pose.p[2] - target.z) < 1.2).sort((a, b) => Math.hypot(a.pose.p[0] - target.x, a.pose.p[2] - target.z) - Math.hypot(b.pose.p[0] - target.x, b.pose.p[2] - target.z))[0];
          if (!prop || !seatSpecs[prop.assetId] || !world.entities.get(prop.entityId) || process.env.QA_INVARIANTS_BREAK === 'seats') { if (oracle.seat({ sitting: true, hasSeat: false, supported: false })) failures.add(`${level}/${tier}/${e.id}: no seat (${action?.seatProp ?? c?.story?.clip})`); }
          else {
            const placement = placementById.get(prop.id);
            const yaw = 2 * Math.atan2(prop.pose.q[1], prop.pose.q[3]);
            const expected = placement && seatAnchor(prop.assetId, prop.pose.p, yaw, placement.scale);
            const dx = target.x - prop.pose.p[0], dz = target.z - prop.pose.p[2];
            const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw), localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
            // Bench seats allow multiple people along their length; test against the actual support footprint, not only its center anchor.
            const actualHipY = e.transform.y - .7 + (action?.seatLift ?? 0) + sitHipHeight;
            const supported = !!expected && Math.abs(localX - seatSpecs[prop.assetId].hipX * placement!.scale[0]) <= .2 && Math.abs(localZ) <= .95 && Math.abs(actualHipY - expected.y) <= .2;
            if (oracle.seat({ sitting: true, hasSeat: true, supported })) failures.add(`${level}/${tier}/${e.id}: ${JSON.stringify({ asset: prop.assetId, seat: target, localX, localZ, actualHipY, expected })}`);
          }
        }
      }
      world.dispose();
    }
    return { seats: [...failures], actors: [...actorFailures], cast };
}
