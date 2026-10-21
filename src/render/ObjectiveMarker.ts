import { Group, Mesh, MeshBasicNodeMaterial, TorusGeometry, ConeGeometry } from 'three/webgpu';
import { markerAnchor, objectiveRingRadius } from '../sim/missions/markerAnchor';
import type { SimWorld } from '../sim/world/SimWorld';
/** Resolve the marker on its walkable layer, including paving/roof edges, rather than an obsolete authored street height. */
export function markerSurfaceY(world: SimWorld, anchor: { x: number; z: number; y?: number }): number {
  if (anchor.y !== undefined && anchor.y < 0) return anchor.y;
  const feet = (world.entities?.get(1)?.transform.y ?? .7) - .7;
  const layer = anchor.y && Math.abs(anchor.y) > .05 ? anchor.y : feet;
  return Math.max(anchor.y ?? 0, world.districts?.supportBelow(anchor.x, anchor.z, layer) ?? 0);
}
/** Two shared geometries; no per-frame marker allocation or renderer state read by sim. */
export class ObjectiveMarker extends Group {
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  private readonly ringMaterial = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: true, depthWrite: false, toneMapped: false, fog: false });
  private readonly ring = new Mesh(new TorusGeometry(objectiveRingRadius-.05,.05,6,24),this.ringMaterial);
  private readonly arrow = new Mesh(new ConeGeometry(0.25,0.5,4),this.material);
  constructor(private readonly world: SimWorld){super();this.ring.renderOrder=94;this.arrow.renderOrder=95;this.ring.rotation.x=Math.PI/2;this.ring.position.y=0.08;this.arrow.rotation.z=Math.PI;this.arrow.position.y=2;this.add(this.ring,this.arrow);}
  // L5 search spots are drawn by SurvivorRings (batch 13e); this marker draws the single current objective.
  update(storyShot = false):void{
    const mission=this.world.missions,reached=!!mission?.state.l3?.crossedAt,anchor=reached?mission!.def.anchors['l3-zone']:markerAnchor(mission);
    const metroDone=!!mission?.state.l5?.shutterAt;
    this.material.color.set(reached?'#71e8a3':'#ffcf77');this.ringMaterial.color.copy(this.material.color);this.arrow.visible=!reached;
    this.visible=!storyShot&&!this.world.storyLock&&!this.world.l7Departure?.cinematic&&mission?.state.phase==='playing'&&!metroDone&&!!anchor;
    if(anchor)this.position.set(anchor.x,markerSurfaceY(this.world,anchor),anchor.z);
  }
  dispose():void{this.ring.geometry.dispose();this.arrow.geometry.dispose();this.material.dispose();this.ringMaterial.dispose();this.clear();}
}
