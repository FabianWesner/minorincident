import type { Document, Node, Primitive } from '@gltf-transform/core';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { adoptStandingBind } from './skin-crowd-standing';

export interface FigureRatios { headHeight: number; headShoulder: number; legHeight: number; shoulderHeight: number }
interface Vertex { profileHead?:boolean;profileWeight?:number; point: Vector3; owner: string; influences?: { name: string; weight: number }[] }
const ignored = /stump|skin_eyes|iris|pupil|clipboard|rifle|weapon|shield|baton|cane|spatula|cushion|restOnly/i;
const headOwner = (name: string) => /head|neck|eye|pony|hair|iris/.test(name);
const shortName = (name: string) => name.replace(/^survivor\d+_/, '');
function figureNodes(document: Document, rootName?: string) {
  if (!rootName) return document.getRoot().listNodes();
  const root = document.getRoot().listNodes().find(n => n.getName() === rootName);
  if (!root) throw Error(`Missing figure root ${rootName}`);
  const nodes: Node[] = []; root.traverse(n => nodes.push(n)); return nodes;
}
const world = (node: Node) => new Matrix4().fromArray(node.getWorldMatrix());
function ownerName(node: Node): string {
  for (let parent: Node | null = node; parent; parent = parent.getParentNode()) {
    if (/^(head|hip|torso|arm[LR]|foreArm[LR]|hand[LR]|leg[LR]|shin[LR]|foot[LR])$/.test(shortName(parent.getName()))) return shortName(parent.getName());
  }
  return node.getName();
}
function primitiveVertices(node: Node, primitive: Primitive): Vertex[] {
  const position = primitive.getAttribute('POSITION')!;
  const skin = node.getSkin(), indices = primitive.getAttribute('JOINTS_0'), weights = primitive.getAttribute('WEIGHTS_0');
  const matrices = skin?.listJoints().map((joint, i) => world(joint).multiply(new Matrix4().fromArray(skin.getInverseBindMatrices()!.getElement(i, []))));
  const used = primitive.getIndices() ? new Set(Array.from({ length: primitive.getIndices()!.getCount() }, (_, i) => primitive.getIndices()!.getScalar(i))) : Array.from({ length: position.getCount() }, (_, i) => i);
  const vertices: Vertex[] = [];
  for (const i of used) {
    const raw = new Vector3().fromArray(position.getElement(i, []));
    let point = raw.clone().applyMatrix4(world(node)), owner = ownerName(node);
    let influences: Vertex['influences'];
    if (matrices && indices && weights) {
      const j = indices.getElement(i, []), w = weights.getElement(i, []);
      point = new Vector3(); let dominant = 0;
      for (let k = 0; k < w.length; k++) { if (w[k] > w[dominant]) dominant = k; if (w[k]) point.add(raw.clone().applyMatrix4(matrices[j[k]]).multiplyScalar(w[k])); }
      owner = shortName(skin!.listJoints()[j[dominant]].getName());
      influences = j.map((part,k) => ({ name: shortName(skin!.listJoints()[part].getName()), weight:w[k] }));
    }
    vertices.push({ point, owner, influences,profileWeight:primitive.getAttribute('_Q249_WEIGHT')?.getScalar(i),profileHead:primitive.getAttribute('_Q249_HEAD')?!!primitive.getAttribute('_Q249_HEAD')!.getScalar(i):undefined });
  }
  return vertices;
}
export function measureFigure(document: Document, rootName?: string, shoulderReferenceHeight?: number) {
  const nodes = figureNodes(document, rootName);
  const joint = (name: string) => { const n = nodes.find(n => shortName(n.getName()) === name); if (!n) throw Error(`Missing anatomy joint ${name}`); return new Vector3().setFromMatrixPosition(world(n)); };
  const head = joint('head'), hip = joint('hip'), shoulderY = (joint('armL').y + joint('armR').y) / 2;
  const body = nodes.filter(n => n.getMesh() && !ignored.test(n.getName()) && !n.getExtras().hidden).flatMap(n => n.getMesh()!.listPrimitives().flatMap(p => primitiveVertices(n, p)));
  const extent = (vertices: Vertex[], axis: 'x' | 'y' | 'z') => { let min = Infinity, max = -Infinity; for (const v of vertices) { min = Math.min(min, v.point[axis]); max = Math.max(max, v.point[axis]); } return { min, max, size: max - min }; };
  const vertical = extent(body, 'y');
  const profile=nodes.find(n=>shortName(n.getName())==='root')?.getExtras().q249HeadProfile;
  const fullHead = body.filter(v => profile?v.profileHead:v.owner === 'head');
  const authoredBottom=nodes.find(n=>shortName(n.getName())==='root')?.getExtras().q249HeadBottom as number|undefined;
  const headBottom = authoredBottom??(profile==='long-hair'?1.13:extent(fullHead, 'y').min - .005);
  const skull = fullHead.filter(v => profile?v.point.y>=headBottom:v.point.y >= head.y);
  const crown = extent(skull, 'y').max;
  const skullWidth = extent(skull, 'z');
  // The old rig's arm pivots sit above its shirt shoulders. Include the upper
  // sleeve envelope below those pivots, rather than measuring a neck slice.
  // Freeze this world-space band across the before/after comparison.
  const bandHeight = shoulderReferenceHeight ?? vertical.size;
  const shoulders = extent(body.filter(v => /^(torso|chest|spine|clavicle[LR]|arm[LR])$/.test(v.owner) && v.point.y >= shoulderY - bandHeight * .10 && v.point.y <= shoulderY + bandHeight * .017), 'z');
  const ratios: FigureRatios = { headHeight: (crown - headBottom) / vertical.size, headShoulder: skullWidth.size / shoulders.size, legHeight: (hip.y - vertical.min) / vertical.size, shoulderHeight: shoulders.size / vertical.size };
  if (!Object.values(ratios).every(v => Number.isFinite(v) && v > 0)) throw Error('Cannot measure anatomy');
  const pivotOverride=nodes.find(n=>shortName(n.getName())==='root')?.getExtras().q249HeadPivot as number[]|undefined;
  const headPivot=pivotOverride?new Vector3().fromArray(pivotOverride):new Vector3(head.x,headBottom,head.z);
  const fixed=body.filter(v=>profile?!v.profileHead:!headOwner(v.owner));const fixedMin=extent(fixed,'y').min,fixedMax=extent(fixed,'y').max;const headMin=extent(fullHead,'y').min;
  return { headPivot,fixedMin,fixedMax,headMin,ratios, ground: vertical.min, height: vertical.size, crown, head, headBottom, jointHeadHeight: (crown-head.y)/vertical.size, hip, shoulderY, shoulderWidth: shoulders.size, headCentreZ: (skullWidth.min + skullWidth.max) / 2, headCentreX: (extent(skull, 'x').min + extent(skull, 'x').max) / 2 };
}

