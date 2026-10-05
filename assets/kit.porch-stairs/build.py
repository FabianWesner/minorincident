"""Deterministic modular porch kit, +X forward, metres, ground at Z=0."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector

P = argparse.ArgumentParser()
for flag in ['render', 'glb']: P.add_argument('--'+flag)
P.add_argument('--view', default='ref')
P.add_argument('--samples', type=int, default=24)
P.add_argument('--width', type=int, default=960)
P.add_argument('--height', type=int, default=540)
a = P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(41)
colors = {'woodWarm':'b0703f','picketWhite':'f2e6dc','brick':'a8483a','foliage':'7da23c','grass':'6f8f3a','uiDark':'25222c','schoolBusYellow':'f2b630','survivorRed':'d9363e','windowGlow':'ffc773'}
materials = {}
for token, hexcol in colors.items():
    c = [int(hexcol[i:i+2],16)/255 for i in (0,2,4)]
    c = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c]
    m = bpy.data.materials.new(('emi_' if token=='windowGlow' else 'pal_')+token)
    m.diffuse_color=(*c,1); m.use_nodes=True
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*c,1); bs.inputs['Roughness'].default_value=.78
    if token=='windowGlow':
        bs.inputs['Emission Color'].default_value=(*c,1); bs.inputs['Emission Strength'].default_value=2.5
    materials[token]=m
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']='kit.porch-stairs'
animated = []
def finish(o,name,token,bevel=0):
    o.name=name; o.data.materials.append(materials[token]); o.parent=root
    bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name,loc,size,token='woodWarm',bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,token,bevel)

def beam(name,start,end,width,token='picketWhite'):
    d=Vector(end)-Vector(start); o=box(name,(Vector(start)+Vector(end))/2,(width,width,d.length),token,.012)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o

def pot_mesh(name,x,y,z):
    profile=[(.20,0),(.24,.035),(.25,.08),(.32,.49),(.35,.50),(.35,.58),(.29,.58),(.29,.50),(.22,.10),(0,.10)]
    n=16; v=[(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),z+h) for r,h in profile for i in range(n)]
    f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o); finish(o,name,'brick')
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.285,depth=.035,location=(x,y,z+.49)); finish(bpy.context.object,'soil','uiDark')

def leaf(loc,scale,token='foliage'):
    if token in ['foliage','grass']:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc); o=bpy.context.object
    else:
        d=bpy.data.meshes.new('petal'); d.from_pydata([(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)],[],[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)]); d.update()
        o=bpy.data.objects.new('petal',d); bpy.context.collection.objects.link(o); o.location=loc
    o.scale=scale; o.rotation_euler=(rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(0,6.28))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'leaf',token)

def plant(x,y,z,tall=False,potted=True):
    if potted: pot_mesh('terracotta planter',x,y,z)
    base=z+(.53 if potted else .08); height=1.05 if tall else .46; radius=.43 if tall else .48
    for j in range(7 if tall else 5):
        th=j*2.4; end=(x+math.cos(th)*radius*.5,y+math.sin(th)*radius*.5,base+height*(.65+.05*j))
        beam('woody stem',(x,y,base-.05),end,.035,'woodWarm')
    for j in range(45 if tall else 30):
        th=rng.uniform(0,6.28); u=rng.uniform(-1,1); r=math.sqrt(1-u*u)*radius*rng.uniform(.6,1)
        pos=(x+r*math.cos(th),y+r*math.sin(th),base+height*.55+u*height*.5)
        leaf(pos,(.19,.105,.045),'grass' if j%3==0 else 'foliage')
        if not tall and j%5==0:
            for k in range(5):
                ang=k*2*math.pi/5
                leaf((pos[0]+.038*math.cos(ang),pos[1]+.038*math.sin(ang),pos[2]+.13),(.052,.052,.025),'survivorRed' if j%2 else 'picketWhite')
            leaf((pos[0],pos[1],pos[2]+.15),(.03,.03,.022),'schoolBusYellow')

# Stair module: three broad wooden treads lead to a raised planked landing.
cy=-1.6
for x in [-1.1,.1]:
    for y in [cy-.88,cy+.88]: box('landing support',(x,y,.34),(.18,.18,.68))
box('landing fascia',(-.48,cy,.64),(1.65,2.05,.22))
for i in range(8): box('landing plank',(-1.2+i*.205,cy,.80),(.198,2.08,.11))
for i in range(3):
    x=.45+i*.37; top=.65-i*.205
    box('step riser',(x,cy,top/2),(.38,1.88,top))
    for j in range(2): box('step tread',(x+.02,cy-.47+j*.94,top+.035),(.43,.929,.09))
# Balusters meet the sloping rails; end posts have base blocks and caps.
for y in [cy-.98,cy+.98]:
    for x,z in [(-1.18,.85),(.13,.85),(1.38,.03)]:
        box('white newel',(x,y,z+.47),(.145,.145,.94),'picketWhite')
        box('newel base',(x,y,z+.065),(.22,.22,.15),'picketWhite')
        box('newel cap',(x,y,z+.97),(.235,.235,.105),'picketWhite')
    for z in [.94,1.70]: beam('landing rail',(-1.18,y,z),(.13,y,z),.10)
    for i in range(1,7): box('landing baluster',(-1.18+i*1.31/7,y,1.32),(.053,.053,.72),'picketWhite',.006)
    for offset in [.13,.85]: beam('stair rail',(.13,y,.85+offset),(1.38,y,.03+offset),.10)
    for i in range(1,7):
        x=.13+i*1.25/7; z=.85-i*.82/7
        box('stair baluster',(x,y,z+.48),(.052,.052,.68),'picketWhite',.006)
# Door module, framed double doors and a short siding wing.
cy=1.55
box('entry foundation',(-.47,cy,.12),(1.75,2.8,.24))
for i in range(8): box('entry plank',(-1.2+i*.21,cy,.275),(.204,2.83,.10))
for i in range(9): box('siding course',(-1.04,.37,.44+i*.225),(.13,.90,.218),'picketWhite',.008)
for y in [-.1,.82]:
    box('wing post',(-1.02,y,1.35),(.20,.18,2.12),'picketWhite')
    box('wing cap',(-1.02,y,2.44),(.27,.25,.12),'picketWhite')
box('door dark recess',(-1.04,1.88,1.39),(.16,1.87,2.13),'uiDark')
for y in [.90,2.86]:
    box('door casing',(-.91,y,1.48),(.27,.23,2.32),'picketWhite',.025)
    box('casing foot',(-.90,y,.45),(.35,.31,.32),'picketWhite',.02)
    box('capital',(-.91,y,2.55),(.34,.32,.22),'picketWhite',.022)
box('door header',(-.92,1.88,2.47),(.14,1.86,.12))
box('door lintel',(-.91,1.88,2.67),(.32,2.40,.22),'picketWhite',.025)
for k,y in enumerate([1.405,2.355]):
    before=set(bpy.data.objects)
    door=box('door leaf',(-.92,y,1.38),(.14,.91,2.08))
    for z,h in [(.82,.69),(1.81,.83)]:
        box('raised door panel',(-.834,y,z),(.032,.63,h),'woodWarm',.018)
        for yy in [y-.34,y+.34]: box('panel stile',(-.805,yy,z),(.04,.045,h+.10),'woodWarm',.009)
        for zz in [z-h/2-.025,z+h/2+.025]: box('panel cross trim',(-.805,y,zz),(.04,.71,.05),'woodWarm',.009)
    hy=y+(.31 if k==0 else -.31)
    box('lock plate',(-.805,hy,1.32),(.035,.105,.23),'uiDark',.012)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.058,location=(-.745,hy,1.34)); finish(bpy.context.object,'brass knob','schoolBusYellow')
    parts=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=door; bpy.ops.object.join(); door.name='door_L' if k==0 else 'door_R'
    bpy.context.scene.cursor.location=(-.92,y+(-.455 if k==0 else .455),1.38); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); animated.append(door)
# Lantern's solid glowing panes sit behind a thick open frame.
lx,ly,lz=-.57,.69,1.66
box('lantern wall bracket',(-.85,ly,lz+.16),(.08,.12,.42),'uiDark')
beam('lantern arm',(-.85,ly,lz+.35),(lx,ly,lz+.35),.065,'uiDark')
box('lantern base',(lx,ly,lz-.27),(.36,.33,.09),'uiDark')
box('lantern luminous panes',(lx,ly,lz),(.24,.22,.43),'windowGlow',.006)
for x in [lx-.15,lx+.15]:
    for y in [ly-.135,ly+.135]: box('lantern mullion',(x,y,lz),(.042,.042,.48),'uiDark',.006)
bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.30,radius2=.08,depth=.18,location=(lx,ly,lz+.33),rotation=(0,0,math.pi/4)); finish(bpy.context.object,'lantern hip roof','uiDark')
anchor=bpy.data.objects.new('light:porch',None); bpy.context.collection.objects.link(anchor); anchor.parent=root; anchor.location=(lx+.2,ly,lz); anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':1.8,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['static_emi_windowGlow'],'tiers':'all'})
plant(-.45,.15,.33,True); plant(.16,1.00,.33); plant(-.15,2.66,.33); plant(1.37,-3.13,0,potted=False)
# Static material batches keep the kit cheap to draw. Door origins remain at hinges.
for m in materials.values():
    obs=[o for o in bpy.data.objects if o.type=='MESH' and o not in animated and o.data.materials[0]==m]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='static_'+m.name
bpy.ops.object.select_all(action='DESELECT')
for o in [o for o in bpy.data.objects if o.type=='MESH']: o.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
# Center the display footprint and place its lowest geometry exactly on ground.
bpy.context.view_layer.update()
points=[o.matrix_world @ v.co for o in bpy.data.objects if o.type=='MESH' for v in o.data.vertices]
shift=Vector((-(min(v.x for v in points)+max(v.x for v in points))/2,
              -(min(v.y for v in points)+max(v.y for v in points))/2,
              -min(v.z for v in points)))
for o in root.children: o.location += shift
# Bake deterministic hemisphere visibility to the runtime AO vertex attribute.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
verts, faces = [], []
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:
    offset=len(verts)
    verts.extend(o.matrix_world @ v.co for v in o.data.vertices)
    faces.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
bvh=BVHTree.FromPolygons(verts,faces)
for o in meshes:
    values=[]
    for v in o.data.vertices:
        normal=(o.matrix_world.to_3x3() @ v.normal).normalized()
        tangent=normal.cross(Vector((0,0,1)) if abs(normal.z)<.95 else Vector((1,0,0))).normalized()
        bitangent=normal.cross(tangent)
        origin=o.matrix_world @ v.co + normal*.006
        blocked=0
        for i in range(32):
            z=(i+.5)/32; r=math.sqrt(1-z*z); theta=i*2.3999632297
            direction=tangent*(r*math.cos(theta))+bitangent*(r*math.sin(theta))+normal*z
            hit=bvh.ray_cast(origin,direction,.65)[0]
            blocked += hit is not None
        values.append(1-.65*blocked/32)
    ao=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for loop in o.data.loops:
        shade=values[loop.vertex_index]; ao.data[loop.index].color=(shade,shade,shade,1)
bpy.context.scene.unit_settings.system='METRIC'
meshes=[o for o in bpy.data.objects if o.type=='MESH']
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
draw_calls=sum(len(o.data.materials) for o in meshes)
report={'id':'kit.porch-stairs','tier':'Side','triangles':triangles,'draw_calls':draw_calls,'materials':[m.name for m in materials.values()],'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','door_L','door_R']),'within_budget':6000<=triangles<=12000 and draw_calls<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
Path(__file__).with_name('report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
    stage=bpy.data.materials.new('stage'); stage.diffuse_color=(.025,.022,.032,1); stage.use_nodes=True; stage.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.025,.022,.032,1); stage.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018)); bpy.context.object.data.materials.append(stage)
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.world.color=(.24,.24,.24)
    target=Vector((0,0,1.5 if a.view=='game' else 1.1))
    for loc,power,col,size in [((2,-4,7),1300,(1,.77,.52),5),((-3,4,6),1000,(.58,.66,1),5)]:
        bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object; l.data.energy=power;l.data.color=col;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object
    elev=math.radians(36 if a.view=='game' else 24); az=math.radians(25 if a.view=='ref' else 45)
    directions={'front':(1,0,.35),'side':(0,-1,.35),'rear':(-1,0,.35)}
    direction=Vector(directions.get(a.view,(math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))).normalized()
    cam.location=target+direction*15; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=11.5 if a.view=='game' else 9.4;scene.camera=cam
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
    # Final hero requests also produce the required 24-sample gameplay companion.
    if Path(a.render).name=='hero.png':
        target=Vector((0,0,1.5))
        elev=math.radians(36); az=math.radians(45)
        cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*15
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=11.5
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        scene.render.filepath=str(Path(a.render).with_name('game.png')); bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
