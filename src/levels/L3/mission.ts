import { dialogue } from '../../data/dialogue';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/** Road centres and parking rings are separate from the pedestrian landmark doors. */
export function levelThreeMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const main = resolve('D-MAIN', 'player-start'), shop = resolve('D-SHOP', 'player-start'), civic = resolve('D-CIVIC', 'player-start');
  const at = (x: number, z: number, radius = 3): Anchor => ({ x, z, radius });
  const def: MissionDef = {
    id: 'L3', briefing: dialogue['L3.briefing'], deadline: { seconds: 720, retryGraceSeconds: 60 },
    anchors: { fuel: resolve('D-MAIN', 'fuel-shop-door'), sedan: at(main.x, main.z + 14), market: at(shop.x+14, shop.z - 4, 3),
      bypass: resolve('D-SHOP', 'market-door'), 'camp-entry': at(civic.x+5, civic.z+6, 2), park: at(shop.x, civic.z - 22, 3), approach: at(civic.x - 8, civic.z - 4, 4),
      checkpoint: at(civic.x - 5, civic.z - 4, 3), barrier: at(civic.x - 2, civic.z - 4, 4), camp: resolve('D-CIVIC', 'safe-point'),
      forecourt: at(main.x, main.z+16, 8), pharmacy: resolve('D-SHOP', 'pharmacy-door'), shelter: resolve('D-PARK', 'lodge-door'),
      'market-loading': at(shop.x, shop.z-4, 9), 'park-loading': at(shop.x, civic.z-18, 9), 'checkpoint-hold': at(civic.x-10, civic.z-4, 9),
      hospital: resolve('D-CIVIC', 'hospital-door') },
    actors: { sedan: { anchor: 'sedan', kind: 'vehicle', faction: 'survivor', archetype: 'vehicle.sedan', hp: 300 } }, groups: { sedan: ['sedan'] },
    gates: { perimeter: { anchor: 'camp-entry', open: false } }, items: [], states: ['checkpoint-clear', 'collapsed', 'tutorial-spawned', 'market-spawned', 'park-spawned', 'checkpoint-spawned'], counters: ['runovers', 'smashed', 'max-infected', 'forecourt-waves', 'market-cover-waves', 'park-cover-waves', 'checkpoint-cover-waves'], checkpoints: ['car', 'checkpoint'],
    cinematics: {}, steps: [], finish: ['gates'], onStart: [{ kind: 'radio', id: 'L3.briefing' }], onComplete: [{ kind: 'cinematic', id: 'twist' }],
  };
  const step = (id: string, type: ObjectiveDef['type'], text: string, anchor: string, complete: Trigger, ids: string[] = [], mode: 'all' | 'any' = 'all'): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, complete, start: ids.length ? { kind: 'objectives', ids, mode } : { kind: 'start' }, fail: [] };
    def.steps.push(s); return s;
  };
  const cover = (id: string, text: string, anchor: string, seconds: number, after: string[] = []): void => {
    def.states.push(`${id}-clear`);
    step(id, 'defend', text, anchor, { kind: 'all', triggers: [{ kind: 'timer', seconds }, { kind: 'state', key: `${id}-clear`, equals: true }, { kind: 'volume', anchor, edge: 'inside' }] }, after);
  };
  cover('forecourt', 'Protect the stranded family while they escape the fuel station', 'forecourt', 35);
  step('car', 'interact', 'Get the sedan keys at the pumps', 'fuel', { kind: 'interact', anchor: 'fuel', seconds: .6 }, ['forecourt']).onComplete = [{ kind: 'spawn', group: 'sedan' }, { kind: 'checkpoint', id: 'car' }, { kind: 'radio', id: 'L3.drive' }];
  for (const [id, anchor, text] of [['market-route', 'market', 'Supermarket road: park and bypass the Riot line on foot'], ['park-route', 'park', 'Park road: keep the car; watch for Sprinters']]) {
    step(id, 'drive', text, anchor, { kind: 'drive', actor: 'sedan', anchor, exit: id === 'market-route' }, ['car']).choice = 'route';
  }
  step('market-bypass', 'reach', 'Bypass the police line through the supermarket entrance', 'bypass', { kind: 'volume', anchor: 'bypass', edge: 'inside' }, ['market-route']);
  step('market-supplies', 'interact', 'Collect first-aid supplies from the pharmacy across the lot', 'pharmacy', { kind: 'interact', anchor: 'pharmacy', seconds: 2 }, ['market-bypass']);
  cover('market-cover', 'Cover the supermarket evacuees as they load supplies', 'market-loading', 90, ['market-supplies']);
  step('park-rescue', 'interact', 'Leave the car and help the evacuees at the park shelter', 'shelter', { kind: 'interact', anchor: 'shelter', seconds: 2 }, ['park-route']);
  cover('park-cover', 'Protect the park evacuees as they cross the blocked footpath', 'park-loading', 90, ['park-rescue']);
  step('approach', 'drive', 'Drive to the Civic checkpoint and leave the car', 'approach', { kind: 'drive', actor: 'sedan', anchor: 'approach', exit: true }, ['market-cover', 'park-cover'], 'any').onComplete = [{ kind: 'checkpoint', id: 'checkpoint' }];
  def.steps.find(s => s.id === 'approach')!.onStart = [{ kind: 'radio', id: 'L3.checkpoint' }];
  step('checkpoint', 'killAll', 'Clear the overrun checkpoint; explosions break the heavy barrier', 'checkpoint', { kind: 'state', key: 'checkpoint-clear', equals: true }, ['approach']);
  cover('checkpoint-cover', 'Hold the police checkpoint while the hospital patients evacuate', 'checkpoint-hold', 120, ['checkpoint']);
  def.actors.patient = { anchor: 'hospital', kind: 'escort', faction: 'escort', archetype: 'npc.escort', hp: 300 }; def.groups.patient = ['patient'];
  step('patient', 'interact', 'Collect the last patient from the hospital entrance', 'hospital', { kind: 'interact', anchor: 'hospital', seconds: 2 }, ['checkpoint-cover']).onComplete = [{ kind: 'spawn', group: 'patient' }];
  const escort = step('gates', 'escort', 'Escort the patient through the Civic Center gate before access closes', 'camp', { kind: 'escort', actor: 'patient', anchor: 'camp' }, ['patient']);
  escort.fail = [{ trigger: { kind: 'dead', actor: 'patient' }, reason: 'escort-died' }];
  escort.onStart = [{ kind: 'gate', id: 'perimeter', open: true }, { kind: 'radio', id: 'L3.gates' }];
  const camp = def.anchors.camp;
  def.cinematics.twist = { seconds: 20, caption: dialogue['L3.twist'], position: [camp.x + 18, 22, camp.z + 18], target: [camp.x, 0, camp.z], actions: [{ kind: 'gate', id: 'perimeter', open: false }, { kind: 'radio', id: 'L3.twist' }] };
  return def;
}
