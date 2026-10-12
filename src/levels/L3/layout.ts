import { highwayPoint } from './highway';
import { l3Anchors, l3ArmyOffset, l3Street } from '../../data/l3';
import { FootprintIndex, findClearSpot, firstOverlap, footprints, obstaclesOf } from '../placementClearance';
import type { DistrictLayout, Placement } from '../districts/types';

/** Kinds of the W2 -> W3 "recently collapsed, still recognizable" dressing (E21 section 5.8); counted by the static AC15 test. */
export type L3DressingKind =
  // Oak Avenue (residential)
  | 'garden' | 'crashed' | 'barricade' | 'blood' | 'corpse'
  // Commerce Street (shopping)
  | 'broken-window' | 'looted' | 'merchandise' | 'bags' | 'damaged-sign'
  // Grove Boulevard (main road)
  | 'wrecked-bus' | 'police-vehicle' | 'jam' | 'fighting'
  // everywhere
  | 'abandoned' | 'fire' | 'smoke'
  // set pieces
  | 'station' | 'army';
export type L3Street = 'oak' | 'commerce' | 'blvd' | 'yard' | 'army';
/**
 * `entity`: not a static placement. `corpse` entries are dead pedestrians spawned by the L3 controller (the crowd model, no
 * extra batch); `fire` entries are E27 fire hazards (flame cards, light pool and a smoke column; they kill infected, the
 * PO rule's "fire kills"); `smoke` entries are smoke columns of fires deep inside a block (unreachable, visible from every
 * street). `lit`: police light bars (L3Props). `decay`: the asset's reviewed decay variant.
 */
export interface L3Dressing { kind: L3DressingKind; street: L3Street; assetId: string; x: number; z: number; yaw?: number; scale?: number; decay?: string; lit?: boolean; entity?: boolean; count?: number }
const H = Math.PI / 2, PI = Math.PI;
const N = -29.9, S = -26.1;   // Boulevard lanes
const d = (kind: L3DressingKind, street: L3Street, assetId: string, x: number, z: number, more: Partial<L3Dressing> = {}): L3Dressing => ({ kind, street, assetId, x, z, ...more });
const corpse = (street: L3Street, x: number, z: number, model: string, yaw: number) => d('corpse', street, model, x, z, { yaw, entity: true });
const fire = (street: L3Street, x: number, z: number, scale = 1) => d('fire', street, 'fx.fire', x, z, { scale, entity: true });

