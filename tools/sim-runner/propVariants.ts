import { pushableProps } from '../../src/data/pushableProps';
import type { DistrictLayout, Placement } from '../../src/levels/districts/types';
import { EntityStore } from '../../src/sim/world/EntityStore';

/** Reproduce the shipped allocator for a fresh before/after run. No gameplay inputs or balance data change. */
export async function withLegacyPropIds<T>(run: () => Promise<T>): Promise<T> {
  const begin = EntityStore.prototype.beginActorSequence, auxiliary = EntityStore.prototype.createAuxiliary;
  EntityStore.prototype.beginActorSequence = () => {};
  EntityStore.prototype.createAuxiliary = function (entity, key) {
    return key === undefined ? auxiliary.call(this, entity) : this.create(entity);
  };
  try { return await run(); }
  finally { EntityStore.prototype.beginActorSequence = begin; EntityStore.prototype.createAuxiliary = auxiliary; }
}

/** Build a temporary authored layout variant for determinism comparisons. */
export function propVariant(layouts: DistrictLayout[], delta: -4 | 0 | 4): DistrictLayout[] {
  if (![-4, 0, 4].includes(delta)) throw new Error('Prop delta must be -4, 0 or 4');
  if (delta === 0) return layouts;
  const result = structuredClone(layouts), placements = result.flatMap(layout => layout.placements
    .filter(placement => pushableProps[placement.assetId]).map(placement => ({ layout, placement })));
  if (delta < 0) {
    if (placements.length < 4) throw new Error('Need four authored pushables to remove');
    const remote = placements.map(entry => {
      const anchors = Object.values(entry.layout.anchors).map(anchor => anchor.position);
      const p = entry.placement.position;
      const nearest = anchors.length ? Math.min(...anchors.map(a => Math.hypot(p[0] - a[0], p[2] - a[2]))) : 0;
      return { ...entry, nearest };
    }).sort((a, b) => b.nearest - a.nearest);
    const remove = new Set(remote.slice(0, 4).map(({ placement }) => placement));
    for (const layout of result) layout.placements = layout.placements.filter(placement => !remove.has(placement));
    return result;
  }
  if (!placements.length) throw new Error('Cannot add pushables to a level with none authored');
  const source = placements[0]!.placement;
  for (let i = 0; i < 4; i++) {
    const placement: Placement = structuredClone(source);
    placement.id = `q233-prop-variant-${i}`;
    placement.position[0] += 1300 + i * 3;
    placement.visualAabb.min[0] += 1300 + i * 3;
    placement.visualAabb.max[0] += 1300 + i * 3;
    placements[0]!.layout.placements.push(placement);
  }
  return result;
}
