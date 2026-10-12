import { describe, expect, it } from 'vitest';
import { l2 } from '../../../src/data/l2';
import { CLIP_REACH_M, GLASS_EAST_X, GLASS_SOUTH_Z, HAND_MARGIN_M, ROLE_CLIPS } from '../../../src/data/l2Glass';

describe('L2 trapped civilians behind the supermarket glass', () => {
  it('keeps every hand and forearm behind the glass plane in every clip of its role', () => {
    for (const [x, z, yaw, role] of l2.rescue.atGlass) {
      for (const clip of ROLE_CLIPS[role]) {
        const reach = CLIP_REACH_M[clip] + HAND_MARGIN_M;
        // East glass: figures face +x (yaw 0). South glass: figures face +z (yaw -PI/2).
        const front = yaw === 0 ? x + reach - GLASS_EAST_X : z + reach - GLASS_SOUTH_Z;
        expect(front, `${role} at ${x},${z} in ${clip}`).toBeLessThanOrEqual(0);
      }
    }
  });
  it('lists a measured reach for every clip a role can play', () => {
    for (const clips of Object.values(ROLE_CLIPS)) for (const clip of clips) expect(CLIP_REACH_M[clip]).toBeGreaterThan(0);
  });
});
