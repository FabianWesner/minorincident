"""Four deterministic, rigid-part civilian corpse poses. Blender +X forward / Z up.
All smoothing is applied before export. Each pose has its own complete joint tree;
the first uses canonical names, others namespace them and carry canonicalNode extras.
Build/render only with experiment/tools/blender_run.py.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
for key in ('render', 'glb'):
    parser.add_argument('--' + key)
parser.add_argument('--view', default='hero')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
HERE.joinpath('renders').mkdir(exist_ok=True)
objects, rigs, caps = [], [], []
rng = random.Random(2204)

def material(token, color, roughness=.75, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_') + token)
    m.use_nodes = True
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgba = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in rgb] + [1]
    shader = m.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = rgba
    shader.inputs['Roughness'].default_value = roughness
    if emission:
        shader.inputs['Emission Color'].default_value = rgba
        shader.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = rgba
    return m

M = {k: material(k, c, r) for k, c, r in [
    ('infectedSkin', 'c9a39a', .72), ('picketWhite', 'f2e6dc', .88),
    ('asphalt', '596171', .83), ('uiDark', '25222c', .8),
    ('woodWarm', '76513c', .8), ('brick', 'a8483a', .72),
    ('blood', 'b3121f', .68), ('sidewalk', 'b9a4a0', .85),
    ('survivorRed', 'd9363e', .65)]}
M['eye'] = material('infectedEye', 'ff3b2f', .25, 1.8)

def empty(name, point, parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = point
    if parent:
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj

root = empty('root', (0, 0, 0))
root['assetId'] = 'inf.corpse-poses'
root['poseNames'] = ['faceDown', 'onBack', 'curled', 'sitting']

def finish(obj, name, token, parent, sub=0):
    obj.name = name
    obj.data.materials.append(M[token])
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if sub:
        mod = obj.modifiers.new('applied sculpt smoothing', 'SUBSURF')
        mod.levels = sub
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    if parent:
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    objects.append(obj)
    return obj

def ell(name, p, scale, token, parent, seg=12, rings=8, sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=p)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, token, parent, sub)

def box(name, p, size, token, parent, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    obj = bpy.context.object
    obj.scale = size
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('rounded edges', 'BEVEL')
    mod.width = min(bevel, min(size)*.4)
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, token, parent)

def mesh(name, vertices, faces, token, parent, sub=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, name, token, parent, sub)

def tube(name, points, radii, token, parent, sides=8, sub=1):
    vertices, faces = [], []
    for j, p in enumerate(points):
        axis = (Vector(points[min(j+1, len(points)-1)]) - Vector(points[max(0, j-1)])).normalized()
        u = axis.cross(Vector((1, 0, 0)))
        if u.length < .1:
            u = axis.cross(Vector((0, 1, 0)))
        u.normalize()
        v = axis.cross(u)
        radius = radii[j]
        rx, ry = (radius, radius) if isinstance(radius, (float, int)) else radius
        for i in range(sides):
            t = i*math.tau/sides
            vertices.append(Vector(p) + u*rx*math.cos(t) + v*ry*math.sin(t))
    for j in range(len(points)-1):
        for i in range(sides):
            k, n = j*sides+i, j*sides+(i+1)%sides
            faces.append((k, n, n+sides, k+sides))
    faces += [tuple(range(sides-1, -1, -1)), tuple((len(points)-1)*sides+i for i in range(sides))]
    return mesh(name, vertices, faces, token, parent, sub)

def patch(name, points, token, parent, thickness=.008):
    n = len(points)
    vertices = list(points) + [(p[0]-thickness, p[1], p[2]) for p in points]
    faces = [tuple(range(n)), tuple(range(2*n-1, n-1, -1))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return mesh(name, vertices, faces, token, parent)

def tear(obj, point, size):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=point)
    cutter = bpy.context.object
    cutter.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('torn cloth opening', 'BOOLEAN')
    mod.object, mod.operation = cutter, 'DIFFERENCE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def stain(name, target, y, z, width, height, parent, rear=False):
    """Project opaque palette splats to the actual shell, with 4 mm clearance."""
    bpy.context.view_layer.update()
    vertices = []
    for i in range(11):
        if i == 0:
            yy, zz = y, z
        else:
            t = (i-1)*math.tau/10
            r = rng.uniform(.65, 1.12)
            yy, zz = y + math.cos(t)*width*r, z + math.sin(t)*height*r
        origin = Vector((-1 if rear else 1, yy, zz))
        direction = Vector((1 if rear else -1, 0, 0))
        hit, local, normal, _ = target.ray_cast(target.matrix_world.inverted() @ origin,
              (target.matrix_world.inverted().to_3x3() @ direction).normalized())
        if not hit:
            return
        world = target.matrix_world @ local
        world += (target.matrix_world.to_3x3() @ normal).normalized()*.004
        vertices.append(world)
    stain_mesh=mesh(name, vertices, [(0, i+1, (i+1)%10+1) for i in range(10)], 'blood', parent)
    for face in stain_mesh.data.polygons: face.use_smooth=False

JOINTS = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR',
          'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'backpackSocket']
STUMPS = ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']

def civilian(index, label, jacket):
    prefix = '' if index == 0 else label + '__'
    rig = {}
    pose_root = empty('pose_' + label, (0, 0, 0), root)
    pose_root['pose'] = label
    pose_root['canonicalNode'] = 'root'
    def joint(name, p, parent):
        obj = empty(prefix+name, p, rig[parent] if parent else pose_root)
        obj['canonicalNode'] = name
        rig[name] = obj
        return obj
    joint('hip', (0,0,.67), None)
    joint('torso', (0,0,.8), 'hip')
    joint('head', (0,0,1.09), 'torso')
    joint('backpackSocket', (-.17,0,.97), 'torso')
    def E(n,p,s,m,par,**kw): return ell(prefix+n,p,s,m,rig[par],**kw)
    def T(n,p,r,m,par,**kw): return tube(prefix+n,p,r,m,rig[par],**kw)
    def B(n,p,s,m,par,**kw): return box(prefix+n,p,s,m,rig[par],**kw)
    def F(n,p,m,par,**kw): return patch(prefix+n,p,m,rig[par],**kw)
    E('trouser_seat',(0,0,.675),(.16,.22,.13),'asphalt','hip')
    shirt = E('shirt_shell',(.018,0,.913),(.17,.23,.218),'picketWhite','torso',seg=16,rings=10)
    E('neck',(0,0,1.105),(.075,.085,.075),'infectedSkin','head')
    B('belt',(.117,0,.702),(.065,.355,.042),'uiDark','hip')
    B('belt_buckle',(.156,0,.702),(.019,.045,.038),'woodWarm','hip')
    for s in (-1,1):
        F('collar'+str(s),[(.088,s*.043,1.123),(.154,s*.144,1.061),(.19,s*.095,1.009),(.165,s*.035,1.059)],'picketWhite','torso')
        F('torn_hem'+str(s),[(.142,s*.02,.795),(.146,s*.174,.781),(.13,s*.165,.675),(.16,s*.124,.722),(.171,s*.078,.671),(.157,s*.026,.739)],'picketWhite','torso')
        B('shirt_pocket'+str(s),(.179,s*.115,.96),(.019,.071,.071),'picketWhite','torso')
        T('pocket_top'+str(s),[(.195,s*.082,.989),(.203,s*.117,.99),(.183,s*.151,.981)],[.004]*3,'sidewalk','torso',sub=0,sides=6)
        for j in range(3):
            z=.78+j*.044
            T('shirt_fold'+str(s)+str(j),[(.154,s*.04,z),(.181,s*.11,z+.017),(.137,s*.179,z+.028)],[.003,.007,.002],'picketWhite','torso')
    T('button_placket',[(.184,0,1.075),(.192,0,.96),(.181,0,.833),(.164,0,.731)],[.008]*4,'sidewalk','torso',sides=6,sub=0)
    for j in range(5): E('shirt_button'+str(j),(.193,0,1.027-j*.057),(.008,.01,.01),'woodWarm','torso',seg=8,rings=6,sub=0)
    if jacket:
        # A thick open jacket shell, distinct from the torn shirt beneath it.
        vertices, faces = [], []
        count=16
        for z,rx,ry in [(.73,.17,.232),(.75,.184,.25),(.93,.184,.257),(1.04,.166,.256),(1.09,.128,.205)]:
            for j in range(count):
                t=.73+(math.tau-1.46)*j/(count-1)
                vertices.append((rx*math.cos(t)-.012,ry*math.sin(t),z))
        for k in range(4):
            for j in range(count-1): faces.append((k*count+j,k*count+j+1,(k+1)*count+j+1,(k+1)*count+j))
        coat=mesh(prefix+'jacket_shell',vertices,faces,'asphalt',rig['torso'],1)
        mod=coat.modifiers.new('cloth shell thickness','SOLIDIFY');mod.thickness=.016
        bpy.context.view_layer.objects.active=coat;bpy.ops.object.modifier_apply(modifier=mod.name)
        for s in [-1,1]:
            F('lapel'+str(s),[(.151,s*.071,1.077),(.193,s*.153,1.032),(.202,s*.11,.913),(.183,s*.081,.946)],'asphalt','torso',thickness=.019)
            B('coat_welt'+str(s),(.15,s*.176,.814),(.027,.073,.023),'uiDark','torso')
        stain(prefix+'coat_back_smear',coat,-.045,.938,.072,.083,rig['torso'],rear=True)
        for j in range(5): stain(prefix+'back_blood'+str(j),coat,-.14+j*.065,.84+(j%2)*.11,.035,.052,rig['torso'],rear=True)
    tear(shirt,(.167,-.09,.926),(.068,.045,.055))
    E('exposed_chest',(.12,-.09,.926),(.031,.04,.05),'blood','torso')
    stain(prefix+'shirt_main_smear',shirt,.025,.902,.093,.075,rig['torso'])
    for j,(y,z,w,h) in enumerate([(-.10,1.026,.047,.06),(.1,.93,.045,.07),(-.07,.801,.034,.055),(.13,1.039,.025,.043)]):
        stain(prefix+'shirt_blood'+str(j),shirt,y,z,w,h,rig['torso'])
    for s,side in [(1,'L'),(-1,'R')]:
        shoulder=(0,s*.225,1.043);elbow=(.015,s*.293,.856);wrist=(.025,s*.333,.703)
        joint('arm'+side,shoulder,'torso');joint('foreArm'+side,elbow,'arm'+side);joint('hand'+side,wrist,'foreArm'+side)
        sleeve_token='asphalt' if jacket else 'picketWhite'
        sleeve=T('upper_sleeve'+side,[shoulder,(0,s*.25,1.01),(.012,s*.278,.918),elbow],[.10,.109,.095,.083],sleeve_token,'arm'+side,sides=10)
        tear(sleeve,(.087,s*.268,.964),(.041,.047,.044))
        E('sleeve_tear_skin'+side,(.057,s*.268,.964),(.035,.043,.041),'infectedSkin','arm'+side)
        for j in range(3):
            F('frayed_sleeve'+side+str(j),[(.093,s*(.235+j*.025),.989),(.104,s*(.254+j*.025),.971),(.097,s*(.246+j*.025),.934-j*.006)],sleeve_token,'arm'+side)
        fore=T('forearm'+side,[elbow,(.02,s*.311,.779),wrist],[.065,.07,.045],'infectedSkin','foreArm'+side,sides=10)
        cuff=T('rolled_shirt_cuff'+side,[(.02,s*.286,.883),(.023,s*.295,.849),(.023,s*.302,.838)],[.092,.096,.087],'picketWhite','foreArm'+side,sides=10)
        T('cuff_seam'+side,[(.088,s*.271,.872),(.111,s*.301,.866),(.083,s*.324,.858)],[.003]*3,'sidewalk','foreArm'+side,sides=6,sub=0)
        E('cuff_button'+side,(.115,s*.298,.866),(.009,.012,.01),'woodWarm','foreArm'+side,sub=0,seg=8,rings=6)
        for target, yy, zz, w,h,stem in [(sleeve,s*.265,.985,.041,.03,'sleeve'),(fore,s*.31,.781,.028,.038,'forearm'),(cuff,s*.293,.864,.039,.019,'cuff')]:
            stain(prefix+stem+'_blood'+side,target,yy,zz,w,h,rig['arm'+side if target==sleeve else 'foreArm'+side])
        palm=E('palm'+side,(.037,s*.344,.661),(.06,.077,.072),'infectedSkin','hand'+side)
        stain(prefix+'palm_blood'+side,palm,s*.342,.669,.045,.047,rig['hand'+side])
        for j in range(4):
            yy=s*(.29+j*.035);zz=.627+(abs(j-1.5)*.009)
            T('finger'+side+str(j),[(.049,yy,zz),(.07,yy+s*(j-1.5)*.006,zz-.056),(.107,yy+s*(j-1.5)*.009,zz-.076),(.126,yy+s*(j-1.5)*.009,zz-.049)],[.018,.02,.015,.01],'infectedSkin','hand'+side)
            E('knuckle'+side+str(j),(.064,yy,zz),(.019,.021,.023),'infectedSkin','hand'+side,sub=0)
            E('nail'+side+str(j),(.13,yy+s*(j-1.5)*.009,zz-.046),(.005,.011,.013),'sidewalk','hand'+side,seg=8,rings=6,sub=0)
        T('thumb'+side,[(.055,s*.288,.69),(.099,s*.27,.66),(.133,s*.289,.64)],[.025,.026,.013],'infectedSkin','hand'+side)
        hip=(0,s*.125,.671);knee=(.005,s*.157,.405);ankle=(0,s*.176,.132)
        joint('leg'+side,hip,'hip');joint('shin'+side,knee,'leg'+side);joint('foot'+side,ankle,'shin'+side)
        thigh=T('trouser_thigh'+side,[hip,(0,s*.14,.607),(.002,s*.152,.467),knee],[.121,.132,.113,.099],'asphalt','leg'+side,sides=10)
        calf=T('trouser_calf'+side,[knee,(.004,s*.169,.34),(0,s*.174,.229),ankle],[.099,.103,.093,.074],'asphalt','shin'+side,sides=10)
        tear(thigh,(.102,s*.157,.439),(.054,.055,.046))
        E('knee_skin'+side,(.071,s*.157,.439),(.043,.046,.039),'infectedSkin','leg'+side)
        E('knee_blood'+side,(.108,s*.161,.437),(.01,.021,.027),'blood','leg'+side,sub=0)
        for j in range(3):
            F('knee_rag'+side+str(j),[(.113,s*(.107+j*.027),.471),(.122,s*(.129+j*.027),.466),(.118,s*(.115+j*.027),.429)],'asphalt','leg'+side)
        for j,z in enumerate([.54,.481,.327,.247]):
            par='leg'+side if j<2 else 'shin'+side
            T('denim_fold'+side+str(j),[(.081,s*.104,z+.016),(.109,s*.16,z),(.062,s*.232,z-.02)],[.003,.011,.003],'asphalt',par)
        for sign in [-1,1]:
            T('denim_seam'+side+str(sign),[(.022,s*.157+sign*.099,.39),(.021,s*.174+sign*.089,.273),(.012,s*.176+sign*.072,.174)],[.003]*3,'sidewalk','shin'+side,sides=6,sub=0)
        T('rolled_trouser_hem'+side,[(0,s*.176,.19),(0,s*.176,.155),(0,s*.176,.145)],[.088,.091,.082],'asphalt','shin'+side,sides=10)
        E('ankle_skin'+side,(0,s*.176,.131),(.066,.065,.064),'infectedSkin','foot'+side)
        B('sneaker_sole'+side,(.046,s*.178,.029),(.285,.187,.058),'woodWarm','foot'+side,bevel=.021)
        B('rubber_welt'+side,(.046,s*.178,.06),(.283,.185,.031),'picketWhite','foot'+side,bevel=.014)
        E('sneaker_upper'+side,(.04,s*.178,.107),(.138,.089,.073),'brick','foot'+side)
        E('rubber_toe'+side,(.132,s*.178,.098),(.066,.085,.042),'picketWhite','foot'+side)
        E('shoe_tongue'+side,(-.006,s*.178,.151),(.069,.053,.024),'brick','foot'+side)
        for j in range(4):
            T('lace'+side+str(j),[(-.035+j*.024,s*.141,.149),(-.027+j*.024,s*.178,.174-j*.005),(-.019+j*.024,s*.217,.147)],[.004]*3,'picketWhite','foot'+side,sides=6,sub=0)
        for j in range(6):
            B('sole_tread'+side+str(j),(-.062+j*.04,s*.178,-.005),(.015,.157,.016),'brick','foot'+side,bevel=.003)
        for target,yy,zz in [(thigh,s*.146,.564),(calf,s*.174,.272)]: stain(prefix+'denim_blood'+side+str(zz),target,yy,zz,.026,.037,rig['leg'+side if target==thigh else 'shin'+side])
    # Large adult chibi skull. A true open mouth, set-in sockets, volumetric hair.
    skull=E('cranium',(-.014,0,1.302),(.205,.217,.238),'infectedSkin','head',seg=20,rings=14)
    jaw=E('jaw',(.077,0,1.175),(.139,.151,.096),'infectedSkin','head',seg=16,rings=10)
    for target in (skull,jaw): tear(target,(.218,0,1.207),(.105,.09,.099))
    E('mouth_cavity',(.165,0,1.207),(.043,.087,.094),'uiDark','head',seg=16,rings=10)
    points=[(.213,.087*math.cos(i*math.tau/20),1.21+.097*math.sin(i*math.tau/20)) for i in range(21)]
    T('bloody_lips',points,[.013]*21,'blood','head',sides=6,sub=0)
    for s in [-1,1]:
        E('ear'+str(s),(-.013,s*.217,1.275),(.05,.036,.068),'infectedSkin','head')
        E('inner_ear'+str(s),(.024,s*.232,1.274),(.014,.02,.035),'blood','head',sub=0)
        E('cheek'+str(s),(.134,s*.142,1.265),(.044,.055,.059),'infectedSkin','head')
        E('socket'+str(s),(.174,s*.095,1.344),(.027,.067,.056),'uiDark','head')
        E('orbital_rim'+str(s),(.161,s*.109,1.338),(.024,.071,.059),'blood','head')
        E('red_eye'+str(s),(.199,s*.095,1.345),(.019,.044,.037),'eye','head')
        E('eye_glint'+str(s),(.216,s*.09,1.351),(.006,.011,.012),'picketWhite','head',sub=0)
        T('eyebrow'+str(s),[(.176,s*.036,1.392),(.182,s*.095,1.416),(.141,s*.157,1.404)],[.017,.025,.013],'uiDark','head')
        T('cheek_wound'+str(s),[(.188,s*.14,1.312),(.19,s*.13,1.282),(.164,s*.142,1.251)],[.006,.01,.004],'blood','head',sides=6,sub=0)
    E('nose_bridge',(.187,0,1.326),(.037,.036,.064),'infectedSkin','head')
    E('nose_tip',(.232,0,1.295),(.039,.045,.026),'infectedSkin','head')
    for s in [-1,1]: E('nostril'+str(s),(.253,s*.026,1.283),(.008,.012,.007),'uiDark','head',sub=0,seg=8,rings=6)
    for row in [0,1]:
        for j in range(6):
            y=(j-2.5)*.024
            z=1.273-abs(j-2.5)*.004 if row==0 else 1.137+abs(j-2.5)*.004
            B('tooth'+str(row)+str(j),(.222,y,z),(.025,.019,.022 if row==0 else .015),'picketWhite','head',bevel=.005)
    E('tongue',(.223,0,1.157),(.018,.043,.015),'survivorRed','head',sub=0)
    T('chin_blood',[(.186,-.04,1.121),(.164,-.037,1.10),(.13,-.029,1.077)],[.016,.011,.003],'blood','head',sides=6,sub=0)
    E('nape_cap',(-.095,0,1.312),(.158,.20,.185),'woodWarm','head')
    E('hair_cap',(-.063,0,1.425),(.206,.219,.142),'woodWarm','head',seg=16,rings=10)
    def lock(name,p0,p1,p2,w):
        p0,p1,p2=Vector(p0),Vector(p1),Vector(p2)
        T(name,[p0,p0.lerp(p1,.55),p1,p1.lerp(p2,.7),p2],[.012,(w*.85,w*.52),(w,w*.55),(w*.4,w*.27),.001],'woodWarm','head')
    for layer in range(2):
        for j in range(11):
            t=j*math.tau/11+.25*layer
            x=-.065+.177*math.cos(t);y=.202*math.sin(t);z=1.36+layer*.081
            lock('hair_lock'+str(layer)+str(j),(x*.7,y*.72,z+.087),(x-.025,y,z+.034),(x-.064,y*1.12-.018,z-.071),.066)
    for j in range(10):
        t=1.15+j*.44
        x=-.04+.19*math.cos(t);y=.205*math.sin(t)
        lock('nape_lock'+str(j),(x*.86,y*.8,1.405),(x-.035,y*1.04,1.29),(x-.045,y*.98,1.165+(j%2)*.022),.068)
    for j in range(7):
        y=-.176+j*.056
        lock('fringe'+str(j),(-.045,y+.032,1.513),(.115,y,1.464),(.175,y-.051,1.383+(j%3)*.016),.075)
    for j in range(5):
        t=j*math.tau/5
        lock('cowlick'+str(j),(-.09,0,1.46),(-.07+.06*math.cos(t),.09*math.sin(t),1.55),(-.13+.15*math.cos(t),.17*math.sin(t),1.562-(j%3)*.024),.065)
    stain(prefix+'face_blood',skull,-.14,1.297,.03,.055,rig['head'])
    # Caps are attached to proximal parts, so removal of distal parts leaves a cap.
    for key in STUMPS:
        parent = 'torso' if key in ['head','armL','armR'] else ('arm'+key[-1] if key.startswith('fore') else 'hip')
        p = rig[key].matrix_world.translation.copy()
        size=(.071,.081,.013) if key=='head' or key.startswith('leg') else (.066,.015,.062)
        cap=ell(prefix+'stump_'+key,p,size,'blood',rig[parent],seg=12,rings=6,sub=0)
        cap['canonicalNode']='stump_'+key;cap['stumpFor']=key;cap['hidden']=True
        caps.append(cap)
    rig['_root']=pose_root
    rigs.append(rig)

for i,(label,jacket) in enumerate([('faceDown',True),('onBack',False),('curled',True),('sitting',False)]):
    civilian(i,label,jacket)

# Rotate the joint hierarchies from an upright build into the reference corpse poses.
# All coordinates remain in metres and are baked into rest geometry/joint pivots.
def rotate(rig, name, angles): rig[name].rotation_euler=angles
r=rigs[0]
rotate(r,'hip',(0,math.pi/2,0))
rotate(r,'torso',(0,-.22,0))
rotate(r,'head',(.22,.32,-.2))
rotate(r,'_root',(0,0,math.pi))
rotate(r,'armL',(.48,-1.05,.25));rotate(r,'foreArmL',(0,-1.95,0))
rotate(r,'armR',(-.28,-.98,-.24));rotate(r,'foreArmR',(0,-1.95,0))
rotate(r,'legL',(.12,-.08,0));rotate(r,'legR',(-.2,-.2,0))
rotate(r,'shinR',(0,.29,0));rotate(r,'footL',(0,.22,0));rotate(r,'footR',(0,.35,0))
r=rigs[1]
rotate(r,'hip',(0,-math.pi/2,0));rotate(r,'torso',(0,.22,0));rotate(r,'head',(.10,.12,-.08))
rotate(r,'armL',(1.38,.12,-.18));rotate(r,'armR',(-1.34,-.08,.18))
rotate(r,'foreArmL',(0,.30,0));rotate(r,'foreArmR',(0,.27,0))
rotate(r,'handL',(0,.5,0));rotate(r,'handR',(0,.45,0))
rotate(r,'legL',(.26,.05,0));rotate(r,'legR',(-.28,-.04,0))
rotate(r,'shinL',(0,.14,0));rotate(r,'shinR',(0,.22,0))
rotate(r,'footL',(0,-.17,0));rotate(r,'footR',(0,-.2,0))
r=rigs[2]
rotate(r,'hip',(math.pi/2,-.10,0));rotate(r,'torso',(0,.44,0));rotate(r,'head',(-.10,-.70,-.17))
rotate(r,'legL',(.13,-1.05,0));rotate(r,'legR',(-.08,-1.23,0))
rotate(r,'shinL',(0,1.67,0));rotate(r,'shinR',(0,1.72,0))
rotate(r,'armL',(-.7,-.83,.16));rotate(r,'foreArmL',(-.5,-1.29,0))
rotate(r,'armR',(.7,-.58,-.12));rotate(r,'foreArmR',(.4,-1.04,0))
r=rigs[3]
rotate(r,'torso',(0,-.12,-.16));rotate(r,'head',(.14,-.34,-.1))
rotate(r,'legL',(.24,-1.43,0));rotate(r,'legR',(-.32,-1.45,0))
rotate(r,'shinL',(0,.06,0));rotate(r,'shinR',(0,.06,0))
rotate(r,'footL',(0,.05,0));rotate(r,'footR',(0,-.10,0))
rotate(r,'armL',(.22,-.17,.12));rotate(r,'foreArmL',(0,-.85,0))
rotate(r,'handL',(0,.13,0));rotate(r,'armR',(-.25,.12,-.16))
rotate(r,'foreArmR',(0,-.27,0))

# Soft mesh reduction keeps the entire four-body set within the infected budget.
for obj in objects:
    if obj in caps: continue
    bpy.context.view_layer.objects.active=obj
    if len(obj.data.polygons)>70:
        mod=obj.modifiers.new('game density','DECIMATE');mod.ratio=.5 if any(n in obj.name for n in ['sneaker_sole','rubber_welt']) else (.25 if 'tooth' in obj.name else .105)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
    # Clean unused Boolean cutter slots.
    for slot in range(len(obj.data.materials)):
        if obj.data.materials[slot] is None:obj.data.materials[slot]=obj.data.materials[0]

# Lay out the four poses as a separated set. Camera-facing arrangement follows sheet.
bpy.context.view_layer.update()
placements=[(-1.40,.20),(.20,1.40),(-.20,-1.40),(1.40,-.20)]
for rig,(x,y) in zip(rigs,placements):
    members=[]
    for obj in objects:
        parent=obj.parent
        while parent and parent!=rig['_root']: parent=parent.parent
        if parent==rig['_root'] and obj not in caps: members.append(obj)
    points=[o.matrix_world@v.co for o in members for v in o.data.vertices]
    center=Vector(((min(p.x for p in points)+max(p.x for p in points))/2,
                   (min(p.y for p in points)+max(p.y for p in points))/2,
                   min(p.z for p in points)))
    rig['_root'].location=Vector((x,y,0))-center
    bpy.context.view_layer.update()

# Bake pose transforms so procedural rotations start at zero about actual joints.
nodes=[root]+[o for r in rigs for o in r.values()]
bpy.context.view_layer.update()
worlds={o:o.matrix_world.copy() for o in nodes}
parents={o:o.parent for o in nodes}
mesh_parents={o:o.parent for o in objects}
for obj in objects:
    obj.data.transform(obj.matrix_world)
    obj.parent=None;obj.matrix_world=Matrix.Identity(4)
for obj in nodes:
    obj.parent=None;obj.matrix_world=Matrix.Translation(worlds[obj].translation)
for obj in nodes:
    if parents[obj]:
        obj.parent=parents[obj];obj.matrix_parent_inverse=Matrix.Identity(4)
        obj.location=worlds[obj].translation-worlds[parents[obj]].translation
bpy.context.view_layer.update()
for obj in objects:
    obj.parent=mesh_parents[obj]
    obj.matrix_parent_inverse=obj.parent.matrix_world.inverted()
    obj.matrix_basis=Matrix.Identity(4)
# Merge all stationary decorations per rigid node into a single multi-material mesh.
buckets={}
for obj in objects:
    if obj not in caps:buckets.setdefault(obj.parent,[]).append(obj)
merged=[]
for parent,group in buckets.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:obj.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    if len(group)>1:bpy.ops.object.join()
    group[0].name=parent.name+'__surface'
    merged.append(group[0])
# A gentle second reduction after joining removes redundant edges within surfaces.
for obj in merged:
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('final combined-set budget','DECIMATE');mod.ratio=.74
    mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
objects=merged+caps
for cap in caps:cap.scale=(0,0,0)
bpy.context.view_layer.update()
triangles=sum(len(f.vertices)-2 for o in objects for f in o.data.polygons)
missing=[name for name in ['root']+JOINTS+['stump_'+n for n in STUMPS] if name not in bpy.data.objects]
pose_bounds={}
for rig in rigs:
    members=[]
    for obj in merged:
        parent=obj.parent
        while parent and parent!=rig['_root']:parent=parent.parent
        if parent==rig['_root']:members.append(obj)
    points=[obj.matrix_world@v.co for obj in members for v in obj.data.vertices]
    pose_bounds[rig['_root']['pose']]={'min_z':min(v.z for v in points),'max_z':max(v.z for v in points)}
stats={'pose_bounds':pose_bounds,'triangles':triangles,'meshes':len(objects),'nodes_ok':not missing,'missing_nodes':missing,
       'pose_hierarchies':{r['_root']['pose']:{n:list(r[n].matrix_world.translation) for n in JOINTS} for r in rigs}}
HERE.joinpath('build-stats.json').write_text(json.dumps(stats,indent=2))
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects+nodes:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=args.glb,export_format='GLB',use_selection=True,
        export_apply=True,export_extras=True,export_cameras=False,export_lights=False)

def pose_test():
    # Canonical nodes demonstrate amputation; the supine copy demonstrates live pivots.
    r=rigs[0]
    r['armL'].rotation_euler.x=.7
    r['foreArmL'].rotation_euler.y=-.6
    r['legR'].rotation_euler.z=-.42
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    r=rigs[1]
    r['armL'].rotation_euler.x=.55
    r['foreArmL'].rotation_euler.y=-.75
    r['legR'].rotation_euler.z=.28
    for obj in objects:
        parent=obj.parent
        while parent:
            if parent==rigs[0]['armL']:obj.hide_render=True;break
            parent=parent.parent
    bpy.context.view_layer.update()
    HERE.joinpath('pose-test.json').write_text(json.dumps({
        'rotated':['armL','foreArmL','legR','onBack__armL','onBack__foreArmL','onBack__legR'],
        'shown':'stump_armL','stump_parent':cap.parent.name,'detached':'armL',
        'posed_pivots':{n:list(rigs[0][n].matrix_world.translation) for n in ['armL','foreArmL','handL','legR','shinR']}
    },indent=2))


if args.pose:
    pose_test()

if args.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.065,.087,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def light(name,p,power,color,size):
        data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj);obj.location=p;data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj.rotation_euler=(Vector((0,0,.4))-obj.location).to_track_quat('-Z','Y').to_euler()
    light('warm softbox',(2,-4,6),750,(1,.81,.69),4)
    light('cool fill',(0,4,5),580,(.66,.76,1),5)
    light('sunset rim',(-4,2,4),850,(1,.5,.27),3)
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(material('studio','302c36',.92))
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(camera);scene.camera=camera
    views={'hero':(6,-8,6.5),'front':(8,0,4.8),'side':(0,-8,4.8),'back':(-8,0,4.8)}
    camera.location=views.get(args.view,views['hero'])
    camera.rotation_euler=(Vector((0,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=5.4*max(args.width/args.height,1)/1.7777778
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=args.render
    def render_view(view, path, width=args.width, height=args.height, samples=args.samples):
        camera.location=views[view]
        camera.rotation_euler=(Vector((0,0,.35))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x=width;scene.render.resolution_y=height
        scene.cycles.samples=samples;scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)

    def turnaround(path):
        import numpy as np
        panels=[]
        for name in ['front','side','back','hero']:
            panel_path=HERE/'renders'/('review-'+name+'.png')
            render_view(name,panel_path,960,540,24)
            im=bpy.data.images.load(str(panel_path));w,h=im.size
            pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
            panels.append(pixels.reshape(h,w,4))
        data=np.concatenate([np.concatenate(panels[2:],axis=1),np.concatenate(panels[:2],axis=1)],axis=0)
        sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
        sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=str(path);sheet.file_format='PNG';sheet.save()

    if args.view == 'final-all':
        render_view('hero',args.render,960,540,24)
        turnaround(HERE/'renders'/'turnaround.png')
        render_view('hero',HERE/'renders'/'hero.png',1600,900,96)
        pose_test()
        render_view('hero',HERE/'renders'/'pose-test.png',960,540,24)
    elif args.view == 'turnaround':
        turnaround(args.render)
    else:
        render_view(args.view if args.view in views else 'hero',args.render)
print('OK inf.corpse-poses', triangles, 'triangles',len(objects),'meshes')
