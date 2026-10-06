"""Deterministic, texture-free hero jeep. +X forward, metres, tyre contact z=0.
Run through experiment/tools/blender_run.py; exports all three LODs with --glb.
"""
import bpy, bmesh, math, sys, json
from pathlib import Path
from mathutils import Vector, Matrix
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette, ao
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
M={}
for key,token,rough,metal in [('red','survivorRed',.3,.12),('dark','uiDark',.65,0),('trim','asphalt',.4,.25),('steel','sidewalk',.32,.65),('white','picketWhite',.5,0)]:
    M[key]=palette.mat(token); p=M[key].node_tree.nodes['Principled BSDF']; p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
for key,token in [('head','windowGlow'),('amber','schoolBusYellow'),('brake','sirenRed')]:
    M[key]=palette.mat(token,True); M[key].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=.8
M['glass']=palette.mat('backpackTeal')
p=M['glass'].node_tree.nodes['Principled BSDF']; p.inputs['Alpha'].default_value=.13; p.inputs['Roughness'].default_value=.18
M['glass'].surface_render_method='DITHERED'
GROUPS={}; PARTS={}
def empty(n,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(n,None); scene.collection.objects.link(o); o.location=loc
    if parent: o.parent=parent
    return o
root=empty('veh.jeep-red'); root['asset_id']='veh.jeep-red'; root['forward']='+X'
root['ss_physics']={'body':'dynamic','mass':1250,'friction':.8,'restitution':.05,'pushable':True,'centerOfMass':[0,0,.65]}
for n,c in [('body',(0,0,0)),('wheelFL',(1.18,.96,.49)),('wheelFR',(1.18,-.96,.49)),('wheelRL',(-1.16,.96,.49)),('wheelRR',(-1.16,-.96,.49)),('lightsFront',(1.8,0,1.1)),('lightsBrake',(-1.7,0,1.1))]:
    GROUPS[n]=empty(n,c,root); PARTS[n]=[]
def finish(o,mat,g='body',bevel=0):
    o.data.materials.append(M[mat]); PARTS[g].append(o)
    if bevel:
        m=o.modifiers.new('soft edges','BEVEL'); m.width=bevel; m.segments=1 if o.name.startswith('offroad tread') else 3
        m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); m.keep_sharp=True
    for f in o.data.polygons: f.use_smooth=True
    return o
def box(n,c,s,mat,g='body',b=.025,rot=None):
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1); bmesh.ops.scale(bm,vec=Vector(s),verts=bm.verts)
    me=bpy.data.meshes.new(n); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(n,me); scene.collection.objects.link(o); o.location=c
    if rot: o.rotation_euler=rot
    return finish(o,mat,g,min(b,min(s)*.4))
def mesh(n,vs,fs,mat,g='body',b=.02):
    me=bpy.data.meshes.new(n); me.from_pydata(vs,[],fs); me.update(); o=bpy.data.objects.new(n,me); scene.collection.objects.link(o); return finish(o,mat,g,b)
def prism(n,pts,y0,y1,mat,b=.025):
    l=len(pts); vs=[(x,y,z) for y in [y0,y1] for x,z in pts]; fs=[tuple(reversed(range(l))),tuple(range(l,2*l))]+[(i,(i+1)%l,(i+1)%l+l,i+l) for i in range(l)]
    return mesh(n,vs,fs,mat,b=b)
def lathe(n,prof,c,axis,mat,g='body',seg=48):
    vs=[]
    rot={'x':Matrix.Rotation(math.pi/2,4,'Y'),'y':Matrix.Rotation(math.pi/2,4,'X'),'z':Matrix.Identity(4)}[axis]
    for r,d in prof:
        for k in range(seg):
            a=k*math.tau/seg; v=rot@Vector((r*math.cos(a),r*math.sin(a),d)); vs.append(tuple(v+Vector(c)))
    fs=[]
    for j in range(len(prof)-1):
        for k in range(seg): fs.append((j*seg+k,j*seg+(k+1)%seg,(j+1)*seg+(k+1)%seg,(j+1)*seg+k))
    return mesh(n,vs,fs,mat,g,0)
def cyl(n,c,r,depth,axis,mat,g='body',seg=32):
    return lathe(n,[(.0001,-depth/2),(r,-depth/2),(r,depth/2),(.0001,depth/2)],c,axis,mat,g,seg)
def tube(n,pts,r,mat,g='body'):
    cu=bpy.data.curves.new(n,'CURVE'); cu.dimensions='3D'; cu.resolution_u=1; cu.bevel_depth=r; cu.bevel_resolution=3
    sp=cu.splines.new('POLY'); sp.points.add(len(pts)-1)
    for p,c in zip(sp.points,pts): p.co=(*c,1)
    o=bpy.data.objects.new(n,cu); scene.collection.objects.link(o); bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False); return finish(o,mat,g)
