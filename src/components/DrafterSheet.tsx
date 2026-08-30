import { useEffect, useRef } from "react";
import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { ordinal } from "../lib/format";
import { BadgeIcon } from "./Badges";
import Chart from "./Chart";
import { Photo, StatusPill } from "./ui";

const GRADE_COLOR: Record<string, string> = { A: "text-palm-400", B: "text-lagoon-400", C: "text-sand-200", D: "text-torch-400", F: "text-ember-500" };

export default function DrafterSheet({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (slug: string) => void }) {
  const d = drafterById.get(id);
  const stats = data.drafterStats.find((s) => s.drafterId === id);
  const standing = data.standings.find((s) => s.drafterId === id);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);
  if (!d || !stats || !standing) return null;

  const color = drafterColor(id);
  const roster = data.contestants.filter((c) => c.drafterId === id).sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
  const name = (s: string) => contestantBySlug.get(s)?.shortName ?? s;
  const onTouchStart = (e: React.TouchEvent) => (startY.current = e.touches[0]?.clientY ?? null);
  const onTouchEnd = (e: React.TouchEvent) => {
    const y = e.changedTouches[0]?.clientY ?? 0;
    if (startY.current !== null && y - startY.current > 80) onClose();
    startY.current = null;
  };
  const proj = stats.projection;
  const team = data.teams[id];
  const ages = roster.map((c) => c.age);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : undefined;
  const tribeCounts = new Map<string, number>();
  for (const c of roster) if (c.tribes.current) tribeCounts.set(c.tribes.current, (tribeCounts.get(c.tribes.current) ?? 0) + 1);
  const topScorer = [...roster].sort((a, b) => b.points.total - a.points.total)[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={d.name}>
      <div className="absolute inset-0 drawer-backdrop" onClick={onClose} />
      <aside
        ref={scrollRef}
        className="sheet relative w-full h-[92dvh] sm:h-full sm:max-w-md md:max-w-lg overflow-y-auto bg-night-900 border-t sm:border-t-0 sm:border-l border-sand-300/10 shadow-2xl rounded-t-2xl sm:rounded-none scrollbar-thin"
      >
        <div className="sticky top-0 z-10 bg-night-900/95 backdrop-blur border-b border-sand-300/10" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="sm:hidden mx-auto mt-2 h-1.5 w-12 rounded-full bg-sand-300/30" aria-hidden />
          <div className="flex items-center justify-between px-3 sm:px-4 py-2">
            <div className="text-xs uppercase tracking-widest text-sand-400">Drafter</div>
            <button onClick={onClose} className="chip text-sand-200 cursor-pointer">Close ✕</button>
          </div>
        </div>

        <div className="p-4 space-y-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-5xl leading-none torch-glow" style={{ color }}>
                {d.name}
              </div>
              <div className="text-sm text-sand-300 mt-1">
                {ordinal(standing.rank)}
                {standing.tied ? " (tied)" : ""} · {standing.remaining} of {roster.length} still in · drafted {ordinal(d.draftPosition)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-5xl leading-none">{standing.total}</div>
              <div className="text-[11px] text-sand-400">pts{standing.dropped ? ` · raw ${standing.rawTotal}` : ""}</div>
            </div>
          </div>

          <div className="card p-3 space-y-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-sand-400">
              <span>
                <span className="text-sand-100 font-semibold">{standing.remaining}</span> of {roster.length} still in
              </span>
              {avgAge !== undefined && (
                <span>
                  avg age <span className="text-sand-100 font-semibold">{avgAge}</span>
                </span>
              )}
              {tribeCounts.size > 0 && (
                <span>
                  {[...tribeCounts.entries()].map(([t, n]) => `${n} ${t}`).join(" / ")}
                </span>
              )}
              {topScorer && data.seasonStarted && (
                <span>
                  top scorer{" "}
                  <button className="text-sand-100 font-semibold underline decoration-sand-400/40" onClick={() => onOpen(topScorer.slug)}>
                    {topScorer.shortName}
                  </button>{" "}
                  ({topScorer.points.total})
                </span>
              )}
              {stats.gpa !== undefined && (
                <span>
                  GPA <span className="text-sand-100 font-semibold">{stats.gpa.toFixed(2)}</span>
                </span>
              )}
            </div>
            {team ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl">🎙️</span>
                  <div className="font-display text-2xl leading-none">Jeff on “{team.nickname}”</div>
                </div>
                <p className="text-sm text-sand-100">{team.summary}</p>
                {team.bullets.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {team.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-torch-400 shrink-0">{b.label}:</span>
                        <span className="text-sand-200">{b.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-[10px] text-sand-400">{team.edited ? "Edited" : "AI-generated in Probst's voice"} · refreshes when the team's situation changes</div>
              </>
            ) : (
              <p className="text-sm text-sand-400">Jeff's team notes are on their way.</p>
            )}
          </div>

          {stats.badges.length > 0 && (
            <div className="card p-3">
              <div className="text-xs uppercase tracking-widest text-sand-400 mb-2">Badges</div>
              <ul className="space-y-2">
                {stats.badges.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 text-sm">
                    <BadgeIcon badge={b} size="md" />
                    <div>
                      <div className="font-semibold text-sand-100">{b.name}</div>
                      <div className="text-sand-300">{b.rule}</div>
                      {b.detail && <div className="text-sand-400 text-xs">{b.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-3 space-y-1 text-sm">
            <div className="text-xs uppercase tracking-widest text-sand-400">Outlook</div>
            <div>
              <span className="font-semibold text-sand-100">{proj.onTable}</span> points still on the table · best case{" "}
              <span className="font-semibold text-sand-100">{proj.maxPossible}</span>
            </div>
            <div className={proj.alive ? "text-palm-400" : "text-ember-500"}>
              {proj.alive ? "Still in contention" : `Eliminated from contention — can't catch ${proj.leaderTotal}`}
            </div>
            {stats.paths.active && (
              <div className="text-sand-300">
                Wins {stats.paths.wins} of {stats.paths.scenarios} finale scenarios
                {stats.paths.clinch.length > 0 && <> · clinches if {stats.paths.clinch.map(name).join(", ")} wins</>}
              </div>
            )}
            {(stats.bestWeek || stats.worstWeek) && (
              <div className="text-sand-400 text-xs">
                {stats.bestWeek && (
                  <>
                    Best week: Ep {stats.bestWeek.episode} (+{stats.bestWeek.delta})
                  </>
                )}
                {stats.bestWeek && stats.worstWeek && " · "}
                {stats.worstWeek && (
                  <>
                    Worst: Ep {stats.worstWeek.episode} (+{stats.worstWeek.delta})
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h4 className="text-xs uppercase tracking-widest text-sand-400">Draft report card</h4>
              <div className="text-xs text-sand-400">
                {stats.gpa !== undefined && <>GPA {stats.gpa.toFixed(2)}</>}
                {stats.gradesEarly && <span className="ml-1 chip text-sand-400">early</span>}
              </div>
            </div>
            <ul className="card divide-y divide-sand-300/10">
              {roster.map((c) => {
                const g = stats.grades.find((x) => x.contestantSlug === c.slug);
                const dropped = standing.dropped === c.slug;
                return (
                  <li key={c.slug}>
                    <button onClick={() => onOpen(c.slug)} className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-night-700/50 ${c.status === "eliminated" ? "eliminated" : ""} ${dropped ? "opacity-60" : ""}`}>
                      <div className={`font-display text-2xl w-7 text-center ${g ? GRADE_COLOR[g.grade] : "text-sand-400"}`}>{g?.grade ?? "–"}</div>
                      <Photo c={c} className="w-9 rounded-md shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-tight truncate">
                          {c.name} <span className="text-sand-400 font-normal">· #{c.pick?.overall}{c.pick?.leftover ? " leftover" : ""}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1 items-center">
                          <StatusPill c={c} />
                          {g && <span className="text-[11px] text-sand-400">ranks {ordinal(g.rank)} of {data.contestants.length}</span>}
                          {dropped && <span className="chip text-sand-400">not counted</span>}
                        </div>
                      </div>
                      <div className="font-display text-xl">{c.points.total}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {(stats.steal || stats.reach) && (
              <div className="text-xs text-sand-400 mt-1.5 flex flex-wrap gap-x-3">
                {stats.steal && (
                  <span>
                    💎 Steal: {name(stats.steal.contestantSlug)} (#{stats.steal.pick.overall} → {ordinal(stats.steal.rank)})
                  </span>
                )}
                {stats.reach && (
                  <span>
                    🫣 Reach: {name(stats.reach.contestantSlug)} (#{stats.reach.pick.overall} → {ordinal(stats.reach.rank)})
                  </span>
                )}
              </div>
            )}
          </div>

          {data.seasonStarted && <Chart highlight={id} compact />}

          <div className="flex flex-wrap gap-1">
            {data.season.drafters
              .filter((x) => x.id !== id)
              .map((x) => (
                <button key={x.id} onClick={() => (window.location.hash = `#/drafter/${x.id}`)} className="chip cursor-pointer" style={{ color: drafterColor(x.id) }}>
                  {x.name}
                </button>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
