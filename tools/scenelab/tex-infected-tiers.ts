/** Live tier changes must preserve the atlas identity, frozen bodies and valid GPU bindings. */
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import type { RenderTarget } from 'three/webgpu';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
const reportDir = resolve(process.env.TEX_REPORT_DIR ?? 'docs/reports/tex-infected');
const receipts: unknown[]=[];
try {
  for(const backend of ['webgl2','webgpu'] as Backend[]) {
    const session=new SceneSession({backend,tier:'high',viewport:{width:1280,height:720}});
    try {
      await session.open();
      await session.load({name:'textured-tier-retention',ground:'asphalt',time:'L1',dof:false,camera:{mode:'game',target:[0,.8,0],zoom:1.5},actors:[{id:'suit',kind:'infected',archetype:'infected.sprinter',at:[0,0],look:{model:'inf.common-worker'},state:'idle'}]});
      await session.step(2);await session.ready();
      await session.page.evaluate(()=>window.__SS__!.cheats.killAll());await session.step(180);await session.ready();
      const corpseIds=await session.page.evaluate(()=>window.__SS__!.query({}).filter(e=>e.corpse).map(e=>e.id));
      if(corpseIds.length!==1)throw new Error('Expected the killed suit to persist as one corpse');
      let identity:string|undefined;
      for(const tier of ['high','low','high','low'] as const) {
        await session.page.evaluate(tier=>window.__SS__!.settings.set({quality:tier}),tier);
        await session.step(2);await session.ready();
        const render=await session.page.evaluate(()=>window.__SS__!.getState().render);
        const atlas=render.crowd?.batches.find(b=>b.atlas)?.atlas;
        if(!atlas||atlas.width!==(tier==='low'?512:1024)||identity&&identity!==atlas.id||(!render.crowd?.texturedCorpsePages || !render.crowd.figures.length))throw new Error('Live tier lost atlas identity/size or frozen corpse pages');
        identity=atlas.id;
        const nonfiniteHDR=await session.page.evaluate(async()=>{
          const game=(window.__SCENE__ as unknown as {game:Game}).game;
          const target=(game.view as unknown as {postFx:{scenePass:{renderTarget:RenderTarget}}}).postFx.scenePass.renderTarget;
          const pixels=await game.view.renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height);
          let bad=0;for(const value of pixels)if(pixels instanceof Float32Array?!Number.isFinite(value):(value&0x7c00)===0x7c00)bad++;
          return bad;
        });
        if(nonfiniteHDR)throw new Error(`${backend}/${tier}: ${nonfiniteHDR} nonfinite HDR channels`);
        receipts.push({backend,tier,atlas,corpseIds,nonfiniteHDR,corpseFigures:render.crowd.figures.length,corpsePages:render.crowd.texturedCorpsePages,errors:session.errors.slice()});
      }
      await session.page.screenshot({path:resolve(reportDir, `corpse-low-${backend}.png`)});
      if(session.errors.length)throw new Error(session.errors.join('\n'));
    }finally{await session.close();stopServer();}
  }
}finally{stopServer();writeJson(resolve(reportDir, 'live-tiers.json'),receipts);}
