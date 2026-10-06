import { action, catalog } from '../../data/actions/catalog';
import type { ActionDef } from '../../data/actions/schema';
import type { SimWorld } from '../world/SimWorld';
import { gearTier,modifiers,powerScore,rackSize,type CampaignSave } from './Campaign';
/** Materialize once at a level/loadout boundary, never in a simulation/render tick. */
export function modifiedActions(save:CampaignSave):Record<string,ActionDef> {
  const m=modifiers(save),defs:Record<string,ActionDef>={};
  for(const original of Object.values(catalog)){
    const d=structuredClone(original);
    if(d.category==='melee')d.damage*=1+m.melee;
    if(d.category==='ranged'){d.magazine+=m.magazine;d.reloadTime*=Math.max(.5,1-m.reload);}
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
  if(!world.player)throw new Error('Progression needs a survivor');
  const m=modifiers(save),player=world.player;
  world.progression={pickups:[],campaign:structuredClone(save),powerScore:powerScore(save)};
  player.entity.health.max=100+m.health;player.entity.health.current=player.entity.health.max;
  player.progressionSpeed=(4.5+m.speed)/4.5;player.select(save.character,gearTier(save));
  if(world.vehicles){world.vehicles.progressionArmor=m.ramArmor;world.vehicles.progressionBoost=1+m.boost;}
  if(world.combat){const level=/^L([1-6])$/.exec(world.scenario??'');const size=rackSize(level?Number(level[1]):save.unlockedLevel);world.combat.rackCapacity=size;world.combat.actionDefinitions=modifiedActions(save);world.combat.setLoadout(save.racks.LEFT.slice(0,size),save.racks.RIGHT.slice(0,size));if(save.settings.aimAssist)world.combat.assist.setting=save.settings.aimAssist;}
}
export function actionResolver(defs:Record<string,ActionDef>|null):(id:string)=>ActionDef {return id=>defs?.[id]??action(id);}
