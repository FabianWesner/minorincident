"""Four adult civilian survivors; +X forward, -Y right, Z up.
Deterministic rigid hierarchies; applied sculpt smoothing; no textures.
Run via experiment/tools/blender_run.py only.
"""
import bpy, bmesh, math, sys, json
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
asset=bpy.data.collections.new('Survivor group'); scene.collection.children.link(asset)
COLORS={'picketWhite':'f2e6dc','uiDark':'25222c','skinWarm':'eeb08b','skinBlush':'df9681','skinShadow':'b97961','hairChestnut':'493026','hairWarm':'70432d','hairHighlight':'975e3e','eyeBrown':'633525','mouth':'723c38','shirt':'b6abb0','shirtLight':'c9bec1','vest':'64606a','vestTrim':'7c717a','purple':'796084','purpleLight':'99819d','mustard':'dba345','mustardLight':'edbd62','pants':'77727a','pantsLight':'918991','pantsDark':'53515d','olive':'706657','oliveLight':'8a795e','leather':'55483f','silver':'b7ada0','survivorRed':'d9363e','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','capTan':'c49c77','shoe':'51453f','shoePink':'d799a9','pantsCargo':'686059'}
M={}
def srgb(h):
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
for t,h in COLORS.items():
    m=bpy.data.materials.new('pal_'+t); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=srgb(h); bs.inputs['Roughness'].default_value=.7
    if t=='silver': bs.inputs['Metallic'].default_value=.4
    if t=='eyeBrown': bs.inputs['Roughness'].default_value=.28
    m.diffuse_color=srgb(h); M[t]=m
N={}; PEOPLE=[]
def joint(name,p,parent=None):
    o=bpy.data.objects.new(name,None); asset.objects.link(o); o.location=p; o.empty_display_size=.025
    bpy.context.view_layer.update()
    if parent:
        w=o.matrix_world.copy(); o.parent=N[parent]; o.matrix_world=w
    N[name]=o; bpy.context.view_layer.update(); return o
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
    cu.dimensions='3D'; cu.resolution_u=2; cu.render_resolution_u=2
    cu.use_fill_caps=True; cu.bevel_depth=radius; cu.bevel_resolution=1
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points):
        p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,cu); asset.objects.link(o)
    bpy.context.view_layer.objects.active=o
    o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return finish(o,mat,parent)

def lock(name, points, widths, depths, mat='hairWarm', normal=(1,0,0), parent='head'):
    # Flattened curved leaf/strand; rounded elliptical cross section and a tip.
    vs=[]; seg=8; normal=Vector(normal)
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


