import type { DistrictLayout } from './districts/types';

const civilianCar = (assetId: string): boolean =>
  /^(veh\.(?:sedan|suv|pickup|wreck)(?:-|$))/.test(assetId);

/** Apply the reviewed level opt-ins before district colliders and the sim destruction owner are built. */
export function destructionRollout(layouts: DistrictLayout[], level: string): DistrictLayout[] {
  if (!['L1', 'L2', 'L3', 'L4', 'L5', 'L9', 'L10'].includes(level)) return layouts;
  return layouts.map(source => {
    if ((level === 'L3' && source.district === 'D-CORRIDOR') ||
        (level === 'L9' && source.district !== 'D-CROSSING') ||
        (level === 'L10' && source.district !== 'D-CURE')) return source;
    const layout = structuredClone(source);
    for (const p of layout.placements) {
      if (level === 'L1' || level === 'L2' || level === 'L4' || level === 'L5') {
        if (civilianCar(p.assetId) && p.assetId !== 'veh.courier-van') p.destruction = { class: 'vehicle' };
        if (p.assetId === 'bld.shed') p.destruction = { class: 'timber' };
      } else if (level === 'L9') {
        if (civilianCar(p.assetId)) p.destruction = { class: 'vehicle' };
        if (p.assetId === 'bld.shed' || p.assetId === 'bld.garage-detached') p.destruction = { class: 'timber' };
        if (p.assetId === 'prop.barricade' || p.assetId === 'prop.jersey-barrier' || p.assetId === 'prop.sandbag-pallet') p.destruction = { class: 'metal-prop' };
      } else if (level === 'L10') {
        if (civilianCar(p.assetId)) p.destruction = { class: 'vehicle' };
        if (['bld.shed', 'bld.farm-house-ruin', 'bld.farm-barn-ruin'].includes(p.assetId)) p.destruction = { class: 'timber' };
        if (p.assetId === 'bld.cure-guard-post' || p.assetId === 'bld.cure-security-post') p.destruction = { class: 'masonry' };
        if (p.position[0] >= 3750 && ['kit.dispersal-tank-bullet', 'kit.dispersal-tank-sphere'].includes(p.assetId)) p.destruction = { class: 'fuel-tank' };
        if (p.position[0] >= 3750 && ['kit.dispersal-turbine-hall', 'kit.dispersal-filtration-tower', 'kit.dispersal-fan-housing'].includes(p.assetId)) p.destruction = { class: 'machinery' };
      }
    }
    return layout;
  });
}
