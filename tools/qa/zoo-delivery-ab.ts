/** Settled game-camera sheets for both delivery tiers. Use SCENE_PORT for each frozen build. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SceneSession } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
const alphasOnly=process.argv.includes('--alphas-only'),mixedOnly=process.argv.includes('--mixed-only');
const variant=process.argv[2] ?? 'after',out=`test-results/followups-25/zoo-ab/${variant}`;
mkdirSync(out,{recursive:true});
for(const tier of ['low','high'] as const){
 const session=new SceneSession({backend:'webgpu',tier,viewport:{width:800,height:600}});
 const cells:Buffer[]=[],receipts=[];
 try{
 await session.open(); await session.page.evaluate('window.__name=f=>f');
 // Exercise the production L8 crowd policy while retaining Scene Lab's fixed actors/camera.
 await session.page.evaluate(()=>{
   const game=(window.__SCENE__ as unknown as {game:Game}).game,load=game.loadLevel.bind(game);
   game.loadLevel=(id,opts,performanceScenario,speculative)=>load(id,{...opts,setup:world=>{opts?.setup?.(world);world.scenario='L8';}},performanceScenario,speculative);
 });
 if(!alphasOnly&&!mixedOnly) for(const species of ['lion','gorilla','elephant','zebra','flamingo']){
 const spec:SceneSpec={name:`zoo-delivery-${species}`,seed:8,ground:'asphalt',time:'L8-zoo',size:60,dof:false,actors:[{id:'courier',kind:'courier',at:[25,25]},{id:'healthy',kind:'animal',species:species as 'lion',at:[-3,0],yaw:-45,state:'idle'},{id:'infected',kind:'infected',archetype:`infected.${species}`,look:{model:`inf.${species}`},at:[3,0],yaw:-45,state:'idle'}],camera:{mode:'game',target:[0,.8,0],zoom:1.5},frames:3};
 await session.load(spec);await session.step(3);await session.ready();
 const metrics=await session.metrics();assert.ok(metrics.actors.healthy.drawnFrames>0&&metrics.actors.infected.drawnFrames>0,`${species}: missing body`);
 cells.push(await session.screenshot(`${out}/${tier}-${species}.png`));receipts.push({species,metrics,errors:session.errors});assert.deepEqual(session.errors,[],`${species}: renderer errors`);
 console.log(`${variant}/${tier}/${species}`);
 }
 if(!alphasOnly) {
 const species=['lion','gorilla','elephant','zebra','flamingo'];
 const actors:NonNullable<SceneSpec['actors']>=[{id:'courier',kind:'courier',at:[0,-18]}];
 const places=[[-6,0],[0,0],[6,0],[-3,7],[3,7]];
 for(const [i,name] of species.entries()) {
   actors.push({id:`healthy-${name}`,kind:'animal',species:name as 'lion',at:[places[i][0],places[i][1]-2],yaw:-45,state:'idle'});
   actors.push({id:`infected-${name}`,kind:'infected',archetype:`infected.${name}`,look:{model:`inf.${name}`},at:[places[i][0],places[i][1]+2],yaw:-45,state:'idle'});
 }
 await session.load({name:'zoo-mixed-atlases',seed:8,ground:'asphalt',time:'L8-zoo',size:80,dof:false,actors,camera:{mode:'game',target:[0,.8,3],zoom:2.5},frames:3});
 await session.step(3);console.log('mixed drawn',JSON.stringify(Object.fromEntries(Object.entries((await session.metrics()).actors).map(([id,a])=>[id,a.drawnFrames]))));await session.screenshot(`${out}/${tier}-mixed.png`);assert.ok(Object.entries((await session.metrics()).actors).filter(([id])=>id!=='courier').every(([,a])=>a.drawnFrames>0),'mixed animals must all be drawn');await session.screenshot(`${out}/${tier}-mixed.png`);assert.deepEqual(session.errors,[]);
 await session.page.evaluate(names=>{for(const name of names)window.__SCENE__!.command(`infected-${name}`,{corpse:true});},species);await session.step(3);await session.screenshot(`${out}/${tier}-mixed-corpses.png`);assert.ok((await session.page.evaluate(()=>window.__SS__!.getState().render.crowd))!.texturedCorpsePages>0,'mixed corpse pages must be drawn');assert.deepEqual(session.errors,[]);
 }
 if(!mixedOnly) {
 const alphaModels=['inf.alpha','inf.alpha-worker','inf.alpha-hoodie','inf.alpha-fire','inf.alpha-suit'];
 await session.load({name:'zoo-alpha-atlases',seed:8,ground:'asphalt',time:'L8-zoo',size:80,dof:false,actors:[{id:'courier',kind:'courier',at:[0,20]},...alphaModels.map((model,i)=>({id:`alpha-${i}`,kind:'infected' as const,archetype:'infected.alpha',look:{model},at:[(i-2)*4,0] as [number,number],yaw:-45,state:'idle' as const}))],camera:{mode:'game',target:[0,.9,0],zoom:2},frames:3});
 await session.step(3);assert.ok(Object.entries((await session.metrics()).actors).filter(([id])=>id!=='courier').every(([,a])=>a.drawnFrames>0),'Alpha variants must all be drawn');await session.screenshot(`${out}/${tier}-alphas.png`);assert.deepEqual(session.errors,[]);
 await session.page.evaluate(()=>{for(let i=0;i<5;i++)window.__SCENE__!.command(`alpha-${i}`,{corpse:true});});await session.step(3);await session.screenshot(`${out}/${tier}-alpha-corpses.png`);assert.ok((await session.page.evaluate(()=>window.__SS__!.getState().render.crowd))!.texturedCorpsePages>0,'Alpha corpse pages must be drawn');assert.deepEqual(session.errors,[]);
 }
 const sheet=new PNG({width:800*5,height:600});cells.forEach((cell,i)=>PNG.bitblt(PNG.sync.read(cell),sheet,0,0,800,600,i*800,0));writeFileSync(`${out}/${tier}-sheet.png`,PNG.sync.write(sheet));
 writeFileSync(`${out}/${tier}.json`,JSON.stringify(receipts,null,2));
 }finally{await session.close();}
}
