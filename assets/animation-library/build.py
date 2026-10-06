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
def hip(x=0, y=0, roll=0, twist=0, lean=0, sway=0):
    return (roll, twist, lean, x, y, sway)
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

# Library leg keys establish the silhouette. Retargeting bakes rig-specific
# support tracks using actual limb lengths, pelvis rotation and runtime strides.
def leg_pose(x, lift, pelvis_y):
    a,b=.233,.283
    dy=.142+lift-(.658+pelvis_y)
    d=min(a+b-.001,math.hypot(x,dy))
    knee=-(math.pi-math.acos(max(-1,min(1,(a*a+b*b-d*d)/(2*a*b)))))
    thigh=math.atan2(x,-dy)+math.acos(max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))))
    return math.degrees(thigh),math.degrees(knee)
def gait(name,duration,stride,run=False,infected=False):
    # Contact -> down -> passing -> up: load follows contact, with modest lift.
    # Retargeted walks use 60% stance; runs use 50% (no exaggerated flight).
    targets=[(.225,0),(.11,0),(-.01,0),(-.12,0),(-.225,.015),(-.14,.045),(.015,.06),(.19,.035),(.225,0)]
    heights=[-.055,-.075,-.06,-.047,-.055,-.075,-.06,-.047,-.055]
    poses=[]
    for i in range(9):
        y=([-.085,-.11,-.08,-.065,-.085,-.11,-.08,-.065,-.085][i] if run else heights[i])
        pose=p(hip=hip(y=y,roll=[0,-2,-3,-2,0,2,3,2,0][i],twist=[-4,-2,0,2,4,2,0,-2,-4][i],sway=[0,-.012,-.018,-.012,0,.012,.018,.012,0][i]),
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
for weapon in ['fists','crowbar','machete']:  # bat: authored chain below (E19 lane G)
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
# ---- E19 L1 v2 (lane G). Kept before the shared clips below: the last NLA strip per
# node must start at rest, because the export samples frame 1 as each node's rest TRS.
# ---- E19 L1 v2 (lane G): infected speed tiers, search, courier, civilians, corgi warnings ----
def ik_leg(dx, dy):
    """Thigh/knee degrees placing the ankle at (dx forward, dy up) from the hip joint."""
    a,b=.233,.283
    d=min(a+b-.001,max(.05,math.hypot(dx,dy)))
    knee=-(math.pi-math.acos(max(-1,min(1,(a*a+b*b-d*d)/(2*a*b)))))
    thigh=math.atan2(dx,-dy)+math.acos(max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))))
    return math.degrees(thigh),math.degrees(knee)
def wave(values,i):
    return values[i%8]
# Speed reads from the silhouette (E19 §5.4): the frail tier chops a short stiff
# shuffle under a hunched back; the average tier lurches side to side with arms
# reaching; the athletic tier runs long and low with pumping arms. Legs are
# re-planted at retarget time (clips.ts plantLocomotion); these keys own the
# pelvis load, torso lean/roll, head and arms.
def infected_gait(name,duration,lean,bob,roll,twist,sway,head,arms):
    poses=[]
    for i in range(9):
        k=i%8
        pose=p(hip=hip(y=bob[k],roll=roll[k],twist=twist[k],sway=sway[k],lean=lean[0]),
               torso=(roll[k]*lean[2],-twist[k]*1.4,lean[1]),head=head(k))
        for side,index in [('L',k),('R',(k+4)%8)]:
            thigh,knee=ik_leg([.2,.1,0,-.1,-.2,-.12,.02,.16][index]*.9,-.6+[0,0,0,0,.02,.06,.07,.03][index])
            pose['leg'+side]=z(thigh); pose['shin'+side]=z(knee)
        pose.update(arms(k))
        poses.append((i/8,pose))
    action(name,duration,poses)
# frail: short, quick, stiff; limping roll; head craned forward from a hunched back.
infected_gait('infected-frail',.5,(-6,-30,.3),[-.085,-.1,-.09,-.075,-.08,-.095,-.088,-.078],
    [0,-5,-4,-1,1,3,2,0],[-3,-1,0,1,3,1,0,-1],[0,-.015,-.02,-.012,0,.012,.018,.01],
    lambda k:(wave([4,6,3,-2,-4,-1,2,5],k),-6,30+wave([0,2,3,2,0,-2,-3,-2],k)),
    lambda k:{'armL':(-10,0,28+wave([0,2,4,2,0,-2,-4,-2],k)),'foreArmL':z(52),'armR':(8,0,18-wave([0,2,4,2,0,-2,-4,-2],k)),'foreArmR':z(40),'handL':z(-25),'handR':z(-20)})
