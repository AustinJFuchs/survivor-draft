import { contestantBySlug, data, drafterColor } from "../data";
import { formatDate } from "../lib/format";
import { Photo, SectionTitle, StatusPill } from "./ui";

export default function DraftBoard({ onOpen }: { onOpen: (slug: string) => void }) {
  const { season, draft } = data;
  const drafters = [...season.drafters].sort((a, b) => a.draftPosition - b.draftPosition);
  const rounds = Math.max(0, ...draft.picks.map((p) => p.round));
  const byRound = new Map<number, typeof draft.picks>();
  for (const p of draft.picks) byRound.set(p.round, [...(byRound.get(p.round) ?? []), p]);
  const filled = draft.picks.filter((p) => p.contestantSlug).length;

  return (
    <section>
      <SectionTitle sub={`Snake draft · ${filled}/${data.season.totalContestants} picks · premiere ${formatDate(season.premiereDate)}`}>
        Draft Board
      </SectionTitle>

      {filled === 0 ? (
        <div className="card p-6 text-sand-300">
          Picks haven't been entered yet. Once <code className="text-torch-400">data/51/draft.json</code> is filled in, the board appears here.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin -mx-3 px-3">
          <table className="min-w-[640px] w-full border-separate border-spacing-1.5">
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
        </div>
      )}

      <p className="mt-4 text-sm text-sand-400">
        Order: {drafters.map((d) => d.name).join(" → ")}, snaking each round. 21 castaways ÷ 5 drafters leaves one leftover, which went to{" "}
        {drafters[0]?.name} along with their last pick — that's why they hold five and only their best {season.handicap.countBest} count.
      </p>
    </section>
  );
}
