"""Civilian man B, deterministic palette-only rigid-part hero. +X forward, +Z up.
All sculpt subdivision is applied before export. Run only via blender_run.py.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render');ap.add_argument('--glb');ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540);ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[]
def mat(token,h,rough=.7):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
 b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough;m.diffuse_color=c;return m
M={k:mat(k,h,r) for k,h,r in [('skinWarm','efa47d',.65),('skinBlush','d77b63',.7),('woodWarm','57301f',.8),('schoolBusYellow','e9a137',.8),('hoodieShade','ce8b27',.85),('denimBlue','354f78',.85),('denimLight','50698b',.85),('capNavy','323d5e',.8),('picketWhite','f2e6dc',.65),('uiDark','25222c',.6),('backpackTeal','2f6e6a',.8),('sidewalk','b9a4a0',.65)]}
def node(n,p,par=None):
 o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
 if par:
  bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
 parts[n]=o;return o
node('root',(0,0,0));node('hip',(0,0,.59),'root');node('torso',(0,0,.72),'hip');node('head',(0,0,1.035),'torso');node('backpackSocket',(-.135,0,.91),'torso')
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
    # Close-to-end support loops prevent subdivision shrinking rigid joint seams.
    if sub and len(points)>1:
        points=[points[0],Vector(points[0]).lerp(Vector(points[1]),.045)]+list(points[1:-1])+[Vector(points[-2]).lerp(Vector(points[-1]),.955),points[-1]]
        radii=[radii[0],radii[0]]+list(radii[1:-1])+[radii[-1],radii[-1]]
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
# Garment body: shaped radial rings make a smooth cloth shell with a broad hem.
def rings(n,levels,m,par,N=24,sub=2):
 v=[];f=[]
 for z,rx,ry,cx in levels:
  for i in range(N):
   t=2*math.pi*i/N;v.append((cx+rx*math.cos(t),ry*math.sin(t),z))
 for j in range(len(levels)-1):
  for i in range(N):k=j*N+i;q=j*N+(i+1)%N;f.append((k,q,q+N,k+N))
 f.extend([tuple(range(N-1,-1,-1)),tuple((len(levels)-1)*N+i for i in range(N))])
 return mesh(n,v,f,m,par,sub)
ell('jeans_hip',(0,0,.602),(.123,.172,.088),'denimBlue','hip')
rings('tee_hem',[(.595,.131,.169,0),(.604,.137,.174,0),(.622,.137,.174,0),(.627,.13,.166,0)],'picketWhite','torso',sub=1)
rings('hoodie',[(.622,.13,.175,0),(.65,.145,.182,0),(.73,.151,.19,0),(.88,.135,.19,-.012),(.97,.102,.145,-.006),(.997,.085,.11,0)],'schoolBusYellow','torso')
rings('ribbed_hem',[(.62,.129,.171,0),(.624,.137,.179,0),(.647,.14,.181,0),(.652,.132,.173,0)],'hoodieShade','torso',sub=1)
ell('neck',(0,0,1.031),(.059,.069,.069),'skinWarm','head')
ell('hood_back',(-.098,0,.967),(.089,.146,.097),'schoolBusYellow','torso',seg=16,rings=10)
# Hood opening rolls around the neck, with distinct inner lining and outer lip.
pts=[(.108*math.cos(t),.128*math.sin(t),1.005-.035*math.cos(t)) for t in [i*2*math.pi/32 for i in range(33)]]
tube('hood_inner',pts,[.03]*33,'hoodieShade','torso',N=10)
tube('hood_roll',[(x,y,z+.013) for x,y,z in pts],[.027]*33,'schoolBusYellow','torso',N=10)
tube('hood_back_seam',[(-.182,0,.946),(-.179,0,.98),(-.14,0,1.026)],[.003]*3,'hoodieShade','torso',N=6,sub=0)
patch('tee_neckline',[(.094,-.056,1.015),(.119,-.034,.98),(.126,0,.967),(.119,.034,.98),(.094,.056,1.015)],'picketWhite','torso',.008)
# Kangaroo pocket is a thick shaped shell, divided by the center seam.
patch('kangaroo_pocket',[(.149,-.13,.654),(.165,-.146,.69),(.161,-.095,.758),(.165,.095,.758),(.165,.146,.69),(.149,.13,.654)],'schoolBusYellow','torso',.013)
for sign in [-1,1]:
 tube('pocket_opening'+str(sign),[(.174,sign*.095,.758),(.177,sign*.114,.726),(.177,sign*.144,.694)],[.004]*3,'hoodieShade','torso',N=6)
 tube('drawcord'+str(sign),[(.121,sign*.061,.997),(.154,sign*.068,.94),(.158,sign*.07,.828)],[.005]*3,'picketWhite','torso',N=8)
 box('cord_tip'+str(sign),(.16,sign*.07,.818),(.012,.012,.024),'sidewalk','torso',.003)
 ell('cord_eyelet'+str(sign),(.125,sign*.061,.993),(.008,.01,.011),'sidewalk','torso',seg=8,rings=6)
 for j in range(12):
  y=sign*(.012+j*.012)
  tube('hem_rib'+str(sign)+str(j),[(.14*math.sqrt(max(.01,1-(y/.179)**2))+.004,y,.626),(.14*math.sqrt(max(.01,1-(y/.181)**2))+.004,y,.646)],[.0017]*2,'schoolBusYellow','torso',N=5,sub=0)
tube('pocket_center',[(.18,0,.655),(.179,0,.752)],[.002]*2,'hoodieShade','torso',N=6,sub=0)
box('zipper_track',(.153,0,.943),(.012,.013,.063),'hoodieShade','torso',.004)
box('zipper_pull',(.163,0,.918),(.012,.018,.024),'sidewalk','torso',.004)
box('chest_badge',(.141,-.111,.884),(.014,.018,.02),'backpackTeal','torso',.004)
# Relaxed arms, full sleeves, exposed forearms and four distinct fingers.
for sign,side in [(1,'L'),(-1,'R')]:
 shoulder=(-.012,sign*.173,.937);elbow=(.005,sign*.252,.798);wrist=(.025,sign*.279,.668)
 node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
 ell('shoulder_round'+side,(-.01,sign*.181,.927),(.08,.083,.082),'schoolBusYellow','arm'+side)
 tube('sleeve_upper'+side,[shoulder,(-.01,sign*.203,.906),(.002,sign*.234,.835),elbow],[.087,.087,.08,.077],'schoolBusYellow','arm'+side,N=12)
 tube('sleeve_lower'+side,[elbow,(.011,sign*.263,.759),(.017,sign*.27,.726)],[.079,.083,.058],'schoolBusYellow','foreArm'+side,N=12)
 tube('cuff'+side,[(.016,sign*.269,.738),(.019,sign*.274,.711)],[.062,.058],'hoodieShade','foreArm'+side,N=12)
 tube('forearm'+side,[(.018,sign*.274,.717),wrist],[.047,.037],'skinWarm','foreArm'+side,N=12)
 for j in range(3):
  z=.799+j*.032
  tube('sleeve_fold'+side+str(j),[(.055,sign*.227,z+.005),(.072,sign*.25,z),(.035,sign*.291,z-.01)],[.004,.01,.003],'schoolBusYellow','foreArm'+side if j==0 else 'arm'+side,N=8)
 ell('palm'+side,(.025,sign*.286,.635),(.043,.045,.052),'skinWarm','hand'+side)
 for j in range(4):
  y=sign*(.255+j*.021);z=.617-(.007 if j in [1,2] else 0)
  tube('finger'+side+str(j),[(.036,y,z),(.048,y,z-.034),(.062,y,z-.048)],[.013,.012,.008],'skinWarm','hand'+side,N=8)
 tube('thumb'+side,[(.051,sign*.247,.652),(.076,sign*.24,.629),(.077,sign*.245,.614)],[.018,.016,.011],'skinWarm','hand'+side,N=8)
 node('weaponSocket'+side,(.053,sign*.28,.614),'hand'+side)
 hip=(0,sign*.094,.603);knee=(.001,sign*.113,.37);ankle=(0,sign*.127,.135)
 node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
 tube('jeans_thigh'+side,[hip,(0,sign*.103,.555),(.005,sign*.11,.443),knee],[.088,.098,.084,.079],'denimBlue','leg'+side,N=12)
 tube('jeans_calf'+side,[knee,(.005,sign*.122,.312),(0,sign*.127,.206),ankle],[.079,.084,.079,.066],'denimBlue','shin'+side,N=12)
 tube('rolled_jeans'+side,[(0,sign*.127,.151),(0,sign*.127,.176)],[.078,.078],'denimLight','shin'+side,N=12)
 for j,z in enumerate([.46,.367,.26,.198]):
  tube('denim_fold'+side+str(j),[(.059,sign*.064,z+.015),(.085,sign*.12,z),(.055,sign*.184,z-.008)],[.004,.009,.003],'denimLight','leg'+side if j==0 else 'shin'+side,N=8)
 tube('outer_denim_seam'+side,[(-.016,sign*.19,.537),(-.013,sign*.192,.44),(-.01,sign*.197,.374)],[.002]*3,'hoodieShade','leg'+side,N=6,sub=0)
 tube('calf_denim_seam'+side,[(-.01,sign*.197,.36),(-.01,sign*.207,.26),(-.01,sign*.196,.181)],[.002]*3,'hoodieShade','shin'+side,N=6,sub=0)
 patch('back_jeans_pocket'+side,[(-.092,sign*.04,.581),(-.084,sign*.137,.58),(-.085,sign*.135,.533),(-.093,sign*.09,.513),(-.093,sign*.04,.533)],'denimLight','hip')
 # Layered trainer sole, toe bumper, navy body, teal side panels and orange heel collars.
 box('sole'+side,(.044,sign*.132,.028),(.235,.147,.056),'picketWhite','foot'+side,.018)
 ell('shoe_body'+side,(.032,sign*.132,.073),(.12,.072,.063),'capNavy','foot'+side,seg=16,rings=10)
 ell('toe_cap'+side,(.117,sign*.132,.061),(.049,.068,.039),'picketWhite','foot'+side,seg=12,rings=8)
 box('toe_bumper'+side,(.154,sign*.132,.034),(.029,.119,.035),'picketWhite','foot'+side,.011)
 ell('ankle_collar'+side,(-.024,sign*.132,.122),(.052,.065,.028),'schoolBusYellow','foot'+side)
 ell('tongue'+side,(.018,sign*.132,.133),(.052,.045,.024),'picketWhite','foot'+side)
 for j in range(3):
  box('shoe_panel'+side+str(j),(.024+j*.027,sign*.199,.078),(.023,.009,.041),'backpackTeal','foot'+side,.006,rot=(0,-.35,0))
 for j in range(4):
  x=.015+j*.025;z=.166-j*.012
  tube('lace'+side+str(j),[(x,sign*.095,z-.009),(x+.009,sign*.132,z),(x-.004,sign*.169,z-.009)],[.0035]*3,'picketWhite','foot'+side,N=6)
 for j in range(5):
  box('sole_groove'+side+str(j),(-.039+j*.038,sign*.204,.024),(.006,.005,.017),'hoodieShade','foot'+side,.002)
ell('beard_jaw',(.039,0,1.106),(.101,.109,.061),'woodWarm','head',seg=16,rings=10)
# Large warm face and volume hair, with a shaped beard and broad friendly smile.
ell('skull',(0,0,1.202),(.135,.137,.167),'skinWarm','head',seg=20,rings=14)
ell('chin',(.048,0,1.106),(.087,.104,.063),'skinWarm','head',seg=16,rings=10)
for sign in [-1,1]:
 ell('ear'+str(sign),(-.002,sign*.139,1.186),(.039,.027,.047),'skinWarm','head')
 ell('ear_inner'+str(sign),(.021,sign*.15,1.188),(.016,.01,.028),'skinBlush','head')
 ell('cheek'+str(sign),(.101,sign*.078,1.161),(.027,.045,.034),'skinWarm','head')
 ell('eye_rim'+str(sign),(.11,sign*.057,1.238),(.023,.04,.048),'woodWarm','head')
 ell('eye_white'+str(sign),(.123,sign*.057,1.239),(.021,.034,.041),'picketWhite','head',seg=16,rings=10)
 ell('iris'+str(sign),(.141,sign*.055,1.237),(.01,.021,.029),'woodWarm','head',seg=16,rings=10)
 ell('pupil'+str(sign),(.149,sign*.055,1.238),(.005,.012,.023),'uiDark','head')
 ell('eye_spark'+str(sign),(.154,sign*.048,1.25),(.003,.006,.008),'picketWhite','head')
 tube('brow'+str(sign),[(.116,sign*.025,1.293),(.128,sign*.052,1.304),(.101,sign*.087,1.295)],[.012,.016,.009],'woodWarm','head',N=10)
 ell('side_beard'+str(sign),(.062,sign*.094,1.124),(.046,.025,.046),'woodWarm','head')
ell('beard_chin',(.062,0,1.074),(.08,.087,.041),'woodWarm','head',seg=16,rings=10)
ell('smile_dark',(.133,0,1.122),(.023,.067,.033),'woodWarm','head',seg=16,rings=10)
tube('lower_lip',[(.139,-.046,1.107),(.156,0,1.097),(.139,.046,1.107)],[.007,.01,.007],'skinBlush','head',N=8)
tube('teeth_smile',[(.151,-.049,1.129),(.162,-.025,1.12),(.165,0,1.117),(.162,.025,1.12),(.151,.049,1.129)],[.008]*5,'picketWhite','head',N=8)
for sign in [-1,1]:
 tube('moustache'+str(sign),[(.157,0,1.153),(.155,sign*.028,1.153),(.133,sign*.057,1.138)],[.011,.013,.008],'woodWarm','head',N=10)
ell('nose_bridge',(.128,0,1.211),(.02,.024,.041),'skinWarm','head')
ell('nose_tip',(.162,0,1.191),(.031,.032,.022),'skinWarm','head')
# Brown tapered locks remain visible under cap around sides, fringe, and nape.
ell('hair_back',(-.055,0,1.233),(.101,.142,.102),'woodWarm','head',seg=16,rings=10)
for j in range(13):
 t=.9+j*(2*math.pi-1.8)/12;x=-.02+.1*math.cos(t);y=.13*math.sin(t)
 tube('nape_lock'+str(j),[(x*.8,y*.8,1.279),(x,y,1.229),(x-.015,y*.95,1.139+(j%3)*.012)],[.025,(.043,.028),.003],'woodWarm','head',N=8)
for j in range(5):
 y=-.09+j*.043
 tube('fringe'+str(j),[(.065,y+.014,1.300),(.105,y,1.277),(.118,y-.022,1.244+(j%2)*.016)],[.022,(.032,.018),.002],'woodWarm','head',N=8)
# Six-panel trucker cap, cream front and navy sides. Shaped hemisphere with seam cords.
N=48;v=[];f=[]
for j in range(9):
 t=(math.pi/2)*j/9
 for i in range(N):
  q=2*math.pi*i/N;v.append((-.014+.142*math.cos(t)*math.cos(q),.153*math.cos(t)*math.sin(q),1.306+.101*math.sin(t)))
v.append((-.014,0,1.408))
for j in range(8):
 for i in range(N):k=j*N+i;q=j*N+(i+1)%N;f.append((k,q,q+N,k+N))
for i in range(N):f.append((8*N+i,8*N+(i+1)%N,len(v)-1))
cap=mesh('cap_panels',v,f,'capNavy','head',0);cap.data.materials.append(M['picketWhite'])
for face in cap.data.polygons:
 if face.center.x>0 and abs(math.atan2(face.center.y/.153,(face.center.x+.014)/.142))<math.pi/3:face.material_index=1
bpy.context.view_layer.objects.active=cap
mod=cap.modifiers.new('smooth cap','SUBSURF');mod.levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
# Curved bill, thick enough to read from profile.
v=[];f=[]
for row in range(4):
 for i in range(17):
  q=-1.2+2.4*i/16;r=.135+row*.035
  v.append((-.014+r*math.cos(q),.15*math.sin(q)*(1+row*.07),1.309-.02*row/3-.014*math.cos(q)))
for row in range(3):
 for i in range(16):k=row*17+i;f.append((k,k+1,k+18,k+17))
bill=mesh('cap_bill',v,f,'capNavy','head',2);mod=bill.modifiers.new('bill thickness','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=bill;bpy.ops.object.modifier_apply(modifier=mod.name)
for i in range(6):
 q=i*math.pi/3;pts=[]
 for j in range(10):
  t=math.pi/2*j/10;pts.append((-.014+.145*math.cos(t)*math.cos(q),.156*math.cos(t)*math.sin(q),1.308+.102*math.sin(t)))
 tube('cap_seam'+str(i),pts,[.0018]*10,'denimLight','head',N=5,sub=0)
ell('cap_button',(-.014,0,1.407),(.013,.014,.008),'capNavy','head')
box('cap_patch',(.127,0,1.351),(.009,.064,.047),'capNavy','head',.004,rot=(0,-.27,0))
box('patch_sunset',(.136,0,1.35),(.005,.047,.028),'schoolBusYellow','head',.003,rot=(0,-.27,0))
patch('patch_mountain',[(.143,-.021,1.34),(.147,-.009,1.355),(.147,0,1.347),(.147,.008,1.355),(.143,.022,1.34)],'hoodieShade','head',.004)
box('snapback_strap',(-.156,0,1.306),(.012,.076,.019),'capNavy','head',.006)
for j in range(5):ell('snap_hole'+str(j),(-.164,-.026+j*.013,1.307),(.003,.003,.003),'uiDark','head',seg=8,rings=6)
# Raise the cap a little so its bill does not obscure the expression at game angle.
for o in objects:
    if o.name.startswith(('cap_','patch_','snap')):
        o.location.z+=.023
# Broader chibi head and reduced face protrusion produce a cohesive sculpted face.
for o in objects:
    if o.parent==parts['head']:
        for vertex in o.data.vertices:
            # Facial pieces are moved toward the skull; hair/cap keep their profile.
            if o.name.startswith(('eye_','iris','pupil','brow','cheek','smile','teeth','moustache','lower_lip')):
                vertex.co.x-=.018/o.scale.x
parts['head'].scale=(1.05,1.19,1.0)
bpy.context.view_layer.update()
head_world={o:o.matrix_world.copy() for o in objects if o.parent==parts['head']}
parts['head'].scale=(1,1,1)
bpy.context.view_layer.update()
for o,world in head_world.items():
    o.matrix_world=world;bpy.context.view_layer.objects.active=o
    o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
# Join decorative pieces per rigid joint and material to limit draw calls.
for o in objects:
 if len(o.data.polygons)>150:
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('game density','DECIMATE');mod.ratio=.64;bpy.ops.object.modifier_apply(modifier=mod.name)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
 tiny=[f for f in bm.faces if f.calc_area()<1e-9]
 if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
 bm.to_mesh(o.data);bm.free()
buckets={}
for o in objects:buckets.setdefault((o.parent.name,tuple(m.name for m in o.data.materials)),[]).append(o)
joined=[]
for (parent,materials),group in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]
 if len(group)>1:bpy.ops.object.join()
 group[0].name=parent+'__'+materials[0];joined.append(group[0])
objects=joined
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in parts]},indent=2))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects+list(parts.values()):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
 parts['armL'].rotation_euler.x=.55;parts['foreArmL'].rotation_euler.y=-.85;parts['legR'].rotation_euler.y=-.48
def turnaround(destination):
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['round3-front.png','round3-side.png','round3-back.png','round3.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(destination);sheet.file_format='PNG';sheet.save()
    print('OK turnaround')
if a.render and a.view=='turnaround':
    turnaround(a.render);sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,.75),'side':(0,-6,.75),'back':(-6,0,.75)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((.02,0,.70))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.68*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    render_views=['hero','front','side','back'] if a.view=='hero' and a.samples==24 and not a.pose else [a.view]
    for view in render_views:
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.02,0,.70))-cam.location).to_track_quat('-Z','Y').to_euler()
        ground.hide_render=view in ['front','side','back']
        S.render.filepath=a.render if view==a.view else str(Path(a.render).with_name(Path(a.render).stem+'-'+view+'.png'))
        bpy.ops.render.render(write_still=True)
    if a.view=='final':
        S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        for view in ['hero','front','side','back']:
            cam.location=views[view];cam.rotation_euler=(Vector((.02,0,.70))-cam.location).to_track_quat('-Z','Y').to_euler()
            ground.hide_render=view!='hero'
            S.render.filepath=str(P/'renders'/('round3.png' if view=='hero' else 'round3-'+view+'.png'));bpy.ops.render.render(write_still=True)
        cam.location=views['hero'];cam.rotation_euler=(Vector((.02,0,.70))-cam.location).to_track_quat('-Z','Y').to_euler();ground.hide_render=False
        parts['armL'].rotation_euler.x=.55;parts['foreArmL'].rotation_euler.y=-.85;parts['legR'].rotation_euler.y=-.48
        S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        S.render.filepath=str(P/'renders/pose-test.png');bpy.ops.render.render(write_still=True)
        if all((P/'renders'/n).exists() for n in ['round3-front.png','round3-side.png','round3-back.png','round3.png']):
            turnaround(P/'renders/turnaround.png')
print('OK',triangles,'triangles',len(objects),'meshes')