# average: the lurch. Large pelvis roll and sway, torso falling over the support
# leg, head lolling a beat late, both arms reaching for the target.
infected_gait('infected-lurch',.64,(-4,-20,.9),[-.07,-.11,-.085,-.06,-.07,-.11,-.085,-.06],
    [0,-8,-10,-6,0,8,10,6],[-9,-5,0,5,9,5,0,-5],[0,-.028,-.035,-.02,0,.028,.035,.02],
    lambda k:(wave([-10,-14,-8,0,10,14,8,0],k),-6,16),
    lambda k:{'armL':(-14,0,66+wave([0,6,10,6,0,-6,-10,-6],k)),'foreArmL':z(18),'armR':(10,0,58-wave([0,6,10,6,0,-6,-10,-6],k)),'foreArmR':z(26),'handL':z(-15),'handR':z(-10)})
# athletic: long low sprint, aggressive lean, arms pumping hard, head driving forward.
infected_gait('infected-sprint',.48,(-10,-26,.2),[-.1,-.13,-.085,-.05,-.1,-.13,-.085,-.05],
    [0,-3,-4,-2,0,3,4,2],[-8,-4,0,4,8,4,0,-4],[0,-.01,-.014,-.008,0,.01,.014,.008],
    lambda k:(wave([2,0,-2,0,2,0,-2,0],k),wave([4,2,0,-2,-4,-2,0,2],k),24),
    lambda k:{'armL':(0,0,-wave([-55,-30,0,30,55,30,0,-30],k)),'foreArmL':z(80+wave([0,10,20,10,0,-10,-20,-10],k)*.5),
              'armR':(0,0,wave([-55,-30,0,30,55,30,0,-30],k)),'foreArmR':z(80-wave([0,10,20,10,0,-10,-20,-10],k)*.5),'handL':z(-30),'handR':z(-30)})
# Spooky stand: hunched sway, slow breathing, sudden head twitches (two-frame keys).
hunch=p(hip=hip(y=-.05,roll=4),torso=(5,6,-20),head=(-8,-10,14),armL=(-12,0,30),foreArmL=z(30),armR=(10,0,20),foreArmR=z(36),handL=z(-25),handR=z(-20),legL=z(6),shinL=z(-14),legR=z(-4),shinR=z(-12))
def twitch(pose,**kw):
    return {**pose,**kw}
action('infected-idle',3.2,[(0,hunch),(.2,twitch(hunch,torso=(2,0,-18),head=(-4,4,10))),
    (.38,twitch(hunch,torso=(2,0,-18),head=(-4,4,10))),(.4,twitch(hunch,torso=(2,0,-18),head=(18,10,6))),
    (.5,twitch(hunch,torso=(2,-4,-21),head=(16,12,8))),(.7,twitch(hunch,hip=hip(y=-.055,roll=-3),torso=(-3,-6,-22),head=(-6,-14,14))),
    (.82,twitch(hunch,hip=hip(y=-.055,roll=-3),torso=(-3,-6,-22),head=(-6,-14,14))),(.835,twitch(hunch,hip=hip(y=-.055,roll=-3),torso=(-3,-6,-22),head=(-20,-30,4),armL=(-12,0,38))),
    (.92,twitch(hunch,head=(-12,-18,10))),(1,hunch)])
# Search: stop, crane, sweep left, hold, snap right, sniff upward, double-take.
look=lambda yaw,pitch=10,chest=.5:{'hip':hip(y=-.045,twist=yaw*.15),'torso':(4,yaw*chest,-16),'head':(-4,yaw*(1-chest)*1.3,pitch)}
action('infected-search',2.6,[(0,{**hunch,**look(0)}),(.12,{**hunch,**look(42)}),(.3,{**hunch,**look(48,6)}),
    (.36,{**hunch,**look(-20)}),(.42,{**hunch,**look(-52,8)}),(.58,{**hunch,**look(-50,6)}),
    (.66,{**hunch,**look(-10,28,.3),'armL':(-12,0,40)}),(.74,{**hunch,**look(-6,26,.3)}),(.78,{**hunch,**look(30,4)}),
    (.84,{**hunch,**look(22,8)}),(1,{**hunch,**look(0)})])

