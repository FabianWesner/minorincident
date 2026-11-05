import { dialogue } from '../../data/dialogue';
import { l3, l3Anchors } from '../../data/l3';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/**
 * L3 "The Police Collapse" objective graph (E21 section 4): armory -> defend the station -> fallback -> reach the army
 * checkpoint. Beats are driven by `LevelThreeCollapse` (def.l3) through mission states; the station attack ends by the
 * scripted fallback (the yard cannot be held), never by clearing it. No fail timer, no reward screen: crossing the army
 * rendezvous ring completes the level and the campaign continues into L4.
 */
export function levelThreeMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const def: MissionDef = {
    id: 'L3', l3: true, briefing: dialogue['L3.briefing'], anchors: {}, actors: {}, groups: {}, gates: {}, items: ['handgun'],
    states: ['attack', 'fallback', 'crossed'], counters: [], checkpoints: [...l3.checkpoints],
    cinematics: {}, steps: [], finish: ['checkpoint'], onStart: [{ kind: 'radio', id: 'L3.briefing' }], onComplete: [],
  };
  for (const name of Object.keys(l3Anchors)) def.anchors[name] = resolve('D-CORRIDOR', name);
  for (let i = 1; i <= 200; i++) { try { def.anchors[`refuge-door-${i}`] = resolve('D-CORRIDOR', `refuge-door-${i}`); } catch { break; } }
  for (let i = 1; i <= 9; i++) { try { def.anchors[`edge-in-${i}`] = resolve('D-CORRIDOR', `edge-in-${i}`); } catch { break; } }
  def.anchors['l3-armory'].radius = 1.2; def.anchors['l3-zone'].radius = .9;
  const step = (id: string, type: ObjectiveDef['type'], text: string, anchor: string, complete: Trigger, start: ObjectiveDef['start']): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, start, complete, fail: [] }; def.steps.push(s); return s;
  };
  const state = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  const armory = step('armory', 'interact', 'Take a handgun from the armory', 'l3-armory', { kind: 'interact', anchor: 'l3-armory', seconds: l3.armory.interactS }, { kind: 'start' });
  armory.onComplete = [{ kind: 'grant', item: 'handgun' }, { kind: 'checkpoint', id: 'armory' }];
  step('defend', 'custom', 'Help defend the station', 'l3-yard', state('fallback'), { kind: 'state', key: 'attack', equals: true }).waypoint = false;
  step('checkpoint', 'reach', 'Get inside the army checkpoint', 'l3-zone', state('crossed'), { kind: 'state', key: 'fallback', equals: true });
  return def;
}
