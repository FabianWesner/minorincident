"""Minor Incident elderly civilian — deterministic sculpted rigid-part hero.
Run only through experiment/tools/blender_run.py. +X forward, -Y right, Z up.
Subdivision is applied, and static surfaces merge by material inside each joint.
"""
import bpy
import bmesh
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key) + 1] if key in ARGS else default

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
asset = bpy.data.collections.new('CivilianElderly')
scene.collection.children.link(asset)
M = {}
# Identity tokens use spec values; additional flat palette entries describe skin,
# hair, khaki cloth and small trims absent from the starter palette (no textures).
COLORS = {'picketWhite': 'f2e6dc', 'uiDark': '25222c', 'skinWarm': 'f2a77f', 'skinBlush': 'e49b8c', 'skinShadow': 'cf795b', 'hairWarm': '63362b', 'eyeBrown': '542920', 'mouth': 'a34743', 'bandage': 'eac19f', 'silver': 'bbb5ab', 'vest': '752d39', 'vestTrim': '542431', 'argyleRed': 'b65140', 'argyleGold': '9b6546', 'argyleGrey': '63645c', 'shirt': 'ded4be', 'plaidBlue': '8794a1', 'plaidRed': 'b88077', 'trouser': '80644f', 'trouserLight': '93745a', 'trouserSeam': '644d3e', 'cap': '785440', 'capSeam': '543e31', 'hairWhite': 'e2d8d7', 'hairShade': 'b9b0b5', 'shoe': '533328', 'shoeLight': '76513b'}

def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for token, color in COLORS.items():
    m = bpy.data.materials.new('pal_'+token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = srgb(color)
    bs.inputs['Roughness'].default_value = .62 if token.startswith('hair') else .67
    if token in ('eyeBrown', 'uiDark'):
        bs.inputs['Roughness'].default_value = .3
    if token == 'silver':
        bs.inputs['Metallic'].default_value = .35
        bs.inputs['Roughness'].default_value = .38
    m.diffuse_color = srgb(color)
    M[token] = m

N = {}
def joint(name, p, parent=None):
    o = bpy.data.objects.new(name, None)
    asset.objects.link(o)
    o.empty_display_size = .025
    o.location = p
    bpy.context.view_layer.update()
    if parent:
        world = o.matrix_world.copy()
        o.parent = N[parent]
        o.matrix_world = world
    N[name] = o
    bpy.context.view_layer.update()
    return o
joint('root', (0,0,0))
joint('hip', (0,0,.705),'root')
joint('torso',(0,0,.755),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.838),'arm'+side)
    joint('hand'+side,((.105 if s<0 else .025),s*.282,(.810 if s<0 else .684)),'foreArm'+side)
    joint('leg'+side,(0,s*.098,.668),'hip')
    joint('shin'+side,(.008,s*.118,.420),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,((.14 if s<0 else .061),s*.28,(.77 if s<0 else .620)),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='npc.civilian-elderly'
N['root']['forward']='+X'
N['root']['animation']='rigid-part'

# All helper geometry is authored in rest-world coordinates, then parented
# without changing its placement. Joint origins remain exactly at the anatomy.
def finish(o, mat, parent, sub=0):
    if o.name not in asset.objects:
        for c in list(o.users_collection): c.objects.unlink(o)
        asset.objects.link(o)
    o.data.materials.append(M[mat])
    for f in o.data.polygons: f.use_smooth=True
    bpy.context.view_layer.objects.active=o
    o.select_set(True)
    if sub:
        mod=o.modifiers.new('Applied sculpt smoothing','SUBSURF')
        mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    world=o.matrix_world.copy()
    o.parent=N[parent]
    o.matrix_world=world
    o.select_set(False)
    return o

def mesh(name, verts, faces, mat, parent, sub=0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    o=bpy.data.objects.new(name,data)
    asset.objects.link(o)
    return finish(o,mat,parent,sub)

def ell(name, c, r, mat, parent, seg=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=c)
    o=bpy.context.object
    o.name=name
    o.scale=r
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,mat,parent)

def box(name,c,size,mat,parent,bevel=.01,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c)
    o=bpy.context.object
    o.name=name
    o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    b=o.modifiers.new('Soft tailoring','BEVEL')
    b.width=bevel
    b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    w=o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=w.name)
    return finish(o,mat,parent)

