import { useState } from "react";
import { data, drafterColor } from "../data";
import { formatDateTime } from "../lib/format";
import { meLink, useMeContext } from "../lib/me";
import { SectionTitle } from "./ui";

export default function Rules({ theme, onToggleTheme }: { theme: "dark" | "light"; onToggleTheme: () => void }) {
  const { season } = data;
  const { me, setMe } = useMeContext();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(meLink(id));
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };
  const { scoring, handicap } = season;
  const drafters = [...season.drafters].sort((a, b) => a.draftPosition - b.draftPosition);
  return (
    <section className="space-y-6 max-w-3xl">
      <SectionTitle>Rules</SectionTitle>

      <div className="card p-4 sm:p-5">
        <h3 className="font-display text-2xl mb-2">Scoring</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-sand-300/10">
              <td className="py-2">Each time someone is eliminated, every castaway still in the game earns</td>
              <td className="py-2 text-right font-display text-xl text-torch-400">+{scoring.perEliminationSurvived}</td>
            </tr>
            <tr className="border-b border-sand-300/10">
              <td className="py-2">Making the merge</td>
              <td className="py-2 text-right font-display text-xl text-torch-400">+{scoring.merge}</td>
            </tr>
            <tr className="border-b border-sand-300/10">
              <td className="py-2">Reaching Final Tribal Council</td>
              <td className="py-2 text-right font-display text-xl text-torch-400">+{scoring.finalTribal}</td>
            </tr>
            <tr>
              <td className="py-2">Winning Survivor {season.id}</td>
              <td className="py-2 text-right font-display text-xl text-torch-400">+{scoring.winner}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-sand-400 mt-3">
          "Eliminated" means any exit — voted out, evacuated, quit, or lost fire. A castaway earns points only while in the game; if the Open Era brings
          someone back, they simply resume earning.
        </p>
      </div>

      <div className="card p-4 sm:p-5 space-y-2 text-sm">
        <h3 className="font-display text-2xl">The draft</h3>
        <p>
          Snake draft in the order {drafters.map((d) => d.name).join(", ")}. With {season.totalContestants} castaways and {drafters.length} drafters, one
          leftover was assigned to {drafters[0]?.name} along with their final pick, giving them {handicap.countBest + 1} castaways.
        </p>
        <p>
          <span className="text-torch-400 font-semibold">Handicap:</span> only a drafter's best {handicap.countBest} castaways count toward their total. The
          leaderboard applies this from day one, so what you see is what the final standings use.
        </p>
        <p>
          <span className="text-torch-400 font-semibold">Ties</span> are shown as ties. "Still in" counts are displayed for bragging rights, not as a tiebreaker.
        </p>
        <p>Rosters are frozen — no trades, no waivers.</p>
      </div>

      <div className="card p-4 sm:p-5 space-y-1 text-sm">
        <h3 className="font-display text-2xl">{season.prize.title}</h3>
        <p>{season.prize.description}</p>
        <p className="text-sand-400">{season.prize.validUntil} No cash pot.</p>
      </div>

      {data.notes.length > 0 && (
        <div className="card p-4 sm:p-5 text-sm">
          <h3 className="font-display text-2xl mb-1">House notes</h3>
          <ul className="list-disc pl-5 space-y-1">
            {data.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4 sm:p-5 text-sm space-y-2">
        <h3 className="font-display text-2xl">Who are you?</h3>
        <p className="text-sand-300 text-xs">Pick yourself and this device highlights your team everywhere. Each drafter has a personal link you can text them.</p>
        <div className="flex flex-wrap gap-1.5">
          {season.drafters.map((d) => (
            <button key={d.id} onClick={() => setMe(me === d.id ? undefined : d.id)} className={`chip cursor-pointer ${me === d.id ? "bg-sand-100 !text-night-950 border-sand-100" : ""}`} style={me === d.id ? undefined : { color: drafterColor(d.id) }}>
              {me === d.id ? "★ " : ""}
              {d.name}
            </button>
          ))}
          {me && (
            <button onClick={() => setMe(undefined)} className="chip text-sand-400 cursor-pointer">
              Not me
            </button>
          )}
        </div>
        <ul className="text-xs text-sand-400 space-y-0.5">
          {season.drafters.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <span style={{ color: drafterColor(d.id) }}>{d.name}</span>
              <code className="text-sand-300 truncate">?me={d.id}</code>
              <button onClick={() => copy(d.id)} className="chip cursor-pointer text-sand-300">
                {copied === d.id ? "Copied" : "Copy link"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4 sm:p-5 text-sm space-y-1">
        <h3 className="font-display text-2xl">Widgets & data</h3>
        <p className="text-sand-300 text-xs">
          Standings on your home screen: iPhone via the free <span className="text-sand-100">Scriptable</span> app, Android via any web-widget app or KWGT.
        </p>
        <ul className="text-xs text-sand-300 space-y-0.5">
          <li>
            <a className="underline" href={`${import.meta.env.BASE_URL}widget.html`} target="_blank" rel="noreferrer">
              widget.html
            </a>{" "}
            — chrome-less standings page (pin it with a web-widget app)
          </li>
          <li>
            <a className="underline" href="https://github.com/AustinJFuchs/survivor-draft/blob/main/docs/widgets.md" target="_blank" rel="noreferrer">
              Setup guide + Scriptable script
            </a>
          </li>
          <li>
            <a className="underline" href={`${import.meta.env.BASE_URL}api/standings.json`} target="_blank" rel="noreferrer">
              api/standings.json
            </a>{" "}
            ·{" "}
            <a className="underline" href={`${import.meta.env.BASE_URL}api/season.json`} target="_blank" rel="noreferrer">
              api/season.json
            </a>
          </li>
        </ul>
      </div>

      <div className="card p-4 sm:p-5 text-sm flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Appearance</h3>
          <p className="text-sand-400 text-xs">Remembered on this device.</p>
        </div>
        <button onClick={onToggleTheme} className="chip text-sand-100 cursor-pointer text-sm px-3 py-1">
          {theme === "dark" ? "☀️ Switch to light" : "🌙 Switch to dark"}
        </button>
      </div>

      <div className="card p-4 sm:p-5 text-sm space-y-1">
        <h3 className="font-display text-2xl">Badges</h3>
        <p className="text-sand-300 text-xs">Awarded automatically after each episode. Tap a badge on the standings to see its rule.</p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-sand-300 mt-1">
          <li>🩸 First Blood · first drafter to lose a castaway</li>
          <li>🛡️ Untouchable · no castaway lost yet, after 3+ boots</li>
          <li>🔥 Torch Collector · most castaways voted out</li>
          <li>🤝 Merge Machine · whole roster made the merge</li>
          <li>🎟️ Leftover Luck · the leftover outscores a drafted pick</li>
          <li>📈 Comeback · last place to first</li>
          <li>🏁 Wire-to-Wire · led after every elimination</li>
          <li>👑 Kingmaker · drafted the Sole Survivor</li>
          <li>⚖️ Jury Duty · most jurors</li>
          <li>🏆 Immunity Hoarder · most individual immunity wins</li>
          <li>🗿 Idol Whisperer · most idols & advantages found</li>
        </ul>
      </div>

      <div className="card p-4 sm:p-5 text-xs text-sand-400 space-y-1">
        <h3 className="font-display text-xl text-sand-200">Where the data comes from</h3>
        <p>
          Boots, tribes, and milestones are pulled automatically from the visible tables on Wikipedia's Survivor {season.id} article after each episode.
          Bios, "3 words," and trivia come from the Survivor Wiki and are display-only. Jeff's commentary is generated from published recaps. Corrections are
          applied by hand when a source is wrong.
        </p>
        <p>{data.syncedAt ? `Last synced ${formatDateTime(data.syncedAt)}.` : "Not synced yet."}</p>
        {data.warnings.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer">Pipeline warnings ({data.warnings.length})</summary>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
