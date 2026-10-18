import { SceneSession, stopServer } from '../../../../tools/scenelab/session';
const s = new SceneSession({backend:'webgl2',tier:'high'});
try {
 await s.open();
 await s.page.evaluate("window.__name = (fn) => fn");
 console.log(JSON.stringify(await s.page.evaluate(async()=>{
  const a=window.__SS__!;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();
  const w=(window.__SCENE__ as any).game.world;
  const probe=()=>({tick:w.tick,scenario:w.scenario,mask:!!w.infected.nav.mask,clear:w.infected.nav.clear(88,10.8,.45),excluded:w.districts.districts.map((d:any)=>({origin:d.origin,areas:d.layout.walkable.excluded})),chunks:!!w.chunks});
  const first=probe();await a.step(2);const second=probe();await a.step(3500);return {first,second,later:probe()};
 }),null,2));
} finally {await s.close();stopServer();}
