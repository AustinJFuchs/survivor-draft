import { useState } from "react";
import { data, drafterColor } from "../data";
import { formatDate } from "../lib/format";
import { useIsMobile } from "../lib/useMediaQuery";
import { DraftGrid, DraftList } from "./DraftBoard";
import { ContestantCard, Photo, Points, SectionTitle, StatusPill, TribeBadge } from "./ui";

type Mode = "drafter" | "pick";

export default function Rosters({ onOpen, onOpenDrafter }: { onOpen: (slug: string) => void; onOpenDrafter: (id: string) => void }) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>(data.seasonStarted ? "drafter" : "pick");
  const { standings, season, draft } = data;
  const drafters = [...season.drafters].sort((a, b) => a.draftPosition - b.draftPosition);
  const filled = draft.picks.filter((p) => p.contestantSlug).length;

  return (
    <section>
      <SectionTitle
        sub={
          <div className="flex items-center gap-1 rounded-full bg-night-800 border border-sand-300/15 p-0.5">
            {(["drafter", "pick"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${mode === m ? "bg-sand-100 text-night-950" : "text-sand-300"}`}
              >
                {m === "drafter" ? "By drafter" : "By pick"}
              </button>
            ))}
          </div>
        }
      >
        {mode === "drafter" ? "Rosters" : "Draft Board"}
      </SectionTitle>

      {mode === "pick" ? (
        <>
          <p className="text-[11px] sm:text-sm text-sand-400 mb-3">
            Snake draft · {filled}/{season.totalContestants} picks · order {drafters.map((d) => d.name).join(" → ")} · premiere {formatDate(season.premiereDate)}
          </p>
          {filled === 0 ? (
            <div className="card p-6 text-sand-300">Picks haven't been entered yet.</div>
          ) : isMobile ? (
            <DraftList onOpen={onOpen} />
          ) : (
            <DraftGrid onOpen={onOpen} />
          )}
          <p className="mt-4 text-[11px] sm:text-sm text-sand-400">
            21 castaways ÷ 5 drafters leaves one leftover, which went to {drafters[0]?.name} with their last pick — so they hold five and only their best{" "}
            {season.handicap.countBest} count.
          </p>
        </>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {standings.map((s) => {
            const picks = data.contestants.filter((c) => c.drafterId === s.drafterId).sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
            return (
              <div key={s.drafterId}>
                <div className="flex items-baseline justify-between mb-2">
                  <button onClick={() => onOpenDrafter(s.drafterId)} className="font-display text-2xl sm:text-3xl text-left hover:text-torch-400 transition" style={{ color: drafterColor(s.drafterId) }}>
                    {s.name}
                    <span className="text-sand-400 text-base sm:text-lg ml-2">#{s.rank}</span>
                  </button>
                  <div className="text-right">
                    <Points n={s.total} className="text-2xl sm:text-3xl" />
                    {s.dropped && (
                      <div className="text-[11px] text-sand-400">
                        best {season.handicap.countBest} count · raw {s.rawTotal}
                      </div>
                    )}
                  </div>
                </div>
                {isMobile ? (
                  <ul className="space-y-1.5">
                    {picks.map((c) => {
                      const dropped = s.dropped === c.slug;
                      return (
                        <li key={c.slug}>
                          <button
                            onClick={() => onOpen(c.slug)}
                            className={`card w-full text-left flex items-center gap-2.5 p-2 ${c.status === "eliminated" ? "eliminated" : ""} ${dropped ? "opacity-60" : ""}`}
                            style={{ borderLeftColor: drafterColor(s.drafterId), borderLeftWidth: 4 }}
                          >
                            <Photo c={c} className="w-11 rounded-md shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold leading-tight truncate">
                                {c.name}
                                {c.pick && <span className="text-sand-400 font-normal"> · #{c.pick.overall}</span>}
                              </div>
                              <div className="text-[11px] text-sand-400 truncate">
                                {c.age} · {c.occupation}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <StatusPill c={c} />
                                <TribeBadge tribe={c.tribes.current} muted />
                                {dropped && <span className="chip text-sand-400">not counted</span>}
                              </div>
                            </div>
                            <div className="font-display text-xl text-sand-200 shrink-0">{c.points.total}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {picks.map((c) => {
                      const dropped = s.dropped === c.slug;
                      return (
                        <div key={c.slug} className={dropped ? "opacity-60" : ""}>
                          <ContestantCard
                            c={c}
                            onOpen={onOpen}
                            compact
                            extra={
                              <span className="text-xs font-semibold text-sand-200">
                                {c.points.total} pts{dropped && <span className="text-sand-400"> · dropped</span>}
                              </span>
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
