import { Group, Mesh, MeshBasicNodeMaterial, TorusGeometry, ConeGeometry } from 'three/webgpu';
import { markerAnchor, searchAnchors } from '../sim/missions/markerAnchor';
import type { SimWorld } from '../sim/world/SimWorld';
/** Two shared geometries; no per-frame marker allocation or renderer state read by sim. */
export class ObjectiveMarker extends Group {
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  private readonly ring = new Mesh(new TorusGeometry(0.6,0.05,6,24),this.material);
  private readonly arrow = new Mesh(new ConeGeometry(0.25,0.5,4),this.material);
  private readonly searches = Array.from({ length: 5 }, () => {
    const ring = new Mesh(this.ring.geometry, this.material); ring.rotation.x = Math.PI / 2; ring.renderOrder = 94; return ring;
  });
  constructor(private readonly world: SimWorld){super();this.ring.renderOrder=94;this.arrow.renderOrder=95;this.ring.rotation.x=Math.PI/2;this.ring.position.y=0.08;this.arrow.rotation.z=Math.PI;this.arrow.position.y=2;this.add(this.ring,this.arrow);}
  update():void{
    const mission=this.world.missions,reached=!!mission?.state.l3?.crossedAt,anchor=reached?mission!.def.anchors['l3-zone']:markerAnchor(mission);
    const searches = searchAnchors(mission), metroDone = !!mission?.state.l5?.shutterAt, playing = mission?.state.phase === 'playing' && !metroDone;
    this.material.color.set(reached?'#71e8a3':'#ffcf77');this.arrow.visible=!!anchor&&!reached;this.ring.visible=!!anchor;
    this.visible=playing&&(!!anchor||searches.length>0);
    this.position.set(anchor?.x??0,anchor?(this.world.districts?.groundHeight(anchor.x,anchor.z)??anchor.y??0):0,anchor?.z??0);
    this.ring.position.set(0,.08,0);this.arrow.position.set(0,2,0);
    this.searches.forEach((ring,i)=>{if(!ring.parent)this.add(ring);const a=searches[i];ring.visible=!!a;if(a)ring.position.set(a.x-this.position.x,(this.world.districts?.groundHeight(a.x,a.z)??a.y??0)+.08-this.position.y,a.z-this.position.z);});
  }
  dispose():void{this.ring.geometry.dispose();this.arrow.geometry.dispose();this.material.dispose();this.clear();}
}
