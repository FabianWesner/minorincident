"""Hero infected flamingo. Deterministic, texture-free, rigid feathered parts.
+X forward, +Z up, -Y right. Run only through experiment/tools/blender_run.py.
Bird and infected contracts coexist: arm/forearm/hand joints articulate each wing.
Subdivision is applied; static decoration is joined by rigid parent and material.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
for key in ['render','glb','sheet']:ap.add_argument('--'+key)
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0);ap.add_argument('--view',default='hero');ap.add_argument('--pose',action='store_true')
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def turnaround(path):
    import numpy as np
    panels=[]
    for n in ['front','side','back','review-hero']:
        im=bpy.data.images.load(str(P/'renders'/f'{n}.png'));w,h=im.size;px=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(px)
        panels.append(px.reshape(h,w,4)[:,(w-560)//2:(w+560)//2,:])
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True);im.pixels.foreach_set(data.ravel());im.filepath_raw=str(path);im.file_format='PNG';im.save()
if a.sheet or (a.render and a.view=='turnaround'):
    turnaround(a.sheet or a.render);print('OK turnaround');sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[];feathers=[];feather_index=0;rng=random.Random(2307)
def mat(token,color,rough=.65,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=c;bs.inputs['Roughness'].default_value=rough
    if emit:bs.inputs['Emission Color'].default_value=c;bs.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,c) for k,c in [('flamingoPink','ea708d'),('flamingoBlush','f7a1b0'),('flamingoCoral','d94c6b'),('flamingoShadow','9c405d'),('picketWhite','f2e6dc'),('uiDark','25222c'),('blood','b3121f')]}
M['eye']=mat('infectedEye','ff3b2f',.25,1.5)
def parent(o,key):
    bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parts[key];o.matrix_world=world
    return o
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:parent(o,par)
    parts[n]=o;return o
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod=o.modifiers.new('Applied sculpt subdivision','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    parent(o,par);objects.append(o);return o
def ell(n,p,sz,m,par,seg=12,rings=8,sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    return finish(o,n,m,par,sub)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,pts,rr,m,par,N=8,sub=1):
    v=[];f=[]
    for j,p in enumerate(pts):
        t=Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(j-1,0)]);t.normalize();u=t.cross(Vector((0,1,0)))
        if u.length<.1:u=t.cross(Vector((1,0,0)))
        u.normalize();w=t.cross(u);r=rr[j];rx,ry=(r,r) if isinstance(r,(float,int)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(pts)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(pts)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def feather(n,start,tip,width,m,par,normal=(0,-1,.2)):
    global feather_index
    feather_index+=1
    if a.lod and feather_index%(2 if a.lod==1 else 4):return
    p=Vector(start);q=Vector(tip);d=q-p;t=d.normalized();normal=Vector(normal).normalized();u=t.cross(normal).normalized();w=t.cross(u).normalized()
    v=[];f=[];N=6
    for frac,rad in [(0,.12),(.17,.85),(.46,1),(.76,.64),(.94,.22),(1,.015)]:
        center=p+d*frac+normal*math.sin(frac*math.pi)*.027
        for i in range(N):
            angle=i*2*math.pi/N;v.append(center+u*width*rad*math.cos(angle)+w*.018*rad*math.sin(angle))
    for j in range(5):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple(5*N+i for i in range(N))])
    o=mesh(n,v,f,m,par);feathers.append(o);return o
node('root',(0,0,0));node('hip',(-.06,0,.85),'root');node('torso',(0,0,.95),'hip');node('body',(0,0,.95),'torso')
node('neck',(.31,0,.97),'torso');node('head',(.49,0,1.38),'neck');node('tail',(-.38,0,.98),'body');node('backpackSocket',(-.12,0,1.14),'torso')
ell('body_core',(-.08,0,.98),(.39,.235,.235),'flamingoShadow','body',20,12)
ell('breast',(.19,0,.97),(.16,.18,.16),'flamingoPink','body')
# S-shaped neck: thick enough for toy-like readability, continuous applied subdivision.
neckpts=[(.25,0,.95),(.36,0,.94),(.44,0,.99),(.46,0,1.08),(.39,0,1.18),(.29,0,1.30),(.30,0,1.43),(.40,0,1.51),(.50,0,1.49)]
tube('sculpted_S_neck',neckpts,[.102,.09,.079,.074,.075,.071,.077,.087,.084],'flamingoPink','neck',12,2)
ell('skull',(.51,0,1.443),(.153,.126,.137),'flamingoPink','head',20,12)
ell('cheek_mass',(.58,0,1.393),(.1,.114,.085),'flamingoCoral','head')
# Hooked ivory upper bill and charcoal tip, with a separate lower jaw and dark gape.
tube('ivory_bill',[(.59,0,1.424),(.67,0,1.401),(.753,0,1.331),(.777,0,1.277)],[ (.072,.075),(.068,.069),(.05,.055),(.046,.05)],'flamingoBlush','head',12,2)
tube('black_hook',[(.755,0,1.32),(.782,0,1.26),(.756,0,1.177),(.693,0,1.13)],[.048,.049,.038,.006],'uiDark','head',12,2)
tube('lower_bill',[(.613,0,1.369),(.68,0,1.319),(.692,0,1.246),(.676,0,1.192)],[.042,.036,.023,.006],'flamingoShadow','head',10)
for s in [-1,1]:
    tube('bill_mouth_seam'+str(s),[(.637,s*.056,1.379),(.706,s*.055,1.32),(.726,s*.042,1.245),(.692,s*.015,1.15)],[.005,.006,.004,.002],'uiDark','head',6)
    ell('nostril'+str(s),(.696,s*.056,1.373),(.022,.006,.01),'uiDark','head',10,6)
    ell('eye_socket'+str(s),(.615,s*.089,1.472),(.032,.046,.054),'flamingoShadow','head')
    ell('orbital_rim'+str(s),(.63,s*.095,1.477),(.021,.043,.046),'blood','head')
    ell('infected_eye'+str(s),(.642,s*.102,1.478),(.018,.036,.037),'eye','head',16,10)
    ell('eye_hot_core'+str(s),(.656,s*.107,1.482),(.005,.01,.012),'picketWhite','head',10,6)
    tube('scowling_brow'+str(s),[(.59,s*.111,1.522),(.633,s*.102,1.526),(.654,s*.053,1.506)],[.019,.022,.008],'flamingoCoral','head')
    # Hanging cheek rags and crown tufts are sculpted feather volumes.
    for j in range(4):
        feather('cheek_rag'+str(s)+str(j),(.49+j*.035,s*.092,1.441),(.48+j*.024,s*.118,1.325-j*.011),.029,'flamingoCoral','head',(0,s,0))
for j in range(7):
    y=(j-3)*.028
    feather('crown_tuft'+str(j),(.5,y,1.53),(.37-(j%3)*.018,y*1.4,1.564+(j%2)*.021),.032,'flamingoCoral' if j%2 else 'flamingoPink','head',(0,0,1))
for s in [-1,1]:
    for j in range(6):
        feather('skull_plume'+str(s)+str(j),(.46-j*.014,s*(.067+j*.008),1.533-j*.014),(.387-j*.014,s*(.097+j*.009),1.441-j*.019),.031,'flamingoCoral' if j%3==0 else 'flamingoPink','head',(0,s,.3))
# Asymmetric layered wings, with small exposed patches between feather rows.
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(.03,s*.18,1.055);elbow=(-.22,s*.245,1.01);wrist=(-.43,s*.24,.91)
    node('arm'+side,shoulder,'torso');node('wing'+side,shoulder,'arm'+side);node('foreArm'+side,elbow,'wing'+side);node('hand'+side,wrist,'foreArm'+side)
    ell('wing_shell'+side,(-.12,s*.204,1.013),(.29,.074,.172),'flamingoShadow','wing'+side,16,10)
    verts=[(-.18+dx,s*.284,1.045+dz) for dx,dz in [(-.065,.01),(-.049,.041),(-.015,.035),(.009,.052),(.056,.026),(.069,-.009),(.024,-.027),(.005,-.055),(-.035,-.034)]]
    mesh('ragged_missing_feather_patch'+side,verts,[tuple(range(len(verts)))],'flamingoShadow','wing'+side,0)
    for row in range(4):
        for j in range(8):
            x=.13-j*.063-row*.018;z=1.156-row*.075+.024*math.sin(j*.8)
            yy=s*(.205+row*.025+.016*math.sin(j))
            length=.15+row*.037+j*.014+rng.uniform(-.048,.048)
            tip=(x-length*.68,yy+s*.035,z-length*.64)
            par='wing'+side if row<2 else ('foreArm'+side if j<5 else 'hand'+side)
            material=['flamingoPink','flamingoBlush','flamingoCoral'][ (j+row+(side=='R'))%3 ]
            # Leave one ragged missing-feather window around the wound.
            if row==1 and j in [4,5]:continue
            feather('wing_feather'+side+str(row)+'_'+str(j),(x,yy,z),tip,.047+row*.005,material,par,(0,s,.2))
    for j in range(8):
        feather('flight_feather'+side+str(j),(-.28-j*.022,s*(.22+j*.004),1.071-j*.025),(-.61-j*.02,s*(.29+j*.014),.88-j*.038),.045,'flamingoCoral' if j%3==0 else 'flamingoPink','hand'+side,(0,s,.2))
# Back and tail, visible in rear view, with feather directions flowing down and back.
for row in range(3):
    for j in range(7):
        y=(j-3)*.055;x=.08-row*.15;z=1.184+.019*math.cos(j)
        feather('back_plume'+str(row)+'_'+str(j),(x,y,z),(x-.23-row*.035,y*1.13,z-.07-row*.035),.047,['flamingoPink','flamingoBlush','flamingoCoral'][(j+row)%3],'body',(0,0,1))
for j in range(9):
    y=(j-4)*.038
    feather('tail_plume'+str(j),(-.36,y,1.04),(-.69-(j%3)*.036,y*1.55,.77-(j%2)*.025),.047,'flamingoCoral' if j%2 else 'flamingoPink','tail',(0,0,1))
for s in [-1,1]:
    for j in range(5):
        feather('breast_rag'+str(s)+str(j),(.27-j*.05,s*.11,.971),(.25-j*.047,s*.15,.812+(j%2)*.025),.041,'flamingoPink','body',(0,s,.1))
    for j in range(8):
        z=1.06+j*.055;x=[.455,.445,.413,.375,.354,.342,.348,.38][j]
        ell('neck_scab'+str(s)+str(j),(x,s*.071,z),(.008,.005,.013 if j%3 else .023),'blood','neck',8,6)
# Broken feather edges across breast and neck prevent a smooth bare-chest silhouette.
for s in [-1,1]:
    for row in range(3):
        for j in range(5):
            x=.342-j*.042;z=1.079-row*.064;yy=s*(.111+row*.021)
            feather('chest_covert'+str(s)+str(row)+str(j),(x,yy,z),(x-.025,yy+s*.033,z-.10-rng.uniform(.01,.06)),.033,['flamingoPink','flamingoBlush','flamingoCoral'][(j+row)%3],'body',(0,s,.2))
    for j in range(8):
        z=1.13+j*.048;x=[.415,.388,.35,.326,.30,.30,.327,.37][j]
        feather('neck_rag'+str(s)+str(j),(x,s*.06,z),(x-.025,s*.075,z-.068-(j%3)*.013),.024,'flamingoCoral' if j%3==0 else 'flamingoPink','neck',(0,s,.1))
for row in range(2):
    for j in range(5):
        y=(j-2)*.043;x=.357-abs(y)*.15;z=.987-row*.07
        feather('front_bib_rag'+str(row)+str(j),(x,y,z),(x+.009,y*1.14,z-.11-(j%2)*.02),.031,'flamingoBlush' if j%3==0 else 'flamingoPink','body',(1,0,.1))
# Slender-but-chunky bird legs, one straight and one characteristically folded.
for s,side in [(1,'L'),(-1,'R')]:
    hip=(-.055,s*.087,.861)
    knee=(-.065,s*.088,.475) if side=='L' else (-.31,s*.1,.658)
    ankle=(-.035,s*.089,.085) if side=='L' else (.04,s*.14,.491)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    tube('upper_leg'+side,[hip,Vector(hip).lerp(Vector(knee),.5),knee],[.033,.026,.03],'flamingoBlush','leg'+side,10)
    tube('lower_leg'+side,[knee,Vector(knee).lerp(Vector(ankle),.6),ankle],[.028,.022,.029],'flamingoPink','shin'+side,10)
    ell('hock'+side,knee,(.038,.038,.045),'flamingoCoral','shin'+side)
    ell('ankle_pad'+side,ankle,(.045,.045,.035),'flamingoPink','foot'+side)
    for j in range(3):
        yy=ankle[1]+(j-1)*.06
        if side=='L':pts=[ankle,(.034,yy,.038),(.102,yy+(j-1)*.015,.025),(.153,yy+(j-1)*.022,.017)]
        else:pts=[ankle,(.056,yy,.427),(.053,yy+(j-1)*.015,.375),(.083,yy+(j-1)*.022,.366)]
        tube('toe'+side+str(j),pts,[.019,.021,.015,.007],'flamingoCoral','foot'+side,8)
        end=Vector(pts[-1]);tip=end+Vector((.035,0,-.012 if side=='L' else .035))
        tube('claw'+side+str(j),[pts[-2],end,tip],[.012,.011,.001],'uiDark','foot'+side,8)
        ell('toe_knuckle'+side+str(j),pts[1],(.023,.024,.025),'flamingoPink','foot'+side,8,6)
    tube('rear_toe'+side,[ankle,(ankle[0]-.064,ankle[1],ankle[2]-.045),(ankle[0]-.091,ankle[1],ankle[2]-.05)],[.014,.014,.002],'flamingoCoral','foot'+side,8)
    for j in range(7):
        p=Vector(knee).lerp(Vector(ankle),.15+j*.105);p.y-=.023;p.z+=rng.uniform(-.015,.015)
        ell('leg_blood'+side+str(j),p,(.008+rng.random()*.009,.005,.009+rng.random()*.022),'blood','shin'+side,8,6)
# Hidden caps on proximal nodes; zero scale is retained in GLB and toggled by runtime.
caps=[]
for key,par,p,sz in [('head','neck',(.49,0,1.38),(.062,.065,.014)),('armL','torso',(.03,.18,1.055),(.069,.012,.06)),('armR','torso',(.03,-.18,1.055),(.069,.012,.06)),('foreArmL','wingL',(-.22,.245,1.01),(.06,.012,.049)),('foreArmR','wingR',(-.22,-.245,1.01),(.06,.012,.049)),('legL','hip',(-.055,.087,.861),(.029,.03,.012)),('legR','hip',(-.055,-.087,.861),(.029,.03,.012))]:
    o=ell('stump_'+key,p,sz,'blood',par,seg=8 if a.lod==0 else 6,rings=6 if a.lod==0 else 4,sub=0);o['stumpFor']=key;o['hidden']=True;o.scale=(0,0,0);caps.append(o)
# Reduce only applied subdivision; keep silhouettes and separate joints.
for o in objects:
    if o not in caps:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Game-ready sculpt reduction','DECIMATE');mod.ratio=({0:.085,1:.06,2:.06} if o in feathers else {0:.085,1:.03,2:.02})[a.lod]
        bpy.ops.object.modifier_apply(modifier=mod.name)
# Join static pieces without flattening animation hierarchy.
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault((o.parent.name,'palette'),[]).append(o)
joined=[]
for (par,material),group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    o=group[0];o.name=par+'__'+material;joined.append(o)
objects=joined+caps
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-12]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
# Exact ground contact of the planted foot.
bpy.context.view_layer.update()
planted=[o for o in objects if o.parent==parts['footL']]
floor=min((o.matrix_world@v.co).z for o in planted for v in o.data.vertices)
parts['footL'].location.z-=floor
bpy.context.view_layer.update()
if not a.pose and a.lod==0:
    (P/'rig-rest.json').write_text(json.dumps({'pivots':{k:list(o.matrix_world.translation) for k,o in parts.items()},'parents':{k:o.parent.name if o.parent else None for k,o in parts.items()},'feet_min_z':0.0},indent=2))
required=['root','body','neck','hip','torso','head','wingL','wingR','tail','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+k for k in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
stats={'triangles':sum(len(o.data.polygons) for o in objects),'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
if not a.pose:(P/('build-stats.json' if a.lod==0 else f'build-stats-lod{a.lod}.json')).write_text(json.dumps(stats,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose_test():
    before={k:list(parts[k].matrix_world.translation) for k in ['handL','footR']}
    parts['armL'].rotation_euler.x=.7;parts['foreArmL'].rotation_euler.z=-.45;parts['legR'].rotation_euler.y=-.3
    bpy.data.objects['stump_armL'].scale=(1,1,1);bpy.data.objects['stump_armL']['hidden']=False
    bpy.context.view_layer.update()
    after={k:list(parts[k].matrix_world.translation) for k in before}
    (P/'pose-stats.json').write_text(json.dumps({'rotated':['armL','foreArmL','legR'],'before':before,'after':after,'stump_armL_visible':True,'children_moved':all((Vector(before[k])-Vector(after[k])).length>.01 for k in before)},indent=2))
if a.pose:pose_test()
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),460,(1,.83,.75),3);light('cool fill',(1,4,3),250,(.63,.72,1),3);light('amber rim',(-3,1,3.5),520,(1,.46,.25),2)
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    cam.data.type='ORTHO'
    S.render.engine='CYCLES';S.cycles.use_denoising=True;S.render.resolution_percentage=100;S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    def render_view(view,path,width=960,height=540,samples=24):
        cam.location={'pose':(4,6,2.8),'hero':(4,-6,2.8),'front':(6,0,1.25),'side':(0,-6,1.25),'back':(-6,0,1.25)}.get(view,(4,-6,2.8))
        cam.rotation_euler=(Vector((.02,0,.82))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.95*width/height
        S.render.resolution_x=width;S.render.resolution_y=height;S.cycles.samples=samples;S.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    if a.view=='final':
        for view in ['front','side','back','hero']:
            render_view(view,P/'renders'/('review-hero.png' if view=='hero' else view+'.png'))
        pose_test();render_view('pose',P/'renders'/'pose-test.png')
        for key in ['armL','foreArmL','legR']:parts[key].rotation_euler=(0,0,0)
        bpy.data.objects['stump_armL'].scale=(0,0,0);bpy.data.objects['stump_armL']['hidden']=True
        bpy.context.view_layer.update()
        render_view('hero',a.render,1600,900,96)
        turnaround(P/'renders'/'turnaround.png')
    else:render_view('pose' if a.pose else a.view,a.render,a.width,a.height,a.samples)
print('OK',stats)
