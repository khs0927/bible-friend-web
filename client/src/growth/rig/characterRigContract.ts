export const BIBLE_FRIEND_RIG_DONOR = {
  provider: "KayKit",
  pack: "Character Pack: Adventurers 1.0",
  license: "CC0-1.0",
  source:
    "https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0",
  referenceModel:
    "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/Mage.glb",
} as const;

/**
 * Canonical gameplay animation names used by Bible Friend.
 *
 * The final Bible Friend mesh is NOT the KayKit Mage. KayKit is only the CC0
 * motion/skeleton donor while the visual mesh comes from the approved Bible
 * Friend character sheet through TRELLIS.2 / TripoSG. Keeping a stable
 * semantic contract means the runtime does not care which rigging backend
 * produced the final clip.
 */
export const BIBLE_FRIEND_ANIMATION_CONTRACT = {
  idle: "Idle",
  idleUnarmed: "Unarmed_Idle",
  walk: "Walking_A",
  walkBackwards: "Walking_Backwards",
  run: "Running_A",
  strafeLeft: "Running_Strafe_Left",
  strafeRight: "Running_Strafe_Right",
  interact: "Interact",
  scriptureSit: "Sit_Chair_Idle",
  prayer: "Interact",
  jumpStart: "Jump_Start",
  jumpLoop: "Jump_Idle",
  jumpLand: "Jump_Land",
  hit: "Hit_A",
  shieldBlock: "Blocking",
  shieldHit: "Block_Hit",
  swordAttack: "1H_Melee_Attack_Slice_Horizontal",
  swordAttackAlt: "1H_Melee_Attack_Slice_Diagonal",
} as const;

export type BibleFriendAnimation = keyof typeof BIBLE_FRIEND_ANIMATION_CONTRACT;

export const UNUSED_NEGATIVE_CLIPS = [
  "Death_A",
  "Death_A_Pose",
  "Death_B",
  "Death_B_Pose",
] as const;

export const DONOR_MESHES_TO_HIDE = [
  "Mage_Hat",
  "Mage_Cape",
  "Spellbook",
  "Spellbook_open",
  "1H_Wand",
  "2H_Staff",
] as const;
