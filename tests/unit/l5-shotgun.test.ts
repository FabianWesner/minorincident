import { expect, test } from 'vitest';
import { action } from '../../src/data/actions/catalog';
import { modifiedActions } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';

test('T-E23-12-campaign @E23 @E23-AC12 campaign shotgun removes reference ammunition while retaining ballistics', () => {
  const reference = action('weapon.shotgun'), save = preset('L5-default');
  const shotgun = modifiedActions(save)['weapon.shotgun'];
  expect(reference.magazine).toBe(6); expect(reference.reloadTime).toBe(2);
  expect(shotgun).toMatchObject({ magazine: 0, reloadTime: 0, damage: 150, pellets: 8, fireRate: 2, range: 18, distanceFalloff: { start: 4, end: 12, minimum: .1 } });
  expect(shotgun.upgradeHooks).not.toContain('magazine'); expect(shotgun.upgradeHooks).not.toContain('reloadTime');
});
