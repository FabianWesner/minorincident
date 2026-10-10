import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { LevelSixBot, type L6Profile } from '../../src/debug/bot/LevelSixBot';
import { followFrustum } from './l3Bots';
export async function loadL6(seed=1,tier:'high'|'low'='high',keys?:string[]){
  const world=new SimWorld();await world.init();const c=compositions.L6;
  world.loadComposition(c,[JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json','utf8'))],seed);
  world.infected!.director.setTier(tier);world.npcs!.setQuality(tier);const save=preset('L6-default');if(keys)save.survivors=keys;applyCampaign(world,save);
  const mission=world.loadMission(resolveCampaignMission('L6',world.districts!));mission.begin();return{world,mission};
}
export function runL6(world:SimWorld,profile:L6Profile='complete',maxSeconds=600){
  const bot=new LevelSixBot(world,profile),timeline:{type:string;t:number}[]=[],start=world.tick;let peak=0;
  const off=world.events.on('sim.tick',()=>{peak=Math.max(peak,world.infected!.director.count);});
  for(const type of ['l6.breach1','l6.breach2','l6.abandon','l6.exit','l6.straggler','l6.rejoined','l6.gate-closed'] as const)world.events.on(type,e=>timeline.push({type:e.type,t:(e.tick-start)/60}));
  for(let i=0;i<maxSeconds*60&&!bot.finished;i++){followFrustum(world);world.applyInput(bot.sample(),'keyboard');world.update();}
  off();world.clearInput();const m=world.missions!,s=m.state.l6!;
  return{outcome:m.state.phase==='result'?'complete':'timeout',seed:world.seed,profile,simSeconds:m.state.stats.time,deaths:m.state.stats.deaths,rescued:m.state.result?.rescued??s.survivors.filter(r=>r.status==='out').length,total:s.survivors.length,peak,timeline,fates:s.survivors.map(r=>({key:r.key,status:r.status,straggler:r.straggler,rejoined:r.rejoined})),spawnLog:s.spawnLog,player:world.entities.get(1)!.transform,leader:[s.leaderX,s.leaderZ]};
}
