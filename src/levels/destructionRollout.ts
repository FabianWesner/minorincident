import type { DistrictLayout } from './districts/types';

const civilianCar = (assetId: string): boolean =>
  /^(veh\.(?:sedan|suv|pickup|wreck)(?:-|$))/.test(assetId);

/** Apply the reviewed level opt-ins before district colliders and the sim destruction owner are built. */
export function destructionRollout(layouts: DistrictLayout[], level: string): DistrictLayout[] {
  if (!['L1', 'L2', 'L3', 'L4', 'L5', 'L9'].includes(level)) return layouts;
  return layouts.map(source => {
    if (level === 'L3' && source.district === 'D-CORRIDOR' || level === 'L9' && source.district !== 'D-CROSSING') return source;
    const layout = structuredClone(source);
    for (const p of layout.placements) {
      if (level === 'L1' || level === 'L2' || level === 'L4' || level === 'L5') {
        if (civilianCar(p.assetId) && p.assetId !== 'veh.courier-van') p.destruction = { class: 'vehicle' };
        if (p.assetId === 'bld.shed') p.destruction = { class: 'timber' };
      } else if (level === 'L9') {
        if (civilianCar(p.assetId)) p.destruction = { class: 'vehicle' };
        if (p.assetId === 'bld.shed' || p.assetId === 'bld.garage-detached') p.destruction = { class: 'timber' };
        if (p.assetId === 'prop.barricade' || p.assetId === 'prop.jersey-barrier' || p.assetId === 'prop.sandbag-pallet') p.destruction = { class: 'metal-prop' };
      }
    }
    return layout;
  });
}