def build_person(index, kind, position, yaw):
    global N
    N={}
    man=kind in ('capMan','glassesMan')
    coat='vest' if man else ('purple' if kind=='capWoman' else 'mustard')
    trim='vestTrim' if man else coat+'Light'
    pants='pantsCargo' if kind=='capMan' else ('pantsDark' if kind=='capWoman' else 'pants')
    hair='hairWarm' if kind=='bunWoman' else 'hairChestnut'
    joint('root',(0,0,0))
    joint('hip',(0,0,.61),'root'); joint('torso',(0,0,.65),'hip'); joint('head',(0,0,1.035),'torso')
    for side,s in [('L',1),('R',-1)]:
        joint('arm'+side,(0,s*.19,.98),'torso')
        joint('foreArm'+side,(.018,s*.237,.80),'arm'+side)
        joint('hand'+side,(.045,s*.255,.625),'foreArm'+side)
        joint('leg'+side,(0,s*.105,.60),'hip')
        joint('shin'+side,(.035,s*.115,.36),'leg'+side)
        joint('foot'+side,(-.006,s*.135,.13),'shin'+side)
        joint('weaponSocket'+side,(.080,s*.255,.57),'hand'+side)
    joint('backpackSocket',(-.13,0,.89),'torso')
    # Shirt under layered outer garment, ribbed hem and stitched placket.
    loft('shirt',[(0,0,.60,.087,.137),(0,0,.65,.104,.155),(0,0,.87,.095,.170),(0,0,.99,.052,.145),(0,0,1.035,.04,.055)],'shirt','torso',16,1)
    loft('coat shell',[(0,0,.655,.106,.158),(0,0,.68,.118,.172),(-.013,0,.83,.112,.185),(-.018,0,.96,.091,.184),(-.026,0,1.012,.064,.103)],coat,'torso',16,1)
    loft('hem band',[(0,0,.65,.109,.164),(0,0,.665,.12,.174),(0,0,.689,.115,.17)],trim,'torso',16,1)
    box('front placket',(.113,0,.821),(.020,.037,.292),trim,'torso',.007)
    if man:
        for s in [-1,1]:
            box('vest pocket',(.11,s*.098,.74),(.025,.088,.094),coat,'torso',.013)
            box('pocket flap',(.127,s*.098,.793),(.014,.097,.032),trim,'torso',.007)
            box('chest patch pocket',(.107,s*.098,.916),(.026,.077,.071),trim,'torso',.012)
            tube('collar fold',[(.045,s*.035,1.011),(.090,s*.070,.988),(.110,s*.055,.925)],.012,trim,'torso')
            for z in [.72,.79,.89,.96]: ell('brass button',(.135,s*.034,z),(.005,.006,.006),'oliveLight','torso',8,6)
    else:
        # Separate padded hood volume around the neck, open towards the face.
        tube('hood horseshoe',[(.078,-.073,1.00),(-.033,-.14,1.03),(-.113,-.095,1.048),(-.135,0,1.06),(-.113,.095,1.048),(-.033,.14,1.03),(.078,.073,1.00)],.035,trim,'torso')
        for s in [-1,1]:
            tube('hood drawstring',[(.090,s*.041,.992),(.124,s*.045,.92),(.124,s*.044,.87)],.0035,'picketWhite','torso')
            box('cord end',(.126,s*.044,.871),(.006,.008,.018),'silver','torso',.002)
            box('hoodie pocket',(.122,s*.071,.743),(.018,.092,.080),coat,'torso',.018)
            tube('pocket opening',[(.138,s*.105,.779),(.139,s*.052,.724)],.003,trim,'torso')
    if kind=='capMan':
        tube('underhood',[(.068,-.075,1.009),(-.05,-.12,1.043),(-.119,0,1.06),(-.05,.12,1.043),(.068,.075,1.009)],.029,'shirtLight','torso')
    loft('neck',[(0,0,1.001,.039,.045),(0,0,1.081,.046,.051)],'skinWarm','head',12,1)
    loft('pants seat',[(0,0,.55,.084,.136),(0,0,.605,.090,.147),(0,0,.653,.086,.144)],pants,'hip',16,1)
    loft('belt',[(0,0,.637,.093,.15),(0,0,.660,.093,.15)],'leather','hip',16,1)
    box('belt buckle',(.102,0,.65),(.012,.047,.025),'silver','hip',.004)
    box('buckle inset',(.109,0,.65),(.007,.030,.012),'leather','hip',.002)
    # Big shoes, compact legs, sleeves, articulated hands.
    for side,s in [('L',1),('R',-1)]:
        a='arm'+side; f='foreArm'+side; h='hand'+side; l='leg'+side; sh='shin'+side; ft='foot'+side
        sleeve='shirt' if kind=='glassesMan' else coat
        sleeveTrim='shirtLight' if kind=='glassesMan' else trim
        loft('sleeve',[(.018,s*.236,.798,.051,.050),(.017,s*.232,.83,.059,.057),(0,s*.207,.923,.067,.065),(0,s*.186,.987,.054,.055)],sleeve,a,12,1)
        loft('rolled cuff',[(.018,s*.239,.776,.057,.056),(.018,s*.238,.80,.060,.059),(.017,s*.234,.824,.058,.056)],sleeveTrim,f,12,1)
        tube('cuff stitch',[(.071,s*.210,.8),(.077,s*.239,.8),(.070,s*.270,.8)],.002,trim,f)
        loft('forearm',[(.045,s*.255,.619,.028,.030),(.042,s*.252,.664,.031,.035),(.027,s*.246,.742,.043,.045),(.019,s*.238,.798,.044,.045)],'skinWarm',f,12,1)
        ell('palm',(.047,s*.26,.601),(.037,.041,.044),'skinWarm',h,12,8)
        for j in range(4):
            yy=s*(.237+j*.016)
            tube('finger',[(.064,yy,.60),(.072,yy,.565),(.060,yy,.548+(.010 if j==3 else 0))],.010,'skinWarm',h)
        tube('thumb',[(.053,s*.23,.617),(.086,s*.218,.592),(.089,s*.223,.579)],.013,'skinWarm',h)
        loft('trouser thigh',[(.035,s*.115,.351,.063,.067),(.028,s*.113,.405,.074,.074),(0,s*.107,.531,.076,.078),(0,s*.105,.61,.070,.075)],pants,l,12,1)
        loft('trouser shin',[(-.006,s*.135,.174,.055,.060),(-.017,s*.134,.208,.059,.064),(-.002,s*.128,.273,.057,.060),(.035,s*.115,.354,.068,.069),(.033,s*.115,.38,.062,.065)],pants,sh,12,1)
        loft('pant cuff',[(-.008,s*.135,.166,.058,.061),(-.010,s*.135,.177,.066,.068),(-.013,s*.134,.203,.064,.068),(-.013,s*.134,.216,.060,.064)],'pantsLight',sh,12,1)
        tube('leg outer seam',[(0,s*.181,.56),(.015,s*.191,.452),(.037,s*.183,.374)],.002,'pantsLight',l)
        tube('calf outer seam',[(.030,s*.184,.36),(-.004,s*.19,.278),(-.017,s*.199,.218)],.002,'pantsLight',sh)
        if man:
            box('cargo pocket',(0,s*.185,.465),(.101,.024,.103),pants,l,.014)
            box('cargo flap',(.003,s*.20,.514),(.108,.018,.029),'pantsLight',l,.006)
            ell('cargo snap',(.035,s*.213,.515),(.005,.004,.005),'oliveLight',l,8,6)
            ell('reinforced knee',(.093,s*.116,.367),(.011,.052,.045),'pantsDark',sh,12,8)
        else:
            box('rear pocket',(-.081,s*.081,.566),(.012,.078,.076),pants,'hip',.01)
            if kind=='capWoman':
                ell('worn knee',(.093,s*.115,.385),(.005,.030,.014),'skinWarm',sh,12,8)
                tube('knee frayed lip',[(.097,s*.087,.398),(.10,s*.112,.400),(.097,s*.142,.398)],.003,'pantsLight',sh)
        shoe='shoe' if man else ('survivorRed' if kind=='capWoman' else 'picketWhite')
        y=s*.135
        box('outsole',(.030,y,.0205),(.236,.143,.041),'leather' if man else 'purple',ft,.017)
        box('midsole',(.030,y,.051),(.234,.140,.027),'oliveLight' if man else 'picketWhite',ft,.012)
        loft('shoe upper',[(.026,y,.07,.102,.063),(.020,y,.096,.100,.064),(-.012,y,.134,.071,.058),(-.026,y,.17,.047,.050)],shoe,ft,16,1)
        ell('toe cap',(.109,y,.091),(.045,.060,.034),shoe if man else 'picketWhite',ft,12,8)
        box('shoe heel',(-.068,y,.11),(.023,.112,.067),shoe,ft,.009)
        box('tongue',(.035,y,.140),(.026,.067,.064),shoe,ft,.009,rot=(0,-.4,0))
        for j in range(4):
            x=.092-j*.017; z=.112+j*.01
            tube('lace',[(x,y-.035,z),(x+.004,y,z+.009),(x,y+.035,z)],.003,'schoolBusYellow' if man else 'picketWhite',ft)
        for d in [-1,1]:
            tube('shoe side stripe',[(.069,y+d*.065,.083),(.008,y+d*.064,.090),(-.031,y+d*.059,.12)],.006,'oliveLight' if man else 'mustardLight',ft)
            for j in range(5): box('sole tread',(-.06+j*.040,y+d*.068,.024),(.014,.005,.017),'leather',ft,.002)
        for z in [.83,.9]: tube('sleeve fold',[(.065,s*.215,z),(.076,s*.23,z-.009),(.065,s*.255,z)],.003,sleeveTrim,a if z>.85 else f)
    # Compact olive expedition pack with flapped pockets, buckles and webbing.
    box('backpack body',(-.20,0,.861),(.16,.281,.333),'olive','backpackSocket',.048)
    box('top flap',(-.279,0,1.002),(.037,.29,.08),'oliveLight','backpackSocket',.022)
    box('front pocket',(-.291,0,.787),(.055,.214,.151),'olive','backpackSocket',.024)
    box('pocket flap',(-.325,0,.85),(.018,.22,.045),'oliveLight','backpackSocket',.009)
    tube('pack carry loop',[(-.193,-.052,1.029),(-.206,-.05,1.066),(-.208,.05,1.066),(-.193,.052,1.029)],.007,'leather','backpackSocket')
    for s in [-1,1]:
        tube('shoulder webbing',[(-.17,s*.10,.982),(-.064,s*.152,1.011),(.045,s*.159,.958),(.098,s*.13,.828),(.079,s*.115,.704),(-.165,s*.127,.70)],.013,'oliveLight','torso')
        box('strap adjuster',(.108,s*.126,.844),(.012,.029,.034),'leather','torso',.004)
        box('pack flap strap',(-.312,s*.070,.952),(.015,.025,.10),'leather','backpackSocket',.004)
        box('pack buckle',(-.323,s*.070,.914),(.012,.037,.035),'silver','backpackSocket',.004)
        box('pack buckle inset',(-.332,s*.070,.914),(.006,.022,.019),'leather','backpackSocket',.002)
        box('side pouch',(-.212,s*.161,.825),(.102,.043,.158),'oliveLight','backpackSocket',.019)
        tube('side pouch lip',[(-.26,s*.18,.881),(-.21,s*.187,.887),(-.163,s*.18,.881)],.006,'leather','backpackSocket')
    for z in [.734,.817]: ell('pack stud',(-.356,0,z),(.004,.007,.007),'oliveLight','backpackSocket',8,6)
    # Broad face has a flatter front than a sphere, avoiding bulging eye stalks.
    loft('face sculpt',[(0,0,1.045,.05,.062),(.006,0,1.071,.090,.104),(.005,0,1.11,.121,.140),(-.006,0,1.18,.140,.154),(-.016,0,1.25,.138,.153),(-.020,0,1.31,.110,.123),(-.024,0,1.344,.038,.044)],'skinWarm','head',24,1)
    for s in [-1,1]:
        ell('ear',(-.013,s*.153,1.166),(.030,.023,.041),'skinWarm','head',12,8)
        ell('ear bowl',(.013,s*.166,1.168),(.012,.011,.027),'skinShadow','head',12,8)
        y=s*.063; x=.128; z=1.212
        ell('eye socket',(x,y,z),(.010,.038,.048),'skinShadow','head',12,8)
        ell('eye white',(x+.008,y,z),(.010,.032,.041),'picketWhite','head',16,10)
        ell('iris',(x+.017,y-s*.003,z+.001),(.004,.018,.027),'eyeBrown','head',12,8)
        ell('pupil',(x+.021,y-s*.003,z+.001),(.003,.010,.020),'uiDark','head',12,8)
        ell('catchlight',(x+.025,y-s*.009,z+.013),(.002,.006,.008),'picketWhite','head',8,6)
        tube('upper lid',[(.135,y-.030,z+.008),(.143,y,z+.043),(.135,y+.03,z+.008)],.0035,hair,'head')
        # Inner brows raised: readable fear instead of a smile.
        tube('worried brow',[(.130,y-s*.029,1.283),(.137,y,1.277),(.119,y+s*.031,1.262)],.006,hair,'head')
        ell('cheek tint',(.118,s*.102,1.147),(.004,.017,.012),'skinBlush','head',12,8)
    ell('nose bridge',(.137,0,1.19),(.012,.013,.024),'skinWarm','head',12,8)
    ell('nose tip',(.154,0,1.174),(.024,.023,.020),'skinWarm','head',12,8)
    for s in [-1,1]: ell('nostril',(.166,s*.015,1.164),(.004,.004,.003),'skinShadow','head',8,6)
    # Small open worried mouth and inset teeth, with a downturned rim.
    ell('open mouth',(.128,0,1.109),(.010,.035,.023),'mouth','head',16,10)
    tube('mouth upper lip',[(.13,-.032,1.111),(.141,0,1.13),(.13,.032,1.111)],.004,'skinShadow','head')
    box('upper teeth',(.141,0,1.119),(.007,.041,.008),'picketWhite','head',.003)
    tube('lower lip',[(.129,-.023,1.097),(.137,0,1.091),(.129,.023,1.097)],.0035,'skinBlush','head')
    if man:
        for s in [-1,1]:
            lock('sideburn',[(.00,s*.133,1.282),(.020,s*.155,1.227),(.035,s*.137,1.158)],[.018,.022,.006],[.011,.015,.005],hair,normal=(.2,s,0))
            tube('beard cheek',[(.051,s*.132,1.149),(.088,s*.095,1.086),(.089,s*.036,1.065)],.015,hair,'head')
            tube('moustache',[(.137,s*.007,1.14),(.135,s*.022,1.14),(.128,s*.034,1.133)],.007,hair,'head')
        ell('chin beard',(.076,0,1.064),(.030,.053,.018),hair,'head',12,8)
    # Scalp with an open face boundary and thick overlapping swept locks.
    vs=[]; fs=[]; seg=24; rows=6
    for k in range(rows):
        for j in range(seg):
            a=2*math.pi*j/seg; edge=.94+1.17*(1-math.cos(a))/2
            ph=.03+(edge-.03)*k/(rows-1)
            vs.append((-.024+.15*math.sin(ph)*math.cos(a),.165*math.sin(ph)*math.sin(a),1.204+.158*math.cos(ph)))
    for k in range(rows-1):
        for j in range(seg): fs.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    fs.append(tuple(reversed(range(seg)))); mesh('scalp',vs,fs,hair,'head',1)
    for j in range(9):
        a=.75+j*.61; c=math.cos(a); q=math.sin(a)
        pts=[(-.035+.028*c,.03*q,1.364),(-.024+.10*c,.117*q,1.343),(-.024+.154*c,.166*q,1.275),(-.043+.141*c,.156*q,1.14+(.072 if c>0 else 0))]
        lock('crown hair',pts,[.023,.044,.036,.003],[.011,.021,.022,.002],hair if j%3 else 'hairWarm',normal=(c,q,.3))
    if kind in ('capMan','capWoman'):
        cap='capTan' if kind=='capMan' else 'purple'
        # Upper hemisphere baseball crown, distinct bill and six panel seams.
        vs=[]; fs=[]
        for k in range(6):
            ph=.02+(math.pi/2-.02)*k/5
            for j in range(24):
                a=2*math.pi*j/24
                vs.append((-.027+.160*math.sin(ph)*math.cos(a),.174*math.sin(ph)*math.sin(a),1.296+.145*math.cos(ph)))
        for k in range(5):
            for j in range(24): fs.append((k*24+j,k*24+(j+1)%24,(k+1)*24+(j+1)%24,(k+1)*24+j))
        mesh('cap crown',vs,fs,cap,'head',1)
        box('cap bill',(.151,0,1.329),(.232,.313,.025),'vest' if kind=='capMan' else 'purple','head',.024,rot=(0,-.08,0))
        ell('cap button',(-.027,0,1.443),(.013,.013,.008),cap,'head',8,6)
        for j in range(6):
            a=j*math.pi/3
            pts=[(-.027+.163*math.sin(ph)*math.cos(a),.177*math.sin(ph)*math.sin(a),1.296+.148*math.cos(ph)) for ph in [.12,.5,.95,1.50]]
            tube('cap seam',pts,.0025,'shirtLight' if kind=='capMan' else 'purpleLight','head')
        ell('cap patch',(.123,0,1.355),(.007,.034,.030),'uiDark','head',12,8)
        tube('cap emblem',[(.133,-.017,1.35),(.136,-.010,1.367),(.137,.006,1.367),(.134,.017,1.351)],.004,'capTan' if kind=='capMan' else 'mustard','head')
    else:
        for j in range(4):
            pts=[(.015,-.075+j*.043,1.368),(.114,-.071+j*.04,1.343),(.156,-.040+j*.04,1.299),(.116,.002+j*.043,1.257)]
            lock('swept fringe',pts,[.019,.032,.026,.002],[.010,.022,.018,.001],hair if j%2 else 'hairWarm')
        if kind=='bunWoman':
            ell('hair bun',(-.146,.015,1.364),(.080,.089,.080),'hairWarm','head',16,10)
            for j in range(5):
                a=j*math.pi*2/5
                tube('bun coil',[(-.161+.052*math.cos(a),.016+.068*math.sin(a),1.313),(-.185+.051*math.cos(a),.016+.068*math.sin(a),1.36),(-.166+.045*math.cos(a),.016+.06*math.sin(a),1.418)],.008,'hairChestnut','head')
            tube('bun tie',[(-.12,-.045,1.339),(-.104,0,1.317),(-.12,.061,1.339)],.008,'survivorRed','head')
        else:
            for j in range(3):
                lock('crown flick',[(-.07,-.04+j*.035,1.35),(-.025,-.04+j*.033,1.396),(.040,-.03+j*.032,1.416),(.063,.003+j*.027,1.395)],[.023,.027,.018,.001],[.009,.016,.014,.001],'hairWarm',normal=(0,-1,0))
    if kind=='glassesMan':
        for s in [-1,1]:
            y=s*.066
            # Empty lenses: frames preserve actual sculpted eyes and avoid transparency artifacts.
            tube('glasses rim',[(.156,y-.042,1.242),(.16,y-.042,1.186),(.16,y+.041,1.186),(.156,y+.041,1.242),(.156,y-.042,1.242)],.006,'uiDark','head')
            tube('glasses temple',[(.153,s*.109,1.235),(.07,s*.164,1.235),(-.014,s*.168,1.217)],.005,'uiDark','head')
        tube('glasses bridge',[(.166,-.024,1.23),(.171,0,1.236),(.166,.024,1.23)],.005,'uiDark','head')
    # Small identity details distinguish the four civilians at hero scale.
    if kind=='capMan':
        ell('beard chin volume',(.088,0,1.068),(.037,.076,.030),hair,'head',16,10)
        for sign in [-1,1]:
            ell('beard jaw volume',(.082,sign*.085,1.101),(.024,.025,.038),hair,'head',12,8)
            tube('eye bag',[(.141,sign*.044,1.166),(.138,sign*.064,1.162),(.130,sign*.089,1.17)],.0025,'skinShadow','head')
        ell('field patch',(.139,.095,.919),(.003,.015,.019),'oliveLight','torso',12,8)
        tube('patch emblem',[(.143,.083,.916),(.143,.095,.928),(.143,.107,.916)],.0025,'leather','torso')
    if kind=='bunWoman':
        for side,sign in [('L',1),('R',-1)]:
            box('pink heel counter',(-.066,sign*.135,.112),(.022,.104,.06),'shoePink','foot'+side,.008)
            box('pink tongue badge',(.052,sign*.135,.154),(.010,.040,.024),'shoePink','foot'+side,.005)
            for d in [-1,1]:
                box('pink canvas panel',(.018,sign*.135+d*.06,.111),(.055,.009,.026),'shoePink','foot'+side,.005)
    if kind in ('glassesMan','bunWoman'):
        for j in range(4):
            tube('fringe ridge',[(.043,-.070+j*.042,1.374),(.134,-.059+j*.04,1.345),(.176,-.029+j*.039,1.300)],.002,'hairHighlight','head')
    for sign in [-1,1]:
        tube('pack stitched edge',[(-.323,sign*.095,.837),(-.327,sign*.101,.790),(-.323,sign*.095,.729)],.002,'oliveLight','backpackSocket')
    # Cloth relief follows elbows, waist and ankle gathers, offset above shells.
    for side,sign in [('L',1),('R',-1)]:
        sleeve='shirtLight' if kind=='glassesMan' else trim
        tube('waist cloth fold',[(.110,sign*.041,.703),(.123,sign*.085,.706),(.099,sign*.131,.721)],.0035,trim,'torso')
        tube('thigh crease',[(.07,sign*.093,.536),(.087,sign*.116,.51),(.077,sign*.149,.49)],.003,'pantsLight','leg'+side)
        tube('ankle gather',[(.043,sign*.11,.24),(.050,sign*.139,.23),(.042,sign*.17,.247)],.003,'pantsLight','shin'+side)
        tube('elbow fold',[(.069,sign*.215,.846),(.078,sign*.236,.841),(.068,sign*.267,.861)],.003,sleeve,'arm'+side)
    # Men retain a broader mature torso; women have a slightly narrower waist.
    bpy.context.view_layer.update()
    if man:
        for o in list(asset.objects):
            if o.type!='MESH' or o.parent not in N.values(): continue
            part=next(k for k,v in N.items() if v==o.parent)
            if part not in ('hip','torso'): continue
            inv=o.matrix_world.inverted()
            for v in o.data.vertices:
                w=o.matrix_world@v.co; w.y*=1.13 if kind=='capMan' else 1.04; v.co=inv@w
    # Move the whole independent hierarchy into a close group, slight inward turns.
    prefix='' if index==0 else f'survivor{index+1:02d}_'
    for name,o in N.items(): o.name=prefix+name
    N['root'].location=position; N['root'].rotation_euler.z=yaw
    N['root']['adult']=True; N['root']['identity']=kind; N['root']['forward']='+X'
    PEOPLE.append(N.copy()); bpy.context.view_layer.update()

