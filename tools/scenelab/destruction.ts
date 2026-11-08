/** One browser, current source, four L3 gameplay captures; no video or trace. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession, stopServer } from './session';
import { loadL3 } from '../sim-runner/l3Bots';
import { rotate } from '../../src/sim/destruction/Destruction';
const out='docs/reports/r13-destruction', session=new SceneSession({backend:'webgl2',tier:'low',seed:17,viewport:{width:960,height:600}});
const {world}=await loadL3(17,'low'), objects=world.destruction!.objects.filter(o=>!o.protected);
const house=objects.find(o=>o.placement.assetId==='bld.house-a')!,car=objects.find(o=>o.placement.assetId==='veh.sedan-green')!;
const h=house.home.p, c=car.home.p, b=house.parts.find(p=>p.id==='window_front')!.bounds;
const shot=rotate([b.max[0]+2,1.2,(b.min[2]+b.max[2])/2],house.home.q),dir=rotate([-1,0,0],house.home.q);
world.dispose(); const images: Buffer[]=[]; const receipts:unknown[]=[];
async function capture(label:string){await session.page.evaluate(()=>window.__SS__!.step(1));await session.ready();images.push(await session.page.screenshot({type:'png'}));receipts.push({label,...await session.page.evaluate(()=>({destruction:window.__SS__!.getState().destruction,perf:window.__SS__!.perf()}))});}
try {
  await session.open();await session.page.evaluate(async()=>{const a=window.__SS__!;await a.loadLevel('L3',{seed:17,progression:'L3-default'});a.pause();a.bot.stop();a.cheats.god(true);a.settings.set({bloom:false,cheapDof:false});});
  await session.page.evaluate(({h,shot})=>{const a=window.__SS__!;a.teleport('player',{x:h[0]+shot[0],z:h[2]+shot[2]});a.camera.cinematic({position:[h[0]+16,14,h[2]+16],target:[h[0],1.5,h[2]]},true);},{h,shot});
  await capture('Intact Oak Street house');
  await session.page.evaluate(async({dir})=>{const a=window.__SS__!;a.setLoadout(['weapon.handgun'],['weapon.grenade']);a.input.set({aim:{x:dir[0],z:dir[2]},aimSource:'pointer',left:{down:true,held:true,up:false}});await a.step(40);a.input.clear();},{dir});
  await capture('Handgun: broken front glass and local impact marks');
  if(!await session.page.evaluate(({id,part})=>window.__SS__!.getState().destruction?.find(o=>o.id===id)?.state.hp[part]===0,{id:house.id,part:house.parts.findIndex(p=>p.id==='window_front')}))throw new Error('Handgun capture did not shatter the front window');
  await session.page.evaluate(async h=>{const a=window.__SS__!;a.setLoadout(['weapon.rocket-launcher'],['weapon.grenade']);a.cheats.infiniteCharges(true);a.input.set({aimPoint:{x:h[0],z:h[2]},aimSource:'pointer',left:{down:true,held:true,up:false}});await a.step(75);a.input.clear();await a.step(120);},h);
  await capture('Rocket: breached facade and collapsed roof');
  if(!await session.page.evaluate(id=>window.__SS__!.getState().destruction?.find(o=>o.id===id)?.state.collapsed,house.id))throw new Error('Rocket capture did not collapse the house');
  await session.page.evaluate(async c=>{const a=window.__SS__!;a.teleport('player',{x:c[0]+5,z:c[2]+5});a.camera.cinematic({position:[c[0]+10,9,c[2]+10],target:[c[0],.7,c[2]]},true);a.setLoadout(['weapon.handgun'],['weapon.molotov']);a.input.set({aim:{x:-.7071,z:-.7071},aimPoint:{x:c[0],z:c[2]},aimSource:'pointer',right:{down:true,held:true,up:false}});await a.step(1);a.input.clear();await a.step(450);},c);
  await capture('Molotov: car burns, explodes, leaves a moving wreck');
  if(!await session.page.evaluate(id=>window.__SS__!.getState().destruction?.find(o=>o.id===id)?.state.exploded,car.id))throw new Error('Molotov capture did not explode the parked car');
  const sheet=new PNG({width:960,height:600});for(let i=0;i<images.length;i++){const src=PNG.sync.read(images[i]);for(let y=0;y<300;y++)for(let x=0;x<480;x++){const from=((y*2)*src.width+x*2)*4,to=((y+Math.floor(i/2)*300)*sheet.width+x+(i%2)*480)*4;src.data.copy(sheet.data,to,from,from+4);}}
  mkdirSync(out,{recursive:true});writeFileSync(`${out}/sheet.png`,PNG.sync.write(sheet));writeFileSync(`${out}/capture.json`,JSON.stringify({backend:'webgl2',tier:'low',errors:session.errors,receipts},null,2));
  console.log(JSON.stringify({errors:session.errors,captures:receipts.length,sheet:`${out}/sheet.png`}));if(session.errors.length)process.exitCode=1;
} finally {await session.close();stopServer();}
