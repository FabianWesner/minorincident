import { readFileSync } from 'node:fs';
import { MeshLambertMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test, vi } from 'vitest';
import { CharacterView } from '../../../src/render/characters/CharacterView';
import type { Materials } from '../../../src/render/Materials';

for (const deferred of [false, true]) test.each(['female', 'male'] as const)(`selected %s courier (${deferred ? 'deferred' : 'direct'}) loads alone; a later menu choice joins one load and retains both rigs`, async selected => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async path => {
    const bytes = readFileSync(`public${path}`);
    return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  });
  const material = () => Object.assign(new MeshLambertMaterial({ vertexColors: true }), { bloodCoverage: { value: 0 }, movingFigure: { value: 0 } });
  const materials = { fromVertexColors: material, fromColor: material, get: material, unique: material } as unknown as Materials;
  const character = new CharacterView(), other = selected === 'female' ? 'male' : 'female';
  try {
    await character.init(materials, false, false, 'courier', true, false, deferred ? null : selected);
    if (deferred) { expect(loader).not.toHaveBeenCalled(); expect(await character.readyVariant(selected)).toBe(true); }
    // The shared tier-2 gear accessory (acc.courier-gear, one module-cached request, not a rig) rides along with the first courier load;
    // the contract here is about character rigs: only the selected one loads first, the other joins one load later.
    const rigs = () => loader.mock.calls.map(call => String(call[0])).filter(path => path.endsWith('.skin.glb'));
    const gear = () => loader.mock.calls.map(call => String(call[0])).filter(path => path.includes('/acc.courier-gear'));
    expect(rigs()).toEqual([`/assets/models/char.courier-${selected}.skin.glb`]);
    expect(gear().length).toBeLessThanOrEqual(1);
    expect(await character.readyVariant(selected)).toBe(false);
    await Promise.all([character.readyVariant(other), character.readyVariant(other)]);
    expect(rigs()).toEqual([`/assets/models/char.courier-${selected}.skin.glb`, `/assets/models/char.courier-${other}.skin.glb`]);
    expect(gear().length).toBeLessThanOrEqual(1);
    expect(await character.readyVariant(other)).toBe(false);
    expect(await character.readyVariant(selected)).toBe(false);
    expect(character.children.filter(child => child.name === 'carried-parcel')).toHaveLength(1);
    expect(character.skinActive).toBe(true);
  } finally { character.dispose(); loader.mockRestore(); }
});