/** Pilot-2: preserve the original body and uniformly shrink the complete head
 * about a neck pivot below the lowest chin/beard point. Only the narrow neck
 * connection tapers. Hands shrink around their wrists with existing weights.
 * Everything is baked into mesh + bind pose once; no per-frame anatomy cost. */
export function planHeadScale(before: ReturnType<typeof measureFigure>, target: FigureRatios) {
  const a=before.crown-before.headBottom, b=before.headBottom-before.ground;
  const heightScale=(ratio:number)=>(ratio*b-.005)/(a-.005-ratio*a);
  const legScale=(ratio:number)=>((before.hip.y-before.ground)/ratio-b)/a;
  const intervals={
    headHeight:[heightScale(target.headHeight*.9),heightScale(target.headHeight*1.1)],
    headShoulder:[target.headShoulder*.9/before.ratios.headShoulder,target.headShoulder*1.1/before.ratios.headShoulder],
    legHeight:[legScale(target.legHeight*1.1),legScale(target.legHeight*.9)],
  };
  const minimum=Math.max(.1,...Object.values(intervals).map(v=>v[0])), maximum=Math.min(1,...Object.values(intervals).map(v=>v[1]));
  // PO rollout decision: head size wins. A smaller head is acceptable; never
  // widen the body or enlarge a head to meet a lower ratio bound. Use 1.099
  // for a small serialization margin under the explicit heroine × 1.1 cap.
  const limits={headHeight:heightScale(target.headHeight*1.099),headShoulder:target.headShoulder*1.099/before.ratios.headShoulder};
  
  // The fixed torso can stay higher than the head in a crouch. Solve the
  // actual fixed-body envelope around the neck pivot instead of assuming the
  // shrunken crown remains the figure's tallest point.
  const ratioAt=(s:number)=>{const low=before.headPivot.y+(before.headMin-before.headPivot.y)*s;const high=before.headPivot.y+(before.crown-before.headPivot.y)*s;return (high-low+.005)/(Math.max(before.fixedMax,high)-Math.min(before.fixedMin,low));};
  let lo=0,hi=1;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(ratioAt(mid)<=target.headHeight*1.099)lo=mid;else hi=mid;}
  limits.headHeight=lo;
  const scale=Math.min(1,limits.headHeight,limits.headShoulder);
  const binding=limits.headHeight<limits.headShoulder?'headHeight':'headShoulder';
  return {feasible:true,strictThreeRatioIntervalFeasible:minimum<=maximum,minimum,maximum,intervals,limits,binding:scale===1?'already-small-enough':binding,scale};
}

