"""L9-D1: flat open crossing greybox. Route metrics precede dressing.
100 m terrain roots retain local vertices for the S3/S4 streamer. No residency here.
"""
import json
import math
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from sslib.layout import Layout, material

l = Layout('D-CROSSING', 'The Crossing — open-country greybox', size=(1200, 800))
l.yaw_matches_collision = True
source = json.loads((l.root / 'layouts/D-CROSSING/routes.json').read_text())
# Discard the flat authoring helper's default road/ground; keep empty W1-W5 markers.
for obj in l.layers[0]:
    bpy.data.objects.remove(obj, do_unlink=True)
l.layers[0] = []
l.data['roads'] = dict(nodes=[dict(id='start', point=source['start']), dict(id='outskirts', point=source['outskirts'])], edges=[])
l.data['surfaces'] = []
l.data['lightGroups'] = []
l.data['lawns'] = []  # Open countryside uses sparse trees, not a million grass blades.

# Validate distances BEFORE geometry/art. No numeric scope reduction to fit existing town bounds.
lengths = [sum(math.dist(a,b) for a,b in zip(r['points'],r['points'][1:])) for r in source['routes']]
assert min(lengths) >= 900 and lengths[2] <= .8 * max(lengths)
assert len(source['routes'][2]['risks']) >= 2 * len(source['routes'][0]['risks'])

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
for z in range(8):
    for x in range(12):
        chunks.append(dict(id=f'crossing-{x}-{z}', origin=[-600+x*100,-400+z*100], size=100))
l.data['terrainChunks'] = chunks

patches=[]
# L9-A2 collapsed road/bridge section, one gully across the outskirts approach (all routes share x 450..550).
# Centre x=516, 16 m gap, floor 5.5 m down, 8 m wide; it tapers out to ground level at z=+-90. CCW polygon.
GULLY_X, GULLY_HALF, GULLY_DEPTH, GULLY_FLOOR, GULLY_LEN = 516.0, 8.0, 5.5, 4.0, 90.0
GULLY_HOLE=[[GULLY_X-GULLY_HALF,-GULLY_LEN],[GULLY_X+GULLY_HALF,-GULLY_LEN],[GULLY_X+GULLY_HALF,GULLY_LEN],[GULLY_X-GULLY_HALF,GULLY_LEN]]
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
        # L9-A2: the collapsed-road gully replaces the flat ground (the sim ground stays flat; S6 owns the crash).
        pieces=[piece for p in pieces for piece in subtract(p,GULLY_HOLE)]
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

surface('countryside', [[-600,-400],[600,-400],[600,400],[-600,400]], 'grass', -.006)
dry=[[-460,-170],[470,-170],[470,110],[-460,110]]
surface('dry-ground',dry,'khaki',-.004)
l.data['surfaces'].append(dict(surface='grass',height=0,polygon=l.data['bounds']))
l.data['surfaces'].append(dict(surface='gravel',height=0,polygon=dry+[dry[0]]))
emitted=set()
for route in source['routes']:
    pts=route['points']; width=route['width']
    l.data['roads']['edges'].append(dict(id=route['id'],start='start',end='outskirts',points=pts,laneWidth=width))
    for a,b in zip(pts,pts[1:]):
        d=math.dist(a,b); nx=-(b[1]-a[1])/d*width/2; nz=(b[0]-a[0])/d*width/2
        poly=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]]
        key=(tuple(a),tuple(b))
        if key in emitted: continue
        emitted.add(key)
        height=.002 if route['id']=='road' else .004 if route['id']=='countryside' else .006
        token='asphalt' if route['surface']=='asphalt' else 'woodWarm' if route['id']=='countryside' else 'khakiLight'
        surface(route['id'],poly,token,height)
        l.data['surfaces'].append(dict(surface=route['surface'],height=height,polygon=poly+[poly[0]]))
        if route['id']=='road':
            for s in range(8,int(d)-4,20):
                cx=a[0]+(b[0]-a[0])*s/d; cz=a[1]+(b[1]-a[1])*s/d
                tx=(b[0]-a[0])/d*2; tz=(b[1]-a[1])/d*2
                mark=[[cx-tx+nx*.025,cz-tz+nz*.025],[cx-tx-nx*.025,cz-tz-nz*.025],[cx+tx-nx*.025,cz+tz-nz*.025],[cx+tx+nx*.025,cz+tz+nz*.025]]
                surface('road-mark',mark,'picketWhite',.008)
    for i,p in enumerate(route['risks']): l.anchor(f"risk-{route['id']}-{i}",[p[0],0,p[1]])