def loft(name, rings, mat, parent, seg=16, sub=1):
    # rings: (x,y,z, x-radius,y-radius). Closed, smoothly sculpted volumes.
    vs=[]
    for x,y,z,rx,ry in rings:
        for j in range(seg):
            a=2*math.pi*j/seg
            cx=math.cos(a)
            if name == 'face sculpt' and cx > 0: cx=cx**.45
            vs.append((x+rx*cx,y+ry*math.sin(a),z))
    fs=[]
    for k in range(len(rings)-1):
        for j in range(seg):
            a=k*seg+j; b=k*seg+(j+1)%seg
            fs.append((a,b,b+seg,a+seg))
    fs.extend([tuple(reversed(range(seg))),tuple((len(rings)-1)*seg+j for j in range(seg))])
    return mesh(name,vs,fs,mat,parent,sub)

def tube(name, points, radius, mat, parent, res=3):
    # Tailoring detail follows the applied cloth, with at least 3 mm clearance.
    shell_prefix = 'shirt upper sleeve' if name.startswith('plaid ') else ('vest ribbed hem' if name=='waist knit rib' else None)
    if shell_prefix:
        shell=next(o for o in asset.objects if o.type=='MESH' and o.name.startswith(shell_prefix) and o.parent==N[parent])
        bpy.context.view_layer.update()
        fitted=[]
        for co in points:
            p=Vector(co)
            if shell_prefix=='shirt upper sleeve':
                sign=1 if parent.endswith('L') else -1
                cy=sign*(.241-(p.z-.84)*.061/.17)
                axis=Vector((.014*(1-(p.z-.84)/.17),cy,p.z))
            else:axis=Vector((0,0,p.z))
            normal=p-axis
            if normal.length<.001:normal=Vector((1,0,0))
            normal.normalize()
            hit,loc,_,_=shell.ray_cast(axis+normal*.3,-normal)
            fitted.append(tuple(loc+normal*(.0035+radius)) if hit else co)
        points=fitted
    cu=bpy.data.curves.new(name,'CURVE')
    cu.dimensions='3D'; cu.resolution_u=3; cu.render_resolution_u=3
    cu.use_fill_caps=True; cu.bevel_depth=radius; cu.bevel_resolution=min(res,2)
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu); asset.objects.link(o)
    bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,mat,parent)

def lock(name, points, widths, depths, mat='hairWarm', normal=(1,0,0), parent='head'):
    # Flattened curved leaf/strand; rounded elliptical cross section and a tip.
    vs=[]; seg=10; normal=Vector(normal)
    for k,point in enumerate(points):
        p=Vector(point)
        tangent=Vector(points[min(k+1,len(points)-1)])-Vector(points[max(0,k-1)])
        tangent.normalize()
        across=tangent.cross(normal).normalized()
        out=across.cross(tangent).normalized()
        for j in range(seg):
            a=2*math.pi*j/seg
            v=p+across*(widths[k]*math.cos(a))+out*(depths[k]*math.sin(a))
            vs.append(v)
    fs=[]
    for k in range(len(points)-1):
        for j in range(seg):
            fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    fs.extend([tuple(reversed(range(seg))),tuple((len(points)-1)*seg+j for j in range(seg))])
    return mesh(name,vs,fs,mat,parent,1)

# Shirt under a separately sculpted sleeveless vest.
loft('shirt body',[(0,0,.75,.084,.14),(-.01,0,.87,.093,.155),(0,0,1.005,.07,.16),(0,0,1.035,.04,.055)],'shirt','torso',24,1)
loft('neck',[(0,0,1.01,.037,.046),(0,0,1.085,.045,.048)],'skinWarm','head',20,1)
# A V neckline is built into the top ring rather than painted onto the shell.
vs=[];fs=[];seg=48
for k in range(5):
    for j in range(seg):
        a=j*2*math.pi/seg;c=math.cos(a);s=math.sin(a)
        z=[.746,.76,.84,.94,1.015][k]
        if k==4 and c>0: z=1.015-.055*c**3
        rx=[.091,.103,.110,.106,.073][k];ry=[.143,.154,.164,.174,.157][k]
        vs.append((-.01+rx*c,ry*s,z))
for k in range(4):
    for j in range(seg):fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
