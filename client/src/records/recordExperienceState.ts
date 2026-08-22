export type RecordsScreen =
  | 'favorites'
  | 'favorite-detail'
  | 'favorites-manage'
  | 'verses'
  | 'verse-detail'
  | 'verse-search'
  | 'prayer'
  | 'prayer-write'
  | 'prayer-answers';

export type RecordsSection = 'favorites' | 'verses' | 'prayer';

export function sectionForScreen(screen: RecordsScreen): RecordsSection {
  if (screen.startsWith('verse')) return 'verses';
  if (screen.startsWith('prayer')) return 'prayer';
  return 'favorites';
}

export function screenForSection(section: RecordsSection): RecordsScreen {
  if (section === 'verses') return 'verses';
  if (section === 'prayer') return 'prayer';
  return 'favorites';
}

export function isDetailScreen(screen: RecordsScreen) {
  return screen !== 'favorites' && screen !== 'verses' && screen !== 'prayer';
}
