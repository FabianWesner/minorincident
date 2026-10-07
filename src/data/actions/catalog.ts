import { noiseForAction } from '../noise';
import { actions as fixtures } from './fixtures';
import { validateAction, type ActionDef } from './schema';

/** Full M1–M3 roster. Seconds/metres/HP; upgrades modify the named hooks in E13.
 * Utility actions intentionally deal no damage. E27 consumes the smoke/fire definitions. */
const base: ActionDef = { ...fixtures['weapon.bat'], effect: null, pellets: 1, distanceFalloff: null };
const melee = (id: string, asset: string, damage: number, range: number, arc: number, swing: number, tier: number, knockback = 0.5): ActionDef => ({ ...base, id: `weapon.${id}`, viewAssetId: asset, iconId: `icon.${id}`, damage, range, arc, windup: swing * 0.2, active: 0.1, recovery: swing * 0.8 - 0.1, cooldown: swing, knockback, tier });
const gun = (id: string, damage: number, range: number, fireRate: number, magazine: number, reloadTime: number, spread: number, tier = 1): ActionDef => ({ ...base, id: `weapon.${id}`, category: 'ranged', viewAssetId: `wpn.${id}`, iconId: `icon.${id}`, damage, range, fireRate, magazine, reloadTime, spread, arc: 0, maxTargets: 1, windup: 0, active: 1 / 60, recovery: 0, cooldown: 0, knockback: 0, stagger: 0, noiseRadius: noiseForAction(`weapon.${id}`).radius, aimIndicator: 'line', tier, upgradeHooks: ['damage', 'magazine', 'reloadTime', 'spread'] });
const thrown = (id: string, damage: number, radius: number, fuse: number): ActionDef => ({ ...base, id: `weapon.${id}`, category: 'throwable', viewAssetId: `thr.${id === 'grenade' ? 'frag-grenade' : id}`, iconId: `icon.${id}`, damage, range: 12, arc: 0, maxTargets: 1000, windup: 0, active: 1 / 60, recovery: 0.2, cooldown: 0.25, charges: 2, recharge: 12, projectile: { speed: 12, gravity: 9.81, pierce: 0 }, splash: { radius, falloff: 0.5 }, fuse, knockback: damage ? 0.5 : 0, stagger: damage ? 0.5 : 0, noiseRadius: damage ? noiseForAction(`weapon.${id}`).radius : 0, aimIndicator: 'arc', tier: 1, upgradeHooks: ['damage', 'charges', 'recharge', 'radius'] });
const ability = (id: string, radius: number, duration: number, cooldown: number, kind: NonNullable<ActionDef['effect']>['kind']): ActionDef => ({ ...base, id: `ability.${id}`, category: 'ability', damage: 0, range: radius, arc: 360, maxTargets: 1000, windup: 0, active: 1 / 60, recovery: 0.2, cooldown, knockback: 0, stagger: 0, noiseRadius: 0, aimIndicator: 'circle', tier: 2, effect: { kind, radius, duration }, viewAssetId: `ability.${id}`, iconId: `icon.${id}`, upgradeHooks: ['cooldown', 'duration', 'radius'] });
export const catalog: Readonly<Record<string, ActionDef>> = Object.fromEntries(([
  // E19 §5.6 + PO #11: unarmed 9 per hit (5 hits per 40 HP); 1.45 m reach so punches land on infected waiting at arm's length, one body per punch; per-move timing/knockback in meleeCombos.
  { ...melee('fists', 'wpn.fists', 9, 1.45, 80, 0.4, 0, 0.2), maxTargets: 1, stagger: 0 },
  melee('kick', 'wpn.kick', 18, 1.5, 60, 0.65, 0, 1.2),
  { ...fixtures['weapon.bat'], damage: 22, knockback: 2.6, stagger: 0.4 },
  melee('crowbar', 'wpn.crowbar', 30, 1.8, 95, 0.6, 0),
  melee('machete', 'wpn.machete', 32, 1.8, 110, 0.45, 0, 0.2),
  melee('knife', 'wpn.knife', 18, 1.3, 60, 0.3, 0, 0.1),
  { ...melee('nail-bat', 'wpn.nail-bat', 38, 2, 100, 0.55, 1), upgradeHooks: ['damage', 'knockback', 'status'] },
  melee('shovel', 'wpn.shovel', 40, 2.2, 110, 0.75, 1, 0.8),
  melee('police-baton', 'wpn.police-baton', 22, 1.7, 85, 0.35, 1, 0.3),
  melee('fire-axe', 'wpn.fire-axe', 65, 2.1, 100, 0.85, 2, 0.8),
  melee('katana', 'wpn.katana', 48, 2.3, 130, 0.45, 2, 0.2),
  fixtures['weapon.pistol'],
  { ...gun('shotgun', 150, 18, 2, 6, 2, 12), pellets: 8, distanceFalloff: { start: 4, end: 12, minimum: 0.1 }, maxTargets: 8, knockback: 0, stagger: 0.3 },
  { ...gun('nail-gun', 14, 18, 6, 24, 1.6, 1), projectile: { speed: 60, gravity: 0, pierce: 0 } },
  gun('smg', 18, 20, 8, 30, 1.5, 2),
  { ...gun('hunting-rifle', 90, 32, 1, 5, 2.4, 0), tier: 1 },
  gun('assault-rifle', 26, 28, 7.5, 30, 2, 1, 2),
  fixtures['weapon.machine-gun'],
  { ...gun('rocket-launcher', 180, 35, 0.8, 1, 2.5, 0, 2), projectile: { speed: 18, gravity: 0, pierce: 0 }, splash: { radius: 4, falloff: 0.6 }, maxTargets: 1000, knockback: 1.2, stagger: 0.8, noiseRadius: noiseForAction('weapon.rocket-launcher').radius },
  fixtures['weapon.grenade'],
  { ...thrown('molotov', 10, 4, 0), effect: { kind: 'fire', radius: 4, duration: 6 }, status: { kind: 'burning', duration: 2, maxStacks: 1, dps: 15, slow: 0 } },
  thrown('pipe-bomb', 150, 4.5, 2),
  { ...thrown('firecracker-lure', 0, 15, 0), splash: null, effect: { kind: 'lure', radius: 15, duration: 5 } },
  { ...thrown('smoke-grenade', 0, 6, 0), splash: null, effect: { kind: 'smoke', radius: 6, duration: 12 } },
  { ...thrown('flashbang', 0, 5, 1), tier: 2, status: { kind: 'stunned', duration: 3, maxStacks: 1, dps: 0, slow: 0 } },
  { ...ability('corgi-lure', 15, 5, 12, 'lure'), tier: 1 },
  fixtures['ability.ground-slam'],
  ability('shield-bubble', 2.5, 4, 14, 'shield'),
  ability('adrenaline', 1, 5, 15, 'adrenaline'),
  { ...ability('turret', 18, 8, 20, 'turret'), damage: 16, fireRate: 5, noiseRadius: 25, upgradeHooks: ['damage', 'cooldown', 'duration'] },
] satisfies ActionDef[]).map((definition) => { const def = validateAction(definition); return [def.id, def]; }));
/** Fixture-only projectile remains available for E05 regression, outside the player roster. */
export function action(id: string): ActionDef { const def = catalog[id] ?? fixtures[id]; if (!def) throw new Error(`Unknown action: ${id}`); return def; }

/** Damage balance keeps the E05 swept-projectile reference alongside every damaging catalog action. */
export const balanceActions = [...Object.values(catalog).filter((def) => def.damage > 0), fixtures['weapon.test-projectile']];
