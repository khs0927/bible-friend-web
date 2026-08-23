import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import "./story-experience.css";

type Category = "all" | "old" | "new" | "people" | "miracle";

type Story = {
  id: string;
  title: string;
  image: string;
  categories: Category[];
};

const STORY_ASSET = "/assets/story/generated";

const STORIES: Story[] = [
  { id: "david", title: "다윗과 골리앗", image: `${STORY_ASSET}/01-david-goliath.png`, categories: ["old", "people"] },
  { id: "noah", title: "노아의 방주", image: `${STORY_ASSET}/02-noah-ark.png`, categories: ["old", "people", "miracle"] },
  { id: "jonah", title: "요나와 큰 물고기", image: `${STORY_ASSET}/03-jonah-whale.png`, categories: ["old", "people", "miracle"] },
  { id: "birth", title: "예수님의 탄생", image: `${STORY_ASSET}/04-jesus-birth.png`, categories: ["new", "people", "miracle"] },
  { id: "samaritan", title: "선한 사마리아인", image: `${STORY_ASSET}/05-good-samaritan.png`, categories: ["new", "people"] },
  { id: "lost-sheep", title: "잃어버린 양", image: `${STORY_ASSET}/06-lost-sheep.png`, categories: ["new"] },
  { id: "resurrection", title: "부활하신 예수님", image: `${STORY_ASSET}/07-resurrection.png`, categories: ["new", "miracle"] },
  { id: "jesus-love", title: "예수님의 사랑", image: `${STORY_ASSET}/08-jesus-love.png`, categories: ["new", "people"] },
  { id: "creation", title: "천지창조", image: `${STORY_ASSET}/09-creation.png`, categories: ["old", "miracle"] },
  { id: "solomon", title: "솔로몬의 지혜", image: `${STORY_ASSET}/10-solomon-wisdom.png`, categories: ["old", "people"] },
];

const FILTERS: Array<{ id: Category; label: string }> = [
  { id: "all", label: "전체" },
  { id: "old", label: "구약" },
  { id: "new", label: "신약" },
  { id: "people", label: "인물" },
  { id: "miracle", label: "기적" },
];

const MAIN_CARD_IDS = ["noah", "jonah", "birth", "samaritan", "lost-sheep", "resurrection"];
const RECOMMENDED_IDS = ["david", "noah", "jonah", "birth"];
const MASCOT = "/assets/story-ui/v1/mascot/mascot-wave.png";

function Header({ allView = false }: { allView?: boolean }) {
  return (
    <header className={`bf-story-head ${allView ? "is-all" : ""}`}>
      <div className="bf-story-topline">
        <div className="bf-story-brand" aria-label="성경 친구">
          <span className="bf-story-brand-logo"><img src={MASCOT} alt="" /></span>
          <strong>성경 친구</strong>
        </div>
        <button
          type="button"
          className="bf-story-settings"
          aria-label="설정"
          onClick={() => window.dispatchEvent(new Event("bible-friend:open-settings"))}
        >
          <SlidersHorizontal aria-hidden="true" />
        </button>
      </div>

      <div className="bf-story-title-row">
        <div>
          <h1>{allView ? "스토리 전체보기" : "스토리"}</h1>
          <p>{allView ? <>하나님의 사랑이 담긴<br />멋진 이야기들을 만나보아요!</> : <>하나님의 사랑이 담긴<br />이야기를 만나봐요!</>}</p>
        </div>
        <img className="bf-story-header-mascot" src={MASCOT} alt="" />
        {!allView && <><span className="bf-story-star star-one">★</span><span className="bf-story-star star-two">★</span></>}
      </div>
    </header>
  );
}

