import { mkdirSync, writeFileSync } from 'node:fs';
import type { L6Profile } from '../../src/debug/bot/LevelSixBot';
import { loadL6, runL6 } from '../sim-runner/l6Bots';
const {world}=await loadL6(Number(process.argv[2]??1));
try {const result=runL6(world,(process.argv[3]??'complete') as L6Profile,600);mkdirSync('test-results/epics/E24',{recursive:true});writeFileSync(`test-results/epics/E24/${result.profile}-seed-${result.seed}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,spawnLog:undefined}));if(result.outcome!=='complete')process.exitCode=1;}finally{world.dispose();}
