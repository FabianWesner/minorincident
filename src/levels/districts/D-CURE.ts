import { anchor, type DistrictGameplay } from './types';

/** R1–R4 layout seams; encounter and weapon transactions remain with E1/S1. */
export const gameplay: DistrictGameplay = {
  id: 'D-CURE', playerStart: anchor('player-start'), spawns: [], spawnVolumes: [],
  triggers: [{ id: 'r1-r2-seam', position: anchor('r1-r2-seam'), radius: 6 }, { id: 'r2-r3-seam', position: anchor('r2-r3-seam'), radius: 6 }, { id: 'r3-r4-seam', position: anchor('r3-r4-seam'), radius: 6 }, { id: 'r4-r5-seam', position: anchor('r4-r5-seam'), radius: 6 }],
  objectives: [{ id: 'residential-security', position: anchor('cure-residential') }, { id: 'industrial-barricade', position: anchor('cure-industrial') }, { id: 'military-post', position: anchor('cure-military') }, { id: 'research-approach', position: anchor('exit') }],
  interactables: [{ id: 'police-pickup', position: anchor('police-pickup') }, { id: 'shotgun-pickup', position: anchor('shotgun-pickup') }, { id: 'mg-pickup', position: anchor('mg-pickup') }],
  civilianRoutes: [], safePoints: [anchor('cure-crash'), anchor('cure-residential'), anchor('police-medkit'), anchor('cure-industrial'), anchor('industrial-medkit'), anchor('cure-military'), anchor('military-medkit')],
  photoSpots: [
    ['l10-crash-axe', 'cure-crash'], ['l10-residential-security', 'cure-residential'],
    ['l10-region-seam', 'r1-r2-seam'], ['l10-residential-detour', 'residential-detour'],
    ['l10-residential-blocked-street', 'residential-blocked-street'], ['l10-mega-viewpoint', 'mega-introduction'],
    ['l10-industrial-barricade', 'cure-industrial'], ['l10-industrial-yard', 'industrial-yard'],
    ['l10-industrial-blocked-yard', 'industrial-blocked-yard'], ['l10-industrial-service', 'industrial-service'],
    ['l10-military-post', 'cure-military'], ['l10-military-breach', 'military-breach'],
    ['l10-military-blocked-checkpoint', 'military-blocked-checkpoint'], ['l10-research-approach', 'cure-research-entry'], ['l10-military-motor-pool', 'military-motor-pool'],
    ['l10-industrial-military-seam', 'r3-r4-seam'], ['l10-military-research-seam', 'r4-r5-seam'],
  ].map(([name, target]) => ({ name, target: anchor(target), offset: [20, 24, 20] })),
  decay: [],
};
