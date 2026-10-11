import { describe, expect, test, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraFraming, policeEngagementM, policeTargetInView, policeShotRangeM } from '../../../src/data/cameraFraming';
import { l3 } from '../../../src/data/l3';
import { allyState, updateAlly } from '../../../src/sim/outbreak/Allies';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { AllyState } from '../../../src/sim/npc/types';

function fixture(gun = true) {
  const entity = (id: number, x: number, z: number) => ({ id, transform: { x, y: 0, z, yaw: 0 }, health: { current: 100, max: 100 } }) as EntitySnapshot;
  const player = entity(1, 0, 0), officer = entity(2, 0, 0), zombie = entity(3, 2, 0);
  const ally: AllyState = { ...allyState('officer', { x: 0, z: 0 }, true), engaged: true, ...(gun ? { gun: { ...l3.officers.gun } } : {}) };
  officer.civilian = { state: 'calm', ally } as EntitySnapshot['civilian'];
  zombie.infected = {} as EntitySnapshot['infected'];
  const entities = new Map([[1, player], [2, officer], [3, zombie]]), emit = vi.fn(), damage = vi.fn();
  const world = { tick: 4, seed: 1, entities, infected: { active: [zombie], nav: { clear: () => false } }, npcs: { move: vi.fn() }, spatial: { query: () => [] }, events: { emit }, combat: { damage: { apply: damage } } } as unknown as SimWorld;
  const sees = vi.fn(() => true);
  return { world, player, officer, zombie, ally, emit, damage, sees, step: () => updateAlly(world, officer, sees) };
}

describe('police visible engagement @E21', () => {
  test.each([true, false])('acquires only near both player and shooter (gun=%s)', gun => {
    const f = fixture(gun);
    f.zombie.transform.x = 12; f.officer.transform.x = 10;
    f.step(); expect(f.ally.targetId).toBe(0); expect(f.emit).not.toHaveBeenCalled();
    f.zombie.transform.x = 2; f.officer.transform.x = 0;
    f.step(); expect(f.ally.targetId).toBe(3);
    f.officer.transform.x = -10; f.world.tick++;
    f.step(); expect(f.ally.targetId).toBe(0); expect(f.damage).not.toHaveBeenCalled();
  });

  test.each(['player moves', 'target moves', 'LOS blocked', 'hidden'] as const)('pending shot cancels immediately when %s', change => {
    const f = fixture(); f.step(); expect(f.ally.strikeAt).toBeTruthy();
    if (change === 'player moves') f.player.transform.x = -10;
    if (change === 'target moves') f.zombie.transform.x = 10;
    if (change === 'LOS blocked') f.sees.mockReturnValue(false);
    if (change === 'hidden') f.zombie.hidden = true;
    f.world.tick++; f.step();
    expect(f.emit).not.toHaveBeenCalled(); expect(f.damage).not.toHaveBeenCalled();
    expect(f.ally.strikeAt).toBe(0);
  });

  test('fires at a visible near target and retains LOS on cached targets', () => {
    const f = fixture(); f.step(); f.world.tick++; f.step();
    expect(f.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ally.attack', sourceId: 2, targetId: 3 }));
    f.sees.mockReturnValue(false); f.world.tick++; f.step(); expect(f.ally.targetId).toBe(0);
  });

  test('a following officer can cover the player from its formation, but cannot exceed the shot limit', () => {
    const f = fixture(); f.officer.transform.x = -3;
    f.step(); expect(f.ally.targetId).toBe(3);
    f.officer.transform.x = 2 - policeShotRangeM - .01; f.world.tick++;
    f.step(); expect(f.ally.targetId).toBe(0); expect(f.emit).not.toHaveBeenCalled();
  });

  test('soldiers keep their own engagement rule', () => {
    const f = fixture(); f.ally.role = 'soldier'; f.zombie.transform.x = 12;
    f.step(); expect(f.ally.targetId).toBe(3);
  });

  test('breakout cannot force an offscreen target into the sights', () => {
    const f = fixture(); f.player.transform.x = 10;
    f.ally.follow = { targetId: 1, slot: 0, minM: 3, maxM: 6, leashM: 8, engageM: 18, moveMs: 6.2, breakoutUntil: 100 };
    f.officer.transform.x = 4; f.step(); expect(f.ally.targetId).toBe(0);
  });

  test.each([[1600, 900], [390, 844], [844, 390]])('accepted targets have a screen margin at %sx%s default framing', (width, height) => {
    const { fovDeg, radiusM, polar, portraitWidthM } = cameraFraming;
    const camera = new PerspectiveCamera(fovDeg, width / height, .1, 600);
    const radius = width >= height ? radiusM : Math.max(radiusM, portraitWidthM / (2 * Math.tan(fovDeg * Math.PI / 360) * camera.aspect));
    camera.position.setFromSphericalCoords(radius, polar, Math.PI / 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (let x = -policeEngagementM; x <= policeEngagementM; x += .1) {
      for (let z = -policeEngagementM; z <= policeEngagementM; z += .1) {
        if (!policeTargetInView(x, z)) continue;
        const point = new Vector3(x, .7, z).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(.9); expect(Math.abs(point.y)).toBeLessThan(.9);
      }
    }
  });

  test('visible street targets beyond the old disc are allowed; screen-edge targets are rejected', () => {
    expect(policeTargetInView(3.5, 0)).toBe(true);
    expect(policeTargetInView(3, -3)).toBe(false);
    expect(policeTargetInView(-3, -3)).toBe(true);
    expect(policeTargetInView(-3.3, -3.3)).toBe(false);
  });
});
