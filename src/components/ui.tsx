import type { ReactNode } from "react";
import type { ContestantView, DraftPick } from "../lib/types";
import { drafterById, drafterColor, photoUrl } from "../data";
import { ordinal } from "../lib/format";

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-2xl sm:text-4xl text-sand-100">{children}</h2>
      {sub && <div className="text-xs sm:text-sm text-sand-400">{sub}</div>}
    </div>
  );
}

export function DrafterChip({ drafterId, size = "sm" }: { drafterId: string | undefined; size?: "sm" | "md" }) {
  const d = drafterId ? drafterById.get(drafterId) : undefined;
  if (!d) return <span className="chip text-sand-400">Undrafted</span>;
  return (
    <span className={`chip ${size === "md" ? "text-sm px-3 py-1" : ""}`} style={{ color: drafterColor(d.id) }}>
      <span className="inline-block size-2 rounded-full" style={{ background: drafterColor(d.id) }} />
      {d.name}
    </span>
  );
}

export function StatusPill({ c }: { c: ContestantView }) {
  if (c.winner) return <span className="chip text-torch-400">🏆 Sole Survivor</span>;
  if (c.finalist) return <span className="chip text-lagoon-400">Finalist{c.placement ? ` · ${ordinal(c.placement)}` : ""}</span>;
  if (c.elimination) {
    const e = c.elimination;
    const label =
      e.kind === "medevac" ? "Evacuated" : e.kind === "quit" ? "Quit" : e.kind === "fire" ? "Lost fire" : e.kind === "removed" ? "Removed" : "Voted out";
    return (
      <span className="chip text-ember-500">
        {label}
        {e.episode ? ` · Ep ${e.episode}` : ""}
        {c.placement ? ` · ${ordinal(c.placement)}` : ""}
      </span>
    );
  }
  return <span className="chip text-palm-400">In the game</span>;
}

export function TribeBadge({ tribe, muted }: { tribe: string | undefined; muted?: boolean }) {
  if (!tribe) return <span className={`chip ${muted ? "text-sand-400/60" : "text-sand-400"}`}>Tribe TBA</span>;
  return <span className="chip text-sand-200">{tribe}</span>;
}

export function PickLabel({ pick }: { pick: DraftPick | undefined }) {
  if (!pick) return null;
  return (
    <span className="text-xs text-sand-400">
      {pick.leftover ? "Leftover" : `Rd ${pick.round} · #${pick.overall}`}
    </span>
  );
}

export function Photo({ c, className = "", eager }: { c: ContestantView; className?: string; eager?: boolean }) {
  const url = photoUrl(c.photo);
  return (
    <div className={`photo-frame ${className}`}>
      {url ? <img src={url} alt={c.name} loading={eager ? "eager" : "lazy"} decoding="async" /> : <div className="w-full h-full grid place-items-center text-4xl">🌴</div>}
    </div>
  );
}

export function ContestantCard({
  c,
  onOpen,
  compact,
  extra,
}: {
  c: ContestantView;
  onOpen: (slug: string) => void;
  compact?: boolean;
  extra?: ReactNode;
}) {
  const gone = c.status === "eliminated";
  return (
    <button
      onClick={() => onOpen(c.slug)}
      className={`card text-left overflow-hidden group hover:border-torch-500/50 transition ${gone ? "eliminated" : ""}`}
      style={{ borderTopColor: drafterColor(c.drafterId), borderTopWidth: 3 }}
    >
      <Photo c={c} />
      <div className={`p-2.5 ${compact ? "space-y-1" : "space-y-1.5"}`}>
        <div className="font-semibold leading-tight text-sand-100 group-hover:text-torch-400 transition">
          {displayFirst(c)} <span className="text-sand-300 font-medium">{c.name.split(" ").slice(1).join(" ")}</span>
        </div>
        {!compact && (
          <div className="text-xs text-sand-400 leading-snug">
            {c.age} · {c.occupation}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          <StatusPill c={c} />
          {!compact && <TribeBadge tribe={c.tribes.current} muted />}
        </div>
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <DrafterChip drafterId={c.drafterId} />
          {extra}
        </div>
      </div>
    </button>
  );
}

/** "Jelly" Loblack, "Thien An" Nguyen — but Danny Kilby, not "Kilby Kilby". */
export function displayFirst(c: ContestantView): string {
  const [first, ...rest] = c.name.split(" ");
  const last = rest.join(" ");
  return c.nickname && c.nickname !== last ? c.nickname : first!;
}

export function Points({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`font-display tabular-nums ${className}`}>
      {n}
      <span className="text-[0.6em] text-sand-400 ml-0.5">pts</span>
    </span>
  );
}
