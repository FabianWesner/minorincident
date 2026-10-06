"""Fuel tanker: +X forward, metres, ground contact z=0. No textures or brands.
Reference: four-axle rigid truck, 11.3 x 3.2 x 4.2m; tank is an elliptical capsule.
All static meshes merge by material; moving assemblies retain joint-origin empties.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k, d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
M={k:palette.mat(k) for k in ['picketWhite','silver','uiDark','denim','survivorRed','schoolBusYellow']}
for k in ['windowGlow','sirenRed','schoolBusYellow']: M['e'+k]=palette.mat(k,True)
for k,m in M.items():
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Roughness'].default_value=.3 if k=='silver' else .48
    if k=='silver': p.inputs['Metallic'].default_value=.72
    if k=='denim': p.inputs['Roughness'].default_value=.19
    if k.startswith('e'): p.inputs['Emission Strength'].default_value=.8
buckets={}
def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=loc
    if parent: o.parent=parent
    return o
root=empty('veh.fuel-truck'); body=empty('body',parent=root)
root['ss_physics']={'class':'heavy','mass':14000,'friction':.7,'restitution':.03,'pushable':False,'kickable':False,'flammable':True,'centerOfMass':[0,1.4,0]}
def finish(o,k,g=body,bev=0):
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    o.data.materials.append(M[k]); bpy.context.view_layer.objects.active=o
    if bev:
        m=o.modifiers.new('soft edges','BEVEL'); m.width=bev; m.segments=2 if bev<.015 else 3
        bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=m.name)
    o.parent=g; o.matrix_parent_inverse=g.matrix_world.inverted()
    buckets.setdefault((g.name,k),[]).append(o); return o

def box(n,c,s,k='silver',g=body,b=.025,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c); o=bpy.context.object; o.name=n; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    return finish(o,k,g,min(b,min(s)*.3))
def cyl(n,c,r,d,k='silver',axis='Z',g=body,v=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=c); o=bpy.context.object; o.name=n
    o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else ((0,math.pi/2,0) if axis=='X' else (0,0,0))
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return finish(o,k,g,.012 if r>=.15 else 0)
def rod(n,a,b,r=.025,k='silver',g=body):
    mid=(Vector(a)+Vector(b))/2; o=cyl(n,mid,r,(Vector(b)-Vector(a)).length,k,g=g,v=12)
    o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler(); return o
def prism(n,pts,y0,y1,k,g=body,bev=.03):
    vs=[(x,y,z) for y in [y0,y1] for x,z in pts]; N=len(pts)
    fs=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    me=bpy.data.meshes.new(n); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new(n,me); scene.collection.objects.link(o); return finish(o,k,g,bev)
# ladder chassis rails, springs, visible axles
for y in [-.72,.72]: box('chassis',(0,y,.94),(10.7,.18,.28),'uiDark')
for x in [4.15,1.05,-2.8,-4.2]:
    cyl('axle',(x,0,.67),.11,2.45,'uiDark','Y')
    for s in [-1,1]:
        for z in [.82,.87,.92]: box('leaf spring',(x,s*.77,z),(1.13,.14,.045),'uiDark',b=.01)
        name=('wheelF' if x==4.15 else 'wheelR' if x==-4.2 else 'wheelM1' if x==1.05 else 'wheelM2')+('L' if s==-1 else 'R')
        g=empty(name,(x,s*1.11,.67),root); bpy.context.view_layer.update()
        # revolved tyre profile with round shoulders and a recessed rim opening
        profile=[(.45,-.22),(.56,-.22),(.63,-.18),(.67,-.10),(.67,.10),(.63,.18),(.56,.22),(.45,.22)]
        verts=[(x+r*math.sin(j*math.tau/48),s*1.11+dy,.67+r*math.cos(j*math.tau/48)) for r,dy in profile for j in range(48)]
        faces=[(i*48+j,i*48+(j+1)%48,((i+1)%len(profile))*48+(j+1)%48,((i+1)%len(profile))*48+j) for i in range(len(profile)) for j in range(48)]
        me=bpy.data.meshes.new('tyre'); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new('tyre',me); scene.collection.objects.link(o)
        for face in me.polygons: face.use_smooth=True
        finish(o,'uiDark',g)
        cyl('rim',(x,s*1.345,.67),.43,.055,'silver','Y',g,48)
        cyl('rim well',(x,s*1.382,.67),.32,.025,'uiDark','Y',g)
        cyl('wheel face',(x,s*1.402,.67),.265,.028,'silver','Y',g)
        cyl('hub',(x,s*1.442,.67),.115,.11,'silver','Y',g)
        for j in range(8):
            a=j*math.tau/8
            cyl('rim vent',(x+.351*math.sin(a),s*1.385,.67+.351*math.cos(a)),.053,.017,'uiDark','Y',g,12)
        for j in range(10):
            a=j*math.tau/10
            cyl('lug',(x+.20*math.sin(a),s*1.435,.67+.20*math.cos(a)),.027,.034,'silver','Y',g,8)
        for j in range(40):
            a=j*math.tau/40
            box('tread',(x+.653*math.sin(a),s*1.11,.67+.653*math.cos(a)),(.092,.45,.038),'uiDark',g,0,(0,a,0))
# cab, sloped bonnet, tall grille, roof and door panels
box('cab lower',(2.8,0,1.61),(1.75,2.08,1.18),'picketWhite',b=.09)
prism('cab upper',[(1.93,2.04),(3.65,2.04),(3.25,3.26),(2.0,3.29)],-1.025,1.025,'picketWhite')
box('roof',(2.61,0,3.3),(1.57,2.17,.16),'picketWhite',b=.07)
prism('hood',[(3.48,1.45),(5.29,1.45),(5.29,2.20),(3.49,2.40)],-.87,.87,'picketWhite',bev=.065)
box('grille surround',(5.32,0,1.8),(.18,1.61,1.38),'silver',b=.09)
box('grille dark',(5.423,0,1.81),(.05,1.37,1.14),'uiDark',b=.05)
for j in range(9): box('grille slat',(5.46,0,1.32+j*.119),(.042,1.28,.038),'silver',b=.006)
for y in [-.46,0,.46]: box('grille upright',(5.486,y,1.81),(.044,.045,1.08),'silver',b=.008)
box('bumper',(5.46,0,.95),(.35,2.64,.38),'silver',b=.05)
for y in [-.94,.94]: box('bumper amber',(5.648,y,.97),(.033,.29,.14),'eschoolBusYellow')
for y in [-.46,.46]: box('bumper recess',(5.647,y,.96),(.034,.22,.14),'uiDark')
box('registration',(5.659,0,.96),(.03,.32,.2),'picketWhite')
for y in [-1.15,-.7,.7,1.15]:
    cyl('bumper fastener',(5.652,y,.89),.027,.020,'uiDark','X',v=8)
# windscreen rides proud of the sloping front; same plane tilt as cab front
box('windscreen gasket',(3.482,0,2.716),(.06,1.89,.96),'uiDark',rot=(0,-.319,0))
box('windscreen',(3.519,0,2.727),(.035,1.75,.82),'denim',rot=(0,-.319,0))
box('windscreen divider',(3.546,0,2.727),(.032,.048,.83),'uiDark',rot=(0,-.319,0))
for y in [-.46,.46]: rod('wiper',(3.69,y-.19,2.33),(3.68,y+.20,2.36),.025,'uiDark')
for s in [-1,1]:
    g=empty('doorL' if s==-1 else 'doorR',(3.39,s*1.04,1.78),root); bpy.context.view_layer.update()
    box('door',(2.75,s*1.057,1.95),(1.27,.055,1.11),'picketWhite',g,.05)
    prism('side glass gasket',[(2.15,2.45),(3.31,2.45),(3.08,3.14),(2.14,3.14)],s*1.083-.026,s*1.083+.026,'uiDark',g)
    prism('side glass',[(2.22,2.51),(3.20,2.51),(3.00,3.06),(2.22,3.06)],s*1.115-.012,s*1.115+.012,'denim',g)
    box('door handle',(2.29,s*1.109,2.17),(.22,.055,.066),'uiDark',g)
    for z in [1.55,2.20]: box('hinge',(3.36,s*1.115,z),(.08,.05,.16),'silver',g)
    rod('mirror arm',(3.23,s*1.08,2.35),(3.25,s*1.42,2.4),.035,'uiDark',g)
    box('mirror case',(3.29,s*1.49,2.80),(.21,.18,.64),'uiDark',g,.05)
    box('mirror glass',(3.164,s*1.49,2.80),(.028,.145,.53),'silver',g)
    for z in [.95,1.16]: box('step',(2.62,s*1.17,z),(.98,.43,.09),'silver')
    cyl('diesel tank',(1.85,s*.96,.81),.30,1.01,'silver','X')
    for x in [1.5,2.15]: box('fuel tank strap',(x,s*1.267,.82),(.07,.034,.39),'uiDark')
    # continuous rounded wheel arches, rather than overlapping segments
    for x in [4.15,1.05]:
        pts=[(x+r*math.cos(a),.67+r*math.sin(a)) for r,angles in [(.89,[j*math.pi/24 for j in range(25)]),(.75,[j*math.pi/24 for j in range(24,-1,-1)])] for a in angles]
        prism('fender arch',pts,s*1.1-.29,s*1.1+.29,'picketWhite')
    box('front lamp housing',(5.16,s*1.055,1.56),(.42,.51,.35),'silver',b=.055)
    lamp=empty('lightsFront' if s==-1 else 'headlampR',parent=root)
    box('headlight',(5.388,s*1.055,1.57),(.035,.34,.23),'ewindowGlow',lamp)
    box('indicator',(5.391,s*1.265,1.57),(.034,.075,.22),'eschoolBusYellow')
    box('hood vent',(3.85,s*.89,2.07),(.43,.04,.16),'uiDark')
    for j in range(4): box('hood vent slat',(3.7+j*.1,s*.919,2.07),(.023,.025,.11),'silver')
    cyl('exhaust',(1.91,s*1.10,2.39),.09,2.87,'silver')
    cyl('exhaust heat shield',(1.91,s*1.10,1.86),.126,1.2,'silver')
    for z in [1.37,2.23]: cyl('shield clamp',(1.91,s*1.10,z),.145,.06,'uiDark')
    box('mudflap',(3.41,s*1.1,.42),(.08,.5,.58),'uiDark')
for y in [-.82,-.41,0,.41,.82]:
    box('roof lamp base',(2.83,y,3.414),(.25,.19,.07),'silver')
    box('roof amber',(2.83,y,3.48),(.19,.13,.10),'eschoolBusYellow',b=.045)
# elliptical capsule tank, dome ends built as rings for a single smooth skin
vs=[]; fs=[]; rings=[]
profile=[(-5.34,0.08),(-5.30,.38),(-5.15,.73),(-4.93,.93),(-4.66,1), (1.22,1),(1.49,.93),(1.71,.73),(1.86,.38),(1.9,.08)]
for x,r in profile:
    rings.append(len(vs))
    for j in range(64):
        a=j*math.tau/64; vs.append((x,1.13*r*math.cos(a),2.65+1.12*r*math.sin(a)))
for i in range(len(rings)-1):
    for j in range(64): fs.append((i*64+j,i*64+(j+1)%64,(i+1)*64+(j+1)%64,(i+1)*64+j))
fs += [tuple(range(63,-1,-1)),tuple(range(576,640))]
me=bpy.data.meshes.new('tank'); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new('tank',me); scene.collection.objects.link(o)
for p in me.polygons: p.use_smooth=True
finish(o,'silver')
for x in [-4.62,-3.15,-1.65,-.15,1.18]:
    # continuous elliptical seam tube: shared vertices, no bevelled rod chain
    verts=[]; faces=[]
    for j in range(64):
        angle=j*math.tau/64
        for t in range(8):
            tube=t*math.tau/8
            verts.append((x+.016*math.cos(tube),(1.143+.016*math.sin(tube))*math.cos(angle),2.65+(1.133+.016*math.sin(tube))*math.sin(angle)))
    for j in range(64):
        for t in range(8): faces.append((j*8+t,((j+1)%64)*8+t,((j+1)%64)*8+(t+1)%8,j*8+(t+1)%8))
    me=bpy.data.meshes.new('tank band'); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new('tank band',me); scene.collection.objects.link(o)
    for face in me.polygons: face.use_smooth=True
    finish(o,'silver')
for s in [-1,1]:
    box('side rail',(-1.65,s*1.23,1.39),(7.7,.16,.20),'silver')
    for j in range(27): box('reflective stripe',(-5.22+j*.274,s*1.32,1.405),(.266,.022,.12),'survivorRed' if j%2==0 else 'picketWhite',b=.002)
    for x in [-4.2,-2.8]:
        box('rear fender',(x,s*1.12,1.38),(1.40,.59,.16),'uiDark')
    box('rear flap',(-4.95,s*1.10,.48),(.08,.56,.73),'uiDark')
    box('valve locker',(-1.08,s*.97,.97),(1.1,.49,.60),'silver',b=.045)
    box('locker latch',(-1.08,s*1.232,1.02),(.08,.04,.17),'survivorRed')
    for x in [-1.49,-.68]:
        for z in [.75,1.20]: cyl('locker rivet',(x,s*1.231,z),.027,.032,'silver','Y',v=8)
    for x in [-3.4,-1.4,.6]:
        rod('tank saddle',(x,s*.71,1.1),(x,s*.91,1.87),.055,'uiDark')
    box('catwalk edge',(-1.62,s*.66,3.81),(6.50,.08,.13),'silver')
    rod('top rail',(-4.8,s*.65,4.01),(1.6,s*.65,4.01),.03)
    for x in [-4.8,-2.7,-.6,1.6]: rod('rail stanchion',(x,s*.65,3.77),(x,s*.65,4.01),.028)
    for x in [-4.7,-3.1,-1.5,.1,1.45]: box('tank marker',(x,s*.718,3.65),(.095,.045,.12),'eschoolBusYellow')
box('catwalk',(-1.6,0,3.81),(6.3,1.24,.07),'uiDark')
for x in [-4.05,-2.30,-.55,1.0]:
    cyl('hatch flange',(x,0,3.87),.36,.1,'silver')
    box('hatch cover',(x,0,3.94),(.63,.56,.13),'uiDark',b=.045)
    box('hatch handle',(x,0,4.02),(.30,.06,.06),'silver')
    for y in [-.27,.27]: box('hatch latch',(x,y,3.97),(.14,.08,.07),'silver')
# lower discharge pipe, valve wheels and hose storage
for side in [-1,1]:
    rod('discharge pipe',(-2.7,side*.98,1.07),(-2.7,side*1.36,1.07),.09)
    cyl('valve flange',(-2.7,side*1.33,1.07),.16,.06,'silver','Y')
    cyl('valve dark opening',(-2.7,side*1.371,1.07),.09,.027,'uiDark','Y')
    cyl('valve stem',(-2.7,side*1.16,1.29),.033,.21,'silver')
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=(-2.7,side*1.16,1.40),major_radius=.12,minor_radius=.022)
    finish(bpy.context.object,'survivorRed')
    for angle in [0,math.pi/2]: rod('valve spoke',(-2.7-.12*math.cos(angle),side*1.16-.12*math.sin(angle),1.4),(-2.7+.12*math.cos(angle),side*1.16+.12*math.sin(angle),1.4),.012,'survivorRed')
    cyl('hose storage',(-3.37,side*.87,1.10),.11,2.0,'uiDark','X')
# rear-side ladder curved over tank top
for x in [-4.60,-4.05]:
    pts=[(x,1.32,1.42),(x,1.32,3.29),(x,1.13,3.79),(x,.77,4.13),(x,.45,4.13)]
    for a,b in zip(pts,pts[1:]): rod('ladder upright',a,b,.035)
for z in [1.55,1.87,2.19,2.51,2.83,3.15,3.47]: rod('ladder rung',(-4.60,1.35,z),(-4.05,1.35,z),.034)
# diamond hazard signs sit on thick mounts, >= 12mm above tank's tangent surface
flame=[(-.16,-.20),(-.26,-.05),(-.20,.15),(-.13,.05),(-.10,.32),(.02,.16),(.04,.45),(.18,.19),(.17,.03),(.24,.10),(.23,-.08),(.12,-.23),(.02,-.29),(-.06,-.25)]
def placard(x,s):
    z=2.66
    box('placard rim',(x,s*1.175,z),(.81,.056,.81),'picketWhite',b=.012,rot=(0,math.pi/4,0))
    box('placard red',(x,s*1.212,z),(.752,.022,.752),'survivorRed',b=.004,rot=(0,math.pi/4,0))
    prism('flame',[(x+a,z+b) for a,b in flame],s*1.239-.007,s*1.239+.007,'picketWhite',bev=.004)
    box('flame underline',(x,s*1.258,z-.34),(.27,.02,.035),'picketWhite',b=.002)
for s in [-1,1]: placard(-1.3,s)
# rear sign uses same graphic rotated around Z
before=set(bpy.data.objects); placard(0,-1)
new=[o for o in bpy.data.objects if o not in before]
rear_transform=Matrix.Translation((-5.37,0,0)) @ Matrix.Rotation(-math.pi/2,4,'Z') @ Matrix.Translation((0,1.175,0))
for o in new: o.matrix_world=rear_transform @ o.matrix_world
box('rear bumper',(-5.47,0,.81),(.2,2.64,.19),'silver')
box('rear lamp beam',(-5.40,0,1.29),(.20,2.64,.22),'silver')
brakes=empty('lightsBrake',parent=root)
for s in [-1,1]:
    for y in [s*.90,s*1.14]: cyl('brake lamp',(-5.516,y,1.30),.095,.034,'esirenRed','X',brakes)
for z in [.81,1.30]:
    for j in range(12): box('rear reflector',(-5.582,-1.19+j*.216,z),(.018,.204,.105),'survivorRed' if j%2==0 else 'picketWhite',b=.002)
# contract anchors
for n,c in [('driverSeat',(2.66,-.50,1.65)),('exitL',(2.6,-1.85,0)),('exitR',(2.6,1.85,0))]: empty(n,c,root)
for n,c,size in [('cab',(3.6,0,1.6),(4.1,2.4,3.2)),('tank',(-1.7,0,2.15),(7.5,2.45,3.1))]:
    e=empty('col:'+n,c,root); e['collider']='cuboid'; e['shape']='cuboid'; e['size']=size
for s in [-1,1]:
    for n,c,kind,color,mesh in [('headlight',(5.45,s*1.05,1.57),'spot','light_led_white','lightsFront' if s==-1 else 'headlampR'),('brake',(-5.54,s*1.05,1.30),'point','light_siren_red','lightsBrake')]:
        e=empty('light:'+n+('L' if s==-1 else 'R'),c,root)
        e.rotation_euler=Vector((1,0,-.12) if n=='headlight' else (-1,0,0)).to_track_quat('-Z','Y').to_euler()
        e['ss_light']={'type':kind,'color':color,'intensity':3,'range':22 if kind=='spot' else 2,'angle':48,'beam':'soft' if kind=='spot' else 'none','shadow':'hero' if kind=='spot' else 'none','emissiveNodes':[mesh+'_emi_'+('windowGlow' if n=='headlight' else 'sirenRed')], 'powerGroup':'self'}
# Merge by material per moving assembly; bake AO for each exported tier.
bpy.context.view_layer.update()
meshes=[]
# Keep source parts for lower tiers before the hero static meshes are joined.
lod_sources={1:{},2:{}}
fine={'tread','lug','rim vent','locker rivet','bumper fastener','shield clamp','grille slat','hood vent slat','tank marker','valve spoke','reflective stripe','rear reflector'}
major={'chassis','tyre','rim','cab lower','cab upper','roof','door','side glass gasket','side glass','windscreen gasket','windscreen','windscreen divider','hood','grille surround','grille dark','bumper','fender arch','headlight','tank','side rail','rear fender','rear flap','catwalk','placard rim','placard red','flame','flame underline','rear bumper','rear lamp beam','brake lamp','roof amber','mirror case','mirror glass','step','diesel tank','exhaust','ladder upright','ladder rung','hatch cover'}
for key,parts in (buckets.items() if arg('--glb') else []):
    for level in [1,2]:
        chosen=[o for o in parts if o.name.split('.')[0] not in fine] if level==1 else [o for o in parts if o.name.split('.')[0] in major]
        if chosen:
            lod_sources[level][key]=[(o.data.copy(),o.matrix_world.copy()) for o in chosen]
for (group,k),parts in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=parts[0]; o.name=group+'_'+M[k].name; meshes.append(o)
    if k.startswith('e') and group=='body': o['decorativeEmissive']=True
def bake_soft_ao(meshes,samples):
    ao.bake_all(meshes,samples=samples)
    # Soft diorama occlusion: intersections must not turn white paint black.
    for mesh in meshes:
        for item in mesh.data.color_attributes['ao'].data:
            value=.55+.45*item.color[0]
            item.color=(value,value,value,1)

if arg('--glb'):
    bake_soft_ao(meshes,samples=16)
    def export(path, selected_meshes):
        bpy.ops.object.select_all(action='DESELECT')
        for o in scene.objects: o.select_set(o.type=='EMPTY' or o in selected_meshes)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_extras=True,export_cameras=False,export_lights=False)
    path=Path(arg('--glb')).resolve(); export(path,meshes)
    for o in meshes: o.hide_render=True
    for level,ratio in [(1,.15),(2,.09)]:
        lower=[]
        for (group,k),parts in lod_sources[level].items():
            parent=bpy.data.objects[group]; vertices=[]; faces=[]
            for data,matrix in parts:
                transform=parent.matrix_world.inverted() @ matrix; offset=len(vertices)
                vertices.extend(tuple(transform @ v.co) for v in data.vertices)
                faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons)
            data=bpy.data.meshes.new('lod'); data.from_pydata(vertices,[],faces); data.update()
            o=bpy.data.objects.new(group+'_'+M[k].name+'_lod'+str(level),data); scene.collection.objects.link(o); o.parent=parent; data.materials.append(M[k]); lower.append(o)
            for face in data.polygons: face.use_smooth=True
            modifier=o.modifiers.new('LOD','DECIMATE'); modifier.ratio=ratio
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=modifier.name)
        bake_soft_ao(lower,samples=8)
        export(path.with_name('model.lod%d.glb'%level),lower)
        for o in lower: bpy.data.objects.remove(o,do_unlink=True)
    for o in meshes: o.hide_render=False
# studio: rendered only, never exported
if arg('--render'):
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.11,.15,1); world.node_tree.nodes['Background'].inputs[1].default_value=.38
    env=world.node_tree.nodes.new('ShaderNodeTexEnvironment'); env.image=bpy.data.images.load(str(Path(bpy.utils.resource_path('LOCAL'))/'datafiles/studiolights/world/studio.exr'))
    world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color'])
    for n,c,power,color in [('key',(5,-7,10),2400,(1,.86,.70)),('fill',(-5,-6,8),1800,(.70,.79,1)),('rim',(-3,6,9),2800,(1,.79,.56))]:
        d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.shape='DISK'; d.size=7; d.color=color
        o=bpy.data.objects.new(n,d); scene.collection.objects.link(o); o.location=c; o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.name='studio floor'
    m=bpy.data.materials.new('studio'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.042,.036,.055,1); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8; floor.data.materials.append(m)
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=15.5
    views={'ref':(12,17,9),'game':(14,14,17),'front':(20,0,6),'side':(0,-22,6),'rear':(-16,-13,8)}
    cam.location=views[arg('--view','ref')]; cam.rotation_euler=(Vector((0,0,1.9))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.filepath=str(Path(arg('--render')).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
print('BUILD OK')
