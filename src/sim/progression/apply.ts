import { enforceCureArsenal } from './arsenal';
import { action, catalog } from '../../data/actions/catalog';
import type { ActionDef } from '../../data/actions/schema';
import { l2WeaponPickup } from '../../data/l2';
import { l3WeaponPickup } from '../../data/l3';
import { l4 } from '../../data/l4';
import { l5DroppedWeapons, l5WeaponPickup } from '../../data/l5';
import { l7Rocket } from '../../data/l7';
import type { SimWorld } from '../world/SimWorld';
import { fixedUnlocks, gearTier,modifiers,powerScore,rackSize,type CampaignSave } from './Campaign';
import { restoreSelectedAction } from './selection';
export { restoreSelectedAction } from './selection';
/** Materialize once at a level/loadout boundary, never in a simulation/render tick. */
export function modifiedActions(save:CampaignSave):Record<string,ActionDef> {
  const m=modifiers(save),defs:Record<string,ActionDef>={};
  for(const original of Object.values(catalog)){
    const d=structuredClone(original);
    if(d.id==='weapon.shotgun'||save.unlockedLevel===10&&d.category==='ranged'){d.magazine=0;d.reloadTime=0;d.upgradeHooks=d.upgradeHooks.filter(h=>h!=='magazine'&&h!=='reloadTime');}
    if(d.category==='melee')d.damage*=1+m.melee;
    // A magazine upgrade never gives a weapon without ammunition (the E21 handgun: 00 §6.1) a magazine and reload.
    if(d.category==='ranged'&&d.magazine>0){d.magazine+=m.magazine;d.reloadTime*=Math.max(.5,1-m.reload);}
    if(d.category==='throwable'){
      d.charges+=m.charges;
      if(d.splash)d.splash.radius*=1+m.radius;
      if(d.effect)d.effect.radius*=1+m.radius;
    }
    d.knockback*=1+m.knockback;
    if(d.id==='weapon.bat')d.damage*=1+.15*save.upgrades.filter(id=>id.startsWith('upgrade.perk.')).length;
    if(d.id==='weapon.nail-bat'&&save.upgrades.includes('upgrade.nail-bat-bleed'))d.status={kind:'bleeding',duration:3,maxStacks:1,dps:5,slow:0};
    defs[d.id]=d;
  }return defs;
}
export function applyCampaign(world:SimWorld,save:CampaignSave):void {
  if (world.scenario === 'L10') enforceCureArsenal(save);
  if(!world.player)throw new Error('Progression needs a survivor');
  if (world.scenario === 'L10' && save.crossingHandover?.corgi && world.npcs) {
    for (const e of [...world.entities.iterate()]) if (e.companion) { world.entities.remove(e.id); world.spatial.delete(e.id); }
    const corgi = structuredClone(save.crossingHandover.corgi); delete corgi.passengerOf; corgi.hidden = false;
    corgi.health.current = corgi.health.max;
    Object.assign(corgi.companion!, { state: 'follow', courage: 100, until: 0, barkAt: 0, hurtAt: 0 });
    world.entities.reserveIds([corgi.id]); world.entities.replace(corgi);
    world.npcs.companion.forceSafe = true; world.npcs.companion.respawnNear();
  }
  const m=modifiers(save),player=world.player;
  world.progression={pickups:[],campaign:structuredClone(save),powerScore:powerScore(save)};
  player.entity.health.max=100+m.health;player.entity.health.current=player.entity.health.max;
  player.progressionSpeed=(4.5+m.speed)/4.5;player.select(save.character,gearTier(save));
  if(world.vehicles){world.vehicles.progressionArmor=m.ramArmor;world.vehicles.progressionBoost=1+m.boost;}
  if(world.combat){
    const level=/^L([1-9]|10)$/.exec(world.scenario??'');
    const {size,LEFT,RIGHT}=campaignLoadout(save,level?Number(level[1]):save.unlockedLevel);
    world.progression.campaign!.racks={LEFT:[...LEFT],RIGHT:[...RIGHT]};
    world.combat.rackCapacity=size;world.combat.actionDefinitions=modifiedActions(save);world.combat.setLoadout(LEFT,RIGHT);
    save.selectedAction=restoreSelectedAction(world.combat.runner.loadout,save);
    world.progression.campaign!.selectedAction=save.selectedAction;
    if(save.settings.aimAssist)world.combat.assist.setting=save.settings.aimAssist;
  }
}
/** The racks a level starts with, clamped to weapons earned before that level while preserving carried rack order and selection. */
export function campaignLoadout(save:CampaignSave,level:number):{size:number;LEFT:string[];RIGHT:string[]} {
  const allowed = storyWeaponsBefore(level);
  const permitted = (id:string) => allowed.has(id) || catalog[id]?.category === 'ability';
  const LEFT = save.racks.LEFT.filter(permitted), RIGHT = save.racks.RIGHT.filter(permitted);
  // A filtered rack may be empty if an older save only contains weapons from future chapters.
  // The unarmed actions are always available and do not count as story weapons.
  if (!LEFT.length) LEFT.push('weapon.fists');
  if (!RIGHT.length) RIGHT.push('weapon.kick');
  const size=Math.max(rackSize(level),LEFT.length,RIGHT.length);
  return {size,LEFT,RIGHT};
}
/** Story grants become selectable at the next level boundary. Current-level pickups stay withheld until collected. */
function storyWeaponsBefore(level:number):Set<string> {
  if (level === 10) return new Set(['weapon.fire-axe','weapon.fists','weapon.kick']); // the mandatory L9 crash strips the combat arsenal
  const earned = new Set<string>(['weapon.fists','weapon.kick', ...(level > 1 ? fixedUnlocks[1].filter(id => catalog[id]?.category !== 'ability') : [])]);
  // These ids are the weapon pickup/action ids authored by each level's mission data.
  // The grant level is the level containing the pickup, so the weapon is usable starting in level + 1.
  const grants: Record<number,readonly string[]> = {
    2:[l2WeaponPickup], 3:[l3WeaponPickup], 4:[l4.machineGun.id],
    5:[l5WeaponPickup,...l5DroppedWeapons.map(p => p.actionId)], 7:[l7Rocket.action],
  };
  for (const [grantLevel, ids] of Object.entries(grants)) if (Number(grantLevel) < level) ids.forEach(id => earned.add(id));
  return earned;
}
export function actionResolver(defs:Record<string,ActionDef>|null):(id:string)=>ActionDef {return id=>defs?.[id]??action(id);}
