# L10 motorbike decision

The rider takes normal damage from ordinary infected hits without being knocked off. Hard hits from heavies, Alpha or Mega and high-speed impacts into solids may dismount her. A forced dismount leaves the bike close enough to recover with E; after a roadblock opens, the HUD should direct her back to it. The motorbike retains its designed 1.25× L1 bicycle speed, and zombie stats stay identical across levels.

The current implementation uses a loss of displacement as a proxy for a solid impact. It does not establish the identity of the obstruction, so this part of the decision is not yet verified and must be corrected or proven against ordinary infected contact. The roadblock recovery and native route targets also remain open; see README.md.
