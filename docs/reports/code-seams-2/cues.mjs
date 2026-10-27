import ts from 'typescript';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { AudioService } = await import(pathToFileURL(resolve('src/audio/AudioService.ts')));
const { eventCues } = await import(pathToFileURL(resolve('src/data/audioCues.ts')));
const Mapper = existsSync('src/audio/AudioEventMapper.ts') ? (await import(pathToFileURL(resolve('src/audio/AudioEventMapper.ts')))).AudioEventMapper : null;
const program = ts.createProgram(['src/sim/world/types.ts'], { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, resolveJsonModule: true, esModuleInterop: true, skipLibCheck: true });
const checker = program.getTypeChecker(), source = program.getSourceFile('src/sim/world/types.ts');
const node = source.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'GameEvent');
const type = checker.getTypeAtLocation(node);
const literals = type => type.isUnion() ? type.types.flatMap(literals) : type.isStringLiteral() || type.isNumberLiteral() ? [type.value] : type.flags & ts.TypeFlags.BooleanLiteral ? [type.intrinsicName === 'true'] : [];
const variants = type.isUnion() ? type.types : [type];
const position = { x: 1, y: .7, z: 2 };
const defaults = { tick: 100, sourceId: 1, targetId: 2, id: 1, position, from: position, to: { x: 4, y: .7, z: 5 }, direction: { x: 1, z: 0 }, velocity: { x: 1, z: 0 }, actionId: 'weapon.fists', attackId: 1, amount: 25, radius: 2, health: .1, hp: 20, maxHp: 50, impulse: 25, speed: 10, rpm: 3000, duration: 2, text: 'Fixture', cue: 'ui.tick', key: 'dale', level: 'L1' };
const events=[];
for (const variant of variants) {
 const properties = checker.getPropertiesOfType(variant);
 const values = Object.fromEntries(properties.map(p=>[p.name,literals(checker.getTypeOfSymbolAtLocation(p,node))]));
 const event = { ...defaults };
 for (const p of properties) {
  if (values[p.name].length) event[p.name] = values[p.name][0];
  else if (!(p.name in event) && !(p.flags & ts.SymbolFlags.Optional)) event[p.name] = 1;
 }
 if (!event.type) throw new Error('Missing discriminator');
 events.push(event);
 for (const [key,list] of Object.entries(values)) for (const value of list.slice(1)) events.push({...event,[key]:value});
 for (const actionId of ['weapon.shotgun','weapon.bat','weapon.crowbar','weapon.machete','weapon.kick','weapon.army-mg']) if (properties.some(p=>p.name==='actionId')) events.push({...event,actionId});
}
for (const event of events.slice()) if (event.type === 'combat.hit' || event.type === 'combat.kill') events.push({...event, actionId: 'cure'});
for (const type of Object.keys(eventCues)) if (!events.some(e=>e.type===type)) throw new Error(`Uncovered event: ${type}`);
const output=[];
for (const event of events) for (const context of ['ordinary','L5-quiet','mega','silent']) {
 const calls=[]; const record=method=>(...args)=>{calls.push([method,...args]);return null;};
 const entity={id:1,archetype:'infected.runner',faction:'infected',infected:{},health:{current:50,max:100},transform:position,survivor:{variant:'female'}};
 if(context==='mega') {entity.archetype='infected.mega-alpha'; entity.infected.pursuit={}; entity.vehicle={floor:true,stage:3};}
 const service=Object.create(AudioService.prototype);
 Object.assign(service, { world:{entities:{get:id=>({...entity,id})},weather:{kind:'snow',rain:1}},context:{currentTime:50}, graph:{map:{zones:[],surfaces:[],buildings:[]},listener:{x:0,z:0},duck:record('duck'),tinnitus:record('tinnitus'),buses:{ambience:{gain:{setTargetAtTime:record('ambienceGain')}}}},alarm:{onEvent:()=>false},arc:null,level:context==='L5-quiet'?'L5':'L1',l5Music:false,settings:{tinnitus:true},corgiWarnAt:new Map(),ambienceDuckUntil:0,attackMusicUntil:0,externalIntensity:null,complete:false,incident:false,available:()=>context!=='silent',host:{offscreen:()=>true},offscreen:()=>true,play:record('play'),loop:record('loop'),stopLoop:record('stopLoop'),caption:record('caption'),ring:record('ring'),haptic:record('haptic'),musicIntensity:record('musicIntensity'),stinger:record('stinger'),pickupFanfare:record('pickupFanfare'),update:record('update') });
 if(Mapper)service.eventMapper=new Mapper({...service, arc: () => service.arc, level: () => service.level, l5Music: () => service.l5Music});
 try {service.event(event);} catch(error){throw new Error(`${event.type} ${context}: ${error.stack}`);}
 const state=service.eventMapper??service;
 output.push({event,context,calls,state:Object.fromEntries(['ambienceDuckUntil','attackMusicUntil','externalIntensity','complete','incident'].map(k=>[k,state[k]])),corgiWarnAt:[...state.corgiWarnAt]});
}
mkdirSync('test-results/code-seams-2',{recursive:true});
writeFileSync('test-results/code-seams-2/cues.json',JSON.stringify({types:[...new Set(events.map(e=>e.type))].sort(),cases:output},null,2));
console.log(`${new Set(events.map(e=>e.type)).size} types, ${output.length} event/context cases`);
