"""L8 sanctuary: closed masonry perimeter, two public loops and service access.
Uses the shipped zoo buildings, E26 fences/furniture and E25 practical lights.
The outbreak/animal population and occluded outlet interiors belong to later lanes.
"""
import math
from sslib.layout import Layout, empty

l = Layout('D-ZOO', 'Sunset Grove Zoo', size=(240, 180))
l.yaw_matches_collision = True
# Replace the flat-mode demonstration road with the zoo's actual path graph.
for ob in list(l.layers[0]):
    if ob.name.startswith('road-main'):
        l.layers[0].remove(ob)
        import bpy
        bpy.data.objects.remove(ob, do_unlink=True)
l.data['surfaces'] = [s for s in l.data['surfaces'] if s['surface'] != 'asphalt']
l.data['roads'] = dict(nodes=[], edges=[])

def point(name, x, z):
    l.data['roads']['nodes'].append(dict(id=name, point=[x,z]))

def path(a, b, width=5):
    nodes = {n['id']: n['point'] for n in l.data['roads']['nodes']}
    x,z = nodes[a]; xx,zz = nodes[b]
    l.data['roads']['edges'].append(dict(id=a+'--'+b, start=a, end=b, points=[[x,z],[xx,zz]], laneWidth=width))
    sx,sz = abs(xx-x),abs(zz-z)
    l.box('clean-path', 'asphalt', [sx+width,.12,sz+width], [(x+xx)/2,.06,(z+zz)/2])
    # Paving supports feet (top .12 m), bordered by narrow light stone edging.
    for side in [-1,1]:
        # Set edging back at intersections: it must not overlap the adjacent
        # path's coplanar paving and flicker across a clean junction.
        if sx > width:
            l.box('path-edging','sidewalk',[sx-width,.12,.18],[(x+xx)/2,.06,z+side*(width/2+.09)])
        elif sz > width:
            l.box('path-edging','sidewalk',[.18,.12,sz-width],[x+side*(width/2+.09),.06,(z+zz)/2])
    l.data['surfaces'].append(dict(surface='tile',height=.12,polygon=[[min(x,xx)-width/2,min(z,zz)-width/2],[max(x,xx)+width/2,min(z,zz)-width/2],[max(x,xx)+width/2,max(z,zz)+width/2],[min(x,xx)-width/2,max(z,zz)+width/2],[min(x,xx)-width/2,min(z,zz)-width/2]]))

xs = [-96,-60,-24,0,24,60,96]
zs = [-64,0,64]
for z in zs:
    for x in xs: point(f'p{x}:{z}',x,z)
for z in zs:
    for a,b in zip(xs,xs[1:]): path(f'p{a}:{z}', f'p{b}:{z}')
for x in [-96,-24,24,96]:
    for a,b in zip(zs,zs[1:]): path(f'p{x}:{a}',f'p{x}:{b}')
point('arrival',0,70); path('p0:64','arrival',8)
point('vehicle',96,74); path('p96:64','vehicle',8)

# Detailed, continuous masonry: plinth, staggered courses, coping and capped piers.
# Render meshes and uninterrupted collision/sight boxes share the same dimensions.
def wall(name, x, z, length, along_x):
    def masonry(part, token, size, pos):
        ob = l.box(part, token, size, pos)
        # Keep the existing detailed stone geometry, but let Three's ordinary
        # frustum culling skip unseen 24 m runs instead of drawing the entire
        # 800 m perimeter as one palette-wide mesh on every phone frame.
        coord = pos[0]-x if along_x else pos[2]-z
        chunk = math.floor((coord+length/2)/24)
        ob['layoutBatch'] = f'zoo-wall-{name}-{chunk}-{token}'
    dims = [length,4,.8] if along_x else [.8,4,length]
    l.data['colliders'].append(dict(id='zoo-wall-'+name,aabb=dict(min=[x-dims[0]/2,0,z-dims[2]/2],max=[x+dims[0]/2,4,z+dims[2]/2]),minTier=0,maxTier=5))
    masonry('wall-plinth','sidewalk',[dims[0],.4,dims[2]],[x,.2,z])
    for row in range(6):
        count = math.ceil(length/4)
        for i in range(count):
            start = max(-length/2, -length/2+i*4-(2 if row%2 else 0))
            end = min(length/2, -length/2+(i+1)*4-(2 if row%2 else 0))
            if end <= start: continue
            mid=(start+end)/2
            masonry('masonry-course','brick' if row%2 else 'woodWarm',[end-start-.025,.54,.8] if along_x else [.8,.54,end-start-.025],[x+(mid if along_x else 0),.69+row*.55,z+(0 if along_x else mid)])
        # Finish the offset end course without a physical/visual seam.
        if row%2:
            masonry('masonry-end','brick',[2,.54,.8] if along_x else [.8,.54,2],[x+(length/2-1 if along_x else 0),.69+row*.55,z+(0 if along_x else length/2-1)])
    masonry('wall-coping','sidewalk',[dims[0]+.08,.22,dims[2]+.22],[x,3.9,z])
    for i in range(math.ceil(length/12)+1):
        t=-length/2+min(length,i*12)
        px=x+(t if along_x else 0); pz=z+(0 if along_x else t)
        masonry('wall-pier','brick',[1.15,4,1.15],[px,2,pz])
        masonry('pier-cap','sidewalk',[1.35,.22,1.35],[px,4.05,pz])
