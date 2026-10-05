"""Brother: deterministic, texture-free rigid-part hero. Build via blender_run.py."""
import argparse, math, sys, json
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
S=bpy.context.scene; parts={}; objects=[]
def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('skinWarm','f3b18b',.65),('skinBlush','e89477',.72),('picketWhite','f2e6dc',.8),('asphalt','5b4f5c',.85),('uiDark','25222c',.8),('survivorRed','d9363e',.72),('redShadow','a92734',.8),('backpackBlue','365576',.8),('blueTrim','273d58',.8),('schoolBusYellow','f2b630',.55),('hairBrown','543026',.8),('hairLight','74432b',.8),('eyeBrown','582b20',.24)]}
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
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
    # Support loops retain broad cloth ends rather than pinching at joints.
    if n.startswith(('upper_sleeve','lower_sleeve','shorts_leg','sock','bare_knee','ribbed_cuff')):
        p=list(map(Vector,points));points=[p[0],p[0].lerp(p[1],.12)]+p[1:-1]+[p[-1].lerp(p[-2],.12),p[-1]]
        radii=[radii[0],radii[0]]+radii[1:-1]+[radii[-1],radii[-1]]
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
# Joint hierarchy, positions authored in world space and preserved on parenting.
node('root',(0,0,0));node('hip',(0,0,.57),'root');node('torso',(0,0,.69),'hip');node('head',(0,0,1.01),'torso')
parts['root']['assetId']='npc.brother';parts['root']['protectedNPC']=True
node('backpackSocket',(-.16,0,.91),'torso')
ell('shorts_pelvis',(0,0,.57),(.126,.17,.092),'asphalt','hip')
ell('undershirt',(.013,0,.779),(.136,.171,.208),'picketWhite','torso')
ell('neck',(0,0,1.012),(.06,.065,.075),'skinWarm','head')
# Open jacket shell with separate hems, hood, and pocket panels.
v=[];f=[];N=24
for z,rx,ry in [(.576,.139,.172),(.59,.147,.181),(.7,.147,.183),(.875,.132,.188),(.958,.107,.157),(.973,.09,.139)]:
    for i in range(N):
        t=.40+(2*math.pi-.80)*i/(N-1);v.append((rx*math.cos(t),ry*math.sin(t),z))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('hoodie_shell',v,f,'survivorRed','torso',2)
