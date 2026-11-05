/** Current ordinary lab handover, continuous same-actor ledger and production framing. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import { provenance } from './accept/probe';
const stage = process.env.HANDOVER_STAGE === 'pickup' ? 'pickup' : 'handover';
const out = process.env.HANDOVER_OUT ?? `test-results/sweep-a2/${stage}`;
mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
try { for (const tier of ['low', 'high'] as const) {
  const s = new SceneSession({ tier, backend: 'webgpu', query: { ui: '1' } });
  try {
    await s.open(); await s.page.evaluate('window.__name=f=>f');
    await s.page.evaluate(async ({ tier, stage }) => {
      const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadLevel('L1', { seed: 1 });
      a.missions.begin(); a.pause(); a.camera.follow(); a.camera.zoom(1); a.bot.start('complete');
      document.documentElement.setAttribute('data-scene-hud',''); document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));
      for (let i=0;i<1200 && a.missions.state()!.l1!.beat?.id!==stage;i++) await a.step(5);
      if (a.missions.state()!.l1!.beat?.id!==stage) throw Error('Ordinary handover not reached');
      a.bot.stop(); a.input.clear();
    }, {tier,stage});
    await s.page.addStyleTag({content:'.story-bubble{visibility:visible!important}'});
    const samples = [], captures = [];
    let previous = '', finished = false, completeAt = -1;
    for (let offset=0;offset<=1200;offset++) {
      const q = await s.page.evaluate(stage => {
        const g=(window.__SCENE__ as unknown as {game:Game}).game,w=g.world,l=w.missions!.state.l1!;
        const id=stage==='pickup'?l.clerkId:l.techId,e=w.entities.get(id??0),p=w.entities.get(1)!;
        return {tick:w.tick,beat:l.beat,carrying:l.carrying,delivered:l.delivered,phase:l.phase,actor:id,
          entity:e&&{hidden:!!e.hidden,at:{...e.transform},story:e.civilian?.story},
          drawn:window.__SS__!.crowdFigures().find(f=>f.id===id)?.drawn??false,player:{...p.transform},
          doors:[...w.openDoors.keys()],done:!!l.beatsDone?.includes(stage)};
      },stage);
      samples.push(q);
      const clip=q.entity?.story?.clip??'none';
      const complete=q.done&&(stage==='pickup'?!q.actor:q.delivered&&!!q.entity&&q.entity.at.z<=-13.5);
      if (complete && completeAt < 0) completeAt = offset;
      finished=complete&&offset>=completeAt+60;
      if ((process.env.HANDOVER_TAIL_ONLY !== '1' && (!offset || offset%60===0 || clip!==previous)) || finished) {
        await s.page.evaluate(async()=>window.__SS__!.screenshotReady());
        const file=`${out}/captures/${tier}-${String(offset).padStart(4,'0')}-${clip}.png`;
        await s.page.screenshot({path:file});captures.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),sample:q});
      }
      previous=clip;if(finished)break;
      await s.page.evaluate(async()=>window.__SS__!.step(1));
    }
    runs.push({tier,finished,samples,captures,errors:s.errors}); console.log(tier,finished,samples.length,captures.length);
  } finally {await s.close();}
} } finally {stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),stage,method:'Ordinary native complete InputFrames from new game to story onset, then idle unskipped every-tick handover. Production framing/full HUD, no relocation/protection/skips. No frame-performance timing.',runs},null,2)+'\n');}
