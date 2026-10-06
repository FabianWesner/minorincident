"""Deterministic Sunset Grove gym-cafeteria cutaway. Run via blender_run.py."""
import bpy, bmesh, math, sys, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'int.gym-cafeteria', 'category': 'building'}
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key)+1] if key in ARGS else default
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
mesh_cache = {}
static = []
def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name, None); scene.collection.objects.link(o)
    o.location = loc; o.parent = parent
    return o
root = empty('root'); root['assetId'] = ASSET['id']; root['forward'] = '+X'
interior = empty('interior', parent=root)
def finish(o, name, token, bevel=0, parent=None):
    o.name = name; o.data.materials.append(palette.mat({'light_window_warm':'windowGlow','light_fluorescent':'picketWhite'}.get(token,token), token.startswith('light_')))
    if bevel:
        m = o.modifiers.new('Soft edges', 'BEVEL'); m.width = bevel; m.segments = 1 if bevel <= .012 else 2
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
        m = o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); m.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.parent = parent or interior
    if parent is None: static.append(o)
    return o
def cached(name, key, loc, rot, parent):
    if key not in mesh_cache: return None
    o=bpy.data.objects.new(name,mesh_cache[key]); scene.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; o.parent=parent or interior
    if parent is None: static.append(o)
    return o
def box(name, loc, size, token, bevel=.018, parent=None):
    key=('box',tuple(size),token,bevel)
    o=cached(name,key,loc,(0,0,0),parent)
    if o: return o
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object
    o.scale=size; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(o,name,token,min(bevel,min(size)*.2),parent); mesh_cache[key]=o.data
    return o
def cyl(name, loc, radius, depth, token, rot=(0,0,0), vertices=12, parent=None):
    key=('cylinder',radius,round(depth,6),token,vertices)
    o=cached(name,key,loc,rot,parent)
    if o: return o
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o=finish(bpy.context.object,name,token,min(.008,radius*.25,depth*.2) if depth>.025 else 0,parent); mesh_cache[key]=o.data
    return o
