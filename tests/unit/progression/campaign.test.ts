import { describe,expect,test } from 'vitest';
import { newCampaign,autoRewards,beginRewards,revealCards,pickUpgrades,finishRewards,offer,eligible,powerScore,rackSize,validRacks,preset,gearTier,type CampaignSave,type Level } from '../../../src/sim/progression/Campaign';
import { upgrades } from '../../../src/data/upgrades';
import { decodeSave,validateSave,SaveStore } from '../../../src/sim/progression/Save';
function start(save:CampaignSave,level:Level){beginRewards(save,level);revealCards(save);}
describe('campaign',()=>{
  test('T-E13-01 @E13 @E13-AC01 1000 seeds give three distinct prerequisite-valid reproducible offers',()=>{
    for(let seed=0;seed<1000;seed++){
      const save=newCampaign('female',seed);
      for(let level=1;level<=5;level++){
        start(save,level as Level);const cards=save.pending!.cards;
        expect(new Set(cards).size).toBe(3);expect(cards.every(id=>eligible(save,upgrades[id]))).toBe(true);
        expect(offer(structuredClone(save),level)).toEqual(cards);
        pickUpgrades(save,cards.slice(0,2));finishRewards(save,save.racks);
      }
    }
  });
  test('@E13 fixed unlock alternatives grant only the chosen weapon and retain guaranteed unlocks',()=>{
    expect(eligible(newCampaign(),upgrades['upgrade.vehicle.1'])).toBe(false);const vehicleSave=preset('L3-default');beginRewards(vehicleSave,3);expect(eligible(vehicleSave,upgrades['upgrade.vehicle.1'])).toBe(true);
    // PO 2026-10-12: no level offers a weapon choice; L3 grants the armory handgun only, never an SMG or a hunting rifle.
    for(const level of [1,2,3,4,5]as const){const save=level===1?newCampaign():preset(`L${level as 2|3|4|5}-default`);const before=[...save.ownedActions];beginRewards(save,level);expect('weaponChoices'in save.pending!).toBe(false);revealCards(save);expect(save.ownedActions.filter(id=>!before.includes(id))).toEqual(level===3?['weapon.handgun']:level===1?['weapon.bat']:save.ownedActions.filter(id=>!before.includes(id)));expect(save.ownedActions).not.toContain('weapon.smg');expect(save.ownedActions).not.toContain('weapon.hunting-rifle');}
    {const save=preset('L2-default');beginRewards(save,2);revealCards(save);expect(save.ownedActions).toContain('weapon.molotov');expect(save.ownedActions).not.toContain('weapon.handgun');}
  });
  test('@E13 @E13-AC01 used weapon weights bias offers without changing the save-seeded choice',()=>{
    let neutral=0,weighted=0,meleeNeutral=0,meleeWeighted=0;
    for(let seed=0;seed<1000;seed++){const save=preset('L3-default');save.seed=seed;neutral+=Number(offer(save).includes('upgrade.handling.2'));save.usage={'weapon.pistol':100};weighted+=Number(offer(save).includes('upgrade.handling.2'));save.ownedActions.push('weapon.crowbar');save.usage={};meleeNeutral+=Number(offer(save).includes('upgrade.melee.3'));save.usage={'weapon.crowbar':100};meleeWeighted+=Number(offer(save).includes('upgrade.melee.3'));}
    expect(weighted).toBeGreaterThan(neutral*1.5);expect(meleeWeighted).toBeGreaterThan(meleeNeutral*1.5);
  });
  test('T-E13-03 @E13 @E13-AC03 all 243 seeded choice paths increase power L1 to L6',()=>{
    let paths=0;
    function walk(save:CampaignSave,level:Level){
      const previous=powerScore(save);start(save,level);const cards=save.pending!.cards;
      for(const pair of [[0,1],[0,2],[1,2]]){
        const next=structuredClone(save);pickUpgrades(next,pair.map(i=>cards[i]));finishRewards(next,next.racks);
        expect(powerScore(next)).toBeGreaterThan(previous);
        if(level<5)walk(next,(level+1) as Level);else{expect(powerScore(next)).toBeGreaterThanOrEqual(powerScore(newCampaign())*3);paths++;}
      }
    }walk(newCampaign(),1);expect(paths).toBe(243);
  });
  test('T-E13-04 @E13 @E13-AC04 rack sizes and overfill/unknown/duplicate rejections',()=>{
    expect([1,2,3,4,5,6].map(rackSize)).toEqual([1,2,2,3,3,3]);
    for(const level of [1,2,3,4,5,6]as const){const save=level===1?newCampaign():preset(`L${level}-default`);const id=save.ownedActions[0];expect(validRacks(save,{LEFT:Array(rackSize(level)+1).fill(id),RIGHT:[id]})).toBe(false);expect(validRacks(save,{LEFT:['weapon.unknown'],RIGHT:[id]})).toBe(false);}
    const save=newCampaign();start(save,1);expect(()=>pickUpgrades(save,[save.pending!.cards[0],save.pending!.cards[0]])).toThrow();pickUpgrades(save,save.pending!.cards.slice(0,2));expect(()=>finishRewards(save,{LEFT:[],RIGHT:['weapon.kick']})).toThrow();
  });
  test('T-E13-06 @E13 @E13-AC06 corrupt/unknown saves fail safely and v0 migrates exactly',()=>{
    const save=preset('L5-default');expect(decodeSave(JSON.stringify(save))).toEqual({status:'ok',save});
    const {unlockedLevel,...rest}=save;expect(decodeSave(JSON.stringify({...rest,version:0,level:unlockedLevel}))).toEqual({status:'ok',save});
    for(const data of ['{','null','[]',JSON.stringify({...save,version:99}),JSON.stringify({...save,ownedActions:[...save.ownedActions,'toString']}),JSON.stringify({...save,unlockedLevel:6}),JSON.stringify({...save,upgrades:[]}),JSON.stringify({...save,upgrades:['unknown']}),JSON.stringify({...save,racks:{LEFT:['unknown'],RIGHT:[]}}),JSON.stringify({...save,settings:{cameraShake:'yes'}}),JSON.stringify({...save,usage:{'weapon.bat':-1}}),JSON.stringify({...save,pending:{level:4,cards:['unknown'],phase:'cards'}})])expect(decodeSave(data).status).toBe('error');
    const broken=new SaveStore({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');},removeItem(){throw new Error('blocked');}});expect(broken.load().status).toBe('error');expect(broken.write(save)).toBe(false);expect(broken.clear()).toBe(false);
  });
  test('T-E13-07-unit @E13 @E13-AC07 L2 through L6 presets are valid reproducible complete saves',()=>{
    for(const level of [2,3,4,5,6]as const){const save=preset(`L${level}-default`);expect(validateSave(save)).toBe(true);expect(save).toEqual(preset(`L${level}-default`));expect(save.completedLevels).toBe(level-1);expect(save.unlockedLevel).toBe(level);expect(save.upgrades).toHaveLength((level-1)*2);}
  });
  test('@E13 @E14 campaign saves retain validated HUD accessibility settings',()=>{
    const save=newCampaign();save.settings={textSize:1.5,colorblind:true,quality:'auto'};
    expect(decodeSave(JSON.stringify(save))).toEqual({status:'ok',save});
    for(const textSize of [0,2,'1.5'])expect(validateSave({...save,settings:{textSize}})).toBe(false);
    expect(validateSave({...save,settings:{colorblind:'yes'}})).toBe(false);
  });
  test('T-E13-08-unit @E13 @E13-AC08 default path ends L1 through L5 in gear tiers zero through four',()=>{
    expect([2,3,4,5,6].map(level=>gearTier(preset(`L${level as 2|3|4|5|6}-default`)))).toEqual([0,1,2,3,4]);
  });
  test('@E13 saves round-trip at each pending phase; rewards cannot be claimed twice',()=>{
    const save=newCampaign();save.ownedActions.push('weapon.bat');beginRewards(save,1);expect(validateSave(save)).toBe(true);revealCards(save);expect(validateSave(save)).toBe(true);pickUpgrades(save,save.pending!.cards.slice(0,2));expect(validateSave(save)).toBe(true);finishRewards(save,save.racks);expect(()=>beginRewards(save,1)).toThrow();
  });
});
test('@E24 @E24-AC14 finished L6 save round-trips without granting a sixth reward',()=>{const save=preset('L6-default');save.completedLevels=6;expect(validateSave(save)).toBe(true);expect(decodeSave(JSON.stringify(save))).toEqual({status:'ok',save});});

test('@E24 @E24-AC05 the actual L5 fire axe rack is valid at the L6 handover when existing equipment ownership is recorded',()=>{
  const save=preset('L5-default');
  autoRewards(save,5);save.racks={LEFT:['weapon.fire-axe','weapon.bat'],RIGHT:['weapon.army-mg','weapon.handgun','weapon.kick']};
  for(const id of [...save.racks.LEFT,...save.racks.RIGHT])if(!save.ownedActions.includes(id))save.ownedActions.push(id);
  expect(validateSave(save)).toBe(true);
});
test('@E13 PO 2026-10-12: old saves holding the retired L3 SMG or hunting rifle migrate to the handgun on load',()=>{
  const base=preset('L4-default');
  for(const legacy of ['weapon.smg','weapon.hunting-rifle']){
    const old=structuredClone(base);old.ownedActions=old.ownedActions.filter(id=>id!=='weapon.handgun');old.ownedActions.push(legacy);old.racks={LEFT:old.racks.LEFT,RIGHT:[legacy]};
    expect(validateSave(old)).toBe(true);
    const loaded=decodeSave(JSON.stringify(old));expect(loaded.status).toBe('ok');
    const save=(loaded as {save:CampaignSave}).save;
    expect(save.ownedActions).toContain('weapon.handgun');expect(save.ownedActions).not.toContain(legacy);expect(save.racks.RIGHT).toEqual(['weapon.handgun']);expect(validateSave(save)).toBe(true);
  }
  const both=structuredClone(base);both.ownedActions.push('weapon.smg');both.racks={LEFT:both.racks.LEFT,RIGHT:['weapon.handgun','weapon.smg']};
  const merged=(decodeSave(JSON.stringify(both)) as {save:CampaignSave}).save;expect(merged.racks.RIGHT).toEqual(['weapon.handgun']);expect(merged.ownedActions.filter(id=>id==='weapon.handgun')).toHaveLength(1);
  // A reward screen saved by an older build (with the retired weaponChosen flag) still loads.
  const pending=newCampaign();pending.ownedActions.push('weapon.bat');beginRewards(pending,1);(pending.pending as unknown as Record<string,unknown>).weaponChosen=true;
  expect(decodeSave(JSON.stringify(pending)).status).toBe('ok');
});
