import { expect, test } from 'vitest';
import { debugCampaign, newCampaign } from '../../../src/sim/progression/Campaign';
import { validateSave } from '../../../src/sim/progression/Save';

test('?debug level starts use a valid campaign fixture for every selectable level', () => {
  const current=newCampaign('male',77); current.settings={muted:true};
  for(let level=1;level<=10;level++){
    const save=debugCampaign(level as 1|2|3|4|5|6|7|8|9|10,current);
    expect(validateSave(save),`L${level}`).toBe(true);
    expect(save.seed).toBe(77); expect(save.character).toBe('male'); expect(save.settings).toEqual({muted:true});
  }
});