# Courier on the cargo bicycle: seated, leaning on the bars, pedalling a crank
# circle (ankles on a 0.1 m circle ahead of/below the hip, cranks opposite).
seat=p(hip=hip(y=-.04,lean=-6),torso=(0,0,-18),head=(0,0,16),armL=(-8,0,62),foreArmL=z(28),armR=(8,0,62),foreArmR=z(28),handL=z(-18),handR=z(-18))
poses=[]
for i in range(9):
    angle=i/8*math.tau
    pose=dict(seat)
    for side,offset in [('L',0),('R',math.pi)]:
        cx,cy=.16+.09*math.cos(angle+offset),-.4+.09*math.sin(angle+offset)
        thigh,knee=ik_leg(cx,cy)
        pose['leg'+side]=z(thigh); pose['shin'+side]=z(knee); pose['foot'+side]=z(-thigh-knee-8+6*math.sin(angle+offset))
    pose['hip']=hip(y=-.04+.006*math.cos(2*angle),roll=1.5*math.sin(angle),lean=-6)
    poses.append((i/8,pose))
action('ride',.6,poses)
ride0=poses[0][1]
action('mount',.4,[(0,p()),(.35,p(hip=hip(y=-.03,roll=-10),torso=(-6,0,-6),legR=(-38,0,30),shinR=z(-60),armL=z(40),armR=z(45))),(.7,{**ride0,'legR':(-12,0,60),'hip':hip(y=-.02,roll=-4)}),(1,ride0)])
action('dismount',.4,[(0,ride0),(.3,{**ride0,'legR':(-35,0,40),'shinR':z(-55),'hip':hip(y=-.01,roll=-8)}),(.7,p(hip=hip(y=-.035),legR=z(-6),shinR=z(-18),armL=z(18),armR=z(20))),(1,p())])
# Parcel: elbows in, forearms level, box against the chest; hand-over extends it,
# with a small bow and a nod, then returns empty-handed.
carry=p(armL=z(26),foreArmL=z(88),armR=z(26),foreArmR=z(88),handL=z(-12),handR=z(-12),torso=z(3))
action('carry',.5,[(0,carry),(1,carry)])
offer=p(hip=hip(y=-.03),torso=z(-14),head=z(-6),armL=z(72),foreArmL=z(28),armR=z(72),foreArmR=z(28),handL=z(-20),handR=z(-20))
action('hand-over',1,[(0,carry),(.2,{**carry,'torso':z(6),'hip':hip(y=-.01)}),(.42,offer),(.6,{**offer,'head':z(-14)}),(.78,p(torso=z(-4),head=z(4),armL=z(12),armR=z(14),foreArmL=z(20),foreArmR=z(22))),(1,p())])
# Garage bat pickup: lift, twirl the grip a full turn, settle it on the shoulder.
action('equip',.9,[(0,p()),(.15,p(hip=hip(y=-.03),armR=(0,0,70),foreArmR=z(40),torso=(0,-10,-4))),
    (.3,p(armR=(0,0,88),foreArmR=z(30),handR=(0,-120,0),torso=(0,-6,-2))),(.42,p(armR=(0,0,92),foreArmR=z(28),handR=(0,-240,0))),
    (.55,p(armR=(0,0,86),foreArmR=z(34),handR=(0,-358,0),head=(0,-10,4))),(.75,p(armR=(0,-20,40),foreArmR=z(125),handR=(0,-360,-20),torso=(0,8,1),head=z(6))),(1,p(handR=(0,-360,0)))])

# Civilians: startle hop back with guarding arms; panic flight with flailing arms
# and over-the-shoulder looks; grabbed struggle pushing an attacker away.
action('civ-startle',.6,[(0,p()),(.12,p(hip=hip(x=-.03,y=.025),torso=(0,0,16),head=z(12),armL=(-20,0,70),foreArmL=z(115),armR=(20,0,72),foreArmR=z(118),legR=z(-18),shinR=z(-20))),
    (.3,p(hip=hip(x=-.06,y=-.05),torso=(0,0,10),head=z(4),armL=(-25,0,62),foreArmL=z(110),armR=(25,0,64),foreArmR=z(112),legR=z(-26),shinR=z(-35),legL=z(10),shinL=z(-30))),
    (.65,p(hip=hip(x=-.05,y=-.03),torso=(0,-10,4),head=(0,-12,2),armL=(-15,0,45),foreArmL=z(95),armR=(15,0,40),foreArmR=z(90),legR=z(-18),shinR=z(-24))),(1,p(hip=hip(x=-.04,y=-.02),armL=z(25),foreArmL=z(60),armR=z(25),foreArmR=z(55),legR=z(-14),shinR=z(-18)))])
