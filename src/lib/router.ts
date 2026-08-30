import { useEffect, useState } from "react";

export type Tab = "board" | "leaderboard" | "rosters" | "contestants" | "episodes" | "chart" | "rules";

export interface Route {
  tab: Tab;
  contestant?: string;
}

const TABS: Tab[] = ["board", "leaderboard", "rosters", "contestants", "episodes", "chart", "rules"];

export function parseHash(hash: string, fallback: Tab): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "contestant" && parts[1]) return { tab: "contestants", contestant: decodeURIComponent(parts[1]) };
  const tab = TABS.includes(parts[0] as Tab) ? (parts[0] as Tab) : fallback;
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