/** Static L3 dressing manifest (the broken glass at every Commerce shop frontage is derived from the layout, see below). */
export const l3Dressing: readonly L3Dressing[] = [
  // ---------------------------------------------------------------- Grove Boulevard: jam, wrecked buses, police, fighting
  ...([[-20, N, 'veh.sedan-blue', PI + .06], [-14, S, 'veh.suv-dark', .05], [-8, N, 'veh.pickup-white', PI - .08], [-2, S, 'veh.sedan-white', .1, 'wrecked'],
    [4, N, 'veh.sedan-green', PI + .1], [10, S, 'veh.pickup-red', -.06], [16, N, 'veh.suv-green', PI - .05], [22, S, 'veh.sedan-red', .08], [28, N, 'veh.sedan-blue', PI]] as const)
    .map(([x, z, assetId, yaw, decay]) => d('jam', 'blvd', assetId, x, z, { yaw, ...(decay ? { decay } : {}) })),
  d('wrecked-bus', 'blvd', 'veh.school-bus', -78, -27.6, { yaw: .3, decay: 'wrecked' }),
  d('wrecked-bus', 'blvd', 'veh.school-bus', 66, -28.2, { yaw: -.25, decay: 'wrecked' }),
  d('police-vehicle', 'blvd', 'veh.police-suv', -104, -25.9, { yaw: .1, lit: true }),
  d('police-vehicle', 'blvd', 'veh.police-sedan', -46, N, { yaw: PI - .2, lit: true }),
  d('police-vehicle', 'blvd', 'veh.police-sedan', 84, -26.2, { yaw: .15 }),
  d('police-vehicle', 'blvd', 'veh.police-sedan', 34, -29.6, { yaw: PI + .4, decay: 'wrecked' }),
  d('fighting', 'blvd', 'prop.sandbag-pallet', -100, -23.6), d('fighting', 'blvd', 'prop.sandbag-pallet', -98.4, -23.6, { yaw: .2 }),
  d('fighting', 'blvd', 'prop.barricade', -102.6, -24.0, { yaw: H }), d('fighting', 'blvd', 'prop.tear-gas-canister', -96.6, -25.2),
  d('fighting', 'blvd', 'wpn.police-baton', -97.4, -24.4, { yaw: .7 }), d('fighting', 'blvd', 'prop.sandbag-pallet', 31.0, -23.4, { yaw: -.3 }),
  d('fighting', 'blvd', 'prop.traffic-cone', -94.0, -26.0), d('fighting', 'blvd', 'prop.traffic-cone', 37.0, -25.4),
  corpse('blvd', -99.2, -26.6, 'npc.police-officer', 1.2), corpse('blvd', -74, -24.4, 'npc.civilian-man-a', 2.6), corpse('blvd', 8.6, -23.6, 'npc.civilian-woman-b', .4), corpse('blvd', 70, -31.8, 'npc.civilian-man-b', 4.1),
  d('blood', 'blvd', 'decal.blood-pool', -99.6, -25.8), d('blood', 'blvd', 'decal.blood-trail', 9.4, -24.0, { yaw: 1.1 }),
  fire('blvd', -2, S, 1.1), fire('blvd', 34, -29.6, 1.1), fire('blvd', 66, -28.2, 1.3),
  // ---------------------------------------------------------------- Commerce Street: looted shops, merchandise, bags, signs
  ...([[-104, -3.4, 0], [-28, 3.4, PI], [22, -3.4, 0], [64, 3.4, PI], [102, -3.4, 0]] as const).map(([x, z, yaw]) => d('looted', 'commerce', 'decay.looted-store', x, z, { yaw })),
  ...([[-101.6, -1.8, 'prop.shopping-cart'], [-25.8, 2.2, 'prop.shopping-cart'], [60.2, 1.6, 'prop.shopping-cart'], [24.4, -3.3, 'prop.crates'], [-64.8, 3.3, 'prop.crates'], [100.4, 2.2, 'prop.vending-cart']] as const)
    .map(([x, z, assetId], i) => d('merchandise', 'commerce', assetId, x, z, { yaw: i * 1.3 })),
  ...([[-60, 1.0], [-8, -1.2], [48, .8], [90, -1.4]] as const).map(([x, z], i) => d('bags', 'commerce', 'decay.dropped-belongings', x, z, { yaw: i * 1.9 })),
  ...([[-80, -3.7, 0], [5, 3.7, PI], [75, -3.7, 0]] as const).map(([x, z, yaw]) => d('damaged-sign', 'commerce', 'decay.damaged-sign', x, z, { yaw: yaw + .3 })),
  d('abandoned', 'commerce', 'veh.sedan-blue', -64, 1.3, { yaw: .1 }), d('abandoned', 'commerce', 'veh.sedan-white', 110, -1.3, { yaw: PI, decay: 'wrecked' }),
  corpse('commerce', -44, 1.8, 'npc.civilian-woman-a', .8), corpse('commerce', -10, 3.6, 'npc.civilian-elderly', 2.2), corpse('commerce', 34, -1.6, 'npc.civilian-man-a', 5.0), corpse('commerce', 88, 2.4, 'npc.civilian-woman-b', 3.3),
  d('blood', 'commerce', 'decal.blood-trail', -43, 2.6, { yaw: .4 }),
  fire('commerce', 110, -1.3, 1.1), fire('commerce', 70.4, -3.7, .9),
  // ---------------------------------------------------------------- Oak Avenue: crashed cars, barricades, trampled gardens
  d('crashed', 'oak', 'veh.sedan-red', -72, 26.8, { yaw: .6, decay: 'wrecked' }),
  d('crashed', 'oak', 'veh.suv-dark', 14, 29.4, { yaw: -.5, decay: 'wrecked' }),
  d('crashed', 'oak', 'veh.pickup-red', 98, 27.2, { yaw: 2.6, decay: 'wrecked' }),
  d('abandoned', 'oak', 'veh.sedan-green', -36, 29.6, { yaw: PI }), d('abandoned', 'oak', 'veh.suv-green', 58, 26.2, { yaw: .1 }),
  d('barricade', 'oak', 'decay.makeshift-barricade', -24, 26.6, { yaw: H }),
  d('barricade', 'oak', 'decay.furniture-barricade', 72, 29.6),
  d('barricade', 'oak', 'decay.makeshift-barricade', 112, 29.4, { yaw: -H }),
  ...([[-80, 32.0, 'prop.broken-chair'], [-8, 24.0, 'prop.trash-bags'], [62, 32.0, 'decay.dropped-belongings'], [100.6, 24.0, 'prop.wheelbarrow'], [-58, 24.0, 'prop.lawn-chair-a'], [24, 32.0, 'prop.trash-bin']] as const)
    .map(([x, z, assetId], i) => d('garden', 'oak', assetId, x, z, { yaw: i * 1.7 })),
  corpse('oak', -66, 24.6, 'npc.civilian-man-b', 1.9), corpse('oak', -20, 31.6, 'npc.civilian-woman-a', .3), corpse('oak', 18.4, 31.4, 'npc.civilian-elderly', 4.4),
  corpse('oak', 60, 24.2, 'npc.civilian-man-a', 2.8), corpse('oak', 102, 31.6, 'npc.civilian-woman-b', 5.6),
  ...([[-67.6, 26.2, 'decal.blood-trail'], [22.4, 31.0, 'decal.blood-pool'], [100, 24.4, 'decal.blood-trail']] as const).map(([x, z, assetId], i) => d('blood', 'oak', assetId, x, z, { yaw: i * 1.4 })),
  fire('oak', 14, 29.4, 1.1), fire('oak', -72, 26.8, .9),
  // Fires deep inside the blocks (unreachable service strips): their smoke columns stand over every street.
  d('smoke', 'commerce', 'fx.fire', -18, -13.5, { scale: 1.6, entity: true }), d('smoke', 'oak', 'fx.fire', -44, 13.4, { scale: 1.6, entity: true }), d('smoke', 'oak', 'fx.fire', 30, 13.4, { scale: 1.6, entity: true }), d('smoke', 'blvd', 'fx.fire', 88, -13.5, { scale: 1.6, entity: true }),
  d('abandoned', 'commerce', 'veh.sedan-white', 130, 2.2, {decay:'wrecked'}),
  d('abandoned', 'commerce', 'veh.pickup-red', 209, 1.1, {decay:'wrecked'}),
  // ---------------------------------------------------------------- the station yard and the bridgehead (W1, organized)
  d('station', 'yard', 'prop.armory-table', -140.6, -8.4, { yaw: H }),
  d('station', 'yard', 'veh.police-sedan', -148, 10.4, { yaw: .1, lit: true }), d('station', 'yard', 'veh.police-suv', -140.6, 12.6, { yaw: -.2, lit: true }),
  d('station', 'yard', 'veh.police-sedan', -134.2, 9.2, { yaw: H, lit: true }), d('station', 'yard', 'veh.police-suv', -156.4, -8.0, { yaw: H, lit: true }),
  ...([[-128.6, -19.9, 0], [-127.2, -6.4, H], [-127.2, 6.4, H], [-128.6, 19.9, 0], [-157.6, -17.4, 0], [-144.0, 17.4, 0]] as const).map(([x, z, yaw]) => d('station', 'yard', 'prop.sandbag-pallet', x, z, { yaw })),
  d('station', 'yard', 'prop.light-tower', -133.6, -14.6, { yaw: .4 }), d('station', 'yard', 'prop.jersey-barrier', -136.2, 15.8, { yaw: H }),
  ...([[-158.8, -1.6], [-158.8, 1.6], [-157.0, 3.4]] as const).map(([x, z]) => d('station', 'yard', 'prop.traffic-cone', x, z)),
  // ---------------------------------------------------------------- the army checkpoint (heavier than the L2 police line)
  d('army', 'army', 'veh.evac-bus', 158, -12.4), d('army', 'army', 'veh.evac-bus', 158, 11.6),
  d('army', 'army', 'veh.military-truck', 151, -24.0, { yaw: H }), d('army', 'army', 'veh.military-apc', 150.4, 17.6, { yaw: PI + .2 }),
  d('army', 'army', 'prop.light-tower', 145.6, -18.6), d('army', 'army', 'prop.light-tower', 145.6, 16.4, { yaw: PI }),
  ...([[141.2, -9.6], [141.2, 9.6], [141.2, -15.0], [141.2, 15.0], [146.0, -6.4], [146.0, 6.4]] as const).map(([x, z]) => d('army', 'army', 'prop.sandbag-pallet', x, z, { yaw: H })),
  ...([[154.0, -4.6], [154.0, 4.6], [162.0, -1.0]] as const).map(([x, z]) => d('army', 'army', 'prop.jersey-barrier', x, z, { yaw: 0 })),
].map(entry => entry.street === 'army' ? { ...entry, x: entry.x + l3ArmyOffset } : entry);

