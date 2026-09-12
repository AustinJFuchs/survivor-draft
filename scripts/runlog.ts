// Record what changed in data/ since the last time anyone looked.
//
//   npm run runlog                # compare the working tree to the last entry, append if it moved
//   npm run runlog -- --backfill  # rebuild the whole log from git history
//   npm run runlog -- --dry       # print, don't write
//
// Runs in the pipeline just before the commit step (and in /episode-update before
// a hand commit) so every change to data/ ends up with a sentence attached.
//
// A run that finds nothing appends no entry — it only bumps the quiet-check
// counter, which the page uses to say "last checked 20 minutes ago" on the days
// when there is no news. Without that, an idle pipeline and a broken one look
// identical from the outside.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RunLog, RunLogEntry } from "../src/lib/types";
import { collectFacts, describeChange, type Reader, type RunFacts } from "./lib/runlog";
import { DATA_DIR, SEASON, dataPath, readJson, writeJson } from "./lib/paths";

interface RunLogFile extends RunLog {
  /** The data as of the newest entry; the next run diffs against this. */
  state?: RunFacts;
}

const LOG_PATH = dataPath("runlog.json");
const EMPTY: RunLogFile = { entries: [], quietChecks: 0 };

// ---------- readers ----------

const diskReader: Reader = {
  read: (rel) => {
    const p = join(DATA_DIR, rel);
    return existsSync(p) ? readFileSync(p, "utf8") : undefined;
  },
  list: (rel) => {
    const p = rel ? join(DATA_DIR, rel) : DATA_DIR;
    return existsSync(p) ? readdirSync(p) : [];
  },
};

function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

function commitReader(sha: string): Reader {
  const base = `data/${SEASON}`;
  return {
    read: (rel) => git(["show", `${sha}:${base}/${rel}`]),
    list: (rel) => (git(["ls-tree", "--name-only", `${sha}:${rel ? `${base}/${rel}` : base}`]) ?? "").split("\n").filter(Boolean),
  };
}

interface Commit {
  sha: string;
  at: string;
  author: string;
  subject: string;
}

function dataCommits(): Commit[] {
  const raw = git(["log", "--reverse", "--format=%H%x1f%aI%x1f%an%x1f%s", "--", "data/"]) ?? "";
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, at, author, subject] = line.split("\x1f");
      // Commits carry the committer's local offset (-04:00 here, +00:00 on the
      // runner), so normalise to UTC or entries will not sort against each other.
      return { sha: sha!, at: new Date(at!).toISOString(), author: author ?? "", subject: subject ?? "" };
    });
}

const isBot = (author: string) => /bot|actions/i.test(author);

// ---------- modes ----------

function backfill(): RunLogFile {
  const commits = dataCommits();
  if (!commits.length) throw new Error("No commits touching data/ — nothing to backfill.");
  const entries: RunLogEntry[] = [];
  let prev: RunFacts | undefined;
  for (const c of commits) {
    const next = collectFacts(commitReader(c.sha));
    const change = describeChange(prev, next);
    if (change.changed) {
      entries.push({
        id: c.sha.slice(0, 7),
        at: c.at,
        source: isBot(c.author) ? "pipeline" : "manual",
        summary: change.summary,
        details: change.details,
        ...(change.episode !== undefined ? { episode: change.episode } : {}),
        ...(change.trouble ? { trouble: true } : {}),
        commit: c.sha.slice(0, 7),
        commitSubject: c.subject,
      });
    } else {
      console.log(`  (skipped ${c.sha.slice(0, 7)} — nothing but timestamps changed)`);
    }
    prev = next;
  }
  return { entries, state: prev, quietChecks: 0, lastCheckedAt: commits[commits.length - 1]!.at };
}

function append(file: RunLogFile): { file: RunLogFile; entry?: RunLogEntry } {
  const next = collectFacts(diskReader);
  const change = describeChange(file.state, next);
  const now = new Date().toISOString();
  if (!change.changed) {
    return { file: { ...file, state: next, lastCheckedAt: now, quietChecks: file.quietChecks + 1 } };
  }
  const entry: RunLogEntry = {
    id: now,
    at: now,
    source: process.env.GITHUB_ACTIONS ? "pipeline" : "manual",
    summary: change.summary,
    details: change.details,
    ...(change.episode !== undefined ? { episode: change.episode } : {}),
    ...(change.trouble ? { trouble: true } : {}),
  };
  return { file: { entries: [...file.entries, entry], state: next, lastCheckedAt: now, quietChecks: 0 }, entry };
}

// ---------- cli ----------

const args = process.argv.slice(2);
const dry = args.includes("--dry");

if (args.includes("--backfill")) {
  const file = backfill();
  console.log(`Rebuilt the update log from git: ${file.entries.length} entries.\n`);
  for (const e of file.entries) console.log(`${e.at.slice(0, 10)}  ${e.source === "pipeline" ? "auto" : "hand"}  ${e.summary}\n${e.details.map((d) => `        · ${d}`).join("\n")}\n`);
  if (!dry) {
    writeJson(LOG_PATH, file);
    console.log(`Wrote ${LOG_PATH}`);
  }
} else {
  const existing = readJson<RunLogFile>(LOG_PATH, EMPTY);
  const { file, entry } = append(existing);
  if (entry) console.log(`Update log: ${entry.summary}\n${entry.details.map((d) => `  · ${d}`).join("\n")}`);
  else console.log(`Update log: nothing new (${file.quietChecks} quiet ${file.quietChecks === 1 ? "check" : "checks"} since the last entry).`);
  if (!dry) writeJson(LOG_PATH, file);
}
