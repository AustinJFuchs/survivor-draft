import { data } from "./data";
import { useHashRoute, type Tab } from "./lib/router";
import { formatDateTime } from "./lib/format";
import Header from "./components/Header";
import { BottomTabs, TopTabs } from "./components/Nav";
import Standings from "./components/Standings";
import Rosters from "./components/Rosters";
import Cast from "./components/Cast";
import ContestantSheet from "./components/ContestantSheet";
import Episodes from "./components/Episodes";
import Rules from "./components/Rules";

export default function App() {
  const fallback: Tab = data.seasonStarted ? "standings" : "rosters";
  const [route, navigate] = useHashRoute(fallback);
  const openContestant = (slug: string) => navigate({ tab: "cast", contestant: slug });
  const closeContestant = () => navigate({ tab: route.tab });
  const select = (tab: Tab) => {
    navigate({ tab });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0">
      <Header />
      <TopTabs active={route.tab} onSelect={select} />

      <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-3 sm:py-8 flex-1">
        {route.tab === "standings" && <Standings onOpen={openContestant} />}
        {route.tab === "rosters" && <Rosters onOpen={openContestant} />}
        {route.tab === "cast" && <Cast onOpen={openContestant} />}
        {route.tab === "episodes" && <Episodes onOpen={openContestant} />}
        {route.tab === "rules" && <Rules />}
      </main>

      <footer className="mx-auto max-w-6xl w-full px-4 py-5 text-[11px] sm:text-xs text-sand-400/80 flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>
          {data.syncedAt ? `Synced from Wikipedia ${formatDateTime(data.syncedAt)}` : "Not yet synced"} · built {formatDateTime(data.builtAt)}
        </span>
        <span>Unofficial fan site. Photos & bios via Survivor Wiki / CBS.</span>
      </footer>

      <BottomTabs active={route.tab} onSelect={select} />
      {route.contestant && <ContestantSheet slug={route.contestant} onClose={closeContestant} onOpen={openContestant} />}
    </div>
  );
}
