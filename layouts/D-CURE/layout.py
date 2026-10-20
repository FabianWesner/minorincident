"""L10-D1/D2/D3/D4: R1–R7 on the shared 100 m streamer. R2's blocked street has an open northern detour."""
import json
import math
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from sslib.layout import Layout, material

l = Layout('D-CURE', 'The Cure — crash through research and destroyed corridor', size=(3700,600))
l.yaw_matches_collision = True
source = json.loads((l.root / 'layouts/D-CURE/routes.json').read_text())
for obj in l.layers[0]: bpy.data.objects.remove(obj, do_unlink=True)
l.layers[0] = []
l.data['bounds'] = source['bounds']
l.data['roads'] = dict(nodes=[],edges=[])
l.data['surfaces'] = []
l.data['lightGroups'] = [dict(id=f'block-{i}',offAt=6) for i in range(4)]
l.data['lawns'] = []
l.data['acousticZones'] = [dict(id='outdoor',preset='suburb-open',polygon=source['bounds'])]
def clip(poly, axis, value, greater):
    out = []
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ai = a[axis] >= value if greater else a[axis] <= value
        bi = b[axis] >= value if greater else b[axis] <= value
        if ai: out.append(a)
        if ai != bi:
            t = (value-a[axis])/(b[axis]-a[axis])
            out.append([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])])
    return out

chunks = []
for z in range(-1,5):
    for x in range(37):
        chunks.append(dict(id=f'cure-{x}-{z}', origin=[500+x*100,-200+z*100], size=100))
l.data['terrainChunks'] = chunks

patches=[]
def surface(name, poly, token, height=0, cut=True):
    # cut=False (look-l9b): a thin overlay that sits above its owner instead of cutting it (cracks, skids): cutting the road
    # quads with hundreds of strips fragmented the asphalt past the 10k streamed-horizon budget.
    # Arrow silhouettes are concave; partition them into convex triangles.
    if any((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]) < -1e-8 for a,b,c in zip(poly,poly[1:]+poly[:1],poly[2:]+poly[:2])):
        for tri in tessellate_polygon([[Vector((x,z,0)) for x,z in poly]]):
            patches.append((name,[poly[v] if isinstance(v,int) else [v.x,v.y] for v in tri],token,height,cut))
    else: patches.append((name,poly,token,height,cut))

def halfplane(poly,a,b,inside):
    out=[]
    cross=lambda p:(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
    for p,q in zip(poly,poly[1:]+poly[:1]):
        cp,cq=cross(p),cross(q)
        pi=cp>=-1e-9 if inside else cp<=1e-9
        qi=cq>=-1e-9 if inside else cq<=1e-9
        if pi: out.append(p)
        if pi != qi:
            t=cp/(cp-cq);out.append([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])])
    return out

def area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))

def subtract(poly,cutter):
    if max(p[0] for p in poly)<=min(p[0] for p in cutter) or min(p[0] for p in poly)>=max(p[0] for p in cutter) or max(p[1] for p in poly)<=min(p[1] for p in cutter) or min(p[1] for p in poly)>=max(p[1] for p in cutter): return [poly]
    # Convex difference: emit disjoint outside pieces, carry only the inside to the next edge.
    outside=[]; remaining=poly
    for a,b in zip(cutter,cutter[1:]+cutter[:1]):
        if len(remaining)<3 or area(remaining)<1e-7: break
        piece=halfplane(remaining,a,b,False)
        if len(piece)>=3 and area(piece)>1e-7: outside.append(piece)
        remaining=halfplane(remaining,a,b,True)
    return outside

def emit_surfaces():
    for index,(name,poly,token,height,_) in enumerate(patches):
        pieces=[poly]
        # Flat surface ownership, rather than stacked coplanar slabs. This avoids depth flicker
        # even at the 200 m review camera; paint and intersecting fork lanes have one owner.
        for _,cutter,_,_,cuts in patches[index+1:]:
            if not cuts: continue
            pieces=[piece for p in pieces for piece in subtract(p,cutter)]
        for c in chunks:
            ox,oz=c['origin']
            for poly in pieces:
                p=poly
                for axis,value,greater in [(0,ox,True),(0,ox+100,False),(1,oz,True),(1,oz+100,False)]:
                    if not p: break
                    p=clip(p,axis,value,greater)
                if len(p)<3: continue
                polygon_area=sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(p,p[1:]+p[:1]))
                if abs(polygon_area)<.0001: continue
                # Explicit convex fans keep Blender's n-gon triangulator out of tiny clipped paint slivers.
                clean=[]
                for point in p:
                    if not clean or math.dist(point,clean[-1])>1e-7: clean.append(point)
                if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-7: clean.pop()
                # A 1 mm edge apron closes float32 reconstruction cracks between material
                # primitives. It affects only shared edges, never stacks whole terrain slabs.
                expanded=[]
                for i,point in enumerate(clean):
                    prev=clean[i-1]; nxt=clean[(i+1)%len(clean)]
                    ax,az=point[0]-prev[0],point[1]-prev[1]; bx,bz=nxt[0]-point[0],nxt[1]-point[1]
                    al,bl=math.hypot(ax,az),math.hypot(bx,bz)
                    n1=(az/al,-ax/al); n2=(bz/bl,-bx/bl)
                    nx,nz=n1[0]+n2[0],n1[1]+n2[1]
                    factor=.001/max(1e-6,nx*n1[0]+nz*n1[1])
                    factor=min(factor,.01/max(1e-6,math.hypot(nx,nz)))
                    expanded.append([point[0]+nx*factor,point[1]+nz*factor])
                clean=expanded
                faces=[(0,i+1,i) for i in range(1,len(clean)-1) if area([clean[0],clean[i],clean[i+1]])>1e-8]
                if not faces: continue
                mesh=bpy.data.meshes.new(name);mesh.from_pydata([(px-ox,-(pz-oz),height) for px,pz in clean],[],faces);mesh.update()
                obj=bpy.data.objects.new(c['id'],mesh);bpy.context.collection.objects.link(obj)
                obj.location=(ox,-oz,0);mesh.materials.append(material(token))
                obj['terrainChunk']=c['id'];obj['chunkOrigin']=c['origin'];l.layers[0].append(obj)


