/** Focused rendered follow-ups. Explicit fixtures; not campaign completion proofs. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SceneSession,stopServer} from '../../../tools/scenelab/session';
import type {SceneSpec} from '../../../src/debug/scenelab/spec';
import {vehicleDef} from '../../../src/data/vehicles';
const [tier='low',backend='webgl2']=process.argv.slice(2),root='docs/reports/r17-polish',tag=`APC-${tier}-${backend}`,raw=`/private/tmp/r17-polish/${tag}`;mkdirSync(raw,{recursive:true});
const s=new SceneSession({tier:tier as 'low'|'high',backend:backend as 'webgl2'|'webgpu',viewport:{width:1280,height:720}});
const receipt:any={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tier,backend,method:'Controlled Scene Lab fixtures with production rendering; god/idle actors and forced specials are fixture setup. Physical E boards APC. No performance claim.',captures:[],rows:[],errors:[]};
receipt.producerSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
receipt.workingSourceDiff=execFileSync('git',['diff','--','src'],{encoding:'utf8'});
receipt.producerSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
async function photo(label:string,level:string){for(const zoom of [1,1.5]){
 await s.page.evaluate(async z=>{window.__SCENE__.setCamera({...window.__SCENE__.camera,zoom:z});window.__SS__!.camera.zoom(z);await window.__SS__!.screenshotReady();},zoom);
 const state=await s.page.evaluate(()=>{const a=window.__SS__!,g=window.__SCENE__.game,w=g.world,p=w.entities.get(1),l=g.view.lighting;return{tick:w.tick,position:p?.transform,hp:p?.health.current,actors:w.infected?.active.map(e=>({id:e.id,hp:e.health.current,at:{...e.transform},type:e.archetype,state:e.infected?.state})),backend:a.perf().backend,quality:a.getState().render.quality,camera:a.getState().render.camera,bars:a.getState().render.healthBars,vehicles:a.getState().render.vehicles,selected:l.heroLight,shadows:{maps:Number(l.sun.visible&&l.sun.shadow.autoUpdate)+Number(l.spot.visible&&l.spot.shadow.autoUpdate),source:l.spot.position.toArray(),target:l.spot.target.position.toArray()},draws:a.perf().drawCalls,triangles:a.perf().triangles,events:a.events(0).filter(e=>['telegraph','infected.special','prop.thrown','combat.hit'].includes(e.type)).slice(-20)};});
 if(state.backend!==(backend==='webgl2'?'webgl':'webgpu')||state.quality!==tier)throw Error('Backend/quality mismatch');const file=`${raw}/${String(receipt.captures.length).padStart(3,'0')}-${label}-z${zoom}.jpg`;await s.page.screenshot({path:file,type:'jpeg',quality:82});receipt.captures.push({file,label,level,requestedZoom:zoom,state,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
 }writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));}
async function scene(spec:SceneSpec,frames:number[],level='L10'){
 await s.load(spec);let at=0;for(const f of frames){await s.step(f-at);at=f;await photo(`${spec.name}-f${f}`,level);}receipt.rows.push({name:spec.name,metrics:await s.metrics(),clipping:await s.clipping()});
}
try{await s.open();await s.page.evaluate('window.__name=f=>f');const originalLoad=s.load.bind(s);s.load=spec=>originalLoad({...spec,layout:spec.layout??{level:'L3',district:'D-CORRIDOR',ids:[]}});
 const def=vehicleDef('vehicle.military-apc');
 await s.load({name:'APC-cab',ground:'asphalt',size:100,vehicles:[{id:'apc',asset:def.id,at:[0,0]}],actors:[{id:'courier',kind:'courier',at:[def.doorX,def.width/2+.55]}],camera:{mode:'follow',actor:'courier',zoom:1},frames:0});
 await s.page.keyboard.down('KeyE');await s.page.evaluate(()=>window.__SS__!.step(1));await s.page.keyboard.up('KeyE');await s.page.evaluate(()=>window.__SS__!.step(60));
 if(!await s.page.evaluate(()=>window.__SCENE__.game.world.vehicles!.active!==null))throw Error('Physical APC entry failed');
 await photo('APC-physical-entry','L9');
 for(const azimuth of [80,110]){await s.page.evaluate(azimuth=>window.__SCENE__.setCamera({mode:'close',target:[0,1,0],radius:7,azimuth}),azimuth);await photo(`APC-front-${azimuth}`,'L9');}
}catch(e){receipt.errors.push(String(e));console.error(e);process.exitCode=1;}
finally{receipt.errors.push(...s.errors);writeFileSync(`${root}/${tag}.json`,JSON.stringify(receipt));await s.close();stopServer();console.log(JSON.stringify({tag,captures:receipt.captures.length,errors:receipt.errors}));}