export function calibrateFigure(document: Document, target: FigureRatios, options: { rootName?: string; headScale?: number; handScale?: number } = {}) {
  const before = measureFigure(document,options.rootName);
  const nodes = figureNodes(document,options.rootName);
  const anatomy = nodes.filter(n => n.getMesh() && !ignored.test(n.getName()) && !n.getExtras().hidden).flatMap(n => n.getMesh()!.listPrimitives().flatMap(p => primitiveVertices(n,p)));
  const profile=nodes.find(n=>shortName(n.getName())==='root')?.getExtras().q249HeadProfile;
  const blendNeck=nodes.find(n=>shortName(n.getName())==='root')?.getExtras().q249NeckBlend;
  const headPoints = anatomy.filter(v => profile?v.profileHead:v.owner === 'head');
  const headBottom = Math.min(...headPoints.map(v => v.point.y));
  const plane = headBottom - .005, pivot = before.headPivot.clone();
  // Match width first, retaining enough complete chin-to-crown height to stay
  // inside the heroine's 10% interval. Both constraints use one XYZ scalar.
  const minimumHeadHeight = target.headHeight * .903;
  const minScale = (minimumHeadHeight * (plane-before.ground) - .005) /
    ((before.crown-headBottom) - minimumHeadHeight*(before.crown-plane));
  const headScale = options.headScale ?? Math.max(target.headShoulder / before.ratios.headShoulder, minScale), handScale = options.handScale ?? .75;
  const wrists = ['L','R'].map(side => new Vector3().setFromMatrixPosition(world(nodes.find(n => shortName(n.getName()) === `hand${side}`)!)));
  const smooth = (t:number) => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const deform = (vertex: Vertex) => {
    const {point:p,owner,influences}=vertex;
    if(profile){
      // A continuous spatial neck field avoids opening the welded TRELLIS
      // surface at the source rig's arbitrary dominant-weight boundary.
      const weight=profile==='long-hair'?(vertex.profileWeight??smooth((p.y-1.13)/.12)):smooth((p.x-.18)/.20)*smooth((p.y-.36)/.08)*(Math.abs(p.z)>.25?smooth((p.y-.59)/.08):1);
      if(weight)return p.clone().lerp(p.clone().sub(pivot).multiplyScalar(headScale).add(pivot),weight);
    }else if(influences&&blendNeck){
      const influence=influences.filter(j=>headOwner(j.name)).reduce((s,j)=>s+j.weight,0);
      const weight=smooth((influence-.05)/.55);
      if(weight)return p.clone().lerp(p.clone().sub(pivot).multiplyScalar(headScale).add(pivot),weight);
    }else if(headOwner(owner)) return p.clone().sub(pivot).multiplyScalar(headScale).add(pivot);
    const result=p.clone();
    // Blend only the slender neck under the beard; the shoulders and shirt
    // silhouette are outside this 8 cm radius and remain exactly as authored.
    const radius=Math.hypot(p.x-pivot.x,p.z-pivot.z);
    if(owner==='torso' && p.y>plane-.035 && radius<.08){
      const weight=smooth((p.y-(plane-.035))/.035)*(1-smooth((radius-.055)/.025));
      result.lerp(p.clone().sub(pivot).multiplyScalar(headScale).add(pivot),weight);
    }
    for(let side=0;side<2;side++){
      const name=side?'handR':'handL';
      // A few source rigs have tiny hand weights on the upper arm/torso.
      // They are not hand geometry: retain that body surface exactly.
      const wristSeam=owner===(side?'foreArmR':'foreArmL')&&p.distanceTo(wrists[side])<.12;
      if(owner!==name&&!wristSeam)continue;
      const weight=influences?.filter(v=>v.name===name).reduce((sum,v)=>sum+v.weight,0) ?? Number(owner===name);
      if(weight) result.add(p.clone().sub(wrists[side]).multiplyScalar((handScale-1)*weight));
    }
    return result;
  };
  const oldWorld=new Map(nodes.map(n=>[n,world(n)]));
  const newWorld=new Map(nodes.map(n=>{const m=oldWorld.get(n)!.clone(),p=new Vector3().setFromMatrixPosition(m);return [n,m.setPosition(deform({point:p,owner:ownerName(n)}))] as const;}));
  const surfaces=nodes.flatMap(node=>node.getMesh()?.listPrimitives().map(primitive=>({node,primitive,vertices:primitiveVertices(node,primitive)})) ?? []);
  for(const node of nodes){
    const parent=node.getParentNode(),matrix=(parent?(newWorld.get(parent)??world(parent)).clone().invert().multiply(newWorld.get(node)!):newWorld.get(node)!).toArray();
    // Retain authored body TRS exactly. Decomposing an unchanged matrix can
    // normalize a quantized quaternion and move a shoulder on serialization.
    if(matrix.some((v,i)=>Math.abs(v-node.getMatrix()[i])>1e-10))node.setMatrix(matrix);
  }
  for(const {node,primitive,vertices} of surfaces){
    const position=primitive.getAttribute('POSITION')!,output=position.clone().setArray(new Float32Array(position.getCount()*3)).setNormalized(false),index=primitive.getIndices();
    const ids=index?[...new Set(Array.from({length:index.getCount()},(_,i)=>index.getScalar(i)))]:Array.from({length:position.getCount()},(_,i)=>i);
    const local=node.getSkin()?new Matrix4():newWorld.get(node)!.clone().invert();
    ids.forEach((id,k)=>output.setElement(id,deform(vertices[k]).applyMatrix4(local).toArray()));primitive.setAttribute('POSITION',output);
    const source=primitive.getAttribute('NORMAL');
    if(source){const normal=source.clone(),into=node.getSkin()?new Matrix3():new Matrix3().getNormalMatrix(oldWorld.get(node)!),from=node.getSkin()?new Matrix3():new Matrix3().getNormalMatrix(local);
      ids.forEach((id,k)=>{const v=vertices[k],base=deform(v),e=1e-4,cols=[new Vector3(e,0,0),new Vector3(0,e,0),new Vector3(0,0,e)].map(delta=>deform({...v,point:v.point.clone().add(delta)}).sub(base).divideScalar(e));const jacobian=new Matrix3().set(cols[0].x,cols[1].x,cols[2].x,cols[0].y,cols[1].y,cols[2].y,cols[0].z,cols[1].z,cols[2].z).invert().transpose();normal.setElement(id,new Vector3().fromArray(source.getElement(id,[])).applyMatrix3(into).applyMatrix3(jacobian).applyMatrix3(from).normalize().toArray());});primitive.setAttribute('NORMAL',normal);
    }
  }
  for(const skin of document.getRoot().listSkins()){const matrices=new Float32Array(skin.listJoints().length*16);skin.listJoints().forEach((n,i)=>world(n).invert().toArray(matrices,i*16));skin.setInverseBindMatrices(skin.getInverseBindMatrices()!.clone().setArray(matrices));}
  const root=nodes.find(n=>shortName(n.getName())==='root')!;root.setExtras({...root.getExtras(),preserveAuthoredBodyScale:true});
  adoptStandingBind(document);
  const after=measureFigure(document,options.rootName,before.height);
  let unchangedBodyMaxDisplacementM=0, unchangedBodyVertices=0, unchangedJointMaxDisplacementM=0;
  for(const {node,primitive,vertices} of surfaces){
    const current=primitiveVertices(node,primitive);
    vertices.forEach((v,i)=>{
      const neck=v.owner==='torso' && v.point.y>plane-.035 && Math.hypot(v.point.x-pivot.x,v.point.z-pivot.z)<.08;
      const hand=/^hand[LR]$/.test(v.owner)||wrists.some((w,i)=>v.owner===(i?'foreArmR':'foreArmL')&&v.point.distanceTo(w)<.12&&v.influences?.some(j=>j.name===(i?'handR':'handL')&&j.weight>0));
      const profileNeck=profile==='long-hair'?(v.profileWeight??0)>0:profile==='crawler'?v.point.x>.18&&v.point.y>.36:false;
      const headSeam=v.influences?.filter(j=>headOwner(j.name)).reduce((s,j)=>s+j.weight,0)??0;
      if(headOwner(v.owner)||neck||hand||profileNeck||headSeam>.05)return;
      unchangedBodyVertices++;
      unchangedBodyMaxDisplacementM=Math.max(unchangedBodyMaxDisplacementM,v.point.distanceTo(current[i].point));
    });
  }
  for(const node of nodes.filter(n=>/^(hip|torso|arm[LR]|foreArm[LR]|hand[LR]|leg[LR]|shin[LR]|foot[LR])$/.test(shortName(n.getName())))) {
    unchangedJointMaxDisplacementM=Math.max(unchangedJointMaxDisplacementM,new Vector3().setFromMatrixPosition(oldWorld.get(node)!).distanceTo(new Vector3().setFromMatrixPosition(world(node))));
  }
  if(unchangedBodyMaxDisplacementM>1e-6 || unchangedJointMaxDisplacementM>1e-6) throw Error('Body changed outside head/neck/hands');
  return {before:before.ratios,after:after.ratios,target,headBottomPlane:plane,headScale,handScale,
    jointHeadHeightBefore:before.jointHeadHeight,jointHeadHeightAfter:after.jointHeadHeight,
    shoulderWidthBefore:before.shoulderWidth,shoulderWidthAfter:after.shoulderWidth,bodyScale:1,
    heightBefore:before.height,heightAfter:after.height,
    unchangedBodyVertices,unchangedBodyMaxDisplacementM,unchangedJointMaxDisplacementM};
}
