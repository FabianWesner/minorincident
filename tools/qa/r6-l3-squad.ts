/** r6-l3: squad survivors at the army line and competent attack rate (same native fixtures as qa:threat L3-06/07/08/11).
 * Usage: node --import tsx/esm tools/qa/r6-l3-squad.ts --tier low|high [--seeds 1,2,3] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { l3ArmySeeds } from './threat/l3ArmySeeds';
import { l3SurvivalSeeds } from './threat/l3SurvivalSeeds';
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const tier = arg('tier', 'low') as 'low' | 'high', seeds = arg('seeds', '1,2,3').split(',').map(Number);
const army = await l3ArmySeeds(tier, seeds);
const survival = await l3SurvivalSeeds(tier, seeds);
const out = { tier, army, survival: survival.map(s => ({ seed: s.seed, valid: s.valid, s1: s.s1, density: s.density })) };
console.log(JSON.stringify(out));
mkdirSync('test-results/r6-l3', { recursive: true }); writeFileSync(arg('out', `test-results/r6-l3/squad-${tier}.json`), JSON.stringify(out, null, 2) + '\n');