poses=[]
for i in range(9):
    k=i%8
    pose=p(hip=hip(y=wave([-.08,-.11,-.08,-.06,-.08,-.11,-.08,-.06],k),roll=wave([0,-3,-4,-2,0,3,4,2],k),twist=wave([-6,-3,0,3,6,3,0,-3],k)),
           torso=(0,wave([8,4,0,-4,-8,-4,0,4],k),-12),head=(0,wave([0,0,0,0,0,30,40,20],k),10))
    for side,index in [('L',k),('R',(k+4)%8)]:
        thigh,knee=ik_leg([.22,.11,0,-.11,-.22,-.13,.02,.17][index],-.6+[0,0,0,0,.02,.07,.08,.03][index])
        pose['leg'+side]=z(thigh); pose['shin'+side]=z(knee)
        pose['arm'+side]=((-1 if side=='L' else 1)*-25,0,wave([110,80,40,10,30,70,100,120],index))
        pose['foreArm'+side]=z(wave([30,50,70,40,30,25,20,25],index))
    poses.append((i/8,pose))
action('civ-flee',.62,poses)
action('civ-grabbed',.8,[(0,p(hip=hip(y=-.06,twist=-12),torso=(0,-22,12),head=(0,30,6),armL=(-10,0,82),foreArmL=z(25),armR=(10,0,70),foreArmR=z(45),legL=z(-10),shinL=z(-25),legR=z(18),shinR=z(-30))),
    (.25,p(hip=hip(y=-.05,twist=10),torso=(6,18,14),head=(0,-26,2),armL=(-10,0,60),foreArmL=z(60),armR=(10,0,88),foreArmR=z(18),legL=z(-14),shinL=z(-30),legR=z(16),shinR=z(-24))),
    (.5,p(hip=hip(y=-.07,twist=-14),torso=(-6,-24,16),head=(10,32,0),armL=(-10,0,85),foreArmL=z(20),armR=(10,0,66),foreArmR=z(50),legL=z(-10),shinL=z(-28),legR=z(20),shinR=z(-34))),
    (.75,p(hip=hip(y=-.05,twist=8),torso=(4,16,12),head=(0,-24,4),armL=(-10,0,64),foreArmL=z(55),armR=(10,0,86),foreArmR=z(22),legL=z(-12),shinL=z(-26),legR=z(15),shinR=z(-26))),
    (1,p(hip=hip(y=-.06,twist=-12),torso=(0,-22,12),head=(0,30,6),armL=(-10,0,82),foreArmL=z(25),armR=(10,0,70),foreArmR=z(45),legL=z(-10),shinL=z(-25),legR=z(18),shinR=z(-30)))])

# Corgi warnings (E19 §5.8): stiffen (freeze low, nose and tail straight), growl
# (head low, lips/body tremor), bark (front-paw push, head snaps up), nervous
# (tail tucked, glances), and a rotary gallop beside the bicycle.
stiff=p(body=(0,0,-4,0,-.03,0),head=z(4),tail=(0,0,-8),legFL=z(-8),legFR=z(-8),legBL=z(10),legBR=z(10))
action('corgi-stiffen',.5,[(0,p()),(.3,{**stiff,'head':z(8)}),(1,stiff)],dogs)
growl=p(body=(0,0,-7,.02,-.06,0),head=z(-14),tail=(0,0,-2),legFL=z(-14),legFR=z(-14),legBL=z(14),legBR=z(14))
action('corgi-growl',.4,[(0,growl),(.25,{**growl,'body':(0,0,-7.5,.02,-.066,0),'head':(0,1.5,-15)}),(.5,growl),(.75,{**growl,'body':(0,0,-6.5,.02,-.056,0),'head':(0,-1.5,-13)}),(1,growl)],dogs)
action('corgi-bark',.5,[(0,stiff),(.15,{**stiff,'body':(0,0,-8,-.02,-.06,0),'head':z(-10)}),(.3,{**stiff,'body':(0,0,9,.03,.02,0),'head':z(26),'legFL':z(14),'legFR':z(10)}),
    (.45,{**stiff,'body':(0,0,2,.01,-.01,0),'head':z(12)}),(.62,{**stiff,'body':(0,0,7,.02,.01,0),'head':z(22)}),(1,stiff)],dogs)
