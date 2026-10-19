"""L8 sanctuary: closed masonry perimeter, two public loops and service access.
Uses the shipped zoo buildings, E26 fences/furniture and E25 practical lights.
The outbreak/animal population and occluded outlet interiors belong to later lanes.
"""
import math
import random
from sslib.layout import Layout, empty

l = Layout('D-ZOO', 'Sunset Grove Zoo', size=(300, 240))
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
def wall(name, x, z, length, along_x, gap=None):
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
    # `gap` = (centre, width) along the wall: the masonry is left out for the drive-out gate (its steel leaves are built below); the collider above stays whole.
    spans = [(-length/2, length/2)] if gap is None else [(-length/2, gap[0]-gap[1]/2), (gap[0]+gap[1]/2, length/2)]
    for lo, hi in spans:
        span = hi - lo
        masonry('wall-plinth','sidewalk',[span,.4,dims[2]] if along_x else [dims[0],.4,span],[x+((lo+hi)/2 if along_x else 0),.2,z+(0 if along_x else (lo+hi)/2)])
        for row in range(6):
            count = math.ceil(span/4)+1
            for i in range(count):
                start = max(lo, lo+i*4-(2 if row%2 else 0))
                end = min(hi, lo+(i+1)*4-(2 if row%2 else 0))
                if end <= start: continue
                mid=(start+end)/2
                masonry('masonry-course','brick' if row%2 else 'woodWarm',[end-start-.025,.54,.8] if along_x else [.8,.54,end-start-.025],[x+(mid if along_x else 0),.69+row*.55,z+(0 if along_x else mid)])
        masonry('wall-coping','sidewalk',[(span if along_x else dims[0])+.08,.22,(dims[2] if along_x else span)+.22],[x+((lo+hi)/2 if along_x else 0),3.9,z+(0 if along_x else (lo+hi)/2)])
    for i in range(math.ceil(length/12)+1):
        t=-length/2+min(length,i*12)
        if gap is not None and abs(t-gap[0]) < gap[1]/2 + 2.0: continue
        px=x+(t if along_x else 0); pz=z+(0 if along_x else t)
        masonry('wall-pier','brick',[1.15,4,1.15],[px,2,pz])
        masonry('pier-cap','sidewalk',[1.35,.22,1.35],[px,4.05,pz])
for name,x,z,length,axis in [('north',0,-86,232,True),('south',0,86,232,True),('west',-116,0,172,False),('east',116,0,172,False)]: wall(name,x,z,length,axis,gap=(74.0,5.4) if name == 'east' else None)

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
l.place('prop.light-tower',[104,0,67.4])
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
# ------------------------------------------------------------------------------------------------ the town round the zoo (dress-l8-cellar)
# Opus visual QA #34: the zoo stood on a flat dark plane. The 4 m masonry wall is closed (collision unchanged), so everything below lies outside it
# and is unreachable; it only gives the camera, which sees past the wall whenever the player walks along it, a town: a closed service-road ring
# with kerbs and lamps, roadside rows of houses, shops, flats and a gas station, parked cars, a tree screen along the bounds, and the drive-out
# spur east from the armored vehicle's gate to a military roadblock (never a bare road end).
_FACE = {'E': 0.0, 'N': math.pi / 2, 'W': math.pi, 'S': -math.pi / 2}
_rng = random.Random(1019)
_BX, _BZ = 149.4, 119.4                         # placements stay inside the bounds
_taken = []                                      # footprints (x0, z0, x1, z1) of everything placed outside the wall

def _foot(asset, x, z, yaw, sc):
    d = l.manifest[asset]['dimensions']
    dx, dz = d['x'] * sc, d['z'] * sc
    ex = abs(math.cos(yaw)) * dx + abs(math.sin(yaw)) * dz
    ez = abs(math.sin(yaw)) * dx + abs(math.cos(yaw)) * dz
    return (x - ex / 2, z - ez / 2, x + ex / 2, z + ez / 2)

