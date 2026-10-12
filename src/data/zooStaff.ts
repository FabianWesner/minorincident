/**
 * L8 zoo staff are civilian bases (no new meshes): one uniform tint the crowd shirt palette never uses, a cap (and a
 * backpack for the vet/medic role) and a work prop. The look is plain data so the district spawn and Scene Lab share it.
 */
import { l1Pedestrians } from './npcs';

export interface ZooStaffLook { role: 'zookeeper' | 'vet' | 'groundskeeper'; model: string; tint: string; accessories: string[]; handProp: string }

export const zooStaff = {
  /** Uniform greens: absent from `l1Pedestrians.shirts`, so staff read as staff next to visitors. */
  uniforms: ['#2f7a4f', '#276b5a'],
  roles: [
    { role: 'zookeeper', accessories: ['cap'], handProp: 'bag' },
    { role: 'vet', accessories: ['cap', 'backpack'], handProp: 'bag' },
    { role: 'groundskeeper', accessories: ['cap'], handProp: 'watering-can' },
  ],
  models: ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b'],
} as const;

/** Deterministic staff look for the i-th staff member of a level (cycles role, model and uniform). */
export function zooStaffLook(index: number): ZooStaffLook {
  const role = zooStaff.roles[index % zooStaff.roles.length];
  return {
    role: role.role,
    model: zooStaff.models[index % zooStaff.models.length],
    tint: zooStaff.uniforms[index % zooStaff.uniforms.length],
    accessories: [...role.accessories],
    handProp: role.handProp,
  };
}

/** True when a pedestrian look is a staff look (uniform tint). */
export const isZooStaffTint = (tint: string): boolean => (zooStaff.uniforms as readonly string[]).includes(tint.toLowerCase());

/** Every staff base model is a shipped civilian model. */
export const zooStaffModelsAreCivilianBases = (): boolean => zooStaff.models.every(m => (l1Pedestrians.models as readonly string[]).includes(m));
