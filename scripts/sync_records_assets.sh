#!/usr/bin/env bash
# Download original generated sources for Bible Friend records assets.
set -euo pipefail

root='client/public/assets/bible-friend/records'
mkdir -p "$root/hq" "$root/backgrounds" "$root/verse" "$root/prayer" "$root/mascot" "$root/nav" "$root/_sources"

names=(01_app_logo.png 02_mascot_wave.png 03_mascot_heart.png 04_settings.png 05_heart.png 06_praying_hands.png 07_dove.png 08_gift.png 09_chat.png 10_story.png)
srcs=(
  'https://cdn.creativeclaw.co/u/448e94a9/images/f1168ec5-1dc5-4e3e-917a-49ff55c4ea71.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/d44e983b-86e6-43f4-ac90-598c0798f42e.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/f07cced3-af37-42d2-8871-e823d7d559ba.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/8c4c133c-9cde-4e7c-8aa5-edd5d904c5f5.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/60e97b46-3a6a-40c2-b545-ee2228e22af2.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/c16d1ac9-fbeb-4414-aadd-466733c52b6a.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/4cfaa18d-b15f-46cb-aa8a-5b20b5359d04.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/09720e49-2ed2-4877-b5bb-1fd9dff9bf3e.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/2cc4bec8-8aa7-4fce-9f54-80507c07b940.png'
  'https://cdn.creativeclaw.co/u/448e94a9/images/6e667058-c6a3-4d7a-ac49-31bd30762e80.png'
)
for i in "${!names[@]}"; do curl -fsSL --retry 3 --retry-delay 2 "${srcs[$i]}" -o "$root/hq/${names[$i]}"; done

curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/486f51f6-d01a-4a2d-b089-e18ea10728d5.png' -o "$root/backgrounds/favorites.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/9053dc1c-b8a7-4a06-b9e2-9210f774d8df.png' -o "$root/backgrounds/verse.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/d9042986-b913-480e-8493-5f692ee9761e.png' -o "$root/backgrounds/prayer.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/38b8fa96-91d9-4050-ab22-0a82861a4bb1.png' -o "$root/backgrounds/prayer-answer.png"

curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/0f1b89e5-b3ee-46bb-8b79-22551f6f4e1c.png' -o "$root/_sources/nav-sheet.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/2e114953-1ff0-4f98-bec9-51155438eded.png' -o "$root/_sources/verse-sheet.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/444e296c-cc9f-40c6-b55d-ed2ed7425a86.png' -o "$root/_sources/prayer-sheet.png"
curl -fsSL --retry 3 'https://cdn.creativeclaw.co/u/448e94a9/images/48fd31e9-a49c-4076-90e2-fa6839b55136.png' -o "$root/_sources/mascot-sheet.png"
# _sources is removed by materialize_records_assets.py after the sheets are split.
