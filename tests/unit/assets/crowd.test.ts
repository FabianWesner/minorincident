import { expect, test } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { assetIO } from '../../../tools/assets/io';
import { bakeCrowd, walkSample } from '../../../tools/assets/bake-crowd';
import type { CrowdClip } from '../../../src/assets/crowd';
import type { AssetDef } from '../../../src/assets/types';
import manifest from '../../../src/assets/manifest.json';

test('T-E17-07 @E17-AC07 baked part coordinates reproduce source hierarchy poses at five clip times', async () => {
  const def=manifest.find(a=>a.id==='inf.common-worker')! as AssetDef;
  const io=await assetIO();
  for (const path of [def.sourceGlb!,def.lods!.lod1!]) {
    const doc=await io.read(path);
    const baked=bakeCrowd(doc,def), clip=baked.getRoot().listScenes()[0].getExtras().crowd as unknown as CrowdClip;
    const nodes=doc.getRoot().listNodes(), parts=clip.parts.map(name=>nodes.find(n=>n.getName()===name)!);
    const rest=parts.map(p=>p.getRotation());
    expect(baked.getRoot().listNodes()).toHaveLength(doc.getRoot().listMaterials().length);
    expect(baked.getRoot().listMeshes().every(m=>m.listPrimitives().length===1)).toBe(true);
    for(const time of [0,.25,.5,.75,1]) {
      for(const [i,part] of parts.entries()){part.setRotation(rest[i]);walkSample(part,time,rest[i]);}
      const frame=Math.round(time*(clip.frames-1));
      for(const [i,part] of parts.entries()) {
        const source=new Matrix4().fromArray(part.getWorldMatrix()), gpu=new Matrix4().fromArray(clip.matrices.slice((frame*parts.length+i)*16,(frame*parts.length+i+1)*16));
        for(const local of [[0,0,0],[.11,.22,.33],[-.2,.4,.1]]) expect(new Vector3().fromArray(local).applyMatrix4(source).distanceTo(new Vector3().fromArray(local).applyMatrix4(gpu))).toBeLessThanOrEqual(.02);
      }
      const expected=new Map<string,Vector3[]>();
      for(const node of nodes) {
        let ancestor= node.getParentNode(), hidden=!!node.getExtras().hidden || node.getName().startsWith('stump_');
        while(ancestor){hidden ||= !!ancestor.getExtras().hidden || ancestor.getName().startsWith('stump_');ancestor=ancestor.getParentNode();}
        if(hidden)continue;
        for(const primitive of node.getMesh()?.listPrimitives() ?? []) {
          const name=primitive.getMaterial()!.getName(), positions=expected.get(name) ?? [], element=[0,0,0];
          const position=primitive.getAttribute('POSITION')!, matrix=new Matrix4().fromArray(node.getWorldMatrix());
          for(let vertex=0;vertex<position.getCount();vertex++){position.getElement(vertex,element);positions.push(new Vector3().fromArray(element).applyMatrix4(matrix));}
          expected.set(name,positions);
        }
      }
      for(const mesh of baked.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()) {
        const position=primitive.getAttribute('POSITION')!, indices=primitive.getAttribute('_PART_INDEX')!, element=[0,0,0];
        const source=expected.get(primitive.getMaterial()!.getName())!;
        expect(source).toHaveLength(position.getCount());
        let maximum=0;
        for(let vertex=0;vertex<position.getCount();vertex++) {
          position.getElement(vertex,element);
          const part=indices.getScalar(vertex), offset=(frame*parts.length+part)*16;
          const matrix=new Matrix4().fromArray(clip.matrices.slice(offset,offset+16));
          maximum=Math.max(maximum,new Vector3().fromArray(element).applyMatrix4(matrix).distanceTo(source[vertex]));
        }
        expect(maximum).toBeLessThanOrEqual(.02);
      }
    }
    for(const mesh of baked.getRoot().listMeshes()) {
      const p=mesh.listPrimitives()[0]; expect(p.getAttribute('_PART_INDEX')!.getCount()).toBe(p.getAttribute('POSITION')!.getCount());
    }
  }
});
