"""Deterministic rigid-part hero cashier. +X forward, Z up, -Y character right.
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8)]}
M['woodWarm']=mat('woodWarm','55312b',.7)
M['hair']=M['woodWarm']
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
# Layered white uniform shirt and sleeveless charcoal store vest.
ell('pelvis',(0,0,.695),(.153,.225,.125),'asphalt','hip')
ell('shirt_body',(.017,0,.944),(.174,.224,.257),'picketWhite','torso')
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
v=[];f=[];N=20
for j,(z,rx,ry) in enumerate([(.74,.175,.224),(.76,.185,.234),(.86,.18,.24),(1.055,.166,.23),(1.125,.137,.19),(1.14,.132,.185)]):
    for i in range(N):
        t=.60+(2*math.pi-1.20)*i/(N-1);v.append((rx*math.cos(t)-.012,ry*math.sin(t),z))
for j in range(5):
    for i in range(N-1):
        t=.60+(2*math.pi-1.20)*(i+.5)/(N-1)
        if math.cos(t)>-.25:f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('vest_shell',v,f,'uiDark','torso',2)
mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.016;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for sign in [-1,1]:
    patch('vest_front'+str(sign),[(.12,sign*.07,1.14),(.18,sign*.174,1.06),(.191,sign*.169,.81),(.183,sign*.04,.762),(.188,sign*.029,.977)],'uiDark','torso',.02)
    patch('collar'+str(sign),[(.111,sign*.04,1.183),(.153,sign*.124,1.138),(.203,sign*.112,1.061),(.197,sign*.032,1.09)],'picketWhite','torso',.017)
    tube('vest_piping'+str(sign),[(.185,sign*.163,.79),(.204,sign*.145,.922),(.178,sign*.145,1.064)],[.004]*3,'asphalt','torso',N=6)
for j in range(4):ell('vest_button'+str(j),(.204,.025,.81+j*.044),(.008,.009,.009),'woodWarm','torso',seg=8,rings=6)
# Sculpted waist apron drapes over thighs; hem and folds are explicit mesh forms.
v=[];f=[];cols=13;rows=8
for j in range(rows):
    t=j/(rows-1);z=.77-.31*t
    for i in range(cols):
        u=2*i/(cols-1)-1;y=u*(.20+.03*t)
        x=.181+.036*t+.028*math.cos(u*math.pi/2)+.013*math.sin(u*math.pi*3)*math.sin(t*math.pi)
        v.append((x,y,z+.034*u*u*t))
for j in range(rows-1):
    for i in range(cols-1):k=j*cols+i;f.append((k,k+1,k+1+cols,k+cols))
o=mesh('apron_drape',v,f,'survivorRed','hip',2)
mod=o.modifiers.new('apron cloth thickness','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for sign in [-1,1]:
    tube('apron_fold'+str(sign),[(.219,sign*.12,.71),(.243,sign*.14,.61),(.245,sign*.177,.513)],[.006,.009,.002],'survivorRed','hip',N=8)
    tube('waist_band'+str(sign),[(.205,0,.765),(.12,sign*.209,.759),(-.11,sign*.213,.76),(-.185,sign*.065,.764)],[.018]*4,'survivorRed','hip',N=10)
    patch('apron_back_panel'+str(sign),[(-.181,sign*.03,.768),(-.17,sign*.22,.756),(-.159,sign*.23,.622),(-.187,sign*.028,.65)],'survivorRed','hip',.013)
    patch('waist_bow_loop'+str(sign),[(-.206,sign*.014,.758),(-.224,sign*.101,.802),(-.231,sign*.133,.751),(-.211,sign*.017,.726)],'uiDark','hip',.015)
    patch('apron_trailing_tie'+str(sign),[(-.218,sign*.005,.745),(-.216,sign*.048,.738),(-.237,sign*.078,.52),(-.224,sign*.025,.543)],'uiDark','hip',.012)
    patch('neck_bow_loop'+str(sign),[(-.174,sign*.004,1.083),(-.193,sign*.083,1.105),(-.19,sign*.09,1.055),(-.18,sign*.018,1.052)],'uiDark','torso',.014)
    patch('neck_tie_tail'+str(sign),[(-.185,sign*.008,1.075),(-.185,sign*.032,1.075),(-.208,sign*.064,.939),(-.21,sign*.019,.945)],'uiDark','torso',.012)
for sign in [-1,1]:
    patch('back_vest_strap'+str(sign),[(-.155,sign*.13,1.129),(-.174,sign*.176,1.105),(-.19,sign*.039,.808),(-.19,sign*.007,.825)],'uiDark','torso',.015)
    for j in range(3):
        tube('back_shirt_fold'+str(sign)+str(j),[(-.175,sign*.028,.868+j*.055),(-.18,sign*.078,.88+j*.055),(-.161,sign*.15,.858+j*.055)],[.004,.009,.002],'picketWhite','torso',N=8)
ell('waist_bow_knot',(-.221,0,.751),(.02,.025,.025),'uiDark','hip')
ell('neck_bow_knot',(-.194,0,1.071),(.015,.022,.019),'uiDark','torso')
box('name_tag_frame',(.213,-.102,.946),(.019,.103,.049),'woodWarm','torso',.006,rot=(.10,0,0))
box('name_tag',(.225,-.102,.946),(.009,.09,.037),'picketWhite','torso',.004,rot=(.10,0,0))
box('name_tag_name_line',(.232,-.11,.949),(.004,.037,.005),'uiDark','torso',.001)
ell('name_tag_portrait',(.233,-.076,.947),(.003,.008,.01),'asphalt','torso',seg=8,rings=6)
# Short uniform sleeves, wrist bands, chunky limbs and individual curled fingers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('short_sleeve'+side,[shoulder,(-.005,s*.27,1.052),(.005,s*.303,.982)],[.097,.11,.095],'picketWhite','arm'+side,N=12)
    tube('sleeve_hem'+side,[(.004,s*.298,.994),(.009,s*.312,.967)],[.103,.099],'picketWhite','arm'+side,N=12)
    tube('upper_arm_skin'+side,[(.008,s*.303,.98),(.014,s*.325,.94),elbow],[.075,.073,.067],'infectedSkin','arm'+side,N=12)
    tube('forearm_skin'+side,[elbow,(.051,s*.382,.823),wrist],[.068,.072,.051],'infectedSkin','foreArm'+side,N=12)
    tube('wristband'+side,[(.075,s*.405,.778),(.083,s*.419,.751)],[.061,.061],'blood','foreArm'+side,N=12)
    box('wristband_buckle'+side,(.13,s*.417,.767),(.021,.045,.033),'uiDark','foreArm'+side,.006)
    ell('palm'+side,(.087,s*.424,.72),(.058,.066,.075),'infectedSkin','hand'+side)
    for i in range(4):
        y=s*(.365+i*.039);z=.696-(.006 if i in [0,3] else .018)
        points=[(.105,y,z),(.127,y+s*(i-1.5)*.006,z-.044),(.175,y+s*(i-1.5)*.010,z-.085),(.204,y+s*(i-1.5)*.012,z-.048)]
        tube('finger'+side+str(i),points,[.019,.02,.017,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(i),(.115,y,z),(.023,.02,.023),'infectedSkin','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(i),(.206,y+s*(i-1.5)*.012,z-.045),(.006,.011,.014),'sidewalk','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.105,s*.37,.745),(.15,s*.353,.713),(.178,s*.366,.691)],[.028,.026,.015],'infectedSkin','hand'+side,N=10)
    hip=(0,s*.124,.694);knee=(.024,s*.176,.415);ankle=(-.019,s*.198,.155)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh'+side,[hip,(-.005,s*.137,.629),(.013,s*.168,.493),knee],[.122,.133,.117,.102],'asphalt','leg'+side,N=12,sub=1)
    tube('trouser_calf'+side,[knee,(.016,s*.186,.362),(-.008,s*.195,.264),ankle],[.105,.109,.101,.089],'asphalt','shin'+side,N=12,sub=1)
    for k,z in enumerate([.433,.36,.232,.17]):
        ell('cloth_fold'+side+str(k),(.016 if k<2 else -.013,s*.184,z),(.103,.106,.038),'asphalt','shin'+side,rot=(s*.12,-.18,0),seg=12,rings=6)
    ell('knee_tear'+side,(.11,s*.171,.457),(.018,.061,.041),'uiDark','leg'+side)
    ell('knee_wound'+side,(.125,s*.171,.46),(.013,.047,.028),'blood','leg'+side)
    for j in range(3):
        patch('knee_rag'+side+str(j),[(.138,s*(.122+j*.029),.482),(.14,s*(.145+j*.029),.473),(.135,s*(.13+j*.029),.452)],'asphalt','leg'+side)
    box('shoe_sole'+side,(.048,s*.204,.034),(.288,.184,.068),'uiDark','foot'+side,.026)
    box('shoe_welt'+side,(.049,s*.204,.067),(.285,.181,.033),'picketWhite','foot'+side,.018)
    ell('work_shoe'+side,(.049,s*.204,.111),(.143,.087,.081),'blood','foot'+side)
    ell('shoe_toecap'+side,(.128,s*.204,.095),(.069,.087,.052),'picketWhite','foot'+side)
    ell('shoe_tongue'+side,(-.002,s*.204,.173),(.064,.057,.025),'asphalt','foot'+side)
    for j in range(4):
        tube('lace'+side+str(j),[(-.03+j*.023,s*.166,.167),(-.026+j*.023,s*.203,.188-j*.006),(-.018+j*.023,s*.243,.161)],[.004]*3,'sidewalk','foot'+side,N=6,sub=0)
    for j in range(7):
        box('sole_tread'+side+str(j),(-.073+j*.039,s*.204,.009),(.016,.164,.015),'uiDark','foot'+side,.004)
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
# Pulled-back brown hair, swept bangs and a high tied messy bun.
ell('hair_base',(-.042,0,1.452),(.177,.181,.159),'hair','head',seg=20,rings=12)
def lock(name,start,bend,tip,width):
    p0,p1,p2=map(Vector,[start,bend,tip])
    tube(name,[p0,p0.lerp(p1,.5),p1,p1.lerp(p2,.74),p2],[.009,(width*.8,width*.5),(width,width*.53),(width*.4,width*.26),.002],'hair','head',N=8)
for j in range(16):
    t=j*2*math.pi/16
    lock('swept_scalp'+str(j),(-.09,.04*math.sin(t),1.562),(-.039+.13*math.cos(t),.163*math.sin(t),1.505),(-.042+.164*math.cos(t),.18*math.sin(t),1.364+(j%3)*.021),.054)
for j in range(7):
    y=-.14+j*.044
    lock('fringe'+str(j),(-.017,y+.046,1.576),(.11,y+.004,1.526),(.153,y-.046,[1.395,1.404,1.425,1.455,1.482,1.465,1.421][j]),.059)
ell('bun',(-.138,.015,1.654),(.12,.136,.125),'hair','head',seg=16,rings=10)
for j in range(9):
    t=j*2*math.pi/9
    lock('bun_fold'+str(j),(-.09,.018,1.57),(-.145+.096*math.cos(t),.018+.111*math.sin(t),1.715),(-.18+.09*math.cos(t),.018+.105*math.sin(t),1.657),.043)
for j in range(6):
    y=-.09+j*.036
    lock('bun_front_swirl'+str(j),(-.036,y,1.61),(-.026,y+.02,1.7),(-.13,y+.035,1.786),.036)
ell('hair_nape',(-.084,0,1.367),(.159,.178,.133),'hair','head',seg=16,rings=10)
for j in range(14):
    t=1.35+j*.265
    lock('nape_lock'+str(j),(-.045+.12*math.cos(t),.13*math.sin(t),1.472),(-.06+.161*math.cos(t),.176*math.sin(t),1.377),(-.055+.17*math.cos(t),.17*math.sin(t),1.257+(j%3)*.017),.044)
for j in range(7):
    y=-.101+j*.034
    lock('bun_rear_swirl'+str(j),(-.155,y,1.765),(-.259,y+.012,1.687),(-.20,y+.027,1.589),.031)
tube('bun_red_tie',[(-.09,-.08,1.587),(-.05,0,1.594),(-.10,.09,1.588)],[.017]*3,'survivorRed','head',N=10)
for sign in [-1,1]:
    lock('long_face_tendril'+str(sign),(.018,sign*.157,1.5),(.06,sign*.177,1.352),(.075,sign*.17,1.185),.023)
    lock('bun_flyaway'+str(sign),(-.14,sign*.077,1.7),(-.2,sign*.16,1.743),(-.24,sign*.18,1.674),.023)
def splat(n,x,y,z,ry,rz,par):
    pts=[]
    for i in range(9):
        t=i*2*math.pi/9;r=rng.uniform(.63,1.15);pts.append((x,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    o=mesh(n,[(x,y,z)]+pts,[(0,i+1,(i+1)%len(pts)+1) for i in range(len(pts))],'blood',par,0)
    # Project each stain onto the nearest intended cloth/skin surface.
    surface_names=({'torso':['shirt_body','vest_shell','vest_front-1','vest_front1'],
                    'hip':['apron_drape','apron_back_panel-1','apron_back_panel1'],
                    'head':['cranium','jaw','cheek-1','cheek1'],
                    'armL':['short_sleeveL','upper_arm_skinL'], 'armR':['short_sleeveR','upper_arm_skinR'],
                    'foreArmL':['forearm_skinL'], 'foreArmR':['forearm_skinR'],
                    'handL':['palmL'],'handR':['palmR'],
                    'legL':['trouser_thighL'],'legR':['trouser_thighR'],
                    'shinL':['trouser_calfL'],'shinR':['trouser_calfR'],
                    'footL':['shoe_toecapL','work_shoeL'],'footR':['shoe_toecapR','work_shoeR']}).get(par,[])
    bpy.context.view_layer.update()
    direction=Vector((-1,0,0) if x>=0 else (1,0,0));startx=.5 if x>=0 else -.5
    missed=False
    for vertex in o.data.vertices:
        start=Vector((startx,vertex.co.y,vertex.co.z));hits=[]
        for name in surface_names:
            target=bpy.data.objects.get(name)
            if target:
                inv=target.matrix_world.inverted();hit,loc,normal,index=target.ray_cast(inv@start,inv.to_3x3()@direction)
                if hit:
                    world=target.matrix_world@loc;hits.append(world)
        if hits:
            hit=min(hits,key=lambda p:(p-start).length)
            vertex.co.x=hit.x+(.004 if x>=0 else -.004)
        else:missed=True
    if missed:
        objects.remove(o);bpy.data.objects.remove(o,do_unlink=True);return
    for face in o.data.polygons:face.use_smooth=False
for i,(x,y,z,ry,rz,par) in enumerate([
    (.2,-.102,1.325,.023,.051,'head'),(.2,.103,1.29,.022,.035,'head'),(.2,-.048,1.202,.036,.034,'head'),
    (.2,-.13,1.063,.036,.043,'torso'),(.2,.14,.887,.033,.057,'torso'),
    (.28,-.118,.577,.042,.04,'hip'),(.28,.07,.672,.031,.055,'hip'),(.28,.02,.49,.04,.02,'hip'),
    (.13,-.298,1.023,.044,.038,'armR'),(.13,.302,.997,.04,.037,'armL'),
    (.13,-.39,.824,.023,.052,'foreArmR'),(.15,.42,.73,.04,.039,'handL'),(.15,-.42,.73,.04,.039,'handR'),
    (.13,-.17,.55,.039,.038,'legR'),(.11,.195,.281,.035,.027,'shinL'),
    (-.22,.10,1.058,.028,.032,'torso'),(-.2,-.08,.69,.03,.03,'hip'),
    (.21,-.21,.11,.025,.019,'footR'),(.21,.2,.11,.036,.018,'footL')]):splat('blood_splatter'+str(i),x,y,z,ry,rz,par)
for j in range(28):
    par='hip' if j<14 else 'torso';z=rng.uniform(.49,.735) if j<14 else rng.uniform(.82,1.1)
    splat('blood_fleck'+str(j),.28,rng.uniform(-.15,.15),z,.004+rng.random()*.004,.004+rng.random()*.005,par)
tube('cheek_drip',[(.16,-.115,1.351),(.168,-.104,1.285),(.161,-.075,1.23)],[.009,.012,.004],'blood','head',N=6)
tube('chin_drip',[(.178,-.018,1.193),(.16,-.012,1.153),(.142,-.008,1.114)],[.015,.01,.003],'blood','head',N=6)
for side,sign in [('L',1),('R',-1)]:
    for j,z in enumerate([.585,.508,.307]):
        par='leg'+side if j<2 else 'shin'+side
        tube('trouser_crease'+side+str(j),[(.079,sign*.11,z+.012),(.126,sign*.166,z),(.078,sign*.223,z-.014)],[.004,.011,.003],'asphalt',par,N=8)
# Integrated palette blood smears on the cheek/jaw surface need no decal layers.
for name in ['cranium','jaw','cheek-1','cheek1']:
    obj=bpy.data.objects[name];obj.data.materials.append(M['blood'])
    for face in obj.data.polygons:
        center=obj.matrix_world@face.center
        chin=center.x>.11 and center.z<1.242 and abs(center.y)<.09
        cheek=center.x>.12 and .078<abs(center.y)<.145 and 1.26<center.z<1.352 and (center.z+center.y*.3)<1.34
        if chin or cheek:face.material_index=len(obj.data.materials)-1
# Caps stay on proximal parts so they remain when distal nodes are detached.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.124,.694),(.09,.095,.012)),('legR','hip',(0,-.124,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.44
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
parts['head'].scale=(1.48,1.53,1.18)
parts['hip'].location.z-=.10
parts['torso'].rotation_euler.y=.34
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.17,-.55 if side=='L' else -.62,0)
    parts['foreArm'+side].rotation_euler.y=-.30 if side=='L' else -.38
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.y=.80
    parts['hand'+side].rotation_euler.z=.12*sign
    parts['leg'+side].rotation_euler.x=sign*.15
    parts['leg'+side].rotation_euler.y=-.34 if side=='L' else -.42
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .80
    parts['foot'+side].rotation_euler.y=-.38
    parts['foot'+side].scale=(1.23,1.26,1.13)
# Caps have an export-hidden zero scale; restore temporarily to bake their actual surfaces.
for cap in caps:cap.scale=(1,1,1)
bpy.context.view_layer.update()
node_positions={n:o.matrix_world.translation.copy()*.91 for n,o in parts.items()}
parents={n:o.parent.name if o.parent else None for n,o in parts.items()}
mesh_parents={o.name:o.parent.name for o in objects}
for o in objects:
    o.data.transform(Matrix.Scale(.91,4)@o.matrix_world);o.parent=None;o.matrix_world=Matrix.Identity(4)
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
# Record dimensions and rest transforms for the rigid animation contract.
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
def apply_pose():
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    # Show an amputation on the other arm, while all requested joints visibly move.
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armR']:o.hide_render=True;break
            p=p.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    bpy.data.objects['stump_armR'].scale=(1,1,1)
    bpy.context.view_layer.update()
    (P/'pose-audit.json').write_text(json.dumps({
        'rotated':{name:list(parts[name].rotation_euler) for name in ['armL','foreArmL','legR']},
        'stump_armL_visible':list(cap.scale)==[1,1,1],
        'foreArmL_parent':parts['foreArmL'].parent.name,
        'handL_parent':parts['handL'].parent.name,
        'shinR_parent':parts['shinR'].parent.name
    },indent=2)+'\n')
if a.pose:apply_pose()
def compose_turnaround(output_path):
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png']]+[P/'renders'/('hero.png' if (P/'renders'/'hero.png').exists() else 'review-hero.png')]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path))
        if tuple(im.size)!=(960,540):im.scale(960,540)
        if path.name=='hero.png':
            im.filepath_raw=str(P/'renders'/'review-hero.png');im.file_format='PNG';im.save()
        w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(output_path);sheet.file_format='PNG';sheet.save()

if a.view=='turnaround':
    compose_turnaround(a.render or P/'renders'/'turnaround.png');print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.15*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.cycles.device='CPU'  # The shared runner owns render concurrency/device policy.
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    if a.view=='review-set':
        for view,filename in [('front','front.png'),('side','side.png'),('back','back.png'),('hero','review-hero.png')]:
            cam.location=views[view];cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/filename);bpy.ops.render.render(write_still=True)
    else:
        S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
        if a.view=='delivery':
            compose_turnaround(P/'renders'/'turnaround.png')
            apply_pose()
            cam.location=views['hero'];cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
            S.render.filepath=str(P/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