for i,(kind,pos,yaw) in enumerate([
    ('capMan',(-.025,-.70,0),-.055),
    ('capWoman',(.055,-.23,0),-.025),
    ('glassesMan',(-.025,.24,0),.025),
    ('bunWoman',(.045,.71,0),.080),
]): build_person(i,kind,pos,yaw)

# The scene has one centered group root, with four independent member roots.
PEOPLE[0]['root'].name='survivor01_root'
group_root=bpy.data.objects.new('root',None); asset.objects.link(group_root)
group_root['asset_id']='npc.survivor-group'; group_root['forward']='+X'; group_root['animation']='rigid-part'; group_root['members']=4
bpy.context.view_layer.update()
for person in PEOPLE:
    w=person['root'].matrix_world.copy(); person['root'].parent=group_root; person['root'].matrix_world=w
bpy.context.view_layer.update()

# Join static details per rigid joint; animation nodes and sockets remain intact.
groups={}
for o in list(asset.objects):
    if o.type=='MESH': groups.setdefault(o.parent,[]).append(o)
for parent,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    bpy.context.object.name=parent.name+'_mesh'
    bpy.context.object.select_set(False)
# Apply one mesh-wide reduction only when necessary to meet the group budget.
def triangle_count():
    n=0
    for o in asset.objects:
        if o.type=='MESH': o.data.calc_loop_triangles(); n+=len(o.data.loop_triangles)
    return n
