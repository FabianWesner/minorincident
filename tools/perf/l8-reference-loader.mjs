/** Native A/B source overlay: original simulation methods, identical current harness and campaign.
 * No checkout, build, filesystem source swap, or browser is created. */
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

const revision = process.env.L8_REFERENCE_REV;
if (!revision) throw new Error('Set L8_REFERENCE_REV to the baseline Git revision');
const paths = ['lighting/LightPower.ts', 'missions/LevelEightZoo.ts', 'missions/Mission.ts', 'npc/Npcs.ts', 'outbreak/humans.ts', 'ai/CharacterSeparation.ts'];
const overrides = new Map(paths.map(path => {
  const file = `src/sim/${path}`, source = execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8' });
  return [resolve(file), transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' }).code];
}));
registerHooks({ load(url, context, nextLoad) {
  const code = url.startsWith('file:') ? overrides.get(fileURLToPath(new URL(url))) : undefined;
  return code === undefined ? nextLoad(url, context) : { format: 'module', source: code, shortCircuit: true };
} });