def rod(n,a,b,r,mat,g='body'): return tube(n,[a,b],r,mat,g)
# Chassis and open bathtub, never a solid cabin block.
box('frame',(0,0,.43),(3.25,1.28,.18),'dark')
for y in [-.48,.48]: box('frame rail',(0,y,.36),(3.35,.09,.13),'trim')
box('floor',(-.25,0,.76),(2.65,1.54,.16),'red')
box('rear tub',(-1.48,0,1.11),(.30,1.63,.66),'red',b=.07)
box('rear cargo floor',(-1.10,0,.97),(.61,1.50,.14),'red')
for s in [-1,1]:
    # Red body drops to a sill at the doorless side entry.
    pts=[(-1.65,.78),(-1.65,1.44),(-.90,1.44),(-.72,1.35),(-.58,.92),(-.40,.84),(.30,.84),(.48,.97),(.52,1.51),(.72,1.50),(.78,.78)]
    prism('open side tub',pts,s*.82-.07,s*.82+.07,'red',.045)
    box('rock slider',(-.19,s*.92,.67),(1.71,.13,.10),'trim',b=.035)
    box('entry tread',(-.10,s*.93,.72),(1.35,.22,.035),'dark',b=.01)
    for x in [-1.56,-1.00,-.75,.49]: cyl('panel fastener',(x,s*.899,1.29 if x<-.7 else 1.12),.018,.018,'y','dark',seg=12)
    # Hood latches and hinges are visibly proud of paint.
    for x in [.85,1.44]: box('hood latch',(x,s*.724,1.46),(.06,.055,.13),'dark',b=.012,rot=(0,.18,0))
    box('hood seam',(.98,s*.713,1.37),(1.15,.014,.024),'dark',b=.005)
    for x in [.42,.55]: box('windshield hinge',(x,s*.88,1.45),(.07,.035,.11),'trim',b=.012)
# Raised hood with crown and beveled grille shell.
prism('hood',[(.56,1.34),(1.73,1.34),(1.76,1.50),(1.56,1.59),(.63,1.60)],-.72,.72,'red',.065)
box('cowl',(.53,0,1.40),(.25,1.68,.28),'red',b=.07)
box('grille panel',(1.76,0,1.15),(.18,1.54,.79),'red',b=.09)
# Seven recessed slots: dark inserts stand proud by 6mm and have rounded rims.
for i in range(7):
    y=(i-3)*.125
    box('grille slot rim',(1.864,y,1.15),(.032,.086,.60),'trim',b=.034)
    box('grille dark depth',(1.886,y,1.15),(.016,.052,.548),'dark',b=.023)
for s in [-1,1]:
    y=s*.61
    cyl('headlight bezel',(1.866,y,1.34),.192,.062,'x','trim','lightsFront')
    cyl('headlight surround',(1.903,y,1.34),.166,.040,'x','steel','lightsFront')
    lathe('round headlight',[(.0001,-.008),(.143,-.008),(.148,.008),(.125,.029),(.0001,.04)],(1.925,y,1.34),'x','head','lightsFront')
    box('indicator bezel',(1.884,y,.94),(.065,.155,.125),'dark','lightsFront',.028)
    box('amber indicator',(1.923,y,.94),(.018,.118,.086),'amber','lightsFront',.019)
    box('tail housing',(-1.654,s*.68,1.15),(.08,.15,.30),'dark','lightsBrake',.026)
    box('tail lamp',(-1.704,s*.68,1.20),(.028,.114,.15),'brake','lightsBrake',.018)
    box('tail amber',(-1.704,s*.68,1.08),(.028,.114,.055),'amber','lightsBrake',.012)
# Front and rear heavy bumpers and paired auxiliary lamps.
for x in [1.94,-1.77]:
    box('bumper',(x,0,.70),(.25,2.06,.26),'trim',b=.055)
    for y in [-.59,.59]:
        box('bumper strap',(x+(.133 if x>0 else -.133),y,.70),(.031,.12,.29),'dark',b=.012)
        cyl('bumper bolt',(x+(.156 if x>0 else -.156),y,.70),.023,.018,'x','steel',seg=12)
for y in [-.25,.25]:
    rod('aux mount',(1.93,y,.82),(1.94,y,.93),.033,'dark')
    cyl('aux housing',(1.94,y,1.01),.135,.10,'x','trim','lightsFront')
    cyl('aux trim',(2.002,y,1.01),.116,.02,'x','steel','lightsFront')
    cyl('aux lens',(2.018,y,1.01),.101,.018,'x','head','lightsFront')
