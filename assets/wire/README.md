# M3 Wire prop

`wire.glb` is a fictional low-poly game prop. `wire.blend` and `build_wire.py` are its editable source. Blender 4.2 builds it in a separate background process; no live scene was changed.

Units: meter. glTF axes: Y up, +Z forward, X right. Root origin is the midpoint of the taut grip centers. Root: `Wire_asset`. Toggle `Wire_coiled` and `Wire_taut` recursively; show exactly one. glTF has no standard visibility flag, so both are exported and the consumer chooses the initial state.

Anchors (root-local glTF meters, identity orientation):
- `GRIP_L`: (-0.16, 0, 0), taut left grip center.
- `GRIP_R`: (0.16, 0, 0), taut right grip center.
- `ATTACH_R`: (0.16, 0, 0), right hand attachment in both variants.

To parent to a right-hand socket at its origin, translate the asset root by (-0.16, 0, 0), then apply the desired socket orientation. In the coiled state both grips are held near the right hand; left grip center is (0.142, 0, 0). The static `GRIP_L` is intended for the taut two-hand pose. Grip axes run along +Y. Taut grip center spacing: 0.32 m, outer width 0.338 m. Grips: 0.07 m long, 0.018 m diameter. Cable: 0.0036 m diameter. Scaling the visual does not define gameplay collision or attack logic.

Colors use the darkest neutral swatch sampled from the existing locker's shared palette, converted from sRGB to linear. Matte dark graphite with metallic factor 0.18 and roughness 0.86. No external textures are needed.

`taut-{front,back,side}.png` and `coiled-{front,back,side}.png` are orthographic proof images. `model-info.json` lists exported nodes, palette values and mesh/triangle counts. `khronos-validation.json` records official Khronos glTF Validator results. Empty anchor nodes intentionally produce informational NODE_EMPTY messages.

Rebuild (PowerShell):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' -b --python ./build_wire.py
& 'C:/Program Files/nodejs/node.exe' ./validate.cjs
```
