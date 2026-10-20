/** Assemble delivered metro models; only the street ground is baked here. No new model geometry. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { worldAssets } from '../../src/assets/worldDefinitions';
import physicsAssets from '../../src/data/physicsAssets';
import { l6, l6Doors, l6PhotoSpots } from '../../src/data/l6';
import type { DistrictLayout, Placement, Point } from '../../src/levels/districts/types';
/** The station sits SZ north of its authored frame so its platform track (kit.metro-track, z=23 in model frame) lands on the tunnel line z=15 (PO 10-15 "Tracks are disconnected"). */
const SZ = -8;
const rect = (a: number, b: number, c: number, d: number): Point[] => [[a,b],[c,b],[c,d],[a,d],[a,b]];
const layout: DistrictLayout = { version: 1, district: 'D-SUBWAY', title: 'Lakeshore — Northgate', geometryHash: '', bounds: rect(-32,-30,288,32), roads: { nodes: [{id:'start',point:[6,-2]},{id:'end',point:[273,15]}], edges:[{id:'track',start:'start',end:'end',points:[[6,-2],[6,15],[273,15]],laneWidth:2.2}] }, placements:[], anchors:{}, buildings:[], colliders:[], walkable:{cellSize:.5,excluded:[]}, lawns:[], lightGroups:[{id:'metro-main',offAt:5},{id:'metro-emergency',offAt:5},{id:'shelter-camp',offAt:5},{id:'self',offAt:5}], acousticZones:[{id:'shelter',preset:'interior',polygon:rect(-30,-28,30,18.8)},{id:'tunnel',preset:'tunnel',polygon:rect(30,11.2,246,18.8)}], surfaces:[{surface:'tile',height:.6,polygon:rect(-30,-28,30,12)},{surface:'gravel',height:.6,polygon:rect(-30,12,30,18.8)},{surface:'gravel',height:.6,polygon:rect(30,11.2,246,18.8)},{surface:'asphalt',height:3.9,polygon:rect(258,0,288,30)}], layers:[] };
/**
 * PO 10-20 #63 "a place where I cannot continue, although there is no wall": many of the metro kits' exported helper
 * boxes carry their Y and Z extents swapped about the box centre (the same exporter fault the escalator treads below
 * work around). In the tunnel, each 1.7 m side walkway became a 1.7 m tall, 0.32 m thin invisible wall in the middle of
 * the drawn walkway, and the south wall piers became head-height shelves reaching 1.4 m into the tunnel; the station's
 * back walls became shelves 2.5 m in front of the drawn wall. Each listed box matches the drawn mesh on every face only
 * once swapped (measured against the LOD0 triangles). Station 37/38 match the mesh in neither orientation (a chest-high
 * slab with no drawn geometry): dropped. Guard: tests/unit/levels/l6-collider-visibility.test.ts.
 */