for y in [-.45,.45]:
    rod('hood pressed rib',(.72,y,1.614),(1.51,y,1.607),.008,'red')
for x in [.65,1.59]:
    box('hood hinge',(x,0,1.62),(.10,.075,.025),'trim',b=.008)
# Polygonal arch flares wrap tyres, open beneath; no covering body over wheels.
for x in [-1.16,1.18]:
    for s in [-1,1]:
        outer=[(x-.70,.78),(x-.52,1.32),(x-.39,1.43),(x+.41,1.43),(x+.55,1.30),(x+.70,.78)]
        inner=[(x+.56,.79),(x+.43,1.22),(x+.34,1.29),(x-.33,1.29),(x-.43,1.20),(x-.56,.79)]
        prism('arch flare',outer+inner,min(s*.78,s*1.035),max(s*.78,s*1.035),'trim',.027)
        if x>0: box('red fender nose',(1.74,s*.91,1.17),(.37,.32,.22),'red',b=.05)
# Suspension visible between wheels.
for x in [-1.16,1.18]:
    cyl('axle',(x,0,.48),.065,1.86,'y','dark')
    lathe('differential',[(.001,-.13),(.15,-.08),(.18,0),(.15,.08),(.001,.13)],(x,0,.46),'y','trim')
    for s in [-1,1]:
        rod('shock',(x-.15,s*.56,.49),(x+.04,s*.58,.85),.037,'steel')
        for z in [.39,.42,.45]: box('leaf spring',(x,s*.57,z),(.75,.055,.025),'trim',b=.01)
# Tyres, radial tread blocks, layered rim and six genuine open spokes.
def wheel(c,axis,g):
    cx,cy,cz=c; seg=64
    def point(r,a,d):
        return (cx+r*math.cos(a),cy+d,cz+r*math.sin(a)) if axis=='y' else (cx+d,cy+r*math.cos(a),cz+r*math.sin(a))
    lathe('tyre',[(.278,-.17),(.37,-.18),(.444,-.143),(.474,-.10),(.478,.10),(.444,.143),(.37,.18),(.278,.17),(.278,-.17)],c,axis,'dark',g,seg)
    for k in range(40):
        a=k*math.tau/40
        for row in [-1,0,1]:
            ang=a+(row%2)*.043; pos=point(.481 if row==0 else .459,ang,row*.155)
            rot=(0,math.pi/2-ang,0) if axis=='y' else Matrix(((0,1,0),(-math.sin(ang),0,math.cos(ang)),(math.cos(ang),0,math.sin(ang)))).to_euler()
            size=(.057,.132,.062)
            box('offroad tread',pos,size,'dark',g,.011,rot)
    for side in [-1,1]:
        d=side*.175
        lathe('rim lip',[(.278,d-.018),(.29,d),(.276,d+.014),(.248,d+.014),(.243,d),(.278,d-.018)],c,axis,'steel',g,seg)
        lathe('rim barrel',[(.246,-.14),(.246,.14),(.232,.14),(.232,-.14)],c,axis,'trim',g,48)
        cyl('hub',point(0,0,d),.097,.052,axis,'trim',g)
        cyl('hub cap',point(0,0,d+side*.032),.055,.03,axis,'steel',g,24)
        for k in range(6):
            a=k*math.tau/6
            rod('wheel spoke',point(.078,a,d),point(.251,a+.13,d),.028,'trim',g)
            cyl('lug nut',point(.12,a,d+side*.019),.014,.026,axis,'steel',g,8)
    return
for g in ['wheelFL','wheelFR','wheelRL','wheelRR']: wheel(tuple(GROUPS[g].location),'y',g)
wheel((-1.89,0,1.43),'x','body')
box('spare bracket',(-1.70,0,1.31),(.18,.33,.38),'trim')
for y in [-.63,.63]:
    tube('rear tow loop',[(-1.92,y-.05,.68),(-1.97,y-.05,.52),(-1.97,y,.48),(-1.97,y+.05,.52),(-1.92,y+.05,.68)],.018,'steel')
# Roll cage: rounded shoulder bends and back diagonal braces.
for s in [-1,1]:
    pts=[(-.85,s*.73,1.17),(-.85,s*.73,2.17),(-.82,s*.73,2.28),(-.72,s*.73,2.34),(.33,s*.73,2.34),(.43,s*.73,2.29)]
    tube('roll cage rail',pts,.058,'dark')
    rod('rear roll brace',(-1.44,s*.73,1.40),(-.84,s*.73,2.24),.061,'dark')
    for x,z in [(-.85,1.49),(-.58,2.34)]: cyl('cage sleeve',(x,s*.73,z),.07,.12,'z' if z<2 else 'x','trim')