vest=mesh('sweater vest shell',vs,fs,'vest','torso',1)
# Reinforce shell thickness without visible hard edges.
bpy.context.view_layer.objects.active=vest
mod=vest.modifiers.new('Knit shell thickness','SOLIDIFY');mod.thickness=.006;bpy.ops.object.modifier_apply(modifier=mod.name)
loft('vest ribbed hem',[(0,0,.742,.093,.145),(0,0,.752,.100,.154),(0,0,.773,.100,.153)],'vestTrim','torso',32,1)
for j in range(40):
    a=j*2*math.pi/40
    tube('waist knit rib',[(.104*math.cos(a),.157*math.sin(a),.746),(.104*math.cos(a),.157*math.sin(a),.768)],.0018,'vest','torso',1)
# Neck and armhole binding follows the shaped vest boundary.
pts=[]
for j in range(49):
    a=j*2*math.pi/48;c=math.cos(a)
    pts.append((-.01+.076*c,.160*math.sin(a),1.015-(.055*c**3 if c>0 else 0)))
tube('V neck ribbing',pts,.009,'vestTrim','torso',2)
for s in [-1,1]:

    verts=[(.04,s*.017,1.028),(.02,s*.058,1.042),(.083,s*.096,.979),(.102,s*.038,.996)]
    verts += [(x-.008,y,z-.006) for x,y,z in verts]
    mesh('shirt collar',verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'shirt','torso')
    tube('collar stitch',[(.043,s*.02,1.03),(.105,s*.038,.997),(.086,s*.096,.98)],.0015,'plaidRed','torso',1)
    tube('collar plaid',[(.037,s*.049,1.033),(.083,s*.065,1.0)],.002,'plaidBlue','torso',1)
ell('shirt button',(.106,0,.998),(.003,.005,.005),'picketWhite','torso',12,8)
# Argyle raised geometry conforms to the sweater (4 mm clearance).
def sweater_x(y,z):
    bpy.context.view_layer.update()
    hit,p,_,_=vest.ray_cast(Vector((.4,y,z)),Vector((-1,0,0)))
    return p.x+.004 if hit else .095
for row,z in enumerate([.802,.862,.915]):
    for col in range(3):
        y=(col-1)*.081+(0.02 if row==1 else 0)
        if abs(y)>.13:continue
        pts=[(y-.030,z),(y,z+.035),(y+.030,z),(y,z-.035)]
        vertices=[(sweater_x(yy,zz),yy,zz) for yy,zz in pts]+[(sweater_x(y,z)+.001,y,z)]
        mesh('argyle diamond',vertices,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],['argyleGold','argyleRed','argyleGrey'][(row+col)%3],'torso')
        tube('argyle stitch',[(sweater_x(yy,zz)+.004,yy,zz) for yy,zz in [pts[0],pts[2]]],.0008,'vestTrim','torso',1)
loft('trouser seat',[(0,0,.64,.076,.128),(0,0,.68,.086,.144),(0,0,.746,.086,.144)],'trouser','hip',24,1)
for s in [-1,1]:
    tube('slant pocket',[(.066,s*.121,.735),(.092,s*.098,.695),(.090,s*.069,.677)],.002,'trouserSeam','hip',1)
    box('rear patch pocket',(-.083,s*.074,.69),(.018,.075,.080),'trouser','hip',.01)
    tube('rear pocket stitch',[(-.095,s*.04,.727),(-.099,s*.04,.673),(-.104,s*.075,.659),(-.099,s*.11,.674),(-.095,s*.11,.727)],.0015,'trouserSeam','hip',1)
