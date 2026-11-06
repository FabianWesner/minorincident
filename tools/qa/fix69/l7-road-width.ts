/** fix69-r diagnostic: clear road width (runner radius) across the L7 opening street, x 236-272. */
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const campaign = preset('L7-default'); campaign.seed = 1; campaign.settings.quality = 'low';
const w = await loadLevel('L7', 1, campaign, 0, { quality: 'low' });
const nav = w.infected!.nav;
for (let x = 236; x <= 272; x += 4) {
  let row = '';
  for (let z = 3; z <= 27; z += .5) row += nav.clear(x, z, .35) ? '.' : '#';
  console.log(String(x).padStart(4), row, '(z 3..27)');
}