def put(asset, x, z, yaw=0.0, sc=1.0, margin=0.0, tint=None, shrink=0.0):
    """Place outside the wall unless it leaves the bounds or overlaps something placed before. `shrink` trims canopies/props to their trunk."""
    f = _foot(asset, x, z, yaw, sc)
    f = (f[0] + shrink, f[1] + shrink, f[2] - shrink, f[3] - shrink)
    if f[0] < -_BX or f[2] > _BX or f[1] < -_BZ or f[3] > _BZ: return None
    for a in _taken:
        if min(f[2], a[2]) - max(f[0], a[0]) > -margin and min(f[3], a[3]) - max(f[1], a[1]) > -margin: return None
    _taken.append(f)
    return l.place(asset, [x, 0, z], yaw=yaw, scale=(sc, sc, sc), tint=tint)

def slab(name, token, x0, x1, z0, z1, top):
    l.box(name, token, [x1 - x0, top, z1 - z0], [(x0 + x1) / 2, top / 2, (z0 + z1) / 2])

# --- the service-road ring: inner kerb walk, 8 m carriageway, outer kerb walk (distances from the wall face, 116.4 / 86.4)
for sx in (-1, 1):
    a, b, c, d = 117.0, 118.4, 125.0, 127.0
    for (x0, x1, token, top) in ((a, b, 'sidewalk', .12), (b, c, 'asphalt', .1), (c, d, 'sidewalk', .12)):
        slab('ring-ns', token, min(sx * x0, sx * x1), max(sx * x0, sx * x1), -97.0, 97.0, top)
for sz in (-1, 1):
    a, b, c, d = 87.0, 88.4, 95.0, 97.0
    for (z0, z1, token, top) in ((a, b, 'sidewalk', .12), (b, c, 'asphalt', .1), (c, d, 'sidewalk', .12)):
        slab('ring-ew', token, -127.0, 127.0, min(sz * z0, sz * z1), max(sz * z0, sz * z1), top)
for t in range(-96, 97, 8):                     # dashed centre lines
    for sx in (-1, 1): l.box('ring-line', 'picketWhite', [.2, .01, 3.6], [sx * 121.7, .105, t])
for t in range(-124, 125, 8):
    for sz in (-1, 1): l.box('ring-line', 'picketWhite', [3.6, .01, .2], [t, .105, sz * 91.7])
# --- the drive-out: apron from the vehicle pad to the east wall (inside), a steel service gate in the wall, the spur outside to the roadblock
slab('apron-road', 'asphalt', 100.0, 118.4, 70.6, 77.4, .1)
slab('apron-kerb-n', 'sidewalk', 100.0, 116.4, 69.6, 70.6, .12); slab('apron-kerb-s', 'sidewalk', 100.0, 116.4, 77.4, 78.4, .12)
slab('spur-road', 'asphalt', 125.0, 147.0, 70.6, 77.4, .1)
slab('spur-kerb-n', 'sidewalk', 127.0, 147.0, 68.8, 70.6, .12); slab('spur-kerb-s', 'sidewalk', 127.0, 147.0, 77.4, 79.2, .12)
slab('gate-apron', 'asphalt', 116.4, 118.4, 70.6, 77.4, .1)
for t in range(104, 147, 8): l.box('spur-line', 'picketWhite', [3.6, .01, .2], [t, .105, 74.0])
# the gate: two steel leaves in the wall gap (visual only, the wall collider stays whole), brick piers and a lintel with a sign
GZ, GW = 74.0, 5.4
for side in (-1, 1):
    pz = GZ + side * (GW / 2 + .6)
    l.box('gate-pier', 'brick', [1.2, 4.4, 1.2], [116.0, 2.2, pz]); l.box('gate-pier-cap', 'sidewalk', [1.45, .22, 1.45], [116.0, 4.5, pz])
for leaf in (-1, 1):
    z0, z1 = (GZ - GW / 2, GZ) if leaf < 0 else (GZ, GZ + GW / 2)
    for y in (.3, 1.5, 2.85): l.box('gate-rail', 'silver', [.12, .12, z1 - z0], [116.0, y, (z0 + z1) / 2])
    for k in range(0, int((z1 - z0) / .22) + 1): l.box('gate-bar', 'silver', [.05, 2.6, .05], [116.0, 1.6, z0 + .11 + k * .22 if z0 + .11 + k * .22 < z1 else z1 - .05])
    l.box('gate-post', 'silver', [.2, 3.0, .2], [116.0, 1.5, z0 + .1 if leaf < 0 else z1 - .1])
