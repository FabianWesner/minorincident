"""Deterministic rigid-part hero Bloated. +X forward, Z up, -Y character right.
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
M['blood'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.56
M['pustule']=mat('schoolBusYellow','f2b630',.48)
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.08,0,.61),'root');node('torso',(-.08,0,.81),'hip');node('head',(.11,0,1.19),'torso');node('backpackSocket',(-.33,0,1.07),'torso')
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
# Heavy, exposed belly. Shirt is an independent open shell above it.
belly=ell('swollen_belly',(.10,0,.86),(.405,.395,.405),'infectedSkin','torso',seg=24,rings=16)
ell('broad_back',(-.15,0,1.02),(.23,.37,.30),'infectedSkin','torso',seg=16,rings=12)
ell('pelvis',(-.09,0,.59),(.245,.30,.18),'asphalt','hip',seg=16,rings=10)
ell('neck',(.07,0,1.225),(.135,.145,.12),'infectedSkin','head')
# Open shirt rear and sides, uneven torn hem; thick sculpted shoulder panels.
v=[];f=[];N=24
for j,(z,rx,ry) in enumerate([(.70,.31,.35),(.735,.31,.37),(.93,.305,.405),(1.14,.295,.385),(1.23,.27,.34),(1.285,.205,.28)]):
    for i in range(N):
        t=.83+(2*math.pi-1.66)*i/(N-1)
        v.append((-.10+rx*math.cos(t),ry*math.sin(t),z+(.025*math.sin(i*2.1) if j==0 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
shirt=mesh('torn_shirt_back',v,f,'picketWhite','torso',2)
mod=shirt.modifiers.new('cloth shell','SOLIDIFY');mod.thickness=.018;bpy.context.view_layer.objects.active=shirt;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    ell('shirt_pectoral'+str(s),(.124,s*.18,1.158),(.23,.204,.124),'picketWhite','torso',rot=(s*.13,-.10,0),seg=16,rings=10)
    tube('collar_roll'+str(s),[(.18,0,1.265),(.16,s*.12,1.263),(.052,s*.17,1.25),(-.07,s*.12,1.245)],[.024,.025,.023,.019],'sidewalk','torso',N=10)
    patch('shirt_rag'+str(s),[(.345,s*.045,1.144),(.348,s*.125,1.135),(.33,s*.091,1.037),(.34,s*.066,1.081)],'picketWhite','torso',.018)
    ell('shirt_nipple'+str(s),(.349,s*.187,1.151),(.009,.024,.018),'blood','torso')
# Belt follows waist, with separately raised loops and buckle.
pts=[(-.08+.252*math.cos(t),.307*math.sin(t),.608+.022*math.cos(t)) for t in [i*2*math.pi/40 for i in range(41)]]
tube('waist_belt',pts,[(.028,.012)]*len(pts),'uiDark','hip',N=8)
box('belt_buckle',(.190,0,.628),(.023,.088,.058),'sidewalk','hip',.009)
box('buckle_opening',(.206,0,.628),(.008,.055,.034),'uiDark','hip',.003)
box('buckle_prong',(.214,0,.628),(.011,.009,.048),'sidewalk','hip',.003)
for s in [-1,1]:
    for j in range(3):
        t=s*(.35+j*.95);x=-.08+.257*math.cos(t);y=.314*math.sin(t)
        box('belt_loop'+str(s)+str(j),(x,y,.627),(.035,.024,.084),'asphalt','hip',.008,rot=(0,0,t))
# Relaxed, forward reaching heavy arms. Hands have individual clawed fingers.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.02,s*.345,1.184);elbow=(.015,s*.49,.963);wrist=(.14,s*.56,.791)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('sleeve'+side,[shoulder,(-.008,s*.40,1.168),(.005,s*.445,1.087),(.012,s*.456,1.038)],[.151,.159,.139,.126],'picketWhite','arm'+side,N=14)
    tube('upper_arm'+side,[(.01,s*.432,1.075),elbow,(.058,s*.511,.913)],[.115,.134,.12],'infectedSkin','arm'+side,N=14)
    tube('forearm'+side,[elbow,(.063,s*.53,.886),wrist],[.127,.118,.075],'infectedSkin','foreArm'+side,N=14)
    for j in range(4):
        y=s*(.405+j*.025)
        patch('sleeve_tatter'+side+str(j),[(.125,y,1.099),(.131,y+s*.028,1.071),(.117,y+s*.014,1.025-j*.009)],'picketWhite','arm'+side,.016)
    ell('palm'+side,(.151,s*.566,.748),(.091,.087,.10),'infectedSkin','hand'+side,seg=14,rings=10)
    for j in range(4):
        y=s*(.487+j*.048);z=.711-(.013 if j in [1,2] else 0)
        finger=[(.172,y,z),(.214,y,z-.065),(.249,y+s*.006,z-.106),(.277,y+s*.006,z-.073)]
        tube('finger'+side+str(j),finger,[.027,.027,.022,.011],'infectedSkin','hand'+side,N=8)
        ell('knuckle'+side+str(j),(.186,y,z+.003),(.03,.028,.03),'infectedSkin','hand'+side)
        ell('nail'+side+str(j),(.28,y+s*.006,z-.073),(.009,.015,.019),'sidewalk','hand'+side)
    tube('thumb'+side,[(.153,s*.483,.769),(.214,s*.455,.724),(.259,s*.475,.72)],[.039,.034,.015],'infectedSkin','hand'+side,N=10)
    # Bent, wide legs; trousers stop below knees, feet are bare as in the reference.
    hip=(-.08,s*.184,.60);knee=(.003,s*.257,.326);ankle=(-.065,s*.299,.105)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('trouser_thigh'+side,[hip,(-.071,s*.205,.565),(-.023,s*.242,.412),knee],[.171,.178,.153,.126],'asphalt','leg'+side,N=14)
    tube('trouser_cuff'+side,[(.002,s*.255,.37),knee,(-.012,s*.266,.282)],[.128,.132,.128],'asphalt','shin'+side,N=12)
    tube('bare_calf'+side,[(.006,s*.26,.307),(-.024,s*.282,.223),ankle],[.097,.108,.077],'infectedSkin','shin'+side,N=12)
    for j in range(7):
        t=j*2*math.pi/7
        x=-.012+.125*math.cos(t);y=s*.266+.125*math.sin(t)
        dx=-.027*math.sin(t);dy=.027*math.cos(t)
        patch('trouser_tatter'+side+str(j),[(x-dx,y-dy,.313),(x+dx,y+dy,.31),(x+dx*.35+.012,y+dy*.35,.25+(j%3)*.01)],'asphalt','shin'+side,.016)
    ell('bare_foot'+side,(.034,s*.305,.075),(.158,.104,.075),'infectedSkin','foot'+side,seg=16,rings=10)
    ell('heel'+side,(-.082,s*.31,.062),(.068,.087,.062),'infectedSkin','foot'+side)
    for j in range(5):
        y=s*(.236+j*.037);sz=.043-j*.004
        ell('toe'+side+str(j),(.17-j*.007,y,.042),(.058,sz,.042),'infectedSkin','foot'+side,seg=10,rings=8)
        ell('toenail'+side+str(j),(.209-j*.007,y,.065),(.022,sz*.66,.005),'sidewalk','foot'+side)
    for j,z in enumerate([.52,.43]):
        tube('trouser_fold'+side+str(j),[(.041,s*.127,z+.027),(.097,s*.215,z),(.04,s*.31,z-.013)],[.007,.018,.003],'asphalt','leg'+side,N=8)
    # Back patch pocket with outlined stitching, separate front welt.
    box('rear_pocket'+side,(-.247,s*.192,.53),(.025,.15,.122),'asphalt','leg'+side,.018,rot=(0,s*.10,0))
    tube('pocket_stitch'+side,[(-.264,s*.125,.57),(-.272,s*.126,.497),(-.28,s*.194,.476),(-.264,s*.258,.503),(-.263,s*.26,.57)],[.003]*5,'sidewalk','leg'+side,N=6,sub=0)
    tube('front_pocket_welt'+side,[(.124,s*.212,.578),(.121,s*.253,.555),(.084,s*.3,.522)],[.009]*3,'uiDark','leg'+side,N=8)
# Large bald, furious head; sculpted cheeks, ears, brows and nose.
ell('cranium',(.09,0,1.42),(.197,.216,.236),'infectedSkin','head',seg=24,rings=16)
ell('heavy_jaw',(.162,0,1.278),(.157,.181,.106),'infectedSkin','head',seg=16,rings=12)
for s in [-1,1]:
    ell('ear'+str(s),(.084,s*.214,1.411),(.06,.038,.081),'infectedSkin','head')
    ell('inner_ear'+str(s),(.13,s*.234,1.416),(.016,.013,.045),'blood','head')
    ell('jowl'+str(s),(.233,s*.14,1.335),(.05,.068,.082),'infectedSkin','head')
    ell('orbital_rim'+str(s),(.261,s*.09,1.471),(.025,.072,.062),'blood','head')
    ell('eye_socket'+str(s),(.28,s*.09,1.473),(.014,.058,.049),'uiDark','head')
    ell('red_eye'+str(s),(.295,s*.09,1.475),(.015,.041,.036),'eye','head',seg=16,rings=10)
    ell('eye_hotspot'+str(s),(.309,s*.085,1.48),(.004,.012,.013),'picketWhite','head')
    tube('brow_ridge'+str(s),[(.277,s*.025,1.508),(.273,s*.088,1.542),(.235,s*.151,1.54)],[.025,.034,.018],'infectedSkin','head',N=10)
    tube('brow_hair'+str(s),[(.289,s*.034,1.518),(.284,s*.085,1.543),(.255,s*.137,1.55)],[.012,.017,.005],'uiDark','head',N=8)
ell('nose_bridge',(.284,0,1.44),(.035,.037,.068),'infectedSkin','head')
ell('bulbous_nose',(.332,0,1.408),(.047,.047,.027),'infectedSkin','head')
for s in [-1,1]:ell('nostril'+str(s),(.359,s*.027,1.396),(.009,.011,.009),'uiDark','head')
# Genuine carved open mouth, with a recessed dark lining and individual broken teeth.
def carve(targets,center,size):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=center)
    cut=bpy.context.object;cut.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for obj in targets:
        mod=obj.modifiers.new('sculpted cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut,do_unlink=True)
carve([bpy.data.objects['cranium'],bpy.data.objects['heavy_jaw']],(.327,0,1.316),(.10,.103,.093))
ell('mouth_depth',(.254,0,1.316),(.034,.099,.091),'uiDark','head',seg=20,rings=12)
pts=[(.326,.105*math.cos(i*2*math.pi/32),1.317+.096*math.sin(i*2*math.pi/32)) for i in range(33)]
tube('torn_lips',pts,[.013 if i<17 else .022 for i in range(33)],'blood','head',N=8)
for row in [0,1]:
    for j in range(6):
        if (row,j)==(0,4):continue
        z=(1.387 if row==0 else 1.25)+(abs(j-2.5)*(-.006 if row==0 else .005))
        box('broken_tooth'+str(row)+str(j),(.342,(j-2.5)*.03,z),(.035,.026,.027+(j%3)*.006),'picketWhite','head',.007,rot=(.1*(j-2.5),0,0))
ell('tongue',(.337,.013,1.267),(.024,.044,.018),'survivorRed','head')
# Sparse hair in thick irregular curled volumes, with open bald forehead and crown.
for j in range(23):
    t=1.15+j*(2*math.pi-2.3)/22;z=1.48+(j%3)*.05
    x=.06+.173*math.cos(t);y=.207*math.sin(t)
    tube('nape_lock'+str(j),[(x*.9,y*.8,z+.065),(x-.014,y,z+.032),(x-.025,y*1.06,z-.016),(x-.002,y*1.07,z-.055)],[.026,.041,.033,.004],'uiDark','head',N=8)
for j in range(9):
    t=j*2*math.pi/9
    tube('crown_tuft'+str(j),[(.025+.11*math.cos(t),.14*math.sin(t),1.61),(.008+.14*math.cos(t),.17*math.sin(t),1.67),(.032+.16*math.cos(t),.17*math.sin(t),1.69),(.055+.17*math.cos(t),.17*math.sin(t),1.657)],[.026,.022,.012,.002],'asphalt','head',N=8)
# Belly wound is carved into the skin rather than painted on top.
wc=(.431,.177,.952)
carve([belly],wc,(.124,.109,.124))
# A recessed bowl closes the carved opening and follows the curved rim.
v=[(.336,.177,.952)];f=[];N=24
for r in [.38,.72,1]:
    for j in range(N):
        t=j*2*math.pi/N;y=.177+.102*r*math.cos(t);z=.952+.115*r*math.sin(t)
        surface=.10+.405*math.sqrt(max(.01,1-(y/.395)**2-((z-.86)/.405)**2))
        v.append((surface-.11*(1-r*r),y,z))
for j in range(N):f.append((0,1+j,1+(j+1)%N))
for row in range(2):
    for j in range(N):f.append((1+row*N+j,1+(row+1)*N+j,1+(row+1)*N+(j+1)%N,1+row*N+(j+1)%N))
bowl=mesh('belly_sore_bowl',v,f,'infectedSkin','torso',1)
bowl.data.materials.append(M['blood'])
for face in bowl.data.polygons:
    if face.center.x<.345 and face.index%4==0:face.material_index=1
for j in range(7):
    t=j*2*math.pi/7;y=.177+.049*math.cos(t);z=.952+.057*math.sin(t)
    surface=.10+.405*math.sqrt(max(.01,1-(y/.395)**2-((z-.86)/.405)**2))
    ell('sore_inner_spot'+str(j),(surface-.075,y,z),(.006,.009,.011),'blood','torso',seg=8,rings=6)
pts=[]
for i in range(29):
    t=i*2*math.pi/28;y=.177+.109*math.cos(t);z=.952+.123*math.sin(t)
    x=.10+.405*math.sqrt(max(.01,1-(y/.395)**2-((z-.86)/.405)**2))+.008
    pts.append((x,y,z))
tube('irritated_sore_rim',pts,[.017]*29,'blood','torso',N=8)
for j in range(19):
    x,y,z=pts[int(j*28/19)]
    ell('yellow_pustule'+str(j),(x+.012,y,z),(.024,.019+(j%3)*.002,.023+(j%2)*.004),'pustule','torso',seg=10,rings=8)
    ell('pustule_head'+str(j),(x+.028,y-.002,z+.005),(.007,.009,.009),'picketWhite','torso',seg=8,rings=6)
# Navel and minor sores sit against the swollen belly surface.
ell('navel',(.489,-.072,.744),(.011,.021,.017),'blood','torso')
# Reference trouser tear exposes skin through an actual garment opening.
carve([bpy.data.objects['trouser_thighR']],(.099,-.249,.453),(.088,.061,.055))
ell('exposed_thigh_tear',(.046,-.249,.453),(.025,.052,.043),'infectedSkin','legR',seg=12,rings=8)
for j in range(3):
    patch('thigh_rag'+str(j),[(.119,-.294+j*.032,.484),(.123,-.268+j*.032,.479),(.116,-.28+j*.032,.453-j*.004)],'asphalt','legR',.012)
# Project raised blood splashes onto actual skin/cloth surfaces, >= 4mm clearance.
def stain(name,y,z,ry,rz,parent,front=True):
    targets=[o for o in objects if o.parent==parts[parent] and not any(k in o.name for k in ['blood','sore','pustule','eye','mouth','nail','tooth'])]
    startx=1.1 if front else -1.1;direction=Vector((-1,0,0) if front else (1,0,0));v=[]
    # Each radial sample conforms to the curved surface, including the center.
    N=16;outline=[rng.uniform(.68,1.12) for i in range(N)]
    samples=[(y,z)]+[(y+ry*math.cos(i*2*math.pi/N)*outline[i]*r,z+rz*math.sin(i*2*math.pi/N)*outline[i]*r) for r in [.45,1] for i in range(N)]
    for yy,zz in samples:
        start=Vector((startx,yy,zz));hits=[]
        for target in targets:
            inv=target.matrix_world.inverted();hit,loc,n,idx=target.ray_cast(inv@start,inv.to_3x3()@direction)
            if hit:hits.append(target.matrix_world@loc)
        if not hits:return
        loc=min(hits,key=lambda p:(p-start).length);v.append((loc.x+(.0045 if front else -.0045),yy,zz))
    faces=[(0,1+i,1+(i+1)%N) for i in range(N)]
    faces += [(1+i,1+N+i,1+N+(i+1)%N,1+(i+1)%N) for i in range(N)]
    o=mesh(name,v,faces,'blood',parent,0)
    mod=o.modifiers.new('raised stain','SOLIDIFY');mod.thickness=.003;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for j,(y,z,ry,rz) in enumerate([(-.20,.73,.065,.071),(-.11,1.02,.042,.023),(.01,1.14,.042,.078),(-.21,1.19,.047,.025),(.21,1.24,.075,.027),(.14,.66,.055,.046),(-.30,.9,.025,.067),(.06,.81,.024,.038),(-.09,1.62,.03,.023),(.06,1.57,.014,.037)]):
    stain('blood_splash'+str(j),y,z,ry,rz,'head' if z>1.3 else 'torso')
for side,s in [('L',1),('R',-1)]:
    for j,(par,y,z,ry,rz) in enumerate([('arm',.43,1.073,.042,.054),('foreArm',.53,.88,.048,.056),('hand',.568,.752,.06,.048),('leg',.22,.46,.077,.071),('shin',.29,.21,.041,.04),('foot',.3,.083,.055,.04)]):
        stain('limb_blood'+side+str(j),s*y,z,ry,rz,par+side)
    for j in range(4):stain('back_blood'+side+str(j),s*(.08+j*.065),.78+j*.12,.04,.05,'torso',False)
    stain('pocket_blood'+side,s*.2,.53,.039,.06,'leg'+side,False)
# Fine scattered infection nodules and blood specks, deterministic and surface-placed.
for j in range(20):
    y=rng.uniform(-.29,.29);z=rng.uniform(.72,1.13)
    x=.10+.405*math.sqrt(max(.03,1-(y/.395)**2-((z-.86)/.405)**2))
    ell('infection_nodule'+str(j),(x+.002,y,z),(.009,.012,.012),'blood' if j%3 else 'infectedSkin','torso',seg=8,rings=6)
tube('chin_blood',[(.311,-.034,1.25),(.288,-.039,1.216),(.239,-.036,1.19)],[.017,.012,.004],'blood','head',N=8)
# Required detachable part caps stay on the proximal node after dismemberment.
caps=[]
for key,parent,size in [('head','torso',(.11,.12,.018)),('armL','torso',(.12,.024,.12)),('armR','torso',(.12,.024,.12)),('foreArmL','armL',(.105,.027,.105)),('foreArmR','armR',(.105,.027,.105)),('legL','hip',(.14,.14,.025)),('legR','hip',(.14,.14,.025))]:
    cap=ell('stump_'+key,parts[key].matrix_world.translation,size,'blood',parent,seg=12,rings=8)
    cap['stumpFor']=key;cap['hidden']=True;cap.scale=(0,0,0);caps.append(cap)
# Applied subdivision is lightly reduced on small details to keep the hero budget.
for o in objects:
    if o not in caps and len(o.data.polygons)>40 and not any(k in o.name for k in ['blood_splash','limb_blood','back_blood','pocket_blood']):
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game-ready density','DECIMATE');mod.ratio=.26
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if any(m is None for m in o.data.materials):
        fallback=next(m for m in o.data.materials if m)
        for i,m in enumerate(o.data.materials):
            if m is None:o.data.materials[i]=fallback
# Triangulate once and merge decorations by rigid parent, preserving every pivot/cap.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[f for f in bm.faces if f.calc_area()<1e-9]
    if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(o.data);bm.free();o.data.update()
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault(o.parent.name,[]).append(o)
joined=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__surface';joined.append(o)
objects=joined+caps
head_surface=next(o for o in joined if o.parent==parts['head'])
pivot=parts['head'].matrix_world.translation.copy()
for v in head_surface.data.vertices:
    world=head_surface.matrix_world@v.co
    delta=world-pivot;delta.x*=1.12;delta.y*=1.12;delta.z*=1.06
    v.co=head_surface.matrix_world.inverted()@(pivot+delta)
# Bare soles contact z=0 exactly, after the applied smoothing/reduction.
bpy.context.view_layer.update()
for side in ['L','R']:
    foot=parts['foot'+side]
    surfaces=[o for o in joined if o.parent==foot]
    floor=min((o.matrix_world@v.co).z for o in surfaces for v in o.data.vertices)
    foot.location.z-=floor
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.65;parts['legR'].rotation_euler.y=-.25
    # Detach left upper arm in test, keep it visible to demonstrate elbow articulation.
    parts['armL'].location.y+=.24
    bpy.data.objects['stump_armL'].scale=(1,1,1)
    bpy.data.objects['stump_armL']['hidden']=False
def contact_sheet(paths,destination,crop_width):
    import numpy as np
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path),check_existing=False);w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-crop_width)//2:(w+crop_width)//2,:])
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('contact sheet',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(destination);sheet.file_format='PNG';sheet.save()
if a.render and a.view=='turnaround':
    folder=Path(a.render).parent
    contact_sheet([folder/n for n in ['front.png','side.png','back.png','review-hero.png']],a.render,420)
    print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.35),'side':(0,-6,1.35),'back':(-6,0,1.35),'pose':(6,4,2.9)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.08,0,.86))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.08*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    def render_view(view,path,width=960,height=540,samples=24):
        cam.location=views[view];cam.rotation_euler=(Vector((.08,0,.86))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=2.08*width/height
        S.render.resolution_x=width;S.render.resolution_y=height;S.cycles.samples=samples
        S.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    if a.view in ['review-all','final-all']:
        folder=Path(a.render).parent;folder.mkdir(parents=True,exist_ok=True)
        for view in ['front','side','back','hero']:
            render_view(view,folder/('review-hero.png' if view=='hero' else view+'.png'))
        contact_sheet([folder/n for n in ['front.png','side.png','back.png','review-hero.png']],folder/'turnaround.png',420)
        if a.view=='final-all':
            render_view('hero',folder/'hero.png',1600,900,96)
            parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.65;parts['legR'].rotation_euler.y=-.25
            render_view('pose',folder/'pose-articulated.png')
            for o in objects:
                p=o.parent
                while p:
                    if p==parts['armL']:o.hide_render=True;break
                    p=p.parent
            bpy.data.objects['stump_armL'].scale=(1,1,1)
            render_view('pose',folder/'pose-stump.png')
            contact_sheet([folder/n for n in ['pose-articulated.png','pose-stump.png']],folder/'pose-test.png',600)
    else:render_view(a.view if a.view in views else 'hero',a.render,a.width,a.height,a.samples)
    print('OK rendered',a.view,triangles,len(objects))
print('OK',triangles,'triangles',len(objects),'meshes')