tube('fly seam',[(.092,.014,.739),(.098,.014,.688),(.083,.012,.651)],.0015,'trouserSeam','hip',1)
for side,s in [('L',1),('R',-1)]:
    arm='arm'+side;fore='foreArm'+side;hand='hand'+side;leg='leg'+side;shin='shin'+side;foot='foot'+side
    loft('shirt upper sleeve',[(.014,s*.241,.832,.050,.052),(.008,s*.234,.866,.057,.058),(0,s*.205,.953,.060,.060),(0,s*.180,1.01,.049,.049)],'shirt',arm,20,1)
    # Surface grid stripes follow the actual sleeve silhouette.
    for z,y,rx,ry in [(.86,.235,.054,.056),(.90,.222,.058,.059),(.94,.208,.062,.062),(.975,.19,.058,.056)]:
        tube('plaid cross stripe',[(rx*math.cos(a)+.004,s*y+ry*math.sin(a),z) for a in [j*2*math.pi/16 for j in range(17)]],.0023,'plaidRed',arm,1)
    for a in [0,1.1,2.2,3.3,4.4,5.5]:
        tube('plaid length stripe',[(.016+.054*math.cos(a),s*.241+.057*math.sin(a),.843),(.008+.061*math.cos(a),s*.22+.064*math.sin(a),.913),(.061*math.cos(a),s*.187+.059*math.sin(a),.991)],.0022,'plaidBlue',arm,1)
    ell('elbow',(.014,s*.241,.839),(.046,.046,.048),'shirt',fore,20,12)
    if s>0:
        points=[(.025,.279,.714,.032,.035),(.02,.270,.753,.041,.043),(.015,.250,.812,.047,.047),(.014,.241,.849,.048,.048)]
        palm=(.031,.289,.655)
    else:
        points=[(.098,-.282,.825,.035,.035),(.080,-.280,.821,.044,.046),(.043,-.261,.828,.051,.050),(.014,-.241,.85,.046,.047)]
        palm=(.118,-.284,.783)
    sleeve=loft('rolled shirt forearm',points,'shirt',fore,20,1)
    bpy.context.view_layer.update()
    # Geometric plaid continues onto the rolled lower sleeves.
    def plaid_line(samples,token):
        chain=[]
        for yy,zz in samples:
            hit,p,_,_=sleeve.ray_cast(Vector((.4,yy,zz)),Vector((-1,0,0)))
            if hit:chain.append((p.x+.004,yy,zz))
        if len(chain)>1:tube('lower sleeve plaid',chain,.0017,token,fore,1)
    for zz in ([.738,.774,.810] if s>0 else [.811,.837,.860]):
        plaid_line([(s*.27-.065+j*.008,zz) for j in range(17)],'plaidRed')
    for yy in [s*.27-.032,s*.27,s*.27+.032]:
        plaid_line([(yy,.72+j*.008) for j in range(17)],'plaidBlue')
    x,y,z,rx,ry=points[0]
    if s>0:
        loft('rolled cuff',[(x,y,z-.006,rx+.003,ry+.003),(x,y,z+.008,rx+.009,ry+.009),(x,y,z+.029,rx+.004,ry+.004)],'shirt',fore,20,1)
        tube('cuff plaid stripe',[(x+(rx+.009)*math.cos(a),y+(ry+.009)*math.sin(a),z+.012) for a in [j*2*math.pi/16 for j in range(17)]],.002,'plaidBlue',fore,1)
    else:
        tube('right rolled cuff',[(.102,y+.042*math.cos(a),z+.035*math.sin(a)) for a in [j*2*math.pi/16 for j in range(17)]],.009,'shirt',fore,2)
        tube('cuff plaid stripe',[(.112,y+.043*math.cos(a),z+.043*math.sin(a)) for a in [j*2*math.pi/16 for j in range(17)]],.002,'plaidBlue',fore,1)
    ell('wrist',(palm[0]-.015,palm[1],palm[2]+.043),(.033,.033,.045),'skinWarm',hand)
    ell('palm',palm,(.037,.043,.039),'skinWarm',hand,20,12)
    for i in range(4):
        yy=palm[1]+(i-1.5)*.018
        tube('finger',[(palm[0]+.018,yy,palm[2]),(palm[0]+.035,yy,palm[2]-.031),(palm[0]+.019,yy,palm[2]-.048)],.011,'skinWarm',hand,2)
        ell('knuckle',(palm[0]+.032,yy,palm[2]+.008),(.009,.010,.012),'skinWarm',hand,12,8)
    tube('thumb',[(palm[0],palm[1]-s*.03,palm[2]+.016),(palm[0]+.038,palm[1]-s*.043,palm[2]+.009),(palm[0]+.042,palm[1]-s*.03,palm[2]-.009)],.014,'skinWarm',hand,2)
    loft('trouser thigh',[(.007,s*.118,.380,.063,.064),(.006,s*.116,.447,.066,.067),(0,s*.11,.565,.072,.074),(0,s*.098,.711,.079,.080),(0,s*.098,.750,.069,.072)],'trouser',leg,24,1)
    loft('trouser shin',[(-.01,s*.138,.163,.055,.059),(-.011,s*.138,.197,.061,.065),(-.016,s*.136,.257,.057,.061),(-.003,s*.126,.33,.053,.057),(.007,s*.118,.423,.065,.065),(.007,s*.118,.461,.062,.064)],'trouser',shin,24,1)
    ell('knee fabric',(.008,s*.118,.419),(.060,.062,.048),'trouser',shin,20,12)
    loft('turned trouser cuff',[(-.01,s*.138,.159,.058,.062),(-.012,s*.138,.174,.067,.070),(-.012,s*.138,.199,.067,.070),(-.012,s*.138,.21,.061,.065)],'trouserLight',shin,24,1)
    tube('trouser side seam',[(0,s*.183,.646),(0,s*.184,.52),(.003,s*.183,.447)],.0015,'trouserSeam',leg,1)
    tube('shin seam',[(.006,s*.182,.419),(-.010,s*.194,.291),(-.015,s*.203,.213)],.0015,'trouserSeam',shin,1)
    for zz in [.231,.375]:tube('cloth fold',[(.05,s*.10,zz+.009),(.056,s*.14,zz),(.045,s*.18,zz-.007)],.003,'trouserLight',shin,1)
    y=s*.138
    box('rubber sole',(.029,y,.018),(.233,.147,.036),'uiDark',foot,.013)
    box('leather welt',(.029,y,.042),(.237,.150,.028),'shoeLight',foot,.012)
    loft('shoe upper',[(.027,y,.053,.104,.064),(.027,y,.077,.100,.067),(-.008,y,.116,.078,.063),(-.029,y,.154,.050,.051),(-.025,y,.176,.045,.048)],'shoe',foot,24,1)
    ell('round shoe toe',(.107,y,.087),(.048,.065,.036),'shoe',foot,24,12)
    box('shoe tongue',(.025,y,.126),(.031,.065,.066),'shoeLight',foot,.01,rot=(0,-.4,0))
    for d in [-1,1]:
        tube('shoe stitching',[(.113,y+d*.059,.072),(.035,y+d*.068,.095),(-.05,y+d*.054,.122)],.0016,'shoeLight',foot,1)
        for i in range(6):box('sole notch',(-.055+i*.03,y+d*.073,.013),(.01,.008,.015),'uiDark',foot,.002)
    for i in range(4):
        x=.078-i*.014;z=.106+i*.009
        for dy in [-.029,.029]:ell('eyelet',(x,y+dy,z),(.004,.005,.004),'shoeLight',foot,8,6)
        tube('brown lace',[(x,y-.029,z+.005),(x-.004,y,z+.009),(x,y+.029,z+.005)],.0025,'woodWarm' if 'woodWarm' in M else 'shoeLight',foot,1)
