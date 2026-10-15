"""L6 local metro modules. Explicit solids at each tier; never decimation.

Uses the reviewed Fairhaven authoring/batching/AO/export conventions. Geometry
is Blender Z up, +X forward. Connection coordinates become glTF (x,z,-y).
"""
import json
import math
from mathutils import Matrix
from . import sockets, colliders, palette

STONE = 'khakiLight'
DARK = 'uiDark'
TEAL = 'backpackTeal'
METAL = 'sidewalk'
YELLOW = 'schoolBusYellow'


def anchor(s, name, pos, **metadata):
    obj = sockets.empty(name, pos, s.root)
    for key, value in metadata.items():
        obj[key] = json.dumps(value) if isinstance(value, (dict, list)) else value
    return obj


def fixture(s, name, pos, emergency=False, camp=False, strip=False):
    """Separate mounts/metadata; all lamps of a circuit share a stable batch."""
    token = 'windowGlow' if camp else 'sirenRed' if emergency else 'picketWhite'
    size = (1.7, .16, .08) if strip else (.16, .16, .28)
    s.box(name+'Housing', pos, tuple(v+.10 for v in size), DARK)
    mesh = s.box(name+'Lens', (pos[0], pos[1]-.065, pos[2]-.025), size, DARK, bevel=0)
    mesh.data = mesh.data.copy()
    mesh.data.materials.clear()
    mesh.data.materials.append(palette.mat(token, True))
    anchor(s, name+'Mount', pos, fixtureKind='camp' if camp else 'emergency' if emergency else 'strip')
    light = anchor(s, 'light:'+name, pos)
    light['ss_light'] = json.dumps(dict(type='point' if camp or emergency else 'spot',
        color='light_window_warm' if camp else 'light_siren_red' if emergency else 'light_fluorescent',
        intensity=2.8 if camp else 3.5, range=6 if camp else 10, angle=100, penumbra=.45,
        pool=True, beam='none' if camp or emergency else 'soft', flare=False, reflect=True,
        shadow='none', heroPriority=1, flicker='none' if camp or emergency else 'fluorescent',
        animation=None, powerGroup='shelter-camp' if camp else 'metro-emergency' if emergency else 'metro-main',
        breakable=True, emissiveNodes=['body_emi_'+token], tiers='all'))
    # Local -Z points down. No Blender lights exported.
    return light


def structure(s, name, pos, size, token=STONE, **kwargs):
    obj = s.box(name, pos, size, token, **kwargs)
    colliders.cuboid(name, size, pos, s.root)
    return obj


def port(s, name, pos, width=2.2, height=2.6, **kwargs):
    return anchor(s, name, pos, clearWidth=width, clearHeight=height, **kwargs)


def wall_with_openings(s, y, intervals, length, height, token=STONE):
    cursor = -length/2
    for n, (a, b) in enumerate(intervals):
        if a > cursor:
            structure(s, 'wallPier'+str(y)+str(n), ((cursor+a)/2,y,height/2+.2), (a-cursor,.3,height), token)
        structure(s, 'portalLintel'+str(y)+str(n), ((a+b)/2,y,(height+2.8)/2+.2), (b-a,.3,height-2.8), token)
        for x in (a-.075,b+.075):
            s.box('portalBorder',(x,y-.17,1.6),(.15,.12,2.8),DARK)
        s.box('portalHeader',((a+b)/2,y-.17,2.98),(b-a,.12,.16),DARK)
        cursor=b
    if cursor < length/2:
        structure(s, 'wallEnd'+str(y), ((cursor+length/2)/2,y,height/2+.2), (length/2-cursor,.3,height), token)


def arch(s, x, owner=None):
    # Closed octagonal ring sections; no thin/perforated panels at any tier.
    inner=[(-3.45,.2),(-3.45,2.9),(-2.5,4.1),(-1.25,4.65),(1.25,4.65),(2.5,4.1),(3.45,2.9),(3.45,.2)]
    outer=[(-3.8,.2),(-3.8,3.05),(-2.7,4.4),(-1.3,5.0),(1.3,5.0),(2.7,4.4),(3.8,3.05),(3.8,.2)]
    for i in range(len(inner)-1):
        s.extrude('archVoussoir', [inner[i],inner[i+1],outer[i+1],outer[i]], 'x', x-.16,x+.16,STONE,parent=owner)
    if s.lod==0:
        for y in (-3.62,3.62):s.box('archFoot',(x,y,.4),(.32,.36,.4),METAL)


