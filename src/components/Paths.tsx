import { useState } from "react";
import { contestantBySlug, data, drafterColor } from "../data";
import { ChevronIcon } from "./icons";

/** Post-merge only: every finalist trio + winner enumerated at build time. */
export default function Paths({ onOpen }: { onOpen: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const stats = data.drafterStats.filter((s) => s.paths.active);
  if (stats.length === 0) return null;
  const scenarios = stats[0]!.paths.scenarios;
  const remaining = stats[0]!.paths.remaining;
  const name = (s: string) => contestantBySlug.get(s)?.shortName ?? s;
  const ordered = [...stats].sort((a, b) => b.paths.wins - a.paths.wins);

  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 sm:p-4 flex items-center gap-3" aria-expanded={open}>
        <span className="text-2xl">🧭</span>
        <span className="flex-1 min-w-0">
          <span className="font-display text-2xl sm:text-3xl leading-none block">Paths to victory</span>
          <span className="text-[11px] sm:text-xs text-sand-400">
            {remaining} left · {scenarios} finale scenarios · assumes the merge bonus is settled
          </span>
        </span>
        <ChevronIcon open={open} width={20} height={20} className="text-sand-400 shrink-0" />
      </button>
      {open && (
        <ol className="border-t border-sand-300/10 divide-y divide-sand-300/10">
          {ordered.map((s) => {
            const d = data.season.drafters.find((x) => x.id === s.drafterId)!;
            const pct = scenarios ? Math.round((s.paths.wins / scenarios) * 100) : 0;
            return (
              <li key={s.drafterId} className="p-3 sm:p-4 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="font-display text-2xl" style={{ color: drafterColor(d.id) }}>
                    {d.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-night-900 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: drafterColor(d.id) }} />
                  </div>
                  <div className="font-display text-xl tabular-nums w-16 text-right">
                    {pct}%<span className="text-[10px] text-sand-400 ml-1">({s.paths.wins}/{scenarios})</span>
                  </div>
                </div>
                {s.paths.wins === 0 ? (
                  <div className="text-sm text-sand-400">No finale outcome wins it. Mathematically out.</div>
                ) : (
                  <div className="text-sm text-sand-200 flex flex-wrap items-center gap-1">
                    {s.paths.clinch.length > 0 && (
                      <>
                        <span className="text-sand-400">Clinches if</span>
                        {s.paths.clinch.map((c) => (
                          <button key={c} onClick={() => onOpen(c)} className="chip text-palm-400 cursor-pointer">
                            👑 {name(c)}
                          </button>
                        ))}
                        <span className="text-sand-400">wins.</span>
                      </>
                    )}
                    {s.paths.live.length > 0 && (
                      <>
                        <span className="text-sand-400">{s.paths.clinch.length ? "Also alive if" : "Alive if"}</span>
                        {s.paths.live.map((c) => (
                          <button key={c} onClick={() => onOpen(c)} className="chip text-sand-200 cursor-pointer">
                            {name(c)}
                          </button>
                        ))}
                        <span className="text-sand-400">wins (depends on the other finalists).</span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