nervous=p(body=(0,0,-3,0,-.04,0),head=z(-6),tail=(0,0,38),legBL=z(6),legBR=z(6))
action('corgi-nervous',2,[(0,nervous),(.18,{**nervous,'head':(0,35,-2)}),(.3,{**nervous,'head':(0,35,-2)}),(.45,nervous),(.6,{**nervous,'head':(0,-30,0)}),(.7,{**nervous,'head':(0,-30,0)}),(.85,{**nervous,'head':(0,0,-10)}),(1,nervous)],dogs)
poses=[]
for i in range(9):
    k=i%8
    pose=p(body=(0,0,wave([6,2,-4,-7,-4,0,4,7],k),0,wave([.02,0,-.02,-.03,-.01,.01,.03,.03],k),0),head=z(wave([-4,-2,2,4,2,0,-2,-4],k)),tail=(0,wave([5,-5,5,-5,5,-5,5,-5],k),-10))
    pose['legFL']=z(wave([45,20,-15,-40,-35,-5,25,45],k)); pose['legFR']=z(wave([35,45,10,-25,-40,-25,10,35],k))
    pose['legBL']=z(wave([-40,-20,15,40,35,10,-20,-35],k)); pose['legBR']=z(wave([-30,-40,-5,30,40,25,-5,-30],k))
    poses.append((i/8,pose))
action('corgi-gallop',.32,poses,dogs)

# Bat chain (E19 §5.6 feel): coil with the pelvis leading, a held anticipation,
# a 1-2 frame strike with a lunge step, overshoot and a slower settle. Contact is
# at 20 % (KeyframeAnimator maps the sim active tick there). Two-handed grip.
bat_guard=p(hip=hip(y=-.03),torso=(0,-6,-4),armR=(0,-20,34),foreArmR=z(72),armL=(0,-35,40),foreArmL=z(70),legL=z(8),shinL=z(-14),legR=z(-6),shinR=z(-12))
def bat(name,keys):
    action(name,1,[(0,bat_guard)]+[(t,{**bat_guard,**pose}) for t,pose in keys]+[(1,bat_guard)])
bat('bat-1',[(.12,p(hip=hip(y=-.05,twist=-22),torso=(0,-48,8),head=(0,30,-4),armR=(-20,-40,62),foreArmR=z(96),armL=(20,-62,56),foreArmL=z(72),legR=z(-12),shinR=z(-32),legL=z(10),shinL=z(-16))),
    (.17,p(hip=hip(y=-.055,twist=-25),torso=(0,-54,9),head=(0,33,-4),armR=(-22,-46,64),foreArmR=z(100),armL=(22,-66,58),foreArmL=z(74),legR=z(-13),shinR=z(-34),legL=z(10),shinL=z(-16))),
    (.2,p(hip=hip(x=.12,y=-.04,twist=16),torso=(0,30,-12),head=(0,-14,8),armR=(10,40,90),foreArmR=z(8),handR=z(-92),armL=(-10,30,86),foreArmL=z(14),legL=z(28),shinL=z(-22),legR=z(-22),shinR=z(-10),footR=z(15))),
    (.3,p(hip=hip(x=.13,y=-.04,twist=28),torso=(0,62,-8),head=(0,-25,6),armR=(20,95,84),foreArmR=z(25),handR=z(-100),armL=(-15,82,70),foreArmL=z(30),legL=z(26),shinL=z(-22),legR=z(-22),shinR=z(-12),footR=z(15))),
    (.55,p(hip=hip(x=.06,y=-.035,twist=12),torso=(0,30,-4),head=(0,-10,2),armR=(10,40,58),foreArmR=z(55),handR=z(-45),armL=(-8,20,52),foreArmL=z(55),legL=z(16),shinL=z(-18)))])
bat('bat-2',[(.1,p(hip=hip(y=-.045,twist=20),torso=(0,56,6),head=(0,-28,-3),armR=(15,88,72),foreArmR=z(62),armL=(-10,70,64),foreArmL=z(60),legL=z(8),shinL=z(-26))),
    (.16,p(hip=hip(y=-.05,twist=23),torso=(0,60,7),head=(0,-30,-3),armR=(16,92,74),foreArmR=z(66),armL=(-10,74,66),foreArmL=z(62),legL=z(8),shinL=z(-28))),
    (.2,p(hip=hip(x=.1,y=-.04,twist=-14),torso=(0,-30,-12),head=(0,14,8),armR=(-10,-45,88),foreArmR=z(10),handR=z(-92),armL=(10,-40,82),foreArmL=z(14),legR=z(24),shinR=z(-20),legL=z(-18),shinL=z(-10))),
    (.32,p(hip=hip(x=.11,y=-.04,twist=-24),torso=(0,-58,-6),head=(0,24,5),armR=(-15,-90,80),foreArmR=z(26),handR=z(-98),armL=(12,-80,72),foreArmL=z(28),legR=z(22),shinR=z(-20),legL=z(-18),shinL=z(-10))),
    (.58,p(hip=hip(x=.05,y=-.035,twist=-10),torso=(0,-24,-4),armR=(-5,-30,50),foreArmR=z(60),handR=z(-40),legR=z(12),shinR=z(-16)))])
