import { DataTexture, FloatType, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Mesh, RGBAFormat, type BufferGeometry } from 'three/webgpu';
import { attribute, int, ivec2, mat4, positionLocal, textureLoad, uniform, vec4 } from 'three/tsl';
import { palette } from './palette';

export interface CrowdClip { parts: string[]; frames: number; duration: number; matrices: number[] }
export function clipTexture(clip: CrowdClip): DataTexture {
  const texture=new DataTexture(new Float32Array(clip.matrices),clip.parts.length*4,clip.frames,RGBAFormat,FloatType);
  texture.needsUpdate=true; return texture;
}
/** One texel per matrix column; shared by the crowd vertex shader and GPU readback probe. */
export function crowdMatrix(texture: DataTexture, part: Parameters<typeof int>[0], frame: Parameters<typeof int>[0]) {
  const start=int(part).mul(4);
  const column = (index:number) => textureLoad(texture,ivec2(start.add(index),int(frame)));
  return mat4(column(0),column(1),column(2),column(3));
}
/** One instanced mesh per material; per-frame work is a scalar uniform update. */
export class Crowd extends Group {
  readonly frame=uniform(0);
  readonly clip: CrowdClip;
  readonly texture: DataTexture;
  readonly instanceCount: number;
  constructor(baked: Group, count: number) {
    super(); this.instanceCount=count;
    const meshes: Mesh[]=[]; baked.traverse((n)=>{if(n instanceof Mesh)meshes.push(n);});
    const clip=baked.userData.crowd as CrowdClip | undefined;
    if(!clip)throw new Error('Missing crowd clip metadata');
    this.clip=clip; this.texture=clipTexture(clip);
    const transform=new Matrix4();
    for(const source of meshes) {
      const original=Array.isArray(source.material)?source.material[0]:source.material;
      const token=original.name.replace(/^(pal|emi)_/,'');
      const material=new MeshBasicNodeMaterial({color:palette[token] ?? '#ffffff'});
      material.positionNode=crowdMatrix(this.texture,attribute('_part_index','float'),this.frame).mul(vec4(positionLocal,1)).xyz;
      const mesh=new InstancedMesh(source.geometry as BufferGeometry,material,count);
      mesh.frustumCulled=false;
      for(let i=0;i<count;i++){transform.makeTranslation(i%10*1.5,0,Math.floor(i/10)*1.5);mesh.setMatrixAt(i,transform);}
      this.add(mesh);
    }
  }
  setTime(time: number): void { this.frame.value=Math.round((time % this.clip.duration)/this.clip.duration*(this.clip.frames-1)); }
  dispose(): void {
    for(const child of this.children) { const mesh=child as InstancedMesh; mesh.geometry.dispose(); (mesh.material as MeshBasicNodeMaterial).dispose(); }
    this.texture.dispose(); this.clear();
  }
}