def rod(name,a,b,r,token,parent=None):
    d=Vector(b)-Vector(a); o=cyl(name,(Vector(a)+Vector(b))/2,r,d.length,token,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def text(name, words, loc, size, token, face='x', parent=None):
    bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.name=name
    o.data.body=words; o.data.size=size; o.data.align_x='CENTER'; o.data.align_y='CENTER'
    o.data.extrude=.002; o.data.bevel_depth=.0005; o.data.resolution_u=3
    o.rotation_euler=(math.pi/2,0,math.pi/2) if face=='x' else (math.pi/2,0,0)
    bpy.ops.object.convert(target='MESH'); return finish(bpy.context.object,name,token,0,parent)
def pivot(name, loc):
    o=empty(name,loc,interior); o['animatable']=True; return o
def anchor(name,loc,meshes,color='light_fluorescent'):
    o=empty('light:'+name,loc,root)
    o['ss_light']=json.dumps({'type':'area','color':color,'intensity':2.5,'range':5,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'gym-cafeteria','breakable':True,'emissiveNodes':meshes,'tiers':'all'})
# Roofless L-shaped shell; open +X entry and -Y court-side cutaway.
box('foundation',(0,0,.12),(16,14,.24),'asphalt',.06)
box('floor_bed',(0,0,.265),(15.9,13.9,.05),'woodWarm',.01)
for i in range(10):
    for j in range(14,40):
        token='canvasTan' if (i*3+j)%13==0 else ('woodWarm' if (i+j)%4==0 else 'brass')
        box('hardwood_plank',(-7.15+i*1.59,-6.72+j*.345,.318),(1.58,.335,.056),token,.008)
# Tiled foreground for dining and evacuation, hardwood court behind it.
box('tile_grout',(0,-4.39,.307),(15.8,5.1,.045),'asphalt',.008)
for i in range(20):
    for j in range(7):
        box('foreground_tile',(-7.55+i*.795,-6.61+j*.75,.348),(.78,.733,.038),'sidewalk',.007)
for loc,size in [((-7.85,0,2.6),(.3,14,4.6)),((0,6.85,2.6),(16,.3,4.6))]:
    box('wall',loc,size,'canvasTan',.045)
for loc,size in [((-7.674,0,1.08),(.07,13.8,1.5)),((0,6.674,1.08),(15.8,.07,1.5))]:
    box('wall_wainscot',loc,size,'woodWarm',.018)
for z in [.42,1.86,4.93]:
    box('wall_trim',(-7.64,-.215,z),(.14,13.57,.10),'woodWarm',.02)
    box('wall_trim',(0,6.64,z),(16,.14,.10),'woodWarm',.02)
for y in [-6.5,-2.6,1.3]:
    box('wall_pilaster',(-7.57,y,2.65),(.25,.28,4.6),'sidewalk',.025)
for x in [-7.4,-3.4,.6,4.6,7.6]:
    box('wall_pilaster',(x,6.57,2.65),(.28,.25,4.6),'sidewalk',.025)
# Court surface line overlays have bottom faces at least 4 mm above boards.
def line(a,b,width=.055,color='picketWhite',z=.371):
    d=Vector(b)-Vector(a); o=box('court_line',((a[0]+b[0])/2,(a[1]+b[1])/2,z),(d.length,width,.008),color,0)
    o.rotation_euler.z=math.atan2(d.y,d.x)
def arc(cx,cy,r,start=0,end=math.tau,color='picketWhite'):
    n=max(16,int((end-start)*14))
    # Contiguous annulus strip, no overlapping decal ends.
    verts=[]
    for i in range(n+1):
        a=start+(end-start)*i/n
        for rr in [r-.028,r+.028]: verts.append((cx+math.cos(a)*rr,cy+math.sin(a)*rr,.383))
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(n)]
    data=bpy.data.meshes.new('court_arc'); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new('court_arc',data); scene.collection.objects.link(o); finish(o,'court_arc',color)
cy=2.0
for a,b in [((-5.9,cy-3.7),(5.9,cy-3.7)),((-5.9,cy+3.7),(5.9,cy+3.7)),((-5.9,cy-3.7),(-5.9,cy+3.7)),((5.9,cy-3.7),(5.9,cy+3.7)),((0,cy-3.65),(0,cy+3.65))]: line(a,b)
cyl('center_disk',(0,cy,.354),1.07,.009,'survivorRed',vertices=64)
arc(0,cy,1.07)
for s in [-1,1]:
    xx=s*5.88; ft=s*3.18
    # Filled colored keys are genuinely raised above the planks.
    # Reference keeps the key hardwood, with raised white outlines.
    for dy in [-1.28,1.28]: line((xx,cy+dy),(ft,cy+dy),z=.369)
    line((ft,cy-1.25),(ft,cy+1.25),z=.369)
    arc(ft,cy,1.28,-math.pi/2,math.pi/2) if s<0 else arc(ft,cy,1.28,math.pi/2,3*math.pi/2)
    arc(s*5.2,cy,3.02,-math.pi/2,math.pi/2) if s<0 else arc(s*5.2,cy,3.02,math.pi/2,3*math.pi/2)
