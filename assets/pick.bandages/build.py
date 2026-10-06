"""Deterministic texture-free bandage pickup. Run through blender_run.py."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--lod',type=int,choices=[0,1,2],default=0);p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
segments=[20,12,8][a.lod]
corner_steps=2 if a.lod==0 else 1
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(token,color):
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.78
    return m
# Palette identities retain the warm pink/tan values needed by this reference.
cloth=material('infectedSkin','e6a18e');edge=material('picketWhite','f2cfb4');pad=material('woodWarm','e58c69');groove=material('sidewalk','b87573');core=material('uiDark','714b3d')
def mesh(name,v,f,m):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def box(name,loc,size,m,b=.018):
    # Rounded rectangular outline with a small top/bottom chamfer.
    sx,sy,sz=size;radius=min(b,sx/3,sy/3);outline=[]
    for cx,cy,angle in [(sx/2-radius,sy/2-radius,0),(-sx/2+radius,sy/2-radius,90),(-sx/2+radius,-sy/2+radius,180),(sx/2-radius,-sy/2+radius,270)]:
        for j in range(corner_steps+1):
            t=math.radians(angle+j*90/corner_steps);outline.append((cx+radius*math.cos(t),cy+radius*math.sin(t)))
    chamfer=min(.003,sz/4);n=len(outline)
    v=[(loc[0]+x*scale,loc[1]+y*scale,loc[2]+z) for z,scale in [(-sz/2,1),(sz/2-chamfer,1),(sz/2,.97)] for x,y in outline]
    f=[tuple(reversed(range(n))),tuple(range(2*n,3*n))]+[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(2) for i in range(n)]
    return mesh(name,v,f,m)
def annulus(name,profile,m,center=(0,.17,.36),n=None):
    # Closed cross-section spun about the roll's Y axis.
    n=n or segments
    v=[(center[0]+r*math.cos(t*2*math.pi/n),center[1]+y,center[2]+r*math.sin(t*2*math.pi/n)) for r,y in profile for t in range(n)]
    f=[(k*n+i,k*n+(i+1)%n,((k+1)%len(profile))*n+(i+1)%n,((k+1)%len(profile))*n+i) for k in range(len(profile)) for i in range(n)]
    return mesh(name,v,f,m)
# Large horizontal roll, visible open end toward -Y; shoulder bevel and middle wrap.
annulus('roll',[(.079,-.255),(.079,.255),(.263,.255),(.278,.242),(.282,.227),(.282,-.227),(.278,-.242),(.263,-.255)],cloth)
annulus('cardboard_core',[(.063,-.26),(.063,.26),(.079,.26),(.084,.251),(.084,-.251),(.079,-.26)],core, n=min(segments,16))
annulus('core_lip',[(.064,-.265),(.064,-.257),(.086,-.257),(.086,-.265)],edge,n=segments)
# Two broad winding ridges retain the open-roll cue without fine wound layers.
for side in [-1,1]:
    for r in ([.118,.204] if a.lod==0 else [.17]):
        y=side*.256
        winding=annulus('wound_edge',[(r,y-side*.003),(r+.005,y+side*.004),(r+.016,y+side*.004),(r+.021,y-side*.003)],cloth,n=min(segments,16))
        winding.data.materials.append(groove)
        for face in winding.data.polygons:
            if face.index//min(segments,16)==3:face.material_index=1
annulus('center_wrap',[(.279,-.115),(.288,-.115),(.293,-.106),(.293,.106),(.288,.115),(.279,.115)],pad)
# A few six-sided markings stand 4 mm clear of the cloth, with no coplanar faces.
def mark(name,pos,normal):
    direction=Vector(normal);u=direction.cross(Vector((0,1,0))).normalized()
    if u.length==0:u=Vector((1,0,0))
    v=direction.cross(u);c=Vector(pos)+direction*.004
    mesh(name,[tuple(c+.008*(u*math.cos(i*math.tau/6)+v*math.sin(i*math.tau/6))) for i in range(6)],[tuple(range(6))],groove)
# Three chunky folded panels retain the stepped foreground silhouette.
for j,y in enumerate([-.48,-.265,-.05]):
    z=.042+j*.036
    box('cloth_layer',(-.12,y,z+.005),(.31,.225,.054),cloth,.025)
    box('dressing_face',(-.12,y,z+.040),(.315,.225,.022),edge,.027)
    box('dressing_color',(-.12,y,z+.049),(.293,.209,.014),cloth if j==1 else pad,.024)
    if a.lod==0:
        for dx,dy in [(-.065,-.05),(0,0),(.065,.05)]:mark('perforation',(-.12+dx,y+dy,z+.056),(0,0,1))
# Secondary folded bundle: one body with two broad face panels.
box('folded_gauze',(.265,-.03,.083),(.41,.275,.13),cloth,.036)
for x in [.17,.36]:
    box('folded_face',(x,-.03,.158),(.22,.272,.021),edge,.03)
    box('folded_color',(x,-.03,.172),(.198,.251,.015),pad,.026)
    if a.lod==0:
        for dy in [-.075,0,.075]:mark('perforation',(x,-.03+dy,.1795),(0,0,1))
if a.lod==0:
    for y in [-.07,.04]:
        for t in [.8,1.6]:
            direction=Vector((math.cos(t),0,math.sin(t)))
            mark('roll_perforation',Vector((0,.17+y,.36))+direction*.293,direction)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='pick.bandages'
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
for m in [cloth,edge,pad,groove,core]:
    verts=[];faces=[]
    for o in parts:
        selected=[f for f in o.data.polygons if o.data.materials[f.material_index]==m]
        if not selected:continue
        used=sorted({i for f in selected for i in f.vertices});offset=len(verts)
        mapping={i:offset+j for j,i in enumerate(used)}
        verts.extend(tuple(o.matrix_world@o.data.vertices[i].co) for i in used)
        faces.extend(tuple(mapping[i] for i in f.vertices) for f in selected)
    o=mesh('body' if m==cloth else 'static_'+m.name,verts,faces,m);o.parent=root
for o in parts:bpy.data.objects.remove(o,do_unlink=True)
# Place the lowest cloth edge on ground and center the complete footprint.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
coords=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];low=min(v.z for v in coords)
mid=Vector(((min(v.x for v in coords)+max(v.x for v in coords))/2,(min(v.y for v in coords)+max(v.y for v in coords))/2,low))
for o in meshes:o.location-=mid
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(.45,0,.15)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='pick.bandages',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [cloth,edge,pad,groove,core]],nodes_ok=True,within_budget=triangles<=2500 and len(meshes)<=6)
(HERE/('geometry.json' if a.lod==0 else f'geometry.lod{a.lod}.json')).write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.16,.16,.16)
    stage=material('stage','2a2730');bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));bpy.context.object.data.materials.append(stage)
    target=Vector((0,0,.26))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((1,-2,3),170,2,(1,.8,.65)),((-2,-1,2),100,2,(.7,.77,1)),((1,2,2),220,1.6,(1,.65,.37))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(1.2,-2,1.35),'game':(1.8,-1.8,2.7),'front':(2,0,.6),'side':(0,-2,.6),'rear':(-1.4,2,1.2)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=2.25 if a.view=='game' else 1.98;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if Path(a.render).name=='hero.png':
        scene.camera.location=views['game'];aim(scene.camera);scene.camera.data.ortho_scale=2.25
        scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
        scene.render.filepath=str(HERE/'renders/game.png');bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
