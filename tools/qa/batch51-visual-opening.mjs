/** Opposite-tier real-input opening coverage; each session uses a fresh context. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runSession } from '../playtest/session.ts';
Object.assign(process.env, { PLAYTEST_BACKEND: 'webgpu', PLAYTEST_GOD: '1', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single', PLAYTEST_THREAT_AUDIT: '1', PLAYTEST_POSE_PROBES: '0' });
const rows=[];
for (let i=1;i<=10;i++) {
 const level=`L${i}`; if(process.env.BATCH51_VISUAL_LEVELS && !process.env.BATCH51_VISUAL_LEVELS.split(',').includes(level)) continue; process.env.PLAYTEST_POSE_PROBES=level==='L6'?'1':'0'; const quality=['L3','L6'].includes(level)?'high':'low', out=`test-results/batch51/visual/opening-${level}-${quality}`, tag=`opening-${level}-${quality}`;
 mkdirSync(out,{recursive:true});
 try { rows.push({level,quality,...await runSession({origin:'http://127.0.0.1:4901',out,levels:[level],quality,zoom:1.5,heroine:'female',entry:level==='L1'?'new':'debug',profile:`${out}/profile`,levelMinutes:1,stopAfterLevel:true,noSkip:true,tag,sampleSeconds:24})}); }
 catch(error){rows.push({level,quality,error:String(error)});}
 writeFileSync(`docs/reports/batch51-qa/${process.env.BATCH51_VISUAL_LEVELS?'visual-openings-extra':'visual-openings'}.json`,JSON.stringify(rows,null,2));
 console.log(JSON.stringify({level,quality,run:rows.at(-1).runs?.[0]}));
}
