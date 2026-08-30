import { data, drafterById, drafterColor } from "../data";
import { daysUntil, formatDate } from "../lib/format";
import { useMeContext } from "../lib/me";
import { FlameIcon } from "./icons";

function stat() {
  const { season } = data;
  const days = daysUntil(season.premiereDate);
  if (!data.seasonStarted) {
    return {
      label: "Premiere",
      big: days > 0 ? `${days} day${days === 1 ? "" : "s"}` : days === 0 ? "Tonight!" : "Aired",
      small: `${formatDate(season.premiereDate, { weekday: "short" })} · CBS`,
    };
  }
  const leaders = data.standings.filter((s) => s.rank === 1);
  const lead = leaders[0];
  return {
    label: leaders.length > 1 ? "Tied for the lead" : "In the lead",
    big: leaders.map((s) => s.name).join(" & "),
    small: `${lead?.total ?? 0} pts · ${data.eliminations.length} gone, ${data.contestants.length - data.eliminations.length} remain`,
  };
}

export default function Header({ onOpenDrafter }: { onOpenDrafter: (id: string) => void }) {
  const { season } = data;
  const s = stat();
  const { me } = useMeContext();
  const meDrafter = me ? drafterById.get(me) : undefined;
  const myTeam = meDrafter && (
    <button onClick={() => onOpenDrafter(meDrafter.id)} className="chip cursor-pointer" style={{ color: drafterColor(meDrafter.id) }} aria-label="My team">
      ★ My team
    </button>
  );
  return (
    <header className="relative overflow-hidden">
      {/* Mobile: one compact line that scrolls away with the page. */}
      <div className="sm:hidden px-3 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-2xl leading-none torch-glow flex items-center gap-1.5">
            <FlameIcon width={18} height={18} className="text-torch-500 flicker" />
            {season.name}
          </div>
          {season.subtitle && <div className="text-lagoon-400 font-display text-sm tracking-[0.18em] leading-none mt-0.5">{season.subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {myTeam}
          <div className="card px-3 py-1.5 text-right">
            <div className="text-[9px] uppercase tracking-widest text-sand-400 leading-none">{s.label}</div>
            <div className="font-display text-lg text-torch-400 leading-tight">{s.big}</div>
            <div className="text-[10px] text-sand-300 leading-none">{s.small}</div>
          </div>
        </div>
      </div>

      {/* Desktop hero. */}
      <div className="hidden sm:flex mx-auto max-w-6xl px-4 pt-10 pb-6 flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-display text-torch-400 text-xl tracking-[0.2em] uppercase flex items-center gap-2">
            <FlameIcon width={20} height={20} className="flicker" /> {season.groupName ?? "Draft"}
          </div>
          <h1 className="font-display text-7xl leading-none text-sand-100 torch-glow">
            {season.name}
            {season.subtitle && <span className="block text-lagoon-400 text-3xl tracking-[0.15em] mt-1">{season.subtitle}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {myTeam}
          <div className="card px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-widest text-sand-400">{s.label}</div>
            <div className="font-display text-3xl text-torch-400 leading-none mt-1">{s.big}</div>
            <div className="text-xs text-sand-300 mt-1">{s.small}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
