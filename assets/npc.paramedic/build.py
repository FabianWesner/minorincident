"""Minor Incident paramedic — deterministic sculpted rigid-part hero.
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
asset = bpy.data.collections.new('Paramedic')
scene.collection.children.link(asset)
M = {}
# Repository palette only; flat materials with no textures.
COLORS = json.loads((HERE.parents[1]/'src/assets/palette.json').read_text())

def srgb(h):
    rgb = [int(h.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
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
joint('hip', (0,0,.650),'root')
joint('torso',(0,0,.690),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.838),'arm'+side)
    joint('hand'+side,(.025,s*.282,.684),'foreArm'+side)
    joint('leg'+side,(0,s*.105,.625),'hip')
    joint('shin'+side,(.008,s*.118,.395),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='npc.paramedic'
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
    o=mesh(name,vs,fs,mat,parent,sub)
    if not sub:
        for f in o.data.polygons[-2:]: f.use_smooth=False
    return o

def tube(name, points, radius, mat, parent, res=3):
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

# Sculpted tucked uniform, sewn shell pieces and raised insignia.
loft('EMS shirt',[(0,0,.645,.074,.113),(0,0,.67,.087,.132),(0,0,.77,.097,.146),(-.005,0,.88,.091,.157),(0,0,.97,.075,.167),(0,0,1.012,.052,.132),(0,0,1.03,.031,.052)],'picketWhite','torso',24)
loft('neck',[(0,0,1.01,.035,.040),(0,0,1.055,.040,.043),(0,0,1.085,.045,.049)],'skinWarm','head')
loft('collar stand',[(0,0,1.008,.044,.059),(0,0,1.035,.044,.060)],'picketWhite','torso',24)
for s in [-1,1]:
    o=box('folded collar',(.065,s*.046,1.005),(.026,.075,.077),'picketWhite','torso',.008,rot=(s*.35,.25,s*.25))
box('shirt placket',(.096,0,.824),(.015,.022,.293),'silver','torso',.004)
box('placket facing',(.105,0,.824),(.008,.018,.292),'picketWhite','torso',.003)
for z in [.71,.78,.85,.92,.975]: ell('brass shirt button',(.113,0,z),(.004,.005,.005),'brass','torso',10,6)
for s in [-1,1]:
    box('shirt pocket',(.094,s*.082,.862),(.017,.075,.080),'picketWhite','torso',.010)
    tube('pocket stitching',[(.107,s*.05,.898),(.111,s*.05,.832),(.115,s*.083,.825),(.107,s*.115,.834),(.105,s*.115,.898)],.0015,'silver','torso',1)
    tube('red harness strap',[(.068,s*.126,.68),(.107,s*.137,.80),(.100,s*.132,.94),(.02,s*.12,1.035),(-.088,s*.118,1.017),(-.12,s*.12,.88)],.021,'redDark','torso',2)
    tube('harness inset',[(.086,s*.126,.69),(.127,s*.137,.80),(.120,s*.132,.94),(.038,s*.12,1.035)],.009,'survivorRed','torso',1)
    for z in [.76,.945]: box('harness adjuster',(.132,s*.137,z),(.013,.043,.023),'uiDark','torso',.004)
# Chest radio and enamel identity badge.
box('radio clip',(.12,-.064,.875),(.020,.030,.115),'uiDark','torso',.004)
box('EMS radio',(.142,-.066,.920),(.035,.042,.070),'navy','torso',.010)
box('radio display',(.164,-.066,.937),(.005,.024,.017),'silver','torso',.003)
for z in [.902,.910,.918]: box('radio speaker',(.164,-.066,z),(.005,.028,.003),'uiDark','torso',.001)
ell('radio button',(.166,-.05,.943),(.003,.005,.005),'brass','torso',10,6)
tube('radio antenna',[(.14,-.066,.950),(.133,-.071,1.008)],.003,'uiDark','torso',1)
box('name badge',(.120,.075,.920),(.013,.060,.024),'brass','torso',.004)
box('badge enamel',(.129,.075,.920),(.004,.040,.011),'picketWhite','torso',.002)
# Utility belt and buckle are dimensional, with hanging pouches.
loft('hip trousers',[(0,0,.566,.068,.128),(0,0,.601,.080,.140),(0,0,.657,.080,.134)],'navy','hip',24)
loft('utility belt',[(0,0,.637,.086,.141),(0,0,.668,.086,.141)],'uiDark','hip',24,0)
box('belt buckle',(.097,0,.652),(.027,.070,.054),'silver','hip',.006)
box('buckle inset',(.113,0,.652),(.006,.047,.034),'leather','hip',.003)
box('buckle pin',(.119,0,.652),(.006,.036,.005),'silver','hip',.002)
for s in [-1,1]:
    for j in range(2):
        y=s*(.070+j*.081)
        box('belt pouch',(.072,y,.611),(.061,.064,.093),'navy','hip',.012)
        box('pouch flap',(.106,y,.637),(.013,.066,.033),'navySeam','hip',.005)
        ell('pouch fastener',(.116,y,.633),(.004,.005,.005),'brass','hip',10,6)
    box('side belt loop',(-.024,s*.143,.654),(.040,.014,.054),'navySeam','hip',.004)
    tube('hip gear cable',[(.064,s*.165,.637),(.054,s*.191,.560),(.064,s*.13,.553),(.09,s*.099,.60)],.003,'leather','hip',1)
# Six-point medical star, raised clear of the underlying panel. axis X faces.
def medical_star(name,c,r,parent,mat='picketWhite',axis='X'):
    # One closed six-spoke outline: no overlapping/coplanar bar faces.
    outline=[]
    for i in range(6):
        a=i*math.pi/3
        outline.append((r*.32*math.sin(a-math.pi/6),r*.32*math.cos(a-math.pi/6)))
        for sign in [-1,1]:
            outline.append((r*(.875*math.sin(a)+sign*.16*math.cos(a)),r*(.875*math.cos(a)-sign*.16*math.sin(a))))
    x,y,z=c; verts=[]
    for depth in [-.0045,.0045]:
        for u,v in outline:
            verts.append((x+depth,y+u,z+v) if axis=='X' else (x+u,y+depth,z+v))
    n=len(outline)
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,verts,faces,mat,parent)
    bpy.context.view_layer.objects.active=o
    be=o.modifiers.new('Insignia edge','BEVEL');be.width=.0015;be.segments=2
    bpy.ops.object.modifier_apply(modifier=be.name)
    return o

for side,s in [('L',1),('R',-1)]:
    arm='arm'+side; fore='foreArm'+side; hand='hand'+side; leg='leg'+side; shin='shin'+side; foot='foot'+side
    loft('short sleeve',[(0,s*.177,1.018,.041,.046),(0,s*.204,.987,.057,.061),(0,s*.217,.938,.061,.060),(0,s*.224,.906,.057,.056)],'picketWhite',arm,20)
    loft('sleeve folded cuff',[(0,s*.224,.902,.060,.059),(0,s*.224,.915,.065,.063),(0,s*.224,.936,.061,.060)],'picketWhite',arm,20)
    box('blue shoulder patch',(.034,s*.249,.966),(.063,.020,.073),'policeBlue',arm,.016)
    medical_star('sleeve medical star',(.035,s*.264,.966),.032,arm,axis='Y')
    loft('upper arm skin',[(.004,s*.225,.910,.041,.040),(.010,s*.241,.840,.038,.039)],'skinWarm',arm,20)
    ell('elbow',(.010,s*.241,.838),(.040,.040,.041),'skinWarm',fore,16,10)
    loft('forearm',[(.010,s*.241,.846,.037,.039),(.015,s*.258,.787,.040,.041),(.025,s*.28,.708,.029,.031),(.025,s*.283,.684,.027,.029)],'skinWarm',fore,20)
    loft('glove cuff',[(.025,s*.282,.682,.036,.039),(.025,s*.281,.699,.039,.041),(.024,s*.278,.720,.036,.038)],'navy',fore,20)
    box('cuff closure',(.059,s*.282,.700),(.015,.039,.027),'navySeam',fore,.006)
    ell('cuff snap',(.071,s*.282,.700),(.003,.006,.006),'brass',fore,10,6)
    ell('glove palm',(.025,s*.290,.649),(.034,.039,.048),'navy',hand,20,12)
    box('glove padded back',(.058,s*.291,.655),(.010,.045,.038),'navySeam',hand,.008)
    for i in range(4):
        y=s*(.270+i*.015)
        tube('gloved finger',[(.030,y,.647),(.047,y,.614),(.037,y,.591+(.005 if i==3 else 0))],.010,'navy',hand,1)
        ell('knuckle padding',(.053,y,.638),(.007,.009,.012),'navySeam',hand,10,6)
    tube('gloved thumb',[(.040,s*.267,.674),(.064,s*.256,.652),(.065,s*.262,.632)],.013,'navy',hand,1)
    loft('cargo thigh',[(.006,s*.118,.380,.061,.062),(.004,s*.118,.418,.066,.065),(0,s*.112,.512,.069,.071),(0,s*.105,.620,.074,.075),(0,s*.104,.644,.067,.067)],'navy',leg,24)
    loft('trouser shin',[(-.006,s*.138,.159,.054,.057),(-.010,s*.138,.183,.063,.064),(-.015,s*.137,.229,.056,.061),(-.004,s*.130,.290,.055,.057),(.008,s*.118,.378,.063,.062),(.008,s*.118,.409,.060,.059)],'navy',shin,24)
    ell('knee cloth',(.012,s*.118,.397),(.062,.060,.047),'navy',shin,20,12)
    box('knee reinforcement',(.069,s*.118,.415),(.016,.093,.105),'navySeam',leg,.022)
    for z in [.263,.309]:
        loft('yellow reflective wrap',[(0,s*.13,z-.016,.064,.070),(0,s*.13,z+.016,.064,.070)],'schoolBusYellow',shin,24,0)
    loft('reflective silver separator',[(0,s*.13,.283,.062,.066),(0,s*.13,.289,.062,.066)],'silver',shin,24,0)
    for z in [.181,.221]:
        ell('gathered trouser fold',(-.006,s*.138,z),(.062,.064,.017),'navy',shin,16,8)
    box('cargo bellows',(0,s*.185,.501),(.102,.032,.112),'navy',leg,.014)
    box('cargo flap',(.010,s*.205,.552),(.110,.012,.032),'navySeam',leg,.007)
    ell('cargo snap',(.013,s*.215,.552),(.005,.003,.005),'brass',leg,10,6)
    tube('thigh seam',[(0,s*.181,.606),(0,s*.184,.486),(0,s*.176,.412)],.002,'navySeam',leg,1)
    if side=='R':
        for z in [.473,.517]:
            loft('thigh equipment strap',[(0,s*.113,z-.010,.073,.077),(0,s*.113,z+.010,.073,.077)],'leather',leg,24,0)
            box('thigh strap buckle',(.078,s*.143,z),(.014,.026,.023),'silver',leg,.004)
        box('tool holster',(.005,s*.208,.473),(.050,.028,.133),'uiDark',leg,.007)
        box('rescue shears handle',(.010,s*.218,.551),(.024,.018,.042),'redDark',leg,.008)
    y=s*.138
    box('boot outsole',(.030,y,.024),(.237,.146,.048),'uiDark',foot,.014)
    box('sole welt',(.030,y,.054),(.235,.144,.021),'leatherEdge',foot,.009)
    loft('boot upper',[(.027,y,.066,.103,.062),(.019,y,.09,.095,.063),(-.013,y,.132,.072,.059),(-.026,y,.172,.051,.054),(-.026,y,.194,.048,.050)],'uiDark',foot,24)
    ell('rounded toe cap',(.106,y,.095),(.047,.063,.035),'navy',foot,20,12)
    box('heel counter',(-.065,y,.110),(.033,.108,.075),'navy',foot,.013)
    box('boot tongue',(.029,y,.145),(.033,.065,.094),'navySeam',foot,.012,rot=(0,-.32,0))
    for d in [-1,1]:
        tube('boot seam',[(.106,y+d*.057,.094),(.031,y+d*.064,.128),(-.051,y+d*.056,.147)],.002,'leatherEdge',foot,1)
        for j in range(7): box('sole lug',(-.069+j*.029,y+d*.07,.018),(.017,.009,.025),'uiDark',foot,.002)
    for j in range(4):
        x=.081-j*.014; z=.115+j*.011
        for d in [-1,1]: ell('boot eyelet',(x,y+d*.032,z),(.005,.006,.004),'silver',foot,8,6)
        tube('boot lace',[(x,y-.033,z+.006),(x-.006,y,z+.010),(x,y+.033,z+.006)],.003,'leatherEdge',foot,1)
# Tailored rear pockets and tiny outside lash tips finish the turnaround.
for side,s in [('L',1),('R',-1)]:
    box('rear trouser pocket',(-.073,s*.105,.578),(.015,.073,.068),'navySeam','leg'+side,.009)
    tube('rear pocket stitch',[(-.083,s*.072,.606),(-.084,s*.077,.550),(-.084,s*.109,.544),(-.083,s*.141,.553),(-.081,s*.144,.605)],.0015,'navy','leg'+side,1)
# Worn backpack and hand bag; fixed to the torso and left-hand joint respectively.
def bag(name,c,size,parent):
    x,y,z=c; dx,dy,dz=size
    box(name+' rounded shell',c,size,'survivorRed',parent,.032)
    for face in [-1,1]:
        xx=x+face*(dx/2+.006)
        box(name+' zipper border',(xx,y,z),(.014,dy*.94,dz*.94),'redDark',parent,.025)
        box(name+' face panel',(xx+face*.010,y,z),(.011,dy*.84,dz*.84),'survivorRed',parent,.022)
        medical_star(name+' medical insignia',(xx+face*.021,y,z+.015),dy*.30,parent)
        box(name+' reflective strip',(xx+face*.021,y,z-dz*.29),(.007,dy*.75,.022),'silver',parent,.003)
        for s in [-1,1]:
            tube(name+' piping',[(xx+face*.017,y+s*dy*.42,z-dz*.35),(xx+face*.017,y+s*dy*.45,z),(xx+face*.017,y+s*dy*.40,z+dz*.37)],.003,'redShadow',parent,1)
            box(name+' webbing',(xx+face*.022,y+s*dy*.34,z+dz*.32),(.010,.022,dz*.22),'leather',parent,.004)
            ell(name+' brass stud',(xx+face*.03,y+s*dy*.34,z+dz*.26),(.004,.007,.007),'brass',parent,10,6)
            box(name+' corner guard',(xx+face*.020,y+s*dy*.35,z-dz*.35),(.013,.022,.054),'brass',parent,.004)
    tube(name+' carry handle',[(x,y-dy*.23,z+dz*.50),(x,y-dy*.20,z+dz*.62),(x,y+dy*.20,z+dz*.62),(x,y+dy*.23,z+dz*.50)],.008,'uiDark',parent,1)
    for s in [-1,1]:
        box(name+' side strap',(x,y+s*(dy/2+.004),z),(.032,.015,dz*.88),'uiDark',parent,.006)
        box(name+' side adjuster',(x,y+s*(dy/2+.015),z+.035),(.043,.009,.030),'silver',parent,.003)
bag('medical backpack',(-.163,0,.857),(.145,.285,.310),'torso')
bag('hand medical case',(.031,.342,.463),(.123,.197,.207),'handL')
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
    tube('upper lashes',pts,.0048,'hairShadow','head',2)
    tube('lower lid',[(face_x(y-.026,z)+.01,y-.026,z-.021),(x+.013,y,z-.044),(face_x(y+.026,z)+.01,y+.026,z-.021)],.002,'skinShadow','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.268),(face_x(y,z)+.008,y,1.277),(face_x(y+s*.030,z)+.008,y+s*.032,1.267)],.006,'hairShadow','head',2)
    ell('cheek blush',(face_x(s*.093,1.165)+.008,s*.094,1.165),(.0007,.022,.009),'skinBlush','head',16,8)
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('eye sclera','iris','pupil','eye glint')):
        o.rotation_euler.z=.18 if o.matrix_world.translation.y>0 else -.18
# Rounded nose bridges smoothly into a small button tip.
ell('nose bridge',(.128,0,1.188),(.012,.011,.022),'skinWarm','head')
ell('nose tip',(.144,0,1.176),(.016,.016,.013),'skinWarm','head')
ell('nose light',(.158,-.003,1.180),(.002,.007,.004),'bandage','head',8,6)
for s in [-1,1]: ell('nostril',(.148,s*.012,1.169),(.003,.003,.002),'skinShadow','head',8,6)
tube('smile',[(.119,-.044,1.135),(.133,-.024,1.126),(.138,0,1.123),(.133,.024,1.126),(.119,.044,1.135)],.0025,'mouth','head',2)

tube('lower lip',[(.126,-.012,1.119),(.130,0,1.118),(.125,.014,1.120)],.002,'skinBlush','head',2)

# Open-faced scalp cap with thick layered crown, nape and swept fringe.
vs=[]; fs=[]; segments=32; rows=9
for k in range(rows):
    t=k/(rows-1)
    for j in range(segments):
        a=2*math.pi*j/segments
        edge=.96+1.12*(1-math.cos(a))/2
        ph=.025+(edge-.025)*t
        vs.append((-.024+.148*math.sin(ph)*math.cos(a),.162*math.sin(ph)*math.sin(a),1.199+.166*math.cos(ph)))
for k in range(rows-1):
    for j in range(segments): fs.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
fs.append(tuple(reversed(range(segments))))
mesh('hair scalp',vs,fs,'hairShadow','head',1)
for i in range(13):
    a=.70+i*.40; c=math.cos(a); q=math.sin(a)
    pts=[(-.012+.035*c,.036*q,1.372),(-.023+.109*c,.121*q,1.342),
         (-.026+.157*c,.168*q,1.282),(-.04+.153*c,.168*q,1.221),
         (-.038+.132*c,.153*q,1.127+.030*math.sin(a*3)+(.075 if c>0 else 0))]
    lock('layered crown '+str(i),pts,[.027,.044,.043,.028,.001],[.013,.021,.025,.018,.001],
         'hairAuburn' if i%3 else 'hairShadow',normal=(c,q,.3))
# Broad front locks sweep outwards from a right-of-center part.
bangs=[
    ([(.040,-.029,1.363),(.113,-.012,1.349),(.151,.047,1.314),(.131,.122,1.286),(.090,.167,1.298)], [ .027,.037,.038,.026,.001]),
    ([(.052,-.027,1.351),(.138,.014,1.320),(.157,.059,1.278),(.138,.082,1.239)], [.024,.032,.026,.001]),
    ([(.042,-.038,1.360),(.132,-.082,1.328),(.143,-.132,1.285),(.10,-.168,1.272),(.074,-.182,1.288)], [.027,.037,.031,.024,.001]),
    ([(.045,-.042,1.354),(.139,-.044,1.323),(.155,-.033,1.281),(.131,-.045,1.241)], [.020,.030,.021,.001]),
    ([(.016,.040,1.369),(.074,.089,1.357),(.110,.149,1.336),(.053,.189,1.345)], [.025,.042,.032,.001]),
]
for i,(pts,widths) in enumerate(bangs):
    lock('swept fringe '+str(i),pts,widths,[.014]+[.024]*(len(pts)-2)+[.001], 'hairAuburn' if i%2==0 else 'hairShadow')
for s in [-1,1]:
    lock('temple sideburn',[(.012,s*.139,1.304),(.041,s*.163,1.265),(.045,s*.158,1.213),(.050,s*.14,1.182)],
         [.022,.027,.020,.001],[.013,.020,.014,.001],'hairShadow',normal=(.3,s,0))
    lock('side flick',[(0,s*.134,1.313),(-.028,s*.166,1.288),(-.062,s*.190,1.253),(-.053,s*.201,1.267)],
         [.020,.032,.027,.001],[.012,.020,.016,.001],'hairAuburn',normal=(0,s,0))
# A few silhouette tips create the tousled top without a noisy strand cage.
for pts in [
    [(-.08,-.035,1.345),(-.04,-.045,1.391),(.010,-.015,1.420),(.055,.002,1.409)],
    [(-.06,.025,1.350),(-.035,.010,1.383),(-.043,-.025,1.413),(-.076,-.060,1.401)],
]:
    lock('crown tuft',pts,[.027,.034,.023,.001],[.010,.014,.012,.001],'hairAuburn',normal=(0,-1,0))
for s in [-1,1]:
    tube('fringe sheen',[(.048,s*.035,1.37),(.117,s*.083,1.335),(.13,s*.125,1.302)],.0017,'hairHighlight','head',1)
for s in [-1,1]:
    tube('outer lash',[(face_x(s*.088,1.231)+.009,s*.088,1.231),(face_x(s*.099,1.24)+.009,s*.103,1.242)],.003,'hairShadow','head',1)
# High tied auburn ponytail, broad curved locks instead of individual hairs.
ell('ponytail tie',(-.108,.025,1.338),(.039,.054,.050),'redDark','head',16,10)
for i in range(9):
    a=2*math.pi*i/9
    y=.020+.108*math.sin(a)
    pts=[(-.115,.020,1.355),(-.188,y,1.383),(-.250,y*1.25,1.333),(-.265,y*1.25,1.256),(-.237,y*1.20,1.190),(-.180,y*1.38,1.180+.030*math.cos(a))]
    lock('pony sculpt lock',pts,[.023,.044,.048,.045,.027,.001],[.012,.023,.025,.023,.014,.001],'hairCopper' if i%3==0 else 'hairAuburn',normal=(-1,math.sin(a),.1))
for s in [-1,1]:
    lock('long temple framing lock',[(.045,s*.144,1.28),(.065,s*.156,1.226),(.057,s*.147,1.160),(.073,s*.13,1.104)],[.018,.022,.017,.001],[.011,.013,.011,.001],'hairAuburn',normal=(1,s,0))
# Refined chibi breadth; mesh and pivot positions use the same world-space map.
bpy.context.view_layer.update()
frames={o:o.matrix_world.copy() for o in asset.objects}
def refine(p,part):
    q=p.copy()
    q.y*=1.09
    if part=='head':
        q.y*=1.07
        q.x*=1.03
    elif part.startswith(('leg','shin')):
        cy=(.118 if part.startswith('leg') else .138)*(1 if part.endswith('L') else -1)*1.09
        q.y=cy+(q.y-cy)*1.18
        q.x*=1.10
    elif part.startswith('hand'):
        center=Vector((.025,(.282 if part.endswith('L') else -.282)*1.09,.684))
        # Only enlarge the glove: the hanging medical case retains its dimensions.
        if p.z>.58: q=center+(q-center)*1.20
    return q
for o,w in frames.items():
    if o.type!='MESH': continue
    inv=w.inverted()
    for v in o.data.vertices:
        p=w@v.co
        v.co=inv@refine(p,o.parent.name)
for name,o in N.items():
    w=frames[o].copy();w.translation=refine(w.translation,name);o.matrix_world=w
    bpy.context.view_layer.update()
for o,w in frames.items():
    if o.type=='MESH':o.matrix_world=w
bpy.context.view_layer.update()
# Preserve a smooth hero silhouette inside the budget.
for o in list(asset.objects):
    if o.type!='MESH': continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>250:
        bpy.context.view_layer.objects.active=o
        d=o.modifiers.new('Hero budget','DECIMATE'); d.ratio=.57
        bpy.ops.object.modifier_apply(modifier=d.name)
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
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
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
report={'id':'npc.paramedic','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':int(arg('--round',3)),'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
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
