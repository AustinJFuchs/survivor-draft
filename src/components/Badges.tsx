import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Badge } from "../lib/types";

/**
 * Tap (or hover) explainer. Renders the trigger inline and a small popover
 * anchored beneath it; closes on outside tap / Escape.
 */
export function Popover({ trigger, children, label }: { trigger: ReactNode; children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex group/pop">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </button>
      <span
        role="tooltip"
        className={`popover absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-40 w-56 rounded-xl border border-sand-300/15 bg-night-800 p-2.5 text-left text-xs shadow-xl ${
          open ? "block" : "hidden group-hover/pop:block"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

export function BadgeIcon({ badge, size = "sm" }: { badge: Badge; size?: "sm" | "md" }) {
  const dim = size === "md" ? "size-9 text-lg" : "size-6 text-[13px]";
  return (
    <Popover
      label={badge.name}
      trigger={<span className={`badge-ring ${dim} grid place-items-center rounded-full`}>{badge.emoji}</span>}
    >
      <span className="block font-semibold text-sand-100">
        {badge.emoji} {badge.name}
      </span>
      <span className="block text-sand-300 mt-0.5">{badge.rule}</span>
      {badge.detail && <span className="block text-sand-400 mt-0.5">{badge.detail}</span>}
    </Popover>
  );
}

export function BadgeRow({ badges, size }: { badges: Badge[]; size?: "sm" | "md" }) {
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {badges.map((b) => (
        <BadgeIcon key={b.id} badge={b} size={size} />
      ))}
    </span>
  );
}