bat('bat-3',[(.12,p(hip=hip(y=-.08),torso=(0,-10,22),head=z(-8),armR=(0,-10,162),foreArmR=z(62),armL=(0,10,158),foreArmL=z(62),legL=z(20),shinL=z(-42),legR=z(14),shinR=z(-40))),
    (.18,p(hip=hip(y=-.09),torso=(0,-12,26),head=z(-10),armR=(0,-10,168),foreArmR=z(66),armL=(0,10,164),foreArmL=z(66),legL=z(22),shinL=z(-46),legR=z(15),shinR=z(-44))),
    (.2,p(hip=hip(x=.14,y=-.11),torso=(0,8,-38),head=z(18),armR=(0,10,62),foreArmR=z(5),armL=(0,-10,58),foreArmL=z(8),legL=z(35),shinL=z(-50),legR=z(-25),shinR=z(-20),footR=z(18))),
    (.3,p(hip=hip(x=.15,y=-.125),torso=(0,10,-44),head=z(22),armR=(0,10,36),foreArmR=z(4),armL=(0,-10,34),foreArmL=z(6),legL=z(36),shinL=z(-54),legR=z(-26),shinR=z(-22),footR=z(18))),
    (.44,p(hip=hip(x=.15,y=-.12),torso=(0,8,-42),head=z(16),armR=(0,10,38),foreArmR=z(6),armL=(0,-10,36),foreArmL=z(8),legL=z(35),shinL=z(-52),legR=z(-26),shinR=z(-22))),
    (.7,p(hip=hip(x=.06,y=-.06),torso=(0,0,-14),armR=(0,-10,50),foreArmR=z(50),legL=z(18),shinL=z(-26)))])

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
# Diner infection: clutch the wound, buckle and convulse, then drag the body upright.
# The collapse endpoint and rise start share exactly the same low side silhouette.
infectionLow={**side,'armL':(-15,0,10),'foreArmL':z(25),'armR':(15,0,10),'foreArmR':z(20),'legL':z(20),'shinL':z(-35)}
wound=p(hip=hip(y=-.04,twist=-8),torso=(8,12,23),head=z(-18),armL=(12,-18,65),foreArmL=z(100),armR=(-12,12,38),foreArmR=z(75),legL=z(18),shinL=z(-35))
action('infection-stagger',.6,[(0,p()),(.22,wound),(.5,{**wound,'torso':(-8,-10,32),'head':z(-28),'shinR':z(-35)}),(.78,wound),(1,wound)])
action('infection-collapse',1,[(0,wound),(.22,p(hip=hip(y=-.27,roll=12),torso=z(38),head=z(-28),legL=z(62),shinL=z(-115),legR=z(45),shinR=z(-100),armL=z(65),foreArmL=z(100))),
    (.45,infectionLow),(.57,{**infectionLow,'torso':(18,-12,-28),'head':(12,18,-15),'foreArmL':z(55)}),(.69,infectionLow),(.8,{**infectionLow,'torso':(-12,18,4),'head':(-12,-18,20),'shinL':z(-100)}),(.9,infectionLow),(1,infectionLow)])
infected=p(hip=hip(y=-.045,roll=4),torso=(4,7,-15),head=(0,-8,12),armL=(-12,0,47),foreArmL=z(24),armR=z(12),foreArmR=z(34),shinL=z(-12),shinR=z(-10))
action('infection-rise',1.2,[(0,infectionLow),(.18,{**infectionLow,'head':(0,18,-8),'foreArmL':z(45)}),
    (.4,p(hip=hip(y=-.36,roll=15),torso=(12,10,-42),head=z(30),armL=z(48),foreArmL=z(65),legL=z(65),shinL=z(-115),legR=z(45),shinR=z(-95))),
    (.7,p(hip=hip(y=-.18,roll=-8),torso=(8,-12,-32),head=(8,-18,22),legL=z(32),shinL=z(-65),legR=z(20),shinR=z(-48),armL=z(60),foreArmR=z(48))),(.9,infected),(1,infected)])
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
