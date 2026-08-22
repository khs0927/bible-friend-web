import './records-icon-fixes.css';

const remoteAssets: Record<string, string> = {
  '/assets/bible-friend/records/hq/01_app_logo.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/f1168ec5-1dc5-4e3e-917a-49ff55c4ea71.png',
  '/assets/bible-friend/records/hq/02_mascot_wave.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/d44e983b-86e6-43f4-ac90-598c0798f42e.png',
  '/assets/bible-friend/records/hq/03_mascot_heart.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/f07cced3-af37-42d2-8871-e823d7d559ba.png',
  '/assets/bible-friend/records/hq/04_settings.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/8c4c133c-9cde-4e7c-8aa5-edd5d904c5f5.png',
  '/assets/bible-friend/records/hq/05_heart.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/60e97b46-3a6a-40c2-b545-ee2228e22af2.png',
  '/assets/bible-friend/records/hq/06_praying_hands.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/c16d1ac9-fbeb-4414-aadd-466733c52b6a.png',
  '/assets/bible-friend/records/hq/07_dove.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/4cfaa18d-b15f-46cb-aa8a-5b20b5359d04.png',
  '/assets/bible-friend/records/hq/08_gift.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/09720e49-2ed2-4877-b5bb-1fd9dff9bf3e.png',
  '/assets/bible-friend/records/backgrounds/favorites.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/486f51f6-d01a-4a2d-b089-e18ea10728d5.png',
  '/assets/bible-friend/records/backgrounds/verse.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/9053dc1c-b8a7-4a06-b9e2-9210f774d8df.png',
  '/assets/bible-friend/records/backgrounds/prayer.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/d9042986-b913-480e-8493-5f692ee9761e.png',
  '/assets/bible-friend/records/backgrounds/prayer-answer.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/38b8fa96-91d9-4050-ab22-0a82861a4bb1.png',
  '/assets/bible-friend/records/mascot/wave.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/344ec30a-b58d-4ab9-9215-9ce1453a8439.png',
  '/assets/bible-friend/records/mascot/heart.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/9e8a3f7b-8b46-45f1-ae62-25e851dfc4dc.png',
  '/assets/bible-friend/records/mascot/praying.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/fb730b24-426f-4634-85fd-ddfa80e2cdaa.png',
  '/assets/bible-friend/records/mascot/reading.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/a17533af-e069-4384-8502-b32fd95bd3c9.png',
  '/assets/bible-friend/records/verse/open-bible-glow.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/c656f08f-d6b7-4cde-8572-477e33145a4d.png',
  '/assets/bible-friend/records/verse/open-bible-star.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/729c35bd-9ed2-4d05-9d99-68d216f3499e.png',
  '/assets/bible-friend/records/verse/scripture-card.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/e7f6523d-ab9b-48d6-ab9a-ca87cb0eee07.png',
  '/assets/bible-friend/records/verse/dove-branch.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/6d4f36e3-0133-4208-8612-4ae251baba10.png',
  '/assets/bible-friend/records/verse/rainbow-cloud.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/fe767ef1-1143-4be4-9806-5a00815b5e90.png',
  '/assets/bible-friend/records/verse/courage-lion.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/9192e9e4-45a6-41e5-a8cd-52eae8573e52.png',
  '/assets/bible-friend/records/verse/scripture-lamp.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/840a2dcd-3e19-4031-8348-182fe4a7d727.png',
  '/assets/bible-friend/records/verse/heart-bible.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/7adcfe61-46ea-46b3-8b86-3dc7c9e6a815.png',
  '/assets/bible-friend/records/verse/prayer-ribbon.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/349d83ca-a5e9-4ec9-88dc-8cf3b9e3e929.png',
  '/assets/bible-friend/records/prayer/family.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/e245dda7-c999-4698-97c8-ccbacd9b9c01.png',
  '/assets/bible-friend/records/prayer/study.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/fc819e2c-74fa-44ef-8e80-a531cc5066c5.png',
  '/assets/bible-friend/records/prayer/friends-teacher.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/67bdf95b-2f79-4ea4-ad65-c9aef38d9f13.png',
  '/assets/bible-friend/records/prayer/candle.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/7aaac5f6-a95c-4c56-b418-f2f041f89799.png',
  '/assets/bible-friend/records/prayer/answered-check.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/e35e744e-21b8-4452-bb89-d5f5dda6534e.png',
  '/assets/bible-friend/records/prayer/gratitude-flower.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/8d488c3e-f773-4b16-8405-e2fda661f19c.png',
  '/assets/bible-friend/records/prayer/calendar.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/74c0dc24-05b3-40a0-b589-4b163d018160.png',
  '/assets/bible-friend/records/prayer/hands-alt.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/2edca0e7-11e6-40f5-aa33-0414ced41889.png',
  '/assets/bible-friend/records/nav/chat.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/2cc4bec8-8aa7-4fce-9f54-80507c07b940.png',
  '/assets/bible-friend/records/nav/story.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/6e667058-c6a3-4d7a-ac49-31bd30762e80.png',
  '/assets/bible-friend/records/nav/growth.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/986a9b48-537f-46d5-b86e-820a2c9ad1b5.png',
  '/assets/bible-friend/records/nav/record.png': 'https://cdn.creativeclaw.co/u/448e94a9/images/29dccce9-fd39-4e01-9c0c-f327adc3c365.png',
};

