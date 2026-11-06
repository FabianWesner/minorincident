/** Red/green proof: cellar battle must be admitted with a full ordinary-gun voice budget. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { AudioEventMapper, type AudioEventHost } from '../../src/audio/AudioEventMapper';
import { VoiceLimiter } from '../../src/audio/VoiceLimiter';
import { resolvedAudioCue } from '../../src/data/audioCues';
const rows=[];
for(const tier of ['low','high'] as const){
 const limiter=new VoiceLimiter(tier),attempts:{id:string;priority:number;accepted:boolean;lowpass?:number}[]=[];let next=0;
 for(let i=0;i<limiter.limit;i++)limiter.add({id:++next,priority:100,stop:()=>{}});
 const host={world:{entities:{get:()=>undefined},missions:{state:{l4:{barredAt:600}}}},context:{currentTime:10},alarm:{onEvent:()=>false},available:()=>true,
 play:(id:string,options:{priority?:number;lowpass?:number})=>{
  const priority=options.priority??resolvedAudioCue(id)!.priority,accepted=limiter.canAdd(priority);attempts.push({id,priority,accepted,lowpass:options.lowpass});
  if(accepted)limiter.add({id:++next,priority,stop:()=>{}});return null;
 }} as unknown as AudioEventHost;
 new AudioEventMapper(host).event({type:'l4.doorBarred',tick:600});
 rows.push({tier,limit:limiter.limit,voices:limiter.voices.size,attempts,acceptedShots:attempts.filter(a=>a.id==='action.weapon.army-mg'&&a.accepted).length});
}
writeFileSync(process.argv[2]??'test-results/fix71-b/cellar-priority.json',JSON.stringify({method:'Real AudioEventMapper and VoiceLimiter; fill all 16/32 slots with priority-100 ordinary weapons, then emit actual door-barred event. No audio source statistics or cap changed.',rows},null,2)+'\n');
console.log(JSON.stringify(rows));assert(rows.every(r=>r.acceptedShots===3&&r.voices===r.limit),'the first cellar pulse must play under a full voice budget');