# Cane follows the right hand through procedural animation.
tube('cane shaft',[(.125,-.319,.025),(.139,-.309,.36),(.151,-.300,.708),(.154,-.294,.768)],.012,'shoeLight','handR',2)
tube('curved cane grip',[(.154,-.294,.744),(.150,-.291,.798),(.118,-.294,.817),(.074,-.299,.796),(.072,-.299,.751)],.018,'cap','handR',2)
loft('cane rubber ferrule',[(.125,-.319,.0,.017,.017),(.125,-.319,.042,.017,.017)],'uiDark','handR',16,0)
loft('cane brass collar',[(.15,-.30,.693,.014,.014),(.15,-.30,.710,.014,.014)],'shoeLight','handR',16,0)
# Character face: rounded cheeks, narrower chin, broad forehead.
headrings=[(-.004,0,1.057,.041,.052),(0,0,1.072,.077,.090),(.004,0,1.105,.112,.135),
    (0,0,1.155,.134,.153),(-.008,0,1.213,.137,.150),(-.013,0,1.277,.127,.141),
    (-.018,0,1.323,.095,.105),(-.019,0,1.340,.040,.045)]
loft('face sculpt',headrings,'skinWarm','head',32,1)
# Ears have an inset inner bowl and a small tragus.
for s in [-1,1]:
    ell('ear',(-.012,s*.150,1.174),(.031,.021,.043),'skinWarm','head')
    ell('ear inset',(.013,s*.162,1.176),(.011,.011,.027),'skinShadow','head')
    ell('ear inner',(.020,s*.16,1.169),(.007,.009,.015),'skinBlush','head')
    ell('tragus',(.023,s*.15,1.162),(.009,.008,.013),'skinWarm','head',8,6)
# Surface x coordinate near eyes. Narrow depth keeps the eyes nestled in face.
def face_x(y,z):
    return .130*max(.1,1-(y/.153)**2)**.225 - .005
