import { enforceCureArsenal } from './arsenal';
import { action, catalog } from '../../data/actions/catalog';
import type { ActionDef } from '../../data/actions/schema';
import { levelStartWeapons } from '../../data/levelStartWeapons';
import type { SimWorld } from '../world/SimWorld';
import { gearTier,modifiers,powerScore,rackSize,type CampaignSave } from './Campaign';
import { restoreSelectedAction } from './selection';
export { restoreSelectedAction } from './selection';
/** Materialize once at a level/loadout boundary, never in a simulation/render tick. */
export function modifiedActions(save:CampaignSave):Record<string,ActionDef> {
  const m=modifiers(save),defs:Record<string,ActionDef>={};
  for(const original of Object.values(catalog)){
    const d=structuredClone(original);
    if(d.id==='weapon.shotgun'||save.unlockedLevel===10&&d.category==='ranged'&&d.id!=='weapon.flamethrower'){d.magazine=0;d.reloadTime=0;d.upgradeHooks=d.upgradeHooks.filter(h=>h!=='magazine'&&h!=='reloadTime');}
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
  // s178: the campaign's difficulty owns the live world (level select, checkpoint restore and restart keep it).
  world.difficulty = save.difficulty === 'hard' ? 'hard' : 'simple';
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
    const startLevel=level?Number(level[1]):save.unlockedLevel;
    const {size,LEFT,RIGHT}=campaignLoadout(save,startLevel);
    save.racks={LEFT:[...LEFT],RIGHT:[...RIGHT]};
    world.progression.campaign!.racks={LEFT:[...LEFT],RIGHT:[...RIGHT]};
    for(const id of [...LEFT,...RIGHT])if(!save.ownedActions.includes(id))save.ownedActions.push(id);
    world.progression.campaign!.ownedActions=[...save.ownedActions];
    world.combat.rackCapacity=size;world.combat.actionDefinitions=modifiedActions(save);world.combat.setLoadout(LEFT,RIGHT);
    const ranged=RIGHT.find(id=>catalog[id]?.category==='ranged');
    const melee=[...LEFT].filter(id=>catalog[id]?.category==='melee'&&id!=='weapon.fists');
    const preferred=ranged??melee.sort((a,b)=>catalog[b].tier-catalog[a].tier)[0]??'weapon.fists';
    save.selectedAction=restoreSelectedAction(world.combat.runner.loadout,{...save,selectedAction:preferred});
    world.progression.campaign!.selectedAction=save.selectedAction;
    if(save.settings.aimAssist)world.combat.assist.setting=save.settings.aimAssist;
  }
}
/** Materialize the authored start racks; carried weapons and save selection do not change a level's opening set. */
export function campaignLoadout(save:CampaignSave,level:number):{size:number;LEFT:string[];RIGHT:string[]} {
  const authored=levelStartWeapons[level as keyof typeof levelStartWeapons];
  if(!authored)throw new RangeError(`Invalid campaign level ${level}`);
  // A deliberately unarmed save (the L6 fists-only challenge) must remain
  // unarmed at the level boundary. Authored campaign arsenals still apply to
  // ordinary saves that own any other weapon.
  if(level===6&&save.ownedActions.every(id=>id==='weapon.fists'||id==='weapon.kick')) {
    const LEFT=save.racks.LEFT.filter(id=>id==='weapon.fists'||id==='weapon.kick');
    const RIGHT=save.racks.RIGHT.filter(id=>id==='weapon.fists'||id==='weapon.kick');
    return {size:Math.max(rackSize(level),LEFT.length,RIGHT.length),LEFT:LEFT.length?LEFT:['weapon.fists'],RIGHT:RIGHT.length?RIGHT:['weapon.kick']};
  }
  const LEFT=[...authored.LEFT],RIGHT=[...authored.RIGHT];
  if(!LEFT.length)LEFT.push('weapon.fists');
  if(!RIGHT.length)RIGHT.push('weapon.kick');
  for(const side of ['LEFT','RIGHT'] as const) for(const id of save.racks[side]) {
    if(catalog[id]?.category==='ability') (side==='LEFT'?LEFT:RIGHT).push(id);
  }
  const size=Math.max(rackSize(level),LEFT.length,RIGHT.length);
  return {size,LEFT,RIGHT};
}
export function actionResolver(defs:Record<string,ActionDef>|null):(id:string)=>ActionDef {return id=>defs?.[id]??action(id);}
