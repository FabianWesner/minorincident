"""Deterministic rigid-part hero infected dachshund. +X forward, Z up, -Y character right.
Run through experiment/tools/blender_run.py. All subdivision is applied before GLB.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--render'); ap.add_argument('--glb'); ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24); ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540)
ap.add_argument('--pose',action='store_true')
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0)
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
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35),('survivorRed','d9363e',.73),('sidewalk','b9a4a0',.8),('woodWarm','b0703f',.7),('schoolBusYellow','f2b630',.4)]}
M['eye']=mat('infectedEye','ff3b2f',.24,.8)
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
# Joint positions are authored in world space, preserving the relaxed quadruped pose.
node('root',(0,0,0));node('hip',(-.58,0,.40),'root');node('torso',(.22,0,.43),'hip')
node('body',(0,0,.40),'torso');node('neck',(.48,0,.55),'torso');node('head',(.57,0,.66),'neck')
node('jaw',(.58,0,.54),'head');node('tail',(-.85,0,.47),'hip');node('backpackSocket',(-.2,0,.66),'torso');node('front',(1.04,0,.65),'head')
ell('long_low_trunk',(-.20,0,.43),(.73,.235,.245),'asphalt','body',seg=20,rings=12)
ell('chest',(.38,0,.44),(.26,.24,.26),'asphalt','torso',seg=16,rings=10)
ell('tan_belly',(-.13,0,.245),(.63,.18,.075),'woodWarm','body',seg=16,rings=8)
ell('breast',(.52,0,.39),(.075,.16,.16),'woodWarm','torso')
# Four short, chunky legs; infected arm nodes animate the front pair.
for s,side in [(1,'L'),(-1,'R')]:
    for front in [True,False]:
        x=.37 if front else -.66;y=s*.19
        upper='arm'+side if front else 'leg'+side; lower='foreArm'+side if front else 'shin'+side; foot='hand'+side if front else 'foot'+side
        joint=(x,y,.40);knee=(x+(.035 if front else -.025),s*.235,.225);ankle=(x+.085,s*.25,.09)
        node(upper,joint,'torso' if front else 'hip');node(lower,knee,upper);node(foot,ankle,lower)
        alias=('F' if front else 'B')+('L' if s==1 else 'R');node('leg'+alias,joint,upper);node('paw'+alias,ankle,foot)
        ell('elbow_joint'+alias,knee,(.084,.086,.080),'woodWarm',lower,seg=12,rings=8)
        tube('thigh'+alias,[joint,(x,s*.23,.34),knee],[.105,.12,.09],'asphalt',upper,N=12)
        tube('lower_leg'+alias,[knee,(x+.05,s*.25,.155),ankle],[.088,.084,.069],'woodWarm',lower,N=12)
        ell('paw'+alias+'_mass',(x+.11,s*.25,.069),(.13,.097,.066),'woodWarm',foot,seg=12,rings=8)
        for j in range(4):
            yy=s*.25+(j-1.5)*.043
            ell('toe'+alias+str(j),(x+.193,yy,.05),(.052,.026,.043),'woodWarm',foot,seg=8,rings=6)
            tube('claw'+alias+str(j),[(x+.22,yy,.057),(x+.247,yy,.042),(x+.255,yy,.024)],[.014,.013,.001],'uiDark',foot,N=8)
        for j in range(3):
            tube('leg_fur'+alias+str(j),[(x-.025+j*.032,y-s*.035,.30),(x-.04+j*.034,y-s*.07,.24),(x-.055+j*.03,y-s*.074,.20)],[.045,.029,.002],'asphalt',upper,N=8)
# Short canine tail: rounded root, gentle upward bend, continuous taper.
tube('tail_core',[(-.85,0,.48),(-.97,0,.51),(-1.075,0,.565),(-1.15,0,.61)],[.09,.072,.039,.005],'asphalt','tail',N=12)
# Head and snout are separate masses around a real open mouth.
ell('skull',(.61,0,.73),(.23,.205,.215),'asphalt','head',seg=20,rings=12)
ell('muzzle_bridge',(.79,0,.687),(.19,.14,.102),'woodWarm','head',seg=16,rings=10)
ell('muzzle_left',(.865,.066,.65),(.128,.089,.073),'woodWarm','head',seg=12,rings=8)
ell('muzzle_right',(.865,-.066,.65),(.128,.089,.073),'woodWarm','head',seg=12,rings=8)
ell('wet_nose',(1.006,0,.698),(.065,.095,.049),'uiDark','head',seg=16,rings=10)
for s in [-1,1]:
    ell('nostril'+str(s),(1.055,s*.044,.701),(.009,.022,.012),'uiDark','head')
    ell('nose_glint'+str(s),(1.029,s*.028,.734),(.016,.018,.004),'asphalt','head')
# Mouth cavity slopes back under the snout, with separate jaw and tongue.
ell('mouth_depth',(.76,0,.551),(.133,.103,.148),'uiDark','head',seg=16,rings=10)
tube('lower_jaw',[(.59,0,.55),(.68,0,.382),(.83,0,.382),(.91,0,.416)],[.092,(.06,.061),(.059,.06),.036],'woodWarm','jaw',N=12)
ell('tongue',(.823,0,.421),(.077,.063,.025),'survivorRed','jaw',seg=12,rings=8)
tube('tongue_crease',[(.87,0,.440),(.83,0,.446),(.79,0,.442)],[.003]*3,'blood','jaw',N=6,sub=0)
for s in [-1,1]:
    tube('upper_gum'+str(s),[(.63,s*.098,.60),(.76,s*.12,.608),(.91,s*.093,.597)],[.012,.013,.012],'blood','head',N=8)
    tube('lower_gum'+str(s),[(.625,s*.078,.479),(.74,s*.083,.403),(.87,s*.075,.414)],[.012,.015,.009],'blood','jaw',N=8)
    for j in range(5):
        x=.665+j*.048;y=s*(.093 if j<4 else .074);long=j==3
        tube('upper_fang'+str(s)+str(j),[(x,y,.614),(x+.005,y,.59),(x+.012,y,.529 if long else .572)],[.017 if long else .012,.013 if long else .009,.001],'picketWhite','head',N=8)
        tube('lower_tooth'+str(s)+str(j),[(x,y,.409),(x+.005,y,.433),(x+.01,y,.478 if j==3 else .449)],[.013,.009,.001],'picketWhite','jaw',N=8)
    # Forward/side-facing eye plane, red core and heavy aggressive brow.
    ell('orbital_rim'+str(s),(.754,s*.148,.783),(.073,.051,.077),'uiDark','head',rot=(0,0,s*.42),seg=12,rings=8)
    ell('eye'+str(s),(.786,s*.164,.792),(.051,.034,.056),'eye','head',rot=(0,0,s*.42),seg=16,rings=10)
    ell('eye_hot_core'+str(s),(.817,s*.17,.795),(.008,.008,.016),'picketWhite','head')
    tube('angry_brow'+str(s),[(.851,s*.111,.802),(.834,s*.16,.849),(.748,s*.185,.866)],[.023,.030,.018],'asphalt','head',N=10)
    ell('tan_eyebrow'+str(s),(.735,s*.129,.875),(.049,.026,.018),'woodWarm','head',rot=(0,-.25,s*.3))
    ell('tan_cheek'+str(s),(.725,s*.159,.639),(.067,.033,.057),'woodWarm','head')
    # Long floppy ears, shaped with a sweep instead of thin flat plates.
    tube('ear'+str(s),[(.53,s*.183,.857),(.49,s*.245,.78),(.475,s*.269,.62),(.49,s*.285,.485)],[.065,(.065,.088),(.058,.099),.011],'asphalt','head',N=12)
    tube('ear_tan_tip'+str(s),[(.49,s*.285,.625),(.51,s*.30,.54),(.50,s*.294,.482)],[.045,.049,.003],'woodWarm','head',N=10)
    for j in range(5):
        z=.78-j*.055;x=.47+(.018 if j%2 else -.025)
        tube('ear_shag'+str(s)+str(j),[(x,s*.26,z),(x-.075,s*.292,z-.055),(x-.074,s*.285,z-.13)],[.048,.036,.001],'asphalt','head',N=8)
    for j in range(8):
        ell('whisker_pore'+str(s)+str(j),(.923+(j%3)*.018,s*(.099+(j%2)*.008),.66-(j//3)*.018),(.005,.004,.004),'uiDark','head',seg=8,rings=6)
# Visible front incisors below the raised muzzle, plus curled corner canines.
for j in range(5):
    y=(j-2)*.024
    tube('front_incisor'+str(j),[(.968,y,.61),(.970,y,.593),(.972,y,.571)],[.012,.011,.002],'picketWhite','head',N=8)
for s in [-1,1]:
    tube('hero_canine'+str(s),[(.932,s*.099,.618),(.945,s*.10,.58),(.930,s*.098,.538)],[.019,.014,.001],'picketWhite','head',N=10)
# The back stays smooth; patchy wounds and floppy-ear fur carry the infected coat.
for s in [-1,1]:
    for j in range(4):
        tube('cheek_rag'+str(s)+str(j),[(.65-j*.035,s*.168,.62-j*.03),(.65-j*.04,s*.205,.56-j*.028),(.70-j*.055,s*.21,.50-j*.035)],[.041,.028,.001],'asphalt','head',N=8)
# Ragged exposed patches: thick irregular polygons, inset red slashes and fur bordering them.
def wound(name,x,y,z,rx,rz,parent):
    side=1 if y>0 else -1
    pts=[]
    for j in range(14):
        t=2*math.pi*j/14;r=1 if j%2==0 else .72
        pts.append((x+rx*math.cos(t)*r,y,z+rz*math.sin(t)*r))
    v=pts+[(xx,yy-side*.012,zz) for xx,yy,zz in pts];N=len(pts)
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(j,(j+1)%N,(j+1)%N+N,j+N) for j in range(N)]
    mesh(name,v,f,'infectedSkin',parent,0)
    tube(name+'_slash',[(x-.025,y+side*.008,z+rz*.7),(x+.008,y+side*.013,z),(x-.008,y+side*.011,z-rz*.6)],[.010,.016,.004],'blood',parent,N=8)
    for j in range(3):
        ell(name+'_blood'+str(j),(x+rx*.6-j*.024,y+side*.012,z+rz*.55-j*.034),(.013,.007,.013),'blood',parent,seg=8,rings=6)
for s in [-1,1]:
    wound('flank_tear'+str(s),-.42,s*.221,.46,.105,.12,'body')
    wound('shoulder_tear'+str(s),.18,s*.237,.48,.051,.078,'torso')
    wound('ear_tear'+str(s),.46,s*.308,.70,.035,.065,'head')
    wound('rear_tear'+str(s),-.73,s*.197,.48,.045,.066,'body')
# Collar is a separate thick shell around the sloping neck, with a deliberate torn gap.
center=Vector((.475,0,.54));axis=Vector((.58,0,.81)).normalized();u=Vector((0,1,0));v=axis.cross(u)
verts=[];faces=[];N=40
for radius,offset in [(.231,-.035),(.231,.035),(.211,-.035),(.211,.035)]:
    for j in range(N):
        t=.17+(2*math.pi-.38)*j/(N-1)
        point=center+axis*offset+radius*(u*math.cos(t)+v*math.sin(t));verts.append(point)
for j in range(N-1):
    for aa,bb in [(0,N),(2*N,3*N),(0,2*N),(N,3*N)]:faces.append((aa+j,aa+j+1,bb+j+1,bb+j))
faces.extend([(0,N,3*N,2*N),(N-1,2*N-1,4*N-1,3*N-1)])
mesh('torn_collar_shell',verts,faces,'survivorRed','neck',0)
for j in range(12):
    t=.3+j*(2*math.pi-.7)/12;p=center+.241*(u*math.cos(t)+v*math.sin(t))
    ell('collar_rivet'+str(j),p,(.012,.012,.012),'schoolBusYellow','neck',seg=8,rings=6)
box('buckle',(.62,-.205,.48),(.07,.031,.086),'schoolBusYellow','neck',.008,rot=(0,.5,0))
box('buckle_inset',(.627,-.226,.48),(.043,.012,.056),'blood','neck',.006,rot=(0,.5,0))
tube('torn_collar_end',[(.49,.23,.59),(.54,.265,.56),(.58,.27,.50)],[.029,.028,.002],'survivorRed','neck',N=8)
# Hanging brass ring and medallion at the front of the chest.
pts=[(.647+.028*math.cos(j*2*math.pi/24),-.045,.375+.033*math.sin(j*2*math.pi/24)) for j in range(25)]
tube('tag_ring',pts,[.006]*25,'schoolBusYellow','neck',N=6,sub=0)
ell('dog_tag',(.659,-.045,.319),(.009,.038,.045),'schoolBusYellow','neck',rot=(0,.12,0),seg=16,rings=10)
ell('tag_inset',(.669,-.045,.319),(.003,.024,.03),'woodWarm','neck',seg=12,rings=8)
# Hidden stump caps live on the retained parent; zero scale survives glTF export.
caps=[]
for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    p=parts[n].matrix_world.translation.copy();par=parts[n].parent.name
    cap=ell('stump_'+n,p,(.053,.064,.04),'blood',par,seg=12,rings=8);cap['hidden']=True;caps.append(cap)
# Applied simplification retains the subdivided silhouette within the crowd budget.
for o in objects:
    if len(o.data.polygons)>30:
        bpy.context.view_layer.objects.active=o
        modifier=o.modifiers.new('game density','DECIMATE');modifier.ratio=.10
        bpy.ops.object.modifier_apply(modifier=modifier.name)
# Plant all toe/claw geometry exactly at ground level.
bpy.context.view_layer.update()
for n in ['handL','handR','footL','footR']:
    meshes=[o for o in objects if o.parent==parts[n]]
    floor=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
    parts[n].location.z-=floor
# Merge by material and animated parent to keep draw calls purposeful.
buckets={}
for o in objects:
    if o not in caps:buckets.setdefault(o.parent.name,[]).append(o)
joined=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=group[0];o.name=parent+'_surface';joined.append(o)
objects=joined+caps
# Enforce each LOD budget on the joined rigid surfaces, never altering the node graph.
def triangle_count():
    return sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
budget=[7800,3000,1400][a.lod]
for iteration in range(3):
    count=triangle_count()
    if count<=budget:break
    ratio=budget/count*.95
    for o in objects:
        if len(o.data.polygons)>16:
            bpy.context.view_layer.objects.active=o
            modifier=o.modifiers.new('LOD budget','DECIMATE');modifier.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=modifier.name)
assert triangle_count()<=budget, 'LOD budget exceeded'
for cap in caps:cap.scale=(0,0,0)
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]+['body','neck','jaw','tail','legFL','legFR','legBL','legBR','pawFL','pawFR','pawBL','pawBR']
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
(P/('build-stats.json' if a.lod==0 else f'lod{a.lod}-stats.json')).write_text(json.dumps({'triangles':triangles,'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    parts['armL'].rotation_euler.x=.45;parts['foreArmL'].rotation_euler.y=-.55;parts['legR'].rotation_euler.y=-.35
    bpy.data.objects['stump_armL'].scale=(1,1,1);bpy.data.objects['stump_armL']['hidden']=False
    # Detach the other front limb to show a retained-side cap clearly.
    for o in objects:
        parent=o.parent
        while parent:
            if parent==parts['armR']:o.hide_render=True;break
            parent=parent.parent
    bpy.data.objects['stump_armR'].scale=(1,1,1)
if a.render and a.view=='turnaround':
    import numpy as np
    panels=[]
    for name in ['front','side','back','review-hero']:
        im=bpy.data.images.load(str(P/'renders'/f'{name}.png'));w,h=im.size;px=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(px)
        panels.append(px.reshape(h,w,4))
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True);im.pixels.foreach_set(data.ravel());im.filepath_raw=a.render;im.file_format='PNG';im.save();sys.exit(0)
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),400,(1,.83,.69),3);light('cool fill',(1,4,3),230,(.63,.72,1),3);light('amber rim',(-3,1,3.5),500,(1,.46,.2),2)
    bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.data.materials.append(mat('studio','35303b',.88))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-4,2.9),'front':(6,0,1.15),'side':(0,-6,1.15),'back':(-6,0,1.15)}
    cam.location=views.get(a.view,views['hero']);cam.rotation_euler=(Vector((-.12,0,.48))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.05
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True;S.cycles.device='CPU'
    S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG';S.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(objects),'meshes')
