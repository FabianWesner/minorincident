import { describe,expect,test } from 'vitest';
import { newCampaign,beginRewards,chooseWeapon,revealCards,pickUpgrades,finishRewards,offer,eligible,powerScore,rackSize,validRacks,preset,gearTier,weaponChoices,type CampaignSave,type Level } from '../../../src/sim/progression/Campaign';
import { upgrades } from '../../../src/data/upgrades';
import { decodeSave,validateSave,SaveStore } from '../../../src/sim/progression/Save';
function start(save:CampaignSave,level:Level){beginRewards(save,level);const choices=weaponChoices[level];if(choices)chooseWeapon(save,choices[0]);revealCards(save);}
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
    for(const level of [2,3]as const)for(const id of weaponChoices[level]!){const save=preset(`L${level}-default`);beginRewards(save,level);expect(()=>revealCards(save)).toThrow();chooseWeapon(save,id);revealCards(save);expect(save.ownedActions).toContain(id);expect(save.ownedActions).not.toContain(weaponChoices[level]!.find(other=>other!==id));if(level===2)expect(save.ownedActions).toContain('weapon.molotov');}
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
    const save=newCampaign();save.ownedActions.push('weapon.bat');beginRewards(save,1);expect(validateSave(save)).toBe(true);expect(()=>revealCards(save)).toThrow();chooseWeapon(save,'weapon.bat');expect(()=>chooseWeapon(save,'weapon.machete')).toThrow();revealCards(save);expect(validateSave(save)).toBe(true);pickUpgrades(save,save.pending!.cards.slice(0,2));expect(validateSave(save)).toBe(true);finishRewards(save,save.racks);expect(()=>beginRewards(save,1)).toThrow();
  });
});
