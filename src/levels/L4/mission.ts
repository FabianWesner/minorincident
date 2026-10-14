import { l4AlphaEmergence, l4BreakableLine } from './layout';
import { dialogue } from '../../data/dialogue';
import { l4, l4Anchors } from '../../data/l4';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/**
 * L4 "The Safe City Falls" objective graph (E22 section 4): ride -> quartermaster (machine gun) -> hold the plaza -> run to the
 * cellar -> bar the cellar door. Beats are driven by `LevelFourWar` (def.l4) through mission states; the line breaks by its first-of
 * collapse director (three lines lost at fixed beats, then "Fall back!"), never by clearing the plaza. No fail timer, no reward screen:
 * the barred cellar door completes the level (after the battle has gone on above for a while) and the campaign continues into L5.
 */
export function levelFourMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const def: MissionDef = {
    id: 'L4', l4: true, briefing: dialogue['L4.briefing'], anchors: {}, actors: {}, groups: {}, gates: {}, items: ['machine-gun'],
    states: ['arrived', 'gun', 'turned', 'line-broken', 'descended', 'barred', 'done'], counters: [], checkpoints: [...l4.checkpoints],
    cinematics: {}, steps: [], finish: ['wait'], onStart: [{ kind: 'radio', id: 'L4.briefing' }], onComplete: [],
  };
  // l4-collapse camera beats (<= 2 s, the sim pauses; skippable after 0.5 s): the overrun line 1 and the swarmed tank.
  const beat = (x: number, z: number, caption: string) => ({ seconds: l4.director.cameraS, caption, position: [x + 15, 19, z + 15] as [number, number, number], target: [x, 0, z] as [number, number, number], actions: [] });
  def.cinematics['l4-line-1'] = beat(-29, -4, dialogue['L4.line1']);
  def.cinematics['l4-armor'] = beat(-19, 20, dialogue['L4.armor']);
  for (const name of [...l4AlphaEmergence.map(e => e.anchor), ...l4BreakableLine.flatMap(line => Object.values(line.anchors))]) def.anchors[name] = resolve('D-FAIR', name);
  for (const name of Object.keys(l4Anchors)) def.anchors[name] = resolve('D-FAIR', name);
  for (const name of ['kessler-cellar-door', 'metro-entrance', 'town-hall-steps']) def.anchors[name] = resolve('D-FAIR', name);
  for (let i = 1; i <= 200; i++) { try { def.anchors[`refuge-door-${i}`] = resolve('D-FAIR', `refuge-door-${i}`); } catch { break; } }
  for (let i = 1; i <= 9; i++) { try { def.anchors[`edge-in-${i}`] = resolve('D-FAIR', `edge-in-${i}`); } catch { break; } }
  for (const name of ['l4-cellar-in']) def.anchors[name] = resolve('D-FAIR', name);
  def.anchors['l4-quartermaster'].radius = 1.4; def.anchors['l4-cellar-door'].radius = 1.4; def.anchors['l4-brace'].radius = 1.3; def.anchors['l4-plaza'].radius = 6;
  const step = (id: string, type: ObjectiveDef['type'], text: string, anchor: string, complete: Trigger, start: ObjectiveDef['start']): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, start, complete, fail: [] }; def.steps.push(s); return s;
  };
  const after = (...ids: string[]): ObjectiveDef['start'] => ({ kind: 'objectives', ids, mode: 'all' });
  const state = (key: string): Trigger => ({ kind: 'state', key, equals: true });
  step('ride', 'custom', 'Ride into Fairhaven with the convoy', 'l4-plaza', state('arrived'), { kind: 'start' });
  const qm = step('quartermaster', 'interact', 'Report to the quartermaster', 'l4-quartermaster', { kind: 'interact', anchor: 'l4-quartermaster', seconds: l4.calm.issueS }, after('ride'));
  qm.onComplete = [{ kind: 'grant', item: 'machine-gun' }, { kind: 'checkpoint', id: 'arrival' }];
  step('hold', 'custom', 'Hold the plaza with the army', 'l4-plaza', state('line-broken'), { kind: 'state', key: 'turned', equals: true }).waypoint = false;
  step('hide', 'interact', 'Run to the cellar', 'l4-cellar-door', { kind: 'interact', anchor: 'l4-cellar-door', seconds: l4.cellar.interactS }, { kind: 'state', key: 'line-broken', equals: true });
  step('bar', 'interact', 'Bar the cellar door', 'l4-brace', { kind: 'interact', anchor: 'l4-brace', seconds: l4.cellar.barS }, after('hide'));
  step('wait', 'custom', 'Stay down', 'l4-brace', state('done'), after('bar')).waypoint = false;
  return def;
}
