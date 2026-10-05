"""Hero corgi, meters, +X forward, -Y right. Rigid joints; no skin/textures.
Run only through experiment/tools/blender_run.py. --view front|side|back|hero|pose.
Subdivisions and bevels are baked. Body-local geometry is joined by material per joint.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k, d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
if arg('--view') == 'turnaround':
    # Assemble rendered views through Blender; no second rendering toolchain.
    import numpy as np
    tiles=[]
    for name in ('front','side','back','hero'):
        im=bpy.data.images.load(str(HERE/'renders'/f'{name}.png'),check_existing=False)
        im.scale(960,540)
        pixels=np.empty(960*540*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        tiles.append(pixels.reshape(540,960,4))
    sheet=bpy.data.images.new('turnaround',width=3840,height=540,alpha=True)
    sheet.pixels.foreach_set(np.concatenate(tiles,axis=1).ravel())
    sheet.filepath_raw=str(Path(arg('--render',str(HERE/'renders/turnaround.png'))).resolve())
    sheet.file_format='PNG';sheet.save();print('RENDER OK',sheet.filepath_raw);sys.exit(0)

ASSET = {'id':'char.corgi','category':'corgi'}
REQUIRED = ['root','body','head','tail','legFL','legFR','legBL','legBR','packSocket']
M = {}
def mat(token, color, rough=.65, metal=0):
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    c=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=c
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    m.diffuse_color=c; M[token]=m
for t,c in [('corgiOrange','#ed963e'),('corgiOrangeLight','#f6ad55'),('picketWhite','#f2e6dc'),('corgiPink','#e8839f'),('corgiTongue','#ed5e79'),('uiDark','#25222c'),('woodWarm','#b0703f'),('survivorRed','#d9363e'),('backpackTeal','#2f6e6a'),('backpackTealDark','#23524f'),('schoolBusYellow','#f2b630')]: mat(t,c,.58)
M['uiDark'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.24
M['schoolBusYellow'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.65
def joint(name,pos,parent=None):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=pos
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    o.empty_display_size=.035; o['joint']=True
    bpy.context.view_layer.update(); return o
root=joint('root',(0,0,0)); root['asset_id']='char.corgi'; root['forward']='+X'
body=joint('body',(-.12,0,.40),root)
head=joint('head',(.31,0,.54),body)
tail=joint('tail',(-.57,0,.48),body)
pack=joint('packSocket',(-.17,0,.62),body)
def finish(o,name,token,parent,sub=0):
    o.name=name; o.data.materials.append(M[token]); bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod=o.modifiers.new('sculpt smoothing','SUBSURF'); mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons: p.use_smooth=True
    bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o

def ell(name,pos,scale,token,parent=body,rot=None,detail=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=detail,ring_count=10,location=pos)
    o=bpy.context.object; o.scale=scale
    if rot: o.rotation_euler=rot
    return finish(o,name,token,parent)

def box(name,pos,scale,token,parent=body,bevel=.025,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.scale=scale
    if rot: o.rotation_euler=rot
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('soft sewn edges','BEVEL'); mod.width=bevel; mod.segments=3
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,token,parent)

def tube(name,points,r,token,parent=body):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=4; c.bevel_depth=r; c.bevel_resolution=2
    sp=c.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for b,p in zip(sp.bezier_points,points): b.co=p; b.handle_left_type=b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,name,token,parent)

def leaf(name,base,tip,width,depth,token,parent=body):
    # Rounded tapered tuft, or thick triangular ear. Seven rings keep smooth pointed silhouette.
    a,b=Vector(base),Vector(tip); axis=(b-a).normalized()
    u=axis.cross(Vector((1,0,0))).normalized()
    if u.length<.1: u=axis.cross(Vector((0,1,0))).normalized()
    v=axis.cross(u).normalized(); verts=[]; faces=[]
    for i,(t,w) in enumerate([(0,.55),(.12,.95),(.30,1),(.52,.82),(.74,.52),(.9,.24),(1,.025)]):
        p=a+(b-a)*t
        for j in range(8):
            ang=2*math.pi*j/8; q=p+u*(math.cos(ang)*width*w)+v*(math.sin(ang)*depth*w)
            verts.append(tuple(q))
    for i in range(6):
        for j in range(8): faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    faces.extend([tuple(reversed(range(8))),tuple(range(48,56))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); scene.collection.objects.link(o)
    return finish(o,name,token,parent,1)

def ear_panel(name,side,outline,front,thickness,token,bevel):
    # A fitted broad triangular shell; both panels share a planar front surface.
    n=len(outline); verts=[(x,side*y,z) for x in (front-thickness,front) for y,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    for i in range(n): faces.append((i,(i+1)%n,(i+1)%n+n,i+n))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    mod=o.modifiers.new('soft ear edge','BEVEL');mod.width=bevel;mod.segments=4
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('smooth broad ear faces','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,token,head,1)

# Barrel and white undersides, with irregular layered fur transition.
ell('orange barrel',(-.19,0,.40),(.47,.232,.25),'corgiOrange')
ell('cream belly',(-.13,0,.303),(.425,.214,.146),'picketWhite')
ell('chest ruff',(.235,0,.379),(.197,.247,.243),'picketWhite')
ell('rump',(-.485,0,.37),(.202,.24,.218),'corgiOrange')
ell('rump cream',(-.545,0,.245),(.162,.209,.123),'picketWhite')
for s in (-1,1):
    for i,x in enumerate([-.52,-.40,-.28,-.14,.015,.16]):
        leaf('flank fur', (x,s*.177,.43),(x-.035,s*.224,.29+(i%2)*.018),.058,.035,'corgiOrange')
    for i,z in enumerate([.47,.40,.33]):
        leaf('bib fur',(.32,s*.12,z),(.37,s*.14,z-.105),.058,.045,'picketWhite')
for side in (-1,1):
    for i in range(3):
        leaf('rump cream tuft',(-.52,side*.158,.257+i*.024),(-.59,side*.22,.204+i*.029),.035,.024,'picketWhite')
# Short chunky feet. Pivots at the upper leg, under the fur of the body.
for name,x,y in [('legFL',.255,.162),('legFR',.255,-.162),('legBL',-.475,.166),('legBR',-.475,-.166)]:
    j=joint(name,(x,y,.32),body)
    ell(name+' thigh',(x,y,.244),(.087,.094,.135),'corgiOrange',j)
    ell(name+' sock',(x+.019,y,.138),(.078,.080,.107),'picketWhite',j)
    ell(name+' paw',(x+.045,y,.061),(.099,.085,.061),'picketWhite',j)
    for d in [-.047,0,.047]:
        ell(name+' toe',(x+.105,y+d,.032),(.039,.029,.032),'picketWhite',j,detail=16)
    for d in [-.024,.024]:
        tube(name+' toe seam',[(x+.130,y+d,.054),(x+.127,y+d,.081),(x+.105,y+d,.092)],.002,'corgiPink',j)
# Happy upright short tail with white fluffy tip.
ell('tail base',(-.622,0,.526),(.113,.11,.12),'corgiOrange',tail,rot=(0,-.6,0))
ell('tail tip',(-.680,0,.597),(.090,.09,.101),'picketWhite',tail,rot=(0,-.65,0))
for s in (-1,1):
    for i in range(3):
        leaf('tail tuft',(-.68,s*.065,.56+i*.027),(-.75-i*.007,s*.065,.59+i*.034),.040,.028,'picketWhite',tail)
# Head and upright ears. Thick external shells and smaller recessed inner pink shells.
ell('head orange',(.409,0,.599),(.257,.252,.24),'corgiOrange',head,detail=32)
for s in (-1,1):
    ear_panel('ear shell',s,[(.077,.733),(.104,.823),(.242,.961),(.278,.939),(.291,.823),(.251,.735)],.432,.055,'corgiOrange',.022)
    ear_panel('ear pink inset',s,[(.120,.772),(.144,.829),(.242,.924),(.249,.909),(.255,.823),(.225,.776)],.434,.006,'corgiPink',.004)
    ell('cheek white',(.493,s*.17,.492),(.17,.136,.109),'picketWhite',head)
    for i in range(4):
        z=.56-i*.039
        leaf('cheek ruff',(.550,s*.218,z),(.526-i*.009,s*(.310-i*.019),z-.038),.046,.034,'picketWhite',head)
# White forehead stripe follows head surface, not a floating planar decal.
verts=[]; faces=[]
for i in range(25):
    theta=-.24+2.19*i/24; w=.036+.008*math.sin(i/24*math.pi)
    for j in range(5):
        y=(j/4*2-1)*w; f=math.sqrt(1-(y/.252)**2)
        x=.409+.260*math.cos(theta)*f; z=.599+.242*math.sin(theta)*f
        verts.append((x,y,z))
for i in range(24):
    for j in range(4): a=i*5+j; faces.append((a,a+1,a+6,a+5))
mesh=bpy.data.meshes.new('blaze'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('forehead blaze',mesh); scene.collection.objects.link(o); finish(o,'forehead blaze','picketWhite',head)
# Eyebrows, dark glossy eyes and tiny cream reflections.
for s in (-1,1):
    ell('eye socket',(.618,s*.148,.641),(.040,.048,.065),'woodWarm',head,rot=(0,0,s*.34))
    ell('eye',(.637,s*.149,.647),(.027,.037,.051),'uiDark',head,rot=(0,0,s*.34),detail=24)
    ell('eye glint',(.662,s*.143,.672),(.007,.011,.013),'picketWhite',head,detail=16)
    ell('eye small glint',(.661,s*.161,.637),(.004,.005,.005),'picketWhite',head,detail=12)
    tube('soft brow',[(.614,s*.098,.706),(.604,s*.149,.718),(.575,s*.190,.703)],.013,'corgiOrangeLight',head)
# Dark smiling mouth cavity sits behind the muzzle, with cream chin and two small teeth.
ell('cream lower jaw',(.653,0,.415),(.124,.138,.055),'picketWhite',head)
ell('smile cavity',(.710,0,.475),(.072,.147,.092),'uiDark',head,detail=28)
for s in (-1,1):
    ell('muzzle lobe',(.696,s*.076,.541),(.113,.099,.067),'picketWhite',head,detail=24)
    tube('smile corner',[(.734,s*.132,.494),(.722,s*.15,.518),(.686,s*.154,.532)],.006,'uiDark',head)
    leaf('little canine',(.758,s*.09,.493),(.761,s*.083,.471),.014,.009,'picketWhite',head)
# Broad soft nose.
ell('nose cushion',(.809,0,.573),(.036,.053,.029),'uiDark',head,detail=24)
ell('nose shine',(.827,-.018,.581),(.003,.012,.005),'woodWarm',head,detail=12)
tube('philtrum',[(.789,0,.554),(.794,0,.524),(.756,0,.513)],.005,'uiDark',head)
ell('tongue',(.788,0,.428),(.097,.064,.026),'corgiTongue',head,rot=(0,.35,0),detail=24)
ell('tongue rounded tip',(.861,0,.395),(.044,.061,.026),'corgiTongue',head,rot=(0,.7,0),detail=24)
tube('tongue groove',[(.780,0,.453),(.817,0,.434),(.854,0,.418)],.0028,'corgiPink',head)
# Red collar wrapping the neck, separate thick shell with piping, ring and golden bell.
points=[(.32,-.237,.475),(.39,-.245,.404),(.457,-.17,.362),(.48,0,.357),(.457,.17,.362),(.39,.245,.404),(.32,.237,.475),(.23,0,.49),(.32,-.237,.475)]
tube('red collar',points,.029,'survivorRed')
for dx in [-.016,.016]: tube('collar edging',[(x+dx,y,z) for x,y,z in points],.004,'survivorRed')
tube('bell hanger',[(.48,-.021,.348),(.513,-.021,.326),(.513,.021,.326),(.48,.021,.348)],.008,'schoolBusYellow')
ell('gold bell',(.515,0,.285),(.040,.044,.049),'schoolBusYellow')
ell('bell dark slot',(.553,0,.266),(.002,.019,.004),'woodWarm',detail=12)
# Teal harness straps curve over the body, two bags, leather edging, rivets, buckles.
for x in [-.38,.035]:
    p=[(x,-.228,.33),(x,-.235,.47),(x,-.165,.598),(x,0,.655),(x,.165,.598),(x,.235,.47),(x,.228,.33)]
    tube('harness dark piping',p,.022,'backpackTealDark',pack)
    tube('harness strap',[(a,b,c+.003) for a,b,c in p],.017,'backpackTeal',pack)
for s in [-1,1]:
    y=s*.277
    box('saddlebag outer piping',(-.23,y,.493),(.373,.138,.299),'backpackTealDark',pack,.048)
    box('saddlebag canvas',(-.23,y+s*.014,.502),(.354,.124,.278),'backpackTeal',pack,.039)
    box('front pocket piping',(-.23,y+s*.078,.418),(.283,.028,.111),'backpackTealDark',pack,.016)
    box('front pocket',(-.23,y+s*.094,.422),(.269,.021,.095),'backpackTeal',pack,.014)
    box('bag flap piping',(-.23,y+s*.078,.584),(.358,.038,.151),'backpackTealDark',pack,.025)
    box('bag flap',(-.23,y+s*.103,.590),(.339,.027,.138),'backpackTeal',pack,.022)
    box('closure webbing',(-.23,y+s*.11,.45),(.041,.025,.125),'backpackTealDark',pack,.005)
    # Frame buckle with four rounded bars, actual hollow center.
    for dx,dz,sx,sz in [(-.025,0,.012,.052),(.025,0,.012,.052),(0,-.022,.051,.012),(0,.022,.051,.012)]:
        box('brass buckle',(-.23+dx,y+s*.129,.444+dz),(sx,.012,sz),'schoolBusYellow',pack,.004)
    box('buckle tongue',(-.23,y+s*.14,.444),(.009,.013,.05),'woodWarm',pack,.003)
    for x in [-.365,-.095]:
        for z in [.414,.587]: ell('bag rivet',(x,y+s*.125,z),(.005,.003,.005),'schoolBusYellow',pack,detail=12)
    # Embroidered raised corgi badge on each flap: cream oval, orange face, ears, muzzle, eyes.
    yy=y+s*.123
    ell('patch base',(-.23,yy,.583),(.059,.004,.047),'picketWhite',pack,detail=20)
    ell('patch orange face',(-.23,yy+s*.004,.59),(.046,.004,.035),'corgiOrange',pack,detail=20)
    for dx in [-.033,.033]:
        leaf('patch ear',(-.23+dx,yy,.610),(-.23+dx*1.35,yy,.646),.014,.006,'corgiOrange',pack)
        ell('patch white muzzle',(-.23+dx*.4,yy+s*.009,.573),(.022,.003,.017),'picketWhite',pack,detail=12)
        ell('patch eye',(-.23+dx*.60,yy+s*.010,.595),(.006,.003,.008),'uiDark',pack,detail=12)
    ell('patch nose',(-.23,yy+s*.015,.579),(.007,.003,.005),'uiDark',pack,detail=12)
    ell('patch tongue',(-.23,yy+s*.011,.56),(.008,.003,.008),'corgiTongue',pack,detail=12)
# Handle and top medical roll, reference rear flap has red cross.
box('top saddle bridge',(-.23,0,.659),(.34,.32,.061),'backpackTeal',pack,.02)
tube('pack carry handle',[(-.295,-.04,.694),(-.295,-.04,.725),(-.18,-.04,.725),(-.18,-.04,.694)],.009,'woodWarm',pack)
box('rear medical tab',(-.413,0,.652),(.022,.159,.075),'backpackTealDark',pack,.009)
box('red medical cross horizontal',(-.429,0,.655),(.009,.106,.023),'survivorRed',pack,.004)
box('red medical cross vertical',(-.430,0,.655),(.01,.028,.067),'survivorRed',pack,.004)

# Merge by joint and material to reduce draw calls while keeping animation hierarchy.
for parent in [body,head,tail,pack]+[bpy.data.objects[n] for n in REQUIRED if n.startswith('leg')]:
    for material in M.values():
        batch=[o for o in scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==material]
        if not batch: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch: o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join(); batch[0].name=parent.name+'__'+material.name
bpy.context.view_layer.update()
meshes=[o for o in scene.objects if o.type=='MESH']
for o in meshes: o.data.calc_loop_triangles()
stats={'id':'char.corgi','triangles':sum(len(o.data.loop_triangles) for o in meshes),'meshes':len(meshes),'nodes_ok':all(n in bpy.data.objects for n in REQUIRED),'missing_nodes':[n for n in REQUIRED if n not in bpy.data.objects]}
(HERE/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root,body,head,tail,pack]+[bpy.data.objects[n] for n in REQUIRED if n.startswith('leg')]+meshes: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('EXPORT OK',json.dumps(stats))
# Pose only after rest-pose export. Shoulder and hip swings plus inquisitive neck tilt.
if arg('--view')=='pose':
    bpy.data.objects['legFL'].rotation_euler.y=-.48
    bpy.data.objects['legBR'].rotation_euler.y=.38
    head.rotation_euler.x=.13; head.rotation_euler.y=-.10
    tail.rotation_euler.x=.35
    bpy.context.view_layer.update()
if arg('--render'):
    # Studio objects created after GLB export; they never enter the game asset.
    stage=bpy.data.materials.new('studio backdrop');stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.028,.045,1);stage.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003)); bpy.context.object.data.materials.append(stage)
    world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.16,.22,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(name,pos,power,color,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.45))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm softbox',(2,-3,4),180,(1,.80,.61),3)
    light('cool fill',(1,3,2.5),100,(.65,.77,1),3)
    light('golden rim',(-2,1,3),200,(1,.65,.34),2)
    view=arg('--view','hero'); target=Vector((.015,0,.48))
    views={'front':(3,0,.90),'side':(0,-3,.82),'back':(-3,0,.90),'hero':(2.4,-3.3,1.7),'pose':(2.4,-3.3,1.7)}
    cam=bpy.data.objects.new('studio camera',bpy.data.cameras.new('studio camera'));scene.collection.objects.link(cam)
    cam.location=views[view];cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.12;scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples',24));scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
    except Exception: scene.cycles.device='CPU'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=int(arg('--width',960));scene.render.resolution_y=int(arg('--height',540));scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(arg('--render')).resolve())
    bpy.ops.render.render(write_still=True);print('RENDER OK',arg('--render'))
