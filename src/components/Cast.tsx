import { useEffect, useMemo, useState } from "react";
import { data, drafterById, drafterColor } from "../data";
import { useIsMobile } from "../lib/useMediaQuery";
import { useMeContext } from "../lib/me";
import type { ContestantView } from "../lib/types";
import { ContestantCard, DrafterChip, Photo, SectionTitle, StatusPill, TribeBadge } from "./ui";

type Filter = "all" | "active" | "eliminated" | `d:${string}`;
type View = "list" | "grid";
type Group = "none" | "tribe" | "drafter";

function matches(c: ContestantView, q: string): boolean {
  if (!q) return true;
  const hay = [c.name, c.nickname, c.shortName, c.occupation, c.hometown, c.residence, c.tribes.current, ...c.tribes.history, c.drafterId ? drafterById.get(c.drafterId)?.name : ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t));
}

export default function Cast({ onOpen }: { onOpen: (slug: string) => void }) {
  const isMobile = useIsMobile();
  const { me } = useMeContext();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"name" | "points" | "pick">("name");
  const [view, setView] = useState<View>(isMobile ? "list" : "grid");
  const [touched, setTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("none");
  const tribesKnown = data.contestants.some((c) => c.tribes.current);
  useEffect(() => {
    if (!touched) setView(isMobile ? "list" : "grid");
  }, [isMobile, touched]);

  const list = useMemo(() => {
    let l = data.contestants;
    if (filter === "active") l = l.filter((c) => c.status !== "eliminated");
    else if (filter === "eliminated") l = l.filter((c) => c.status === "eliminated");
    else if (filter.startsWith("d:")) l = l.filter((c) => c.drafterId === filter.slice(2));
    l = l.filter((c) => matches(c, query.trim()));
    return [...l].sort((a, b) => {
      if (sort === "points") return b.points.total - a.points.total || a.name.localeCompare(b.name);
      if (sort === "pick") return (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99);
      return a.name.split(" ")[0]!.localeCompare(b.name.split(" ")[0]!);
    });
  }, [filter, sort, query]);

  const groups = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", color: undefined as string | undefined, items: list }];
    if (group === "tribe") {
      const m = new Map<string, ContestantView[]>();
      for (const c of list) {
        const k = c.tribes.current ?? "Tribe TBA";
        m.set(k, [...(m.get(k) ?? []), c]);
      }
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, items]) => ({ key: k, label: k, color: data.tribeColors[k], items }));
    }
    return data.season.drafters
      .map((d) => ({ key: d.id, label: d.name, color: drafterColor(d.id), items: list.filter((c) => c.drafterId === d.id) }))
      .filter((g) => g.items.length > 0);
  }, [group, list]);

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
  const seg = <T extends string>(value: T, options: { id: T; label: string }[], set: (v: T) => void, aria: string) => (
    <div className="flex rounded-full bg-night-800 border border-sand-300/15 p-0.5" role="group" aria-label={aria}>
      {options.map((o) => (
        <button key={o.id} onClick={() => set(o.id)} className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${value === o.id ? "bg-sand-100 text-night-950" : "text-sand-300"}`} aria-pressed={value === o.id}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const renderItems = (items: ContestantView[]) =>
    view === "grid" ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {items.map((c) => (
          <ContestantCard key={c.slug} c={c} onOpen={onOpen} extra={<span className="text-xs font-semibold text-sand-200">{c.points.total} pts</span>} />
        ))}
      </div>
    ) : (
      <ul className="space-y-1.5">
        {items.map((c) => (
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
    );

  return (
    <section>
      <SectionTitle sub={`${list.length} shown`}>Castaways</SectionTitle>
      <div className="mb-3 space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, job, hometown, tribe, drafter…"
          className="w-full rounded-full bg-night-800 border border-sand-300/20 px-4 py-2 text-sm text-sand-100 placeholder:text-sand-400 outline-none focus:border-torch-500/60"
          aria-label="Search castaways"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {chip("all", "All")}
          {me && chip(`d:${me}`, "★ Mine", drafterColor(me))}
          {data.seasonStarted && chip("active", "In the game")}
          {data.seasonStarted && chip("eliminated", "Out")}
          <span className="w-px h-5 bg-sand-300/20 mx-0.5" />
          {data.season.drafters.filter((d) => d.id !== me).map((d) => chip(`d:${d.id}`, d.name, drafterColor(d.id)))}
          <span className="flex-1" />
          {seg(
            group,
            [
              { id: "none", label: "All" },
              ...(tribesKnown ? [{ id: "tribe" as Group, label: "By tribe" }] : []),
              { id: "drafter", label: "By drafter" },
            ],
            setGroup,
            "Group",
          )}
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
          {seg(
            view,
            [
              { id: "list", label: "☰" },
              { id: "grid", label: "▦" },
            ],
            (v) => {
              setTouched(true);
              setView(v);
            },
            "View",
          )}
        </div>
      </div>

      {list.length === 0 && <div className="card p-5 text-sm text-sand-400">No castaways match “{query}”.</div>}

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && (
              <h3 className="font-display text-2xl mb-2 flex items-center gap-2" style={{ color: g.color }}>
                {g.color && <span className="inline-block size-3 rounded-full" style={{ background: g.color }} />}
                {g.label}
                <span className="text-sand-400 text-base">{g.items.length}</span>
              </h3>
            )}
            {renderItems(g.items)}
          </div>
        ))}
      </div>
    </section>
  );
}
