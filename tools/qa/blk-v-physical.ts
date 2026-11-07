// runSession uses launchProfile through the shared browser pool.
/** Physical L4 route with read-only lifetime/vertex evidence; no performance timing. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {runSession} from '../playtest/session';
const quality=process.argv[2]==='high'?'high':'low',port=Number(process.env.SCENE_PORT??4834),origin=`http://127.0.0.1:${port}`;
if(port===3300)throw Error('Reserved dev port');
const out=resolve(`test-results/blk-v/physical/${quality}`);mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
try{
 let ready=false;
 for(let i=0;i<120;i++){try{ready=(await fetch(origin)).ok;}catch{/* server boot */}if(ready)break;await new Promise(r=>setTimeout(r,500));}
 assert(ready,'owned Vite server ready');
 const result=await runSession({origin,out,levels:['L4'],quality,zoom:1.5,heroine:'female',entry:'debug',profile:`${out}/profile`,levelMinutes:9,stopAfterLevel:true,tag:`corpse-${quality}`,noSkip:true,sampleSeconds:480});
 writeFileSync(`${out}/result.json`,JSON.stringify({method:'Real physical WASD/mouse/E through the production progressed L4 menu entry. Survival-protected courier; read-only corpse lifetime and actual frozen-vertex census. No frame/performance timing.',...result},null,2)+'\n');
 assert(result.runs.some(run=>run.level==='L4'&&run.finished),'physical L4 route completed');
 assert(result.runs.every(run=>!run.skipped.length),'no objectives skipped');
 console.log(JSON.stringify(result.runs));
}finally{server.kill();}
