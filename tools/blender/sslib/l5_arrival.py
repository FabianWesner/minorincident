"""Lakeshore arrival interior and mountable lamp; explicit closed-solid LOD recipes."""
import json
import math
from . import sockets, colliders, palette
from .l6_metro import anchor, port, fixture, structure, wall_with_openings


def station(s):
    stone, dark, teal, yellow = 'sidewalk', 'uiDark', 'backpackTeal', 'schoolBusYellow'
    roof = s.joint('roof'); roof['cutaway'] = True
    anchor(s, 'interior', (0, 0, .6), cutaway=True)
    # Adjacent hall and full-length platform, with a wide open connection.
    structure(s, 'concourseFloor', (0, 0, .3), (30, 20, .6), stone)
    structure(s, 'platformFloor', (0, -15, .3), (60, 10, .6), stone)
    structure(s, 'trackBed', (0, -23, .09), (60, 6, .18), dark)
    s.box('tactileEdge', (0, -19.65, .64), (60, .55, .08), yellow)
    s.box('platformFascia', (0, -20, .35), (60, .14, .48), teal)
    for y in (-22.2, -23.8):
        s.box('railFoot', (0, y, .23), (60, .22, .10), stone)
        s.box('railWeb', (0, y, .32), (60, .07, .12), stone)
        s.box('railCrown', (0, y, .41), (60, .14, .06), stone)
    for i in range((64, 40, 24)[s.lod]):
        x=-29.5+i*59/((64,40,24)[s.lod]-1)
        s.box('sleeper', (x, -23, .17), (.26, 3.2, .12), teal, bevel=0)
    # Far wall has two actual openings. Near side and end walls are cut away.
    wall_with_openings(s, 9.85, [(-11.2,-8.8),(8.8,11.2)], 30, 4.6, stone)
    for a,b in [(-15,-11.2),(-8.8,8.8),(11.2,15)]:
        s.box('tileBand', ((a+b)/2, 9.66, 1.35), (b-a, .11, .45), teal)
    for x in (-14.8,14.8):
        structure(s, 'hallReturn', (x, 5.5, 2.5), (.4, 8.6, 3.8), stone)
        s.box('returnBand',(x,5.5,1.35),(.43,8.6,.45),teal)
    # Distinct door leaves keep local hinge-space geometry and state colliders.
    for name,x in [('maintenanceDoorA',-10),('maintenanceDoorB',10)]:
        door=s.joint(name,(x-1.1,9.67,.6))
        door['ss_door']=json.dumps(dict(kind='swing',axis='Y',closedAngle=0,openAngle=100,initialState='closed',clearWidth=2.2))
        s.box(name+'Leaf',(1.1,0,1.3),(2.2,.14,2.6),dark,parent=door)
        s.box(name+'Brace',(1.1,-.09,1.4),(1.95,.06,.12),dark,parent=door)
        col=colliders.cuboid(name,(2.2,.14,2.6),(1.1,0,1.3),door);col['enabledWhen']='closed'
        port(s,name+'Socket',(x,10,.6),2.2,asset='prop.service-gate',route='maintenance')
        anchor(s,name+'BraceSocket',(x,9.2,1.4))
        text=s.text('SERVICE',(x,9.53,3.7),.34,yellow,d=1)
        # Rotate the helper's +X text plane toward the open hall (-Y).
        if text is not None:text.rotation_euler=(math.pi/2,0,0)
    # Structural columns, broad capitals and removable overhead beams.
    for x in (-24,-12,0,12,24):
        for y in (-17,-11):
            structure(s,'platformColumn',(x,y,2.8),(.7,.7,4.4),stone)
            s.box('columnBoot',(x,y,.9),(.82,.82,.6),teal)
            s.box('columnCapital',(x,y,4.9),(1.25,1.25,.3),stone)
        s.box('roofCrossbeam',(x,-14,5.13),(.6,8.2,.4),stone,parent=roof)
    s.box('roofSpine',(0,-11,5.35),(60,.6,.35),stone,parent=roof)
    # Ticket barrier: rounded housings and unmistakable three-spoke turnstiles.
    for x in (-5.4,-3.6,-1.8,0,1.8,3.6,5.4):
        s.box('turnstilePlinth',(x,-5,.7),(.95,1.8,.2),dark)
        s.box('turnstileHousing',(x,-5,1.15),(.6,1.5,.85),teal)
        s.box('ticketTop',(x,-5,1.61),(.68,1.62,.10),stone)
        s.box('reader',(x,-5.5,1.68),(.3,.4,.09),dark)
        s.tube('turnstileHub',(x+.40,-5,1.15),.16,.25,stone,rot=(0,math.pi/2,0))
        for a in (0,math.tau/3,2*math.tau/3):
            s.beam('turnstileArm',(x+.45,-5,1.15),(x+.45,-5+.6*math.cos(a),1.15+.6*math.sin(a)),.085,stone)
        s.box('readerArrow',(x,-5.52,1.733),(.15,.20,.015),yellow,d=1)
    # Staff kiosk with dark window, chunky frame and ticket machines.
    structure(s,'kioskBase',(-11,3,1.35),(4,3,1.5),teal)
    s.box('kioskRoof',(-11,3,3.45),(4.5,3.5,.25),teal)
    for dx in (-1.86,1.86):s.box('kioskPillar',(-11+dx,1.65,2.6),(.24,.24,1.8),stone)
    s.box('kioskWindow',(-11,1.63,2.55),(3.5,.12,1.3),dark)
    s.box('kioskCounter',(-11,1.35,1.9),(4.25,.65,.20),stone)
    for x in (-5.8,-3.5):
        s.box('ticketMachine',(x,8.7,1.65),(1.45,1.0,2.1),yellow)
        s.box('machineScreen',(x,8.17,2.1),(.95,.10,.7),dark)
        s.box('ticketSlot',(x,8.14,1.22),(.7,.08,.12),dark)
        s.box('screenInset',(x,8.105,2.1),(.67,.035,.42),teal,d=1)
    for x,y in [(4,5),(9,5),(-20,-13),(20,-13),(7,-13),(-7,-13)]:
        s.box('benchSeat',(x,y,1.05),(3.8,.8,.22),teal)
        s.box('benchBack',(x,y+.38,1.47),(3.8,.16,.65),teal)
        for dx in (-1.4,1.4):
            s.box('benchLeg',(x+dx,y,.78),(.18,.6,.36),dark)
            s.box('benchArm',(x+dx,y,1.30),(.12,.85,.12),dark,d=1)
        if s.lod==0:
            for dx in (-.9,0,.9):s.box('seatSeam',(x+dx,y,1.163),(.024,.76,.012),dark)
    # Sealed street stair: steps remain real solids at each distance tier.
    for i in range((16,12,8)[s.lod]):
        n=(16,12,8)[s.lod];z=.6+3.8*(i+1)/n
        structure(s,'streetStep'+str(i),(6,2+i*6/n,(z+.6)/2),(3.4,6/n,z-.6),stone,bevel=0)
    for x in (4.2,7.8):
        s.beam('stairHandrail',(x,2,1.6),(x,8,5.4),.12,dark)
        for y in (2,5,8):s.box('railPost',(x,y,.6+(y-2)*3.8/6+.5),(.12,.12,1),dark)
    s.box('sealedStreetShutter',(6,8.3,4.95),(3.8,.18,1.6),dark)
    for z in (4.4,4.7,5,5.3,5.6):s.box('shutterRib',(6,8.17,z),(3.7,.10,.065),stone,d=1)
    port(s,'sealedStreetStairSocket',(6,8.5,4.4),3.4,sealed=True)
    port(s,'stairsArrivalSocket',(6,2,.6),3.4,route='L5-arrival')
    port(s,'concoursePlatformSocket',(0,-10,.6),12)
    port(s,'tunnelStartSocket',(-30,-15,.6),8,route='north-tunnel')
    port(s,'tunnelEndSocket',(30,-15,.6),8)
    anchor(s,'shelterCampSocket',(0,1,.6),asset='kit.shelter-camp',reservedArea=[9,7])
    # Wayfinding boards stay bold at 135px; geometric lettering is near-tier detail.
    for x in (-17,17):
        s.box('platformSign',(x,-16,3.7),(.25,5,.95),teal)
        s.text('LAKESHORE',(x+.14,-16,3.85),.40,stone,d=1)
        s.text('FAIRHAVEN METRO',(x+.14,-16,3.45),.22,yellow,d=0)
    for x in (-12,0,12):fixture(s,'mainHall'+str(x),(x,6,4.4),strip=True)
    for x in (-24,-12,0,12,24):fixture(s,'mainPlatform'+str(x),(x,-14,4.5),strip=True)
    # Separate emergency and camp fixture assets are mounted by the level lane.
    for x in (-10,10):anchor(s,'emergencyLamp'+str(x)+'Socket',(x,9.4,3.2),asset='prop.emergency-light',powerGroup='metro-emergency')
    s.physics()