surface('soil',source['bounds'][:-1],'grass',-.006)
surface('crash-dry',[[500,-125],[740,-125],[740,125],[500,125]],'gloveKhaki',-.004)  # look-l10: dimmer than khaki so the moonlit scar keeps the route read
# look-l9b: the destroyed corridor (R6) is scorched ground, not a lawn: an ash sheet (pantsDark) under its burned fronts. The moonlit
# grass there read at .03 luminance (no building shadows from the collapsed w3 fronts) and broke the E31-AC16 verge gate.
surface('corridor-ash',[[2917,-140],[3697,-140],[3697,140],[2917,140]],'pantsDark',-.005)
l.data['surfaces'].append(dict(surface='grass',height=0,polygon=source['bounds']))
# Graph shares the exact boundary vertex; no duplicate slab or invisible region gate.
route = [p for i,r in enumerate(source['regions']) for p in (r['route'] if i == 0 else r['route'][1:])]
# Vehicle-width road ends at the apron; the remaining critical route is pedestrian nav.
route = route[:route.index([3978,-25])+1]
for i,p in enumerate(route): l.data['roads']['nodes'].append(dict(id=f'route-{i}',point=p))
for i,(a,b) in enumerate(zip(route,route[1:])):
    width=8; d=math.dist(a,b); nx=-(b[1]-a[1])/d*width/2; nz=(b[0]-a[0])/d*width/2
    poly=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]]
    l.data['roads']['edges'].append(dict(id=f'route-{i}',start=f'route-{i}',end=f'route-{i+1}',points=[a,b],laneWidth=width))
    surface('road',poly,'asphalt',.002)
    l.data['surfaces'].append(dict(surface='asphalt',height=.002,polygon=poly+[poly[0]]))
    for s in range(6,int(d)-3,14):
        cx=a[0]+(b[0]-a[0])*s/d; cz=a[1]+(b[1]-a[1])*s/d
        tx=(b[0]-a[0])/d*1.5; tz=(b[1]-a[1])/d*1.5
        surface('mark',[[cx-tx+nx*.025,cz-tz+nz*.025],[cx-tx-nx*.025,cz-tz-nz*.025],[cx+tx-nx*.025,cz+tz-nz*.025],[cx+tx+nx*.025,cz+tz+nz*.025]],'silver',.008)   # look-l9b recipe: worn grey paint, not self-lit white
# Both optional routes rejoin the same nav/road graph, with no invisible gates.
for detour in source['detours']:
    points=detour['route']; ids=[]
    for j,p in enumerate(points):
        existing=next((n['id'] for n in l.data['roads']['nodes'] if n['point']==p),None)
        node=existing or f"{detour['id']}-{j}"
        if not existing: l.data['roads']['nodes'].append(dict(id=node,point=p))
        ids.append(node)
    for j,(a,b) in enumerate(zip(points,points[1:])):
        width=6; d=math.dist(a,b); nx=-(b[1]-a[1])/d*width/2; nz=(b[0]-a[0])/d*width/2
        poly=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]]
        l.data['roads']['edges'].append(dict(id=f"{detour['id']}-{j}",start=ids[j],end=ids[j+1],points=[a,b],laneWidth=width))
        surface('service-road',poly,'asphalt',.002)
        l.data['surfaces'].append(dict(surface='asphalt',height=.002,polygon=poly+[poly[0]]))
# The old through street ends at a visible rubble barrier. The route goes north around it.
a,b=[807,25],[1057,25]
surface('blocked-road',[[807,21],[1057,21],[1057,29],[807,29]],'asphalt',.002)
for name,p in source['anchors'].items(): l.anchor(name,[p[0],0,p[1]])
l.anchor('player-start',[547,0,0]); l.anchor('exit',[4002,0,-27])
# Crash continuity: same safe position as L9 crawl-end, spent wreck behind the courier.
l.place('veh.military-apc',[540,0,-5],yaw=1.5); l.data['placements'][-1]['decay']='wrecked'
for x,z in [(557,30),(600,-35),(697,-35)]: l.place('prop.tree',[x,0,z])
for x,z in [(578,-20),(718,43)]: l.place('decay.makeshift-barricade',[x,0,z])
for x,z in [(767,16)] + [(x,89.5) for x in range(833,1014,20)] + [(1080,10),(1120,10),(1160,10),(1200,10),(847,10),(887,10),(997,10)]:
    asset='bld.cure-security-post' if x==767 else 'bld.cure-duplex'
    pid=l.place(asset,[x,0,z],yaw=math.pi/2 if z==89.5 else 0)
    p=l.data['placements'][-1]; l.data['buildings'].append(dict(id=pid,assetId=asset,aabb=p['visualAabb'],label='Security' if x==767 else 'Residential fringe'))
# Post forecourt: police pickup lies on the open route, before the denser neighbourhood.
l.place('veh.police-sedan',[779,0,33]);l.data['placements'][-1]['decay']='wrecked'
for x,z in [(758,19),(943,86)]: l.place('prop.street-lamp',[x,0,z])
for x,z in [(759,19),(773,19)]: l.place('prop.traffic-cone',[x,0,z])
for x in [843,883,923,963,1003]:
    l.place('prop.cure-garden-wall',[x,0,87])
    l.place('prop.hedge',[x,0,88])
# A line of rubble spans the blocked street and its verge; the northern lane at z=80 stays open.
for z in [i*1.5-10 for i in range(48)]: l.place('decay.makeshift-barricade',[937,0,z])
for x,z in [(930,25),(944,32)]: l.place('veh.wreck',[x,0,z])
# R3 survivor depot forecourt: the shotgun checkpoint precedes both yard alternatives.
l.place('bld.cure-service-building',[1257,0,10])
for x,z in [(1249,19),(1265,19)]: l.place('decay.makeshift-barricade',[x,0,z])
for x,z in [(1397,78),(1597,78),(1787,-20)]:
    pid=l.place('bld.cure-warehouse',[x,0,z])
    l.data['buildings'].append(dict(id=pid,assetId='bld.cure-warehouse',aabb=l.data['placements'][-1]['visualAabb'],label='Depot warehouse'))
