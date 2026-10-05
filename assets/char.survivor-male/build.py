"""Deterministic hero survivor. Blender +X forward, -Y right, +Z up.
Run exclusively through experiment/tools/blender_run.py; --view front|side|back|ref|pose.
Applied subdivision gives soft solid shells; rigid joint nodes drive animation, no skinning.
"""
import bpy
import math
import sys
import json
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(k, default=None):
    return ARGS[ARGS.index(k)+1] if k in ARGS else default

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
MODEL = bpy.data.collections.new('Survivor')
scene.collection.children.link(MODEL)
N = {}

def srgb(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]

def material(token, color, rough=.68, metal=0):
    m = bpy.data.materials.new('pal_'+token)
    m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=srgb(color)
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    m.diffuse_color=srgb(color)
    return m

# Palette starting values are gently tuned for the turnaround's fabric/skin/hair.
M={
    'red':material('survivorRed','d9363e'),
    'white':material('picketWhite','f2e6dc'),
    'teal':material('backpackTeal','2f6e6a'),
    'skin':material('infectedSkin','edb08d',.58),
    'brown':material('woodWarm','613522',.65),
    'pants':material('asphalt','685b4a'),
    'black':material('uiDark','25222c'),
    'orange':material('schoolBusYellow','e99e42',.5),
    'seam':material('sidewalk','b9a4a0'),
    'iris':material('brick','a8483a',.32),
}

def group(name, pos, parent=None):
    o=bpy.data.objects.new(name,None); MODEL.objects.link(o)
    o.location=pos
    bpy.context.view_layer.update()
    if parent:
        w=o.matrix_world.copy(); o.parent=N[parent]; o.matrix_world=w
    o.empty_display_size=.035
    N[name]=o
    bpy.context.view_layer.update()
    return o


def finish(o, name, mat, parent):
    o.name=name
    for coll in list(o.users_collection): coll.objects.unlink(o)
    MODEL.objects.link(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons: p.use_smooth=True
    bpy.context.view_layer.update()
    if parent:
        w=o.matrix_world.copy(); o.parent=N[parent]; o.matrix_world=w
    return o


def apply(o, modifier):
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def box(name, p, size, mat, parent, bevel=.015, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft sewn edges','BEVEL'); b.width=min(bevel,min(size)*.48); b.segments=2
    apply(o,b)
    s=o.modifiers.new('Face normals','WEIGHTED_NORMAL'); apply(o,s)
    if rot: o.rotation_euler=rot
    return finish(o,name,mat,parent)


def ell(name,p,size,mat,parent,segments=16,rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=p)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent)


def mesh(name,verts,faces,mat,parent,sub=0):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); MODEL.objects.link(o)
    if sub:
        s=o.modifiers.new('Applied fabric subdivision','SUBSURF'); s.levels=sub; apply(o,s)
    return finish(o,name,mat,parent)


def loft(name, rings, mat, parent, sides=16, sub=1, exponent=1):
    """Horizontal oval garment sections: (x,y,z, x-radius,y-radius)."""
    verts=[]
    cloth=name.startswith(('cargo_thigh','cargo_calf','cream_upper','cream_fore'))
    for j,(x,y,z,rx,ry) in enumerate(rings):
        for i in range(sides):
            a=2*math.pi*i/sides; c=math.cos(a); t=math.sin(a)
            zz=z; r=1
            if cloth and 0<j<len(rings)-1:
                zz += .011*math.sin(2*a+j*1.65)
                r += .07*math.cos(3*a+j*1.4)
            verts.append((x+rx*math.copysign(abs(c)**exponent,c)*r,y+ry*math.copysign(abs(t)**exponent,t)*r,zz))
    faces=[tuple(reversed(range(sides)))]
    for j in range(len(rings)-1):
        for i in range(sides):
            a=j*sides+i; b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    return mesh(name,verts,faces,mat,parent,sub)


def tube(name,points,radius,mat,parent):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for b,p in zip(sp.bezier_points,points): b.co=p; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    cu.bevel_depth=radius; cu.bevel_resolution=1; cu.resolution_u=3
    o=bpy.data.objects.new(name,cu); MODEL.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object; o.select_set(False)
    return finish(o,name,mat,parent)


