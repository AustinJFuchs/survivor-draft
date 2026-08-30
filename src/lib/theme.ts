import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "s51-theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode */
  }
  return "dark";
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f4ead6" : "#07110f");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(read);
  useEffect(() => applyTheme(theme), [theme]);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  };
  return [theme, setTheme];
}
