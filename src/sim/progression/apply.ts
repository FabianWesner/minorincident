import { enforceCureArsenal } from './arsenal';
import { action, catalog } from '../../data/actions/catalog';
import type { ActionDef } from '../../data/actions/schema';
import type { SimWorld } from '../world/SimWorld';
import { gearTier,modifiers,powerScore,rackSize,type CampaignSave } from './Campaign';
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
  if(world.combat){const level=/^L([1-9]|10)$/.exec(world.scenario??'');const {size,LEFT,RIGHT}=campaignLoadout(save,level?Number(level[1]):save.unlockedLevel);world.combat.rackCapacity=size;world.combat.actionDefinitions=modifiedActions(save);world.combat.setLoadout(LEFT,RIGHT);if(save.settings.aimAssist)world.combat.assist.setting=save.settings.aimAssist;}
}
/** The racks a level starts with. The level's rack size is a floor, never a cut: a rack that grew by a pickup (L5's basement
 * shotgun, Pickups' extra slot) is carried whole (E24: "The player keeps the existing arsenal"; P1 10-20 lost shotgun in L6). */
export function campaignLoadout(save:CampaignSave,level:number):{size:number;LEFT:string[];RIGHT:string[]} {
  const size=Math.max(rackSize(level),save.racks.LEFT.length,save.racks.RIGHT.length);
  return {size,LEFT:[...save.racks.LEFT],RIGHT:[...save.racks.RIGHT]};
}
export function actionResolver(defs:Record<string,ActionDef>|null):(id:string)=>ActionDef {return id=>defs?.[id]??action(id);}
