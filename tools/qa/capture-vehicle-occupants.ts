/** PKG-13/14 capture runner. Run under tools/e2e-lock.sh; optional third argument: cars or l2. */
import { SceneSession, stopServer, writeJson } from '../scenelab/session';
const phase = process.argv[2] ?? 'before';
const session = new SceneSession({ viewport: { width: 1600, height: 900 } });
const out = `test-results/vehicle-occupants/${phase}`;
try {
 await session.open();
 for (const car of process.argv[3] === 'l2' ? [] : process.argv[4] ? [process.argv[4]] : ['sedan','pickup','suv','police','ambulance','school-bus','fire-engine']) {
  await session.load({name:`driver-${car}`,ground:'asphalt',size:30,vehicles:[{id:'car',asset:`vehicle.${car}`,at:[0,0]}],actors:[{id:'courier',kind:'courier',at:[.2,2],look:{model:'female'}}],camera:{mode:'game',target:[1,0],zoom:1},frames:0});
  await session.page.evaluate(async () => {const a=window.__SS__!;a.input.set({interact:true});await a.step(1);a.input.clear();await a.step(60);});
  await session.screenshot(`${out}/${car}-game.png`);
  await session.page.evaluate(async () => { await window.__SCENE__!.setCamera({mode:'close',target:[1,1,0],radius:8,azimuth:45}); });
  await session.screenshot(`${out}/${car}-close.png`);
  writeJson(`${out}/${car}.json`,await session.page.evaluate(()=>window.__SS__!.getState()));
  if (phase === 'after') {
   await session.page.evaluate(async()=>{const a=window.__SS__!;a.survivor.select('male');await a.screenshotReady();});
   await session.screenshot(`${out}/${car}-male-close.png`);
   await session.page.evaluate(()=>window.__SCENE__!.setCamera({mode:'game',target:[1,0],zoom:1}));
   await session.screenshot(`${out}/${car}-male-game.png`);
   writeJson(`${out}/${car}-male.json`,await session.page.evaluate(()=>window.__SS__!.getState()));
  }
 }
 if (process.argv[3] !== 'cars') {
 await session.inspectLevel('L2');
 await session.page.evaluate(async()=>{const a=window.__SS__!;a.inspect.enable(true,{courier:'unchanged'});a.pause();a.missions.begin();a.missions.completeObjective('axe');a.missions.completeObjective('calm');a.missions.completeObjective('board');await a.step(170);a.inspect.enable(false);a.camera.follow();});
 await session.screenshot(`${out}/l2-game.png`);
 writeJson(`${out}/l2-ride.json`,await session.page.evaluate(()=>window.__SS__!.getState()));
 const cells=[];
 for (const frame of [170,230,290]) {
  if(frame>170) await session.page.evaluate(()=>window.__SS__!.step(60));
  await session.page.evaluate(()=>{const a=window.__SS__!,l=a.missions.state()!.l2!,t=a.getEntity(l.truckId)!.transform;const r=10,polar=Math.PI*.3;a.inspect.setCamera({target:[t.x+2,1.8,t.z],position:[t.x+2+r*Math.sin(polar)/Math.sqrt(2),1.8+r*Math.cos(polar),t.z+r*Math.sin(polar)/Math.sqrt(2)]});});
  await session.ready(); cells.push({frame,jpeg:await session.snapshot()});
 }
 await session.makeSheet(cells,`${out}/l2-ride-sheet.jpg`,640);
 await session.page.evaluate(async()=>{const a=window.__SS__!;while(!a.missions.state()!.l2!.arrivedAt)await a.step(60);await a.step(60);});
 await session.page.evaluate(()=>{const a=window.__SS__!;a.inspect.enable(false);a.camera.follow();});
 await session.screenshot(`${out}/l2-exit.png`);
 writeJson(`${out}/l2.json`,await session.page.evaluate(()=>window.__SS__!.getState()));
 await session.page.evaluate(async()=>{const a=window.__SS__!;a.input.set({move:{x:1,z:0}});await a.step(90);a.input.clear();});
 await session.screenshot(`${out}/l2-control.png`);
 writeJson(`${out}/l2-control.json`,await session.page.evaluate(()=>window.__SS__!.getState()));
 }
} finally {await session.close();stopServer();}
