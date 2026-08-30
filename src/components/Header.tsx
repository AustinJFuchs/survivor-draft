import { data } from "../data";
import { daysUntil, formatDate } from "../lib/format";

export default function Header() {
  const { season } = data;
  const days = daysUntil(season.premiereDate);
  const leader = data.standings[0];
  return (
    <header className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pt-7 pb-4 sm:pt-10 sm:pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-torch-400 text-lg sm:text-xl tracking-[0.2em] uppercase">
            <span className="flicker">🔥</span> {season.groupName ?? "Draft"}
          </div>
          <h1 className="font-display text-5xl sm:text-7xl leading-none text-sand-100 torch-glow">
            {season.name}
            {season.subtitle && <span className="block text-lagoon-400 text-2xl sm:text-3xl tracking-[0.15em] mt-1">{season.subtitle}</span>}
          </h1>
        </div>
        <div className="text-right">
          {!data.seasonStarted ? (
            <div className="card px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-sand-400">Premiere</div>
              <div className="font-display text-3xl text-torch-400 leading-none mt-1">
                {days > 0 ? `${days} day${days === 1 ? "" : "s"}` : days === 0 ? "Tonight!" : "Aired"}
              </div>
              <div className="text-xs text-sand-300 mt-1">{formatDate(season.premiereDate, { weekday: "short" })} · CBS</div>
            </div>
          ) : leader ? (
            <div className="card px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-sand-400">{leader.tied ? "Tied for the lead" : "In the lead"}</div>
              <div className="font-display text-3xl text-torch-400 leading-none mt-1">
                {data.standings.filter((s) => s.rank === 1).map((s) => s.name).join(" & ")}
              </div>
              <div className="text-xs text-sand-300 mt-1">
                {leader.total} pts · {data.eliminations.length} gone, {data.contestants.length - data.eliminations.length} remain
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
