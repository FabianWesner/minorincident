/** Exact native encounter receipts for the four L10 farm set pieces. */
/* eslint-disable @typescript-eslint/no-explicit-any -- the QA probe wraps runtime SimWorld APIs that have no observer interface. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { cureEncounters, cureEncounterSlots, curePaceEncounters } from '../../src/levels/L10/encounters';

const out = process.env.S161_OUT ?? 'docs/reports/s161-l10fair/metrics.json';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
const targets = ['corn-field-horde', 'farmhouse-defense', 'shed-field-crossing', 'depot-alpha'] as const;
const encounterById = new Map([...cureEncounters, ...curePaceEncounters].map(e => [e.id, e]));
const rows: any[] = [];
const tiers = (process.env.S161_TIERS?.split(',') ?? ['high', 'low']) as ('high' | 'low')[];
const policies = (process.env.S161_POLICIES?.split(',') ?? ['skilled', 'walk']) as ('skilled' | 'walk')[];
const seeds = (process.env.S161_SEEDS?.split(',').map(Number) ?? [1, 2, 3]);
for (const tier of tiers) for (const policy of policies) for (const seed of seeds) {
  const result = await runLevel('L10', 'complete', seed, 900, 'auto', undefined, undefined, 0, {
    quality: tier, l10Walk: policy === 'walk',
    beforeBegin(world) {
      const release = new Map<string, number>(), releaseEvents = new Map<string, number[]>(), members = new Map<number, string>(), ids = new Map<string, Set<number>>(), currentSlots = new Map<string, Map<string, number>>(), spawnPose = new Map<number, any>();
      const admissions = new Map<string, any[]>(), damage = new Map<string, number>(), damageByAttacker = new Map<string, Map<number, any>>(), deaths = new Map<string, number>();
      const alphaTelegraphs = new Map<number, number>(), alphaCueEvents: any[] = [], alphaHits: any[] = [], playerDeathEvents: any[] = [], engaged = new Set<number>(), stationary = new Map<number, any>();
      const admissionIds = new Set<string>(), pendingDeaths = new Set<number>(), releasedLastTick = new Map<string, boolean>(), clearReceipts = new Map<string, any[]>();
      const groupFor = (id: number) => members.get(id);
      const ensure = (id: string) => {
        ids.set(id, ids.get(id) ?? new Set()); currentSlots.set(id, new Map()); releaseEvents.set(id, []); clearReceipts.set(id, []); admissions.set(id, admissions.get(id) ?? []);
        damage.set(id, damage.get(id) ?? 0); damageByAttacker.set(id, new Map()); deaths.set(id, deaths.get(id) ?? 0);
      };
      for (const id of targets) ensure(id);
      world.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.sourceId === 1) engaged.add(e.targetId); });
      world.events.on('combat.kill', e => { if (e.type === 'combat.kill' && e.sourceId === 1) engaged.add(e.targetId); });
      world.events.on('infected.attack', e => {
        if (e.type !== 'infected.attack' || e.targetId !== 1) return;
        const group = groupFor(e.sourceId);
        if (group) {
          damage.set(group, damage.get(group)! + e.amount);
          const ledger = damageByAttacker.get(group)!, row = ledger.get(e.sourceId) ?? { attackerId: e.sourceId, hits: 0, damage: 0, specials: {} as Record<string, number> };
          row.hits++; row.damage += e.amount; row.specials[e.special] = (row.specials[e.special] ?? 0) + 1; ledger.set(e.sourceId, row);
        }
        if (pendingDeaths.has(e.tick) && group) { deaths.set(group, deaths.get(group)! + 1); playerDeathEvents.push({ tick: e.tick, attackerId: e.sourceId, group, special: e.special }); pendingDeaths.delete(e.tick); }
        const member = world.entities.get(e.sourceId);
        if (member?.archetype === 'infected.alpha' && ['alpha.pounce', 'alpha.charge'].includes(e.special)) alphaHits.push({ tick: e.tick, sourceId: e.sourceId, group, move: e.special, amount: e.amount, telegraphTick: alphaTelegraphs.get(e.attackId) ?? null, leadSeconds: alphaTelegraphs.has(e.attackId) ? (e.tick - alphaTelegraphs.get(e.attackId)!) / 60 : null });
      });
      world.events.on('telegraph', e => { if (e.type === 'telegraph' && e.sourceId && e.target?.id === 1 && ['alpha.pounce', 'alpha.charge'].includes(e.special)) {
        alphaTelegraphs.set(e.attackId, e.tick); alphaCueEvents.push({ tick: e.tick, sourceId: e.sourceId, group: groupFor(e.sourceId), move: e.special, duration: e.duration });
      } });
      world.events.on('player.died', e => { if (e.type === 'player.died') pendingDeaths.add(e.tick); });
      const ai = world.infected!, spawn = (ai as any).spawn.bind(ai) as (...args: any[]) => number;
      (ai as any).spawn = (...args: any[]) => {
        const id = spawn(...args), actor = world.entities.get(id)!, player = world.entities.get(1)!;
        spawnPose.set(id, { tick: world.tick, x: actor.transform.x, z: actor.transform.z,
          inPlayerView: ai.director.inPlayerView(actor.transform), distance: Math.hypot(actor.transform.x-player.transform.x, actor.transform.z-player.transform.z) });
        return id;
      };
      const update = world.update.bind(world);
      world.update = (...args: Parameters<typeof world.update>) => {
        const value = update(...args), state = world.l10Encounters?.state, player = world.entities.get(1)!;
        for (const id of targets) {
          const released = !!state?.released?.includes(id), priorReleased = releasedLastTick.get(id) ?? false;
          if (released && !priorReleased) { releaseEvents.get(id)!.push(world.tick); if (!release.has(id)) release.set(id, world.tick); }
          releasedLastTick.set(id, released);
          const group = encounterById.get(id)!;
          const slots = cureEncounterSlots(group, tier);
          const slotMap = currentSlots.get(id)!;
          slotMap.clear();
          const keys = slots.map(s => s.key);
          for (const key of keys) {
            const spawnedKey = `${key}:0`, actorId = state?.spawned[spawnedKey]; if (actorId === undefined) continue;
            slotMap.set(spawnedKey, actorId); ids.get(id)!.add(actorId); members.set(actorId, id);
            const keyTag = `${id}:${spawnedKey}`;
            if (!admissionIds.has(keyTag)) {
              admissionIds.add(keyTag);
              if (!release.has(id)) release.set(id, world.tick);
              const actor = world.entities.get(actorId)!;
              admissions.get(id)!.push({ key: spawnedKey, id: actorId, ...(spawnPose.get(actorId) ?? { tick: world.tick, x: actor.transform.x, z: actor.transform.z,
                inPlayerView: world.infected!.director.inPlayerView(actor.transform), distance: Math.hypot(actor.transform.x-player.transform.x, actor.transform.z-player.transform.z) }) });
            }
          }
          if (slotMap.size === slots.length && [...slotMap.values()].every(actorId => {
            const actor = world.entities.get(actorId); return !actor || actor.health.current <= 0 && (actor.infected?.recoverAt ?? -1) < 0;
          })) {
            const signature = `${releaseEvents.get(id)!.at(-1)}:${[...slotMap.values()].join(',')}`;
            if (!clearReceipts.get(id)!.some(r => r.signature === signature)) {
              clearReceipts.get(id)!.push({ signature, tick: world.tick, releaseTick: releaseEvents.get(id)!.at(-1) ?? null });
              clearTick.set(id, world.tick);
            }
          }
        }
        for (const group of targets) for (const actorId of ids.get(group)!) {
          const actor = world.entities.get(actorId); if (!actor || actor.health.current <= 0) continue;
          const prev = stationary.get(actorId);
          if (!prev || Math.hypot(actor.transform.x-prev.x, actor.transform.z-prev.z) > .05) stationary.set(actorId, { x: actor.transform.x, z: actor.transform.z, since: world.tick });
          else if (world.tick - prev.since >= 600 && !stuck.some(s => s.id === actorId)) {
            const playerAt = world.entities.get(1)!.transform;
            const path = world.infected!.nav.steer(actor.transform, playerAt, { path: [], goal: -1, pathIndex: 0 }, .35, { x: actor.transform.x, z: actor.transform.z }, Infinity, true);
            if (!path) stuck.push({ id: actorId, group, since: prev.since, until: world.tick, x: actor.transform.x, z: actor.transform.z });
          }
        }
        return value;
      };
      const clearTick = new Map<string, number>(), stuck: any[] = [];
      Object.assign(world, { __s161: { release, releaseEvents, currentSlots, clearReceipts, ids, admissions, damage, damageByAttacker, deaths, playerDeathEvents, alphaHits, alphaCueEvents, engaged, clearTick, stuck } });
    },
    beforeDispose(world) {
      const m = (world as any).__s161;
      for (const id of targets) {
        const group = encounterById.get(id)!, expected = cureEncounterSlots(group, tier).length;
        const admitted = new Set((m.admissions.get(id) ?? []).map((a: any) => a.key)).size;
        const finalRelease = m.releaseEvents.get(id)?.at(-1), receipt = m.clearReceipts.get(id)?.find((r: any) => r.releaseTick === finalRelease);
        const clear = receipt?.tick;
        const allIds = [...(m.ids.get(id) ?? [])];
        const livingEndIds = allIds.filter((actorId: number) => (world.entities.get(actorId)?.health.current ?? 0) > 0);
        const neverEngagedIds = allIds.filter((actorId: number) => !m.engaged.has(actorId));
        const unfairSpawnIds = (m.admissions.get(id) ?? []).filter((a: any) => a.inPlayerView || a.distance <= 12).map((a: any) => a.id);
        rows.push({ tier, policy, seed, encounter: id, expected, admitted, admissionAttempts: m.admissions.get(id)?.length ?? 0,
          releaseTick: m.release.get(id) ?? null, releaseTicks: m.releaseEvents.get(id),
          clearTick: clear ?? null, clearSeconds: clear === undefined || receipt?.releaseTick == null ? null : (clear-receipt.releaseTick)/60,
          members: m.admissions.get(id), unfairSpawnIds,
          stuck: m.stuck.filter((s: any) => s.group === id), damage: m.damage.get(id) ?? 0,
          deaths: m.deaths.get(id) ?? 0, deathEvents: m.playerDeathEvents.filter((h: any) => h.group === id),
          damageByAttacker: [...m.damageByAttacker.get(id)!.values()], alphaTelegraphs: m.alphaCueEvents.filter((h: any) => h.group === id),
          alphaHits: m.alphaHits.filter((h: any) => h.group === id), livingAtEndIds: livingEndIds, neverEngagedIds });
      }
    },
  });
  writeFileSync(out, JSON.stringify({ method: 'native SimWorld exact tick hooks; stable encounter slot ledger; skilled LevelTenBot, walk applies walk input', rows }) + '\n');
  console.log(JSON.stringify({ tier, policy, seed, completed: result.completed, deaths: result.deaths, time: result.time }));
}
