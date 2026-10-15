import { dialogue } from '../../data/dialogue';
import { l2 } from '../../data/l2';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/**
 * L2 "The Failed Rescue" objective graph (E20 section 4): axe -> alarm -> board -> ride -> doors -> bridge checkpoint.
 * Beats are driven by `LevelTwoRescue` (def.l2) through mission states; everything after the doors open is systemic.
 * No fail timer, no reward screen: crossing the checkpoint gate completes the level and the campaign continues into L3.
 */
export function levelTwoMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const names = [...l2.escape.groups.map((_, i) => `l2-street-edge-${i + 1}`), 'l2-start', 'l2-axe-rack', 'l2-board', 'l2-truck', 'l2-truck-stop', 'l2-market', 'l2-door-front', 'l2-door-loading', 'l2-forecourt', 'l2-watch', 'l2-gate', 'l2-gate-inside', 'l2-cluster', 'l2-cluster-alarm', 'l2-side-gate',
    ...['bench-1', 'bench-2', 'bench-3', 'bench-4', 'crew-1', 'crew-2', 'crew-3', 'crew-4', 'crew-5', 'crew-6'].map(n => `l2-${n}`), 'edge-in-1', 'edge-in-2', 'edge-in-3', 'edge-in-4', 'edge-in-5', 'edge-in-6'];
  const def: MissionDef = {
    id: 'L2', l2: true, briefing: dialogue['L2.briefing'], anchors: {}, actors: {}, groups: {}, gates: {}, items: ['axe'],
    states: ['alarm', 'boarded', 'arrived', 'doors-open', 'radio', 'crossed'], counters: [], checkpoints: [...l2.checkpoints],
    cinematics: {}, steps: [], finish: ['bridge'], onStart: [{ kind: 'radio', id: 'L2.briefing' }], onComplete: [],
  };
  for (const name of names) def.anchors[name] = resolve('D-GROVE', name);
  for (let i = 1; i <= 80; i++) { try { def.anchors[`refuge-door-${i}`] = resolve('D-GROVE', `refuge-door-${i}`); } catch { break; } }
  def.anchors['l2-gate-inside'].radius = 3;
  // Forgiving rings (PO 10-08: the axe took several tries): standing anywhere in them counts.
  def.anchors['l2-board'].radius = 1.8; def.anchors['l2-axe-rack'].radius = 1.5;
  // The axe ring stands on the station's raised apron (slab top at 0.4 m).
  def.anchors['l2-axe-rack'].y = .4;
  const step = (id: string, type: ObjectiveDef['type'], text: string, anchor: string, complete: Trigger, start: ObjectiveDef['start']): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, start, complete, fail: [] }; def.steps.push(s); return s;
  };
  const after = (...ids: string[]): ObjectiveDef['start'] => ({ kind: 'objectives', ids, mode: 'all' });
  const state = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  const axe = step('axe', 'interact', 'Take the fire axe', 'l2-axe-rack', { kind: 'interact', anchor: 'l2-axe-rack', seconds: .6 }, { kind: 'start' });
  axe.onComplete = [{ kind: 'grant', item: 'axe' }, { kind: 'checkpoint', id: 'axe' }];
  step('calm', 'custom', 'Take the fire axe', 'l2-axe-rack', state('alarm'), { kind: 'start' }).waypoint = false;
  step('board', 'interact', 'Get on the fire truck', 'l2-board', { kind: 'interact', anchor: 'l2-board', seconds: l2.ride.boardInteractS }, after('axe', 'calm'));
  step('ride', 'custom', 'Ride with Engine 3 to Grove Market', 'l2-truck-stop', state('arrived'), after('board'));
  step('doors', 'custom', 'Cover the firefighters while they force the doors', 'l2-watch', state('doors-open'), after('ride')).waypoint = false;
  step('bridge', 'reach', 'Reach the police checkpoint at the bridge', 'l2-gate-inside', state('crossed'), after('doors'));
  return def;
}