# Raised red perimeter lanes, below the white border lines.
for yy in [cy-3.89,cy+3.89]: box('red_court_border',(0,yy,.355),(12.55,.30,.008),'survivorRed',0)
for xx in [-6.09,6.09]: box('red_court_border',(xx,cy,.355),(.30,7.48,.008),'survivorRed',0)
# Two freestanding basketball assemblies with support braces and open mesh nets.
for s in [-1,1]:
    hoop_start=len(static)
    x=s*6.68; bx=s*5.72
    box('hoop_ballast',(x,cy,.56),(.64,1.05,.42),'backpackTeal',.06)
    rod('hoop_upright',(x,cy,.65),(x,cy,3.78),.075,'asphalt')
    for dy in [-.36,.36]: rod('hoop_brace',(x,cy+dy,.71),(x,cy,2.7),.04,'asphalt')
    rod('hoop_arm',(x,cy,3.7),(bx,cy,3.7),.055,'asphalt')
    box('backboard',(bx,cy,3.52),(.12,1.78,1.08),'picketWhite',.025)
    front=bx-s*.073
    for yy in [-.82,.82]: box('backboard_border',(front,cy+yy,3.52),(.016,.045,1.0),'survivorRed',.005)
    for zz in [3.04,4.0]: box('backboard_border',(front,cy,zz),(.016,1.66,.045),'survivorRed',.005)
    for yy in [-.33,.33]: box('target_box',(front-s*.004,cy+yy,3.39),(.018,.038,.40),'uiDark',0)
    for zz in [3.19,3.59]: box('target_box',(front-s*.004,cy,zz),(.018,.66,.038),'uiDark',0)
    hx=bx-s*.40
    rod('rim_mount',(front,cy,3.13),(hx,cy,3.13),.027,'survivorRed')
    bpy.ops.mesh.primitive_torus_add(major_radius=.30,minor_radius=.027,major_segments=32,minor_segments=8,location=(hx,cy,3.12))
    finish(bpy.context.object,'basketball_rim','survivorRed')
    for j in range(12):
        a=j*math.tau/12
        for da in [-.18,.18]: rod('net_cord',(hx+.28*math.cos(a),cy+.28*math.sin(a),3.10),(hx+.18*math.cos(a+da),cy+.18*math.sin(a+da),2.63),.007,'picketWhite')
    for z,r in [(2.87,.23),(2.65,.18)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=.007,major_segments=24,minor_segments=4,location=(hx,cy,z)); finish(bpy.context.object,'net_ring','picketWhite')
    # Reference baskets sit against the walls, clear of the main play area.
    for o in static[hoop_start:]:
        x,y,z=o.location
        if s<0: o.location=(x-.52,y-1.65,z)
        else:
            o.location=(6.1-(y-cy),6.1+(x-6.1),z); o.rotation_euler.z+=math.pi/2
# Third compact practice hoop, above the serving area.
rod('practice_upright',(-7.51,-5.5,1.76),(-7.51,-5.5,3.36),.055,'asphalt')
for y in [-5.95,-5.05]: rod('practice_brace',(-7.48,y,3.40),(-6.94,y,2.62),.033,'asphalt')
box('practice_board',(-6.93,-5.5,2.86),(.12,1.47,.91),'picketWhite',.025)
for y in [-6.19,-4.81]: box('practice_border',(-6.854,y,2.86),(.019,.043,.83),'survivorRed',.003)
for z in [2.46,3.26]: box('practice_border',(-6.854,-5.5,z),(.019,1.38,.043),'survivorRed',.003)
for y in [-5.77,-5.23]: box('practice_target',(-6.848,y,2.79),(.018,.035,.33),'survivorRed',0)
for z in [2.63,2.95]: box('practice_target',(-6.848,-5.5,z),(.018,.54,.035),'survivorRed',0)
bpy.ops.mesh.primitive_torus_add(major_radius=.25,minor_radius=.025,major_segments=28,minor_segments=6,location=(-6.54,-5.5,2.54)); finish(bpy.context.object,'practice_rim','survivorRed')
for j in range(12):
    a=j*math.tau/12
    rod('practice_net',(-6.54+.24*math.cos(a),-5.5+.24*math.sin(a),2.51),(-6.54+.14*math.cos(a+.18),-5.5+.14*math.sin(a+.18),2.10),.007,'picketWhite')
# Loose basketballs with raised dark seam bands.
for x,y in [(-3.2,-5.6),(3.9,-4.1)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.18,location=(x,y,.526))
    finish(bpy.context.object,'basketball','woodWarm')
    for rot in [(0,0,0),(math.pi/2,0,0),(0,math.pi/2,0)]:
        bpy.ops.mesh.primitive_torus_add(major_radius=.181,minor_radius=.006,major_segments=32,minor_segments=4,location=(x,y,.526),rotation=rot)
        finish(bpy.context.object,'ball_seam','uiDark')
