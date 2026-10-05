"""Shared environment and character palette, also used by runtime material swaps."""
import json
from pathlib import Path
import bpy

TOKENS = json.loads((Path(__file__).resolve().parents[3] / 'src/assets/palette.json').read_text())


def mat(token, emissive=False):
    color = TOKENS[token]
    name = ('emi_' if emissive else 'pal_') + token
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*linear, 1)
    material.diffuse_color = (*linear, 1)
    if emissive:
        shader.inputs['Emission Color'].default_value = (*linear, 1)
        shader.inputs['Emission Strength'].default_value = 3
    return material