def tunnel(s):
    """12 m through module, 7.6 m outer width, 6.9 m clear bore.

    Three actual far-side doors; two near-side cross passages. Place the module
    repeatedly along E24's route; gate inserts use the independent prop ID.
    """
    roof=s.joint('roof'); roof['cutaway']=True
    anchor(s,'interior',(0,0,.2),cutaway=True)
    structure(s,'trackBed',(0,0,.1),(12,7.6,.2))
    s.box('ballast',(0,0,.225),(12,3.1,.05),DARK)
    for y in (-2.65,2.65):
        structure(s,'walkway'+str(y),(0,y,.36),(12,1.7,.32))
        s.box('safetyEdge',(0,y+( .79 if y<0 else -.79),.53),(12,.12,.04),YELLOW)
    # Paired rails with web, foot and crown retained at every tier.
    for y in (-.72,.72):
        for z,w,h in ((.39,.20,.06),(.48,.07,.16),(.59,.13,.06)):
            s.box('rail',(0,y,z),(12,w,h),METAL,bevel=.01)
    count=(24,20,16)[s.lod]
    for i in range(count):
        x=-5.75+i*11.5/(count-1)
        s.box('sleeper',(x,0,.31),(.24,2.45,.14),'woodWarm',bevel=.025)
        if s.lod<2:
            for y in (-.72,.72):s.box('railClamp',(x,y,.39),(.3,.3,.06),DARK,d=1)
    wall_with_openings(s,3.65,[(-4.9,-2.7),(-1.1,1.1),(2.7,4.9)],12,3.15)
    # Near wall deliberately cut away; actual transverse routes remain open.
    for a,b in [(-6,-4.8),(-2.6,2.6),(4.8,6)]:
        structure(s,'cutawayCurb',((a+b)/2,-3.65,.48),(b-a,.3,.56))
    for x in (-5.84,2,5.84):arch(s,x,roof)
    # Far half shell: the open near half is the permanent gameplay cutaway.
    s.extrude('halfVault',[(1.25,4.65),(2.5,4.1),(3.45,2.9),(3.8,3.05),(2.7,4.4),(1.3,5.0)],'x',-6,6,STONE,parent=roof)
    for z in (3.15,3.35):
        s.tube('utilityConduit',(0,3.0,z),.07,12,DARK,rot=(0,math.pi/2,0))
    for x in (-3.8,0,3.8):
        port(s,'sidePassage'+str(x)+'Socket',(x,3.8,.52),height=2.35,route='maintenance')
        port(s,'gate'+str(x)+'Socket',(x,3.8,.52),height=2.35,asset='prop.service-gate')
        anchor(s,'brace'+str(x)+'Socket',(x,3.8,.52),coverage=[2.2,2.35])
    for x in (-3.7,3.7):port(s,'crossPassage'+str(x)+'Socket',(x,-3.8,.52),route='cross-passage')
    for x in (-6,6):port(s,'tunnel'+('Start' if x<0 else 'End')+'Socket',(x,0,.25),6.9,moduleLength=12)
    for x in (-4,4):fixture(s,'main'+str(x),(x,2.65,3.0),strip=True)
    fixture(s,'emergency',(0,3.0,3.15),emergency=True)
    s.physics()


