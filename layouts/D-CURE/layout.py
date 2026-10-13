"""L10-D1/D2: R1–R4 on the shared 100 m streamer. R2's blocked street has an open northern detour."""
import json
import math
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from sslib.layout import Layout, material

l = Layout('D-CURE', 'The Cure — crash, residential, industrial and military', size=(2000,600))
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
    for x in range(20):
        chunks.append(dict(id=f'cure-{x}-{z}', origin=[500+x*100,-200+z*100], size=100))
l.data['terrainChunks'] = chunks

patches=[]
def surface(name, poly, token, height=0):
    # Arrow silhouettes are concave; partition them into convex triangles.
    if any((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]) < -1e-8 for a,b,c in zip(poly,poly[1:]+poly[:1],poly[2:]+poly[:2])):
        for tri in tessellate_polygon([[Vector((x,z,0)) for x,z in poly]]):
            patches.append((name,[poly[v] if isinstance(v,int) else [v.x,v.y] for v in tri],token,height))
    else: patches.append((name,poly,token,height))

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
    for index,(name,poly,token,height) in enumerate(patches):
        pieces=[poly]
        # Flat surface ownership, rather than stacked coplanar slabs. This avoids depth flicker
        # even at the 200 m review camera; paint and intersecting fork lanes have one owner.
        for _,cutter,_,_ in patches[index+1:]:
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
surface('crash-dry',[[500,-125],[740,-125],[740,125],[500,125]],'khaki',-.004)
l.data['surfaces'].append(dict(surface='grass',height=0,polygon=source['bounds']))
# Graph shares the exact boundary vertex; no duplicate slab or invisible region gate.
route = [p for i,r in enumerate(source['regions']) for p in (r['route'] if i == 0 else r['route'][1:])]
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
        surface('mark',[[cx-tx+nx*.025,cz-tz+nz*.025],[cx-tx-nx*.025,cz-tz-nz*.025],[cx+tx-nx*.025,cz+tz-nz*.025],[cx+tx+nx*.025,cz+tz+nz*.025]],'picketWhite',.008)
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
l.anchor('player-start',[547,0,0]); l.anchor('exit',[2467,0,-5])
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
for x in [1997,2197,2327]: l.place('veh.military-truck',[x,0,130 if x==2327 else -95])
surface('checkpoint-road',[[1897,21],[2397,21],[2397,29],[1897,29]],'asphalt',.002)
for z in range(-45,87,3): l.place('prop.cure-mil-fence',[2137,0,z],yaw=math.pi/2)
for x,z in [(2137,-87),(2137,-63)]: l.place('prop.jersey-barrier',[x,0,z])
for x,z in [(1850,19),(1864,19),(2127,-68),(2147,-68)]: l.place('prop.traffic-cone',[x,0,z])
for p in l.data['placements']: p['maxTier']=6
for c in l.data['colliders']: c['maxTier']=6
# Semantic pavement shares the renderer's level top, no raised seam at the region/chunk boundary.
emit_surfaces()
l.export()
