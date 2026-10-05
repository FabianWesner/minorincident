"""Minor Incident National Guard — deterministic sculpted rigid-part hero.
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
asset = bpy.data.collections.new('NationalGuard')
scene.collection.children.link(asset)
M = {}
# Use the repository palette directly. Clothing and relief are texture-free.
COLORS = {k:v.lstrip('#') for k,v in json.loads((HERE.parents[1]/'src/assets/palette.json').read_text()).items()}

def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for token, color in COLORS.items():
    m = bpy.data.materials.new('pal_'+token)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = srgb(color)
    bs.inputs['Roughness'].default_value = .62 if token.startswith('hair') else .67
    if token == 'eyeBrown':
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
joint('hip', (0,0,.640),'root')
joint('torso',(0,0,.680),'hip')
joint('head',(0,0,1.055),'torso')
for side,s in [('L',1),('R',-1)]:
    joint('arm'+side,(0,s*.185,1.005),'torso')
    joint('foreArm'+side,(.012,s*.241,.838),'arm'+side)
    joint('hand'+side,(.025,s*.282,.684),'foreArm'+side)
    joint('leg'+side,(0,s*.098,.620),'hip')
    joint('shin'+side,(.008,s*.118,.360),'leg'+side)
    joint('foot'+side,(-.006,s*.138,.142),'shin'+side)
    joint('weaponSocket'+side,(.061,s*.28,.620),'hand'+side)
joint('backpackSocket',(-.111,0,.924),'torso')
N['root']['asset_id']='npc.national-guard'
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



# Woodland patches are baked material regions, with no overlay surfaces.
def camo(o):
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Smooth woodland regions','SUBSURF');mod.levels=1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # Gentle tailoring ripples, baked before assigning the camo regions.
    if o.name.startswith('trouser'):
        for v in o.data.vertices:
            w=o.matrix_world@v.co
            v.co.x+=.004*math.sin(w.z*105+w.y*21)
            v.co.y+=.003*math.sin(w.z*91+w.x*32)
    o.data.update()
    for token in ['apronOlive','khakiSeam','khakiLight']: o.data.materials.append(M[token])
    for f in o.data.polygons:
        p=o.matrix_world@f.center
        value=math.sin(p.x*55+p.z*37+math.sin(p.y*40)*1.7)+math.cos(p.y*41-p.z*31+math.sin(p.x*35)*1.5)
        f.material_index=1 if value>.65 else 2 if value<-.8 else 3 if value<-.15 else 0
    return o

def cloth(name,rings,parent,seg=24):
    return camo(loft(name,rings,'khaki',parent,seg,1))

cloth('field blouse',[(0,0,.64,.09,.14),(0,0,.67,.098,.153),(0,0,.83,.104,.159),(0,0,.95,.096,.176),(0,0,1.012,.061,.149),(0,0,1.025,.044,.057)],'torso')
loft('neck',[(0,0,1.01,.042,.048),(0,0,1.075,.046,.05)],'skinWarm','head')
loft('undershirt neck',[(0,0,1.009,.047,.055),(0,0,1.028,.047,.055)],'uiDark','torso')
for s in [-1,1]:
    box('folded camo collar',(.062,s*.05,1.008),(.039,.057,.072),'khaki','torso',.009,(s*.4,-.35,0))
    box('carrier shoulder strap',(.060,s*.13,.968),(.056,.048,.135),'apronOlive','torso',.01,(s*.13,-.28,0))
    box('strap stitch',(.091,s*.13,.951),(.009,.031,.085),'gloveKhaki','torso',.004)
    box('shoulder buckle',(.101,s*.13,.924),(.015,.047,.025),'uiDark','torso',.005)
box('front ballistic plate',(.109,0,.828),(.061,.292,.257),'apronOlive','torso',.028)
box('back ballistic plate',(-.116,0,.819),(.063,.293,.27),'apronOlive','torso',.028)
for z in [.716,.751,.789,.828,.866]:
    box('front MOLLE band',(.145,0,z),(.012,.271,.020),'gloveKhaki','torso',.004)
    box('rear MOLLE band',(-.153,0,z),(.011,.272,.021),'gloveKhaki','torso',.004)
    for y in [-.105,-.052,0,.052,.105]:
        box('MOLLE sewn tack',(.153,y,z),(.006,.005,.022),'khakiSeam','torso',.001)
for s in [-1,1]:
    box('carrier side panel',(0,s*.153,.807),(.181,.041,.195),'apronOlive','torso',.014)
    for z in [.741,.78,.821]: box('side webbing',(0,s*.178,z),(.174,.012,.020),'gloveKhaki','torso',.003)
for y in [-.089,0,.089]:
    box('magazine pouch',(.171,y,.750),(.052,.075,.128),'apronOlive','torso',.01)
    box('magazine pouch flap',(.200,y,.800),(.015,.081,.036),'gloveKhaki','torso',.006)
    ell('pouch brass snap',(.211,y,.798),(.004,.006,.006),'brass','torso',10,6)
    tube('pouch bottom piping',[(.205,y-.03,.775),(.208,y-.03,.695),(.208,y+.03,.695),(.205,y+.03,.775)],.0018,'khakiSeam','torso',1)
box('chest utility tab',(.157,.092,.919),(.025,.072,.051),'gloveKhaki','torso',.005)
ell('utility snap',(.174,.094,.922),(.004,.006,.006),'brass','torso',10,6)
box('rear pack',(-.176,0,.804),(.079,.249,.216),'apronOlive','torso',.021)
box('rear pack piping',(-.221,0,.807),(.017,.218,.175),'khakiSeam','torso',.013)
box('US panel rim',(-.234,0,.813),(.012,.172,.112),'khakiLight','torso',.009)
box('US panel face',(-.244,0,.813),(.009,.153,.096),'khaki','torso',.005)
from mathutils import Matrix
cu=bpy.data.curves.new('US embroidered relief','FONT');cu.body='US';cu.align_x='CENTER';cu.align_y='CENTER';cu.size=.086;cu.extrude=.001
font=Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
if font.exists(): cu.font=bpy.data.fonts.load(str(font))
o=bpy.data.objects.new('US embroidered relief',cu);asset.objects.link(o);o.location=(-.252,0,.813);o.rotation_euler=Matrix(((0,0,-1),(-1,0,0),(0,1,0))).to_euler()
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);finish(o,'uiDark','torso')
for s in [-1,1]:
    box('rear shoulder tab',(-.165,s*.098,.936),(.025,.039,.068),'gloveKhaki','torso',.006)
    ell('rear brass tab snap',(-.182,s*.098,.952),(.004,.011,.011),'brass','torso',12,8)
# Side radio and antenna.
box('radio',(-.12,.177,.873),(.058,.058,.144),'apronOlive','torso',.008)
for z in [.84,.86,.88]: box('radio rib',(-.153,.177,z),(.009,.06,.007),'khakiSeam','torso',.002)
tube('radio aerial',[(-.12,.18,.94),(-.122,.18,1.045)],.004,'uiDark','torso',1)
ell('aerial tip',(-.122,.18,1.045),(.005,.005,.006),'brass','torso',8,6)
cloth('seat',[(0,0,.55,.08,.13),(0,0,.588,.095,.15),(0,0,.658,.091,.143)],'hip')
loft('web belt',[(0,0,.63,.099,.154),(0,0,.668,.099,.154)],'uiDark','hip',24)
box('belt buckle',(.110,0,.648),(.022,.064,.041),'gloveKhaki','hip',.005)
box('belt buckle inset',(.124,0,.648),(.009,.040,.022),'uiDark','hip',.003)
for s in [-1,1]:
    box('belt utility pouch',(-.034,s*.16,.633),(.088,.061,.102),'apronOlive','hip',.009)
    box('utility flap',(-.025,s*.196,.669),(.083,.016,.031),'gloveKhaki','hip',.005)
for side,s in [('L',1),('R',-1)]:
    arm='arm'+side;fore='foreArm'+side;hand='hand'+side;leg='leg'+side;shin='shin'+side;foot='foot'+side
    cloth('blouse sleeve',[(0,s*.24,.837,.052,.055),(0,s*.229,.886,.064,.063),(0,s*.195,.977,.070,.065),(0,s*.184,1.009,.048,.049)],arm)
    cloth('forearm sleeve',[(.026,s*.28,.716,.035,.038),(.023,s*.276,.748,.043,.045),(.01,s*.256,.804,.05,.052),(.006,s*.242,.853,.056,.055)],fore)
    for z in [.77,.814]: tube('sleeve fold',[(.048,s*.214,z+.01),(.062,s*.248,z),(.038,s*.285,z-.008)],.005,'khaki',fore,1)
    loft('rolled cuff',[(.026,s*.28,.70,.04,.041),(.025,s*.28,.733,.044,.045)],'khakiLight',fore,20)
    loft('wrist skin',[(.025,s*.28,.685,.030,.033),(.025,s*.28,.706,.032,.035)],'skinWarm',hand)
    loft('glove cuff',[(.025,s*.28,.674,.036,.038),(.025,s*.28,.693,.037,.04)],'uiDark',hand)
    ell('glove palm',(.027,s*.29,.647),(.038,.043,.044),'uiDark',hand,20,12)
    box('glove knuckle pad',(.064,s*.291,.653),(.018,.057,.046),'navySeam',hand,.01)
    for i in range(4):
        y=s*(.267+i*.017)
        tube('glove finger',[(.033,y,.636),(.053,y,.610),(.043,y,.594)],.0115,'uiDark',hand,1)
        ell('finger pad',(.058,y,.630),(.009,.009,.012),'navySeam',hand,10,8)
    tube('thumb',[(.044,s*.261,.665),(.070,s*.25,.643),(.069,s*.251,.625)],.013,'uiDark',hand,1)
    cloth('trouser thigh',[(.006,s*.118,.347,.064,.067),(.008,s*.115,.39,.07,.07),(0,s*.11,.50,.08,.08),(0,s*.098,.62,.082,.083)],leg)
    cloth('trouser shin',[(-.007,s*.138,.164,.055,.059),(-.013,s*.138,.198,.066,.069),(-.012,s*.136,.249,.059,.064),(.006,s*.118,.337,.063,.066),(.008,s*.118,.370,.064,.066)],shin)
    loft('knee pad strap',[(.007,s*.119,.336,.070,.073),(.007,s*.119,.385,.070,.073)],'uiDark',shin,20)
    box('knee pad rim',(.073,s*.118,.358),(.044,.112,.121),'uiDark',shin,.025)
    box('knee pad shell',(.100,s*.118,.358),(.021,.095,.102),'navySeam',shin,.022)
    for y,z in [(s*.151,.395),(s*.087,.395),(s*.151,.32),(s*.087,.32)]: ell('pad bolt',(.112,y,z),(.003,.005,.005),'uiDark',shin,8,6)
    cloth('bloused trouser cuff',[(-.012,s*.138,.169,.059,.064),(-.012,s*.138,.188,.071,.075),(-.012,s*.138,.208,.065,.069)],shin)
    box('cargo pocket',(0,s*.195,.47),(.111,.031,.125),'khaki',leg,.01)
    box('cargo flap',(.001,s*.216,.523),(.118,.015,.032),'khakiLight',leg,.005)
    ell('cargo snap',(.02,s*.226,.522),(.005,.004,.005),'khakiSeam',leg,8,6)
    y=s*.138
    box('boot sole',(.03,y,.023),(.235,.15,.046),'khakiSeam',foot,.016)
    box('boot welt',(.03,y,.050),(.240,.154,.027),'shoeTan',foot,.011)
    loft('boot leather',[(.027,y,.058,.103,.064),(.024,y,.086,.101,.066),(-.006,y,.12,.073,.061),(-.021,y,.173,.055,.056),(-.022,y,.184,.052,.054)],'shoeTan',foot,24)
    ell('boot toe cap',(.103,y,.089),(.051,.067,.038),'khakiLight',foot,20,12)
    box('boot heel',(-.07,y,.109),(.024,.110,.067),'khaki',foot,.01)
    box('boot tongue',(.031,y,.144),(.030,.067,.080),'khaki',foot,.008,(0,-.4,0))
    for d in [-1,1]:
        tube('boot seam',[(.104,y+d*.060,.081),(.024,y+d*.065,.106),(-.05,y+d*.06,.15)],.002,'khakiSeam',foot,1)
        for j in range(7): box('sole tread',(-.061+j*.029,y+d*.073,.019),(.018,.014,.026),'khakiSeam',foot,.003)
    for j in range(5):
        x=.083-j*.015;z=.113+j*.011
        for dy in [-.027,.027]: ell('boot eyelet',(x,y+dy,z),(.004,.005,.004),'khakiSeam',foot,8,6)
        tube('cross lace',[(x,y-.027,z+.005),(x-.007,y+.027,z+.011)],.0026,'khakiSeam',foot,1)
        tube('cross lace',[(x,y+.027,z+.005),(x-.007,y-.027,z+.011)],.0026,'khakiSeam',foot,1)
    # Raised shoulder flag patch: embroidered geometry, 4mm proud.
    box('flag patch rim',(.015,s*.267,.945),(.079,.018,.09),'khakiLight',arm,.006,(s*.15,0,0))
    box('flag white field',(.016,s*.28,.945),(.069,.009,.077),'picketWhite',arm,.003)
    for j in range(7): box('flag red stripe',(.016,s*.287,.913+j*.0107),(.069,.005,.005),'survivorRed',arm,.001)
    box('flag blue canton',(-.001,s*.291,.965),(.036,.005,.037),'denimBlue',arm,.001)
    for a in range(4):
        for b in range(3): ell('flag stitch star',(-.014+a*.009,s*.295,.954+b*.01),(.0018,.0015,.0018),'picketWhite',arm,6,4)
# Right thigh holster.
for z in [.472,.524]:
    loft('thigh retention strap',[(0,-.109,z-.011,.083,.087),(0,-.109,z+.011,.083,.087)],'uiDark','legR',20)
    box('thigh buckle',(.086,-.145,z),(.016,.038,.027),'navySeam','legR',.004)
box('drop holster',(0,-.235,.488),(.083,.063,.173),'uiDark','legR',.011)
box('holster retention',(0,-.271,.55),(.065,.013,.044),'navySeam','legR',.004)
box('pistol butt',(-.016,-.232,.594),(.038,.031,.050),'uiDark','legR',.005,(0,-.2,0))
# A diagonal slung rifle, stock upper-right / muzzle lower-left in front view.
joint('rifle',(.224,0,.81),'torso')
# Helpers build rifle vertically, then tilt the entire rigid accessory around X.
box('rifle receiver',(.226,0,.808),(.075,.062,.146),'uiDark','rifle',.007)
box('receiver side plate',(.270,0,.813),(.012,.055,.102),'navySeam','rifle',.004)
box('charging handle',(.238,0,.902),(.093,.014,.017),'uiDark','rifle',.003)
box('butt stock spine',(.224,0,.956),(.040,.038,.133),'uiDark','rifle',.004)
box('stock upper',(.221,.014,1.018),(.065,.092,.070),'uiDark','rifle',.008)
box('stock rubber butt',(.222,.020,1.058),(.069,.102,.016),'navySeam','rifle',.004)
box('stock inset',(.260,.015,1.018),(.008,.063,.036),'navySeam','rifle',.004)
box('pistol grip',(.219,.059,.820),(.055,.035,.081),'uiDark','rifle',.006,(.25,0,0))
tube('trigger guard',[(.266,.026,.844),(.271,.062,.845),(.271,.072,.881),(.265,.028,.88)],.0035,'navySeam','rifle',1)
box('magazine',(.227,.077,.729),(.056,.040,.126),'khakiLight','rifle',.004,(-.15,0,0))
for y in [.062,.077,.092]: box('magazine groove',(.258,y,.729),(.005,.004,.108),'khakiSeam','rifle',.001)
box('rifle handguard',(.223,0,.666),(.066,.060,.172),'uiDark','rifle',.006)
for z in [.600+i*.018 for i in range(8)]:
    box('handguard rail tooth',(.263,0,z),(.016,.076,.007),'navySeam','rifle',.0015)
    for s in [-1,1]: box('handguard vent',(.232,s*.032,z),(.035,.006,.008),'navySeam','rifle',.001)
tube('rifle barrel',[(.223,0,.580),(.223,0,.397)],.010,'uiDark','rifle',1)
tube('barrel collar',[(.223,0,.480),(.223,0,.503)],.016,'navySeam','rifle',1)
box('front sight',(.241,0,.542),(.048,.015,.061),'uiDark','rifle',.003)
box('muzzle brake',(.223,0,.389),(.028,.028,.041),'navySeam','rifle',.003)
for z in [.379,.39,.40]: box('muzzle vent',(.24,0,z),(.003,.018,.004),'uiDark','rifle',.001)
box('optic base',(.279,0,.866),(.025,.035,.058),'uiDark','rifle',.004)
box('optic housing',(.295,0,.864),(.029,.040,.043),'navySeam','rifle',.006)
N['rifle'].rotation_euler.x=math.radians(34)
bpy.context.view_layer.update()
tube('rifle sling',[(.148,-.13,.976),(.19,-.11,.94),(.246,-.049,.85),(.24,-.165,.64),(.077,-.165,.71)],.009,'uiDark','torso',1)
box('sling adjuster',(.181,-.1,.93),(.019,.028,.036),'navySeam','torso',.004)

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
    shell=bpy.data.objects['face sculpt']
    bpy.context.view_layer.update()
    inv=shell.matrix_world.inverted()
    hit,point,_,_=shell.ray_cast(inv@Vector((.5,y,z)),inv.to_3x3()@Vector((-1,0,0)))
    return (shell.matrix_world@point).x if hit else .10
for s in [-1,1]:
    y=s*.062; z=1.210; x=face_x(y,z)
    ell('eye sclera', (x+.004,y,z),(.007,.032,.037),'picketWhite','head',20,12)
    ell('iris', (x+.013,y-.003*s,z-.001),(.0035,.019,.029),'eyeBrown','head',20,12)
    ell('pupil', (x+.016,y-.003*s,z),(.0025,.010,.022),'hairChestnut','head',20,12)
    ell('eye glint', (x+.019,y-.009*s,z+.014),(.0025,.007,.009),'picketWhite','head',8,6)
    ell('eye glint small',(x+.019,y+.007*s,z-.010),(.002,.003,.004),'picketWhite','head',8,6)
    pts=[]
    for j in range(7):
        a=math.pi*j/6
        yy=y+.032*math.cos(a); zz=z+.037*math.sin(a)
        pts.append((face_x(yy,zz)+.012,yy,zz))
    tube('upper lashes',pts,.0048,'hairChestnut','head',2)
    tube('lower lid',[(face_x(y-.026,z)+.01,y-.026,z-.021),(x+.013,y,z-.037),(face_x(y+.026,z)+.01,y+.026,z-.021)],.002,'skinShadow','head',2)
    tube('brow',[(face_x(y-s*.029,z)+.007,y-s*.030,1.253),(face_x(y,z)+.008,y,1.262),(face_x(y+s*.030,z)+.008,y+s*.032,1.259)],.008,'hairChestnut','head',2)
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
tube('smile teeth',[(.133,-.027,1.130),(.139,0,1.126),(.133,.027,1.130)],.0023,'picketWhite','head',1)
tube('lower lip',[(.126,-.012,1.119),(.130,0,1.118),(.125,.014,1.120)],.002,'skinBlush','head',2)


# Short dark hair under the cap: a scalp, chunky nape locks and sideburns.
ell('hair back',(-.048,0,1.24),(.108,.150,.109),'hairChestnut','head',24,16)
for j in range(9):
    a=math.pi*.55+j*math.pi*.9/8
    x=-.019+.127*math.cos(a);y=.153*math.sin(a)
    lock('nape lock',[(x,y,1.283),(x-.025,y*1.01,1.237),(x-.018,y*.92,1.173+(.009 if j%2 else -.006))], [.030,.034,.001],[.012,.016,.001],'uiDark',normal=(-1,0,0))
for s in [-1,1]:
    lock('sideburn',[(.020,s*.136,1.288),(.038,s*.153,1.240),(.041,s*.140,1.184)], [.020,.025,.001],[.012,.014,.001],'uiDark',normal=(.3,s,0))
    lock('temple lock',[(.068,s*.090,1.296),(.092,s*.116,1.269),(.063,s*.144,1.242)], [.02,.024,.001],[.01,.014,.001],'uiDark')
for j in range(5):
    y=(j-2)*.049
    lock('lower nape layering',[(-.139,y,1.244),(-.152,y-.012,1.205),(-.119,y-.018,1.148)], [.030,.032,.001],[.011,.015,.001],'uiDark',normal=(-1,0,0))

# Helmet shell: scalloped lower edge gives face clearance and low ear guards.
vs=[];fs=[];seg=48
for k,(rx,ry,z) in enumerate([(.160,.183,1.275),(.167,.189,1.301),(.160,.181,1.348),(.127,.148,1.391),(.074,.087,1.417),(.010,.012,1.429)]):
    for j in range(seg):
        a=2*math.pi*j/seg
        dip=-.053*abs(math.sin(a))**8 if k==0 else -.017*abs(math.sin(a))**8 if k==1 else 0
        vs.append((-.015+rx*math.cos(a),ry*math.sin(a),z+dip))
for k in range(5):
    for j in range(seg):
        a=k*seg+j;b=k*seg+(j+1)%seg;fs.append((a,b,b+seg,a+seg))
fs.extend([tuple(reversed(range(seg))),tuple(5*seg+j for j in range(seg))])
camo(mesh('camo ballistic helmet',vs,fs,'khaki','head',1))
tube('helmet rolled rim',[(-.015+.163*math.cos(2*math.pi*j/48),.186*math.sin(2*math.pi*j/48),1.277-.053*abs(math.sin(2*math.pi*j/48))**8) for j in range(49)],.012,'khakiSeam','head',2)
ell('helmet front lip',(.131,0,1.280),(.049,.148,.012),'khaki','head',32,10)
box('helmet mount border',(.155,0,1.339),(.028,.064,.089),'uiDark','head',.006,(0,.16,0))
box('helmet mount insert',(.175,0,1.339),(.013,.047,.068),'navySeam','head',.003,(0,.16,0))
box('mount lower latch',(.175,0,1.298),(.022,.07,.014),'uiDark','head',.003)
for s in [-1,1]:
    tube('helmet side rail',[(.114,s*.118,1.304),(.04,s*.183,1.307),(-.072,s*.171,1.31)],.010,'navySeam','head',1)
    for j in range(5): box('rail slot',(.045-j*.021,s*.188,1.31),(.01,.008,.008),'uiDark','head',.001)
    box('helmet side tab',(-.075,s*.18,1.265),(.052,.018,.052),'khakiLight','head',.007)
    tube('helmet retention web',[(.037,s*.162,1.270),(.033,s*.149,1.186),(.065,s*.107,1.093),(.091,s*.04,1.075)],.006,'uiDark','head',1)
    box('chin strap buckle',(.049,s*.139,1.183),(.02,.022,.025),'navySeam','head',.003)
    tube('helmet stitched crown seam',[(-.142,s*.064,1.338),(-.067,s*.072,1.404),(.047,s*.07,1.402),(.128,s*.063,1.349)],.002,'khakiSeam','head',1)
box('chin cup',(.083,0,1.076),(.026,.074,.022),'navySeam','head',.008)
box('helmet rear band',(-.168,0,1.296),(.027,.148,.035),'navySeam','head',.005)
box('helmet rear rectangle',(-.184,0,1.296),(.012,.071,.041),'uiDark','head',.004)

# Broader head/helmet silhouette and a relaxed support arm, baked into rest geometry.
bpy.context.view_layer.update()
for o in asset.objects:
    if o.type!='MESH' or o.parent!=N['head']: continue
    inv=o.matrix_world.inverted(); pivot=N['head'].matrix_world.translation
    for v in o.data.vertices:
        w=o.matrix_world@v.co
        w.x=pivot.x+(w.x-pivot.x)*1.10
        w.y=pivot.y+(w.y-pivot.y)*1.20
        v.co=inv@w
N['foreArmR'].rotation_euler=(math.radians(25),math.radians(-55),0)
bpy.context.view_layer.update()
# Store posed coordinates in the mesh and joint locations, restoring zero rotations.
rest_world={o:o.matrix_world.copy() for o in asset.objects}
for o in asset.objects:
    if o.type=='MESH':
        for v in o.data.vertices: v.co=rest_world[o]@v.co
for o in N.values():
    o.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
for o in N.values():
    world=rest_world[o].copy();world=Matrix.Translation(world.translation)
    o.matrix_world=world
    bpy.context.view_layer.update()
for o in asset.objects:
    if o.type=='MESH':
        o.matrix_world=Matrix.Identity(4)
        bpy.context.view_layer.update()

# Apply silhouette simplification before material consolidation; no modifiers export.
for o in list(asset.objects):
    if o.type!='MESH': continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>150:
        bpy.context.view_layer.objects.active=o
        dec=o.modifiers.new('Hero budget','DECIMATE');dec.ratio=.25 if len(o.data.materials)>1 else .60
        bpy.ops.object.modifier_apply(modifier=dec.name)
# Merge static shells within each rigid joint. Blender reuses common palette
# slots, so the exporter emits one primitive per material per joint, preserving
# separate shells in the source and every animation/socket node in the GLB.
def consolidate():
    groups={}
    for o in list(asset.objects):
        if o.type=='MESH':
            key=o.parent.name
            groups.setdefault(key,[]).append(o)
    for parent,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1: bpy.ops.object.join()
        o=bpy.context.object
        o.name=parent+'.shells'
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
report={'id':'npc.national-guard','triangles':tris,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':int(arg('--round',3)),'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
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
