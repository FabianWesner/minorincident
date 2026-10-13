import { validCureCheckpoint } from './cureSave';
import { catalog } from '../../data/actions/catalog';
import { upgrades } from '../../data/upgrades';
import { eligible, lastLevel, meetsPrerequisite, validRacks, type CampaignSave } from './Campaign';
import { validAftermath } from './carryover';
import type { EntitySnapshot } from '../world/types';
export const SAVE_KEY='minor-incident.campaign';
export const SAVE_ERROR='Save could not be loaded';
export type SaveResult={status:'empty'}|{status:'ok';save:CampaignSave}|{status:'error';message:string};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string')&&new Set(v).size===v.length;
/** Bounded L5 carryover records preserve the people, rather than respawning replacements. */
function validCivilian(e: unknown): e is EntitySnapshot {
  if (!record(e) || !record(e.transform) || !record(e.health) || !record(e.civilian) || !record(e.appearance)) return false;
  const transform = e.transform;
  return Number.isSafeInteger(e.id) && Number(e.id) > 1 && e.kind === 'civilian'
    && ['x', 'y', 'z', 'yaw'].every(k => Number.isFinite(transform[k]))
    && Number.isFinite(e.health.current) && Number.isFinite(e.health.max)
    && typeof e.appearance.asset === 'string' && e.appearance.asset.startsWith('npc.');
}
/** PO 2026-10-12: L3 no longer grants an SMG or hunting rifle (the handgun is the only L3 firearm). Old saves hold the handgun instead; the pending reward drops its retired weapon choice flag. */
const legacyL3=new Set(['weapon.smg','weapon.hunting-rifle']);
function dropLegacyL3Weapons(raw:unknown):unknown {
  if(!record(raw)||!Array.isArray(raw.ownedActions))return raw;
  const swap=(ids:unknown):unknown=>Array.isArray(ids)?[...new Set(ids.map(id=>legacyL3.has(id)?'weapon.handgun':id))]:ids;
  const owned=swap(raw.ownedActions) as string[],out:Record<string,unknown>={...raw,ownedActions:owned};
  if(record(raw.racks))out.racks={...raw.racks,LEFT:swap(raw.racks.LEFT),RIGHT:swap(raw.racks.RIGHT)};
  if(record(raw.pending)){const pending={...raw.pending};delete pending.weaponChosen;out.pending=pending;}
  return out;
}
/** The transport handover is an exact live roster, not a set of visual seat placeholders. */
function validTransport(raw: unknown): boolean {
  if (!record(raw) || !Number.isSafeInteger(raw.tick) || Number(raw.tick) < 0 || typeof raw.infiniteCharges !== 'boolean' || !record(raw.vehicle) || !Array.isArray(raw.occupants)) return false;
  const actor = (e: unknown): e is EntitySnapshot => {
    if (!record(e) || !record(e.transform) || !record(e.health)) return false;
    const transform = e.transform, health = e.health;
    return Number.isSafeInteger(e.id) && Number(e.id) > 0 && ['x', 'y', 'z', 'yaw'].every(k => Number.isFinite(transform[k])) && Number.isFinite(health.current) && Number.isFinite(health.max) && Number(health.max) > 0 && (Number(health.current) > 0 || e.archetype === 'vehicle.military-apc' && record(e.vehicle) && e.vehicle.floor === true && Number(health.current) === 0) && Number(health.current) <= Number(health.max);
  };
  const vehicle = raw.vehicle;
  if (!actor(vehicle) || vehicle.archetype !== 'vehicle.military-apc' || !record(vehicle.vehicle) || vehicle.vehicle.driver !== 1 || !Array.isArray(vehicle.vehicle.passengers) || !raw.occupants.every(actor)) return false;
  const ids = new Set(raw.occupants.map(e => e.id));
  return ids.size === raw.occupants.length && ids.has(1) && !ids.has(vehicle.id) && vehicle.vehicle.passengers.length === ids.size - 1
    && vehicle.vehicle.passengers.every(p => record(p) && p.phase === 'seated' && p.id !== 1 && ids.has(p.id)) && new Set(vehicle.vehicle.passengers.map(p => p.id)).size === vehicle.vehicle.passengers.length;
}
/** Validate the fixed crash resume record before any physics bodies are rebuilt. */
function validCrash(raw: unknown): boolean {
  if (!record(raw) || !record(raw.state) || !record(raw.player) || !record(raw.vehicle)) return false;
  const s = raw.state, p = raw.player, car = raw.vehicle;
  const pose = (v: unknown): boolean => record(v) && ['x', 'y', 'z', 'yaw'].every(k => Number.isFinite(v[k]));
  const health = (v: unknown, alive: boolean): boolean => record(v) && Number.isFinite(v.current) && Number.isFinite(v.max) && Number(v.max) > 0 && Number(v.current) >= (alive ? 1 : 0) && Number(v.current) <= Number(v.max);
  return Number.isSafeInteger(raw.tick) && Number(raw.tick) >= 0 && Number.isSafeInteger(s.startedAt) && Number(s.startedAt) <= Number(raw.tick)
    && ['driving', 'approach', 'fall', 'impact', 'crawl', 'done'].includes(String(s.phase)) && Number.isSafeInteger(s.carId) && Number(s.carId) > 1
    && Number.isFinite(s.preCrashDurability) && Number(s.preCrashDurability) >= 0 && pose(s.from)
    && ['crawl-start', 'crawl-fallback'].includes(String(s.crawlAnchor)) && typeof s.finished === 'boolean' && s.finished === (s.phase === 'done') && typeof s.ended === 'boolean' && (!s.ended || s.finished)
    && p.id === 1 && pose(p.transform) && health(p.health, true) && record(p.survivor)
    && car.id === s.carId && car.archetype === 'vehicle.military-apc' && pose(car.transform) && health(car.health, false) && record(car.vehicle)
    && (['impact', 'crawl', 'done'].includes(String(s.phase)) ? car.vehicle.damage === 'exploded' && car.vehicle.driver === null : car.vehicle.driver === 1);
}
/** Companion identity is carried independently of the sheltered human roster. */
function validCorgi(raw: unknown): boolean {
  if (!record(raw) || !record(raw.companion) || !record(raw.health) || !record(raw.transform)) return false;
  const pose = raw.transform, companion = raw.companion;
  return Number.isSafeInteger(raw.id) && Number(raw.id) > 1 && raw.archetype === 'char.corgi' && raw.kind === 'companion'
    && ['x','y','z','yaw'].every(k => Number.isFinite(pose[k])) && Number(raw.health.current) > 0 && Number(raw.health.current) <= Number(raw.health.max)
    && Array.isArray(companion.path) && ['courage','until','barkAt','hurtAt'].every(k => Number.isFinite(companion[k]));
}
/** v0 renamed level; v2 persists completion before navigation. Existing v1 aftermath is retained; absent records keep level defaults. */
export function migrate(raw:unknown):unknown {
  if(record(raw)&&raw.version===0){const {level,...rest}=raw;raw={...rest,version:1,unlockedLevel:level};}
  if(record(raw)&&raw.version===1)raw={...raw,version:2};
  raw = dropLegacyL3Weapons(raw);
  // Retired pre-finale breakdown saves retain their position, roster and zero durability.
  if (record(raw) && raw.unlockedLevel === 9 && record(raw.l9Crash) && record(raw.l9Crash.state) && raw.l9Crash.state.phase === 'driving' && record(raw.l9Crash.vehicle) && record(raw.l9Crash.vehicle.health) && raw.l9Crash.vehicle.health.current === 0 && record(raw.l9Crash.vehicle.vehicle)) {
    const copy = structuredClone(raw.l9Crash);
    const car = copy.vehicle as Record<string, unknown>;
    car.vehicle = { ...(car.vehicle as Record<string, unknown>), floor: true, damage: 'normal', explodeAt: null, driver: 1 };
    raw = { ...raw, l9Crash: copy };
  }
  // S6 saves written after the crawl had no L10 transaction yet. Commit the same reset on load.
  if (record(raw) && raw.completedLevels === 9 && raw.unlockedLevel === 9 && validCrash(raw.l9Crash) && strings(raw.ownedActions)) {
    const crash = raw.l9Crash as NonNullable<CampaignSave['l9Crash']>;
    if (crash.state.finished) {
      const transport = validTransport(raw.transport) ? raw.transport as NonNullable<CampaignSave['transport']> : null;
      const out = { ...raw, unlockedLevel: 10, ownedActions: ['weapon.fire-axe', ...raw.ownedActions.filter(id => catalog[id]?.category === 'ability')], racks: { LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] }, crossingHandover: { applied: true, checkpoint: 'cure-crash', anchor: { ...crash.player.transform }, preCrashDurability: crash.state.preCrashDurability, lostWeapons: raw.ownedActions.filter(id => catalog[id]?.category !== 'ability' && id !== 'weapon.fire-axe'), shelteredPassengers: transport?.occupants.filter(e => e.id !== 1 && !e.companion) ?? [] } } as Record<string, unknown>;
      delete out.l9Crash; delete out.transport; delete out.pending; raw = out;
    }
  }
  return raw;
}
export function validateSave(raw:unknown):raw is CampaignSave {
  if(!record(raw)||raw.version!==2||!Number.isSafeInteger(raw.seed)||!['female','male'].includes(String(raw.character))||!Number.isInteger(raw.unlockedLevel)||Number(raw.unlockedLevel)<1||Number(raw.unlockedLevel)>lastLevel||!Number.isInteger(raw.completedLevels)||Number(raw.completedLevels)<0||Number(raw.completedLevels)>lastLevel||(Number(raw.completedLevels)>=Number(raw.unlockedLevel)&&!(Number(raw.completedLevels)>=6&&Number(raw.unlockedLevel)>=Number(raw.completedLevels))))return false;
  if(!strings(raw.ownedActions)||(raw.crossingHandover === undefined && (!raw.ownedActions.includes('weapon.fists')||!raw.ownedActions.includes('weapon.kick')))||raw.ownedActions.some(id=>!Object.hasOwn(catalog,id))||!strings(raw.upgrades)||raw.upgrades.some(id=>!Object.hasOwn(upgrades,id))||!record(raw.racks)||!strings(raw.racks.LEFT)||!strings(raw.racks.RIGHT)||!record(raw.settings)||!record(raw.usage))return false;
  const save=raw as unknown as CampaignSave;
  if (save.completedLevels >= 9 && !save.crossingHandover) return false;
  if (raw.crossingHandover !== undefined) {
    const h = raw.crossingHandover;
    if (record(h) && h.corgi !== undefined && !validCorgi(h.corgi)) return false;
    if (!record(h) || h.applied !== true || h.checkpoint !== 'cure-crash' || !record(h.anchor) || !['x','y','z','yaw'].every(k => Number.isFinite((h.anchor as Record<string, unknown>)[k])) || !Number.isFinite(h.preCrashDurability) || Number(h.preCrashDurability) < 0 || !strings(h.lostWeapons) || h.lostWeapons.some(id => !Object.hasOwn(catalog,id) || catalog[id].category === 'ability' || id === 'weapon.fire-axe') || !Array.isArray(h.shelteredPassengers) || !h.shelteredPassengers.every(e => record(e) && Number.isSafeInteger(e.id) && Number(e.id) > 1 && ['civilian','escort'].includes(String(e.kind)) && record(e.health) && Number(e.health.current) > 0 && Number(e.health.current) <= Number(e.health.max) && record(e.transform) && ['x','y','z','yaw'].every(k => Number.isFinite((e.transform as Record<string, unknown>)[k]))) || new Set(h.shelteredPassengers.map(e => e.id)).size !== h.shelteredPassengers.length || save.completedLevels < 9 || save.unlockedLevel !== 10 || save.l9Crash || save.transport || save.pending || !save.ownedActions.includes('weapon.fire-axe')) return false;
  }

  if(!validRacks(save,save.racks)||save.upgrades.length!==Math.min(5,save.completedLevels)*2)return false;
  const expectedLevel=save.completedLevels+((save.pending?.phase==='unlock'||save.pending?.phase==='cards')?2:1);
  // A finished L6 save written before L7 existed keeps unlockedLevel 6; every later completion unlocks the next level.
  if(save.unlockedLevel!==Math.min(lastLevel,expectedLevel)&&!(save.completedLevels===6&&save.unlockedLevel===6))return false;
  for(const [key,value]of Object.entries(save.settings)){
    if(key==='textSize'){if(![1,1.25,1.5].includes(value as number))return false;continue;}
    const enums:Record<string,string[]>={gore:['Off','Reduced','Full'],quality:['high','low','auto'],aimAssist:['Off','Low','Default','High']};
    if(Object.hasOwn(enums,key)?!enums[key].includes(String(value)):!['cameraShake','flashReduction','muted','captions','noiseRings','mono','haptics','tinnitus','bloom','cheapDof','vfx','colorblind','slowMotion'].includes(key)||typeof value!=='boolean')return false;
  }
  if(Object.entries(save.usage).some(([id,n])=>!Object.hasOwn(catalog,id)||!Number.isSafeInteger(n)||n<0))return false;
  if (save.cureResume !== undefined) {
    const resume = save.cureResume;
    if (!record(resume) || save.unlockedLevel !== 10 || !save.crossingHandover || !validCureCheckpoint(resume.current) || !validCureCheckpoint(resume.checkpoint) || resume.current.state.checkpoint !== resume.checkpoint.state.checkpoint || JSON.stringify(resume.current.arsenal) !== JSON.stringify({ ownedActions: save.ownedActions, racks: save.racks })) return false;
  }
  if(save.l9Crash!==undefined&&!validCrash(save.l9Crash))return false;
  if(save.transport!==undefined&&!validTransport(save.transport))return false;
  if(save.world!==undefined&&(!record(save.world)||Object.keys(save.world).some(k=>k!=='L1')||save.world.L1!==undefined&&!validAftermath(save.world.L1)))return false;
  if(save.stationOccupants!==undefined&&(!Array.isArray(save.stationOccupants)||save.stationOccupants.length<20||save.stationOccupants.length>30||!save.stationOccupants.every(validCivilian)||new Set(save.stationOccupants.map(e=>e.id)).size!==save.stationOccupants.length))return false;
  if(save.survivors!==undefined&&(!strings(save.survivors)||save.survivors.some(k=>!['dale','rosa','okafor','mia','sam'].includes(k))))return false;
  if(save.rescuedSurvivors!==undefined){
    if(!Array.isArray(save.rescuedSurvivors)||save.rescuedSurvivors.length>5||!save.rescuedSurvivors.every(validCivilian))return false;
    if(!save.rescuedSurvivors.every(e=>save.survivors?.includes(e.civilian!.survivor?.key??'')))return false;
    const people=[...save.stationOccupants??[],...save.rescuedSurvivors];
    if(new Set(people.map(e=>e.id)).size!==people.length)return false;
  }
  if(save.results!==undefined&&(!record(save.results)||Object.entries(save.results).some(([id,result])=>!/^L(?:[1-9]|10)$/.test(id)||!record(result)||!['time','kills','knockdowns','damage','deaths','rescued'].every(k=>typeof result[k]==='number'&&Number.isFinite(result[k])&&Number(result[k])>=0)||!strings(result.optionalObjectives)||result.survivors!==undefined&&!strings(result.survivors))))return false;
  const history = [...save.ownedActions, ...save.crossingHandover?.lostWeapons ?? []];
  const prefix={...save,ownedActions:history,upgrades:[] as string[]};
  for(const id of save.upgrades){if(!upgrades[id].prerequisites.every(p=>meetsPrerequisite(prefix,p))||(upgrades[id].weapon&&!history.includes(upgrades[id].weapon!))||(upgrades[id].grant&&!history.includes(upgrades[id].grant!)))return false;prefix.upgrades.push(id);}
  if(save.completedLevels>=6&&save.pending)return false;
  if(save.pending){const p=save.pending;
    if(!record(p)||!Number.isInteger(p.level)||p.level<1||p.level>5||!['unlock','cards','racks'].includes(p.phase)||!strings(p.cards)||p.cards.some(id=>!Object.hasOwn(upgrades,id))||save.unlockedLevel!==p.level+1)return false;
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