before=triangle_count()
if before>58000:
    ratio=57500/before
    for o in asset.objects:
        if o.type!='MESH': continue
        bpy.context.view_layer.objects.active=o
        d=o.modifiers.new('Group hero budget','DECIMATE'); d.ratio=ratio
        bpy.ops.object.modifier_apply(modifier=d.name)
for o in asset.objects:
    if o.type!='MESH': continue
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if (f.verts[1].co-f.verts[0].co).cross(f.verts[2].co-f.verts[0].co).length<2e-8]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
missing=[]
for i in range(4):
    prefix='' if i==0 else f'survivor{i+1:02d}_'
    missing.extend(prefix+n for n in required if prefix+n not in asset.objects)
report={'id':'npc.survivor-group','triangles':triangle_count(),'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n'); print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    print('GLB OK')

def pose_test():
    for person in PEOPLE:
        person['armL'].rotation_euler.x=.65
        person['armL'].rotation_euler.y=-.2
        person['foreArmL'].rotation_euler.y=-.95
        person['legR'].rotation_euler.y=-.28
        person['shinR'].rotation_euler.y=.35
    bpy.context.view_layer.update()
if '--pose-test' in ARGS: pose_test()

def stage():
    w=bpy.data.worlds.new('Dusk studio'); scene.world=w; w.use_nodes=True
    w.node_tree.nodes['Background'].inputs['Color'].default_value=(.14,.16,.21,1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def light(name,loc,power,size,color):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(4,-3,5),500,4,(1,.83,.70)); light('cool fill',(3,4,3),350,4,(.73,.83,1)); light('gold rim',(-3,1,4),600,3,(1,.65,.39))
    bpy.ops.mesh.primitive_plane_add(size=200); g=bpy.context.object; g.name='Studio floor'; g.location.z=-.006
    m=bpy.data.materials.new('Studio'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.030,.045,1); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85; g.data.materials.append(m)
    cam=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera')); scene.collection.objects.link(cam); scene.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=3.65
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.render.image_settings.file_format='PNG'

