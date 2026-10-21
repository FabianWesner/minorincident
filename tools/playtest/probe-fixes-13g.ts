/** Debug-menu real-input probe; result setup is explicitly a fixture, never a playthrough claim. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const out='docs/reports/fixes-13g';mkdirSync(out,{recursive:true});const rows:unknown[]=[];
const session=new SceneSession({backend:'webgl2',tier:'low'});
try{
  await session.open();const page=session.page;page.setDefaultTimeout(120_000);
  await page.addInitScript('window.__name = fn => fn');
  const url=`${origin}/?testApi=1&scenelab=1&debug=1&renderer=webgl&quality=low&dpr=1&audio=muted`;
  for(let level=1;level<=10;level++){
    await page.evaluate(()=>localStorage.removeItem('minor-incident.campaign'));
    await page.goto(url);await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__!.ready);
    await page.getByTestId('start-game').click();await page.getByTestId('character-female').click();await page.getByTestId(`level-L${level}`).click({force:true});
    await page.waitForFunction(id=>{const g=(window.__SCENE__ as unknown as {game:{world:{scenario:string};loading:boolean}}).game;return g.world.scenario===id&&!g.loading&&document.body.dataset.uiScreen==='game';},`L${level}`);
    if(await page.evaluate(()=>window.__SS__!.missions.state()?.phase==='briefing'))await page.getByTestId('mission-button').click();
    const row=await page.evaluate(()=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;return {scenario:g.world.scenario,tick:a.tick(),save:a.campaign.save(),status:g.saves.load().status,unlocked:a.campaign.state()!.unlockedLevel};});
    assert.equal(row.scenario,`L${level}`);assert.equal(row.unlocked,level);assert.equal(row.save,true);assert.equal(row.status,'ok');rows.push(row);console.log(`debug L${level}: loaded and strict save accepted`);
    if(level===9){
      await page.evaluate(async()=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game,m=g.world.missions!;a.pause();
        const at=m.def.anchors['crawl-end'];g.world.vehicles!.destroyScripted(m.l9!.state.carId,{...at,y:.72,yaw:0});
        m.l9!.state.phase='done';m.l9!.state.finished=true;g.world.storyLock=null;a.cheats.completeObjective('approach');a.cheats.completeObjective('reach-outskirts');await a.step(1);
      });
      const button=page.getByTestId('mission-button');assert.equal(await button.innerText(),'Continue');assert.equal(await button.isVisible(),true);await button.click();
      await page.waitForFunction(()=>{const g=(window.__SCENE__ as unknown as {game:{world:{scenario:string};loading:boolean}}).game;return g.world.scenario==='L10'&&!g.loading;});rows.push({fixture:'L9 completed crawl',resultContinue:true});
    }
    if(level===10){
      const before=await page.evaluate(()=>window.__SS__!.getEntity(1)!.transform);
      await page.keyboard.down('d');await page.waitForTimeout(800);await page.keyboard.up('d');
      await page.keyboard.press('1');await page.waitForTimeout(400);
      const playable=await page.evaluate(()=>{const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;return {tick:a.tick(),player:a.getEntity(1)!.transform,current:g.world.combat!.runner.loadout.current('LEFT').id,save:a.campaign.save(),status:g.saves.load().status};});
      assert.ok(playable.tick>row.tick);assert.ok(Math.hypot(playable.player.x-before.x,playable.player.z-before.z)>.1);assert.equal(playable.current,'weapon.fists');assert.equal(playable.status,'ok');rows.push({realInput:'L10 movement and key 1',...playable});
    }
    writeFileSync(`${out}/debug-menu.json`,JSON.stringify({rows,errors:session.errors},null,2));
  }
  assert.deepEqual(session.errors,[]);
}finally{await session.close();stopServer();}