def flashlight(s):
    dark,red,metal='uiDark','survivorRed','sidewalk'
    # Lens faces +X. Ground touch at Z=0; hand socket is on the rear grip.
    for name,x,r,depth,token in [('grip',-.035,.037,.20,dark),('head',.09,.062,.08,metal),('bezel',.133,.065,.024,red),('tail',-.146,.041,.035,red),('neck',.039,.045,.026,red)]:
        s.tube(name,(x,0,.065),r,depth,token,rot=(0,math.pi/2,0),sides=(24,12,8))
    lens=s.tube('lens',(.147,0,.065),.054,.006,dark,rot=(0,math.pi/2,0),sides=(24,12,8))
    lens.data.materials.clear();lens.data.materials.append(palette.mat('picketWhite',True))
    s.box('switch',(-.02,0,.106),(.045,.025,.014),red,d=1)
    for x in (-.09,-.065,-.04,-.015,.01):
        s.tube('gripRing',(x,0,.065),.04,.007,dark,rot=(0,math.pi/2,0),sides=(20,10,6),d=0)
    anchor(s,'handMountSocket',(-.055,0,.065),attachment='weaponSocketR')
    anchor(s,'weaponMountSocket',(-.035,0,.02),clearance=[.32,.13,.13])
    light=anchor(s,'light:flashlight',(.152,0,.065))
    light.rotation_euler=(0,-math.pi/2,0)
    light['ss_light']=json.dumps(dict(type='spot',color='light_led_white',intensity=4,range=18,angle=35,pool=True,beam='strong',reflect=True,shadow='hero',heroPriority=3,flicker='none',animation=None,powerGroup='self',breakable=False,emissiveNodes=['body_emi_picketWhite']))
    colliders.cuboid('body',(.31,.13,.13),(-.005,0,.065),s.root)
    s.physics('light',.35,sound='prop.metal-light')
