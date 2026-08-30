import { useEffect, useState } from "react";

export type Tab = "standings" | "rosters" | "cast" | "episodes" | "rules";

export interface Route {
  tab: Tab;
  contestant?: string;
}

const TABS: Tab[] = ["standings", "rosters", "cast", "episodes", "rules"];

/** Old hashes from the first version keep working. */
const LEGACY: Record<string, Tab> = {
  leaderboard: "standings",
  chart: "standings",
  board: "rosters",
  contestants: "cast",
};

export function parseHash(hash: string, fallback: Tab): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "contestant" && parts[1]) return { tab: "cast", contestant: decodeURIComponent(parts[1]) };
  const raw = parts[0] ?? "";
  const tab = TABS.includes(raw as Tab) ? (raw as Tab) : (LEGACY[raw] ?? fallback);
  return { tab };
}

export function useHashRoute(fallback: Tab): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash, fallback));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash, fallback));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [fallback]);
  const navigate = (r: Route) => {
    const hash = r.contestant ? `#/contestant/${encodeURIComponent(r.contestant)}` : `#/${r.tab}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    else setRoute(r);
  };
  return [route, navigate];
}
