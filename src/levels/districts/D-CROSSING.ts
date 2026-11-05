import { anchor, type DistrictGameplay } from './types';
import { crossing } from '../L9/district';

/** Open greybox. Encounter and campaign ownership arrive in L9-E1/S1/S2. */
export const gameplay: DistrictGameplay = {
  id: 'D-CROSSING', playerStart: anchor('crossing-start'),
  spawns: [], spawnVolumes: [],
  triggers: [{ id: 'outskirts', position: anchor('outskirts'), radius: 12 }],
  objectives: [{ id: 'reach-outskirts', position: anchor('outskirts') }],
  interactables: [], civilianRoutes: [], safePoints: [anchor('crossing-start'), anchor('outskirts')],
  photoSpots: [
    ['l9-armored-start', 'crossing-start'], ['l9-road-fork', 'road-fork'],
    ['l9-countryside-route', 'countryside'], ['l9-dry-shortcut', 'dry-shortcut'],
    ['l9-long-sightline', crossing.viewpoints[1].id], ['l9-city-outskirts', 'outskirts'],
    ['l9-chunk-seam', 'chunk-seam'],
  ].map(([name, target]) => ({ name, target: anchor(target), offset: [35, 42, 35] })),
  decay: [],
};