/** Two staggered crash lines force Oak -> Boulevard; their ends overlap the solid lot frontages. */
export const l3Roadblocks = [
  {x:-72,z:0,halfWidth:5}, {x:-72,z:-28,halfWidth:6},
  {x:12,z:0,halfWidth:5}, {x:12,z:28,halfWidth:5},
] as const;

/** Commerce Street shop fronts: broken glass at every frontage (E21 section 5.8), one per shop door. */
export function commerceFrontages(layout: DistrictLayout): { x: number; z: number; facing: 1 | -1 }[] {
  return layout.placements.filter(p => /^bld\.(mainstreet-brick|joes-diner|maple-hardware|pharmacy|supermarket|cafe-corner)$/.test(p.assetId) && l3Street(p.position[2]) === 'commerce')
    .map(p => ({ x: p.position[0], z: p.position[2] < 0 ? -3.6 : 3.6, facing: p.position[2] < 0 ? 1 : -1 }));
}

/**
 * L3 copy of the D-CORRIDOR layout: authored L3 anchors, the W2/W3 dressing manifest and the broken glass at every Commerce
 * shop frontage. Feeds collision, navigation and rendering alike (the same pattern as L2's layout copy).
 */
export function levelThreeLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return structuredClone(layouts).map(layout => {
    if (layout.district !== 'D-CORRIDOR') return layout;
    for (const p of layout.placements) if (p.assetId === 'kit.highway-onramp') p.lightGroup = 'l3-highway';
    const ramps = layout.placements.filter(p => p.assetId === 'kit.highway-onramp');
    if (ramps.length === 2) {
      const points: [number,number][] = [[133,0]];
      for(const p of ramps) {
        for(let i=0;i<=24;i++) {const v=highwayPoint(p,p.yaw>1?1-i/24:i/24);points.push([v[0],v[2]]);}
      }
      points.push([216,0]);
      const entry = layout.roads.nodes.find(n => n.point[0] === 133 && n.point[1] === 0)!;
      layout.roads.nodes.push({id:'l3-highway-exit',point:points.at(-1)!});
      layout.roads.edges.push({id:'l3-highway',start:entry.id,end:'l3-highway-exit',points,laneWidth:4.62});
    }
    for (const c of layout.colliders) {
      if (c.id.startsWith('dressing:highway-lip') || c.id.startsWith('dressing:highway-deck')) c.walkable = true;
      if (c.id.startsWith('dressing:highway-jersey')) c.aabb.navBlocker = true;
    }
    // The central elevated span and entry lips support every walker just like the ramp strips.
    layout.colliders.push({id:'l3-highway-deck',aabb:{min:[167.5,5.2,-2.31],max:[179.5,5.7,2.31]},walkable:true,minTier:0,maxTier:5});
    for (let i=0;i<14;i++) for (const x of [139.3+i*.3,207.7-i*.3]) layout.colliders.push({id:`l3-highway-lip-${x}`,aabb:{min:[x-.155,0,-2.31],max:[x+.155,(i+1)*.05,2.31]},walkable:true,minTier:0,maxTier:5});
    // PO 10-12: the ramp jersey rails stop at x 167.5 / 179.5 while the central span has none on the far side of each junction, leaving a
    // 1.3 m slot where actors stepped off the deck onto the lower road. Close each with a solid, nav-blocking rail at deck height.
    for (const [x0, x1, z0, z1] of [[163, 167.6, 1.6, 2.9], [179.4, 184, -2.9, -1.6]]) layout.colliders.push({id:`l3-highway-seal-${x0}`,aabb:{min:[x0,5.0,z0],max:[x1,6.7,z1],navBlocker:true},minTier:0,maxTier:5});
    for (const [name, [x, z]] of Object.entries(l3Anchors)) layout.anchors[name] = { position: [x, 0, z], yaw: 0 };
    // Placement rule shared with L2: dressing never cuts into a fence, wall, lamp, tree or another prop and stays out of
    // gardens; a piece that would moves to the nearest clear spot (cars slide along their own axis first, bumper to obstacle).
    // A fence run never ends inside a building: base panels that cut into one are dropped (the fence simply stops at the wall).
    const walls = layout.placements.filter(p => p.assetId.startsWith('bld.') || p.assetId.startsWith('kit.')).flatMap(p => footprints(p));
    const through = new Set(layout.placements.filter(p => /fence/.test(p.assetId) && firstOverlap(p, walls, .2) !== undefined).map(p => p.id));
    layout.placements = layout.placements.filter(p => !through.has(p.id));
    layout.colliders = layout.colliders.filter(c => !through.has(c.id.split('/')[0]));
    for (const p of layout.placements) {
      if (p.assetId.startsWith('kit.')) p.allowRoad = true;
      if (p.assetId === 'kit.army-checkpoint') p.boomOpen = true;
      if (p.assetId === 'prop.street-lamp' && l3Roadblocks.some(b=>Math.abs(p.position[0]-b.x)<4 && Math.abs(p.position[2]-b.z)<b.halfWidth+1)) {
        p.position[0]+=7;p.visualAabb.min[0]+=7;p.visualAabb.max[0]+=7;
      }
      // Mount the span's lamp on the elevated deck, so its night pool lights the walking surface.
      if(p.assetId === 'prop.street-lamp' && p.position[0]===174) {
        p.navBlocker=true;p.allowRoad=true;
        const dy=5.7-p.position[1], dz=-2.1-p.position[2];p.position[1]+=dy;p.position[2]+=dz;
        p.visualAabb.min[1]+=dy;p.visualAabb.max[1]+=dy;p.visualAabb.min[2]+=dz;p.visualAabb.max[2]+=dz;
      }
      if(p.assetId === 'prop.street-lamp' && p.position[0]===136) {p.position[2]-=4;p.visualAabb.min[2]-=4;p.visualAabb.max[2]-=4;}
    }
    const obstacles = obstaclesOf(layout, 2);
    const index = new FootprintIndex(obstacles);
    const add = (id: string, assetId: string, x: number, z: number, yaw = 0, scale = 1, decay?: string) => {
      const decal = assetId.startsWith('decal.');
      const p: Placement = { id, assetId, position: [x, decal ? .06 : 0, z], yaw, scale: decal ? [1.4, 1, 2.6] : [scale, scale, scale], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l3', visualAabb: { min: [x - 1, 0, z - 1], max: [x + 1, 1.5, z + 1] } };
      if (decay) p.decay = decay;
      if (!decal && footprints(p, 0, true).length) {
        const spot = findClearSpot(layout, p, obstacles, { index, slide: assetId.startsWith('veh.'), margin: assetId.startsWith('veh.') ? .1 : .3, maxRadius: 8 });
        if (!spot) throw new Error(`No clear spot for ${id} (${assetId}) near ${x}, ${z}`);
        const [dx, dz] = [spot[0] - x, spot[1] - z];
        p.position = [spot[0], 0, spot[1]]; p.visualAabb = { min: [x + dx - 1, 0, z + dz - 1], max: [x + dx + 1, 1.5, z + dz + 1] };
        { const added = footprints(p, 0, true); obstacles.push(...added); index.add(added); }
      }
      layout.placements.push(p);
    };
    for (const [i, entry] of l3Dressing.entries()) if (!entry.entity) add(`l3-${entry.kind}-${i}`, entry.assetId, entry.x, entry.z, entry.yaw ?? 0, entry.scale ?? 1, entry.decay);
    for (const [i, f] of commerceFrontages(layout).entries()) add(`l3-broken-window-${i}`, 'decay.broken-glass', f.x, f.z, f.facing > 0 ? 0 : Math.PI);
    // Authored decks stay at exact posts; automatic dressing clearance must not move the support away from its guards.
    for (const [i, z] of [-18, -7.6, 7.6, 18].entries()) {
      layout.placements.push({ id: `l3-watchtower-${i}`, assetId: 'kit.guard-tower', position: [138.5 + l3ArmyOffset, 0, z], yaw: 0,
        scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: false, lightGroup: 'l3',
        visualAabb: { min: [137.1 + l3ArmyOffset, 0, z - 1.4], max: [140.18 + l3ArmyOffset, 4.9, z + 1.4] } });
    }
    // Deliberate pile-ups bypass the ordinary clearance relocation: bumper overlaps seal both pavements.
    for (const [i, block] of l3Roadblocks.entries()) {
      for (const [j, z] of [-(block.halfWidth-2), 0, block.halfWidth-2].entries()) {
        const x = block.x + (j === 1 ? 1 : 0);
        const wreck: Placement = {id:`l3-roadblock-${i}-${j}`,assetId:j===1?'veh.school-bus':'veh.sedan-blue',position:[x,0,block.z+z],yaw:Math.PI/2+(j-1)*.08,scale:j===1?[1,1,1]:[.65,.65,.65],decay:j===1?'burned':'wrecked',minTier:0,maxTier:5,allowRoad:true,lightGroup:'l3',visualAabb:{min:[x-1.7,0,block.z+z-4],max:[x+1.7,3.4,block.z+z+4]}};
        if(j!==1) for(let k=0;k<15 && firstOverlap(wreck,walls,0)!==undefined;k++) wreck.position[2]+=(j===0?.1:-.1);
        layout.placements.push(wreck);
      }
      // The compacted bodywork closes seams between the three overlapping wreck silhouettes.
      layout.colliders.push({id:`l3-roadblock-${i}`,aabb:{min:[block.x-1.55,0,block.z-block.halfWidth],max:[block.x+2.55,2.2,block.z+block.halfWidth]},minTier:0,maxTier:5});
    }
    // Join each low ramp end to the city/base gate with visible jersey barriers, sealing ground-level bypasses.
    for (const p of layout.placements.filter(p => p.assetId === 'kit.highway-onramp')) {
      for (const side of [-1, 1]) {
        const end = highwayPoint(p, 1, side * 2.6), entry = p.yaw > 1 ? [132.7, side * 4.5] : [212, -side * 4];
        const dx=end[0]-entry[0], dz=end[2]-entry[1], length=Math.hypot(dx,dz), n=Math.ceil(length/2.8);
        for (let i=0;i<n;i++) {
          const x=entry[0]+dx*(i+.5)/n, z=entry[1]+dz*(i+.5)/n;
          layout.placements.push({id:`l3-highway-edge-${p.id}-${side}-${i}`,assetId:'prop.jersey-barrier',position:[x,0,z],yaw:-Math.atan2(dz,dx),scale:[length/n/3,1,1],minTier:0,maxTier:5,allowRoad:true,lightGroup:'l3',visualAabb:{min:[x-2,0,z-2],max:[x+2,1,z+2]}});
        }
      }
    }
    for (const z of [-45.6,45.6]) {
      const n=Math.ceil((212-132.6)/2.6), step=(212-132.6)/n;
      for(let i=0;i<n;i++) {
        const x=132.6+(i+.5)*step;
        layout.placements.push({id:`l3-outskirts-fence-${z}-${i}`,assetId:'prop.privacy-fence',position:[x,0,z],yaw:Math.PI/2,scale:[1,1,step/2.6],minTier:0,maxTier:5,allowRoad:true,lightGroup:'l3',visualAabb:{min:[x-step/2-.05,0,z-.135],max:[x+step/2+.05,1.8,z+.135]}});
      }
    }
    layout.placements.push({id:'l3-highway-train',assetId:'veh.train-freight',position:[175,0,17],yaw:0,scale:[1,1,1],minTier:0,maxTier:5,allowRoad:true,lightGroup:'l3',visualAabb:{min:[162.6,0,15],max:[187.4,4.9,19]}});
    layout.placements.push({id:'l3-highway-car',navBlocker:true,assetId:'veh.sedan-blue',position:[173,5.7,1.1],yaw:0,scale:[1,1,1],decay:'wrecked',minTier:0,maxTier:5,allowRoad:true,lightGroup:'l3',visualAabb:{min:[170.7,5.7,0],max:[175.3,7.4,2.2]}});
    layout.lightGroups.push({ id: 'l3-highway', offAt: 5 }, { id: 'l3', offAt: 5 });
    return layout;
  });
}
