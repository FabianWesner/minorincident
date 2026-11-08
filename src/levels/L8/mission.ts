import { dialogue } from '../../data/dialogue';
import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

export function levelEightMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const anchors = Object.fromEntries(['player-start', 'arrival', 'exit', 'zoo-gate', ...[1, 2, 3, 4].map(n => `tunnel-outlet-${n}`), ...['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].map(s => `animal-${s}`)].map(name => [name, resolve('D-ZOO', name === 'zoo-gate' ? 'zoo-entrance' : name)]));
  return {
    id: 'L8', l8: true, briefing: dialogue['L8.briefing'],
    anchors, actors: {}, groups: {}, gates: {}, items: [], states: ['breached', 'player-boarded', 'aboard', 'apc-destroyed'], counters: [],
    checkpoints: ['sanctuary', 'breach', 'escape-route'], cinematics: {},
    steps: [{ id: 'sanctuary', type: 'custom', text: 'Lead the group to the zoo gate', anchor: 'zoo-gate', waypoint: true,
      start: { kind: 'start' }, complete: { kind: 'state', key: 'breached', equals: true }, fail: [] },
    { id: 'escape', type: 'custom', text: 'Lead the group to the armored vehicle', anchor: 'exit', waypoint: true,
      start: { kind: 'objectives', ids: ['sanctuary'], mode: 'all' }, complete: { kind: 'state', key: 'player-boarded', equals: true }, fail: [{ trigger: { kind: 'state', key: 'apc-destroyed', equals: true }, reason: 'target-destroyed' }] },
    { id: 'depart', type: 'custom', text: 'Wait for everyone to board the armored vehicle', anchor: 'exit', waypoint: false,
      start: { kind: 'objectives', ids: ['escape'], mode: 'all' }, complete: { kind: 'state', key: 'aboard', equals: true }, fail: [{ trigger: { kind: 'state', key: 'apc-destroyed', equals: true }, reason: 'target-destroyed' }] }],
    finish: ['depart'], onStart: [], onComplete: [],
  };
}
