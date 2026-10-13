import { clearOfL2Script, MAX_BODIES, type L1Aftermath } from '../../levels/continuity';
import type { SimWorld } from '../world/SimWorld';
import type { MissionResult } from '../missions/types';
import { commitCrossingHandover } from './crossingHandover';
import { autoRewards, lastLevel, type CampaignSave, type Level } from './Campaign';

/** Record the completed run before any result-screen navigation or level unload. Replays update aftermath without granting rewards again. */
export function completeCampaignLevel(save: CampaignSave, level: Level, result: MissionResult, world: SimWorld): void {
  if (level === 1) save.world = { ...save.world, L1: captureL1Aftermath(world) };
  save.results ??= {};
  save.results[`L${level}`] = structuredClone(result);
  if (level === 5) { save.survivors = [...result.survivors ?? []]; save.stationOccupants = structuredClone(result.stationOccupants); save.rescuedSurvivors = structuredClone(result.rescuedSurvivors); }
  if (level === 9) { commitCrossingHandover(save, world); return; }
  if (level !== save.completedLevels + 1) return;
  // L6 onwards has no reward screen: finishing a level unlocks and hands over to the next one directly.
  if (level >= 6) {
    save.completedLevels = level; save.unlockedLevel = Math.max(save.unlockedLevel, Math.min(lastLevel, level + 1)) as Level;
    const carriedWeapons = level === 7 ? world.entities.get(1)?.weapons : null;
    if (carriedWeapons) {
      // L8 receives the exact acquired arsenal (E29-AC13 / E30-AC03); the rocket launcher stays in the racks.
      const racks = { LEFT: carriedWeapons.LEFT.rack.map(s => s.id), RIGHT: carriedWeapons.RIGHT.rack.map(s => s.id) };
      save.racks = racks;
      for (const id of [...racks.LEFT, ...racks.RIGHT]) if (!save.ownedActions.includes(id)) save.ownedActions.push(id);
    }
    return;
  }
  const weapons = level === 4 || level === 5 ? world.entities.get(1)?.weapons : null;
  const carried = weapons ? { LEFT: weapons.LEFT.rack.map(s => s.id), RIGHT: weapons.RIGHT.rack.map(s => s.id) } : null;
  autoRewards(save, level);
  if (carried) {
    save.racks = carried;
    for (const id of [...carried.LEFT, ...carried.RIGHT]) if (!save.ownedActions.includes(id)) save.ownedActions.push(id);
  }
}

/** Rounded, and -0 folded to 0 so a JSON round trip of the save reproduces the record exactly. */
const r2 = (v: number) => Math.round(v * 100) / 100 + 0, r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
/**
 * The player-caused part of the L1 world at the moment L1 completes (src/levels/continuity.ts). Sim state only, in a
 * stable order and rounded, so the same run always stores the same record. Scripted canon is never stored: L2 always
 * applies it.
 */
export function captureL1Aftermath(world: SimWorld): L1Aftermath {
  const props = (world.props?.snapshot() ?? []).filter(p => p.id.startsWith('D-GROVE/'))
    .map(p => ({ id: p.id, p: p.p.map(r4) as [number, number, number], q: p.q.map(r4) as [number, number, number, number] }));
  const toys = world.toys?.carried() ?? { dumpsters: [], gatesClosed: [] };
  const bodies: L1Aftermath['bodies'] = [];
  for (const e of [...world.entities.iterate()].sort((a, b) => a.id - b.id)) {
    if (bodies.length >= MAX_BODIES) break;
    if (!e.civilian?.l1 || e.civilian.state !== 'finished' || e.infection || e.hidden || !e.appearance) continue;
    // L2 clears its set pieces; record only bodies it can actually restore, before applying the body cap.
    if (!clearOfL2Script(e.transform)) continue;
    bodies.push({ x: r2(e.transform.x), z: r2(e.transform.z), yaw: r2(e.transform.yaw), model: e.appearance.asset, tint: e.appearance.tint });
  }
  const bike = world.vehicles?.bicycle.entity?.transform;
  return { version: 1, props, dumpsters: toys.dumpsters, gatesClosed: toys.gatesClosed, bodies, bike: bike ? { x: r2(bike.x), z: r2(bike.z), yaw: r2(bike.yaw) } : null };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Save-file validation of a stored aftermath (bounded sizes, known anchor names, finite numbers). */
export function validAftermath(raw: unknown): raw is L1Aftermath {
  if (!record(raw) || raw.version !== 1) return false;
  const { props, dumpsters, gatesClosed, bodies, bike } = raw;
  if (!Array.isArray(props) || props.length > 400 || !props.every(p => record(p) && typeof p.id === 'string' && p.id.startsWith('D-GROVE/') && Array.isArray(p.p) && p.p.length === 3 && p.p.every(finite) && Array.isArray(p.q) && p.q.length === 4 && p.q.every(finite))) return false;
  const names = (v: unknown, prefix: string) => Array.isArray(v) && v.length <= 16 && v.every(n => typeof n === 'string' && new RegExp(`^${prefix}-\\d+$`).test(n)) && new Set(v).size === v.length;
  if (!names(dumpsters, 'dumpster') || !names(gatesClosed, 'gate')) return false;
  if (!Array.isArray(bodies) || bodies.length > MAX_BODIES || !bodies.every(b => record(b) && finite(b.x) && finite(b.z) && finite(b.yaw) && typeof b.model === 'string' && /^npc\.[a-z0-9-]+$/.test(b.model) && typeof b.tint === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.tint))) return false;
  return bike === null || record(bike) && finite(bike.x) && finite(bike.z) && finite(bike.yaw);
}
