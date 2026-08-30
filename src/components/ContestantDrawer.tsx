import { useEffect } from "react";
import { contestantBySlug, data, drafterById, drafterColor } from "../data";
import { ordinal } from "../lib/format";
import { DrafterChip, Photo, StatusPill, TribeBadge } from "./ui";

export default function ContestantDrawer({ slug, onClose, onOpen }: { slug: string; onClose: () => void; onOpen: (slug: string) => void }) {
  const c = contestantBySlug.get(slug);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  if (!c) return null;

  const order = data.contestants.map((x) => x.slug);
  const i = order.indexOf(slug);
  const prev = order[(i - 1 + order.length) % order.length]!;
  const next = order[(i + 1) % order.length]!;
  const drafter = c.drafterId ? drafterById.get(c.drafterId) : undefined;
  const standing = data.standings.find((s) => s.drafterId === c.drafterId);
  const dropped = standing?.dropped === c.slug;
  const { scoring } = data.season;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={c.name}>
      <div className="absolute inset-0 drawer-backdrop" onClick={onClose} />
      <aside className="relative w-full sm:max-w-md md:max-w-lg h-full overflow-y-auto bg-night-900 border-l border-sand-300/10 shadow-2xl scrollbar-thin">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-night-900/90 backdrop-blur border-b border-sand-300/10">
          <div className="flex gap-1">
            <button onClick={() => onOpen(prev)} className="chip text-sand-300 cursor-pointer">← Prev</button>
            <button onClick={() => onOpen(next)} className="chip text-sand-300 cursor-pointer">Next →</button>
          </div>
          <button onClick={onClose} className="chip text-sand-200 cursor-pointer">Close ✕</button>
        </div>

        <div className={`relative ${c.status === "eliminated" ? "eliminated" : ""}`}>
          <Photo c={c} eager className="w-full !aspect-[4/3] sm:!aspect-[3/2]" />
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-night-900 via-night-900/70 to-transparent">
            <div className="font-display text-4xl leading-none torch-glow">{c.name}</div>
            {c.nickname && <div className="text-sand-300 text-sm">"{c.nickname}"</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <StatusPill c={c} />
              <TribeBadge tribe={c.tribes.current} />
              {c.merged && <span className="chip text-lagoon-400">Merged</span>}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row k="Age" v={String(c.age)} />
            <Row k="Occupation" v={c.occupation} />
            <Row k="Hometown" v={c.hometown} />
            {c.residence && c.residence !== c.hometown && <Row k="Lives in" v={c.residence} />}
            {c.tribes.history.length > 0 && <Row k="Tribes" v={c.tribes.history.join(" → ")} />}
            {c.extras?.threeWords && <Row k="In 3 words" v={c.extras.threeWords.join(", ")} />}
          </dl>

          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-sand-400">Drafted by</div>
              <DrafterChip drafterId={c.drafterId} size="md" />
            </div>
            {c.pick && (
              <div className="text-sm text-sand-300 mt-1">
                {c.pick.leftover ? `Leftover pick (#${c.pick.overall}), assigned to ${drafter?.name}` : `Round ${c.pick.round}, pick #${c.pick.overall} overall`}
                {dropped && <span className="text-ember-500"> · currently the dropped score for {drafter?.name}</span>}
              </div>
            )}
          </div>

          <div className="card p-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-widest text-sand-400">Points</div>
              <div className="font-display text-3xl" style={{ color: drafterColor(c.drafterId) }}>
                {c.points.total}
              </div>
            </div>
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
                {c.placement ? ` · finished ${ordinal(c.placement)}` : ""}
                {c.elimination.note ? ` · ${c.elimination.note}` : ""}
              </div>
            )}
            {(c.extras?.challengeWins !== undefined || c.extras?.votesAgainst !== undefined) && (
              <div className="text-xs text-sand-400 mt-1">
                {c.extras?.challengeWins !== undefined && <>Challenge wins: {c.extras.challengeWins}</>}
                {c.extras?.challengeWins !== undefined && c.extras?.votesAgainst !== undefined && " · "}
                {c.extras?.votesAgainst !== undefined && <>Votes against: {c.extras.votesAgainst}</>}
                {c.extras?.daysLasted && <> · Days: {c.extras.daysLasted}</>}
              </div>
            )}
          </div>

          {(c.bio || c.extras?.bio) && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-sand-400 mb-1">Bio</h4>
              <p className="text-sm text-sand-200 whitespace-pre-line">{c.bio ?? c.extras?.bio}</p>
            </div>
          )}

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
