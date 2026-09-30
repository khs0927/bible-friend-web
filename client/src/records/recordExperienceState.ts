export type RecordsScreen =
  | 'recent'
  | 'recent-detail'
  | 'favorites'
  | 'favorite-detail'
  | 'favorites-manage'
  | 'verses'
  | 'verse-detail'
  | 'verse-search'
  | 'prayer'
  | 'prayer-write'
  | 'prayer-answers';

export type RecordsSection = 'recent' | 'favorites' | 'verses' | 'prayer';

const MAIN_SCREENS: RecordsScreen[] = ['recent', 'favorites', 'verses', 'prayer'];

export function sectionForScreen(screen: RecordsScreen): RecordsSection {
  if (screen.startsWith('recent')) return 'recent';
  if (screen.startsWith('verse')) return 'verses';
  if (screen.startsWith('prayer')) return 'prayer';
  return 'favorites';
}

export function screenForSection(section: RecordsSection): RecordsScreen {
  return section;
}

export function isDetailScreen(screen: RecordsScreen) {
  return !MAIN_SCREENS.includes(screen);
}