for x in [1367,1457,1547,1637,1727]:
    l.place('prop.cure-container-stack',[x,0,45])
    l.place('prop.cure-drum-stack',[x,0,-65])
# Block the direct yard; northern loading yard and southern service lane stay open.
surface('yard-road',[[1297,21],[1747,21],[1747,29],[1297,29]],'asphalt',.002)
for z in range(-25,66,3): l.place('decay.makeshift-barricade',[1517,0,z])
# R4 destroyed entrance post, breached defensive line and low motor-pool shelters.
l.place('bld.cure-guard-post',[1857,0,10])
l.place('veh.military-truck',[1877,0,42]); l.data['placements'][-1]['decay']='wrecked'
for x,z in [(1997,-95),(2197,-95),(2327,130)]:
    pid=l.place('bld.cure-motor-shelter',[x,0,z])
    l.data['buildings'].append(dict(id=pid,assetId='bld.cure-motor-shelter',aabb=l.data['placements'][-1]['visualAabb'],label='Motor pool'))
# The shelter slab is 16 cm high; 1 mm clearance prevents quantized mesh contact.
for x in [1997,2197,2327]: l.place('veh.military-truck',[x,.161,130 if x==2327 else -95])
surface('checkpoint-road',[[1897,21],[2397,21],[2397,29],[1897,29]],'asphalt',.002)
for z in range(-45,87,3): l.place('prop.cure-mil-fence',[2137,0,z],yaw=math.pi/2)
for x,z in [(2137,-87),(2137,-63)]: l.place('prop.jersey-barrier',[x,0,z])
for x,z in [(1850,19),(1864,19),(2127,-68),(2147,-68)]: l.place('prop.traffic-cone',[x,0,z])
# R5: low laboratories and quarantine forecourt, all story anchors on a clear lane.
for asset,x,z in [('bld.cure-lab-main',2707,23),('bld.cure-lab-annex',2607,23),('bld.cure-lab-annex',2777,23)]:
    pid=l.place(asset,[x,0,z])
    l.data['buildings'].append(dict(id=pid,assetId=asset,aabb=l.data['placements'][-1]['visualAabb'],label='Research laboratory'))
for x,z in [(2547,65),(2657,65),(2847,20)]: l.place('prop.cure-iso-tent',[x,0,z])
for x,z in [(2557,65),(2697,65),(2857,20)]: l.place('prop.cure-generator',[x,0,z])
for x,z in [(2567,65),(2757,65)]: l.place('veh.ambulance',[x,0,z])
# Reuse the device console as the recorded-message terminal; pickup sockets face the route.
l.place('kit.dispersal-console',[2707,0,39.5],yaw=-math.pi/2)
l.place('prop.cure-canister-pedestal',[2713,0,39.5])
for x in range(2577,2798,6): l.place('prop.cure-quarantine-fence',[x,0,76])
for z in range(-35,36,6):
    if abs(z+5)>9: l.place('prop.cure-quarantine-fence',[2837,0,z],yaw=math.pi/2)
# R6: rocket supply before the rubble defensive line; the northern breach stays open.
l.place('veh.military-truck',[2937,0,10]);l.data['placements'][-1]['decay']='wrecked'
for x,z in [(2929,3),(2945,3)]: l.place('prop.cure-drum-stack',[x,0,z])
for x,z in [(3067,115),(3217,115),(3467,115),(3617,-45)]:
    l.place('veh.wreck',[x,0,z])
    l.place('decay.makeshift-barricade',[x+8,0,z])
surface('corridor-blocked-road',[[2977,-9],[3577,-9],[3577,-1],[2977,-1]],'asphalt',.002)
for i in range(110): l.place('decay.makeshift-barricade',[3317,0,-89+i*1.5])
for x,z in [(3317,83),(3317,107)]: l.place('prop.jersey-barrier',[x,0,z])
# R7 uses the TS finale anchors, serialized by tools/layouts/build.ts before Blender.
finale = json.loads((l.root / '.cache/layouts/D-CURE-finale.json').read_text())
ox,oz = source['anchors']['dispersal-origin']
surface('dispersal-apron',[[ox-48,oz-42],[ox+44,oz-42],[ox+44,oz+40],[ox-48,oz+40]],'asphalt',.002)
for prop in finale['props']:
    x,z = prop['at']
    l.place(prop['asset'],[ox+x,0,oz+z],yaw=math.radians(prop['yaw']))
# Named paths document the clear rocket dodge corridors; all use the same nav surface.
for lane in finale['lanes']:
    for i,(x,z) in enumerate(lane['points']): l.anchor(lane['id']+'-'+str(i),[ox+x,0,oz+z])
l.anchor('dispersal-gun',[ox-10,3,oz-6])
l.anchor('dispersal-stair-top',[ox-4,3.08,oz-6])
l.anchor('epilogue-camera',[ox+45,50,oz+45])
# Low refuge beyond the arena: a future survivor emergence point, clear of every dodge lane.
l.place('bld.cure-service-building',[ox+32,0,oz+47])

# ---- look-l10 set dressing (E32 art direction addendum) -------------------------------------------------------------
# Render/collision dressing beside the route only. Every solid stays clear of the walkable route, detours, Mega pursuit
# shortcuts, anchors, encounter/medkit spots and the R7 assault ring, so routes, nav, triggers and timing are unchanged.
import random, re
rng = random.Random(1019)
FLAT_PATCHES = False
full_route = [p for i,r in enumerate(source['regions']) for p in (r['route'] if i == 0 else r['route'][1:])]
route_segments = list(zip(full_route, full_route[1:]))
detour_segments = [s for d in source['detours'] for s in zip(d['route'], d['route'][1:])]
reg = source['regions']; anc = source['anchors']
shortcut_segments = [(reg[5]['route'][1], anc['corridor-breach']), (anc['corridor-breach'], anc['r6-r7-seam']), (anc['r6-r7-seam'], reg[6]['route'][5])]
encounter_text = (l.root / 'src/levels/L10/encounters.ts').read_text()
spots = [(float(x), float(z)) for x, z in re.findall(r"at: \[(-?[\d.]+), (-?[\d.]+)\]", encounter_text)]
spots += [tuple(p) for p in anc.values()]
console = anc['cure-console']
def seg_point(a, b, p):
    dx, dz = b[0]-a[0], b[1]-a[1]; d2 = dx*dx+dz*dz
    t = 0 if d2 == 0 else max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dz)/d2))
    return math.hypot(a[0]+t*dx-p[0], a[1]+t*dz-p[1])
