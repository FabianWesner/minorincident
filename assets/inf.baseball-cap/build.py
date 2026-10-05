"""Minor Incident runner. Deterministic rigid-part hero, +X forward, Z up.
Build/render only via experiment/tools/blender_run.py. No textures or skinning.
Applied subdivision on organic/clothing meshes; fixed tessellation and joint pivots.
Stumps export with hidden/ss_hidden extras and are enclosed in rest-pose joints.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--glb')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--pose', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
asset = bpy.data.collections.new('Runner')
scene.collection.children.link(asset)
rng = random.Random(23)


def material(token, color, roughness=.65, emission=0):
    m = bpy.data.materials.new(('emi_' if emission else 'pal_') + token)
    m.use_nodes = True
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgba = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb] + [1]
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba
    b.inputs['Roughness'].default_value = roughness
    if emission:
        b.inputs['Emission Color'].default_value = rgba
        b.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = rgba
    return m


M = {k: material(t, h, r, e) for k, t, h, r, e in [
    ('skin', 'infectedSkin', '#bba5a3', .73, 0),
    ('red', 'survivorRed', '#d9363e', .56, 0),
    ('white', 'picketWhite', '#f2e6dc', .8, 0),
    ('blood', 'blood', '#b3121f', .35, 0),
    ('dark', 'uiDark', '#25222c', .7, 0),
    ('denim', 'asphalt', '#5b4f5c', .9, 0),
    ('hair', 'woodWarm', '#694336', .78, 0),
    ('eye', 'infectedEye', '#ff3b2f', .3, 6.0),
]}
G = {}


def group(name, point, parent=None):
    o = bpy.data.objects.new(name, None)
    asset.objects.link(o)
    o.location = point
    bpy.context.view_layer.update()
    if parent:
        world = o.matrix_world.copy()
        o.parent = G[parent]
        o.matrix_world = world
    G[name] = o
    return o


def finish(o, mat, parent, sub=0, bevel=0):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    asset.objects.link(o)
    o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if sub:
        md = o.modifiers.new('Applied sculpt smoothing', 'SUBSURF')
        md.levels = sub
        bpy.ops.object.modifier_apply(modifier=md.name)
    if bevel:
        md = o.modifiers.new('Soft tailored edges', 'BEVEL')
        md.width = bevel
        md.segments = 2
        bpy.ops.object.modifier_apply(modifier=md.name)
    for p in o.data.polygons:
        p.use_smooth = True
    bpy.context.view_layer.update()
    world = o.matrix_world.copy()
    o.parent = G[parent]
    o.matrix_world = world
    o.select_set(False)
    return o


def ell(name, c, s, mat, parent, sub=1, rot=None):
    face_detail = name in ['skull','jaw','mouth_cavity','glowing_eye_L','glowing_eye_R']
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if face_detail else 6, ring_count=6 if face_detail else 5, location=c)
    o = bpy.context.object
    o.name = name
    o.scale = s
    if rot:
        o.rotation_euler = rot
    return finish(o, mat, parent, sub)


def box(name, c, s, mat, parent, bevel=.008, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object
    o.name = name
    o.scale = s
    if rot:
        o.rotation_euler = rot
    return finish(o, mat, parent, bevel=bevel)


def mesh(name, verts, faces, mat, parent, sub=0, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    asset.objects.link(o)
    return finish(o, mat, parent, sub, bevel)


def tube(name, points, radius, mat, parent):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 2
    cu.bevel_depth = radius
    cu.bevel_resolution = 0
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for p, co in zip(sp.bezier_points, points):
        p.co = co
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu)
    asset.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, mat, parent)


def limb(name, a, b, width, depth, mat, parent):
    a, b = Vector(a), Vector(b)
    o = ell(name, (a + b) / 2, (width, depth, (b - a).length / 2 + .022), mat, parent)
    # ellipsoid's long axis follows the limb, with no surviving scale.
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o


def sleeve(name, a, b, radius, parent):
    a, b = Vector(a), Vector(b)
    q = (b-a).to_track_quat('Z', 'Y')
    verts = []
    for t, r in [(0, .9), (.08, 1), (.85, 1), (1, .94)]:
        for i in range(12):
            offset = q @ Vector((radius*r*math.cos(i*math.tau/12), radius*r*math.sin(i*math.tau/12), 0))
            edge_t = t + (.18*math.sin(i*2.1) if t == 1 else 0)
            verts.append(tuple(a.lerp(b, edge_t) + offset))
    faces = [(j*12+i,j*12+(i+1)%12,(j+1)*12+(i+1)%12,(j+1)*12+i) for j in range(3) for i in range(12)]
    return mesh(name, verts, faces, 'white', parent, sub=1)


def shell(name, rings, mat, parent, n=20, sub=1, ragged=False):
    verts = []
    for j, (x, y, z, rx, ry) in enumerate(rings):
        for i in range(n):
            a = 2 * math.pi * i / n
            dz = (.012 * math.sin(i * 2.3) if ragged and j == 0 else 0)
            verts.append((x + rx * math.cos(a), y + ry * math.sin(a), z + dz))
    faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
             for j in range(len(rings)-1) for i in range(n)]
    faces += [tuple(reversed(range(n))), tuple((len(rings)-1)*n+i for i in range(n))]
    return mesh(name, verts, faces, mat, parent, sub)


def patch(name, x, y, z, sy, sz, mat, parent, normal=1, seed=0):
    # A thin irregular relief decal, useful without a texture/transparent material.
    rr = random.Random(seed)
    verts = [(x, y, z)]
    for i in range(12):
        a = i * math.tau / 12
        r = rr.uniform(.6, 1.2)
        verts.append((x + .0015 * normal, y + sy * r * math.cos(a), z + sz * r * math.sin(a)))
    return mesh(name, verts, [(0, i+1, (i+1)%12+1) for i in range(12)], mat, parent)


def tuft(name, a, b, width, depth, mat='hair'):
    # Sculpted pointed lock: smooth overlapping volumes, not flat hair cards.
    a, b = Vector(a), Vector(b)
    axis = b-a
    q = axis.to_track_quat('Z', 'Y')
    verts = []
    for t, r in [(0, .65), (.22, 1), (.65, .66), (1, .035)]:
        for i in range(6):
            v = q @ Vector((width*r*math.cos(i*math.tau/6), depth*r*math.sin(i*math.tau/6), 0))
            verts.append(tuple(a + axis*t + v))
    faces = [(j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i) for j in range(3) for i in range(6)]
    faces += [tuple(reversed(range(6))), tuple(range(18,24))]
    return mesh(name, verts, faces, mat, 'head', sub=1)


# Rig: absolute rest pivots, then world-preserving parenting.
group('root', (0, 0, 0))
group('hip', (0, 0, .74), 'root')
group('torso', (0, 0, .83), 'hip')
group('head', (.035, 0, 1.18), 'torso')
group('backpackSocket', (-.15, 0, 1.02), 'torso')
G['root']['asset_id'] = 'inf.baseball-cap'
G['root']['forward'] = '+X'
G['root']['rig'] = 'rigid-parts'
G['root']['rest_pose'] = 'lurching'
G['root']['revision'] = 'hero-r3'
shoulders, elbows, wrists = {}, {}, {}
for side, sn in [(1, 'L'), (-1, 'R')]:
    shoulders[sn] = (-.012, side*.208, 1.108)
    elbows[sn] = (.016, side*.33, .938)
    wrists[sn] = (.089, side*.414, .813)
    group('arm'+sn, shoulders[sn], 'torso')
    group('foreArm'+sn, elbows[sn], 'arm'+sn)
    group('hand'+sn, wrists[sn], 'foreArm'+sn)
    group('leg'+sn, (0, side*.112, .755), 'hip')
    group('shin'+sn, (.018, side*.2, .433), 'leg'+sn)
    group('foot'+sn, (.02, side*.236, .146), 'shin'+sn)

# Torso: shaped independent shirt, rolled hem, opening, collar and chest badge.
shell('shirt_body', [(0,0,.755,.125,.167), (0,0,.779,.136,.176),
    (-.008,0,.825,.12,.164), (-.015,0,.97,.129,.181),
    (-.02,0,1.085,.123,.205), (-.016,0,1.15,.10,.17), (.006,0,1.177,.064,.077)], 'white', 'torso')
shell('shirt_hem', [(0,0,.75,.134,.178),(0,0,.773,.142,.186),(0,0,.788,.132,.174)], 'white','torso')
ell('neck', (.024,0,1.183),(.065,.071,.089),'skin','head')
for side, sn in [(1,'L'),(-1,'R')]:
    collar = [( .07, side*.016,1.176), (.116,side*.07,1.124), (.126,side*.119,1.152), (.055,side*.094,1.184)]
    mesh('collar_'+sn, collar + [(x-.012,y,z-.009) for x,y,z in collar],
         [(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'white','torso',bevel=.004)
    tube('shoulder_seam_'+sn,[(-.065,side*.095,1.157),(-.052,side*.17,1.144),(-.025,side*.217,1.086)],.0024,'denim','torso')
box('button_placket',(.134,0,.969),(.013,.024,.305),'white','torso',.004)
for z in [.825,.909,.997,1.087]:
    ell('shirt_button',(.144,-.002,z),(.006,.007,.007),'denim','torso',0)
box('name_badge_border',(.139,-.091,1.024),(.006,.069,.046),'denim','torso',.004)
box('name_badge',(.144,-.091,1.024),(.004,.058,.035),'white','torso',.002)
box('badge_red_band',(.147,-.091,1.033),(.003,.051,.010),'red','torso',.001)
for y in [-.108,-.097,-.086]:
    box('badge_print',(.148,y,1.016),(.002,.004,.009),'denim','torso',.001)
# Shirt splatter runs from mouth to the hem, not evenly distributed speckles.
for x, y, z, ry, rz in [(.145,-.015,1.088,.034,.041),(.143,-.01,1.005,.022,.075),
    (.134,-.04,.899,.049,.07),(.146,-.031,.799,.04,.024),(.095,-.149,1.105,.032,.03),
    (.09,.15,1.066,.035,.036),(-.14,-.04,1.034,.052,.083),(-.145,.086,.913,.022,.048)]:
    patch('shirt_blood',x,y,z,ry*1.38,rz*1.18,'blood','torso',seed=int(z*900+y*30))
for back in [False,True]:
    for i in range(18):
        y=rng.uniform(-.135,.135); z=rng.uniform(.802,1.117)
        x=(-1 if back else 1)*(.125 if z<1.06 else .113)*math.sqrt(max(.15,1-(y/.19)**2))
        patch('blood_fleck',x+(-.004 if back else .004),y,z,rng.uniform(.003,.009),rng.uniform(.004,.012),'blood','torso',seed=i+int(back)*21)
for side,sn in [(1,'L'),(-1,'R')]:
    tube('shirt_fold_'+sn,[(.098,side*.1,.808),(.11,side*.107,.829),(.103,side*.12,.854)],.003,'white','torso')
    a,b,c = shoulders[sn], elbows[sn], wrists[sn]
    limb('upper_arm_skin_'+sn,a,b,.064,.063,'skin','arm'+sn)
    sleeve_end = tuple(Vector(a).lerp(Vector(b),.57))
    sleeve('shirt_sleeve_'+sn,a,sleeve_end,.079,'arm'+sn)
    sleeve('rolled_sleeve_'+sn,tuple(Vector(a).lerp(Vector(b),.48)),tuple(Vector(a).lerp(Vector(b),.64)),.084,'arm'+sn)
    limb('forearm_skin_'+sn,b,c,.064,.065,'skin','foreArm'+sn)
    limb('wrist_cuff_'+sn,tuple(Vector(b).lerp(Vector(c),.85)),tuple(Vector(b).lerp(Vector(c),1.04)),.066,.067,'dark','foreArm'+sn)
    box('cuff_buckle_'+sn,(c[0]+.058,c[1],c[2]+.012),(.015,.047,.03),'denim','foreArm'+sn,.005)
    for i in range(3):
        ell('cuff_rivet_'+sn,(c[0]+.068,c[1]+(i-1)*.013,c[2]+.015),(.003,.003,.003),'hair','foreArm'+sn,0)
    patch('arm_wound_'+sn,b[0]+.056,b[1],b[2]+.041,.024,.015,'blood','foreArm'+sn,seed=16)
    # Adult hands with four individually curled claw fingers, nails, thumb and knuckles.
    hx,hy,hz = c[0]+.017,c[1]+side*.018,c[2]-.063
    ell('palm_'+sn,(hx,hy,hz),(.043,.056,.065),'skin','hand'+sn)
    for i in range(4):
        yy=hy+(i-1.5)*.026
        top=(hx+.013,yy,hz-.021)
        length=[.10,.129,.119,.09][i]
        mid=(hx+.039,yy+side*.005,hz-length*.61)
        hook=(hx+.065,yy+side*.002,hz-length)
        tip=(hx+.034,yy-side*.002,hz-length-.017)
        limb('finger_prox_'+sn+str(i),top,mid,.018,.018,'skin','hand'+sn)
        limb('finger_tip_'+sn+str(i),mid,hook,.015,.016,'skin','hand'+sn)
        digit=ell('claw_return_'+sn+str(i),(Vector(hook)+Vector(tip))/2,(.015,.014,(Vector(tip)-Vector(hook)).length/2+.006),'skin','hand'+sn,0)
        digit.rotation_euler=(Vector(tip)-Vector(hook)).to_track_quat('Z','Y').to_euler()
        ell('fingernail_'+sn+str(i),(tip[0]+.009,tip[1],tip[2]+.003),(.004,.009,.011),'blood','hand'+sn,0)
        ell('knuckle_'+sn+str(i),(hx+.037,yy,hz-.025),(.011,.014,.013),'skin','hand'+sn,0)
    limb('thumb_'+sn,(hx,hy-side*.048,hz+.005),(hx+.055,hy-side*.068,hz-.03),.023,.022,'skin','hand'+sn)
    ell('thumb_nail_'+sn,(hx+.071,hy-side*.066,hz-.031),(.006,.012,.012),'blood','hand'+sn,0)
    patch('hand_blood_'+sn,hx+.046,hy,hz,.033,.026,'blood','hand'+sn,seed=9)

# Denim hip, waistband and belt: short, frayed trousers per reference.
ell('denim_hip',(0,0,.736),(.122,.176,.115),'denim','hip')
shell('waistband',[(0,0,.739,.13,.17),(0,0,.769,.129,.17),(0,0,.782,.121,.164)],'denim','hip')
shell('belt',[(0,0,.757,.133,.176),(0,0,.778,.129,.171)],'dark','hip',sub=0)
box('belt_buckle',(.137,0,.769),(.015,.044,.027),'hair','hip',.004)
box('belt_buckle_inset',(.147,0,.769),(.007,.029,.015),'dark','hip',.002)
for y in [-.13,.12]: box('belt_loop',(.089,y,.768),(.012,.014,.05),'denim','hip',.004)
tube('fly_seam',[(.124,.009,.743),(.131,.009,.689),(.102,.009,.657)],.0025,'hair','hip')
for side,sn in [(1,'L'),(-1,'R')]:
    hip=(0,side*.112,.755); knee=(.018,side*.2,.433); ankle=(.02,side*.236,.146)
    limb('thigh_skin_'+sn,hip,knee,.082,.077,'skin','leg'+sn)
    shell('denim_short_'+sn,[(.01,side*.177,.469,.079,.082),(.012,side*.17,.486,.092,.094),
        (.003,side*.152,.56,.092,.095),(-.006,side*.13,.676,.098,.1),(-.004,side*.112,.73,.092,.096)],'denim','leg'+sn,ragged=True)
    for i in range(9):
        a=i*math.tau/9
        x=.01+.079*math.cos(a); y=side*.177+.081*math.sin(a)
        mesh('frayed_denim_'+sn+str(i),[(x-.012,y,.482),(x+.014,y,.483),(x+.009,y,.438+rng.uniform(-.015,.012)),(x-.008,y,.46)],[(0,1,2,3)],'denim','leg'+sn)
    # Fold ridges and genuine pocket silhouettes on the rear.
    tube('outside_denim_seam_'+sn,[(-.023,side*.214,.708),(-.024,side*.244,.584),(-.009,side*.258,.493)],.003,'hair','leg'+sn)
    tube('short_fold_'+sn,[(.088,side*.118,.529),(.103,side*.161,.54),(.082,side*.214,.522)],.006,'denim','leg'+sn)
    verts=[(-.104,side*.088,.695),(-.106,side*.171,.697),(-.111,side*.168,.629),(-.115,side*.133,.611),(-.115,side*.091,.631)]
    mesh('rear_pocket_'+sn,verts,[(0,1,2,3,4)],'denim','leg'+sn,bevel=.003)
    tube('pocket_stitch_'+sn,verts+[verts[0]],.0015,'hair','leg'+sn)
    tube('front_pocket_'+sn,[(.092,side*.063,.742),(.109,side*.104,.701),(.061,side*.183,.682)],.002,'hair','leg'+sn)
    limb('calf_'+sn,knee,ankle,.07,.071,'skin','shin'+sn)
    ell('kneecap_'+sn,(.076,side*.2,.439),(.034,.055,.045),'skin','shin'+sn)
    patch('knee_blood_'+sn,.105,side*.2,.435,.027,.027,'blood','shin'+sn,seed=7)
    patch('denim_blood_'+sn,.094,side*.172,.576,.033,.028,'blood','leg'+sn,seed=2)
    # High top sneaker: padded ankle, tongue, layered sole and individual laces.
    yy=side*.236
    ell('sock_'+sn,(.02,yy,.186),(.056,.065,.072),'white','foot'+sn)
    box('sole_'+sn,(.06,yy,.029),(.27,.167,.058),'white','foot'+sn,.017)
    box('sole_shadow_'+sn,(.065,yy,.010),(.247,.152,.018),'dark','foot'+sn,.007)
    ell('shoe_upper_'+sn,(.053,yy,.086),(.126,.076,.076),'red','foot'+sn)
    ell('toe_cap_'+sn,(.141,yy,.069),(.056,.079,.051),'white','foot'+sn)
    ell('high_top_'+sn,(-.017,yy,.139),(.069,.071,.082),'red','foot'+sn)
    shell('ankle_cuff_'+sn,[(-.018,yy,.179,.072,.077),(-.017,yy,.204,.071,.076),(-.016,yy,.214,.064,.067)],'dark','foot'+sn)
    box('shoe_tongue_'+sn,(.059,yy,.144),(.051,.064,.081),'denim','foot'+sn,.018,rot=(0,.22,0))
    for j in range(4):
        xx=.038+j*.024; zz=.16-j*.013
        for sy in [-1,1]:
            ell('lace_eyelet_'+sn,(xx,yy+sy*.044,zz),(.006,.006,.006),'hair','foot'+sn,0)
        tube('lace_'+sn+str(j),[(xx-.004,yy-.039,zz),(xx+.007,yy,zz+.009),(xx-.003,yy+.039,zz)],.004,'white','foot'+sn)
    for sy in [-1,1]:
        tube('sneaker_side_stripe_'+sn,[(-.033,yy+sy*.072,.12),(.023,yy+sy*.074,.079),(.099,yy+sy*.065,.093)],.006,'white','foot'+sn)
    for j in range(5):
        box('sole_tread_'+sn,(.0+j*.036,yy-side*.078,.028),(.015,.007,.009),'denim','foot'+sn,.002)
    patch('toe_blood_'+sn,.194,yy,.074,.023,.024,'blood','foot'+sn,seed=10)

# Face: domed skull, cheek structure, exposed mouth cavity and angry luminous eyes.
ell('skull',(.027,0,1.349),(.142,.177,.181),'skin','head')
ell('jaw',(.076,0,1.244),(.096,.113,.087),'skin','head')
for side,sn in [(1,'L'),(-1,'R')]:
    ell('cheek_'+sn,(.121,side*.095,1.3),(.022,.047,.043),'skin','head')
    ell('ear_'+sn,(.009,side*.165,1.335),(.042,.031,.057),'skin','head',rot=(.12*side,0,0))
    ell('ear_concha_'+sn,(.034,side*.181,1.338),(.014,.012,.033),'blood','head')
    ell('ear_inner_'+sn,(.04,side*.184,1.337),(.013,.008,.021),'skin','head')
    ell('eye_socket_'+sn,(.148,side*.069,1.372),(.014,.05,.048),'blood','head')
    ell('glowing_eye_'+sn,(.161,side*.069,1.377),(.01,.041,.043),'eye','head')
    ell('eye_hot_core_'+sn,(.174,side*.069,1.382),(.003,.013,.016),'eye','head',0)
    tube('lower_lid_'+sn,[(.159,side*.036,1.351),(.16,side*.065,1.342),(.146,side*.095,1.362)],.0045,'skin','head')
    tube('angry_brow_'+sn,[(.158,side*.032,1.398),(.158,side*.068,1.425),(.136,side*.108,1.429)],.009,'dark','head')
    patch('cheek_splash_'+sn,.151,side*.098,1.31,.024,.034,'blood','head',seed=6)
ell('nose_bridge',(.151,0,1.358),(.019,.019,.038),'skin','head')
ell('nose_tip',(.177,0,1.334),(.027,.027,.022),'skin','head')
for y in [-.019,.019]: ell('nostril',(.19,y,1.326),(.006,.006,.004),'dark','head',0)
ell('mouth_cavity',(.17,0,1.264),(.018,.074,.063),'dark','head')
tube('bloody_lip',[ (.176,-.05,1.295),(.181,-.065,1.268),(.182,-.039,1.222),(.187,0,1.211),(.183,.041,1.228),(.179,.064,1.276),(.174,.048,1.3)],.006,'blood','head')
ell('tongue',(.182,.007,1.235),(.009,.032,.012),'blood','head',0)
for i,y in enumerate([-.044,-.022,0,.022,.043]):
    box('upper_tooth_'+str(i),(.184,y,1.293-abs(y)*.1),(.012,.016,.018 if i!=3 else .011),'white','head',.003,rot=(.1*i,0,0))
for i,y in enumerate([-.039,-.018,.022,.041]):
    box('lower_tooth_'+str(i),(.19,y,1.234+abs(y)*.15),(.01,.015,.012),'white','head',.003)
for y,low in [(-.022,1.159),(.031,1.181)]:
    tube('blood_drip',[(.174,y,1.233),(.169,y,1.205),(.151,y,low)],.0035,'blood','head')
    ell('blood_drop',(.151,y,low),(.004,.005,.008),'blood','head',0)

# Hair, including broad bangs and layered nape. The cap covers their roots.
ell('hair_mass',(-.029,0,1.407),(.15,.178,.139),'hair','head')
for i,(y,z,tip_y) in enumerate([(-.136,1.35,-.155),(-.108,1.365,-.122),
        (-.038,1.342,-.014),(.008,1.373,.021),(.043,1.355,.06),
        (.112,1.363,.129),(.142,1.343,.16)]):
    tuft('bang_'+str(i),(.139,y,1.438),(.194+.006*math.sin(i),tip_y,z),.034,.027,'hair')
for side in [-1,1]:
    for j in range(6):
        x=.08-j*.035
        tuft('side_lock', (x,side*.129,1.449-j*.003),(x-.025,side*(.176+.012*math.sin(j)),1.366-j*.01-(.026 if j>3 else 0)),.039,.033,'hair')
    for j in range(5):
        tuft('nape_lock',(-.105,side*(.027+j*.026),1.397),(-.138-j*.005,side*(.036+j*.03),1.242+.016*math.sin(j)),.04,.031,'hair')
    for j in range(3):
        tuft('hair_flick',(-.015-j*.042,side*.148,1.399-j*.018),(-.079-j*.041,side*.203,1.407-j*.024),.032,.027,'hair')
# Cap dome in segmented curved panels, white frontal gore-emblem.
verts=[]; faces=[]; n=24
for j in range(9):
    a=(.02+j/8*math.pi/2)
    for i in range(n):
        t=i*math.tau/n
        verts.append((-.025+.151*math.sin(a)*math.cos(t),.167*math.sin(a)*math.sin(t),1.451+.144*math.cos(a)))
for j in range(8):
    for i in range(n):
        # Open arched adjustment cutout at rear, with hair visible through it.
        if j >= 6 and abs(i+.5-12) < (1.7 if j == 7 else .9):
            continue
        faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
mesh('cap_crown',verts,faces,'red','head',sub=1)
# White front is a curved sector closely fitted to crown.
verts=[]; faces=[]
for j in range(8):
    a=.20+j/7*1.375
    for i in range(13):
        t=-.66+i/12*1.32
        verts.append((-.025+.154*math.sin(a)*math.cos(t),.17*math.sin(a)*math.sin(t),1.451+.145*math.cos(a)))
for j in range(7):
    for i in range(12): faces.append((j*13+i,j*13+i+1,(j+1)*13+i+1,(j+1)*13+i))
mesh('cap_white_panel',verts,faces,'white','head',sub=1)
# Brim: curved disc sector with actual edge thickness.
verts=[]
for zoff in [0,-.012]:
    for k in range(5):
        u=k/4
        for i in range(25):
            t=-1.08+i/24*2.16
            x=.047+(.08+u*.112)*math.cos(t)
            y=(.146+u*.023)*math.sin(t)
            z=1.455-.022*u-.012*(y/.17)**2+zoff
            verts.append((x,y,z))
faces=[]
for layer in range(2):
    for k in range(4):
        for i in range(24):
            a=layer*125+k*25+i
            faces.append((a,a+1,a+26,a+25))
for i in range(24): faces.append((100+i,101+i,226+i,225+i))
for i in [0,24]:
    for k in range(4):
        a=k*25+i;faces.append((a,a+25,a+150,a+125))
mesh('cap_curved_brim',verts,faces,'red','head',sub=1)
for t in [-.67,.67,math.pi/2,-math.pi/2,math.pi]:
    points=[]
    for j in range(12):
        a=.1+j/11*1.47
        points.append((-.025+.152*math.sin(a)*math.cos(t),.168*math.sin(a)*math.sin(t),1.451+.145*math.cos(a)))
    tube('cap_panel_seam',points,.0016,'blood','head')
ell('cap_top_button',(-.025,0,1.599),(.012,.012,.009),'red','head',0)
for side in [-1,1]:
    for t in [.8,1.65,2.45]:
        a=1.18; yy=side*.169*math.sin(a)*math.sin(t); xx=-.025+.153*math.sin(a)*math.cos(t)
        ell('cap_vent',(xx,yy,1.451+.145*math.cos(a)),(.004,.004,.004),'dark','head',0)
box('cap_rear_strap',(-.181,0,1.462),(.009,.097,.018),'red','head',.006)
box('cap_strap_clasp',(-.189,.017,1.463),(.007,.021,.013),'hair','head',.003)
# Starburst blood emblem on the cap follows its curved surface.
verts=[(.122,0,1.521)]
for i in range(20):
    a=i*math.tau/20; r=.037*((1+.23*math.sin(i*2.3)) if i%2==0 else (.61+.08*math.cos(i*1.7)))
    y=r*math.cos(a); z=1.521+r*math.sin(a)
    x=-.025+.155*math.sqrt(max(0,1-((z-1.451)/.145)**2-(y/.17)**2))+.003
    verts.append((x,y,z))
mesh('cap_blood_emblem',verts,[(0,i+1,(i+1)%20+1) for i in range(20)],'blood','head')

for i, (y,z,ry,rz) in enumerate([(-.03,1.063,.06,.076),(.067,1.01,.035,.038),(-.071,.871,.045,.026),(.085,.822,.031,.022)]):
    patch('shirt_blood_back',-.2,y,z,ry,rz,'blood','torso',normal=-1,seed=43+i)
# Conform decal geometry to curved fabric; no floating plates or texture dependency.
fabric = [bpy.data.objects[n] for n in ['shirt_body','shirt_hem']]
for o in list(asset.objects):
    if o.type != 'MESH' or not o.name.startswith(('shirt_blood','blood_fleck')):
        continue
    inv = o.matrix_world.inverted()
    for vertex in o.data.vertices:
        world = o.matrix_world @ vertex.co
        side = 1 if world.x > 0 else -1
        origin = Vector((side*.6, world.y, world.z))
        direction = Vector((-side,0,0))
        hits = []
        for target in fabric:
            ti = target.matrix_world.inverted()
            hit, location, normal, _ = target.ray_cast(ti @ origin, ti.to_3x3() @ direction)
            if hit:
                point = target.matrix_world @ location
                hits.append(point)
        if hits:
            point = min(hits,key=lambda p:(p-origin).length)
            point.x += side*.0018
            vertex.co = inv @ point

# Torn lower shirt tails: individual cloth tabs and gaps around the hem.
for i in range(12):
    a=i*math.tau/12
    x=.14*math.cos(a);y=.183*math.sin(a)
    mesh('torn_shirt_tab',[(x-.009,y-.012,.771),(x+.011,y+.012,.771),
        (x+.015,y+.008,.735-(.008 if i%3==0 else 0)),(x-.006,y-.008,.75)],
        [(0,1,2,3)],'white','torso')
# Blood surrounding the open mouth and on the exposed chin.
for side in [-1,1]:
    patch('mouth_blood',.183,side*.048,1.236,.025,.037,'blood','head',seed=39+side)
    patch('mouth_blood',.181,side*.066,1.281,.025,.03,'blood','head',seed=51+side)
# Fit facial blood to the skin surface rather than leaving floating plates.
face_skin=[bpy.data.objects[n] for n in ['skull','jaw','cheek_L','cheek_R']]
for o in list(asset.objects):
    if o.type=='MESH' and o.name.startswith(('mouth_blood','cheek_splash')):
        for vertex in o.data.vertices:
            world=o.matrix_world @ vertex.co
            origin=Vector((.5,world.y,world.z))
            hits=[]
            for skin in face_skin:
                inv=skin.matrix_world.inverted()
                hit,loc,_,_=skin.ray_cast(inv @ origin,inv.to_3x3() @ Vector((-1,0,0)))
                if hit:hits.append(skin.matrix_world @ loc)
            if hits:
                point=min(hits,key=lambda v:(v-origin).length);point.x+=.002
                vertex.co=o.matrix_world.inverted() @ point
# Lift the crown and brim slightly to expose the enlarged eyes and thick bangs.
for o in asset.objects:
    if o.type=='MESH' and o.name.startswith('cap_'):
        o.location.z+=.019

# Hidden caps remain at dismemberment pivots, enclosed by the attached rigid part.
for name in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    pivot=G[name].matrix_world.translation.copy()
    parent=G[name].parent.name
    cap_size = (.024,.025,.008) if name.startswith('foreArm') else (.044,.047,.017)
    stump=ell('stump_'+name,pivot,cap_size,'blood',parent,0)
    if name.startswith(('arm','foreArm')):
        tip = Vector(elbows[name[-1]] if name.startswith('arm') else wrists[name[-1]])
        stump.rotation_euler=(tip-pivot).to_track_quat('Z','Y').to_euler()
    stump.hide_render=True
    stump['hidden']=True
    stump['ss_hidden']=True
    stump['detachedPart']=name
    G[name]['stump']='stump_'+name

# Join decoration by material within each rigid part to keep draw calls practical.
# Stumps keep their own meshes and exact names.
for name, parent in G.items():
    children=[o for o in asset.objects if o.type=='MESH' and o.parent==parent and not o.name.startswith('stump_')]
    batches=[(mat, [o for o in children if o.data.materials and o.data.materials[0]==mat]) for mat in M.values()]
    for mat, batch in batches:
        if len(batch)<2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in batch:o.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join()
        batch[0].name=name+'__'+mat.name

# Character proportions: a large face, broad claws and chunky shoes.
# Mesh-only scaling retains exact rigid joint pivots and introduces no rig scale.
for parent, size in [('torso',(1.07,1.10,1)),('head',(1.60,1.55,1.35)),
                     ('handL',(1.40,1.42,1.38)),('handR',(1.40,1.42,1.38)),
                     ('footL',(1.30,1.30,1.23)),('footR',(1.30,1.30,1.23))]:
    for o in asset.objects:
        if o.parent == G[parent] and o.type == 'MESH':
            o.matrix_basis = Matrix.Diagonal((*size,1)) @ o.matrix_basis

# Bake a lurching rest pose: crouched legs, arched shoulders and forward claws.
G['hip'].location.z-=.06
G['torso'].rotation_euler.y=math.radians(24)
G['head'].location.x+=.035
G['head'].rotation_euler.y=math.radians(-15)
for side in 'LR':
    G['arm'+side].rotation_euler.y=math.radians(-60)
    G['foreArm'+side].rotation_euler.y=math.radians(-40)
    G['hand'+side].rotation_euler.y=math.radians(65)
    G['leg'+side].rotation_euler.y=math.radians(-24)
    G['shin'+side].rotation_euler.y=math.radians(43)
    G['foot'+side].rotation_euler.y=math.radians(-19)
bpy.context.view_layer.update()
# Ground both soles while maintaining ankle pivots inside the padded high-tops.
for side in 'LR':
    foot=G['foot'+side]
    soles=[o for o in asset.objects if o.type=='MESH' and o.parent==foot]
    bottom=min((o.matrix_world @ v.co).z for o in soles for v in o.data.vertices)
    world=foot.matrix_world.copy();world.translation.z-=bottom;foot.matrix_world=world
bpy.context.view_layer.update()
for name in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    cap=bpy.data.objects['stump_'+name]
    pivot=G[name].matrix_world.translation.copy()
    if name.startswith(('arm','foreArm','leg')):
        child=('foreArm' if name.startswith('arm') else 'hand' if name.startswith('foreArm') else 'shin')+name[-1]
        axis=G[child].matrix_world.translation-pivot
        orientation=axis.to_track_quat('Z','Y').to_matrix().to_4x4()
    else:
        orientation=G[name].matrix_world.to_quaternion().to_matrix().to_4x4()
    cap.matrix_world=Matrix.Translation(pivot) @ orientation
bpy.context.view_layer.update()
# Store posed geometry in local mesh coordinates, then reset all joint rotations.
# Animation starts from this actual lurching shape, with translation-only joint nodes.
posed_meshes={o.name:(o.matrix_world.copy(),o.parent.name) for o in asset.objects if o.type=='MESH'}
posed_joints={name:o.matrix_world.translation.copy() for name,o in G.items()}
for name,o in G.items():
    o.matrix_world=Matrix.Translation(posed_joints[name])
    bpy.context.view_layer.update()
for name,(world,parent) in posed_meshes.items():
    o=bpy.data.objects[name]
    transform=G[parent].matrix_world.inverted() @ world
    o.data.transform(transform)
    o.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
required=['root','hip','torso','head','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=0
for o in asset.objects:
    if o.type=='MESH':
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
missing=[n for n in required if n not in asset.objects]
assert not missing, f'Missing infected nodes: {missing}'
assert triangles <= 40000, f'Infected hero budget exceeded: {triangles}'
metrics={'id':'inf.baseball-cap','triangles':triangles,'meshes':sum(o.type=='MESH' for o in asset.objects),'nodes_ok':not missing,'missing_nodes':missing}
(HERE/'build-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('BUILD OK',json.dumps(metrics))
if args.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(args.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False)
    print('GLB OK',args.glb)
if args.pose:
    G['armL'].rotation_euler.x=math.radians(-34)
    G['foreArmL'].rotation_euler.y=math.radians(-48)
    G['legR'].rotation_euler.y=math.radians(-20)
    # Lift the severed limb so the exposed cap and hierarchy are reviewable together.
    G['armL'].location.z+=.12
    G['armL'].location.y+=.2
    bpy.data.objects['stump_armL'].hide_render=False


def stage(view):
    world=bpy.data.worlds.new('warm charcoal studio')
    scene.world=world
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.066,.084,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.7
    def area(name,pos,power,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=power;data.color=color;data.shape='DISK';data.size=size
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos
        o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
    area('softbox',(3,-4,5),450,(1,.84,.7),4)
    area('cool fill',(2,4,3),230,(.7,.8,1),3)
    area('gold rim',(-3,1,4),550,(1,.55,.3),3)
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object;floor.name='studio_floor';floor.data.materials.append(material('studioFloor','#35313c',.9))
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'))
    scene.collection.objects.link(camera);scene.camera=camera
    views={'ref':(4,-3,2.05),'front':(5,0,1.25),'side':(0,-5,1.25),'back':(-5,0,1.25)}
    camera.location=views[view];target=Vector((.23,0,.8))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=2.08*args.width/args.height
    scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=True
    scene.cycles.device='GPU';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width;scene.render.resolution_y=args.height;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.image_settings.file_format='PNG'

if args.render:
    stage(args.view)
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)