def track(s):
    """12 m open track module: the tunnel's track (bed, ballast, rails, clamps, sleepers) without walls or roof.

    Same numbers as tunnel() above and placed like its modules (y 0.35, 12 m apart along X, on the tunnel line z), so the
    station platform track and the tunnel track are one kit. The bed reaches down to the ground (module z -0.35) so no gap
    shows under it; its collider top (0.2) is a walkable support like the tunnel's.
    """
    structure(s, 'trackBed', (0, 0, -.075), (12, 7.6, .55))
    s.box('ballast', (0, 0, .225), (12, 3.1, .05), DARK)
    for y in (-.72, .72):
        for z, w, h in ((.39, .20, .06), (.48, .07, .16), (.59, .13, .06)):
            s.box('rail', (0, y, z), (12, w, h), METAL, bevel=.01)
    count = (24, 20, 16)[s.lod]
    for i in range(count):
        x = -5.75 + i * 11.5 / (count - 1)
        s.box('sleeper', (x, 0, .31), (.24, 2.45, .14), 'woodWarm', bevel=.025)
        if s.lod < 2:
            for y in (-.72, .72):
                s.box('railClamp', (x, y, .39), (.3, .3, .07), DARK, d=1)
    for x in (-6, 6):
        port(s, 'track' + ('Start' if x < 0 else 'End') + 'Socket', (x, 0, .25), 6.9, moduleLength=12)
    s.physics()


def corridor(s):
    """10 m service bay. A 2.2 m aisle links two actual room portals."""
    anchor(s,'interior',(0,0,.2),cutaway=True)
    structure(s,'floor',(0,0,.1),(10,4.6,.2))
    wall_with_openings(s,2.15,[(-1.1,1.1),(2.2,4.4)],10,3.7)
    structure(s,'nearCurb',(0,-2.15,.38),(10,.3,.36))
    for x in (-4.85,4.85):
        structure(s,'endPier',(x,1.9,2.05),(.3,.5,3.7))
    # Thick pipe loop with real bends, flange discs and readable valve wheels.
    s.tube('headerPipe',(.15,1.67,3.25),.22,8.5,TEAL,rot=(0,math.pi/2,0),sides=(16,12,8))
    for x in (-4.4,4.7):
        s.tube('pipeRiser',(x,1.67,1.7),.22,2.9,TEAL,sides=(16,12,8))
        # quarter elbow is a closed swept prism, explicitly sampled per tier
        n=(8,6,4)[s.lod]; ring=(12,8,6)[s.lod]
        verts=[]
        sign=1 if x<0 else -1
        for i in range(n+1):
            t=i*math.pi/2/n
            for j in range(ring):
                a=j*math.tau/ring
                verts.append((x+sign*.32*(1-math.cos(t))+sign*.22*math.cos(a)*math.cos(t),1.67+.22*math.sin(a),2.93+.32*math.sin(t)-.22*math.cos(a)*math.sin(t)))
        faces=[tuple(range(ring-1,-1,-1)),tuple(n*ring+j for j in range(ring))]
        faces += [(i*ring+j,i*ring+(j+1)%ring,(i+1)*ring+(j+1)%ring,(i+1)*ring+j) for i in range(n) for j in range(ring)]
        s.solid('pipeElbow',verts,faces,TEAL)
        for z in (.48,2.65):s.tube('pipeFlange',(x,1.67,z),.3,.10,DARK)
        # Wheel is a real closed ring, all tiers retain its aperture and spokes.
        wheel_ring(s,(x,1.38,1.7),.30,'survivorRed')
    for x in (-3.7,-2.3,1.8):
        s.box('pipeBracket',(x,1.82,3.25),(.14,.50,.60),DARK)
    # Pump assembly sits beside, not in, the route opening.
    structure(s,'pumpPlinth',(-3.0,1.3,.32),(1.65,1.25,.24))
    s.tube('pumpMotor',(-2.8,1.20,.89),.38,1.1,TEAL,rot=(0,math.pi/2,0),sides=(18,12,8))
    s.tube('pumpVolute',(-3.55,1.20,.85),.45,.35,TEAL,rot=(0,math.pi/2,0))
    s.tube('motorFan',(-2.22,1.20,.89),.33,.08,DARK,rot=(0,math.pi/2,0))
    for z in (.65,.78,.91,1.04,1.17):s.box('motorFin',(-2.8,1.20,z),(1.0,.76,.035),DARK,d=1)
    s.tube('pumpOutlet',(-3.65,1.2,2.05),.14,2.35,TEAL)
    s.tube('pumpHeaderBranch',(-3.65,1.44,3.15),.14,.5,TEAL,rot=(math.pi/2,0,0))
    s.box('pumpFoot',(-2.9,1.2,.49),(1.3,.8,.12),DARK)
    # Signal cabinets stay distinct from the two open doorways.
    for x,width in [(-1.7,.7),(1.75,.65)]:
        structure(s,'signalCabinet'+str(x),(x,1.68,1.22),(width,.66,2.0),YELLOW)
        s.box('cabinetInset',(x,1.32,1.23),(width-.12,.04,1.77),DARK)
        s.box('cabinetDoor',(x,1.285,1.23),(width-.18,.04,1.70),YELLOW)
        s.box('doorHandle',(x+width*.22,1.25,1.32),(.045,.06,.22),DARK)
        for z in (.55,.64,.73):s.box('cabinetVent',(x,1.248,z),(width*.6,.012,.035),DARK,d=1)
        s.box('signalDisplay',(x,1.247,1.77),(.28,.018,.18),TEAL)
        for dx in (-.15,0,.15):s.tube('signalDial',(x+dx,1.23,1.5),.043,.03,'survivorRed',rot=(math.pi/2,0,0),d=1)
    for name,x in [('pumpRoom',0),('signalRoom',3.3)]:
        port(s,name+'Socket',(x,2.3,.2),room=name)
        port(s,name+'GateSocket',(x,2.3,.2),asset='prop.service-gate')
        anchor(s,name+'BraceSocket',(x,2.3,.2),coverage=[2.2,2.6])
    for x in (-5,5):port(s,('start' if x<0 else 'end')+'Socket',(x,-.65,.2),2.2,moduleLength=10)
    for x in (-3,3):fixture(s,'main'+str(x),(x,.9,3.25),strip=True)
    fixture(s,'emergency',(0,1.97,3.2),emergency=True)
    for x in (-3,3):anchor(s,'roomEquipment'+str(x)+'Socket',(x,1.1,.2))
    s.physics()


