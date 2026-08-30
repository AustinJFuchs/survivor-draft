import { data, drafterColor } from "../data";
import { ContestantCard, Points, SectionTitle } from "./ui";

export default function Rosters({ onOpen }: { onOpen: (slug: string) => void }) {
  const { standings, season } = data;
  return (
    <section>
      <SectionTitle sub="Tap a castaway for details">Rosters</SectionTitle>
      <div className="space-y-6">
        {standings.map((s) => {
          const picks = data.contestants
            .filter((c) => c.drafterId === s.drafterId)
            .sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
          return (
            <div key={s.drafterId}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-display text-3xl" style={{ color: drafterColor(s.drafterId) }}>
                  {s.name}
                  <span className="text-sand-400 text-lg ml-2">#{s.rank}</span>
                </h3>
                <div className="text-right">
                  <Points n={s.total} className="text-3xl" />
                  {s.dropped && (
                    <div className="text-[11px] text-sand-400">
                      best {season.handicap.countBest} count · raw {s.rawTotal}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
