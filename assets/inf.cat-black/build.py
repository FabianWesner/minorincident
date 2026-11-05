"""Crowd-budget infected cat (LOD0 <= 8k). Deterministic applied-subdivision rigid meshes, +X forward.
Animal joints are nested within the infected animation contract. No textures.
Run exclusively through experiment/tools/blender_run.py.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
for n in ['render','glb']:ap.add_argument('--'+n)
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0)
ap.add_argument('--view',default='review-set');ap.add_argument('--pose',action='store_true')
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[];caps=[];tuft_counts={}
BUDGETS=(7800,3000,1500)
def mat(token,h,rough=.8,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,h,r) for k,h,r in [('uiDark','25222c',.84),('asphalt','5b4f5c',.87),('infectedSkin','c9a39a',.7),('blood','b3121f',.36),('picketWhite','f2e6dc',.45),('sidewalk','b9a4a0',.7)]}
M['eye']=mat('infectedEye','ff3b2f',.28,3)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
node('root',(0,0,0));node('hip',(-.31,0,.48),'root');node('body',(-.08,0,.5),'hip');node('torso',(.17,0,.48),'body');node('neck',(.32,0,.46),'torso');node('head',(.39,0,.46),'neck');node('jaw',(.43,0,.34),'head');node('tail',(-.43,0,.54),'hip');node('backpackSocket',(-.05,0,.67),'torso');node('front',(.66,0,.47),'head')
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod=o.modifiers.new('applied sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted();objects.append(o);return o
def ell(n,p,sz,m,par,seg=12,rings=8):
    seg,rings=((6,4) if n.startswith('stump_') else ((12,8) if n in ['skull','arched_coat'] else (8,6))) if a.lod==0 else ((8,6) if a.lod==1 else (6,4))
    if n.startswith('stump_'):seg,rings=(6,4)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p)
    o=bpy.context.object;o.scale=Vector(sz)*(.97 if seg>=12 else .92)
    return finish(o,n,m,par,0)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o);return finish(o,n,m,par,sub)
def tube(n,pts,rs,m,par,N=8,sub=1):
    N=min(N,(6,5,4)[a.lod])
    sub=1 if a.lod==0 and n in ['tail_core','raised_spine','snarl_lip','ear_shell'] else 0
    v=[];f=[]
    for j,p in enumerate(pts):
        t=Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(j-1,0)]);t.normalize();u=t.cross(Vector((0,1,0)))
        if u.length<.1:u=t.cross(Vector((0,0,1)))
        u.normalize();w=t.cross(u);r=rs[j];rx,ry=(r,r) if isinstance(r,(float,int)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(pts)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(pts)-1)*N+i for i in range(N))]);return mesh(n,v,f,m,par,sub)
def tuft(n,p,d,w,m,par):
    tuft_counts[n]=tuft_counts.get(n,0)+1
    if a.lod and (tuft_counts[n]-1)%(2 if a.lod==1 else 3):return
    p=Vector(p);d=Vector(d)*1.65
    normal=Vector((0,0,1)) if abs(p.y)<.06 and p.z>.6 else Vector((0,1 if p.y>=0 else -1,0))
    axis=d.normalized();u=axis.cross(normal).normalized();normal=u.cross(axis).normalized()
    v=[];f=[];N=(6,5,4)[a.lod]
    for t,width in [(0,.55),(.20,1),(.62,.8),(1,.015)]:
        for i in range(N):
            angle=i*math.tau/N;v.append(p+d*t+u*w*width*math.cos(angle)+normal*w*.28*width*math.sin(angle))
    for j in range(3):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple(3*N+i for i in range(N))]);mesh(n,v,f,m,par,0)
# Raised arch, small waist, powerful haunches and low shoulders.
ell('arched_coat',(-.08,0,.51),(.42,.175,.21),'uiDark','body',20,12)
ell('shoulder',(.22,0,.425),(.17,.17,.19),'uiDark','torso')
ell('rump',(-.32,0,.45),(.20,.182,.18),'uiDark','hip')
tube('raised_spine',[(.28,0,.50),(.14,0,.65),(-.1,0,.735),(-.32,0,.64),(-.43,0,.52)],[.06,.095,.115,.10,.06],'uiDark','body',N=12)
# Curved tail, thick root and hooked tip.
tailpts=[(-.43,0,.54),(-.58,.012,.55),(-.72,.025,.64),(-.79,.025,.81),(-.79,.02,.98),(-.73,.01,1.10),(-.61,0,1.13),(-.54,-.005,1.09)]
tube('tail_core',tailpts,[.07,.063,.06,.061,.063,.065,.069,.025],'uiDark','tail',N=10)
dense_tail=[Vector(point) for point in tailpts]
for j in range(1,len(dense_tail)-1):
    tangent=(dense_tail[j+1]-dense_tail[j-1]).normalized()
    u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u)
    for k in range(4):
        t=k*math.tau/4;radial=u*math.cos(t)+v*math.sin(t)
        tuft('tail_fur',dense_tail[j]+radial*.049,tangent*.052+radial*.037,.045,'asphalt' if k==2 else 'uiDark','tail')
# Front legs use arm/forearm/hand; back legs use leg/shin/foot.
for s,side in [(1,'L'),(-1,'R')]:
    for front in [True,False]:
        off=.022 if s==1 else 0
        joint=(.23 if front else -.32,s*.125,.44 if front else .43)
        knee=(.19 if front else -.25,s*.17,.23 if front else .24)
        ankle=(.35+off if front else -.46-off,s*.19,.078)
        upper=('arm' if front else 'leg')+side;lower=('foreArm' if front else 'shin')+side;end=('hand' if front else 'foot')+side
        animal=('F' if front else 'B')+side
        node(upper,joint,'torso' if front else 'hip');node('leg'+animal,joint,upper);node(lower,knee,'leg'+animal);node(end,ankle,lower);node('paw'+animal,ankle,end)
        ell('haunch'+animal,joint,(.11,.095,.125) if not front else (.082,.078,.105),'uiDark','leg'+animal)
        tube('upper_limb'+animal,[joint,((joint[0]+knee[0])/2,s*.16,.33),knee],[.075,.073,.047],'uiDark','leg'+animal)
        tube('lower_limb'+animal,[knee,((knee[0]+ankle[0])/2,s*.18,.16),ankle],[.05,.045,.044],'uiDark',lower)
        ell('paw_mass'+animal,(ankle[0]+.025,ankle[1],.051),(.09,.071,.05),'uiDark','paw'+animal)
        for k in range(4):
            yy=ankle[1]+(k-1.5)*.034
            ell('toe'+animal,(ankle[0]+.075,yy,.041),(.035,.022,.032),'asphalt','paw'+animal,8,6)
            tube('claw'+animal,[(ankle[0]+.094,yy,.046),(ankle[0]+.12,yy,.034),(ankle[0]+.129,yy,.018)],[.009,.007,.001],'sidewalk','paw'+animal,N=6)
        for k in range(2):
            z=.30+k*.07;tuft('leg_fur',(joint[0]-.04,s*.19,z),(-.065,s*.025,-.085),.045,'uiDark','leg'+animal)
        if (front and s==-1) or not front:
            ell('bald_limb',((knee[0]+ankle[0])/2,s*.214,.155),(.06,.009,.045),'infectedSkin',lower)
            ell('limb_wound',((knee[0]+ankle[0])/2+.007,s*.225,.155),(.026,.007,.025),'blood',lower)
# Paired exposed rump patches read clearly from the rear turnaround.
for sign in [-1,1]:
    pink=[(-.501,sign*.083,.467)]
    for k in range(14):
        t=k*math.tau/14;r=.76 if k%2 else 1;pink.append((-.502,sign*.083+.061*r*math.cos(t),.467+.068*r*math.sin(t)))
    mesh('rump_bald',pink,[(0,k+1,(k+1)%14+1) for k in range(14)],'infectedSkin','hip',0)
    for k in range(4):
        t=k*math.tau/4
        tuft('rump_fringe',(-.483,sign*.083+.059*math.cos(t),.467+.068*math.sin(t)),(-.019,.018*math.cos(t),-.066),.035,'uiDark','hip')
    verts=[(-.519,sign*.083,.467)]
    for k in range(12):
        t=k*math.tau/12;r=.025 if k%2 else .041;verts.append((-.520,sign*.083+r*math.cos(t),.467+r*math.sin(t)))
    mesh('rump_wound',verts,[(0,k+1,(k+1)%12+1) for k in range(12)],'blood','hip',0)
# Cranium and sharp cheek silhouette. The mouth is a real space between muzzle and lower jaw.
ell('skull',(.421,0,.49),(.145,.153,.139),'uiDark','head',20,12)
ell('chin',(.523,0,.304),(.076,.083,.036),'infectedSkin','jaw')
ell('lower_jaw',(.482,0,.318),(.075,.103,.042),'uiDark','jaw')
ell('mouth_void',(.553,0,.376),(.030,.080,.066),'uiDark','head',16,10)
# raised lip ring surrounds the opening without covering it
lip=[(.571,-.073,.43),(.588,-.074,.38),(.59,-.056,.319),(.595,0,.309),(.59,.056,.319),(.588,.074,.38),(.571,.073,.43)]
tube('snarl_lip',lip,[.009]*7,'blood','jaw',N=8)
for s in [-1,1]:
    # ears: thick tapered cat triangles, pink inset well in front of shell
    tube('ear_shell',[(.395,s*.116,.565),(.393,s*.132,.62),(.385,s*.158,.705),(.407,s*.173,.786)],[.07,.063,.038,.001],'uiDark','head',N=6)
    mesh('ear_inner',[(.448,s*.106,.605),(.44,s*.158,.719),(.415,s*.174,.767),(.449,s*.172,.621),(.455,s*.14,.638)],[(0,1,2,3),(0,3,4)],'infectedSkin','head',0)
    tube('ear_blood',[(.456,s*.128,.622),(.447,s*.15,.681),(.433,s*.164,.716)],[.009,.014,.004],'blood','head',N=6)
    for k in range(2):tuft('ear_rag',(.394,s*(.116+k*.035),.625+k*.045),(-.026,s*.03,.039),.017,'uiDark','head')
    ell('brow_substrate',(.545,s*.083,.55),(.057,.060,.035),'uiDark','head')
    ell('orbital_rim',(.534,s*.086,.509),(.020,.061,.056),'blood','head')
    ell('eye_socket',(.56,s*.086,.512),(.019,.049,.045),'uiDark','head')
    ell('glowing_eye',(.579,s*.086,.514),(.012,.034,.034),'eye','head',16,10)
    ell('eye_pupil',(.592,s*.084,.515),(.003,.008,.018),'uiDark','head',10,6)
    ell('eye_glint',(.594,s*.071,.528),(.003,.007,.007),'picketWhite','head',8,6)
    tube('angry_brow',[(.604,s*.038,.536),(.597,s*.077,.558),(.562,s*.131,.57)],[.021,.026,.016],'uiDark','head',N=8)
    ell('muzzle_pad',(.574,s*.044,.442),(.054,.049,.036),'infectedSkin','head')
    ell('cheek',(.47,s*.117,.441),(.06,.059,.068),'uiDark','head')
    for k in range(3):tuft('cheek_fur',(.425,s*(.11+k*.015),.51-k*.045),(-.10,s*.077,-.035-k*.01),.047,'asphalt' if k%4==0 else 'uiDark','head')
    tube('upper_fang',[(.593,s*.061,.43),(.61,s*.061,.403),(.603,s*.052,.363)],[.016,.013,.001],'picketWhite','head',N=8)
    tube('lower_fang',[(.602,s*.055,.323),(.612,s*.055,.345),(.603,s*.052,.365)],[.012,.008,.001],'picketWhite','jaw',N=8)
    for k in range(3):
        y=s*(.015+k*.014)
        tube('incisor_top',[(.617,y,.431),(.622,y,.417)],[.008,.005],'picketWhite','head',N=6)
        tube('incisor_bottom',[(.615,y,.322),(.62,y,.335)],[.007,.004],'picketWhite','jaw',N=6)
    for k in range(4):
        z=.442-k*.012;yy=s*(.059+k*.008)
        tube('whisker',[(.608,yy,z),(.621,s*(.17+k*.009),z+.02-k*.017),(.584,s*(.27+k*.019),z+.027-k*.031)],[.0025,.0015,.0005],'sidewalk','head',N=5,sub=0)
    for k in range(3):ell('whisker_follicle',(.625,s*(.035+k*.013),.446-(k%2)*.009),(.003,.003,.003),'uiDark','head',8,4)
mesh('triangular_nose',[(.626,-.028,.46),(.626,.028,.46),(.643,0,.436),(.60,0,.453)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],'blood','head',1)
ell('nose_ridge',(.609,0,.461),(.02,.028,.018),'uiDark','head')
ell('tongue',(.59,0,.325),(.018,.036,.012),'blood','jaw')
# Shaved infected islands, bordered by directional tufts. No floating/coplananr patches.
for s in [-1,1]:
    for j,(x,z,rx,rz) in enumerate([(-.19,.606,.12,.088),(-.35,.438,.074,.078),(.16,.405,.059,.063)]):
        y=s*(.15 if j==0 else .171)
        par='body' if j<2 else 'torso'
        outline=[]
        for k in range(16):
            t=k*math.tau/16;r=.72 if k%2 else 1
            outline.append((x+rx*math.cos(t)*r,y+s*.026,z+rz*math.sin(t)*r))
        mesh('bald_island',[(x,y+s*.032,z)]+outline,[(0,1+k,1+(k+1)%16) for k in range(16)],'infectedSkin',par,0)
        wound=[(x,y+s*.039,z)]
        for k in range(9):
            t=k*math.tau/9;r=.3 if k%2 else .55;wound.append((x+rx*r*math.cos(t),y+s*.038,z+rz*r*math.sin(t)))
        mesh('wound_center',wound,[(0,1+k,1+(k+1)%9) for k in range(9)],'blood',par,0)
        for k in range(4):
            t=k*math.tau/4;p=(x+rx*math.cos(t),y+s*.016,z+rz*math.sin(t));tuft('ragged_patch_edge',p,(-.045,s*.013,-.041),.029,'uiDark','body' if j<2 else 'torso')
# Fur clumps follow arch, hanging belly, chest and shoulder contours.
for s in [-1,1]:
    for j in range(5):
        x=.26-j*.14
        for k in range(3):
            t=.4+k*.85;z=.51+.19*math.cos(t);y=s*(.16*math.sin(t))
            # omit tufts in the main shaved shoulder island
            if abs(x+.19)<.12 and .51<z<.72:continue
            tuft('layered_flank_fur',(x,y,z),(-.12,s*.025,-.052),.058,'asphalt' if (j+k)%7==0 else 'uiDark','body')
    for j in range(4):
        x=.27-j*.19;z=.61+.125*math.sin(j/3*math.pi)
        tuft('bristled_spine',(x,s*.036,z),(-.14,s*.025,.065),.048,'asphalt' if j%3==0 else 'uiDark','body')
    for k in range(3):tuft('chest_ruff',(.28,s*(.035+k*.05),.374),(-.016,s*.045,-.106),.052,'uiDark','torso')
# Overlapping flattened dorsal locks cover the arch instead of leaving a smooth dome.
for j in range(4):
    x=.20-j*.16
    for k in range(3):
        t=(k-1)*.75;y=.145*math.sin(t)
        # Attach each lock to the actual sculpted coat, avoiding guessed floating layers.
        hits=[]
        for name in ['arched_coat','raised_spine']:
            coat=bpy.data.objects[name];inverse=coat.matrix_world.inverted()
            hit,point,normal,face=coat.ray_cast(inverse@Vector((x,y,1.3)),inverse.to_3x3()@Vector((0,0,-1)))
            if hit:hits.append((coat.matrix_world@point).z)
        if not hits:continue
        z=max(hits)+.004
        if abs(x+.19)<.12 and abs(y)>.07:continue
        tuft('dorsal_locks',(x,y,z),(-.12,y*.13,.018),.066,'asphalt' if (j+k)%9==0 else 'uiDark','body')
for sign in [-1,1]:
    for k in range(2):
        tuft('forehead_locks',(.446,sign*(.035+k*.055),.597-k*.015),(.074,sign*.006,-.05),.040,'uiDark','head')
# Contract caps stay on the retained parent, encoded hidden at zero scale in glTF.
for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    j=parts[n];p=j.matrix_world.translation.copy();par=j.parent.name
    normal=None
    if n in ['armL','armR']:
        coat=bpy.data.objects['shoulder'];inverse=coat.matrix_world.inverted()
        direction=(parts['foreArm'+n[-1]].matrix_world.translation-p).normalized()
        hit,point,normal_local,face=coat.ray_cast(inverse@p,inverse.to_3x3()@direction)
        if hit:
            normal=(coat.matrix_world.to_3x3()@normal_local).normalized()
            p=coat.matrix_world@point+normal*.012
    o=ell('stump_'+n,p,(.060,.064,.018) if normal else (.046,.049,.025),'blood',par,12,8)
    if normal:
        o.rotation_euler=normal.to_track_quat('Z','Y').to_euler()
        bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    o.name='stump_'+n;o['hidden']=True;o['ss_stump']=True;o['detachedNode']=n;o.scale=(0,0,0);caps.append(o)
# Quadruped cap aliases for animal-aware animation.
for animal,limb in [('FL','armL'),('FR','armR'),('BL','legL'),('BR','legR')]:
    source=bpy.data.objects['stump_'+limb];o=source.copy();o.data=source.data.copy()
    S.collection.objects.link(o);o.name='stump_leg'+animal;o['detachedNode']='leg'+animal
    objects.append(o);caps.append(o)
# Merge detail by material and rigid joint, preserving caps and all pivots.
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
joined=[]
for (par,ma),group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    o=group[0];o.name=par+'__'+ma;joined.append(o)
objects=joined+caps
for o in joined:
    if o.parent==parts['tail']:
        # Joined meshes are in the first clump's local frame, so transform in world space.
        world=o.matrix_world.copy();inverse=world.inverted()
        for v in o.data.vertices:
            p=world@v.co;p.z=.54+(p.z-.54)*.86;v.co=inverse@p
bpy.context.view_layer.update()
floor=min((o.matrix_world@v.co).z for o in joined for v in o.data.vertices)
parts['root'].location.z-=floor
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket','body','neck','jaw','tail']+['leg'+n for n in ['FL','FR','BL','BR']]+['paw'+n for n in ['FL','FR','BL','BR']]+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
def triangle_count(items):
    return sum(len(f.vertices)-2 for o in items for f in o.data.polygons)
# Caps and joints stay intact; reduction acts only on rigid visible surfaces.
for iteration in range(4):
    total=triangle_count(objects)
    if total<=BUDGETS[a.lod]:break
    cap_triangles=triangle_count(caps)
    ratio=(BUDGETS[a.lod]-cap_triangles)/(total-cap_triangles)*.96
    for o in joined:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('animal budget reduction','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
triangles=triangle_count(objects)
assert triangles<=BUDGETS[a.lod],(a.lod,triangles)
# Keep exact ground contact after simplification.
bpy.context.view_layer.update()
floor=min((o.matrix_world@v.co).z for o in joined for v in o.data.vertices)
parts['root'].location.z-=floor
stats={'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
(P/('build-stats.json' if a.lod==0 else f'lod{a.lod}-stats.json')).write_text(json.dumps(stats,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def apply_test_pose():
    rotations={'armL':(0,-.4,0),'foreArmL':(0,-.5,0),'legR':(0,.4,0)}
    for n,r in rotations.items():parts[n].rotation_euler=r
    parts['head'].rotation_euler.z=-.10;parts['tail'].rotation_euler.x=.17
    (P/'pose-proof.json').write_text(json.dumps({'rotations':rotations,'cap':'stump_armL','rest_hidden':True,'test_visible':True},indent=2))
def compose(paths,output,crop=None):
    import numpy as np
    panels=[]
    for path in paths:
        im=bpy.data.images.load(str(path));w,h=im.size
        data=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(data);data=data.reshape(h,w,4)
        if crop:data=data[:,(w-crop)//2:(w+crop)//2,:]
        panels.append(data)
    data=np.concatenate(panels,axis=1)
    im=bpy.data.images.new('comparison',width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel());im.filepath_raw=str(output);im.file_format='PNG';im.save()
def turnaround(output):
    compose([P/'renders'/(n+'.png') for n in ['front','side','back','review-hero']],output,640)
if a.render and a.view=='turnaround':
    turnaround(a.render);print('OK turnaround');sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def light(n,p,power,c,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o)
        o.location=p;d.energy=power;d.color=c;d.shape='DISK';d.size=size
        o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),360,(1,.81,.68),3)
    light('cool fill',(1,4,3),230,(.65,.73,1),3)
    light('amber rim',(-3,1,3),460,(1,.44,.17),2)
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(mat('studio','35303b',.9))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam)
    S.camera=cam;cam.data.type='ORTHO'
    S.render.engine='CYCLES';S.cycles.use_denoising=True
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    def render(view,output,width,height,samples):
        cam.location={'hero':(4,-3,2.1),'front':(5,0,.85),'side':(0,-5,.85),'back':(-5,0,.85),'pose':(2.5,5,2.2)}[view]
        cam.rotation_euler=(Vector((-.05,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.ortho_scale=1.65*width/height
        S.cycles.samples=samples;S.render.resolution_x=width;S.render.resolution_y=height
        S.render.resolution_percentage=100;S.render.filepath=str(output)
        bpy.ops.render.render(write_still=True)
    def pose_render(output):
        apply_test_pose()
        intact=P/'renders'/'pose-intact.png';stump=P/'renders'/'pose-stump.png'
        render('pose',intact,960,540,24)
        for o in objects:
            par=o.parent
            while par:
                if par==parts['armL']:o.hide_render=True;break
                par=par.parent
        cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
        render('pose',stump,960,540,24);compose([intact,stump],output)
    if a.view=='final-set':
        for view in ['front','side','back','hero']:
            output=P/'renders'/((view if view!='hero' else 'review-hero')+'.png')
            render(view,output,960,540,24)
        render('hero',a.render,a.width,a.height,a.samples)
        turnaround(P/'renders'/'turnaround.png');pose_render(P/'renders'/'pose-test.png')
    elif a.pose:
        pose_render(a.render)
    elif a.view=='review-set':
        for view in ['front','side','back','hero']:
            output=P/'renders'/((view if view!='hero' else 'review-hero')+'.png')
            render(view,output,a.width,a.height,a.samples)
        import shutil
        shutil.copyfile(P/'renders'/'review-hero.png',a.render)
    else:
        render(a.view,a.render,a.width,a.height,a.samples)
print('OK',triangles,'triangles',len(objects),'meshes')
