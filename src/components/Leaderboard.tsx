import { contestantBySlug, data, drafterColor } from "../data";
import { daysUntil, formatDate, ordinal } from "../lib/format";
import { Photo, Points, SectionTitle } from "./ui";

export default function Leaderboard({ onOpen }: { onOpen: (slug: string) => void }) {
  const { season, standings } = data;
  const days = daysUntil(season.premiereDate);
  const gone = data.eliminations.length;

  return (
    <section className="space-y-5">
      <SectionTitle sub={data.seasonStarted ? `${gone} eliminated · ${data.contestants.length - gone} remaining` : "Everyone starts at zero"}>
        Leaderboard
      </SectionTitle>

      <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-5 border-torch-500/40 bg-gradient-to-r from-torch-600/20 to-transparent">
        <div className="text-3xl">🏆</div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-display text-2xl text-torch-400 leading-none">{season.prize.title}</div>
          <div className="text-sand-100 mt-1">{season.prize.description}</div>
          <div className="text-xs text-sand-400 mt-0.5">{season.prize.validUntil} Winner takes all.</div>
        </div>
      </div>

      {!data.seasonStarted && (
        <div className="card p-4 text-sand-300">
          Season starts {days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "tonight"} — {formatDate(season.premiereDate, { weekday: "long" })}. Points begin
          with the first person voted out.
        </div>
      )}

      <ol className="space-y-3">
        {standings.map((s) => {
          const color = drafterColor(s.drafterId);
          const picks = data.contestants.filter((c) => c.drafterId === s.drafterId).sort((a, b) => b.points.total - a.points.total);
          return (
            <li key={s.drafterId} className="card p-3 sm:p-4" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="font-display text-4xl sm:text-5xl w-10 sm:w-14 text-center leading-none" style={{ color }}>
                  {s.rank}
                  {s.tied && <span className="text-sm block text-sand-400">tie</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-2xl sm:text-3xl leading-none">{s.name}</div>
                  <div className="text-xs text-sand-400 mt-1">
                    {s.remaining} of {picks.length} still in
                    {s.dropped && (
                      <>
                        {" "}
                        · best {season.handicap.countBest} of {picks.length} count · raw {s.rawTotal}
                      </>
                    )}
                  </div>
                </div>
                <Points n={s.total} className="text-4xl sm:text-5xl" />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
                {picks.map((c) => {
                  const dropped = s.dropped === c.slug;
                  return (
                    <button
                      key={c.slug}
                      onClick={() => onOpen(c.slug)}
                      title={`${c.name} · ${c.points.total} pts${dropped ? " (not counted)" : ""}`}
                      className={`relative shrink-0 w-14 sm:w-16 rounded-lg overflow-hidden ${c.status === "eliminated" ? "eliminated" : ""} ${dropped ? "opacity-50" : ""}`}
                    >
                      <Photo c={c} />
                      <div className="absolute bottom-0 inset-x-0 bg-night-950/80 text-[10px] text-center py-0.5 font-semibold">
                        {c.points.total}
                        {dropped && " ✕"}
                      </div>
                    </button>
                  );
                })}
              </div>
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
    </section>
  );
}
