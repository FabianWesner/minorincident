"""Authored rescue/collapse set. Complete solid primitives at every distance;
LOD choices remove fittings and reduce radial sides, never collapse panels.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from . import palette, primitives as P, sockets, colliders, export, ao

class Scene:
    def __init__(self, asset, lod):
        self.asset, self.lod = asset, lod
        self.root = sockets.empty('root')
        self.root['asset_id'] = asset
        self.protected = {'body'}
        self.body = sockets.empty('body', parent=self.root)
    def box(self, name, pos, size, token='sidewalk', parent=None, angle=0):
        obj = P.rounded_box(name, size, palette.mat(token), pos, .025 if self.lod == 0 else 0)
        if self.lod == 0: obj.modifiers['bevel'].segments = 1
        else: obj.modifiers.remove(obj.modifiers['bevel'])
        obj.parent = parent or self.body
        obj.rotation_euler.z = angle
        return obj
    def tube(self, name, pos, radius, depth, token='uiDark', rotation=(0,0,0), parent=None):
        obj = P.cylinder(name, radius, depth, palette.mat(token), pos, [10,8,6][self.lod])
        obj.parent = parent or self.body
        obj.rotation_euler = rotation
        return obj
    def beam(self, name, start, end, width=.04, token='sidewalk'):
        a,b = Vector(start),Vector(end)
        obj = self.box(name, (a+b)/2, (width,width,(b-a).length), token)
        obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
        return obj
    def mesh(self,name,vs,fs,token):
        data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.materials.append(palette.mat(token))
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.parent=self.body
        return obj
    def joint(self,name,pos=(0,0,0)):
        self.protected.add(name)
        return sockets.empty(name,pos,self.root)
    def light(self,name,pos,mesh,red=False,rotate=False):
        obj=sockets.empty('light:'+name,pos,self.root)
        obj['ss_light']=json.dumps(dict(type='beacon' if rotate else 'spot',color='light_siren_red' if red else 'light_led_white',intensity=4,range=12,angle=55,penumbra=.4,pool=True,beam='soft',flare=True,reflect=True,shadow='hero',heroPriority=2,flicker='none',animation={'rotate':150} if rotate else None,powerGroup='self',breakable=True,emissiveNodes=[mesh.name],tiers='all'))
    def lamp(self,name,pos,red=False,rotate=False):
        obj=self.box(name,pos,(.26,.18,.18),'sirenRed' if red else 'windowGlow')
        obj.data.materials.clear();obj.data.materials.append(palette.mat('sirenRed' if red else 'windowGlow',True))
        self.light(name,pos,obj,red,rotate)
        # Keep emissive mesh references stable through material batching.
        obj.parent=self.joint(name+'Mount');self.protected.add(name+'Mount')
    def physics(self,kind='fixed',mass=0,wood=False):
        self.root['ss_physics']=json.dumps({'class':kind,'mass':mass,'friction':.75,'restitution':.05,'centerOfMass':[0,.3,0],'pushable':kind in ('light','medium'),'kickable':kind=='light','flammable':wood,'sounds':'prop.metal-heavy' if not wood else 'prop.wood-medium'})
    def table(self,x,y,z= .85,length=2):
        self.box('tabletop',(x,y,z),(length,.8,.12),'woodWarm')
        for dx in (-length/2+.15,length/2-.15):
            for dy in (-.28,.28):self.box('tableLeg',(x+dx,y+dy,z/2),(.08,.08,z),'uiDark')
    def axe(self,x,y,z,parent=None):
        self.box('axeHandle',(x,y,z),(.045,.045,.95),'woodWarm',parent)
        self.box('axeHead',(x+.08,y,z+.36),(.30,.075,.16),'survivorRed',parent)
        if self.lod==0:self.box('axeEdge',(x+.21,y,z+.36),(.05,.08,.18),'picketWhite',parent)


def recipe(s):
    a,L=s.asset,s.lod
    if a=='int.fire-station-bay':
        # Open +X truck aperture, open near wall for cutaway view; clear 8.5 x 4.2 parking aisle.
        s.box('floor',(0,0,.08),(12,10,.16),'sidewalk')
        s.box('rearWall',(-5.9,0,2.15),(.2,10,4.3),'picketWhite')
        s.box('backWall',(0,4.9,2.15),(12,.2,4.3),'picketWhite')
        for y in (-4,4):s.box('bayJamb',(5.85,y,2.15),(.3,2,4.3),'survivorRed')
        s.box('bayLintel',(5.85,0,4.05),(.3,6,.5),'survivorRed')
        for y in (-2.2,2.2):s.box('parkingStripe',(0,y,.164),(9,.08,.008),'schoolBusYellow')
        for x in (-4.8,-3.9,-3,-2.1,-1.2,.0):
            s.box('locker',(x,4.45,1.15),(.75,.7,2.1),'survivorRed')
            if L<2:
                s.box('lockerHandle',(x+.23,4.08,1.1),(.045,.04,.18),'picketWhite')
                for z in (1.65,1.75,1.85):s.box('lockerVent',(x,4.085,z),(.38,.016,.025),'uiDark')
        s.table(-4.5,-3.4,length=2)
        s.box('radio',(-4.5,-3.3,1.08),(.6,.38,.35),'uiDark')
        s.box('radioDial',(-4.5,-3.50,1.12),(.43,.022,.16),'backpackTeal')
        if L<2:s.beam('radioAntenna',(-4.25,-3.3,1.25),(-4.25,-3.3,1.8),.025)
        for x in (-2.7,-1.4):
            s.box('kitchenBase',(x,-4.35,.5),(1.2,.9,1),'woodWarm')
            s.box('worktop',(x,-4.35,1.04),(1.25,.95,.1),'picketWhite')
        s.box('sink',(-2.7,-4.35,1.10),(.65,.45,.018),'uiDark')
        s.box('fridge',(-.15,-4.3,1.03),(.85,.9,2.06),'picketWhite')
        for x in (1.3,3.4):s.table(x,3.2,.5,1.8)
        for y in (-3.2,3.2):s.lamp('alarm'+str(y),(5.55,y,3.5),True,True)
        s.physics()
        for name,pos,size in [('rear',(-5.9,0,2.15),(.2,10,4.3)),('back',(0,4.9,2.15),(12,.2,4.3)),('floor',(0,0,.08),(12,10,.16))]:colliders.cuboid(name,size,pos,s.root)
        sockets.empty('truckParking',(0,0,.17),s.root)
        sockets.empty('radioSocket',(-4.5,-3.4,1.25),s.root)
    elif a=='prop.axe-rack':
        s.box('rack',(0,0,.75),(.75,.18,1.5),'uiDark')
        for x in (-.22,.22):s.axe(x,-.16,.7)
        if L==0:
            for z in (.3,1.1):s.box('rackBracket',(0,-.13,z),(.7,.12,.06),'sidewalk')
        s.physics()
    elif a=='wpn.halligan':
        s.box('shaft',(0,0,.48),(.055,.055,.88),'sidewalk')
        s.box('adze',(.09,0,.91),(.24,.12,.045),'uiDark')
        s.beam('pick',(.01,0,.90),(-.17,0,.84),.045,'sidewalk')
        for y in (-.036,.036):s.box('fork',(0,y,.08),(.07,.025,.16),'uiDark')
        sockets.empty('grip',(0,0,.45),s.root);sockets.empty('tip',(.2,0,.91),s.root)
    elif a=='prop.checkpoint-gate':
        s.box('base',(-2,0,.08),(.8,.8,.16),'sidewalk')
        s.box('motor',(-2,0,.65),(.5,.5,1.14),'schoolBusYellow')
        gate=s.joint('gateArm',(-2,0,1.13))
        s.box('boom',(2.2,0,0),(4.6,.16,.20),'picketWhite',gate)
        for x in (0.3,1.2,2.1,3,3.9):s.box('warningStripe',(x,-.087,0),(.35,.02,.205),'survivorRed',gate)
        s.lamp('gateBeacon',(-2,0,1.38),True,True)
        s.physics();colliders.cuboid('motor',(.8,.8,1.4),(-2,0,.7),s.root)
        col=colliders.cuboid('boom',(4.6,.16,.2),(2.2,0,0),gate)
        col['shape']='cuboid'
    elif a=='prop.jersey-barrier':
        # Closed extruded concrete profile with the characteristic broad foot and sloped shoulder.
        profile=[(-.36,0),(.36,0),(.36,.15),(.15,.52),(.12,.95),(-.12,.95),(-.15,.52),(-.36,.15)]
        vs=[(x,y,z) for x in (-1.5,1.5) for y,z in profile]
        fs=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
        s.mesh('concrete',vs,fs,'sidewalk')
        if L<2:
            for x in (-1.1,0,1.1):s.box('reflector',(x,-.137,.75),(.25,.018,.09),'schoolBusYellow')
        s.physics('heavy',650);colliders.cuboid('body',(3,.72,.95),(0,0,.475),s.root)
    elif a=='prop.crowd-fence':
        for x in (-1.1,1.1):
            s.box('post',(x,0,.56),(.05,.05,1.12));s.box('foot',(x,0,.035),(.18,.65,.07))
        for z in (.2,1.1):s.box('rail',(0,0,z),(2.3,.05,.05))
        for x in ([-.85,-.57,-.28,0,.28,.57,.85] if L<2 else [-.7,0,.7]):s.box('vertical',(x,0,.65),(.025,.035,.9))
        s.physics('medium',22);colliders.cuboid('body',(2.3,.65,1.12),(0,0,.56),s.root)
    elif a=='prop.armory-table':
        s.table(0,0,length=2)
        s.box('mat',(0,0,.925),(1.7,.65,.025),'policeBlue')
        s.box('pistolSlide',(.32,0,.995),(.27,.08,.095),'uiDark')
        s.box('pistolGrip',(.22,0,.965),(.085,.10,.12),'uiDark',angle=.3)
        if L<2:
            s.box('case',(-.5,0,1.01),(.5,.4,.14),'khaki');s.box('magazine',(.65,.1,.98),(.12,.08,.1),'sidewalk')
        sockets.empty('pickupSocket',(.32,0,1.1),s.root)
        s.physics('heavy',85,True);colliders.cuboid('body',(2,.8,.98),(0,0,.49),s.root)
    elif a=='veh.evac-bus':
        s.box('coach',(0,0,1.27),(9.2,2.5,1.6),'picketWhite')
        s.box('roof',(0,0,2.94),(9,2.45,.23),'picketWhite')
        s.box('rearCabin',(-4.52,0,2.45),(.16,2.45,.9),'picketWhite')
        s.box('rearWindow',(-4.615,0,2.45),(.023,1.8,.55),'backpackTeal')
        for y in (-1.18,1.18):
            s.box('windowRail',(0,y,2.78),(9.0,.12,.12),'picketWhite')
            for x in (-4.4,-2.85,-1.55,-.25,1.05,2.35,4.3):s.box('windowPillar',(x,y,2.43),(.13,.16,.9),'picketWhite')
        if L<2:
            for x in (-4.6,4.6):s.box('bumper',(x,0,.65),(.12,2.45,.15),'uiDark')
            for y in (-1.4,1.4):s.box('mirror',(4.05,y,2.2),(.28,.16,.25),'uiDark')
        s.box('chassis',(0,0,.5),(8.8,2.3,.35),'uiDark')
        for y in (-1.255,1.255):
            s.box('blueStripe',(0,y,1.25),(9,.025,.35),'policeBlue')
            for x in (-3.5,-2.2,-.9,.4,1.7,3):
                # Dark recessed windows backed by seated adult silhouettes.
                s.box('window',(x,y,2.35),(1.1,.026,.83),'backpackTeal')
                s.box('passengerTorso',(x,y*1.018,2.13),(.25,.033,.3),'uiDark')
                s.tube('passengerHead',(x,y*1.023,2.43),.10,.035,'uiDark',(math.pi/2,0,0))
        s.box('windshield',(4.62,0,2.3),(.025,2.2,1),'backpackTeal')
        s.box('evacPlacard',(4.646,0,2.45),(.025,.95,.36),'schoolBusYellow')
        text=bpy.data.curves.new('EVAC','FONT');text.body='EVAC';text.size=.22;text.align_x='CENTER';text.extrude=0
        obj=bpy.data.objects.new('EVAC',text);bpy.context.collection.objects.link(obj);obj.location=(4.665,0,2.38);obj.rotation_euler=(math.pi/2,0,math.pi/2);obj.parent=s.body;text.materials.append(palette.mat('uiDark'))
        bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
        for name,x,y in [('wheelFL',3,-1.22),('wheelFR',3,1.22),('wheelRL',-2.8,-1.22),('wheelRR',-2.8,1.22)]:
            joint=s.joint(name,(x,y,.52));s.tube('tyre',(0,0,0),.52,.24,'uiDark',(math.pi/2,0,0),joint)
            if L<2:s.tube('hub',(0,-.13 if y<0 else .13,0),.23,.025,'sidewalk',(math.pi/2,0,0),joint)
        for name,x,token in [('lightsFront',4.67,'windowGlow'),('lightsBrake',-4.62,'sirenRed')]:
            node=s.joint(name)
            lamp=s.box('lamp',(x,0,.98),(.05,1.7,.14),token,node)
            lamp.data.materials.clear();lamp.data.materials.append(palette.mat(token,True))
            anchor=sockets.empty('light:'+name,(x,0,.98),s.root)
            anchor.rotation_euler.y=-math.pi/2 if x>0 else math.pi/2
            anchor['ss_light']=json.dumps(dict(type='spot' if x>0 else 'point',color='light_led_white' if x>0 else 'light_siren_red',intensity=3 if x>0 else .7,range=18 if x>0 else 2,angle=48,penumbra=.35,pool=True,beam='soft' if x>0 else 'none',flare=True,reflect=True,shadow='hero' if x>0 else 'none',heroPriority=1,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=[lamp.name],tiers='all'))
            if x>0:anchor.rotation_euler.y=-math.pi/2+.12
        door=s.joint('doorR',(3.6,1.3,.65));s.box('doorPanel',(0,0,.95),(.9,.08,1.9),'backpackTeal',door)
        for name,pos in [('driverSeat',(3.5,0,1.1)),('exitL',(3.3,-1.8,.2)),('exitR',(3.3,1.8,.2))]:sockets.empty(name,pos,s.root)
        for i in range(12):sockets.empty('seat_'+str(i+1),(-3.4+(i//2)*1.2,(-1 if i%2 else 1)*.7,1.1),s.root)
        s.physics('heavy',9000);colliders.cuboid('body',(9.2,2.5,3.05),(0,0,1.525),s.root)
    elif a=='kit.army-checkpoint':
        # Traversable center lane; separate collision pieces, no footprint box.
        for y in (-4.2,4.2):
            for x in (-4,-1,2):
                s.box('Twall',(x,y,1.1),(2.8,.4,2.2),'sidewalk')
                s.box('Tfoot',(x,y,.12),(2.8,1.2,.24),'sidewalk')
                colliders.cuboid('wall'+str(x)+str(y),(2.8,.4,2.2),(x,y,1.1),s.root)
            if L<2:
                # Low-sided authored loops and crossed barbs preserve closed rails.
                for i in range(16):
                    x=-5.1+i*.48
                    points=[(x+.21*math.cos(k*math.tau/8),y+.30*math.cos(k*math.tau/8),2.55+.30*math.sin(k*math.tau/8)) for k in range(9)]
                    for k in range(8):s.beam('razorCoil',points[k],points[k+1],.018,'uiDark')
                    if L==0:s.beam('barb',(x-.07,y,2.80),(x+.07,y,2.92),.025)
            else:s.box('razorRail',(-1.5,y,2.5),(8,.05,.12),'uiDark')
        for y in (-2.8,2.8):
            for layer in range(3):
                for i in range(4):s.box('sandbag',(-4.5+i*.52,y,.19+layer*.26),(.58,.5,.3),'khaki')
            colliders.cuboid('nest'+str(y),(2.2,.5,.97),(-3.7,y,.485),s.root)
        for x in (3.1,5.5):
            for y in (2.3,4.7):
                s.box('towerLeg',(x,y,2.3),(.14,.14,4.6),'woodWarm')
                colliders.cuboid('leg'+str(x)+str(y),(.14,.14,4.6),(x,y,2.3),s.root)
        s.box('towerDeck',(4.3,3.5,4.15),(2.8,2.8,.22),'woodWarm')
        colliders.cuboid('towerDeck',(2.8,2.8,.22),(4.3,3.5,4.15),s.root)
        s.box('towerRoof',(4.3,3.5,5.8),(3,3,.18),'khaki')
        for y in (2.2,4.8):s.box('towerRailing',(4.3,y,4.7),(2.8,.1,.75),'khaki')
        for z in ([i*.34+.3 for i in range(13)] if L<2 else [1,2,3]):s.box('ladderRung',(3,2.1,z),(.7,.09,.06),'woodWarm')
        for x in (2.65,3.35):s.box('ladderRail',(x,2.1,2.1),(.06,.08,4.2),'woodWarm')
        for y in (-3,3):
            s.box('lightPole',(0,y,2.6),(.13,.13,5.2),'uiDark');s.lamp('flood'+str(y),(0,y,5.2))
        s.box('speakerPole',(-5.5,3,2),(.12,.12,4),'uiDark')
        s.box('loudspeaker',(-5.5,3,4),(.55,.4,.4),'picketWhite')
        s.box('speakerMouth',(-5.20,3,4),(.045,.33,.33),'uiDark')
        s.physics()
    elif a=='decay.looted-store':
        for y in (-.65,.65):
            for x in (-.95,.95):s.box('shelfPost',(x,y,1),(.055,.08,2),'uiDark')
            for z in (.2,.9,1.6):s.box('emptyShelf',(0,y,z),(2,.48,.07),'picketWhite')
        for i in range(3 if L==2 else 8):
            s.box('merchandise',(-.9+i*.24,-.1+math.sin(i)*.35,.065),(.18,.14,.13),['schoolBusYellow','survivorRed','backpackTeal'][i%3],angle=i*.8)
        s.physics('heavy',100)
    elif a=='decay.damaged-sign':
        s.box('signPost',(-.35,0,1),(.09,.09,2),'uiDark',angle=.13)
        sign=s.box('brokenSign',(.05,0,1.7),(1.4,.10,.65),'schoolBusYellow',angle=-.15)
        s.box('fallenFragment',(.6,-.35,.05),(.55,.32,.06),'schoolBusYellow',angle=.5)
        if L<2:
            for x in (-.3,.15,.45):s.box('scar',(x,-.061,1.7),(.09,.018,.5),'uiDark',angle=-.2)
        s.physics()
    elif a=='decay.makeshift-barricade':
        s.box('sofa',(0,0,.4),(2,.8,.75),'backpackTeal')
        s.box('sofaBack',(0,.35,.9),(2,.16,.7),'backpackTeal')
        for x in (-.85,.85):s.box('sofaArm',(x,0,.8),(.3,.8,.22),'backpackTeal')
        for x in (-1.3,1.3):s.box('crate',(x,.15,.36),(.6,.7,.72),'woodWarm',angle=x*.1)
        s.box('crossBoard',(0,-.5,.55),(3,.13,.18),'woodWarm',angle=.1)
        s.box('chairSeat',(.2,.65,1.0),(.6,.5,.09),'woodWarm',angle=.3)
        for x in (-.1,.5):s.box('chairLeg',(x,.65,1.25),(.06,.08,.5),'woodWarm')
        s.physics('heavy',180,True);colliders.cuboid('body',(3.2,1.35,1.3),(0,.1,.65),s.root)
    elif a=='decay.broken-glass':
        for i in range(15):
            x=math.sin(i*2.3)*.8;y=math.cos(i*1.7)*.6;r=.15+(i%3)*.04
            base=.018+i*.004
            vs=[(x-r,y-r,base),(x+r,y-r/2,base),(x-r/3,y+r,base),(x-r,y-r,base+.02),(x+r,y-r/2,base+.02),(x-r/3,y+r,base+.02)]
            s.mesh('glassShard',vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'backpackTeal')
    elif a=='decay.boarded-windows':
        for x in (-.65,.65):s.box('frameSide',(x,0,.8),(.1,.12,1.6),'picketWhite')
        for z in (.05,1.55):s.box('frameRail',(0,0,z),(1.4,.12,.1),'picketWhite')
        for i,z in enumerate((.3,.65,1,1.35)):
            s.box('board',(0,-.095,z),(1.55,.075,.24),'woodWarm',angle=0)
            if L==0:
                for x in (-.55,.55):s.box('nail',(x,-.14,z),(.025,.02,.025),'uiDark')
        s.physics()
    elif a=='decay.dropped-belongings':
        s.box('suitcase',(-.4,0,.16),(.65,.45,.30),'survivorRed',angle=.2)
        s.box('handle',(-.4,.26,.20),(.25,.07,.08),'uiDark')
        s.box('backpack',(.35,.18,.23),(.42,.30,.46),'backpackTeal',angle=-.4)
        s.box('blanket',(.25,-.4,.035),(.7,.4,.05),'khaki',angle=.2)
        s.box('bottle',(.68,-.2,.07),(.14,.28,.13),'schoolBusYellow',angle=.8)
        if L<2:
            s.box('backpackPocket',(.35,-.01,.18),(.27,.07,.21),'policeBlue')
            for x in (-.6,-.2):s.box('caseStrap',(x,0,.17),(.025,.46,.30),'uiDark')
        s.physics('light',8,True)
    else:raise ValueError(a)
    return s


def finish(s, path):
    # Anchors retain exact named emissive child after batching.
    for obj in s.root.children_recursive:
        if 'ss_light' in obj:
            value=json.loads(obj['ss_light']);name=value['emissiveNodes'][0]
            lamp=bpy.data.objects[name];value['emissiveNodes']=[lamp.parent.name+'_'+lamp.data.materials[0].name];obj['ss_light']=json.dumps(value)
    export.merge_by_material(s.root,s.protected)
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in s.root.children_recursive if o.type=='MESH' for v in o.data.vertices]
    low=[min(p[k] for p in points) for k in range(3)];high=[max(p[k] for p in points) for k in range(3)]
    sockets.empty('front',(high[0],0,0),s.root)
    if 'ss_physics' in s.root:
        physics=json.loads(s.root['ss_physics'])
        physics['centerOfMass']=[(low[0]+high[0])/2,(low[2]+high[2])/2,-(low[1]+high[1])/2]
        s.root['ss_physics']=json.dumps(physics)
        if not any('collider' in o for o in s.root.children_recursive):
            colliders.cuboid('body',tuple(high[k]-low[k] for k in range(3)),tuple((high[k]+low[k])/2 for k in range(3)),s.root)
    ao.bake_all(s.root.children_recursive,16)
    # Interior AO is a contact cue; bounded contrast keeps the golden-hour palette readable.
    if s.asset=='int.fire-station-bay':
        for obj in s.root.children_recursive:
            if obj.type=='MESH':
                for value in obj.data.color_attributes['ao'].data:
                    value.color=tuple(.55+.45*c for c in value.color[:3])+(1,)
    export.glb(s.root,path)
    tris=0
    for o in s.root.children_recursive:
        if o.type=='MESH':o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    return {'triangles':tris,'dimensions':{'x':high[0]-low[0],'y':high[2]-low[2],'z':high[1]-low[1],'tolerance':.1}}


def build_set(asset, directory):
    directory=Path(directory);stats={}
    for lod in (0,1,2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        stats['lod'+str(lod)]=finish(recipe(Scene(asset,lod)),directory/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb'))
    (directory/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    return stats
