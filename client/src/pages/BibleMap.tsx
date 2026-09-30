import { BookOpenText, Clock3, Search, Sparkles, Users } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./bible-map.css";

type MapKind = "era" | "person" | "verse";

type BibleMapNode = {
  id: string;
  kind: MapKind;
  label: string;
  subtitle: string;
  repository: string;
  summary: string;
  era: string;
  lon: number;
  lat: number;
  related: string[];
};

const NODES: BibleMapNode[] = [
  { id: "patriarchs", kind: "era", label: "족장 시대", subtitle: "창세기", repository: "족장 시대 저장소", summary: "아브라함, 이삭, 야곱과 언약의 흐름을 모아 보는 시대 저장소예요.", era: "족장 시대", lon: -150, lat: 28, related: ["아브라함", "창세기 12:2", "언약"] },
  { id: "exodus", kind: "era", label: "출애굽·광야", subtitle: "출애굽기–신명기", repository: "출애굽 시대 저장소", summary: "모세와 출애굽, 광야 여정, 율법의 이야기를 한 흐름으로 연결해요.", era: "출애굽·광야", lon: -92, lat: -8, related: ["모세", "출애굽기 3:14", "십계명"] },
  { id: "kingdom", kind: "era", label: "왕국 시대", subtitle: "사무엘상–열왕기", repository: "왕국 시대 저장소", summary: "사울, 다윗, 솔로몬과 왕국의 시작과 분열을 살펴보는 저장소예요.", era: "왕국 시대", lon: -25, lat: 24, related: ["다윗", "시편 23:1", "예루살렘"] },
  { id: "exile", kind: "era", label: "포로·귀환", subtitle: "예언서·에스라", repository: "포로와 귀환 저장소", summary: "포로 생활과 귀환, 다시 세워지는 공동체와 예언의 소망을 모아요.", era: "포로·귀환", lon: 35, lat: -22, related: ["이사야", "이사야 40:31", "소망"] },
  { id: "gospels", kind: "era", label: "예수님의 시대", subtitle: "복음서", repository: "복음서 시대 저장소", summary: "예수님의 탄생, 말씀, 비유, 십자가와 부활을 중심으로 보는 저장소예요.", era: "예수님의 시대", lon: 95, lat: 18, related: ["예수님", "마리아", "요한복음 3:16"] },
  { id: "church", kind: "era", label: "초대교회", subtitle: "사도행전·서신서", repository: "초대교회 저장소", summary: "성령, 사도들의 전도와 교회의 확장을 연결해서 살펴봐요.", era: "초대교회", lon: 150, lat: -12, related: ["베드로", "바울", "사도행전 1:8"] },

  { id: "abraham", kind: "person", label: "아브라함", subtitle: "믿음과 언약", repository: "아브라함 인물 저장소", summary: "부르심을 따라 떠난 아브라함의 선택과 믿음을 연결해요.", era: "족장 시대", lon: -132, lat: 8, related: ["족장 시대", "창세기 12:2"] },
  { id: "moses", kind: "person", label: "모세", subtitle: "출애굽의 지도자", repository: "모세 인물 저장소", summary: "부르심, 출애굽, 광야와 율법을 모세의 시선으로 살펴봐요.", era: "출애굽·광야", lon: -72, lat: -30, related: ["출애굽·광야", "출애굽기 3:14"] },
  { id: "david", kind: "person", label: "다윗", subtitle: "왕과 시편", repository: "다윗 인물 저장소", summary: "목동에서 왕이 되기까지의 삶과 시편의 고백을 함께 연결해요.", era: "왕국 시대", lon: -6, lat: 2, related: ["왕국 시대", "시편 23:1"] },
  { id: "isaiah", kind: "person", label: "이사야", subtitle: "예언과 소망", repository: "이사야 인물 저장소", summary: "심판과 회복, 메시아에 대한 소망의 말씀을 연결해요.", era: "포로·귀환", lon: 48, lat: -2, related: ["포로·귀환", "이사야 40:31"] },
  { id: "mary", kind: "person", label: "마리아", subtitle: "순종과 믿음", repository: "마리아 인물 저장소", summary: "예수님의 탄생을 둘러싼 마리아의 믿음과 순종을 살펴봐요.", era: "예수님의 시대", lon: 78, lat: 38, related: ["예수님의 시대", "예수님"] },
  { id: "jesus", kind: "person", label: "예수님", subtitle: "복음의 중심", repository: "예수님 인물 저장소", summary: "말씀, 비유, 만남, 십자가와 부활을 모든 시대와 연결하는 중심 노드예요.", era: "예수님의 시대", lon: 112, lat: 0, related: ["요한복음 3:16", "마리아", "베드로"] },
  { id: "peter", kind: "person", label: "베드로", subtitle: "제자와 사도", repository: "베드로 인물 저장소", summary: "제자로 부름받은 순간부터 초대교회의 사역까지 이어서 살펴봐요.", era: "초대교회", lon: 138, lat: 22, related: ["예수님", "초대교회", "사도행전 1:8"] },
  { id: "paul", kind: "person", label: "바울", subtitle: "복음을 전한 사도", repository: "바울 인물 저장소", summary: "회심과 선교 여행, 여러 교회에 보낸 편지를 한 저장소로 연결해요.", era: "초대교회", lon: 168, lat: -34, related: ["초대교회", "사도행전 1:8"] },

  { id: "genesis-12-2", kind: "verse", label: "창세기 12:2", subtitle: "복의 약속", repository: "창세기 12:2 말씀 저장소", summary: "아브라함에게 주신 부르심과 복의 약속을 관련 대화와 함께 모아요.", era: "족장 시대", lon: -162, lat: -12, related: ["아브라함", "족장 시대"] },
  { id: "exodus-3-14", kind: "verse", label: "출애굽기 3:14", subtitle: "나는 스스로 있는 자", repository: "출애굽기 3:14 말씀 저장소", summary: "모세의 부르심과 하나님의 이름에 대한 말씀을 연결해요.", era: "출애굽·광야", lon: -105, lat: 18, related: ["모세", "출애굽·광야"] },
  { id: "psalm-23-1", kind: "verse", label: "시편 23:1", subtitle: "여호와는 나의 목자", repository: "시편 23:1 말씀 저장소", summary: "다윗의 고백과 위로, 돌보심에 관한 대화를 함께 모아요.", era: "왕국 시대", lon: -38, lat: -12, related: ["다윗", "왕국 시대"] },
  { id: "isaiah-40-31", kind: "verse", label: "이사야 40:31", subtitle: "새 힘을 얻으리니", repository: "이사야 40:31 말씀 저장소", summary: "기다림과 회복, 소망에 관한 말씀과 대화를 연결해요.", era: "포로·귀환", lon: 24, lat: 10, related: ["이사야", "포로·귀환"] },
  { id: "john-3-16", kind: "verse", label: "요한복음 3:16", subtitle: "하나님의 사랑", repository: "요한복음 3:16 말씀 저장소", summary: "하나님의 사랑과 구원에 대한 대화를 예수님의 이야기와 연결해요.", era: "예수님의 시대", lon: 118, lat: 34, related: ["예수님", "예수님의 시대"] },
  { id: "acts-1-8", kind: "verse", label: "사도행전 1:8", subtitle: "땅 끝까지 증인", repository: "사도행전 1:8 말씀 저장소", summary: "성령과 증인, 교회의 확장에 관한 내용을 초대교회와 연결해요.", era: "초대교회", lon: 154, lat: 8, related: ["베드로", "바울", "초대교회"] },
];

