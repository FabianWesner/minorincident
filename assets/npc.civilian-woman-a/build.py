"""Deterministic rigid-part hero Civilian Woman A. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render'); ap.add_argument('--glb'); ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24); ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540)
ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene; parts={}; objects=[]
def mat(token,hex,rough=.7):
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8)]}
M['woodWarm']=mat('woodWarm','b0703f',.6)
# Reference extensions cover civilian skin, chestnut hair and tan canvas absent from starter palette.
M.update({k:mat(k,h,r) for k,h,r in [('skinWarm','f2a77f',.68),('skinBlush','dd8f78',.72),('hairChestnut','61362b',.66),('hairHighlight','89503a',.68),('eyeBrown','582b20',.24),('canvasTan','e7c39a',.85)]})
M['grass']=mat('grass','6f8f3a',.8)
M['schoolBusYellow']=mat('schoolBusYellow','f2b630',.8)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(0,0,.68),'root');node('torso',(0,0,.76),'hip');node('head',(0,0,1.015),'torso');node('backpackSocket',(-.13,0,.88),'torso')
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
    return finish(o,n,m,par,0 if max(sz)<.04 else 1)
def box(n,p,sz,m,par,bevel=.015,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=sz;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,n,m,par)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=10,sub=1):
    points=list(points);radii=list(radii)
    # Support rings retain full sleeve lengths across rigid joints.
    if sub and len(points)>=2:
        points=[points[0],Vector(points[0]).lerp(Vector(points[1]),.08)]+points[1:-1]+[Vector(points[-1]).lerp(Vector(points[-2]),.08),points[-1]]
        radii=[radii[0],radii[0]]+radii[1:-1]+[radii[-1],radii[-1]]
    if max(max(r) if isinstance(r,(tuple,list)) else r for r in radii)<=.012:sub=0
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
# Adult chibi proportions: 1.4m, large head, short sturdy legs, relaxed stance.
ell('pelvis',(0,0,.665),(.115,.151,.105),'survivorRed','hip')
ell('dress_bodice',(0,0,.815),(.125,.169,.145),'survivorRed','torso',seg=16,rings=10)
ell('neck',(0,0,1.015),(.057,.065,.069),'skinWarm','head')
# Flared, closed dress shell: shallow sculpted pleats, double hem, soft waist.
def skirt_radius(z):
    return .148+(.73-z)*.27,.158+(.73-z)*.29
N=48;v=[];f=[]
for z in [.342,.35,.37,.44,.55,.65,.718,.732]:
    rx,ry=skirt_radius(z)
    for i in range(N):
        t=2*math.pi*i/N;fold=1+.024*math.cos(t*12)*( .73-z)/.39
        v.append((rx*math.cos(t)*fold,ry*math.sin(t)*fold,z))
for j in range(7):
    for i in range(N):f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
f.extend([tuple(range(N-1,-1,-1)),tuple(7*N+i for i in range(N))])
mesh('sundress_skirt',v,f,'survivorRed','hip',1)
for z in [.353,.718]:
    rx,ry=skirt_radius(z)
    tube('dress_hem' if z<.4 else 'gathered_waist',[(rx*math.cos(i*2*math.pi/48),ry*math.sin(i*2*math.pi/48),z) for i in range(49)],[.005]*49,'survivorRed','hip',N=6,sub=0)
# Small dimensional flower appliques stand clear of the dress surface.
for row,(z,count,size) in enumerate([(.39,8,.03),(.49,9,.012),(.59,8,.026),(.675,9,.009)]):
    rx,ry=skirt_radius(z)
    for j in range(count):
        t=2*math.pi*(j+.35*(row%2))/count
        if row==2 and j%3==1:continue
        center=Vector(((rx+.01)*math.cos(t),(ry+.01)*math.sin(t),z))
        tangent=Vector((-math.sin(t),math.cos(t),0));normal=Vector((math.cos(t),math.sin(t),0))
        for k in range(5):
            q=k*2*math.pi/5;pos=center+tangent*(math.cos(q)*size*.75)+Vector((0,0,math.sin(q)*size*.75))
            o=ell('flower_%d_%d_%d'%(row,j,k),pos,(.004,size*.52,size*.75),'picketWhite','hip',seg=8,rings=6)
            o.rotation_euler=(0,0,t);o.rotation_euler.x=-q
        ell('flower_center_%d_%d'%(row,j),center+normal*.003,(.006,.006,.006),'sidewalk','hip',seg=8,rings=6)
for z,y in [(.86,-.07),(.91,.08),(.78,.035),(.83,.12)]:
    for k in range(5):
        q=k*2*math.pi/5;ell('bodice_petal',(.12,y+.01*math.cos(q),z+.014*math.sin(q)),(.004,.008,.012),'picketWhite','torso',seg=8,rings=6)
# Open ivory cardigan shell with a rounded ribbed band and welted front edges.
v=[];f=[];N=24
for z,rx,ry in [(.71,.117,.165),(.72,.131,.177),(.82,.14,.181),(.925,.13,.194),(.974,.099,.164),(.98,.089,.151)]:
    for i in range(N):
        t=.68+(2*math.pi-1.36)*i/(N-1);v.append((rx*math.cos(t)-.009,ry*math.sin(t),z-(.075*(max(math.cos(t),0)/math.cos(.68))**2 if z<.73 else 0)))
for j in range(5):
    for i in range(N-1):f.append((j*N+i,j*N+i+1,(j+1)*N+i+1,(j+1)*N+i))
o=mesh('cardigan_shell',v,f,'picketWhite','torso',2)
mod=o.modifiers.new('knit thickness','SOLIDIFY');mod.thickness=.012;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    tube('cardigan_placket'+str(s),[(.07,s*.087,.984),(.099,s*.118,.943),(.117,s*.115,.832),(.101,s*.111,.641)],[.016,.018,.017,.016],'picketWhite','torso',N=8)
    for z in [.687,.756,.814,.877,.938]:ell('ivory_button',(.123,s*.108,z),(.005,.006,.006),'sidewalk','torso',seg=8,rings=6)
    tube('neckline'+str(s),[(.10,0,.952),(.106,s*.045,.958),(.09,s*.081,.982)],[.006]*3,'survivorRed','torso',N=8)
tube('back_cardigan_hem',[(-.121,.169*math.sin(t),.717) for t in [-1.3,-.8,0,.8,1.3]],[.015]*5,'picketWhite','torso',N=8)
tube('back_seam',[(-.151,0,.73),(-.155,0,.84),(-.128,0,.955)],[.003]*3,'sidewalk','torso',N=6,sub=0)
# Joint origins match the visible shoulder, elbow, wrist, hip, knee and ankle centers.
for s,side in [(1,'L'),(-1,'R')]:
    sh=(0,s*.181,.941);el=(.016,s*.244,.785)
    wr=(.149,s*.201,.826) if side=='L' else (.058,s*.29,.656)
    node('arm'+side,sh,'torso');node('foreArm'+side,el,'arm'+side);node('hand'+side,wr,'foreArm'+side)
    tube('cardigan_upper_sleeve'+side,[sh,(0,s*.215,.91),(.01,s*.238,.836),el],[.066,.077,.063,.058],'picketWhite','arm'+side,N=12)
    cuff=(.047,s*.238,.785) if side=='L' else (.035,s*.269,.72)
    tube('cardigan_lower_sleeve'+side,[el,cuff],[.062,.061],'picketWhite','foreArm'+side,N=12)
    tube('rolled_cuff'+side,[Vector(cuff).lerp(Vector(el),.2),cuff,Vector(cuff).lerp(Vector(wr),.10)],[.07,.072,.067],'picketWhite','foreArm'+side,N=12)
    tube('bare_forearm'+side,[cuff,Vector(cuff).lerp(Vector(wr),.65),wr],[.045,.039,.031],'skinWarm','foreArm'+side,N=12)
    palm=Vector(wr)+Vector((.012,0,-.023));ell('palm'+side,palm,(.039,.039,.049),'skinWarm','hand'+side)
    for j in range(4):
        y=wr[1]+(j-1.5)*.017
        pts=[(wr[0]+.031,y,wr[2]-.018),(wr[0]+.043,y,wr[2]-.049),(wr[0]+.027,y,wr[2]-.064)]
        tube('finger'+side+str(j),pts,[.012,.012,.009],'skinWarm','hand'+side,N=8)
    tube('thumb'+side,[(wr[0]+.025,wr[1]-s*.036,wr[2]),(wr[0]+.052,wr[1]-s*.039,wr[2]-.025),(wr[0]+.044,wr[1]-s*.024,wr[2]-.035)],[.017,.016,.011],'skinWarm','hand'+side,N=8)
    node('weaponSocket'+side,wr,'hand'+side)
    hp=(0,s*.101,.658);kn=(.005,s*.12,.31);an=(0,s*.139,.105)
    node('leg'+side,hp,'hip');node('shin'+side,kn,'leg'+side);node('foot'+side,an,'shin'+side)
    tube('thigh'+side,[hp,(0,s*.108,.48),kn],[.077,.071,.052],'skinWarm','leg'+side,N=12)
    tube('calf'+side,[kn,(0,s*.128,.248),an],[.052,.061,.033],'skinWarm','shin'+side,N=12)
    box('rubber_sole'+side,(.038,s*.139,.027),(.231,.14,.054),'picketWhite','foot'+side,.018)
    ell('sneaker_body'+side,(.03,s*.139,.083),(.112,.065,.061),'survivorRed','foot'+side,seg=16,rings=10)
    box('toe_cap'+side,(.118,s*.139,.07),(.075,.13,.061),'picketWhite','foot'+side,.021)
    ell('shoe_collar'+side,(-.024,s*.139,.129),(.053,.053,.023),'survivorRed','foot'+side)
    ell('tongue'+side,(.018,s*.139,.149),(.045,.035,.018),'survivorRed','foot'+side)
    for j in range(3):tube('lace'+side+str(j),[(.009+j*.023,s*.101,.151-j*.008),(.02+j*.023,s*.139,.164-j*.008),(.009+j*.023,s*.177,.151-j*.008)],[.005]*3,'picketWhite','foot'+side,N=6,sub=0)
    box('heel_tab'+side,(-.076,s*.139,.114),(.018,.04,.051),'picketWhite','foot'+side,.008)
    for j in range(3):
        for edge in [-1,1]:ell('lace_eyelet'+side,(.013+j*.023,s*.139+edge*.038,.144-j*.007),(.007,.007,.005),'picketWhite','foot'+side,seg=8,rings=6)
    for k in range(5):box('sole_groove'+side+str(k),(-.046+k*.038,s*.211,.02),(.005,.004,.019),'sidewalk','foot'+side,.002)
    ell('shoe_badge'+side,(.017,s*.201,.083),(.018,.006,.018),'picketWhite','foot'+side,seg=10,rings=8)
# Friendly real face: sculpted cheeks, eye whites, warm irises, lashes, brows and smile.
ell('face',(0,0,1.158),(.134,.16,.167),'skinWarm','head',seg=24,rings=16)
ell('chin',(.008,0,1.065),(.067,.1,.042),'skinWarm','head',seg=16,rings=10)
for s in [-1,1]:
    ell('ear'+str(s),(0,s*.158,1.15),(.035,.027,.046),'skinWarm','head')
    ell('ear_inner'+str(s),(.024,s*.164,1.15),(.012,.014,.027),'skinBlush','head')
    ell('eye_rim'+str(s),(.12,s*.071,1.186),(.005,.043,.051),'hairChestnut','head',seg=16,rings=10)
    ell('eye_white'+str(s),(.135,s*.071,1.184),(.009,.039,.045),'picketWhite','head',seg=16,rings=10)
    ell('iris'+str(s),(.146,s*.069,1.181),(.009,.023,.035),'eyeBrown','head',seg=16,rings=10)
    ell('pupil'+str(s),(.153,s*.067,1.182),(.005,.013,.026),'uiDark','head',seg=12,rings=8)
    ell('catchlight'+str(s),(.158,s*.061,1.195),(.004,.007,.009),'picketWhite','head',seg=8,rings=6)
    tube('eyelash'+str(s),[(.139,s*.037,1.218),(.133,s*.073,1.235),(.115,s*.109,1.218)],[.004,.007,.004],'uiDark','head',N=8)
    tube('brow'+str(s),[(.123,s*.035,1.257),(.12,s*.069,1.269),(.101,s*.103,1.259)],[.007,.012,.007],'hairChestnut','head',N=8)
ell('nose_bridge',(.13,0,1.156),(.013,.018,.027),'skinWarm','head')
ell('nose_tip',(.15,0,1.137),(.016,.021,.014),'skinWarm','head')
def face_surface(y,z):
    return .134*math.sqrt(max(0,1-(y/.16)**2-((z-1.158)/.167)**2))*.97+.004
tube('smile',[(face_surface(y,z),y,z) for y,z in [(-.048,1.092),(-.025,1.079),(0,1.077),(.025,1.079),(.048,1.092)]],[.0035]*5,'skinBlush','head',N=8)
tube('lower_lip',[(face_surface(y,1.071),y,1.071) for y in [-.022,0,.022]],[.0035]*3,'skinWarm','head',N=8)
# Thick wavy hair and half-up bun; continuous sculpted locks with slim warm grooves.
ell('hair_cap',(-.042,0,1.242),(.132,.164,.108),'hairChestnut','head',seg=20,rings=12)
for j in range(11):
    t=.65+(2*math.pi-1.3)*j/10
    x=-.025+.11*math.cos(t);y=.157*math.sin(t)
    points=[(x*.6,y*.7,1.30),(x,y,1.235),(x-.008,y*1.13,1.173),(x+.025,y*1.18,1.102),(x-.005,y*1.2,1.041),(x+.025,y*1.07,1.017)]
    tube('wavy_lock'+str(j),points,[.021,(.044,.034),(.043,.032),(.038,.029),(.028,.022),.005],'hairChestnut','head',N=10)
    tube('hair_groove'+str(j),[(p[0]+.003,p[1]+.008*math.sin(t),p[2]+.008) for p in points[1:-1]],[.0025]*4,'hairHighlight','head',N=6,sub=0)
# Broad swept half-up volumes cover the rear cap and converge into the bun.
for j in range(9):
    y=(j-4)*.032
    tube('half_up_sweep'+str(j),[(-.125,y,1.185),(-.179,y*.98,1.242),(-.159,y*.69,1.298),(-.092,y*.25,1.345)],[.008,(.037,.029),(.031,.024),.006],'hairChestnut','head',N=10)
    tube('half_up_ridge'+str(j),[(-.20,y*.95,1.243),(-.18,y*.67,1.298),(-.109,y*.25,1.336)],[.0025]*3,'hairHighlight','head',N=6,sub=0)
# Side swept fringe leaves eyes and eyebrows clear.
for j in range(4):
    tube('swept_fringe'+str(j),[(-.025,.086-j*.023,1.33),(.062,.04-j*.03,1.324),(.121,-.016-j*.035,1.291),(.125,-.085-j*.021,1.253),(.071,-.13-j*.012,1.216)],[.013,(.043,.029),(.047,.028),(.032,.02),.004],'hairChestnut','head',N=10)
    tube('fringe_ridge'+str(j),[(.084,.021-j*.03,1.331),(.147,-.023-j*.035,1.296),(.146,-.086-j*.021,1.256)],[.0025]*3,'hairHighlight','head',N=6,sub=0)
tube('parted_side_wave',[(0,.105,1.317),(.102,.144,1.287),(.105,.177,1.224),(.061,.18,1.19)],[.018,(.039,.028),(.033,.023),.005],'hairChestnut','head',N=10)
ell('bun_core',(-.066,0,1.336),(.093,.093,.071),'hairChestnut','head',seg=16,rings=10)
for j in range(8):
    t=2*math.pi*j/8
    tube('bun_coil'+str(j),[(-.068+.03*math.cos(t),.03*math.sin(t),1.395),(-.066+.084*math.cos(t),.081*math.sin(t),1.365),(-.068+.068*math.cos(t),.066*math.sin(t),1.31)],[.015,(.024,.019),.011],'hairChestnut','head',N=8)
tube('bun_braided_tie',[(-.066+.072*math.cos(i*2*math.pi/32),.073*math.sin(i*2*math.pi/32),1.308+.003*math.sin(i*math.pi)) for i in range(33)],[.005]*33,'schoolBusYellow','head',N=6,sub=0)
# Canvas tote at the left hip; thick straps are fixed to torso, hand grips the front strap.
box('canvas_tote',(.008,.289,.578),(.155,.234,.281),'canvasTan','torso',.035,rot=(.08,-.09,0))
box('tote_front_panel',(.094,.289,.577),(.016,.2,.224),'canvasTan','torso',.02)
for y in [.2,.376]:
    tube('tote_piping',[(.107,y,.68),(.115,y,.48),(.104,y-.008,.456)],[.004]*3,'sidewalk','torso',N=6,sub=0)
for x in [.048,-.067]:
    tube('leather_tote_handle',[(x,.225,.696),(x+.014,.192,.849),(x-.009,.172,.986),(x-.035,.225,.97),(x-.025,.337,.698)],[.011]*5,'woodWarm','torso',N=8)
# Botanical motif on outer bag face, leaves in actual geometry.
tube('tote_leaf_stem',[(.112,.291,.484),(.115,.29,.56),(.114,.284,.645)],[.003]*3,'grass','torso',N=6,sub=0)
for j in range(5):
    z=.53+j*.021;s=1 if j%2 else -1
    ell('tote_leaf'+str(j),(.118,.289+s*.025,z),(.005,.024,.037),'grass','torso',rot=(s*.6,0,0),seg=10,rings=6)
# Outer-facing print remains readable in the side turnaround.
tube('outer_tote_stem',[(.008,.414,.485),(.007,.416,.557),(.003,.414,.645)],[.003]*3,'grass','torso',N=6,sub=0)
for j in range(5):
    z=.53+j*.021;sign=1 if j%2 else -1
    ell('outer_tote_leaf'+str(j),(.008+sign*.023,.418,z),(.022,.005,.035),'grass','torso',rot=(0,sign*.6,0),seg=10,rings=6)
# Enlarge the head silhouette while keeping the model at 1.4m and bake unit-scale nodes.
parts['head'].scale=(1.13,1.30,1.02)
bpy.context.view_layer.update()
# Apply head scale to descendant mesh coordinates and preserve all joint world locations.
for o in objects:
    if o.parent==parts['head']:
        world=o.matrix_world.copy();o.data.transform(world);o.matrix_world=Matrix.Identity(4)
parts['head'].scale=(1,1,1)
bpy.context.view_layer.update()
for o in objects:
    if o.parent==parts['head']:
        o.matrix_parent_inverse=parts['head'].matrix_world.inverted();o.matrix_basis=Matrix.Identity(4)
# Merge static surfaces by material within each animated rigid part.
groups={}
for o in objects:groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
merged=[]
for (parent,material),items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    o=bpy.context.object;o.name=parent+'_'+material
    merged.append(o)
objects=merged
# Keep only purposeful silhouette detail; simplify densely subdivided interior surfaces.
total=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
if total>59000:
    for o in objects:
        mod=o.modifiers.new('hero budget','DECIMATE');mod.ratio=57000/total
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Export and counts precede studio geometry. Subdivision modifiers are fully applied.
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','weaponSocketR','weaponSocketL','backpackSocket']
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
(P/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
(P/'rig-rest.json').write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'hierarchy':{n:o.parent.name if o.parent else None for n,o in parts.items()}},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def apply_pose():
    bpy.context.view_layer.update()
    before={n:list(parts[n].matrix_world.translation) for n in ['handL','footR']}
    parts['armL'].rotation_euler.x=-.65;parts['foreArmL'].rotation_euler.y=-.6;parts['legR'].rotation_euler.y=-.4
    bpy.context.view_layer.update()
    (P/'pose-test.json').write_text(json.dumps({'rotations_radians':{n:list(parts[n].rotation_euler) for n in ['armL','foreArmL','legR']},'before':before,'after':{n:list(parts[n].matrix_world.translation) for n in before}},indent=2))
if a.pose:apply_pose()
def assemble_turnaround(output):
    # Assemble already-rendered camera views in Blender, without another GPU render.
    import numpy as np
    paths=[P/'renders'/n for n in ['front.png','side.png','back.png','review-hero.png']]
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4)[:,(w-420)//2:(w+420)//2,:])
    data=np.concatenate(panels,axis=1);sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(output);sheet.file_format='PNG';sheet.save()
    print('OK turnaround')
if a.render and a.view=='turnaround':
    assemble_turnaround(a.render);sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.69),3);light('cool fill',(1,4,3),260,(.63,.72,1),3);light('amber rim',(-3,1,3.5),600,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='studio_floor';ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.6),'front':(6,0,.71),'side':(0,6,.71),'back':(-6,0,.71)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.68*max(a.width/a.height,1)
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='METAL';prefs.get_devices()
        for d in prefs.devices:d.use=True
        S.cycles.device='GPU'
    except Exception:pass
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    if a.view in ['review-set','final-set']:
        for view in ['front','side','back','hero']:
            cam.location=views[view];cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler()
            S.render.filepath=str(P/'renders'/('review-hero.png' if view=='hero' else view+'.png'))
            bpy.ops.render.render(write_still=True)
        if a.view=='final-set':
            apply_pose()
            S.render.filepath=str(P/'renders'/'pose-test.png');bpy.ops.render.render(write_still=True)
            for n in ['armL','foreArmL','legR']:parts[n].rotation_euler=(0,0,0)
            S.render.resolution_x=1600;S.render.resolution_y=900;S.cycles.samples=96
            S.render.filepath=str(P/'renders'/'hero.png');bpy.ops.render.render(write_still=True)
            assemble_turnaround(P/'renders'/'turnaround.png')
    else:bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
