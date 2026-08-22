import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Mic,
  Search,
  Share2,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { sectionForScreen, screenForSection, type RecordsScreen, type RecordsSection } from './recordExperienceState';
import { recordAssetUrl } from './recordsAssets';
import './records-experience.css';

const A = '/assets/bible-friend/records';
const HQ = `${A}/hq`;
const BG = `${A}/backgrounds`;
const VERSE = `${A}/verse`;
const PRAYER = `${A}/prayer`;
const MASCOT = `${A}/mascot`;
const NAV = `${A}/nav`;

type Favorite = { id: string; title: string; body: string; date: string; image: string };
type Verse = { ref: string; text: string; image: string; theme: string };
type PrayerEntry = {
  id: number;
  title: string;
  date: string;
  status: '기도 중' | '응답됨';
  image: string;
  gratitude?: string;
  topic?: string;
  body?: string;
  category?: string;
};

const favorites: Favorite[] = [
  { id: 'love', title: '하나님의 사랑은 변하지 않아요', body: '하나님은 우리를 언제나 사랑하세요.', date: '오늘 09:30', image: `${HQ}/05_heart.png` },
  { id: 'prayer', title: '기도는 하나님과의 대화예요', body: '마음속 이야기를 하나님께 들려드려요.', date: '어제 20:15', image: `${HQ}/06_praying_hands.png` },
  { id: 'forgive', title: '용서는 사랑의 선택이에요', body: '예수님은 우리를 용서해 주셨어요.', date: '5월 18일', image: `${HQ}/07_dove.png` },
  { id: 'thanks', title: '감사는 기쁨을 키워요', body: '매일 작은 것에도 감사해요.', date: '5월 15일', image: `${HQ}/08_gift.png` },
];

const verses: Verse[] = [
  { ref: '시편 23:1-2', text: '여호와는 나의 목자시니 내게 부족함이 없으리로다.', image: `${VERSE}/rainbow-cloud.png`, theme: '위로' },
  { ref: '이사야 41:10', text: '두려워하지 말라 내가 너와 함께 함이라.', image: `${VERSE}/courage-lion.png`, theme: '용기' },
  { ref: '요한복음 14:27', text: '평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라.', image: `${VERSE}/dove-branch.png`, theme: '평안' },
  { ref: '잠언 3:5-6', text: '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라.', image: `${VERSE}/scripture-lamp.png`, theme: '지혜' },
  { ref: '빌립보서 4:6-7', text: '아무것도 염려하지 말고 모든 일에 기도와 간구로 하나님께 아뢰라.', image: `${VERSE}/prayer-ribbon.png`, theme: '기도' },
];

const prayerSeed: PrayerEntry[] = [
  { id: 1, title: '우리 가족의 건강과 평안을 위해', date: '오늘 09:10', status: '기도 중', image: `${PRAYER}/candle.png`, category: '가족', topic: '우리 가족이 건강하고 평안하도록 지켜주세요.' },
  { id: 2, title: '새 학기, 지혜와 용기를 주시기를', date: '어제 20:30', status: '응답됨', image: `${PRAYER}/answered-check.png`, category: '학교', topic: '새 학기에도 지혜와 용기를 주세요.' },
  { id: 3, title: '전쟁과 아픔 속에 있는 사람들을 위해', date: '5월 18일', status: '기도 중', image: `${VERSE}/prayer-ribbon.png`, category: '감사', topic: '아픔 속에 있는 사람들에게 평안을 주세요.' },
];

const answerSeed = [
  { title: '동생의 건강을 위해', date: '5월 12일', status: '응답됨', image: `${PRAYER}/answered-check.png` },
  { title: '새 학년 적응을 위해', date: '5월 8일', status: '기도 중', image: `${PRAYER}/calendar.png` },
  { title: '아빠의 직장 문제를 위해', date: '4월 28일', status: '응답됨', image: `${PRAYER}/family.png` },
  { title: '할머니의 마음에 평안을 위해', date: '4월 20일', status: '감사', image: `${PRAYER}/candle.png` },
] as const;