# School lettering and raised navy cloth banners.
text('school_name','SUNSET GROVE\nMIDDLE SCHOOL',(-7.658,3.12,3.98),.43,'policeBlue')
for y,words in [(-4.3,'FUEL\nSTRONGER\nTOMORROWS')]:
    box('banner',(-7.39,y,3.70),(.08,3.25,1.66),'policeBlue',.025)
    text('banner_message',words,(-7.335,y,3.73),.32,'picketWhite')
for x,words in [(-4.8,'SAFER\nNEIGHBORS\nBRIGHTER\nTOMORROW'),(5.42,'COMMUNITY\nKEEPS US\nGOING')]:
    box('banner',(x,6.33,3.58),(2.95,.08,2.1),'policeBlue',.025)
    text('banner_message',words,(x,6.272,3.64),.30,'picketWhite','y')
    for dx in [-1.38,1.38]:
        for z in [2.59,4.57]: cyl('banner_fastener',(x+dx,6.264,z),.035,.025,'asphalt',(math.pi/2,0,0))
box('scoreboard',(.3,6.48,3.95),(2.5,.14,1.16),'uiDark',.04)
text('score_heading','HOME       GUEST',(.3,6.389,4.31),.18,'picketWhite','y')
text('score_digits','24        18',(.3,6.389,3.94),.36,'redDark','y')
text('score_clock','08:42',(.3,6.389,3.63),.17,'schoolBusYellow','y')
# School paw emblem is embossed above the bleachers.
for y,z,ry,rz in [(3.12,2.77,.32,.26),(2.69,3.12,.12,.16),(2.97,3.30,.12,.16),(3.28,3.30,.12,.16),(3.55,3.12,.12,.16)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(-7.65,y,z))
    o=bpy.context.object; o.scale=(.025,ry,rz); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'school_paw','policeBlue')
# Four-tier retractable bleachers along the left wall.
for row in range(4):
    x=-6.28-row*.34; z=.58+row*.35
    box('bleacher_tread',(x,3.57,z),(.40,4.7,.10),'woodWarm',.022)
    box('bleacher_riser',(x-.15,3.57,z-.14),(.07,4.6,.24),'asphalt',.01)
    for y in [1.34,5.80]: rod('bleacher_support',(x,y,.36),(x,y,z),.036,'asphalt')
for y in [1.28,5.88]:
    rod('bleacher_guard',(-7.4,y,2.07),(-6.07,y,2.07),.025,'asphalt')
    for x in [-7.4,-6.1]: rod('guard_post',(x,y,.58),(x,y,2.07),.025,'asphalt')
rod('bleacher_backrail',(-7.40,1.28,2.07),(-7.40,5.88,2.07),.025,'asphalt')
for y in [1.6,2.5,3.4,4.3,5.2]: rod('backrail_post',(-7.4,y,1.48),(-7.4,y,2.07),.023,'asphalt')
# Stacked folding chairs against the rear wall.
for x in [-5.4,-4.4,-3.4,-2.4]:
    for j in range(6):
        y=6.10-j*.07; z=.70+j*.16
        box('stacked_chair_seat',(x,y,z),(.53,.12,.36),'denim',.025)
        for dx in [-.3,.3]: rod('chair_fold_frame',(x+dx,y-.07,.36),(x+dx,y,1.45+j*.11),.020,'asphalt')
