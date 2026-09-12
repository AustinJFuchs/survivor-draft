import { useEffect } from "react";
import { data } from "../data";
import { formatDateTime } from "../lib/format";
import type { RunLogEntry } from "../lib/types";
import { SectionTitle } from "./ui";

const REPO = "https://github.com/AustinJFuchs/survivor-draft";

/** "20 minutes ago", "3 days ago" — the header's proof the pipeline is still breathing. */
function ago(iso: string | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "never";
  const mins = Math.round(ms / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function Entry({ e }: { e: RunLogEntry }) {
  return (
    <li className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5">
        <span className="text-xs text-sand-400 tabular-nums">{formatDateTime(e.at)}</span>
        <span className={`chip ${e.source === "pipeline" ? "text-lagoon-400" : "text-torch-400"}`}>{e.source === "pipeline" ? "Automatic" : "By hand"}</span>
        {e.trouble && <span className="chip text-ember-500">Needed attention</span>}
      </div>
      <p className="text-sm text-sand-100 leading-snug">{e.summary}</p>
      {e.details.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer text-xs text-sand-400 hover:text-sand-200 transition list-none">
            <span className="group-open:hidden">Show all {e.details.length} changes</span>
            <span className="hidden group-open:inline">Hide changes</span>
          </summary>
          <ul className="mt-1.5 space-y-0.5 text-xs text-sand-300 border-l border-sand-300/15 pl-3">
            {e.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}
      {e.commit && (
        <div className="mt-2 text-[11px] text-sand-400/80">
          <a className="underline hover:text-sand-200 transition" href={`${REPO}/commit/${e.commit}`} target="_blank" rel="noreferrer">
            {e.commit}
          </a>
          {e.commitSubject && <span className="ml-1.5 truncate">{e.commitSubject}</span>}
        </div>
      )}
    </li>
  );
}

export default function RunLog({ onBack }: { onBack: () => void }) {
  const { entries, lastCheckedAt, quietChecks } = data.runLog;
  // Reached by anchor from the bottom of Rules, so start at the top of this page.
  useEffect(() => window.scrollTo({ top: 0 }), []);

  // Newest first, grouped the way the rest of the site groups a season.
  const sorted = [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const groups: { episode?: number; entries: RunLogEntry[] }[] = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.episode === e.episode) last.entries.push(e);
    else groups.push({ episode: e.episode, entries: [e] });
  }

  return (
    <section className="space-y-5 max-w-3xl">
      <button onClick={onBack} className="text-xs text-sand-400 hover:text-sand-200 transition cursor-pointer">
        ← Rules
      </button>

      <SectionTitle sub={`${entries.length} ${entries.length === 1 ? "update" : "updates"}`}>Update log</SectionTitle>

      <div className="card p-4 sm:p-5 text-sm space-y-2">
        <p className="text-sand-300">
          The site checks Wikipedia and the Survivor Wiki every morning, and again three times on Thursday night after an episode. Only the checks that
          found something get a line here.
        </p>
        <p className="text-xs text-sand-400">
          Last checked {ago(lastCheckedAt)}
          {quietChecks > 0 && ` · ${quietChecks} quiet ${quietChecks === 1 ? "check" : "checks"} since the last update`}
          {lastCheckedAt && ` · ${formatDateTime(lastCheckedAt)}`}
        </p>
      </div>

      {groups.length === 0 && <p className="text-sm text-sand-400">Nothing logged yet.</p>}

      {groups.map((g, i) => (
        <details key={g.episode ?? "pre"} open={i === 0} className="space-y-2">
          <summary className="cursor-pointer font-display text-xl text-sand-200 hover:text-torch-400 transition mb-2">
            {g.episode === undefined ? "Pre-season" : `After Ep ${g.episode}`}
            <span className="text-xs text-sand-400 font-sans font-normal ml-2">
              {g.entries.length} {g.entries.length === 1 ? "update" : "updates"}
            </span>
          </summary>
          <ul className="space-y-2">
            {g.entries.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </ul>
        </details>
      ))}

      <p className="text-xs text-sand-400/80">
        Written by the pipeline itself from the before/after of each change — not by Claude, so it stays exact even on the weeks a generation step is
        skipped.
      </p>
    </section>
  );
}
