"""Deterministic Sunset Grove Freight semi-trailer; metres, +X forward, Z up.
Static parts merge by material; moving assemblies retain joint origins.
All lettering/stripes are raised geometry, with >= 3 mm face clearance.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def build_scene(lod=0, bake=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    colors = json.loads((HERE.parents[1]/'src/assets/palette.json').read_text())
    FONT=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    M = {}
    for token, rough, metal, emission in [('picketWhite',.36,0,0),('uiDark',.73,0,0),('silver',.3,.65,0),('orange',.4,0,0),('blueTrim',.22,.2,0),('survivorRed',.27,.08,0),('windowGlow',.3,0,3),('schoolBusYellow',.32,0,1.3),('sirenRed',.32,0,.65)]:
        name=('emi_' if emission else 'pal_')+token
        m=bpy.data.materials.new(name); m.use_nodes=True
        rgb=[int(colors[token][i:i+2],16)/255 for i in (1,3,5)]
        c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
        bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c
        bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
        if emission:
            bs.inputs['Emission Color'].default_value=c; bs.inputs['Emission Strength'].default_value=emission
        m.diffuse_color=c; M[token]=m

    def empty(name, loc=(0,0,0), parent=None):
        o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=loc; o.parent=parent
        bpy.context.view_layer.update()
        return o
    root=empty('veh.semi-trailer')
    root['ss_physics']=json.dumps({'class':'heavy',**dict(mass=18000,friction=.8,restitution=.03,centerOfMass=[-.4,1.1,0],pushable=False,kickable=False,flammable=True)})
    body=empty('body',parent=root)

    def finish(o,name,token,parent=body,bevel=.02):
        o.name=name
        omit=('rivet','tread','lug','rim vent','roof seam','step grip','fleet marking')
        if lod and any(key in name for key in omit):
            bpy.data.objects.remove(o,do_unlink=True); return None
        if lod==2 and any(key in name for key in ('rim bead','hub cap','lock bracket','hinge pin','tank strap','marker base','reflective tape','shield perforation','side panel seam','sleeper louvre','rim bowl','side marker','sill marker','corner marker','roof marker base','damper','leaf spring','mirror stay','exhaust elbow','shield band','wiper','wiper arm')):
            bpy.data.objects.remove(o,do_unlink=True); return None
        o.data.materials.append(M[token])
        if lod and name not in ('cargo box','hood','cab','sleeper','door panel','mirror housing','fuel tank','front bumper','grille surround','rear door'):
            bevel=0
        if bevel and lod<2:
            mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=(3 if name in ('hood','cab','sleeper','cargo box','fuel tank','front bumper','grille surround') else 1) if lod==0 else 1
            mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        world=Matrix.LocRotScale(o.location,o.rotation_euler.to_quaternion(),o.scale)
        o.parent=parent; o.matrix_world=world
        return o

    def box(name,loc,size,token,parent=body,bevel=.02,rot=None):
        hx,hy,hz=(v/2 for v in size)
        verts=[(x*hx,y*hy,z*hz) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
        faces=[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)]
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o); o.location=loc
        if rot: o.rotation_euler=rot
        return finish(o,name,token,parent,0 if min(size)<.03 else min(bevel,min(size)*.4))

    def prism(name,points,y0,y1,token,parent=body,bevel=.02):
        n=len(points); verts=[(x,y,z) for y in (y0,y1) for x,z in points]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o)
        return finish(o,name,token,parent,bevel)

    def cylinder(name,loc,radius,depth,token,parent=body,axis='Y',vertices=32):
        n=min(vertices,16 if lod==1 else 6) if lod else vertices
        phase=math.pi/6 if lod==2 and name=='tyre' else 0
        verts=[(radius*math.cos(math.tau*i/n+phase),radius*math.sin(math.tau*i/n+phase),z) for z in (-depth/2,depth/2) for i in range(n)]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
        for f in list(me.polygons)[2:]: f.use_smooth=True
        return finish(o,name,token,parent,0 if name in ('rail rivet','rim vent','lug','bumper bolt') else .012)

    def rod(name,start,end,radius,token,parent=body):
        start,end=Vector(start),Vector(end)
        o=cylinder(name,(start+end)/2,radius,(end-start).length,token,parent,axis='Z',vertices=12)
        if o is not None: o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
        return o

    def torus(name,loc,major,minor,token,parent=body):
        if lod==2:
            return cylinder(name,loc,major+minor,minor*2,token,parent,vertices=12)
        n=48 if lod==0 else 24 if lod==1 else 12
        m=10 if lod==0 else 6 if lod==1 else 4
        verts=[]; faces=[]
        for i in range(n):
            t=math.tau*i/n
            for j in range(m):
                u=math.tau*j/m; rr=major+minor*math.cos(u)
                verts.append((rr*math.cos(t),rr*math.sin(t),minor*math.sin(u)))
                faces.append((i*m+j,((i+1)%n)*m+j,((i+1)%n)*m+(j+1)%m,i*m+(j+1)%m))
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(math.pi/2,0,0)
        for f in me.polygons: f.use_smooth=True
        return finish(o,name,token,parent,0)

    def text(name,label,loc,size,token,side=-1,parent=body,width=None):
        if lod==2: return None
        cu=bpy.data.curves.new(name,'FONT'); cu.body=label; cu.size=size; cu.extrude=.004 if lod==0 else 0; cu.bevel_depth=0; cu.bevel_resolution=1
        cu.font=FONT
        cu.align_x='CENTER'; cu.align_y='CENTER'; cu.resolution_u=5 if lod==0 else 2
        o=bpy.data.objects.new(name,cu); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(math.pi/2,0,math.pi if side==1 else 0)
        bpy.context.view_layer.update()
        if width: o.scale.x=width/max(o.dimensions.x,.01)
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
        return finish(o,name,token,parent,0)

    def arch(name,x,y,r,width,token):
        # Solid open semicircular fender: continuous bevelled surface.
        n=32 if lod==0 else 12 if lod==1 else 6
        verts=[]
        for yy in (y-width/2,y+width/2):
            for rr in (r,r+.075):
                for i in range(n+1):
                    t=math.pi*i/n
                    verts.append((x+rr*math.cos(t),yy,.61+rr*math.sin(t)))
        k=n+1; faces=[]
        for i in range(n):
            for aa,bb in ((0,k),(2*k,3*k),(0,2*k),(k,3*k)):
                faces.append((aa+i,aa+i+1,bb+i+1,bb+i))
        for i in (0,n): faces.append((i,k+i,3*k+i,2*k+i))
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o)
        return finish(o,name,token,body,.025)

    # Trailer box, ribbed roof, riveted aluminum frame and raised livery.
    box('cargo box',(-2.8,0,3.025),(11.2,2.5,3.05),'picketWhite',bevel=.055)
    box('trailer chassis',(-2.8,0,1.37),(11.25,1.85,.25),'uiDark',bevel=.035)
    box('tractor chassis',(4.15,0,.88),(7.7,1.65,.3),'uiDark',bevel=.04)
    for y in (-.72,.72): box('tractor rail',(4.1,y,.74),(7.55,.15,.27),'uiDark')
    for x in (-7.4,-6.1,.9,2.2,7.2):
        cylinder('axle',(x,0,.61),.115,2.3,'uiDark')
        box('axle differential',(x,0,.61),(.38,.44,.32),'uiDark',bevel=.075)
        for y in (-.61,.61):
            box('leaf spring',(x,y,.8),(1.1,.12,.065),'silver')
            rod('damper',(x-.3,y,.62),(x+.2,y,1.08),.047,'silver')
    cylinder('fifth wheel',(1.9,0,1.145),.65,.13,'uiDark',axis='Z')
    for side in (-1,1):
        y=side*1.28
        for z in (1.54,4.54): box('trailer rail',(-2.8,y,z),(11.32,.09,.125),'silver')
        for x in (-8.39,2.79):
            box('trailer post',(x,y,3.04),(.09,.1,3.02),'silver')
            for z in (1.56,4.51): box('corner cap',(x,y,z),(.24,.14,.24),'silver',bevel=.035)
        box('orange stripe',(-2.8,side*1.265,1.98),(11.04,.016,.23),'orange',bevel=.003)
        box('navy stripe',(-2.8,side*1.267,1.74),(11.04,.018,.13),'blueTrim',bevel=.003)
        for i in range(29):
            x=-8.22+i*.387
            box('reflective tape',(x,side*1.334,1.55),(.26,.01,.065),'survivorRed' if i%2==0 else 'picketWhite',bevel=.002)
            for z in (1.54,4.54): cylinder('rail rivet',(x,side*1.335,z),.015,.009,'silver',vertices=10)
        for i in range(1,12):
            x=-8.4+i*.935
            box('side panel seam',(x,side*1.253,3.08),(.012,.011,2.68),'silver',bevel=.002)
        # Mountain / sun emblem as raised solid geometry.
        cx=.8
        cy=side*1.271
        cylinder('sun emblem',(cx,cy,3.38),.63,.02,'orange',vertices=64)
        pts=[(cx-1.16,2.62),(cx-.49,3.3),(cx-.21,3.06),(cx+.32,3.92),(cx+.91,3.2),(cx+1.21,3.43),(cx+1.85,2.62)]
        if side==1: pts=[(2*cx-x,z) for x,z in pts]
        prism('mountain emblem',pts,side*1.292,side*1.313,'blueTrim',bevel=.003)
        snow=[(cx+.04,3.45),(cx+.32,3.79),(cx+.46,3.39),(cx+.24,3.47)]
        road=[(cx-.42,2.63),(cx-.15,2.97),(cx+.38,3.25),(cx+.08,3.3),(cx+.4,3.57),(cx+.31,3.23),(cx+.6,3.18),(cx+.09,2.82),(cx-.05,2.63)]
        for name,points in [('mountain snow',snow),('winding road',road)]:
            if side==1: points=[(2*cx-x,z) for x,z in points]
            prism(name,points,side*1.323,side*1.335,'picketWhite',bevel=0)
        tx=-4.27
        text('company name','SUNSET GROVE',(tx,side*1.271,3.58),.58,'blueTrim',side,width=4.98)
        text('company service','FREIGHT CO.',(tx,side*1.271,2.99),.52,'blueTrim',side,width=4.4)
        for x in (-5.8,-4.6,-3.4,-2.2,-1): box('trailer crossmember',(x,0,1.29),(.13,2.13,.17),'uiDark')
        box('side underrun guard',(-3.05,side*.99,.79),(4.1,.11,.14),'uiDark')
        for x in (-4.8,-1.3): box('side guard support',(x,side*.99,1.04),(.12,.12,.58),'uiDark')
        box('landing leg',(-.45,side*.74,.95),(.17,.19,.94),'uiDark')
        box('landing shoe',(-.45,side*.74,.48),(.37,.37,.08),'silver')
        rod('landing brace',(-.45,side*.74,.8),(-1.25,side*.74,1.4),.038,'uiDark')
        rod('landing crank',(-.45,side*.78,1.21),(-.45,side*1.08,1.21),.025,'silver')
        for x in (.9,2.2,-6.1,-7.4):
            arch('rear mudguard',x,side*.99,.695,.47,'uiDark')
            box('mud flap',(x-.75,side*.98,.48),(.045,.51,.73),'uiDark')
    for x in (-6.4,-4.4,-2.4,-.4,1.6): box('roof seam',(x,0,4.56),(.018,2.38,.017),'silver',bevel=.003)
    for y in (-.8,-.4,0,.4,.8): box('front bulkhead rib',(2.831,y,3.05),(.03,.025,2.78),'silver',bevel=.006)

    # Conventional long bonnet and tall aerodynamic sleeper.
    box('hood',(7.1,0,1.76),(2.13,1.62,1.33),'survivorRed',bevel=.16)
    box('hood crown',(7.08,0,2.43),(2.07,1.55,.12),'survivorRed',bevel=.055)
    prism('cab',[(4.4,1.12),(6.15,1.12),(6.15,2.17),(5.75,3.42),(4.43,3.5)],-.98,.98,'survivorRed',bevel=.09)
    prism('sleeper',[(3.15,1.19),(4.55,1.19),(4.55,3.47),(5.54,3.44),(5.18,3.83),(4.72,4.03),(3.16,4.03)],-1.05,1.05,'survivorRed',bevel=.12)
    box('cab visor',(5.83,0,3.43),(.47,2.12,.12),'survivorRed',bevel=.04)
    # Windscreen sits on the sloping face, with raised gasket and center bar.
    box('windshield seal',(5.943,0,2.82),(.04,1.94,1.05),'uiDark',rot=(0,-.309,0),bevel=.055)
    box('windshield',(5.968,0,2.82),(.032,1.82,.92),'blueTrim',rot=(0,-.309,0),bevel=.04)
    box('windshield divider',(5.997,0,2.82),(.033,.035,.94),'silver',rot=(0,-.309,0),bevel=.006)
    for side in (-1,1):
        arch('front fender',7.2,side*.99,.7,.51,'survivorRed')
        box('fender nose',(8.01,side*.96,1.15),(.5,.58,.43),'survivorRed',bevel=.07)
        door=empty('doorL' if side==-1 else 'doorR',(5.99,side*.988,1.45),root)
        prism('door panel',[(4.5,1.24),(5.98,1.24),(5.98,2.16),(5.62,3.31),(4.51,3.34)],side*.995,side*1.015,'survivorRed',door,.025)
        prism('side window',[(4.61,2.22),(5.86,2.22),(5.57,3.21),(4.61,3.23)],side*1.025,side*1.052,'blueTrim',door,.025)
        box('quarterlight divider',(5.5,side*1.07,2.72),(.035,.024,.98),'silver',door,rot=(0,-.26,0),bevel=.004)
        box('door handle',(4.72,side*1.054,1.95),(.23,.047,.07),'silver',door)
        text('fleet marking','SG • 047',(5.25,side*1.041,1.72),.12,'silver',side,door,width=.76)
        for z in (2.38,3.17):
            rod('mirror stay',(5.85,side*1.02,z),(5.92,side*1.44,z),.023,'silver',door)
        box('mirror housing',(5.92,side*1.44,2.8),(.17,.15,.65),'silver',door,bevel=.035)
        box('mirror glass',(5.821,side*1.44,2.8),(.018,.126,.57),'blueTrim',door,bevel=.013)
        box('convex mirror',(5.93,side*1.44,2.34),(.19,.17,.2),'silver',door,bevel=.055)
        # Sleeper access panel, bunk window, roof louvres and grab rails.
        box('sleeper window frame',(3.58,side*1.063,2.75),(.37,.025,.57),'silver',bevel=.045)
        box('sleeper window',(3.58,side*1.082,2.75),(.29,.018,.48),'blueTrim',bevel=.035)
        box('storage hatch',(3.58,side*1.064,1.72),(.53,.033,.58),'survivorRed',bevel=.04)
        for xx in (3.32,3.83): rod('hatch edge',(xx,side*1.085,1.45),(xx,side*1.085,2),.013,'silver')
        box('hatch latch',(3.73,side*1.098,1.64),(.055,.017,.11),'silver',bevel=.006)
        for i in range(6): box('sleeper louvre',(3.64,side*1.064,3.57+i*.037),(.46,.014,.018),'uiDark',bevel=.004)
        rod('grab rail',(3.24,side*1.12,1.58),(3.24,side*1.12,3.15),.025,'silver')
        box('cab sill',(4.35,side*1.068,1.22),(2.3,.12,.12),'survivorRed')
        # Cylindrical fuel tank, bands, filler and serrated steps.
        cylinder('fuel tank',(3.72,side*.91,.73),.36,1.63,'silver',axis='X',vertices=64)
        for xx in (3.15,4.27):
            cylinder('tank strap',(xx,side*.91,.73),.378,.056,'uiDark',axis='X',vertices=48)
        cylinder('fuel filler',(3.87,side*1.12,1.04),.075,.058,'silver',axis='Z',vertices=20)
        for xx,z,length in ((5.29,.69,1.12),(5.04,1.04,.87)):
            box('cab step',(xx,side*1.105,z),(length,.39,.12),'silver',bevel=.025)
            for i in range(8): box('step grip',(xx-length*.4+i*length*.115,side*1.106,z+.066),(.044,.29,.015),'uiDark',bevel=.003)
        # Stacks are chrome, with heat shields and angled hollow-looking tips.
        cylinder('exhaust heat shield',(4.34,side*1.24,2.18),.145,1.68,'silver',axis='Z',vertices=48)
        cylinder('exhaust pipe',(4.34,side*1.24,3.73),.078,1.46,'silver',axis='Z',vertices=32)
        rod('stack tip',(4.34,side*1.24,4.4),(4.14,side*1.24,4.69),.078,'silver')
        o=cylinder('exhaust opening',(4.132,side*1.24,4.703),.059,.012,'uiDark',axis='Z',vertices=24)
        o.rotation_euler=(0,-.6,0)
        rod('exhaust elbow',(4.34,side*1.24,1.36),(4.16,side*1.12,1.02),.078,'silver')
        for z in (1.5,2.82): cylinder('shield band',(4.34,side*1.24,z),.153,.045,'silver',axis='Z',vertices=40)
        for i in range(8):
            for z in (1.77,2.08,2.39,2.61):
                t=math.tau*i/8
                box('shield perforation',(4.34+.147*math.cos(t),side*1.24+.147*math.sin(t),z),(.024,.024,.055),'uiDark',bevel=.008)
        box('hood handle',(6.56,side*.827,1.99),(.25,.031,.085),'silver')
        rod('wiper',(6.13,side*.8,2.35),(6.164,side*.12,2.36),.018,'uiDark')
        rod('wiper arm',(6.17,side*.1,2.33),(6.075,side*.32,2.56),.014,'silver')
    box('grille surround',(8.22,0,1.81),(.18,1.55,1.55),'silver',bevel=.12)
    box('grille recess',(8.318,0,1.81),(.026,1.36,1.34),'uiDark',bevel=.06)
    for z in [1.22+i*.145 for i in range(9)]: box('grille horizontal',(8.348,0,z),(.035,1.31,.034),'silver',bevel=.009)
    for y in (-.46,-.16,.16,.46): box('grille vertical',(8.374,y,1.81),(.038,.033,1.3),'silver',bevel=.009)
    box('front bumper',(8.3,0,.85),(.3,2.49,.45),'silver',bevel=.065)
    for side in (-1,1):
        box('tow slot',(8.461,side*.45,.87),(.024,.2,.13),'uiDark',bevel=.01)
        for y in (.8,1.15): cylinder('bumper bolt',(8.465,side*y,.86),.022,.012,'silver',axis='X',vertices=12)
    box('registration',(8.468,0,.85),(.018,.3,.15),'picketWhite',bevel=.008)

    # Ten independently rotating hubs, with dual tyres on the four rear axles.
    for x,tag in [(7.2,'F'),(2.2,'R'),(.9,'Drive2'),(-6.1,'Trailer1'),(-7.4,'Trailer2')]:
        for side,lr in [(-1,'L'),(1,'R')]:
            wheel=empty('wheel'+tag+lr,(x,side*1.045,.61),root)
            for yy in ([side*1.045] if tag=='F' else [side*1.065,side*.725]):
                torus('tyre',(x,yy,.61),.46,.15,'uiDark',wheel)
                if lod==0:
                    for i in range(48):
                        t=math.tau*i/48
                        box('tread',(x+.604*math.cos(t),yy,.61+.604*math.sin(t)),(.047,.21,.014),'uiDark',wheel,bevel=.002,rot=(0,math.pi/2-t,0))
            cylinder('rim',(x,side*1.193,.61),.36,.055,'silver',wheel,vertices=48)
            torus('rim bead',(x,side*1.228,.61),.338,.018,'silver',wheel)
            cylinder('rim bowl',(x,side*1.225,.61),.277,.024,'uiDark',wheel)
            cylinder('hub',(x,side*1.247,.61),.175,.085,'silver',wheel)
            cylinder('hub cap',(x,side*1.297,.61),.102,.035,'silver',wheel)
            for i in range(10):
                t=math.tau*i/10
                cylinder('rim vent',(x+.278*math.cos(t),side*1.251,.61+.278*math.sin(t)),.036,.015,'uiDark',wheel,vertices=16)
                cylinder('lug',(x+.2*math.cos(t),side*1.27,.61+.2*math.sin(t)),.024,.027,'silver',wheel,vertices=8)

    for side in (-1,1):
        rear=empty('cargoDoorL' if side==-1 else 'cargoDoorR',(-8.43,side*1.18,3.04),root)
        box('rear door',(-8.444,side*.608,3.04),(.039,1.15,2.85),'picketWhite',rear,bevel=.015)
        for yy in (side*.075,side*1.16): box('rear stile',(-8.472,yy,3.04),(.02,.03,2.81),'silver',rear)
        rod('locking rod',(-8.5,side*.15,1.7),(-8.5,side*.15,4.35),.024,'silver',rear)
        for z in (1.85,2.88,4.21):
            box('door hinge',(-8.503,side*1.08,z),(.045,.2,.085),'silver',rear)
            cylinder('hinge pin',(-8.529,side*1.16,z),.026,.14,'silver',rear,axis='Z',vertices=16)
            box('lock bracket',(-8.524,side*.15,z),(.033,.12,.1),'silver',rear)
        box('lock handle',(-8.546,side*.28,2.05),(.03,.3,.048),'silver',rear)
    box('rear sill',(-8.45,0,1.53),(.15,2.58,.14),'silver')
    box('rear underrun bumper',(-8.6,0,.67),(.17,2.5,.16),'silver')
    for y in (-.98,.98): box('rear bumper support',(-8.46,y,1.06),(.14,.14,.68),'uiDark')
    for i in range(8): box('rear reflective tape',(-8.697,-1.1+i*.315,.67),(.014,.19,.07),'survivorRed' if i%2==0 else 'picketWhite',bevel=.002)

    front=empty('lightsFront',(8.2,0,1.34),root)
    brake=empty('lightsBrake',(-8.52,0,1.21),root)
    markers=empty('clearanceLamps',parent=root)
    for side in (-1,1):
        box('headlamp surround',(8.22,side*1.02,1.29),(.15,.43,.36),'silver')
        box('headlamp',(8.312,side*1.04,1.29),(.034,.31,.25),'windowGlow',front)
        box('tail housing',(-8.54,side*1.025,1.19),(.14,.34,.2),'uiDark')
        box('brake lens',(-8.627,side*1.08,1.19),(.025,.16,.13),'sirenRed',brake)
        box('rear turn lens',(-8.628,side*.92,1.19),(.026,.096,.13),'schoolBusYellow',markers)
        box('front turn lens',(8.313,side*.845,1.29),(.035,.065,.24),'schoolBusYellow',markers)
        for x in (-8.31,-6.3,-4.3,-2.3,-.3,2.69):
            box('marker base',(x,side*1.337,1.54),(.16,.016,.11),'silver')
            box('side marker',(x,side*1.352,1.54),(.11,.02,.063),'schoolBusYellow',markers,bevel=.009)
        for x in (-8.3,2.7):
            box('corner marker',(x,side*1.35,4.39),(.13,.026,.1),'schoolBusYellow',markers)
        for xx in (3.3,3.65,4,4.35,4.7): box('sill marker',(xx,side*1.141,1.22),(.16,.02,.06),'schoolBusYellow',markers)
        for label,pos,typ,color,group in [('headlight',(8.34,side*1.04,1.29),'spot','light_led_white',front),('brake',(-8.66,side*1.08,1.19),'point','light_siren_red',brake)]:
            anchor=empty('light:'+label+('L' if side==-1 else 'R'),pos,root)
            if typ=='spot': anchor.rotation_euler=(0,-math.pi/2+.1,0)
            anchor['ss_light']=json.dumps(dict(type=typ,color=color,intensity=5 if typ=='spot' else 1,range=24 if typ=='spot' else 2,angle=48,penumbra=.35,pool=True,beam='soft' if typ=='spot' else 'none',flare=True,reflect=True,shadow='hero' if typ=='spot' else 'none',heroPriority=2,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=[group.name],tiers='all'))
    for y in (-.88,-.35,0,.35,.88):
        box('roof marker base',(5.87,y,3.5),(.17,.12,.07),'silver')
        box('roof marker',(5.87,y,3.555),(.13,.085,.07),'schoolBusYellow',markers,bevel=.02)
    for name,loc in [('driverSeat',(5.12,-.46,1.71)),('exitL',(5.1,-1.7,0)),('exitR',(5.1,1.7,0))]: empty(name,loc,root)
    for name,loc,size in [('trailer',(-2.8,0,3.03),(11.2,2.5,3.05)),('cab',(4.7,0,2.55),(3.1,2.6,2.95)),('hood',(7.1,0,1.75),(2.15,2.1,1.4)),('chassis',(0,0,.75),(16.7,2.45,1.5))]:
        o=empty('col:'+name,loc,root); o['collider']='cuboid'; o['shape']='cuboid'; o['size']=list(size)

    meshes=[o for o in scene.objects if o.type=='MESH']
    graph=bpy.context.evaluated_depsgraph_get()
    evaluated=[(o,bpy.data.meshes.new_from_object(o.evaluated_get(graph),depsgraph=graph)) for o in meshes]
    for o,mesh in evaluated:
        o.modifiers.clear(); o.data=mesh
    groups={}
    for o in meshes: groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); o=bpy.context.object
        o.name=parent+'_'+mat
        if parent=='clearanceLamps': o['decorativeEmissive']=True
        world=o.matrix_world.copy(); joint=bpy.data.objects[parent].matrix_world.copy()
        o.data.transform(joint.inverted()@world); o.matrix_world=joint
        mod=o.modifiers.new('density','DECIMATE')
        if lod==0:
            # Preserve thin markings, doors, glazing and paint silhouettes.
            protected=parent.startswith(('door','cargoDoor')) or mat.startswith('emi_') or mat.endswith(('blueTrim','orange','picketWhite')) or (parent=='body' and mat.endswith('survivorRed'))
            mod.ratio=1 if protected else .85 if parent=='body' and mat.endswith('silver') else .52
        elif lod==1:
            mod.ratio=1 if mat.endswith(('orange','blueTrim','picketWhite')) else .42
        else:
            protected=parent.startswith(('wheel','door','cargoDoor')) or mat.startswith('emi_') or mat.endswith(('orange','blueTrim','picketWhite','survivorRed'))
            mod.ratio=1 if protected else .35
        mod.use_collapse_triangulate=True; bpy.ops.object.modifier_apply(modifier=mod.name)
        o.data.calc_loop_triangles()
    for anchor in scene.objects:
        if 'ss_light' in anchor:
            light=json.loads(anchor['ss_light'])
            light['emissiveNodes']=[o.name for o in scene.objects if o.type=='MESH' and any(o.name.startswith(prefix+'_emi_') for prefix in light['emissiveNodes'])]
            anchor['ss_light']=json.dumps(light)
    sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
    from sslib import ao
    if bake: ao.bake_all([o for o in scene.objects if o.type=='MESH'],samples=32)
    bpy.ops.object.select_all(action='DESELECT')
    objects=list(scene.objects)
    triangles=sum(len(o.data.loop_triangles) for o in objects if o.type=='MESH')
    calls=sum(len(o.data.materials) for o in objects if o.type=='MESH')
    required=['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR','doorL','doorR','cargoDoorL','cargoDoorR']
    stats=dict(id='veh.semi-trailer',tier='Hero',triangles=triangles,draw_calls=calls,materials=sorted({m.name for o in objects if o.type=='MESH' for m in o.data.materials}),nodes_ok=all(scene.objects.get(n) is not None for n in required),within_budget=triangles<=80000 and calls<=40,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
    return M,objects,stats

M,objects,stats=build_scene(a.lod,bake=bool(a.glb))
if a.lod==0: (HERE/'geometry.json').write_text(json.dumps(stats,indent=2)+'\n')
def export_scene(path,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
if a.glb:
    export_scene(a.glb,objects)
    lod_stats={}
    for lod in ((1,2) if a.lod==0 else ()):
        _,lo,ss=build_scene(lod,bake=True)
        export_scene(Path(a.glb).with_name('model.lod'+str(lod)+'.glb'),lo)
        lod_stats[str(lod)]={k:ss[k] for k in ('triangles','draw_calls')}
    if a.lod==0: (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')
    if a.render: M,objects,_=build_scene(a.lod)
scene=bpy.context.scene
if a.render:
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015)); ground=bpy.context.object
    ground.name='studio ground'; ground.data.materials.append(M['uiDark'])
    scene.world=bpy.data.worlds.new('studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.22,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def area(name,pos,power,color,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; o.rotation_euler=(Vector((0,0,2.1))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(4,8,12),3500,(1,.81,.65),10)
    area('cool fill',(3,-8,9),2700,(.68,.79,1),9)
    area('rim',(-8,2,10),4000,(1,.71,.45),8)
    d=bpy.data.cameras.new('camera'); cam=bpy.data.objects.new('camera',d); scene.collection.objects.link(cam)
    positions={'ref':(21,30,16),'game':(23,-23,30),'front':(27,0,8),'side':(0,-28,9),'rear':(-25,-16,12)}
    cam.location=positions[a.view]; target=Vector((0,0,2.2))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=24 if a.view=='game' else 20
    scene.camera=cam; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=-.25; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve())
    bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        # Review the same built geometry at gameplay elevation as well.
        cam.location=positions['game']; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); d.ortho_scale=24
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        path=Path(a.render)
        scene.render.filepath=str(path.with_name('game.png' if path.name=='hero.png' else path.stem.replace('-ref','-game')+'.png').resolve())
        bpy.ops.render.render(write_still=True)
print('OK',json.dumps(stats))
