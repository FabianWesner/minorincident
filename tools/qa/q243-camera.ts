/** Frame-zero production transitions, through the shared headless browser pool. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {SceneSession,stopServer} from '../scenelab/session';
import type {Game} from '../../src/Game';
const session=new SceneSession({backend:'webgpu',tier:'low'});
try{
 await session.open();await session.page.evaluate('globalThis.__name = fn => fn');
 const rows=await session.page.evaluate(async()=>{
  const a=window.__SS__!,game=(window.__SCENE__ as unknown as {game:Game}).game,rows:unknown[]=[];
  const sample=(name:string)=>{const p=game.world.entities.get(1)!.transform;const expected=game.view.view.framing!(p.x,p.z).scale;const state=game.view.view.getState();rows.push({name,expected,...state});return {expected,state};};
  await a.loadLevel('L10',{checkpoint:'cure-crash',seed:32});a.pause();a.cheats.god(true);sample('load');await a.step(120);sample('load-120');
  await a.loadLevel('L10',{checkpoint:'cure-disperse-ready',seed:32});sample('checkpoint-normal');await a.step(120);sample('checkpoint-normal-120');
  await a.loadLevel('L10',{checkpoint:'cure-crash',seed:32});sample('checkpoint-wide');
  a.teleport(1,{x:2700,z:45});sample('teleport');await a.step(1);sample('teleport-tick');
  a.survivor.checkpoint({x:640,y:.72,z:8});a.cheats.god(false);a.survivor.damage(1e6);await a.step(121);sample('respawn');
  return rows;
 });
 mkdirSync('test-results/q243',{recursive:true});writeFileSync('test-results/q243/camera.json',JSON.stringify({rows,errors:session.errors},null,2));console.log(JSON.stringify(rows.map(r=>({name:(r as {name:string}).name,expected:(r as {expected:number}).expected,scale:(r as {regionScale:number}).regionScale}))));
 for(const row of rows as {name:string;expected:number;regionScale:number}[])assert.ok(Math.abs(row.expected-row.regionScale)<1e-4,row.name);
 assert.deepEqual(session.errors,[]);
}finally{await session.close();stopServer();}
