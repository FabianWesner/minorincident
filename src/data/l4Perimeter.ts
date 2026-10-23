import { l4 } from './l4';

/** Shared solid collision and visible military line for every actor. */
const p = l4.perimeter;
export const l4PerimeterWalls = [
  { x: (p.x0 + p.x1) / 2, z: p.z0, halfX: (p.x1 - p.x0) / 2 + .2, halfZ: .2 },
  { x: (p.x0 + p.x1) / 2, z: p.z1, halfX: (p.x1 - p.x0) / 2 + .2, halfZ: .2 },
  { x: p.x0, z: (p.z0 + p.z1) / 2, halfX: .2, halfZ: (p.z1 - p.z0) / 2 + .2 },
  { x: p.x1, z: (p.z0 + p.z1) / 2, halfX: .2, halfZ: (p.z1 - p.z0) / 2 + .2 },
].map((wall, side) => ({ ...wall, y: .4, halfY: .4, id: `l4-perimeter-${side}` }));

export const l4PerimeterSegments = l4PerimeterWalls.flatMap((wall, side) => {
  const alongX = wall.halfX > wall.halfZ, half = alongX ? wall.halfX : wall.halfZ, count = Math.ceil(half * 2 / 2.4), length = half * 2 / count;
  return Array.from({ length: count }, (_, i) => ({ side, x: wall.x + (alongX ? -half + length * (i + .5) : 0), z: wall.z + (alongX ? 0 : -half + length * (i + .5)), yaw: alongX ? 0 : Math.PI / 2, length }));
});

/**
 * PO 10-23 ("L4 is still no action ... make them destructable, so Zombies or alphas can tear them down"): the wall is the front.
 * Every segment is an E26 slot (`groupId: 'l4-wall'`); three breach sites in front of the E26 sandbag slots have breakable HP, the
 * rest is reinforced. Non-Alpha attackers deal `hordeShare` of their damage, so the pile at the fence cracks a breach but an Alpha
 * tears it down (a charge that reaches the wire deals `chargeDamage`). While it batters the wall an Alpha takes `batterResist` of the army's
 * damage (the soldiers cannot stop it at the wire; the courier's damage is unchanged), then the usual `l4.alphas.allyResist`.
 */
export const l4Wall = { wallLeadS: 18, batterResist: .15, chargeDamage: 300, breachHp: 600, reinforcedHp: 1e6, hordeShare: .25, height: 1.12, coverHeight: 1.12, depth: .4, stageM: 7, crack: .66, sag: .33 };
export type L4BreachSide = 'west' | 'north' | 'south';
export const l4Breaches: Record<L4BreachSide, { segments: readonly number[]; out: { x: number; z: number } }> = {
  north: { segments: [7, 8], out: { x: 0, z: -1 } },
  west: { segments: [33, 34], out: { x: -1, z: 0 } },
  south: { segments: [16, 17], out: { x: 0, z: 1 } },
};
export const l4BreachSides = Object.keys(l4Breaches) as L4BreachSide[];
/** Centre of a breach site on the wall line, and the Alpha's run-up point `stageM` outside it. */
export function l4BreachSite(side: L4BreachSide): { centre: { x: number; z: number }; stage: { x: number; z: number } } {
  const b = l4Breaches[side], segs = b.segments.map(i => l4PerimeterSegments[i]);
  const centre = { x: segs.reduce((a, s) => a + s.x, 0) / segs.length, z: segs.reduce((a, s) => a + s.z, 0) / segs.length };
  return { centre, stage: { x: centre.x + b.out.x * l4Wall.stageM, z: centre.z + b.out.z * l4Wall.stageM } };
}
export const l4WallSlotId = (i: number) => `l4-wall-${i}`;
export const l4BreachOf = (segment: number): L4BreachSide | null => l4BreachSides.find(side => l4Breaches[side].segments.includes(segment)) ?? null;
/** E26 slots for every wall segment (inward = toward the camp). */
export const l4WallSlots = l4PerimeterSegments.map((s, i) => {
  const alongX = s.yaw === 0, half = s.length / 2, inward = s.side === 0 ? { x: 0, z: 1 } : s.side === 1 ? { x: 0, z: -1 } : s.side === 2 ? { x: 1, z: 0 } : { x: -1, z: 0 };
  return {
    id: l4WallSlotId(i), groupId: 'l4-wall', a: { x: s.x - (alongX ? half : 0), z: s.z - (alongX ? 0 : half) }, b: { x: s.x + (alongX ? half : 0), z: s.z + (alongX ? 0 : half) },
    // The slot's own box (physics, nav, cover) stays below the 0.7 m shot line: the army and the courier fire over the low concrete; SolidRegistry keeps the full 1.12 m wire solid for bodies.
    height: l4Wall.coverHeight, depth: l4Wall.depth, initialHp: l4BreachOf(i) ? l4Wall.breachHp : l4Wall.reinforcedHp, playerBuildable: false, inward, hordeShare: l4Wall.hordeShare,
  };
});
