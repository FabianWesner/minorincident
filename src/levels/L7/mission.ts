import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

/** Checkpoints use the ordinary mission capture/retry path; encounters and the bus keep owning gameplay. */
export function levelSevenMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const anchors = Object.fromEntries(['l7-night-exit', 'l7-rocket', 'l7-corridor-east', 'l7-corridor-west', 'l7-bus-boarding'].map(name => [name, resolve('D-FAIR', name)]));
  anchors['l7-corridor-east'].radius = 6;
  anchors['l7-corridor-west'].radius = 12;
  return {
    id: 'L7', briefing: 'Bring the survivors through the ruined city to the evacuation bus.',
    anchors, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [],
    checkpoints: ['night-exit', 'rocket', 'corridor'], cinematics: {},
    onStart: [{ kind: 'checkpoint', id: 'night-exit' }], onComplete: [], finish: ['departure'],
    steps: [
      { id: 'rocket', type: 'custom', text: 'Recover the rocket launcher beside the exit', anchor: 'l7-rocket',
        start: { kind: 'start' }, complete: { kind: 'event', type: 'l7.armed', count: 1 }, fail: [],
        onComplete: [{ kind: 'checkpoint', id: 'rocket' }] },
      { id: 'corridor', type: 'reach', text: 'Bring the group to the evacuation corridor', anchor: 'l7-corridor-east',
        start: { kind: 'objectives', ids: ['rocket'], mode: 'all' }, complete: { kind: 'any', triggers: ['l7-corridor-east', 'l7-corridor-west'].map(anchor => ({ kind: 'volume', anchor, edge: 'inside' })) }, fail: [],
        onComplete: [{ kind: 'checkpoint', id: 'corridor' }] },
      { id: 'departure', type: 'custom', text: 'Get everyone aboard the bus', anchor: 'l7-bus-boarding',
        start: { kind: 'objectives', ids: ['corridor'], mode: 'all' }, complete: { kind: 'event', type: 'l7.departed', count: 1 }, fail: [] },
    ],
  };
}
