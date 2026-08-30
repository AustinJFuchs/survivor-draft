import { useState } from "react";
import { contestantBySlug, data, drafterColor } from "../data";
import { daysUntil, formatDate, ordinal } from "../lib/format";
import Chart from "./Chart";
import { ChevronIcon } from "./icons";
import { Photo, Points, SectionTitle, StatusPill } from "./ui";

export default function Standings({ onOpen }: { onOpen: (slug: string) => void }) {
  const { season, standings } = data;
  const days = daysUntil(season.premiereDate);
  const gone = data.eliminations.length;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <section className="space-y-4 sm:space-y-5">
      <SectionTitle sub={data.seasonStarted ? `${gone} eliminated · ${data.contestants.length - gone} remaining` : "Everyone starts at zero"}>
        Standings
      </SectionTitle>

      <div className="card p-3 sm:p-5 flex items-center gap-3 sm:gap-5 border-torch-500/40 bg-gradient-to-r from-torch-600/20 to-transparent">
        <div className="text-2xl sm:text-3xl">🏆</div>
        <div className="min-w-0">
          <div className="font-display text-xl sm:text-2xl text-torch-400 leading-none">{season.prize.title}</div>
          <div className="text-sm sm:text-base text-sand-100 mt-1">{season.prize.description}</div>
          <div className="text-[11px] sm:text-xs text-sand-400 mt-0.5">{season.prize.validUntil} Winner takes all.</div>
        </div>
      </div>

      {!data.seasonStarted && (
        <div className="card p-3 sm:p-4 text-sm text-sand-300">
          Season starts {days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "tonight"} — {formatDate(season.premiereDate, { weekday: "long" })}. Points begin
          with the first person voted out.
        </div>
      )}

      <ol className="space-y-2.5 sm:space-y-3">
        {standings.map((s) => {
          const color = drafterColor(s.drafterId);
          const picks = data.contestants.filter((c) => c.drafterId === s.drafterId).sort((a, b) => b.points.total - a.points.total);
          const isOpen = !!open[s.drafterId];
          return (
            <li key={s.drafterId} className="card overflow-hidden" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
              <button onClick={() => toggle(s.drafterId)} className="w-full text-left p-3 sm:p-4" aria-expanded={isOpen}>
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <div className="font-display text-3xl sm:text-5xl w-8 sm:w-14 text-center leading-none" style={{ color }}>
                    {s.rank}
                    {s.tied && <span className="text-[10px] sm:text-sm block text-sand-400">tie</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-2xl sm:text-3xl leading-none">{s.name}</div>
                    <div className="text-[11px] sm:text-xs text-sand-400 mt-1">
                      {s.remaining} of {picks.length} still in
                      {s.dropped && (
                        <>
                          {" "}
                          · best {season.handicap.countBest} count · raw {s.rawTotal}
                        </>
                      )}
                    </div>
                  </div>
                  <Points n={s.total} className="text-3xl sm:text-5xl" />
                  <ChevronIcon open={isOpen} width={18} height={18} className="text-sand-400 shrink-0" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex gap-1.5">
                  {picks.map((c) => {
                    const dropped = s.dropped === c.slug;
                    return (
                      <div
                        key={c.slug}
                        className={`relative shrink-0 w-12 sm:w-16 rounded-lg overflow-hidden ${c.status === "eliminated" ? "eliminated" : ""} ${dropped ? "opacity-50" : ""}`}
                      >
                        <Photo c={c} />
                        <div className="absolute bottom-0 inset-x-0 bg-night-950/80 text-[10px] text-center py-0.5 font-semibold">
                          {c.points.total}
                          {dropped && " ✕"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>
              {isOpen && (
                <ul className="border-t border-sand-300/10 divide-y divide-sand-300/10">
                  {picks.map((c) => {
                    const dropped = s.dropped === c.slug;
                    return (
                      <li key={c.slug}>
                        <button
                          onClick={() => onOpen(c.slug)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-night-700/50 ${c.status === "eliminated" ? "eliminated" : ""} ${dropped ? "opacity-60" : ""}`}
                        >
                          <Photo c={c} className="w-9 rounded-md shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold leading-tight truncate">
                              {c.name}
                              {c.pick && <span className="text-sand-400 font-normal"> · #{c.pick.overall}</span>}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              <StatusPill c={c} />
                              {dropped && <span className="chip text-sand-400">not counted</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-xl leading-none">{c.points.total}</div>
                            <div className="text-[10px] text-sand-400">
                              {c.points.survival}s{c.points.merge ? ` +${c.points.merge}m` : ""}
                              {c.points.finalTribal ? ` +${c.points.finalTribal}f` : ""}
                              {c.points.winner ? ` +${c.points.winner}w` : ""}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {data.milestones.winner && (
        <div className="card p-4 text-center">
          <div className="text-xs uppercase tracking-widest text-sand-400">Sole Survivor</div>
          <div className="font-display text-3xl text-torch-400">{contestantBySlug.get(data.milestones.winner)?.name}</div>
          <div className="text-sm text-sand-300">Final standings are official. {ordinal(1)} place takes the prize.</div>
        </div>
      )}

      {data.seasonStarted && <Chart />}
    </section>
  );
}