for s in [-1,1]:
    y=s*.062; z=1.210; x=face_x(y,z)
    ell('eye sclera', (x+.004,y,z),(.008,.031,.043),'picketWhite','head',20,12)
    ell('iris', (x+.013,y-.003*s,z-.001),(.0035,.019,.032),'eyeBrown','head',20,12)
    ell('pupil', (x+.016,y-.003*s,z),(.0025,.010,.024),'uiDark','head',20,12)
    ell('eye glint', (x+.019,y-.009*s,z+.014),(.0025,.007,.009),'picketWhite','head',8,6)
    ell('eye glint small',(x+.019,y+.007*s,z-.010),(.002,.003,.004),'picketWhite','head',8,6)
    pts=[]
    for j in range(7):
        a=math.pi*j/6
        yy=y+.032*math.cos(a); zz=z+.043*math.sin(a)
        pts.append((face_x(yy,zz)+.012,yy,zz))
    tube('upper lashes',pts,.0048,'hairWhite','head',2)
    tube('lower lid',[(face_x(y-.026,z)+.01,y-.026,z-.021),(x+.013,y,z-.044),(face_x(y+.026,z)+.01,y+.026,z-.021)],.002,'skinShadow','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.268),(face_x(y,z)+.008,y,1.277),(face_x(y+s*.030,z)+.008,y+s*.032,1.267)],.006,'hairWhite','head',2)
    ell('cheek blush',(face_x(s*.093,1.165)+.008,s*.094,1.165),(.0007,.022,.009),'skinBlush','head',16,8)
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('eye sclera','iris','pupil','eye glint')):
        o.rotation_euler.z=.18 if o.matrix_world.translation.y>0 else -.18
# Rounded nose bridges smoothly into a small button tip.
ell('nose bridge',(.128,0,1.188),(.012,.011,.022),'skinWarm','head')
ell('nose tip',(.149,0,1.176),(.025,.024,.020),'skinWarm','head')
ell('nose light',(.158,-.003,1.180),(.002,.007,.004),'bandage','head',8,6)
for s in [-1,1]: ell('nostril',(.148,s*.012,1.169),(.003,.003,.002),'skinShadow','head',8,6)
tube('smile',[(.119,-.044,1.135),(.133,-.024,1.126),(.138,0,1.123),(.133,.024,1.126),(.119,.044,1.135)],.0025,'mouth','head',2)
tube('smile teeth',[(.133,-.027,1.130),(.139,0,1.126),(.133,.027,1.130)],.0023,'picketWhite','head',1)
tube('lower lip',[(.126,-.012,1.119),(.130,0,1.118),(.125,.014,1.120)],.002,'skinBlush','head',2)

# Gentle elderly face: white brows, moustache lobes and smile creases.
for s in [-1,1]:
    ell('soft cheek',(.099,s*.102,1.154),(.030,.036,.035),'skinWarm','head',20,12)
    tube('smile crease',[(.117,s*.042,1.158),(.128,s*.059,1.139),(.111,s*.066,1.121)],.0015,'skinShadow','head',1)
    lock('white eyebrow',[(.126,s*.029,1.267),(.126,s*.061,1.279),(.113,s*.093,1.269)], [.008,.012,.003],[.007,.010,.003],'hairWhite')
    for j in range(5):
        y=s*(.008+j*.012)
        lock('moustache lock',[(.148,y,1.158),(.154,y+s*.008,1.145),(.143,y+s*.006,1.138+j*.002)], [.010,.012,.002],[.009,.011,.002],'hairWhite')
for s in [-1,1]:
    ell('moustache soft lobe',(.147,s*.030,1.145),(.014,.033,.012),'hairWhite','head',20,12)
# Large circular glasses: open lenses let the character's eyes remain readable.
for s in [-1,1]:
    pts=[]
    for j in range(33):
        a=j*2*math.pi/32;y=s*.064+.047*math.cos(a);z=1.212+.047*math.sin(a)
        pts.append((face_x(y,z)+.025,y,z))
    tube('round spectacles',pts,.0048,'uiDark','head',2)
    tube('spectacle temple',[(.116,s*.112,1.217),(.047,s*.16,1.224),(-.021,s*.167,1.215)],.004,'uiDark','head',2)
    ell('spectacle hinge',(.116,s*.112,1.217),(.005,.006,.005),'capSeam','head',12,8)