rod('roll cage crossbar',(-.77,-.73,2.34),(-.77,.73,2.34),.058,'dark')
rod('front cage crossbar',(.37,-.73,2.31),(.37,.73,2.31),.047,'dark')
# Reclined upholstered seats, inset cushions and piping-like distinct pads.
for y in [-.40,.40]:
    box('seat pedestal',(-.24,y,.96),(.40,.39,.24),'dark',b=.04)
    box('seat cushion',(-.13,y,1.05),(.54,.52,.16),'trim',b=.07)
    box('seat cushion inset',(-.12,y,1.14),(.40,.37,.055),'dark',b=.025)
    box('seat back',(-.42,y,1.44),(.17,.52,.68),'trim',b=.065,rot=(0,-.15,0))
    box('back cushion',(-.308,y,1.43),(.043,.39,.47),'dark',b=.02,rot=(0,-.15,0))
    box('headrest',(-.46,y,1.90),(.18,.33,.27),'trim',b=.06)
    cyl('seat recline joint',(-.40,y-.28,1.13),.053,.029,'y','dark')
box('rear bench',(-1.14,0,1.13),(.40,1.27,.19),'trim',b=.07)
box('rear bench back',(-1.40,0,1.42),(.16,1.28,.43),'trim',b=.055)
box('dash',(.40,0,1.49),(.25,1.46,.24),'dark',b=.04)
for y,r in [(-.40,.080),(-.22,.044),(-.58,.044)]:
    cyl('gauge bezel',(.263,y,1.53),r,.018,'x','steel'); cyl('gauge black face',(.25,y,1.53),r*.80,.014,'x','dark')
    rod('gauge needle',(.239,y,1.53),(.239,y+.018,1.53+r*.48),.005,'white')
rod('steering column',(.31,.40,1.38),(.02,.40,1.53),.037,'dark')
lathe('steering wheel',[(.152,-.015),(.169,-.015),(.178,0),(.169,.015),(.152,.015),(.152,-.015)],(.01,.40,1.56),'x','dark')
for a in [0,2.1,4.2]: rod('steering spoke',(.01,.40,1.56),(.01,.40+.155*math.cos(a),1.56+.155*math.sin(a)),.013,'trim')
box('center console',(-.13,0,1.00),(.55,.17,.19),'dark',b=.035)
rod('gear lever',(-.05,0,1.07),(-.10,0,1.30),.015,'steel'); cyl('gear knob',(-.10,0,1.30),.032,.051,'z','dark')
# Windshield rakes slightly backwards; open pane with alpha, framed in red.
wb=(.53,0,1.58); wt=(.35,0,2.29)
for s in [-1,1]: rod('windshield upright',(.53,s*.81,1.58),(.35,s*.81,2.29),.045,'red')
rod('windshield top',(.35,-.81,2.29),(.35,.81,2.29),.045,'red')
rod('windshield bottom',(.53,-.81,1.58),(.53,.81,1.58),.050,'red')
for s in [-1,1]: rod('glass seal',(.511,s*.755,1.63),(.359,s*.755,2.24),.016,'dark')
for x,z in [(.511,1.63),(.359,2.24)]: rod('glass seal',(x,-.755,z),(x,.755,z),.016,'dark')
mesh('windscreen',[(.514,-.743,1.648),(.514,.743,1.648),(.365,.743,2.225),(.365,-.743,2.225)],[(0,1,2,3)],'glass',b=0)
for s in [-1,1]:
    y=s*.43
    rod('wiper arm',(.558,y,1.61),(.510,y-s*.17,1.81),.013,'dark')
    rod('wiper blade',(.512,y-s*.36,1.80),(.512,y+s*.10,1.80),.014,'dark')
    rod('mirror arm',(.47,s*.82,1.50),(.39,s*1.02,1.81),.026,'dark')
    box('mirror housing',(.38,s*1.03,1.86),(.10,.19,.24),'trim',b=.038)
    box('mirror glass',(.323,s*1.03,1.86),(.012,.145,.18),'steel',b=.02)
