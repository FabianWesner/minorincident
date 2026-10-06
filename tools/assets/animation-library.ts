import { writeFileSync } from 'node:fs';
import { assetIO } from './io';

/** Compile the actual Blender-exported glTF samplers for synchronous hero/crowd startup.
 * Values stay node TRS tracks; translation is stored relative to the library rest pose. */
const io = await assetIO();
const document = await io.read('assets/animation-library/library.glb');
const round = (n: number) => Math.round(n * 100000) / 100000;
const clips = document.getRoot().listAnimations().map(animation => {
  const tracks = animation.listChannels().flatMap(channel => {
    const node = channel.getTargetNode()!, sampler = channel.getSampler()!, path = channel.getTargetPath();
    const input = Array.from(sampler.getInput()!.getArray()! as ArrayLike<number>), output = Array.from(sampler.getOutput()!.getArray()! as ArrayLike<number>);
    const rest = path === 'translation' ? node.getTranslation() : path === 'rotation' ? node.getRotation() : node.getScale();
    const size = path === 'rotation' ? 4 : 3;
    if (output.every((v, i) => Math.abs(v - rest[i % size]) < .00001)) return [];
    const values = output.map((v, i) => round(path === 'translation' ? v - rest[i % size] : v));
    return [{ node: node.getName(), path, times: input.map(round), values }];
  });
  return { name: animation.getName(), duration: Math.max(...animation.listSamplers().map(s => Math.max(...Array.from(s.getInput()!.getArray()! as ArrayLike<number>)))), tracks };
});
writeFileSync('src/render/characters/library.json', JSON.stringify(clips) + '\n');
console.log(`Compiled ${clips.length} Blender actions (${clips.reduce((n, c) => n + c.tracks.length, 0)} moving TRS tracks)`);
