# Bible Friend Growth Game — Master Plan

## Product goal
Turn the existing `growth` tab into a persistent, child-safe spiritual growth game in which the Bible Friend mascot grows through Scripture reading, memorization, prayer, conversation, and acts of love. The game starts at home and gradually opens outdoor exploration, wilderness encounters, healing missions, and equipment progression inspired by biblical imagery.

The separate Bible-character mini-games in the existing `game` tab are explicitly deferred. Phase 1 is the Growth tab only.

## Design pillars
1. **Scripture is nourishment, not currency abuse.** Reading Scripture fills `spiritFood`; memorization can complete a full daily meal; Bible conversation gives smaller nourishment/insight rewards.
2. **No permanent death or shame loop.** If nourishment reaches zero, the friend becomes sleepy/weak and rests. The player can always restore the friend through a small Scripture action. Notifications must be gentle, never guilt-inducing.
3. **Visible transformation.** Growth changes the avatar, home, aura, equipment, animations, exploration access, and title.
4. **Biblical symbolism becomes game systems.** Armor of God, fruit of the Spirit, living water, bread, lamp/light, crown, shepherd imagery, wilderness, prayer, praise, and service are modeled as mechanics without inventing doctrine.
5. **Reward learning and love.** The strongest progression comes from understanding, remembering, speaking, and living out Scripture — not from repetitive tapping.

## Core loop
`Home -> receive daily Scripture meal -> talk/learn -> choose mission -> go outside -> proclaim/serve -> earn Soul Points/Faith XP -> upgrade equipment/home/avatar -> return home -> reflect`

### Daily Scripture meal
- Read a passage: +1 meal portion, +Knowledge XP
- Complete a short comprehension reflection: +Insight
- Memorize/recite the daily verse: fill remaining daily meal +Faith XP
- Bible conversation connected to the passage: small Spirit Food +Insight
- Prayer/reflection: Peace meter recovery

Daily meal has 3 portions: Morning / Midday / Evening. Memorization can fill all remaining portions once per day.

## Vital stats
- `spiritFood` 0..100 — nourishment; decays slowly by day, not minute-by-minute.
- `faithXp` — main long-term level.
- `wisdomXp` — Bible knowledge/understanding.
- `loveXp` — service/healing/helping missions.
- `peace` 0..100 — prayer/rest/peaceful choices.
- `soulPoints` — spendable progression resource earned through missions; cannot be purchased in Phase 1.
- `streakDays` — positive streak indicator with a forgiveness/recovery mechanic.

State when spiritFood is 0: `resting`, never dead. The mascot looks sleepy, combat/exploration difficulty is reduced, and a “말씀 한 입으로 다시 힘내기” recovery action is always available.

## Growth stages
1. `seedling` — 새싹 친구; home only.
2. `disciple` — 자라는 제자; neighborhood opens.
3. `warrior` — 믿음의 용사; wilderness opens.
4. `servant` — 사랑으로 섬기는 제자; healing/service missions expand.
5. `crowned` — 면류관 단계; long-term mastery, not an ending.

A stage is determined from Faith XP + minimum Wisdom/Love requirements, so grinding one resource cannot skip spiritual dimensions.

## Equipment progression
Equipment is modular and independently upgradeable. Each item has `tier 0..5`, visual variants, unlock requirements, and a gameplay passive.

### Armor of God set (Ephesians 6:10–18)
- `belt_truth` — 진리의 허리띠: reveals misleading/false dialogue choices.
- `breastplate_righteousness` — 의의 흉배: reduces damage from accusation/fear encounters.
- `shoes_peace` — 평안의 복음이 준비한 신: movement/exploration range and service mission bonus.
- `shield_faith` — 믿음의 방패: blocks temptation/fear projectiles; visually grows from wood -> bronze/gold/light.
- `helmet_salvation` — 구원의 투구: protects hope meter; upgraded halo/light motifs.
- `sword_spirit` — 성령의 검, 곧 하나님의 말씀: Scripture declaration ability; power comes from learned/memorized verses, never arbitrary attack stats.

### Crown
`crown_life / crown_righteousness` is treated carefully as a symbolic achievement cosmetic. It is not represented as “earning salvation.” Unlock requires long-term learning/service milestones.

## Exploration zones
### 1. Home
Starting hub. Character care, Bible meal, wardrobe, equipment, prayer corner, daily verse, growth tree.

### 2. Neighborhood / Road
Low-risk service missions: encourage a lonely person, share hope, help someone, choose gentle speech. Earn Love XP and Soul Points.

### 3. Wilderness
Unlocked at Warrior stage. Encounters model temptation/fear/doubt using Scripture-choice combat. Enemy presentation must avoid horror for children. Satan/temptation encounters are symbolic story battles, based on biblical passages such as Jesus’ temptation, with Scripture as the response mechanic.

### 4. Village / City
Service/healing-style missions framed as encouragement, prayer, food/help, reconciliation, and proclamation. Do not imply the player performs real supernatural healing; the game depicts story-world restoration/hope.

## Encounter combat model
Combat is a **word/choice timing game**, not violent combat.
- Enemy attacks: fear, lie, discouragement, temptation.
- Shield: timed defend.
- Sword: select or speak the fitting learned Scripture.
- Shoes: dodge/reposition/approach a person in need.
- Helmet: protects hope/focus.
- Victory: enemy darkness dissolves; player earns Faith XP.

Boss examples for later: Wilderness Tempter, Giant of Fear (David motif), Storm of Anxiety (disciples motif). Biblical characters should not be distorted into villains.

