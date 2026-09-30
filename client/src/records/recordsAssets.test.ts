import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/bible-friend/records/manifest.json';
import { recordAssetUrl, recordBackgroundUrl } from './recordsAssets';

const R = '/assets/bible-friend/records/';

describe('records assets', () => {
  it('serves files listed in the manifest as-is', () => {
    const file = `${R}${manifest.assets[0].file}`;
    expect(recordAssetUrl(file)).toBe(file);
  });

  it('maps art that is not in the manifest to a local stand-in', () => {
    const listed = new Set(manifest.assets.map(a => `${R}${a.file}`));
    const missing = `${R}mascot/wave.png`;
    if (listed.has(missing)) return; // original already imported
    expect(recordAssetUrl(missing)).toBe('/assets/figma/conversation/mascot-wave.png');
  });

  it('uses the gradient until a background is imported', () => {
    const bg = `${R}backgrounds/verse.png`;
    const listed = manifest.assets.some(a => `${R}${a.file}` === bg);
    expect(recordBackgroundUrl(bg)).toBe(listed ? bg : null);
  });
});
