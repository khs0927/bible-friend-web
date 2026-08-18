# Bible Friend CC0 rig strategy

## Decision

Do not author a new humanoid rig or locomotion set from scratch.

- **Visual hero mesh:** approved Bible Friend front/3-quarter/side/back sheet -> Microsoft TRELLIS.2 ZeroGPU first -> TripoSG fallback.
- **Motion donor:** KayKit Character Pack: Adventurers 1.0 (CC0).
- **Extra retargetable motion:** Quaternius Universal Animation Library (CC0) only when KayKit does not contain a needed action.
- **Equipment geometry:** reuse/adapt CC0 shields/swords first; Bible-specific hero versions may later replace them.

## Why KayKit is the first donor

The public Mage GLB was loaded and audited in Chromium:

- 55 scene nodes,
- a real humanoid skeleton (`hips`, `spine`, `chest`, arms, hands, legs, feet and IK helpers),
- 76 embedded animation clips,
- stylised/chibi proportions closer to Bible Friend than the currently accessible Quaternius adult example,
- mobile-optimized and CC0.

Relevant verified clips include:

- `Idle`, `Unarmed_Idle`
- `Walking_A`, `Walking_Backwards`
- `Running_A`, `Running_Strafe_Left`, `Running_Strafe_Right`
- `Interact`
- `Sit_Chair_Idle`
- `Jump_Start`, `Jump_Idle`, `Jump_Land`
- `Hit_A`, `Hit_B`
- `Blocking`, `Block_Hit`
- `1H_Melee_Attack_Slice_Horizontal`, `1H_Melee_Attack_Slice_Diagonal`

Death clips exist but are intentionally excluded from Bible Friend gameplay.

## Quaternius role

Quaternius Universal Base Characters are also CC0 and provide Teen proportions, a humanoid rig, ~13k-triangle game-ready topology and compatibility with the 120+ Universal Animation Library. They remain a strong retargeting/secondary donor option. The currently automated public GLB we were able to inspect was an adult Superhero body, so it is not used as the Bible Friend visual base.

## Completion gate

A final player character is accepted only after:

1. real image-to-3D generation,
2. model loads as valid GLB,
3. front/side/back visual comparison,
4. rig/animation transfer or retarget validation,
5. walking/running/interact/block/attack playback,
6. actual Bible Friend mobile screenshot review.