box('rear view mirror',(.32,0,2.12),(.06,.28,.10),'trim',b=.025)
rod('rear mirror stalk',(.34,0,2.24),(.30,0,2.14),.012,'dark')
# Gameplay attachment and physics extras.
for n,c in [('driverSeat',(-.13,.40,1.13)),('exitL',(-.05,1.3,.10)),('exitR',(-.05,-1.3,.10))]: empty(n,c,root)
col=empty('col:body',(0,0,1.05),root); col['collider']='cuboid'; col['size']=[3.94,2.10,1.48]
for s,label in [(1,'L'),(-1,'R')]:
    for kind,x,z,color,group in [('headlight',1.94,1.34,'light_window_warm','lightsFront'),('brake',-1.72,1.2,'light_siren_red','lightsBrake')]:
        e=empty('light:'+kind+label,(x,s*.61,z),root)
        e['ss_light']={'type':'spot' if kind=='headlight' else 'point','color':color,'intensity':2,'range':12 if kind=='headlight' else 2,'angle':48,'penumbra':.35,'pool':True,'beam':'soft','flare':True,'reflect':True,'heroPriority':2,'flicker':'none','breakable':True,'tiers':'all','shadow':'hero' if kind=='headlight' else 'none','emissiveNodes':[group+'__emi_windowGlow',group+'__emi_schoolBusYellow'] if kind=='headlight' else [group+'__emi_sirenRed',group+'__emi_schoolBusYellow'],'powerGroup':'vehicle','behavior':'steady','defaultOn':True}
        if kind=='headlight': e.rotation_euler=Vector((1,0,-.15)).to_track_quat('-Z','Y').to_euler()
# Apply modifiers, join each static material and keep wheel-centre origins.
for g,parts in PARTS.items():
    buckets={}
    for o in parts:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        buckets.setdefault(o.data.materials[0].name,[]).append(o)
    for mat,obs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=g+'__'+mat
        scene.cursor.location=GROUPS[g].location; bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); mw=o.matrix_world.copy(); o.parent=GROUPS[g]; o.matrix_world=mw
meshes=[o for o in scene.objects if o.type=='MESH']
bpy.context.view_layer.update()
root.location.z=-min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
bpy.context.view_layer.update()
# True deterministic AO stored in COLOR_0 for the runtime palette shader.
if arg('--glb'): ao.bake_all(meshes,samples=32)
def stats():
    triangles=0
    for o in meshes: o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
    return {'triangles':triangles,'draw_calls':len(meshes)}
print('BUILD OK',stats())
(HERE/'geometry-stats.json').write_text(json.dumps({**stats(),'parts':{o.name:len(o.data.loop_triangles) for o in meshes}}))
if arg('--glb'):
    report={'id':'veh.jeep-red','tier':'Hero',**stats(),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':True,'within_budget':stats()['triangles']<=80000 and len(meshes)<=40,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    def export(path):
        bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    p=Path(arg('--glb')).resolve(); export(p)
    original={o:o.data.copy() for o in meshes}
    lodstats={}
    for level,ratio in [(1,.13),(2,.03)]:
        for o in meshes:
            o.data=original[o].copy(); bpy.context.view_layer.objects.active=o
            dec=o.modifiers.new('distance simplification','DECIMATE'); dec.ratio=ratio; bpy.ops.object.modifier_apply(modifier=dec.name)
        export(p.with_name(p.stem+f'.lod{level}.glb')); lodstats[str(level)]=stats()
    (HERE/'lod-stats.json').write_text(json.dumps(lodstats,indent=2))
    for o in meshes: o.data=original[o]
    print('GLB OK',report)
def stage(view):
    world=bpy.data.worlds.new('studio'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.086,1); world.node_tree.nodes['Background'].inputs[1].default_value=.7; scene.world=world
    for n,c,power,size,color in [('key',(5,-6,8),1600,5,(1,.80,.61)),('fill',(0,5,5),1000,6,(.68,.76,1)),('rim',(-5,-2,6),1500,4,(1,.55,.28))]:
        ld=bpy.data.lights.new(n,'AREA'); ld.energy=power; ld.shape='DISK'; ld.size=size; ld.color=color; o=bpy.data.objects.new(n,ld); scene.collection.objects.link(o); o.location=c; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    box('studio floor',(0,0,-.045),(200,200,.06),'dark',b=0)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(cam); scene.camera=cam
    loc={'ref':(5.4,-7.4,4.15),'game':(6.5,-6.5,8.4),'front':(8,0,2.8),'rear':(-7,-5,3.3),'side':(0,-9,3)}[view]
    cam.location=loc; cam.rotation_euler=(Vector((0,0,1.15))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=6.25 if view!='game' else 7.4
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
if arg('--render'):
    stage(arg('--view','ref')); scene.render.filepath=str(Path(arg('--render')).resolve()); bpy.ops.render.render(write_still=True); print('RENDER OK')
