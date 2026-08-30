import { useState } from "react";
import { data, drafterById, drafterColor } from "../data";
import { formatDate } from "../lib/format";
import type { Rundown } from "../lib/types";
import { ChevronIcon } from "./icons";
import { useMeContext } from "../lib/me";

/** "Jeff's State of the Draft" — latest on Standings, archived per episode on Episodes. */
export default function RundownCard({ rundown, onOpenDrafter, compact }: { rundown: Rundown; onOpenDrafter?: (id: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!!compact);
  const { me } = useMeContext();
  const when = rundown.episode ? `after Ep ${rundown.episode}` : "pre-season";
  const ep = rundown.episode ? data.episodes.find((e) => e.number === rundown.episode) : undefined;
  return (
    <section className="card overflow-hidden border-torch-500/30">
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-widest text-sand-400">
          <span className="text-base">🎙️</span>
          Jeff's State of the Draft · {when}
          {ep?.airDate && <span className="normal-case tracking-normal">· {formatDate(ep.airDate)}</span>}
        </div>
        <h3 className="font-display text-2xl sm:text-3xl leading-tight mt-1 torch-glow">{rundown.headline}</h3>
        <p className="text-sm text-sand-100 mt-2">{rundown.overview}</p>
        {!compact && (
          <button onClick={() => setOpen((o) => !o)} className="chip text-lagoon-400 cursor-pointer mt-2" aria-expanded={open}>
            {open ? "Hide the rundown" : "Read Jeff's full rundown"} <ChevronIcon open={open} width={14} height={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-sand-300/10 p-3 sm:p-4 space-y-3">
          <ol className="space-y-1.5">
            {rundown.lines.map((l, i) => {
              const d = drafterById.get(l.drafterId);
              const team = data.teams[l.drafterId];
              return (
                <li key={l.drafterId} className={`flex gap-2.5 text-sm rounded-md ${me === l.drafterId ? "bg-torch-500/10 -mx-2 px-2 py-1" : ""}`}>
                  <span className="font-display text-xl leading-none w-5 text-right" style={{ color: drafterColor(l.drafterId) }}>
                    {i + 1}
                  </span>
                  <span>
                    <button onClick={() => onOpenDrafter?.(l.drafterId)} className="font-semibold hover:text-torch-400" style={{ color: drafterColor(l.drafterId) }}>
                      {d?.name ?? l.drafterId}
                    </button>
                    {team?.nickname && <span className="text-sand-400 italic"> · {team.nickname}</span>} <span className="text-sand-200">{l.text}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {rundown.awards.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {rundown.awards.map((a) => (
                <div key={a.label} className="rounded-lg bg-night-900/60 p-2.5 text-sm" style={{ borderLeft: `3px solid ${drafterColor(a.drafterId)}` }}>
                  <div className="text-[10px] uppercase tracking-widest text-sand-400">{a.label}</div>
                  <div className="font-display text-xl leading-none" style={{ color: drafterColor(a.drafterId) }}>
                    {drafterById.get(a.drafterId)?.name}
                  </div>
                  <div className="text-sand-200 mt-1">{a.text}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-[10px] text-sand-400">{rundown.edited ? "Edited" : "AI-generated in Probst's voice"} · refreshes after each episode</div>
        </div>
      )}
    </section>
  );
}