function Filters({ active, onChange, allView = false }: { active: Category; onChange: (category: Category) => void; allView?: boolean }) {
  return (
    <div className={`bf-story-filters ${allView ? "is-all-view" : ""}`} role="tablist" aria-label="스토리 분류">
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

function StoryImage({ story, className = "" }: { story: Story; className?: string }) {
  return <img className={className} src={story.image} alt={story.title} loading="lazy" decoding="async" />;
}

function MainCard({ story, onOpen }: { story: Story; onOpen: (story: Story) => void }) {
  return (
    <button type="button" className="bf-story-main-card" onClick={() => onOpen(story)}>
      <StoryImage story={story} />
      <strong>{story.title}</strong>
    </button>
  );
}

function MainView({ filter, onFilter, onAll, onOpen }: { filter: Category; onFilter: (category: Category) => void; onAll: () => void; onOpen: (story: Story) => void }) {
  const david = STORIES[0];
  const cards = useMemo(() => {
    const base = filter === "all" ? MAIN_CARD_IDS.map(id => STORIES.find(story => story.id === id)!).filter(Boolean) : STORIES.filter(story => story.categories.includes(filter));
    return base.slice(0, 6);
  }, [filter]);

  return (
    <>
      <Header />
      <section className="bf-story-hero-card">
        <StoryImage story={david} className="bf-story-hero-image" />
        <div className="bf-story-hero-fade" aria-hidden="true" />
        <div className="bf-story-hero-copy">
          <span className="bf-story-today">★&nbsp;&nbsp;오늘의 이야기</span>
          <h2>다윗과 골리앗</h2>
          <p>용감한 소년 다윗이 하나님을 믿고<br />거인 골리앗을 이겨요!</p>
          <button type="button" onClick={() => onOpen(david)}>▶&nbsp;&nbsp;이야기 보기</button>
        </div>
      </section>

      <div className="bf-story-carousel-dots" aria-hidden="true"><i /><i /><i /></div>
      <Filters active={filter} onChange={onFilter} />

      <div className="bf-story-section-head">
        <h2>★&nbsp;&nbsp;모든 이야기</h2>
        <button type="button" onClick={onAll}>전체보기&nbsp;&nbsp;›</button>
      </div>
      <section className="bf-story-main-grid">
        {cards.map(story => <MainCard key={story.id} story={story} onOpen={onOpen} />)}
      </section>
    </>
  );
}

function Recommended({ onOpen }: { onOpen: (story: Story) => void }) {
  const stories = RECOMMENDED_IDS.map(id => STORIES.find(story => story.id === id)!).filter(Boolean);
  return (
    <section className="bf-story-recommended">
      <div className="bf-story-recommended-head"><h2>★&nbsp;&nbsp;추천 이야기</h2><span>모두 보기&nbsp;&nbsp;›</span></div>
      <div className="bf-story-recommended-grid">
        {stories.map(story => (
          <button type="button" key={story.id} onClick={() => onOpen(story)}>
            <StoryImage story={story} />
            <strong>{story.title}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function AllView({ filter, onFilter, onOpen }: { filter: Category; onFilter: (category: Category) => void; onOpen: (story: Story) => void }) {
  const visible = filter === "all" ? STORIES : STORIES.filter(story => story.categories.includes(filter));
  return (
    <>
      <Header allView />
      <Recommended onOpen={onOpen} />
      <Filters active={filter} onChange={onFilter} allView />
      <section className="bf-story-all-grid">
        {visible.map((story, index) => (
          <button type="button" className="bf-story-grid-card" key={story.id} onClick={() => onOpen(story)}>
            <span className="bf-story-grid-number">{index + 1}</span>
            <StoryImage story={story} />
            <strong>{story.title}</strong>
          </button>
        ))}
      </section>
    </>
  );
}

export default function StoryExperience() {
  const [location, navigate] = useLocation();
  const [filter, setFilter] = useState<Category>("all");
  const allView = location.includes("view=all") || (typeof window !== "undefined" && window.location.search.includes("view=all"));

  const openStory = (story: Story) => {
    if (story.id === "david") {
      navigate("/story/david");
      return;
    }
    window.dispatchEvent(new CustomEvent("bible-friend:story-selected", { detail: { id: story.id, title: story.title } }));
  };

  return (
    <main className="bf-story-route" data-design-source="figma:HHXt8qYYdgUwyaIbmO9US1" data-design-node={allView ? "168:75" : "168:3"}>
      <section className={`bf-story-app ${allView ? "is-all-view" : "is-main-view"}`}>
        <div className="bf-story-content">
          {allView ? (
            <AllView filter={filter} onFilter={setFilter} onOpen={openStory} />
          ) : (
            <MainView filter={filter} onFilter={setFilter} onAll={() => navigate("/story?view=all")} onOpen={openStory} />
          )}
        </div>
      </section>
    </main>
  );
}
