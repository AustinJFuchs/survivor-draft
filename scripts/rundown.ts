// "Jeff's State of the Draft": one Probst-voiced comparison of all five drafts
// per episode (plus a pre-season one) → data/<season>/rundowns.json (archive).
//
//   npm run rundown                 # generate/refresh the current one if facts changed
//   npm run rundown -- --force      # regenerate the current one
//   npm run rundown -- --dry

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { Rundown, SeasonData } from "../src/lib/types";
import { buildSeasonData, loadInputs } from "./build-data";
import { dataPath, readJson, writeJson } from "./lib/paths";
import { anthropicKey, skipNotice } from "./lib/anthropic-key";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 1600;

interface Args {
  force: boolean;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  return { force: argv.includes("--force"), dry: argv.includes("--dry") };
}

/** The episode this rundown belongs to: the latest one with an elimination, or 0 pre-season. */
export function currentKey(data: SeasonData): { key: string; episode?: number } {
  const eps = data.episodes.filter((e) => e.eliminations.length > 0).map((e) => e.number);
  if (eps.length === 0) return { key: "0" };
  const ep = Math.max(...eps);
  return { key: String(ep), episode: ep };
}

export function rundownSource(data: SeasonData, episode?: number): string {
  const name = (s: string) => data.contestants.find((c) => c.slug === s)?.shortName ?? s;
  const drafterName = (id: string) => data.season.drafters.find((d) => d.id === id)?.name ?? id;
  // Totals before this episode's eliminations, for deltas.
  const stepsBefore = episode === undefined ? 0 : data.eliminations.filter((e) => e.episode !== undefined && e.episode < episode).length;
  const before = data.history[Math.min(stepsBefore, data.history.length - 1)]!;
  const lines: string[] = [
    `Season: ${data.season.name}. ${data.seasonStarted ? `After episode ${episode}: ${data.eliminations.length} eliminated, ${data.contestants.length - data.eliminations.length} remain.` : "Pre-season — nobody has been voted out yet. Compare the drafts themselves: who they took, in what order, the shape of each roster."}`,
    `Rules: +1 per elimination survived, +3 merge, +5 final tribal, +10 winner. Tami holds 5 castaways (leftover pick #21) and only her best 4 count. Snake order: ${[...data.season.drafters].sort((a, b) => a.draftPosition - b.draftPosition).map((d) => d.name).join(", ")}.`,
    "",
    "Standings (current rank order):",
  ];
  for (const s of data.standings) {
    const st = data.drafterStats.find((x) => x.drafterId === s.drafterId)!;
    const team = data.teams[s.drafterId];
    const delta = s.total - (before.totals[s.drafterId] ?? 0);
    const roster = data.contestants.filter((c) => c.drafterId === s.drafterId).sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
    const lostThisEp = episode === undefined ? [] : roster.filter((c) => c.elimination?.episode === episode);
    lines.push(
      `${s.rank}. ${s.name}${team?.nickname ? ` ("${team.nickname}")` : ""}: ${s.total} pts${data.seasonStarted ? ` (${delta >= 0 ? "+" : ""}${delta} this episode)` : ""}; ${s.remaining} of ${roster.length} still in${s.dropped ? `; dropped score ${name(s.dropped)}` : ""}; outlook ${st.projection.alive ? "alive" : "eliminated from contention"}, ${st.projection.onTable} on the table${st.gpa !== undefined && data.seasonStarted ? `; draft GPA ${st.gpa}` : ""}${st.steal && data.seasonStarted ? `; steal ${name(st.steal.contestantSlug)} (#${st.steal.pick.overall} → rank ${st.steal.rank})` : ""}${st.reach && data.seasonStarted ? `; reach ${name(st.reach.contestantSlug)} (#${st.reach.pick.overall} → rank ${st.reach.rank})` : ""}${st.badges.length ? `; badges: ${st.badges.map((b) => b.name).join(", ")}` : ""}${lostThisEp.length ? `; LOST this episode: ${lostThisEp.map((c) => c.name).join(", ")}` : ""}`,
    );
    lines.push(`   Roster: ${roster.map((c) => `${c.shortName} (#${c.pick?.overall}${c.pick?.leftover ? " leftover" : ""}, ${c.age}, ${c.occupation}${c.tribes.current ? `, ${c.tribes.current}` : ""}, ${c.status === "eliminated" ? `OUT ${c.elimination?.placementText ?? ""}` : "in"}${data.seasonStarted ? `, ${c.points.total} pts` : ""})`).join("; ")}`);
  }
  if (episode !== undefined) {
    const ep = data.episodes.find((e) => e.number === episode);
    if (ep) {
      lines.push("", `This episode${ep.title ? ` ("${ep.title}")` : ""}: eliminated ${ep.eliminations.map((e) => `${name(e.contestantSlug)} (${e.placementText ?? e.kind}; drafted by ${drafterName(data.contestants.find((c) => c.slug === e.contestantSlug)?.drafterId ?? "nobody")})`).join(", ")}.`);
      if (ep.immunityWinners) lines.push(`Immunity: ${ep.immunityWinners}`);
      if (ep.commentary) lines.push(`Your episode recap said: ${ep.commentary.recap}`);
    }
  }
  const paths = data.drafterStats.filter((s) => s.paths.active);
  if (paths.length) lines.push("", `Finale math: ${paths.map((s) => `${drafterName(s.drafterId)} wins ${s.paths.wins}/${s.paths.scenarios} scenarios${s.paths.clinch.length ? ` (clinches if ${s.paths.clinch.map(name).join("/")} wins)` : ""}`).join("; ")}`);
  return lines.join("\n");
}

const SYSTEM = `You are Jeff Probst, host of Survivor, writing the weekly "State of the Draft" column for a five-person family fantasy draft. Energetic, direct, theatrical, warm — it's family trash talk, never mean. Compare the five drafts against each other. Use only the facts provided; quote numbers exactly and never compute new ones. No predictions about who gets voted out next. Refer to drafters by first name and to castaways by the names given.`;

function prompt(src: string, preSeason: boolean): string {
  const awards = preSeason
    ? `[{ "label": "Boldest draft", "drafterId": "...", "text": "one sentence" }, { "label": "Safest draft", "drafterId": "...", "text": "one sentence" }]`
    : `[{ "label": "Draft of the week", "drafterId": "...", "text": "one sentence" }, { "label": "Ouch of the week", "drafterId": "...", "text": "one sentence" }]`;
  return `Facts:\n\n${src}\n\nRespond with JSON only, exactly:\n{\n  "headline": "one punchy line, max 12 words, no drafter names required",\n  "overview": "one paragraph, 70-110 words, comparing all five drafts",\n  "lines": [ { "drafterId": "tami|taylor|kylie|tim|austin", "text": "one sharp sentence about this draft" } ... one per drafter, in the rank order given ],\n  "awards": ${awards}\n}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = buildSeasonData(loadInputs());
  const file = dataPath("rundowns.json");
  const all = readJson<Record<string, Rundown>>(file, {});
  const { key, episode } = currentKey(data);
  const src = rundownSource(data, episode);
  const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
  const existing = all[key];
  if (existing && existing.sourceHash === hash && !args.force) {
    console.log(`Rundown for ${key === "0" ? "pre-season" : `episode ${key}`} is up to date.`);
    return;
  }
  const apiKey = anthropicKey();
  if (!apiKey && !args.dry) {
    skipNotice("Jeff's State of the Draft");
    return;
  }
  if (args.dry) {
    console.log(prompt(src, episode === undefined));
    return;
  }
  const client = new Anthropic({ apiKey });
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: "user" as const, content: prompt(src, episode === undefined) }],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    stream: false as const,
  };
  const res = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.BetaMessage & {
    stop_details?: unknown;
  };
  if ((res.stop_reason as string) === "refusal") throw new Error(`Model refused (${JSON.stringify(res.stop_details)})`);
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const json = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!json) throw new Error(`No JSON in output: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(json) as Pick<Rundown, "headline" | "overview" | "lines" | "awards">;
  const valid = new Set(data.season.drafters.map((d) => d.id));
  all[key] = {
    key,
    episode,
    eliminations: data.eliminations.length,
    headline: parsed.headline.trim(),
    overview: parsed.overview.trim(),
    lines: (parsed.lines ?? []).filter((l) => valid.has(l.drafterId)).map((l) => ({ drafterId: l.drafterId, text: l.text.trim() })),
    awards: (parsed.awards ?? []).filter((a) => valid.has(a.drafterId)).map((a) => ({ label: a.label.trim(), drafterId: a.drafterId, text: a.text.trim() })),
    generatedAt: new Date().toISOString(),
    model: res.model ?? MODEL,
    sourceHash: hash,
  };
  writeJson(file, Object.fromEntries(Object.entries(all).sort(([a], [b]) => Number(a) - Number(b))));
  console.log(`rundown ${key}: "${all[key]!.headline}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