def rect_point(mn, mx, p):
    return math.hypot(max(mn[0]-p[0], 0, p[0]-mx[0]), max(mn[1]-p[1], 0, p[1]-mx[1]))
def seg_rect(a, b, mn, mx):
    # Axis-aligned rectangle versus segment: zero when the segment crosses it, else the closest feature distance.
    steps = max(1, int(math.dist(a, b) / 1.0))
    if any(mn[0] <= a[0]+(b[0]-a[0])*k/steps <= mx[0] and mn[1] <= a[1]+(b[1]-a[1])*k/steps <= mx[1] for k in range(steps+1)): return 0
    corners = [(mn[0], mn[1]), (mx[0], mn[1]), (mx[0], mx[1]), (mn[0], mx[1])]
    return min([seg_point(a, b, c) for c in corners] + [rect_point(mn, mx, a), rect_point(mn, mx, b)])
taken = []   # 2D footprints already used (existing placements plus dressing)
for p in l.data['placements']:
    v = p['visualAabb']; taken.append(((v['min'][0], v['min'][2]), (v['max'][0], v['max'][2])))
def footprint(asset, x, z, yaw, scale):
    m = l.manifest['prop.tree' if asset == 'crown:tree' else asset]['dimensions']; dx, dz = m['x']*scale, m['z']*scale
    # Trees collide only at the trunk; the crown may overhang the verge like any street tree.
    if asset in ('prop.tree', 'prop.street-tree'): dx = dz = 1.2
    sx = abs(math.cos(yaw))*dx+abs(math.sin(yaw))*dz; sz = abs(math.sin(yaw))*dx+abs(math.cos(yaw))*dz
    return (x-sx/2, z-sz/2), (x+sx/2, z+sz/2)
def ccw(poly):
    # emit_surfaces' convex clipping expects the road polygons' winding (positive shoelace area in x/z).
    return poly if sum(p[0]*q[1]-q[0]*p[1] for p, q in zip(poly, poly[1:]+poly[:1])) > 0 else poly[::-1]
THIN = ('prop.street-lamp', 'prop.utility-pole', 'prop.emergency-light', 'prop.fire-hydrant', 'prop.mailbox-blue', 'prop.street-sign')
def dress(asset, x, z, yaw=0.0, scale=1.0, decay=None, route_clear=None, run=False):
    """Place one dressing piece if it keeps every gameplay clearance; returns the placement id or None."""
    mn, mx = footprint(asset, x, z, yaw, scale)
    if route_clear is not None: clear = route_clear
    elif asset in THIN: clear = 5.4
    elif asset.startswith(('bld.', 'kit.')): clear = 8.5
    elif asset.startswith('veh.'): clear = 7.0
    elif asset in ('prop.tree', 'prop.street-tree'): clear = 7.5
    else: clear = 6.0   # low verge props: fences, hedges, sandbags, barriers, drums
    b = source['bounds']
    if mn[0] < 500.2 or mx[0] > 4196 or mn[1] < -296 or mx[1] > 296: return None
    if any(seg_rect(a, c, mn, mx) < clear for a, c in route_segments): return None
    if any(seg_rect(a, c, mn, mx) < clear - .5 for a, c in detour_segments): return None
    if asset in ('prop.tree', 'prop.street-tree'):
        # The validator tests the crown's visual box against every road lane (half widths 4 m route, 3 m detour).
        cmn, cmx = footprint('crown:tree', x, z, yaw, scale)
        if any(seg_rect(a, c, cmn, cmx) < 4.4 for a, c in route_segments + detour_segments): return None
    if any(seg_rect(a, c, mn, mx) < 6 for a, c in shortcut_segments): return None
    if any(rect_point(mn, mx, s) < (9 if asset.startswith(('bld.', 'kit.', 'veh.')) else 6.5) for s in spots): return None
    if rect_point(mn, mx, console) < 60: return None
    # R7: the approach band (route z -41..-21 plus the walk to the console) stays open ground, so nobody cuts a corner into a box.
    if mx[0] > 3690 and mn[1] < 5 and mx[1] > -57 and asset != 'prop.emergency-light': return None
    gap = -.1 if run else 1.0   # run pieces butt against each other; manifest boxes can be a little smaller than the mesh
    # Crowns must not grow into roofs, fences or poles (Scene Lab static clipping), so trees reserve their whole crown.
    omn, omx = footprint('crown:tree', x, z, yaw, scale) if asset in ('prop.tree', 'prop.street-tree') else (mn, mx)
    if any(omn[0] < t[1][0]+gap and omx[0] > t[0][0]-gap and omn[1] < t[1][1]+gap and omx[1] > t[0][1]-gap for t in taken): return None
    pid = l.place(asset, [x, 0, z], yaw=yaw, scale=(scale, 1 if asset.startswith(('bld.', 'veh.')) else scale, scale) if scale != 1 else (1, 1, 1))
    if decay: l.data['placements'][-1]['decay'] = decay
    # Dressing collides as one box (trees: trunk only, fence runs: one box per run) instead of the asset's detailed
    # compound boxes: a garage alone bakes ~100 boxes, and every resident box is a nav wall and a cover wall in the sim.
    placement = l.data['placements'][-1]; placement['collisionId'] = 'look-l10-box'; placement['decorLights'] = True
    l.data['colliders'] = [c for c in l.data['colliders'] if c['id'] != pid]
    v = placement['visualAabb']
    if asset in ('prop.tree', 'prop.street-tree'): box = dict(min=[x-.3, 0, z-.3], max=[x+.3, 2.2, z+.3])
    else: box = dict(min=list(v['min']), max=list(v['max']))
    # look-l9b (PO: "soldiers and peds are just walking through the barrier"): R6/R7 dressing is solid for everyone; the
    # finale calibration (tests/sim/levels/l10-arrival.test.ts) is re-run after every dressing change instead.
    if not run and asset not in ('prop.emergency-light', 'prop.lab-signs'): l.data['colliders'].append(dict(id=pid, aabb=box, minTier=0, maxTier=6))
    taken.append((omn, omx)); return pid
