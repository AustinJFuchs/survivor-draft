import { useState } from "react";
import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { ordinal } from "../lib/format";
import { BadgeRow } from "./Badges";
import { ChevronIcon } from "./icons";
import ShareButton from "./ShareButton";

/** Replaces the weekly rundown once the Sole Survivor is known. */
export default function ReviewCard({ onOpen, onOpenDrafter }: { onOpen: (slug: string) => void; onOpenDrafter: (id: string) => void }) {
  const r = data.review;
  const [open, setOpen] = useState(false);
  if (!r) return null;
  const champs = r.champion.map((id) => drafterById.get(id)).filter(Boolean);
  const mvp = r.mvp ? contestantBySlug.get(r.mvp) : undefined;
  const line = (label: string, drafterId: string | undefined, slug: string | undefined, text: string | undefined, extra?: string) =>
    drafterId && (
      <div className="rounded-lg bg-night-900/60 p-2.5 text-sm" style={{ borderLeft: `3px solid ${drafterColor(drafterId)}` }}>
        <div className="text-[10px] uppercase tracking-widest text-sand-400">{label}</div>
        <div className="font-display text-xl leading-none">
          {slug && (
            <button onClick={() => onOpen(slug)} className="hover:text-torch-400">
              {contestantBySlug.get(slug)?.name}
            </button>
          )}{" "}
          <button onClick={() => onOpenDrafter(drafterId)} className="text-base" style={{ color: drafterColor(drafterId) }}>
            · {drafterById.get(drafterId)?.name}
          </button>
          {extra && <span className="text-sand-400 text-sm"> {extra}</span>}
        </div>
        {text && <div className="text-sand-200 mt-1">{text}</div>}
      </div>
    );

  return (
    <section className="card overflow-hidden border-torch-500/50">
      <div className="p-4 sm:p-5 bg-gradient-to-r from-torch-600/25 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] sm:text-xs uppercase tracking-widest text-sand-400">🏆 Season in review</div>
          <ShareButton card="recap.png" title={`${data.season.name} draft recap`} label="Share recap" />
        </div>
        <h3 className="font-display text-3xl sm:text-4xl leading-tight mt-1 torch-glow">{r.headline}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-sand-300">{champs.length > 1 ? "Co-champions" : "Champion"}:</span>
          {champs.map((d) => (
            <button key={d!.id} onClick={() => onOpenDrafter(d!.id)} className="font-display text-3xl leading-none" style={{ color: drafterColor(d!.id) }}>
              {d!.name}
            </button>
          ))}
          <span className="text-sm text-sand-300">— {data.season.prize.description}</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="chip text-lagoon-400 cursor-pointer mt-3" aria-expanded={open}>
          {open ? "Hide the review" : "Read Jeff's season review"} <ChevronIcon open={open} width={14} height={14} />
        </button>
      </div>
      {open && (
        <div className="border-t border-sand-300/10 p-4 sm:p-5 space-y-4">
          <p className="text-sm text-sand-100 whitespace-pre-line">{r.howItWent}</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {mvp && line("MVP castaway", mvp.drafterId, mvp.slug, r.mvpLine, `${mvp.points.total} pts`)}
            {r.pickOfYear && line("Pick of the year", r.pickOfYear.drafterId, r.pickOfYear.contestantSlug, r.pickLine, `#${r.pickOfYear.pick} → ${ordinal(r.pickOfYear.rank)}`)}
            {r.bustOfYear && line("Bust of the year", r.bustOfYear.drafterId, r.bustOfYear.contestantSlug, r.bustLine, `#${r.bustOfYear.pick} → ${ordinal(r.bustOfYear.rank)}`)}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-sand-400 mb-1">Final report cards & badges</div>
            <ul className="divide-y divide-sand-300/10">
              {data.standings.map((s) => {
                const st = data.drafterStats.find((x) => x.drafterId === s.drafterId)!;
                return (
                  <li key={s.drafterId} className="py-1.5 flex items-center gap-3 text-sm">
                    <span className="font-display text-xl w-5 text-right" style={{ color: drafterColor(s.drafterId) }}>
                      {s.rank}
                    </span>
                    <button onClick={() => onOpenDrafter(s.drafterId)} className="font-semibold" style={{ color: drafterColor(s.drafterId) }}>
                      {s.name}
                    </button>
                    <span className="text-sand-400">{s.total} pts{st.gpa !== undefined ? ` · GPA ${st.gpa.toFixed(2)}` : ""}{st.bestWeek ? ` · best week Ep ${st.bestWeek.episode} (+${st.bestWeek.delta})` : ""}</span>
                    <span className="flex-1" />
                    <BadgeRow badges={st.badges} />
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-sm text-torch-400 font-display text-xl">{r.signoff}</p>
          <div className="text-[10px] text-sand-400">{r.edited ? "Edited" : "AI-generated in Probst's voice"} · written once, after the finale</div>
        </div>
      )}
    </section>
  );
}
