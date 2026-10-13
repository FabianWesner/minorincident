import { Group, Mesh, MeshBasicNodeMaterial, TorusGeometry, ConeGeometry } from 'three/webgpu';
import { markerAnchor } from '../sim/missions/markerAnchor';
import type { SimWorld } from '../sim/world/SimWorld';
/** Two shared geometries; no per-frame marker allocation or renderer state read by sim. */
export class ObjectiveMarker extends Group {
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: true });
  private readonly ring = new Mesh(new TorusGeometry(0.6,0.05,6,24),this.material);
  private readonly arrow = new Mesh(new ConeGeometry(0.25,0.5,4),this.material);
  constructor(private readonly world: SimWorld){super();this.ring.rotation.x=Math.PI/2;this.ring.position.y=0.08;this.arrow.rotation.z=Math.PI;this.arrow.position.y=2;this.add(this.ring,this.arrow);}
  update():void{const mission=this.world.missions,anchor=markerAnchor(mission);this.visible=mission?.state.phase==='playing'&&!!anchor;if(anchor)this.position.set(anchor.x,anchor.y??0,anchor.z);}
  dispose():void{this.ring.geometry.dispose();this.arrow.geometry.dispose();this.material.dispose();this.clear();}
}
