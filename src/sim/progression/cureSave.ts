import { catalog } from '../../data/actions/catalog';
import { cureCheckpoints, levelTenMission } from '../../levels/L10/mission';
import type { MissionCheckpoint } from '../missions/types';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
const definition = levelTenMission(() => ({ x: 0, z: 0, radius: 2 }));
/** Validate resume records before rebuilding entities, chunks and combat. Optional seams retain their owners' schemas. */
export function validCureCheckpoint(v: unknown): v is MissionCheckpoint {
  if (!record(v) || !Number.isSafeInteger(v.tick) || Number(v.tick) < 0 || !record(v.state) || !record(v.arsenal) || !Array.isArray(v.entities) || !v.entities.length || !record(v.entities[0]) || v.entities[0].id !== 1 || v.entities.length > 2000) return false;
  if (v.combatSequence !== undefined && (!Number.isSafeInteger(v.combatSequence) || Number(v.combatSequence) < 0)) return false;
  const s = v.state, a = v.arsenal;
  if (s.id !== 'L10' || !['playing','retry','result','progression'].includes(String(s.phase)) || !cureCheckpoints.includes(s.checkpoint as typeof cureCheckpoints[number]) || !record(s.steps) || !record(s.states) || !record(s.stats) || !record(s.actors) || !record(s.counters) || !record(s.gates) || !strings(s.items) || s.items.some(id => !definition.items.includes(id)) || !strings(s.killedBosses) || !strings(s.completedObjectives) || s.completedObjectives.some(id => !definition.steps.some(step => step.id === id)) || !Array.isArray(s.volumes) || s.volumes.some(x => typeof x !== 'boolean')) return false;
  if (!definition.states.every(key => typeof (s.states as Record<string, unknown>)[key] === 'boolean') || !['time','kills','knockdowns','damage','deaths','rescued'].every(key => Number.isFinite((s.stats as Record<string, unknown>)[key]))) return false;
  for (const step of definition.steps) {
    const value = s.steps[step.id];
    if (!record(value) || !['pending','active','completed','cancelled'].includes(String(value.status)) || !Number.isSafeInteger(value.started) || !Number.isFinite(value.interaction) || !Array.isArray(value.kills) || !record(value.events)) return false;
  }
  if (!strings(a.ownedActions) || !a.ownedActions.includes('weapon.fire-axe') || a.ownedActions.some(id => !catalog[id]) || !record(a.racks)) return false;
  if (!['LEFT','RIGHT'].every(side => { const rack = (a.racks as Record<string, unknown>)[side]; return strings(rack) && rack.length > 0 && rack.length <= 4 && rack.every(id => (a.ownedActions as string[]).includes(id)); })) return false;
  const ids = new Set<number>();
  for (const e of v.entities) {
    if (!record(e) || !Number.isSafeInteger(e.id) || Number(e.id) < 1 || ids.has(Number(e.id)) || !record(e.transform) || !['x','y','z','yaw'].every(key => Number.isFinite((e.transform as Record<string, unknown>)[key])) || !record(e.health) || !Number.isFinite(e.health.current) || !Number.isFinite(e.health.max)) return false;
    ids.add(Number(e.id));
  }
  if (!definition.counters.every(key => Number.isSafeInteger((s.counters as Record<string, unknown>)[key]) && Number((s.counters as Record<string, unknown>)[key]) >= 0)) return false;
  const player = v.entities.find(e => e.id === 1);
  if (!player || !record(player.survivor) || !record(player.survivor.checkpoint) || !record(player.weapons) || !['LEFT','RIGHT'].every(side => { const hand = player.weapons[side]; return record(hand) && Array.isArray(hand.rack) && hand.rack.map(slot => record(slot) ? slot.id : null).join() === (a.racks as Record<string, string[]>)[side].join(); })) return false;
  return v.seams === undefined || record(v.seams);
}

/** S1/E2 saves predate explicit console activation; preserve their checkpoint and inventory. */
export function migrateCureResume(raw: unknown): unknown {
  if (!record(raw)) return raw;
  const copy = structuredClone(raw);
  for (const name of ['current', 'checkpoint']) {
    const checkpoint = copy[name];
    if (!record(checkpoint) || !record(checkpoint.state) || !record(checkpoint.state.states)) continue;
    const states = checkpoint.state.states;
    if (states['charge-active'] === undefined) states['charge-active'] = false;
    if (states['console-held'] === undefined) states['console-held'] = false;
  }
  return copy;
}
