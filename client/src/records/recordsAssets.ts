import './records-icon-fixes.css';
import manifest from '../../public/assets/bible-friend/records/manifest.json';

// Records art is served only from client/public so it works offline in the
// Android app and never depends on an external CDN. manifest.json (written by
// scripts/materialize_records_assets.py, which the asset-sync workflow runs)
// lists the files that exist and decode cleanly; anything else maps to the
// closest local image until its original is imported.
const RECORDS_ROOT = '/assets/bible-friend/records/';
const AVAILABLE = new Set(manifest.assets.map(asset => `${RECORDS_ROOT}${asset.file}`));

const LOCAL_ALIASES: Record<string, string> = {
  '/assets/bible-friend/records/hq/02_mascot_wave.png': '/assets/figma/conversation/mascot-wave.png',
  '/assets/bible-friend/records/hq/03_mascot_heart.png': '/assets/bible-friend/records/mascot/praying.png',
  '/assets/bible-friend/records/mascot/wave.png': '/assets/figma/conversation/mascot-wave.png',
  '/assets/bible-friend/records/verse/heart-bible.png': '/assets/bible-friend/records/hq/05_heart.png',
  '/assets/bible-friend/records/verse/prayer-ribbon.png': '/assets/bible-friend/records/prayer/heart-cross.png',
  '/assets/bible-friend/records/prayer/gratitude-flower.png': '/assets/bible-friend/records/hq/05_heart.png',
  // These four were committed with damaged image data and had no intact copy.
  '/assets/bible-friend/records/hq/08_gift.png': '/assets/bible-friend/records/hq/05_heart.png',
  '/assets/bible-friend/records/mascot/heart.png': '/assets/figma/conversation/mascot-wave.png',
  '/assets/bible-friend/records/mascot/reading.png': '/assets/figma/conversation/mascot-teach.png',
  '/assets/bible-friend/records/verse/scripture-lamp.png': '/assets/bible-friend/records/verse/open-bible-glow.png',
  '/assets/bible-friend/records/prayer/calendar.png': '/assets/bible-friend/records/verse/scripture-card.png',
};

/** Shown if an image still fails to load (e.g. a file removed later). */
export const RECORD_FALLBACK_ART = '/assets/bible-friend-mascot.svg';

export function recordAssetUrl(path: string) {
  if (!path.startsWith(RECORDS_ROOT) || AVAILABLE.has(path)) return path;
  return LOCAL_ALIASES[path] ?? path;
}

/** Background illustration if it has been imported; otherwise the CSS gradient. */
export function recordBackgroundUrl(path: string): string | null {
  return AVAILABLE.has(path) ? path : null;
}
