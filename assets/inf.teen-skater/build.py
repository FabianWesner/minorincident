"""Deterministic rigid-part hero young-adult infected skater. +X forward, Z up, -Y character right.
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
S=bpy.context.scene; rng=random.Random(83); parts={}; objects=[]
def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('woodWarm','b0703f',.75),('backpackTeal','2f6e6a',.8)]}
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
# Torso and separate garment shells.
ell('pelvis',(0,0,.695),(.153,.225,.125),'asphalt','hip')
ell('shirt_body',(.017,0,.944),(.174,.224,.257),'picketWhite','torso')
ell('neck',(.013,0,1.184),(.076,.088,.089),'infectedSkin','head')
# jacket back is a contoured shell, open at front.
v=[];f=[];N=20
for j,(z,rx,ry) in enumerate([(.702,.173,.224),(.719,.183,.234),(.84,.17,.23),(1.055,.166,.254),(1.125,.137,.21),(1.14,.132,.205)]):
    for i in range(N):
        t=.67+(2*math.pi-1.34)*i/(N-1);v.append((rx*math.cos(t)-.012,ry*math.sin(t),z+(.012*math.sin(i*2.7) if j==0 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('jacket_shell',v,f,'asphalt','torso',2);mod=o.modifiers.new('cloth thickness','SOLIDIFY');mod.thickness=.015;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    patch('torn_shirt_hem'+str(s),[(.153,s*.025,.85),(.155,s*.15,.836),(.142,s*.176,.738),(.164,s*.128,.767),(.17,s*.095,.716),(.173,s*.044,.75)],'picketWhite','torso')
    box('welt_pocket'+str(s),(.151,s*.176,.805),(.03,.092,.026),'uiDark','torso',.008,rot=(s*.12,0,0))
    ell('jacket_button'+str(s),(.185,s*.108,.876),(.009,.009,.009),'sidewalk','torso',seg=8,rings=6)
    tube('jacket_seam'+str(s),[(-.185,s*.11,.742),(-.181,s*.14,.85),(-.168,s*.16,1.053)],[.004]*3,'uiDark','torso',N=6,sub=0)
# Relaxed asymmetric limbs, sleeves with rolled ivory cuffs, individual curled fingers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.008,s*.237,1.076);elbow=(.021,s*.343,.899);wrist=(.086,s*.418,.744)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(-.005,s*.28,1.054),(.006,s*.313,.958),elbow],[.099,.112,.094,.091],'asphalt','arm'+side,N=12,sub=1)
    tube('sleeve_fold'+side,[(.022,s*.313,.948),(.034,s*.34,.916),(.037,s*.365,.874)],[.098,.098,.073],'asphalt','foreArm'+side,N=12)
    tube('rolled_cuff'+side,[(.031,s*.345,.902),(.039,s*.361,.865),(.042,s*.368,.852)],[.097,.098,.088],'picketWhite','foreArm'+side,N=12)
    tube('forearm_skin'+side,[(.041,s*.364,.855),(.064,s*.396,.797),wrist],[.068,.068,.047],'infectedSkin','foreArm'+side,N=12,sub=1)
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
    box('shoe_sole'+side,(.048,s*.204,.034),(.288,.184,.068),'picketWhite','foot'+side,.026)
    box('shoe_welt'+side,(.049,s*.204,.067),(.285,.181,.033),'picketWhite','foot'+side,.018)
    ell('skate_shoe'+side,(.049,s*.204,.111),(.143,.087,.081),'survivorRed','foot'+side)
    ell('shoe_toecap'+side,(.128,s*.204,.095),(.069,.087,.052),'picketWhite','foot'+side)
    ell('shoe_tongue'+side,(-.002,s*.204,.173),(.064,.057,.025),'survivorRed','foot'+side)
    for j in range(7):
        box('sole_tread'+side+str(j),(-.073+j*.039,s*.204,.009),(.016,.164,.015),'sidewalk','foot'+side,.004)
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
# Thick layered leaf-shaped locks, irregularly swept across the forehead and crown.
ell('hair_base',(-.035,0,1.423),(.165,.173,.12),'woodWarm','head',seg=20,rings=12)
def lock(name,start,bend,tip,width,material='woodWarm'):
    p0,p1,p2=map(Vector,[start,bend,tip])
    points=[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.74),p2]
    tube(name,points,[.014,(width*.85,width*.52),(width,width*.56),(width*.40,width*.29),.002],material,'head',N=8,sub=1)
for layer in range(3):
    for j in range(11):
        t=2*math.pi*j/11+.21*(layer%2);z=1.315+layer*.058
        x=-.037+.145*math.cos(t);y=.159*math.sin(t)
        lock('hair_layer'+str(layer)+'_'+str(j),(x*.6,y*.63,z+.089),
             (x-.011,y,z+.042),(x+.052*math.cos(t)-.045,y+.045*math.sin(t)-.035,z-.068),.066+(j%3)*.005,
             'woodWarm')
for j in range(7):
    y=-.142+j*.046
    lock('heavy_fringe'+str(j),(-.025,y+.048,1.539),(.10,y-.009,1.482),
         (.149,y-.047,1.407+(j%3)*.015),.065+(j%2)*.012)
# Overlapping low nape locks close the rear scalp silhouette down to the collar.
for j in range(10):
    t=1.45+j*.36
    x=-.022+.15*math.cos(t);y=.16*math.sin(t)
    lock('low_nape'+str(j),(x*.8,y*.83,1.383),(x-.027,y*1.01,1.316),
         (x-.045,y*.91,1.239+(j%2)*.012),.06)
# Ivory adhesive remnant on the wounded right cheek.
patch('cheek_bandage',[(.163,-.127,1.294),(.171,-.108,1.289),(.17,-.103,1.27),(.157,-.123,1.276)],'picketWhite','head')
# Flat, purposeful blood shapes, raised slightly from garment/skin surfaces.
def splat(n,x,y,z,ry,rz,par):
    pts=[]
    for i in range(9):
        t=i*2*math.pi/9;r=rng.uniform(.63,1.15);pts.append((x,y+math.cos(t)*ry*r,z+math.sin(t)*rz*r))
    o=mesh(n,[(x,y,z)]+pts,[(0,i+1,(i+1)%len(pts)+1) for i in range(len(pts))],'blood',par,0)
    # Project each stain onto the nearest intended cloth/skin surface.
    surface_names=({'torso':['shirt_body','jacket_shell'],
                    'head':['cranium','jaw','cheek-1','cheek1']+['heavy_fringe'+str(j) for j in range(7)]+['hair_layer2_'+str(j) for j in range(11)],
                    'foreArmL':['forearm_skinL','rolled_cuffL'], 'foreArmR':['forearm_skinR','rolled_cuffR'],
                    'handL':['palmL'],'handR':['palmR'],
                    'legL':['trouser_thighL'],'legR':['trouser_thighR'],
                    'shinL':['trouser_calfL'],'shinR':['trouser_calfR']}).get(par,[])
    direction=Vector((-1,0,0) if x>=0 else (1,0,0));startx=.5 if x>=0 else -.5
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
    for face in o.data.polygons:face.use_smooth=False
for i,(x,y,z,ry,rz,par) in enumerate([
    (.204,-.084,1.29,.018,.052,'head'),(.157,.125,1.31,.019,.023,'head'),(.162,-.037,1.465,.017,.021,'head'),
    (.183,.043,1.18,.031,.032,'head'),(.178,-.108,.93,.034,.051,'torso'),(.173,.117,1.014,.029,.035,'torso'),
    (.179,-.13,.793,.024,.022,'torso'),(.241,-.024,.826,.02,.025,'torso'),(-.192,.092,.835,.03,.027,'torso'),
    (.112,-.393,.792,.035,.03,'foreArmR'),(.114,.4,.783,.026,.044,'foreArmL'),(.147,-.427,.716,.035,.026,'handR'),
    (.148,.426,.71,.029,.032,'handL'),(.123,-.17,.579,.033,.032,'legR'),(.107,.203,.285,.028,.025,'shinL')]):splat('blood_splash'+str(i),x,y,z,ry,rz,par)
for i in range(22):
    y=rng.uniform(-.125,.125);z=rng.uniform(.79,1.075);x=.186 if abs(y)<.095 else .176
    ell('blood_fleck'+str(i),(x,y,z),(.003,rng.uniform(.003,.008),rng.uniform(.004,.012)),'blood','torso',seg=8,rings=6)
# Small shirt fastenings, cuff stitches and belt buckle remain readable close up.
for j in range(3):
    ell('shirt_button'+str(j),(.182,.048,.91+j*.039),(.006,.008,.008),'sidewalk','torso',seg=8,rings=6)
box('belt_buckle',(.153,0,.712),(.025,.066,.038),'sidewalk','hip',.006)
for side,sign in [('L',1),('R',-1)]:
    tube('trouser_side_seam'+side,[(-.032,sign*.251,.6),(-.028,sign*.274,.48),(-.051,sign*.275,.28)],[.003]*3,'uiDark','leg'+side,N=6,sub=0)
# Ripped jacket-back patches and stitches.
for j in range(4):
    x=-.185;z=.78+j*.07;y=.08*(-1 if j%2 else 1)
    patch('back_rip'+str(j),[(x,y-.024,z),(x,y+.026,z+.012),(x,y+.016,z+.018),(x,y-.015,z+.008)],'uiDark','torso')
# Ragged cloth tongues and torn sleeve openings, following the reference.
for side,sign in [('L',1),('R',-1)]:
    for j in range(3):
        yy=sign*(.317+j*.025)
        patch('sleeve_rag'+side+str(j),[(.092,yy,.921),(.094,yy+sign*.023,.914),(.095,yy+sign*.012,.87-j*.008)],'asphalt','foreArm'+side)
    splat('sleeve_blood'+side,.12,sign*.358,.884,.023,.025,'foreArm'+side)
    for j in range(3):
        yy=sign*(.09+j*.036)
        patch('jacket_hem_rag'+side+str(j),[(.158,yy,.776),(.164,yy+sign*.034,.769),(.164,yy+sign*.018,.705-j*.007)],'asphalt','torso')
tube('face_blood_stream',[(.163,-.119,1.365),(.16,-.112,1.31),(.163,-.079,1.264)],[.008,.013,.004],'blood','head',N=6)
tube('chin_blood_stream',[(.176,-.019,1.19),(.162,-.017,1.161),(.14,-.011,1.135)],[.018,.011,.003],'blood','head',N=6)
for j in range(6):
    y=-.13+j*.049;z=.77+(j%3)*.107
    splat('jacket_back_blood'+str(j),-.194,y,z,.021,.026,'torso')
# True torn openings in shirt and sleeves, with inset stylized wounds.
def tear(name,center,size):
    target=bpy.data.objects[name]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=center)
    cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=target.modifiers.new('torn opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
tear('shirt_body',(.181,-.082,.963),(.065,.035,.049))
ell('chest_wound',(.126,-.082,.963),(.024,.034,.043),'blood','torso')
for side,sign in [('L',1),('R',-1)]:
    tear('upper_sleeve'+side,(.095,sign*.302,.99),(.044,.037,.04))
    ell('sleeve_exposed_skin'+side,(.056,sign*.302,.99),(.027,.036,.039),'infectedSkin','arm'+side)
    for j in range(3):
        patch('sleeve_tear_edge'+side+str(j),[(.097,sign*(.27+j*.023),1.021),(.101,sign*(.29+j*.023),1.019),(.10,sign*(.282+j*.023),.995-j*.008)],'asphalt','arm'+side)
    for j in range(3):
        tube('shirt_wrinkle'+side+str(j),[(.167,sign*.079,.89+j*.032),(.176,sign*.116,.904+j*.03),(.156,sign*.143,.9+j*.03)],[.004,.009,.003],'picketWhite','torso',N=8)
for j in range(3):
    splat('hair_blood'+str(j),.18,-.09+j*.07,1.505+(j%2)*.04,.03,.014,'head')
ell('upper_gum',(.176,0,1.307),(.02,.064,.013),'blood','head')
ell('lower_gum',(.18,0,1.205),(.019,.06,.011),'blood','head')
# Large blood smears beneath the mouth, on sleeves and on the torn worker shirt.
for j,(y,z,ry,rz) in enumerate([(-.043,1.193,.038,.042),(.048,1.215,.025,.043),(-.105,1.27,.025,.039),(.111,1.285,.019,.033)]):
    splat('mouth_blood'+str(j),.19,y,z,ry,rz,'head')
for side,sign in [('L',1),('R',-1)]:
    ell('shoulder_mass'+side,(-.013,sign*.249,1.039),(.103,.101,.10),'asphalt','arm'+side)
    for j in range(3):
        z=.99-j*.032
        tube('sleeve_wrinkle'+side+str(j),[(.064,sign*.278,z+.018),(.092,sign*.306,z),(.062,sign*.326,z-.01)], [.012,.015,.006],'asphalt','arm'+side,N=8)
    splat('hand_heavy_blood'+side,.15,sign*.42,.744,.038,.045,'hand'+side)
    splat('forearm_heavy_blood'+side,.10,sign*.393,.801,.035,.043,'foreArm'+side)
    splat('jacket_heavy_blood'+side,.17,sign*.138,.963,.031,.066,'torso')

# Palette blood regions on the lower jaw read as a smeared wound rather than a clean lip ring.
obj=bpy.data.objects['jaw'];obj.data.materials.append(M['blood'])
for face in obj.data.polygons:
    center=obj.matrix_world@face.center
    if center.x>.118 and center.z<1.247 and abs(center.y)<.081:
        face.material_index=len(obj.data.materials)-1
# Broad asymmetric cloth creases across the trouser fronts.
for side,sign in [('L',1),('R',-1)]:
    for j,z in enumerate([.606,.536,.485]):
        tube('thigh_crease'+side+str(j),[(.089,sign*.098,z+.009),(.121,sign*.164,z),(.09,sign*.225,z-.017)],
             [(.008,.011),(.014,.02),(.003,.006)],'asphalt','leg'+side,N=8)
    for j,z in enumerate([.313,.27]):
        tube('calf_crease'+side+str(j),[(.072,sign*.128,z),(.093,sign*.185,z+.013),(.066,sign*.251,z-.016)],
             [(.005,.009),(.011,.015),(.003,.005)],'asphalt','shin'+side,N=8)
for side,sign in [('L',1),('R',-1)]:
    splat('claw_back_blood'+side,-.05,sign*.418,.725,.041,.041,'hand'+side)
    splat('claw_back_flecks'+side,-.05,sign*.43,.686,.027,.016,'hand'+side)
# Soft hoodie front edges and visible skate laces.
for sign in [-1,1]:
    tube('hoodie_zip_binding'+str(sign),[(.155,sign*.063,1.106),(.188,sign*.101,1.011),(.181,sign*.088,.864),(.17,sign*.077,.755)],[.012,.015,.014,.01],'asphalt','torso',N=8)
    box('zip_pull'+str(sign),(.19,sign*.09,.829),(.012,.012,.025),'sidewalk','torso',.004)
    side='L' if sign==1 else 'R'
    ell('padded_skate_tongue'+side,(.055,sign*.204,.175),(.086,.058,.033),'survivorRed','foot'+side)
    for j in range(4):
        x=.018+j*.024
        tube('skate_crosslace'+side+str(j),[(x,sign*.152,.207-j*.007),(x+.014,sign*.207,.215-j*.007),(x+.025,sign*.252,.201-j*.007)],[.005]*3,'picketWhite','foot'+side,N=6,sub=0)
        ell('lace_eyelet'+side+str(j),(x,sign*.151,.207-j*.007),(.008,.008,.004),'sidewalk','foot'+side,seg=8,rings=6)
# Broad bloody shirt spill and ragged, exposed knees from the turnaround.
splat('shirt_blood_spill',.21,-.018,.969,.052,.089,'torso')
for j in range(5):
    y=-.057+j*.023
    tube('shirt_blood_drip'+str(j),[(.19,y,.941),(.19,y,.895),(.179,y,.858-(j%3)*.02)],[.005,.007,.002],'blood','torso',N=6,sub=0)
for sign,side in [(1,'L'),(-1,'R')]:
    ell('torn_knee_skin'+side,(.124,sign*.171,.46),(.014,.045,.027),'infectedSkin','leg'+side)
    splat('knee_blood_smear'+side,.15,sign*.184,.45,.019,.017,'leg'+side)
# Skater identity: broad ivory hood pooled behind the neck, folded lip and drawcords.
ell('hood_outer',(-.118,0,1.105),(.151,.224,.112),'picketWhite','torso',seg=16,rings=10)
ell('hood_inset',(-.101,0,1.151),(.108,.159,.058),'sidewalk','torso',seg=16,rings=10)
for sign in [-1,1]:
    tube('hood_fold'+str(sign),[(-.211,sign*.063,1.122),(-.168,sign*.183,1.12),(-.048,sign*.193,1.15),(.061,sign*.11,1.163)],[.026,.035,.033,.021],'picketWhite','torso',N=10)
    tube('hood_front_lining'+str(sign),[(.087,sign*.095,1.151),(.169,sign*.108,1.078),(.185,sign*.057,.984)],[.022,.022,.011],'picketWhite','torso',N=10)
    tube('hood_drawcord'+str(sign),[(.181,sign*.102,1.075),(.209,sign*.113,1.006),(.219,sign*.103,.943)],[.004]*3,'sidewalk','torso',N=6,sub=0)
    box('cord_tip'+str(sign),(.219,sign*.103,.943),(.01,.009,.026),'uiDark','torso',.003)
    # Contrasting skate-shoe quarter panels and side piping, no logos.
    for yy in [sign*.12,sign*.288]:
        patch('shoe_stripe'+str(sign)+str(yy),[(.072,yy,.145),(.045,yy,.143),(.011,yy,.093),(.044,yy,.091)],'picketWhite','foot'+('L' if sign==1 else 'R'),.009)
    ell('ankle_sock'+str(sign),(-.014,sign*.198,.179),(.067,.072,.06),'picketWhite','shin'+('L' if sign==1 else 'R'))
# Hood tail and stitched folds break up the smooth rolled silhouette on the rear.
mesh('hood_folded_tail',[(-.229,-.146,1.138),(-.252,0,1.132),(-.229,.146,1.138),(-.244,.102,1.071),(-.241,0,1.017),(-.244,-.102,1.071),(-.211,0,1.088)],[(0,1,6),(1,2,6),(2,3,6),(3,4,6),(4,5,6),(5,0,6)],'picketWhite','torso',1)
for sign in [-1,1]:
    tube('hood_tail_fold'+str(sign),[(-.247,sign*.098,1.123),(-.258,sign*.062,1.076),(-.246,0,1.027)],[.012,.015,.005],'picketWhite','torso',N=8)
for j in range(3):
    z=.83+j*.075
    tube('hoodie_back_crease'+str(j),[(-.183,-.14,z-.01),(-.198,0,z+.012),(-.183,.14,z-.016)],[.004,.01,.003],'asphalt','torso',N=8)
# Backwards baseball cap: sculpted six panel dome, open adjustment arch facing +X.
v=[];f=[];sectors=32;levels=8
for j in range(levels):
    t=.035+(math.pi/2-.035)*j/(levels-1)
    for i in range(sectors):
        ang=2*math.pi*i/sectors
        v.append((-.035+.184*math.cos(t)*math.cos(ang),.192*math.cos(t)*math.sin(ang),1.515+.186*math.sin(t)))
for j in range(levels-1):
    for i in range(sectors):
        if j<3 and (i<3 or i>29):continue
        f.append((j*sectors+i,j*sectors+(i+1)%sectors,(j+1)*sectors+(i+1)%sectors,(j+1)*sectors+i))
cap=mesh('cap_dome',v,f,'survivorRed','head',1)
cap.data.materials.append(M['asphalt'])
for face in cap.data.polygons:
    if face.center.x>-.035:face.material_index=1
mod=cap.modifiers.new('cap cloth thickness','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=cap;bpy.ops.object.modifier_apply(modifier=mod.name)
ell('cap_top_button',(-.035,0,1.701),(.017,.019,.01),'survivorRed','head',seg=10,rings=6)
ell('cap_backwards_bill',(-.227,0,1.523),(.163,.169,.017),'survivorRed','head',seg=20,rings=8)
ell('bill_underlayer',(-.235,0,1.512),(.158,.162,.010),'woodWarm','head',seg=16,rings=8)
box('cap_adjustment_strap',(.153,0,1.531),(.016,.187,.026),'asphalt','head',.007)
for j in range(7):ell('strap_hole'+str(j),(.163,-.064+j*.021,1.531),(.003,.004,.004),'uiDark','head',seg=8,rings=6)
box('cap_strap_buckle',(.166,-.077,1.531),(.012,.016,.023),'sidewalk','head',.004)
for i in range(6):
    angle=2*math.pi*i/6
    pts=[]
    for j in range(7):
        t=.13+(math.pi/2-.13)*j/6
        pts.append((-.035+.189*math.cos(t)*math.cos(angle),.197*math.cos(t)*math.sin(angle),1.515+.191*math.sin(t)))
    tube('cap_panel_seam'+str(i),pts,[.0025]*7,'blood' if i>1 else 'uiDark','head',N=6,sub=0)
# Hoodie pockets and ribbed waistband.
for sign in [-1,1]:
    tube('pocket_opening'+str(sign),[(.178,sign*.131,.89),(.185,sign*.163,.845),(.175,sign*.168,.817)],[.006]*3,'uiDark','torso',N=6,sub=0)
for j in range(12):
    y=-.187+j*.034
    tube('hem_rib'+str(j),[(.102,y,.732),(.133,y,.75)],[.003,.003],'uiDark','torso',N=6,sub=0)
# Caps stay on proximal parts so they remain when distal nodes are detached.
for key,parent,p,sz in [('head','torso',(.014,0,1.19),(.075,.084,.012)),('armL','torso',(-.008,.237,1.076),(.077,.016,.077)),('armR','torso',(-.008,-.237,1.076),(.077,.016,.077)),('foreArmL','armL',(.021,.343,.899),(.065,.014,.06)),('foreArmR','armR',(.021,-.343,.899),(.065,.014,.06)),('legL','hip',(0,.124,.694),(.09,.095,.012)),('legR','hip',(0,-.124,.694),(.09,.095,.012))]:
    o=ell('stump_'+key,p,sz,'blood',parent,seg=12,rings=6);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)
# Applied subdivision defines the sculpted forms; reduce redundant triangles for the crowd budget.
for o in objects:
    if sum(len(f.vertices)-2 for f in o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game mesh reduction','DECIMATE');mod.ratio=.32
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
parts['head'].scale=(1.43,1.50,1.12)
parts['hip'].location.z-=.10
parts['torso'].rotation_euler.y=.24
parts['head'].rotation_euler.y=-.10
for side,sign in [('L',1),('R',-1)]:
    parts['arm'+side].rotation_euler=(sign*.17,-.94 if side=='L' else -1.04,0)
    parts['foreArm'+side].rotation_euler.y=-.69 if side=='L' else -.76
    parts['hand'+side].scale=(1.38,1.45,1.40)
    parts['hand'+side].rotation_euler.z=math.pi
    parts['leg'+side].rotation_euler.y=-.34 if side=='L' else -.42
    parts['shin'+side].rotation_euler.y=.72 if side=='L' else .80
    parts['foot'+side].rotation_euler.y=-.38
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
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
def compose_turnaround(output_path):
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
    compose_turnaround(a.render);sys.exit(0)
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
    if a.view=='review-set':
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((.13,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png'))
            bpy.ops.render.render(write_still=True)
        compose_turnaround(a.render)
    else:
        S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
        if a.pose:
            import numpy as np
            intact=bpy.data.images.load(a.render);w,h=intact.size
            pixels=np.empty(w*h*4,dtype=np.float32);intact.pixels.foreach_get(pixels)
            first=pixels.reshape(h,w,4)[:,(w-500)//2:(w+500)//2,:].copy()
            for o in objects:
                parent=o.parent
                while parent:
                    if parent==parts['armL']:o.hide_render=True;break
                    parent=parent.parent
            cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
            S.render.filepath=str(P/'renders'/'pose-amputation.png');bpy.ops.render.render(write_still=True)
            amputated=bpy.data.images.load(S.render.filepath);amputated.pixels.foreach_get(pixels)
            second=pixels.reshape(h,w,4)[:,(w-500)//2:(w+500)//2,:].copy()
            data=np.concatenate([first,second],axis=1)
            proof=bpy.data.images.new('pose proof',width=data.shape[1],height=h,alpha=True)
            proof.pixels.foreach_set(data.ravel());proof.filepath_raw=a.render;proof.file_format='PNG';proof.save()

print('OK',triangles,'triangles',len(objects),'meshes')
