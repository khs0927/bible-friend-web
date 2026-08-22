import { describe, expect, it } from 'vitest';
import { isDetailScreen, screenForSection, sectionForScreen } from './recordExperienceState';

describe('record experience screen graph', () => {
  it('maps each record section to its main screen', () => {
    expect(screenForSection('favorites')).toBe('favorites');
    expect(screenForSection('verses')).toBe('verses');
    expect(screenForSection('prayer')).toBe('prayer');
  });

  it('keeps detail screens in the correct section', () => {
    expect(sectionForScreen('favorite-detail')).toBe('favorites');
    expect(sectionForScreen('favorites-manage')).toBe('favorites');
    expect(sectionForScreen('verse-detail')).toBe('verses');
    expect(sectionForScreen('verse-search')).toBe('verses');
    expect(sectionForScreen('prayer-write')).toBe('prayer');
    expect(sectionForScreen('prayer-answers')).toBe('prayer');
  });

  it('distinguishes main and detail screens', () => {
    expect(isDetailScreen('favorites')).toBe(false);
    expect(isDetailScreen('verses')).toBe(false);
    expect(isDetailScreen('prayer')).toBe(false);
    expect(isDetailScreen('verse-search')).toBe(true);
  });
});