# Wall protective pads beside baskets and exit.
for y in [.25,.85,1.45]: box('wall_padding',(-7.61,y,1.07),(.15,.54,1.41),'policeBlue',.035)
# Build counter in a local coordinate frame then rotate it against -X wall.
serving_start=len(static)
# Cafeteria long serving counter: cabinet seams, warm sneeze guard and meal trays.
box('serving_cabinet',(-3.0,5.97,.88),(6.1,1.04,1.02),'backpackTeal',.035)
box('counter_top',(-3.0,5.93,1.43),(6.28,1.22,.12),'sidewalk',.04)
for x in [-5.4,-4.2,-3,-1.8,-.6]:
    box('cabinet_front',(x,5.428,.91),(1.13,.027,.80),'tealDark',.012)
    rod('cabinet_pull',(x-.14,5.38,1.17),(x+.14,5.38,1.17),.022,'picketWhite')
    box('meal_tray',(x,5.8,1.515),(.85,.52,.05),'asphalt',.018)
    for k in range(3): box('meal_portion',(x-.24+k*.24,5.8,1.566),(.20,.38,.052),['schoolBusYellow','foliage','brick'][k],.015)
for x in [-5.8,-.2]: rod('guard_support',(x,6.1,1.5),(x,6.1,2.28),.032,'asphalt')
box('counter_canopy',(-3,6.1,2.30),(6.1,.75,.12),'schoolBusYellow',.03)
box('cafeteria_sign',(-3,6.04,2.69),(3.6,.13,.55),'brick',.025)
text('cafeteria_label','MEALS',(-3,5.958,2.69),.32,'picketWhite','y')

for o in static[serving_start:]:
    x,y,z=o.location; o.location=(-y-1.11,x-.75,z); o.rotation_euler.z+=math.pi/2
# Folding tables and paired benches: cross braces read as portable furniture.
for x,y in [(-4.8,-3.10),(-1.0,-3.10),(-4.8,-5.56),(-1.0,-5.56)]:
    box('folding_table',(x,y,1.10),(2.75,.83,.13),'sidewalk',.045)
    for dx in [-.95,.95]:
        for dy in [-.28,.28]: rod('table_leg',(x+dx,y+dy,.37),(x+dx*.8,y+dy*.65,1.03),.035,'asphalt')
        rod('table_crossbrace',(x+dx,y-.3,.47),(x+dx,y+.3,.95),.024,'asphalt')
    for dy in [-.75,.75]:
        box('bench_seat',(x,y+dy,.69),(2.75,.29,.11),'woodWarm',.025)
        for dx in [-1,1]:
            rod('bench_leg',(x+dx,y+dy,.37),(x+dx,y+dy,.66),.035,'asphalt')
    for dx in [-.75,0,.75]:
        cyl('paper_cup',(x+dx,y,1.265),.06,.18,'picketWhite')
        cyl('meal_plate',(x+dx,y-.19,1.179),.15,.014,'sidewalk',vertices=20)
# Six portable evacuee cots in rows with canvas, pillows, folded blankets and bags.
for i,(x,y) in enumerate([(2.1,-2.28),(5.3,-2.28),(2.1,-3.62),(5.3,-3.62),(2.1,-4.96),(5.3,-4.96),(2.1,-6.30),(5.3,-6.30)]):
    for dy in [-.43,.43]: rod('cot_rail',(x-1.02,y+dy,.81),(x+1.02,y+dy,.81),.025,'asphalt')
    box('cot_canvas',(x,y,.82),(2,.83,.09),'tealDark',.04)
    box('cot_pillow',(x-.68,y,.933),(.49,.65,.17),'policeBlue',.065)
    color=['denim','trouserViolet','woodWarm'][i%3]
    box('cot_blanket',(x+.59,y,.906),(.45,.76,.075),color,.025)
    for dx in [.52,.61,.70]: box('blanket_fold',(x+dx,y,.956),(.024,.72,.009),'sidewalk',.002)
    for dx in [-.78,.78]:
        rod('cot_cross',(x+dx,y-.40,.37),(x+dx,y+.39,.76),.026,'asphalt')
        rod('cot_cross',(x+dx,y+.40,.37),(x+dx,y-.39,.76),.026,'asphalt')
    box('evacuee_bag',(x+.72,y+.62,.58),(.52,.32,.44),color,.06)
    rod('bag_handle',(x+.6,y+.62,.82),(x+.84,y+.62,.82),.027,'asphalt')
