import { useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Play, SlidersHorizontal, Star } from "lucide-react";
import "./story-experience.css";

const STORY_ASSET_ROOT =
  "https://raw.githubusercontent.com/khs0927/bible-verse-web/main/assets/bible-friend/story";

type StoryId =
  | "david"
  | "noah"
  | "jonah"
  | "birth"
  | "samaritan"
  | "lost-sheep"
  | "resurrection"
  | "jesus-love"
  | "creation"
  | "solomon";

type StoryFilter = "all" | "old" | "new" | "person" | "miracle";
type StoryView = "main" | "all";

type StoryInfo = {
  id: StoryId;
  number: number;
  title: string;
  description: string;
  image: string;
  categories: StoryFilter[];
  focus: { x: number; y: number };
  route?: string;
};

const STORIES: StoryInfo[] = [
  {
    id: "david",
    number: 1,
    title: "다윗과 골리앗",
    description: "용감한 소년 다윗이 하나님을 믿고 거인 골리앗을 이겨요!",
    image: `${STORY_ASSET_ROOT}/01-david-goliath.png`,
    categories: ["all", "old", "person"],
    focus: { x: 58, y: 50 },
    route: "/story/david",
  },
  {
    id: "noah",
    number: 2,
    title: "노아의 방주",
    description: "하나님의 말씀을 믿고 방주를 만든 노아의 이야기예요.",
    image: `${STORY_ASSET_ROOT}/02-noah-ark.png`,
    categories: ["all", "old", "person"],
    focus: { x: 52, y: 46 },
  },
  {
    id: "jonah",
    number: 3,
    title: "요나와 큰 물고기",
    description: "하나님의 말씀을 배우게 된 요나의 놀라운 이야기예요.",
    image: `${STORY_ASSET_ROOT}/03-jonah-whale.png`,
    categories: ["all", "old", "person", "miracle"],
    focus: { x: 52, y: 44 },
  },
  {
    id: "birth",
    number: 4,
    title: "예수님의 탄생",
    description: "우리에게 오신 예수님의 기쁜 탄생 이야기를 만나봐요.",
    image: `${STORY_ASSET_ROOT}/04-jesus-birth.png`,
    categories: ["all", "new", "person"],
    focus: { x: 50, y: 42 },
  },
  {
    id: "samaritan",
    number: 5,
    title: "선한 사마리아인",
    description: "이웃을 사랑하는 마음을 보여준 따뜻한 이야기예요.",
    image: `${STORY_ASSET_ROOT}/05-good-samaritan.png`,
    categories: ["all", "new", "person"],
    focus: { x: 52, y: 39 },
  },
  {
    id: "lost-sheep",
    number: 6,
    title: "잃어버린 양",
    description: "한 마리의 양도 소중히 찾으시는 사랑을 배워요.",
    image: `${STORY_ASSET_ROOT}/06-lost-sheep.png`,
    categories: ["all", "new", "person"],
    focus: { x: 50, y: 42 },
  },
  {
    id: "resurrection",
    number: 7,
    title: "부활하신 예수님",
    description: "죽음을 이기고 다시 살아나신 예수님의 기쁜 소식이에요.",
    image: `${STORY_ASSET_ROOT}/07-resurrection.png`,
    categories: ["all", "new", "miracle"],
    focus: { x: 50, y: 61 },
  },
  {
    id: "jesus-love",
    number: 8,
    title: "예수님의 사랑",
    description: "예수님이 우리를 얼마나 사랑하시는지 이야기로 만나봐요.",
    image: `${STORY_ASSET_ROOT}/09-jesus-love.png`,
    categories: ["all", "new", "person"],
    focus: { x: 52, y: 58 },
  },
  {
    id: "creation",
    number: 9,
    title: "천지창조",
    description: "하나님이 아름다운 세상을 만드신 이야기를 만나봐요.",
    image: `${STORY_ASSET_ROOT}/08-creation.png`,
    categories: ["all", "old", "miracle"],
    focus: { x: 50, y: 58 },
  },
  {
    id: "solomon",
    number: 10,
    title: "솔로몬의 지혜",
    description: "하나님께 지혜를 구한 솔로몬 왕의 이야기예요.",
    image: `${STORY_ASSET_ROOT}/10-solomon-wisdom.png`,
    categories: ["all", "old", "person"],
    focus: { x: 50, y: 52 },
  },
];

