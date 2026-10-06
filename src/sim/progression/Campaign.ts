import { Rng } from '../../core/Rng';
import { catalog } from '../../data/actions/catalog';
import { upgrades, type Modifiers, type UpgradeDef } from '../../data/upgrades';
import type { GearTier, SurvivorVariant } from '../../data/survivor';
export type Level = 1|2|3|4|5|6;
export type ProgressionPreset = `L${2|3|4|5|6}-default`;
export interface CampaignSettings { cameraShake?:boolean; flashReduction?:boolean; gore?:'Off'|'Reduced'|'Full'; quality?:'high'|'low'; muted?:boolean; captions?:boolean; aimAssist?:'Off'|'Low'|'Default'|'High' }
export interface CampaignSave {
  version:1; seed:number; character:SurvivorVariant; unlockedLevel:Level; completedLevels:number;
  ownedActions:string[]; upgrades:string[]; racks:{LEFT:string[];RIGHT:string[]}; settings:CampaignSettings;
  usage:Record<string,number>;
  pending?:{level:Level; cards:string[]; phase:'unlock'|'cards'|'racks'; weaponChosen:boolean};
}
export const fixedUnlocks: Readonly<Record<Level,readonly string[]>> = {
  1:[],2:['weapon.pistol','weapon.shotgun','weapon.molotov'],3:['weapon.smg','weapon.hunting-rifle'],
  4:['weapon.machine-gun','weapon.rocket-launcher','weapon.pipe-bomb'],5:[],6:[],
};
export const meleeChoices=['weapon.bat','weapon.crowbar','weapon.machete'] as const;
export function newCampaign(character:SurvivorVariant='female',seed=1):CampaignSave {
  if(!Number.isSafeInteger(seed)||!['female','male'].includes(character))throw new RangeError('Invalid campaign');
  return {version:1,seed,character,unlockedLevel:1,completedLevels:0,ownedActions:['weapon.fists','weapon.kick'],upgrades:[],racks:{LEFT:['weapon.fists'],RIGHT:['weapon.kick']},settings:{},usage:{}};
}
export function rackSize(level:number):number {return level<2?1:level<4?2:3;}
export function validRacks(save:CampaignSave,racks:CampaignSave['racks'],level=save.unlockedLevel):boolean {
  return [racks.LEFT,racks.RIGHT].every(r=>Array.isArray(r)&&r.length>=1&&r.length<=rackSize(level)&&new Set(r).size===r.length&&r.every(id=>save.ownedActions.includes(id)));
}
export function eligible(save:CampaignSave,d:UpgradeDef):boolean {
  return !save.upgrades.includes(d.id)&&(!d.grant||!save.ownedActions.includes(d.grant))&&d.prerequisites.every(p=>save.upgrades.includes(p)||save.ownedActions.includes(p))&&(!d.weapon||save.ownedActions.includes(d.weapon));
}
/** Save-seeded weighted sampling without replacement, isolated from combat RNG. */
export function offer(save:CampaignSave,level=save.completedLevels+1):string[] {
  const rng=new Rng(save.seed,`upgrade-offer-${level}`),pool=Object.values(upgrades).filter(d=>eligible(save,d)),cards:string[]=[];
  while(cards.length<3){
    if(!pool.length)throw new Error('Insufficient valid upgrades');
    const weights=pool.map(d=>1+d.actions.reduce((n,id)=>n+Math.min(4,save.usage[id]??0),0));
    let roll=rng.next()*weights.reduce((a,b)=>a+b,0),index=0;
    while(index<weights.length-1&&(roll-=weights[index])>=0)index++;
    cards.push(pool.splice(index,1)[0].id);
  }return cards;
}
export function modifiers(save:Pick<CampaignSave,'upgrades'>):Modifiers {
  const m:Modifiers={health:0,speed:0,melee:0,magazine:0,reload:0,charges:0,radius:0,knockback:0,ramArmor:0,boost:0};
  for(const id of save.upgrades)for(const [key,value]of Object.entries(upgrades[id].modifiers))m[key as keyof Modifiers]+=value;
  return m;
}
/** Weighted stats + owned weapon tiers + abilities; neither rack order nor unused slots inflate power. */
export function powerScore(save:CampaignSave):number {
  const m=modifiers(save);
  return Math.round(100+m.health+100*m.speed+100*m.melee+10*m.magazine+100*m.reload+20*m.charges+100*m.radius+100*m.knockback+100*m.ramArmor+100*m.boost+
    save.ownedActions.reduce((n,id)=>n+(catalog[id].category==='ability'?60:(catalog[id].tier+1)*20),0)+save.upgrades.filter(id=>upgrades[id].family==='perk').length*20);
}
export function gearTier(save:CampaignSave):GearTier {
  const score=powerScore(save);return (score<240?0:score<450?1:score<600?2:score<720?3:4);
}
export function beginRewards(save:CampaignSave,level:Level):void {
  if(save.pending||level!==save.completedLevels+1||level>5)throw new Error('Rewards unavailable');
  for(const id of fixedUnlocks[level])if(!save.ownedActions.includes(id))save.ownedActions.push(id);
  save.unlockedLevel=Math.max(save.unlockedLevel,level+1) as Level;
  save.pending={level,cards:[],phase:'unlock',weaponChosen:level!==1};
}
export function chooseWeapon(save:CampaignSave,id:string):void {
  if(save.pending?.level!==1||save.pending.phase!=='unlock'||save.pending.weaponChosen||!meleeChoices.includes(id as typeof meleeChoices[number]))throw new Error('Invalid permanent weapon');
  save.ownedActions.push(id);save.racks.LEFT=[id];save.pending.weaponChosen=true;
}
export function revealCards(save:CampaignSave):void {
  if(!save.pending||save.pending.phase!=='unlock'||!save.pending.weaponChosen)throw new Error('Choose a weapon first');
  save.pending.cards=offer(save,save.pending.level);save.pending.phase='cards';
}
export function pickUpgrades(save:CampaignSave,picks:string[]):void {
  const p=save.pending;
  if(!p||p.phase!=='cards'||picks.length!==2||new Set(picks).size!==2||picks.some(id=>!p.cards.includes(id)||!eligible(save,upgrades[id])))throw new Error('Pick two offered upgrades');
  for(const id of picks){save.upgrades.push(id);const grant=upgrades[id].grant;if(grant)save.ownedActions.push(grant);}
  save.completedLevels=p.level;p.phase='racks';
}
export function finishRewards(save:CampaignSave,racks:CampaignSave['racks']):void {
  if(save.pending?.phase!=='racks'||!validRacks(save,racks))throw new Error('Invalid racks');
  save.racks=structuredClone(racks);delete save.pending;
}
export function preset(name:ProgressionPreset):CampaignSave {
  if(!/^L[2-6]-default$/.test(name))throw new Error('Unknown progression preset');
  const target=Number(name[1]),save=newCampaign();
  for(let level=1;level<target;level++){
    beginRewards(save,level as Level);if(level===1)chooseWeapon(save,'weapon.bat');revealCards(save);pickUpgrades(save,save.pending!.cards.slice(0,2));
    const size=rackSize(save.unlockedLevel),melee=save.ownedActions.filter(id=>catalog[id].category==='melee').reverse(),ranged=save.ownedActions.filter(id=>catalog[id].category!=='melee').reverse();
    finishRewards(save,{LEFT:melee.slice(0,size),RIGHT:(ranged.length?ranged:['weapon.kick']).slice(0,size)});
  }return save;
}