for name,x,z,length,axis in [('north',0,-86,232,True),('south',0,86,232,True),('west',-116,0,172,False),('east',116,0,172,False)]: wall(name,x,z,length,axis)

# Real shipped architecture: ticket pavilions, intact reptile hall and staff lodge.
for asset,x,z,label,door in [('bld.zoo-gate',0,78,'Zoo tickets','zoo-entrance'),('bld.reptile-house',-14,14,'Reptile House','reptile-door'),('bld.park-lodge',87,32,'Zoo staff and first aid','staff-door')]:
    ident=l.place(asset,[x,0,z])
    l.data['buildings'].append(dict(id=ident,assetId=asset,aabb=l.data['placements'][-1]['visualAabb'],label=label))
    l.anchor(door,[x+7,0,z])

# Enclosures built from shipped metal fence modules. Each has two 5 m gates;
# permanent posts frame the openings while both routes remain navigable.
def fence(x,z,yaw=0,span=2.4):
    l.place('prop.crowd-fence',[x,0,z],yaw=yaw,scale=(span/2.38,2.4,1))

def enclosure(species,cx,cz,w=44,d=40):
    l.zone('enclosure-'+species,[[cx-w/2,cz-d/2],[cx+w/2,cz-d/2],[cx+w/2,cz+d/2],[cx-w/2,cz+d/2]])
    for side in [-1,1]:
        for i in range(math.ceil(d/2.38)):
            span=min(2.38,d-i*2.38)
            fence(cx+side*w/2,cz-d/2+i*2.38+span/2,math.pi/2,span)
        for a,b in [(-w/2,-3),(3,w/2)]:
            count=math.ceil((b-a)/2.38)
            for i in range(count):
                span=min(2.38,b-a-i*2.38)
                fence(cx+a+i*2.38+span/2,cz+side*d/2,0,span)
        # Route from each gate to the nearest public path.
        gate_z=cz+side*d/2; path_z=0 if abs(gate_z)<32 else side*64
        l.anchor(f'{species}-gate-{"north" if side<0 else "south"}',[cx,0,gate_z])
        point(f'{species}-gate-{side}',cx,gate_z)
        path(f'p{cx}:{path_z}',f'{species}-gate-{side}',5)
    # Normal flamingos need a walkable shore spawn, not the excluded pond centre.
    l.anchor('animal-'+species,[cx-10 if species == 'flamingo' else cx,0,cz])
    l.place('prop.street-lamp',[cx+9,0,cz+5])
    l.place('prop.street-sign',[cx+5,0,cz+d/2+3])
    for dx,dz in [(-w/2+6,-d/2+6),(w/2-6,d/2-6)]:
        l.place('prop.tree',[cx+dx,0,cz+dz],scale=(.85,.85,.85))
        l.place('prop.garden-bush',[cx+dx+3,0,cz+dz+2])
        l.data['lawns'].append(dict(min=[cx+dx-2,cz+dz-2],max=[cx+dx+2,cz+dz+2]))
    l.place('prop.hose-reel',[cx+w/2-3,0,cz])
    l.place('prop.sprinkler',[cx+w/2-3 if species == 'flamingo' else cx+5,0,cz+3])
for species,x,z in [('lion',-60,-32),('gorilla',60,-32),('elephant',-60,32),('zebra',60,32)]: enclosure(species,x,z)
enclosure('flamingo',0,-32,28,40)
# A recessed pond with a rounded stone rim; excluded water never blocks the gates.
import bpy
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=8,location=(0,32,-.1))
pond=bpy.context.object; pond.name='flamingo-water'; pond.scale=(8,6,.14)
from sslib.layout import material
pond.data.materials.append(material('backpackTeal')); l.layers[0].append(pond)
l.data['walkable']['excluded']=[[[ -8,-38],[8,-38],[8,-26],[-8,-26],[-8,-38]]]

