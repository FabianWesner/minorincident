import { catalog } from '../../data/actions/catalog';
import { upgrades } from '../../data/upgrades';
import { eligible, meetsPrerequisite, validRacks, type CampaignSave } from './Campaign';
export const SAVE_KEY='minor-incident.campaign';
export const SAVE_ERROR='Save could not be loaded';
export type SaveResult={status:'empty'}|{status:'ok';save:CampaignSave}|{status:'error';message:string};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string')&&new Set(v).size===v.length;
/** Unreleased v0 used `level` instead of `unlockedLevel`. Migration does not infer lost choices. */
export function migrate(raw:unknown):unknown {
  if(record(raw)&&raw.version===0){const {level,...rest}=raw;return {...rest,version:1,unlockedLevel:level};}return raw;
}
export function validateSave(raw:unknown):raw is CampaignSave {
  if(!record(raw)||raw.version!==1||!Number.isSafeInteger(raw.seed)||!['female','male'].includes(String(raw.character))||!Number.isInteger(raw.unlockedLevel)||Number(raw.unlockedLevel)<1||Number(raw.unlockedLevel)>6||!Number.isInteger(raw.completedLevels)||Number(raw.completedLevels)<0||Number(raw.completedLevels)>5||Number(raw.completedLevels)>=Number(raw.unlockedLevel))return false;
  if(!strings(raw.ownedActions)||!raw.ownedActions.includes('weapon.fists')||!raw.ownedActions.includes('weapon.kick')||raw.ownedActions.some(id=>!Object.hasOwn(catalog,id))||!strings(raw.upgrades)||raw.upgrades.some(id=>!Object.hasOwn(upgrades,id))||!record(raw.racks)||!strings(raw.racks.LEFT)||!strings(raw.racks.RIGHT)||!record(raw.settings)||!record(raw.usage))return false;
  const save=raw as unknown as CampaignSave;
  if(!validRacks(save,save.racks)||save.upgrades.length!==save.completedLevels*2)return false;
  const expectedLevel=save.completedLevels+((save.pending?.phase==='unlock'||save.pending?.phase==='cards')?2:1);
  if(save.unlockedLevel!==expectedLevel)return false;
  for(const [key,value]of Object.entries(save.settings)){
    if(key==='textSize'){if(![1,1.25,1.5].includes(value as number))return false;continue;}
    const enums:Record<string,string[]>={gore:['Off','Reduced','Full'],quality:['high','low','auto'],aimAssist:['Off','Low','Default','High']};
    if(Object.hasOwn(enums,key)?!enums[key].includes(String(value)):!['cameraShake','flashReduction','muted','captions','noiseRings','mono','haptics','tinnitus','bloom','cheapDof','vfx','colorblind'].includes(key)||typeof value!=='boolean')return false;
  }
  if(Object.entries(save.usage).some(([id,n])=>!Object.hasOwn(catalog,id)||!Number.isSafeInteger(n)||n<0))return false;
  const prefix={...save,upgrades:[] as string[]};
  for(const id of save.upgrades){if(!upgrades[id].prerequisites.every(p=>meetsPrerequisite(prefix,p))||(upgrades[id].weapon&&!save.ownedActions.includes(upgrades[id].weapon!))||(upgrades[id].grant&&!save.ownedActions.includes(upgrades[id].grant!)))return false;prefix.upgrades.push(id);}
  if(save.pending){const p=save.pending;
    if(!record(p)||!Number.isInteger(p.level)||p.level<1||p.level>5||!['unlock','cards','racks'].includes(p.phase)||typeof p.weaponChosen!=='boolean'||!strings(p.cards)||p.cards.some(id=>!Object.hasOwn(upgrades,id))||save.unlockedLevel!==p.level+1)return false;
    if(p.phase==='racks'){if(save.completedLevels!==p.level||p.cards.length!==3||p.cards.filter(id=>save.upgrades.includes(id)).length!==2)return false;}
    else if(save.completedLevels!==p.level-1||p.cards.length!==(p.phase==='cards'?3:0)||p.cards.some(id=>!eligible(save,upgrades[id])))return false;
  }return true;
}
export function decodeSave(text:string|null):SaveResult {
  if(text===null)return {status:'empty'};
  try {const save=migrate(JSON.parse(text));return validateSave(save)?{status:'ok',save:structuredClone(save)}:{status:'error',message:SAVE_ERROR};}catch{return {status:'error',message:SAVE_ERROR};}
}
/** Options.js delegates persistence to Audio.js (Bruno Simon, MIT): restore/store at the browser boundary.
 * Injected storage keeps migration/validation testable without DOM or a singleton. */
export class SaveStore {
  constructor(private readonly storage:{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}){}
  load():SaveResult {try{return decodeSave(this.storage.getItem(SAVE_KEY));}catch{return {status:'error',message:SAVE_ERROR};}}
  write(save:CampaignSave):boolean {if(!validateSave(save))throw new Error('Invalid campaign save');try{this.storage.setItem(SAVE_KEY,JSON.stringify(save));return true;}catch{return false;}}
  clear():boolean {try{this.storage.removeItem(SAVE_KEY);return true;}catch{return false;}}
}
