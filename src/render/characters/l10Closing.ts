import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';

const slots = { mia: [6, 3], rosa: [8, 5.5], dale: [5.5, 8], okafor: [2, 8] } as const;
/** The closing shot uses the clear apron beside the console, beyond the battle's body pile. */
export function l10ClosingPose(world: SimWorld, e: EntitySnapshot): EntitySnapshot['transform'] | undefined {
  const mission = world.missions, state = mission?.state;
  if (world.scenario !== 'L10' || !state?.epilogue || state.counters['epilogue-ticks'] < 45 * 60 || e.health.current <= 0 || e.infected) return;
  const key = e.civilian?.survivor?.key, sam = e.id === state.actors['hangar-sam'] || e.civilian?.model?.startsWith('npc.sam');
  const slot = key && slots[key as keyof typeof slots] || (sam ? [-1, 5] : undefined);
  const console = mission!.def.anchors['cure-console'];
  if (!slot || !console) return;
  return { ...e.transform, x: console.x + slot[0], y: .7, z: console.z + slot[1], yaw: Math.PI * .75 };
}
