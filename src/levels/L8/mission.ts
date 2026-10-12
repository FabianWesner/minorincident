import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

export function levelEightMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const anchors = Object.fromEntries(['player-start', 'arrival', 'exit', ...[1, 2, 3, 4].map(n => `tunnel-outlet-${n}`), ...['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].map(s => `animal-${s}`)].map(name => [name, resolve('D-ZOO', name)]));
  return {
    id: 'L8', l8: true, briefing: 'The zoo is secure. Take a breath. Explore the sanctuary.',
    anchors, actors: {}, groups: {}, gates: {}, items: [], states: ['breached', 'aboard'], counters: [],
    checkpoints: ['sanctuary', 'breach', 'escape-route'], cinematics: {},
    steps: [{ id: 'escape', type: 'custom', text: 'Bring the survivors to the armored vehicle and board', anchor: 'exit', waypoint: true,
      start: { kind: 'state', key: 'breached', equals: true }, complete: { kind: 'state', key: 'aboard', equals: true }, fail: [] }],
    finish: ['escape'], onStart: [], onComplete: [],
  };
}
