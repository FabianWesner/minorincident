"""Hero infected golden retriever. Deterministic, rigid joint hierarchy, +X forward.
Build/render only via experiment/tools/blender_run.py; no external textures.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools' / 'blender'))
from sslib import palette

ASSET = {'id': 'inf.dog-retriever', 'category': 'infected'}
parser = argparse.ArgumentParser()
for name in ['render', 'glb']:
    parser.add_argument('--' + name)
parser.add_argument('--view', default='hero')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
parser.add_argument('--amputate', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
parts, meshes = {}, []
fur_objects = set()
materials = {n: palette.mat(n) for n in ['brass', 'corgiOrange', 'corgiOrangeLight', 'woodWarm', 'canvasTan', 'bandage', 'picketWhite', 'uiDark', 'blood', 'redDark', 'survivorRed', 'skinShadow', 'infectedSkin', 'silver']}
materials['eye'] = palette.mat('infectedEye', emissive=True)
materials['eyeCore'] = palette.mat('picketWhite', emissive=True)
materials['eye'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .7
for n, m in materials.items():
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = .78 if n in ['brass','corgiOrange','corgiOrangeLight','woodWarm','canvasTan','bandage'] else .46
    if n == 'silver':
        bsdf.inputs['Metallic'].default_value = .7
    if n == 'brass':
        bsdf.inputs['Roughness'].default_value = .7

def parent_to(obj, parent):
    bpy.context.view_layer.update()
    obj.parent = parts[parent]
    obj.matrix_parent_inverse = obj.parent.matrix_world.inverted()

def node(name, position, parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = position
    if parent:
        parent_to(obj, parent)
    parts[name] = obj
    return obj

def finish(obj, name, material, parent, sub=0):
    obj.name = name
    obj.data.materials.append(materials[material])
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if sub:
        modifier = obj.modifiers.new('Applied sculpt smoothing', 'SUBSURF')
        modifier.levels = sub
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    parent_to(obj, parent)
    meshes.append(obj)
    return obj

def ell(name, position, radius, material, parent, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if name.startswith('stump_') else 10, ring_count=4 if name.startswith('stump_') else 6, location=position)
    obj = bpy.context.object
    obj.scale = radius
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, material, parent, 0 if name.startswith('stump_') else 1)

def mesh(name, vertices, faces, material, parent, sub=1):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, name, material, parent, sub)

def tube(name, points, radii, material, parent, sides=8, sub=1):
    sides=min(sides,6)
    vertices, faces = [], []
    for j, point in enumerate(points):
        tangent = Vector(points[min(j+1, len(points)-1)]) - Vector(points[max(0,j-1)])
        tangent.normalize()
        u = tangent.cross(Vector((0,1,0)))
        if u.length < .1:
            u = tangent.cross(Vector((0,0,1)))
        u.normalize()
        w = tangent.cross(u)
        radius = radii[j]
        rx, ry = (radius, radius) if isinstance(radius, (float,int)) else radius
        for i in range(sides):
            t = i * math.tau / sides
            vertices.append(Vector(point) + rx*u*math.cos(t) + ry*w*math.sin(t))
    for j in range(len(points)-1):
        for i in range(sides):
            k = j*sides+i
            nxt = j*sides+(i+1)%sides
            faces.append((k,nxt,nxt+sides,k+sides))
    faces += [tuple(range(sides-1,-1,-1)), tuple((len(points)-1)*sides+i for i in range(sides))]
    return mesh(name, vertices, faces, material, parent, sub)

def lock(name, start, bend, tip, width, material, parent):
    a,b,c = map(Vector,[start,bend,tip])
    obj=tube(name,[a,a.lerp(b,.45),b,b.lerp(c,.65),c],
             [.015,(width*.8,width*.52),(width,width*.55),(width*.4,width*.22),.002],material,parent,6)
    fur_objects.add(obj)
    return obj

def box(name, position, size, material, parent, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj=bpy.context.object
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('Soft edge','BEVEL');mod.width=bevel;mod.segments=3
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,material,parent)

node('root',(0,0,0))
node('hip',(-.43,0,.65),'root')
node('body',(0,0,.68),'hip')
node('torso',(.27,0,.72),'body')
node('neck',(.4,0,.82),'torso')
node('head',(.48,0,.91),'neck')
node('jaw',(.57,0,.79),'head')
node('tail',(-.68,0,.72),'hip')
node('backpackSocket',(.05,0,.91),'torso')
ell('Barrel ribcage',(-.04,0,.675),(.55,.238,.252),'brass','body')
ell('Haunch',(-.49,0,.65),(.246,.25,.236),'corgiOrange','hip')
ell('Deep chest',(.29,0,.67),(.245,.272,.30),'corgiOrangeLight','torso')
ell('Ruff core',(.37,0,.82),(.225,.251,.24),'brass','neck')
ell('Cream bib',(.47,0,.64),(.10,.198,.22),'canvasTan','torso')
# Layered feathering follows the flank contours; each lock is a rounded tapered volume.
for row in range(4):
    x=.30-row*.25
    for j in range(11):
        angle=j*math.tau/11+.17*(row%2)
        y=.221*math.sin(angle);z=.686+.215*math.cos(angle)+.012*math.sin(j*4.7+row)
        xj=x+.035*math.sin(j*3.1+row*1.7)
        start=(xj+.1,y*.86,.686+(z-.686)*.84)
        bend=(xj,y,z)
        tip=(xj-.10-(j%3)*.025,y*1.14,z-.10-(j%4)*.014)
        token=['brass','corgiOrange','brass','woodWarm'][((j+row*2)%4)]
        lock('Body feather %s %s'%(row,j),start,bend,tip,.057+(j%3)*.007,token,'body' if row<3 else 'hip')
for row in range(2):
    for j in range(10):
        t=j*math.tau/10+.16*row
        x=.385+.20*math.cos(t);y=.235*math.sin(t);z=.86-row*.16
        lock('Mane feather %s %s'%(row,j),(x-.025,y*.78,z+.11),(x,y,z+.025),
             (x+.035,y*1.15,z-.12),.081,'canvasTan' if math.cos(t)>.4 and row>0 else ['brass','corgiOrangeLight','corgiOrange'][j%3],'neck')
# Cranial face: large skull, hung retriever ears, broad muzzle, deep snarling cavity.
ell('Skull',(.535,0,.975),(.257,.227,.217),'corgiOrangeLight','head')
ell('Occiput',(.415,0,1.021),(.188,.214,.173),'brass','head')
ell('Mouth darkness',(.753,0,.797),(.142,.133,.161),'uiDark','head')
for sign in [-1,1]:
    ell('Forehead orbital mass '+str(sign),(.651,sign*.13,1.015),(.098,.096,.114),'brass','head')
    ell('Cheek '+str(sign),(.591,sign*.158,.884),(.124,.10,.143),'brass','head')
    ell('Muzzle lobe '+str(sign),(.793,sign*.075,.932),(.143,.094,.079),'canvasTan','head')
    ell('Orbital wound '+str(sign),(.684,sign*.153,1.043),(.041,.064,.076),'redDark','head')
    ell('Eye black socket '+str(sign),(.711,sign*.155,1.047),(.02,.053,.059),'uiDark','head')
    ell('Burning eye '+str(sign),(.728,sign*.153,1.048),(.018,.040,.046),'eye','head')
    ell('Eye bright core '+str(sign),(.743,sign*.147,1.053),(.004,.014,.019),'eyeCore','head')
    tube('Angry brow '+str(sign),[(.733,sign*.088,1.097),(.689,sign*.146,1.124),(.611,sign*.201,1.117)], [.022,.034,.014],'brass','head')
    tube('Floppy ear '+str(sign),[(.43,sign*.19,1.091),(.41,sign*.254,1.019),(.373,sign*.283,.89),(.425,sign*.275,.795)],
         [(.08,.045),(.113,.065),(.103,.05),(.058,.024)],'woodWarm','head',10)
    ell('Hanging ear volume '+str(sign),(.41,sign*.28,.95),(.11,.065,.179),'woodWarm','head',rotation=(0,-.18,0))
    ell('Ear inner fold '+str(sign),(.458,sign*.334,.963),(.038,.012,.083),'brass','head')
    for j in range(5):
        z=1.091-j*.058
        lock('Ear shag %s %s'%(sign,j),(.389,sign*.265,z+.035),(.376-(j%2)*.04,sign*.312,z),
             (.40,sign*.328,z-.105),.048,'brass' if j%2 else 'corgiOrange','head')
    for j in range(4):
        lock('Cheek shag %s %s'%(sign,j),(.53,sign*.17,.98-j*.048),(.555,sign*.232,.955-j*.055),
             (.5,sign*.278,.84-j*.05),.05,'corgiOrangeLight' if j%2 else 'brass','head')
    # Dark whisker follicles, no floating hairs.
    for j in range(4):
        ell('Whisker pore %s %s'%(sign,j),(.864-(j%2)*.029,sign*(.073+(j//2)*.04),.916+(j%2)*.025),(.005,.007,.005),'woodWarm','head')
    tube('Face blood trail '+str(sign),[(.735,sign*.186,1.026),(.733,sign*.185,.961),(.712,sign*.177,.86)],[.011,.009,.003],'blood','head',6)
# Forehead locks emphasize asymmetry and thick matted hair.
for j in range(7):
    y=-.17+j*.056
    lock('Crown swept lock '+str(j),(.38,y,1.125),(.48,y-.012,1.195+(j%2)*.015),(.64,y-.025,1.103+(j%3)*.015),.062,
         'corgiOrange' if j%3==0 else 'brass','head')
ell('Nose bridge',(.755,0,.992),(.094,.088,.069),'corgiOrangeLight','head')
ell('Black velvet nose',(.907,0,.968),(.07,.077,.048),'uiDark','head')
for sign in [-1,1]:
    ell('Nostril '+str(sign),(.962,sign*.038,.965),(.012,.018,.01),'redDark','head')
ell('Nose glint',(.949,-.019,.994),(.011,.017,.007),'silver','head')
ell('Lower jaw fur',(.724,0,.683),(.16,.121,.061),'canvasTan','jaw')
ell('Lower gum',(.76,0,.716),(.145,.111,.028),'blood','jaw')
ell('Upper gum',(.8,0,.875),(.133,.125,.021),'redDark','head')
for sign in [-1,1]:
    # Lips run from mouth corner to the tip of the jaw, leaving the opening empty.
    tube('Snarling lip '+str(sign),[(.663,sign*.128,.855),(.749,sign*.143,.814),(.835,sign*.114,.725),(.884,sign*.062,.709)],[.019,.019,.016,.012],'redDark','jaw')
    for row in [0,1]:
        for j in range(4):
            x=.71+j*.048;y=sign*(.132 if j==2 else .116-.011*j);z=.882 if row==0 and j==2 else .867 if row==0 else .727
            length=.106 if j==2 and row==0 else .04 if j==1 and row==1 else .025
            tube('Fang %s %s %s'%(sign,row,j),[(x,y,z),(x+.007,y*.98,z+(-.017 if row==0 else .012)),(x+.016,y*.96,z+(-length if row==0 else length))],[.014,.014,.001],'picketWhite','head' if row==0 else 'jaw',8)
for j in range(5):
    y=(j-2)*.031
    box('Front incisor '+str(j),(.908,y,.858),(.021,.023,.035),'picketWhite','head',.006)
ell('Tongue',(.806,0,.736),(.06,.05,.025),'survivorRed','jaw')
tube('Tongue groove',[(.858,0,.746),(.822,0,.76),(.775,0,.75)],[.003]*3,'redDark','jaw',6,0)
for j in range(3):
    tube('Chin blood drip '+str(j),[(.859,-.062+j*.06,.689),(.857,-.062+j*.06,.658),(.853,-.062+j*.06,.628+j*.006)],[.008,.006,.002],'blood','jaw',6)
# Thick red leather collar, oblique around the neck in the turnaround.
points=[]
for j in range(33):
    t=j*math.tau/32
    points.append((.392+.162*math.cos(t),.266*math.sin(t),.781-.126*math.cos(t)))
tube('Collar leather',points,[(.038,.017)]*len(points),'survivorRed','neck',8)
for offset in [-.029,.029]:
    pts=[(x+offset*.55,y,z+offset) for x,y,z in points]
    tube('Collar rolled piping '+str(offset),pts,[.006]*len(pts),'redDark','neck',6,0)
box('Buckle frame',(.549,-.091,.66),(.048,.092,.07),'brass','neck',.01)
box('Buckle inset',(.575,-.091,.66),(.009,.060,.043),'redDark','neck',.005)
box('Buckle tongue',(.583,-.091,.66),(.01,.065,.008),'brass','neck',.003)
for j in range(6):
    t=math.pi*(.22+j*.18)
    ell('Collar stud '+str(j),(.396+.176*math.cos(t),-.282*math.sin(t),.783-.126*math.cos(t)),(.009,.007,.009),'silver','neck')
ring=[]
for j in range(17):
    t=j*math.tau/16;ring.append((.563,-.021+.026*math.cos(t),.629+.026*math.sin(t)))
tube('Tag attachment ring',ring,[.006]*len(ring),'brass','neck',6,0)
ell('Round brass ID tag',(.574,-.021,.567),(.018,.058,.063),'brass','neck')
ell('ID tag inset',(.592,-.021,.567),(.004,.046,.051),'corgiOrange','neck')
for j,(yy,zz,rr) in enumerate([(-.025,.548,.022),(-.05,.583,.009),(-.027,.59,.009),(-.004,.583,.009)]):
    ell('Tag paw emboss '+str(j),(.599,yy,zz),(.003,rr,rr),'woodWarm','neck')
# Rigid limbs. The lifted left front paw echoes the lunge in the reference.
for sign,side in [(1,'L'),(-1,'R')]:
    shoulder=(.3,sign*.206,.707)
    elbow=(.42,sign*.226,.45 if side=='R' else .52)
    wrist=(.65 if side=='R' else .73,sign*.246,.145 if side=='R' else .32)
    node('arm'+side,shoulder,'torso')
    node('legF'+side,shoulder,'arm'+side)
    node('foreArm'+side,elbow,'legF'+side)
    node('hand'+side,wrist,'foreArm'+side)
    node('pawF'+side,wrist,'hand'+side)
    ell('Wrist joint '+side,wrist,(.067,.069,.080),'canvasTan','hand'+side)
    tube('Front upper '+side,[shoulder,(.33,sign*.24,.637),elbow],[.112,.119,.088],'corgiOrangeLight','legF'+side,10)
    tube('Front lower '+side,[elbow,(.52,sign*.237,.348 if side=='R' else .43),wrist],[.084,.075,.061],'canvasTan','foreArm'+side,10)
    for j in range(5):
        z=.645-j*.041
        lock('Front feather %s %s'%(side,j),(.318,sign*.236,z+.026),(.3,sign*.292,z),(.26,sign*.305,z-.09),.047,'brass','legF'+side)
    hp=(-.46,sign*.178,.66);knee=(-.33,sign*.224,.422);hock=(-.64,sign*.239,.232);ankle=(-.65,sign*.248,.105)
    node('leg'+side,hp,'hip');node('legB'+side,hp,'leg'+side)
    node('shin'+side,knee,'legB'+side);node('foot'+side,ankle,'shin'+side);node('pawB'+side,ankle,'foot'+side)
    ell('Ankle joint '+side,ankle,(.068,.065,.080),'canvasTan','foot'+side)
    tube('Hind haunch '+side,[hp,(-.47,sign*.226,.562),knee],[.141,.142,.085],'brass','legB'+side,10)
    tube('Bent rear hock '+side,[knee,(-.45,sign*.246,.35),hock,ankle],[.077,.07,.06,.054],'canvasTan','shin'+side,10)
    for j in range(5):
        lock('Haunch feather %s %s'%(side,j),(-.47-j*.023,sign*.244,.68-j*.043),(-.54-j*.02,sign*.29,.64-j*.038),(-.63-j*.018,sign*.29,.59-j*.046),.053,'corgiOrangeLight' if j%2 else 'brass','legB'+side)
    for limb,point in [('F',wrist),('B',ankle)]:
        x,y,z=point;parent='paw'+limb+side
        paw_z=.068 if limb=='B' or side=='R' else .253
        ell('Paw mass '+limb+side,(x+.031,y,paw_z+.028),(.111,.095,.08),'canvasTan',parent)
        for j in range(4):
            yy=y+(j-1.5)*.047
            ell('Toe '+limb+side+str(j),(x+.094,yy,paw_z),(.066,.029,.059),'canvasTan',parent)
            tube('Claw '+limb+side+str(j),[(x+.13,yy,paw_z+.024),(x+.155,yy,paw_z+.014),(x+.172,yy,paw_z-.024)],[.016,.014,.002],'uiDark',parent,8)
        ell('Paw underside pad '+limb+side,(x+.04,y,paw_z-.047),(.052,.055,.018),'woodWarm',parent)
# Upturned feathered tail, not a thin cat tail.
tube('Tail core',[(-.65,0,.75),(-.86,0,.79),(-1.09,.014,.91),(-1.3,.035,1.094)],[.115,.112,.092,.014],'brass','tail',10)
for row in range(3):
    x=-.74-row*.21;z=.774+row*.063
    for j in range(6):
        t=j*math.tau/6
        y=.095*math.sin(t);zz=z+.085*math.cos(t)
        lock('Tail plume %s %s'%(row,j),(x+.055,y*.6,zz), (x-.06,y,zz+.015),
             (x-.25,y*1.46,zz+.09 if j in [0,1,5] else zz-.09),.06,'corgiOrangeLight' if j%3==0 else 'brass','tail')
# Purposeful wounds: scalloped flesh borders, recessed dark cores and ragged fur edges.
def wound(name, position, size, parent):
    x,y,z=position;rx,ry,rz=size
    direction=-1 if y<0 else 1
    # Irregular ring with a recessed center; no bulbous wound decals.
    vertices=[]
    for ring in [1,.72]:
        for j in range(12):
            t=j*math.tau/12
            ragged=1+(.12 if j%3==0 else -.07 if j%3==1 else .03)
            vertices.append((x+rx*ring*ragged*math.cos(t),y+direction*(.004 if ring==1 else .008),z+rz*ring*ragged*math.sin(t)))
    faces=[(j,(j+1)%12,(j+1)%12+12,j+12) for j in range(12)]
    mesh(name+' torn rim',vertices,faces,'redDark',parent,0)
    mesh(name+' recessed wound',vertices[12:],[tuple(range(12))],'uiDark',parent,0)
    for j in range(2):
        tube(name+' flesh ridge '+str(j),[(x-rx*.42,y+direction*.011,z+rz*(.18-j*.35)),(x,y+direction*.014,z+rz*(.12-j*.35)),(x+rx*.38,y+direction*.012,z+rz*(.08-j*.35))],[.007,.009,.003],'blood',parent,6,0)
    for j in range(3):
        xx=x-rx*.7+j*rx*.6
        tube(name+' wet streak '+str(j),[(xx,y+direction*.006,z-rz*.4),(xx-.008,y+direction*.006,z-rz*.9),(xx-.006,y,z-rz*1.25)], [.006,.004,.001],'blood',parent,6,0)
wound('Open flank',(-.25,-.284,.753),(.10,.017,.092),'body')
wound('Rear flank',(-.49,.278,.709),(.06,.015,.056),'hip')
wound('Foreleg bite',(.53,-.302,.337),(.05,.012,.058),'foreArmR')
wound('Hind leg wound',(-.60,-.279,.269),(.05,.012,.037),'shinR')
wound('Tail wound',(-1.12,-.094,.918),(.06,.012,.046),'tail')
for j in range(3):
    tube('Flank scratch '+str(j),[(-.21+j*.034,-.272,.794),(-.245+j*.03,-.28,.742),(-.267+j*.03,-.27,.703)], [.008,.011,.003],'blood','body',6)
# Stumps on proximal parents remain after the distal limb is removed.
caps=[]
for key,proximal in [('head','neck'),('armL','torso'),('armR','torso'),('foreArmL','legFL'),('foreArmR','legFR'),('legL','hip'),('legR','hip'),('legFL','torso'),('legFR','torso'),('legBL','hip'),('legBR','hip')]:
    p=parts[key].matrix_world.translation.copy()
    # Place the cut face at the outer socket surface of the thick coat.
    if key in ['armL','armR','legFL','legFR']:
        p.y=.282 if key.endswith('L') else -.282
    elif key in ['legL','legR','legBL','legBR']:
        p.y=.27 if key.endswith('L') else -.27
    elif key=='head':
        p.x+=.17
    cap=ell('stump_'+key,p,(.077,.019,.077) if key!='head' else (.019,.09,.075),'blood',proximal)
    cap['hidden']=True;cap['stumpFor']=key;cap['visibleScale']=[1,1,1]
    cap.scale=(0,0,0);caps.append(cap)
# Reduce applied subdivision without changing silhouette, then merge static geometry per joint.
for obj in meshes:
    bpy.context.view_layer.objects.active=obj
    if len(obj.data.polygons)>24 and not obj.name.startswith('stump_'):
        mod=obj.modifiers.new('Hero mesh economy','DECIMATE');mod.ratio=.11 if obj.parent.name != 'head' else .21
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
# Face mask lets the distant LOD discard small locks while retaining solid anatomy.
for obj in meshes:
    mask=obj.data.attributes.new('lod_fur','INT','FACE')
    mask.data.foreach_set('value',[int(obj in fur_objects)]*len(obj.data.polygons))
groups={}
for obj in meshes:
    if obj not in caps:
        groups.setdefault((obj.parent.name,any(m.name.startswith('emi_') for m in obj.data.materials)),[]).append(obj)
merged=[]
for (parent,emissive),group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    bpy.ops.object.join()
    obj=group[0];obj.name=parent+('__eyes' if emissive else '__surface');merged.append(obj)
meshes=merged+caps
# Exact ground contact for the three planted paws; the leading left paw stays raised.
for key in ['pawFR','pawBL','pawBR']:
    bpy.context.view_layer.update()
    group=[obj for obj in meshes if obj.parent == parts[key]]
    floor=min((obj.matrix_world @ vertex.co).z for obj in group for vertex in obj.data.vertices)
    parts[key].location.z-=floor
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket','body','neck','jaw','tail']
required += ['leg'+k for k in ['FL','FR','BL','BR']] + ['paw'+k for k in ['FL','FR','BL','BR']]
required += ['stump_'+k for k in ['head','armL','armR','foreArmL','foreArmR','legL','legR','legFL','legFR','legBL','legBR']]
triangles=sum(len(p.vertices)-2 for obj in meshes for p in obj.data.polygons)
assert triangles <= 12000, f'Animal LOD0 budget exceeded: {triangles}'
(HERE/'build-stats.json').write_text(json.dumps({'triangles':triangles,'meshes':len(meshes),'missing_nodes':[n for n in required if n not in bpy.data.objects], 'required_nodes':required},indent=2))
(HERE/'rig-rest.json').write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'aliases':{'legFL':'armL','legFR':'armR','legBL':'legL','legBR':'legR'},'stump_visibility':'zero scale; restore visibleScale to show'},indent=2))
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes+list(parts.values()):obj.select_set(True)
    def export_glb(path):
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    export_glb(args.glb)
    # LODs share exact joint transforms, node names and proximal stump caps.
    originals={obj:obj.data for obj in meshes}
    lod_stats=[]
    for level,ratio in [(1,.14),(2,.18)]:
        for obj in meshes:
            obj.data=originals[obj].copy()
            if level==2:
                bm=bmesh.new();bm.from_mesh(obj.data)
                layer=bm.faces.layers.int.get('lod_fur')
                if layer:
                    bmesh.ops.delete(bm,geom=[face for face in bm.faces if face[layer]],context='FACES')
                bm.to_mesh(obj.data);bm.free()
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Animal LOD reduction','DECIMATE')
            count=sum(len(p.vertices)-2 for p in obj.data.polygons)
            minimum=24 if level==1 else 12
            mod.ratio=max(ratio,min(1,minimum/max(count,1)))
            if obj.name.endswith('__eyes'):
                mod.ratio=max(mod.ratio,.4)
            elif obj.name.startswith('stump_'):
                mod.ratio=max(mod.ratio,.25)
            mod.delimit={'MATERIAL'}
            bpy.ops.object.modifier_apply(modifier=mod.name)
        path=Path(args.glb).with_name(Path(args.glb).stem+'.lod'+str(level)+'.glb')
        export_glb(path)
        lod_stats.append({'level':level,'file':path.name,'triangles':sum(len(p.vertices)-2 for obj in meshes for p in obj.data.polygons),'meshes':len(meshes)})
        for obj in meshes:
            reduced=obj.data;obj.data=originals[obj];bpy.data.meshes.remove(reduced)
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2))
def test_pose(amputate=False):
    parts['armL'].rotation_euler.x=.48
    parts['foreArmL'].rotation_euler.y=-.65
    parts['legR'].rotation_euler.y=-.38
    # A separate amputation view makes both joint motion and cap visibility reviewable.
    if amputate:
        for obj in meshes:
            p=obj.parent
            while p:
                if p==parts['armL']:
                    obj.hide_render=True;break
                p=p.parent
        cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    cap=bpy.data.objects['stump_armL']
    (HERE/'pose-test.json').write_text(json.dumps({'rotated':['armL','foreArmL','legR'],'angles_rad':{'armL':[.48,0,0],'foreArmL':[0,-.65,0],'legR':[0,-.38,0]},'exposed':'stump_armL' if amputate else None,'removed':'armL' if amputate else None,'proximal_parent':cap.parent.name},indent=2))
if args.pose:
    test_pose(args.amputate)
if args.render:
    world=bpy.data.worlds.new('Studio world');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def light(name,position,power,color,size):
        data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        obj.location=position;data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj.rotation_euler=(Vector((0,0,.62))-obj.location).to_track_quat('-Z','Y').to_euler()
    light('Soft golden key',(3,-4,5),450,(1,.82,.66),3)
    light('Cool fill',(1,4,3),260,(.65,.75,1),3)
    light('Golden rim',(-3,1,3),500,(1,.49,.23),2)
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(palette.mat('uiDark'))
    camera=bpy.data.objects.new('Studio camera',bpy.data.cameras.new('Studio camera'));scene.collection.objects.link(camera);scene.camera=camera
    views={'hero':(4.5,-6,3.1),'front':(6,0,1.8),'side':(0,-6,1.7),'back':(-6,0,1.8),'pose':(5,4,2.7)}
    camera.location=views.get(args.view,views['hero'])
    camera.rotation_euler=(Vector((-.13,0,.61))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=3.10
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.25;scene.render.image_settings.file_format='PNG';scene.render.filepath=args.render
    if args.view=='final':
        jobs=[('hero','round5-hero.png',960,540,24),('hero','hero.png',1600,900,96),
              ('front','front.png',960,540,24),('side','side.png',960,540,24),
              ('back','back.png',960,540,24),('hero','review-hero.png',960,540,24),
              ('pose','pose-joints.png',960,540,24),('pose','pose-stump.png',960,540,24)]
        for view,filename,width,height,samples in jobs:
            if filename.startswith('pose-'):
                test_pose(filename=='pose-stump.png')
            camera.location=views[view]
            camera.rotation_euler=(Vector((-.13,0,.61))-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.resolution_x=width;scene.render.resolution_y=height;scene.cycles.samples=samples
            scene.render.filepath=str(HERE/'renders'/filename)
            bpy.ops.render.render(write_still=True)
    elif args.view=='turnaround':
        for view in ['front','side','back','hero']:
            camera.location=views[view]
            camera.rotation_euler=(Vector((-.13,0,.61))-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(HERE/'renders'/('review-hero.png' if view=='hero' else view+'.png'))
            bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(meshes),'meshes')