function asset(path: string, alt = '', className = '') {
  return <img src={recordAssetUrl(path)} alt={alt} className={className} draggable={false} />;
}

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export default function RecordsExperience() {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<RecordsScreen>('favorites');
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite>(favorites[0]);
  const [selectedVerse, setSelectedVerse] = useState<Verse>(verses[0]);
  const [favoriteIds, setFavoriteIds] = usePersistentState<string[]>('bible-friend-record-favorites', favorites.map(item => item.id));
  const [savedPrayers, setSavedPrayers] = usePersistentState<PrayerEntry[]>('bible-friend-record-prayers', prayerSeed);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerThanks, setPrayerThanks] = useState('');
  const [prayerTopic, setPrayerTopic] = useState('');
  const [prayerBody, setPrayerBody] = useState('');
  const [category, setCategory] = useState('감사');

  const section = sectionForScreen(screen);
  const visibleFavorites = useMemo(() => favorites.filter(item => favoriteIds.includes(item.id)), [favoriteIds]);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return verses.slice(0, 4);
    return verses.filter(item => `${item.ref} ${item.text} ${item.theme}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const nav = button.closest('nav.bf-bottom-nav');
      if (!nav || !button.textContent?.includes('기록')) return;
      event.preventDefault();
      event.stopPropagation();
      setScreen('favorites');
      setOpen(true);
    };
    const onCustom = () => { setScreen('favorites'); setOpen(true); };
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
  const handoff = (label: '대화' | '스토리' | '성장') => {
    setOpen(false);
    window.setTimeout(() => {
      const targets = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('nav.bf-bottom-nav button, nav.bf-bottom-nav a'));
      const target = targets.find(node => node.textContent?.includes(label));
      if (target) target.click();
      else if (label === '성장') window.location.assign('/growth-game');
    }, 0);
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

  const savePrayer = () => {
    const title = prayerTitle.trim() || prayerTopic.trim() || '오늘의 기도';
    const gratitude = prayerThanks.trim();
    const topic = prayerTopic.trim();
    const body = prayerBody.trim();
    if (!gratitude && !topic && !body) { setToast('기도 내용을 적어주세요'); return; }
    const entry: PrayerEntry = {
      id: Date.now(),
      title,
      date: '방금',
      status: '기도 중',
      image: `${PRAYER}/hands-alt.png`,
      gratitude,
      topic,
      body,
      category,
    };
    setSavedPrayers(prev => [entry, ...prev]);
    setPrayerTitle(''); setPrayerThanks(''); setPrayerTopic(''); setPrayerBody(''); setCategory('감사');
    setToast('기도를 소중히 기록했어요 🙏');
    setScreen('prayer');
  };

  const bgPath = section === 'favorites' ? `${BG}/favorites.png` : section === 'verses' ? `${BG}/verse.png` : screen === 'prayer-answers' ? `${BG}/prayer-answer.png` : `${BG}/prayer.png`;
  const bg = recordAssetUrl(bgPath);
  const isDetail = ['favorite-detail','favorites-manage','verse-detail','verse-search','prayer-write','prayer-answers'].includes(screen);

  return (
    <div className="records-layer" role="dialog" aria-modal="true" aria-label="성경 친구 기록">
      <div className="records-shell" style={{ '--records-bg': `url(${bg})` } as CSSProperties}>
        <div className="records-bg" aria-hidden="true" />
        <Header onClose={() => setOpen(false)} onSettings={() => setToast('꾸미기 설정은 준비 중이에요')} />
        <main className="records-main">
          {!isDetail && <Hero section={section} />}
          {!isDetail && <Segmented section={section} onChange={goSection} />}

          {screen === 'favorites' && (
            <section className="records-stack records-list-pad">
              <div className="records-section-head"><b>즐겨찾기</b><button onClick={() => setScreen('favorites-manage')}>관리</button></div>
              {visibleFavorites.length === 0 && <div className="records-card records-mini-panel soft"><b>아직 즐겨찾기가 없어요.</b><span>마음에 남는 말씀을 다시 저장해 보세요.</span></div>}
              {visibleFavorites.map(item => (
                <button className="records-card records-row-card" key={item.id} onClick={() => { setSelectedFavorite(item); setScreen('favorite-detail'); }}>
                  {asset(item.image, '', 'records-card-icon')}
                  <span className="records-card-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
                  <span className="records-card-meta"><small>{item.date}</small><Star size={19} fill="#FFD24A" color="#FFD24A" /></span>
                </button>
              ))}
            </section>
          )}

          {screen === 'favorite-detail' && (
            <DetailScaffold title="즐겨찾기 상세" onBack={() => setScreen('favorites')}>
              <section className="records-card records-detail-card">
                <div className="records-detail-lead">{asset(selectedFavorite.image, '', 'records-detail-icon')}<div><h2>{selectedFavorite.title}</h2><small>{selectedFavorite.date}</small></div>{asset(`${HQ}/02_mascot_wave.png`, '', 'records-detail-mascot')}</div>
                <p>{selectedFavorite.body} 하나님의 사랑은 언제나 변하지 않고 우리 곁에 있어요.</p>
                <div className="records-mini-panel">{asset(`${VERSE}/open-bible-star.png`, '', 'records-mini-icon')}<div><b>관련 말씀</b><span>“여호와께서 네게 복을 주시고 너를 지키시기를 원하며” (민수기 6:24)</span></div></div>
                <div className="records-mini-panel soft">{asset(`${VERSE}/heart-bible.png`, '', 'records-mini-icon')}<div><b>마음에 새겨요</b><span>기쁠 때도 슬플 때도 하나님은 곁에 계세요.</span></div></div>
              </section>
              <div className="records-action-grid three"><button onClick={() => setToast('다시 천천히 읽어보아요')}>↻ 다시 읽기</button><button onClick={() => shareText(`${selectedFavorite.title}\n${selectedFavorite.body}`)}><Share2 size={15}/> 공유하기</button><button className="primary"><Star size={15} fill="currentColor"/> 유지</button></div>
            </DetailScaffold>
          )}

          {screen === 'favorites-manage' && (
            <DetailScaffold title="즐겨찾기 관리" onBack={() => setScreen('favorites')} action={<button className="records-top-action" onClick={() => setScreen('favorites')}>편집 완료</button>}>
              <div className="records-summary-card records-card"><div className="records-summary-star"><Star fill="#FFD24A" color="#FFD24A"/></div><div><h2>즐겨찾기 {favoriteIds.length}개</h2><p>체크한 항목만 즐겨찾기에 남아요.</p></div>{asset(`${MASCOT}/wave.png`, '', 'records-summary-mascot')}</div>
              <div className="records-stack">{favorites.map(item => { const checked = favoriteIds.includes(item.id); return <button className="records-card records-manage-row" key={item.id} onClick={() => setFavoriteIds(ids => checked ? ids.filter(id => id !== item.id) : [...ids, item.id])}><span className={`records-check ${checked?'checked':''}`}>{checked && <Check size={13}/>}</span>{asset(item.image, '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.title}</strong><small>{item.body}</small></span><span className="records-drag">≡</span></button>; })}</div>
              <div className="records-manage-actions"><button onClick={() => setToast('폴더 이동 기능은 다음 단계에서 연결할 수 있어요')}>폴더 이동</button><button onClick={() => setFavoriteIds([])}>모두 지우기</button><button className="primary" onClick={() => setScreen('favorites')}>완료</button></div>
            </DetailScaffold>
          )}

          {screen === 'verses' && (
            <section className="records-stack records-list-pad">
              <button className="records-card records-today-verse" onClick={() => { setSelectedVerse({ ref:'시편 119:105', text:'주의 말씀은 내 발에 등이요 내 길에 빛이니이다.', image:`${VERSE}/open-bible-glow.png`, theme:'오늘' }); setScreen('verse-detail'); }}><span><b>✦ 오늘의 말씀</b><small>시편 119:105</small><strong>주의 말씀은 내 발에 등이요 내 길에 빛이니이다.</strong></span>{asset(`${VERSE}/open-bible-glow.png`, '', 'records-verse-feature-art')}</button>
              <div className="records-chips"><button className="active">사랑</button><button>용기</button><button>감사</button><button>평안</button><button>기도</button></div>
              {verses.slice(1).map(item => <button className="records-card records-row-card compact" key={item.ref} onClick={() => { setSelectedVerse(item); setScreen('verse-detail'); }}>{asset(item.image, '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.ref}</strong><small>{item.text}</small></span><Bookmark size={20}/></button>)}
              <button className="records-search-cta" onClick={() => setScreen('verse-search')}><Search size={18}/> 더 많은 말씀 찾기</button>
            </section>
          )}

          {screen === 'verse-detail' && (
            <DetailScaffold title="성경 구절 상세" onBack={() => setScreen('verses')} action={<button className="records-round-top" onClick={() => shareText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Share2 size={18}/></button>}>
              <section className="records-card records-scripture-hero"><div><h2>{selectedVerse.ref}</h2><blockquote>{selectedVerse.text}</blockquote></div>{asset(`${MASCOT}/heart.png`, '', 'records-scripture-mascot')}</section>
              <InfoRow image={`${VERSE}/open-bible-star.png`} title="말씀 해설" text="하나님은 우리를 사랑하시고 말씀으로 우리의 길을 밝혀 주세요." />
              <InfoRow image={`${VERSE}/scripture-card.png`} title="오늘의 적용" text="오늘도 하나님의 사랑을 기억하고 그 사랑을 다른 사람에게 전해보아요." />
              <InfoRow image={`${VERSE}/prayer-ribbon.png`} title="짧은 기도" text="사랑의 하나님, 오늘도 말씀대로 걸어가게 도와주세요. 아멘." />
              <div className="records-action-grid four"><button onClick={() => setToast('말씀을 들려줄 준비를 했어요')}>♪<span>듣기</span></button><button onClick={() => copyText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Copy size={18}/><span>복사</span></button><button onClick={() => shareText(`${selectedVerse.ref} ${selectedVerse.text}`)}><Share2 size={18}/><span>공유</span></button><button className="primary"><Star size={18}/><span>저장</span></button></div>
            </DetailScaffold>
          )}

          {screen === 'verse-search' && (
            <DetailScaffold title="성경 구절 찾기" onBack={() => setScreen('verses')} action={asset(`${MASCOT}/reading.png`, '', 'records-search-mascot')}>
              <label className="records-search-box"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="찾고 싶은 말씀이나 주제를 입력하세요" /></label>
              <div className="records-chips search">{['위로','치유','희망','지혜','사랑','믿음'].map(topic => <button key={topic} onClick={() => setQuery(topic)}>{topic}</button>)}</div>
              <section className="records-card records-recommend">{asset(`${VERSE}/open-bible-glow.png`, '', 'records-card-icon large')}<div><h3>어떤 말씀을 찾고 있나요?</h3><p>인기 주제를 선택하면 관련 구절을 쉽게 찾을 수 있어요.</p></div></section>
              <div className="records-section-head"><b>검색 결과</b><span>총 {searchResults.length}건</span></div>
              <div className="records-stack">{searchResults.map(item => <button className="records-card records-row-card compact" key={item.ref} onClick={() => { setSelectedVerse(item); setScreen('verse-detail'); }}>{asset(item.image, '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.ref}</strong><small>{item.text}</small></span><ChevronRight size={18}/></button>)}</div>
            </DetailScaffold>
          )}

          {screen === 'prayer' && (
            <section className="records-stack records-list-pad">
              <button className="records-card records-today-prayer" onClick={() => setScreen('prayer-write')}><div><span className="records-pill">✦ 오늘의 기도</span><h2>하나님, 오늘도 함께해 주세요</h2><p>하나님, 오늘도 저와 함께해 주셔서 감사합니다. 제 마음을 지켜주시고 사랑으로 인도해 주세요.</p></div>{asset(`${PRAYER}/hands-alt.png`, '', 'records-prayer-feature-art')}</button>
              <div className="records-section-head"><b>기도 제목</b><button onClick={() => setScreen('prayer-answers')}>응답 기록</button></div>
              <div className="records-prayer-shortcuts"><PrayerShortcut image={`${PRAYER}/family.png`} title="가족을 위해" text="우리 가족을 지켜주세요." /><PrayerShortcut image={`${PRAYER}/study.png`} title="공부와 지혜" text="공부할 때 지혜를 주세요." /><PrayerShortcut image={`${PRAYER}/friends-teacher.png`} title="친구와 선생님" text="서로 사랑하게 해주세요." /></div>
              {savedPrayers.slice(0, 5).map(item => <div className="records-card records-row-card compact" key={item.id}>{asset(item.image, '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.title}</strong><small>{[item.category, item.topic, item.gratitude, item.body].filter(Boolean).join(' · ') || item.date}</small></span><span className={`records-status ${item.status==='응답됨'?'answered':''}`}>{item.status}</span></div>)}
              <button className="records-primary-wide" onClick={() => setScreen('prayer-write')}>+ 새 기도문 쓰기</button>
            </section>
          )}

          {screen === 'prayer-write' && (
            <DetailScaffold title="기도문 쓰기" onBack={() => setScreen('prayer')} action={<button className="records-top-action" onClick={savePrayer}>저장</button>}>
              <section className="records-card records-writing-hero"><div><h2>하나님께 솔직한 마음을 적어보세요</h2><p>하나님은 당신의 마음을 기쁘게 들어주세요.</p></div>{asset(`${MASCOT}/praying.png`, '', 'records-writing-mascot')}</section>
              <PrayerField label="제목" value={prayerTitle} onChange={setPrayerTitle} placeholder="기도문 제목을 적어주세요" />
              <PrayerField label="오늘 감사한 일" value={prayerThanks} onChange={setPrayerThanks} placeholder="오늘 감사한 일을 적어보세요" multiline />
              <PrayerField label="기도 제목" value={prayerTopic} onChange={setPrayerTopic} placeholder="기도하고 싶은 제목을 적어보세요" multiline />
              <PrayerField label="하나님께 드리는 말" value={prayerBody} onChange={setPrayerBody} placeholder="하나님께 전하고 싶은 마음을 자유롭게 적어보세요" multiline large />
              <div className="records-field-block"><b>기도 분류</b><div className="records-chips categories">{['감사','가족','학교','건강','친구'].map(item => <button key={item} className={category===item?'active':''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
              <div className="records-action-grid two"><button onClick={() => setToast('작성 중인 내용은 화면을 닫기 전까지 유지돼요')}>▣ 임시 저장</button><button className="primary" onClick={savePrayer}>♡ 기도 남기기</button></div>
            </DetailScaffold>
          )}

          {screen === 'prayer-answers' && (
            <DetailScaffold title="기도 응답 기록" subtitle="기도하고 기다리며, 하나님이 일하신 순간을 기록해요." onBack={() => setScreen('prayer')} action={asset(`${MASCOT}/heart.png`, '', 'records-search-mascot')}>
              <section className="records-card records-calendar"><div className="records-calendar-head"><span>‹</span><b>2025년 5월</b><span>›</span></div><div className="records-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div className="records-week dates"><span>11</span><span>12</span><span className="selected">13</span><span>14</span><span>15</span><span>16</span><span>17</span></div></section>
              <section className="records-card records-prayer-stats"><div>{asset(`${PRAYER}/hands-alt.png`, '', 'records-stat-icon')}<span>이번 달<b>{savedPrayers.length}</b><small>기도</small></span></div><div>{asset(`${PRAYER}/answered-check.png`, '', 'records-stat-icon')}<span>응답됨<b>{savedPrayers.filter(item => item.status==='응답됨').length}</b><small>기도</small></span></div><div>{asset(`${PRAYER}/gratitude-flower.png`, '', 'records-stat-icon')}<span>감사할 제목<b>{savedPrayers.filter(item => item.gratitude).length}</b></span></div></section>
              <div className="records-section-head"><b>기도 기록</b><span>전체 보기 ›</span></div>
              <div className="records-stack">{answerSeed.map(item => <div className="records-card records-row-card compact" key={item.title}>{asset(item.image, '', 'records-card-icon')}<span className="records-card-copy"><strong>{item.title}</strong><small>{item.date}</small></span><span className={`records-status ${item.status==='응답됨'?'answered':item.status==='감사'?'thanks':''}`}>{item.status}</span></div>)}</div>
              <h3 className="records-subtitle">내가 남긴 기도</h3>
              <div className="records-stack">{savedPrayers.slice(0, 4).map(item => <div className="records-card records-info-row" key={`saved-${item.id}`}>{asset(item.image, '', 'records-card-icon')}<div><b>{item.title}</b><span>{[item.gratitude && `감사: ${item.gratitude}`, item.topic && `기도 제목: ${item.topic}`, item.body && `하나님께 드리는 말: ${item.body}`, item.category && `분류: ${item.category}`].filter(Boolean).join(' · ')}</span></div></div>)}</div>
            </DetailScaffold>
          )}
        </main>

        <div className="records-composer"><span>메시지를 입력해 주세요</span><button onClick={() => setToast('음성 질문은 대화 탭에서 사용할 수 있어요')}><Mic size={16}/> 말하기</button></div>
        <nav className="records-bottom-nav" aria-label="기록 화면 메뉴"><button onClick={() => handoff('대화')}>{asset(`${NAV}/chat.png`, '', 'records-nav-icon')}<span>대화</span></button><button onClick={() => handoff('스토리')}>{asset(`${NAV}/story.png`, '', 'records-nav-icon')}<span>스토리</span></button><button onClick={() => handoff('성장')}>{asset(`${NAV}/growth.png`, '', 'records-nav-icon')}<span>성장</span></button><button className="active" onClick={() => setScreen('favorites')}>{asset(`${NAV}/record.png`, '', 'records-nav-icon')}<span>기록</span></button></nav>
        {toast && <div className="records-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function Header({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  return <header className="records-header"><div className="records-brand">{asset(`${HQ}/01_app_logo.png`, '', 'records-brand-logo')}<strong>성경 친구</strong></div><div className="records-header-actions"><button onClick={onSettings} aria-label="설정">{asset(`${HQ}/04_settings.png`, '', 'records-settings')}</button><button className="records-close" onClick={onClose} aria-label="기록 화면 닫기"><X size={19}/></button></div></header>;
}

function Hero({ section }: { section: RecordsSection }) {
  const data = section === 'favorites' ? { title:'즐겨찾기', sub:'마음에 저장한 내용을 다시 만나보세요', image:`${HQ}/02_mascot_wave.png` } : section === 'verses' ? { title:'성경 구절', sub:'주제별 말씀을 쉽고 따뜻하게 만나보세요', image:`${MASCOT}/reading.png` } : { title:'기도', sub:'오늘의 기도와 기도 기록을 따뜻하게 남겨보세요', image:`${HQ}/03_mascot_heart.png` };
  return <section className="records-hero"><div><h1>{data.title}</h1><p>{data.sub}</p></div>{asset(data.image, '', 'records-hero-mascot')}</section>;
}

function Segmented({ section, onChange }: { section: RecordsSection; onChange: (section: RecordsSection) => void }) {
  return <nav className="records-segmented"><button>최근</button><button className={section==='favorites'?'active':''} onClick={() => onChange('favorites')}>즐겨찾기</button><button className={section==='verses'?'active':''} onClick={() => onChange('verses')}>성경 구절</button><button className={section==='prayer'?'active':''} onClick={() => onChange('prayer')}>기도</button></nav>;
}

function DetailScaffold({ title, subtitle, onBack, action, children }: { title: string; subtitle?: string; onBack: () => void; action?: ReactNode; children: ReactNode }) {
  return <section className="records-detail-page"><div className="records-detail-head"><button className="records-round-top" onClick={onBack} aria-label="뒤로"><ArrowLeft size={20}/></button><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="records-detail-action">{action}</div></div>{children}</section>;
}

function InfoRow({ image, title, text }: { image: string; title: string; text: string }) {
  return <div className="records-card records-info-row">{asset(image, '', 'records-card-icon')}<div><b>{title}</b><span>{text}</span></div><ChevronRight size={20}/></div>;
}

function PrayerShortcut({ image, title, text }: { image: string; title: string; text: string }) {
  return <button className="records-card">{asset(image, '', 'records-shortcut-art')}<b>{title}</b><span>{text}</span></button>;
}

function PrayerField({ label, value, onChange, placeholder, multiline, large }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; large?: boolean }) {
  return <label className="records-card records-field-block"><b>{label}</b>{multiline ? <textarea rows={large ? 4 : 2} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/> : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>}</label>;
}
