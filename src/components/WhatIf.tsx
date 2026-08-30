import { useEffect, useMemo, useState } from "react";
import { contestantBySlug, data, drafterColor } from "../data";
import { simulate } from "../lib/analysis";
import { ChevronIcon } from "./icons";
import { Photo } from "./ui";
import { useMeContext } from "../lib/me";

/** Parse/format the scenario in the URL hash query: #/standings?boots=a,b&merge=1&winner=c */
function readScenario(): { boots: string[]; mergeNow: boolean; winner?: string } {
  const q = window.location.hash.split("?")[1] ?? "";
  const p = new URLSearchParams(q);
  const boots = (p.get("boots") ?? "").split(",").filter((s) => contestantBySlug.has(s));
  return { boots, mergeNow: p.get("merge") === "1", winner: p.get("winner") && contestantBySlug.has(p.get("winner")!) ? p.get("winner")! : undefined };
}

function writeScenario(s: { boots: string[]; mergeNow: boolean; winner?: string }) {
  const base = window.location.hash.split("?")[0] || "#/standings";
  const p = new URLSearchParams();
  if (s.boots.length) p.set("boots", s.boots.join(","));
  if (s.mergeNow) p.set("merge", "1");
  if (s.winner) p.set("winner", s.winner);
  const q = p.toString();
  history.replaceState(null, "", q ? `${base}?${q}` : base);
}

