import { anchor, type DistrictGameplay } from './types';

/** R1/R2 layout seams; encounter and weapon transactions remain with E1/S1. */
export const gameplay: DistrictGameplay = {
  id: 'D-CURE', playerStart: anchor('player-start'), spawns: [], spawnVolumes: [],
  triggers: [{ id: 'r1-r2-seam', position: anchor('r1-r2-seam'), radius: 6 }, { id: 'r2-r3-seam', position: anchor('r2-r3-seam'), radius: 6 }],
  objectives: [{ id: 'residential-security', position: anchor('cure-residential') }, { id: 'industrial-approach', position: anchor('exit') }],
  interactables: [{ id: 'police-pickup', position: anchor('police-pickup') }],
  civilianRoutes: [], safePoints: [anchor('cure-crash'), anchor('cure-residential'), anchor('police-medkit')],
  photoSpots: [
    ['l10-crash-axe', 'cure-crash'], ['l10-residential-security', 'cure-residential'],
    ['l10-region-seam', 'r1-r2-seam'], ['l10-residential-detour', 'residential-detour'],
    ['l10-residential-blocked-street', 'residential-blocked-street'], ['l10-mega-viewpoint', 'mega-introduction'],
  ].map(([name, target]) => ({ name, target: anchor(target), offset: [20, 24, 20] })),
  decay: [],
};