const localFigmaAssets = new Set([
  '/assets/bible-friend/records/hq/01_app_logo.png',
  '/assets/bible-friend/records/hq/04_settings.png',
  '/assets/bible-friend/records/hq/05_heart.png',
  '/assets/bible-friend/records/hq/06_praying_hands.png',
  '/assets/bible-friend/records/hq/07_dove.png',
  '/assets/bible-friend/records/hq/08_gift.png',
  '/assets/bible-friend/records/nav/chat.png',
  '/assets/bible-friend/records/nav/story.png',
  '/assets/bible-friend/records/nav/growth.png',
  '/assets/bible-friend/records/nav/record.png',
  '/assets/bible-friend/records/mascot/praying.png',
  '/assets/bible-friend/records/mascot/reading.png',
  '/assets/bible-friend/records/mascot/heart.png',
  '/assets/bible-friend/records/verse/open-bible-glow.png',
  '/assets/bible-friend/records/verse/open-bible-star.png',
  '/assets/bible-friend/records/verse/scripture-card.png',
  '/assets/bible-friend/records/verse/dove-branch.png',
  '/assets/bible-friend/records/verse/rainbow-cloud.png',
  '/assets/bible-friend/records/verse/courage-lion.png',
  '/assets/bible-friend/records/verse/scripture-lamp.png',
  '/assets/bible-friend/records/prayer/hands-alt.png',
  '/assets/bible-friend/records/prayer/family.png',
  '/assets/bible-friend/records/prayer/study.png',
  '/assets/bible-friend/records/prayer/friends-teacher.png',
  '/assets/bible-friend/records/prayer/candle.png',
  '/assets/bible-friend/records/prayer/answered-check.png',
  '/assets/bible-friend/records/prayer/heart-cross.png',
]);

const localFigmaAliases: Record<string, string> = {
  '/assets/bible-friend/records/hq/03_mascot_heart.png': '/assets/bible-friend/records/mascot/praying.png',
  '/assets/bible-friend/records/verse/prayer-ribbon.png': '/assets/bible-friend/records/prayer/heart-cross.png',
};

export function recordAssetUrl(path: string) {
  const alias = localFigmaAliases[path];
  if (alias) return alias;
  if (localFigmaAssets.has(path)) return path;
  return remoteAssets[path] ?? path;
}

export const recordAssetManifest = remoteAssets;
