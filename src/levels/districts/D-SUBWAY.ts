import { anchor, type DistrictGameplay } from './types';
export const gameplay: DistrictGameplay = {
  id: 'D-SUBWAY', playerStart: anchor('player-start'), spawns: [], spawnVolumes: [], triggers: [],
  objectives: [{ id: 'exit', position: anchor('night-exit') }], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [],
};
