import { useMemo } from "react";
import { data } from "./data";
import { useHashRoute, type Tab } from "./lib/router";
import { formatDateTime } from "./lib/format";
import Header from "./components/Header";
import DraftBoard from "./components/DraftBoard";
import Leaderboard from "./components/Leaderboard";
import Rosters from "./components/Rosters";
import Contestants from "./components/Contestants";
import ContestantDrawer from "./components/ContestantDrawer";
import Episodes from "./components/Episodes";
import Chart from "./components/Chart";
import Rules from "./components/Rules";

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "leaderboard", label: "Leaderboard", short: "Board" },
  { id: "board", label: "Draft", short: "Draft" },
  { id: "rosters", label: "Rosters", short: "Rosters" },
  { id: "contestants", label: "Castaways", short: "Cast" },
  { id: "episodes", label: "Episodes", short: "Episodes" },
  { id: "chart", label: "Chart", short: "Chart" },
  { id: "rules", label: "Rules", short: "Rules" },
];

export default function App() {
  const fallback: Tab = data.seasonStarted ? "leaderboard" : "board";
  const [route, navigate] = useHashRoute(fallback);
  const tabs = useMemo(() => (data.seasonStarted ? TABS : [TABS[1]!, TABS[0]!, ...TABS.slice(2)]), []);
  const openContestant = (slug: string) => navigate({ tab: "contestants", contestant: slug });
  const closeContestant = () => navigate({ tab: route.tab });

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <nav className="sticky top-0 z-30 backdrop-blur bg-night-950/80 border-b border-sand-300/10">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 overflow-x-auto scrollbar-thin">
          <ul className="flex gap-1 py-2 min-w-max">
            {tabs.map((t) => {
              const active = route.tab === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => navigate({ tab: t.id })}
                    className={`font-display text-lg sm:text-xl tracking-wide px-3 sm:px-4 py-1.5 rounded-full transition ${
                      active ? "bg-torch-500 text-night-950 shadow-[0_0_20px_-4px_var(--color-torch-500)]" : "text-sand-200 hover:bg-night-700"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-5 sm:py-8 flex-1">
        {route.tab === "board" && <DraftBoard onOpen={openContestant} />}
        {route.tab === "leaderboard" && <Leaderboard onOpen={openContestant} />}
        {route.tab === "rosters" && <Rosters onOpen={openContestant} />}
        {route.tab === "contestants" && <Contestants onOpen={openContestant} />}
        {route.tab === "episodes" && <Episodes onOpen={openContestant} />}
        {route.tab === "chart" && <Chart />}
        {route.tab === "rules" && <Rules />}
      </main>

      <footer className="mx-auto max-w-6xl w-full px-4 py-6 text-xs text-sand-400/80 flex flex-wrap gap-x-4 gap-y-1 justify-between">
        <span>
          {data.syncedAt ? `Last synced from Wikipedia ${formatDateTime(data.syncedAt)}` : "Not yet synced"} · built {formatDateTime(data.builtAt)}
        </span>
        <span>Unofficial fan site. Photos & bios via Survivor Wiki / CBS.</span>
      </footer>

      {route.contestant && <ContestantDrawer slug={route.contestant} onClose={closeContestant} onOpen={openContestant} />}
    </div>
  );
}
