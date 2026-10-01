import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Globe2,
  MessageCircleMore,
  Search,
  Share2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { getVerse, searchVerses, VERSE_THEMES, verseOfTheDay, type LibraryVerse, type VerseTheme } from '@shared/verseLibrary';
import { sectionForScreen, screenForSection, type RecordsScreen, type RecordsSection } from './recordExperienceState';
import { RECORD_FALLBACK_ART, recordAssetUrl, recordBackgroundUrl } from './recordsAssets';
import {
  addPrayer,
  clearRecents,
  deletePrayer,
  formatRecordTime,
  isFavorite,
  nowIso,
  removeFavorites,
  setPrayerStatus,
  toggleFavorite,
  updateRecords,
  useRecords,
  type FavoriteItem,
  type PrayerRecord,
  type RecentConversation,
} from './recordsStore';
import './records-experience.css';

const A = '/assets/bible-friend/records';
const HQ = `${A}/hq`;
const BG = `${A}/backgrounds`;
const VERSE = `${A}/verse`;
const PRAYER = `${A}/prayer`;
const MASCOT = `${A}/mascot`;
const NAV = `${A}/nav`;

const THEME_ART: Record<VerseTheme, string> = {
  사랑: `${VERSE}/heart-bible.png`,
  용기: `${VERSE}/courage-lion.png`,
  평안: `${VERSE}/dove-branch.png`,
  위로: `${VERSE}/rainbow-cloud.png`,
  기도: `${VERSE}/prayer-ribbon.png`,
  감사: `${PRAYER}/gratitude-flower.png`,
  지혜: `${VERSE}/scripture-lamp.png`,
  용서: `${HQ}/07_dove.png`,
  소망: `${VERSE}/open-bible-glow.png`,
  친구: `${PRAYER}/friends-teacher.png`,
  가족: `${PRAYER}/family.png`,
  예수님: `${VERSE}/open-bible-star.png`,
};

const PRAYER_SHORTCUTS = [
  { image: `${PRAYER}/family.png`, title: '가족을 위해', text: '우리 가족을 지켜주세요.', category: '가족' },
  { image: `${PRAYER}/study.png`, title: '공부와 지혜', text: '공부할 때 지혜를 주세요.', category: '학교' },
  { image: `${PRAYER}/friends-teacher.png`, title: '친구와 선생님', text: '서로 사랑하게 해주세요.', category: '친구' },
];

function verseArt(verse?: LibraryVerse) {
  return verse ? THEME_ART[verse.theme] : `${VERSE}/open-bible-star.png`;
}

function favoriteArt(item: FavoriteItem) {
  return item.kind === 'verse' ? verseArt(item.verseId ? getVerse(item.verseId) : undefined) : `${HQ}/05_heart.png`;
}

