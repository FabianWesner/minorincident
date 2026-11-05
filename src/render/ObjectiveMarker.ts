import { Group, Mesh, MeshBasicNodeMaterial, TorusGeometry, ConeGeometry, Shape, ShapeGeometry } from 'three/webgpu';
import { markerAnchor, objectiveRingRadius } from '../sim/missions/markerAnchor';
import type { SimWorld } from '../sim/world/SimWorld';
/** Resolve the marker on its walkable layer, including paving/roof edges, rather than an obsolete authored street height. */
export function markerSurfaceY(world: SimWorld, anchor: { x: number; z: number; y?: number }): number {
  if (anchor.y !== undefined && anchor.y < 0) return anchor.y;
  const feet = (world.entities?.get(1)?.transform.y ?? .7) - .7;
  const layer = anchor.y && Math.abs(anchor.y) > .05 ? anchor.y : feet;
  return Math.max(anchor.y ?? 0, world.districts?.supportBelow(anchor.x, anchor.z, layer) ?? 0);
}
/** Flat ground chevron (tip toward local -Z): an outlined arrow, unlike the pale leaf triangles strewn over L1's streets. */
function chevron(size: number): ShapeGeometry {
  const s = new Shape(), p = [[0, .45], [.6, -.15], [.6, -.47], [0, .12], [-.6, -.47], [-.6, -.15]];
  s.moveTo(p[0][0] * size, p[0][1] * size); for (const [x, y] of p.slice(1)) s.lineTo(x * size, y * size); s.closePath();
  return new ShapeGeometry(s).rotateX(-Math.PI / 2);
}
const cueSpacing = [1.3, 2.4, 3.5];
/** Shared geometries; no per-frame marker allocation or renderer state read by sim. */
export class ObjectiveMarker extends Group {
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  private readonly ringMaterial = new MeshBasicNodeMaterial({ color: '#ffcf77', depthTest: true, depthWrite: false, toneMapped: false, fog: false });
  private readonly ring = new Mesh(new TorusGeometry(objectiveRingRadius-.05,.05,6,24),this.ringMaterial);
  private readonly arrow = new Mesh(new ConeGeometry(0.25,0.5,4),this.material);
  // fix65-a (L1-16): a single pale cone 1.6 m ahead read as one more leaf on the pavement. A trail of three dark-outlined
  // chevrons along the next walkable leg reads as a route from the game camera at zoom 0.5-1.5.
  private readonly outlineMaterial = new MeshBasicNodeMaterial({ color: '#3b2616', depthTest: true, depthWrite: false, toneMapped: false, fog: false });
  private readonly cueGeometry = chevron(1);
  private readonly cueOutlineGeometry = chevron(1.32);
  private readonly routeCue = new Group();
  private readonly cueMarks = cueSpacing.map(() => { const g = new Group(), o = new Mesh(this.cueOutlineGeometry, this.outlineMaterial), m = new Mesh(this.cueGeometry, this.ringMaterial); o.renderOrder = 92; m.renderOrder = 93; m.position.y = .01; o.position.z = .06; g.add(o, m); return g; });
  private readonly cueRoute = { path: [] as number[], goal: -1, pathIndex: 0 };
  private readonly cuePoint = { x: 0, z: 0 };
  private readonly cueFrom = { x: Infinity, z: Infinity };
  private cueTick = -Infinity;
  private cueAnchor: object | null = null;
  private cueReady = false;
  constructor(private readonly world: SimWorld){super();this.ring.renderOrder=94;this.arrow.renderOrder=95;this.ring.rotation.x=Math.PI/2;this.ring.position.y=0.08;this.arrow.rotation.z=Math.PI;this.arrow.position.y=2;this.routeCue.add(...this.cueMarks);this.add(this.ring,this.arrow,this.routeCue);}
  // The L3 corridor steer ('l3-route') only guides the HUD arrow; the world ring stays at the army checkpoint (PO 10-31:
  // "Checkpoint should not move with me").
  // L5 search spots are unmarked (Q-302, found by sound); this marker draws the single current objective.
  update(_storyShot?: boolean, zoomScale = 1):void{
    const mission=this.world.missions,reached=!!mission?.state.l3?.crossedAt,anchor=reached||mission?.state.marker==='l3-route'?mission!.def.anchors['l3-zone']:markerAnchor(mission);
    const metroDone=!!mission?.state.l5?.shutterAt;
    this.material.color.set(reached?'#71e8a3':'#ffcf77');this.ringMaterial.color.copy(this.material.color);this.arrow.visible=!reached;
    // Camera pull-backs retain the active waypoint, so guidance survives the reveal.
    this.visible=!this.world.storyLock&&!this.world.l7Departure?.cinematic&&mission?.state.phase==='playing'&&!metroDone&&!!anchor;
    this.scale.setScalar(Math.max(1,zoomScale));
    if(anchor)this.position.set(anchor.x,markerSurfaceY(this.world,anchor),anchor.z);
    this.routeCue.visible = false;
    const player = this.world.entities.get(1), nav = this.world.infected?.nav;
    if (this.visible && this.world.scenario === 'L1' && (mission?.state.marker === 'parcel-counter' || mission?.state.marker === 'lab-door' || mission?.state.marker === 'garage-door') && anchor && player && nav) {
      // L1's depot, Annex and garage fences make a direct bearing ambiguous.
      // Show the next walkable leg without moving the destination.
      if (anchor !== this.cueAnchor) {
        this.cueAnchor = anchor; this.cueRoute.path.length = 0; this.cueRoute.goal = -1; this.cueTick = -Infinity;
      }
      if (this.world.tick - this.cueTick >= 15) {
        this.cueTick = this.world.tick;
        // A camera update can follow a long paused QA step or a checkpoint
        // restore. Replan from the new pose instead of pointing back at a
        // cached leg the player has already passed.
        if (Math.hypot(player.transform.x - this.cueFrom.x, player.transform.z - this.cueFrom.z) > 3) this.cueRoute.goal = -1;
        this.cueFrom.x = player.transform.x; this.cueFrom.z = player.transform.z;
        this.cueReady = nav.steer(player.transform, anchor, this.cueRoute, .45, this.cuePoint, Infinity, true, 20);
      }
      const dx = this.cuePoint.x - player.transform.x, dz = this.cuePoint.z - player.transform.z, distance = Math.hypot(dx, dz);
      if (this.cueReady && distance > .6 && Math.hypot(anchor.x - player.transform.x, anchor.z - player.transform.z) > 2) {
        const ux = dx / distance, uz = dz / distance, yaw = Math.atan2(-ux, -uz), inv = 1 / this.scale.x;
        this.routeCue.position.set(-this.position.x, -this.position.y, -this.position.z).multiplyScalar(inv);
        this.routeCue.scale.setScalar(inv);
        for (const [i, mark] of this.cueMarks.entries()) {
          // Chevrons past the next turn would point into the wall; keep them on this leg.
          const ahead = Math.min(cueSpacing[i], Math.max(.9, distance - .3) * (i + 1) / cueSpacing.length), x = player.transform.x + ux * ahead, z = player.transform.z + uz * ahead;
          mark.position.set(x, (this.world.districts?.supportBelow(x, z, player.transform.y - .7) ?? 0) + .12, z);
          mark.rotation.set(0, yaw, 0);
          // A slow travelling pulse (presentation only) leads the eye along the leg.
          mark.scale.setScalar(.9 + .18 * Math.max(0, Math.sin(this.world.tick * .12 - i * 1.1)));
        }
        this.routeCue.visible = true;
      }
    }
  }
  dispose():void{this.ring.geometry.dispose();this.arrow.geometry.dispose();this.cueGeometry.dispose();this.cueOutlineGeometry.dispose();this.outlineMaterial.dispose();this.material.dispose();this.ringMaterial.dispose();this.clear();}
}