def face(side_normal):
    # Asset front is +X; rotation.y = yaw maps +X to (cos, -sin). Face back towards the road.
    nx, nz = -side_normal[0], -side_normal[1]
    return math.atan2(-nz, nx)
def frontage(segments, palette, spacing, offset, sides=(1, -1), jitter=2.0, chance=1.0, align=True):
    """Walk both verges of axis-aligned route segments, placing palette pieces at a setback, facing the road."""
    names = [a for a, _ in palette]; weights = [w for _, w in palette]
    for a, b in segments:
        d = math.dist(a, b)
        if d < 4: continue
        ux, uz = (b[0]-a[0])/d, (b[1]-a[1])/d
        for side in sides:
            n = (-uz*side, ux*side)
            s = rng.uniform(0, spacing)
            while s < d:
                if rng.random() <= chance:
                    entry = rng.choices(names, weights)[0]
                    asset, decay = (entry.split('@') + [None])[:2]
                    off = rng.uniform(*offset) if isinstance(offset, tuple) else offset
                    x = a[0]+ux*s+n[0]*off; z = a[1]+uz*s+n[1]*off
                    yaw = face(n) if align else rng.uniform(0, math.tau)
                    if asset.startswith('veh.'): yaw = math.atan2(-uz, ux) + (math.pi if rng.random() < .5 else 0) + rng.uniform(-.25, .25)
                    if asset.startswith(('prop.tree', 'prop.street-tree')): yaw = rng.uniform(0, math.tau)
                    dress(asset, x, z, yaw, decay=decay)
                s += spacing + rng.uniform(-jitter, jitter)
def region_segments(i):
    r = source['regions'][i]['route']; return list(zip(r, r[1:]))
