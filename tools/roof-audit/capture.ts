import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Vector3 } from 'three';
import { cameraFraming } from '../../src/data/cameraFraming';
import { SceneSession, stopServer } from '../scenelab/session';
const baseline=process.env.ROOF_BASELINE??'5a9d26820dbf913734c06aeb23f82188b25ad425';
const phase = process.argv[2] ?? 'before';
const dir = `docs/scenes/l3-roofs/${phase}`; mkdirSync(dir, { recursive: true });
const affected=new Set(['bld.pharmacy','bld.supermarket','int.basement-cellar']);
const sweep=JSON.parse(readFileSync('docs/scenes/l3-roofs/sweep.json','utf8')) as {placements:{level:string;id:string;asset:string;position:number[]}[]};
const session = new SceneSession({ viewport: { width: 1280, height: 720 } });
const offset=new Vector3().setFromSphericalCoords(cameraFraming.radiusM,cameraFraming.polar,Math.PI/4).toArray();
const evidence:unknown[]=[];
/** The new exterior contract requires a roof anchor. An empty anchor keeps baseline geometry unchanged. */
function baselineShell(bytes: Buffer): Buffer {
 const length=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+length).toString());
 const index=json.nodes.length;json.nodes.push({name:'roof'});json.scenes[0].nodes.push(index);
 const data=Buffer.from(JSON.stringify(json)), padded=Buffer.alloc(Math.ceil(data.length/4)*4,0x20);data.copy(padded);
 const chunk=Buffer.alloc(8);chunk.writeUInt32LE(padded.length);chunk.writeUInt32LE(0x4e4f534a,4);
 const tail=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,12));header.writeUInt32LE(20+padded.length+tail.length,8);
 return Buffer.concat([header,chunk,padded,tail]);
}
try {
 await session.open();
 if (phase === 'before') {
  await session.page.route('**/assets/models/*.glb', async route => {
   const path = new URL(route.request().url()).pathname;
   const replacement = path.replace('bld.pharmacy', 'int.pharmacy-clinic').replace('bld.supermarket', 'int.supermarket').replace('bld.gym', 'int.gym-cafeteria');
   if (/int.basement-cellar/.test(path)) return route.fulfill({body:execFileSync('git',['show',`${baseline}:public${path}`]),contentType:'model/gltf-binary'});
   if (replacement === path) return route.continue();
   await route.fulfill({ body: baselineShell(readFileSync(`public${replacement}`)), contentType: 'model/gltf-binary' });
  });
  const original=JSON.parse(execFileSync('git',['show',`${baseline}:src/assets/staticBakes.json`]).toString()) as Record<string,string>;
  await session.page.route('**/assets/statics/*.bin.gz', async route=>{
   const path=new URL(route.request().url()).pathname;
   const match=path.match(/\/(bld\.(?:pharmacy|supermarket))\.(lod[12])\.base\./);
   if(!match)return route.continue();
   await route.fulfill({body:readFileSync(`public${original[`${match[1]}:${match[2]}:`]}`),contentType:'application/octet-stream'});
  });
 }
 for(const level of ['L3','L2','L4','L5']) {
  const anchors=await session.inspectLevel(level);
  await session.page.addStyleTag({content:'#hud,.hud,[data-testid=inspection],[data-lookdev=panel],.tp-dfwv,.story-bubble,.mission-subtitle,[data-testid=mission-button]{visibility:hidden!important}'});
  writeFileSync(`${dir}/${level}-anchors.json`,JSON.stringify(anchors,null,2));
  for(const placement of sweep.placements.filter(p=>p.level===level&&affected.has(p.asset))) {
   const [x,y,z]=placement.position;
   // The eastern apartment/bakery obscures these lids from 45°. Keep the game
   // radius/elevation and inspect from its opposite azimuth. Cellar's L5 spawn
   // is inside: move the courier outside before checking the closed roof.
   const opposite=placement.asset==='int.basement-cellar'||level==='L3'&&['bld.pharmacy:4','bld.pharmacy:10','bld.pharmacy:16','bld.pharmacy:22'].includes(placement.id);
   const viewOffset=opposite?[-offset[0],offset[1],-offset[2]]:offset;
   if(placement.asset==='int.basement-cellar')await session.page.evaluate(({x,z})=>window.__SS__!.teleport('player',{x,z:z-12}),{x,z});
   await session.page.evaluate(({x,y,z,offset})=>{const api=window.__SS__!;api.inspect.timeScale(0);api.inspect.lod('game');api.inspect.setCamera({position:[x+offset[0],y+offset[1],z+offset[2]],target:[x,y,z]});},{x,y,z,offset:viewOffset});
   await session.page.evaluate(()=>window.__SS__!.screenshotReady());
   const name=`${level}-${placement.id.replaceAll(':','-')}.jpg`;
   await session.page.screenshot({path:`${dir}/${name}`,type:'jpeg',quality:80});
   evidence.push({...placement,cameraOffset:viewOffset,file:name,inspection:await session.page.evaluate(()=>window.__SS__!.inspect.state())});
  }
  console.log(`${phase}: ${level} placements captured`);
 }
 for (const asset of ['bld.pharmacy','bld.supermarket','bld.gym','int.basement-cellar']) {
  await session.load({name:asset,time:'L3',ground:'sidewalk',props:[{asset,at:[0,0]}],actors:[{kind:'courier',at:[12,9]}],camera:{mode:'game',target:[0,0],zoom:asset==='bld.gym'?1.6:1},dof:false});
  await session.step(1);await session.screenshot(`${dir}/${asset}.png`);
  if(phase==='after') {
   await session.load({name:`${asset}-inside`,time:'L3',ground:'sidewalk',props:[{id:'occupied',asset,at:[0,0]},{id:'neighbour',asset,at:[16,0]}],actors:[{kind:'courier',at:[12,9]}],camera:{mode:'game',target:[8,0],zoom:2.4},dof:false});
   await session.page.evaluate(()=>window.__SS__!.teleport('player',{x:0,z:0}));
   await session.step(1);await session.screenshot(`${dir}/${asset}-inside.png`);
  }
 }
 writeFileSync(`${dir}/captures.json`,JSON.stringify({offset,evidence,errors:session.errors},null,2));
 if(session.errors.length)throw new Error(session.errors.join('\n'));
} finally { await session.close(); stopServer(); }