# Relief boxes and a stacked basketball rack at the rear right.
for x in [-1.1,3.8]:
    box('relief_box',(x,6.1,.63),(.55,.48,.54),'policeBlue',.025)
    box('box_lid',(x,6.1,.92),(.60,.53,.08),'denim',.02)
    cyl('box_latch',(x,5.843,.69),.04,.022,'schoolBusYellow',(math.pi/2,0,0))
for z in [.55,1.03,1.51]:
    for yy in [5.77,6.33]: rod('ball_rack_shelf',(4.5,yy,z),(6.5,yy,z),.027,'asphalt')
    for x in [4.72,5.20,5.68,6.16]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.19,location=(x,6.04,z+.20)); finish(bpy.context.object,'rack_ball','woodWarm')
for x in [4.5,6.5]:
    for y in [5.77,6.33]: rod('ball_rack_post',(x,y,.36),(x,y,1.89),.03,'asphalt')
entry_start=len(static)
entry_pivots=[]
# Double entry door panels on the +X edge, with correct independent hinge origins.
box('entry_header',(7.72,5.37,2.83),(.30,2.62,.21),'brick',.03)
for y in [4.02,6.72]: box('entry_jamb',(7.72,y,1.60),(.30,.18,2.47),'brick',.025)
for i,(y,angle) in enumerate([(4.15,-.4),(6.59,.35)]):
    p=pivot('door_entry_'+str(i),(7.72,y,.36)); sign=1 if i==0 else -1
    box('door_panel',(0,sign*.58,1.15),(.09,1.16,2.30),'backpackTeal',.025,p)
    box('door_window',(.057,sign*.58,1.55),(.022,.78,.82),'uiDark',.015,p)
    rod('panic_bar',(.10,sign*.23,1.03),(.10,sign*.95,1.03),.027,'picketWhite',p)
    p.rotation_euler.z=angle; entry_pivots.append(p)
box('exit_plate',(7.91,5.37,3.10),(.09,.92,.32),'grass',.012)
text('exit_label','EXIT',(7.972,5.37,3.10),.23,'picketWhite')

for o in static[entry_start:]+entry_pivots:
    x,y,z=o.location; o.location=(y-3.47,14.2-x,z); o.rotation_euler.z-=math.pi/2
# Wheeled cafeteria tray trolley in the foreground gap.
for z in [.54,1.20]:
    box('tray_cart_shelf',(.65,-6.09,z),(.95,.72,.075),'sidewalk',.023)
for x in [.21,1.09]:
    for y in [-6.40,-5.78]: rod('tray_cart_post',(x,y,.43),(x,y,1.48),.033,'asphalt')
box('tray_cart_canopy',(.65,-6.09,1.51),(1.03,.78,.075),'sidewalk',.025)
for z in [.62,1.28]:
    for j in range(7):
        box('stacked_tray',(.65,-6.09,z+j*.028),(.73,.48,.022),'policeBlue',.005)
for i,(x,y) in enumerate([(.24,-6.38),(1.06,-6.38),(.24,-5.8),(1.06,-5.8)]):
    p=pivot('wheel_tray_'+str(i),(x,y,.436)); cyl('tray_caster',(0,0,0),.082,.055,'uiDark',(0,math.pi/2,0),12,p)
# Warm wall sconces with emissive cores and separate light anchors.
for x in [-6.65,-2.70,3.42]:
    box('sconce_base',(x,6.47,3.06),(.27,.16,.70),'brass',.025)
    box('lamp_diffuser',(x,6.364,3.06),(.16,.06,.48),'light_window_warm',.018)
    anchor('sconce_'+str(x),(x,6.20,3.06),['static_emi_windowGlow'],'light_window_warm')
for y in [-2.45,6.0]:
    box('sconce_base',(-7.48,y,3.04),(.16,.27,.70),'brass',.025)
    box('lamp_diffuser',(-7.374,y,3.04),(.06,.16,.48),'light_window_warm',.018)
    anchor('sconce_left_'+str(y),(-7.2,y,3.04),['static_emi_windowGlow'],'light_window_warm')
