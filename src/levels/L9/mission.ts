import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';

export function levelNineMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const names = ['crossing-start', 'outskirts', 'crash-approach', 'crash-impact', 'crash-wreck', 'crawl-start', 'crawl-fallback', 'crawl-end'];
  const anchors = Object.fromEntries(names.map(name => [name, resolve('D-CROSSING', name)]));
  anchors.outskirts.radius = 12;
  return {
    id: 'L9', l9: true, briefing: 'Cross the countryside toward the next city.',
    anchors,
    actors: {}, groups: {}, gates: {}, items: [], states: ['crash-started', 'crash-finished'], counters: [],
    checkpoints: ['crossing-start', 'outskirts-approach'], cinematics: {},
    steps: [
      { id: 'approach', type: 'custom', text: 'Drive toward the city', anchor: 'crash-approach', start: { kind: 'start' },
        complete: { kind: 'state', key: 'crash-started', equals: true }, fail: [] },
      { id: 'reach-outskirts', type: 'custom', text: 'Get clear of the wreck', anchor: 'crawl-end', start: { kind: 'objectives', ids: ['approach'], mode: 'all' },
        complete: { kind: 'all', triggers: [{ kind: 'state', key: 'crash-finished', equals: true }, { kind: 'volume', anchor: 'outskirts', edge: 'inside' }] }, fail: [] },
    ],
    finish: ['reach-outskirts'], onStart: [], onComplete: [],
  };
}
