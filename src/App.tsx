import { data } from "./data";
import { useHashRoute, type Tab } from "./lib/router";
import { formatDateTime } from "./lib/format";
import { useTheme } from "./lib/theme";
import { MeContext, useMe } from "./lib/me";
import Header from "./components/Header";
import { BottomTabs, TopTabs } from "./components/Nav";
import Standings from "./components/Standings";
import Rosters from "./components/Rosters";
import Cast from "./components/Cast";
import ContestantSheet from "./components/ContestantSheet";
import DrafterSheet from "./components/DrafterSheet";
import Episodes from "./components/Episodes";
import Rules from "./components/Rules";
import UpdateToast from "./components/UpdateToast";

export default function App() {
  const fallback: Tab = data.seasonStarted ? "standings" : "rosters";
  const [route, navigate] = useHashRoute(fallback);
  const [theme, setTheme] = useTheme();
  const [me, setMe] = useMe(data.season.drafters.map((d) => d.id));
  const openContestant = (slug: string) => navigate({ tab: "cast", contestant: slug });
  const openDrafter = (id: string) => navigate({ tab: "standings", drafter: id });
  const closeSheet = () => navigate({ tab: route.tab });
  const select = (tab: Tab) => {
    navigate({ tab });
    window.scrollTo({ top: 0 });
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <MeContext.Provider value={{ me, setMe }}>
    <div className="min-h-dvh flex flex-col pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0">
      <Header onOpenDrafter={openDrafter} />
      <TopTabs active={route.tab} onSelect={select} />

      <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-3 sm:py-8 flex-1">
        {route.tab === "standings" && <Standings onOpen={openContestant} onOpenDrafter={openDrafter} />}
        {route.tab === "rosters" && <Rosters onOpen={openContestant} onOpenDrafter={openDrafter} />}
        {route.tab === "cast" && <Cast onOpen={openContestant} />}
        {route.tab === "episodes" && <Episodes onOpen={openContestant} />}
        {route.tab === "rules" && <Rules theme={theme} onToggleTheme={toggleTheme} />}
      </main>

      <footer className="mx-auto max-w-6xl w-full px-4 py-5 text-[11px] sm:text-xs text-sand-400/80 flex flex-wrap gap-x-4 gap-y-1 justify-between items-center">
        <span>
          {data.syncedAt ? `Synced from Wikipedia ${formatDateTime(data.syncedAt)}` : "Not yet synced"} · built {formatDateTime(data.builtAt)}
        </span>
        <span className="flex items-center gap-3">
          <button onClick={toggleTheme} className="chip cursor-pointer" aria-label="Toggle light/dark theme">
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <span>Unofficial fan site. Photos & bios via Survivor Wiki / CBS.</span>
        </span>
      </footer>

      <BottomTabs active={route.tab} onSelect={select} />
      <UpdateToast />
      {route.contestant && <ContestantSheet slug={route.contestant} onClose={closeSheet} onOpen={openContestant} />}
      {route.drafter && <DrafterSheet id={route.drafter} onClose={closeSheet} onOpen={openContestant} />}
    </div>
    </MeContext.Provider>
  );
}
