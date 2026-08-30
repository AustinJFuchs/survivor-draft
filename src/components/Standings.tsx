import { useState } from "react";
import { contestantBySlug, data, drafterColor } from "../data";
import { daysUntil, formatDate, ordinal } from "../lib/format";
import { BadgeRow, Popover } from "./Badges";
import Chart from "./Chart";
import { ChevronIcon } from "./icons";
import Paths from "./Paths";
import ShareButton from "./ShareButton";
import { Photo, Points, SectionTitle, StatusPill } from "./ui";
import WhatIf from "./WhatIf";
import RundownCard from "./RundownCard";
import ReviewCard from "./ReviewCard";
import { useMeContext } from "../lib/me";

export default function Standings({ onOpen, onOpenDrafter }: { onOpen: (slug: string) => void; onOpenDrafter: (id: string) => void }) {
  const { season, standings } = data;
  const days = daysUntil(season.premiereDate);
  const gone = data.eliminations.length;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const statsOf = (id: string) => data.drafterStats.find((s) => s.drafterId === id);
  const { me } = useMeContext();

  return (
    <section className="space-y-4 sm:space-y-5">
      <SectionTitle
        sub={
          <span className="inline-flex items-center gap-2">
            {data.seasonStarted ? `${gone} eliminated · ${data.contestants.length - gone} remaining` : "Everyone starts at zero"}
            <ShareButton card="standings.png" title={`${season.name} standings`} />
          </span>
        }
      >
        Standings
      </SectionTitle>

      {data.review ? <ReviewCard onOpen={onOpen} onOpenDrafter={onOpenDrafter} /> : data.latestRundown && <RundownCard rundown={data.latestRundown} onOpenDrafter={onOpenDrafter} />}

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
          const st = statsOf(s.drafterId);
          const proj = st?.projection;
          return (
            <li key={s.drafterId} className={`card overflow-hidden ${me === s.drafterId ? "me-glow" : ""}`} style={{ borderLeftColor: color, borderLeftWidth: 4, ["--me" as string]: color }}>
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <div className="font-display text-3xl sm:text-5xl w-8 sm:w-14 text-center leading-none" style={{ color }}>
                    {s.rank}
                    {s.tied && <span className="text-[10px] sm:text-sm block text-sand-400">tie</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => onOpenDrafter(s.drafterId)} className="font-display text-2xl sm:text-3xl leading-none hover:text-torch-400 transition text-left">
                        {s.name}
                        {me === s.drafterId && <span className="text-sm text-torch-400 ml-1.5">★ you</span>}
                      </button>
                      {st && <BadgeRow badges={st.badges} />}
                    </div>
                    {data.teams[s.drafterId]?.nickname && <div className="text-[11px] sm:text-xs italic text-sand-300 leading-tight">{data.teams[s.drafterId]!.nickname}</div>}
                    <div className="text-[11px] sm:text-xs text-sand-400 mt-1 flex flex-wrap gap-x-2">
                      <span>
                        {s.remaining} of {picks.length} still in
                        {s.dropped && (
                          <>
                            {" "}
                            · best {season.handicap.countBest} count · raw {s.rawTotal}
                          </>
                        )}
                      </span>
                      {data.seasonStarted && proj && (
                        <Popover
                          label="Outlook"
                          trigger={
                            <span className={proj.alive ? "text-sand-400 underline decoration-dotted" : "text-ember-500 underline decoration-dotted"}>
                              {proj.alive ? `${proj.onTable} on the table` : "out of contention"}
                            </span>
                          }
                        >
                          <span className="block text-sand-100 font-semibold">{proj.alive ? "Still in contention" : "Eliminated from contention"}</span>
                          <span className="block text-sand-300 mt-0.5">
                            Best case {proj.maxPossible} pts if every remaining castaway reaches the end and one wins. Leader has {proj.leaderTotal}.
                          </span>
                        </Popover>
                      )}
                    </div>
                  </div>
                  <Points n={s.total} className="text-3xl sm:text-5xl" />
                  <button onClick={() => toggle(s.drafterId)} aria-expanded={isOpen} aria-label="Show roster" className="p-1 -mr-1">
                    <ChevronIcon open={isOpen} width={18} height={18} className="text-sand-400 shrink-0" />
                  </button>
                </div>
                <button onClick={() => toggle(s.drafterId)} className="mt-2.5 sm:mt-3 flex gap-1.5 w-full text-left" aria-hidden>
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
                </button>
              </div>
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
                  <li className="px-3 py-2 text-xs">
                    <button onClick={() => onOpenDrafter(s.drafterId)} className="chip cursor-pointer" style={{ color }}>
                      Open {s.name}'s page →
                    </button>
                  </li>
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

      <WhatIf onOpen={onOpen} />
      <Paths onOpen={onOpen} />
      {data.seasonStarted && <Chart />}
    </section>
  );
}
