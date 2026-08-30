import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { data } from "../data";

const SEEN_KEY = "s51-last-build";

/**
 * Two signals, one toast:
 *  - the service worker found a newer build → "tap to refresh"
 *  - this build is newer than the last one this device saw → "Updated after Ep N"
 */
export default function UpdateToast() {
  const [refresh, setRefresh] = useState<(() => Promise<void>) | null>(null);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    let last: string | null = null;
    try {
      last = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, data.builtAt);
    } catch {
      /* ignore */
    }
    if (last && last !== data.builtAt) {
      setFresh(true);
      const t = setTimeout(() => setFresh(false), 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setRefresh(() => () => update(true));
      },
    });
  }, []);

  const latestEp = [...data.episodes].filter((e) => e.eliminations.length > 0).sort((a, b) => b.number - a.number)[0];
  if (!refresh && !fresh) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(76px+env(safe-area-inset-bottom))] sm:bottom-6 z-50">
      <button
        onClick={() => (refresh ? refresh() : setFresh(false))}
        className="card px-4 py-2.5 flex items-center gap-3 text-sm shadow-2xl border-torch-500/40 bg-night-800"
      >
        <span>🔥</span>
        <span>
          {refresh ? "New version available" : latestEp ? `Updated after Ep ${latestEp.number}` : "Updated"}
          {refresh && <span className="text-torch-400 font-semibold"> · tap to refresh</span>}
        </span>
      </button>
    </div>
  );
}