const FILTERS: Array<{ id: "all" | MapKind; label: string }> = [
  { id: "all", label: "전체" },
  { id: "era", label: "시대" },
  { id: "person", label: "인물" },
  { id: "verse", label: "말씀" },
];

const kindLabel: Record<MapKind, string> = {
  era: "시대",
  person: "인물",
  verse: "말씀",
};

export default function BibleMap() {
  const [filter, setFilter] = useState<"all" | MapKind>("all");
  const [query, setQuery] = useState("");
  const [rotation, setRotation] = useState(-8);
  const [selectedId, setSelectedId] = useState("jesus");
  const dragRef = useRef<{ startX: number; startRotation: number } | null>(null);

  const visibleNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NODES.filter(node => {
      const matchesKind = filter === "all" || node.kind === filter;
      const haystack = `${node.label} ${node.subtitle} ${node.repository} ${node.summary} ${node.era}`.toLowerCase();
      return matchesKind && (!q || haystack.includes(q));
    });
  }, [filter, query]);

  const selected = NODES.find(node => node.id === selectedId) ?? NODES[0];

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: event.clientX, startRotation: rotation };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setRotation(dragRef.current.startRotation + (event.clientX - dragRef.current.startX) * 0.55);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <main className="bible-map-page">
      <header className="bible-map-header">
        <span className="bible-map-kicker"><Sparkles size={14} /> BIBLE KNOWLEDGE GLOBE</span>
        <h1>성경 지도</h1>
        <p>장소가 아니라 <strong>시대 · 인물 · 말씀</strong>의 관계를 돌려보는 지식 지도예요.</p>
      </header>

      <label className="bible-map-search">
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="인물, 시대, 말씀을 찾아보세요" />
      </label>

      <div className="bible-map-filters" aria-label="지도 필터">
        {FILTERS.map(item => (
          <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="bible-map-stage" aria-label="성경 지식 지구본">
        <div
          className="bible-globe"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="bible-globe-shine" aria-hidden="true" />
          <div className="bible-globe-equator" aria-hidden="true" />
          <div className="bible-globe-meridian meridian-one" aria-hidden="true" />
          <div className="bible-globe-meridian meridian-two" aria-hidden="true" />

          {visibleNodes.map(node => {
            const lon = ((node.lon + rotation) * Math.PI) / 180;
            const lat = (node.lat * Math.PI) / 180;
            const depth = Math.cos(lat) * Math.cos(lon);
            const x = 50 + Math.cos(lat) * Math.sin(lon) * 43;
            const y = 50 - Math.sin(lat) * 41;
            const scale = 0.76 + (depth + 1) * 0.17;
            const opacity = depth < -0.2 ? 0.14 : 0.56 + depth * 0.36;
            const isFront = depth > -0.2;
            return (
              <button
                key={node.id}
                type="button"
                className={`bible-map-node kind-${node.kind} ${selectedId === node.id ? "selected" : ""}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  opacity,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  zIndex: Math.round((depth + 1) * 50),
                  pointerEvents: isFront ? "auto" : "none",
                }}
                onClick={event => {
                  event.stopPropagation();
                  setSelectedId(node.id);
                }}
                aria-label={`${kindLabel[node.kind]} ${node.label}`}
              >
                <i aria-hidden="true" />
                <span>{node.label}</span>
              </button>
            );
          })}
        </div>
        <p className="bible-map-drag-hint">손가락으로 좌우로 돌려보세요</p>
      </section>

      <section className="bible-map-repositories" aria-label="지도 저장소">
        <div><Clock3 size={17} /><span><b>6</b> 시대 저장소</span></div>
        <div><Users size={17} /><span><b>8</b> 인물 저장소</span></div>
        <div><BookOpenText size={17} /><span><b>6</b> 말씀 저장소</span></div>
      </section>

      <section className={`bible-map-detail detail-${selected.kind}`}>
        <div className="bible-map-detail-top">
          <span>{kindLabel[selected.kind]} 저장소</span>
          <small>{selected.era}</small>
        </div>
        <h2>{selected.label}</h2>
        <p className="bible-map-detail-subtitle">{selected.subtitle}</p>
        <p>{selected.summary}</p>
        <div className="bible-map-related">
          {selected.related.map(item => <span key={item}>{item}</span>)}
        </div>
      </section>

      <p className="bible-map-footnote">
        앞으로 대화에서 발견한 인물·말씀·주제가 각 저장소에 쌓이고, 서로 연결되도록 확장할 수 있어요.
      </p>
    </main>
  );
}