const FILTERS: Array<{ id: StoryFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "old", label: "구약" },
  { id: "new", label: "신약" },
  { id: "person", label: "인물" },
  { id: "miracle", label: "기적" },
];

function initialView(): StoryView {
  if (typeof window === "undefined") return "main";
  return new URLSearchParams(window.location.search).get("view") === "all" ? "all" : "main";
}

function StoryBrand() {
  return (
    <div className="bfs-brand">
      <span className="bfs-brand-mark" aria-hidden="true">
        <img src="/assets/bible-friend-mascot.svg" alt="" width="40" height="40" decoding="async" />
      </span>
      <strong>성경 친구</strong>
    </div>
  );
}

function StoryHeader({ all = false }: { all?: boolean }) {
  return (
    <header className={`bfs-header ${all ? "is-all" : ""}`}>
      <StoryBrand />
      <button type="button" className="bfs-settings" aria-label="스토리 설정">
        <SlidersHorizontal aria-hidden="true" />
      </button>
      <div className="bfs-heading-copy">
        <h1>{all ? "스토리 전체보기" : "스토리"}</h1>
        <p>
          하나님의 사랑이 담긴
          <br />
          {all ? "멋진 이야기들을 만나보아요!" : "이야기를 만나봐요!"}
        </p>
      </div>
      <img
        className="bfs-header-mascot"
        src="/assets/bible-friend-mascot.svg"
        alt=""
        width={all ? 96 : 112}
        height={all ? 96 : 112}
        decoding="async"
      />
      <i className="bfs-header-star one" aria-hidden="true">★</i>
      {!all && <i className="bfs-header-star two" aria-hidden="true">★</i>}
    </header>
  );
}

