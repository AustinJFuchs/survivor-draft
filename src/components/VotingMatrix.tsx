import { useMemo, useState } from "react";
import { contestantBySlug, data, drafterColor } from "../data";
import { ChevronIcon } from "./icons";

interface Column {
  key: string;
  episode?: number;
  day?: number;
  eliminated: string[];
  tally?: string;
}

/** Who voted for whom at every Tribal Council. Built from each castaway's vote records. */
export default function VotingMatrix() {
  const [open, setOpen] = useState(false);
  const { columns, rows } = useMemo(() => {
    const colMap = new Map<string, Column>();
    for (const c of data.contestants) {
      for (const v of c.votes) {
        const key = `${v.episode ?? "?"}-${v.day ?? "?"}`;
        const col = colMap.get(key) ?? { key, episode: v.episode, day: v.day, eliminated: [], tally: v.tally };
        if (!col.tally && v.tally) col.tally = v.tally;
        colMap.set(key, col);
      }
    }
    for (const e of data.eliminations) {
      const key = `${e.episode ?? "?"}-${e.day ?? "?"}`;
      const col = colMap.get(key);
      if (col) col.eliminated.push(e.contestantSlug);
    }
    const columns = [...colMap.values()].sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0) || (a.day ?? 0) - (b.day ?? 0));
    // Rows: castaways ordered by finish (winner first), i.e. reverse elimination order.
    const elimOrder = new Map(data.eliminations.map((e) => [e.contestantSlug, e.order]));
    const rows = [...data.contestants].sort((a, b) => (elimOrder.get(b.slug) ?? 999) - (elimOrder.get(a.slug) ?? 999) || a.shortName.localeCompare(b.shortName));
    return { columns, rows };
  }, []);
  if (columns.length === 0) return null;

  return (
    <section className="card overflow-hidden mt-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 sm:p-4 flex items-center gap-3" aria-expanded={open}>
        <span className="text-2xl">🗳️</span>
        <span className="flex-1 min-w-0">
          <span className="font-display text-2xl sm:text-3xl leading-none block">Voting history</span>
          <span className="text-[11px] sm:text-xs text-sand-400">{columns.length} Tribal Councils · cells coloured by the target's drafter</span>
        </span>
        <ChevronIcon open={open} width={20} height={20} className="text-sand-400 shrink-0" />
      </button>
      {open && (
        <div className="border-t border-sand-300/10 overflow-x-auto scrollbar-thin">
          <table className="text-xs border-separate border-spacing-0 min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-night-800 text-left px-3 py-2 text-sand-400 font-medium">Voter</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-center font-medium text-sand-300 whitespace-nowrap">
                    <div>Ep {c.episode ?? "?"}</div>
                    <div className="text-[10px] text-sand-400">{c.day ? `Day ${c.day}` : ""}</div>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-night-800 text-left px-3 py-1 text-sand-400 font-medium">Out</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-1 text-center font-semibold whitespace-nowrap">
                    {c.eliminated.map((s) => (
                      <span key={s} className="chip text-ember-500 mr-0.5">
                        {contestantBySlug.get(s)?.shortName ?? s}
                      </span>
                    ))}
                    {c.tally && <div className="text-[10px] text-sand-400 font-normal">{c.tally}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} className="border-t border-sand-300/10">
                  <th className={`sticky left-0 z-10 bg-night-800 text-left px-3 py-1 font-semibold whitespace-nowrap ${r.status === "eliminated" ? "text-sand-400" : "text-sand-100"}`} style={{ borderLeft: `3px solid ${drafterColor(r.drafterId)}` }}>
                    {r.shortName}
                  </th>
                  {columns.map((c) => {
                    const v = r.votes.find((x) => `${x.episode ?? "?"}-${x.day ?? "?"}` === c.key);
                    const out = c.eliminated.includes(r.slug);
                    if (!v) return <td key={c.key} className={`px-2 py-1 text-center ${out ? "bg-ember-500/10" : ""}`} />;
                    const target = v.votedFor ? contestantBySlug.get(v.votedFor) : undefined;
                    return (
                      <td key={c.key} className={`px-2 py-1 text-center whitespace-nowrap ${out ? "bg-ember-500/10" : ""}`}>
                        {target ? (
                          <span className="chip" style={{ color: drafterColor(target.drafterId) }}>
                            {target.shortName}
                          </span>
                        ) : v.votedForText ? (
                          <span className="text-sand-400 italic">{v.votedForText}</span>
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
