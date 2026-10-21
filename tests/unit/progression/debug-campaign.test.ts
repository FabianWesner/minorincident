import { expect, test } from 'vitest';
import { debugCampaign, newCampaign } from '../../../src/sim/progression/Campaign';
import { validateSave } from '../../../src/sim/progression/Save';
import { GameUI } from '../../../src/ui/GameUI';
import type { CampaignSave } from '../../../src/sim/progression/Campaign';

test('PO #89 the debug level-list loader passes a preset-consistent save to every campaign start', async () => {
  for(let level=1;level<=10;level++){
    let started:CampaignSave|undefined;
    const ui={debugEnabled:true,show(){},applySettings(){},game:{campaign:newCampaign(),continueCampaign:async(save:CampaignSave)=>{started=save;},world:{},audio:{snapshot:()=>({background:false})},clock:{resume(){}},view:{update(){}}}};
    await (GameUI.prototype as unknown as {load(id:string):Promise<void>}).load.call(ui,`L${level}`);
    expect(started?.unlockedLevel,`L${level}`).toBe(level);
    expect(validateSave(started),`L${level}`).toBe(true);
  }
});

test('?debug level starts use a valid campaign fixture for every selectable level', () => {
  const current=newCampaign('male',77); current.settings={muted:true};
  for(let level=1;level<=10;level++){
    const save=debugCampaign(level as 1|2|3|4|5|6|7|8|9|10,current);
    expect(validateSave(save),`L${level}`).toBe(true);
    expect(save.seed).toBe(77); expect(save.character).toBe('male'); expect(save.settings).toEqual({muted:true});
  }
});
