import { dialogue } from '../../data/dialogue';
import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

export function levelEightMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const anchors = Object.fromEntries(['player-start', 'arrival', 'exit', 'zoo-gate', ...[1, 2, 3, 4].map(n => `tunnel-outlet-${n}`), ...['lion', 'gorilla', 'elephant', 'zebra', 'flamingo', 'monkey'].map(s => `animal-${s}`)].map(name => [name, resolve('D-ZOO', name === 'zoo-gate' ? 'zoo-entrance' : name)]));
  anchors['central-plaza'] = { x: 0, z: 0, radius: 6 };
  anchors['l8-route'] = { x: 0, z: 0, radius: 2 };
  return {
    id: 'L8', l8: true, briefing: dialogue['L8.briefing'],
    anchors, actors: {}, groups: {}, gates: {}, items: [], states: ['breached', 'player-boarded', 'aboard', 'apc-destroyed', 'hale-fallen', 'hale-keys', 'elephant-fallen', 'elephant-turning', 'reyes-fallback', 'departed', 'arena-flamingo', 'arena-flamingo-cleared', 'arena-zebra', 'arena-zebra-cleared', 'arena-monkey', 'arena-monkey-cleared', 'arena-lion', 'arena-lion-cleared', 'arena-gorilla', 'arena-gorilla-cleared', 'arena-elephant', 'arena-elephant-cleared'], counters: [],
    checkpoints: ['sanctuary', 'breach', 'sealed', 'escape-route', 'arena-flamingo', 'arena-lion', 'arena-monkey', 'arena-zebra', 'arena-gorilla', 'arena-elephant', 'cleared-flamingo', 'cleared-lion', 'cleared-monkey', 'cleared-zebra', 'cleared-gorilla'], cinematics: {
      'l8-hale': { seconds: 1.5, caption: dialogue['L8.hale-dying'], position: [108, 12, 89], target: [88, 1, 70], actions: [] },
    },
    steps: [{ id: 'sanctuary', type: 'custom', text: 'Follow Nadia to the central plaza', anchor: 'central-plaza', waypoint: true,
      start: { kind: 'start' }, complete: { kind: 'all', triggers: [{ kind: 'state', key: 'breached', equals: true }, { kind: 'volume', anchor: 'central-plaza', edge: 'inside' }] }, fail: [] },
    { id: 'escape', type: 'custom', text: 'Lead the group to the armored vehicle', anchor: 'exit', waypoint: false,
      start: { kind: 'objectives', ids: ['sanctuary'], mode: 'all' }, complete: { kind: 'state', key: 'player-boarded', equals: true }, fail: [{ trigger: { kind: 'state', key: 'apc-destroyed', equals: true }, reason: 'target-destroyed' }] },
    { id: 'depart', type: 'custom', text: 'Cover the survivors while they board', anchor: 'exit', waypoint: false,
      start: { kind: 'objectives', ids: ['escape'], mode: 'all' }, complete: { kind: 'state', key: 'departed', equals: true }, fail: [{ trigger: { kind: 'state', key: 'apc-destroyed', equals: true }, reason: 'target-destroyed' }] }],
    finish: ['depart'], onStart: [], onComplete: [],
  };
}
