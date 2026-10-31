import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer, origin } from '../scenelab/session';
const out=resolve('docs/reports/slim/pilot'),session=new SceneSession({tier:'high',viewport:{width:1200,height:900},log:line=>console.log(line)});mkdirSync(out,{recursive:true});
try{await session.open();await session.page.goto(`${origin}/tools/slim/pilot-studio.html`);await session.page.waitForFunction(()=>!!(window as unknown as {__SLIM__?:unknown}).__SLIM__);
for(const figure of ['man-a','woman-a'])for(const state of ['before','after'])for(const view of ['front','three-quarter','side']){const result=await session.page.evaluate(async q=>{const studio=(window as unknown as {__SLIM__:{show:(f:string,s:string,v:string)=>Promise<unknown>}}).__SLIM__;return studio.show(q.figure,q.state,q.view);},{figure,state,view});await session.screenshot(resolve(out,`studio-${figure}-${state}-${view}.png`));console.log(JSON.stringify(result));}
if(session.errors.length)throw Error(session.errors.join('\n'));
}finally{await session.close();stopServer();}