for name,loc,size in [('floor',(0,0,.17),(16,14,.34)),('wall_left',(-7.85,0,2.6),(.3,14,4.6)),('wall_back',(0,6.85,2.6),(16,.3,4.6)),('counter',(-7.08,-4.05,.88),(1.04,6.1,1.02))]:
    o=empty('col:'+name,loc,root); o['collider']='cuboid'; o['size']=list(size)
# Tag structural faces before material merging: LODs retain the slab and walls.
for o in static:
    if o.name in ['foundation','floor_bed','tile_grout'] or o.name.startswith(('wall.','wall_wainscot')) or o.name=='wall':
        o.data=o.data.copy()
        layer=o.data.attributes.new(name='lod_keep',type='INT',domain='FACE')
        for value in layer.data: value.value=1
# Make cached instances independent before join/origin operators mutate mesh data.
for o in list(scene.objects):
    if o.type=='MESH': o.data=o.data.copy()
bpy.context.view_layer.update()
# Static geometry is joined by palette; motion groups retain their hinge/wheel origins.
def join(objects,name,parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=name; o.parent=parent
    scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); return o
groups={}
for o in static: groups.setdefault(o.data.materials[0].name,[]).append(o)
for mat,objects in sorted(groups.items()): join(objects,'static_'+mat,interior)
for p in list(interior.children):
    if p.type=='EMPTY' and p.get('animatable'):
        children=[o for o in p.children if o.type=='MESH']
        if children:
            bpy.ops.object.select_all(action='DESELECT')
            for o in children: o.select_set(True)
            bpy.context.view_layer.objects.active=children[0]; bpy.ops.object.join()
            o=bpy.context.object; o.name=p.name+'_mesh'
            scene.cursor.location=p.matrix_world.translation; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
for m in bpy.data.materials:
    bs=m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Roughness'].default_value=.28 if m.name in ['pal_picketWhite','pal_blood','pal_policeBlue'] else .55
meshes=[o for o in scene.objects if o.type=='MESH']
def stats(objects=None):
    tris=0; draws=0
    for o in (meshes if objects is None else objects):
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
        draws+=len({p.material_index for p in o.data.polygons})
    return {'triangles':tris,'draw_calls':draws}
# Keep the Hero export below the building triangle budget.
count=stats()['triangles']
if count>96000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('Hero budget','DECIMATE'); m.ratio=95000/count
        bpy.ops.object.modifier_apply(modifier=m.name)