def render(view,path):
    # Side inspection separates members along screen-X, as on the reference
    # sheet, so all four side silhouettes can be reviewed. Restore afterwards.
    rest=[p['root'].location.copy() for p in PEOPLE]
    if view=='side':
        for i,p in enumerate(PEOPLE): p['root'].location.x=(i-1.5)*.52
        bpy.context.view_layer.update()
    target=Vector((-.04,0,.73))
    dirs={'front':(6,0,.22),'side':(0,-6,.22),'back':(-6,0,.22),'ref':(7,-3.5,2.5)}
    scene.camera.location=target+Vector(dirs[view]); scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(Path(path).resolve()); Path(path).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True); print('RENDER OK',view,path)
    for p,loc in zip(PEOPLE,rest): p['root'].location=loc
    bpy.context.view_layer.update()
if arg('--render'):
    stage(); render(arg('--view','ref'),arg('--render'))
    if '--four-views' in ARGS:
        base=Path(arg('--render'))
        for v in ['front','side','back','ref']: render(v,base.with_name(base.stem+'-'+v+'.png'))
    if '--deliverables' in ARGS:
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        for v in ['front','side','back','ref']: render(v,HERE/'renders'/('final-'+v+'.png'))
        pose_test(); render('ref',HERE/'renders'/'pose-test.png')