tube('spectacle bridge',[(.144,-.018,1.216),(.153,0,1.220),(.144,.018,1.216)],.004,'uiDark','head',2)
# Thick swept white hair visible under the cap, particularly at the back.
ell('white scalp',(-.048,0,1.25),(.112,.155,.096),'hairShade','head',24,16)
for j in range(13):
    a=.67+j*(2*math.pi-1.34)/12;c=math.cos(a);s=math.sin(a)
    lock('swept silver lock',[(-.02+.11*c,.13*s,1.313),(-.034+.139*c,.159*s,1.283),(-.045+.146*c,.166*s,1.235),(-.061+.13*c,.153*s,1.195+.015*math.cos(j*2))],[.026,.035,.031,.002],[.015,.021,.019,.002],'hairWhite',normal=(c,s,.1))
for s in [-1,1]:
    lock('white sideburn',[(.04,s*.133,1.287),(.05,s*.15,1.245),(.045,s*.142,1.184)],[.022,.024,.003],[.012,.015,.003],'hairShade',normal=(.3,s,0))
    lock('temple sweep',[(.09,s*.09,1.305),(.061,s*.144,1.288),(.009,s*.178,1.275),(-.022,s*.188,1.294)],[.022,.029,.022,.002],[.01,.018,.013,.002],'hairWhite',normal=(.2,s,0))
for j in range(6):
    y=(j-2.5)*.045
    lock('nape curl',[(-.159,y,1.276),(-.194,y-.008,1.235),(-.190,y+.012,1.194),(-.161,y+.027,1.183)],[.032,.033,.023,.002],[.011,.017,.014,.002],'hairWhite',normal=(-1,0,0))
# Flat cap: low soft crown, seam panels, covered top button and short bill.
loft('flat cap band',[(-.015,0,1.300,.141,.16),(-.015,0,1.31,.148,.168),(-.015,0,1.327,.149,.168)],'capSeam','head',32,1)
loft('flat cap crown',[(-.02,0,1.319,.147,.170),(-.025,0,1.334,.164,.185),(-.035,0,1.369,.165,.184),(-.042,0,1.396,.13,.146),(-.04,0,1.414,.067,.073),(-.04,0,1.416,.02,.02)],'cap','head',32,1)
ell('cap short visor',(.12,0,1.307),(.09,.146,.014),'cap','head',32,12)
for a in [j*math.pi/3 for j in range(6)]:
    tube('cap panel seam',[(-.04,0,1.421),(-.04+.076*math.cos(a),.079*math.sin(a),1.410),(-.039+.132*math.cos(a),.150*math.sin(a),1.388),(-.025+.17*math.cos(a),.187*math.sin(a),1.350),(-.02+.153*math.cos(a),.173*math.sin(a),1.325)],.0015,'capSeam','head',1)
ell('cap covered button',(-.04,0,1.418),(.013,.013,.006),'capSeam','head',16,8)
tube('bill edge stitching',[(.12+.085*math.cos(a),.14*math.sin(a),1.308) for a in [-1.4,-1,-.6,0,.6,1,1.4]],.0015,'capSeam','head',1)
# Keep the face and hair broad enough to read as the accepted chibi style.
bpy.context.view_layer.update()
for o in asset.objects:
    if o.type=='MESH' and o.parent==N['head']:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            w=o.matrix_world@v.co;w.y*=1.23;w.x*=1.10;v.co=inv@w
# Final reference proportions: a longer vest, shorter roomy trouser legs.
def reshape(p,part):
    p=p.copy()
    if part=='head':p.z-=.025
    elif part=='torso':p.z=1.015+(p.z-1.015)*1.37;p.y*=1.10
    elif part=='hip':p.z-=.098;p.y*=1.10
    elif part.startswith(('leg','shin')):
        p.z=.17+(p.z-.17)*.80
        sign=1 if part.endswith('L') else -1
        p.y=sign*.13+(p.y-sign*.13)*1.14
    elif part.startswith(('foreArm','hand','weaponSocket')) and not part.endswith('R'):
        p.z=.94+(p.z-.94)*1.25
    return p
bpy.context.view_layer.update()
worlds={o:o.matrix_world.copy() for o in asset.objects}
for o in asset.objects:
    if o.type=='MESH':
        inv=worlds[o].inverted()
        for v in o.data.vertices:v.co=inv@reshape(worlds[o]@v.co,o.parent.name)
for name,o in N.items():
    w=worlds[o].copy();w.translation=reshape(w.translation,name);o.matrix_world=w;bpy.context.view_layer.update()
for o,w in worlds.items():
    if o.type=='MESH':o.matrix_world=w
bpy.context.view_layer.update()
# Preserve sculpted silhouette while reducing only dense applied surfaces.
for o in list(asset.objects):
    if o.type!='MESH':continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>350:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Surface budget','DECIMATE');mod.ratio=.60;bpy.ops.object.modifier_apply(modifier=mod.name)