def leaf(name,base,tip,width,depth,mat='brown',parent='head'):
    """Swept diamond-section sculpted hair lock, with a broad middle and tapered tip."""
    a=Vector(base); b=Vector(tip); axis=(b-a).normalized()
    u=axis.cross(Vector((1,0,0)))
    if u.length<.1: u=axis.cross(Vector((0,1,0)))
    u.normalize(); v=axis.cross(u).normalized()
    verts=[]
    for t,r in [(0,.45),(.12,.88),(.37,1),(.67,.63),(.91,.19),(1,.002)]:
        c=a.lerp(b,t)
        for i in range(4):
            th=2*math.pi*i/4
            verts.append(tuple(c+u*math.cos(th)*width*r+v*math.sin(th)*depth*r))
    faces=[tuple(reversed(range(4)))]
    for j in range(5):
        for i in range(4):
            k=j*4+i; n=j*4+(i+1)%4
            faces.append((k,n,n+4,k+4))
    faces.append(tuple(range(20,24)))
    return mesh(name,verts,faces,mat,parent,1)

# Rigid parts, all pivots at their named joints. L is the +Y side.
group('root',(0,0,0))
group('hip',(0,0,.63),'root')
group('torso',(0,0,.70),'hip')
group('head',(0,0,1.035),'torso')
for side,s in [('L',1),('R',-1)]:
    group('arm'+side,(0,s*.212,.965),'torso')
    group('foreArm'+side,(.005,s*.294,.785),'arm'+side)
    group('hand'+side,(.014,s*.348,.607),'foreArm'+side)
    group('leg'+side,(0,s*.102,.645),'hip')
    group('shin'+side,(.006,s*.135,.405),'leg'+side)
    group('foot'+side,(.008,s*.153,.145),'shin'+side)
    group('weaponSocket'+side,(.035,s*.362,.552),'hand'+side)
group('backpackSocket',(-.118,0,.902),'torso')
N['root']['asset_id']='char.survivor-male'
N['root']['forward']='+X'
N['root']['rig']='rigid-part-v1'

# Pants: soft tailored hip, seam, belt loops, shaped folded legs.
loft('cargo_waist',[(0,0,.59,.092,.166),(0,0,.60,.098,.18),(0,0,.66,.10,.182),(0,0,.695,.096,.176)],'pants','hip')
box('fly',( .102,0,.635),(.008,.028,.097),'pants','hip',.004)
tube('waist_seam',[(.095,-.155,.674),(.106,0,.68),(.095,.155,.674)],.003,'black','hip')
for s in [-1,1]:
    box('belt_loop'+str(s),(.095,s*.114,.668),(.017,.021,.046),'pants','hip',.005)
    tube('slant_pocket'+str(s),[(.076,s*.166,.663),(.108,s*.133,.63),(.101,s*.108,.616)],.003,'pants','hip')
