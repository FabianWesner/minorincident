"""Sunset Grove police SUV. Metres, +X forward, +Z up; deterministic bpy source.
Run through experiment/tools/blender_run.py. Static meshes merge by material;
wheel/door/lamp meshes merge only within their own joint groups.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bmesh
import bpy
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render')
parser.add_argument('--view', default='ref', choices=['ref','game','front','side','rear'])
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
parser.add_argument('--glb')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao
PI = math.pi
LOD_LEVEL = 0
M = {}
for key, token in [('black','uiDark'),('white','picketWhite'),('metal','silver'),('grey','asphalt'),('glass','denim'),('amber','schoolBusYellow')]:
    M[key] = palette.mat(token)
for key,token in [('head','windowGlow'),('red','sirenRed'),('blue','policeBlue')]:
    M[key] = palette.mat(token, emissive=True)
for key,mat in M.items():
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Roughness'].default_value = .32 if key in ['white','glass'] else .46
    if key == 'metal': bs.inputs['Metallic'].default_value = .75
    if key in ['black','white','glass']: bs.inputs['Coat Weight'].default_value = .35
    if key in ['head','red','blue']: bs.inputs['Emission Strength'].default_value = 1.4
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .68
M['glass'].surface_render_method = 'DITHERED'
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.22
M['glass'].node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=.12
GROUPS = {}

def group(name, pos=(0,0,0), parent=None):
    o = bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location = pos
    bpy.context.view_layer.update()
    if parent:
        o.parent = GROUPS[parent]; o.matrix_parent_inverse = o.parent.matrix_world.inverted()
    GROUPS[name]=o
    return o

def finish(o,mat,parent='body',bevel=0, smooth=True):
    if o.name not in scene.objects: scene.collection.objects.link(o)
    o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1 if bevel<.009 or LOD_LEVEL else 3
    for p in o.data.polygons: p.use_smooth=smooth
    if smooth:
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    o.parent=GROUPS[parent]; o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    return o

def mesh(name,verts,faces,mat,parent='body',bevel=0,smooth=True):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    bm=bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm,edges=bm.edges,dist=1e-7)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
    return finish(bpy.data.objects.new(name,me),mat,parent,bevel,smooth)

def box(name,c,size,mat,parent='body',bevel=.02,rot=(0,0,0)):
    if LOD_LEVEL==1 and bevel==0: bevel=.018
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1); bmesh.ops.scale(bm,vec=Vector(size),verts=bm.verts)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(name,me); o.location=c; o.rotation_euler=rot
    return finish(o,mat,parent,min(bevel,min(size)*.4))

def prism(name,pts,y0,y1,mat,parent='body',bevel=.015):
    if LOD_LEVEL==1 and bevel==0: bevel=.015
    n=len(pts); verts=[(x,y,z) for y in (y0,y1) for x,z in pts]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,parent,bevel)

def panel(name,pts,s,mat,parent='body',skin=.977,depth=.025,bevel=.01):
    return prism(name,pts,min(s*skin,s*(skin+depth)),max(s*skin,s*(skin+depth)),mat,parent,bevel)

def surf(name,vs,mat,parent='body'):
    o=mesh(name,vs,[tuple(range(len(vs)))],mat,parent,smooth=False)
    mod=o.modifiers.new('panel thickness','SOLIDIFY'); mod.thickness=.012
    return o

def window(name,outer,inner,parent='body',offset=(0,0,0)):
    # A genuine frame opening lets the seats read through the tinted pane.
    n=len(outer)
    o=mesh(name+' gasket',outer+inner,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'black',parent,smooth=False)
    mod=o.modifiers.new('gasket thickness','SOLIDIFY'); mod.thickness=.008
    surf(name,[(x+offset[0],y+offset[1],z+offset[2]) for x,y,z in inner],'glass',parent)

def rod(name,a,b,r,mat,parent='body',segments=16):
    if LOD_LEVEL==1: segments*=3
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return finish(o,mat,parent,.005)

def lathe(name,profile,c,axis,mat,parent='body',segments=48):
    if LOD_LEVEL==1: segments*=3
    vs=[]
    rot={'y':Matrix.Rotation(-PI/2,3,'X'),'x':Matrix.Rotation(PI/2,3,'Y'),'z':Matrix.Identity(3)}[axis]
    for r,z in profile:
        for i in range(segments): vs.append(tuple(rot @ Vector((r*math.cos(i*2*PI/segments),r*math.sin(i*2*PI/segments),z))))
    fs=[]
    for j in range(len(profile)-1):
        for i in range(segments): fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    o=mesh(name,vs,fs,mat,parent); o.location=c
    return o

def cylinder(name,c,r,d,axis,mat,parent='body',segments=32):
    return lathe(name,[(0,-d/2),(r,-d/2),(r,d/2),(0,d/2)],c,axis,mat,parent,segments)

def cut(o,cutter):
    mod=o.modifiers.new('wheel opening','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    o.modifiers.move(len(o.modifiers)-1,0)
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def arch_points(x,r,start=0,end=PI,n=32):
    return [(x+r*math.cos(start+(end-start)*i/n),.46+r*math.sin(start+(end-start)*i/n)) for i in range(n+1)]

def text(name,words,c,size,s,parent='body',width=None,font='Impact.ttf',depth=.003,resolution=5):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=words; cu.size=size; cu.align_x='CENTER'; cu.align_y='CENTER'
    cu.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/'+font,check_existing=True)
    cu.extrude=depth; cu.resolution_u=resolution
    o=bpy.data.objects.new(name,cu); scene.collection.objects.link(o); o.location=c
    o.rotation_euler=(PI/2,0,PI if s>0 else 0)
    bpy.context.view_layer.update()
    if width: o.scale.x=width/o.dimensions.x
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,'black',parent,smooth=False)

root=group('veh.police-suv'); root['asset_id']='veh.police-suv'; root['tier']='Hero'; root['forward']='+X'
root['ss_physics']=json.dumps({'class':'heavy','mass':2200,'friction':.8,'restitution':.05,'centerOfMass':[0,.8,0],'pushable':False,'kickable':False,'flammable':True})
group('body',parent=root.name)
# Sculpted lower shell, with real open wheel wells.
sections=[(-2.36,.87,.48,1.31,1.38),(-2.16,.97,.40,1.39,1.46),(-1.65,.99,.40,1.40,1.47),(1.42,.99,.40,1.40,1.49),(2.10,.95,.46,1.25,1.35),(2.35,.87,.52,1.19,1.27)]
vs=[]
for x,w,lo,hi,top in sections: vs.extend([(x,-w*.94,lo),(x,-w,hi),(x,-w*.80,top),(x,w*.80,top),(x,w,hi),(x,w*.94,lo)])
fs=[tuple(reversed(range(6))),tuple(range(len(vs)-6,len(vs)))]
for j in range(len(sections)-1):
    for k in range(6): fs.append((j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k))
shell=mesh('sculpted shell',vs,fs,'black',bevel=.045)
for ax in [-1.51,1.46]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.54,depth=2.5,location=(ax,0,.46),rotation=(PI/2,0,0)); cut(shell,bpy.context.object)
box('chassis',(0,0,.38),(4.1,1.5,.15),'black',bevel=.04)
# Cabin is assembled around glazing openings, leaving a visible interior.
box('white roof',(-.48,0,2.055),(2.02,1.70,.14),'white',bevel=.07)
box('rear roof',(-1.81,0,2.04),(.67,1.70,.14),'black',bevel=.055)
for s,label in [(1,'L'),(-1,'R')]:
    # windshield A pillar, rear D pillar and roof rim
    rod('A pillar'+label,(1.12,s*.93,1.43),(.52,s*.80,2.03),.047,'white')
    rod('D pillar'+label,(-2.24,s*.91,1.42),(-1.97,s*.80,2.03),.058,'black')
    rod('roof edge'+label,(-1.96,s*.81,2.07),(.54,s*.81,2.07),.035,'white')
    # Four hinged doors, with windows attached to the moving assembly.
    for xa,xb,nm in [(-.08,1.05,'door'+label),(-1.12,-.11,'doorRear'+label)]:
        group(nm,(xb,s*.99,1.15),parent='body')
        p=panel(nm+' white skin',[(xa,.60),(xb,.60),(xb,1.42),(xa,1.42)],s,'white',nm,skin=.982,depth=.032,bevel=.023)
        # Rear door corner clears the rear arch rather than covering the tyre.
        axle=-1.51 if xa<-.5 else 1.46
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.545,depth=2.5,location=(axle,0,.46),rotation=(PI/2,0,0)); cut(p,bpy.context.object)
        # Window trapezoids inset in broad dark gasket, 12 mm above each underlying surface.
        if xa>-.5: pts=[(xa+.025,1.455),(xb-.08,1.455),(.50,1.976),(xa+.025,1.976)]
        else: pts=[(xa+.025,1.455),(xb-.025,1.455),(xb-.025,1.976),(xa+.025,1.976)]
        vs=[(x,s*(.974-(z-1.45)*.285),z) for x,z in pts]
        cx=sum(x for x,z in pts)/4; cz=sum(z for x,z in pts)/4
        window(nm+' glass',vs,[(cx+(x-cx)*.925,y,cz+(z-cz)*.90) for x,y,z in vs],nm,offset=(0,s*.014,0))
        rod(nm+' white window edge',(xa+.008,s*.969,1.46),(xa+.008,s*.813,2.01),.028,'white',nm)
        box(nm+' handle',(xa+.19,s*1.034,1.31),(.22,.055,.06),'black',nm,.022)
        box(nm+' sill',((xa+xb)/2,s*1.015,.60),(xb-xa,.045,.065),'black',nm,.014)
    # Rear quarter window and its gasket.
    q=[(-2.17,1.48),(-1.21,1.48),(-1.21,1.969),(-1.965,1.969)]
    window('quarter glass'+label,[(x,s*(.978-(z-1.45)*.285),z) for x,z in q],[(x,s*(.978-(z-1.45)*.285),z) for x,z in [(-2.10,1.51),(-1.26,1.51),(-1.26,1.93),(-1.93,1.93)]],offset=(0,s*.016,0))
    rod('C pillar'+label,(-1.165,s*.97,1.44),(-1.165,s*.817,2.015),.054,'white')
    rod('B pillar'+label,(-.095,s*.986,1.44),(-.095,s*.83,2.015),.028,'black')
    # Whole-word layouts are bisected at the hinge seam so no artificial gap
    # appears, and each raised letter fragment follows its own moving door.
    for words,z,width,size,font in [('POLICE',1.00,2.04,.53,'Impact.ttf'),('SUNSET GROVE',.72,1.72,.17,'DIN Condensed Bold.ttf')]:
        original=text('livery '+words+label,words,(-.035,s*1.029,z),size,s,width=width,font=font)
        bpy.context.view_layer.update()
        world=original.matrix_world.copy()
        for front,nm in [(True,'door'+label),(False,'doorRear'+label)]:
            bm=bmesh.new(); bm.from_mesh(original.data); bmesh.ops.transform(bm,matrix=world,verts=bm.verts)
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(-.095,0,0),plane_no=(1,0,0),clear_inner=front,clear_outer=not front)
            data=bpy.data.meshes.new(words+nm); bm.to_mesh(data); bm.free()
            data.materials.clear()
            finish(bpy.data.objects.new(words+nm,data),'black',nm,smooth=False)
        bpy.data.objects.remove(original,do_unlink=True)
    for ax in [-1.51,1.46]:
        panel('arch flare'+label+str(ax),arch_points(ax,.59)+arch_points(ax,.546,PI,0),s,'black',skin=.995,depth=.075,bevel=.009)
    box('running board'+label,(-.02,s*1.04,.47),(1.85,.18,.10),'black',bevel=.025)
    for x in [-.6,-.3,0,.3,.6]: box('step rib'+label+str(x),(x,s*1.045,.524),(.13,.14,.012),'grey',bevel=.004)
    box('mirror stalk'+label,(.96,s*1.01,1.50),(.13,.21,.09),'black','door'+label,.025)
    box('mirror shell'+label,(.94,s*1.15,1.56),(.27,.20,.19),'black','door'+label,.045)
    box('mirror glass'+label,(.796,s*1.15,1.56),(.012,.157,.135),'metal','door'+label,.012)
    box('fender marker'+label,(1.76,s*.989,1.30),(.105,.015,.046),'amber',bevel=.006)
    panel('fuel hatch'+label,[(-1.98,1.13),(-1.76,1.13),(-1.76,1.34),(-1.98,1.34)],s,'grey',skin=.98,depth=.012,bevel=.024)
# Windshield follows the A pillars. No body surface behind it.
window('windshield',[(1.14,-.887,1.445),(1.14,.887,1.445),(.535,.785,2.024),(.535,-.785,2.024)],[(1.092,-.841,1.491),(1.092,.841,1.491),(.581,.741,1.980),(.581,-.741,1.980)],offset=(.016,0,0))
window('rear glass',[(-2.25,.89,1.44),(-2.25,-.89,1.44),(-1.994,-.787,2.018),(-1.994,.787,2.018)],[(-2.229,.833,1.487),(-2.229,-.833,1.487),(-2.014,-.731,1.972),(-2.014,.731,1.972)],offset=(-.016,0,0))
for y in [-.43,.37]: rod('wiper'+str(y),(1.155,y-.26,1.475),(1.155,y+.27,1.505),.014,'black')
rod('rear wiper',(-2.266,-.38,1.51),(-2.266,.22,1.54),.012,'black')
# Hood contours and purposeful interior.
for s in [-1,1]:
    rod('hood ridge'+str(s),(1.20,s*.47,1.482),(2.12,s*.45,1.344),.013,'grey')
    for x in [.18,-.80]:
        box('seat base'+str(s)+str(x),(x,s*.41,1.27),(.46,.47,.14),'black',bevel=.07)
        box('seat back'+str(s)+str(x),(x-.21,s*.41,1.53),(.16,.45,.43),'black',bevel=.065,rot=(0,-.10,0))
        box('headrest'+str(s)+str(x),(x-.23,s*.41,1.82),(.14,.28,.18),'black',bevel=.04)
box('dashboard',(.89,0,1.47),(.30,1.66,.16),'black',bevel=.05)
lathe('steering wheel',[(.12,-.008),(.145,-.009),(.15,.012),(.12,.013)],(.61,.41,1.61),'x','black',segments=32)
rod('steering spoke',(.62,.27,1.61),(.62,.55,1.61),.014,'black')
# Multi-profile tyres, raised tread shoulders, inset steel-wheel vent wells.
for ax,tag in [(1.46,'F'),(-1.51,'R')]:
    cylinder('axle'+tag,(ax,0,.46),.065,1.85,'y','black')
    for s,label in [(1,'L'),(-1,'R')]:
        nm='wheel'+tag+label; c=(ax,s*.95,.46); group(nm,c,parent='body')
        # Profiles mirror axially on the left/right.
        def wheel_lathe(name,prof,mat): return lathe(name,[(r,s*d) for r,d in prof],c,'y',mat,nm,64)
        wheel_lathe(nm+' tyre',[(.28,-.145),(.37,-.15),(.43,-.115),(.457,-.065),(.46,0),(.457,.065),(.43,.125),(.36,.155),(.28,.145)],'black')
        wheel_lathe(nm+' rim',[(0,.119),(.16,.12),(.24,.10),(.29,.145),(.31,.147),(.314,.13),(.302,.096),(.28,.075),(0,.075)],'grey')
        wheel_lathe(nm+' rim lip',[(.296,.143),(.31,.15),(.319,.14),(.317,.124),(.309,.121)],'metal')
        wheel_lathe(nm+' hub',[(0,.203),(.065,.203),(.093,.182),(.106,.156),(.102,.139)],'metal')
        for i in range(8):
            a=i*2*PI/8
            cylinder(nm+' vent'+str(i),(ax+.219*math.cos(a),s*1.088,.46+.219*math.sin(a)),.039,.012,'y','black',nm,24)
        for i in range(5):
            a=i*2*PI/5
            cylinder(nm+' lug'+str(i),(ax+.126*math.cos(a),s*1.111,.46+.126*math.sin(a)),.016,.025,'y','metal',nm,8)
        for i in range(52):
            a=i*2*PI/52
            for row in [-1,1]:
                box(nm+' tread'+str(i)+str(row),(ax+.451*math.cos(a),s*.95+row*.091,.46+.451*math.sin(a)),(.033,.072,.022),'black',nm,.005,rot=(0,PI/2-a,row*.16))
# Bumper/grille/light assemblies.
for x,n in [(2.32,'front'),(-2.35,'rear')]:
    box(n+' bumper',(x,0,.69),(.24,1.92,.33),'black',bevel=.075)
    box(n+' bumper seam',(x+( .129 if x>0 else -.129),0,.81),(.015,1.76,.042),'grey',bevel=.005)
box('grille surround',(2.335,0,1.12),(.09,1.16,.43),'grey',bevel=.038)
box('grille recess',(2.39,0,1.12),(.035,1.055,.351),'black',bevel=.02)
for z in [.97,1.04,1.11,1.18,1.25]: box('grille slat'+str(z),(2.417,0,z),(.025,1.02,.025),'grey',bevel=.008)
for y in [-.38,-.19,0,.19,.38]: box('grille support'+str(y),(2.402,y,1.11),(.02,.02,.30),'black',bevel=.005)
group('lightsFront',(2.3,0,1.18),parent='body'); group('lightsBrake',(-2.35,0,1.2),parent='body')
for s,label in [(1,'L'),(-1,'R')]:
    group('lampHead'+label,(2.34,s*.727,1.19),parent='lightsFront')
    box('headlight housing'+label,(2.31,s*.731,1.19),(.13,.43,.30),'grey','lampHead'+label,.035)
    box('headlight reflector'+label,(2.388,s*.704,1.19),(.015,.30,.23),'metal','lampHead'+label,.022)
    cylinder('headlight lens'+label,(2.402,s*.700,1.20),.092,.027,'x','head','lampHead'+label)
    box('headlight brow'+label,(2.414,s*.704,1.286),(.015,.28,.020),'head','lampHead'+label,.006)
    box('turn signal'+label,(2.386,s*.902,1.18),(.02,.071,.21),'amber','lampHead'+label,.018)
    cylinder('fog surround'+label,(2.465,s*.74,.687),.085,.022,'x','grey')
    cylinder('fog lens'+label,(2.48,s*.74,.687),.056,.015,'x','metal')
    group('lampBrake'+label,(-2.35,s*.87,1.23),parent='lightsBrake')
    box('brake housing'+label,(-2.34,s*.865,1.25),(.14,.20,.51),'grey','lampBrake'+label,.033)
    box('brake lens'+label,(-2.418,s*.865,1.26),(.045,.145,.43),'red','lampBrake'+label,.025)
    box('reverse lens'+label,(-2.447,s*.865,1.31),(.010,.127,.074),'head','lampBrake'+label,.006)
    # Heavy push bars with rubber pads and visible fasteners.
    box('push upright'+label,(2.64,s*.54,.95),(.16,.13,1.01),'grey',bevel=.06,rot=(0,-.08,0))
    box('push pad'+label,(2.735,s*.54,.99),(.07,.13,.78),'black',bevel=.025)
    for z in [.57,1.32]: cylinder('push bolt'+label+str(z),(2.786,s*.54,z),.018,.015,'x','metal',segments=12)
    box('push bracket'+label,(2.47,s*.54,.60),(.28,.10,.10),'black',bevel=.02)
    # Jointed A-pillar searchlights.
    group('spotlight'+label,(1.07,s*1.02,1.53),parent='body')
    rod('spotlight stem'+label,(1.07,s*1.02,1.53),(1.07,s*1.08,1.70),.027,'black','spotlight'+label)
    lathe('spotlight shell'+label,[(0,-.09),(.085,-.08),(.123,-.02),(.125,.05),(.10,.07)],(1.08,s*1.08,1.77),'x','grey','spotlight'+label,40)
    cylinder('spotlight lens'+label,(1.154,s*1.08,1.77),.095,.012,'x','metal','spotlight'+label)
for z in [.53,.84,1.36]: box('push crossbar'+str(z),(2.64,0,z),(.10,1.12,.075),'black',bevel=.025)
box('tailgate trim',(-2.446,0,1.18),(.03,1.45,.07),'grey',bevel=.02)
box('rear plate backing',(-2.449,0,.96),(.025,.46,.25),'grey',bevel=.02)
box('rear plate',(-2.467,0,.96),(.012,.34,.16),'metal',bevel=.012)
box('front plate',(2.704,0,.69),(.025,.34,.16),'metal',bevel=.01)
for s in [-1,1]:
    box('rear bumper pad'+str(s),(-2.486,s*.64,.61),(.025,.22,.20),'grey',bevel=.02)
    rod('roof rail'+str(s),(-1.89,s*.68,2.16),(-.72,s*.68,2.16),.024,'black')
    for x in [-1.84,-.77]: box('rail foot'+str(s)+str(x),(x,s*.68,2.11),(.14,.08,.10),'grey',bevel=.025)
for x in [-1.65,-.85]: rod('roof cross rack'+str(x),(x,-.67,2.16),(x,.67,2.16),.018,'black')
# Broad light bar: LED grids stand clear of coloured shells.
group('lightbar',(.12,0,2.15),parent='body')
for s in [-1,1]: box('bar foot'+str(s),(.12,s*.57,2.16),(.30,.14,.13),'black','lightbar',.024)
box('bar base',(.12,0,2.235),(.36,1.75,.065),'black','lightbar',.022)
box('bar central speaker',(.12,0,2.34),(.33,.37,.16),'metal','lightbar',.022)
for i in range(5): box('speaker slot'+str(i),(.299,-.12+i*.06,2.34),(.010,.02,.10),'black','lightbar',.004)
for s,label,mat in [(1,'L','red'),(-1,'R','blue')]:
    group('siren'+label,(.12,s*.55,2.34),parent='lightbar')
    box('siren lens'+label,(.12,s*.555,2.34),(.34,.71,.17),mat,'siren'+label,.025)
    for x in [-.06,.30]:
        for y in [s*.37,s*.72]:
            box('LED backing'+label+str(x)+str(y),(x,y,2.34),(.016,.235,.109),'black','siren'+label,.009)
            for j in range(4):
                for k in range(3): box('LED'+label+str(x)+str(y)+str(j)+str(k),(x+(.011 if x>0 else -.011),y-.082+j*.054,2.305+k*.033),(.009,.028,.018),mat,'siren'+label,.003)
box('third brake housing',(-2.058,0,1.999),(.065,.48,.057),'black','lightsBrake',.01)
box('third brake lens',(-2.095,0,1.999),(.012,.40,.028),'red','lightsBrake',.005)
rod('roof aerial',(-1.6,.20,2.12),(-1.66,.20,2.48),.006,'black',segments=8)
# Gameplay sockets and physics volumes.
for nm,pos in [('driverSeat',(.15,.4,1.1)),('exitL',(.2,1.42,.05)),('exitR',(.2,-1.42,.05))]: group(nm,pos,parent=root.name)
col=group('col:body',(0,0,1.13),parent=root.name); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[5.0,2.15,2.2]
for nm,pos,color,node,kind in [('headlightL',(2.4,.70,1.2),'light_led_white','lampHeadL','spot'),('headlightR',(2.4,-.70,1.2),'light_led_white','lampHeadR','spot'),('brakeL',(-2.45,.86,1.2),'light_siren_red','lampBrakeL','point'),('brakeR',(-2.45,-.86,1.2),'light_siren_red','lampBrakeR','point'),('sirenL',(.12,.55,2.34),'light_siren_red','sirenL','beacon'),('sirenR',(.12,-.55,2.34),'light_siren_blue','sirenR','beacon')]:
    o=group('light:'+nm,pos,parent=node)
    o['ss_light']=json.dumps({'type':kind,'color':color,'intensity':5 if kind!='point' else 2,'range':22 if kind=='spot' else 8,'angle':48,'penumbra':.35,'pool':True,'beam':'soft' if kind=='spot' else 'none','flare':True,'reflect':True,'shadow':'hero' if kind=='spot' else 'none','heroPriority':2,'flicker':'none','animation':{'strobe':'police'} if kind=='beacon' else None,'powerGroup':'self','breakable':True,'emissiveNodes':[node],'tiers':'all'})
    if kind=='spot': o.rotation_euler=Vector((1,0,-.10)).to_track_quat('-Z','Y').to_euler()
# Apply modelling modifiers, then join by material within each motion group.
def clean_mesh(o):
    # Text caps and boolean boundaries can contain collinear corner triangles.
    bm=bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny: bmesh.ops.delete(bm,geom=tiny,context='FACES_ONLY')
    bm.to_mesh(o.data); bm.free(); o.data.update()

def finalize(objects=None):
    buckets={}
    dg=bpy.context.evaluated_depsgraph_get()
    evaluated=[(o,bpy.data.meshes.new_from_object(o.evaluated_get(dg))) for o in (objects if objects is not None else scene.objects) if o.type=='MESH']
    for o,data in evaluated:
        o.modifiers.clear(); o.data=data
        par=o.parent.name
        mat=o.data.materials[0]
        o.data.materials.clear(); o.data.materials.append(mat)
        for face in o.data.polygons: face.material_index=0
        # Share wheel metal and spotlight metal; leave their motion groups intact.
        if par.startswith('wheel') and mat==M['grey']:
            o.data.materials[0]=M['black']
        if par.startswith('spotlight') and mat==M['grey']:
            o.data.materials[0]=M['metal']
        if par.startswith('door') and o.name.startswith('mirror glass'):
            o.data.materials[0]=M['glass']
        # Lamp housings and support hardware do not emit or animate.
        if (par.startswith('lampHead') and mat in [M['grey'],M['metal'],M['amber']]) or (par.startswith('lampBrake') and mat==M['grey']):
            mw=o.matrix_world.copy(); o.parent=GROUPS['body']; o.matrix_world=mw; par='body'
        if par.startswith('siren') and mat==M['black']:
            mw=o.matrix_world.copy(); o.parent=GROUPS['lightbar']; o.matrix_world=mw; par='lightbar'
        if par=='body' and o.data.materials[0]==M['grey']:
            o.data.materials[0]=M['metal'] if o.name.startswith('grille') else M['black']
        if par.startswith('lampBrake') and mat==M['head']:
            mw=o.matrix_world.copy(); o.parent=GROUPS['lightsBrake']; o.matrix_world=mw; par='lightsBrake'
        key=(par,o.data.materials[0].name); buckets.setdefault(key,[]).append(o)
    result=[]
    for (par,mat),obs in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        bpy.ops.object.join(); o=bpy.context.object; o.name=par+'__'+mat
        bpy.context.scene.cursor.location=GROUPS[par].matrix_world.translation
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        clean_mesh(o)
        if mat.startswith('emi_'): o['decorativeEmissive']=True
        result.append(o)
    return result
meshes=finalize()
# Centre the complete silhouette and seat the tyre contact on z=0.
bpy.context.view_layer.update()
points=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
offset=Vector((-(min(v.x for v in points)+max(v.x for v in points))/2,-(min(v.y for v in points)+max(v.y for v in points))/2,-min(v.z for v in points)))
for o in root.children: o.location+=offset
bpy.context.view_layer.update()
# Light contracts reference exported emissive mesh names, rather than pivots.
for name,anchor in GROUPS.items():
    if name.startswith('light:'):
        config=json.loads(anchor['ss_light'])
        config['emissiveNodes']=[o.name for o in anchor.parent.children_recursive if o.type=='MESH' and any(m.name.startswith('emi_') for m in o.data.materials)]
        anchor['ss_light']=json.dumps(config)

def distance_model(level):
    """Explicit LOD geometry preserves closed forms and clear markings."""
    global LOD_LEVEL
    LOD_LEVEL=level
    detail=level==1
    before=set(scene.objects)
    for o in meshes: o.name='hero_'+o.name; o.hide_render=True
    body=prism('distant body',[(-2.35,.43),(2.35,.43),(2.35,1.24),(1.14,1.47),(-2.35,1.43)],-.96,.96,'black',bevel=0)
    for ax in [-1.51,1.46]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=32 if detail else 16,radius=.55,depth=2.3,location=(ax,0,.46),rotation=(PI/2,0,0)); cut(body,bpy.context.object)
    box('distant roof',(-.48,0,2.055),(2.02,1.70,.14),'white',bevel=0)
    box('distant rear roof',(-1.81,0,2.04),(.67,1.70,.14),'black',bevel=0)
    for s,label in [(1,'L'),(-1,'R')]:
        rod('distant A'+label,(1.12,s*.93,1.43),(.52,s*.80,2.03),.047,'white',segments=6)
        rod('distant D'+label,(-2.24,s*.91,1.42),(-1.97,s*.80,2.03),.052,'black',segments=6)
        for xa,xb,nm in [(-.08,1.05,'door'+label),(-1.12,-.11,'doorRear'+label)]:
            o=panel('distant white'+nm,[(xa,.60),(xb,.60),(xb,1.42),(xa,1.42)],s,'white',nm,skin=.982,depth=.032,bevel=0)
            ax=-1.51 if xa<-.5 else 1.46
            bpy.ops.mesh.primitive_cylinder_add(vertices=32 if detail else 16,radius=.55,depth=2.3,location=(ax,0,.46),rotation=(PI/2,0,0)); cut(o,bpy.context.object)
            pts=[(xa+.025,1.455),(xb-.08 if xa>-.5 else xb-.025,1.455),(.50 if xa>-.5 else xb-.025,1.976),(xa+.025,1.976)]
            vs=[(x,s*(.974-(z-1.45)*.285),z) for x,z in pts]
            cx=sum(x for x,z in pts)/4; cz=sum(z for x,z in pts)/4
            window('distant window'+nm,vs,[(cx+(x-cx)*.92,y,cz+(z-cz)*.90) for x,y,z in vs],nm,offset=(0,s*.014,0))
            box('distant handle'+nm,(xa+.19,s*1.034,1.31),(.22,.055,.06),'black',nm,0)
        rod('distant C'+label,(-1.165,s*.97,1.44),(-1.165,s*.817,2.015),.048,'white',segments=6)
        q=[(-2.17,1.48),(-1.21,1.48),(-1.21,1.969),(-1.965,1.969)]
        window('distant quarter'+label,[(x,s*(.978-(z-1.45)*.285),z) for x,z in q],[(x,s*(.978-(z-1.45)*.285),z) for x,z in [(-2.10,1.51),(-1.26,1.51),(-1.26,1.93),(-1.93,1.93)]],offset=(0,s*.016,0))
        box('distant mirror'+label,(.94,s*1.15,1.56),(.27,.20,.19),'black','door'+label,0)
        box('distant step'+label,(-.02,s*1.04,.47),(1.85,.18,.10),'black',bevel=0)
        # Flat raised geometry retains the full word at a fraction of hero density.
        original=text('distant POLICE'+label,'POLICE',(-.035,s*1.031,1.00),.53,s,width=2.04,depth=.002 if detail else 0,resolution=3 if detail else 1)
        bpy.context.view_layer.update(); world=original.matrix_world.copy()
        for front,nm in [(True,'door'+label),(False,'doorRear'+label)]:
            bm=bmesh.new(); bm.from_mesh(original.data); bmesh.ops.transform(bm,matrix=world,verts=bm.verts)
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(-.095,0,0),plane_no=(1,0,0),clear_inner=front,clear_outer=not front)
            data=bpy.data.meshes.new('distant text'+nm); bm.to_mesh(data); bm.free(); data.materials.clear()
            finish(bpy.data.objects.new(data.name,data),'black',nm,smooth=False)
        bpy.data.objects.remove(original,do_unlink=True)
        for ax,tag in [(1.46,'F'),(-1.51,'R')]:
            nm='wheel'+tag+label; c=(ax,s*.95,.46)
            lathe('distant tyre'+nm,[(r,s*d) for r,d in [(0,-.13),(.39,-.14),(.47,-.08),(.48,0),(.46,.09),(.38,.145),(0,.145)]],c,'y','black',nm,12)
            lathe('distant rim'+nm,[(r,s*d) for r,d in [(.26,.15),(.30,.15),(.30,.13),(.26,.13)]],c,'y','metal',nm,12)
            cylinder('distant hub'+nm,(ax,s*1.12,.46),.10,.055,'y','metal',nm,8)
        cylinder('distant searchlight'+label,(1.08,s*1.08,1.77),.12,.10,'x','metal','spotlight'+label,8)
        box('distant head'+label,(2.395,s*.70,1.20),(.055,.29,.23),'head','lampHead'+label,0)
        box('distant turn'+label,(2.39,s*.90,1.20),(.05,.07,.21),'amber',bevel=0)
        box('distant brake'+label,(-2.42,s*.865,1.26),(.045,.145,.43),'red','lampBrake'+label,0)
        box('distant push upright'+label,(2.64,s*.54,.95),(.16,.13,1.01),'black',bevel=0)
        box('distant siren'+label,(.12,s*.555,2.34),(.34,.71,.17),'red' if s>0 else 'blue','siren'+label,0)
    window('distant windshield',[(1.14,-.887,1.445),(1.14,.887,1.445),(.535,.785,2.024),(.535,-.785,2.024)],[(1.092,-.841,1.491),(1.092,.841,1.491),(.581,.741,1.980),(.581,-.741,1.980)],offset=(.016,0,0))
    window('distant backlight',[(-2.25,.89,1.44),(-2.25,-.89,1.44),(-1.994,-.787,2.018),(-1.994,.787,2.018)],[(-2.229,.833,1.487),(-2.229,-.833,1.487),(-2.014,-.731,1.972),(-2.014,.731,1.972)],offset=(-.016,0,0))
    for x in [2.32,-2.35]: box('distant bumper'+str(x),(x,0,.69),(.24,1.92,.33),'black',bevel=0)
    for z in [.53,.84,1.36]: box('distant push rail'+str(z),(2.64,0,z),(.10,1.12,.075),'black',bevel=0)
    for z in [.99,1.10,1.21]: box('distant grille'+str(z),(2.40,0,z),(.03,1.05,.025),'metal',bevel=0)
    box('distant bar',(.12,0,2.235),(.36,1.75,.065),'black','lightbar',0)
    box('distant speaker',(.12,0,2.34),(.33,.37,.16),'metal','lightbar',0)
    box('distant dash',(.89,0,1.47),(.30,1.66,.16),'black',bevel=0)
    for y in [-.41,.41]: box('distant seat'+str(y),(-.04,y,1.56),(.20,.45,.57),'black',bevel=0)
    raw=[o for o in scene.objects if o not in before and o.type=='MESH']
    for o in raw: o.location+=offset
    low=finalize(raw)
    for o in low: o.data.calc_loop_triangles()
    ao.bake_all(low,samples=32)
    LOD_LEVEL=0
    return low

def stats():
    return {'triangles':sum(len(o.data.loop_triangles) for o in meshes),'draw_calls':sum(len(o.data.materials) for o in meshes)}
for o in meshes: o.data.calc_loop_triangles()
base_stats=stats()
required=['body','wheelFL','wheelFR','wheelRL','wheelRR','lightsFront','lightsBrake','driverSeat','exitL','exitR','sirenL','sirenR']
report={'id':'veh.police-suv','tier':'Hero',**base_stats,'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in GROUPS for n in required),'within_budget':base_stats['triangles']<=80000 and base_stats['draw_calls']<=40,'rounds':1,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'geometry.json').write_text(json.dumps(report,indent=2)+'\n')
print('BUILD OK',json.dumps(base_stats))
if args.glb:
    # Bake AO on the joined hero meshes, including cabin and wheel occlusion.
    ao.bake_all(meshes,samples=32)
    def export(path,objects=None):
        selected=set(GROUPS.values()) | set(meshes if objects is None else objects)
        for o in scene.objects: o.select_set(o in selected)
        bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_lights=False,export_cameras=False)
    path=Path(args.glb); export(path)
    original={o:o.data.copy() for o in meshes}
    lod_stats={}
    for level in [1,2]:
        low=distance_model(level)
        lod_stats['lod'+str(level)]={'triangles':sum(len(o.data.loop_triangles) for o in low),'draw_calls':len(low)}
        export(path.with_name(path.stem+'.lod'+str(level)+'.glb'),low)
        for o in low: bpy.data.objects.remove(o,do_unlink=True)
        for o in meshes: o.name=o.name.removeprefix('hero_'); o.hide_render=False
    for o in meshes: o.data=original[o]
    (HERE/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2)+'\n')
    print('GLB OK',json.dumps(lod_stats))
if args.render:
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.095,.14,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
    def light(name,loc,energy,size,color):
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(5,4,8),1900,6,(1,.81,.64))
    light('cool fill',(2,-5,5),1250,6,(.65,.77,1))
    light('rim',(-5,2,6),1800,5,(1,.72,.44))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006))
    floor=bpy.context.object; floor.name='studio floor'; fm=bpy.data.materials.new('studio floor'); fm.diffuse_color=(.06,.052,.08,1); fm.use_nodes=True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.06,.052,.08,1); fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85; floor.data.materials.append(fm)
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(camera); scene.camera=camera
    views={'ref':((6.4,8.8,5.1),(0,0,1.15),52),'game':((9,9,12),(0,0,1.0),48),'front':((12,0,4),(0,0,1.1),52),'side':((0,14,3),(0,0,1.1),52),'rear':((-8,10,5),(0,0,1.1),52)}
    loc,tgt,lens=views[args.view]; camera.location=loc; camera.data.lens=lens
    camera.rotation_euler=(Vector(tgt)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True; scene.cycles.seed=17
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(args.render).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)
    # Paired game review in the same Blender slot keeps the shared queue short.
    if args.view=='ref':
        loc,tgt,lens=views['game']; camera.location=loc; camera.data.lens=lens
        camera.rotation_euler=(Vector(tgt)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        filename=Path(args.render).name.replace('-ref.png','-game.png') if '-ref.png' in args.render else 'game.png'
        scene.render.filepath=str(Path(args.render).resolve().with_name(filename))
        bpy.ops.render.render(write_still=True); print('RENDER OK',filename)
