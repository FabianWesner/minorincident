import { BufferAttribute, DataTexture, FloatType, Group, InstancedMesh, InstancedInterleavedBuffer, Matrix4, MeshBasicNodeMaterial, Mesh, RGBAFormat, type Node, type BufferGeometry } from 'three/webgpu';
import { attribute, instancedBufferAttribute, int, ivec2, mat4, positionGeometry, textureLoad, uniform, vec4, mix, float, Fn, If } from 'three/tsl';
import { palette } from './palette';

export interface CrowdClip { parts: string[]; frames: number; duration: number; matrices: number[] | Float32Array }
export function clipTexture(clip: CrowdClip): DataTexture {
  const texture=new DataTexture(new Float32Array(clip.matrices),clip.parts.length*4,clip.frames,RGBAFormat,FloatType);
  texture.needsUpdate=true; return texture;
}
/** Pack scalar part flags into one location so production crowds fit WebGL2's
 * 16-attribute minimum even with instancing, shaded normals and clip fades. */
export function packCrowdParts(geometry: BufferGeometry): void {
  const names = ['_part_index', '_shirt', '_emissive', '_vein'], count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 4);
  names.forEach((name, channel) => {
    const source = geometry.getAttribute(name);
    if (source) for (let i = 0; i < count; i++) values[i * 4 + channel] = source.getX(i);
    geometry.deleteAttribute(name);
  });
  geometry.setAttribute('_parts', new BufferAttribute(values, 4));
}
/** One texel per matrix column; shared by the crowd vertex shader and GPU readback probe. */
export function crowdMatrix(texture: DataTexture, part: Parameters<typeof int>[0], frame: Parameters<typeof int>[0]) {
  const start=int(part).mul(4);
  const f = float(frame), low = f.floor(), high = f.ceil();
  const column = (index:number) => mix(textureLoad(texture,ivec2(start.add(index),int(low))), textureLoad(texture,ivec2(start.add(index),int(high))), f.fract());
  return mat4(column(0),column(1),column(2),column(3));
}
/** Outgoing atlas rows are fetched only while an actor is transitioning. */
export function crowdBlendedMatrix(texture: DataTexture, part: Parameters<typeof int>[0], frame: Parameters<typeof int>[0], outgoing: Parameters<typeof int>[0], weight: Node<'float'>) {
  return Fn(() => {
    const current = crowdMatrix(texture, part, frame).toVar();
    If(weight.lessThan(1), () => { current.assign(crowdMatrix(texture, part, outgoing).mul(weight.oneMinus()).add(current.mul(weight))); });
    return current;
  })();
}
/** Pose in part-local space before applying the instance's movement/heading. */
export function crowdPosition(instance: Node<'mat4'>, texture: DataTexture, part: Parameters<typeof int>[0], frame: Parameters<typeof int>[0], position: Node<'vec3'>) {
  return instance.mul(crowdMatrix(texture,part,frame).mul(vec4(position,1))).xyz;
}
/** One instanced mesh per material; per-frame work is a scalar uniform update. */
export class Crowd extends Group {
  readonly frame=uniform(0);
  readonly clip: CrowdClip;
  readonly texture: DataTexture;
  readonly instanceCount: number;
  constructor(baked: Group, count: number) {
    super(); this.instanceCount=count;
    baked.updateMatrixWorld(true);
    const meshes: Mesh[]=[]; baked.traverse((n)=>{if(n instanceof Mesh)meshes.push(n);});
    const clip=baked.userData.crowd as CrowdClip | undefined;
    if(!clip)throw new Error('Missing crowd clip metadata');
    this.clip=clip; this.texture=clipTexture(clip);
    const transform=new Matrix4();
    for(const source of meshes) {
      const original=Array.isArray(source.material)?source.material[0]:source.material;
      const token=original.name.replace(/^(pal|emi)_/,'');
      const material=new MeshBasicNodeMaterial({color:palette[token] ?? '#ffffff'});
      // Restore part-local coordinates from the quantization transform before
      // the crowd shader applies its independently baked joint matrices.
      const geometry = (source.geometry as BufferGeometry).clone();
      for (const name of ['position', 'normal']) {
        const attribute = geometry.getAttribute(name);
        if (!attribute) continue;
        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++) for (let channel = 0; channel < attribute.itemSize; channel++) values[i * attribute.itemSize + channel] = attribute.getComponent(i, channel);
        geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
      }
      geometry.applyMatrix4(source.matrixWorld);
      const mesh=new InstancedMesh(geometry,material,count);
      mesh.frustumCulled=false;
      for(let i=0;i<count;i++){transform.makeTranslation(i%10*1.5,0,Math.floor(i/10)*1.5);mesh.setMatrixAt(i,transform);}
      // NodeMaterial evaluates positionNode after its default instancing step.
      // Start from raw geometry and compose instance * part to avoid rotating offsets.
      const matrices = new InstancedInterleavedBuffer(mesh.instanceMatrix.array,16,1);
      mesh.onBeforeRender = () => { matrices.version = mesh.instanceMatrix.version; };
      const column = (offset: number) => instancedBufferAttribute(matrices,'vec4' as const,16,offset);
      const instance = mat4(column(0),column(4),column(8),column(12));
      material.positionNode=crowdPosition(instance,this.texture,attribute('_part_index','float'),this.frame,positionGeometry);
      this.add(mesh);
    }
  }
  setTime(time: number): void { this.frame.value=Math.round((time % this.clip.duration)/this.clip.duration*(this.clip.frames-1)); }
  dispose(): void {
    for(const child of this.children) { const mesh=child as InstancedMesh; mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); }
    this.texture.dispose(); this.clear();
  }
}