l.box('gate-lintel', 'silver', [.35, .3, GW + 1.2], [116.0, 4.15, GZ]); l.box('gate-sign', 'woodWarm', [.12, .7, 3.2], [115.55, 3.55, GZ])
l.anchor('l8-drive-out-gate', [116.0, 0, GZ])
# --- buildings and fillers
POOL = {'W': [('bld.apartment-block-b', 1.0), ('bld.apartment-block-a', 1.0), ('bld.storefront-row', .9), ('bld.house-d', .9), ('bld.supermarket', 1.0), ('bld.house-c', .85), ('bld.apartment-block-a', 1.0), ('bld.house-e', .9)],
        'N': [('bld.apartment-block-a', 1.0), ('bld.storefront-row', .9), ('bld.apartment-block-b', 1.0), ('bld.house-e', .9), ('bld.gas-station', 1.0), ('bld.house-a', 1.0), ('bld.supermarket', 1.0), ('bld.apartment-block-a', 1.0)],
        'E': [('bld.house-c', .85), ('bld.garage-detached', .9), ('bld.house-e', .9), ('bld.storefront-row', .8), ('bld.house-a', 1.0), ('bld.house-d', .9), ('bld.supermarket', .9), ('bld.house-e', .9)],
        'S': [('bld.house-a', 1.0), ('bld.storefront-row', .8), ('bld.house-d', .9), ('bld.supermarket', .9), ('bld.house-c', .85), ('bld.garage-detached', .9), ('bld.gas-station', 1.0), ('bld.house-e', .9)]}
TINTS = ['#ffe58f', '#bfe8c8', '#b3d7f5', '#ffb8a3', '#d3dfae', '#fff6e6', '#d9c8f2']
CARS = ['veh.sedan-red', 'veh.sedan-blue', 'veh.suv-dark', 'veh.pickup-red', 'veh.sedan-white', 'veh.suv-green', 'veh.pickup-white', 'veh.wreck', 'veh.box-truck', 'veh.sedan-green']
def side_row(side, lo, hi, skip=None):
    """Buildings facing the ring road from beyond the outer kerb walk. E/W rows run along z, N/S along x."""
    face = {'E': 'W', 'W': 'E', 'N': 'S', 'S': 'N'}[side]
    along_z = side in ('E', 'W')
    front = {'E': 128.4, 'W': -128.4, 'N': -98.4, 'S': 98.4}[side]
    maxd = (149.0 - 128.4) if along_z else (119.0 - 98.4)
    pool, cursor, i = POOL[side], lo, _rng.randrange(8)
    while cursor < hi - 6:
        if skip and skip[0] <= cursor + 5 < skip[1]:
            cursor = skip[1]; continue
        asset, sc = pool[i % len(pool)]; i += 1
        d = l.manifest[asset]['dimensions']; depth, width = d['x'] * sc, d['z'] * sc
        if depth > maxd or (skip and cursor < skip[0] < cursor + width): cursor += 4; continue
        sgn = 1 if side in ('E', 'S') else -1             # direction from the front wall into the plot
        mid = cursor + width / 2
        cx, cz = (front + sgn * depth / 2, mid) if along_z else (mid, front + sgn * depth / 2)
        if put(asset, cx, cz, _FACE[face], sc, margin=.3, tint=_rng.choice(TINTS) if 'house' in asset else None) is not None:
            cursor += width + _rng.choice((2.0, 3.0, 4.5))
        else: cursor += 5.0
for side, lo, hi, skip in (('N', -146, 146, None), ('S', -146, 146, None), ('W', -100, 100, None), ('E', -100, 100, (66, 82))):
    side_row(side, lo, hi, skip)