def wheel_ring(s, pos, radius, token):
    n=(16,12,8)[s.lod]; verts=[]
    for y in (-.035,.035):
        for r in (radius,radius-.07):
            verts.extend((pos[0]+r*math.cos(i*math.tau/n),pos[1]+y,pos[2]+r*math.sin(i*math.tau/n)) for i in range(n))
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    s.solid('valveWheel',verts,faces,token)
    s.beam('valveSpoke',(pos[0]-radius,pos[1],pos[2]),(pos[0]+radius,pos[1],pos[2]),.05,token)
    s.beam('valveSpoke',(pos[0],pos[1],pos[2]-radius),(pos[0],pos[1],pos[2]+radius),.05,token)


def exit_station(s):
    anchor(s,'interior',(0,0,.2),cutaway=True)
    structure(s,'platform',(0,0,.1),(12,7.6,.2))
    # Platform edge is obvious independently of the rising routes.
    s.box('tactilePlatformEdge',(-4.4,-3.4,.24),(3.2,.45,.08),YELLOW)
    for x in (-5.6,-5.2,-4.8,-4.4,-4,-3.6,-3.2):
        s.box('tactileRidge',(x,-3.4,.289),(.07,.40,.016),DARK,d=0)
    # Raised street landing and stone cheek walls around two climbable routes.
    structure(s,'streetLanding',(4.7,0,1.85),(2.6,5.6,3.3))
    profile=[(-2.6,.2),(3.4,.2),(3.4,4.0),(-2.6,1.0)]
    for y in (-2.7,2.7):
        s.extrude('stairCheek',profile,'y',y-.17,y+.17,STONE)
        s.extrude('tileBand',[(-2.6,.55),(3.4,.55),(3.4,3.5),(-2.6,.55+.42)],'y',y-.18,y+.18,TEAL)
        s.beam('cheekCoping',(-2.6,y,1.02),(3.4,y,4.02),.22,STONE)
    # Two different stairs: broad stone flight and dead escalator with skirt,
    # dark continuous handrails, bulky newel ends, comb plates and ribbed treads.
    run=6; rise=3.3
    n=(24,20,16)[s.lod]
    for y,width,kind in [(-1.4,1.5,'stairs'),(.9,1.35,'escalator')]:
        for i in range(n):
            top=.2+rise*(i+1)/n; x=-2.6+run*(i+.5)/n
            s.box(kind+'Tread',(x,y,(top+.2)/2),(run/n,width,top-.2),METAL,bevel=0)
            colliders.cuboid(kind+'Tread'+str(i),(run/n,width,top-.2),(x,y,(top+.2)/2),s.root)
            if s.lod<2:s.box(kind+'Nose',(x-run/n/2+.035,y,top+.007),(.07,width,.014),DARK,bevel=0)
            if kind=='escalator' and s.lod==0:
                for dy in (-.45,-.25,0,.25,.45):s.box('treadGroove',(x,y+dy,top+.009),(run/n-.025,.022,.018),DARK,bevel=0)
        if kind=='escalator':
            for dy in (-.79,.79):
                s.extrude('escalatorSkirt',[(-2.85,.2),(-2.85,.76),(3.65,4.03),(3.65,.2)],'y',y+dy-.11,y+dy+.11,TEAL)
                s.beam('deadHandrail',(-2.65,y+dy,1.05),(3.6,y+dy,4.28),.13,DARK)
                for x,z in [(-2.65,.67),(3.6,3.90)]:
                    s.tube('newelReturn',(x,y+dy,z),.37,.24,DARK,rot=(math.pi/2,0,0),sides=(20,12,8))
            for x,z in [(-2.85,.23),(3.65,3.53)]:s.box('combPlate',(x,y,z),(.5,1.45,.06),YELLOW)
            anchor(s,'escalator',(0,y,1.85),stationary=True,animation='none')
        else:
            for dy in (-.81,.81):
                s.beam('stairHandrail',(-2.65,y+dy,1.05),(3.45,y+dy,4.1),.08,DARK)
                for x in (-2.3,.3,3.1):
                    z=.2+(x+2.6)*rise/run
                    s.box('railPost',(x,y+dy,z+.45),(.07,.07,.9),DARK)
    # Gate pivot is one material / one draw, separate from the static batch.
    for y in (-2.45,2.45):
        structure(s,'gatePillar',(4.1,y,4.55),(.55,.55,2.1))
        s.box('pillarCap',(4.1,y,5.66),(.67,.67,.12),STONE)
    s.box('exitSignHeader',(4.1,0,5.64),(.26,4.4,.34),STONE)
    gate=s.joint('exitGate',(4.1,-2.15,3.5))
    gate['ss_door']=json.dumps(dict(kind='swing',axis='Y',closedAngle=0,openAngle=100,initialState='closed',clearWidth=4.3))
    for y in (0,4.3):s.box('gateStile',(0,y,1.0),(.14,.14,2.0),DARK,parent=gate)
    for z in (.12,1.95):s.box('gateCrossbar',(0,2.15,z),(.14,4.3,.14),DARK,parent=gate)
    for i in range((22,18,12)[s.lod]):
        y=.18+i*3.94/((22,18,12)[s.lod]-1)
        s.box('gateBar',(0,y,1.03),(.07,.07,1.78),DARK,parent=gate,bevel=0)
    s.box('gatePlaque',(.10,2.15,1.60),(.12,2.1,.38),DARK,parent=gate)
    s.text('NORTHGATE',(4.238,0,5.64),.22,DARK,d=1,extrude=.003)
    s.text('NORTHGATE',(3.962,0,5.64),.22,DARK,side=-1,d=1,extrude=.003)
    # Closed collider is child of the hinge, so transforms follow gate state.
    colliders.cuboid('exitGate',(.18,4.3,2.0),(0,2.15,1.0),gate)
    for y in (-2.4,2.4):fixture(s,'exitLamp'+str(y),(1.3,y,2.45))
    structure(s,'emergencyPost',(-3.4,2.6,1.05),(.24,.24,1.7),DARK)
    fixture(s,'emergency',(-3.4,2.47,1.85),emergency=True)
    for name,pos,width in [('platformSocket',(-6,0,.2),5.2),('stairsBottomSocket',(-2.9,-1.4,.2),1.5),('stairsTopSocket',(3.5,-1.4,3.5),1.5),('escalatorBottomSocket',(-3.1,.9,.2),1.35),('escalatorTopSocket',(3.8,.9,3.5),1.35),('nightStreetSocket',(6,0,3.5),4.3),('gateSocket',(4.1,0,3.5),4.3)]:port(s,name,pos,width)
    anchor(s,'braceSocket',(4.1,0,3.5),coverage=[4.3,2.0])
    s.physics()
    # The mandatory +X game camera must see the stair faces, not the raised
    # landing's retaining wall. +X is the platform approach; egress is -X.
    # Transform all root children together, keeping hinge/collider local space.
    rotation=Matrix.Rotation(math.pi,4,'Z')
    for child in s.root.children:
        child.matrix_basis=rotation @ child.matrix_basis


