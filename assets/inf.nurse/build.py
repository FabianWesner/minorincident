"""Deterministic rigid-part hero infected nurse. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json, random
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
S=bpy.context.scene; rng=random.Random(71); parts={}; objects=[]
def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('backpackTeal','2f6e6a',.78),('woodWarm','593a32',.82)]}
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(0,0,.68),'root');node('torso',(0,0,.83),'hip');node('head',(.015,0,1.19),'torso');node('backpackSocket',(-.18,0,1.02),'torso')
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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1)
def box(n,p,sz,m,par,bevel=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=10,sub=1):
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
# Scrub tunic: smooth volumes, separate collar, sleeve cuffs, pockets and hems.
ell('pelvis',(0,0,.69),(.155,.218,.12),'backpackTeal','hip')
ell('scrub_tunic',(.012,0,.944),(.173,.228,.249),'backpackTeal','torso',seg=16,rings=10)
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
for s in [-1,1]:
    patch('v_collar'+str(s),[(.101,s*.047,1.167),(.153,s*.15,1.109),(.189,s*.065,.994),(.198,0,1.051)],'backpackTeal','torso',.019)
    tube('collar_piping'+str(s),[(.113,s*.053,1.162),(.181,s*.073,1.076),(.205,0,1.026)],[.004]*3,'backpackTeal','torso',N=8)
    patch('tunic_hem'+str(s),[(.132,s*.013,.85),(.148,s*.205,.83),(.125,s*.224,.732),(.16,s*.141,.745),(.178,s*.078,.716),(.163,s*.011,.758)],'backpackTeal','torso',.023)
    box('pocket'+str(s),(.165,s*.147,.857),(.025,.109,.101),'backpackTeal','torso',.016,rot=(0,0,-s*.12))
    tube('pocket_welt'+str(s),[(.181,s*.095,.9),(.18,s*.146,.898),(.158,s*.197,.89)],[.008]*3,'sidewalk','torso',N=8)
    for j in range(3):
        tube('tunic_fold'+str(s)+str(j),[(.164,s*.045,.95-j*.04),(.18,s*.1,.968-j*.04),(.142,s*.2,.962-j*.04)],[.004,.01,.003],'backpackTeal','torso',N=8)
# The rear tunic hangs over the waistband rather than exposing a separate hip volume.
v=[];f=[];N=16
for z,rx,ry in [(.86,.18,.226),(.79,.19,.24),(.72,.198,.247),(.707,.193,.241)]:
    for j in range(N):
        t=math.pi/2+j*math.pi/(N-1);v.append((-.005+rx*math.cos(t),ry*math.sin(t),z))
for k in range(3):
    for j in range(N-1):f.append((k*N+j,k*N+j+1,(k+1)*N+j+1,(k+1)*N+j))
o=mesh('rear_scrub_hem',v,f,'backpackTeal','torso',1)
mod=o.modifiers.new('fabric shell','SOLIDIFY');mod.thickness=.014;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('scrub_sleeve'+side,[shoulder,(-.005,s*.28,1.054),(.006,s*.312,.98),(.013,s*.326,.95)],[.099,.12,.115,.108],'backpackTeal','arm'+side,N=12)
    tube('sleeve_hem'+side,[(.009,s*.316,.978),(.013,s*.329,.952)],[.116,.112],'backpackTeal','arm'+side,N=12)
    tube('upper_arm'+side,[(.015,s*.32,.964),elbow,(.047,s*.369,.85)],[.075,.083,.068],'infectedSkin','arm'+side,N=12)
    tube('forearm_skin'+side,[elbow,(.055,s*.383,.816),wrist],[.074,.079,.051],'infectedSkin','foreArm'+side,N=12)
    tube('wristband'+side,[(.074,s*.407,.773),(.086,s*.418,.753)],[.061,.06],'picketWhite' if side=='L' else 'survivorRed','foreArm'+side,N=12)
    box('wristband_clasp'+side,(.137,s*.412,.769),(.018,.041,.026),'sidewalk','foreArm'+side,.005)
    ell('palm'+side,(.087,s*.424,.72),(.063,.078,.079),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.357+i*.042);z=.696-(.006 if i in [0,3] else .018)
        pts=[(.105,y,z),(.145,y+s*(i-1.5)*.01,z-.045),(.18,y+s*(i-1.5)*.017,z-.087),(.215,y+s*(i-1.5)*.018,z-.057)]
        tube('claw'+side+str(i),pts,[.024,.024,.018,.01],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.12,y,z),(.025,.022,.024),'infectedSkin','hand'+side)
        ell('nail'+side+str(i),pts[-1],(.008,.013,.017),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.108,s*.365,.748),(.167,s*.338,.715),(.193,s*.35,.679)],[.034,.026,.016],'infectedSkin','hand'+side,N=10)
    hip=(0,s*.124,.694);knee=(.024,s*.176,.415);ankle=(-.019,s*.198,.155)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh'+side,[hip,(-.005,s*.137,.629),(.013,s*.168,.493),knee],[.122,.137,.119,.106],'backpackTeal','leg'+side,N=12)
    tube('trouser_calf'+side,[knee,(.016,s*.186,.362),(-.008,s*.195,.264),ankle],[.108,.119,.101,.089],'backpackTeal','shin'+side,N=12)
    for j,z in enumerate([.59,.48,.32,.23,.17]):
        par='leg'+side if j<2 else 'shin'+side
        tube('cloth_crease'+side+str(j),[(.07,s*.11,z+.022),(.12,s*.17,z),(.066,s*.245,z-.015)],[.005,.017,.004],'backpackTeal',par,N=8)
    ell('knee_torn_inset'+side,(.121,s*.172,.484),(.02,.055,.055),'infectedSkin','leg'+side)
    ell('knee_wound'+side,(.141,s*.172,.478),(.007,.036,.035),'blood','leg'+side)
    for j in range(4):
        patch('knee_rag'+side+str(j),[(.143,s*(.119+j*.025),.524),(.146,s*(.144+j*.025),.52),(.145,s*(.133+j*.025),.494-(j%2)*.025)],'backpackTeal','leg'+side)
    tube('rolled_pant_cuff'+side,[(-.015,s*.197,.192),(-.019,s*.198,.159)],[.1,.097],'backpackTeal','shin'+side,N=12)
    box('shoe_sole'+side,(.048,s*.204,.034),(.293,.185,.068),'picketWhite','foot'+side,.024)
    box('shoe_welt'+side,(.049,s*.204,.067),(.294,.187,.028),'sidewalk','foot'+side,.015)
    ell('sneaker_body'+side,(.048,s*.204,.111),(.144,.087,.077),'asphalt','foot'+side)
    ell('sneaker_toe'+side,(.128,s*.204,.098),(.071,.088,.051),'picketWhite','foot'+side)
    ell('shoe_tongue'+side,(-.006,s*.204,.17),(.068,.058,.025),'sidewalk','foot'+side)
    for j in range(4):
        tube('lace'+side+str(j),[(-.041+j*.023,s*.166,.169),(-.026+j*.023,s*.204,.189-j*.006),(-.031+j*.023,s*.243,.168)],[.005]*3,'picketWhite','foot'+side,N=6,sub=0)
    for j in range(6):
        box('sole_tread'+side+str(j),(-.063+j*.043,s*.204,.009),(.014,.168,.017),'asphalt','foot'+side,.004)
    tube('shoe_side_panel'+side,[(-.047,s*.287,.107),(.014,s*.292,.094),(.073,s*.29,.114)],[.011,.023,.006],'sidewalk','foot'+side,N=8)
# Head, strong orbital shapes and screaming mouth; face planes project forward.
ell('cranium',(.009,0,1.349),(.164,.17,.214),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.07,0,1.235),(.113,.128,.09),'infectedSkin','head')
for s in [-1,1]:
    ell('ear'+str(s),(.012,s*.169,1.321),(.047,.035,.062),'infectedSkin','head')
    ell('ear_inner'+str(s),(.046,s*.18,1.322),(.016,.018,.036),'blood','head')
    ell('cheek'+str(s),(.113,s*.112,1.291),(.038,.048,.054),'infectedSkin','head')
    ell('eye_socket'+str(s),(.141,s*.082,1.37),(.023,.059,.052),'blood','head')
    ell('eye_dark_rim'+str(s),(.157,s*.082,1.37),(.012,.046,.044),'uiDark','head')
    ell('eye_glow'+str(s),(.166,s*.082,1.371),(.016,.041,.039),'eye','head')
    ell('eye_core'+str(s),(.178,s*.079,1.376),(.004,.012,.014),'picketWhite','head',seg=12,rings=8)
    tube('angry_brow'+str(s),[(.159,s*.028,1.399),(.167,s*.072,1.431),(.13,s*.13,1.433)],[.02,.025,.015],'uiDark','head',N=10)
    tube('brow_ridge'+str(s),[(.151,s*.028,1.411),(.16,s*.075,1.444),(.121,s*.136,1.44)],[.017,.02,.01],'infectedSkin','head',N=10)
# Carve a genuine opening through jaw and face before inserting the mouth lining.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.20,0,1.254))
cutter=bpy.context.object;cutter.scale=(.088,.070,.076);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['cranium','jaw']:
    obj=bpy.data.objects[name];mod=obj.modifiers.new('open mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Mouth dark cavity and raised irregular lip ring, not a painted line.
ell('mouth_cavity',(.156,0,1.254),(.031,.069,.077),'uiDark','head',seg=20,rings=12)
pts=[]
for i in range(25):
    t=i*2*math.pi/24;pts.append((.196,.072*math.cos(t),1.257+.082*math.sin(t)))
tube('torn_bloody_lips',pts,[.010 if i<13 else .017 for i in range(len(pts))],'blood','head',N=8)
ell('nose_bridge',(.167,0,1.351),(.035,.028,.058),'infectedSkin','head')
ell('nose_tip',(.203,0,1.327),(.035,.037,.022),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.22,s*.021,1.316),(.008,.01,.006),'uiDark','head',seg=8,rings=6)
for row in [0,1]:
    for j in range(5):
        y=(j-2)*.023;z=(1.309 if row==0 else 1.205)+(abs(j-2)*(-.004 if row==0 else .004))
        box('tooth'+str(row)+str(j),(.205,y,z),(.025,.018,([.031,.023,.017,.024,.03] if row==0 else [.012,.019,.017,.011,.018])[j]),'picketWhite','head',.006,rot=(.1*(j-2),0,0))
ell('tongue',(.21,0,1.213),(.012,.031,.014),'survivorRed','head')
# Brown hair swept into a high bun, red scrunchie and sculpted loose strands.
def lock(n,start,bend,tip,width):
    p0,p1,p2=map(Vector,[start,bend,tip])
    tube(n,[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.72),p2],[.012,(width*.8,width*.55),(width,width*.6),(width*.4,width*.25),.002],'woodWarm','head',N=8)
ell('hair_cap',(-.039,0,1.45),(.175,.187,.153),'woodWarm','head',seg=18,rings=12)
for j in range(16):
    t=j*math.tau/16
    lock('swept_hair'+str(j),(-.075,.025,1.57),(-.035+.152*math.cos(t),.177*math.sin(t),1.482),(-.03+.17*math.cos(t),.187*math.sin(t),1.339),.066)
for j in range(6):
    y=-.139+j*.053
    lock('fringe'+str(j),(-.02,y*.6,1.57),(.112,y,1.5),(.16,y-.016,1.405+(j%3)*.015),.055)
ell('bun_core',(-.125,.01,1.61),(.12,.135,.104),'woodWarm','head',seg=16,rings=10)
for j in range(10):
    t=j*math.tau/10
    lock('bun_lock'+str(j),(-.12,.01,1.709),(-.14+.11*math.cos(t),.01+.125*math.sin(t),1.66),(-.1+.08*math.cos(t+.7),.01+.09*math.sin(t+.7),1.565),.05)
for j in range(16):
    t=j*math.tau/16
    ell('scrunchie'+str(j),(-.104+.12*math.cos(t),.007+.135*math.sin(t),1.591),(.026,.025,.024),'survivorRed','head',seg=8,rings=6)
for s in [-1,1]:
    lock('loose_temple'+str(s),(.01,s*.162,1.459),(.075,s*.187,1.358),(.1,s*.183,1.239),.025)
    lock('loose_nape'+str(s),(-.14,s*.11,1.438),(-.164,s*.147,1.342),(-.17,s*.15,1.257),.038)
for j in range(5):
    t=j*math.tau/5
    tube('bun_flyaway'+str(j),[(-.13+.07*math.cos(t),.01+.075*math.sin(t),1.68),(-.14+.14*math.cos(t),.015+.16*math.sin(t),1.73),(-.1+.17*math.cos(t+.4),.02+.175*math.sin(t+.4),1.67)],[.006,.008,.003],'woodWarm','head',N=6)
for j in range(9):
    t=1.52+j*.38
    lock('layered_nape'+str(j),(-.03+.14*math.cos(t),.16*math.sin(t),1.414),(-.038+.17*math.cos(t),.18*math.sin(t),1.336),(-.035+.17*math.cos(t),.17*math.sin(t),1.226+(j%2)*.025),.062)
# Medical instruments and an independent hanging ID on a woven lanyard.
for s in [-1,1]:
    tube('lanyard'+str(s),[(.075,s*.055,1.182),(.188,s*.111,1.049),(.213,s*.073,.897),(.224,.045,.846)],[.007]*4,'uiDark','torso',N=8)
box('id_clip',(.23,.046,.845),(.023,.034,.031),'sidewalk','torso',.004)
box('id_card',(.23,.046,.793),(.018,.093,.116),'picketWhite','torso',.007,rot=(.08,-.03,.02))
box('id_photo',(.242,.025,.808),(.007,.027,.035),'backpackTeal','torso',.003)
for j in range(3):box('id_print'+str(j),(.243,.07,.818-j*.016),(.007,.022,.004),'asphalt','torso',.001)
box('id_red_cross_horizontal',(.245,.033,.766),(.007,.029,.007),'blood','torso',.001)
box('id_red_cross_vertical',(.249,.033,.766),(.007,.007,.03),'blood','torso',.001)
tube('stethoscope_neck',[(-.052,-.08,1.157),(.106,-.145,1.135),(.186,-.156,1.062),(.209,-.163,.962),(.213,-.125,.9),(.217,-.064,.919),(.212,-.056,.977)],[.014]*7,'uiDark','torso',N=10)
tube('stethoscope_branch',[(-.052,.08,1.157),(.115,.144,1.131),(.192,.145,1.069),(.205,.167,1.001)],[.014]*4,'uiDark','torso',N=10)
tube('stethoscope_metal_y',[(.212,-.056,.978),(.221,-.045,1.033),(.221,-.072,1.086)],[.004]*3,'backpackTeal','torso',N=8)
ell('stethoscope_diaphragm',(.216,.162,.986),(.018,.039,.039),'sidewalk','torso')
ell('stethoscope_diaphragm_inset',(.234,.162,.986),(.007,.027,.027),'asphalt','torso')
# Genuine torn openings rather than raised fake wound plates.
def tear(name,center,size):
    target=bpy.data.objects[name]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=target.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
for side,s in [('L',1),('R',-1)]:
    tear('trouser_thigh'+side,(.139,s*.173,.483),(.055,.06,.061))
tear('scrub_tunic',(-.16,.04,.907),(.071,.086,.043))
ell('back_exposed_skin',(-.11,.04,.907),(.026,.086,.043),'infectedSkin','torso')
for j in range(4):
    patch('back_torn_flap'+str(j),[(-.171,-.057+j*.04,.95),(-.18,-.025+j*.04,.947),(-.182,-.043+j*.04,.905-j*.006)],'backpackTeal','torso')
# Raised conforming splat meshes. Cast into the garment and keep >=4 mm clearance.
def splat(n,x,y,z,ry,rz,par):
    pts=[(x,y,z)]
    for i in range(11):
        t=i*math.tau/11;r=rng.uniform(.5,1.18);pts.append((x,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    o=mesh(n,pts,[(0,i+1,(i+1)%11+1) for i in range(11)],'blood',par,0)
    bpy.context.view_layer.update()
    targets=[p for p in objects if p!=o and p.parent==parts[par] and not p.name.startswith(('blood','stump')) and p.data.materials[0]!=M['blood']]
    direction=Vector((-1,0,0) if x>=0 else (1,0,0));startx=.7 if x>=0 else -.7
    for v in o.data.vertices:
        start=Vector((startx,v.co.y,v.co.z));hits=[]
        for target in targets:
            inv=target.matrix_world.inverted();hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(target.matrix_world@loc)
        if hits:
            hit=min(hits,key=lambda p:(p-start).length);v.co.x=hit.x+(.004 if x>=0 else -.004)
    for f in o.data.polygons:f.use_smooth=False
for j,(x,y,z,ry,rz,par) in enumerate([
    (.2,-.11,1.3,.024,.06,'head'),(.2,.11,1.31,.026,.036,'head'),(.2,.025,1.196,.035,.034,'head'),
    (.2,-.15,1.08,.035,.034,'torso'),(.2,.08,.948,.03,.034,'torso'),(.2,-.12,.842,.038,.027,'torso'),
    (-.2,-.1,1.047,.034,.057,'torso'),(-.2,.035,.951,.06,.045,'torso'),(-.2,.08,.795,.054,.035,'torso'),
    (.2,.047,.785,.025,.033,'torso')]):splat('blood_main'+str(j),x,y,z,ry,rz,par)
for s,side in [(1,'L'),(-1,'R')]:
    for j,(y,z,ry,rz,par) in enumerate([(s*.308,.995,.032,.025,'arm'+side),(s*.37,.84,.039,.057,'foreArm'+side),(s*.43,.725,.049,.05,'hand'+side),(s*.165,.549,.05,.04,'leg'+side),(s*.196,.26,.035,.04,'shin'+side)]):
        splat('blood_limb'+side+str(j),.2,y,z,ry,rz,par)
    for j in range(7):
        splat('blood_scrub_fleck'+side+str(j),.2,s*rng.uniform(.02,.16),rng.uniform(.77,1.11),.008,.009,'torso')
    splat('blood_heel'+side,-.2,s*.2,.08,.031,.017,'foot'+side)
tube('chin_blood',[(.18,-.015,1.203),(.164,-.02,1.158),(.138,-.015,1.135)],[.016,.011,.003],'blood','head',N=8)
for side,sign in [('L',1),('R',-1)]:
    splat('blood_claw_back'+side,-.2,sign*.422,.721,.051,.049,'hand'+side)
    for j in range(3):
        tube('sleeve_wrinkle'+side+str(j),[(.06,sign*.275,1.025-j*.017),(.103,sign*.31,1.012-j*.017),(.064,sign*.345,.998-j*.017)],[.007,.012,.004],'backpackTeal','arm'+side,N=8)
    tube('sneaker_pink_panel'+side,[(-.037,sign*.286,.133),(.013,sign*.298,.115),(.048,sign*.293,.124)],[.012,.017,.006],'infectedSkin','foot'+side,N=8)
# Stump caps remain on proximal nodes; zero scale is the portable hidden state.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.124,.694),(.09,.095,.012)),('legR','hip',(0,-.124,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.49
        bpy.ops.object.modifier_apply(modifier=mod.name)
# Triangulate explicitly and discard zero-area remnants from bevels/boolean cuts.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
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
# Establish the lurching rest pose, then bake it into geometry and joint positions.
# Rest nodes export at unit scale/zero rotation: procedural animation adds motion to this pose.
parts['head'].scale=(1.40,1.48,1.16)
parts['hip'].location.z-=.10
parts['torso'].rotation_euler.y=.24
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.12,-.45 if side=='L' else -.25,0)
    parts['foreArm'+side].rotation_euler.y=-.42 if side=='L' else -.28
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi+.12*sign
    parts['leg'+side].rotation_euler.x=sign*.17
    parts['leg'+side].rotation_euler.y=-.34 if side=='L' else -.42
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .80
    parts['foot'+side].rotation_euler.y=-.38
    parts['foot'+side].rotation_euler.x=-sign*.17
    parts['foot'+side].scale=(1.23,1.26,1.13)
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
# Measure the visible skull/hair separately from the neck and drips.
bpy.context.view_layer.update()
bounds=[o.matrix_world@v.co for o in objects if not o.name.startswith('stump_') for v in o.data.vertices]
(P/'rig-rest.json').write_text(json.dumps({
    'height':max(v.z for v in bounds)-min(v.z for v in bounds),
    'feet_min_z':min(v.z for v in bounds),
    'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},
    'rest_rotations_zero':all(sum(v*v for v in o.rotation_euler)<1e-12 for o in parts.values()),
    'rest_scales_one':all((o.scale-Vector((1,1,1))).length<1e-6 for o in parts.values())
},indent=2))
# Record before stage objects. Export includes hidden caps as zero scale nodes.
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.view=='final-set' and not a.glb:a.glb=str(P/'model.glb')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose_test():
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    # Show an amputation on the other arm, while all requested joints visibly move.
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armR']:o.hide_render=True;break
            p=p.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    bpy.data.objects['stump_armR'].scale=(1,1,1)
if a.pose:pose_test()
def assemble_turnaround(path):
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','hero.png' if (P/'renders'/'hero.png').exists() else 'review-hero.png']]
    panels=[]
    for source_path in paths:
        im=bpy.data.images.load(str(source_path));im.scale(960,540);w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()
    print('OK turnaround')
if a.render and a.view=='turnaround':
    assemble_turnaround(a.render);sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.037,.055,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.10*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    render_views=['front','side','back','hero'] if a.view=='review-set' else (['hero','pose'] if a.view=='final-set' else [a.view])
    for view in render_views:
        if view=='pose':
            pose_test();S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
        S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png')) if a.view=='review-set' else a.render
        if a.view=='final-set':S.render.filepath=str(P/'renders'/('hero.png' if view=='hero' else 'pose-test.png'))
        bpy.ops.render.render(write_still=True)
    if a.view=='final-set':assemble_turnaround(P/'renders'/'turnaround.png')
print('OK',triangles,'triangles',len(objects),'meshes')
