import type { ComponentType, SVGProps } from "react";
import type { Tab } from "../lib/router";
import { PalmIcon, RosterIcon, ScrollIcon, TrophyIcon, TvIcon } from "./icons";

export const TABS: { id: Tab; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "standings", label: "Standings", Icon: TrophyIcon },
  { id: "rosters", label: "Rosters", Icon: RosterIcon },
  { id: "cast", label: "Cast", Icon: PalmIcon },
  { id: "episodes", label: "Episodes", Icon: TvIcon },
  { id: "rules", label: "Rules", Icon: ScrollIcon },
];

export function TopTabs({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <nav className="hidden sm:block sticky top-0 z-30 backdrop-blur bg-night-950/80 border-b border-sand-300/10">
      <div className="mx-auto max-w-6xl px-4">
        <ul className="flex gap-1 py-2">
          {TABS.map(({ id, label, Icon }) => {
            const is = active === id;
            return (
              <li key={id}>
                <button
                  onClick={() => onSelect(id)}
                  aria-current={is ? "page" : undefined}
                  className={`flex items-center gap-2 font-display text-xl tracking-wide px-4 py-1.5 rounded-full transition ${
                    is ? "bg-torch-500 text-night-950 shadow-[0_0_20px_-4px_var(--color-torch-500)]" : "text-sand-200 hover:bg-night-700"
                  }`}
                >
                  <Icon width={18} height={18} />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function BottomTabs({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 bottom-bar" aria-label="Sections">
      <ul className="grid grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const is = active === id;
          return (
            <li key={id}>
              <button
                onClick={() => onSelect(id)}
                aria-current={is ? "page" : undefined}
                className={`w-full flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide transition ${
                  is ? "text-torch-400" : "text-sand-400"
                }`}
              >
                <span className={`rounded-full px-3 py-0.5 transition ${is ? "bg-torch-500/15" : ""}`}>
                  <Icon width={22} height={22} />
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