# Merge same-material static geometry within each rigid joint, preserving
# separate shells in the source and every animation/socket node in the GLB.
def consolidate():
    groups={}
    for o in list(asset.objects):
        if o.type=='MESH':
            key=(o.parent.name,o.data.materials[0].name)
            groups.setdefault(key,[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        o=bpy.context.object
        o.name=parent+'.'+mat
        o.select_set(False)
consolidate()
# Explicit triangles and clean bevel/cap slivers avoid exporter-created zero-area
# faces. This changes no visible silhouette and keeps each joint mesh separate.
for o in asset.objects:
    if o.type != 'MESH': continue
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    bad=[f for f in bm.faces if (f.verts[1].co-f.verts[0].co).cross(f.verts[2].co-f.verts[0].co).length<2e-8]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free(); o.data.update()
bpy.context.view_layer.update()
tris=0
for o in asset.objects:
    if o.type=='MESH':
        o.data.calc_loop_triangles()
        tris+=len(o.data.loop_triangles)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
missing=[n for n in required if n not in asset.objects]
report={'id':'npc.civilian-elderly','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':int(arg('--round',5)),'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('GLB OK',arg('--glb'))

def test_pose():
    N['armL'].rotation_euler.x=math.radians(65)
    N['armL'].rotation_euler.y=math.radians(-20)
    N['foreArmL'].rotation_euler.y=math.radians(-80)
    N['legR'].rotation_euler.y=math.radians(-28)
    N['shinR'].rotation_euler.y=math.radians(35)
    bpy.context.view_layer.update()

if '--pose-test' in ARGS: test_pose()

# Studio is separate from exported collection. Orthographic consistent views.
def stage(view):
    world=bpy.data.worlds.new('Warm dusk studio'); scene.world=world
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.14,.16,.21,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    def area(name,loc,power,size,color):
        ld=bpy.data.lights.new(name,'AREA'); ld.energy=power; ld.shape='DISK'; ld.size=size; ld.color=color
        o=bpy.data.objects.new(name,ld); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,.78))-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    area('soft key',(3,-4,5),420,4,(1,.83,.70))
    area('cool fill',(2,4,3),270,3,(.73,.83,1))
    area('golden rim',(-3,-1,3.7),500,3,(1,.61,.34))
    bpy.ops.mesh.primitive_plane_add(size=200)
    ground=bpy.context.object; ground.name='Studio floor'; ground.location.z=-.005
    gm=bpy.data.materials.new('Studio slate'); gm.diffuse_color=(.036,.032,.048,1); gm.use_nodes=True
    bs=gm.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=(.036,.032,.048,1); bs.inputs['Roughness'].default_value=.85
    ground.data.materials.append(gm)
    cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
    scene.collection.objects.link(cam); scene.camera=cam; cam.data.type='ORTHO'
    target=Vector((-.035,0,.70))
    directions={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
    cam.location=target+Vector(directions[view])
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540))
    cam.data.ortho_scale=1.65*scene.render.resolution_x/scene.render.resolution_y
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'
if arg('--render'):
    stage(arg('--view','ref'))
    scene.render.filepath=str(Path(arg('--render')).resolve())
    Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',arg('--render'))
    if '--four-views' in ARGS:
        target=Vector((-.035,0,.70))
        views={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
        for label,direction in views.items():
            scene.camera.location=target+Vector(direction)
            scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            base=Path(arg('--render')).resolve()
            scene.render.filepath=str(base.with_name(base.stem+'-'+label+'.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK',scene.render.filepath)

    if '--deliverables' in ARGS:
        # Hero above is full resolution. Remaining reviews use the agreed light settings.
        scene.cycles.samples=24
        scene.render.resolution_x=960; scene.render.resolution_y=540
        target=Vector((-.035,0,.70))
        views={'front':(5,0,.28),'side':(0,-5,.28),'back':(-5,0,.28),'ref':(6.3,-4.7,2.0)}
        for label,direction in views.items():
            scene.camera.location=target+Vector(direction)
            scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(HERE/'renders'/('final-'+label+'.png'))
            bpy.ops.render.render(write_still=True)
            print('RENDER OK',scene.render.filepath)
        test_pose()
        scene.render.filepath=str(HERE/'renders'/'pose-test.png')
        bpy.ops.render.render(write_still=True)
        print('POSE OK',scene.render.filepath)
