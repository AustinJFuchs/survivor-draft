import { useState } from "react";
import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { useIsMobile } from "../lib/useMediaQuery";
import type { ContestantView, GameEvent } from "../lib/types";
import { ChevronIcon } from "./icons";
import { Photo } from "./ui";

export function eventGlyph(e: GameEvent): { glyph: string; label: string } {
  switch (e.type) {
    case "idol-found":
      return { glyph: "🗿", label: `found an idol${e.day ? ` (Day ${e.day})` : ""}` };
    case "idol-played":
      return { glyph: e.outcome === "success" ? "🛡️" : "💨", label: `played an idol${e.outcome === "success" ? " — saved" : e.outcome === "fail" ? " — wasted" : ""}` };
    case "idol-unused":
      return { glyph: "🪦", label: `idol never played${e.detail ? ` (${e.detail})` : ""}` };
    case "advantage-found":
      return { glyph: "🎁", label: `found ${e.advantage ?? "an advantage"}` };
    case "advantage-played":
      return { glyph: e.outcome === "fail" ? "❌" : "⚡", label: `played ${e.advantage ?? "an advantage"}${e.target ? ` on ${contestantBySlug.get(e.targetSlug ?? "")?.shortName ?? e.target}` : ""}${e.outcome === "fail" ? " — failed" : ""}` };
    case "advantage-unused":
      return { glyph: "🪦", label: `${e.advantage ?? "advantage"} never used` };
    case "shot-in-the-dark":
      return { glyph: e.outcome === "success" ? "🎲✅" : "🎲", label: `Shot in the Dark${e.outcome === "success" ? " — safe!" : e.outcome === "fail" ? " — not safe" : ""}` };
    case "journey":
      return { glyph: "🥾", label: "went on a journey" };
    default:
      return { glyph: "✨", label: e.advantage ? `${e.advantage}${e.detail ? ` — ${e.detail}` : ""}` : (e.detail ?? "twist") };
  }
}

function Markers({ c }: { c: ContestantView }) {
  if (c.events.length === 0) return null;
  return (
    <span className="inline-flex gap-0.5 text-sm" title={c.events.map((e) => eventGlyph(e).label).join("; ")}>
      {c.events.map((e) => (
        <span key={e.id}>{eventGlyph(e).glyph}</span>
      ))}
    </span>
  );
}

/** Every torch snuffed, in order, plus the living as unlit torches. */
export default function TorchWall({ onOpen }: { onOpen: (slug: string) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!isMobile);
  const gone = data.eliminations.map((e) => ({ e, c: contestantBySlug.get(e.contestantSlug)! })).filter((x) => x.c);
  const living = data.contestants.filter((c) => c.status !== "eliminated");
  const mergeEp = data.milestones.mergeEpisode;
  if (gone.length === 0) return null;

  const tile = (c: ContestantView, order?: number, sub?: string, lit = false) => {
    const d = c.drafterId ? drafterById.get(c.drafterId) : undefined;
    return (
      <button
        key={c.slug}
        onClick={() => onOpen(c.slug)}
        className={`text-left flex sm:flex-col items-center sm:items-stretch gap-2.5 sm:gap-1 card p-2 sm:w-24 shrink-0 ${lit ? "" : "eliminated"}`}
        style={{ borderTopColor: drafterColor(c.drafterId), borderTopWidth: 3 }}
      >
        <div className="relative w-12 sm:w-full shrink-0">
          <Photo c={c} className="rounded-md" />
          {order !== undefined && <div className="absolute -top-1.5 -left-1.5 size-6 rounded-full bg-ember-500 text-night-950 text-[11px] font-bold grid place-items-center">{order}</div>}
          {lit && <div className="absolute -top-1.5 -left-1.5 text-base">🔥</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm leading-tight truncate">{c.shortName}</div>
          <div className="text-[11px] text-sand-400 truncate">
            {sub}
            {d && (
              <>
                {" "}
                · <span style={{ color: drafterColor(d.id) }}>{d.name}</span>
              </>
            )}
          </div>
          <Markers c={c} />
        </div>
      </button>
    );
  };

  return (
    <section className="card overflow-hidden mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 sm:p-4 flex items-center gap-3" aria-expanded={open}>
        <span className="text-2xl">🕯️</span>
        <span className="flex-1 min-w-0">
          <span className="font-display text-2xl sm:text-3xl leading-none block">Torch wall</span>
          <span className="text-[11px] sm:text-xs text-sand-400">
            {gone.length} snuffed · {living.length} still burning{data.events.length ? ` · ${data.events.length} idols & advantages` : ""}
          </span>
        </span>
        <ChevronIcon open={open} width={20} height={20} className="text-sand-400 shrink-0" />
      </button>
      {open && (
        <div className="border-t border-sand-300/10 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-stretch">
            {gone.map(({ e, c }, i) => (
              <div key={c.slug} className="contents">
                {mergeEp !== undefined && e.episode !== undefined && e.episode >= mergeEp && (i === 0 || (gone[i - 1]!.e.episode ?? 0) < mergeEp) && (
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-lagoon-400 sm:w-full py-1">
                    <span className="flex-1 h-px bg-lagoon-400/40" />
                    Merge · Ep {mergeEp}
                    <span className="flex-1 h-px bg-lagoon-400/40" />
                  </div>
                )}
                {tile(c, e.order, `${e.placementText ?? "Out"}${e.episode ? ` · Ep ${e.episode}` : ""}${e.day ? ` · Day ${e.day}` : ""}`)}
              </div>
            ))}
            {living.length > 0 && (
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-torch-400 sm:w-full py-1">
                <span className="flex-1 h-px bg-torch-500/40" />
                {data.milestones.winner ? "Final Tribal Council" : "Still burning"}
                <span className="flex-1 h-px bg-torch-500/40" />
              </div>
            )}
            {living
              .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99) || b.points.total - a.points.total)
              .map((c) => tile(c, undefined, c.winner ? "Sole Survivor" : c.finalist ? "Finalist" : c.tribes.current ?? "In the game", true))}
          </div>
          <div className="text-[10px] text-sand-400 mt-2">🗿 idol found · 🛡️/💨 idol played · 🎁 advantage · ⚡/❌ advantage played · 🎲 Shot in the Dark · 🥾 journey · ✨ twist</div>
        </div>
      )}
    </section>
  );
}
