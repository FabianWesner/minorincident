"""L6 living adults: native civilian sculpt recipes, never mesh decimation.

Evaluate the shipped sculpt functions with explicit radial/subdivision recipes.
Keep their joint names/pivots, batch only inside owners, and pose the hierarchy.
"""
import ast
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from . import export, injury, palette, sockets

ROOT = Path(__file__).resolve().parents[3]
BASES = {
    'npc.civilian-man-a.aftermath': 'npc.civilian-man-a',
    'npc.civilian-man-b.aftermath': 'npc.civilian-man-b',
    'npc.civilian-woman-b.aftermath': 'npc.civilian-woman-b',
    'npc.marcus.aftermath': 'npc.civilian-man-a',
    'npc.shelter-survivor.bandaged': 'npc.civilian-man-a',
    'npc.shelter-survivor.lying': 'npc.civilian-man-a',
    'npc.shelter-survivor.sitting': 'npc.civilian-man-a',
}
CUTS = {'npc.civilian-man-a': '# Simplify the applied smooth surfaces',
        'npc.civilian-man-b': '# Join decorative pieces',
        'npc.civilian-woman-b': '# Normalize the reference silhouette'}
# Explicit decoration omissions. Identity-bearing hair masses, eyes, garments,
# shoe soles and continuous limb volumes remain in every tier.
OMIT = (
    ('stitch', 'seam', 'sheen', 'shine', 'groove', 'ridge', 'nostril', 'watch hand'),
    ('finger', 'knuckle', 'tread', 'side stripe', 'eye glint', 'stitch', 'seam', 'sheen', 'shine', 'groove', 'ridge', 'nostril', 'watch', 'eyelet', 'lace', 'piping', 'portrait', 'pictogram', 'footer', 'buckle', 'dial', 'cord_tip', 'cheek'),
    ('finger', 'knuckle', 'tread', 'side stripe', 'eye glint', 'stitch', 'seam', 'sheen', 'shine', 'groove', 'ridge', 'nostril', 'watch', 'eyelet', 'lace', 'piping', 'portrait', 'pictogram', 'footer', 'buckle', 'dial', 'cord', 'cheek', 'inner ear', 'lower lip', 'lower_lip', 'eyelid', 'bag clasp', 'clip ring', 'temple strand', 'bun fold', 'nape', 'bun loose', 'button', 'lace', 'tread', 'eye shine', 'iris', 'moustache'),
)

class Recipe(ast.NodeTransformer):
    def __init__(self, tier): self.tier = tier
    def visit_FunctionDef(self, node):
        # Shape topology is authored by the base loft/leaf/tube functions.
        # Lower their construction density before any mesh exists.
        node = self.generic_visit(node)
        names = {a.arg for a in node.args.args}
        lines = []
        for name in names & {'seg', 'N', 'rings'}:
            if name == 'rings' and node.name != 'ell': continue
            limit = ([10, 7, 5] if name != 'rings' else [6, 4, 3])[self.tier]
            lines.append(f'{name} = min({name}, {limit})')
        if 'sub' in names: lines.append('sub = 0')
        if self.tier == 2 and node.name == 'tube' and {'name','points'} <= names:
            lines.append("if name.startswith('round glasses'): points = points[::3] + [points[-1]]")
        if lines: node.body = ast.parse('\n'.join(lines)).body + node.body
        return node
    def visit_Call(self, node):
        node = self.generic_visit(node)
        if isinstance(node.func, ast.Attribute) and node.func.attr == "modifier_apply":
            node.func = ast.Name(id="apply_authored_modifier", ctx=ast.Load())
        return node
    def visit_Assign(self, node):
        node = self.generic_visit(node)
        for target in node.targets:
            if isinstance(target, ast.Attribute) and target.attr == 'levels': node.value = ast.Constant(0)
            if self.tier == 2 and isinstance(target, ast.Attribute) and target.attr == 'width': node.value = ast.Constant(0)
            if isinstance(target, ast.Attribute) and target.attr in ('segments', 'bevel_resolution', 'resolution_u', 'render_resolution_u'):
                node.value = ast.Constant(1 if target.attr == 'segments' else 0 if target.attr == 'bevel_resolution' else 1)
            if isinstance(target, ast.Name) and target.id in ('seg', 'segments', 'N') and isinstance(node.value, ast.Constant):
                node.value = ast.Constant(min(node.value.value, [10,7,5][self.tier]))
        return node


