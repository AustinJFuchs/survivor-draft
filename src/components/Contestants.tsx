import { useMemo, useState } from "react";
import { data, drafterColor } from "../data";
import { ContestantCard, SectionTitle } from "./ui";

type Filter = "all" | "active" | "eliminated" | `d:${string}`;

export default function Contestants({ onOpen }: { onOpen: (slug: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"name" | "points" | "pick">("name");

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
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {chip("all", "All")}
        {data.seasonStarted && chip("active", "In the game")}
        {data.seasonStarted && chip("eliminated", "Out")}
        <span className="w-px h-5 bg-sand-300/20 mx-1" />
        {data.season.drafters.map((d) => chip(`d:${d.id}`, d.name, drafterColor(d.id)))}
        <span className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="bg-night-800 border border-sand-300/20 rounded-full text-xs px-3 py-1 text-sand-200"
        >
          <option value="name">Sort: name</option>
          <option value="points">Sort: points</option>
          <option value="pick">Sort: draft pick</option>
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {list.map((c) => (
          <ContestantCard key={c.slug} c={c} onOpen={onOpen} extra={<span className="text-xs font-semibold text-sand-200">{c.points.total} pts</span>} />
        ))}
      </div>
    </section>
  );
}