for name,p in [('crossing-start',source['start']),('player-start',source['start']),('outskirts',source['outskirts']),('exit',source['outskirts']),('road-fork',[-450,0]),('countryside',[0,240]),('dry-shortcut',[0,-30]),('chunk-seam',[0,-330])]: l.anchor(name,[p[0],0,p[1]])
for v in source['viewpoints']: l.anchor(v['id'],[v['from'][0],0,v['from'][1]])
# Reuse existing countryside stock; widely separated, clear of all route/detour footprints.
for x,z in [(-250,320),(-225,320),(160,330),(185,330)]:
    pid=l.place('bld.house-a',[x,0,z]); p=l.data['placements'][-1]
    l.data['buildings'].append(dict(id=pid,assetId=p['assetId'],aabb=p['visualAabb'],label='Countryside'))
for x,z in [(-420,100),(-380,310),(-150,310),(80,320),(360,300),(340,-220),(-200,-220),(100,-230)]: l.place('prop.tree',[x,0,z])
for x,z in [(565,-65),(580,-85),(545,-105),(575,-130)]:
    pid=l.place('bld.apartment-block-a',[x,0,z]); p=l.data['placements'][-1]
    l.data['buildings'].append(dict(id=pid,assetId=p['assetId'],aabb=p['visualAabb'],label='Next city'))
# Dry rocks from the reviewed river kit: only its rocks module, no water/reeds/bank.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(l.root/'assets/kit.river-terrain/model.glb'))
imported=set(bpy.data.objects)-before
rocks=sorted([o for o in imported if o.name.startswith('rocks_pal_') and o.type=='MESH'],key=lambda o:o.name)
assert rocks
bpy.context.view_layer.update()
verts=[o.matrix_world @ v.co for o in rocks for v in o.data.vertices]
lo=Vector(tuple(min(v[i] for v in verts) for i in range(3))); hi=Vector(tuple(max(v[i] for v in verts) for i in range(3)))
center=(lo+hi)/2
for x,z in [(-310,-110),(-100,-120),(100,-120),(310,-110)]:
    for rock in rocks:
        ob=bpy.data.objects.new('dry-rocks',rock.data.copy()); bpy.context.collection.objects.link(ob)
        for i,m in enumerate(ob.data.materials): ob.data.materials[i]=material(m.name.removeprefix('pal_').split('.')[0])
        for v in ob.data.vertices:
            p=rock.matrix_world @ v.co
            v.co=(p.x-center.x,p.y-center.y,p.z-lo.z)
        ob.location=(x,-z,0); l.layers[0].append(ob)
    l.data['colliders'].append(dict(id=f'rocks-{x}',aabb=dict(min=[x-(hi.x-lo.x)/2,0,z-(hi.y-lo.y)/2],max=[x+(hi.x-lo.x)/2,hi.z-lo.z,z+(hi.y-lo.y)/2]),minTier=0,maxTier=6))
for obj in imported: bpy.data.objects.remove(obj,do_unlink=True)
# Visible fork direction arrows: three traces branch towards the skyline, no route rails.
for z in [-16,0,16]:
    surface('outskirts-arrow',[[-445,z-2],[-438,z-2],[-438,z-4],[-432,z],[-438,z+4],[-438,z+2],[-445,z+2]],'picketWhite',.01)
