import { BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Group, Mesh, Object3D, Matrix4, CircleGeometry, MeshBasicNodeMaterial, Vector3, DoubleSide } from 'three/webgpu';
import type { Destruction, DestructionObject } from '../sim/destruction/Destruction';
import type { DestructionPart } from '../data/destructionModel';
import type { Aabb } from '../levels/districts/types';
import { InstancedGroup } from './InstancedGroup';

type Vertex = number[];
interface Slice { geometry: BufferGeometry; triangles: { part: number; material: number }[]; indices: number[] }
/** Split a polygon at one plane, preserving every vertex attribute (UV, palette, normals, etc.). */
function plane(poly: Vertex[], axis: number, value: number, keepAbove: boolean): [Vertex[], Vertex[]] {
  const inside: Vertex[] = [], outside: Vertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = (a[axis] - value) * (keepAbove ? 1 : -1), db = (b[axis] - value) * (keepAbove ? 1 : -1);
    (da >= 0 ? inside : outside).push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db), v = a.map((n,j) => n + (b[j]-n)*t); inside.push(v); outside.push(v); }
  }
  return [inside, outside];
}
function cut(poly: Vertex[], box: Aabb): { inside: Vertex[]; outside: Vertex[][] } {
  let contained = true;
  for (let axis=0;axis<3;axis++) {
    let lo=Infinity, hi=-Infinity;for(const vertex of poly){lo=Math.min(lo,vertex[axis]);hi=Math.max(hi,vertex[axis]);}
    if(hi<box.min[axis] || lo>box.max[axis]) return {inside:[],outside:[poly]};
    contained &&= lo>=box.min[axis] && hi<=box.max[axis];
  }
  if(contained) return {inside:poly,outside:[]};
  let inside = poly; const outside: Vertex[][] = [];
  for (let axis = 0; axis < 3 && inside.length >= 3; axis++) for (const side of ['min','max'] as const) {
    const [a,b] = plane(inside,axis,box[side][axis],side === 'min'); inside = a; if (b.length >= 3) outside.push(b);
  }
  return { inside, outside };
}
/** First damage only. Later changes rewrite a bounded index list; intact neighbours keep their shared batch. */
function split(source: BufferGeometry, parts: DestructionPart[]): Slice {
  const names = ['position', ...Object.keys(source.attributes).filter(n=>n!=='position')];
  const attributes = names.map(name => source.getAttribute(name)), sizes = attributes.map(a=>a.itemSize), values = names.map(()=>[] as number[]);
  const triangles: Slice['triangles'] = [], indices: number[] = [];
  const index = source.index, count = index?.count ?? attributes[0].count;
  const emit = (poly: Vertex[], part: number, material: number) => {
    for (let i = 1; i+1 < poly.length; i++) {
      triangles.push({part,material});
      for (const v of [poly[0],poly[i],poly[i+1]]) {
        indices.push(values[0].length/3); let offset=0;
        for(let a=0;a<names.length;a++) { values[a].push(...v.slice(offset,offset+sizes[a])); offset+=sizes[a]; }
      }
    }
  };
  for(let i=0;i<count;i+=3) {
    const poly: Vertex[]=[];
    for(let j=0;j<3;j++) { const vi=index?.getX(i+j)??i+j; poly.push(attributes.flatMap(a=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(vi,c)))); }
    const material = source.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
    // Foundations/floors remain walkable supports, even after the roof and facade are gone.
    let remaining=[poly]; const foundation=cut(poly,{min:[-1e4,-1e4,-1e4],max:[1e4,.45,1e4]});
    if(foundation.inside.length>=3) emit(foundation.inside,-1,material);
    remaining=foundation.outside;
    for(const [part,def] of parts.entries()) {
      const next: Vertex[][]=[];
      for(const polygon of remaining) { const r=cut(polygon,def.bounds); if(r.inside.length>=3) emit(r.inside,part,material); next.push(...r.outside); }
      remaining=next; if(!remaining.length) break;
    }
    for(const polygon of remaining) emit(polygon,-1,material);
  }
  const geometry=new BufferGeometry();
  const stride=sizes.reduce((a,b)=>a+b,0), countVertices=values[0].length/3, packed=new Float32Array(countVertices*stride);
  let offset=0;
  const buffer=new InterleavedBuffer(packed,stride);
  for(let a=0;a<names.length;a++) {
    for(let v=0;v<countVertices;v++) for(let c=0;c<sizes[a];c++) packed[v*stride+offset+c]=values[a][v*sizes[a]+c];
    geometry.setAttribute(names[a],new InterleavedBufferAttribute(buffer,sizes[a],offset));offset+=sizes[a];
  }
  geometry.userData={...source.userData};
  geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return {geometry,triangles,indices};
}
interface Extracted { object: DestructionObject; root: Group; ref: Object3D; batch: InstancedGroup; slices: Slice[]; marks: Mesh[]; revision: number; state: DestructionObject['state']; wreck?: InstancedGroup }
export class DestructionView extends Group {
  private readonly entries = new Map<string,Extracted>();
  private readonly markGeometry = new CircleGeometry(1,8);
  private readonly markMaterial = new MeshBasicNodeMaterial({color:'#171512',side:DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  private readonly normal = new Vector3();
  /** The prototype remains cache-owned. All split buffers and mark meshes belong to this view. */
  extract(object: DestructionObject, prototype: Group, wreckPrototype?: Group): void {
    if(this.entries.has(object.id)) return;
    const root=new Group(), model=new Group(), slices: Slice[]=[], inverse=new Matrix4();
    prototype.updateWorldMatrix(true,true); inverse.copy(prototype.matrixWorld).invert();
    prototype.traverse(node=>{
      if(!(node instanceof Mesh)) return;
      for(let parent: Object3D | null=node;parent;parent=parent.parent) if(!parent.visible)return;
      const source=node.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse,node.matrixWorld));
      const slice=split(source,object.parts); source.dispose(); slices.push(slice);
      const mesh=new Mesh(slice.geometry,node.material); mesh.castShadow=node.castShadow; mesh.receiveShadow=node.receiveShadow; model.add(mesh);
    });
    const ref=new Object3D(), batch=new InstancedGroup(model,[ref],1); root.add(batch); this.add(root);
    const wreck=wreckPrototype?new InstancedGroup(wreckPrototype,[new Object3D()],1):undefined; if(wreck){wreck.visible=false;root.add(wreck);}
    this.entries.set(object.id,{object,root,ref,batch,slices,marks:[],revision:-1,state:object.state,wreck});
  }
  has(id:string):boolean {return this.entries.has(id);}
  update(destruction:Destruction):void {
    for(const e of this.entries.values()) {
      const o=destruction.objects.find(o=>o.id===e.object.id); if(!o) {e.root.visible=false;continue;}
      e.object=o; const pose=destruction.pose(o), s=o.state;
      if(e.state!==s){e.state=s;e.revision=-1;}
      e.root.visible=s.revision>0; if(!e.root.visible){e.revision=-1;continue;}
      e.root.position.fromArray(pose.p);e.root.quaternion.fromArray(pose.q);e.root.scale.fromArray(o.placement.scale);
      e.batch.visible=!s.exploded || !e.wreck; if(e.wreck)e.wreck.visible=s.exploded;
      if(e.revision===s.revision) continue; e.revision=s.revision;
      // Instance wrappers borrow the vertex arrays but own their index wrapper: update both on damage.
      for(const [i,slice] of e.slices.entries()) {
        const live:number[]=[]; slice.geometry.clearGroups(); let groupStart=0,material=-1;
        for(const [tri,t] of slice.triangles.entries()) {
          if(t.part>=0&&s.hp[t.part]<=0) continue;
          if(t.material!==material) {if(live.length>groupStart)slice.geometry.addGroup(groupStart,live.length-groupStart,material);groupStart=live.length;material=t.material;}
          live.push(...slice.indices.slice(tri*3,tri*3+3));
        }
        if(live.length>groupStart) slice.geometry.addGroup(groupStart,live.length-groupStart,material);
        slice.geometry.setIndex(live);
        const mesh=e.batch.children[i] as Mesh; mesh.geometry.setIndex(slice.geometry.index);mesh.geometry.groups=slice.geometry.groups;
      }
      e.ref.userData.tint=s.fireClock>0?'#665449':o.placement.tint; e.batch.update();
      for(let i=0;i<8;i++) {
        const mark=s.marks[i];let mesh=e.marks[i];
        if(!mark) {if(mesh)mesh.visible=false;continue;}
        if(!mesh) {mesh=new Mesh(this.markGeometry,this.markMaterial);e.marks.push(mesh);e.root.add(mesh);}
        mesh.visible=s.hp[mark.part]>0;mesh.position.fromArray(mark.at).addScaledVector(this.normal.fromArray(mark.normal),.015);
        mesh.quaternion.setFromUnitVectors(new Vector3(0,0,1),this.normal);
        mesh.scale.setScalar(mark.kind==='scorch'?.32:mark.kind==='chip'?.09:.045);
      }
    }
  }
  dispose():void {for(const e of this.entries.values()){e.batch.dispose();e.wreck?.dispose();for(const s of e.slices)s.geometry.dispose();}this.entries.clear();this.markGeometry.dispose();this.markMaterial.dispose();this.clear();}
}
