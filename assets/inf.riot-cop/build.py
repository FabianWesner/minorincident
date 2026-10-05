"""Deterministic rigid-part hero Infected Riot Cop. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render'); ap.add_argument('--glb'); ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24); ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540)
ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene; parts={}; objects=[]
def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8)]}
M['woodWarm']=mat('woodWarm','b0703f',.55)
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.04,0,.66),'root');node('torso',(-.04,0,.79),'hip');node('head',(.045,0,1.12),'torso');node('backpackSocket',(-.19,0,.95),'torso')
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    if sub:
        mod=o.modifiers.new('sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o

def ell(n,p,sz,m,par,rot=None,seg=10,rings=6):
    seg=min(seg,12 if max(sz)>.2 else 8);rings=min(rings,8 if max(sz)>.2 else 5)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1 if max(sz)>.065 else 0)
def box(n,p,sz,m,par,bevel=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=10,sub=1):
    N=min(N,8)
    largest=max(max(r) if isinstance(r,(tuple,list)) else r for r in radii)
    if largest<.026:sub=0
    v=[];f=[]
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        tangent.normalize();u=tangent.cross(Vector((1,0,0)))
        if u.length<.1:u=tangent.cross(Vector((0,1,0)))
        u.normalize();w=tangent.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def patch(n,pts,m,par,depth=.006):
    # Soft extruded silhouette in the front-facing Y/Z plane, with explicit thickness.
    v=[tuple(p) for p in pts]+[(p[0]-depth,p[1],p[2]) for p in pts];N=len(pts)
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(n,v,f,m,par,0);mod=o.modifiers.new('edge rounding','BEVEL');mod.width=.004;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=False
    return o
# Rounded underclothes and overlapping vest panels.
ell('pelvis',(-.045,0,.665),(.16,.228,.125),'asphalt','hip')
ell('uniform',(-.013,0,.925),(.175,.245,.225),'picketWhite','torso')
ell('vest_core',(-.035,0,.917),(.195,.235,.193),'uiDark','torso')
for x in [.166,-.221]:
    box('vest_plate',(x,0,.94),(.05,.35,.235),'asphalt','torso',.025)
    for j in range(3):box('vest_webbing',(x+(.032 if x>0 else -.032),0,.866+j*.046),(.014,.329,.017),'uiDark','torso',.005)
for s in [-1,1]:
    tube('shoulder_strap',[(-.16,s*.17,.89),(-.14,s*.20,1.077),(.04,s*.20,1.108),(.162,s*.164,.973)],[.033,.039,.035,.029],'asphalt','torso',N=8)
    box('strap_buckle',(.181,s*.16,1.012),(.026,.058,.052),'uiDark','torso',.009)
    for z in [.996,1.036]:ell('strap_rivet',(.20,s*.164,z),(.008,.009,.009),'sidewalk','torso',seg=8,rings=6)
    patch('collar',[(.105,s*.025,1.121),(.12,s*.12,1.095),(.18,s*.094,1.033),(.15,s*.034,1.058)],'picketWhite','torso',.018)
box('belt',(-.033,0,.717),(.35,.475,.08),'uiDark','hip',.027)
box('belt_buckle',(.159,0,.72),(.028,.075,.055),'sidewalk','hip',.009)
for j in range(4):
    y=-.17+j*.113
    box('belt_pouch',(.156,y,.739),(.081,.092,.134),'asphalt','hip',.015)
    box('pouch_flap',(.203,y,.789),(.027,.098,.045),'uiDark','hip',.007)
    box('pouch_tab',(.22,y,.766),(.012,.018,.039),'sidewalk','hip',.004)
for s in [-1,1]:
    box('side_pouch',(-.07,s*.264,.725),(.155,.075,.138),'asphalt','hip',.018)
    box('side_pouch_lid',(-.061,s*.308,.77),(.149,.023,.039),'uiDark','hip',.01)
# Anatomical pivots, relaxed asymmetric shield/baton pose.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.255,1.048)
    elbow=(.042,s*.362,.863 if s==1 else .897)
    wrist=(.18,s*.393,.793 if s==1 else .907)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    node('weaponSocket'+side,wrist,'hand'+side)
    tube('sleeve',[shoulder,(.005,s*.298,1.012),elbow],[.107,.123,.095],'picketWhite','arm'+side,N=12)
    ell('shoulder_pad',(-.014,s*.282,1.041),(.12,.13,.09),'asphalt','arm'+side)
    box('shoulder_plate',(.039,s*.299,1.052),(.147,.16,.09),'uiDark','arm'+side,.018)
    tube('forearm',[elbow,(.112,s*.379,.855 if s==1 else .903),wrist],[.094,.084,.057],'infectedSkin','foreArm'+side,N=12)
    tube('rolled_cuff',[elbow,(.07,s*.369,.854 if s==1 else .90)],[.104,.097],'picketWhite','foreArm'+side,N=12)
    ell('elbow_pad',(-.026,s*.368,elbow[2]),(.055,.112,.09),'asphalt','foreArm'+side)
    box('forearm_armour',(.133,s*.4,.827 if s==1 else .898),(.15,.153,.086),'uiDark','foreArm'+side,.021)
    ell('glove',(.205,s*.394,.794 if s==1 else .905),(.084,.085,.077),'uiDark','hand'+side)
    for j in range(4):
        y=s*(.341+j*.031);z=.803 if s==1 else .923
        tube('clawed_finger',[(.218,y,z),(.27,y,z-.022),(.282,y,z-.061),(.252,y,z-.074)],[.022,.023,.02,.016],'infectedSkin','hand'+side,N=8)
        ell('glove_knuckle',(.228,y,z),(.025,.022,.025),'asphalt','hand'+side,seg=8,rings=6)
    tube('thumb',[(.182,s*.336,.821 if s==1 else .948),(.242,s*.32,.817 if s==1 else .931),(.276,s*.346,.789 if s==1 else .911)],[.031,.026,.019],'infectedSkin','hand'+side,N=8)
    hip=(-.045,s*.142,.658);knee=(.027,s*.212,.389);ankle=(-.035,s*.233,.142)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh',[hip,(-.03,s*.163,.593),(.017,s*.201,.455),knee],[.131,.143,.126,.109],'asphalt','leg'+side,N=12)
    tube('trouser_calf',[knee,(.004,s*.225,.298),ankle],[.113,.107,.084],'asphalt','shin'+side,N=12)
    ell('thigh_plate',(.098,s*.195,.525),(.055,.098,.103),'uiDark','leg'+side)
    for z in [.47,.577]:tube('thigh_strap',[(.029,s*.113,z),(.122,s*.2,z),(-.07,s*.29,z)],[.02]*3,'uiDark','leg'+side,N=8)
    ell('knee_pad',(.119,s*.215,.396),(.063,.112,.093),'uiDark','shin'+side)
    box('knee_plate',(.163,s*.215,.403),(.06,.139,.108),'asphalt','shin'+side,.025)
    box('shin_plate',(.075,s*.231,.253),(.066,.149,.154),'uiDark','shin'+side,.022,rot=(0,-.12,0))
    for z in [.181,.308]:box('shin_strap',(.1,s*.231,z),(.03,.187,.03),'asphalt','shin'+side,.008)
    box('boot_sole',(.032,s*.235,.037),(.338,.22,.074),'uiDark','foot'+side,.027)
    box('boot_welt',(.032,s*.235,.078),(.334,.217,.027),'sidewalk','foot'+side,.012)
    ell('boot',(.025,s*.235,.137),(.165,.102,.091),'uiDark','foot'+side)
    ell('boot_toe',(.126,s*.235,.115),(.084,.103,.058),'asphalt','foot'+side)
    box('boot_ankle',(-.053,s*.235,.178),(.146,.193,.128),'uiDark','foot'+side,.035)
    for j in range(3):box('boot_lace',(-.029+j*.033,s*.235,.205-j*.012),(.012,.11,.012),'sidewalk','foot'+side,.004)
    for j in range(7):box('tread',(-.099+j*.043,s*.235,.009),(.021,.205,.017),'uiDark','foot'+side,.004)
# Large head: visible sculpted muzzle, sunken eyes, jaw and separate ear volumes.
ell('neck',(.033,0,1.132),(.095,.11,.077),'infectedSkin','head')
ell('cranium',(.043,0,1.338),(.225,.237,.233),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.124,0,1.201),(.14,.176,.105),'infectedSkin','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear',(.012,s*.235,1.3),(.055,.035,.071),'infectedSkin','head')
    ell('ear_inner',(.05,s*.245,1.3),(.017,.013,.041),'blood','head')
    ell('cheek',(.197,s*.148,1.258),(.042,.066,.065),'infectedSkin','head')
    ell('socket',(.237,s*.103,1.361),(.024,.074,.054),'blood','head')
    ell('socket_rim',(.253,s*.103,1.361),(.015,.063,.046),'uiDark','head')
    ell('eye',(.266,s*.103,1.363),(.018,.048,.029),'eye','head')
    ell('eye_core',(.28,s*.102,1.369),(.006,.014,.016),'picketWhite','head')
    tube('angry_brow',[(.277,s*.033,1.384),(.261,s*.106,1.408),(.226,s*.172,1.406)],[.027,.03,.017],'uiDark','head',N=10)
    tube('brow_ridge',[(.266,s*.032,1.399),(.25,s*.103,1.424),(.217,s*.165,1.42)],[.018,.023,.012],'infectedSkin','head',N=10)
ell('nose_bridge',(.262,0,1.335),(.035,.037,.065),'infectedSkin','head')
ell('nose',(.299,0,1.308),(.041,.049,.03),'infectedSkin','head')
for s in [-1,1]:ell('nostril',(.319,s*.028,1.297),(.009,.012,.008),'uiDark','head',seg=8,rings=6)
# Actual open mouth cut through both face volumes.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.279,0,1.222))
cutter=bpy.context.object;cutter.scale=(.104,.101,.07);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['cranium','jaw']:
    target=bpy.data.objects[name];mod=target.modifiers.new('snarl opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
ell('mouth_cavity',(.211,0,1.223),(.058,.113,.082),'uiDark','head',seg=16,rings=10)
pts=[(.283,.105*math.cos(i*2*math.pi/24),1.224+.073*math.sin(i*2*math.pi/24)) for i in range(25)]
tube('bloody_lips',pts,[.011 if i<13 else .016 for i in range(25)],'blood','head',N=8)
for row in [0,1]:
    for j in range(7):
        y=(j-3)*.027;z=(1.273 if row==0 else 1.176)+abs(j-3)*(-.004 if row==0 else .004)
        box('snarl_tooth',(.29,y,z),(.024,.019,.026 if j%3==0 else .017),'picketWhite','head',.005)
ell('tongue',(.283,0,1.183),(.02,.046,.011),'survivorRed','head')
# Thick hidden nape/temple hair, helmet shell formed from contoured rings.
for s in [-1,1]:
    tube('temple_hair',[(-.021,s*.218,1.399),(-.003,s*.233,1.32),(.016,s*.219,1.245)],[.044,.036,.006],'uiDark','head',N=8)
for j in range(7):
    y=-.18+j*.06
    tube('nape_hair',[(-.134,y,1.368),(-.17,y,1.29),(-.139,y,1.225)],[.038,.043,.007],'uiDark','head',N=8)
v=[];f=[];N=24
for z,rx,ry in [(1.389,.247,.259),(1.401,.257,.27),(1.472,.249,.265),(1.56,.21,.224),(1.615,.125,.147),(1.633,.018,.02)]:
    for i in range(N):t=i*2*math.pi/N;v.append((.022+rx*math.cos(t),ry*math.sin(t),z))
for j in range(5):
    for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
f.append(tuple(range(5*N,6*N)))
o=mesh('helmet_dome',v,f,'uiDark','head',1);mod=o.modifiers.new('helmet thickness','SOLIDIFY');mod.thickness=.013;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
tube('helmet_rim',[(.022+.258*math.cos(i*2*math.pi/40),.272*math.sin(i*2*math.pi/40),1.402) for i in range(41)],[.019]*41,'uiDark','head',N=8)
# Raised smoked visor ends above the angry brows; eyes remain exposed.
v=[];f=[];N=20
for z in [1.434,1.536]:
    for i in range(N):t=-1.18+2.36*i/(N-1);v.append((.039+.277*math.cos(t),.281*math.sin(t),z))
for i in range(N-1):f.append((i,i+1,i+1+N,i+N))
o=mesh('raised_visor',v,f,'uiDark','head',0);mod=o.modifiers.new('visor thickness','SOLIDIFY');mod.thickness=.008;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
M['uiDark'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.46
for z in [1.434,1.536]:tube('visor_trim',[(.042+.28*math.cos(-1.18+2.36*i/20),.284*math.sin(-1.18+2.36*i/20),z) for i in range(21)],[.009]*21,'sidewalk','head',N=6,sub=0)
for s in [-1,1]:
    ell('helmet_hinge',(.061,s*.279,1.451),(.063,.027,.058),'uiDark','head')
    ell('hinge_bolt',(.061,s*.304,1.451),(.024,.01,.024),'sidewalk','head')
    tube('chin_strap',[(.015,s*.249,1.384),(.069,s*.228,1.235),(.175,s*.108,1.121),(.177,0,1.107)],[.014,.017,.016,.012],'uiDark','head',N=8)
box('chin_buckle',(.188,-.104,1.129),(.032,.044,.031),'asphalt','head',.006)
# Baton held in right hand, with guard, grip rings and bloodied tip.
tube('baton',[(.252,-.403,.813),(.252,-.403,.915),(.347,-.404,1.233),(.406,-.404,1.429)],[.032,.032,.027,.026],'asphalt','handR',N=12)
ell('baton_guard',(.272,-.403,.975),(.063,.057,.024),'uiDark','handR',rot=(0,.29,0))
for j in range(5):ell('grip_ring',(.253+j*.005,-.403,.86+j*.02),(.037,.037,.009),'uiDark','handR',rot=(0,.29,0),seg=12,rings=6)
tube('baton_blood',[(.378,-.405,1.335),(.399,-.405,1.414),(.407,-.405,1.444)],[.03,.029,.014],'blood','handR',N=10)
# Large riot shield with rounded border, bolts, identification stripe and rear handles.
node('shield',(.29,.431,.776),'handL')
box('shield_panel',(.32,.466,.769),(.055,.415,.96),'asphalt','shield',.041)
for y in [.246,.686]:box('shield_edge',(.326,y,.769),(.083,.035,.958),'sidewalk','shield',.013)
for z in [.292,1.246]:box('shield_edge',(.326,.466,z),(.083,.448,.032),'sidewalk','shield',.01)
box('shield_inner',(.357,.466,.772),(.025,.363,.86),'asphalt','shield',.018)
box('shield_stripe',(.375,.466,.79),(.015,.383,.169),'picketWhite','shield',.008)
for y in [.278,.654]:
    for z in [.33,.595,1.005,1.207]:ell('shield_bolt',(.377,y,z),(.013,.013,.014),'woodWarm','shield',seg=8,rings=6)
for z in [.632,.911]:
    box('shield_rear_mount',(.267,.463,z),(.025,.182,.05),'uiDark','shield',.01)
    tube('shield_handle',[(.264,.4,z),(.205,.4,z),(.205,.524,z),(.264,.524,z)],[.013]*4,'uiDark','shield',N=8)
# Extruded type is real geometry with 4 mm or more clearance.
def lettering(n,body,p,size,par,back=False):
    cu=bpy.data.curves.new(n,'FONT');cu.body=body;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.0015;cu.bevel_depth=.0004;cu.bevel_resolution=0;cu.resolution_u=3
    font=Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
    if font.exists():cu.font=bpy.data.fonts.load(str(font))
    o=bpy.data.objects.new(n,cu);S.collection.objects.link(o);o.location=p
    # text local X along model +/- Y; local Y up, normal +/-X
    o.rotation_euler=Vector((-1 if back else 1,0,0)).to_track_quat('Z','Y').to_euler()
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object
    return finish(o,n,'picketWhite' if back else 'uiDark',par)
lettering('shield_POLICE','POLICE',(.388,.466,.789),.122,'shield')
box('back_id_panel',(-.258,0,.977),(.018,.32,.106),'uiDark','torso',.01)
lettering('back_POLICE','POLICE',(-.274,0,.977),.093,'torso',True)
# Raised stains and gouges: ray projected onto named surfaces with >= 3mm clearance.
def stain(n,target,y,z,ry,rz,back=False):
    obj=bpy.data.objects[target];bpy.context.view_layer.update();inv=obj.matrix_world.inverted()
    pts=[(y,z)]+[(y+ry*(.72+.28*((i*7)%5)/4)*math.cos(i*2*math.pi/9),z+rz*(.7+.3*((i*3)%5)/4)*math.sin(i*2*math.pi/9)) for i in range(9)]
    vs=[];direction=Vector((1 if back else -1,0,0))
    for yy,zz in pts:
        start=Vector((-1 if back else 1,yy,zz));hit,loc,normal,index=obj.ray_cast(inv@start,inv.to_3x3()@direction)
        if not hit:return
        p=obj.matrix_world@loc;p.x+=-.004 if back else .004;vs.append(p)
    mesh(n,vs,[(0,i+1,(i+1)%9+1) for i in range(9)],'blood',obj.parent.name,0)
for j,(target,y,z,ry,rz) in enumerate([
 ('cranium',-.18,1.298,.027,.044),('jaw',-.063,1.166,.035,.033),('jaw',.092,1.179,.036,.022),
 ('helmet_dome',-.097,1.578,.041,.025),('helmet_dome',.156,1.48,.025,.034),
 ('raised_visor',-.095,1.465,.028,.022),('vest_plate',-.087,1.028,.031,.022),
 ('shield_inner',.571,.547,.027,.07),('shield_inner',.326,1.065,.02,.053),('shield_inner',.592,1.121,.023,.017)]):stain('blood_stain',target,y,z,ry,rz)
for side,s in [('L',1),('R',-1)]:
    # find repeated named sleeve/thigh meshes deterministically
    sleeve=next(o for o in objects if o.name.startswith('sleeve') and o.parent==parts['arm'+side])
    thigh=next(o for o in objects if o.name.startswith('trouser_thigh') and o.parent==parts['leg'+side])
    for j in range(4):stain('sleeve_blood',sleeve.name,s*(.275+j*.026),1.017-j*.033,.022,.025)
    for j in range(3):stain('thigh_blood',thigh.name,s*(.16+j*.025),.565-j*.04,.024,.026)
    patch('torn_sleeve',[(.102,s*.326,.953),(.113,s*.35,.93),(.118,s*.337,.875)],'picketWhite','arm'+side)
for j in range(5):
    y=.29+j*.075;z=.427+j*.135
    tube('shield_scratch',[(.377,y,z),(.379,y+.015,z+.061)],[.0025,.001],'sidewalk','shield',N=6,sub=0)
# Armour fastenings, thick cloth folds and boot buckles complete the hero surfaces.
for side,s in [('L',1),('R',-1)]:
    for j in range(3):
        box('gauntlet_segment',(.177,s*(.355+j*.039),.842 if s==1 else .914),(.086,.033,.029),'asphalt','foreArm'+side,.008)
    box('shoulder_insignia',(.117,s*.305,1.056),(.01,.056,.045),'sidewalk','arm'+side,.007)
    box('shoulder_insignia_bar',(.124,s*.305,1.057),(.008,.013,.023),'uiDark','arm'+side,.003)
    for j,z in enumerate([.58,.52,.461]):
        tube('trouser_fold',[(.065,s*.13,z+.013),(.112,s*.189,z),(.064,s*.265,z-.016)],[.006,.014,.004],'asphalt','leg'+side,N=8)
    for j,z in enumerate([.29,.205]):
        tube('calf_fold',[(.018,s*.143,z+.005),(.071,s*.23,z+.014),(.013,s*.311,z-.008)],[.005,.01,.004],'asphalt','shin'+side,N=8)
    box('boot_top_strap',(.026,s*.235,.194),(.038,.201,.03),'asphalt','foot'+side,.008)
    box('boot_buckle',(.049,s*.317,.194),(.025,.035,.028),'sidewalk','foot'+side,.006)
    for j in range(2):
        ell('kneepad_rivet',(.183,s*(.18+j*.07),.403),(.008,.01,.009),'sidewalk','shin'+side,seg=8,rings=6)
# Blood trails flow down from the injured jaw and sleeve folds.
tube('jaw_blood_trail',[(.251,-.122,1.212),(.239,-.101,1.16),(.175,-.062,1.111)],[.011,.014,.004],'blood','head',N=6)
for j in range(6):
    stain('helmet_rear_blood','helmet_dome',-.17+j*.065,1.433+(j%3)*.039,.017,.027,True)
for j in range(5):
    stain('back_armour_blood','vest_plate.001',-.12+j*.059,.846+(j%3)*.036,.018,.02,True)
# Proximal caps remain after distal part detachment.
for key,parent in [('head','torso'),('armL','torso'),('armR','torso'),('foreArmL','armL'),('foreArmR','armR'),('legL','hip'),('legR','hip')]:
    p=parts[key].matrix_world.translation
    sz=(.08,.013,.08) if 'Arm' in key or 'arm' in key else (.085,.09,.014)
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Resolution is specified at construction; no nondeterministic collapse decimation.
# Triangulate explicitly and discard zero-area remnants from bevels/boolean cuts.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP')
    tiny=[f for f in bm.faces if f.calc_area()<1e-8]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
# Merge static decorations by material within each rigid parent; keep all cap names separate.
# Boolean openings may add an unused cutter-material slot; keep every slot palette-backed.
for o in objects:
    fallback=next(m for m in o.data.materials if m)
    materials=[m or fallback for m in o.data.materials]
    unique=list(dict.fromkeys(materials))
    indices=[unique.index(materials[f.material_index]) for f in o.data.polygons]
    o.data.materials.clear()
    for m in unique:o.data.materials.append(m)
    for f,index in zip(o.data.polygons,indices):f.material_index=index
caps=[o for o in objects if o.name.startswith('stump_')]
buckets={}
for o in objects:
    if not o.name.startswith('stump_'):
        buckets.setdefault((o.parent.name,tuple(m.name for m in o.data.materials)),[]).append(o)
joined=[]
for (parent,material),group in buckets.items():
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__'+material[0]+('_regions' if len(material)>1 else '');joined.append(o)
objects=joined+caps
# Bake a restrained infected lurch into surfaces and pivot positions.
parts['hip'].location.z-=.035
parts['torso'].rotation_euler.y=.18
parts['head'].rotation_euler.y=-.10
parts['armL'].rotation_euler.y=-.14
parts['armR'].rotation_euler.y=-.20
for side,angle in [('L',.17),('R',.23)]:
    parts['leg'+side].rotation_euler.y=-angle
    parts['shin'+side].rotation_euler.y=2*angle
    parts['foot'+side].rotation_euler.y=-angle
# Caps have an export-hidden zero scale; restore temporarily to bake their actual surfaces.
for cap in caps:cap.scale=(1,1,1)
bpy.context.view_layer.update()
node_positions={n:o.matrix_world.translation.copy() for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
mesh_parents={o.name:o.parent.name for o in objects}
for o in objects:
    o.data.transform(o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
for n,o in parts.items():
    o.parent=None;o.matrix_world=Matrix.Translation(node_positions[n])
for n,o in parts.items():
    if parents[n]:
        o.parent=parts[parents[n]];o.matrix_parent_inverse=Matrix.Identity(4)
        o.location=node_positions[n]-node_positions[parents[n]]
bpy.context.view_layer.update()
for o in objects:
    o.parent=parts[mesh_parents[o.name]];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    o.matrix_basis=Matrix.Identity(4)
# Ground both planted shoes after the knee bend. A tiny per-shoe shift avoids any floating sole.
bpy.context.view_layer.update()
for side in ['L','R']:
    shoe_objects=[o for o in objects if o.parent==parts['foot'+side]]
    floor=min((o.matrix_world@v.co).z for o in shoe_objects for v in o.data.vertices)
    parts['foot'+side].location.z-=floor
for cap in caps:cap.scale=(0,0,0)
bpy.context.view_layer.update()
# Record before stage objects. Export includes hidden caps as zero scale nodes.
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket','weaponSocketL','weaponSocketR']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
bpy.context.view_layer.update()
bounds=[o.matrix_world@v.co for o in objects if not o.name.startswith('stump_') for v in o.data.vertices]
(P/'rig-rest.json').write_text(json.dumps({'height':max(v.z for v in bounds)-min(v.z for v in bounds),'feet_min_z':min(v.z for v in bounds),'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'hierarchy':{n:o.parent.name if o.parent else None for n,o in parts.items()},'rest_rotations_zero':all(sum(v*v for v in o.rotation_euler)<1e-12 for o in parts.values()),'rest_scales_one':all((o.scale-Vector((1,1,1))).length<1e-6 for o in parts.values())},indent=2))
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
assert triangles <= 40000, f'Infected budget exceeded: {triangles}'
assert all(n in bpy.data.objects for n in required), 'Required joint/cap absent'
assert not any(o.modifiers for o in objects), 'Export must contain applied meshes'

(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.5;parts['foreArmL'].rotation_euler.y=-.7;parts['legR'].rotation_euler.y=-.35
    # First articulate all requested joints, then offset the amputated arm as a detached rigid branch.
    bpy.context.view_layer.update()
    arm=parts['armL'];world=arm.matrix_world.copy();arm.parent=None;arm.matrix_world=world;arm.location+=Vector((.65,-.80,.18))
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
def make_turnaround(output_path):
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','review-hero.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(output_path);sheet.file_format='PNG';sheet.save()
    print('OK turnaround')
if a.render and a.view=='turnaround':
    make_turnaround(a.render);sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35),'pose':(6,4,2.9)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.05*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review-set','final-review']:
        folder=Path(a.render).parent;folder.mkdir(parents=True,exist_ok=True)
        S.render.resolution_x=960;S.render.resolution_y=540;S.cycles.samples=24
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(folder/('review-hero.png' if view=='hero' else view+'.png'))
            bpy.ops.render.render(write_still=True)
        if a.view=='final-review':
            cam.location=views['hero'];cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.resolution_x=1600;S.render.resolution_y=900;S.cycles.samples=96
            S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
            make_turnaround(P/'renders'/'turnaround.png')
    else:bpy.ops.render.render(write_still=True)
    if a.view=='final-all':make_turnaround(P/'renders'/'turnaround.png')
print('OK',triangles,'triangles',len(objects),'meshes')