export default function WhatIf({ onOpen }: { onOpen: (slug: string) => void }) {
  const initial = useMemo(readScenario, []);
  const [open, setOpen] = useState(initial.boots.length > 0 || initial.mergeNow || !!initial.winner);
  const [boots, setBoots] = useState<string[]>(initial.boots);
  const [mergeNow, setMergeNow] = useState(initial.mergeNow);
  const [winner, setWinner] = useState<string | undefined>(initial.winner);
  const [copied, setCopied] = useState(false);

  useEffect(() => writeScenario({ boots, mergeNow, winner }), [boots, mergeNow, winner]);

  const gone = new Set(data.eliminations.map((e) => e.contestantSlug));
  const remaining = data.contestants.filter((c) => !gone.has(c.slug));
  const mergeAlready = data.milestones.merged.length > 0;
  const base = { contestantSlugs: data.contestants.map((c) => c.slug), eliminations: data.eliminations, milestones: data.milestones, scoring: data.season.scoring };
  const rows = useMemo(
    () => simulate({ base, drafters: data.season.drafters, picks: data.draft.picks, handicap: data.season.handicap, boots, mergeNow: mergeNow || mergeAlready, winner }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boots, mergeNow, winner],
  );
  const current = new Map(data.standings.map((s) => [s.drafterId, s]));
  const dirty = boots.length > 0 || mergeNow || !!winner;
  const { me } = useMeContext();
  const mine = me ? rows.find((r) => r.drafterId === me) : undefined;
  const mineDelta = mine ? mine.total - (current.get(me!)?.total ?? 0) : 0;

  const toggleBoot = (slug: string) => {
    setBoots((b) => (b.includes(slug) ? b.filter((x) => x !== slug) : [...b, slug]));
    if (winner === slug) setWinner(undefined);
  };
  const reset = () => {
    setBoots([]);
    setMergeNow(false);
    setWinner(undefined);
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "What if…", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 sm:p-4 flex items-center gap-3" aria-expanded={open}>
        <span className="text-2xl">🔮</span>
        <span className="flex-1 min-w-0">
          <span className="font-display text-2xl sm:text-3xl leading-none block">What if…</span>
          <span className="text-[11px] sm:text-xs text-sand-400">
            {dirty ? `${boots.length} boot${boots.length === 1 ? "" : "s"}${mergeNow && !mergeAlready ? " · merge" : ""}${winner ? ` · ${contestantBySlug.get(winner)?.shortName} wins` : ""}` : "Tap castaways in the order they go home and watch the standings move"}
          </span>
        </span>
        <ChevronIcon open={open} width={20} height={20} className="text-sand-400 shrink-0" />
      </button>

      {open && (
        <div className="border-t border-sand-300/10 p-3 sm:p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-widest text-sand-400">Next to go (tap in order)</div>
              <div className="flex gap-1">
                {dirty && (
                  <button onClick={share} className="chip text-lagoon-400 cursor-pointer">
                    {copied ? "Link copied" : "Share"}
                  </button>
                )}
                <button onClick={reset} className="chip text-sand-300 cursor-pointer" disabled={!dirty}>
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 gap-1.5">
              {remaining.map((c) => {
                const idx = boots.indexOf(c.slug);
                const booted = idx >= 0;
                return (
                  <button
                    key={c.slug}
                    onClick={() => toggleBoot(c.slug)}
                    className={`relative rounded-lg overflow-hidden text-left transition ${booted ? "eliminated ring-2 ring-ember-500" : "hover:ring-2 hover:ring-torch-500/60"} ${winner === c.slug ? "ring-2 ring-torch-400" : ""}`}
                    style={{ borderTop: `3px solid ${drafterColor(c.drafterId)}` }}
                    aria-pressed={booted}
                  >
                    <Photo c={c} />
                    <div className="absolute inset-x-0 bottom-0 bg-night-950/85 px-1 py-0.5 text-[10px] font-semibold truncate">{c.shortName}</div>
                    {booted && <div className="absolute top-1 left-1 size-5 rounded-full bg-ember-500 text-night-950 text-[10px] font-bold grid place-items-center">{idx + 1}</div>}
                    {winner === c.slug && <div className="absolute top-1 right-1 text-sm">👑</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {!mergeAlready && (
              <label className="chip text-sand-200 cursor-pointer">
                <input type="checkbox" className="accent-[var(--color-torch-500)]" checked={mergeNow} onChange={(e) => setMergeNow(e.target.checked)} />
                Merge happens now (+{data.season.scoring.merge} to everyone still in)
              </label>
            )}
            <label className="chip text-sand-200 cursor-pointer">
              👑 Winner:
              <select
                value={winner ?? ""}
                onChange={(e) => setWinner(e.target.value || undefined)}
                className="bg-transparent text-sand-100 outline-none"
              >
                <option value="">— nobody yet —</option>
                {remaining
                  .filter((c) => !boots.includes(c.slug))
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.shortName}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {mine && dirty && (
            <div className="rounded-lg bg-torch-500/10 border border-torch-500/30 px-3 py-2 text-sm flex items-center justify-between">
              <span>
                ★ You'd be <span className="font-semibold">{mine.rank}{mine.tied ? " (tied)" : ""}</span> with {mine.total} pts
              </span>
              <span className={mineDelta > 0 ? "text-palm-400" : mineDelta < 0 ? "text-ember-500" : "text-sand-400"}>{mineDelta > 0 ? `+${mineDelta}` : mineDelta}</span>
            </div>
          )}
          <ol className="space-y-1.5">
            {rows.map((r) => {
              const now = current.get(r.drafterId);
              const delta = r.total - (now?.total ?? 0);
              const moved = now ? now.rank - r.rank : 0;
              return (
                <li key={r.drafterId} className="flex items-center gap-3 rounded-lg bg-night-900/60 px-3 py-2" style={{ borderLeft: `4px solid ${drafterColor(r.drafterId)}` }}>
                  <div className="font-display text-2xl w-6 text-center" style={{ color: drafterColor(r.drafterId) }}>
                    {r.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-xl leading-none">{r.name}</div>
                    <div className="text-[11px] text-sand-400">
                      {r.remaining} still in
                      {moved !== 0 && <span className={moved > 0 ? "text-palm-400" : "text-ember-500"}> · {moved > 0 ? `▲ ${moved}` : `▼ ${-moved}`}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl leading-none">{r.total}</div>
                    {dirty && <div className={`text-[11px] ${delta > 0 ? "text-palm-400" : delta < 0 ? "text-ember-500" : "text-sand-400"}`}>{delta > 0 ? `+${delta}` : delta}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-sand-400">
            Scenario only — nothing is saved. Tap a castaway twice to un-boot them; tap a name in the cast to open their sheet{" "}
            <button className="underline" onClick={() => remaining[0] && onOpen(remaining[0].slug)}>
              (e.g. {remaining[0]?.shortName})
            </button>
            .
          </p>
        </div>
      )}
    </section>
  );
}
