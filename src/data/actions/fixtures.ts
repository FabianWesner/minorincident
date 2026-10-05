import { validateAction, type ActionDef } from './schema';
/** Minimal E05 reference actions. Full roster/tuning/held views belong to E06. */
const base: ActionDef = {
  id: 'weapon.bat', category: 'melee', sideAgnostic: true, damage: 25, range: 1.9, arc: 100, spread: 0, maxTargets: 3,
  windup: 0.1, active: 0.1, recovery: 0.3, cooldown: 0.5, fireRate: 0, magazine: 0, reloadTime: 0, charges: 0, recharge: 0,
  projectile: null, splash: null, fuse: 0, knockback: 0.5, stagger: 0.3, status: null, noiseRadius: 6,
  aimIndicator: 'cone', tier: 0, upgradeHooks: ['damage', 'knockback'], viewAssetId: 'wpn.baseball-bat', iconId: 'icon.bat',
};
export const actions: Readonly<Record<string, ActionDef>> = Object.fromEntries([
  base,
  { ...base, id: 'weapon.pistol', category: 'ranged', damage: 20, range: 20, arc: 0, maxTargets: 1, windup: 0, active: 1 / 60, recovery: 0, cooldown: 0, fireRate: 4, magazine: 6, reloadTime: 1, knockback: 0, stagger: 0, noiseRadius: 25, aimIndicator: 'line', viewAssetId: 'wpn.pistol', iconId: 'icon.pistol' },
  { ...base, id: 'weapon.machine-gun', category: 'ranged', damage: 10, range: 25, arc: 0, maxTargets: 1, windup: 0, active: 1 / 60, recovery: 0, cooldown: 0, fireRate: 10, magazine: 30, reloadTime: 2, knockback: 0, stagger: 0, noiseRadius: 35, aimIndicator: 'line', viewAssetId: 'wpn.machine-gun', iconId: 'icon.machine-gun' },
  { ...base, id: 'weapon.grenade', category: 'throwable', damage: 100, range: 10, arc: 0, maxTargets: 1000, windup: 0, active: 1 / 60, recovery: 0.2, cooldown: 0.25, charges: 2, recharge: 12, projectile: { speed: 12, gravity: 9.81, pierce: 0 }, splash: { radius: 4, falloff: 1 }, fuse: 1.5, knockback: 0.5, stagger: 0.5, aimIndicator: 'arc', viewAssetId: 'wpn.frag-grenade', iconId: 'icon.grenade' },
  { ...base, id: 'weapon.test-projectile', category: 'ranged', damage: 20, range: 20, arc: 0, maxTargets: 1, windup: 0, active: 1 / 60, recovery: 0, cooldown: 0.25, projectile: { speed: 120, gravity: 0, pierce: 0 }, knockback: 0, stagger: 0, aimIndicator: 'line', viewAssetId: 'wpn.pistol', iconId: 'icon.projectile' },
  { ...base, id: 'ability.ground-slam', category: 'ability', damage: 25, range: 2, arc: 360, maxTargets: 1000, cooldown: 2, splash: { radius: 2, falloff: 0 }, aimIndicator: 'circle', viewAssetId: 'wpn.fists', iconId: 'icon.slam' },
].map((definition) => { const def = validateAction(definition as ActionDef); return [def.id, def]; }));
export function action(id: string): ActionDef { const def = actions[id]; if (!def) throw new Error(`Unknown action: ${id}`); return def; }
