import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { formatDate } from "../lib/format";
import { DrafterChip, Photo, SectionTitle } from "./ui";

export default function Episodes({ onOpen }: { onOpen: (slug: string) => void }) {
  const aired = data.episodes.filter((e) => e.aired || e.eliminations.length > 0).sort((a, b) => b.number - a.number);
  const upcoming = data.episodes.filter((e) => !e.aired && e.eliminations.length === 0).sort((a, b) => a.number - b.number);

  return (
    <section>
      <SectionTitle sub={`${aired.length} aired`}>Episodes</SectionTitle>

      {upcoming[0] && (
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-3 border-lagoon-500/40">
          <div className="text-2xl">📺</div>
          <div>
            <div className="text-xs uppercase tracking-widest text-sand-400">Next up</div>
            <div className="font-display text-2xl">
              Episode {upcoming[0].number}
              {upcoming[0].title && <span className="text-sand-300"> · “{upcoming[0].title}”</span>}
            </div>
            {upcoming[0].airDate && <div className="text-sm text-sand-300">{formatDate(upcoming[0].airDate, { weekday: "long" })} on CBS</div>}
          </div>
        </div>
      )}

      {aired.length === 0 && <div className="card p-6 text-sand-300">No episodes yet. Recaps, boots, and Jeff's commentary land here after each Wednesday.</div>}

      <ol className="space-y-6">
        {aired.map((ep) => (
          <li key={ep.number} className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-sand-300/10 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="font-display text-3xl text-torch-400">Ep {ep.number}</div>
              {ep.title && <div className="font-display text-2xl">“{ep.title}”</div>}
              {ep.airDate && <div className="text-sm text-sand-400">{formatDate(ep.airDate)}</div>}
            </div>

            <div className="p-4 sm:p-5 grid gap-5 md:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                {ep.eliminations.length > 0 ? (
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-2">Torch snuffed</h4>
                    <ul className="space-y-2">
                      {ep.eliminations.map((e) => {
                        const c = contestantBySlug.get(e.contestantSlug);
                        if (!c) return null;
                        const d = c.drafterId ? drafterById.get(c.drafterId) : undefined;
                        return (
                          <li key={e.contestantSlug}>
                            <button onClick={() => onOpen(c.slug)} className="flex items-center gap-3 text-left w-full hover:bg-night-700/60 rounded-lg p-1 transition eliminated">
                              <Photo c={c} className="w-10 rounded-md shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold">{c.name}</div>
                                <div className="text-xs text-sand-400">
                                  {e.placementText ?? "Eliminated"}
                                  {e.day ? ` · Day ${e.day}` : ""}
                                  {d && (
                                    <>
                                      {" "}
                                      · <span style={{ color: drafterColor(d.id) }}>{d.name}</span> loses a player
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="text-sm text-sand-400">No elimination recorded.</div>
                )}
                {(ep.immunityWinners || ep.rewardWinners) && (
                  <dl className="text-sm space-y-1">
                    {ep.immunityWinners && (
                      <div className="flex gap-2">
                        <dt className="text-sand-400 w-20 shrink-0">Immunity</dt>
                        <dd>{ep.immunityWinners}</dd>
                      </div>
                    )}
                    {ep.rewardWinners && (
                      <div className="flex gap-2">
                        <dt className="text-sand-400 w-20 shrink-0">Reward</dt>
                        <dd>{ep.rewardWinners}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {ep.synopsis && !ep.commentary && <p className="text-sm text-sand-300">{ep.synopsis}</p>}
              </div>

              <div className="space-y-4">
                {ep.commentary ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎙️</span>
                      <div>
                        <div className="font-display text-xl leading-none">Jeff's take</div>
                        <div className="text-[10px] text-sand-400">
                          {ep.commentary.edited ? "edited" : "AI-generated in Probst's voice"} · from published recaps
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-sand-100 whitespace-pre-line">{ep.commentary.recap}</p>
                    {ep.commentary.bullets.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {ep.commentary.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-torch-400">🔥</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ep.commentary.draftImpact && (
                      <div className="rounded-lg bg-night-700/60 p-3">
                        <div className="text-xs uppercase tracking-widest text-lagoon-400 mb-1">Draft impact</div>
                        <p className="text-sm whitespace-pre-line">{ep.commentary.draftImpact}</p>
                      </div>
                    )}
                    {ep.commentary.sources.length > 0 && (
                      <div className="text-[11px] text-sand-400 flex flex-wrap gap-x-3 gap-y-1">
                        Sources:
                        {ep.commentary.sources.map((s) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline decoration-sand-400/40 hover:text-sand-200">
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-sand-400">Jeff's commentary is on its way — it's generated once recaps are published.</div>
                )}

                {ep.quotes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase tracking-widest text-sand-400">From the group chat</h4>
                    {ep.quotes.map((q) => (
                      <blockquote key={q.id} className="border-l-2 pl-3 text-sm" style={{ borderColor: drafterColor(q.drafterId) }}>
                        <p className="text-sand-100">“{q.text}”</p>
                        <footer className="mt-1 flex items-center gap-2">
                          <DrafterChip drafterId={q.drafterId} />
                          {q.date && <span className="text-[11px] text-sand-400">{formatDate(q.date)}</span>}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