def native(base, tier):
    source = ROOT / 'assets' / base / 'build.py'
    code = source.read_text().split(CUTS[base])[0]
    tree = ast.fix_missing_locations(Recipe(tier).visit(ast.parse(code)))
    previous = sys.argv
    sys.argv = [str(source), '--']
    try:
        # Same zero-width bevel handling as the L5 survivor aftermath lane.
        def apply_authored_modifier(modifier):
            obj = bpy.context.view_layer.objects.active
            mod = obj.modifiers[modifier]
            if (mod.type == 'BEVEL' and mod.width == 0) or (mod.type == 'SUBSURF' and mod.levels == 0):
                obj.modifiers.remove(mod)
            else: bpy.ops.object.modifier_apply(modifier=modifier)
        ns = {'__file__': str(source), '__name__': '__shelter_recipe__',
              'apply_authored_modifier': apply_authored_modifier}
        exec(compile(tree, str(source), 'exec'), ns)
    finally: sys.argv = previous
    joints = ns['parts' if base == 'npc.civilian-man-b' else 'N']
    for o in joints['root'].children_recursive:
        if o.type == 'MESH': o['shelter_owner'] = o.parent.name
    return joints


def build_adult(directory, output):
    directory = Path(directory)
    asset = directory.name; base = BASES[asset]
    tier = int(sys.argv[sys.argv.index('--distance-tier') + 1]) if '--distance-tier' in sys.argv else None
    if tier not in (None, 1, 2): raise ValueError('distance tier must be 1 or 2')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/assets/models' / (base + '.glb')))
    bpy.context.view_layer.update()
    anchors = {o.name: (o.matrix_world.copy(), dict(o.items())) for o in bpy.context.scene.objects if o.type == 'EMPTY'}
    stats = {}
    for lod in ((tier,) if tier is not None else (0,1,2)):
        joints = native(base, lod); root = joints['root']
        # Native swatches are references only; every exported slot comes from
        # the shared palette rather than the legacy sculpt's custom hex values.
        for material in bpy.data.materials:
            if material.name.startswith('pal_'): material.name = 'source_' + material.name
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        # Use anatomical anchor distance, independent of recipe silhouette density.
        scale = (anchors['head'][0].translation - anchors['hip'][0].translation).length / (joints['head'].matrix_world.translation - joints['hip'].matrix_world.translation).length
        origin = anchors['hip'][0].translation - joints['hip'].matrix_world.translation * scale
        worlds = {o: o.matrix_world.copy() for o in meshes}
        for o in meshes:
            o.data.transform(Matrix.Translation(origin) @ Matrix.Scale(scale, 4) @ worlds[o])
            o.parent = None; o.matrix_world = Matrix.Identity(4)
        parents = {n: o.parent.name if o.parent else None for n,o in joints.items()}
        for o in joints.values(): o.parent = None
        for n,o in joints.items():
            if parents[n]: o.parent = joints[parents[n]]
            o.matrix_world = anchors[n][0]
            for k,v in anchors[n][1].items(): o[k] = v
            bpy.context.view_layer.update()
        # Export an explicit Y-up standing reset for the runtime pose lane.
        # It can restore the same hierarchy before retreat clips are sampled.
        convert = Matrix.Rotation(-math.pi/2, 4, 'X')
        standing = {}
        for name, obj in joints.items():
            world = anchors[name][0]
            local = anchors[parents[name]][0].inverted() @ world if parents[name] else world
            loc, rot, size = (convert @ local @ convert.inverted()).decompose()
            standing[name] = dict(translation=list(loc), rotation=[rot.x,rot.y,rot.z,rot.w], scale=list(size))
        root['ss_standingPose'] = json.dumps(standing, sort_keys=True)
        for o in meshes:
            owner = joints[o['shelter_owner']]
            o.parent = owner; o.matrix_parent_inverse = owner.matrix_world.inverted()
        for o in list(meshes):
            name = o.name.lower()
            if (any(word in name for word in OMIT[lod])
                    or (lod == 2 and any(word in name for word in ('loafer vamp', 'loafer strap', 'bracelet', 'elbow fold', 'waist fold', 'back dart', 'shoulder yoke', 'pressed crease', 'chest pin', 'buckle inset', 'fly', 'hinge', 'cap_patch', 'cap_button', 'patch_sunset', 'patch_mountain', 'snap_hole', 'eye_spark', 'midsole rim', 'padded tongue', 'tongue teal', 'heel tab', 'side flick', 'temple sideburn', 'cargo', 'shoe collar', 'sleeve cuff', 'trouser cuff', 'sneaker side', 'eye glint', 'ear inset', 'ear inner', 'tragus', 'nose light', 'teeth', 'collar stand', 'pocket', 'belt loop', 'sneaker tongue', 'shoe_panel', 'denim_fold', 'drawcord', 'hem', 'hood_inner', 'hood_roll', 'hood_back', 'cord_', 'bag flap facing', 'id ', 'lanyard clip', 'side swept', 'temple curl')))
                    or (lod == 1 and name.startswith(('hood_inner', 'hood_roll', 'temple curl', 'bracelet', 'clip ring')))
                    or (lod == 1 and name.startswith(('bun fold', 'gathered nape')) and int(''.join(c for c in name.split('.')[0] if c.isdigit())) % 2 == 1)
                    or (lod == 1 and name.startswith('layered crown') and int(''.join(c for c in name.split('.')[0] if c.isdigit())) % 2 == 1)
                    or (lod == 2 and name.startswith(('layered crown', 'swept fringe', 'nape_lock', 'fringe', 'right part')) and any(c.isdigit() for c in name) and int(''.join(c for c in name.split('.')[0] if c.isdigit())) > 1)):
                bpy.data.objects.remove(o, do_unlink=True); continue
            token = o.data.materials[0].name.removeprefix('source_pal_')
            choices = ['skinWarm','hairChestnut','uiDark','picketWhite',
                       'schoolBusYellow' if base == 'npc.civilian-man-b' or asset.endswith(('bandaged','sitting')) else 'lavender' if base == 'npc.civilian-woman-b' else 'polo',
                       'navy' if base == 'npc.civilian-woman-b' else 'denimBlue' if base == 'npc.civilian-man-b' else 'khaki',
                       'leather','survivorRed' if base == 'npc.civilian-woman-b' else 'sidewalk']
            if asset == 'npc.marcus.aftermath': choices[4:6] = ['backpackTeal','olive']
            # Fold tonal trims into their main shared-palette regions.
            if token.startswith(('polo','schoolBus','hoodie','lavender')): folded = choices[4]
            elif token.startswith(('khaki','denim','navy')): folded = choices[5]
            elif token.startswith(('skin','mouth','bandage')): folded = 'skinWarm'
            elif token.startswith(('hair','woodWarm','eyeBrown')): folded = 'hairChestnut'
            elif token.startswith(('leather','cap')): folded = 'leather'
            elif token in ('picketWhite',): folded = 'picketWhite'
            else: folded = 'uiDark' if token == 'uiDark' else choices[7]
            two_tone_cap = o.name == 'cap_panels'
            face_materials = [f.material_index for f in o.data.polygons] if two_tone_cap else []
            o.data.materials.clear(); o.data.materials.append(palette.mat(folded))
            if two_tone_cap:
                o.data.materials.append(palette.mat('picketWhite'))
                for face, index in zip(o.data.polygons, face_materials): face.material_index = index
            layer = o.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
            o.data.color_attributes.active_color = layer
            for loop in o.data.loops:
                p = o.matrix_world @ o.data.vertices[loop.vertex_index].co
                # Broad dusty/soot islands feathered with local vertex gradients.
                cloth = folded in choices[4:6]
                patch = math.exp(-((p.z-1.08)/.29)**2 - ((p.y+.10)/.23)**2)
                back = math.exp(-((p.z-.90)/.33)**2 - ((p.y-.13)/.22)**2) * (1 if p.x < 0 else .25)
                factor = 1 - .47 * max(patch,back) if cloth else 1
                layer.data[loop.index].color = (factor, factor*.96 if cloth else factor, factor*.89 if cloth else factor, 1)
        if lod > 0:
            for side in ('L','R'):
                owner=joints['hand'+side]
                # Closed native palm extension replaces individual fingers.
                bpy.ops.mesh.primitive_uv_sphere_add(segments=6 if lod==1 else 5, ring_count=4 if lod==1 else 3)
                mitten=bpy.context.object; mitten.name='restMitten'+side
                mitten.scale=(.046,.047,.083); mitten.data.materials.append(palette.mat('skinWarm'))
                mitten.parent=owner; mitten.location=(.024,0,-.043)
        def wrap(name, owner, center, radius, length):
            bpy.ops.mesh.primitive_cylinder_add(vertices=[10,7,5][lod], radius=radius, depth=length, location=center)
            obj=bpy.context.object; obj.name=name
            obj.data.materials.append(palette.mat('picketWhite'))
            obj.parent=joints[owner]; obj.matrix_parent_inverse=obj.parent.matrix_world.inverted()
            return obj
        def paint(obj, owner, length, strength=1.0):
            # Dirty paper white with a blood stain wedge (injury.py) instead of a clean sweatband cylinder.
            if lod == 0 or (lod == 1 and base != 'npc.civilian-man-b'): injury.add_mid_ring(obj)  # man-b LOD1 sits 11 triangles under its cap
            bpy.context.view_layer.update()
            layer = obj.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
            obj.data.color_attributes.active_color = layer
            c = obj.matrix_world.translation; sign = injury.side_sign(owner, joints['armL'].matrix_world.translation.y, joints['armR'].matrix_world.translation.y)
            for loop in obj.data.loops:
                p = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
                layer.data[loop.index].color = injury.wrap_color(p, c, sign, length, strength)
        # Pale sleeve wrap remains a broad limb-volume cue even at distance.
        arm = joints['foreArmL']; hand = joints['handL']
        center = (arm.matrix_world.translation + hand.matrix_world.translation) / 2
        w = wrap('paleForearmWrap', 'foreArmL', center, .075, .16)
        w.rotation_euler = (hand.matrix_world.translation-arm.matrix_world.translation).to_track_quat('Z','Y').to_euler()
        paint(w, 'foreArmL', .16)
        if asset.endswith(('bandaged','sitting')):
            head = joints['head'].matrix_world.translation
            paint(wrap('broadHeadBandage', 'head', head+Vector((.01,0,.22)), .205, .095), 'headL', .095, .9)
        if asset.endswith('bandaged'):
            shoulder=joints['armL'].matrix_world.translation
            paint(wrap('paleShoulderDressing','armL',shoulder+Vector((0,0,-.065)),.095,.17), 'armL', .17, 1.1)
            joints['armL'].rotation_euler.y = -.35
            joints['foreArmL'].rotation_euler.y = -1.1
            joints['head'].rotation_euler.y = .12
        if asset == 'npc.marcus.aftermath':
            # Bright organizer armband; right-hand weapon socket stays untouched.
            c=(joints['armR'].matrix_world.translation+joints['foreArmR'].matrix_world.translation)/2
            w=wrap('organizerArmband','armR',c,.09,.12)
            w.data.materials[0]=palette.mat('schoolBusYellow')
            # Keep eight tokens by folding shoe accents into dark leather.
            for o in root.children_recursive:
                if o.type=='MESH' and o.data.materials[0].name=='pal_sidewalk': o.data.materials[0]=palette.mat('leather')
        export.merge_by_material(root, set(joints), preserve_vertex_colors=True)
        if asset.endswith('sitting'):
            for side in ('L','R'):
                joints['leg'+side].rotation_euler.y=-2.10
                joints['shin'+side].rotation_euler.y=3.10
                joints['foot'+side].rotation_euler.y=-1.0
                joints['arm'+side].rotation_euler.y=-.42
                joints['foreArm'+side].rotation_euler.y=-.78
            joints['torso'].rotation_euler.y=.12
        if asset.endswith('lying'):
            joints['hip'].rotation_euler.y=-math.pi/2
            joints['armL'].rotation_euler.y=-.25
            joints['foreArmL'].rotation_euler.y=2.7
            joints['head'].rotation_euler.y=.08
            # Cushion is owned by the head, so the rig remains fully movable.
            bpy.ops.mesh.primitive_cube_add(size=1)
            cushion=bpy.context.object; cushion.name='headCushion'; cushion.scale=(.13,.46,.38)
            cushion.data.materials.append(palette.mat('picketWhite'))
            cushion_owner=sockets.empty('restCushion',parent=joints['head'])
            cushion.parent=cushion_owner; cushion.location=(-.17,0,.17)
            root['restOnlyNodes']=['restCushion']
            export.merge_by_material(root,set(joints)|{'restCushion'},preserve_vertex_colors=True)
        bpy.context.view_layer.update()
        meshes=[o for o in root.children_recursive if o.type=='MESH']
        lo=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
        root.location.z-=lo
        bpy.context.view_layer.update()
        points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        high=max(p.x for p in points); low=min(p.x for p in points)
        front=sockets.empty('front',parent=root); front.matrix_world.translation=Vector((high+.01,0,.2))
        root['asset_id']=asset; root['derivedFrom']=base; root['restPose']=asset.rsplit('.',1)[-1]
        root['standingHipHeight']=float(anchors['hip'][0].translation.z)
        for o in meshes:
            if o.parent.name in ('head','handL','handR','foreArmL','foreArmR','armL','armR'):
                for face in o.data.polygons: face.use_smooth = True
        path=directory/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        export.glb(root,path)
        tris=0
        for o in meshes: o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
        stats['lod'+str(lod)]={'triangles':tris,'draws':sum(len(o.data.materials) for o in meshes),'materials':len({m.name for o in meshes for m in o.data.materials}),'bytes':path.stat().st_size,'dimensions':[max(p[k] for p in points)-min(p[k] for p in points) for k in (0,2,1)]}
        if tris>[15000,6000,2000][lod]: raise ValueError(f'{asset} LOD{lod}: {tris} exceeds authored cap')
    (directory/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    supplied=directory/('model'+('.lod'+str(tier) if tier else '')+'.glb')
    if supplied.resolve()!=Path(output).resolve(): shutil.copyfile(supplied,output)