for side,s in [('L',1),('R',-1)]:
    leg='leg'+side; shin='shin'+side; foot='foot'+side
    loft('cargo_thigh'+side,[(0,s*.108,.646,.084,.083),(.0,s*.116,.631,.093,.091),(.0,s*.122,.54,.087,.091),(.005,s*.135,.43,.068,.077),(.005,s*.135,.398,.072,.074)],'pants',leg)
    loft('cargo_calf'+side,[(.005,s*.135,.424,.072,.075),(.0,s*.14,.40,.074,.077),(.012,s*.147,.368,.078,.072),(-.009,s*.151,.34,.062,.076),(.016,s*.152,.312,.079,.077),(-.008,s*.153,.291,.063,.066),(.012,s*.153,.273,.079,.079),(.005,s*.153,.255,.071,.07),(.005,s*.153,.226,.059,.061)],'pants',shin)
    box('cargo_side_pouch'+side,(.009,s*.213,.51),(.125,.05,.121),'pants',leg,.02)
    box('cargo_pocket_flap'+side,(.012,s*.242,.558),(.137,.015,.035),'pants',leg,.009)
    ell('pocket_snap'+side,(.043,s*.253,.557),(.007,.003,.007),'orange',leg,16,8)
    tube('pocket_stitch'+side,[(-.034,s*.24,.535),(-.034,s*.24,.469),(.051,s*.24,.469),(.051,s*.24,.535)],.002,'seam',leg)
    loft('rolled_cuff'+side,[(.004,s*.153,.225,.061,.063),(.004,s*.153,.23,.066,.068),(.004,s*.153,.246,.066,.068),(.004,s*.153,.25,.061,.063)],'pants',shin,16,1)
    loft('cream_sock'+side,[(.004,s*.153,.153,.045,.048),(.004,s*.153,.155,.047,.05),(.004,s*.153,.224,.047,.05),(.004,s*.153,.227,.045,.048)],'white',shin,16,1)
    box('sock_shadow'+side,(.032,s*.153,.17),(.006,.09,.045),'black',shin,.003)
    # Oversized sneakers, stacked sole, rubber toe, ankle collar, eyelets and laces.
    box('sneaker_sole'+side,(.044,s*.153,.030),(.238,.15,.060),'white',foot,.024)
    box('rubber_midsole'+side,(.041,s*.153,.057),(.23,.145,.035),'white',foot,.013)
    box('shoe_upper'+side,(.038,s*.153,.106),(.208,.136,.087),'red',foot,.037)
    box('high_top'+side,(-.031,s*.153,.153),(.10,.131,.115),'red',foot,.03)
    box('toe_cap'+side,(.13,s*.153,.088),(.08,.13,.055),'white',foot,.024)
    box('shoe_tongue'+side,(.024,s*.153,.18),(.056,.071,.098),'white',foot,.014,rot=(0,.22,0))
    box('tongue_label'+side,(.064,s*.153,.212),(.007,.018,.016),'red',foot,.004)
    tube('ankle_collar'+side,[(-.023,s*.213,.193),(-.077,s*.153,.2),(-.023,s*.093,.193)],.011,'red',foot)
    box('ankle_strap'+side,(.011,s*.153,.17),(.025,.145,.025),'white',foot,.008)
    for i in range(4):
        x=.045+i*.023; z=.164-i*.004
        for t in [-1,1]: ell('eyelet'+side+str(i)+str(t),(x,s*.153+t*.031,z),(.006,.006,.004),'seam',foot,12,8)
        tube('lace'+side+str(i),[(x-.005,s*.153-.034,z+.005),(x+.005,s*.153,z+.013),(x-.005,s*.153+.034,z+.005)],.0037,'white',foot)
    tube('lace_bow'+side,[(.043,s*.153,.171),(.039,s*.115,.177),(.023,s*.127,.172),(.043,s*.153,.171),(.039,s*.191,.178),(.025,s*.183,.171)],.003,'white',foot)
    for x in [-.056,-.016,.035,.092]:
        box('sole_tread'+side+str(x),(x,s*.153,.008),(.025,.153,.014),'white',foot,.003)
    ell('shoe_side_badge'+side,(.005,s*.225,.113),(.012,.004,.012),'black',foot,16,8)

