"""Sunset Grove rail crossing. +X road-forward, metres, ground Z=0.
Run with experiment/tools/blender_run.py; no textures or external assets.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector, Euler

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, export, ao, colliders
P = argparse.ArgumentParser()
P.add_argument('--render'); P.add_argument('--glb'); P.add_argument('--view', default='ref')
P.add_argument('--samples', type=int, default=24)
P.add_argument('--width', type=int, default=960); P.add_argument('--height', type=int, default=540)
a = P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(26)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
root['asset_id'] = 'kit.rail-crossing'; root['category'] = 'building'
M = {t:palette.mat(t) for t in ['asphalt','sidewalk','woodWarm','picketWhite','uiDark','silver','survivorRed','schoolBusYellow','grass','foliage','khaki','leatherShadow']}
M['glow'] = palette.mat('sirenRed', True)
M['glowCore'] = palette.mat('windowGlow', True)
for t,m in M.items():
    bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Roughness'].default_value = .64
    if t=='silver': bs.inputs['Metallic'].default_value=.18; bs.inputs['Roughness'].default_value=.32
    if t=='glow': bs.inputs['Emission Strength'].default_value=1.1
    if t=='glowCore': bs.inputs['Emission Strength'].default_value=3

def empty(name, loc=(0,0,0), parent=root):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; o.location=loc; return o

def finish(o,name,t,bevel=0,parent=root):
    o.name=name; o.data.materials.append(M[t]); o.parent=parent
    bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('soft bevel','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,size,t,bevel=.015,parent=root):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,t,bevel,parent)

def cyl(name,loc,r,depth,t,axis='Z',parent=root,n=16,bevel=.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=depth, location=loc)
    o=finish(bpy.context.object,name,t,bevel if r>=.06 else 0,parent)
    if axis=='X': o.rotation_euler[1]=math.pi/2
    if axis=='Y': o.rotation_euler[0]=math.pi/2
    return o

def mesh(name,v,f,t,parent=root):
    d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update()
    o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); return finish(o,name,t,parent=parent)

def bake_soft_ao(objects,samples):
    ao.bake_all(objects,samples=samples)
    for o in objects:
        for c in o.data.color_attributes['ao'].data:
            c.color=(.4+.6*c.color[0],.4+.6*c.color[1],.4+.6*c.color[2],1)

def pebble(x,y,z,size,t):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z))
    o=bpy.context.object; o.scale=size; o.rotation_euler=(rng.random(),rng.random(),rng.random()*6)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'ballast',t)

# Continuous railway: exposed dark sleepers and gray ballast extend ~3 m
# beyond each road edge. The timber crossing deck stops at flange channels.
box('earth foundation',(0,0,.12),(7.4,7.1,.24),'woodWarm',.06)
for y in [-4.475,4.475]:
    box('track earth extension',(0,y,.12),(2.95,1.85,.24),'woodWarm',.04)
box('gravel ballast bed',(0,0,.285),(2.8,10.65,.13),'sidewalk',.035)
for j in range(24):
    y=-5.12+j*10.24/23
    box('timber sleeper',(0,y,.37),(2.5,.24,.16),'leatherShadow',.02)
    if abs(y)>2.15:
        box('sleeper timber top',(0,y,.453),(2.46,.20,.015),'woodWarm',.006)
        for x in [-.78,.78]:
            box('rail chair',(x,y,.465),(.32,.28,.04),'uiDark',.006)
            for dx in [-.12,.12]: cyl('chair bolt',(x+dx,y,.50),.024,.027,'silver',n=8)
for x in [-.78,.78]:
    box('rail foot',(x,0,.486),(.23,10.66,.06),'silver',.009)
    box('rail vertical web',(x,0,.535),(.085,10.66,.08),'uiDark',.007)
    box('polished steel rail head',(x,0,.592),(.17,10.68,.07),'silver',.012)
    inner=x-math.copysign(.16,x)
    box('dark wheel flange channel',(inner,0,.503),(.13,4.35,.045),'uiDark',.005)
# Asphalt approaches meet a separate wooden road deck across the rail bed.
for lo,hi in [(-3.7,-1.32),(1.32,3.7)]:
    count=3; step=(hi-lo)/count
    for i in range(count):
        for j in range(4):
            box('pavement slab',(lo+(i+.5)*step,-1.575+j*1.05,.39),(step-.012,1.037,.29),'asphalt',.018)
for lo,hi in [(-1.30,-.93),(-.65,.65),(.93,1.30)]:
    for j in range(12):
        box('crossing deck plank',((lo+hi)/2,-1.925+j*.35,.511),(hi-lo,.337,.075),'woodWarm',.008)
for y in [-2.025,2.025]:
    for i in range(8):
        x=-3.25+i*.93
        box('white road edge',(x,y,.566),(.917,.19,.024),'picketWhite',.004)
        cyl('reflector stud',(x,y,.584),.023,.014,'silver',n=8)
for lo,hi in [(-3.7,-.93),(-.65,.65),(.93,3.7)]:
    box('yellow center line',((lo+hi)/2,0,.566),(hi-lo-.025,.11,.021),'schoolBusYellow',.004)
# Gravel is concentrated between exposed sleepers and along the ballast shoulders.
for j in range(150):
    y=rng.choice([-1,1])*rng.uniform(2.22,5.23)
    x=rng.uniform(-1.36,1.36)
    # Keep rail heads and timber tops clear of aggregate.
    if min(abs(x-.78),abs(x+.78))<.13: continue
    nearest=min(abs(y-(-5.12+k*10.24/23)) for k in range(24))
    if abs(x)<1.24 and nearest<.145: continue
    r=rng.uniform(.07,.14)
    pebble(x,y,.36,(r,r*.8,r*.6),'sidewalk' if j%3 else 'silver')
for j in range(110):
    x=rng.uniform(-3.55,3.55); y=rng.uniform(-3.4,3.4)
    if abs(y)<2.2 or abs(x)<1.45: continue
    r=rng.uniform(.035,.095)
    pebble(x,y,.25,(r,r*.8,r*.65),'khaki')
for x,y,sz in [(2.9,-2.9,.30),(-2.8,3.0,.23),(-1.8,-3.15,.20),(3.25,2.9,.18)]:
    pebble(x,y,.28,(sz,sz*.8,sz*.8),'sidewalk')
for j in range(55):
    x=rng.uniform(-3.45,3.45); y=rng.choice([-1,1])*rng.uniform(2.3,3.35)
    if abs(x)<1.45: continue
    for k in range(7):
        ang=k*2.4; h=rng.uniform(.18,.46); dx=math.cos(ang); dy=math.sin(ang)
        v=[(x-dy*.025,y+dx*.025,.25),(x+dy*.025,y-dx*.025,.25),(x+dx*.10,y+dy*.10,.25+h*.65),(x+dx*.20,y+dy*.20,.25+h*.85)]
        mesh('grass blade',v,[(0,1,2),(1,3,2)],'grass' if k%2 else 'foliage')

# Two roadside gate mechanisms, paired signal heads and raised crossbuck lettering.
protected=['gateL','gateR','signalL','signalR','beaconL','beaconR']
for side,y in [('L',-2.63),('R',2.63)]:
    x=-1.65; inward=1 if y<0 else -1
    box('concrete plinth',(x,y,.40),(.85,.80,.34),'sidewalk',.05)
    box('cast pedestal',(x,y,.71),(.43,.43,.36),'uiDark',.035)
    for yy in [-.21,.21]: box('pedestal rib',(x,y+yy,.78),(.50,.075,.40),'silver',.015)
    cyl('mast',(x,y,2.03),.104,2.9,'silver',n=20)
    cyl('base collar',(x,y,1.0),.155,.10,'silver')
    box('motor cabinet',(x,y,1.20),(.51,.47,.70),'picketWhite',.04)
    box('cabinet door',(x+.274,y,1.19),(.045,.36,.59),'sidewalk',.018)
    for yy in [-.13,.13]:
        for z in [.96,1.43]: cyl('cabinet screw',(x+.306,y+yy,z),.021,.016,'silver','X',n=8)
    cyl('key escutcheon',(x+.31,y,1.25),.047,.022,'silver','X')
    box('service handle',(x+.331,y,1.15),(.025,.025,.12),'uiDark',.008)
    pivot=empty('gate'+side,(x,y+inward*.32,1.63))
    pivot['animation_axis']='X'; pivot['closed_angle']=0; pivot['open_angle']=inward*math.pi/2
    cyl('hinge boss',(0,0,0),.16,.28,'uiDark','X',pivot)
    cyl('hinge cap',(.17,0,0),.10,.06,'silver','X',pivot)
    length=2.24
    box('barrier arm',(0,inward*length/2,0),(.17,length,.19),'picketWhite',.025,pivot)
    # Red diagonal bands are closed thin solids 6 mm proud on both long faces.
    for k in range(4):
        u=.20+k*.53
        for xx in [-.094,.094]:
            v=[(xx,inward*u,-.086),(xx,inward*(u+.29),-.086),(xx,inward*(u+.46),.086),(xx,inward*(u+.17),.086)]
            v += [(px+math.copysign(.008,xx),py,pz) for px,py,pz in v]
            mesh('red diagonal band',v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'survivorRed',pivot)
    for u in [.55,1.72]:
        cyl('arm marker base',(0,inward*u,.111),.055,.025,'uiDark',parent=pivot,n=12)
        o=cyl('arm marker',(0,inward*u,.153),.038,.062,'glow',parent=pivot,n=12); o['decorativeEmissive']=True
    box('arm end cap',(0,inward*length,0),(.19,.06,.21),'survivorRed',.02,pivot)
    box('signal mounting bar',(x,y,2.39),(.19,.83,.16),'uiDark',.02)
    sig=empty('signal'+side)
    for yy in [y-.29,y+.29]:
        cyl('signal rear housing',(x+.05,yy,2.40),.234,.27,'uiDark','X')
        cyl('bronze signal rim',(x+.20,yy,2.40),.238,.042,'leatherShadow','X')
        cyl('red lens',(x+.290,yy,2.40),.176,.046,'glow','X',sig,n=24)
        cyl('lens central highlight',(x+.318,yy,2.40),.055,.012,'glowCore','X',sig,n=12)
        # Open curved visors, rather than closed cylinders hiding the lamps.
        v=[]; n=16
        for xx in [x+.22,x+.34]:
            for i in range(n+1):
                th=math.pi*i/n
                v.append((xx,yy+.243*math.cos(th),2.40+.243*math.sin(th)))
        o=mesh('signal visor',v,[(i,i+1,n+2+i,n+1+i) for i in range(n)],'uiDark')
        mod=o.modifiers.new('visor thickness','SOLIDIFY'); mod.thickness=.018
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    # Crossbuck in YZ plane. Text has a full 7 mm gap over each sign face.
    for angle,words,xx in [(math.pi/4,'RAIL ROAD',x+.14),(-math.pi/4,'CROSSING',x+.21)]:
        board=box('crossbuck board',(xx,y,3.08),(.065,1.57,.245),'picketWhite',.022)
        board.rotation_euler[0]=angle
        bpy.ops.object.text_add(location=(xx+.044,y,3.08)); o=bpy.context.object
        o.data.body=words; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=.185
        o.data.space_character=1.12; o.data.extrude=.002; o.data.resolution_u=2
        # Rotate text about its normal (+X) to match board slope.
        o.rotation_euler=(Euler((angle,0,0)).to_matrix() @ Euler((math.pi/2,0,math.pi/2)).to_matrix()).to_euler()
        bpy.context.view_layer.objects.active=o; bpy.ops.object.convert(target='MESH'); finish(bpy.context.object,'raised crossing lettering','uiDark')
    cyl('mast cap collar',(x,y,3.51),.136,.115,'picketWhite')
    beacon=empty('beacon'+side,(x,y,3.64))
    cyl('red mast beacon',(0,0,0),.111,.145,'glow',parent=beacon)
    cyl('beacon top',(x,y,3.725),.108,.025,'survivorRed')
    for name,owner,loc in [('signal',sig,(x+.28,y,2.40)),('beacon',beacon,(0,0,0))]:
        e=empty('light:'+name+side,loc,root if name=='signal' else beacon)
        e['ss_light']={'type':'beacon','color':'light_siren_red','intensity':3,'range':3,'pool':False,'flare':True,'shadow':'none','animation':{'strobe':'rail-crossing'},'powerGroup':'self','emissiveNodes':[],'tiers':'all'}
colliders.cuboid('foundation',(7.4,7.1,.55),(0,0,.275),root)
for y in [-4.475,4.475]: colliders.cuboid('track'+str(y),(2.95,1.85,.45),(0,y,.225),root)
for side,y in [('L',-2.63),('R',2.63)]: colliders.cuboid('pedestal'+side,(.85,.8,1.7),(-1.65,y,.85),root)
export.merge_by_material(root, protected)
bpy.context.view_layer.update()
for side in ['L','R']:
    for name in ['signal','beacon']:
        bpy.data.objects['light:'+name+side]['ss_light']['emissiveNodes']=[o.name for o in bpy.data.objects[name+side].children if o.type=='MESH']
meshes=[o for o in root.children_recursive if o.type=='MESH']
for o in meshes:
    if o.parent.name in ['gateL','gateR'] and o.data.materials[0].name.startswith('emi_'):
        o['decorativeEmissive']=True
for o in meshes: o.data.calc_loop_triangles()
triangle_count=sum(len(o.data.loop_triangles) for o in meshes)
if triangle_count>19000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('budget reduction','DECIMATE'); mod.ratio=19000/triangle_count
        bpy.ops.object.modifier_apply(modifier=mod.name)
# AO vertex data is baked once for the actual export geometry.
if a.glb:
    bake_soft_ao(meshes,16)
    export.glb(root,a.glb)
    stats=lambda: sum(len(o.data.loop_triangles) for o in meshes)
    for o in meshes: o.data.calc_loop_triangles()
    counts={'lod0':stats()}
    # Author coarse LOD assemblies: decimating disconnected thin slabs makes holes.
    originals=[(o.name,o.parent,o.matrix_local.copy(),o.data.copy(),dict(o.items())) for o in meshes]
    def clear_meshes():
        for o in list(root.children_recursive):
            if o.type=='MESH': bpy.data.objects.remove(o,do_unlink=True)
        bpy.context.view_layer.update()
    for label in ['lod1','lod2']:
        clear_meshes()
        detailed=label=='lod1'
        edge=.015 if detailed else 0
        box('earth',(0,0,.12),(7.4,7.1,.24),'woodWarm',0)
        for y in [-4.475,4.475]: box('track extension',(0,y,.12),(2.95,1.85,.24),'woodWarm',0)
        box('ballast bed',(0,0,.285),(2.8,10.65,.13),'sidewalk',0)
        for lo,hi in [(-3.7,-1.32),(1.32,3.7)]:
            box('road',((lo+hi)/2,0,.39),(hi-lo,4.3,.29),'asphalt',edge)
        for lo,hi in [(-1.30,-.93),(-.65,.65),(.93,1.30)]:
            box('timber road deck',((lo+hi)/2,0,.511),(hi-lo,4.2,.075),'woodWarm',edge)
        for lo,hi in [(-3.7,-.93),(-.65,.65),(.93,3.7)]:
            box('centerline',((lo+hi)/2,0,.566),(hi-lo-.025,.11,.02),'schoolBusYellow',0)
        for y in [-2.025,2.025]: box('edge marking',(0,y,.566),(7.4,.19,.02),'picketWhite',0)
        for x in [-.78,.78]: box('steel rail',(x,0,.585),(.17,10.68,.085),'silver',edge)
        nt=24 if detailed else 9
        for j in range(nt):
            box('tie',(0,-5.12+j*10.24/(nt-1),.37),(2.5,.24,.16),'leatherShadow',edge)
        for side,y in [('L',-2.63),('R',2.63)]:
            x=-1.65; inward=1 if y<0 else -1
            box('plinth',(x,y,.40),(.85,.80,.34),'sidewalk',edge)
            box('cabinet',(x,y,1.08),(.51,.47,.88),'picketWhite',edge)
            cyl('mast',(x,y,2.08),.104,2.84,'silver',n=12 if detailed else 6,bevel=0)
            gate=bpy.data.objects['gate'+side]
            box('arm',(0,inward*1.12,0),(.17,2.24,.19),'picketWhite',edge,gate)
            for k in range(4 if detailed else 2):
                u=.20+k*(.53 if detailed else 1.0)
                for xx in [-.094,.094]:
                    mesh('stripe',[(xx,inward*u,-.086),(xx,inward*(u+.29),-.086),(xx,inward*(u+.46),.086),(xx,inward*(u+.17),.086)],[(0,1,2,3) if xx*inward>0 else (3,2,1,0)],'survivorRed',gate)
            sig=bpy.data.objects['signal'+side]
            for yy in [y-.29,y+.29]:
                cyl('signal hood',(x+.13,yy,2.4),.234,.27,'uiDark',axis='X',n=8 if detailed else 6,bevel=0)
                n=12 if detailed else 6
                verts=[(x+.29,yy,2.4)]+[(x+.29,yy+.176*math.cos(i*2*math.pi/n),2.4+.176*math.sin(i*2*math.pi/n)) for i in range(n)]
                mesh('red signal',verts,[(0,1+i,1+(i+1)%n) for i in range(n)],'glow',sig)
            for angle,xx in [(math.pi/4,x+.14),(-math.pi/4,x+.21)]:
                o=box('crossbuck',(xx,y,3.08),(.065,1.57,.245),'picketWhite',edge); o.rotation_euler[0]=angle
            cyl('beacon',(0,0,0),.111,.145,'glow',n=8 if detailed else 6,parent=bpy.data.objects['beacon'+side],bevel=0)
        if detailed:
            for j in range(16):
                x=rng.uniform(-1.35,1.35); y=rng.choice([-1,1])*rng.uniform(2.35,5.2)
                pebble(x,y,.36,(.12,.10,.065),'sidewalk')
        export.merge_by_material(root,protected); bpy.context.view_layer.update()
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        for side in ['L','R']:
            for name in ['signal','beacon']:
                bpy.data.objects['light:'+name+side]['ss_light']['emissiveNodes']=[o.name for o in bpy.data.objects[name+side].children if o.type=='MESH']
        bake_soft_ao(meshes,8)
        for o in meshes: o.data.calc_loop_triangles()
        counts[label]=stats()
        export.glb(root,Path(a.glb).with_name('model.'+label+'.glb'))
    clear_meshes()
    for name,parent,matrix,data,extras in originals:
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.parent=parent; o.matrix_local=matrix
        for key,value in extras.items(): o[key]=value
    bpy.context.view_layer.update()
    meshes=[o for o in root.children_recursive if o.type=='MESH']
    for side in ['L','R']:
        for name in ['signal','beacon']:
            bpy.data.objects['light:'+name+side]['ss_light']['emissiveNodes']=[o.name for o in bpy.data.objects[name+side].children if o.type=='MESH']
    (HERE/'geometry-stats.json').write_text(json.dumps({'triangles':counts,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in bpy.data.objects for n in ['root']+protected)},indent=2))
    print('OK exports',counts)
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
    scene.cycles.use_denoising=True; scene.world.color=(.16,.16,.16)
    box('studio ground',(0,0,-.10),(200,200,.15),'uiDark',0,parent=None)
    def area(name,loc,power,color,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(2,-6,10),1700,(1,.78,.57),7)
    area('cool fill',(-5,-1,7),1200,(.65,.76,1),6)
    area('rim',(1,6,8),1900,(1,.76,.49),5)
    d=bpy.data.cameras.new('review camera'); cam=bpy.data.objects.new('review camera',d); bpy.context.collection.objects.link(cam)
    loc={'ref':(14,10,11),'game':(12,12,15),'front':(15,0,7),'side':(0,-15,7),'rear':(-12,10,9)}[a.view]
    cam.location=loc; target=Vector((0,0,1.6)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    d.type='ORTHO'; d.ortho_scale=18.0; scene.camera=cam
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=a.render
    bpy.ops.render.render(write_still=True); print('OK render',a.render)