function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Sunday-first week containing `now`, for the prayer calendar strip. */
function currentWeek(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function asset(path: string, alt = '', className = '') {
  return (
    <img
      src={recordAssetUrl(path)}
      alt={alt}
      className={className}
      draggable={false}
      onError={event => {
        const img = event.currentTarget;
        if (!img.src.endsWith(RECORD_FALLBACK_ART)) img.src = RECORD_FALLBACK_ART;
      }}
    />
  );
}

/** Opens the conversation and asks `question` there (see ConversationHome's ?ask=). */
export function askUrl(question: string) {
  return `/?ask=${encodeURIComponent(question)}`;
}

export default function RecordsExperience() {
  const records = useRecords();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<RecordsScreen>('recent');
  const [selectedRecent, setSelectedRecent] = useState<RecentConversation | null>(null);
  const [selectedFavorite, setSelectedFavorite] = useState<FavoriteItem | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<LibraryVerse>(() => verseOfTheDay(todayKey()));
  const [manageSelection, setManageSelection] = useState<string[]>([]);
  const [theme, setTheme] = useState<VerseTheme | null>(null);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerThanks, setPrayerThanks] = useState('');
  const [prayerTopic, setPrayerTopic] = useState('');
  const [prayerBody, setPrayerBody] = useState('');
  const [category, setCategory] = useState('감사');

  const section = sectionForScreen(screen);
  const todayVerse = verseOfTheDay(todayKey());
  const themedVerses = useMemo(() => searchVerses('', theme ?? undefined), [theme]);
  const searchResults = useMemo(() => searchVerses(query), [query]);
  const week = currentWeek();

  useEffect(() => {
    const openAt = (next: RecordsScreen) => {
      setScreen(next);
      setOpen(true);
    };
    const onCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const nav = button.closest('nav.bf-bottom-nav');
      if (!nav || !button.textContent?.includes('기록')) return;
      event.preventDefault();
      event.stopPropagation();
      openAt('recent');
    };
    const onCustom = () => openAt('favorites');
    document.addEventListener('click', onCapture, true);
    window.addEventListener('bible-friend:open-records', onCustom);
    return () => {
      document.removeEventListener('click', onCapture, true);
      window.removeEventListener('bible-friend:open-records', onCustom);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!open) return null;

  const goSection = (next: RecordsSection) => setScreen(screenForSection(next));
  const handoff = (path: string) => {
    setOpen(false);
    window.setTimeout(() => window.location.assign(path), 0);
  };

  const shareText = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ title: '성경 친구', text });
      else await navigator.clipboard.writeText(text);
      setToast('공유할 내용을 준비했어요 ✨');
    } catch { /* user cancelled */ }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setToast('복사했어요 ✨'); } catch { setToast('복사하지 못했어요'); }
  };

  const verseSaved = (verse: LibraryVerse) => isFavorite(records, { kind: 'verse', body: verse.text, verseId: verse.id });
  const toggleVerse = (verse: LibraryVerse) => {
    const saved = verseSaved(verse);
    updateRecords(state => toggleFavorite(state, { kind: 'verse', title: verse.ref, body: verse.text, verseId: verse.id, at: nowIso() }));
    setToast(saved ? '즐겨찾기에서 뺐어요' : '말씀을 즐겨찾기에 담았어요 ⭐');
  };
  const openVerse = (verse: LibraryVerse) => { setSelectedVerse(verse); setScreen('verse-detail'); };

  const startPrayer = (preset?: { category: string; topic: string }) => {
    if (preset) { setCategory(preset.category); setPrayerTopic(preset.topic); }
    setScreen('prayer-write');
  };

  const savePrayer = () => {
    const gratitude = prayerThanks.trim();
    const topic = prayerTopic.trim();
    const body = prayerBody.trim();
    if (!gratitude && !topic && !body) { setToast('기도 내용을 적어주세요'); return; }
    const title = prayerTitle.trim() || topic || '오늘의 기도';
    updateRecords(state => addPrayer(state, { title, gratitude, topic, body, category, at: nowIso() }));
    setPrayerTitle(''); setPrayerThanks(''); setPrayerTopic(''); setPrayerBody(''); setCategory('감사');
    setToast('기도를 소중히 기록했어요 🙏');
    setScreen('prayer');
  };

  const togglePrayerStatus = (prayer: PrayerRecord) => {
    const next = prayer.status === '응답됨' ? '기도 중' : '응답됨';
    updateRecords(state => setPrayerStatus(state, prayer.id, next, nowIso()));
    setToast(next === '응답됨' ? '하나님이 응답하신 기도로 표시했어요 🙌' : '다시 기도 중으로 바꿨어요');
  };

  const bgPath = section === 'verses' ? `${BG}/verse.png` : section === 'prayer' ? (screen === 'prayer-answers' ? `${BG}/prayer-answer.png` : `${BG}/prayer.png`) : `${BG}/favorites.png`;
  const bg = recordBackgroundUrl(bgPath);
  const isDetail = !['recent', 'favorites', 'verses', 'prayer'].includes(screen);
  const answered = records.prayers.filter(p => p.status === '응답됨');
  const prayerDays = records.prayers.map(p => new Date(p.at));

  return (
    <div className="records-layer" role="dialog" aria-modal="true" aria-label="성경 친구 기록">
      <div className="records-shell" style={bg ? ({ '--records-bg': `url(${bg})` } as CSSProperties) : undefined}>
        <div className="records-bg" aria-hidden="true" />
        <Header onClose={() => setOpen(false)} />
        <main className="records-main">
          {!isDetail && <Hero section={section} />}
          {!isDetail && <Segmented section={section} onChange={goSection} />}

          {screen === 'recent' && (
            <section className="records-stack records-list-pad">
              <div className="records-section-head"><b>최근 대화</b>{records.recents.length > 0 && <button onClick={() => { updateRecords(clearRecents); setToast('최근 대화를 지웠어요'); }}>모두 지우기</button>}</div>
              {records.recents.length === 0 && <EmptyPanel title="아직 나눈 대화가 없어요." text="성경 친구에게 궁금한 것을 물어보면 여기에 차곡차곡 남아요." action="대화하러 가기" onAction={() => handoff('/')} />}
              {records.recents.map(item => (
                <button className="records-card records-row-card" key={item.id} onClick={() => { setSelectedRecent(item); setScreen('recent-detail'); }}>
                  {asset(verseArt(getVerse(item.verseId)), '', 'records-card-icon')}
                  <span className="records-card-copy"><strong>{item.question}</strong><small>{item.answer}</small></span>
                  <span className="records-card-meta"><small>{formatRecordTime(item.at)}</small><ChevronRight size={18} /></span>
                </button>
              ))}
            </section>
          )}

          {screen === 'recent-detail' && selectedRecent && (() => {
            const verse = getVerse(selectedRecent.verseId);
            const saved = isFavorite(records, { kind: 'answer', body: selectedRecent.answer });
            return (
              <DetailScaffold title="대화 다시 보기" subtitle={formatRecordTime(selectedRecent.at)} onBack={() => setScreen('recent')}>
                <section className="records-card records-detail-card">
                  <div className="records-detail-lead">{asset(`${HQ}/05_heart.png`, '', 'records-detail-icon')}<div><h2>{selectedRecent.question}</h2></div></div>
                  <p>{selectedRecent.answer}</p>
                  {verse && <div className="records-mini-panel">{asset(verseArt(verse), '', 'records-mini-icon')}<div><b>함께 읽은 말씀 · {verse.ref}</b><span>{verse.text}</span></div></div>}
                </section>
                <div className="records-action-grid three">
                  <button onClick={() => handoff(askUrl(selectedRecent.question))}><MessageCircleMore size={15} /> 다시 묻기</button>
                  <button onClick={() => shareText(`${selectedRecent.question}\n${selectedRecent.answer}`)}><Share2 size={15} /> 공유하기</button>
                  <button className="primary" onClick={() => { updateRecords(state => toggleFavorite(state, { kind: 'answer', title: selectedRecent.question, body: selectedRecent.answer, verseId: selectedRecent.verseId, at: nowIso() })); setToast(saved ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 담았어요 ⭐'); }}><Star size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? '저장됨' : '저장'}</button>
                </div>
              </DetailScaffold>
            );
          })()}

          {screen === 'favorites' && (
            <section className="records-stack records-list-pad">
              <div className="records-section-head"><b>즐겨찾기</b>{records.favorites.length > 0 && <button onClick={() => { setManageSelection([]); setScreen('favorites-manage'); }}>관리</button>}</div>
              {records.favorites.length === 0 && <EmptyPanel title="아직 즐겨찾기가 없어요." text="대화에서 ⭐를 누르거나 마음에 남는 말씀을 저장해 보세요." action="말씀 둘러보기" onAction={() => setScreen('verses')} />}
              {records.favorites.map(item => (
                <button className="records-card records-row-card" key={item.id} onClick={() => { setSelectedFavorite(item); setScreen('favorite-detail'); }}>
                  {asset(favoriteArt(item), '', 'records-card-icon')}
                  <span className="records-card-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
                  <span className="records-card-meta"><small>{formatRecordTime(item.at)}</small><Star size={19} fill="#FFD24A" color="#FFD24A" /></span>
                </button>
              ))}
            </section>
          )}

          {screen === 'favorite-detail' && selectedFavorite && (() => {
            const verse = selectedFavorite.verseId ? getVerse(selectedFavorite.verseId) : undefined;
            return (
              <DetailScaffold title="즐겨찾기 상세" subtitle={formatRecordTime(selectedFavorite.at)} onBack={() => setScreen('favorites')}>
                <section className="records-card records-detail-card">
                  <div className="records-detail-lead">{asset(favoriteArt(selectedFavorite), '', 'records-detail-icon')}<div><h2>{selectedFavorite.title}</h2></div>{asset(`${HQ}/02_mascot_wave.png`, '', 'records-detail-mascot')}</div>
                  <p>{selectedFavorite.body}</p>
                  {selectedFavorite.kind === 'answer' && verse && <div className="records-mini-panel">{asset(verseArt(verse), '', 'records-mini-icon')}<div><b>관련 말씀 · {verse.ref}</b><span>{verse.text}</span></div></div>}
                </section>
                <div className="records-action-grid three">
                  <button onClick={() => handoff(askUrl(selectedFavorite.kind === 'verse' ? `${selectedFavorite.title} 말씀을 쉽게 설명해줘` : selectedFavorite.title))}><MessageCircleMore size={15} /> 더 묻기</button>
                  <button onClick={() => shareText(`${selectedFavorite.title}\n${selectedFavorite.body}`)}><Share2 size={15} /> 공유하기</button>
                  <button onClick={() => { updateRecords(state => removeFavorites(state, [selectedFavorite.id])); setToast('즐겨찾기에서 뺐어요'); setScreen('favorites'); }}><Trash2 size={15} /> 빼기</button>
                </div>
              </DetailScaffold>
            );
          })()}

          {screen === 'favorites-manage' && (
            <DetailScaffold title="즐겨찾기 관리" onBack={() => setScreen('favorites')} action={<button className="records-top-action" onClick={() => setScreen('favorites')}>완료</button>}>
              <div className="records-summary-card records-card"><div className="records-summary-star"><Star fill="#FFD24A" color="#FFD24A" /></div><div><h2>즐겨찾기 {records.favorites.length}개</h2><p>지울 항목을 골라 주세요.</p></div>{asset(`${MASCOT}/wave.png`, '', 'records-summary-mascot')}</div>
              <div className="records-stack">{records.favorites.map(item => { const checked = manageSelection.includes(item.id); return <button className="records-card records-manage-row" key={item.id} onClick={() => setManageSelection(ids => checked ? ids.filter(id => id !== item.id) : [...ids, item.id])}><span className={`records-check ${checked ? 'checked' : ''}`}>{checked && <Check size={13} />}</span>{asset(favoriteArt(item), '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.title}</strong><small>{item.body}</small></span><span /></button>; })}</div>
              <div className="records-manage-actions"><button onClick={() => setManageSelection(records.favorites.map(f => f.id))}>모두 선택</button><button onClick={() => setManageSelection([])}>선택 해제</button><button className="primary" disabled={manageSelection.length === 0} onClick={() => { updateRecords(state => removeFavorites(state, manageSelection)); setToast(`${manageSelection.length}개를 지웠어요`); setManageSelection([]); }}>선택 삭제</button></div>
            </DetailScaffold>
          )}

          {screen === 'verses' && (
            <section className="records-stack records-list-pad">
              <button className="records-card records-today-verse" onClick={() => openVerse(todayVerse)}><span><b>✦ 오늘의 말씀</b><small>{todayVerse.ref}</small><strong>{todayVerse.text}</strong></span>{asset(verseArt(todayVerse), '', 'records-verse-feature-art')}</button>
              <div className="records-chips"><button className={theme === null ? 'active' : ''} onClick={() => setTheme(null)}>전체</button>{VERSE_THEMES.map(item => <button key={item} className={theme === item ? 'active' : ''} onClick={() => setTheme(item)}>{item}</button>)}</div>
              {themedVerses.map(item => <button className="records-card records-row-card compact" key={item.id} onClick={() => openVerse(item)}>{asset(verseArt(item), '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.ref}</strong><small>{item.text}</small></span>{verseSaved(item) ? <Star size={19} fill="#FFD24A" color="#FFD24A" /> : <ChevronRight size={18} />}</button>)}
              <button className="records-search-cta" onClick={() => setScreen('verse-search')}><Search size={18} /> 말씀 찾기</button>
            </section>
          )}

          {screen === 'verse-detail' && (
            <DetailScaffold title="성경 구절" subtitle={`주제 · ${selectedVerse.theme}`} onBack={() => setScreen('verses')} action={<button className="records-round-top" aria-label="공유" onClick={() => shareText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Share2 size={18} /></button>}>
              <section className="records-card records-scripture-hero"><div><h2>{selectedVerse.ref}</h2><blockquote>{selectedVerse.text}</blockquote></div>{asset(`${MASCOT}/heart.png`, '', 'records-scripture-mascot')}</section>
              <button className="records-card records-info-row" onClick={() => handoff(askUrl(`${selectedVerse.ref} 말씀을 쉽게 설명해줘`))}>{asset(`${VERSE}/open-bible-star.png`, '', 'records-card-icon')}<div><b>성경 친구에게 물어보기</b><span>이 말씀이 무슨 뜻인지 쉽게 설명해 줄게요.</span></div><ChevronRight size={20} /></button>
              <button className="records-card records-info-row" onClick={() => handoff(askUrl(`${selectedVerse.ref} 말씀으로 짧게 기도해줘`))}>{asset(`${VERSE}/prayer-ribbon.png`, '', 'records-card-icon')}<div><b>이 말씀으로 기도하기</b><span>말씀을 마음에 담는 짧은 기도를 함께 해요.</span></div><ChevronRight size={20} /></button>
              <div className="records-action-grid three"><button onClick={() => copyText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Copy size={18} /><span>복사</span></button><button onClick={() => shareText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Share2 size={18} /><span>공유</span></button><button className="primary" onClick={() => toggleVerse(selectedVerse)}><Star size={18} fill={verseSaved(selectedVerse) ? 'currentColor' : 'none'} /><span>{verseSaved(selectedVerse) ? '저장됨' : '저장'}</span></button></div>
            </DetailScaffold>
          )}

          {screen === 'verse-search' && (
            <DetailScaffold title="말씀 찾기" onBack={() => setScreen('verses')} action={asset(`${MASCOT}/reading.png`, '', 'records-search-mascot')}>
              <label className="records-search-box"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="찾고 싶은 말씀이나 주제를 입력하세요" /></label>
              <div className="records-chips search">{['위로', '용기', '감사', '지혜', '사랑', '용서'].map(topic => <button key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
              <div className="records-section-head"><b>검색 결과</b><span>총 {searchResults.length}건</span></div>
              {searchResults.length === 0 && <EmptyPanel title="찾는 말씀이 없어요." text="성경 친구에게 직접 물어보면 알맞은 말씀을 찾아 줄게요." action="성경 친구에게 묻기" onAction={() => handoff(askUrl(`${query} 에 대한 성경 말씀을 알려줘`))} />}
              <div className="records-stack">{searchResults.map(item => <button className="records-card records-row-card compact" key={item.id} onClick={() => openVerse(item)}>{asset(verseArt(item), '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.ref}</strong><small>{item.text}</small></span><ChevronRight size={18} /></button>)}</div>
            </DetailScaffold>
          )}

          {screen === 'prayer' && (
            <section className="records-stack records-list-pad">
              <button className="records-card records-today-prayer" onClick={() => startPrayer()}><div><span className="records-pill">✦ 오늘의 기도</span><h2>하나님, 오늘도 함께해 주세요</h2><p>오늘 감사한 일과 기도하고 싶은 마음을 적어 보세요.</p></div>{asset(`${PRAYER}/hands-alt.png`, '', 'records-prayer-feature-art')}</button>
              <div className="records-section-head"><b>기도 제목</b><button onClick={() => setScreen('prayer-answers')}>응답 기록</button></div>
              <div className="records-prayer-shortcuts">{PRAYER_SHORTCUTS.map(item => <button className="records-card" key={item.title} onClick={() => startPrayer({ category: item.category, topic: item.text })}>{asset(item.image, '', 'records-shortcut-art')}<b>{item.title}</b><span>{item.text}</span></button>)}</div>
              {records.prayers.length === 0 && <EmptyPanel title="아직 적은 기도가 없어요." text="기도를 적어 두면, 하나님이 응답하신 순간도 함께 기록할 수 있어요." />}
              {records.prayers.map(item => <PrayerRow key={item.id} prayer={item} onToggle={() => togglePrayerStatus(item)} onDelete={() => { updateRecords(state => deletePrayer(state, item.id)); setToast('기도를 지웠어요'); }} />)}
              <button className="records-primary-wide" onClick={() => startPrayer()}>+ 새 기도문 쓰기</button>
            </section>
          )}

          {screen === 'prayer-write' && (
            <DetailScaffold title="기도문 쓰기" onBack={() => setScreen('prayer')} action={<button className="records-top-action" onClick={savePrayer}>저장</button>}>
              <section className="records-card records-writing-hero"><div><h2>하나님께 솔직한 마음을 적어보세요</h2><p>하나님은 당신의 마음을 기쁘게 들어주세요.</p></div>{asset(`${MASCOT}/praying.png`, '', 'records-writing-mascot')}</section>
              <PrayerField label="제목" value={prayerTitle} onChange={setPrayerTitle} placeholder="기도문 제목을 적어주세요" />
              <PrayerField label="오늘 감사한 일" value={prayerThanks} onChange={setPrayerThanks} placeholder="오늘 감사한 일을 적어보세요" multiline />
              <PrayerField label="기도 제목" value={prayerTopic} onChange={setPrayerTopic} placeholder="기도하고 싶은 제목을 적어보세요" multiline />
              <PrayerField label="하나님께 드리는 말" value={prayerBody} onChange={setPrayerBody} placeholder="하나님께 전하고 싶은 마음을 자유롭게 적어보세요" multiline large />
              <div className="records-field-block"><b>기도 분류</b><div className="records-chips categories">{['감사', '가족', '학교', '건강', '친구'].map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
              <div className="records-action-grid two"><button onClick={() => setScreen('prayer')}>취소</button><button className="primary" onClick={savePrayer}>♡ 기도 남기기</button></div>
            </DetailScaffold>
          )}

          {screen === 'prayer-answers' && (
            <DetailScaffold title="기도 응답 기록" subtitle="기도하고 기다리며, 하나님이 일하신 순간을 기록해요." onBack={() => setScreen('prayer')} action={asset(`${MASCOT}/heart.png`, '', 'records-search-mascot')}>
              <section className="records-card records-calendar"><div className="records-calendar-head"><span /><b>{week[3].getFullYear()}년 {week[3].getMonth() + 1}월</b><span /></div><div className="records-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div className="records-week dates">{week.map(day => <span key={day.toISOString()} className={sameDay(day, new Date()) ? 'selected' : ''}>{day.getDate()}{prayerDays.some(d => sameDay(d, day)) ? '•' : ''}</span>)}</div></section>
              <section className="records-card records-prayer-stats"><div>{asset(`${PRAYER}/hands-alt.png`, '', 'records-stat-icon')}<span>전체<b>{records.prayers.length}</b><small>기도</small></span></div><div>{asset(`${PRAYER}/answered-check.png`, '', 'records-stat-icon')}<span>응답됨<b>{answered.length}</b><small>기도</small></span></div><div>{asset(`${PRAYER}/gratitude-flower.png`, '', 'records-stat-icon')}<span>감사 제목<b>{records.prayers.filter(item => item.gratitude).length}</b></span></div></section>
              <div className="records-section-head"><b>응답된 기도</b></div>
              {answered.length === 0 && <EmptyPanel title="아직 응답 표시한 기도가 없어요." text="기도 목록에서 ‘기도 중’을 누르면 응답된 기도로 바꿀 수 있어요." />}
              <div className="records-stack">{answered.map(item => <PrayerRow key={item.id} prayer={item} onToggle={() => togglePrayerStatus(item)} />)}</div>
            </DetailScaffold>
          )}
        </main>

        <nav className="records-bottom-nav" aria-label="기록 화면 메뉴"><button onClick={() => handoff('/')}>{asset(`${NAV}/chat.png`, '', 'records-nav-icon')}<span>대화</span></button><button onClick={() => handoff('/map')}><Globe2 className="records-nav-icon" aria-hidden="true" /><span>지도</span></button><button className="active" onClick={() => setScreen('recent')}>{asset(`${NAV}/record.png`, '', 'records-nav-icon')}<span>기록</span></button></nav>
        {toast && <div className="records-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function EmptyPanel({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="records-card records-mini-panel soft records-empty"><div><b>{title}</b><span>{text}</span>{action && <button className="records-empty-action" onClick={onAction}>{action}</button>}</div></div>;
}

function PrayerRow({ prayer, onToggle, onDelete }: { prayer: PrayerRecord; onToggle: () => void; onDelete?: () => void }) {
  const details = [prayer.category, prayer.topic, prayer.gratitude && `감사: ${prayer.gratitude}`, prayer.body].filter(Boolean).join(' · ');
  return (
    <div className="records-card records-row-card compact records-prayer-row">
      {asset(prayer.status === '응답됨' ? `${PRAYER}/answered-check.png` : `${PRAYER}/hands-alt.png`, '', 'records-card-icon')}
      <span className="records-card-copy"><strong>{prayer.title}</strong><small>{details || formatRecordTime(prayer.at)}</small></span>
      <span className="records-prayer-actions">
        <button className={`records-status ${prayer.status === '응답됨' ? 'answered' : ''}`} onClick={onToggle} aria-label={`${prayer.title} 상태 바꾸기`}>{prayer.status}</button>
        {onDelete && <button className="records-icon-button" onClick={onDelete} aria-label={`${prayer.title} 지우기`}><Trash2 size={14} /></button>}
      </span>
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return <header className="records-header"><div className="records-brand">{asset(`${HQ}/01_app_logo.png`, '', 'records-brand-logo')}<strong>성경 친구</strong></div><div className="records-header-actions"><button className="records-close" onClick={onClose} aria-label="기록 화면 닫기"><X size={19}/></button></div></header>;
}

function Hero({ section }: { section: RecordsSection }) {
  const data = section === 'recent' ? { title:'최근 대화', sub:'성경 친구와 나눈 이야기를 다시 만나보세요', image:`${HQ}/02_mascot_wave.png` } : section === 'favorites' ? { title:'즐겨찾기', sub:'마음에 저장한 내용을 다시 만나보세요', image:`${HQ}/02_mascot_wave.png` } : section === 'verses' ? { title:'성경 구절', sub:'주제별 말씀을 쉽고 따뜻하게 만나보세요', image:`${MASCOT}/reading.png` } : { title:'기도', sub:'오늘의 기도와 기도 기록을 따뜻하게 남겨보세요', image:`${HQ}/03_mascot_heart.png` };
  return <section className="records-hero"><div><h1>{data.title}</h1><p>{data.sub}</p></div>{asset(data.image, '', 'records-hero-mascot')}</section>;
}

function Segmented({ section, onChange }: { section: RecordsSection; onChange: (section: RecordsSection) => void }) {
  return <nav className="records-segmented"><button className={section==='recent'?'active':''} onClick={() => onChange('recent')}>최근</button><button className={section==='favorites'?'active':''} onClick={() => onChange('favorites')}>즐겨찾기</button><button className={section==='verses'?'active':''} onClick={() => onChange('verses')}>성경 구절</button><button className={section==='prayer'?'active':''} onClick={() => onChange('prayer')}>기도</button></nav>;
}

function DetailScaffold({ title, subtitle, onBack, action, children }: { title: string; subtitle?: string; onBack: () => void; action?: ReactNode; children: ReactNode }) {
  return <section className="records-detail-page"><div className="records-detail-head"><button className="records-round-top" onClick={onBack} aria-label="뒤로"><ArrowLeft size={20}/></button><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="records-detail-action">{action}</div></div>{children}</section>;
}



function PrayerField({ label, value, onChange, placeholder, multiline, large }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; large?: boolean }) {
  return <label className="records-card records-field-block"><b>{label}</b>{multiline ? <textarea rows={large ? 4 : 2} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/> : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>}</label>;
}
