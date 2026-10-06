import {mkdirSync} from 'node:fs';
import {boot,expect,test,testUrl} from './fixtures';
import {preset,newCampaign} from '../../src/sim/progression/Campaign';
import {SAVE_KEY} from '../../src/sim/progression/Save';
const dir='test-results/epics/E13';
test('@E13 @E14 full menus start a saved campaign, restore settings and hand results to real rewards',async({page})=>{
  test.setTimeout(180_000);
  await page.goto(`${testUrl}&ui=1`);
  await page.getByTestId('start-game').click();await page.getByTestId('character-male').click();
  await expect(page.getByTestId('level-L2')).toBeDisabled();await page.getByTestId('level-L1').click();
  await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});
  await page.getByRole('button',{name:'Begin mission',exact:true}).click();
  await page.getByTestId('pause-button').click();await page.getByTestId('pause-settings').click();
  await expect(page.getByTestId('setting-quality')).toHaveValue('auto');
  await page.getByTestId('setting-aimAssist').selectOption('High');
  await page.getByTestId('setting-textSize').selectOption('1.25');await page.getByTestId('setting-colorblind').check();
  await page.getByTestId('setting-quality').selectOption('low');
  const save=await page.evaluate(()=>window.__SS__!.campaign.state());
  expect(save!.character).toBe('male');expect(save!.settings).toMatchObject({aimAssist:'High',textSize:1.25,colorblind:true,quality:'low'});
  await page.reload();await page.getByTestId('continue-game').click();
  await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});
  expect(await page.evaluate(()=>window.__SS__!.campaign.state())).toEqual(save);
  const state=await page.evaluate(()=>window.__SS__!.getState());expect(state.combat!.aimAssist).toBe('High');
  expect(state.entities.filter(e=>e.kind==='civilian'&&e.civilian?.ambient&&e.civilian.adult)).toHaveLength(36);
  expect(state.entities.some(e=>e.kind==='pet'&&e.civilian?.ambient)).toBe(true);
  await page.getByRole('button',{name:'Begin mission',exact:true}).click();
  await page.evaluate(async()=>{const a=window.__SS__!;a.pause();for(let i=0;i<100&&a.missions.state()!.phase!=='result';i++){if(a.missions.state()!.phase==='cinematic')await a.step(600);else{a.cheats.completeObjective();await a.step(1);}}await a.screenshotReady();});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Unlock reveal'})).toBeVisible();
  await expect(page.getByTestId('menu-upgrades')).toBeHidden();await expect(page.getByTestId('pause-button')).toBeHidden();
  await page.getByRole('button',{name:'Keep bat',exact:true}).click();await page.getByRole('button',{name:'Choose upgrades',exact:true}).click();
  await page.locator('[data-upgrade]').nth(0).click();await page.locator('[data-upgrade]').nth(1).click();
  await page.getByRole('button',{name:'Set up racks',exact:true}).click();await page.getByRole('button',{name:'Mission briefing',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});
  expect(await page.evaluate(()=>window.__SS__!.getState().scenario)).toBe('L2');
  const progressed=await page.evaluate(()=>window.__SS__!.campaign.state());expect(progressed!.upgrades).toHaveLength(2);expect(progressed!.completedLevels).toBe(1);expect(progressed!.settings).toEqual(save!.settings);
});
async function photo(page:import('@playwright/test').Page,name:string){mkdirSync(dir,{recursive:true});await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${dir}/${name}.png`});}
test('T-E13-05 @E13 @E13-AC05 @smoke save reload continue restores character, progress, upgrades, racks and settings exactly',async({page})=>{
  test.setTimeout(180_000);await page.goto(`${testUrl}&debug`);await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__!.ready);
  const save=preset('L5-default');save.character='male';save.settings={cameraShake:false,gore:'Reduced',aimAssist:'High',muted:true};
  await page.evaluate(async save=>{const a=window.__SS__!;await a.loadScenario('combat-arena');a.campaign.restore(save);a.settings.set(save.settings);a.campaign.save();},save);
  await page.locator('[data-audio-controls] summary').click();await page.getByRole('checkbox',{name:'Mono audio',exact:true}).check();save.settings.mono=true;
  await page.reload();await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__!.ready);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});
  expect(await page.evaluate(()=>window.__SS__!.campaign.state())).toEqual(save);
  const state=await page.evaluate(()=>window.__SS__!.getState());expect(state.scenario).toBe('L5');expect(state.player!.survivor!.variant).toBe('male');expect(state.player!.weapons!.LEFT.rack.map(s=>s.id)).toEqual(save.racks.LEFT);expect(state.player!.weapons!.RIGHT.rack.map(s=>s.id)).toEqual(save.racks.RIGHT);
  expect(state.combat!.aimAssist).toBe('High');await photo(page,'continue-L5');
});
test('T-E13-06-browser @E13 @E13-AC06 corrupted and future saves show recoverable dialog without crashing',async({page})=>{
  await page.goto(testUrl);
  for(const data of ['{broken',JSON.stringify({...newCampaign(),version:999})]){
    await page.evaluate(({key,data})=>localStorage.setItem(key,data),{key:SAVE_KEY,data});await page.reload();await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__!.ready);
    await expect(page.getByRole('dialog',{name:'Save could not be loaded'})).toBeVisible();await expect(page.getByRole('button',{name:'Start new',exact:true})).toBeVisible();await photo(page,'save-error');
    await page.getByRole('button',{name:'Start new',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose your survivor'})).toBeVisible();
  }
});
test('T-E13-07-browser @E13 @E13-AC07 loadLevel L5 with named preset starts its expected valid loadout',async({page})=>{
  test.setTimeout(180_000);await boot(page);await page.evaluate(()=>window.__SS__!.loadLevel('L5',{progression:'L5-default'}));
  const save=preset('L5-default'),state=await page.evaluate(()=>window.__SS__!.getState());expect(state.progression!.campaign).toEqual(save);expect(state.player!.weapons!.RIGHT.rack.map(s=>s.id)).toEqual(save.racks.RIGHT);expect(state.player!.survivor!.gearTier).toBe(3);
});
for(const scheme of ['mouse','keyboard','touch']as const)test(`T-E13-09-${scheme} @E13 @E13-AC09 @E13-AC04 result unlock cards rack briefing level via ${scheme} only`,async({page,browser})=>{
  test.setTimeout(180_000);
  const context=scheme==='touch'?await browser.newContext({baseURL:test.info().project.use.baseURL,hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:1}):null;
  if(context)page=await context.newPage();
  const guard=context?(await import('./fixtures')).attachErrorGuard(page):null;
  const activate=async(name:string)=>{
    const b=page.getByRole('button',{name,exact:true});await expect(b).toBeEnabled();
    if(scheme==='keyboard'){
      for(let i=0;i<80;i++){if(await b.evaluate(e=>e===document.activeElement))break;await page.keyboard.press('Tab');}
      await expect(b).toBeFocused();await page.keyboard.press('Enter');
    }else if(scheme==='touch')await b.tap();else await b.click();
  };
  try{
    await boot(page);await page.evaluate(()=>window.__SS__!.campaign.menu());await activate('Start new');await activate('Female survivor');await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});await activate('Begin mission');
    // Test API completes the authored mission; all between-level navigation uses the physical device.
    await page.evaluate(async()=>{const a=window.__SS__!;a.pause();for(let i=0;i<100&&a.missions.state()!.phase!=='result';i++){const s=a.missions.state()!;if(s.phase==='cinematic')await a.step(600);else {a.cheats.completeObjective();await a.step(1);}}await a.screenshotReady();});
    await expect(page.getByRole('heading',{name:'Level complete'})).toBeVisible();await photo(page,`result-${scheme}`);await activate('Continue');await expect(page.getByRole('heading',{name:'Unlock reveal'})).toBeVisible();await activate('Keep bat');await activate('Choose upgrades');await expect(page.getByRole('heading',{name:'Pick 2 of 3 upgrades'})).toBeVisible();
    const cards=await page.locator('[data-upgrade]').allTextContents();await activate(cards[0]);await activate(cards[1]);expect(await page.locator('[data-upgrade][aria-pressed=true]').count()).toBe(2);await activate(cards[2]);expect(await page.locator('[data-upgrade][aria-pressed=true]').count()).toBe(2);await photo(page,`cards-${scheme}`);
    await activate('Set up racks');await expect(page.getByRole('heading',{name:'Rack setup'})).toBeVisible();await activate('LEFT: fists');await activate('LEFT: kick');await expect(page.getByRole('status')).toContainText('rack is full');await expect(page.getByRole('button',{name:'LEFT: kick',exact:true})).toHaveAttribute('aria-pressed','false');await photo(page,`racks-${scheme}`);
    await activate('Mission briefing');await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});expect(await page.evaluate(()=>window.__SS__!.getState().scenario)).toBe('L2');await activate('Begin mission');expect(await page.evaluate(()=>window.__SS__!.missions.state()!.phase)).toBe('playing');
    const save=await page.evaluate(()=>window.__SS__!.campaign.state());expect(save!.completedLevels).toBe(1);expect(save!.unlockedLevel).toBe(2);expect(save!.upgrades).toHaveLength(2);expect(save!.pending).toBeUndefined();
  }finally{if(guard){guard.dispose();expect(guard.errors).toEqual([]);}await context?.close();}
});
test('@E13 level select disables locked levels and can replay an unlocked level',async({page})=>{
  test.setTimeout(180_000);await boot(page);const save=preset('L2-default');await page.evaluate(save=>{window.__SS__!.campaign.restore(save);window.__SS__!.campaign.save();window.__SS__!.campaign.menu();},save);await page.getByRole('button',{name:'Level select',exact:true}).click();await expect(page.getByRole('button',{name:'Level 3',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Level 1',exact:true}).click();await expect(page.getByRole('heading',{name:'Mission briefing'})).toBeVisible({timeout:60_000});expect(await page.evaluate(()=>window.__SS__!.getState().scenario)).toBe('L1');
});
test('@E13 offered cards survive reload and continue without reroll',async({page})=>{
  await boot(page);const save=preset('L2-default');const {beginRewards,revealCards,chooseWeapon}=await import('../../src/sim/progression/Campaign');beginRewards(save,2);chooseWeapon(save,'weapon.pistol');revealCards(save);
  await page.evaluate(save=>{window.__SS__!.campaign.restore(save);window.__SS__!.campaign.save();},save);await page.reload();await page.waitForFunction(()=>!!window.__SS__);await page.evaluate(()=>window.__SS__!.ready);await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Pick 2 of 3 upgrades'})).toBeVisible();expect(await page.locator('[data-upgrade]').evaluateAll(elements=>elements.map(e=>(e as HTMLElement).dataset.upgrade))).toEqual(save.pending!.cards);
});

test('@E13 L2 and L3 unlock screens offer the authored permanent weapon alternatives',async({page})=>{
  await boot(page);const {beginRewards}=await import('../../src/sim/progression/Campaign');
  for(const level of [2,3]as const){const save=preset(`L${level}-default`);beginRewards(save,level);await page.evaluate(save=>{const a=window.__SS__!;a.campaign.restore(save);a.campaign.save();a.campaign.menu();},save);await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Unlock reveal'})).toBeVisible();const chosen=level===2?'shotgun':'hunting rifle';await page.getByRole('button',{name:`Keep ${chosen}`,exact:true}).click();await page.getByRole('button',{name:'Choose upgrades',exact:true}).click();expect((await page.evaluate(()=>window.__SS__!.campaign.state()))!.ownedActions).toContain(level===2?'weapon.shotgun':'weapon.hunting-rifle');}
});