materials=sorted({m.name for o in meshes for m in o.data.materials})
report={'id':ASSET['id'],'tier':'Hero',**stats(),'materials':materials,'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','interior']),'within_budget':stats()['triangles']<=100000 and stats()['draw_calls']<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Small wall clock, waste bins and condiment details are simplified or omitted.', 'Default preview game camera near=0.01 causes depth artifacts; near=0.5 diagnostic captures are clean on both renderers. Preview files were left unchanged.']}
if arg('--glb'):
    ao.bake_all(meshes,samples=32)
    asset_objects=list(scene.objects)
    def export(path, objects=None):
        bpy.ops.object.select_all(action='DESELECT')
        for o in (asset_objects if objects is None else objects): o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    export(arg('--glb'))
    originals={o:o.data.copy() for o in meshes}
    lod_stats={}
    def retain_faces(data, keep):
        bm=bmesh.new(); bm.from_mesh(data)
        layer=bm.faces.layers.int.get('lod_keep')
        remove=[f for f in bm.faces if bool(f[layer])!=keep]
        bmesh.ops.delete(bm,geom=remove,context='FACES')
        bm.to_mesh(data); bm.free(); data.update()
    for level,ratio in [(1,.12),(2,.03)]:
        for o in meshes:
            o.data=originals[o].copy()
            shell=None
            if o.data.attributes.get('lod_keep'):
                shell=o.copy(); shell.data=o.data.copy(); scene.collection.objects.link(shell)
                retain_faces(shell.data,True); retain_faces(o.data,False)
            bpy.context.view_layer.objects.active=o
            if o.data.polygons:
                m=o.modifiers.new('LOD reduction','DECIMATE'); m.ratio=ratio; m.use_collapse_triangulate=True
                bpy.ops.object.modifier_apply(modifier=m.name)
            if shell:
                bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); shell.select_set(True)
                bpy.context.view_layer.objects.active=o; bpy.ops.object.join()
            if o.name.startswith('static_'):
                for v in o.data.vertices:
                    v.co.x=max(-8,min(8,v.co.x)); v.co.y=max(-7,min(7,v.co.y)); v.co.z=max(0,min(4.98,v.co.z))
                bm=bmesh.new(); bm.from_mesh(o.data)
                bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_area()<1e-12],context='FACES')
                bm.to_mesh(o.data); bm.free(); o.data.update()
        selected=asset_objects
        temporary=[]
        if level==2:
            # Distant draw-call cap: merge visually similar palette materials.
            remap={'pal_grass':'foliage','pal_canvasTan':'woodWarm','pal_picketWhite':'sidewalk','pal_uiDark':'asphalt','pal_brass':'woodWarm','pal_tealDark':'backpackTeal','pal_policeBlue':'denim','pal_redDark':'survivorRed','pal_trouserViolet':'denim'}
            originals_static=[o for o in meshes if o.name.startswith('static_') and not o.name.startswith('static_emi_')]
            groups={}
            for o in originals_static:
                clone=o.copy(); clone.data=o.data.copy(); scene.collection.objects.link(clone)
                token=remap.get(clone.data.materials[0].name)
                if token: clone.data.materials[0]=palette.mat(token)
                groups.setdefault(clone.data.materials[0].name,[]).append(clone)
            for mat,objects in groups.items(): temporary.append(join(objects,'lod2_static_'+mat,interior))
            selected=[o for o in asset_objects if o not in originals_static]+temporary
        export(ROOT/f'model.lod{level}.glb',selected)
        lod_stats[str(level)]=stats([o for o in selected if o.type=='MESH'])
        for o in temporary: bpy.data.objects.remove(o,do_unlink=True)
    (ROOT/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2))
    for o in meshes: o.data=originals[o]
    (ROOT/'report.json').write_text(json.dumps(report,indent=2))
print('BUILD OK',json.dumps(report))
if arg('--render'):
    world=bpy.data.worlds.new('Studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.085,.073,.10,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for name,loc,energy,size,color in [('key',(3,-5,15),4200,10,(1,.75,.55)),('fill',(10,1,12),3400,9,(.66,.80,1)),('rim',(-2,8,14),4000,8,(1,.52,.32))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    for anchor_obj in [o for o in scene.objects if o.get('ss_light')]:
        d=bpy.data.lights.new(anchor_obj.name+'_preview','POINT'); d.energy=35; d.color=(1,.48,.12); d.shadow_soft_size=.18
        o=bpy.data.objects.new(d.name,d); scene.collection.objects.link(o); o.location=anchor_obj.matrix_world.translation
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(camera); scene.camera=camera
    view=arg('--view','ref'); loc={'ref':(23,-28,23),'game':(23,-28,32),'front':(18,0,9),'side':(0,-20,10),'rear':(-14,16,12)}[view]
    camera.location=loc; camera.rotation_euler=(Vector((0,0,1.8))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=31.5
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True; scene.cycles.seed=74
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(arg('--render')).resolve()); Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True); print('RENDER OK',arg('--render'))

    if arg('--render-game'):
        camera.location=(23,-28,32); camera.rotation_euler=(Vector((0,0,1.8))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        scene.render.filepath=str(Path(arg('--render-game')).resolve()); bpy.ops.render.render(write_still=True)
        print('RENDER OK',arg('--render-game'))
