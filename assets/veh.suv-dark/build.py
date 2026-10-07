"""Deterministic hero SUV. +X forward, +Z up; all dimensions in metres.
Build/render through experiment/tools/blender_run.py (see asset prompt).
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.distance import tier_argument, export_variant, build_native_lods
DISTANCE = tier_argument()
if '--lod-only' in sys.argv:
    build_native_lods(__file__)
    sys.exit(0)

HERE = Path(__file__).resolve().parent
ASSET = {'id': 'veh.suv-dark', 'category': 'vehicle', 'tier': 'Hero'}
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def linear(hexcode):
    rgb = [int(hexcode[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb] + [1]


def material(name, color, rough=.5, metal=0, emit=0, alpha=1):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = linear(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = linear(color)
        p.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'DITHERED'
    m.diffuse_color = linear(color)
    return m


M = {
    'paint': material('pal_asphalt', '454354', .34, .18),
    'rubber': material('pal_uiDark', '25222c', .77),
    'metal': material('pal_sidewalk', '837a80', .38, .55),
    'glass': material('pal_backpackTeal', '343645', .17, .1, alpha=.80),
    'rack': material('pal_brick', 'd64d24', .4, .22),
    'rope': material('pal_woodWarm', 'b0703f', .78),
    'amber': material('pal_schoolBusYellow', 'ef9b31', .35),
    'head': material('emi_windowGlow', 'ffc773', .25, emit=3.5),
    'brake': material('emi_sirenRed', 'ff2d2d', .35, emit=1.1),
}


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update()
    return o


def build(quality=0):
    root = empty('veh.suv-dark')
    root['ss_physics'] = {'class': 'heavy', 'mass': 2100, 'friction': .8,
                          'restitution': .05, 'centerOfMass': [0, 0, .7],
                          'pushable': False, 'kickable': False, 'flammable': True}
    groups = {'body': empty('body', parent=root)}
    parts = {}
    skipped = []


    def finish(o, mat, group='body', bevel=.025):
        if DISTANCE: bevel = 0
        detail = o.name.split('.')[0]
        omit = {'tread block', 'lug nut'}
        if quality == 2:
            omit |= {'rounded tire shoulder', 'rim lip', 'wheel spoke', 'recovery rope coil',
                     'rope tail', 'steering wheel', 'case strap', 'case handle', 'wiper arm',
                     'wiper blade', 'rear wiper', 'lower door moulding', 'running board edge',
                     'hood crease', 'grille vertical', 'mirror insert', 'corner indicator',
                     'headrest', 'seat cushion', 'seat back', 'dashboard', 'axle',
                     'differential', 'exhaust', 'tow hitch', 'fog lens', 'front fog recess',
                     'door frame', 'window gasket', 'windshield seal', 'rear window border',
                     'rear window lower seal', 'roof lamp bezel', 'headlamp bezel',
                     'blank plate', 'hatch handle', 'door handle'}
        if quality and detail in omit:
            skipped.append(o)
            return o
        if quality:
            bevel = bevel if quality == 1 and detail in {'roof', 'hood', 'door panel', 'angular fender flare', 'bumper'} else 0
        o.data.materials.append(M[mat])
        bpy.context.view_layer.objects.active = o
        if bevel:
            mod = o.modifiers.new('Soft edges', 'BEVEL')
            mod.width = bevel
            mod.segments = 1 if quality or 'tread' in o.name else 2
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons:
            p.use_smooth = not quality or bevel > 0 or detail in {
                'tire carcass', 'rounded tire shoulder', 'wheel dish', 'dark hub recess',
                'hub cap', 'rim lip', 'recovery rope coil'}
        mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        parts.setdefault((group, mat), []).append(o)
        return o


    def box(name, loc, size, mat, group='body', bevel=.025, rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if rot:
            o.rotation_euler = rot
        return finish(o, mat, group, min(bevel, min(size) * .42))


    def mesh(name, verts, faces, mat, group='body', bevel=.02):
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        o = bpy.data.objects.new(name, me)
        scene.collection.objects.link(o)
        return finish(o, mat, group, bevel)


    def prism(name, pts, y0, y1, mat, group='body', bevel=.025):
        n = len(pts)
        verts = [(x, y, z) for y in (y0, y1) for x, z in pts]
        faces = [tuple(reversed(range(n))), tuple(range(n, n*2))]
        faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
        return mesh(name, verts, faces, mat, group, bevel)


    def beam(name, a, b, width, mat, group='body', depth=None):
        a, b = Vector(a), Vector(b)
        o = box(name, (a+b)/2, (width, depth or width, (b-a).length), mat, group)
        o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
        return o


    def cylinder(name, loc, radius, depth, mat, group='body', vertices=36):
        if DISTANCE: vertices = min(vertices, 12 if DISTANCE == 1 else 6)
        bpy.ops.mesh.primitive_cylinder_add(vertices=min(vertices, 10 if quality == 2 else 20) if quality else vertices, radius=radius, depth=depth,
                                           location=loc, rotation=(math.pi/2, 0, 0))
        o = bpy.context.object
        o.name = name
        return finish(o, mat, group, .012)


    def torus(name, loc, major, minor, mat, group='body', rotation=(math.pi/2, 0, 0)):
        bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                         major_segments=(16 if DISTANCE == 1 else 12) if DISTANCE else 24 if quality else 36, minor_segments=(4 if DISTANCE == 1 else 3) if DISTANCE else 6 if quality else 10,
                                         location=loc, rotation=rotation)
        o = bpy.context.object
        o.name = name
        return finish(o, mat, group, 0)


    # Narrow central chassis and hollow side skins leave real space inside wheel arches.
    box('ladder chassis', (0, 0, .66), (4.35, 1.50, .34), 'rubber')
    box('floor', (-.3, 0, .91), (3.55, 1.89, .18), 'paint')
    for x in (-1.44, 1.38):
        cylinder('axle', (x, 0, .55), .095, 2.05, 'rubber', vertices=20)
        box('differential', (x, 0, .52), (.29, .36, .26), 'rubber')

    side_outline = [(-2.22,.69),(-2.22,1.43),(1.96,1.43),(2.20,1.30),(2.20,.70),
                    (2.03,.70),(1.95,1.00),(1.73,1.18),(1.05,1.18),(.82,1.0),
                    (.72,.64),(-.78,.64),(-.89,1.0),(-1.12,1.18),(-1.76,1.18),(-1.99,1.0),(-2.07,.69)]
    for side in (-1, 1):
        prism('wheel-arch body skin', side_outline, side*.94, side*1.025, 'paint')
        box('running board', (-.04, side*1.065, .61), (1.78,.17,.105), 'rubber')
        box('running board edge', (-.04, side*1.135, .64), (1.76,.025,.045), 'metal', bevel=.01)
        for x in (-1.44, 1.38):
            outer=[(x-.73,.61),(x-.62,1.02),(x-.39,1.27),(x+.38,1.27),(x+.62,1.03),(x+.73,.61)]
            inner=[(x+.58,.62),(x+.49,.97),(x+.30,1.105),(x-.30,1.105),(x-.49,.97),(x-.58,.62)]
            prism('angular fender flare', outer+inner, side*1.026, side*1.135,'paint',bevel=.03)
        box('front side marker', (1.64, side*1.045,1.40),(.17,.04,.095),'amber',bevel=.013)

    # Hood is a low wedge; raised shoulder lines border its broad inset centre.
    prism('hood', [(.63,1.44),(.71,1.61),(2.17,1.46),(2.19,1.34)], -.98,.98,'paint',bevel=.045)
    for y in (-.79,.79):
        beam('hood crease',(.74,y,1.63),(2.14,y,1.48),.045,'paint',depth=.065)
    box('roof',(-.56,0,2.04),(2.87,1.93,.13),'paint',bevel=.06)
    # A/B/C/D pillars; side glazing laid into separate window seals.
    for side in (-1,1):
        beam('A pillar',(.94,side*.965,1.43),(.49,side*.89,2.02),.105,'paint')
        beam('D pillar',(-2.12,side*.99,1.40),(-1.92,side*.89,2.03),.13,'paint')
        box('rear quarter lower skin',(-1.91,side*.987,1.34),(.56,.075,.20),'paint')
        rear_pts=[(-2.035,1.49),(-1.852,1.97),(-1.01,1.97),(-1.01,1.49)]
        prism('quarter window seal',rear_pts,side*.94,side*.996,'rubber',bevel=.018)
        prism('quarter glass',[(-1.97,1.54),(-1.815,1.92),(-1.07,1.92),(-1.07,1.54)],side*.998,side*1.007,'glass',bevel=.01)
        for name,pts,hinge,handle in [
            ('doorL' if side==-1 else 'doorR',[(-.15,.68),(.71,.68),(.88,1.45),(.45,1.99),(-.15,1.99)],(.79,side*1.02,1.34),-.02),
            ('doorRearL' if side==-1 else 'doorRearR',[(-.97,.68),(-.19,.68),(-.19,1.99),(-.97,1.99)],(-.20,side*1.02,1.34),-.82)]:
            groups[name]=empty(name,hinge,root)
            # Door is a lower sheet plus open upper window frame, rather than solid behind glass.
            prism('door panel',[(pts[0][0],.69),(pts[1][0],.69),(pts[2][0],1.46),(pts[0][0],1.46)],side*.968,side*1.027,'paint',name,.018)
            if name in ('doorL','doorR'):
                win=[(-.085,1.52),(.754,1.52),(.405,1.929),(-.085,1.929)]
                frame=[(-.15,1.46),(.88,1.46),(.45,1.99),(-.15,1.99)]
            else:
                win=[(-.90,1.52),(-.26,1.52),(-.26,1.929),(-.90,1.929)]
                frame=[(-.97,1.46),(-.19,1.46),(-.19,1.99),(-.97,1.99)]
            # Seal strips outline an opening. Glass stands 7 mm beyond seals.
            for i in range(4):
                a,b=frame[i],frame[(i+1)%4]
                beam('door frame',(a[0],side*1.002,a[1]),(b[0],side*1.002,b[1]),.07,'paint',name,depth=.055)
                a,b=win[i],win[(i+1)%4]
                beam('window gasket',(a[0],side*1.031,a[1]),(b[0],side*1.031,b[1]),.024,'rubber',name)
            prism('door glass',win,side*1.037,side*1.047,'glass',name,.006)
            box('door handle',(handle,side*1.068,1.34),(.20,.065,.065),'rubber',name,.014)
            box('lower door moulding',((pts[0][0]+pts[1][0])*.5,side*1.047,.81),(pts[1][0]-pts[0][0]-.04,.03,.05),'paint',name,.01)
        beam('mirror stalk',(.66,side*1.055,1.45),(.59,side*1.22,1.50),.07,'rubber')
        box('mirror housing',(.60,side*1.28,1.56),(.24,.18,.20),'paint',bevel=.04)
        box('mirror insert',(.469,side*1.28,1.56),(.016,.13,.135),'metal',bevel=.012)

    # Windshield spans the sloped A-pillars. No underlying roof/body face at this plane.
    mesh('windshield',[(.80,-.855,1.615),(.80,.855,1.615),(.495,.825,1.975),(.495,-.825,1.975)],[(0,1,2,3)],'glass',bevel=0)
    for z,x in [(1.60,.825),(1.98,.495)]:
        beam('windshield seal',(x,-.88,z),(x,.88,z),.043,'rubber')
    for y in (-.46,.42):
        beam('wiper arm',(.862,y-.18,1.631),(.819,y+.17,1.665),.026,'rubber')
        beam('wiper blade',(.823,y-.23,1.672),(.823,y+.24,1.672),.035,'rubber')
    # Rear hatch with a top hinge and inset license recess.
    groups['doorHatch']=empty('doorHatch',(-1.95,0,2.00),root)
    box('hatch lower',(-2.135,0,1.18),(.12,1.75,.55),'paint','doorHatch',.025)
    mesh('rear glass',[(-2.147,-.83,1.50),(-2.147,.83,1.50),(-1.953,.80,1.97),(-1.953,-.80,1.97)],[(0,1,2,3)],'glass','doorHatch',0)
    for y in (-.87,.87):
        beam('rear window border',(-2.16,y,1.47),(-1.95,y,2.01),.055,'rubber','doorHatch')
    beam('rear window lower seal',(-2.165,-.87,1.47),(-2.165,.87,1.47),.05,'rubber','doorHatch')
    box('rear license recess',(-2.204,0,1.23),(.018,.53,.20),'rubber','doorHatch',.012)
    box('blank plate',(-2.22,0,1.23),(.015,.43,.13),'paint','doorHatch',.005)
    box('hatch handle',(-2.22,0,1.40),(.025,.22,.04),'rubber','doorHatch',.008)
    beam('rear wiper',(-2.181,-.33,1.54),(-2.181,.25,1.54),.027,'rubber','doorHatch')
    # Interior seats seen through the glazing.
    for x in (.04,-.92):
        for y in (-.47,.47):
            box('seat cushion',(x,y,1.04),(.43,.42,.12),'rubber',bevel=.05)
            box('seat back',(x-.18,y,1.39),(.12,.42,.52),'rubber',bevel=.05)
            box('headrest',(x-.19,y,1.71),(.13,.25,.18),'rubber',bevel=.045)
    box('dashboard',(.58,0,1.39),(.31,1.66,.17),'rubber',bevel=.04)
    # Steering wheel axis roughly fore/aft.
    torus('steering wheel',(.36,-.48,1.49),.15,.025,'rubber',rotation=(0,math.pi/2,0))

    # Four separate rolling assemblies; all origins at axle centres.
    for axle,x in [('F',1.38),('R',-1.44)]:
        for side,label in [(-1,'L'),(1,'R')]:
            name='wheel'+axle+label
            y=side*1.03
            groups[name]=empty(name,(x,y,.53),root)
            cylinder('tire carcass',(x,y,.53),.493,.34,'rubber',name)
            for face in (-1,1):
                torus('rounded tire shoulder',(x,y+face*.126,.53),.401,.10,'rubber',name)
            for i in range(40):
                a=2*math.pi*i/40
                for band in (-1,0,1):
                    aa=a+(band%2)*.022
                    o=box('tread block',(x+.50*math.sin(aa),y+band*.112,.53+.50*math.cos(aa)),(.080,.101,.055),'rubber',name,.009)
                    o.rotation_euler=(0,aa,band*.08)
            out=y+side*.191
            cylinder('wheel dish',(x,out,.53),.305,.036,'metal',name)
            torus('rim lip',(x,out+side*.023,.53),.29,.025,'metal',name)
            cylinder('dark hub recess',(x,out+side*.029,.53),.233,.013,'rubber',name)
            for i in range(6):
                a=2*math.pi*i/6
                o=box('wheel spoke',(x+.162*math.sin(a),out+side*.045,.53+.162*math.cos(a)),(.07,.032,.19),'metal',name,.014)
                o.rotation_euler=(0,a,0)
                cylinder('lug nut',(x+.095*math.sin(a),out+side*.070,.53+.095*math.cos(a)),.018,.022,'metal',name,12)
            cylinder('hub cap',(x,out+side*.065,.53),.112,.057,'metal',name)

    # Bumpers, radiator slats and a heavy three-rail bull bar.
    for x in (-2.29,2.28):
        box('bumper',(x,0,.81),(.25,2.10,.31),'paint',bevel=.06)
        box('bumper top rubber',(x,0,.985),(.27,2.10,.055),'rubber',bevel=.016)
    box('grille recess',(2.217,0,1.23),(.04,1.38,.42),'rubber',bevel=.02)
    for z in (1.10,1.22,1.34):
        box('grille slat',(2.255,0,z),(.06,1.29,.038),'paint',bevel=.01)
    for y in (-.51,-.26,0,.26,.51):
        box('grille vertical',(2.27,y,1.22),(.03,.024,.29),'rubber',bevel=.006)
    box('brandless centre badge',(2.304,0,1.26),(.035,.23,.10),'metal',bevel=.018)
    for y in (-.53,.53):
        beam('bull bar upright',(2.50,y,.68),(2.54,y,1.39),.105,'rubber',depth=.13)
        beam('bull bar top bend',(2.54,y,1.39),(2.43,y,1.49),.105,'rubber',depth=.13)
    for z in (.74,.97,1.20):
        beam('bull bar cross rail',(2.50,-.56,z),(2.50,.56,z),.075,'paint')
    for side in (-1,1):
        box('front fog recess',(2.418,side*.82,.81),(.028,.21,.105),'rubber',bevel=.012)
        box('fog lens',(2.438,side*.82,.81),(.021,.125,.066),'amber',bevel=.01)
        box('headlight surround',(2.218,side*.82,1.235),(.125,.38,.34),'rubber',bevel=.028)
        box('headlamp bezel',(2.290,side*.82,1.235),(.035,.30,.265),'metal',bevel=.02)
        name='lampHead'+('L' if side==-1 else 'R')
        groups[name]=empty(name,(2.318,side*.82,1.235),root)
        box('headlight lens',(2.319,side*.82,1.235),(.025,.246,.22),'head',name,.025)
        box('corner indicator',(2.18,side*1.005,1.25),(.14,.035,.23),'amber',bevel=.015)
        name='lampBrake'+('L' if side==-1 else 'R')
        groups[name]=empty(name,(-2.234,side*.91,1.34),root)
        box('tail lamp backing',(-2.20,side*.93,1.34),(.10,.22,.34),'rubber')
        box('tail lens',(-2.261,side*.93,1.34),(.035,.165,.28),'brake',name,.018)
        box('rear reflector',(-2.429,side*.78,.79),(.020,.14,.07),'brake',name,.008)
    # Exhaust and underbody details.
    cylinder('exhaust',(-1.98,.67,.55),.07,.29,'metal')
    box('tow hitch',(-2.43,0,.56),(.22,.19,.14),'rubber')

    # Roof rack: orange tubular basket, charcoal mounts, cargo and tied recovery rope.
    for x in (-1.65,-.52,.42):
        for y in (-.72,.72):
            box('rack foot',(x,y,2.15),(.25,.18,.09),'rubber')
            beam('rack riser',(x,y,2.18),(x-.06,y,2.33),.095,'rubber')
        beam('rack crossbar',(x,-.81,2.30),(x,.81,2.30),.075,'rack')
    for y in (-.78,.78):
        beam('lower basket rail',(-1.88,y,2.30),(.52,y,2.30),.075,'rack')
        beam('upper basket rail',(-1.81,y,2.52),(.14,y,2.52),.082,'rack')
        for x in (-1.75,-.84,.10):
            beam('basket upright',(x,y,2.31),(x,y,2.50),.065,'rack')
    for x in (-1.81,.14):
        beam('basket end rail',(x,-.78,2.52),(x,.78,2.52),.08,'rack')
    for x in (-1.7,-1.3,-.9,-.5,-.1,.33):
        beam('rack floor slat',(x,-.73,2.28),(x,.73,2.28),.047,'rubber')
    for y in (-.34,.36):
        box('cargo case',(-1.02,y,2.36),(.78,.56,.18),'paint',bevel=.045)
        for xx in (-1.27,-.77):
            box('case strap',(xx,y,2.462),(.046,.58,.025),'rubber',bevel=.008)
        box('case handle',(-1.02,y-.30,2.38),(.22,.037,.055),'rubber',bevel=.012)
    # Rope loops lie flat on the forward rack floor.
    for radius in (.19,.24,.29):
        torus('recovery rope coil',(.02,.17,2.34),radius,.018,'rope',rotation=(0,0,0))
    beam('rope tail',(.15,.38,2.34),(.43,.42,2.34),.035,'rope')
    for y in (-.67,-.23,.23,.67):
        box('roof lamp base',(.54,y,2.27),(.16,.21,.10),'rubber')
        box('roof lamp housing',(.56,y,2.40),(.18,.32,.27),'rubber',bevel=.035)
        box('roof lamp bezel',(.66,y,2.40),(.033,.265,.22),'metal',bevel=.025)
        name='lampRoof'+str(round((y+.67)/.44))
        groups[name]=empty(name,(.686,y,2.40),root)
        box('roof lamp lens',(.686,y,2.40),(.025,.207,.171),'head',name,.026)

    for o in skipped:
        bpy.data.objects.remove(o, do_unlink=True)

    if DISTANCE:
        export_variant(Path(__file__).parent, DISTANCE, omit=('tread', 'lug', 'rivet', 'bolt', 'seat', 'steering', 'sidewall', 'rim lip'), far_omit=('rounded tire shoulder', 'rack floor slat', 'rack foot', 'wiper', 'handle', 'seam', 'badge', 'text', 'letter', 'logo', 'stripe', 'rib', 'hub', 'rim', 'gasket', 'dashboard', 'headrest', 'axle', 'differential', 'grille bar', 'vent', 'hinge', 'clamp', 'spoke'), flat_parts=('*rim*',), owners={groups[g]: [o for (owner, token), objects in parts.items() if owner == g for o in objects] for g in groups})

    # Merge each static material and each moving assembly/material, keeping joint origins.
    for (group,mat),objects in parts.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        o=bpy.context.object
        o.name=group+'_'+mat
        scene.cursor.location=groups[group].location
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        o.parent=groups[group]
        o.matrix_parent_inverse=groups[group].matrix_world.inverted()

    empty('lightsFront',parent=root)
    empty('lightsBrake',parent=root)
    for n,loc in [('driverSeat',(.02,-.47,1.14)),('exitL',(.03,-1.47,0)),('exitR',(.03,1.47,0))]:
        empty(n,loc,root)
    col=empty('col:body',(0,0,1.27),root)
    col['collider']='cuboid'
    col['shape']='cuboid'
    col['size']=[4.8,2.28,2.54]
    for name in [n for n in groups if n.startswith('lamp')]:
        node=groups[name]
        light=empty('light:'+name,tuple(node.location),node)
        front=not name.startswith('lampBrake')
        light.rotation_euler=Vector((1,0,-.12) if front else (-1,0,0)).to_track_quat('-Z','Y').to_euler()
        light['ss_light']={'type':'spot' if front else 'point','color':'light_led_white' if front else 'light_siren_red',
            'intensity':5 if front else 1,'range':18 if front else 2,'angle':48,'penumbra':.35,
            'pool':True,'beam':'soft' if front else 'none','flare':True,'reflect':True,
            'shadow':'hero' if front else 'none','heroPriority':2,'flicker':'none','animation':None,
            'powerGroup':'self','breakable':True,'emissiveNodes':[name+('_head' if front else '_brake')],'tiers':'all'}


    return list(scene.objects)
asset_objects=build()
meshes=[o for o in asset_objects if o.type=='MESH']
for o in meshes:
    o.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in meshes)
stats={'id':ASSET['id'],'tier':'Hero','triangles':triangles,
       'draw_calls':sum(len(o.data.materials) for o in meshes),
       'materials':sorted(m.name for m in M.values()),
       'nodes_ok':all(scene.objects.get(n) for n in ['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR']),
       'within_budget':triangles<=80000 and len(meshes)<=40}
(HERE/'geometry-stats.json').write_text(json.dumps(stats,indent=2)+'\n')


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset_objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)


if args.glb:
    sys.path.insert(0, str(HERE.parents[1] / 'tools' / 'blender'))
    from sslib.ao import bake_all
    bake_all(meshes, samples=32)
    export(args.glb)
    # Rebuild simpler parts rather than collapsing disconnected bevel geometry.
    lod_stats={}
    for level in (1,2):
        for o in list(scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        asset_objects=build(level)
        lod_meshes=[o for o in asset_objects if o.type=='MESH']
        bake_all(lod_meshes, samples=32)
        export(Path(args.glb).with_name('model.lod'+str(level)+'.glb'))
        for o in lod_meshes:
            o.data.calc_loop_triangles()
        lod_stats[str(level)]=sum(len(o.data.loop_triangles) for o in lod_meshes)
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')
    if args.render:
        for o in list(scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        asset_objects=build()

if args.render:
    # Render-only studio surfaces/lights never enter the GLB.
    ground=material('studio_ground','302f38',.88)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.007))
    bpy.context.object.data.materials.append(ground)
    world=bpy.data.worlds.new('Studio')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.24,.30,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.6
    scene.world=world
    def area(name,loc,power,color,size):
        bpy.ops.object.light_add(type='AREA',location=loc)
        o=bpy.context.object
        o.name=name
        o.data.energy=power
        o.data.color=color
        o.data.shape='DISK'
        o.data.size=size
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(2,-5,8),1500,(1,.77,.56),5)
    area('cool fill',(-3,-1,5),1000,(.59,.66,1),4)
    area('rim',(-2,4,6),1800,(1,.54,.26),3)
    views={'ref':(6.5,-8,5.1),'game':(7,-7,9),'front':(9,0,3.1),'side':(0,-10,3.3),'rear':(-8,5,4.8)}
    bpy.ops.object.camera_add(location=views.get(args.view,views['ref']))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=7.1 if args.view!='game' else 8.4
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True
    scene.render.resolution_x=args.width
    scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=args.render
    bpy.ops.render.render(write_still=True)
    if Path(args.render).name == 'hero.png':
        # The delivery hero pass also renders the companion gameplay view,
        # reusing the built scene and the same shared render slot.
        camera.location=views['game']
        camera.rotation_euler=(Vector((0,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale=8.4
        scene.cycles.samples=24
        scene.render.resolution_x=960
        scene.render.resolution_y=540
        scene.render.filepath=str(Path(args.render).with_name('game.png'))
        bpy.ops.render.render(write_still=True)
print('OK',json.dumps(stats))

# Every full source export refreshes the native distance tiers.
if "--glb" in sys.argv and not DISTANCE:
    build_native_lods(__file__)
