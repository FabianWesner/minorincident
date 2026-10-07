import { dialogue } from '../../data/dialogue';
import type { Anchor, MissionDef, ObjectiveDef, Trigger } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/** Road centres and parking rings are separate from the pedestrian landmark doors. */
export function levelThreeMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const main = resolve('D-MAIN', 'player-start'), shop = resolve('D-SHOP', 'player-start'), civic = resolve('D-CIVIC', 'player-start');
  const at = (x: number, z: number, radius = 3): Anchor => ({ x, z, radius });
  const def: MissionDef = {
    id: 'L3', briefing: dialogue['L3.briefing'], deadline: { seconds: 720, retryGraceSeconds: 60 },
    anchors: { fuel: resolve('D-MAIN', 'fuel-shop-door'), sedan: at(main.x, main.z + 14), market: at(shop.x, shop.z - 4, 4),
      bypass: resolve('D-SHOP', 'market-door'), park: at(shop.x, civic.z - 4, 4), approach: at(civic.x - 8, civic.z - 4, 4),
      checkpoint: at(civic.x - 5, civic.z - 4, 3), barrier: at(civic.x - 2, civic.z - 4, 4), camp: resolve('D-CIVIC', 'hospital-door') },
    actors: { sedan: { anchor: 'sedan', kind: 'vehicle', faction: 'survivor', archetype: 'vehicle.sedan', hp: 300 } }, groups: { sedan: ['sedan'] },
    gates: {}, items: [], states: ['checkpoint-clear', 'collapsed', 'tutorial-spawned', 'market-spawned', 'park-spawned', 'checkpoint-spawned'], counters: ['runovers', 'smashed', 'max-infected'], checkpoints: ['car', 'checkpoint'],
    cinematics: {}, steps: [], finish: ['gates'], onStart: [{ kind: 'radio', id: 'L3.briefing' }], onComplete: [{ kind: 'cinematic', id: 'twist' }],
  };
  const step = (id: string, type: ObjectiveDef['type'], text: string, anchor: string, complete: Trigger, ids: string[] = [], mode: 'all' | 'any' = 'all'): ObjectiveDef => {
    const s: ObjectiveDef = { id, type, text, anchor, complete, start: ids.length ? { kind: 'objectives', ids, mode } : { kind: 'start' }, fail: [] };
    def.steps.push(s); return s;
  };
  step('car', 'interact', 'Get the sedan keys at the pumps', 'fuel', { kind: 'interact', anchor: 'fuel', seconds: .6 }).onComplete = [{ kind: 'spawn', group: 'sedan' }, { kind: 'checkpoint', id: 'car' }];
  for (const [id, anchor, text] of [['market-route', 'market', 'Supermarket road: park and bypass the Riot line on foot'], ['park-route', 'park', 'Park road: keep the car; watch for Sprinters']]) {
    step(id, 'drive', text, anchor, { kind: 'drive', actor: 'sedan', anchor, exit: id === 'market-route' }, ['car']).choice = 'route';
  }
  step('market-bypass', 'reach', 'Bypass the police line through the supermarket entrance', 'bypass', { kind: 'volume', anchor: 'bypass', edge: 'inside' }, ['market-route']);
  step('approach', 'drive', 'Drive to the Civic checkpoint and leave the car', 'approach', { kind: 'drive', actor: 'sedan', anchor: 'approach', exit: true }, ['market-bypass', 'park-route'], 'any').onComplete = [{ kind: 'checkpoint', id: 'checkpoint' }];
  step('checkpoint', 'killAll', 'Clear the overrun checkpoint; explosions break the heavy barrier', 'checkpoint', { kind: 'state', key: 'checkpoint-clear', equals: true }, ['approach']);
  step('gates', 'reach', 'Reach the Civic Center gate before access closes', 'camp', { kind: 'volume', anchor: 'camp', edge: 'inside' }, ['checkpoint']);
  const camp = def.anchors.camp;
  def.cinematics.twist = { seconds: 20, caption: dialogue['L3.twist'], position: [camp.x + 18, 22, camp.z + 18], target: [camp.x, 0, camp.z], actions: [{ kind: 'radio', id: 'L3.twist' }] };
  return def;
}
