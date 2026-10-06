"""Authored rigid-joint actions. Rebuild via experiment/tools/blender_run.py.

No geometry or procedural oscillators: contact / down / passing / up poses,
and anticipation / strike / follow-through / recovery poses are keyed in Blender.
The GLB is the source for the compact runtime tracks (tools/assets/animation-library.ts).
Angles below are game-space XYZ degrees (+X forward, Y up).
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Euler, Quaternion, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
HERE = Path(__file__).resolve().parent
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
output = Path(argv[argv.index('--glb') + 1]) if '--glb' in argv else HERE / 'library.glb'
nodes = {}
rest = {}
def joint(name, parent, p):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = nodes.get(parent)
    obj.location = (p[0], -p[2], p[1])
    obj.rotation_mode = 'QUATERNION'
    nodes[name] = obj
    rest[name] = Vector(p)

joint('root', None, (0, 0, 0))
joint('hip', 'root', (0, .705, 0))
joint('torso', 'hip', (0, .05, 0))
joint('head', 'torso', (0, .3, 0))
joint('backpackSocket', 'torso', (-.111, .169, 0))
for side, sign in [('L', -1), ('R', 1)]:
    joint('arm'+side, 'torso', (0, .25, sign*.172))
    joint('foreArm'+side, 'arm'+side, (.012, -.162, sign*.063))
    joint('hand'+side, 'foreArm'+side, (.013, -.163, sign*.047))
    joint('weaponSocket'+side, 'hand'+side, (0, 0, 0))
    joint('leg'+side, 'hip', (0, -.047, sign*.094))
    joint('shin'+side, 'leg'+side, (.008, -.233, sign*.018))
    joint('foot'+side, 'shin'+side, (-.014, -.283, sign*.018))
# Quadruped actions use separate names, except shared head/root, and are retargeted by name.
joint('body', 'root', (-.12, .4, 0))
joint('tail', 'body', (-.45, .08, 0))
joint('wingL', 'body', (0, 0, -.2))
joint('wingR', 'body', (0, 0, .2))
joint('packSocket', 'body', (-.05, .22, 0))
for side, x, z in [('FL', .375, -.162), ('FR', .375, .162), ('BL', -.34, -.162), ('BR', -.34, .162)]:
    joint('leg'+side, 'body', (x, -.08, z))

humans = [n for n in nodes if n not in ['body', 'tail', 'packSocket', 'legFL', 'legFR', 'legBL', 'legBR', 'wingL', 'wingR']]
dogs = ['body', 'head', 'tail', 'packSocket', 'legFL', 'legFR', 'legBL', 'legBR']
# Maps of offsets: rotation XYZ, then optional position XYZ. All unmentioned joints are rest.
def p(**kw):
    return kw
def z(angle):
    return (0, 0, angle)
def hip(x=0, y=0, roll=0, twist=0, lean=0):
    return (roll, twist, lean, x, y, 0)
def action(name, duration, poses, contract=humans):
    for node_name in contract:
        obj = nodes[node_name]
        obj.animation_data_create()
        act = bpy.data.actions.new(name+'__'+node_name)
        obj.animation_data.action = act
        for phase, pose in poses:
            value = pose.get(node_name, (0, 0, 0))
            # Basis conjugation converts a game-space rotation to Blender Z up.
            q = Euler(tuple(math.radians(v) for v in value[:3]), 'XYZ').to_quaternion()
            basis = Quaternion((1, 0, 0), math.pi/2)
            obj.rotation_quaternion = basis @ q @ basis.inverted()
            pos = rest[node_name] + Vector(value[3:6] if len(value) == 6 else (0, 0, 0))
            obj.location = (pos.x, -pos.z, pos.y)
            frame = 1 + round(phase * duration * 60)
            obj.keyframe_insert('rotation_quaternion', frame=frame, group=node_name)
            obj.keyframe_insert('location', frame=frame, group=node_name)
        # Clamp Bezier handles: smooth authored curves cannot overshoot planted feet.
        for slot in act.slots:
            for layer in act.layers:
                for strip in layer.strips:
                    bag = strip.channelbag(slot)
                    if bag:
                        for curve in bag.fcurves:
                            for key in curve.keyframe_points:
                                key.handle_left_type = key.handle_right_type = 'AUTO_CLAMPED'
        track = obj.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, act)
        obj.animation_data.action = None
        obj.rotation_quaternion = Quaternion()
        pos = rest[node_name]
        obj.location = (pos.x, -pos.z, pos.y)

action('idle', 4, [(0,p(hip=hip(y=-.006),foreArmL=z(12),foreArmR=z(14))),
    (.25,p(hip=hip(y=.002,roll=1),torso=(0,2,-1),head=(0,-5,1),foreArmL=z(14),foreArmR=z(12))),
    (.5,p(hip=hip(y=-.006),torso=(0,-2,0),head=(0,5,0),foreArmL=z(12),foreArmR=z(14))),
    (.75,p(hip=hip(y=.002,roll=-1),torso=(0,-1,-1),head=(0,2,1),foreArmL=z(14),foreArmR=z(12))),
    (1,p(hip=hip(y=-.006),foreArmL=z(12),foreArmR=z(14)))])

# Key foot targets describe a 0.9 m stride. Solve the two-joint knee at the authored
# contact/passing points so the sole stays on the floor through the stance.
def leg_pose(x, lift, pelvis_y):
    a,b=.233,.283
    dy=.142+lift-(.658+pelvis_y)
    d=min(a+b-.001,math.hypot(x,dy))
    knee=-(math.pi-math.acos(max(-1,min(1,(a*a+b*b-d*d)/(2*a*b)))))
    thigh=math.atan2(x,-dy)+math.acos(max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))))
    return math.degrees(thigh),math.degrees(knee)
def gait(name,duration,stride,run=False,infected=False):
    # stance occupies half a cycle; the rear foot lifts through passing, then reaches.
    targets=[(.225,0),(.11,0),(-.01,0),(-.12,0),(-.225,.015),(-.14,.12),(.015,.16),(.19,.10),(.225,0)]
    heights=[-.064,-.038,-.027,-.045,-.064,-.038,-.027,-.045,-.064]
    poses=[]
    for i in range(9):
        y=([-.135,-.08,-.015,-.065,-.135,-.08,-.015,-.065,-.135][i] if run else heights[i])
        pose=p(hip=hip(y=y,roll=[0,-2,-3,-2,0,2,3,2,0][i],twist=[-4,-2,0,2,4,2,0,-2,-4][i]),
            torso=(0,[6,3,0,-3,-6,-3,0,3,6][i],-9 if run else -2),head=(0,0,9 if run else 2))
        for side,index in [('L',i),('R',(i+4)%8)]:
            x,lift=targets[index]
            thigh,knee=leg_pose(x*(1.3 if run else 1),lift*(1.25 if run else 1),y)
            pose['leg'+side]=z(thigh)
            pose['shin'+side]=z(knee)
            pose['foot'+side]=z(-thigh-knee+[ -8,0,0,10,20,-12,-18,-10, -8][index])
            arm=[-27,-14,0,14,27,14,0,-14,-27][index]*(1.15 if run else .65)
            pose['arm'+side]=(0,0,arm+(-12 if infected and side=='L' else 0))
            pose['foreArm'+side]=z((65 if run else 20)+[0,4,8,4,0,-4,-8,-4,0][index])
        if infected:
            pose['torso']=(4,pose['torso'][1]+7,-15)
            pose['head']=(i%3*3-3,-8,12)
            pose['armL']=(-12,0,47+(i%4)*3)
            pose['foreArmR']=z(34)
        if name=='npc-walk-relaxed':
            pose['torso']=(0,pose['torso'][1]*.55,1)
            pose['head']=(0,[0,4,8,4,0,-4,-8,-4,0][i],-1)
            pose['armL']=z(pose['armL'][2]*.75-5)
            pose['armR']=z(pose['armR'][2]*.75+3)
            pose['foreArmL']=z(14)
            pose['foreArmR']=z(18)
        poses.append((i/8,pose))
    action(name,duration,poses)
gait('walk',.8,.9)
gait('run',.6,1.8,True)
gait('shamble',1.1,.72,False,True)
gait('infected-run',.64,1.5,True,True)
gait('npc-walk',.9,.9)
gait('npc-walk-relaxed',1,.85)
action('start',.18,[(0,p()),(.4,p(hip=hip(y=-.055),torso=z(-10),legL=z(15),shinL=z(-28),armR=z(15))),
    (1,p(torso=z(-8),legL=z(25),shinL=z(-30),legR=z(-15),foreArmL=z(55),foreArmR=z(55)))])
action('stop',.22,[(0,p(torso=z(-8),legL=z(20),shinL=z(-25))),(.45,p(hip=hip(y=-.045),torso=z(5),legL=z(12),shinL=z(-20))), (1,p())])
for name,sign in [('turn-left',1),('turn-right',-1)]:
    action(name,.35,[(0,p()),(.35,p(hip=hip(y=-.025,twist=sign*9),torso=(0,sign*15,0),head=(0,sign*18,0),legL=(0,-sign*10,12),shinL=z(-20))),(.7,p(hip=hip(y=-.02,twist=-sign*5),legR=(0,sign*10,12),shinR=z(-20))), (1,p())])

# Every strike lands at 20% of its duration (the catalog's active tick). Backhands
# reverse shoulder/hip torque; finishers use an overhead plane and a deep knee load.
for weapon in ['fists','bat','crowbar','machete']:
    for combo in range(3):
        sign=1 if combo!=1 else -1
        blade=weapon=='machete'; hook=weapon=='crowbar'; fists=weapon=='fists'
        overhead=combo==2 and not fists
        arm='armL' if fists and combo==0 else 'armR'
        fore='foreArmL' if arm=='armL' else 'foreArmR'
        guard=p(armL=z(48),foreArmL=z(70),armR=z(52),foreArmR=z(70)) if fists else p(armL=z(28),foreArmL=z(35),foreArmR=z(35))
        wind={**guard,'hip':hip(y=-.035,twist=-sign*14),'torso':(0,-sign*32,8),'head':(0,sign*20,-5),
            arm:(-sign*25,-sign*28,158 if overhead else 45 if fists else -35),fore:z(85 if overhead or fists else 45)}
        strike={**guard,'hip':hip(x=.08,y=-.03,twist=sign*12),'torso':(0,sign*(22 if fists else 42),-14),'head':(0,-sign*12,10),
            arm:(sign*8,sign*(15 if fists else 58),92 if not overhead else 118),fore:z(5 if not hook else 25),
            'legL':z(18),'shinL':z(-25),'legR':z(-14),'shinR':z(-9)}
        if fists and combo==2:
            wind[arm]=(0,-18,-10);wind[fore]=z(112)
            strike[arm]=(0,25,138);strike[fore]=z(42)
        if blade:
            strike[arm]=(sign*28,sign*72,88 if combo<2 else 125)
        follow={**guard,'hip':hip(x=.09,y=-.025,twist=sign*16),'torso':(0,sign*50,-9),arm:(sign*12,sign*90,48 if overhead else 110),fore:z(22),'head':(0,-sign*22,6), 'legL':z(14),'shinL':z(-20)}
        action(weapon+'-'+str(combo+1),1,[(0,guard),(.10,wind),(.20,strike),(.36,follow),(.68,{**guard,'torso':(0,sign*8,-2)}),(1,guard)])
action('swing',.5,[(0,p()),(.1,p(armR=z(-30),torso=(0,-30,5))),(.2,p(armR=(0,55,100),foreArmR=z(8),torso=(0,35,-10))),(.5,p(armR=(0,85,100),torso=(0,45,-5))),(1,p())])
action('kick',.65,[(0,p(armL=z(35),foreArmL=z(50))),(.12,p(hip=hip(y=-.03),legR=z(68),shinR=z(-110),torso=z(12))),
    (.20,p(hip=hip(x=.06,y=.02),legR=z(98),shinR=z(-8),footR=z(-25),torso=z(18),armL=z(55),armR=z(-35),legL=z(-8))),
    (.38,p(legR=z(80),shinR=z(-22),torso=z(15),armR=z(-25))),(.62,p(legR=z(25),shinR=z(-65),torso=z(4))),(1,p())])
action('spin-kick',.65,[(0,p()),(.10,p(hip=hip(y=-.035,twist=-35),torso=(0,-55,8),legR=z(45),shinR=z(-80))),
    (.20,p(hip=hip(y=.025,twist=48),torso=(0,35,15),legR=(20,15,98),shinR=z(-5),armL=z(70),armR=z(-55))),
    (.42,p(hip=hip(twist=85),torso=(0,50,8),legR=(0,30,70),shinR=z(-22))),(.75,p(hip=hip(twist=15),shinR=z(-35))),(1,p())])
for name,sign in [('stagger-left',1),('stagger-right',-1)]:
    action(name,.42,[(0,p()),(.18,p(hip=hip(y=-.035,twist=sign*14),torso=(sign*12,sign*24,20),head=(0,-sign*15,-15),armL=z(45),armR=z(55),shinL=z(-30))),(.5,p(hip=hip(y=-.02),torso=(sign*6,sign*12,8),foreArmL=z(35))),(1,p())])
action('hurt',.3,[(0,p()),(.2,p(hip=hip(y=-.04),torso=z(23),head=z(-16),foreArmL=z(55),armR=z(45))),(.55,p(torso=z(10))),(1,p())])
# Grounded end poses are normalized to each target's hip height at retarget time.
back=p(hip=(0,0,88,0,-.55,0),torso=z(8),head=z(-20),armL=(25,0,-20),armR=(-30,0,-15),foreArmL=z(0),foreArmR=z(5),legL=z(6),shinL=z(-12),legR=z(12),shinR=z(-20),footL=z(6),footR=z(8))
side=p(hip=(90,0,0,0,-.55,0),torso=(8,15,-12),head=(0,-15,8),armL=(-65,0,10),foreArmL=z(20),armR=z(25),foreArmR=z(10),legL=z(38),shinL=z(-75),legR=z(12),shinR=z(-35))
crumple=p(hip=(12,0,-80,0,-.55,0),torso=z(-15),head=z(28),armL=(25,0,35),armR=(-35,0,35),foreArmL=z(80),foreArmR=z(80),legL=z(35),shinL=z(-90),legR=z(18),shinR=z(-68))
for name,end in [('die',back),('death-back',back),('death-side',side),('death-crumple',crumple)]:
    action(name,.72,[(0,p()),(.16,p(hip=hip(y=-.05),torso=z(25 if end is back else -20),armL=z(60),armR=z(65),shinL=z(-35))),(.48,{**end,'hip':tuple(end['hip'][:3])+(0,-.35,0)}),(.8,end),(1,end)])
action('knockdown',.48,[(0,p()),(.18,p(hip=hip(y=-.09),torso=z(34),armL=z(78),armR=z(62),shinL=z(-45))),(.55,p(hip=(0,0,58,0,-.32,0),torso=z(18),head=z(-25),armL=z(-10),armR=z(25),legL=z(38),shinL=z(-65))),(.86,back),(1,back)])
action('flung',.48,[(0,p()),(.14,p(hip=(0,-12,25,0,.04,0),torso=z(15),head=z(-18),armL=(32,0,100),armR=(-38,0,108),legL=z(52),shinL=z(-72),legR=z(25),shinR=z(-45))),(.48,p(hip=(0,8,66,0,-.16,0),torso=z(8),head=z(-30),armL=(35,0,32),armR=(-42,0,15),legL=z(48),shinL=z(-60),legR=z(22),shinR=z(-48))),(.9,back),(1,back)])
action('get-up',.95,[(0,back),(.25,p(hip=(0,0,48,0,-.4,0),torso=z(-28),legL=z(55),shinL=z(-100),foreArmR=z(70))),(.65,p(hip=hip(y=-.2),torso=z(-30),legL=z(35),shinL=z(-70),armR=z(30))),(1,p())])
action('crawl',1,[(0,p(hip=(0,0,-78,0,-.42,0),armL=z(35),armR=z(85),shinL=z(-85),shinR=z(-40))),(.5,p(hip=(0,0,-78,0,-.42,0),armL=z(85),armR=z(35),shinL=z(-40),shinR=z(-85))),(1,p(hip=(0,0,-78,0,-.42,0),armL=z(35),armR=z(85),shinL=z(-85),shinR=z(-40)))])
action('windup',.5,[(0,p()),(.65,p(torso=z(-22),armL=z(-45),armR=z(-35),foreArmL=z(30))), (1,p(torso=z(-28),armL=z(-55),armR=z(-48)))])
for name,duration,end in [('shoot',.2,p(armR=z(90),foreArmR=z(5))),('throw',.6,p(armR=z(100),foreArmR=z(15))),('interact',.75,p(torso=z(-15),armL=z(65),armR=z(65),foreArmL=z(25))),('enter-car',1,p(hip=hip(y=-.2),legL=z(80),legR=z(80),shinL=z(-80),shinR=z(-80)))]:
    action(name,duration,[(0,p()),(.2,end),(.6,end),(1,p() if name!='enter-car' else end)])

action('corgi-idle',3,[(0,p(head=(0,-4,2),tail=(0,-12,0))),(.25,p(head=(0,8,-3),tail=(0,20,0))),(.5,p(head=(0,4,1),tail=(0,-15,0))),(.75,p(head=(0,-6,0),tail=(0,15,0))),(1,p(head=(0,-4,2),tail=(0,-12,0)))],dogs)
for name,duration in [('corgi-walk',.7),('corgi-trot',.46)]:
    poses=[]
    # Diagonal pairs contact together in trot; four beats in a walk.
    angles=[38,19,-4,-30,-40,-19,11,42,38] if name=='corgi-trot' else [24,12,-3,-20,-25,-12,8,28,24]
    for i in range(9):
        pose=p(body=(0,0,[0,-1,0,1,0,-1,0,1,0][i],0,[0,-.014,0,.012,0,-.014,0,.012,0][i],0),head=z([0,1,0,-1,0,1,0,-1,0][i]),tail=(0,[0,10,15,10,0,-10,-15,-10,0][i],0))
        for side,offset in [('FL',0),('BR',0 if name=='corgi-trot' else 6),('FR',4),('BL',4 if name=='corgi-trot' else 2)]:
            pose['leg'+side]=z(angles[(i+offset)%8])
        poses.append((i/8,pose))
    action(name,duration,poses,dogs)
sit=p(body=(0,0,18,0,-.12,0),head=z(-18),legBL=z(-55),legBR=z(-55),legFL=z(-15),legFR=z(-15),tail=(0,15,0))
action('corgi-sit',.4,[(0,p()),(.5,{**sit,'body':(0,0,12,0,-.08,0)}),(1,sit)],dogs)

action('infected-flight',.35,[(0,p()),(.25,p(wingL=(35,0,0),wingR=(-35,0,0))),(.5,p()),(.75,p(wingL=(-45,0,0),wingR=(45,0,0))),(1,p())],['body','head','wingL','wingR'])
action('animal-death',.6,[(0,p()),(.35,p(body=(0,0,35,0,-.08,0),head=z(-15))),(.75,p(body=(0,0,85,0,-.24,0),head=z(-25),legFL=z(25),legFR=z(-15),legBL=z(35),legBR=z(15))),(1,p(body=(0,0,90,0,-.24,0),head=z(-25),legFL=z(25),legFR=z(-15),legBL=z(35),legBR=z(15)))],dogs+['wingL','wingR'])

scene.frame_start=1
scene.frame_end=241
bpy.ops.object.select_all(action='SELECT')
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output.resolve()),export_format='GLB',use_selection=True,
    export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',
    export_optimize_animation_size=True,export_optimize_animation_keep_anim_object=True,
    export_force_sampling=True,export_frame_range=False,export_frame_step=1,
    export_cameras=False,export_lights=False)
print('EXPORT OK authored animation library',output)
