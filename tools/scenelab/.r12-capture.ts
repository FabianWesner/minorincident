import { SceneSession, stopServer } from '/Users/wesner/Workspace/minorincident/.claude/worktrees/r12-l4truck/tools/scenelab/session.ts';
const s = new SceneSession({backend:'webgl2',tier:'high',viewport:{width:1280,height:800}});
try {
 await s.open();
 await s.page.evaluate(async()=>{const a=window.__SS__!; await a.loadLevel('L4',{seed:2,progression:'L4-default'}); a.pause();});
 const begin=s.page.getByRole('button',{name:'Begin mission'}); if(await begin.count()) await begin.click();
 await s.page.evaluate(async()=>{const a=window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('ride'); await a.step(700);});
 console.log(JSON.stringify(await s.page.evaluate(()=>({state:window.__SS__!.missions.state()!.l4,vehicles:window.__SS__!.getState().entities.filter(e=>e.vehicle).map(e=>({id:e.id,p:e.transform,vehicle:e.vehicle})),camera:window.__SS__!.getState().render.camera})),null,2));
 await s.page.evaluate(async()=>{const a=window.__SS__!; a.teleport(1,{x:-15,z:2}); a.camera.follow(); a.camera.zoom(1); await a.step(30); await a.screenshotReady();});
 await s.screenshot('/private/tmp/r12-l4truck-probe.png');
 console.log('errors',s.errors);
} finally {await s.close();stopServer();}
