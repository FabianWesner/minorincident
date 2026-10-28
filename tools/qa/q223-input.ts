/** L10 reproduction fixture; combat uses real mouse/keyboard only after explicit scene setup. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../browser-pool/client';
import { needsTargetInput } from '../playtest/startup';
import { look } from '../playtest/eyes';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import type { Game } from '../../src/Game';
const out = process.argv[2] ?? 'test-results/followups-25/q223-input';
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const rows: unknown[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(30_000);
  console.log('page created');
  page.on('pageerror',e=>console.error('pageerror',e.message)); page.on('console',m=>{if(m.type()==='error')console.error('console',m.text())});
  await page.addInitScript('window.__name=f=>f');
  await page.goto('http://127.0.0.1:4277/?test=poses&testApi=1&scenelab=1&debug=1&quality=low&audio=muted&dpr=1');
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(() => window.__SS__!.ready); console.log('boot ready');
  await page.getByTestId('title-settings').click(); await page.getByTestId('setting-quality').selectOption('low'); await page.getByTestId('settings-back').click();
  console.log('quality selected'); await page.getByTestId('start-game').click();
  await page.waitForTimeout(500);
  if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
  console.log('character selected'); await page.getByTestId('level-L10').click({ force: true }); console.log('level clicked');
  await page.getByTestId('level-transition').waitFor({state:'hidden',timeout:120_000}); console.log('load closed');
  for(let i=0;i<600;i++) {
    const phase=await page.evaluate(()=>window.__SS__!.missions.state()?.phase);
    if(phase==='playing') break;
    if(i%25===0) console.log('waiting for play',phase,(await page.locator('body').innerText()).slice(-900));
    const button=page.getByTestId('mission-button');
    if(await button.isVisible() && await button.isEnabled()) await button.click();
    await page.waitForTimeout(200);
  }
  assert.equal(await page.evaluate(()=>window.__SS__!.missions.state()?.phase),'playing'); console.log('mission begun');
  await page.waitForTimeout(500);
  const corgi = (await page.evaluate(look)).allies.find(a=>/corgi/.test(a.archetype ?? ''));
  await page.screenshot({path:`${out}/corgi.jpg`});
  assert.ok(corgi?.drawn, 'visible L10 corgi must be reported drawn');
  await page.evaluate(() => { const a=window.__SS__!; a.debug.figureJoints(true); a.camera.zoom(1.5); a.setLoadout(['weapon.fire-axe'],['weapon.pistol']); a.teleport('player',{x:1144,z:25}); const g=(window.__SCENE__ as unknown as {game:Game}).game; g.world.physics.playerBody!.setNextKinematicTranslation(g.world.entities.get(1)!.transform); g.world.chunks!.update(); });
  await page.keyboard.press('Digit4');
  const setup = await page.evaluate(() => {
    const g=(window.__SCENE__ as unknown as {game:Game}).game;
    const hits: unknown[]=[]; (window as unknown as {q223Hits:unknown[]}).q223Hits=hits;
    g.world.events.on('combat.hit',e=>hits.push(structuredClone(e)));
    return {backend:g.view.getState().backend,quality:g.quality.snapshot(),player:g.world.entities.get(1)!.transform};
  });
  await page.waitForTimeout(750);
  console.log('setup', JSON.stringify(setup), await page.evaluate(()=>{ const w=(window.__SCENE__ as unknown as {game:Game}).game.world; return {player:w.entities.get(1)!.transform,nav:w.infected!.nav.ground,cell:w.infected!.nav.cell(w.entities.get(1)!.transform.x+3,w.entities.get(1)!.transform.z)}; }));
  for (const model of regularInfectedModels) {
    const id = await page.evaluate(model => {
      const a=window.__SS__!,p=a.getEntity(1)!;
      return a.spawn('infected.runner',{x:p.transform.x+3,z:p.transform.z},{variant:model,state:'chase'});
    }, model);
    await page.waitForTimeout(500);
    const before = await page.evaluate(id=>window.__SS__!.getEntity(id),id);
    const observations=[]; let held=false;
    for(let attempt=0;attempt<24;attempt++) {
      const eyes=await page.evaluate(look), target=eyes.enemies.find(e=>e.id===id);
      if(target) {
        await page.mouse.move(target.aim.x,target.aim.y);
        if(!held) { await page.mouse.down(); held=true; }
      }
      await page.waitForTimeout(150);
      const observation=await page.evaluate(id=>{
        const a=window.__SS__!,g=(window.__SCENE__ as unknown as {game:Game}).game;
        return {entity:a.getEntity(id),render:a.getState().render.healthBars,input:g.world.inputFrame,control:g.world.controls.snapshot(),pick:a.input.lastPick(),hits:(window as unknown as {q223Hits:unknown[]}).q223Hits};
      },id);
      observations.push(observation);
      if(observation.entity!.health.current<before!.health.current) break;
    }
    await page.mouse.up();
    await page.screenshot({path:`${out}/${model}.jpg`});
    const after=await page.evaluate(id=>window.__SS__!.getEntity(id),id);
    rows.push({model,id,before,after,observations});
    writeFileSync(`${out}/receipt.json`,JSON.stringify({setup,corgi,rows},null,2));
    console.log(`${model} #${id}: ${before!.health.current} -> ${after!.health.current}`);
    // Move the observed actor away before the next fixture; never inject damage.
    await page.evaluate(id=>window.__SS__!.teleport(id,{x:1060,z:25}),id);
  }
  // Reproduce the driver's lost initial body pick using physical input: a held ground
  // click stays a movement command even when the pointer is moved over the infected.
  const repairId=await page.evaluate(()=>{const a=window.__SS__!,p=a.getEntity(1)!.transform;return a.spawn('infected.runner',{x:p.x+3,z:p.z},{variant:'inf.bbq-dad',state:'chase'});});
  await page.waitForTimeout(500);
  await page.mouse.move(1000,600);await page.mouse.down();await page.waitForTimeout(1500);
  const commanded=await page.evaluate(()=>(window.__SCENE__ as unknown as {game:Game}).game.world.controls.targetId);
  assert.notEqual(commanded,repairId,'fixture must miss the initial body pick');
  const target=(await page.evaluate(look)).enemies.find(e=>e.id===repairId)!;
  assert.ok(target,'repair target must be visibly drawn');
  assert.ok(needsTargetInput(repairId,commanded,repairId,1500,1500));
  await page.mouse.up();await page.mouse.move(target.aim.x,target.aim.y);await page.mouse.down();
  await page.waitForFunction(id=>window.__SS__!.getEntity(id)!.health.current<60,repairId,{timeout:5000});
  await page.mouse.up();
  const repaired=await page.evaluate(id=>({entity:window.__SS__!.getEntity(id),bars:window.__SS__!.getState().render.healthBars,pick:window.__SS__!.input.lastPick()}),repairId);
  await page.screenshot({path:`${out}/bbq-lost-command-repaired.jpg`});
  writeFileSync(`${out}/receipt.json`,JSON.stringify({setup,corgi,rows,repair:{id:repairId,commanded,repaired}},null,2));
  console.log(`held-ground-command repair #${repairId}: ${target.hp} -> ${repaired.entity!.health.current}`);
  for(const row of rows as {model:string;before:{health:{current:number}};after:{health:{current:number}};observations:{render:{bars:{id:number}[]};hits:{sourceId:number;targetId:number}[]}[];id:number}[]) {
    assert.ok(row.after.health.current<row.before.health.current,`${row.model}: held real mouse input did not damage target`);
    assert.ok(row.observations.some(o=>o.render.bars.some(b=>b.id===row.id)),`${row.model}: no HP bar`);
    assert.ok(row.observations.some(o=>o.hits.some(h=>h.sourceId===1&&h.targetId===row.id)),`${row.model}: no player hit event`);
  }
} finally { await browser.close(); }
