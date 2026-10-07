"""Wreck transformations of existing CLOSED native sedan forms, not decimation.
The near wreck uses native LOD1 plus buckled hood/scratches; distant wrecks use
the sedan's reviewed native tiers. Preserve all source nodes and socket pivots.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from . import palette, ao


def build_wreck(directory, output):
    directory=Path(directory);asset=directory.name;stats={}
    for lod in (0,1,2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source=directory/('model.lod2.glb' if lod==2 else 'model.lod1.glb')
        bpy.ops.import_scene.gltf(filepath=str(source))
        bpy.context.view_layer.update()
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        low=[min(v[k] for v in points) for k in range(3)];high=[max(v[k] for v in points) for k in range(3)]
        length=high[0]-low[0];nose=high[0];top=high[2]
        for obj in meshes:
            if asset=='veh.police-sedan' and 'pal_asphalt' in [m.name for m in obj.data.materials]:
                # Police glazing shares the asphalt batch: remove only thin window faces,
                # retaining body trim. Native panes sit above 1.10 m in the source script.
                import bmesh
                bm=bmesh.new();bm.from_mesh(obj.data)
                faces=[f for f in bm.faces if obj.data.materials[f.material_index].name=='pal_asphalt' and all((obj.matrix_world@v.co).z>1.10 for v in f.verts)]
                bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free()
                if not obj.data.polygons:
                    bpy.data.objects.remove(obj,do_unlink=True)
                    continue
            # Remove front glass faces by authored spatial region; keep surrounding pillars.
            # Original panes are independent palette batches, so no panel triangulation collapses.
            if 'glass' in obj.name.lower() or any(m and m.name in ('pal_backpackTeal','pal_glassBlue') for m in obj.data.materials):
                # Entire glazing batch becomes empty frame area, including rear panes.
                obj.hide_render=True
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            inv=obj.matrix_world.inverted()
            for v in obj.data.vertices:
                world=obj.matrix_world@v.co
                # Deterministic front impact, bonnet fold and roof sag; continuous displacement.
                t=max(0,min(1,(world.x-(nose-length*.28))/(length*.28)))
                if world.z>.55 and world.z<top*.78:
                    world.x-=length*.045*t
                    world.z+=.15*math.sin(t*math.pi)-.12*t
                if world.z>top*.8:world.z-=.07*max(0,1-abs(world.x)/length*2)
                v.co=inv@world
            obj.data.update()
        root=next(o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent is None)
        root['decay']='wrecked'
        root['ss_physics']=json.dumps({'class':'heavy','mass':1400,'friction':.85,'restitution':.02,'centerOfMass':[0,.6,0],'pushable':False,'kickable':False,'flammable':True,'sounds':'prop.metal-heavy'})
        # Keep a named collider in native coordinates (Blender Z up).
        if not any('collider' in o for o in bpy.context.scene.objects):
            from .colliders import cuboid
            cuboid('wreck',(length,high[1]-low[1],top),(0,0,top/2),root)
        # An explicit closed accordion-fold hood gives the wreck a readable impact silhouette
        # even where the native bonnet has too few vertices for a continuous dent.
        token='policeBlue' if asset.endswith('blue') else 'uiDark' if asset=='veh.police-sedan' else 'survivorRed'
        xs=[nose-length*.29,nose-length*.22,nose-length*.15,nose-length*.08]
        zs=[top*.56,top*.77,top*.58,top*.63]
        width=(high[1]-low[1])*.32
        vs=[(x,y,z-dz) for dz in (0,.045) for x,z in zip(xs,zs) for y in (-width,width)]
        fs=[]
        for i in range(3):
            k=i*2;fs.extend([(k,k+1,k+3,k+2),(k+8,k+10,k+11,k+9),(k,k+2,k+10,k+8),(k+1,k+9,k+11,k+3)])
        fs.extend([(0,8,9,1),(6,7,15,14)])
        data=bpy.data.meshes.new('buckledHood');data.from_pydata(vs,[],fs);data.materials.append(palette.mat(token))
        hood=bpy.data.objects.new('buckledHood',data);bpy.context.collection.objects.link(hood);hood.parent=root
        if lod==0:
            from .primitives import rounded_box
            for i in range(5):
                obj=rounded_box('impactScar'+str(i),(.35,.015,.045),palette.mat('uiDark'),(nose-length*.14-i*.10,low[1]-.012,.72+i*.08),0)
                obj.parent=root;obj.rotation_euler.y=.2
                obj.modifiers.remove(obj.modifiers['bevel'])
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
        ao.bake_all(meshes,16)
        for o in meshes:
            o.data.calc_loop_triangles()
        tris=sum(len(o.data.loop_triangles) for o in meshes)
        path=directory/('model.wrecked'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
        stats['lod'+str(lod)]={'triangles':tris}
    (directory/'wrecked-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    import shutil
    shutil.copyfile(directory/'model.wrecked.glb',output)