def cushion(s, name, pos, size, token):
    # Authored octagonal textile silhouette survives even the far recipe.
    x,y,z=pos; w,l,h=size; c=min(w,l)*.13
    outline=[(-w/2+c,-l/2),(w/2-c,-l/2),(w/2,-l/2+c),(w/2,l/2-c),(w/2-c,l/2),(-w/2+c,l/2),(-w/2,l/2-c),(-w/2,-l/2+c)]
    verts=[(x+a,y+b,z-h/2) for a,b in outline]+[(x+a*.95,y+b*.98,z+h/2) for a,b in outline]
    faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    return s.solid(name,verts,faces,token)


def shelter(s):
    """Repeatable four-person rest cluster, independent warm lamps, 1.4 m aisle."""
    structure(s,'campBase',(0,0,.06),(5.6,5.6,.12))
    for x in (-1.25,1.25):
        for y in (-1.35,1.10):
            token=TEAL if x<0 else 'corgiOrange'
            cushion(s,'sleepingMat',(x,y,.23),(1.0,2.0,.22),token)
            cushion(s,'pillow',(x,y+.64,.42),(.73,.47,.23),'picketWhite')
            # Four broad padded quilt segments, reduced to two at far distance.
            n=(4,4,2)[s.lod]
            for i in range(n):cushion(s,'quiltPanel',(x,y-.32+i*.97/max(1,n-1),.36),(.94,.98/n+.04,.10),token)
            anchor(s,'rest'+str(x)+str(y)+'Socket',(x,y,.35),adult=True,routine='rest')
    # Pallet and unmistakable capped water bottles at the end of the aisle.
    for x in (-.49,.49):s.box('palletBlock',(x,2.25,.21),(.22,.82,.18),'woodWarm')
    for y in (1.90,2.13,2.36,2.59):s.box('palletSlat',(0,y,.33),(1.2,.18,.09),'woodWarm')
    for x in (-.37,0,.37):
        for y in (2.02,2.40):
            s.tube('waterBottle',(x,y,.65),.13,.51,TEAL,sides=(16,10,8))
            s.tube('bottleShoulder',(x,y,.92),.10,.08,TEAL)
            s.tube('bottleCap',(x,y,1.00),.07,.10,DARK)
            s.tube('bottleLabel',(x,y,.64),.134,.12,'picketWhite',d=1)
    for i in range(3):cushion(s,'foldedBlanket',(-2.12,2.08,.23+i*.13),(.9,.65,.14),'picketWhite' if i<2 else YELLOW)
    cushion(s,'foldReturn',(-2.12,1.85,.53),(.84,.19,.08),YELLOW)
    for n,(x,y) in enumerate([(2.15,2.1),(-2.15,-2.1)]):
        s.tube('lanternBase',(x,y,.22),.20,.16,DARK)
        fixture(s,'campLamp'+str(n),(x,y,.48),camp=True)
        s.tube('lanternCap',(x,y,.68),.20,.10,DARK)
        for dx in (-.15,.15):s.box('lanternGuard',(x+dx,y,.47),(.04,.06,.40),DARK)
        # Handle arch reads at 135 px, unlike a subpixel wire.
        for dx in (-.13,.13):s.box('handlePost',(x+dx,y,.80),(.055,.055,.22),DARK)
        s.box('handleTop',(x,y,.91),(.3,.055,.055),DARK)
    anchor(s,'waterShareSocket',(0,1.55,.13),routine='share')
    anchor(s,'aisleStartSocket',(0,-2.8,.12),clearWidth=1.4)
    anchor(s,'aisleEndSocket',(0,1.6,.12),clearWidth=1.4)
    s.physics()
