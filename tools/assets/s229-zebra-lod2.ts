/** Rebuild the s229 continuous zebra LOD2 from its retained fitted TRELLIS surface. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assetIO } from './io';
import { paintAnimalDetails } from './skin-crowd-animal-details';
import { compressSkin } from './skin-crowd-compress';

const source = 'assets/inf.zebra/s229-source/continuous-fitted-textured.glb';
const expected = '7edfa2d89aa995b646a3968c16e64c2ddabb89fca68e8bb1a171294c348b37ff';
const rig = 'assets/inf.zebra/model.lod1.glb', rigHash = 'c725036bd576db06391589d3a99232185f301be43ef88f082f34123bbf566855';
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
if (sha(source) !== expected) throw Error('Retained zebra source hash changed');
if (sha(rig) !== rigHash) throw Error('Production zebra rig hash changed');
const output = process.argv[2]; if (!output) throw Error('Usage: tsx tools/assets/s229-zebra-lod2.ts <output.glb>');
const temp = mkdtempSync(join(tmpdir(), 's229-zebra-'));
try {
  const skin = join(temp, 'skin.glb'), painted = join(temp, 'painted.glb');
  execFileSync(process.execPath, ['--import', 'tsx', 'tools/assets/skin-crowd-figure.ts', '--rig', rig, '--body', source, '--body-scale', '1', '--body-rot-y', '0', '--body-yaw-fixed', '--rig-kind', 'quadruped', '--out', skin], { stdio: 'inherit' });
  const io = await assetIO(), document = await io.read(skin);
  paintAnimalDetails(document, false, undefined, undefined, false, { species: 'zebra', infected: true });
  await io.write(painted, document);
  process.env.CROWD_Q = '128'; process.env.CROWD_WEIGHT_BITS = '8'; process.env.CROWD_JOINT_BITS = '8';
  const basis = resolve(process.env.CROWD_PIPELINE ?? '/Users/wesner/Workspace/minorincident_3dpipeline', 'vendor/basis-encoder-2.1');
  await compressSkin(painted, output, basis, 256);
  const bytes = readFileSync(output).length; if (bytes > 107576) throw Error(`Zebra LOD2 exceeds byte ceiling: ${bytes}`);
  console.log(JSON.stringify({ output, bytes, sha256: sha(output) }));
} finally { rmSync(temp, { recursive: true, force: true }); }
