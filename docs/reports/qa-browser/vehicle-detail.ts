import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
import { vehicles, vehicleDef } from '../../../src/data/vehicles';
const out='docs/reports/qa-browser/vehicles';mkdirSync(out,{recursive:true});
const rows:unknown[]=[];const s=new SceneSession({tier:'high',backend:'webgl2'});
async function key(keys:string[],ticks:number){for(const k of keys)await s.page.keyboard.down(k);try{await s.page.evaluate(n=>window.__SS__!.step(n),ticks);}finally{for(const k of keys)await s.page.keyboard.up(k);}}
async function board(){await s.page.evaluate(()=>window.__SS__!.input.clear());await key(['KeyE'],1);await s.page.evaluate(()=>window.__SS__!.step(60));if(!(await state()).car)throw Error('Physical door entry failed');}
async function state(){return s.page.evaluate(()=>{const a=window.__SS__!,w=window.__SCENE__.game.world,car=w.entities.get(w.vehicles.active);return{tick:w.tick,car:car&&{at:{...car.transform},vehicle:{...car.vehicle}},props:w.props.items.map(p=>({id:p.id,asset:p.assetId,fixed:p.fixed,awake:p.awake,at:[...p.pose.p],nav:w.props.navWalls.get(p.entityId)})),awake:w.props.items.filter(p=>p.awake).length,budget:w.props.awakeBudget};});}
try{
 await s.open();
 for(const def of vehicles){
  await s.load({name:`detail-${def.id}`,ground:'asphalt',size:120,vehicles:[{id:'car',asset:def.id,at:[0,0],yaw:0}],actors:[{id:'courier',kind:'courier',at:[def.doorX,def.width/2+.55]}],camera:{mode:'close',target:[0,1,0],radius:Math.max(8,def.length*.9+3),azimuth:80},frames:60});
  await board();const file=`detail-${def.id}.jpg`;writeFileSync(`${out}/${file}`,await s.snapshot());
  rows.push({kind:'front-close',vehicle:def.id,file,...await state(),view:await s.page.evaluate(()=>window.__SS__!.getState().render.vehicles)});
  if(def.id==='vehicle.military-apc'){
   await s.page.evaluate(()=>window.__SCENE__.setCamera({mode:'close',target:[0,1,0],radius:7,azimuth:110}));writeFileSync(`${out}/detail-apc-front.jpg`,await s.snapshot());
   await s.page.evaluate(()=>window.__SCENE__.setCamera({mode:'follow',actor:'courier',zoom:1.5}));
   await key(['ArrowUp'],240);const forward=await state();
   const reverse=[];for(let i=0;i<24;i++){await key(['ArrowDown'],10);reverse.push(await state());}
   rows.push({kind:'brake-reverse',forward,reverse,pass:forward.car.vehicle.forwardSpeed>0&&reverse.some(v=>v.car.vehicle.braking)&&reverse.at(-1).car.vehicle.forwardSpeed<0});
  }
 }
 for(const asset of ['prop.traffic-cone','prop.folding-chair','prop.cure-drum-stack','prop.jersey-barrier','prop.privacy-fence','bld.house-a']){
  await s.load({name:`contact-${asset}`,ground:'asphalt',size:140,vehicles:[{id:'car',asset:'vehicle.military-apc',at:[0,0],yaw:0}],actors:[{id:'courier',kind:'courier',at:[vehicleDef('vehicle.military-apc').doorX,vehicleDef('vehicle.military-apc').width/2+.55]}],props:[{id:'target',asset,at:[15,0],yaw:0}],camera:{mode:'follow',actor:'courier',zoom:1.5},frames:60});
  await board();const before=await state();await key(['KeyD','KeyS'],240);const contact=await state();
  await s.page.evaluate(()=>window.__SS__!.step(600));const settled=await state();
  const file=`contact-${asset}.jpg`;writeFileSync(`${out}/${file}`,await s.snapshot());
  const movable=['prop.traffic-cone','prop.folding-chair','prop.cure-drum-stack'].includes(asset),p=contact.props.find(p=>p.asset===asset),p0=before.props.find(p=>p.asset===asset);
  const displacement=p&&p0?Math.hypot(p.at[0]-p0.at[0],p.at[2]-p0.at[2]):0;
  rows.push({kind:'prop-contact',asset,movable,file,before,contact,settled,displacement,pass:contact.awake<=contact.budget&&(movable?displacement>.2:contact.car.at.x>5&&contact.car.at.x<15)});
 }
 const props=Array.from({length:20},(_,i)=>({id:`cone${i}`,asset:'prop.traffic-cone',at:[8+Math.floor(i/4)*2,(i%4-1.5)*.6] as [number,number]}));
 await s.load({name:'awake-cap',ground:'asphalt',size:140,vehicles:[{id:'car',asset:'vehicle.military-apc',at:[0,0]}],actors:[{id:'courier',kind:'courier',at:[vehicleDef('vehicle.military-apc').doorX,vehicleDef('vehicle.military-apc').width/2+.55]}],props,camera:{mode:'follow',actor:'courier',zoom:1.5},frames:60});
 await board();const samples=[];for(let i=0;i<60;i++){await key(['KeyD','KeyS'],6);samples.push(await state());}
 rows.push({kind:'awake-cap',peak:Math.max(...samples.map(v=>v.awake)),budget:12,pass:samples.every(v=>v.awake<=12)});
 console.log(JSON.stringify(rows.map(r=>({kind:r.kind,vehicle:r.vehicle,asset:r.asset,pass:r.pass}))));
}catch(error){rows.push({error:String(error)});console.error(error);process.exitCode=1;}
finally{writeFileSync(`${out}/detail-receipt.json`,JSON.stringify({rows,errors:s.errors},null,2));await s.close();stopServer();}