# ---- L9-A2 crash site: gully terrain, collapsed road/bridge kit, wrecks, anchors --------------------
def gully():
    """Banks and floor of the gully as terrain-chunk meshes (z<0 belongs to chunk row 3, z>=0 to row 4)."""
    stations=[-GULLY_LEN+5*i for i in range(int(2*GULLY_LEN/5)+1)]
    def depth(z):
        t=max(0,min(1,(GULLY_LEN-abs(z))/50)); return GULLY_DEPTH*t*t*(3-2*t)
    ring=lambda z:[(GULLY_X-GULLY_HALF,0),(GULLY_X-GULLY_FLOOR,-depth(z)),(GULLY_X+GULLY_FLOOR,-depth(z)),(GULLY_X+GULLY_HALF,0)]
    for row,(z0,z1) in enumerate([(-GULLY_LEN,0),(0,GULLY_LEN)]):
        cid=f'crossing-11-{3+row}'; ox,oz=500,-400+(3+row)*100
        zs=[z for z in stations if z0<=z<=z1]
        for part,token in (('bank-w','khaki'),('floor','khakiSeam'),('bank-e','khaki')):
            verts=[];faces=[]
            for z in zs:
                r=ring(z); a,b={'bank-w':(0,1),'floor':(1,2),'bank-e':(2,3)}[part]
                for x,h in (r[a],r[b]): verts.append((x-ox,-(z-oz),h))
            for i in range(len(zs)-1):
                q=[2*i,2*i+1,2*i+3,2*i+2]
                n=(Vector(verts[q[1]])-Vector(verts[q[0]])).cross(Vector(verts[q[3]])-Vector(verts[q[0]]))
                faces.append(tuple(q) if n.z>=0 else tuple(reversed(q)))
            mesh=bpy.data.meshes.new('gully-'+part);mesh.from_pydata(verts,[],faces);mesh.update()
            obj=bpy.data.objects.new(cid,mesh);bpy.context.collection.objects.link(obj)
            obj.location=(ox,-oz,0);mesh.materials.append(material(token))
            obj['terrainChunk']=cid;obj['chunkOrigin']=[ox,oz];l.layers[0].append(obj)
gully()
# Collapsed deck, broken lips, pier stubs, rebar, rails and rubble: one visual-only kit (no collider, sim ground unchanged).
l.place('kit.crossing-crash',[GULLY_X,0,0],allowed=True)
# Wrecks on the approach. In-lane blockers are the shared `veh.wreck` (the only vehicle the road validator allows on a lane)
# at x >= 486 with >= 4.7 m of the 12 m lane free either side of the route line; cars overshoot the (450, 0) corner by up to
# +-4 m, so nothing sits in the lane before x=486 and the large wrecks flank the verge (outside the lane, x >= 472).
def wreck(asset,x,z,yaw,decay='wrecked',road=False):
    l.place(asset,[x,0,z],yaw,allowed=road)
    if asset!='veh.wreck': l.data['placements'][-1]['decay']=decay
for x,z,yaw in [(488,-6.7,.5),(493,6.8,-.6)]: wreck('veh.wreck',x,z,yaw,road=True)
for asset,x,z,yaw in [('veh.military-truck',478,-8.9,.35),('veh.school-bus',490,9.7,-.42),('veh.sedan-red',494,-9.3,.9),('veh.police-sedan',476,8.8,2.6),('veh.pickup-red',465,-8.9,-.5)]:
    wreck(asset,x,z,yaw)
for x,z,yaw in [(461,-7.4,.2),(462,7.4,-.15),(483,7.4,1.1),(505,-7.7,.3)]: l.place('prop.barricade',[x,0,z],yaw)
# Crash sequence anchors (game space). S6 owns the trigger/camera; these are validated safe positions.
l.anchor('crash-approach',[470,0,0])          # take driving input here, before the first wreck
l.anchor('crash-impact',[GULLY_X-GULLY_HALF,0,0])  # near lip: the APC leaves the road here
l.anchor('crash-wreck',[GULLY_X+1.7,-GULLY_DEPTH,0.0])  # final APC wreck on the gully floor, yaw 90 (clear of slabs and piers)
l.anchor('crawl-start',[GULLY_X+GULLY_HALF+3.5,0,2.6])   # player thrown clear on the far lip, beside the wreck
l.anchor('crawl-fallback',[GULLY_X+GULLY_HALF+3.5,0,-3.2])
l.anchor('crawl-end',[547,0,0])               # safe L10 on-foot start, in sight of the city
for p in l.data['placements']: p['maxTier']=6
for c in l.data['colliders']: c['maxTier']=6
emit_surfaces()
l.export()
