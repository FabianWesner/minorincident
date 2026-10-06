"""L1-only, authored diorama dressing. Solid handmade props export explicit colliders.
No mission anchors move. Mesh detail is merged by palette; existing props use instances.
"""
import bpy
import math
import random
from sslib.layout import material


def collider(l, name, size, pos):
    l.data['colliders'].append(dict(id='dressing:'+name+':'+str(len(l.data['colliders'])),
        aabb=dict(min=[pos[i]-size[i]/2 for i in range(3)], max=[pos[i]+size[i]/2 for i in range(3)]), minTier=0, maxTier=5))


def solid(l, name, token, size, pos):
    o = l.box(name, token, size, pos)
    collider(l,name,size,pos)
    return o


def sphere(l, name, token, radius, pos, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=(pos[0], -pos[2], pos[1]))
    o=bpy.context.object; o.name=name; o.scale=(scale[0],scale[2],scale[1]); o.data.materials.append(material(token)); l.layers[0].append(o)
    return o


def ring(l, name, token, radius, thickness, pos, vertical=False):
    bpy.ops.mesh.primitive_torus_add(major_segments=20, minor_segments=6, major_radius=radius, minor_radius=thickness, location=(pos[0], -pos[2], pos[1]))
    o=bpy.context.object; o.name=name
    if vertical: o.rotation_euler.x=math.pi/2
    o.data.materials.append(material(token)); l.layers[0].append(o)