mod=o.modifiers.new('cloth shell','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Folded hood forms a thick draped collar behind the neck.
ell('hood_back',(-.101,0,.973),(.101,.18,.086),'survivorRed','torso')
tube('hood_rim',[(.08,-.103,.985),(-.032,-.164,1.011),(-.147,-.115,1.022),(-.169,0,1.034),(-.147,.115,1.022),(-.032,.164,1.011),(.08,.103,.985)],[.026,.029,.03,.033,.03,.029,.026],'redShadow','torso',N=10)
for s in [-1,1]:
    tube('zipper_tape'+str(s),[(.143,s*.056,.578),(.159,s*.048,.717),(.154,s*.052,.869),(.106,s*.083,.974)],[.008]*4,'schoolBusYellow','torso',N=6,sub=0)
    box('front_pocket'+str(s),(.138,s*.111,.674),(.029,.097,.091),'survivorRed','torso',.022,rot=(s*.12,0,s*.09))
    tube('pocket_opening'+str(s),[(.156,s*.065,.695),(.161,s*.092,.737),(.139,s*.151,.729)],[.005]*3,'redShadow','torso',N=6)
    tube('hood_string'+str(s),[(.133,s*.087,.951),(.168,s*.07,.875),(.17,s*.072,.835)],[.0045]*3,'picketWhite','torso',N=8)
    ell('drawcord_tip'+str(s),(.17,s*.072,.826),(.007,.007,.012),'picketWhite','torso',seg=8,rings=6)
    tube('jacket_hem'+str(s),[(.144,s*.063,.586),(.139,s*.136,.577),(.031,s*.18,.58),(-.12,s*.112,.583)],[.016]*4,'redShadow','torso',N=8)
for i in range(24):
    z=.604+i*.014
    for s in [-1,1]:box('zip_tooth',(.162,s*.048,z),(.009,.006,.006),'picketWhite','torso',.002)
box('zip_pull',(.164,.047,.871),(.017,.016,.038),'schoolBusYellow','torso',.005)
# Relaxed sleeves, soft palms with four individual fingers and thumbs.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(0,s*.17,.926);elbow=(.004,s*.237,.774);wrist=(.013,s*.267,.635)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    tube('upper_sleeve'+side,[shoulder,(0,s*.196,.887),elbow],[.078,.085,.072],'survivorRed','arm'+side,N=12)
    ell('elbow_fold'+side,elbow,(.074,.077,.076),'survivorRed','foreArm'+side)
    tube('lower_sleeve'+side,[elbow,(.009,s*.26,.701),wrist],[.076,.09,.055],'survivorRed','foreArm'+side,N=12)
    tube('ribbed_cuff'+side,[(.013,s*.268,.66),wrist],[.059,.054],'redShadow','foreArm'+side,N=12)
    for j in range(4):
        tube('sleeve_fold'+side+str(j),[(.062,s*.231,.779-j*.033),(.077,s*.253,.765-j*.033),(.06,s*.283,.775-j*.033)],[.003,.01,.003],'survivorRed','foreArm'+side,N=8)
    ell('palm'+side,(.017,s*.274,.592),(.045,.052,.063),'skinWarm','hand'+side)
    for i in range(4):
        yy=s*(.24+i*.023);zz=.565+(abs(i-1.5)*.008)
        tube('finger'+side+str(i),[(.03,yy,zz),(.04,yy,zz-.027),(.055,yy-s*.003,zz-.043)],[.015,.014,.009],'skinWarm','hand'+side,N=8)
    tube('thumb'+side,[(.046,s*.236,.615),(.068,s*.227,.592),(.066,s*.23,.573)],[.02,.017,.012],'skinWarm','hand'+side,N=8)
    node('weaponSocket'+side,(.064,s*.271,.574),'hand'+side)
    hip=(0,s*.094,.565);knee=(.003,s*.104,.347);ankle=(0,s*.119,.15)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('shorts_leg'+side,[hip,(0,s*.098,.481),(.001,s*.105,.373)],[.091,.099,.092],'asphalt','leg'+side,N=12)
    tube('shorts_cuff'+side,[(0,s*.105,.388),(0,s*.106,.363)],[.099,.098],'asphalt','leg'+side,N=12)
    box('cargo_pocket'+side,(.008,s*.193,.436),(.111,.029,.09),'asphalt','leg'+side,.015)
    box('cargo_flap'+side,(.008,s*.209,.47),(.117,.016,.035),'asphalt','leg'+side,.008)
    ell('cargo_button'+side,(.026,s*.221,.468),(.009,.004,.008),'uiDark','leg'+side,seg=8,rings=6)
    tube('bare_knee'+side,[(.001,s*.106,.385),(.001,s*.111,.323),(0,s*.116,.264)],[.065,.061,.056],'skinWarm','shin'+side,N=12)
    tube('sock'+side,[(0,s*.116,.282),(0,s*.12,.199),ankle],[.057,.053,.047],'picketWhite','shin'+side,N=12)
    for z,m in [(.278,'picketWhite'),(.263,'blueTrim'),(.247,'survivorRed'),(.233,'blueTrim')]:
        tube('sock_stripe'+side+str(z),[(0,s*.118,z+.006),(0,s*.118,z-.006)],[.058,.058],m,'shin'+side,N=12)
    box('sole'+side,(.05,s*.122,.029),(.239,.157,.058),'picketWhite','foot'+side,.019)
    box('sole_band'+side,(.05,s*.122,.059),(.232,.151,.009),'picketWhite','foot'+side,.008)
    ell('sneaker'+side,(.045,s*.122,.094),(.116,.077,.064),'survivorRed','foot'+side)
    ell('toe_cap'+side,(.12,s*.122,.078),(.063,.074,.04),'picketWhite','foot'+side)
    box('heel_tab'+side,(-.044,s*.122,.127),(.025,.075,.052),'blueTrim','foot'+side,.009)
    ell('shoe_tongue'+side,(.013,s*.122,.151),(.045,.046,.035),'survivorRed','foot'+side)
    for j in range(4):
        x=.004+j*.023;z=.194-j*.011
        tube('lace'+side+str(j),[(x-.006,s*.084,z-.01),(x,s*.122,z),(x+.01,s*.16,z-.014)],[.0045]*3,'picketWhite','foot'+side,N=6)
        for sign in [-1,1]:ell('eyelet',(x,s*.122+sign*.04,z-.013),(.006,.006,.004),'picketWhite','foot'+side,seg=8,rings=6)
    ell('shoe_side_badge'+side,(.059,s*.196,.096),(.023,.005,.026),'picketWhite','foot'+side)
    ell('shoe_badge_inset'+side,(.059,s*.202,.096),(.014,.004,.017),'asphalt','foot'+side)
# Friendly sculpted face; eyes are nested shells, raised brows and catchlights.
ell('face',(0,0,1.157),(.176,.205,.182),'skinWarm','head',seg=24,rings=16)
# The continuous face ellipsoid provides the jaw and cheeks.
for s in [-1,1]:
    ell('ear'+str(s),(-.008,s*.18,1.136),(.046,.036,.065),'skinWarm','head')
    ell('ear_inner'+str(s),(.025,s*.193,1.139),(.011,.018,.033),'skinBlush','head')
    ell('eye_outline'+str(s),(.151,s*.083,1.187),(.01,.049,.061),'hairBrown','head',seg=16,rings=12)
    ell('eye_white'+str(s),(.16,s*.083,1.188),(.009,.043,.054),'picketWhite','head',seg=20,rings=12)
    ell('iris'+str(s),(.168,s*.078,1.186),(.006,.026,.041),'eyeBrown','head',seg=16,rings=12)
    ell('pupil'+str(s),(.173,s*.077,1.188),(.004,.017,.028),'uiDark','head',seg=16,rings=10)
    ell('catchlight'+str(s),(.178,s*.069,1.207),(.005,.008,.011),'picketWhite','head',seg=8,rings=6)
    ell('small_glint'+str(s),(.178,s*.087,1.173),(.003,.004,.005),'picketWhite','head',seg=8,rings=6)
    tube('brow'+str(s),[(.17,s*.028,1.236),(.17,s*.068,1.245),(.146,s*.116,1.234)],[.009,.011,.006],'hairBrown','head',N=10)
    # Cheeks are part of the broad face volume, without separate ball shapes.
ell('nose',(.178,0,1.133),(.021,.026,.021),'skinWarm','head')
for s in [-1,1]:ell('nostril'+str(s),(.195,s*.013,1.122),(.004,.006,.004),'skinBlush','head',seg=8,rings=6)
tube('smile',[(.155,-.061,1.097),(.163,-.033,1.083),(.164,0,1.079),(.163,.033,1.083),(.155,.061,1.097)],[.003]*5,'hairBrown','head',N=8)
# Layered swept hair volumes instead of flat cards.
ell('hair_base',(-.042,0,1.239),(.158,.183,.125),'hairBrown','head',seg=20,rings=12)
def lock(n,start,bend,tip,width):
    p0,p1,p2=map(Vector,[start,bend,tip]);tube(n,[p0,p0.lerp(p1,.6),p1,p1.lerp(p2,.72),p2],[.009,(width*.85,width*.5),(width,width*.55),(width*.4,width*.28),.002],'hairBrown','head',N=8)
for j in range(7):
    y=-.139+j*.044
    lock('fringe'+str(j),(.035,y+.015,1.293),(.132,y,1.272),(.16,y-.039,1.245+(j%3)*.008),.045)
for layer in range(2):
    for j in range(11):
        t=.65+j*(2*math.pi-1.3)/10;x=-.032+.136*math.cos(t);y=.167*math.sin(t);z=1.106+layer*.104
        lock('side_hair'+str(layer)+'_'+str(j),(x*.8,y*.86,z+.055),(x-.016,y,z+.03),(x+.065*math.cos(t),y+.04*math.sin(t),z-.032),.045+(j%3)*.006)
# Keep swept hair below the hat lip; no locks break through the cream panel.
for o in objects:
    if o.name.startswith(('fringe','side_hair')):
        for vertex in o.data.vertices:
            if vertex.co.x>.07 and vertex.co.z>1.277:vertex.co.z=1.277
# Cap crown hemispherical panels with a cream front. Closed thickness along brim.
v=[];f=[];N=48;rows=9
for j in range(rows):
    t=(j+.15)/(rows-1+.15)*math.pi/2
    for i in range(N):
        ang=2*math.pi*i/N;v.append((-.026+.19*math.sin(t)*math.cos(ang),.193*math.sin(t)*math.sin(ang),1.286+.126*math.cos(t)))
for j in range(rows-1):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
mesh('cap_crown',v,f,'survivorRed','head',1)
# Smooth cream crown panel follows the curved cap with 4 mm clearance.
v=[];f=[];C=16;R=10
for j in range(R):
    t=.30+j*(1.25/(R-1))
    for i in range(C):
        ang=-.67+i*1.34/(C-1);v.append((-.026+.194*math.sin(t)*math.cos(ang),.197*math.sin(t)*math.sin(ang),1.286+.13*math.cos(t)))
for j in range(R-1):
    for i in range(C-1):f.append((j*C+i,j*C+i+1,(j+1)*C+i+1,(j+1)*C+i))
mesh('cap_cream_panel',v,f,'picketWhite','head',1)
# Curved, extruded oval brim.
ell('cap_brim',(.15,0,1.28),(.177,.194,.019),'survivorRed','head',rot=(0,-.1,0),seg=24,rings=10)
ell('brim_underside',(.147,0,1.271),(.17,.184,.009),'blueTrim','head',rot=(0,-.1,0),seg=24,rings=8)
ell('cap_button',(-.026,0,1.416),(.015,.016,.011),'survivorRed','head')
for ang in [0,math.pi/3,-math.pi/3,math.pi,2*math.pi/3,-2*math.pi/3]:
    pts=[]
    for j in range(9):
        t=.1+j*.18;pts.append((-.026+.193*math.sin(t)*math.cos(ang),.196*math.sin(t)*math.sin(ang),1.286+.129*math.cos(t)))
    tube('cap_seam',pts,[.002]*len(pts),'redShadow','head',N=6,sub=0)
box('back_adjuster',(-.218,0,1.286),(.012,.095,.02),'blueTrim','head',.005)
for y in [-.033,-.011,.011,.033]:ell('adjuster_hole',(-.227,y,1.286),(.003,.003,.003),'asphalt','head',seg=8,rings=6)
def star(n,x,y,z,r,m,par,depth=.01):
    pts=[]
    for i in range(10):
        t=math.pi/2+i*math.pi/5;rr=r if i%2==0 else r*.46
        yy=y+rr*math.cos(t);zz=z+rr*math.sin(t);xx=x
        if n.startswith('cap_'):
            radial=.194*math.sqrt(max(0,1-((zz-1.286)/.13)**2))
            xx=-.026+math.sqrt(max(0,radial*radial-yy*yy))+(.014 if n=='cap_star' else .008)
        pts.append((xx,yy,zz))
    return patch(n,pts,m,par,depth)
star('cap_emblem',.166,0,1.346,.038,'survivorRed','head')
star('cap_star',.179,0,1.346,.022,'schoolBusYellow','head',.004)
# Blue backpack, thick straps, inset pockets and raised badge details.
box('backpack',(-.203,0,.784),(.147,.29,.308),'backpackBlue','torso',.06)
box('pack_front',(-.289,0,.792),(.029,.255,.248),'blueTrim','torso',.04)
box('pack_pocket',(-.313,0,.758),(.034,.227,.171),'backpackBlue','torso',.03)
# Negative-X-facing star badge is extruded toward viewer.
star('pack_star',-.336,0,.827,.058,'schoolBusYellow','torso',-.009)
ell('star_center',(-.349,0,.827),(.006,.01,.012),'hairLight','torso')
for s in [-1,1]:
    tube('shoulder_strap'+str(s),[(-.16,s*.108,.927),(-.074,s*.169,.965),(.062,s*.166,.937),(.135,s*.155,.863),(.151,s*.143,.761),(.103,s*.156,.641),(-.169,s*.11,.65)],[.022,.023,.025,.025,.024,.02,.017],'blueTrim','torso',N=10)
    box('strap_buckle'+str(s),(.153,s*.154,.844),(.018,.037,.043),'uiDark','torso',.006)
    box('buckle_inset'+str(s),(.164,s*.154,.844),(.007,.023,.026),'asphalt','torso',.003)
    ell('round_patch'+str(s),(-.341,s*.073,.701),(.008,.026,.027),'schoolBusYellow','torso',seg=16,rings=10)
    tube('patch_symbol'+str(s),[(-.35,s*.083,.705),(-.351,s*.073,.715),(-.351,s*.062,.701),(-.351,s*.076,.69)],[.003]*4,'hairLight','torso',N=6)
    box('pack_side_pocket'+str(s),(-.217,s*.157,.745),(.091,.025,.124),'backpackBlue','torso',.017)
    box('pack_side_tab'+str(s),(-.245,s*.18,.778),(.031,.013,.042),'blueTrim','torso',.005)
    box('pack_zip_pull'+str(s),(-.337,s*.083,.735),(.013,.009,.026),'schoolBusYellow','torso',.003)
tube('pack_handle',[(-.183,-.051,.943),(-.197,-.048,.97),(-.207,.047,.97),(-.183,.054,.943)],[.012]*4,'blueTrim','torso',N=8)
# Merge decoration meshes within each rigid node, preserving required joints.
for o in objects:
    if len(o.data.polygons)>100:
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('efficient game surface','DECIMATE');mod.ratio=.46;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
buckets={}
for o in objects:buckets.setdefault(o.parent.name,[]).append(o)
joined=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=group[0];o.name=parent+'__mesh';joined.append(o)
objects=joined
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.65;parts['foreArmL'].rotation_euler.y=-.8;parts['legR'].rotation_euler.y=-.4
def compose_turnaround(path):
    """Join the four centered review panels without another render."""
    import numpy as np
    panels=[]
    for name in ['front.png','side.png','back.png','review-hero.png']:
        im=bpy.data.images.load(str(P/'renders'/name));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()
if a.render and a.view=='turnaround':
    compose_turnaround(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,4.4),'front':(6,0,.85),'side':(0,-6,.85),'back':(-6,0,.85)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.72*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['all','deliver']:
        for name in ['front','side','back','hero']:
            cam.location=views[name];cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if name=='hero' else name+'.png'))
            bpy.ops.render.render(write_still=True)
        if a.view=='deliver':
            parts['armL'].rotation_euler.x=.65;parts['foreArmL'].rotation_euler.y=-.8;parts['legR'].rotation_euler.y=-.4
            S.render.filepath=str(P/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
            for n in ['armL','foreArmL','legR']:parts[n].rotation_euler=(0,0,0)
            S.render.resolution_x=1600;S.render.resolution_y=900;S.cycles.samples=96
            S.render.filepath=str(P/'renders'/'hero.png');bpy.ops.render.render(write_still=True)
            compose_turnaround(P/'renders'/'turnaround.png')
    else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
