# Dale / Sam stock and shelter reuse

Four independently rooted living adults, derived from the shipped survivor-group source: cap/beard man (`survivor01_root`, Dale stock), purple cap woman (`survivor02_root`), glasses man (`survivor03_root`, Sam stock), yellow hoodie/bun woman (`survivor04_root`). Existing joint and socket prefixes are retained. Each figure has a pale forearm wrap and soot on its own clothes, with different caps/hair, faces and outer clothing. No rifles or other held weapons.

The 15k/6k/2k caps apply to the complete four-person stock GLB. Draw budget is 60, one per native animation owner, checked against each shipped base tier. Metres conversion remains 1.24057588 once. LOD2 omits small tailoring, but preserves a crown tuft on Sam to meet the existing adult height contract.

Separately loadable member IDs are `npc.survivor-group.aftermath.dale`, `.sam`, `.cap-woman`, `.bun-woman`. Their scripts extract the shared authored stock GLBs, remove unrelated roots, reset only the member placement/yaw, and strip the source member prefix into the normal fifteen-owner rig. Build the stock first. These are stock compatibility outputs; the named-cast lane can alias matching casts to them instead of commissioning another mesh. District placement, named-cast behavior, follower logic, sound and shelter dressing stay with runtime/level lanes.