## 3D art direction
Source identity comes from `client/public/assets/bible-friend-mascot.svg`:
- rounded chibi silhouette
- oversized head / small body
- orange-to-coral hood
- purple body robe
- warm cream face
- simple dark oval eyes with large white highlights
- rosy cheeks
- star emblem on chest

### Character modeling guide
Target mobile model:
- 5k–15k triangles base mascot
- separate skinned body + modular equipment meshes
- single skeleton retained across all outfits
- 1–2 1K texture atlases or flat/vertex colors where possible
- GLB delivery
- animations: idle, happy, sleepy, eat-word, pray, read, walk, run, shield-block, sword-declare, celebrate, comfort/heal

### Concept sheets to generate before organic modeling
1. Front / side / back turnaround of base mascot.
2. Expression sheet: happy, curious, sleepy, praying, brave, compassionate.
3. Armor of God full set concept.
4. Shield tiers 0–5.
5. Helmet tiers 0–5.
6. Spirit Sword tiers 0–5.
7. Peace Shoes tiers 0–5.
8. Crown progression.
9. Home room layout and upgrade stages.
10. Wilderness environment and encounter style.

All concept art must preserve the mascot’s orange/coral + purple identity and rounded non-threatening proportions.

## Technical architecture
### Client
Extract Growth out of the 100k+ line `Home.tsx` into a feature module:
- `client/src/growth/GrowthGame.tsx`
- `client/src/growth/growthEngine.ts`
- `client/src/growth/catalog.ts`
- `client/src/growth/types.ts`
- `client/src/growth/components/*`

The first playable slice may render the existing 2D mascot while the 3D GLB pipeline is built. The component contract must already support a future `<Character3D />` swap.

### Server persistence
Add one user profile row and an append-only activity ledger.

`user_growth_profiles`
- userId unique
- stage
- spiritFood
- faithXp / wisdomXp / loveXp / peace
- soulPoints
- streakDays
- lastNourishedAt
- equipped JSON
- inventory JSON
- equipmentTiers JSON
- unlockedZones JSON
- updatedAt

`user_growth_events`
- userId
- eventType
- sourceId
- payload JSON/text
- createdAt

Events make Scripture rewards auditable and prevent duplicate reward claims.

### Server API
`growth.profile`
`growth.claimActivity({ type, sourceId, metadata })`
`growth.equip({ slot, itemId })`
`growth.upgradeEquipment({ equipmentId })`
`growth.startMission({ missionId })`
`growth.completeMission({ missionId, result })`

Server is authoritative for XP, meal rewards, inventory, equipment costs, and daily limits.

## Reward policy
Example first-pass values:
- Scripture read: food +30, wisdom +10, faith +5
- Comprehension/reflection: wisdom +10
- Verse memorized: fill today meal to 100, faith +25
- Bible conversation: food +5, wisdom +3, daily capped
- Prayer/reflection: peace +20
- Service mission: love +15, soulPoints +10
- Wilderness victory: faith +20, soulPoints +10

Duplicate `sourceId` activities must not grant repeat rewards.

## Notifications
Gentle examples:
- “성경 친구가 말씀 한 입을 기다리고 있어요 📖🌾”
- “오늘 함께 읽을 짧은 말씀이 준비됐어요.”
- “어제 쉬었어도 괜찮아요. 오늘 한 구절부터 다시 시작해요.”

Never use: “죽는다”, “하나님이 실망한다”, “믿음이 없어진다”, or fear-based punishment copy.

## Orchestration roles
- **A01 Product/Game Director** — core loop, pacing, economy, acceptance criteria.
- **A02 Bible/Theology Guardian** — verse/source mapping, doctrinal wording, symbolism integrity.
- **A03 Child UX & Safety** — anxiety/guilt checks, notification wording, age-appropriate feedback.
- **A04 2D Concept Art Director** — guide-image consistency and turnaround specs.
- **A05 3D Character Modeler** — mascot topology, skeleton, GLB, animations.
- **A06 Equipment Modeler** — shield/helmet/sword/shoes/crown tier assets.
- **A07 World Designer** — home/neighborhood/wilderness scenes.
- **A08 Gameplay Engineer** — state machine, missions, encounters, equipment passives.
- **A09 Backend Engineer** — persistence, idempotent rewards, progression APIs.
- **A10 QA/Balance** — tests, exploit resistance, mobile performance, progression tuning.

No agent may merge theology-sensitive content without A02 review or child-facing punishment mechanics without A03 review.

## Phase plan
### Phase 1 — Growth vertical slice (current objective)
- extract Growth module
- persistent profile
- daily meal system
- stages and meters
- equipment catalog and tier upgrades
- home hub
- neighborhood + wilderness locked cards
- first service mission
- first Scripture-choice wilderness encounter
- placeholder character visual using current mascot
- tests for reward idempotency and growth engine

### Phase 2 — 3D mascot
- concept sheets
- organic 3D model
- rig + animations
- mobile GLB viewer
- equipment attachment slots
- first shield/helmet/sword/shoes tier meshes

### Phase 3 — exploration polish
- home 3D scene
- neighborhood
- wilderness
- encounter presentation
- mission content expansion

### Phase 4 — Bible-character mini-games
Deferred until Growth is stable.

## Definition of “Growth v1 complete”
A signed-in child can open Growth, see a persistent Bible Friend, read/claim a Scripture meal, see nourishment and XP change, equip/upgrade at least the starter Armor-of-God pieces, enter one service mission and one wilderness Scripture encounter, return home with persisted rewards, and continue on another session/device. The experience remains recoverable and encouraging even after missed days.