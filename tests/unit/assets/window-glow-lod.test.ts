import { describe, expect, it } from 'vitest';
import { checkDir } from '../../../tools/assets/window-glow-check';

// PO 10-09 "Lights are not on right place": house D/E LOD1/2 drew their window glows 0.8 m beside the windows.
describe('window glows stay in their windows in every LOD', () => {
  it('LOD1/LOD2 glow patches coincide with the LOD0 patches of every building', async () => {
    expect(await checkDir('public/assets/models')).toEqual([]);
  }, 120_000);
});
