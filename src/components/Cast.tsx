import { useEffect, useMemo, useState } from "react";
import { data, drafterColor } from "../data";
import { useIsMobile } from "../lib/useMediaQuery";
import { ContestantCard, DrafterChip, Photo, SectionTitle, StatusPill, TribeBadge } from "./ui";

type Filter = "all" | "active" | "eliminated" | `d:${string}`;
type View = "list" | "grid";

export default function Cast({ onOpen }: { onOpen: (slug: string) => void }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"name" | "points" | "pick">("name");
  const [view, setView] = useState<View>(isMobile ? "list" : "grid");
  const [touched, setTouched] = useState(false);
  // Follow the breakpoint until the user picks a view explicitly.
  useEffect(() => {
    if (!touched) setView(isMobile ? "list" : "grid");
  }, [isMobile, touched]);

  const list = useMemo(() => {
    let l = data.contestants;
    if (filter === "active") l = l.filter((c) => c.status !== "eliminated");
    else if (filter === "eliminated") l = l.filter((c) => c.status === "eliminated");
    else if (filter.startsWith("d:")) l = l.filter((c) => c.drafterId === filter.slice(2));
    return [...l].sort((a, b) => {
      if (sort === "points") return b.points.total - a.points.total || a.name.localeCompare(b.name);
      if (sort === "pick") return (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99);
      return a.name.split(" ")[0]!.localeCompare(b.name.split(" ")[0]!);
    });
  }, [filter, sort]);

  const chip = (id: Filter, label: string, color?: string) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className={`chip cursor-pointer transition ${filter === id ? "bg-sand-100 !text-night-950 border-sand-100" : ""}`}
      style={filter === id ? undefined : { color: color ?? "var(--color-sand-200)" }}
    >
      {label}
    </button>
  );

  return (
    <section>
      <SectionTitle sub={`${list.length} shown`}>Castaways</SectionTitle>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {chip("all", "All")}
        {data.seasonStarted && chip("active", "In the game")}
        {data.seasonStarted && chip("eliminated", "Out")}
        <span className="w-px h-5 bg-sand-300/20 mx-0.5" />
        {data.season.drafters.map((d) => chip(`d:${d.id}`, d.name, drafterColor(d.id)))}
        <span className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="bg-night-800 border border-sand-300/20 rounded-full text-xs px-3 py-1 text-sand-200"
          aria-label="Sort"
        >
          <option value="name">Sort: name</option>
          <option value="points">Sort: points</option>
          <option value="pick">Sort: draft pick</option>
        </select>
        <div className="flex rounded-full bg-night-800 border border-sand-300/15 p-0.5" role="group" aria-label="View">
          {(["list", "grid"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setTouched(true);
                setView(v);
              }}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${view === v ? "bg-sand-100 text-night-950" : "text-sand-300"}`}
              aria-pressed={view === v}
            >
              {v === "list" ? "☰" : "▦"}
            </button>
          ))}
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
          {list.map((c) => (
            <ContestantCard key={c.slug} c={c} onOpen={onOpen} extra={<span className="text-xs font-semibold text-sand-200">{c.points.total} pts</span>} />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {list.map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => onOpen(c.slug)}
                className={`card w-full text-left flex items-center gap-2.5 p-2 hover:border-torch-500/50 transition ${c.status === "eliminated" ? "eliminated" : ""}`}
                style={{ borderLeftColor: drafterColor(c.drafterId), borderLeftWidth: 4 }}
              >
                <Photo c={c} className="w-12 rounded-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight truncate">
                    {c.name}
                    {c.nickname && <span className="text-sand-400 font-normal"> “{c.nickname}”</span>}
                  </div>
                  <div className="text-[11px] text-sand-400 truncate">
                    {c.age} · {c.occupation} · {c.residence ?? c.hometown}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <StatusPill c={c} />
                    <TribeBadge tribe={c.tribes.current} muted />
                    <DrafterChip drafterId={c.drafterId} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-xl leading-none">{c.points.total}</div>
                  <div className="text-[10px] text-sand-400">{c.pick ? `#${c.pick.overall}` : "—"}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
