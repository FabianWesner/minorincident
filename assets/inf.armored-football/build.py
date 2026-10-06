"""Deterministic rigid-part hero armored football charger. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json, random
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
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
M['survivorRed'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.43
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.09,0,.75),'root');node('torso',(-.04,0,.94),'hip');node('head',(.08,0,1.35),'torso');node('backpackSocket',(-.27,0,1.15),'torso')
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    if sub:
        mod=o.modifiers.new('sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o

def ell(n,p,sz,m,par,rot=None,seg=12,rings=8):
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
# Broad bent athletic body; garments are distinct shells.
ell('pelvis',(-.10,0,.76),(.19,.29,.16),'asphalt','hip')
ell('jersey',(-.014,0,1.06),(.235,.337,.30),'picketWhite','torso',rot=(0,.16,0),seg=20,rings=12)
ell('neck',(.086,0,1.36),(.12,.13,.12),'infectedSkin','head')
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(.015,s*.32,1.25); elbow=(.105,s*.43,1.04); wrist=(.24,s*.47,.84)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    ell('shoulder_padding'+side,(.006,s*.335,1.257),(.21,.205,.16),'uiDark','arm'+side)
    ell('ivory_pad_shell'+side,(.025,s*.349,1.30),(.214,.213,.132),'picketWhite','arm'+side)
    ell('red_pad_rim'+side,(.042,s*.37,1.255),(.203,.20,.086),'survivorRed','arm'+side)
    tube('sleeve'+side,[shoulder,(.056,s*.395,1.17),elbow],[.147,.151,.13],'asphalt','arm'+side,N=12)
    for j in range(2):
        tube('sleeve_fold'+side+str(j),[(.16,s*.35,1.14-j*.045),(.19,s*.414,1.13-j*.045),(.13,s*.475,1.11-j*.045)],[.01,.021,.009],'uiDark','arm'+side,N=8)
    tube('muscular_forearm'+side,[elbow,(.156,s*.455,.952),wrist],[.115,.124,.084],'infectedSkin','foreArm'+side,N=14)
    ell('biceps'+side,(.127,s*.427,1.028),(.095,.098,.114),'infectedSkin','foreArm'+side)
    tube('wrist_tape'+side,[(.219,s*.468,.88),(.242,s*.475,.835)],[.098,.091],'asphalt','foreArm'+side,N=12)
    ell('large_palm'+side,(.277,s*.483,.804),(.099,.106,.106),'asphalt' if side=='R' else 'infectedSkin','hand'+side)
    if side=='R':box('glove_back_plate',(.331,s*.484,.826),(.026,.16,.08),'sidewalk','handR',.016)
    for j in range(4):
        y=s*(.40+j*.052);z=.79-(.012 if j in [0,3] else 0)
        tube('claw'+side+str(j),[(.295,y,z),(.354,y+s*.008,z-.063),(.397,y+s*.004,z-.115),(.431,y-s*.009,z-.083)],[.026,.026,.021,.012],'infectedSkin','hand'+side,N=8)
        ell('nail'+side+str(j),(.433,y-s*.009,z-.084),(.008,.015,.018),'blood','hand'+side,seg=8,rings=6)
        ell('knuckle'+side+str(j),(.327,y,z),(.037,.026,.028),'asphalt' if side=='R' else 'infectedSkin','hand'+side)
    tube('thumb'+side,[(.305,s*.395,.832),(.374,s*.36,.796),(.40,s*.377,.75)],[.036,.033,.017],'infectedSkin','hand'+side,N=10)
    hip=(-.09,s*.17,.75);knee=(.053,s*.236,.49);ankle=(-.054,s*.271,.20)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('pants_thigh'+side,[hip,(-.053,s*.194,.68),(.024,s*.226,.55),knee],[.157,.164,.143,.111],'asphalt','leg'+side,N=14)
    tube('calf'+side,[knee,(.006,s*.256,.39),ankle],[.113,.121,.091],'infectedSkin','shin'+side,N=12)
    ell('knee_guard'+side,(.135,s*.24,.475),(.052,.107,.079),'uiDark','shin'+side)
    for z in [.425,.514]:
        tube('knee_strap'+side+str(z),[(.072,s*.24,z),(.01,s*.25,z),(-.047,s*.25,z)],[.111,.113,.111],'asphalt','shin'+side,N=10)
    tube('sock'+side,[(.006,s*.257,.351),(-.043,s*.269,.23),ankle],[.117,.104,.092],'picketWhite','shin'+side,N=12)
    for z in [.31,.335]:
        tube('sock_stripe'+side+str(z),[(-.018,s*.263,z+.009),(-.024,s*.264,z-.009)],[.112,.111],'survivorRed','shin'+side,N=12)
    box('sole'+side,(.037,s*.28,.041),(.37,.239,.068),'uiDark','foot'+side,.023)
    box('welt'+side,(.037,s*.28,.075),(.374,.239,.036),'picketWhite','foot'+side,.018)
    ell('cleat_upper'+side,(.024,s*.28,.131),(.18,.117,.09),'asphalt','foot'+side)
    ell('toe'+side,(.154,s*.28,.118),(.082,.117,.061),'picketWhite','foot'+side)
    ell('red_toe_overlay'+side,(.17,s*.281,.141),(.069,.108,.037),'survivorRed','foot'+side)
    ell('ankle_collar'+side,(-.069,s*.28,.202),(.099,.102,.067),'uiDark','foot'+side)
    box('tongue'+side,(-.006,s*.28,.21),(.109,.105,.035),'survivorRed','foot'+side,.018,rot=(0,-.34,0))
    for j in range(5):
        x=-.044+j*.028;z=.221-j*.013
        tube('cross_lace'+side+str(j),[(x,s*.228,z),(x+.011,s*.28,z+.008),(x+.025,s*.329,z-.012)],[.005]*3,'picketWhite','foot'+side,N=6,sub=0)
    for j in range(5):
        for sy in [-1,1]:box('cleat_stud'+side+str(j)+str(sy),(-.11+j*.073,s*.28+sy*.083,.013),(.027,.033,.026),'asphalt','foot'+side,.005)
    # Ragged shorts cuff and side stripe, exposed patches.
    tube('pants_red_stripe'+side,[(-.08,s*.342,.70),(-.004,s*.36,.61),(.028,s*.344,.54)],[.017,.018,.013],'survivorRed','leg'+side,N=8)
    ell('thigh_exposed'+side,(.151,s*.24,.57),(.026,.071,.068),'infectedSkin','leg'+side)
    for j in range(4):
        yy=s*(.175+j*.034)
        patch('pants_rag'+side+str(j),[(.159,yy,.635),(.163,yy+s*.035,.611),(.166,yy+s*.02,.566-j*.012)],'asphalt','leg'+side)
    for j in range(3):
        tube('pants_crease'+side+str(j),[(.09,s*.10,.68-j*.054),(.128,s*.17,.667-j*.054),(.113,s*.23,.654-j*.054)],[.004,.011,.003],'asphalt','leg'+side,N=8)
    box('rear_pocket'+side,(-.257,s*.163,.697),(.022,.126,.133),'asphalt','hip',.017)
    tube('pocket_seam'+side,[(-.273,s*.104,.745),(-.279,s*.106,.654),(-.276,s*.174,.633),(-.265,s*.224,.656)],[.003]*4,'sidewalk','hip',N=6,sub=0)
# Belt and a V-neck ring.
tube('belt',[(-.09+.197*math.cos(t),.291*math.sin(t),.804) for t in [i*2*math.pi/32 for i in range(33)]],[.024]*33,'uiDark','hip',N=8)
box('belt_buckle',(.124,0,.81),(.032,.068,.038),'sidewalk','hip',.007)
for s in [-1,1]:
    tube('v_neck'+str(s),[(.138,s*.13,1.345),(.24,s*.10,1.263),(.257,0,1.212)],[.023,.02,.018],'survivorRed','torso',N=10)
    for j in range(3):
        patch('jersey_rag'+str(s)+str(j),[(.184,s*(.018+j*.061),.88),(.195,s*(.075+j*.061),.873),(.196,s*(.06+j*.061),.815-j*.012)],'picketWhite','torso')
# A sculpted enraged face, larger than human proportions.
ell('cranium',(.106,0,1.57),(.226,.239,.263),'infectedSkin','head',seg=20,rings=14)
ell('jaw',(.20,0,1.411),(.16,.177,.115),'infectedSkin','head',seg=16,rings=10)
for s in [-1,1]:
    ell('cheek'+str(s),(.286,s*.14,1.493),(.068,.075,.077),'infectedSkin','head')
    ell('socket'+str(s),(.299,s*.106,1.592),(.031,.075,.069),'blood','head')
    ell('dark_orbit'+str(s),(.321,s*.106,1.594),(.025,.061,.052),'uiDark','head')
    ell('eye'+str(s),(.339,s*.106,1.595),(.022,.045,.040),'eye','head')
    ell('eye_core'+str(s),(.359,s*.107,1.60),(.008,.015,.018),'picketWhite','head')
    tube('brow'+str(s),[(.324,s*.033,1.621),(.334,s*.096,1.653),(.30,s*.176,1.65)],[.026,.032,.019],'uiDark','head',N=10)
    ell('ear'+str(s),(.09,s*.232,1.5),(.071,.04,.08),'infectedSkin','head')
ell('nose_bridge',(.327,0,1.563),(.035,.04,.067),'infectedSkin','head')
ell('nose_tip',(.363,0,1.537),(.044,.048,.03),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.39,s*.027,1.527),(.006,.015,.01),'uiDark','head')
# Actual hollow mouth cut into jaw/cranium.
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(.351,0,1.441));cut=bpy.context.object;cut.scale=(.119,.106,.096);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for name in ['jaw','cranium']:
    target=bpy.data.objects[name];mod=target.modifiers.new('mouth opening','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut,do_unlink=True)
ell('mouth_dark',(.27,0,1.441),(.045,.103,.092),'uiDark','head')
tube('bloody_lips',[(.359,.106*math.cos(t),1.441+.096*math.sin(t)) for t in [i*2*math.pi/24 for i in range(25)]],[.015]*25,'blood','head',N=8)
for row in [0,1]:
    for j in range(7):box('tooth'+str(row)+str(j),(.368,(j-3)*.027,1.50 if row==0 else 1.376),(.026,.022,.028 if (j+row)%3 else .038),'picketWhite','head',.005,rot=(.05*(j-3),0,0))
ell('tongue',(.348,0,1.375),(.025,.046,.017),'survivorRed','head')
# Thick dark locks visible beneath the helmet at the nape and temple.
for j in range(11):
    t=1.0+j*.43;x=.075+.19*math.cos(t);y=.224*math.sin(t)
    tube('hair_lock'+str(j),[(x,y,1.64),(x-.024,y*1.05,1.53),(x-.035,y*.94,1.425)],[.043,.05,.008],'uiDark','head',N=8)
# Open helmet: crown dome and low rear shell, with thick padded rolled lip.
v=[];f=[];N=40;R=12
for j in range(R+1):
    theta=.025+(math.pi/2-.025)*j/R
    for i in range(N):
        t=i*2*math.pi/N;v.append((.06+.29*math.sin(theta)*math.cos(t),.287*math.sin(theta)*math.sin(t),1.65+.287*math.cos(theta)))
for j in range(R):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
o=mesh('helmet_dome',v,f,'survivorRed','head',1)
mod=o.modifiers.new('helmet shell thickness','SOLIDIFY');mod.thickness=.014;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
v=[];f=[]
for z,r in [(1.65,1),(1.59,1.01),(1.43,.86)]:
    for i in range(29):
        t=.73+(2*math.pi-1.46)*i/28;v.append((.06+.29*r*math.cos(t),.287*r*math.sin(t),z))
for j in range(2):
    for i in range(28):f.append((j*29+i,j*29+i+1,(j+1)*29+i+1,(j+1)*29+i))
o=mesh('helmet_rear_shell',v,f,'survivorRed','head',1);mod=o.modifiers.new('shell thickness','SOLIDIFY');mod.thickness=.017;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Center ivory stripe follows crown surface, >3mm proud.
v=[];f=[]
for i in range(33):
    t=math.pi*i/32
    for y in [-.036,.036]:v.append((.06+.303*math.cos(t),y,1.65+.300*math.sin(t)))
for i in range(32):f.append((2*i,2*i+1,2*i+3,2*i+2))
mesh('helmet_center_stripe',v,f,'picketWhite','head',0)
tube('helmet_brow_rim',[(.311,-.186,1.65),(.363,-.11,1.662),(.371,0,1.665),(.363,.11,1.662),(.311,.186,1.65)],[.016]*5,'asphalt','head',N=10)
for s in [-1,1]:
    ell('helmet_ear_padding'+str(s),(.10,s*.274,1.516),(.093,.035,.09),'uiDark','head')
    ell('helmet_ear_shell'+str(s),(.098,s*.30,1.536),(.085,.019,.086),'survivorRed','head')
    ell('ear_vent'+str(s),(.112,s*.321,1.553),(.034,.006,.044),'uiDark','head')
    for j in range(3):
        ell('helmet_rivet'+str(s)+str(j),(.23-j*.072,s*(.225+j*.032),1.637-j*.04),(.012,.013,.013),'sidewalk','head',seg=8,rings=6)
    # Cage rails swept away from the face, no bar crosses the eye center.
    tube('cage_side'+str(s),[(.25,s*.244,1.645),(.392,s*.218,1.568),(.441,s*.18,1.379),(.396,s*.145,1.31)],[.013]*4,'sidewalk','head',N=8)
    tube('cage_cheek'+str(s),[(.16,s*.296,1.51),(.335,s*.257,1.479),(.451,s*.179,1.463)],[.013]*3,'sidewalk','head',N=8)
    tube('chin_strap'+str(s),[(.04,s*.281,1.463),(.24,s*.195,1.335),(.31,s*.063,1.322)],[.016,.018,.02],'asphalt','head',N=8)
for z,x,w in [(1.47,.457,.18),(1.335,.424,.149)]:
    tube('cage_crossbar'+str(z),[(x-.03,-w,z+.018),(x,-w*.6,z),(x,0,z-.007),(x,w*.6,z),(x-.03,w,z+.018)],[.012]*5,'sidewalk','head',N=8)
for y in [-.079,.079]:tube('cage_vertical'+str(y),[(.452,y,1.468),(.441,y,1.39),(.418,y,1.328)],[.010]*3,'sidewalk','head',N=8)
# Front and back athletic block numbers; project their vertices onto garment curvature.
def project(o,names,front=True,offset=.004):
    direction=Vector((-1,0,0) if front else (1,0,0));startx=1 if front else -1
    bpy.context.view_layer.update();complete=True
    for vertex in o.data.vertices:
        world=o.matrix_world@vertex.co;start=Vector((startx,world.y,world.z));hits=[]
        for name in names:
            ob=bpy.data.objects.get(name)
            if not ob:continue
            inv=ob.matrix_world.inverted();hit,loc,n,idx=ob.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(ob.matrix_world@loc)
        if hits:
            hit=min(hits,key=lambda p:(p-start).length);world.x=hit.x+(offset if front else -offset);vertex.co=o.matrix_world.inverted()@world
        else:complete=False
    return complete
# Font-independent solid athletic glyph silhouettes, tessellated to follow the cloth.
glyphs={'1':[(-.037,.08),(-.005,.12),(.028,.12),(.028,-.12),(-.007,-.12),(-.007,.07),(-.037,.048)],
        '3':[(-.044,.12),(.044,.12),(.044,-.12),(-.044,-.12),(-.044,-.084),(.01,-.084),(.01,-.018),(-.032,-.018),(-.032,.018),(.01,.018),(.01,.084),(-.044,.084)]}
for front in [True,False]:
    for digit,yc in [('1',-.076),('3',.068)]:
        pts=[(.4,(yc+dy)*(1 if front else -1),1.052+dz*1.15) for dy,dz in glyphs[digit]]
        o=mesh('jersey_number_'+str(front)+digit,pts,[tuple(range(len(pts)))],'blood','torso',0)
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
        bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=3,use_grid_fill=True)
        bm.to_mesh(o.data);bm.free();project(o,['jersey'],front,.007)
        for face in o.data.polygons:face.use_smooth=False
# Blood and scuffed finish uses projected irregular palette shapes, no textures.
def stain(n,y,z,ry,rz,par,surfaces,front=True,material='blood'):
    pts=[]
    for j in range(9):
        t=j*2*math.pi/9;r=rng.uniform(.65,1.2);pts.append((.6,y+ry*r*math.cos(t),z+rz*r*math.sin(t)))
    o=mesh(n,pts,[tuple(range(9))],material,par,0)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=1,use_grid_fill=True)
    bm.to_mesh(o.data);bm.free()
    if not project(o,surfaces,front,.008):
        objects.remove(o);bpy.data.objects.remove(o,do_unlink=True);return
    for face in o.data.polygons:face.use_smooth=False
for front in [True,False]:
    for j in range(27):
        y=rng.uniform(-.28,.28);z=rng.uniform(.85,1.33)
        if abs(y)<.13 and .91<z<1.19:continue
        stain('jersey_blood'+str(front)+str(j),y,z,rng.uniform(.008,.04),rng.uniform(.012,.047),'torso',['jersey'],front)
for s,side in [(1,'L'),(-1,'R')]:
    for j in range(9):
        stain('arm_blood'+side+str(j),s*(.41+rng.uniform(-.08,.08)),rng.uniform(.87,1.10),.015,.029,'foreArm'+side,['muscular_forearm'+side,'biceps'+side])
    for j in range(9):
        stain('pad_blood'+side+str(j),s*(.34+rng.uniform(-.16,.16)),rng.uniform(1.24,1.4),.022,.019,'arm'+side,['ivory_pad_shell'+side,'red_pad_rim'+side])
    for j in range(4):
        stain('sock_blood'+side+str(j),s*(.25+rng.uniform(-.06,.06)),rng.uniform(.22,.36),.025,.024,'shin'+side,['sock'+side])
    stain('thigh_wound'+side,s*.24,.585,.031,.036,'leg'+side,['thigh_exposed'+side])
    stain('hand_blood'+side,s*.48,.813,.05,.059,'hand'+side,['large_palm'+side])
for j in range(13):
    stain('helmet_scuff'+str(j),rng.uniform(-.25,.25),rng.uniform(1.69,1.88),.015,.019,'head',['helmet_dome'],material='asphalt' if j%3 else 'blood')
for j in range(7):
    stain('face_blood'+str(j),rng.uniform(-.19,.19),rng.uniform(1.35,1.56),.024,.026,'head',['jaw','cheek-1','cheek1','cranium'])
# True garment tears, exposed red wounds and loose cloth tongues.
for j,(y,z) in enumerate([(-.22,1.14),(.24,.98),(-.15,.90)]):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(.18,y,z));cut=bpy.context.object;cut.scale=(.075,.043,.038);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob=bpy.data.objects['jersey'];mod=ob.modifiers.new('jersey rip','BOOLEAN');mod.object=cut;mod.operation='DIFFERENCE';bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
    ell('chest_wound'+str(j),(.128,y,z),(.025,.04,.035),'blood','torso')
    patch('rip_flap'+str(j),[(.203,y-.036,z+.03),(.213,y+.013,z+.026),(.226,y+.026,z-.052)],'picketWhite','torso')
for key,parent,p,sz in [('head','torso',(.08,0,1.35),(.11,.12,.016)),('armL','torso',(.015,.32,1.25),(.12,.016,.12)),('armR','torso',(.015,-.32,1.25),(.12,.016,.12)),('foreArmL','armL',(.105,.43,1.04),(.10,.014,.09)),('foreArmR','armR',(.105,-.43,1.04),(.10,.014,.09)),('legL','hip',(-.09,.17,.75),(.13,.13,.014)),('legR','hip',(-.09,-.17,.75),(.13,.13,.014))]:
    o=ell('stump_'+key,p,sz,'blood',parent);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0)

# Padded garment seams, cloth creases, and crown ventilation distinguish equipment layers.
for sign,side in [(1,'L'),(-1,'R')]:
    for j in range(3):
        tube('jersey_fold'+side+str(j),[(.213,sign*.14,.905+j*.025),(.231,sign*.20,.927+j*.025),(.19,sign*.263,.924+j*.025)],[.004,.012,.003],'picketWhite','torso',N=8)
    tube('pad_seam'+side,[(.169,sign*.28,1.382),(.203,sign*.38,1.35),(.145,sign*.51,1.30)],[.006]*3,'sidewalk','arm'+side,N=8)
    for j in range(3):
        ell('crown_vent'+side+str(j),(.025-j*.06,sign*.14,1.893-j*.009),(.021,.013,.004),'uiDark','head',seg=8,rings=6)
for sign,side in [(1,'L'),(-1,'R')]:
    # Distinct lateral red cleat band, raised above the charcoal upper.
    tube('shoe_side_band'+side,[(-.103,sign*.391,.14),(.009,sign*.398,.14),(.115,sign*.379,.115)],[.012,.02,.007],'survivorRed','foot'+side,N=8)
    for j in range(4):
        x=-.011+j*.027;z=.25-j*.018
        for sy in [-1,1]:ell('lace_eyelet'+side+str(j)+str(sy),(x,sign*.28+sy*.048,z),(.009,.009,.006),'sidewalk','foot'+side,seg=8,rings=6)
        tube('visible_lace'+side+str(j),[(x,sign*.28-.045,z+.003),(x+.01,sign*.28,z+.008),(x+.021,sign*.28+.045,z-.007)],[.004]*3,'picketWhite','foot'+side,N=6,sub=0)
# Enlarge claws around their wrist pivot without leaving non-unit rig scales.
bpy.context.view_layer.update()
for o in objects:
    if o.parent and o.parent.name in ['handL','handR']:
        pivot=o.parent.matrix_world.translation.copy();inv=o.matrix_world.inverted()
        for v in o.data.vertices:v.co=inv@(pivot+(o.matrix_world@v.co-pivot)*1.34)
# Applied sculpt smoothing is reduced before triangulation to stay within crowd budget.
for o in objects:
    if len(o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('remove redundant sculpt triangles','DECIMATE');mod.ratio=.285
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
        buckets.setdefault(o.parent.name,[]).append(o)
joined=[]
for parent,group in buckets.items():
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__geometry';joined.append(o)
objects=joined+caps
# Plant each sole exactly on z=0 after mesh reduction.
bpy.context.view_layer.update()
for side in ['L','R']:
    shoe=next(o for o in objects if o.parent==parts['foot'+side])
    floor=min((shoe.matrix_world@v.co).z for v in shoe.data.vertices)
    parts['foot'+side].location.z-=floor
bpy.context.view_layer.update()
# Record before stage objects. Export includes hidden caps as zero scale nodes.
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
bpy.context.view_layer.update()
bounds=[o.matrix_world@v.co for o in objects if not o.name.startswith('stump_') for v in o.data.vertices]
(P/'rig-rest.json').write_text(json.dumps({'height':max(v.z for v in bounds)-min(v.z for v in bounds),'feet_min_z':min(v.z for v in bounds),'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()}},indent=2))
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose_test():
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    # Move the articulated left arm away to expose its proximal cap while retaining
    # the shoulder/elbow rotations, and bend the right leg independently.
    parts['armL'].location+=Vector((.05,.36,.12))
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    (P/'pose-test.json').write_text(json.dumps({'rotated_nodes':['armL','foreArmL','legR'],'shown_cap':'stump_armL','cap_scale':list(cap.scale),'armL_offset':[.05,.36,.12],'parent_chain_ok':parts['foreArmL'].parent==parts['armL'] and parts['handL'].parent==parts['foreArmL']},indent=2))
if a.pose:pose_test()
def save_turnaround(path):
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','review-hero.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()
if a.render and a.view=='turnaround':
    save_turnaround(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,3.1),'pose':(6,4,3.1),'front':(6,0,1.0),'side':(0,-6,1.0),'back':(-6,0,1.0)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.05,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.30*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review-set','final-set']:
        if a.view=='final-set':
            S.render.resolution_x=960;S.render.resolution_y=540;S.cycles.samples=24
        for name in ['front','side','back','hero']:
            cam.location=views[name];cam.rotation_euler=(Vector((.05,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if name=='hero' else name+'.png'));bpy.ops.render.render(write_still=True)
        if a.view=='final-set':
            cam.location=views['hero'];cam.rotation_euler=(Vector((.05,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.cycles.samples=a.samples
            S.render.filepath=str(P/'renders'/'hero.png');bpy.ops.render.render(write_still=True)
            pose_test();cam.location=views['pose'];cam.rotation_euler=(Vector((.05,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler();S.render.resolution_x=960;S.render.resolution_y=540;S.cycles.samples=24
            S.render.filepath=str(P/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
            save_turnaround(P/'renders'/'turnaround.png')
    else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
