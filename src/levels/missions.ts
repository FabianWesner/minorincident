import { levelTenMission } from './L10/mission';
import { levelNineMission } from './L9/mission';
import { levelEightMission } from './L8/mission';
import { levelSixMission } from './L6/mission';
import { levelFiveMission } from './L5/mission';
import { levelFourMission } from './L4/mission';
import { levelThreeMission } from './L3/mission';
import { levelTwoMission } from './L2/mission';
import { dialogue } from '../data/dialogue';
import type { DistrictId } from './districts/types';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import type { Anchor, MissionDef, ObjectiveDef, ObjectiveType, Trigger } from '../sim/missions/types';

export const missionIds = ['L1','L2','L3','L4','L5','L6','L8','L9','L10'] as const;
export type MissionId = typeof missionIds[number];
/** Campaign graph authoring, distinct from encounter tuning and bots owned by E19–E24.
 * Coordinates come from loaded district GLB anchors; no duplicate placement coordinates. */
export function campaignMission(id: MissionId, resolve: (district: DistrictId, anchor: string) => Anchor): MissionDef {
  if (id === 'L10') return levelTenMission(name => name === 'cure-crash' ? resolve('D-CROSSING', 'crawl-end') : undefined);
  if (id === 'L9') return levelNineMission(resolve);
  if (id === 'L8') return levelEightMission(resolve);
  if (id === 'L6') return levelSixMission(resolve);
  if (id === 'L5') return levelFiveMission(resolve);
  if (id === 'L4') return levelFourMission(resolve);
  if (id === 'L3') return levelThreeMission(resolve);
  if (id === 'L2') return levelTwoMission(resolve);
  const def: MissionDef = { id, briefing: dialogue[`${id}.briefing`], anchors: {}, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: [], cinematics: {}, steps: [], finish: [], onStart: [{ kind: 'radio', id: `${id}.briefing` }], onComplete: [{ kind: 'cinematic', id: 'twist' }] };
  const anchor = (key: string, district: DistrictId, name: string) => { def.anchors[key] = resolve(district, name); return key; };
  const step = (key: string, type: ObjectiveType, text: string, at: string, complete: Trigger, after?: string[]): ObjectiveDef => {
    const prev = after ?? (def.steps.length ? [def.steps[def.steps.length - 1].id] : []);
    const s: ObjectiveDef = { id: key, type, text, anchor: at, start: prev.length ? { kind: 'objectives', ids: prev, mode: 'all' } : { kind: 'start' }, complete, fail: [] };
    def.steps.push(s); return s;
  };
  const reach = (key: string, text: string, at: string, after?: string[]) => step(key, 'reach', text, at, { kind: 'volume', anchor: at, edge: 'inside' }, after);
  const interact = (key: string, text: string, at: string, seconds = 0.6, after?: string[]) => step(key, 'interact', text, at, { kind: 'interact', anchor: at, seconds }, after);
  let end: string;
  switch (id) {
    case 'L1': {
      // L1 v2 (specs/epic-19 section 3): courier job, hand-over, accident, systemic spread, bat, fire station.
      def.l1 = true;
      for (const name of ['player-start', 'parcel-counter', 'lab-door', 'lab-gate', 'lab-exit-front', 'lab-exit-side', 'lab-exit-window', 'lab-smoke-vent', 'lab-smoke-window', 'lab-tech-spawn', 'lab-bike-rack', 'garage-door', 'garage-bat', 'fire-bay-door', 'fire-bay-trigger', 'elm-horde-entry', ...[1, 2, 3, 4, 5, 6].map(i => `edge-in-${i}`)]) anchor(name, 'D-GROVE', name);
      // Entire completion volume is inside the open doorway, never on the apron.
      def.anchors['fire-bay-trigger'].radius = .5;
      def.onComplete = [{ kind: 'radio', id: 'L1.twist' }];
      // Doors that director infected emerge from (spec PO request 2026-10-07).
      for (let i = 1; i <= 80; i++) { try { anchor(`refuge-door-${i}`, 'D-GROVE', `refuge-door-${i}`); } catch { break; } }
      def.items.push('parcel', 'bat'); def.states.push('delivered', 'exited', 'away', 'safe'); def.checkpoints.push('accident', 'bat');
      def.gates['fire-shutter'] = { anchor: 'fire-bay-door', open: true };
      const pickup = interact('pickup', 'Pick up the package at the courier depot', 'parcel-counter', 1);
      pickup.onComplete = [{ kind: 'grant', item: 'parcel' }, { kind: 'radio', id: 'L1.pickedUp' }];
      // Completes when the technician has taken the box and walked back in (LevelOneOutbreak drives `delivered`).
      step('deliver', 'interact', 'Deliver the package to the Medical Annex', 'lab-door', { kind: 'state', key: 'delivered', equals: true });
      // Beat 5 leaves no objective for 4 to 6 s; the objective below starts when the infected exit.
      // PO feedback 2026-10-07: the weapon objective and its marker appear at once after the exits (no gate), the world stays live.
      const escape = step('escape', 'custom', 'Get away from the facility', 'garage-door', { kind: 'state', key: 'exited', equals: true }, []);
      escape.start = { kind: 'state', key: 'exited', equals: true }; escape.onStart = [{ kind: 'radio', id: 'L1.bang' }];
      const bat = interact('weapon', 'Find something to defend yourself', 'garage-bat', 0.6);
      // The marker sits at the garage door (visible from the street), the interaction itself stays at the bench.
      bat.onStart = [{ kind: 'marker', anchor: 'garage-door' }];
      bat.onComplete = [{ kind: 'grant', item: 'bat' }, { kind: 'checkpoint', id: 'bat' }];
      // PO: the courier walks into the bay herself; no cinematic, auto-walk or input lock.
      const fire = reach('firestation', 'Get inside the fire station', 'fire-bay-trigger');
      fire.onStart = [{ kind: 'radio', id: 'L1.fire' }];
      fire.onComplete = [{ kind: 'state', key: 'safe', value: true }, { kind: 'gate', id: 'fire-shutter', open: false }];
      end = fire.id; break;
    }

  }
  def.finish = [end]; const at = def.anchors[def.steps.at(-1)!.anchor];
  if (id !== 'L1') def.cinematics.twist = { seconds: 20, caption: dialogue[`${id}.twist`], position: [at.x+18,22,at.z+18], target: [at.x,0,at.z], actions: [{ kind: 'radio', id: `${id}.twist` }] };
  return def;
}
/** Missing loaded anchors are authoring errors, never silently replaced with coordinates. */
export function resolveCampaignMission(id: MissionId, world: DistrictWorld): MissionDef {
  if (id === 'L10') return levelTenMission(name => {
    const cure = world.districts.find(d => String(d.id) === 'D-CURE');
    const district = cure ?? (name === 'cure-crash' ? world.districts.find(d => d.id === 'D-CROSSING') : undefined);
    const at = district?.layout.anchors[cure ? name : 'crawl-end'];
    return district && at ? { x: at.position[0] + district.origin[0], z: at.position[2] + district.origin[1], y: at.position[1], radius: 2 } : undefined;
  });
  return campaignMission(id, (district, name) => {
    const d = world.districts.find(d => d.id === district), a = d?.layout.anchors[name];
    if (!d || !a) throw new Error(`Missing mission anchor: ${district}/${name}`);
    return { x: a.position[0]+d.origin[0], z: a.position[2]+d.origin[1], radius: 2, ...a.position[1] ? { y: a.position[1] } : {} };
  });
}
