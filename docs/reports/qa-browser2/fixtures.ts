/** Focused rendered follow-ups. Explicit fixtures; not campaign completion proofs. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SceneSession,stopServer} from '../../../tools/scenelab/session';
import type {SceneSpec} from '../../../src/debug/scenelab/spec';
import {vehicleDef} from '../../../src/data/vehicles';
const [tier='low',backend='webgl2']=process.argv.slice(2),root='docs/reports/qa-browser2',tag=`fixtures-${tier}-${backend}`,raw=`/private/tmp/qa-browser2/${tag}`;mkdirSync(raw,{recursive:true});
const s=new SceneSession({tier:tier as 'low'|'high',backend:backend as 'webgl2'|'webgpu',viewport:{width:1280,height:720}});
const receipt:any={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tier,backend,method:'Controlled Scene Lab fixtures with production rendering; god/idle actors and forced specials are fixture setup. Physical E boards APC. No performance claim.',captures:[],rows:[],errors:[]};
receipt.producerSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
async function photo(label:string,level:string){for(const zoom of [1,1.5]){
 await s.page.evaluate(async z=>{window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom:z});window.__SS__!.camera.zoom(z);await window.__SS__!.screenshotReady();},zoom);
 const state=await s.page.evaluate(()=>{const a=window.__SS__!,g=window.__SCENE__.game,w=g.world,p=w.entities.get(1),l=g.view.lighting;return{tick:w.tick,position:p?.transform,hp:p?.health.current,actors:w.infected?.active.map(e=>({id:e.id,hp:e.health.current,at:{...e.transform},type:e.archetype,state:e.infected?.state})),backend:a.perf().backend,quality:a.getState().render.quality,camera:a.getState().render.camera,bars:a.getState().render.healthBars,vehicles:a.getState().render.vehicles,selected:l.heroLight,shadows:{maps:Number(l.sun.visible&&l.sun.shadow.autoUpdate)+Number(l.spot.visible&&l.spot.shadow.autoUpdate),source:l.spot.position.toArray(),target:l.spot.target.position.toArray()},draws:a.perf().drawCalls,triangles:a.perf().triangles,events:a.events(0).filter(e=>['telegraph','infected.special','prop.thrown','combat.hit'].includes(e.type)).slice(-20)};});
 const file=`${raw}/${String(receipt.captures.length).padStart(3,'0')}-${label}-z${zoom}.jpg`;await s.page.screenshot({path:file,type:'jpeg',quality:82});receipt.captures.push({file,label,level,requestedZoom:zoom,state,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
 }writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));}
async function scene(spec:SceneSpec,frames:number[],level='L10'){
 await s.load(spec);let at=0;for(const f of frames){await s.step(f-at);at=f;await photo(`${spec.name}-f${f}`,level);}receipt.rows.push({name:spec.name,metrics:await s.metrics(),clipping:await s.clipping()});
}
try{
 await s.open();const originalLoad=s.load.bind(s);s.load=spec=>originalLoad({...spec,layout:spec.layout??{level:'L3',district:'D-CORRIDOR',ids:[]}});await s.page.evaluate('window.__name=f=>f');
 const def=vehicleDef('vehicle.military-apc');
 await s.load({name:'APC-cab',ground:'asphalt',size:100,vehicles:[{id:'apc',asset:def.id,at:[0,0]}],actors:[{id:'courier',kind:'courier',at:[def.doorX,def.width/2+.55]}],camera:{mode:'follow',actor:'courier',zoom:1},frames:0});
 await s.page.keyboard.down('KeyE');await s.page.evaluate(()=>window.__SS__!.step(1));await s.page.keyboard.up('KeyE');await s.page.evaluate(()=>window.__SS__!.step(60));
 if(!await s.page.evaluate(()=>window.__SCENE__.game.world.vehicles!.active!==null))throw Error('Physical APC entry failed');
 await photo('APC-physical-entry','L9');
 for(const azimuth of [80,110]){await s.page.evaluate(azimuth=>window.__SCENE__.setCamera({mode:'close',target:[0,1,0],radius:7,azimuth}),azimuth);await photo(`APC-front-${azimuth}`,'L9');}
 await s.load({name:'headlights',ground:'asphalt',size:150,time:'night',dof:false,vehicles:[{id:'apc',asset:def.id,at:[0,0],path:[[100,0]],driven:true}],actors:[{id:'target',kind:'infected',at:[12,0],state:'idle'}],camera:{mode:'game',target:'apc',zoom:1},frames:0});
 let previous=0;for(const tick of [21,51,120,600]){await s.step(tick-previous);previous=tick;await photo(`APC-headlights-t${tick}`,'L9');}
 const farm:SceneSpec={name:'farm-assets',ground:'grass',size:100,time:'night',actors:[{id:'courier',kind:'courier',at:[0,0]}],props:[{id:'barn',asset:'bld.farm-barn-ruin',at:[-5,-7]},{id:'house',asset:'bld.farm-house-ruin',at:[8,-7]},{id:'tractor',asset:'prop.farm-tractor',at:[-4,4]},{id:'combine',asset:'prop.farm-combine',at:[7,5]}],camera:{mode:'game',target:'courier',zoom:1},frames:0};await scene(farm,[1]);
 await scene({...farm,name:'corn',props:[{id:'corn-a',asset:'veg.corn-block',at:[-5,0]},{id:'corn-b',asset:'veg.corn-block',at:[5,0]},{id:'lamp',asset:'prop.street-lamp',at:[1,-3]}]},[1,60]);
 const flame=JSON.parse(readFileSync('docs/reports/r15-flamer/scene.json','utf8'));flame.time='night';flame.name='flame';flame.actors.find((a:any)=>a.id==='target').at=[5.2,0];await scene(flame,[24,45,75,120]);
 const variants:SceneSpec={name:'Alpha-types',ground:'asphalt',size:60,time:'night',actors:[{id:'courier',kind:'courier',at:[0,4]},...(['brute','thrower','screamer','leaper','armoured'] as const).map((alphaType,i)=>({id:alphaType,kind:'infected' as const,archetype:'infected.alpha',alphaType,at:[(i-2)*3,0] as [number,number],state:'idle' as const}))],camera:{mode:'game',target:[0,0],zoom:1},frames:0};await scene(variants,[1]);
 const base=JSON.parse(readFileSync('tests/scenes/alpha-s3/qa-alpha-grab-throw.json','utf8')) as SceneSpec;
 for(const [type,move]of [['brute','alpha.ground-slam'],['thrower','alpha.grab-throw'],['thrower','alpha.living-missile'],['screamer','alpha.roar'],['leaper','alpha.pounce'],['armoured','alpha.shield-bash']] as const){
  const spec=structuredClone(base);spec.name=`${type}-${move}`;spec.time='night';spec.frames=180;spec.actors!.find(a=>a.id==='alpha')!.alphaType=type;spec.camera={mode:'game',target:[0,0],zoom:1};spec.script=[...(move==='alpha.grab-throw'?[{frame:0,actor:'body',do:{corpse:true}}]:[]),{frame:10,actor:'alpha',do:{special:move,target:'courier'}}] as any;
  await scene(spec,[10,40,60,90,150]);
 }
 await s.load({name:'G24',ground:'asphalt',size:80,time:'night',actors:[{id:'courier',kind:'courier',at:[0,0]},{id:'alpha',kind:'infected',archetype:'infected.alpha',at:[11.314,-11.314],state:'idle'}],camera:{mode:'game',target:[5.657,-5.657],zoom:1},frames:0});
 await photo('G24-far-full','L10');
 await s.page.evaluate(()=>{const e=window.__SCENE__.game.world.infected!.active[0];e.transform.x=7.071;e.transform.z=-7.071;});await photo('G24-near-full','L10');
 await s.page.evaluate(()=>{const e=window.__SCENE__.game.world.infected!.active[0];e.transform.x=11.314;e.transform.z=-11.314;});
 await s.page.evaluate(()=>{const w=window.__SCENE__.game.world,e=w.infected!.active[0];e.health.current--;});await photo('G24-far-damaged','L10');
 await s.page.evaluate(()=>{const w=window.__SCENE__.game.world,e=w.infected!.active[0];e.health.current=0;});await photo('G24-dead','L10');
 await s.load({name:'G24-riot',ground:'asphalt',size:80,time:'night',actors:[{id:'courier',kind:'courier',at:[0,0]},{id:'riot',kind:'infected',archetype:'infected.riot',at:[11.314,-11.314],state:'idle'}],camera:{mode:'game',target:[5.657,-5.657],zoom:1},frames:0});await photo('G24-riot-16m','L10');
 /* Healthy zoo animal control blocked by L8 assets. await s.load({name:'G24-animal',ground:'asphalt',size:80,time:'night',actors:[{id:'courier',kind:'courier',at:[0,0]},{id:'lion',kind:'animal',species:'lion',at:[7.071,-7.071]}],camera:{mode:'game',target:[3.5,-3.5],zoom:1},frames:0});await photo('G24-healthy-animal','L10'); */
 const mist=JSON.parse(readFileSync('tests/scenes/catalog/l10-cure-mist.json','utf8')) as SceneSpec;await scene(mist,[10,30,90,180,320,470]);
 const mega=JSON.parse(readFileSync('tests/scenes/catalog/r15-megarun.json','utf8')) as SceneSpec;
 for(const[direction,at]of[['toward',[40,40]],['away',[-40,-40]],['across',[40,-40]]]as const)await scene({...mega,name:`Mega-lope-${direction}`,actors:[{id:'courier',kind:'courier',at:[...at],god:true}]},[60,66,72,78,84,90]);
 const height:SceneSpec={name:'height-platform',ground:'asphalt',size:80,time:'night',props:[{id:'platform',asset:'kit.dispersal-platform',at:[0,0]}],actors:[{id:'courier',kind:'courier',at:[-2,0],floorY:3,god:false},{id:'runner',kind:'infected',at:[-2,0],floorY:0,state:'chase'},{id:'dog',kind:'infected',archetype:'infected.dog',at:[0,0],floorY:0,state:'chase'},{id:'alpha',kind:'infected',archetype:'infected.alpha',alphaType:'brute',at:[0,2],floorY:0,state:'chase'}],camera:{mode:'game',target:[0,0],zoom:1},frames:0};
 await scene(height,[1,60,240,600]);
 await scene({...height,name:'height-flat-control',props:[],actors:[{id:'courier',kind:'courier',at:[0,0],god:false},{id:'runner',kind:'infected',at:[1,0],state:'chase'}]},[1,60,120]);
}catch(e){receipt.errors.push(String(e));console.error(e);process.exitCode=1;}
finally{receipt.errors.push(...s.errors);writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));await s.close();stopServer();console.log(JSON.stringify({tag,captures:receipt.captures.length,errors:receipt.errors}));}
