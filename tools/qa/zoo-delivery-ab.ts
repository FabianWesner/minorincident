/** Settled game-camera sheets for both delivery tiers. Use SCENE_PORT for each frozen build. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession } from '../scenelab/session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const variant=process.argv[2] ?? 'after',out=`test-results/followups-25/zoo-ab/${variant}`;
mkdirSync(out,{recursive:true});
for(const tier of ['low','high'] as const){
 const session=new SceneSession({backend:'webgpu',tier,viewport:{width:800,height:600}});
 const cells:Buffer[]=[],receipts=[];
 try{
 await session.open();
 for(const species of ['lion','gorilla','elephant','zebra','flamingo']){
 const spec:SceneSpec={name:`zoo-delivery-${species}`,seed:8,ground:'asphalt',time:'L4',size:60,dof:false,actors:[{id:'courier',kind:'courier',at:[25,25]},{id:'healthy',kind:'animal',species:species as 'lion',at:[-3,0],yaw:-45,state:'idle'},{id:'infected',kind:'infected',archetype:`infected.${species}`,look:{model:`inf.${species}`},at:[3,0],yaw:-45,state:'idle'}],camera:{mode:'game',target:[0,.8,0],zoom:1.5},frames:3};
 await session.load(spec);await session.step(3);await session.ready();
 const metrics=await session.metrics();assert.ok(metrics.actors.healthy.drawnFrames>0&&metrics.actors.infected.drawnFrames>0,`${species}: missing body`);
 cells.push(await session.screenshot(`${out}/${tier}-${species}.png`));receipts.push({species,metrics,errors:session.errors});
 console.log(`${variant}/${tier}/${species}`);
 }
 const sheet=new PNG({width:800*5,height:600});cells.forEach((cell,i)=>PNG.bitblt(PNG.sync.read(cell),sheet,0,0,800,600,i*800,0));writeFileSync(`${out}/${tier}-sheet.png`,PNG.sync.write(sheet));
 writeFileSync(`${out}/${tier}.json`,JSON.stringify(receipts,null,2));
 }finally{await session.close();}
}
