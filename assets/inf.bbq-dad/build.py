"""Deterministic rigid-part hero BBQ dad. +X forward, Z up, -Y character right.
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','70615d',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('woodWarm','513126',.65),('brick','a8483a',.65)]}
M['hair']=M['woodWarm']
M['shorts']=M['asphalt']
M['metal']=M['sidewalk']
M['metal'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.75
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(0,0,.65),'root');node('torso',(0,0,.83),'hip');node('head',(.015,0,1.19),'torso');node('backpackSocket',(-.18,0,1.02),'torso')
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
# Stocky shirt and bib apron: genuine shells with contoured hem and raised seams.
ell('pelvis',(-.025,0,.67),(.20,.28,.14),'shorts','hip')
ell('camp_shirt',(-.005,0,.94),(.239,.315,.285),'picketWhite','torso',seg=20,rings=12)
ell('neck',(.035,0,1.19),(.095,.105,.095),'infectedSkin','head')
for s in [-1,1]:
    patch('camp_collar'+str(s),[(.13,s*.04,1.192),(.193,s*.146,1.138),(.235,s*.118,1.057),(.216,s*.049,1.09)],'picketWhite','torso',.019)
    tube('bib_strap'+str(s),[(.175,s*.153,.965),(.164,s*.158,1.108),(.049,s*.13,1.195),(-.13,s*.132,1.124)],[.021,.022,.024,.022],'uiDark','torso',N=8)
    box('apron_brass_button'+str(s),(.238,s*.16,1.002),(.018,.031,.035),'woodWarm','torso',.009)
    ell('button_hole'+str(s),(.249,s*.16,1.002),(.003,.008,.008),'uiDark','torso',seg=8,rings=6)
# Apron grid conforms over belly and flares at thighs. Fabric edges have physical thickness.
v=[];f=[];N=17
rows=[(1.026,.176,.226),(.994,.179,.25),(.90,.231,.267),(.77,.272,.25),(.65,.311,.248),(.555,.339,.224),(.54,.34,.222)]
for z,w,x in rows:
    for i in range(N):
        t=(i/(N-1)*2-1);v.append((x-.085*t*t+.008*math.cos(t*math.pi*3),w*t,z+.018*t*t))
for j in range(len(rows)-1):
    for i in range(N-1):q=j*N+i;f.append((q,q+1,q+N+1,q+N))
apron=mesh('apron_shell',v,f,'uiDark','torso',2)
mod=apron.modifiers.new('fabric thickness','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=apron;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    tube('apron_bound_edge'+str(s),[(x-.085+.008*math.cos(math.pi*3)+.004,s*w,z+.018) for z,w,x in rows],[.006]*len(rows),'asphalt','torso',N=6)
    tube('apron_fold'+str(s),[(.263,s*.19,.79),(.259,s*.23,.686),(.221,s*.275,.57)],[.002,.01,.003],'asphalt','torso',N=8)
# Waist tie wraps sides and ends in a sculpted knot and bow at the back.
pts=[(.005+.244*math.cos(i*2*math.pi/32),.31*math.sin(i*2*math.pi/32),.773) for i in range(33)]
tube('waist_tie',pts,[.014]*33,'uiDark','torso',N=8)
ell('back_tie_knot',(-.246,0,.776),(.025,.034,.031),'uiDark','torso')
for s in [-1,1]:
    tube('bow_loop'+str(s),[(-.249,0,.776),(-.266,s*.085,.80),(-.265,s*.10,.744),(-.253,s*.027,.76),(-.249,0,.776)],[.009]*5,'uiDark','torso',N=8)
    tube('tie_tail'+str(s),[(-.25,s*.012,.764),(-.257,s*.025,.663),(-.247,s*.039,.59)],[.014,.015,.012],'uiDark','torso',N=8)
# Mesh lettering follows the apron surface, no image decals.
def text(n,word,z,size):
    bpy.ops.object.text_add(location=(.281,0,z));o=bpy.context.object;o.name=n;o.data.body=word;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.0015;o.data.bevel_depth=.0006;o.data.bevel_resolution=1
    o.rotation_euler=(math.pi/2,0,math.pi/2);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,n,'picketWhite','torso')
text('GRILL','GRILL',.887,.077);text('CHILL','CHILL',.717,.064)
patch('flame_badge',[(.287,-.064,.811),(.289,-.022,.842),(.289,-.012,.874),(.289,.006,.85),(.289,.044,.863),(.289,.03,.834),(.289,.064,.815),(.289,.033,.785),(.289,0,.777),(.289,-.039,.789)],'woodWarm','torso')
# Bent limbs and cargo shorts; left hand clawed, right hand grips a spatula.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.012,s*.292,1.095);elbow=(.043,s*.415,.913);wrist=(.12,s*.445,.777)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('shirt_sleeve'+side,[shoulder,(-.003,s*.33,1.066),(.021,s*.38,.987)],[.115,.13,.107],'picketWhite','arm'+side,N=12)
    tube('rolled_sleeve'+side,[(.021,s*.379,1.004),(.03,s*.394,.974)],[.115,.115],'picketWhite','arm'+side,N=12)
    tube('upper_arm'+side,[(.024,s*.385,.987),elbow],[.092,.085],'infectedSkin','arm'+side,N=12)
    ell('elbow'+side,elbow,(.085,.083,.086),'infectedSkin','foreArm'+side)
    tube('forearm'+side,[elbow,(.082,s*.442,.851),wrist],[.083,.091,.06],'infectedSkin','foreArm'+side,N=12)
    ell('palm'+side,(.139,s*.45,.745),(.076,.083,.073),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.385+i*.042);z=.731-(.007 if i in [0,3] else .019)
        points=[(.158,y,z),(.19,y,z-.052),(.232,y,z-.08),(.254,y,z-.043)] if side=='L' else [(.161,y,z),(.208,y,z-.023),(.215,y,z+.019),(.185,y,z+.035)]
        tube('finger'+side+str(i),points,[.021,.022,.019,.013],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),points[1],(.025,.021,.025),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('fingernail'+side+str(i),points[-1],(.01,.012,.013),'picketWhite','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.164,s*.376,.776),(.205,s*.367,.738),(.226,s*.39,.713)],[.034,.029,.019],'infectedSkin','hand'+side,N=8)
    hip=(-.02,s*.16,.671);knee=(.032,s*.228,.388);ankle=(-.009,s*.247,.13)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('cargo_short'+side,[hip,(-.013,s*.18,.59),(.005,s*.211,.49),(.016,s*.224,.453)],[.15,.156,.141,.135],'shorts','leg'+side,N=12)
    tube('short_cuff'+side,[(.017,s*.223,.476),(.022,s*.228,.443)],[.144,.144],'shorts','leg'+side,N=12)
    ell('knee'+side,knee,(.113,.106,.107),'infectedSkin','shin'+side)
    tube('bare_calf'+side,[knee,(.009,s*.239,.277),ankle],[.10,.102,.067],'infectedSkin','shin'+side,N=12)
    ell('calf_muscle'+side,(-.043,s*.239,.30),(.077,.097,.104),'infectedSkin','shin'+side)
    box('cargo_pocket'+side,(-.01,s*.327,.561),(.147,.032,.12),'shorts','leg'+side,.016)
    box('cargo_flap'+side,(-.005,s*.349,.603),(.158,.02,.045),'shorts','leg'+side,.01)
    ell('cargo_button'+side,(0,s*.364,.6),(.008,.006,.008),'woodWarm','leg'+side,seg=8,rings=6)
    box('sandal_sole'+side,(.055,s*.25,.033),(.327,.22,.066),'uiDark','foot'+side,.022)
    box('sandal_footbed'+side,(.056,s*.25,.067),(.325,.218,.022),'woodWarm','foot'+side,.015)
    ell('bare_foot'+side,(.051,s*.25,.105),(.133,.093,.055),'infectedSkin','foot'+side)
    for j in range(5):
        yy=s*(.173+j*.037)
        ell('toe'+side+str(j),(.177-(j*.006),yy,.099),(.038-j*.003,.022,.026),'infectedSkin','foot'+side,seg=10,rings=6)
        ell('toenail'+side+str(j),(.194-j*.006,yy,.12),(.014,.013,.003),'picketWhite','foot'+side,seg=8,rings=6)
    for j,x in enumerate([-.01,.105]):
        tube('sandal_strap'+side+str(j),[(x,s*.354,.075),(x,s*.317,.141),(x,s*.25,.16),(x,s*.18,.142),(x,s*.147,.076)],[.022]*5,'uiDark','foot'+side,N=8)
        tube('strap_piping'+side+str(j),[(x+.018,s*.345,.087),(x+.018,s*.30,.145),(x+.018,s*.25,.164),(x+.018,s*.188,.145)],[.004]*4,'woodWarm','foot'+side,N=6)
# Spatula aligned in right fist, head with real slots built from rails.
tube('spatula_grip',[(.18,-.45,.72),(.235,-.45,.844)],[.021,.021],'uiDark','handR',N=10)
tube('spatula_shaft',[(.235,-.45,.844),(.307,-.45,.982)],[.008,.008],'metal','handR',N=8)
# Local metal blade frame tilted along the shaft, slots are negative space.
for j in range(5):
    box('spatula_rail'+str(j),(.345,-.516+j*.033,1.032),(.021,.012,.146),'metal','handR',.005,rot=(0,.45,0))
for z,x in [( .974,.317),(1.093,.374)]:
    box('spatula_blade_edge'+str(z),(x,-.45,z),(.021,.15,.018),'metal','handR',.005,rot=(0,.45,0))
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
ell('mouth_cavity',(.156,0,1.254),(.031,.069,.077),'hair','head',seg=20,rings=12)
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
# Thick layered leaf-shaped locks, irregularly swept across the forehead and crown.
ell('hair_base',(-.035,0,1.464),(.179,.183,.159),'hair','head',seg=20,rings=12)
def lock(name,start,bend,tip,width,material='hair'):
    p0,p1,p2=map(Vector,[start,bend,tip])
    points=[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2]
    tube(name,points,[.014,(width*.85,width*.52),(width,width*.56),(width*.40,width*.29),.002],material,'head',N=8,sub=1)
for layer in range(2):
    for j in range(11):
        t=2*math.pi*j/11+.21*(layer%2);z=1.367+layer*.076
        x=-.037+.145*math.cos(t);y=.159*math.sin(t)
        lock('hair_layer'+str(layer)+'_'+str(j),(x*.6,y*.63,z+.089),
             (x-.011,y,z+.042),(x+.052*math.cos(t)-.045,y+.045*math.sin(t)-.035,z-.068),.066+(j%3)*.005,
             'hair')
for j in range(4):
    y=-.10+j*.05
    lock('swept_quiff'+str(j),(-.05,y+.07,1.56),(.125,y+.035,1.56),(.15,y-.08,1.472+(j%2)*.012),.071)
for j in range(9):
    t=j*2*math.pi/9
    lock('messy_crown'+str(j),(-.028,.04*math.sin(t),1.52),
         (-.06+.08*math.cos(t),.11*math.sin(t),1.598+(j%3)*.015),
         (-.08+.17*math.cos(t),.18*math.sin(t)-.028,1.57-(j%4)*.019),.07)
# Overlapping low nape locks close the rear scalp silhouette down to the collar.
for j in range(10):
    t=1.45+j*.36
    x=-.022+.15*math.cos(t);y=.16*math.sin(t)
    lock('low_nape'+str(j),(x*.8,y*.83,1.383),(x-.027,y*1.01,1.316),
         (x-.045,y*.91,1.239+(j%2)*.012),.06)
# Raised surface-conforming blood smears, offset 4 mm from the actual mesh.
def splat(n,y,z,ry,rz,target,par,back=False):
    ob=bpy.data.objects[target];pts=[(y,z)]
    for i in range(11):
        t=i*math.tau/11;r=rng.uniform(.63,1.13);pts.append((y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    bpy.context.view_layer.update();v=[];direction=Vector((1,0,0) if back else (-1,0,0));inv=ob.matrix_world.inverted()
    for yy,zz in pts:
        start=Vector((-1 if back else 1,yy,zz));hit,loc,normal,index=ob.ray_cast(inv@start,inv.to_3x3()@direction)
        if not hit:continue
        p=ob.matrix_world@loc;p.x+=(-.004 if back else .004);v.append(p)
    if len(v)<4:return None
    return mesh(n,v,[(0,i,i+1) for i in range(1,len(v)-1)],'blood',par,0)
for j,(y,z,ry,rz) in enumerate([(-.15,.68,.06,.07),(.17,.62,.07,.044),(-.03,.76,.036,.017),(.13,.81,.026,.039),(-.13,.95,.035,.026),(.03,.59,.026,.025)]):
    splat('apron_blood'+str(j),y,z,ry,rz,'apron_shell','torso')
for j in range(22):
    splat('apron_fleck'+str(j),rng.uniform(-.22,.22),rng.uniform(.57,.78),rng.uniform(.004,.014),rng.uniform(.004,.012),'apron_shell','torso')
for j,(y,z) in enumerate([(-.19,1.1),(.2,1.06),(-.13,.99),(.08,1.16)]):splat('shirt_blood'+str(j),y,z,.025,.035,'camp_shirt','torso')
for j in range(8):splat('back_blood'+str(j),rng.uniform(-.19,.19),rng.uniform(.83,1.14),.02,.027,'camp_shirt','torso',True)
for side,s in [('L',1),('R',-1)]:
    splat('arm_smear'+side,s*.423,.88,.035,.055,'forearm'+side,'foreArm'+side)
    splat('hand_smear'+side,s*.45,.754,.043,.029,'palm'+side,'hand'+side)
    splat('knee_smear'+side,s*.23,.411,.034,.04,'knee'+side,'shin'+side)
    splat('shin_smear'+side,s*.245,.288,.02,.049,'bare_calf'+side,'shin'+side)
    for j in range(3):
        tube('sleeve_fold'+side+str(j),[(.068,s*.33,1.066-j*.02),(.096,s*.361,1.048-j*.02),(.068,s*.395,1.02-j*.02)],[.004,.01,.002],'picketWhite','arm'+side,N=8)
    tube('short_front_fold'+side,[(.098,s*.12,.544),(.149,s*.22,.536),(.104,s*.3,.511)],[.004,.012,.003],'shorts','leg'+side,N=8)
for j,(y,z,ry,rz) in enumerate([(-.112,1.3,.02,.05),(.11,1.293,.02,.045),(-.045,1.217,.029,.039),(.045,1.24,.029,.026),(-.04,1.453,.016,.025)]):
    splat('face_smear'+str(j),y,z,ry,rz,'cranium' if z>1.3 else 'jaw','head')
tube('chin_blood_drip',[(.18,-.03,1.2),(.171,-.03,1.158),(.16,-.03,1.134)],[.012,.009,.002],'blood','head',N=8)
# Proximal stump children persist when the corresponding limb subtree detaches.
for key,parent,p,sz in [('head','torso',(.035,0,1.19),(.08,.09,.012)),('armL','torso',(-.012,.292,1.095),(.09,.016,.09)),('armR','torso',(-.012,-.292,1.095),(.09,.016,.09)),('foreArmL','armL',(.043,.415,.913),(.07,.014,.07)),('foreArmR','armR',(.043,-.415,.913),(.07,.014,.07)),('legL','hip',(-.02,.16,.671),(.115,.115,.014)),('legR','hip',(-.02,-.16,.671),(.115,.115,.014))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.40
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
parts['hip'].scale.y=1.16
parts['head'].scale=(1.48,1.53/1.16,1.15)
parts['hip'].location.z-=.04
parts['torso'].rotation_euler.y=.17
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.17,-.35 if side=='L' else -.40,0)
    parts['foreArm'+side].rotation_euler.y=-.55 if side=='L' else -.60
    parts['hand'+side].scale=(1.15,1.15,1.15)
    parts['hand'+side].rotation_euler.y=.75 if side=='L' else .25
    parts['leg'+side].rotation_euler.y=-.20 if side=='L' else -.24
    parts['shin'+side].rotation_euler.y=.43 if side=='L' else .49
    parts['foot'+side].rotation_euler.y=-.23
    parts['foot'+side].scale=(1.05,1.05,1)
# Caps have an export-hidden zero scale; restore temporarily to bake their actual surfaces.
for cap in caps:cap.scale=(1,1,1)
bpy.context.view_layer.update()
asset_scale=.946
node_positions={n:o.matrix_world.translation.copy()*asset_scale for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
mesh_parents={o.name:o.parent.name for o in objects}
for o in objects:
    o.data.transform(Matrix.Scale(asset_scale,4)@o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
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
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
if a.render and a.view=='turnaround':
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','review-hero.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=a.render;sheet.file_format='PNG';sheet.save()
    print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.10*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    Path(a.render).parent.mkdir(parents=True,exist_ok=True)
    def render_view(view,path,width=960,height=540,samples=24):
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=2.10*max(width/height,1);S.render.resolution_x=width;S.render.resolution_y=height;S.cycles.samples=samples;S.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    def combine(paths,path,crop=None):
        import numpy as np
        panels=[]
        for path0 in paths:
            im=bpy.data.images.load(str(path0),check_existing=False);w,h=im.size;pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4)
            if crop:pixels=pixels[:,(w-crop)//2:(w+crop)//2,:]
            panels.append(pixels)
        data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('comparison',width=data.shape[1],height=data.shape[0],alpha=True);sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()
    if a.view in ['review-all','final-all']:
        out=Path(a.render).parent
        for view,filename in [('front','front.png'),('side','side.png'),('back','back.png'),('hero','review-hero.png')]:render_view(view,out/filename)
        combine([out/n for n in ['front.png','side.png','back.png','review-hero.png']],out/'turnaround.png',460)
        if a.view=='final-all':
            render_view('hero',out/'hero.png',1600,900,96)
            parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
            render_view('hero',out/'pose-articulated.png')
            for o in objects:
                parent=o.parent
                while parent:
                    if parent==parts['armL']:o.hide_render=True;break
                    parent=parent.parent
            bpy.data.objects['stump_armL'].scale=(1,1,1)
            render_view('hero',out/'pose-amputated.png')
            combine([out/'pose-articulated.png',out/'pose-amputated.png'],out/'pose-test.png',600)
    else:render_view(a.view,a.render,a.width,a.height,a.samples)
print('OK',triangles,'triangles',len(objects),'meshes')
