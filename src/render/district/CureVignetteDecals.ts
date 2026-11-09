import { Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three/webgpu';
import { attribute, texture, uv } from 'three/tsl';
import { groundDepth, groundLayers } from '../GroundLayers';
import type { CureVignetteDecal } from '../../levels/L10/vignettes';

/** One atlas and one instanced draw for wall paint and spent casings. No per-frame text, actors, lights or new physics. */
export class CureVignetteDecals extends Group {
  private readonly mesh:InstancedMesh;
  private readonly cells:InstancedBufferAttribute;
  private readonly transform=new Object3D();
  private focus=[Infinity,Infinity];
  private low=false;
  private barnDestroyed=false;
  private shown:string[]=[];
  private readonly roofs:Mesh[]=[];
  static async load(rows:readonly CureVignetteDecal[]):Promise<CureVignetteDecals>{
    const atlas=await new TextureLoader().loadAsync('/assets/decals/l10-stories.png');atlas.colorSpace=SRGBColorSpace;
    return new CureVignetteDecals(rows,atlas);
  }
  constructor(private readonly rows:readonly CureVignetteDecal[],private readonly atlas:Texture){
    super();const geometry=new PlaneGeometry(1,1);
    this.cells=new InstancedBufferAttribute(new Float32Array(rows.length*4),4);geometry.setAttribute('storyAtlas',this.cells);
    const rect=attribute('storyAtlas','vec4'),sample=texture(atlas,uv().mul(rect.zw).add(rect.xy));
    const material=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,alphaTest:.08});
    material.colorNode=sample.rgb.mul(.72);material.opacityNode=sample.a;
    groundDepth(material,groundLayers.footprint);
    this.mesh=new InstancedMesh(geometry,material,rows.length);this.mesh.frustumCulled=false;this.mesh.count=0;this.add(this.mesh);
    for(const row of rows.filter(r=>r.roof)){
      const roof=new Mesh(new PlaneGeometry(row.size[0]+.4,row.size[1]+.4),new MeshBasicNodeMaterial({color:0x493c2d}));
      roof.name=row.id;roof.rotation.x=-Math.PI/2;roof.position.fromArray(row.position);roof.position.y-=.02;this.roofs.push(roof);this.add(roof);
    }
  }
  update(focus:{x:number;z:number},low:boolean,barnDestroyed=false):void{
    if(low===this.low&&barnDestroyed===this.barnDestroyed&&Math.hypot(focus.x-this.focus[0],focus.z-this.focus[1])<3)return;
    this.focus=[focus.x,focus.z];this.low=low;this.barnDestroyed=barnDestroyed;this.shown=[];
    for(const roof of this.roofs)roof.visible=!barnDestroyed&&Math.hypot(roof.position.x-focus.x,roof.position.z-focus.z)<(low?60:90);
    let index=0;
    for(const row of this.rows){
      if(row.roof&&barnDestroyed)continue;
      if(low&&row.highOnly||Math.hypot(row.position[0]-focus.x,row.position[2]-focus.z)>(low?60:90))continue;
      this.transform.position.fromArray(row.position);this.transform.rotation.set(row.ground?-Math.PI/2:0,row.yaw,0,'YXZ');this.transform.scale.set(row.size[0],row.size[1],1);this.transform.updateMatrix();
      this.mesh.setMatrixAt(index,this.transform.matrix);this.cells.setXYZW(index,(row.cell%4)/4,(3-Math.floor(row.cell/4))/4,.25,.25);
      this.shown.push(row.id);index++;
    }
    this.mesh.count=index;this.mesh.instanceMatrix.needsUpdate=this.cells.needsUpdate=true;
  }
  /** Native QA can inspect selection without launching a renderer. */
  visibleIds():readonly string[]{return this.shown;}
  dispose():void{this.mesh.geometry.dispose();(this.mesh.material as MeshBasicNodeMaterial).dispose();this.mesh.dispose();for(const roof of this.roofs){roof.geometry.dispose();(roof.material as MeshBasicNodeMaterial).dispose();}this.atlas.dispose();this.clear();}
}
