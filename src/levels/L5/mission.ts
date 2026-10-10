import { dialogue } from '../../data/dialogue';
import { l5, l5Survivors } from '../../data/l5';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/**
 * L5 "Aftermath" objective graph (E23 section 4): unbar the cellar door and step out -> look for anyone still alive (five survivors,
 * found in any order by standing next to them; the sign-of-life cues are the only guide, there is no marker on a survivor) -> lead
 * whoever is left to the Metro station, where the shutter rolls shut behind the group. No fail timer and no fail on a survivor's
 * death; the level is completable with zero survivors. Beats are driven by `LevelFiveAftermath` (def.l5) through mission states.
 */
export function levelFiveMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const def: MissionDef = {
    id: 'L5', l5: true, briefing: dialogue['L5.briefing'], anchors: {}, actors: {}, groups: {}, gates: {}, items: [],
    states: ['emerged', 'searching', 'accounted', 'at-metro', 'sheltered'], counters: [], checkpoints: [...l5.checkpoints],
    cinematics: {}, steps: [], finish: ['metro'], onStart: [{ kind: 'radio', id: 'L5.hours' }], onComplete: [],
  };
  const names = ['l5-cellar-in', 'l5-brace', 'l5-cellar-door', 'l5-out', 'l5-plaza', 'l5-metro-foot', 'kessler-cellar-door', 'metro-entrance', 'town-hall-steps',
    ...l5Survivors.flatMap(s => [`l5-ring-${s.key}`, `l5-hide-${s.key}`, `l5-out-${s.key}`])];
  for (const name of names) def.anchors[name] = resolve('D-FAIR', name);
  for (let i = 1; i <= 200; i++) { try { def.anchors[`refuge-door-${i}`] = resolve('D-FAIR', `refuge-door-${i}`); } catch { break; } }
  for (let i = 1; i <= 9; i++) { try { def.anchors[`edge-in-${i}`] = resolve('D-FAIR', `edge-in-${i}`); } catch { break; } }
  def.anchors['l5-brace'].radius = 1.3; def.anchors['l5-metro-foot'].radius = l5.metro.triggerM; def.anchors['l5-plaza'].radius = 6;
  for (const s of l5Survivors) def.anchors[`l5-ring-${s.key}`].radius = l5.survivors.reachM;
  const step = (id: string, text: string, anchor: string, complete: Trigger, start: ObjectiveDef['start'], type: ObjectiveDef['type'] = 'custom'): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, start, complete, fail: [] }; def.steps.push(s); return s;
  };
  const after = (...ids: string[]): ObjectiveDef['start'] => ({ kind: 'objectives', ids, mode: 'all' });
  const state = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  step('emerge', 'Unbar the cellar door', 'l5-brace', { kind: 'interact', anchor: 'l5-brace', seconds: l5.emerge.interactS }, { kind: 'start' }, 'interact');
  const look = step('look', 'Look for anyone still alive', 'l5-plaza', state('accounted'), { kind: 'state', key: 'searching', equals: true });
  look.onStart = [{ kind: 'radio', id: 'L5.search' }];
  const metro = step('metro', 'Lead the survivors to the metro station', 'metro-entrance', state('sheltered'), after('look'));
  metro.onStart = [{ kind: 'radio', id: 'L5.accounted' }]; metro.onComplete = [{ kind: 'radio', id: 'L5.twist' }];
  return def;
}