function FilterBar({ active, onChange }: { active: StoryFilter; onChange: (next: StoryFilter) => void }) {
  return (
    <div className="bfs-filters" role="tablist" aria-label="스토리 필터">
      {FILTERS.map(filter => (
        <button
          key={filter.id}
          type="button"
          role="tab"
          aria-selected={active === filter.id}
          className={active === filter.id ? "is-active" : ""}
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function StoryImage({ story, className = "" }: { story: StoryInfo; className?: string }) {
  const style: CSSProperties = { objectPosition: `${story.focus.x}% ${story.focus.y}%` };
  return <img className={className} src={story.image} alt="" loading="lazy" decoding="async" style={style} />;
}

function Hero({ story, onOpen }: { story: StoryInfo; onOpen: () => void }) {
  return (
    <section className="bfs-hero" aria-labelledby="bfs-hero-title">
      <div className="bfs-hero-image-wrap" aria-hidden="true">
        <img className="bfs-hero-image" src={story.image} alt="" fetchPriority="high" decoding="async" />
      </div>
      <div className="bfs-hero-gradient" aria-hidden="true" />
      <div className="bfs-hero-copy">
        <span className="bfs-today-badge">★&nbsp;&nbsp;오늘의 이야기</span>
        <h2 id="bfs-hero-title">{story.title}</h2>
        <p>용감한 소년 다윗이 하나님을 믿고<br />거인 골리앗을 이겨요!</p>
        <button type="button" onClick={onOpen}>
          <Play aria-hidden="true" fill="currentColor" />
          이야기 보기
        </button>
      </div>
    </section>
  );
}

function MainStoryCard({ story, onOpen }: { story: StoryInfo; onOpen?: () => void }) {
  return (
    <button type="button" className="bfs-main-card" onClick={onOpen} aria-label={`${story.title} 보기`}>
      <StoryImage story={story} className="bfs-main-card-image" />
      <strong>{story.title}</strong>
    </button>
  );
}

function RecommendationCard({ story, onOpen }: { story: StoryInfo; onOpen?: () => void }) {
  return (
    <button type="button" className="bfs-rec-card" onClick={onOpen} aria-label={`${story.title} 보기`}>
      <StoryImage story={story} className="bfs-rec-image" />
      <strong>{story.title}</strong>
    </button>
  );
}

function GridStoryCard({ story, onOpen }: { story: StoryInfo; onOpen?: () => void }) {
  return (
    <button type="button" className="bfs-grid-card" onClick={onOpen} aria-label={`${story.title} 보기`}>
      <StoryImage story={story} className="bfs-grid-image" />
      <span className="bfs-story-number">{story.number}</span>
      <span className="bfs-grid-scrim" aria-hidden="true" />
      <strong>{story.title}</strong>
    </button>
  );
}

export default function StoryExperience() {
  const [, navigate] = useLocation();
  const [view, setViewState] = useState<StoryView>(initialView);
  const [filter, setFilter] = useState<StoryFilter>("all");

  const filteredStories = useMemo(
    () => STORIES.filter(story => filter === "all" || story.categories.includes(filter)),
    [filter],
  );

  const openStory = (story: StoryInfo) => {
    if (story.route) navigate(story.route);
  };

  const setView = (next: StoryView) => {
    setViewState(next);
    if (typeof window !== "undefined") {
      const suffix = next === "all" ? "?view=all" : "";
      window.history.replaceState(window.history.state, "", `/story${suffix}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const hero = STORIES[0];
  const mainStories = (filter === "all" ? STORIES.slice(1, 7) : filteredStories.filter(story => story.id !== "david").slice(0, 6));
  const recommended = STORIES.slice(0, 4);

  return (
    <main className="bfs-route" data-design-source="figma:HHXt8qYYdgUwyaIbmO9US1">
      <section className="bfs-app">
        {view === "main" ? (
          <div className="bfs-page bfs-main-page" data-figma-node="168:3">
            <StoryHeader />
            <Hero story={hero} onOpen={() => openStory(hero)} />

            <div className="bfs-carousel-dots" aria-hidden="true"><i /><i /><i /></div>
            <FilterBar active={filter} onChange={setFilter} />

            <section className="bfs-story-section" aria-labelledby="bfs-all-stories-title">
              <div className="bfs-section-heading">
                <h2 id="bfs-all-stories-title"><Star aria-hidden="true" fill="currentColor" />모든 이야기</h2>
                <button type="button" onClick={() => setView("all")}>전체보기 <ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="bfs-main-grid">
                {mainStories.map(story => (
                  <MainStoryCard
                    key={story.id}
                    story={story}
                    onOpen={story.route ? () => openStory(story) : undefined}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="bfs-page bfs-all-page" data-figma-node="168:75">
            <StoryHeader all />

            <section className="bfs-recommended" aria-labelledby="bfs-recommended-title">
              <div className="bfs-recommended-heading">
                <h2 id="bfs-recommended-title"><Star aria-hidden="true" fill="currentColor" />추천 이야기</h2>
                <button type="button" onClick={() => setFilter("all")}>모두 보기 <ChevronRight aria-hidden="true" /></button>
              </div>
              <div className="bfs-recommended-grid">
                {recommended.map(story => (
                  <RecommendationCard
                    key={story.id}
                    story={story}
                    onOpen={story.route ? () => openStory(story) : undefined}
                  />
                ))}
              </div>
            </section>

            <FilterBar active={filter} onChange={setFilter} />

            <section className="bfs-catalog" aria-label="전체 스토리">
              {filteredStories.map(story => (
                <GridStoryCard
                  key={story.id}
                  story={story}
                  onOpen={story.route ? () => openStory(story) : undefined}
                />
              ))}
            </section>

            <button type="button" className="bfs-back-to-main" onClick={() => setView("main")}>스토리 메인으로</button>
          </div>
        )}
      </section>
    </main>
  );
}
