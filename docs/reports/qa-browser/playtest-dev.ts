/** Run the existing physical-input playtest against current Vite sources. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { runSession } from '../../../tools/playtest/session';
const [level='L6',quality='low']=process.argv.slice(2);
const probe=createServer();await new Promise<void>((ok,no)=>{probe.once('error',no);probe.listen(0,'127.0.0.1',ok);});
const port=(probe.address() as {port:number}).port;await new Promise<void>(ok=>probe.close(()=>ok()));
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort','--configLoader','runner'],{stdio:'ignore'});
const origin=`http://127.0.0.1:${port}`,out=resolve(`docs/reports/qa-browser/${level.toLowerCase()}-physical-${quality}`);
try{
  let up=false;for(let i=0;i<120;i++){try{if((await fetch(origin)).ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!up)throw Error('Vite did not start');
  const result=await runSession({origin,out,levels:[level],quality:quality as 'low'|'high',zoom:1.5,heroine:'female',entry:'debug',profile:`${out}/profile`,levelMinutes:8.3,stopAfterLevel:true,tag:`${level}-${quality}`,noSkip:true,sampleSeconds:495});
  console.log(JSON.stringify(result));
}finally{server.kill('SIGTERM');}
