"""Deterministic texture-free bandage pickup. Run through blender_run.py."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--render');p.add_argument('--glb');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
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
        for j in range(4):
            t=math.radians(angle+j*90/3);outline.append((cx+radius*math.cos(t),cy+radius*math.sin(t)))
    chamfer=min(.003,sz/4);n=len(outline)
    v=[(loc[0]+x*scale,loc[1]+y*scale,loc[2]+z) for z,scale in [(-sz/2,.97),(-sz/2+chamfer,1),(sz/2-chamfer,1),(sz/2,.97)] for x,y in outline]
    f=[tuple(reversed(range(n))),tuple(range(3*n,4*n))]+[(k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i) for k in range(3) for i in range(n)]
    return mesh(name,v,f,m)
def annulus(name,profile,m,center=(0,.17,.36),n=64):
    # Closed cross-section spun about the roll's Y axis.
    v=[(center[0]+r*math.cos(t*2*math.pi/n),center[1]+y,center[2]+r*math.sin(t*2*math.pi/n)) for r,y in profile for t in range(n)]
    f=[(k*n+i,k*n+(i+1)%n,((k+1)%len(profile))*n+(i+1)%n,((k+1)%len(profile))*n+i) for k in range(len(profile)) for i in range(n)]
    return mesh(name,v,f,m)
# Large horizontal roll, visible open end toward -Y; shoulder bevel and middle wrap.
annulus('roll',[(.079,-.255),(.079,.255),(.263,.255),(.278,.242),(.282,.227),(.282,-.227),(.278,-.242),(.263,-.255)],cloth)
annulus('cardboard_core',[(.063,-.26),(.063,.26),(.079,.26),(.084,.251),(.084,-.251),(.079,-.26)],core, n=64)
annulus('core_lip',[(.064,-.265),(.064,-.257),(.086,-.257),(.086,-.265)],edge,n=64)
# Seven concentric winding ridges on each end, actual recessed valleys between.
for side in [-1,1]:
    for i in range(7):
        r=.091+i*.024
        y=side*.256
        winding=annulus('wound_edge',[(r,y-side*.002),(r+.004,y+side*.004),(r+.017,y+side*.004),(r+.021,y-side*.002)],cloth,n=24)
        winding.data.materials.append(groove)
        for face in winding.data.polygons:
            if face.index//24==3:face.material_index=1
annulus('center_wrap',[(.279,-.115),(.288,-.115),(.293,-.106),(.293,.106),(.288,.115),(.279,.115)],pad)
# Perforated panels are thick rounded solids; boolean holes stop at the cloth backing.
def holes(o,points,r=.009):
    for x,y,z in points:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=.026,location=(x,y,z));cut=bpy.context.object
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('perforation','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
    # Boolean cut edges stay sharp at pickup scale.
# Front strip: three folded panels, raised faces, narrow cream fold borders.
for j,y in enumerate([-.48,-.265,-.05]):
    z=.042+j*.036
    for k in range(3):box('cloth_layer',(-.12,y,z-.014+k*.010),(.31,.225,.012),cloth if k!=1 else groove,.025)
    box('cream_border',(-.12,y,z+.024),(.315,.225,.024),edge,.027)
    top=z+.040
    o=box('dressing_face',(-.12,y,top),(.293,.209,.014),cloth if j==1 else pad,.024)
    points=[(-.12+dx,y+dy,top+.008) for dx,dy in [(-.065,-.05),(.065,-.05),(0,0),(-.065,.05),(.065,.05)]]
    holes(o,points)
# Secondary folded strip behind the foreground strip.
for j,x in enumerate([.17,.36]):
    box('folded_gauze',(x,-.03,.083),(.22,.275,.13),cloth,.036)
    box('fold_rim',(x,-.03,.152),(.22,.272,.021),edge,.03)
    o=box('folded_face',(x,-.03,.166),(.198,.251,.015),pad,.026)
    holes(o,[(x+dx,-.03+dy,.175) for dx,dy in [(-.045,-.075),(.045,-.075),(0,0),(-.045,.075),(.045,.075)]])
# Roll perforations: dark recess cups surrounded by bevel rims, 4mm below a raised rim.
for y in [-.18,-.07,.04,.18]:
    for t in [.45,1.0,1.65,2.2]:
        r=.293 if abs(y)<.115 else .283
        direction=Vector((math.cos(t),0,math.sin(t)));pos=Vector((0,.17+y,.36))+direction*(r+.006)
        bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=3,major_radius=.009,minor_radius=.002,location=pos)
        o=bpy.context.object;o.name='perforation_lip';o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();o.data.materials.append(cloth)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.008,depth=.002,location=pos-direction*.002)
        o=bpy.context.object;o.name='perforation_recess';o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();o.data.materials.append(groove)
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
report=dict(id='pick.bandages',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [cloth,edge,pad,groove,core]],nodes_ok=True,within_budget=triangles<=12000 and len(meshes)<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
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
print('OK',json.dumps(report))