const swappedBoxes: Record<string, Set<number>> = {
  'kit.metro-tunnel': new Set([1, 7, 8, 9, 10, 11, 12]),
  'kit.maintenance-corridor': new Set([0, 1, 4, 5, 6, 7, 8, 9, 10, 11]),
  'int.metro-station': new Set([]),
};
const undrawnBoxes: Record<string, Set<number>> = { 'int.metro-station': new Set([37, 38]) };
const swapYZ = (b: { min: number[]; max: number[] }) => {
  const cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2, hy = (b.max[2] - b.min[2]) / 2, hz = (b.max[1] - b.min[1]) / 2;
  return { min: [b.min[0], cy - hy, cz - hz], max: [b.max[0], cy + hy, cz + hz] };
};
const place = (assetId: string, x: number, z: number, y=0, yaw=0, lightGroup='metro-main', sx=1): Placement => {
  const d = worldAssets[assetId]; if (!d) throw new Error(`Unregistered ${assetId}`);
  const hx = (Math.abs(Math.cos(yaw))*(d.dimensions.x*sx)+Math.abs(Math.sin(yaw))*d.dimensions.z)/2, hz=(Math.abs(Math.sin(yaw))*(d.dimensions.x*sx)+Math.abs(Math.cos(yaw))*d.dimensions.z)/2;
  const p: Placement={id:`l6-${layout.placements.length}`,assetId,position:[x,y,z],yaw,scale:[sx,1,1],minTier:0,maxTier:5,allowRoad:false,lightGroup,visualAabb:{min:[x-hx,y,z-hz],max:[x+hx,y+d.dimensions.y,z+hz]}}; layout.placements.push(p);
  // Delivered low floors and stairs are supports; overhead ribs never obstruct planar navigation.
  // Hinged station/exit leaves are owned by the level, separate from fixed structure.
  for (const [i, raw] of ((physicsAssets as Record<string, { boxes: { min: number[]; max: number[] }[] }>)[assetId]?.boxes ?? []).entries()) {
    if (undrawnBoxes[assetId]?.has(i)) continue;
    const box = swappedBoxes[assetId]?.has(i) ? swapYZ(raw) : raw;
    if (box.min[1] >= 2.4 || assetId==='int.metro-exit') continue;
    if (assetId==='int.metro-station' && raw.min[2]<-9 && raw.max[2]>-9 && (Math.abs((raw.min[0]+raw.max[0])/2-10)<1.5 || Math.abs((raw.min[0]+raw.max[0])/2+10)<1.5)) continue;
    if (assetId==='int.metro-exit' && box.max[1]>3.5 && box.max[0]<-3.8) continue;
    const min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
    for(const bx of [box.min[0]*sx,box.max[0]*sx]) for(const bz of [box.min[2],box.max[2]]) for(const by of [box.min[1],box.max[1]]) {const q=[x+bx*Math.cos(yaw)+bz*Math.sin(yaw),y+by,z-bx*Math.sin(yaw)+bz*Math.cos(yaw)]; for(let a=0;a<3;a++){min[a]=Math.min(min[a],q[a]);max[a]=Math.max(max[a],q[a]);}}
    const walkable=box.max[1]<=.65 || (assetId==='int.metro-exit' && (box.max[1]-box.min[1]<.35 || (box.max[0]-box.min[0]<.3 && box.min[1]<3.5)));
    layout.colliders.push({id:`${p.id}/fixed-${i}`,aabb:{min,max},walkable,minTier:0,maxTier:5});
    // The shipped L6 balance (escort, entries, infection spread) was tuned with crowds and survivors held in the
    // central lane by the old walkway boxes. Keep those lane edges for navigation only: the courier walks the drawn walkways.
    if (assetId==='kit.metro-tunnel' && (i===7 || i===8)) { const lane=raw; const lmin:[number,number,number]=[x+lane.min[0],y+lane.min[1],z+lane.min[2]], lmax:[number,number,number]=[x+lane.max[0],y+lane.max[1],z+lane.max[2]]; layout.colliders.push({id:`${p.id}/lane-${i}`,aabb:{min:lmin,max:lmax,navOnly:true},walkable:false,minTier:0,maxTier:5}); }
  }
  return p;
};
place('int.metro-station',0,SZ);
for(let i=0;i<18;i++) place('kit.metro-tunnel',36+i*12,15,.35);
for(const x of [54,126,198]) place('kit.maintenance-corridor',x,6.2,.4,Math.PI/2);
for(const x of [78,174]) place('kit.maintenance-corridor',x,23.8,.4,-Math.PI/2);
// Centre the dead escalator on the tunnel route (z=15), rather than its unwalkable gap.
const exitZ = l6.exit.centerZ;
place('int.metro-exit',252,exitZ,.4,Math.PI);
layout.colliders.push({id:'northgate-platform',aabb:{min:[246,.4,exitZ-3.8],max:[249.4,.6,exitZ+3.8]},walkable:true,minTier:0,maxTier:5});
// Match the delivered recipe's 24 stone/escalator treads after its root half-turn.
// The exported helper boxes rotate their dimensions twice; use the actual tread tops.
for(const [z,width]of [[exitZ+1.4,1.5],[exitZ-.9,1.35]])for(let i=0;i<24;i++)layout.colliders.push({id:`northgate-tread-${z}-${i}`,aabb:{min:[249.4+i*.25,.4,z-width/2],max:[249.4+(i+1)*.25,.6+3.3*(i+1)/24,z+width/2]},walkable:true,minTier:0,maxTier:5});
layout.colliders.push({id:'northgate-landing',aabb:{min:[255.4,.4,exitZ-2.8],max:[258,3.9,exitZ+2.8]},walkable:true,minTier:0,maxTier:5});

