"""Hero infected lion. Deterministic sculpted rigid parts, +X forward / Z up.
All smoothing is applied; export contains no lights, textures, or modifiers.
Run exclusively through experiment/tools/blender_run.py.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render'); parser.add_argument('--glb')
parser.add_argument('--view', default='hero')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
parser.add_argument('--lod', type=int, choices=[0,1,2], default=0)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if args.render and args.view in ['turnaround','pose-sheet']:
    import numpy as np
    panels=[]
    for name in (['front','side','back','review-hero'] if args.view=='turnaround' else ['pose-joints','pose-stump']):
        im=bpy.data.images.load(str(HERE/'renders'/f'{name}.png'));w,h=im.size
        px=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(px)
        panels.append(px.reshape(h,w,4))
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=args.render;sheet.file_format='PNG';sheet.save()
    print('OK turnaround');sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(2309)
parts, meshes, caps = {}, [], []

def material(token, color, rough=.7, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes = True
    rgb = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgba = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = rgba
    return m

materials = {k: material(k,c,r) for k,c,r in [
    ('woodWarm','c38a4f',.76), ('brick','754330',.78),
    ('asphalt','4e3642',.82), ('picketWhite','f2e6dc',.6),
    ('infectedSkin','c9a39a',.68), ('blood','b3121f',.4),
    ('uiDark','25222c',.64), ('sidewalk','b9a4a0',.78)]}
materials['eye'] = material('infectedEye','ff3b2f',.28,3)

def parent_keep(o, parent):
    bpy.context.view_layer.update()
    o.parent = parts[parent]
    o.matrix_parent_inverse = o.parent.matrix_world.inverted()

def node(name, position, parent=None):
    o = bpy.data.objects.new(name,None)
    scene.collection.objects.link(o); o.location = position
    if parent: parent_keep(o,parent)
    parts[name] = o
    return o

def finish(o,name,token,parent,sub=0):
    o.name = name
    o.data.materials.append(materials[token])
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod = o.modifiers.new('Applied sculpt smoothing','SUBSURF'); mod.levels=sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in o.data.polygons: face.use_smooth = True
    parent_keep(o,parent); meshes.append(o)
    return o

def ell(name,pos,size,token,parent,seg=12,rings=8,rot=None,sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=pos)
    o = bpy.context.object; o.scale = size
    if rot: o.rotation_euler = rot
    return finish(o,name,token,parent,sub)

def tube(name,points,radii,token,parent,N=8,sub=1):
    verts, faces = [], []
    for j,p in enumerate(points):
        tangent = Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        tangent.normalize(); u = tangent.cross(Vector((1,0,0)))
        if u.length < .1: u = tangent.cross(Vector((0,1,0)))
        u.normalize(); w = tangent.cross(u)
        rx,ry = (radii[j],radii[j]) if isinstance(radii[j],(float,int)) else radii[j]
        for i in range(N):
            t = i*math.tau/N
            verts.append(Vector(p)+u*rx*math.cos(t)+w*ry*math.sin(t))
    for j in range(len(points)-1):
        for i in range(N):
            k=j*N+i; q=j*N+(i+1)%N
            faces.append((k,q,q+N,k+N))
    faces += [tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))]
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); scene.collection.objects.link(o)
    return finish(o,name,token,parent,sub)

def lock(name,start,bend,tip,width,token='brick',parent='head'):
    p,q,r=map(Vector,[start,bend,tip])
    return tube(name,[p,p.lerp(q,.4),q,q.lerp(r,.7),r],
                [.006,(width*.8,width*.30),(width,width*.33),(width*.44,width*.19),.0015],token,parent)

# A single hierarchy exposes animal joints and the generic infected joint names.
node('root',(0,0,0)); node('hip',(-.58,0,.76),'root')
node('torso',(.03,0,.85),'hip'); node('body',(0,0,.85),'torso')
node('neck',(.46,0,.99),'body'); node('head',(.60,0,1.08),'neck')
node('jaw',(.80,0,.91),'head'); node('backpackSocket',(-.05,0,1.08),'torso')
ell('barrel',(-.16,0,.87),(.76,.30,.33),'woodWarm','body',16,10)
ell('shoulders',(.35,0,.87),(.34,.36,.39),'woodWarm','body')
ell('rump',(-.66,0,.81),(.30,.31,.29),'woodWarm','hip')
ell('belly',(-.15,0,.67),(.52,.245,.19),'infectedSkin','body')
# Forward legs are heavy, rear legs have unmistakable feline hocks.
for side,s in [('L',1),('R',-1)]:
    shoulder=(.43,s*.265,.86); elbow=(.50,s*.32,.49)
    wrist=(.73 if s<0 else .65,s*.35,.19)
    node('arm'+side,shoulder,'torso'); node('legF'+side,shoulder,'arm'+side)
    node('foreArm'+side,elbow,'legF'+side); node('hand'+side,wrist,'foreArm'+side)
    node('pawF'+side,wrist,'hand'+side)
    tube('front_upper'+side,[shoulder,(.45,s*.30,.73),elbow],[.19,.185,.135],'woodWarm','legF'+side,N=10)
    tube('front_lower'+side,[elbow,(.56,s*.34,.35),wrist],[.14,.125,.10],'woodWarm','foreArm'+side,N=10)
    ell('front_elbow'+side,elbow,(.14,.14,.15),'woodWarm','foreArm'+side)
    h=(-.65,s*.22,.78); k=(-.49,s*.30,.47); ankle=(-.82,s*.31,.28); foot=(-.76,s*.33,.13)
    node('leg'+side,h,'hip'); node('legB'+side,h,'leg'+side)
    node('shin'+side,k,'legB'+side); node('foot'+side,foot,'shin'+side)
    node('pawB'+side,foot,'foot'+side)
    ell('haunch'+side,(-.64,s*.26,.66),(.24,.20,.27),'woodWarm','legB'+side)
    tube('rear_hock'+side,[k,(-.72,s*.30,.37),ankle,foot],[.135,.105,.085,.09],'woodWarm','shin'+side,N=10)
    for prefix,pos,parent in [('F',wrist,'pawF'+side),('B',foot,'pawB'+side)]:
        x,y,z=pos; front=prefix=='F'
        ell('paw_'+prefix+side,(x+.035,y,.12),(.20 if front else .155,.155 if front else .13,.12),'woodWarm',parent)
        ell('paw_pad_'+prefix+side,(x+.035,y,.037),(.16,.12,.034),'asphalt',parent,seg=10,rings=6)
        for j in range(4):
            ty=y+(j-1.5)*(.074 if front else .061)
            ell('toe_'+prefix+side+str(j),(x+.15,ty,.10),(.078,.052,.072),'woodWarm',parent,seg=10,rings=6)
            tube('claw_'+prefix+side+str(j),[(x+.183,ty,.104),(x+.24,ty,.079),(x+.259,ty,.028)],
                 [.027,.022,.003],'uiDark',parent,N=7)
        for j in range(3):
            lock('leg_fur_'+prefix+side+str(j),(x-.045,y+s*.04,z+.15+j*.035),
                 (x-.045,y+s*.105,z+.14+j*.035),(x-.10,y+s*.15,z+.05+j*.035),.049,'woodWarm',parent)
# The tail is a soft curve, not an angular cylinder.
node('tail',(-.84,0,.89),'hip')
tail_points=[(-.84,0,.89),(-1.05,.03,.84),(-1.24,.10,.63),(-1.50,.12,.58),(-1.68,.11,.71),(-1.70,.09,.86)]
tube('tail_curve',tail_points,[.060,.055,.045,.038,.035,.026],'woodWarm','tail',N=10)
ell('tail_tuft',(-1.69,.09,.87),(.10,.09,.13),'asphalt','tail')
for i in range(9):
    t=i*math.tau/9
    lock('tuft_'+str(i),(-1.65,.09,.78),(-1.70+.08*math.cos(t),.09+.075*math.sin(t),.9),
         (-1.78+.13*math.cos(t),.09+.12*math.sin(t),1.04+(i%3)*.017),.064,'brick' if i%3==0 else 'asphalt','tail')
# Mane core and sculpted directional locks: three layered rings around the face.
ell('mane_core',(.40,0,1.04),(.34,.40,.45),'asphalt','head',16,10)
for layer in range(4):
    for i in range(18):
        t=i*math.tau/18 + layer*.19
        cy,sz=math.cos(t),math.sin(t)
        cx=.10+layer*.19
        start=(cx+.05,.35*cy,1.04+.39*sz)
        bend=(cx+.015,.47*cy,1.04+.54*sz)
        tip=(cx-.13,.55*cy,1.04+.64*sz)
        # Feline mane sweeps down and back rather than forming a radial sunburst.
        tip=(tip[0]-.025,tip[1]-.018,tip[2]-.08)
        token='brick' if (i+layer)%4 else 'asphalt'
        lock('mane_ring_%d_%d'%(layer,i),start,bend,tip,.13+(i%3)*.012,token)
for i in range(16):
    t=i*math.tau/16
    cy,sz=math.cos(t),math.sin(t)
    lock('face_mane_'+str(i),(.67,.30*cy,1.07+.34*sz),
         (.80,.39*cy,1.07+.46*sz),(.73,.49*cy,1.07+.57*sz-.095),.095,'brick' if i%4 else 'asphalt')
# Broad nape locks cover the rear core where the body meets the mane.
for i in range(11):
    y=(i-5)*.065
    lock('nape_'+str(i),(.07,y*.75,1.52-abs(i-5)*.016),
         (-.01,y,1.37-abs(i-5)*.018),(-.06,y*1.10,1.12-abs(i-5)*.018),.082,'brick' if i%3 else 'asphalt')
# Crown crest and cheek drapes wrap the huge face.
for i in range(7):
    y=(i-3)*.066
    lock('crown_'+str(i),(.56,y,1.35),(.67,y-.024,1.49),(.47,y-.075,1.67-abs(i-3)*.028),.082,'brick')
for s in [-1,1]:
    for i in range(6):
        lock('cheek_mane_%d_%d'%(s,i),(.72,s*(.26+i*.012),1.22-i*.053),
             (.67,s*(.34+i*.015),1.13-i*.063),(.48,s*(.42+i*.008),.99-i*.068),.09,'brick' if i%3 else 'asphalt')
for i in range(5):
    y=(i-2)*.092
    lock('forehead_fringe'+str(i),(.61,y*.75,1.49),(.81,y,1.43),(.87,y*1.14,1.33+abs(i-2)*.025),.083,'brick')
# Lion skull, temples, short broad muzzle, real open maw.
ell('skull',(.73,0,1.19),(.255,.26,.25),'woodWarm','head',16,10)
for s in [-1,1]:
    ell('ear_outer'+str(s),(.55,s*.29,1.40),(.092,.080,.105),'woodWarm','head')
    ell('ear_inner'+str(s),(.607,s*.30,1.412),(.019,.046,.059),'asphalt','head')
    ell('cheekbone'+str(s),(.84,s*.195,1.11),(.115,.11,.10),'woodWarm','head')
    ell('socket'+str(s),(.915,s*.137,1.285),(.035,.083,.061),'asphalt','head')
    ell('red_eye'+str(s),(.946,s*.135,1.286),(.024,.060,.037),'eye','head')
    ell('eye_core'+str(s),(.967,s*.132,1.29),(.009,.014,.016),'picketWhite','head',seg=8,rings=6)
    tube('angry_brow'+str(s),[(.946,s*.057,1.306),(.937,s*.137,1.348),(.86,s*.212,1.346)],
         [.033,.043,.025],'woodWarm','head',N=8)
    ell('muzzle_lobe'+str(s),(.984,s*.086,1.154),(.11,.105,.072),'picketWhite','head')
    ell('muzzle_red'+str(s),(1.052,s*.086,1.137),(.025,.085,.040),'infectedSkin','head')
    for j in range(4):
        ell('whisker_pore%d%d'%(s,j),(1.076-abs(j-1.5)*.009,s*(.052+j*.026),1.166-(j%2)*.024),
            (.007,.010,.007),'uiDark','head',seg=8,rings=6)
# The cavity lies in front of the skull and between independent upper/lower jaws.
ell('maw',(.931,0,1.006),(.071,.147,.144),'uiDark','head',16,10)
loop=[(.983,.147*math.cos(i*math.tau/24),1.008+.144*math.sin(i*math.tau/24)) for i in range(25)]
tube('torn_lip',loop,[.014]*25,'blood','head',N=6)
ell('lower_jaw',(.95,0,.854),(.125,.147,.046),'infectedSkin','jaw')
ell('chin',(.943,0,.819),(.109,.114,.036),'picketWhite','jaw')
ell('tongue',(.997,0,.909),(.040,.067,.038),'blood','jaw')
ell('nose_bridge',(.929,0,1.235),(.10,.075,.074),'woodWarm','head')
ell('nose', (1.077,0,1.199),(.044,.074,.037),'uiDark','head')
for s in [-1,1]:
    ell('nostril'+str(s),(1.105,s*.038,1.199),(.009,.018,.010),'asphalt','head',seg=8,rings=6)
    tube('fang_upper'+str(s),[(1.021,s*.114,1.122),(1.042,s*.118,1.036),(1.03,s*.108,.973)],
         [.028,.021,.002],'picketWhite','head',N=8)
    tube('fang_lower'+str(s),[(1.002,s*.11,.872),(1.035,s*.11,.927),(1.035,s*.108,.959)],
         [.025,.017,.002],'picketWhite','jaw',N=8)
for row in [0,1]:
    for j in range(5):
        y=(j-2)*.030; z=1.12 if row==0 else .874; dz=-.030 if row==0 else .029
        tube('incisor_%d_%d'%(row,j),[(1.052,y,z),(1.064,y,z+dz)], [.013,.006], 'picketWhite','head' if row==0 else 'jaw',N=6)
tube('cheek_scar',[(.90,-.215,1.21),(.935,-.204,1.17),(.965,-.169,1.12)], [.011,.014,.009],'blood','head',N=6)
for i in range(3):
    ell('muzzle_blood'+str(i),(1.085,-.075+i*.03,1.144-i*.014),(.006,.013,.011),'blood','head',seg=8,rings=6)
# Small golden fur ridges make the bare body read as sculpted skin/fur.
for s in [-1,1]:
    for i in range(8):
        x=-.76+i*.15
        lock('spine_fur%d%d'%(s,i),(x,s*.04,1.10),(x-.03,s*.11,1.17),
             (x-.13,s*.17,1.17),.045,'woodWarm','body')
    for i in range(4):
        lock('belly_fur%d%d'%(s,i),(-.45+i*.18,s*.16,.64),(-.50+i*.18,s*.23,.60),
             (-.56+i*.18,s*.20,.51),.052,'infectedSkin','body')
# Raised irregular wound islands project directly onto their intended skin surface.
def wound(name,target,center,rx,rz,parent,s):
    obj=bpy.data.objects[target]; bpy.context.view_layer.update()
    points=[]; x,y,z=center; count=13
    for i in range(count):
        t=i*math.tau/count; r=[1,.81,1.13,.72,.87,.96,.69,1.10,.91,.63,1.02,.83,.76][i]
        points.append(Vector((x+rx*math.cos(t)*r,s*1.2,z+rz*math.sin(t)*r)))
    points.insert(0,Vector((x,s*1.2,z)))
    direction=Vector((0,-s,0)); inv=obj.matrix_world.inverted()
    for p in points:
        hit,loc,normal,_=obj.ray_cast(inv@p,inv.to_3x3()@direction)
        if hit: p[:]=obj.matrix_world@loc+Vector((0,s*.004,0))
    data=bpy.data.meshes.new(name); data.from_pydata(points,[],[(0,i+1,(i+1)%count+1) for i in range(count)]);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    finish(o,name,'asphalt',parent)
    # Torn skin forms an irregular flat border, not a row of beads.
    border=[]
    c=points[0]
    for p in points[1:]:
        border.extend([p+Vector((0,s*.009,0)),c.lerp(p,.72)+Vector((0,s*.013,0))])
    data=bpy.data.meshes.new(name+'_torn_skin')
    data.from_pydata(border,[],[(i*2,((i+1)%count)*2,((i+1)%count)*2+1,i*2+1) for i in range(count)])
    data.update();o=bpy.data.objects.new(name+'_torn_skin',data);scene.collection.objects.link(o)
    finish(o,o.name,'infectedSkin',parent)
    inner=[c+Vector((0,s*.018,0))]+[c.lerp(p,.48 if j%2 else .62)+Vector((0,s*.018,0)) for j,p in enumerate(points[1:])]
    data=bpy.data.meshes.new(name+'_raw');data.from_pydata(inner,[],[(0,i+1,(i+1)%count+1) for i in range(count)]);data.update()
    o=bpy.data.objects.new(name+'_raw',data);scene.collection.objects.link(o);finish(o,o.name,'blood',parent)
for s in [-1,1]:
    for i,(x,z,rx,rz) in enumerate([(-.54,.98,.12,.12),(-.17,1.01,.071,.15),(.10,.85,.095,.09)]):
        wound('flank_%d_%d'%(s,i),'barrel',(x,s*.3,z),rx,rz,'body',s)
    side='L' if s>0 else 'R'
    wound('front_scar'+side,'front_lower'+side,(.58,s*.36,.38),.067,.082,'foreArm'+side,s)
    wound('haunch_scar'+side,'haunch'+side,(-.68,s*.40,.72),.075,.10,'legB'+side,s)
# Hidden cap meshes stay attached to the retained parent, at the severance plane.
for joint in ['head','armL','armR','foreArmL','foreArmR','legL','legR','legFL','legFR','legBL','legBR']:
    pos=parts[joint].matrix_world.translation.copy()
    parent=parts[joint].parent.name
    r=.12 if 'Arm' in joint else .16
    shape=(.022,r,r) if joint=='head' else (r,r,.025)
    if joint in ['armL','armR','legFL','legFR']:
        pos.z-=.18
        pos.y+=.055 if joint.endswith('L') else -.055
    o=ell('stump_'+joint,pos,shape,'blood',parent,seg=8,rings=4,sub=0)
    o['hidden']=True; o['detached_joint']=joint; o.scale=(0,0,0)
    caps.append(o)
# Merge static details into one multi-material mesh per rigid parent. Joint nodes survive.
buckets={}
for o in meshes:
    if o not in caps: buckets.setdefault(o.parent.name,[]).append(o)
merged=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    o=group[0];o.name=parent+'__surface';merged.append(o)
# Applied collapse preserves sculpted silhouettes within the infected hero budget.
for o in merged:
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Applied hero density','DECIMATE');mod.ratio=[.235,.030,.008][args.lod]
    bpy.ops.object.modifier_apply(modifier=mod.name)
meshes=merged+caps
bpy.context.view_layer.update()
floor=min((o.matrix_world@v.co).z for o in merged for v in o.data.vertices)
parts['root'].location.z-=floor
bpy.context.view_layer.update()
required=['root','hip','torso','body','neck','head','jaw','tail','backpackSocket']
required += [p+s for p in ['arm','foreArm','hand','leg','shin','foot'] for s in ['L','R']]
required += [p+s for p in ['legF','legB','pawF','pawB'] for s in ['L','R']]
required += ['stump_'+j for j in ['head','armL','armR','foreArmL','foreArmR','legL','legR','legFL','legFR','legBL','legBR']]
triangles=sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)
(HERE/('build-stats.json' if args.lod==0 else f'lod{args.lod}-stats.json')).write_text(json.dumps({'triangles':triangles,'meshes':len(meshes),'missing_nodes':[n for n in required if n not in bpy.data.objects],
    'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()}},indent=2))
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=args.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if args.pose:
    parts['armL'].rotation_euler.y=-.42
    parts['foreArmL'].rotation_euler.y=.65
    parts['legR'].rotation_euler.y=.40
    # Actual amputation exposes the retained shoulder cap on the posed front leg.
    if args.view=='pose-stump':
        for o in meshes:
            p=o.parent
            while p:
                if p == parts['armL']: o.hide_render=True; break
                p=p.parent
        cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    else:
        cap=bpy.data.objects['stump_armL']
    (HERE/'pose-proof.json').write_text(json.dumps({'rotated':['armL','foreArmL','legR'],'stump_armL_visible':args.view in ['pose-stump','pose-all'],
        'rotations':{n:list(parts[n].rotation_euler) for n in ['armL','foreArmL','legR']},
        'cap_parent':cap.parent.name,'cap_position':list(cap.matrix_world.translation)},indent=2))
if args.render:
    world=bpy.data.worlds.new('Studio');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.070,.062,.086,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(name,pos,power,color,size):
        data=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
        o.location=pos;data.energy=power;data.color=color;data.shape='DISK';data.size=size
        o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('Warm key',(4,-4,6),650,(1,.81,.64),4)
    light('Cool fill',(1,4,3),320,(.64,.73,1),3)
    light('Golden rim',(-3,2,4),750,(1,.48,.22),3)
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(material('studio','302c37',.87))
    camera=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));scene.collection.objects.link(camera);scene.camera=camera
    target=Vector((-.2,0,.81))
    views={'hero':(6,-8,4.4),'front':(7,0,1.5),'side':(0,-7,1.5),'back':(-7,0,1.5),'pose-joints':(6,8,3.5),'pose-stump':(6,8,3.5),'pose-all':(6,8,3.5)}
    camera.location=views.get(args.view,views['hero'])
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=4.15
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.cycles.device='CPU'
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=args.render
    if args.view=='pose-all':
        scene.render.filepath=str(HERE/'renders'/'pose-joints.png')
        bpy.ops.render.render(write_still=True)
        for o in meshes:
            p=o.parent
            while p:
                if p==parts['armL']: o.hide_render=True;break
                p=p.parent
        cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
        scene.render.filepath=str(HERE/'renders'/'pose-stump.png')
        bpy.ops.render.render(write_still=True)
    elif args.view=='review-all':
        for view in ['front','side','back','hero']:
            camera.location=views[view]
            camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            name='review-hero' if view=='hero' else view
            scene.render.filepath=str(HERE/'renders'/f'{name}.png')
            bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(meshes),'meshes')