# Cream inner sweatshirt; separate red open varsity panels.
loft('sweatshirt',[(0,0,.683,.102,.175),(0,0,.697,.112,.183),(0,0,.775,.104,.174),(0,0,.90,.109,.182),(0,0,.982,.081,.158),(0,0,.999,.065,.12)],'white','torso')
loft('waist_ribbing',[(0,0,.681,.106,.174),(0,0,.685,.115,.181),(0,0,.708,.115,.181),(0,0,.713,.108,.178)],'white','torso',24,1)
loft('jacket_back', [(-.019,0,.706,.095,.182),(-.022,0,.716,.107,.194),(-.025,0,.835,.103,.181),(-.017,0,.958,.107,.191),(-.019,0,.979,.086,.176)],'red','torso')
# Front center insert covers the underlying red torso, giving a clean open jacket.
box('cream_front_insert',(.108,0,.823),(.036,.121,.235),'white','torso',.018)
for s in [-1,1]:
    outline=[(s*.046,.708),(s*.166,.70),(s*.184,.728),(s*.166,.874),(s*.13,.949),(s*.068,.958),(s*.055,.835)]
    verts=[(x,y,z) for x in [.108,.143] for y,z in outline]
    k=len(outline); faces=[tuple(reversed(range(k))),tuple(range(k,2*k))]
    faces += [(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
    o=mesh('red_front_panel'+str(s),verts,faces,'red','torso')
    # Positive volume winding for the mirrored shell.
    if s<0:
        for f in o.data.polygons: f.flip()
    be=o.modifiers.new('Panel soft hem','BEVEL'); be.width=.012; be.segments=3; apply(o,be)
    wn=o.modifiers.new('Panel weighted normals','WEIGHTED_NORMAL'); apply(o,wn)
    tube('front_jacket_piping'+str(s),[(.142,s*.065,.71),(.147,s*.063,.82),(.143,s*.061,.931)],.004,'red','torso')
    box('jacket_hem_stripe'+str(s),(.127,s*.13,.705),(.015,.09,.019),'white','torso',.006)
    for z in [.717,.787,.856]: ell('jacket_snap'+str(s)+str(z),(.145,s*.064,z),(.004,.007,.007),'seam','torso',16,8)
    tube('slash_pocket_welt'+str(s),[(.14,s*.105,.794),(.145,s*.145,.737)],.007,'red','torso')
    box('pocket_tab'+str(s),(.15,s*.132,.784),(.007,.022,.025),'white','torso',.004,rot=(s*.4,0,0))
# Raised fictional letter patch.
ell('chest_patch',(.145,.112,.909),(.005,.02,.027),'white','torso',24,12)
ell('chest_patch_inner',(.151,.112,.909),(.003,.012,.018),'red','torso',16,10)

# Neck, hood cavity, rolled sculpted hood collar with a front V.
ell('neck',(.018,0,1.012),(.052,.058,.067),'skin','torso')
ell('hood_dark_cavity',(-.038,0,.984),(.104,.125,.017),'black','torso')
loft('hood_draped_back',[(-.055,0,.916,.053,.116),(-.078,0,.947,.072,.176),(-.074,0,.995,.078,.177),(-.073,0,1.022,.063,.167),(-.067,0,1.029,.043,.151)],'white','torso',24,1)
tube('hood_rolled_edge',[(.085,-.035,.946),(.07,-.127,.984),(-.026,-.168,1.014),(-.122,-.121,1.024),(-.14,0,1.026),(-.122,.121,1.024),(-.026,.168,1.014),(.07,.127,.984),(.085,.035,.946)],.018,'white','torso')
for s in [-1,1]:
    ell('hood_eyelet'+str(s),(.113,s*.049,.951),(.004,.009,.009),'seam','torso',16,8)
    tube('hood_drawstring'+str(s),[(.119,s*.048,.949),(.133,s*.052,.901),(.134,s*.059,.841)],.0045,'white','torso')
    box('drawstring_tip'+str(s),(.135,s*.059,.833),(.012,.013,.021),'black','torso',.005)

# Puffy sleeves with shoulder overlays, cuff ribbing, watch, articulated hand volumes.
for side,s in [('L',1),('R',-1)]:
    arm='arm'+side; fore='foreArm'+side; hand='hand'+side
    loft('cream_upper_sleeve'+side,[(0,s*.208,.972,.072,.077),(0,s*.22,.959,.079,.085),(0,s*.257,.867,.076,.08),(.006,s*.294,.787,.070,.081),(.006,s*.294,.776,.064,.072)],'white',arm)
    loft('red_shoulder_yoke'+side,[(-.005,s*.206,.980,.070,.073),(-.005,s*.219,.968,.078,.085),(-.003,s*.232,.931,.074,.083),(-.002,s*.247,.903,.072,.077)],'red',arm,16,1)
    loft('cream_fore_sleeve'+side,[(.005,s*.294,.809,.063,.073),(.006,s*.305,.793,.077,.082),(.01,s*.321,.725,.076,.086),(.012,s*.342,.673,.067,.076),(.013,s*.344,.660,.06,.064)],'white',fore)
    tube('sleeve_fold'+side,[(.065,s*.31-.04,.735),(.09,s*.32,.751),(.066,s*.32+.05,.733)],.006,'white',fore)
    loft('charcoal_cuff'+side,[(.011,s*.343,.626,.05,.052),(.011,s*.343,.63,.056,.06),(.011,s*.343,.663,.057,.061),(.011,s*.343,.669,.05,.054)],'black',fore,16,1)
    loft('skin_wrist'+side,[(.014,s*.348,.60,.038,.041),(.014,s*.348,.606,.043,.045),(.013,s*.345,.635,.042,.045),(.013,s*.345,.643,.037,.04)],'skin',hand,16,1)
    loft('wristband'+side,[(.014,s*.348,.606,.044,.046),(.014,s*.348,.612,.048,.05),(.014,s*.348,.626,.048,.05),(.014,s*.348,.63,.044,.046)],'red',hand,16,1)
    box('wristband_clasp'+side,(.056,s*.35,.619),(.008,.025,.022),'white',hand,.004)
    # Palm and individual curled fingers with an inset opening around the thumb.
    ell('palm'+side,(.012,s*.353,.559),(.039,.047,.058),'skin',hand)
    for i in range(4):
        y=s*(.327+i*.017)
        ell('knuckle'+side+str(i),(.016,y,.529),(.026,.013,.025),'skin',hand,12,8)
        ell('curled_finger'+side+str(i),(.034,y,.536),(.018,.012,.022),'skin',hand,12,8)
    ell('thumb'+side,(.051,s*.32,.56),(.024,.02,.032),'skin',hand,16,10)
    tube('palm_crease'+side,[(.048,s*.349,.548),(.05,s*.364,.549),(.046,s*.376,.553)],.0015,'iris',hand)

# Backpack straps follow the shoulders and torso, both visible from the front.
for s in [-1,1]:
    tube('padded_pack_strap'+str(s),[(-.135,s*.127,.94),(-.05,s*.179,.988),(.089,s*.164,.942),(.124,s*.152,.863),(.113,s*.157,.783),(-.10,s*.143,.749)],.017,'black','torso')
    box('teal_strap_pad'+str(s),(.13,s*.154,.871),(.017,.044,.060),'teal','torso',.006,rot=(s*.1,0,0))
    box('strap_adjuster'+str(s),(.137,s*.155,.901),(.013,.041,.016),'orange','torso',.003)
    tube('strap_stitch'+str(s),[(.146,s*.139,.913),(.153,s*.14,.873),(.137,s*.145,.827)],.002,'seam','torso')

# Backpack has a padded body, upper/lower flap pockets, piping and orange hardware.
pack='backpackSocket'
box('pack_back_pad',(-.14,0,.819),(.073,.283,.30),'black',pack,.035)
box('teal_pack_body',(-.208,0,.814),(.18,.303,.312),'teal',pack,.035)
box('pack_top_lid',(-.217,0,.973),(.152,.28,.038),'teal',pack,.018)
tube('carry_handle',[(-.19,-.044,.975),(-.193,-.04,1.014),(-.192,.04,1.014),(-.19,.044,.975)],.01,'black',pack)
box('large_upper_flap',(-.31,0,.871),(.038,.256,.166),'teal',pack,.022)
box('lower_pouch',(-.311,0,.732),(.049,.259,.093),'teal',pack,.018)
box('lower_pouch_flap',(-.34,0,.763),(.014,.254,.032),'teal',pack,.009)
tube('upper_pack_piping',[(-.335,-.113,.925),(-.339,-.119,.869),(-.339,-.11,.802),(-.34,.11,.802),(-.339,.119,.869),(-.335,.113,.925)],.003,'seam',pack)
for z in [.736,.799]:
    box('orange_webbing'+str(z),(-.342,0,z),(.015,.032,.073),'orange',pack,.004)
    box('pack_buckle'+str(z),(-.355,0,z+.014),(.02,.047,.027),'orange',pack,.005)
    box('buckle_slot'+str(z),(-.367,0,z+.014),(.003,.024,.006),'brown',pack,.001)
for s in [-1,1]:
    box('pack_side_pocket'+str(s),(-.209,s*.157,.766),(.13,.03,.137),'teal',pack,.013)
    tube('side_zipper'+str(s),[(-.16,s*.176,.81),(-.245,s*.176,.81)],.003,'black',pack)
    for z in [.752,.918]:
        box('side_webbing'+str(s)+str(z),(-.218,s*.178,z),(.021,.01,.043),'orange',pack,.003)
        box('side_buckle'+str(s)+str(z),(-.219,s*.186,z),(.035,.015,.023),'orange',pack,.004)
        box('side_buckle_hole'+str(s)+str(z),(-.219,s*.195,z),(.017,.003,.01),'brown',pack,.001)
    ell('flap_rivet'+str(s),(-.336,s*.106,.907),(.004,.007,.007),'orange',pack,16,8)
# Corgi patch: actual raised geometry, ears, cheeks, eyes, smile and tongue.
ell('corgi_patch_base',(-.339,0,.863),(.007,.054,.052),'orange',pack)
for s in [-1,1]:
    leaf('corgi_ear'+str(s),(-.342,s*.034,.89),(-.344,s*.041,.935),.019,.008,'orange',pack)
    leaf('corgi_inner_ear'+str(s),(-.351,s*.034,.90),(-.351,s*.04,.926),.01,.004,'iris',pack)
    ell('corgi_cheek'+str(s),(-.348,s*.028,.843),(.006,.027,.022),'white',pack,16,10)
    ell('corgi_eye'+str(s),(-.354,s*.019,.876),(.004,.006,.008),'black',pack,16,10)
    ell('corgi_eye_glint'+str(s),(-.358,s*.018,.878),(.0015,.002,.002),'white',pack,12,8)
ell('corgi_blaze',(-.35,0,.876),(.006,.014,.031),'white',pack,16,10)
ell('corgi_muzzle',(-.356,0,.851),(.005,.021,.011),'white',pack,16,10)
ell('corgi_nose',(-.361,0,.856),(.003,.007,.005),'black',pack,16,8)
ell('corgi_smile',(-.362,0,.842),(.002,.009,.007),'black',pack,16,8)
ell('corgi_tongue',(-.365,0,.839),(.002,.005,.005),'red',pack,16,8)

# Sculpted head: flatter face, full cheeks, tapered jaw. Head height ~1/4 total with hair.
loft('sculpted_face',[(0,0,1.048,.026,.046),(.017,0,1.058,.071,.075),(.019,0,1.091,.111,.105),(.008,0,1.137,.139,.131),(-.005,0,1.196,.148,.145),(-.013,0,1.248,.142,.139),(-.022,0,1.282,.119,.117),(-.026,0,1.3,.052,.067)],'skin','head',32,1,exponent=.67)
for s in [-1,1]:
    ell('ear'+str(s),(-.009,s*.143,1.14),(.026,.033,.043),'skin','head')
    ell('ear_inner'+str(s),(.013,s*.154,1.14),(.007,.022,.029),'iris','head',16,10)
    ell('ear_tragus'+str(s),(.018,s*.136,1.132),(.012,.014,.017),'skin','head',16,10)
    # Eyes are nested shallow domes, with warm irises and distinct reflected highlights.
    o=ell('eye_white'+str(s),(.14,s*.064,1.177),(.009,.032,.039),'white','head',24,16)
    o.rotation_euler.z=s*.24
    ell('eye_iris'+str(s),(.149,s*.065,1.176),(.003,.018,.03),'brown','head',20,12)
    ell('eye_pupil'+str(s),(.152,s*.065,1.176),(.002,.011,.023),'black','head',20,12)
    ell('eye_glint'+str(s),(.155,s*.058,1.189),(.0025,.006,.008),'white','head',12,8)
    ell('eye_tiny_glint'+str(s),(.155,s*.071,1.164),(.002,.0025,.0035),'white','head',12,8)
    tube('upper_eyelid'+str(s),[(.132,s*.032,1.192),(.14,s*.055,1.212),(.13,s*.08,1.21),(.121,s*.093,1.191)],.0035,'brown','head')
    tube('brow'+str(s),[(.137,s*.03,1.225),(.14,s*.061,1.24),(.126,s*.087,1.239)],.006,'brown','head')
# A modeled nose bridge, nose tip and a gentle asymmetric smile.
ell('nose_bridge',(.142,0,1.155),(.015,.013,.024),'skin','head',20,12)
ell('nose_tip',(.155,0,1.141),(.014,.017,.013),'skin','head',20,12)
tube('smile',[(.124,-.026,1.111),(.137,-.003,1.107),(.133,.02,1.109),(.125,.032,1.115)],.0022,'iris','head')
ell('lower_lip',(.134,.001,1.102),(.004,.019,.004),'skin','head',20,10)
box('cheek_bandage',(.129,-.099,1.134),(.008,.035,.017),'white','head',.003,rot=(-.36,0,.36))
for y in [-.09,-.105]: ell('bandage_vent'+str(y),(.135,y,1.134),(.001,.0012,.0012),'seam','head',8,6)

# Hair mass with a sculpted cap and overlapping locks. No cones or flat triangles.
loft('hair_cap',[(-.069,0,1.106,.049,.069),(-.061,0,1.14,.087,.12),(-.055,0,1.20,.111,.15),(-.042,0,1.258,.129,.158),(-.044,0,1.305,.113,.133),(-.046,0,1.338,.067,.079),(-.046,0,1.344,.016,.02)],'brown','head',24,1)
# Front swept fringe leaves clear eye space, with an intentionally uneven hairline.
for i,(base,tip,w) in enumerate([
    ((.036,-.102,1.309),(.091,-.129,1.197),.035),
    ((.065,-.058,1.324),(.143,-.089,1.216),.041),
    ((.06,-.006,1.329),(.147,-.037,1.213),.043),
    ((.045,.047,1.33),(.142,.022,1.24),.043),
    ((.012,.095,1.303),(.101,.09,1.21),.041),
    ((-.02,.126,1.277),(.045,.144,1.155),.029),
    ((-.02,-.126,1.277),(.04,-.144,1.16),.028),
]): leaf('swept_fringe'+str(i),base,tip,w*1.65,.020)
# Radial crown spikes and staggered locks along the back and sides.
for i in range(11):
    a=2*math.pi*i/11
    base=(-.042+.068*math.cos(a),.08*math.sin(a),1.303)
    tip=(-.042+.17*math.cos(a+.18),.17*math.sin(a+.18),1.34+.035*(i%3==0))
    leaf('crown_spike'+str(i),base,tip,.079,.022)
for layer in range(2):
    for i in range(9):
        a=math.pi*.43+math.pi*1.14*i/8
        base=(-.046+.108*math.cos(a),.137*math.sin(a),1.28-layer*.06)
        tip=(-.049+.132*math.cos(a+.14),.158*math.sin(a+.14),1.194-layer*.058)
        leaf('back_hair_lock'+str(layer)+'_'+str(i),base,tip,.070,.017)
leaf('hero_top_tuft',(-.04,-.017,1.326),(.022,-.035,1.396),.045,.02)

N['head'].location.z -= .015
N['head'].scale=(1.05,1.12,1.05)
for side in ['L','R']:
    N['hand'+side].scale=(1.12,1.12,1.1)

bpy.context.view_layer.update()
for name in ['head','handL','handR']:
    g=N[name]; children=[(o,o.matrix_world.copy()) for o in g.children]
    g.scale=(1,1,1); bpy.context.view_layer.update()
    for o,w in children:
        o.matrix_world=w
        if o.type=='EMPTY': o.scale=(1,1,1)

# Merge each rigid part's decorations, retaining every joint and socket as its own node.
bpy.context.view_layer.update()
for name,g in N.items():
    parts=[o for o in list(MODEL.objects) if o.type=='MESH' and o.parent==g]
    if not parts: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    o=bpy.context.object; o.name=name+'_geometry'
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    scene.cursor.location=g.matrix_world.translation
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o['rigid_part']=name

required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
triangles=0
for o in MODEL.objects:
    if o.type=='MESH':
        o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
missing=[n for n in required if n not in N]
report={'id':'char.survivor-male','triangles':triangles,'meshes':sum(o.type=='MESH' for o in MODEL.objects),'nodes_ok':not missing,'missing_nodes':missing}
(HERE/'part-stats.json').write_text(json.dumps({o.name:len(o.data.loop_triangles) for o in MODEL.objects if o.type=='MESH'},indent=2))
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
assert not missing and triangles<=60000, (missing,triangles)
print('BUILD OK',json.dumps(report))
if arg('--glb'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in MODEL.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(arg('--glb')).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False)
    print('GLB OK')

if arg('--view')=='pose':
    N['armL'].rotation_euler.x=math.radians(55)
    N['armL'].rotation_euler.y=math.radians(-35)
    N['foreArmL'].rotation_euler.y=math.radians(-65)
    N['legR'].rotation_euler.y=math.radians(-24)
    N['shinR'].rotation_euler.y=math.radians(25)
    bpy.context.view_layer.update()


def stage(view):
    world=bpy.data.worlds.new('Warm charcoal studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.17,.15,.21,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    def light(name,pos,power,size,color):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos
        o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm softbox',(3,-4,5),420,4,(1,.84,.70))
    light('Cool fill',(1,4,3),260,3,(.70,.79,1))
    light('Hair and pack rim',(-3,-1,4),500,3,(1,.69,.41))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003))
    floor=bpy.context.object; floor.name='Studio floor'; floor.data.materials.append(material('studio','302c36',.88))
    cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam); scene.camera=cam
    positions={'ref':(5.5,-3.8,2.5),'front':(6,0,.70),'side':(0,-6,.70),'back':(-6,0,.70),'pose':(3.8,-5.4,2.7)}
    cam.location=positions[view]; target=Vector((-.035,0,.70))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=2.95
    scene.render.engine='CYCLES'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices: d.use=True
    scene.cycles.device='GPU'
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(Path(arg('--render')).resolve())

if arg('--render'):
    stage(arg('--view','ref')); bpy.ops.render.render(write_still=True); print('RENDER OK')
