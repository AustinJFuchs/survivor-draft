import { contestantBySlug, data, drafterColor } from "../data";
import { DrafterChip, Photo, StatusPill } from "./ui";

/** Desktop: the classic 5-column snake grid. */
export function DraftGrid({ onOpen }: { onOpen: (slug: string) => void }) {
  const { season, draft } = data;
  const drafters = [...season.drafters].sort((a, b) => a.draftPosition - b.draftPosition);
  const rounds = Math.max(0, ...draft.picks.map((p) => p.round));
  const byRound = new Map<number, typeof draft.picks>();
  for (const p of draft.picks) byRound.set(p.round, [...(byRound.get(p.round) ?? []), p]);

  return (
    <table className="w-full border-separate border-spacing-1.5">
      <thead>
        <tr>
          <th className="w-10" />
          {drafters.map((d) => (
            <th key={d.id} className="font-display text-2xl tracking-wide pb-1" style={{ color: drafterColor(d.id) }}>
              {d.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
          const picks = byRound.get(round) ?? [];
          return (
            <tr key={round}>
              <td className="font-display text-xl text-sand-400 text-center align-middle">R{round}</td>
              {drafters.map((d) => {
                const pick = picks.find((p) => p.drafterId === d.id);
                const c = pick?.contestantSlug ? contestantBySlug.get(pick.contestantSlug) : undefined;
                if (!pick) return <td key={d.id} className="card bg-night-900/40 opacity-40" />;
                return (
                  <td key={d.id} className="align-top p-0">
                    {c ? (
                      <button
                        onClick={() => onOpen(c.slug)}
                        className={`card w-full text-left flex gap-2 p-1.5 hover:border-torch-500/50 transition ${c.status === "eliminated" ? "eliminated" : ""}`}
                      >
                        <Photo c={c} className="w-12 shrink-0 rounded-md" />
                        <div className="min-w-0 flex flex-col gap-1">
                          <div className="text-[10px] uppercase tracking-wider text-sand-400">
                            #{pick.overall}
                            {pick.leftover && " · leftover"}
                          </div>
                          <div className="font-semibold text-sm leading-tight truncate">{c.nickname ?? c.name}</div>
                          <StatusPill c={c} />
                        </div>
                      </button>
                    ) : (
                      <div className="card p-2 text-sand-400 text-sm">#{pick.overall} — TBD</div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Mobile: every pick in order, round dividers, nothing hidden. */
export function DraftList({ onOpen }: { onOpen: (slug: string) => void }) {
  const picks = [...data.draft.picks].sort((a, b) => a.overall - b.overall);
  let lastRound = 0;
  return (
    <ol className="space-y-1.5">
      {picks.map((pick) => {
        const c = pick.contestantSlug ? contestantBySlug.get(pick.contestantSlug) : undefined;
        const divider = pick.round !== lastRound;
        lastRound = pick.round;
        return (
          <li key={pick.overall}>
            {divider && (
              <div className="font-display text-lg text-sand-400 tracking-wide pt-2 pb-1 flex items-center gap-2">
                Round {pick.round}
                <span className="flex-1 h-px bg-sand-300/10" />
              </div>
            )}
            {c ? (
              <button
                onClick={() => onOpen(c.slug)}
                className={`card w-full text-left flex items-center gap-2.5 p-2 ${c.status === "eliminated" ? "eliminated" : ""}`}
                style={{ borderLeftColor: drafterColor(pick.drafterId), borderLeftWidth: 4 }}
              >
                <div className="font-display text-xl w-8 text-center text-sand-400 leading-none">{pick.overall}</div>
                <Photo c={c} className="w-11 rounded-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight truncate">{c.name}</div>
                  <div className="text-[11px] text-sand-400 truncate">
                    {c.age} · {c.occupation}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <DrafterChip drafterId={pick.drafterId} />
                    <StatusPill c={c} />
                    {pick.leftover && <span className="chip text-sand-400">leftover</span>}
                  </div>
                </div>
                <div className="font-display text-lg text-sand-200 shrink-0">{c.points.total}</div>
              </button>
            ) : (
              <div className="card p-2 text-sand-400 text-sm">#{pick.overall} — TBD</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