for x in [-96,-24,24,96]:
    for z in [-64,-32,0,32,64]:
        l.place('prop.street-lamp',[x+(6 if z==64 and x==96 else 4),0,z+4])
for z in [-64,0,64]:
    for x in [-60,0,60]:
        l.place('prop.street-lamp',[x+(6 if z==64 and x==0 else 4),0,z+4])
        l.place('prop.bench',[x+7,0,z+5],yaw=math.pi/2)
        l.place('prop.trash-bin',[x+10,0,z+5])
for x,z in [(-108,-72),(108,-72),(-108,72),(108,72)]: l.place('kit.guard-tower',[x,0,z])
for x,z in [(-104,-32),(104,-32),(0,48)]:
    l.place('kit.maintenance-corridor',[x,0,z])
    l.anchor(f'maintenance-{x}',[x+7,0,z])
# Four occluded service-tunnel outlets (L8-D2): locked masonry bunkers whose steel doors open at the breach (the
# HouseEmergence door contract in src/data/buildingDoors.ts). Door plane 3.05 m from the footprint centre; the
# paved apron runs out to the path edge (2.5 m half width + 2.95 m). Interiors are an L-shaped dark vestibule, so
# nothing inside is visible from outside even with the doors open. >= 20 m apart, all inside the perimeter.
def outlet(n, door_x, door_z, nx, nz, yaw):
    l.place('kit.zoo-tunnel-mouth',[door_x-3.05*nx,0,door_z-3.05*nz],yaw=yaw)
    cx,cz = door_x+nx*1.475, door_z+nz*1.475
    size = [2.95,.12,3.6] if nx else [3.6,.12,2.95]
    l.box('tunnel-apron','sidewalk',size,[cx,.06,cz])
    hx,hz = size[0]/2,size[2]/2
    l.data['surfaces'].append(dict(surface='tile',height=.12,polygon=[[cx-hx,cz-hz],[cx+hx,cz-hz],[cx+hx,cz+hz],[cx-hx,cz+hz],[cx-hx,cz-hz]]))
    l.anchor(f'tunnel-outlet-{n}',[door_x+nx*1.5,0,door_z+nz*1.5])
    l.place('prop.street-lamp',[door_x+nx*2.2-nz*2.4,0,door_z+nz*2.2+nx*2.4])
outlet(1,-101.45,32,1,0,0)                 # west loop, facing the x=-96 path
outlet(2,101.45,-48,-1,0,math.pi)          # east loop, facing the x=96 path
outlet(3,-30,-69.45,0,1,-math.pi/2)        # north loop, facing the z=-64 path
outlet(4,-45,69.45,0,-1,math.pi/2)         # south loop, facing the z=64 path near the arrival plaza
l.place('prop.light-tower',[104,0,74])
l.place('prop.vending-machine',[10,0,75])
l.place('prop.hose-reel',[90,0,37])
l.place('prop.wheelbarrow',[90,0,42])
l.place('prop.crates',[84,0,42])
# Intact service parking and staff garden reuse the ordinary instanced prop families.
for x,z in [(104,32),(104,42)]: l.place('veh.sedan-red',[x,0,z])
for x,z in [(106,54),(110,54)]: l.place('prop.picket-fence',[x,0,z])
for x,z in [(110,46),(110,50)]: l.place('prop.hedge',[x,0,z])
for x,z in [(6,70),(6,72)]: l.place('prop.traffic-cone',[x,0,z])
for name,p in {'player-start':[0,0,70],'arrival':[0,0,70],'exit':[96,0,74],'safe-point':[24,0,64],'cat-perch':[-14,4,-14],'crow-roost':[86,4,32],'objective':[96,0,74],'pair-zoo-gate':[0,0,70],'pair-zoo-lion':[-60,0,-10],'pair-zoo-gorilla':[60,0,-10],'pair-zoo-service-yard':[96,0,32],'l8-safe-paths':[24,0,0],'l8-tunnel-breach':[-45,0,68]}.items(): l.anchor(name,p)
# Preserve the old generic E10 decay probes away from public paths; L8 uses W0
# throughout and live outbreak damage, so sanctuary is never pre-dressed with wrecks.
for tier in range(1,6): l.place('veh.wreck',[-106,0,-60+tier*12],tier=tier,allowed=True)
l.empties.append(empty('collapse-canopy',[0,-2,0]))
l.data['layers'][4]['remove'].append('collapse-canopy')
l.data['layers'][2]['disableLights']=['block-0','block-2']
l.data['layers'][4]['disableLights']=['block-1','block-3']
l.export()