def flower(l,x,y,z,scale=(1,1,1),yaw=0):
    # A tiny daisy (44 triangles), built directly so mass dressing stays cheap to author.
    height=.34*scale[1];radius=.18*scale[0]
    l.data.setdefault('decorations',[]).append(dict(kind='flower',position=[x,y,z]))
    vertices=[];faces=[];indices=[]
    def cube(cx,cy,cz,hx,hy,hz,slot):
        n=len(vertices)
        vertices.extend([(cx+dx*hx,-(cz+dz*hz),cy+dy*hy) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
        faces.extend([tuple(n+v for v in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]])
        indices.extend([slot]*6)
    cube(x,y+height/2,z,.012,height/2,.012,0)
    for k in range(5):
        a=k*math.tau/5+yaw;dx=math.cos(a);dz=math.sin(a);px=-dz;pz=dx;n=len(vertices)
        vertices += [(x,-z,y+height),(x+dx*radius*.6+px*radius*.4,-(z+dz*radius*.6+pz*radius*.4),y+height+.025),(x+dx*radius,-(z+dz*radius),y+height+.05),(x+dx*radius*.6-px*radius*.4,-(z+dz*radius*.6-pz*radius*.4),y+height+.025)]
        faces += [(n,n+1,n+2),(n,n+2,n+3),(n+2,n+1,n),(n+3,n+2,n)]
        indices += [1]*4
    cube(x,y+height+.045,z,radius*.25,.022,radius*.25,2)
    mesh=bpy.data.meshes.new('daisy');mesh.from_pydata(vertices,[],faces)
    for token in ['foliage','picketWhite' if int(abs(x*3+z))%3 else 'cardiganRose','schoolBusYellow']:mesh.materials.append(material(token))
    for face,index in zip(mesh.polygons,indices):face.material_index=index
    o=bpy.data.objects.new('flower-cluster',mesh);bpy.context.collection.objects.link(o);l.layers[0].append(o)
    return 'flower'


def prepare(l, residential=False):
    # Intercept all new flower placements, including the entrance beds in building().
    original_place=l.place
    def place(asset,pos,yaw=0,tier=0,allowed=False,scale=(1,1,1)):
        if asset=='prop.flower':return flower(l,*pos,scale,yaw)
        if asset=='prop.tree':
            asset='prop.street-tree' if sum(p['assetId'].startswith('prop.street-tree') for p in l.data['placements'])%2==0 else 'prop.street-tree-blossom'
        return original_place(asset,pos,yaw,tier,allowed,scale)
    l.place=place
    removed={p['id'] for p in l.data['placements'] if p['assetId']=='prop.tree'}
    l.data['placements']=[p for p in l.data['placements'] if p['id'] not in removed]
    l.data['colliders']=[c for c in l.data['colliders'] if c['id'] not in removed]
    for o in list(l.empties):
        if o.get('assetId')=='prop.tree' or any(o.name.startswith('crown:'+id+':') for id in removed):
            l.empties.remove(o);bpy.data.objects.remove(o,do_unlink=True)
    # Replace just the L1 roads. Their centre lines, connectivity and all anchors stay fixed.
    for o in list(l.layers[0]):
        if o.name.startswith(('road-', 'curb', 'lane-mark', 'crosswalk', 'collapse-canopy')):
            l.layers[0].remove(o); bpy.data.objects.remove(o, do_unlink=True)
    # Keep the removable canopy contract used by later decay tiers.
    l.box('collapse-canopy', 'schoolBusYellow', [5,.2,2], [14,3,-8])
    l.data['surfaces']=[s for s in l.data['surfaces'] if s['surface'] not in ['asphalt','tile']]
    axes=[0] if residential else [0,2]
    for axis in axes:
        size=[5,.08,5]; size[axis]=56
        l.box('road-'+str(axis),'asphalt',size,[0,.01,0])
        for side in [-3.15,3.15]:
            # Sidewalks end at the intersection, rather than laying strips across its road.
            for center,length in [(0,56)] if residential else [(-16,24),(16,24)]:
                sz=[1.3,.18,1.3]; sz[axis]=length
                p=[0,.04,0]; p[axis]=center; p[2-axis]=side; l.box('curb-pavers','sidewalk',sz,p)
                # Pale kerb top and a darker gutter give the road a readable raised edge.
                edge=[.13,.13,.13]; edge[axis]=length
                p[2-axis]=math.copysign(2.54,side); p[1]=.035; l.box('curb-lip','picketWhite',edge,p)
                gutter=[.18,.015,.18]; gutter[axis]=length
                p[2-axis]=math.copysign(2.35,side); p[1]=.057; l.box('gutter','denim',gutter,p)
        for v in range(-25,26,4):
            if not residential and abs(v)<6: continue
            p=[0,.065,0];p[axis]=v;sz=[.12,.014,.12];sz[axis]=1.5;l.box('lane-mark','picketWhite',sz,p)
        for v in [-5,5] if not residential else [23]:
            for k in range(-2,3):
                p=[0,.066,0];p[axis]=v;p[2-axis]=k*.85;sz=[.5,.014,.5];sz[axis]=1.05;l.box('crosswalk','picketWhite',sz,p)
        poly=[[-28,-2.5],[28,-2.5],[28,2.5],[-28,2.5],[-28,-2.5]]
        if axis==2: poly=[[z,x] for x,z in poly]
        l.data['surfaces'].append(dict(surface='asphalt',polygon=poly))
        for side in [-1,1]:
            lo=[-27,side*3.85];hi=[27,side*6.5]
            if lo[1]>hi[1]:lo[1],hi[1]=hi[1],lo[1]
            if axis==2:lo=lo[::-1];hi=hi[::-1]
            l.data['lawns'].append(dict(min=lo,max=hi))
    for e in l.data['roads']['edges']:e['laneWidth']=5
    if residential:
        l.data['roads']=dict(nodes=[dict(id='west',point=[-20,0]),dict(id='east',point=[28,0])],edges=[dict(id='crescent',start='west',end='east',points=[[-20,0],[28,0]],laneWidth=5)])
        l.box('turnaround','asphalt',[8,.08,8],[-20,.01,0])
    # Covers/rain grates are low, merged meshes rather than dozens of extra draw calls.
    for x in [-18,6,20]:
        sphere(l,'manhole-cover','denim',.43,[x,.062,.8],(1,.04,1))
        ring(l,'manhole-rim','uiDark',.4,.028,[x,.068,.8])
        for dx in [-.2,0,.2]:l.box('manhole-grid','uiDark',[.035,.012,.55],[x+dx,.087,.8])
    for x in range(-24,25,8):
        for side in [-1,1]:
            l.box('drain','uiDark',[.65,.012,.27],[x,.063,side*2.28])
            for k in range(5):l.box('drain-bars','denim',[.035,.015,.25],[x-.25+k*.12,.075,side*2.28])


def planter(l,x,z):
    solid(l,'planter','woodWarm',[1.2,.34,.6],[x,.18,z])
    l.box('planter-soil','hairChestnut',[1.08,.035,.48],[x,.37,z])
    for dx in [-.4,0,.4]:l.place('prop.flower',[x+dx,.38,z],scale=(1,1,1.3))
    for dx in [-.48,.48]:l.box('planter-post','picketWhite',[.06,.4,.065],[x+dx,.23,z+.3])


def bench(l,x,z):
    # Reuse the accepted, bevelled side-tier park bench (its long axis is local Z).
    l.place('prop.bench',[x,0,z],yaw=math.pi/2,scale=(.9,.9,.9))


def bin(l,x,z):
    l.place('prop.trash-bin',[x,0,z],yaw=math.pi/2,scale=(.55,.65,.55))
    sphere(l,'trash-bag','uiDark',.23,[x+.65,.2,z],(1,.8,1))
    collider(l,'trash-bag',[.46,.37,.46],[x+.65,.2,z])
    l.box('bag-tie','sidewalk',[.08,.11,.08],[x+.65,.42,z])


def garden(l,x,z,variant):
    # Colour accents beside the sidewalk, with a full clear path to each house door.
    planter(l,x,z)
    if variant%3==0:
        sphere(l,'gnome-coat','backpackTeal',.18,[x+1,.19,z])
        sphere(l,'gnome-head','skinWarm',.13,[x+1,.44,z])
        bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.17,depth=.36,location=(x+1,-z,.67))
        o=bpy.context.object;o.name='gnome-hat';o.data.materials.append(material('survivorRed'));l.layers[0].append(o)
        collider(l,'gnome',[.36,.85,.36],[x+1,.425,z])
    elif variant%3==1:
        sphere(l,'toy-ball','survivorRed',.16,[x+1,.17,z+.1]);ring(l,'garden-hose','backpackTeal',.42,.035,[x+1,.08,z-.4]);ring(l,'garden-hose','tealDark',.3,.035,[x+1,.08,z-.4])
    else:bin(l,x+1,z)


def dress(l,residential=False):
    rng=random.Random(14)
    # Nine-metre canopy cadence with lamps between crowns. Entrances and the
    # porch's existing hedge detour take precedence over the planting rhythm.
    for i,base_x in enumerate(range(-23,27,9)):
        x=base_x+2.2
        for side in [-1,1]:
            if not residential and abs(x)<6:continue
            tx=-22 if residential and i==0 and side<0 else x
            if not residential and side<0 and abs(tx+14)<3.5: tx=-9
            l.place('prop.street-tree' if (i+side)%2 else 'prop.street-tree-blossom',[tx,0,side*5.9])
            lx,lz=x+4.5,side*5.2
            if i<5 and (residential or abs(lx)>6) and not any(abs(lx-a['position'][0])<2.5 and abs(lz-a['position'][2])<2.6 for a in l.data['anchors'].values() if a['position'][1]==0):
                l.place('prop.street-lamp',[lx,0,lz])
    for b in l.data['buildings']:
        p=next(p for p in l.data['placements'] if p['id']==b['id']);x=p['position'][0];front=b['aabb']['max'][2]
        for side in [-1,1]:
            l.place('prop.garden-bush',[x+side*3.8,0,front+2.2])
            if front<0: l.place('prop.garden-bush',[x+side*4.5,0,max(front+3.7,-4.4)],scale=(1.25,1.25,1.25))
    if residential:
        l.place('prop.street-tree',[-21,0,-13.5])
    else:
        for x,z in [(-5.8,-5.8),(5.8,5.8),(-5.8,5.8),(5.8,-5.8)]:
            l.place('prop.street-tree' if x*z>0 else 'prop.street-tree-blossom',[x,0,z])
        for x,z in [(-21,-6.7),(-8,-7.4),(-21,7), (9,-6.7)]:
            l.place('prop.street-tree-blossom' if x<0 else 'prop.street-tree',[x,0,z])
        if l.data['district']=='D-MAIN':
            l.place('prop.street-tree',[-21,0,-13.5])
    leaf_vertices=[];leaf_faces=[];leaf_colors=[]
    # Staggered compositions along the entire route, including district joins.
    for i,x in enumerate(range(-24,28,6)):
        for side in [-1,1]:
            z=side*4.6
            # Cross district sidewalks must stay clear at the junction.
            if not residential and abs(x)<5:continue
            if (i+side)%3==0:bench(l,x,z)
            else:garden(l,x,z,i+side)
            for j in range(8):
                px=x-2+rng.random()*4;pz=side*(3.85+rng.random()*2.2)
                l.place('prop.flower',[px,0,pz],yaw=rng.random()*math.pi,scale=(.45,.6,.8))
            for j in range(12):
                px=x-2.5+rng.random()*5;pz=side*(2.9+rng.random()*3)
                # Two triangles per leaf: bevelled boxes cost more than the visible silhouette.
                a=rng.random()*math.pi;n=len(leaf_vertices);height=.14 if abs(pz)<3.8 else .018
                for dx,dz in [(-.045,0),(0,-.08),(.045,0),(0,.08)]:
                    leaf_vertices.append((px+dx*math.cos(a)-dz*math.sin(a),-pz+dx*math.sin(a)+dz*math.cos(a),height))
                leaf_faces.append((n,n+1,n+2,n+3));leaf_colors.append(0 if j%3 else 1)
    mesh=bpy.data.meshes.new('leaf-litter');mesh.from_pydata(leaf_vertices,[],leaf_faces)
    for token in ['woodWarm','schoolBusYellow']:mesh.materials.append(material(token))
    for face,index in zip(mesh.polygons,leaf_colors):face.material_index=index
    o=bpy.data.objects.new('leaf-litter',mesh);bpy.context.collection.objects.link(o);l.layers[0].append(o)
    if not residential:
        for z in [-22,-15,13,21]:
            for side in [-1,1]:
                planter(l,side*4.6,z)
                for j in range(7):l.place('prop.flower',[side*4.6,0,z-1+j*.32],scale=(.5,.6,1))
    if not residential:
        for x,z in [(-3.8,-3.8),(3.8,3.8)]:
            l.place('prop.fire-hydrant',[x,0,z],scale=(.8,.8,.8))
            for j in range(10):flower(l,x+.55+math.sin(j*2.1)*.5,0,z+math.cos(j*2.1)*.5)
        for x,z in [(3.8,-3.8),(-3.8,3.8)]:
            l.place('prop.street-sign',[x,0,z],yaw=math.pi/2,scale=(.8,.8,.8))
            planter(l,x+math.copysign(.7,x),z)
        # A cart returned beside the storefront and a bright vending machine, outside door paths.
        l.place('prop.shopping-cart',[10,0,-8.2],yaw=.3,scale=(.8,.8,.8))
        l.place('prop.vending-machine',[-18.5,0,-7.8],yaw=math.pi/2,scale=(.65,.65,.65))
    else:
        for x in [-18,5,23]:l.place('prop.folding-chair',[x,0,-6.3],yaw=.4,scale=(.75,.75,.75))
    # Entrance gardens fill the space near the close diner/store/pharmacy cameras.
    for b in l.data['buildings']:
        p=next(p for p in l.data['placements'] if p['id']==b['id']);x=p['position'][0];front=b['aabb']['max'][2]
        for side in [-1,1]:
            planter(l,x+side*3,front+1.3)
            if not residential:bench(l,x+side*4.5,front+1.4)
        # Driveway / entrance path is a walkable surface, never a new blocker.
        l.box('driveway','sidewalk',[1.8,.08,max(.5,abs(front)-3.8)],[x,.02,(front-3.8)/2 if front<0 else (front+3.8)/2])
