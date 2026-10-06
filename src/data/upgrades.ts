import { catalog } from './actions/catalog';
export type UpgradeFamily = 'health' | 'speed' | 'melee' | 'handling' | 'throwables' | 'knockback' | 'perk' | 'specials' | 'vehicle';
export interface Modifiers {
  health: number; speed: number; melee: number; magazine: number; reload: number;
  charges: number; radius: number; knockback: number; ramArmor: number; boost: number;
}
export interface UpgradeDef {
  id: string; title: string; description: string; family: UpgradeFamily; tier: number;
  prerequisites: string[]; actions: string[]; modifiers: Partial<Modifiers>;
  visualTags: string[]; grant?: string; weapon?: string;
}
const families: {family: UpgradeFamily; title: string; description: string; modifiers: Partial<Modifiers>; actions?: string[]}[] = [
  {family:'health',title:'Extra endurance',description:'+30 maximum health',modifiers:{health:30}},
  {family:'speed',title:'Fleet feet',description:'+0.22 m/s movement speed',modifiers:{speed:.22}},
  {family:'melee',title:'Hard hitter',description:'+20% melee damage',modifiers:{melee:.2},actions:Object.values(catalog).filter(d=>d.category==='melee').map(d=>d.id)},
  {family:'handling',title:'Larger magazines',description:'+2 rounds to every firearm; 10% faster reload',modifiers:{magazine:2,reload:.1},actions:Object.values(catalog).filter(d=>d.category==='ranged').map(d=>d.id)},
  {family:'throwables',title:'Demolition kit',description:'+1 throwable charge; +15% effect radius',modifiers:{charges:1,radius:.15},actions:Object.values(catalog).filter(d=>d.category==='throwable').map(d=>d.id)},
  {family:'knockback',title:'Make some room',description:'+20% knockback',modifiers:{knockback:.2},actions:Object.values(catalog).filter(d=>d.knockback>0).map(d=>d.id)},
  {family:'perk',title:'Bat training',description:'+15% bat damage',modifiers:{},actions:['weapon.bat']},
  {family:'vehicle',title:'Reinforced ride',description:'10% less vehicle damage; +10% boost strength',modifiers:{ramArmor:.1,boost:.1}},
];
const definitions: UpgradeDef[] = [];
for (const f of families) for(let tier=1;tier<=5;tier++) definitions.push({
  ...f,id:`upgrade.${f.family}.${tier}`,tier,prerequisites:tier>1?[`upgrade.${f.family}.${tier-1}`]:[],
  actions:f.actions??[],visualTags:[f.family],...(f.family==='perk'?{weapon:'weapon.bat'}:{}),
});
const specials=['corgi-lure','ground-slam','shield-bubble','adrenaline','turret'];
for(const [i,name] of specials.entries()) definitions.push({id:`upgrade.specials.${i+1}`,family:'specials',tier:i+1,title:name.replaceAll('-',' '),description:'Unlock this special action for either rack',prerequisites:i?[`upgrade.specials.${i}`]:[],modifiers:{},actions:[`ability.${name}`],grant:`ability.${name}`,visualTags:['special']});
definitions.push({id:'upgrade.nail-bat-bleed',family:'perk',tier:1,title:'Nail bat bleeds',description:'Nail bat hits cause 5 damage/s for 3 seconds',prerequisites:['weapon.nail-bat'],modifiers:{},actions:['weapon.nail-bat'],weapon:'weapon.nail-bat',visualTags:['bleed']});
export const upgrades: Readonly<Record<string,UpgradeDef>> = Object.fromEntries(definitions.map(d=>[d.id,d]));
for (const d of definitions) {
  if(!d.id||!d.title||!Number.isInteger(d.tier)||d.tier<1||d.prerequisites.some(p=>!upgrades[p]&&!catalog[p])||d.actions.some(a=>!catalog[a])||Object.values(d.modifiers).some(n=>!Number.isFinite(n)||n<0)) throw new Error(`Invalid upgrade: ${d.id}`);
}
