/** Area-weighted identity colours from the retained rigid contract; no texture-space nearest repair. */
import type { Document } from '@gltf-transform/core';
import { Matrix4, Vector3 } from 'three';
import type { AuthoredCrowdPalette } from './skin-crowd-regions';

export function legacyCrowdPalette(document: Document): AuthoredCrowdPalette {
  const palette: AuthoredCrowdPalette = {}, votes = { shirt: new Map<string, number>(), trousers: new Map<string, number>() };
  const colours = new Map<string, [number, number, number]>();
  for (const material of document.getRoot().listMaterials()) {
    const rgb = material.getBaseColorFactor().slice(0, 3).map(c => Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055))) as [number, number, number];
    colours.set(material.getName(), rgb);
    if (/infectedSkin|^pal_skin/.test(material.getName())) palette.skin = [rgb];
    if (/woodWarm|hairBrown/.test(material.getName())) palette.hair = [rgb];
  }
  for (const node of document.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const name = primitive.getMaterial()?.getName() ?? '';
    if (/blood|skin|infectedSkin|eye|woodWarm|hair/i.test(name)) continue;
    let owner = node;
    while (owner.getParentNode() && !/^(torso|hip|leg[LR]|shin[LR])$/.test(owner.getName())) owner = owner.getParentNode()!;
    const group = owner.getName() === 'torso' ? 'shirt' : /^(hip|leg[LR]|shin[LR])$/.test(owner.getName()) ? 'trousers' : undefined;
    if (!group) continue;
    const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices(), matrix = new Matrix4().fromArray(node.getWorldMatrix());
    let area = 0;
    for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromArray(positions.getElement(indices ? indices.getScalar(i + k) : i + k, [])).applyMatrix4(matrix));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    votes[group].set(name, (votes[group].get(name) ?? 0) + area);
  }
  for (const group of ['shirt', 'trousers'] as const) {
    const total = [...votes[group].values()].reduce((sum, area) => sum + area, 0);
    const names = [...votes[group]].filter(([, area]) => area > total * .02).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    if (names.length) palette[group] = names.map(name => colours.get(name)!);
  }
  return palette;
}