def fence_run(asset, a, b, step=2.6):
    d = math.dist(a, b); ux, uz = (b[0]-a[0])/d, (b[1]-a[1])/d
    m = l.manifest[asset]['dimensions']
    yaw = math.atan2(-uz, ux) + (math.pi/2 if m['z'] > m['x'] else 0)   # align the asset's long side with the run
    boxes = []
    for k in range(int(d // step)):
        if dress(asset, a[0]+ux*(k+.5)*step, a[1]+uz*(k+.5)*step, yaw, run=True):
            v = l.data['placements'][-1]['visualAabb']; boxes.append(v)
    # Consecutive pieces merge into one collider per unbroken stretch (gaps from skipped pieces stay open).
    group = []
    for v in boxes + [None]:
        if group and (v is None or v['min'][0] > group[-1]['max'][0] + .3 or v['min'][2] > group[-1]['max'][2] + .3):
            l.data['colliders'].append(dict(id=f'look-l10-run:{len(l.data["colliders"])}', aabb=dict(min=[min(g['min'][i] for g in group) for i in range(3)], max=[max(g['max'][i] for g in group) for i in range(3)], ), minTier=0, maxTier=6))
            group = []
        if v is not None: group.append(v)

# Roads do not end in the void: the L9 road continues west past the crash, a service road meets the console apron.
surface('road-west', [[500, -4], [547, -4], [547, 4], [500, 4]], 'asphalt', .002)
# Gravel/dirt shoulders break the flat verge; flat surfaces only, no collision.
# look-l9b: a continuous dark shoulder band (4..9.5 m from the centreline, as L9's leather shoulders) under the strips: the
# E31-AC16 verge samples (5.5/7/8.5 m) read a dark verge against the silver road instead of bright strips and lawn blades.
for i, (a, b) in enumerate(route_segments):
    d = math.dist(a, b)
    if d < 20 or a[0] > 3940: continue
    ux, uz = (b[0]-a[0])/d, (b[1]-a[1])/d
    for side in (1, -1):
        n = (-uz*side, ux*side)
        p0 = (a[0]+ux*2+n[0]*4, a[1]+uz*2+n[1]*4); p1 = (a[0]+ux*(d-2)+n[0]*4, a[1]+uz*(d-2)+n[1]*4)
        surface('shoulder-band', ccw([list(p0), list(p1), [p1[0]+n[0]*5.5, p1[1]+n[1]*5.5], [p0[0]+n[0]*5.5, p0[1]+n[1]*5.5]]), 'leather' if a[0] < 800 else 'leatherEdge', -.0015)
        s = 6
        while s < d - 8:
            ln = rng.uniform(6, 18); w = rng.uniform(1.2, 2.6)
            p0 = (a[0]+ux*s+n[0]*4, a[1]+uz*s+n[1]*4); p1 = (a[0]+ux*(s+ln)+n[0]*4, a[1]+uz*(s+ln)+n[1]*4)
            q1 = (p1[0]+n[0]*w, p1[1]+n[1]*w); q0 = (p0[0]+n[0]*w, p0[1]+n[1]*w)
            token = 'khakiSeam' if a[0] < 800 else 'oliveSeam'
            surface('shoulder', ccw([list(p0), list(p1), list(q1), list(q0)]), token, -.001)
            s += ln + rng.uniform(8, 26)

# R1 crash outskirts: dead farmland, a toppled pole line, convoy leftovers and one warm work light.
crash = region_segments(0)
# L9's collapsed bridge kit behind the crawl-end: the crash the courier just crawled out of (visual kit, boxed so nobody walks through it).
pid = dress('kit.crossing-crash', 518.5, 0, 0, route_clear=0)
if pid: l.data['colliders'].append(dict(id=pid, aabb=dict(min=[500.4, 0, -7.5], max=[536.6, 2.5, 7.5]), minTier=0, maxTier=6))
for x, z, asset, yaw, decay in [(528, -12, 'veh.military-truck', .5, 'wrecked'), (531, 13, 'veh.sedan-red', -.9, 'burned'), (556, -14, 'veh.wreck', 1.1, None), (566, 13, 'veh.pickup-red', 2.4, 'wrecked'), (590, -16, 'veh.school-bus', .2, 'wrecked'), (612, 15, 'veh.police-sedan', -.3, 'burned')]:
    dress(asset, x, z, yaw, decay=decay, route_clear=6.5)
for x, z, asset, yaw in [(585, 40, 'bld.shed', math.pi/2), (598, 46, 'bld.garage-detached', math.pi/2), (612, 42, 'prop.street-lamp', 0), (690, -28, 'kit.army-checkpoint', math.pi/2), (720, -26, 'prop.emergency-light', 0), (560, -32, 'veh.military-truck', .4), (676, 50, 'prop.tree', 0), (705, 56, 'prop.tree', 1)]:
    dress(asset, x, z, yaw, decay='wrecked' if asset == 'veh.military-truck' else None)
for x0 in (575, 640): fence_run('prop.picket-fence', (x0, 34), (x0 + 30, 34))
# Red road flares around the wrecks: the first light points the courier sees after the crawl (render-only, no collider).
for x, z in [(538, -11), (546, 9), (560, -9), (572, 8), (588, -7.5), (604, 7.5), (632, -6), (655, 12), (690, 32), (725, 17)]:
    dress('prop.emergency-light', x, z, rng.uniform(0, 6), route_clear=4.6)
frontage(crash, [('prop.utility-pole', 1)], 28, 6.5, sides=(-1,), jitter=1)
frontage(crash, [('prop.tree', 3), ('veh.sedan-white@burned', 1), ('veh.suv-dark@wrecked', 1), ('veh.pickup-red@burned', 1), ('prop.sandbag-pallet', 1), ('decay.blown-sandbags', 2), ('prop.jersey-barrier', 1)], 9, (6.5, 13))

# R2 residential fringe: front yards with lit windows, fences, street trees, sodium lamps and parked cars.
houses = [('bld.house-a', 3), ('bld.house-b', 2), ('bld.house-c', 3), ('bld.house-d', 2), ('bld.house-e', 3), ('bld.garage-detached', 1), ('bld.house-c@w2', 1), ('bld.house-a@w3', 1)]
fringe = region_segments(1)
# The old blocked street keeps its rubble line; its yards behind face the detour.
# Their fronts (lit windows, porches) face the detour the player walks; sheds and trees fill the back yards.
for x in range(820, 1050, 16):
    if abs(x - 937) < 14: continue
    dress(rng.choice(['bld.house-a', 'bld.house-c', 'bld.house-e', 'bld.house-d']), x, 52, -math.pi/2)
    dress(rng.choice(['bld.shed', 'prop.street-tree', 'prop.tree']), x + 5, 37, rng.uniform(0, 6))
for x in range(822, 1050, 32):
    if abs(x - 937) > 18: fence_run('prop.picket-fence', (x, 70), (x + 26, 70))
dress('bld.gas-station', 1150, 50, math.pi/2)
for x, z in [(1146, 40), (1158, 40)]: dress('prop.vending-machine', x, z, -math.pi/2)
for x0, z0 in [(840, 120), (940, 125), (1100, 120), (1180, 95)]:
    for k in range(3): dress(rng.choice(['bld.house-b', 'bld.house-d', 'bld.house-e']), x0 + k*16, z0, math.pi/2)
for x0 in (860, 980, 1100, 1180): dress('bld.house-c', x0, -16, -math.pi/2)
l.data['lawns'] += [dict(min=[x, 30], max=[x + 10, 33]) for x in range(1065, 1230, 18)] + [dict(min=[x, 15], max=[x + 10, 18]) for x in range(1065, 1230, 18)]
frontage(fringe, [('prop.street-lamp', 1)], 26, 5.8, jitter=1)
frontage(fringe, houses, 13, (13, 15))
frontage(fringe, [('prop.street-tree', 2), ('prop.hedge', 3), ('prop.garden-bush', 2), ('prop.mailbox-blue', 1)], 6, (6.6, 9))
frontage(fringe, [('veh.sedan-blue', 2), ('veh.sedan-green', 1), ('veh.suv-green', 1), ('veh.pickup-white', 1), ('veh.sedan-red@burned', 1), ('veh.suv-dark@wrecked', 1)], 19, 8.4, chance=.8)

# R3 industrial area: depot rows, trucks, poles and sodium yard lamps.
industrial = region_segments(2) + [s for s in detour_segments if s[0][0] >= 1297 and s[1][0] <= 1747 and min(s[0][1], s[1][1]) < 0]
for x, z in [(1430, 160), (1640, 160), (1700, -120), (1420, -110), (1560, -120)]:
    dress('bld.cure-warehouse', x, z, rng.choice([0, math.pi]))
for x0, z0, x1, z1 in [(1310, 128, 1500, 128), (1530, 128, 1735, 128), (1310, -72, 1500, -72), (1530, -72, 1735, -72)]:
    fence_run('prop.cure-mil-fence', (x0, z0), (x1, z1), 3.3)
frontage(industrial, [('prop.street-lamp', 1)], 24, 5.8, jitter=1)
frontage(industrial, [('prop.utility-pole', 1)], 30, 6.5, sides=(1,), jitter=1)
frontage(industrial, [('bld.cure-service-building', 2), ('bld.substation', 2), ('prop.cure-container-stack', 3), ('veh.box-truck', 2), ('veh.fuel-truck', 1), ('veh.military-truck@wrecked', 1)], 14, (10.5, 15))
frontage(industrial, [('prop.cure-drum-stack', 2), ('prop.jersey-barrier', 2), ('prop.sandbag-pallet', 1), ('prop.emergency-light', 1)], 8, (6.5, 8.5), chance=.8)

# R4 military zone: checkpoints with white floods, guard towers, sandbags, armour wrecks.
military = region_segments(3) + [s for s in detour_segments if s[0][0] >= 1897 and s[1][0] <= 2397 and max(s[0][1], s[1][1]) > 100]
for x, z, yaw in [(1960, -40, 0), (2070, -110, math.pi), (2280, -40, 0), (2360, -110, math.pi), (2000, 150, math.pi), (2260, 150, math.pi)]:
    dress('kit.army-checkpoint', x, z, yaw)
for x0, z0, x1, z1 in [(1910, -96, 2120, -96), (2160, -96, 2380, -96), (1910, 128, 2120, 128), (2160, 128, 2380, 128)]:
    fence_run('prop.cure-mil-fence', (x0, z0), (x1, z1), 3.3)
frontage(military, [('prop.street-lamp', 1)], 32, 5.8, jitter=1, sides=(1,))
frontage(military, [('veh.tank@wrecked', 2), ('veh.military-truck@wrecked', 2), ('kit.guard-tower', 2), ('bld.cure-motor-shelter', 1), ('prop.sandbag-pallet', 2), ('decay.blown-sandbags', 2), ('veh.evac-bus@burned', 1)], 13, (9, 13))
frontage(military, [('prop.jersey-barrier', 3), ('prop.emergency-light', 1), ('decay.blown-sandbags', 2), ('prop.sandbag-pallet', 2), ('prop.cure-mil-fence', 2)], 6, (6.4, 7.5), chance=1)

# R5 research campus: cold floods, ambulances, tents and generators along the lab lanes.
campus = region_segments(4)
for x, z in [(2560, -40), (2650, -40), (2750, -45), (2560, 110), (2650, 110), (2760, 110), (2880, 50)]:
    dress(rng.choice(['bld.cure-lab-annex', 'bld.clinic-annex', 'bld.cure-service-building']), x, z, rng.choice([0, math.pi]))
for x0, z0, x1, z1 in [(2540, 92, 2800, 92), (2540, -26, 2790, -26)]:
    fence_run('prop.cure-quarantine-fence', (x0, z0), (x1, z1), 3.2)
frontage(campus, [('prop.street-lamp', 1)], 22, 5.8, jitter=1)
frontage(campus, [('prop.cure-iso-tent', 3), ('prop.cure-generator', 2), ('veh.ambulance', 2), ('veh.ambulance@wrecked', 1), ('bld.cure-lab-annex', 2), ('veh.police-suv', 1), ('prop.tent', 1)], 12, (9, 13))
frontage(campus, [('prop.street-tree', 1), ('prop.hedge', 3), ('prop.lab-signs', 1), ('prop.cure-quarantine-fence', 2)], 7, (6.4, 8.5), chance=.8)

# R6 destroyed corridor: burned streetscape, collapsed fronts, wrecks and red emergency lights.
corridor = region_segments(5)
frontage(corridor, [('prop.utility-pole', 1)], 28, 6.5, sides=(-1,), jitter=1)
frontage(corridor, [('bld.house-a@w3', 2), ('bld.house-c@w3', 2), ('bld.mainstreet-brick@w3', 2), ('bld.storefront-row@w6', 1), ('bld.house-e@w3', 1), ('bld.clinic-annex@burned', 1)], 13, (12.5, 15))
frontage(corridor, [('veh.school-bus@burned', 1), ('veh.sedan-white@burned', 2), ('veh.suv-dark@burned', 2), ('veh.police-sedan@burned', 1), ('veh.tank@wrecked', 1), ('veh.wreck', 2)], 15, (8, 10), chance=.85)
frontage(corridor, [('decay.blown-sandbags', 2), ('prop.emergency-light', 1), ('decay.makeshift-barricade', 1), ('prop.jersey-barrier', 1)], 8, (6.4, 8), chance=.75)

# R7 approach: plant pipework, tanks, towers and substations beyond the assault ring, lamps on the service road.
complex_route = region_segments(6)
for x, z, asset in [(3820, -110, 'kit.dispersal-filtration-tower'), (3880, 70, 'kit.dispersal-filtration-tower'), (4100, -110, 'kit.dispersal-fan-housing'), (4110, 60, 'kit.dispersal-turbine-hall'), (3920, -120, 'kit.dispersal-tank-sphere'), (4080, 90, 'kit.dispersal-tank-bullet'), (4130, -40, 'kit.dispersal-filtration-tower')]:
    dress(asset, x, z, 0)
for x0, z0, x1, z1 in [(3710, -70, 3930, -70), (3710, 25, 3930, 25)]:
    fence_run('prop.cure-mil-fence', (x0, z0), (x1, z1), 3.3)
frontage(complex_route, [('prop.street-lamp', 1)], 20, 5.8, jitter=1)
frontage(complex_route, [('kit.dispersal-pipe-straight', 3), ('kit.dispersal-tank-bullet', 1), ('kit.dispersal-tank-sphere', 1), ('bld.substation', 2), ('bld.cure-service-building', 1)], 12, (10, 14))
# R7 verge props sit in the bot's and player's natural line to the console: lights only, nothing to bump into.
frontage(complex_route, [('prop.emergency-light', 1)], 7, (5, 7), chance=.9)
# Road surface: solid edge lines so the asphalt reads as a worn road, not a flat ribbon.
for a_, b_ in route_segments:
    d = math.dist(a_, b_)
    if d < 12 or a_[0] > 3975 or b_[0] > 3975: continue
    ux, uz = (b_[0]-a_[0])/d, (b_[1]-a_[1])/d; nx, nz = -uz, ux
    for side in (1, -1):
        o0, o1 = 3.45*side, 3.6*side
        surface('edge-line', ccw([[a_[0]+ux*4.5+nx*o0, a_[1]+uz*4.5+nz*o0], [b_[0]-ux*4.5+nx*o0, b_[1]-uz*4.5+nz*o0], [b_[0]-ux*4.5+nx*o1, b_[1]-uz*4.5+nz*o1], [a_[0]+ux*4.5+nx*o1, a_[1]+uz*4.5+nz*o1]]), 'silver', .006)
# Verge grass: blade strips beside the road through the residential fringe and the campus lawns (high 28 / low 5 blades per m2).
for i in (1, 4):
    for a_, b_ in region_segments(i):
        xs, zs = sorted([a_[0], b_[0]]), sorted([a_[1], b_[1]])
        if xs[1] - xs[0] > zs[1] - zs[0]:
            for z0 in (zs[0] + 9.8, zs[0] - 11.2): l.data['lawns'].append(dict(min=[xs[0] + 5, z0], max=[xs[1] - 5, z0 + 1.4]))   # look-l9b: beyond the dark shoulder band
        else:
            for x0 in (xs[0] + 9.8, xs[0] - 11.2): l.data['lawns'].append(dict(min=[x0, zs[0] + 5], max=[x0 + 1.4, zs[1] - 5]))
# Ground variety in the visible verge band: worn dirt, moss and gravel patches (flat surfaces, no collision).
for a_, b_ in route_segments:
    d = math.dist(a_, b_)
    if d < 10 or a_[0] > 3930: continue
    ux, uz = (b_[0]-a_[0])/d, (b_[1]-a_[1])/d
    for side in (1, -1):
        n = (-uz*side, ux*side); t = rng.uniform(0, 8)
        while t < d:
            off = rng.uniform(7, 26); w = rng.uniform(3, 9); h = rng.uniform(2.5, 7)
            cx, cz = a_[0]+ux*t+n[0]*off, a_[1]+uz*t+n[1]*off
            ang = rng.uniform(0, math.pi); ca, sa = math.cos(ang), math.sin(ang)
            quad = [[cx+ca*w/2*i-sa*h/2*j, cz+sa*w/2*i+ca*h/2*j] for i, j in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
            if all(seg_rect(p0, p1, (min(q[0] for q in quad), min(q[1] for q in quad)), (max(q[0] for q in quad), max(q[1] for q in quad))) > 5 for p0, p1 in route_segments + detour_segments):
                dry = a_[0] < 800
                token = rng.choice(['gloveKhaki', 'oliveSeam'] if dry else ['oliveSeam', 'apronOlive', 'olive', 'khakiSeam'])
                # look-l9b: flat patch quads read as placeholder polygons at the game camera (orchestrator 10-20); the rng
                # draws stay so the dressing stream is unchanged, the shader ground breakup carries the variety.
                if FLAT_PATCHES: surface('verge-patch', ccw(quad), token, -.003)
            t += rng.uniform(11, 22)
# R7 apron: painted bays, hazard edges and service lines so the console floor reads as a working plant (paint only).
for x0 in range(3958, 4040, 9):
    surface('apron-line', [[x0, -66], [x0 + .25, -66], [x0 + .25, -56], [x0, -56]], 'silver', .004)
    surface('apron-line', [[x0, 1], [x0 + .25, 1], [x0 + .25, 11], [x0, 11]], 'silver', .004)
for z0 in (-68.5, 11.5):
    for x0 in range(3954, 4042, 6):
        surface('apron-hazard', [[x0, z0], [x0 + 1.5, z0], [x0 + 1.5, z0 + .6], [x0, z0 + .6]], 'schoolBusYellow', .004)
for x0 in (3955.5, 4040.5):
    for z0 in range(-66, 10, 6):
        surface('apron-hazard', [[x0, z0], [x0 + .6, z0], [x0 + .6, z0 + 1.5], [x0, z0 + 1.5]], 'schoolBusYellow', .004)
# Back rows: distant roofs and trees so the verge beyond the frontage is never empty ground.
for i in range(6):
    frontage(region_segments(i), [('prop.tree', 3), ('prop.street-tree', 1)], 13, (20, 32), chance=.8)
# look-l9b: the destroyed corridor has no power. Its burned fronts join a light group that is off at every tier, so only the
# red emergency lights (their own anchors) and the render-only fires light R6; the warm window pools no longer wash the verge.
l.data['lightGroups'].append(dict(id='corridor-dark', offAt=0))
for p in l.data['placements']:
    if p['assetId'].startswith('bld.') and 2917 <= p['position'][0] <= 3700 and p.get('decorLights'): p['lightGroup'] = 'corridor-dark'
# look-l9b: tar cracks and skid marks on the asphalt (thin dark strips, flat, no collision; L9's dress.py recipe), from a
# separate random stream so the dressing placements are untouched.
crack_rng = random.Random(1020)
for a_, b_ in route_segments:
    d = math.dist(a_, b_)
    if d < 12 or a_[0] > 3940 or b_[0] > 3940: continue
    ux, uz = (b_[0]-a_[0])/d, (b_[1]-a_[1])/d; nx, nz = -uz, ux
    t = crack_rng.uniform(2, 8)
    while t < d - 3:
        lat = crack_rng.uniform(-3.0, 3.0); cx, cz = a_[0]+ux*t+nx*lat, a_[1]+uz*t+nz*lat
        if crack_rng.random() < .6:
            L = crack_rng.uniform(2.5, 7); ca = math.atan2(uz, ux) + crack_rng.choice([crack_rng.uniform(-.25, .25), crack_rng.uniform(1.1, 2.0)])
            w = crack_rng.uniform(.05, .09); p0 = (cx - math.cos(ca)*L/2, cz - math.sin(ca)*L/2); p1 = (cx + math.cos(ca)*L/2, cz + math.sin(ca)*L/2)
            sx, sz = -math.sin(ca)*w/2, math.cos(ca)*w/2
            surface('road-crack', ccw([[p0[0]+sx, p0[1]+sz], [p0[0]-sx, p0[1]-sz], [p1[0]-sx, p1[1]-sz], [p1[0]+sx, p1[1]+sz]]), 'uiDark', .0064, cut=False)
        else:
            L = crack_rng.uniform(3, 7); drift = crack_rng.uniform(-.8, .8)
            for off in (-.9, .9):
                ox, oz = cx + nx*off, cz + nz*off; e0 = (ox - ux*L/2, oz - uz*L/2); e1 = (ox + ux*L/2 + nx*drift, oz + uz*L/2 + nz*drift)
                surface('skid', ccw([[e0[0]+nx*.075, e0[1]+nz*.075], [e0[0]-nx*.075, e0[1]-nz*.075], [e1[0]-nx*.075, e1[1]-nz*.075], [e1[0]+nx*.075, e1[1]+nz*.075]]), 'uiDark', .0062, cut=False)
        t += crack_rng.uniform(5, 11)
print('look-l10 dressing placements', len(l.data['placements']))
for p in l.data['placements']: p['maxTier']=6
for c in l.data['colliders']: c['maxTier']=6
# Semantic pavement shares the renderer's level top, no raised seam at the region/chunk boundary.
emit_surfaces()
l.export()
