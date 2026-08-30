import { createContext, useContext, useEffect, useState } from "react";

export const MeContext = createContext<{ me: string | undefined; setMe: (id: string | undefined) => void }>({ me: undefined, setMe: () => {} });
export const useMeContext = () => useContext(MeContext);

const KEY = "s51-me";

/** `?me=tami` in the query (before or after the hash) claims this device; stored in localStorage. */
export function readMeFromUrl(validIds: string[]): string | undefined {
  const search = new URLSearchParams(window.location.search);
  const hashQ = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const v = search.get("me") ?? hashQ.get("me");
  return v && validIds.includes(v) ? v : undefined;
}

export function useMe(validIds: string[]): [string | undefined, (id: string | undefined) => void] {
  const [me, setMeState] = useState<string | undefined>(() => {
    const fromUrl = readMeFromUrl(validIds);
    if (fromUrl) {
      try {
        localStorage.setItem(KEY, fromUrl);
      } catch {
        /* ignore */
      }
      // Drop the query so the hash router stays clean and the link isn't re-applied on reload.
      const clean = window.location.pathname + (window.location.hash.split("?")[0] || "");
      history.replaceState(null, "", clean);
      return fromUrl;
    }
    try {
      const v = localStorage.getItem(KEY);
      return v && validIds.includes(v) ? v : undefined;
    } catch {
      return undefined;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.me = me ?? "";
  }, [me]);
  const setMe = (id: string | undefined) => {
    setMeState(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };
  return [me, setMe];
}

export function meLink(id: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?me=${encodeURIComponent(id)}`;
}