for(const [x,z] of [[-8,-2+SZ],[0,-2+SZ],[-24,15+SZ],[-12,15+SZ],[0,15+SZ],[20,15+SZ]]) place('kit.shelter-camp',x,z,.6,0,'shelter-camp');
for(const [x,z] of [[269,3],[282,26],[283,6]]) place('prop.jersey-barrier',x,z,3.9);
place('prop.crates',279,24,3.9);
place('veh.wreck',279,22,3.9,.4);
place('bld.backdrop-houses',284,27,3.9,Math.PI);
place('decay.fuel-truck-crater',283,8,3.9);
place('util.radio',-4,2+SZ,.6,0,'shelter-camp');
for(let x=30;x<=246;x+=12) place('prop.emergency-light',x,12,3.2,Math.PI/2,'metro-emergency');
for(const x of [-12,0,12]) place('prop.emergency-light',x,8.8+SZ,3.2,Math.PI/2,'metro-emergency');
// Paired barriers narrow each service gate to 2.2 m. Alternating piers break long sight lines every 24 m.
// South barriers end at the drawn wall pier face (z 11.5, restored with the swapped boxes above): 2.65 m long
// (scale .8833) from 11.5 to 14.15, so the gate opening (14.15-15.85) is unchanged.
const south = (x: number) => place('prop.jersey-barrier',x,12.825,.6,Math.PI/2,'metro-main',2.65/3);
for(const x of l6.gates) { south(x); place('prop.jersey-barrier',x,17.35,.6,Math.PI/2); }
for(let x=42;x<246;x+=24) if(!l6.gates.some(g=>g===x)) { if(((x-42)/24)%2) place('prop.jersey-barrier',x,17.35,.6,Math.PI/2); else south(x); }
// Gate crates stand on the drawn side walkways (top y .87, z 11.5-13.2 and 16.8-18.5), clear of the walking lane.
for(const x of l6.gates) for(const z of [12.35,17.65]) place('prop.crates',x-3,z,.87,0,'self');
// Appended last so the ids of every other placement stay (placement-solids baseline keys on them).
// One continuous track: the tunnel's own track kit, placed like its modules (y .35, 12 m apart) along the station's whole length.
for(const x of [-24,-12,0,12,24]) place('kit.metro-track',x,15,.35);
const anchor=(name:string,x:number,z:number,y=.6)=>{layout.anchors[name]={position:[x,y,z],yaw:0};};
anchor('player-start',3,8+SZ);anchor('maintenance-a',-10,-10+SZ);anchor('maintenance-b',10,-10+SZ);anchor('tunnel-start',30,15);anchor('mid-tunnel',150,15);anchor('exit-platform',242,15);anchor('night-exit',273,15,3.9);
for(const [i,p] of l6Doors.entries())anchor(`service-${i}`,p.x,p.z);
for(const [n,p]of l6PhotoSpots)anchor(`photo-${n}`,p[0],p[1],n==='l6-exit-night'?3.9:.6);
// Complement of the actual rooms: no traversable void around the kit walls.
const rooms=[[-30,-20+SZ,30,18.8],[30,11.2,258,18.8],[258,0,288,30],...[54,126,198].map(x=>[x-2.3,1.2,x+2.3,11.2]),...[78,174].map(x=>[x-2.3,18.8,x+2.3,28.8])];
const edges=[...new Set([-32,288,...rooms.flatMap(r=>[r[0],r[2]])])].sort((a,b)=>a-b);
for(let i=1;i<edges.length;i++){const x0=edges[i-1],x1=edges[i],mid=(x0+x1)/2,spans=rooms.filter(r=>mid>=r[0]&&mid<r[2]).map(r=>[r[1],r[3]]).sort((a,b)=>a[0]-b[0]);let z=-30;for(const [lo,hi]of spans){if(lo>z)layout.walkable.excluded.push(rect(x0,z,x1,lo));z=Math.max(z,hi);}if(z<32)layout.walkable.excluded.push(rect(x0,z,x1,32));}
layout.colliders.push({id:'night-street-floor',aabb:{min:[258,3.75,0],max:[288,3.9,30]},walkable:true,minTier:0,maxTier:5});
// There are no drivable road lanes underground; the track is a pedestrian route.
layout.roads={nodes:[{id:'shelter',point:[3,8+SZ]}],edges:[]};
layout.geometryHash=createHash('sha256').update(JSON.stringify(layout)).digest('hex');
mkdirSync('public/assets/layouts',{recursive:true});writeFileSync('public/assets/layouts/D-SUBWAY.layout.json',JSON.stringify(layout,null,2)+'\n');
// Authored 30x30 night street slab. The tunnel/stations retain their shipped floors.
const doc=new Document(),buf=doc.createBuffer(),mat=doc.createMaterial('asphalt').setBaseColorFactor([.16,.20,.25,1]).setRoughnessFactor(.95);
const pos=doc.createAccessor().setType('VEC3').setArray(new Float32Array([258,3.9,0,258,3.9,30,288,3.9,30,288,3.9,0])).setBuffer(buf);
const normal=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0])).setBuffer(buf);
const idx=doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,0,2,3])).setBuffer(buf);
doc.createScene().addChild(doc.createNode('night-street-ground').setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',normal).setIndices(idx).setMaterial(mat))));
await new NodeIO().write('public/assets/layouts/D-SUBWAY.base.glb',doc);
