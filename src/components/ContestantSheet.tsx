import { useEffect, useRef, useState } from "react";
import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { formatDate, ordinal } from "../lib/format";
import type { ContestantView } from "../lib/types";
import { DrafterChip, Photo, StatusPill, TribeBadge } from "./ui";
import { eventGlyph } from "./TorchWall";

/**
 * Castaway detail. On phones it's a bottom sheet (~92% tall, grab handle,
 * swipe-down to dismiss); from `sm` up it's a right-side drawer. Same content.
 */
export default function ContestantSheet({ slug, onClose, onOpen }: { slug: string; onClose: () => void; onOpen: (slug: string) => void }) {
  const c = contestantBySlug.get(slug);
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
  }, [slug]);
  if (!c) return null;

  const order = data.contestants.map((x) => x.slug);
  const i = order.indexOf(slug);
  const prev = order[(i - 1 + order.length) % order.length]!;
  const next = order[(i + 1) % order.length]!;
  const drafter = c.drafterId ? drafterById.get(c.drafterId) : undefined;
  const standing = data.standings.find((s) => s.drafterId === c.drafterId);
  const rosterMates = data.contestants.filter((x) => x.drafterId && x.drafterId === c.drafterId && x.slug !== c.slug).sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
  const { scoring } = data.season;
  const name = (s: string) => contestantBySlug.get(s)?.shortName ?? s;

  const onTouchStart = (e: React.TouchEvent) => (startY.current = e.touches[0]?.clientY ?? null);
  const onTouchEnd = (e: React.TouchEvent) => {
    const y = e.changedTouches[0]?.clientY ?? 0;
    if (startY.current !== null && y - startY.current > 80) onClose();
    startY.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={c.name}>
      <div className="absolute inset-0 drawer-backdrop" onClick={onClose} />
      <aside
        ref={scrollRef}
        className="sheet relative w-full h-[92dvh] sm:h-full sm:max-w-md md:max-w-lg overflow-y-auto bg-night-900 border-t sm:border-t-0 sm:border-l border-sand-300/10 shadow-2xl rounded-t-2xl sm:rounded-none scrollbar-thin"
      >
        <div className="sticky top-0 z-10 bg-night-900/95 backdrop-blur border-b border-sand-300/10" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="sm:hidden mx-auto mt-2 h-1.5 w-12 rounded-full bg-sand-300/30" aria-hidden />
          <div className="flex items-center justify-between px-3 sm:px-4 py-2">
            <div className="flex gap-1">
              <button onClick={() => onOpen(prev)} className="chip text-sand-300 cursor-pointer">← Prev</button>
              <button onClick={() => onOpen(next)} className="chip text-sand-300 cursor-pointer">Next →</button>
            </div>
            <button onClick={onClose} className="chip text-sand-200 cursor-pointer">Close ✕</button>
          </div>
        </div>

        {/* Hero */}
        <div className={`relative ${c.status === "eliminated" ? "eliminated" : ""}`}>
          <Photo c={c} eager className="w-full !aspect-[4/3] sm:!aspect-[3/2]" />
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-night-900 via-night-900/70 to-transparent">
            <div className="font-display text-3xl sm:text-4xl leading-none torch-glow">{c.name}</div>
            {c.nickname && <div className="text-sand-300 text-sm">"{c.nickname}"</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <StatusPill c={c} />
              <TribeBadge tribe={c.tribes.current} />
              {c.merged && <span className="chip text-lagoon-400">Merged</span>}
              {c.elimination?.juryMember && <span className="chip text-sand-200">Jury</span>}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* Facts */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row k="Age" v={c.ageOnDayOne && c.ageOnDayOne !== c.age ? `${c.age} (${c.ageOnDayOne} this season)` : String(c.age)} />
            {c.extras?.birthdate && <Row k="Birthday" v={formatDate(c.extras.birthdate, { year: undefined })} />}
            <Row k="Occupation" v={c.occupation} />
            <Row k="Hometown" v={c.hometown} />
            {c.residence && c.residence !== c.hometown && <Row k="Lives in" v={c.residence} />}
            {c.tribes.history.length > 0 && <Row k="Tribes" v={c.tribes.history.join(" → ")} />}
            {c.extras?.threeWords && <Row k="In 3 words" v={c.extras.threeWords.join(", ")} />}
            {c.extras?.alliances && c.extras.alliances.length > 0 && <Row k="Alliances" v={c.extras.alliances.join(", ")} />}
            {c.placement && <Row k="Finish" v={`${ordinal(c.placement)} of ${data.contestants.length}`} />}
            {c.extras?.daysLasted && <Row k="Days" v={c.extras.daysLasted} />}
          </dl>

          {/* Draft */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-sand-400">Drafted by</div>
              <DrafterChip drafterId={c.drafterId} size="md" />
            </div>
            {c.pick && (
              <div className="text-sm text-sand-300">
                {c.pick.leftover ? `Leftover pick (#${c.pick.overall}), assigned to ${drafter?.name}` : `Round ${c.pick.round}, pick #${c.pick.overall} overall`}
                {(c.pickBefore || c.pickAfter) && (
                  <span className="text-sand-400">
                    {" "}
                    · between{" "}
                    {c.pickBefore ? (
                      <button className="underline decoration-sand-400/40" onClick={() => onOpen(c.pickBefore!.contestantSlug)}>
                        {name(c.pickBefore.contestantSlug)} (#{c.pickBefore.overall}, {drafterById.get(c.pickBefore.drafterId)?.name})
                      </button>
                    ) : (
                      "start"
                    )}{" "}
                    and{" "}
                    {c.pickAfter ? (
                      <button className="underline decoration-sand-400/40" onClick={() => onOpen(c.pickAfter!.contestantSlug)}>
                        {name(c.pickAfter.contestantSlug)} (#{c.pickAfter.overall}, {drafterById.get(c.pickAfter.drafterId)?.name})
                      </button>
                    ) : (
                      "the end"
                    )}
                  </span>
                )}
              </div>
            )}
            {standing && (
              <div className="text-sm text-sand-300">
                {c.counted === false ? (
                  <span className="text-ember-500">Currently the dropped score for {drafter?.name} (best {data.season.handicap.countBest} count).</span>
                ) : (
                  <>
                    <span className="text-sand-100 font-semibold">{c.points.total}</span> of {drafter?.name}'s {standing.total} counted points
                    {c.rosterRank && <> · {c.rosterRank === 1 ? "top scorer" : `${ordinal(c.rosterRank)} scorer`} on the roster</>}
                  </>
                )}
              </div>
            )}
            {rosterMates.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {rosterMates.map((m) => (
                  <button key={m.slug} onClick={() => onOpen(m.slug)} className={`chip cursor-pointer ${m.status === "eliminated" ? "text-sand-400 line-through" : "text-sand-200"}`}>
                    {m.shortName} · {m.points.total}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Points */}
          <div className="card p-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-sand-400">Points</div>
                <div className="text-[11px] text-sand-400">
                  {data.seasonStarted && c.rank ? `${ordinal(c.rank)} of ${data.contestants.length} castaways` : "Season hasn't started"}
                </div>
              </div>
              <div className="font-display text-3xl" style={{ color: drafterColor(c.drafterId) }}>
                {c.points.total}
              </div>
            </div>
            {c.sparkline.length > 2 && <Sparkline values={c.sparkline} color={drafterColor(c.drafterId)} />}
            <ul className="text-sm mt-2 space-y-1 text-sand-200">
              <li className="flex justify-between">
                <span>Eliminations survived × {scoring.perEliminationSurvived}</span>
                <span>{c.points.survival}</span>
              </li>
              <li className="flex justify-between">
                <span>Made the merge (+{scoring.merge})</span>
                <span>{c.points.merge}</span>
              </li>
              <li className="flex justify-between">
                <span>Final Tribal Council (+{scoring.finalTribal})</span>
                <span>{c.points.finalTribal}</span>
              </li>
              <li className="flex justify-between">
                <span>Sole Survivor (+{scoring.winner})</span>
                <span>{c.points.winner}</span>
              </li>
            </ul>
            {c.elimination && (
              <div className="text-xs text-sand-400 mt-2">
                {c.elimination.placementText ?? "Eliminated"}
                {c.elimination.day ? ` · Day ${c.elimination.day}` : ""}
                {c.elimination.note ? ` · ${c.elimination.note}` : ""}
              </div>
            )}
            {(c.extras?.challengeWins !== undefined || c.extras?.votesAgainst !== undefined) && (
              <div className="text-xs text-sand-400 mt-1">
                {c.extras?.challengeWins !== undefined && <>Challenge wins: {c.extras.challengeWins}</>}
                {c.extras?.challengeWins !== undefined && c.extras?.votesAgainst !== undefined && " · "}
                {c.extras?.votesAgainst !== undefined && <>Votes against: {c.extras.votesAgainst}</>}
              </div>
            )}
          </div>

          {/* Episode ledger */}
          {c.ledger.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Episode by episode</h4>
              <ul className="card divide-y divide-sand-300/10 text-sm">
                {c.ledger.map((r) => (
                  <li key={r.episode} className={`px-3 py-2 flex items-start gap-3 ${!r.survived && !r.eliminated ? "opacity-50" : ""}`}>
                    <div className="font-display text-lg text-torch-400 w-10 shrink-0 leading-tight">Ep {r.episode}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1">
                        {r.eliminated ? (
                          <span className="chip text-ember-500">Eliminated</span>
                        ) : r.survived ? (
                          <span className="chip text-palm-400">Survived</span>
                        ) : (
                          <span className="chip text-sand-400">Out of the game</span>
                        )}
                        {r.immunity && <span className="chip text-torch-400">Immunity</span>}
                        {r.reward && <span className="chip text-lagoon-400">Reward</span>}
                        {r.votesAgainst > 0 && (
                          <span className="chip text-sand-200" title={r.voters.map(name).join(", ")}>
                            {r.votesAgainst} vote{r.votesAgainst === 1 ? "" : "s"} against
                          </span>
                        )}
                        {r.events?.map((t, k) => (
                          <span key={k} className="chip text-torch-400">
                            {t}
                          </span>
                        ))}
                      </div>
                      {(r.votedFor || r.votedForText || r.votesAgainst > 0) && (
                        <div className="text-[11px] text-sand-400 mt-1">
                          {r.votedFor ? (
                            <>
                              Voted for{" "}
                              <button className="underline decoration-sand-400/40" onClick={() => onOpen(r.votedFor!)}>
                                {name(r.votedFor)}
                              </button>
                            </>
                          ) : r.votedForText ? (
                            <>{r.votedForText}</>
                          ) : null}
                          {r.votesAgainst > 0 && (
                            <>
                              {(r.votedFor || r.votedForText) && " · "}
                              from {r.voters.map(name).join(", ")}
                            </>
                          )}
                          {r.tally && <> · council {r.tally}</>}
                        </div>
                      )}
                    </div>
                    <div className="font-display text-lg text-sand-200 shrink-0">{r.points > 0 ? `+${r.points}` : r.points}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Idols & advantages */}
          {c.events.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Idols & advantages</h4>
              <ul className="card divide-y divide-sand-300/10 text-sm">
                {c.events.map((e) => {
                  const g = eventGlyph(e);
                  return (
                    <li key={e.id} className="px-3 py-2 flex items-start gap-3">
                      <span className="text-lg leading-none">{g.glyph}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sand-100">
                          {g.label.charAt(0).toUpperCase() + g.label.slice(1)}
                          {e.episode ? <span className="text-sand-400"> · Ep {e.episode}</span> : null}
                          {e.day ? <span className="text-sand-400"> · Day {e.day}</span> : null}
                        </div>
                        {e.detail && <div className="text-xs text-sand-400">{e.detail}</div>}
                        <div className="text-[10px] text-sand-400">
                          {e.extracted === "claude" ? "AI-extracted from the wiki" : e.extracted === "manual" ? "Entered by hand" : "Survivor Wiki"}
                          {e.source.url && e.source.url !== "#" && (
                            <>
                              {" · "}
                              <a className="underline" href={e.source.url} target="_blank" rel="noreferrer">
                                {e.source.page}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Jeff's mentions */}
          {c.mentions.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">🎙️ Jeff on {c.shortName}</h4>
              <ul className="space-y-1.5 text-sm text-sand-200">
                {c.mentions.map((m, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-torch-400 shrink-0">Ep {m.episode}</span>
                    <span>“{m.text}”</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Group-chat quotes */}
          {c.quotes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-widest text-sand-400">From the group chat</h4>
              {c.quotes.map((q) => (
                <blockquote key={q.id} className="border-l-2 pl-3 text-sm" style={{ borderColor: drafterColor(q.drafterId) }}>
                  <p className="text-sand-100">“{q.text}”</p>
                  <footer className="mt-1 flex items-center gap-2">
                    <DrafterChip drafterId={q.drafterId} />
                    {q.episode && <span className="text-[11px] text-sand-400">Ep {q.episode}</span>}
                    {q.date && <span className="text-[11px] text-sand-400">{formatDate(q.date)}</span>}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}

          {/* Bio */}
          {(c.bio || c.extras?.bio) && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Bio</h4>
              <p className="text-sm text-sand-200 whitespace-pre-line">{c.bio ?? c.extras?.bio}</p>
            </div>
          )}

          {/* About: Claude-written summary + bullets; full questionnaire tucked behind a toggle */}
          {(c.profile || (c.extras?.qa && c.extras.qa.length > 0)) && <About c={c} />}

          {/* Fun facts */}
          {c.funFacts.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Fun facts</h4>
              <ul className="space-y-1.5 text-sm text-sand-200">
                {c.funFacts.map((f, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-torch-400">•</span>
                    <span>
                      {f.text}
                      {f.source === "wiki" && <span className="text-[10px] text-sand-400 ml-1">via Survivor Wiki</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gallery */}
          {c.extras?.photos && c.extras.photos.length > 0 && <Gallery c={c} />}

          {c.extras?.pageUrl && (
            <a href={c.extras.pageUrl} target="_blank" rel="noreferrer" className="chip text-lagoon-400">
              Survivor Wiki ↗
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-sand-400">{k}</dt>
      <dd className="text-sand-100">{v}</dd>
    </>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 240;
  const h = 40;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / max) * (h - 4) - 2] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10 mt-2" aria-label="Points over time">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  );
}

function About({ c }: { c: ContestantView }) {
  const [open, setOpen] = useState(false);
  const qa = c.extras?.qa ?? [];
  const p = c.profile;
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">About {c.shortName}</h4>
      {p ? (
        <>
          <p className="text-sm text-sand-100">{p.summary}</p>
          {p.bullets.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-sand-200">
              {p.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-torch-400">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[10px] text-sand-400 mt-1">{p.edited ? "Edited" : "AI summary"} of the pre-season questionnaire (Survivor Wiki / EW)</div>
        </>
      ) : (
        <p className="text-sm text-sand-400">Summary coming soon.</p>
      )}
      {qa.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setOpen((o) => !o)} className="chip text-sand-300 cursor-pointer" aria-expanded={open}>
            {open ? "Hide the full questionnaire" : `Read the full questionnaire (${qa.length})`}
          </button>
          {open && (
            <dl className="mt-3 space-y-2.5 text-sm border-l-2 border-sand-300/15 pl-3">
              {qa.map((q, idx) => (
                <div key={idx}>
                  <dt className="text-sand-400">{q.question}</dt>
                  <dd className="text-sand-100">{q.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

function Gallery({ c }: { c: ContestantView }) {
  // The main portrait is already the hero image; only show extra shots.
  const photos = (c.extras?.photos ?? []).filter((p) => (p.caption ?? "").toLowerCase() !== c.name.toLowerCase());
  if (photos.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Photos</h4>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {photos.map((p) => (
          <a key={p.url} href={p.url.replace(/\/scale-to-width-down\/\d+$/, "")} target="_blank" rel="noreferrer" className="shrink-0 w-28 rounded-lg overflow-hidden bg-night-700">
            <img src={p.url} alt={p.caption ?? c.name} loading="lazy" className="w-28 h-36 object-cover object-top" />
            {p.caption && <div className="text-[10px] text-sand-400 px-1 py-0.5 truncate">{p.caption}</div>}
          </a>
        ))}
      </div>
      <div className="text-[10px] text-sand-400 mt-0.5">via Survivor Wiki</div>
    </div>
  );
}
