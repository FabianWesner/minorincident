import { l6, l6PhotoSpots } from '../../data/l6';
import type { Anchor, MissionDef } from '../../sim/missions/types';
import type { DistrictId } from '../districts/types';
export function levelSixMission(resolve: (district: DistrictId, name: string) => Anchor): MissionDef {
  const def: MissionDef = {
    id: 'L6', l6: true, briefing: 'Lakeshore shelter. Rest, share water, and let the medic dress the injured. Pick up the headlamp by the lantern. Marcus watches the sealed stair.',
    anchors: {}, actors: {}, groups: {}, gates: {}, items: ['headlamp'], states: ['breached', 'abandoned', 'platform', 'exited'], counters: [],
    checkpoints: [...l6.checkpoints], cinematics: {}, steps: [], finish: ['exit'], onStart: [], onComplete: [{ kind: 'cinematic', id: 'night' }],
  };
  for (const name of ['player-start', 'maintenance-a', 'maintenance-b', 'tunnel-start', 'mid-tunnel', 'exit-platform', 'night-exit', ...l6PhotoSpots.map(([n]) => `photo-${n}`)]) def.anchors[name] = resolve('D-SUBWAY', name);
  const ids = ['shelter', 'stop', 'retreat', 'exit'];
  const states = ['breached', 'abandoned', 'platform', 'exited'];
  const texts = ['Look around the shelter', 'Stop the infected', 'Cover the retreat through the tunnel', 'Bring the survivors into the night'];
  const anchors = ['player-start', 'maintenance-a', 'exit-platform', 'night-exit'];
  def.steps = ids.map((id, i) => ({ id, type: 'custom', text: texts[i], anchor: anchors[i], waypoint: i >= 2, start: i ? { kind: 'objectives', ids: [ids[i - 1]], mode: 'all' } : { kind: 'start' }, complete: { kind: 'state', key: states[i], equals: true }, fail: [] }));
  def.cinematics.night = { seconds: 6, caption: l6.caption, position: [299, 39, 42], target: [273, 3.9, 16], actions: [] };
  return def;
}