# trees and lamps along the outer kerb walk, parked cars on the carriageway edge, a tree screen along the bounds
for t in range(-100, 101, 12):
    for sx in (-1, 1):
        if sx > 0 and 64 < t < 84: continue
        put('prop.street-tree' if (t // 12) % 2 else 'prop.street-tree-blossom', sx * 126.6, t + 3 * sx, 0, .8, margin=.2, shrink=2.2)
for t in range(-120, 121, 12):
    for sz in (-1, 1): put('prop.street-tree' if (t // 12) % 2 else 'prop.street-tree-blossom', t, sz * 96.6, 0, .8, margin=.2, shrink=2.2)
for t in range(-92, 93, 24):
    for sx in (-1, 1):
        if sx > 0 and 66 < t < 82: continue
        l.place('prop.street-lamp', [sx * 126.0, 0, t + 6]); l.place('prop.street-lamp', [sx * 117.8, 0, t + 6 + 12])
for t in range(-116, 117, 24):
    for sz in (-1, 1): l.place('prop.street-lamp', [t + 6, 0, sz * 96.0]); l.place('prop.street-lamp', [t + 18, 0, sz * 87.8])
for k in range(34):
    side = _rng.choice(('N', 'S', 'E', 'W')); t = _rng.uniform(-92, 92)
    asset = _rng.choice(CARS); yaw = _rng.choice((-1, 1)) * math.pi / 2 + _rng.uniform(-.06, .06)
    if side in ('E', 'W'):
        x = (120.0 if _rng.random() < .5 else 123.4) * (1 if side == 'E' else -1)
        if side == 'E' and 66 < t < 82: continue
        put(asset, x, t, yaw, 1.0, margin=.4)
    else:
        z = (89.9 if _rng.random() < .5 else 93.5) * (1 if side == 'S' else -1)
        put(asset, t * 1.25, z, yaw + math.pi / 2, 1.0, margin=.4)
for t in range(-116, 117, 5):
    for z in (-117.6, 117.6): put('prop.tree' if (t // 5) % 2 else 'prop.street-tree', t + _rng.uniform(-1, 1), z, 0, .75, margin=0, shrink=2.4)
for t in range(-92, 93, 5):
    for x in (-147.6, 147.6):
        if x > 0 and 62 < t < 86: continue
        put('prop.tree' if (t // 5) % 2 else 'prop.street-tree', x, t + _rng.uniform(-1, 1), 0, .75, margin=0, shrink=2.4)
# spur flanks, roadblock and lamps
for x in (131.0, 138.0, 144.0):
    l.place('prop.street-lamp', [x, 0, 69.6]); l.place('prop.street-lamp', [x, 0, 78.4])
for k, z in enumerate((71.6, 74.0, 76.4)):
    put('prop.jersey-barrier', 142.6, z, math.pi / 2, 1.0)
for z in (71.4, 74.6):
    put('prop.jersey-barrier', 144.2, z + .8, math.pi / 2, 1.0)
put('veh.military-truck', 145.6, 72.2, math.pi / 2 + .12); put('veh.wreck', 144.8, 76.4, 1.2); put('veh.sedan-white', 139.4, 71.8, -math.pi / 2 + .1)
for z in (70.2, 77.8): put('prop.sandbag-pallet', 143.4, z, 0.0)
put('prop.light-tower-trailer', 141.6, 69.4, math.pi / 2); put('prop.barricade', 140.0, 75.8, math.pi / 2); put('prop.emergency-light', 140.6, 72.4, 0.0)
put('prop.emergency-light', 143.0, 77.8, 0.0); put('prop.street-sign', 138.4, 78.6, math.pi)
for z in (69.8, 78.0, 66.6, 81.4): put('prop.street-tree', 147.6, z, 0, .75, margin=0, shrink=2.4)

# the first thing the camera meets beyond the wall: a canopy of street trees and tall utility poles on the inner kerb walk (they rise above the 4 m wall)
for t in range(-84, 85, 10):
    for sx in (-1, 1):
        if sx > 0 and 62 < t < 86: continue
        put('prop.street-tree' if (t // 10) % 2 else 'prop.street-tree-blossom', sx * 118.0, t, 0, .9, margin=.1, shrink=2.4)
for t in range(-112, 113, 10):
    for sz in (-1, 1): put('prop.street-tree' if (t // 10) % 2 else 'prop.street-tree-blossom', t + 5, sz * 87.8, 0, .9, margin=.1, shrink=2.4)
for t in range(-80, 81, 40):
    for sx in (-1, 1):
        if sx > 0 and 62 < t < 86: continue
        put('prop.utility-pole', sx * 117.6, t + 5, 0, 1.0, margin=.1)
for t in range(-100, 101, 40): put('prop.utility-pole', t + 7, 87.6, math.pi / 2, 1.0, margin=.1); put('prop.utility-pole', t + 7, -87.6, math.pi / 2, 1.0, margin=.1)

l.export()
