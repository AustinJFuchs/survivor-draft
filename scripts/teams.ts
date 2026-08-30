// Jeff Probst–voiced team summaries per drafter → data/<season>/teams.json.
// Regenerated whenever the team's situation changes (source hash covers roster
// status, standings, grades); edits in overrides.teams[drafterId] survive.
//
//   npm run teams
//   npm run teams -- --drafter tami --force
//   npm run teams -- --dry

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { SeasonData, TeamSummary } from "../src/lib/types";
import { buildSeasonData, loadInputs } from "./build-data";
import { dataPath, readJson, writeJson } from "./lib/paths";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 1200;

interface Args {
  drafter?: string;
  force: boolean;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--drafter") a.drafter = argv[++i];
    else if (argv[i] === "--force") a.force = true;
    else if (argv[i] === "--dry") a.dry = true;
  }
  return a;
}

/** Everything Jeff is allowed to know about a team. Numbers come from the engine. */
export function teamSource(data: SeasonData, drafterId: string): string {
  const d = data.season.drafters.find((x) => x.id === drafterId)!;
  const st = data.standings.find((s) => s.drafterId === drafterId)!;
  const stats = data.drafterStats.find((s) => s.drafterId === drafterId)!;
  const roster = data.contestants.filter((c) => c.drafterId === drafterId).sort((a, b) => (a.pick?.overall ?? 99) - (b.pick?.overall ?? 99));
  const name = (s: string) => data.contestants.find((c) => c.slug === s)?.shortName ?? s;
  const lines: string[] = [
    `Drafter: ${d.name} (drafted ${d.draftPosition}${["st", "nd", "rd"][d.draftPosition - 1] ?? "th"} in the snake order)`,
    `Season started: ${data.seasonStarted ? "yes" : "no — pre-season"}`,
    `Standing: rank ${st.rank}${st.tied ? " (tied)" : ""} of ${data.standings.length}, ${st.total} counted points${st.dropped ? ` (raw ${st.rawTotal}; ${name(st.dropped)} is the dropped score under the best-${data.season.handicap.countBest} rule)` : ""}`,
    `Still in the game: ${st.remaining} of ${roster.length}`,
    `Outlook: ${stats.projection.alive ? "still in contention" : "eliminated from contention"}; ${stats.projection.onTable} points still on the table; leader has ${stats.projection.leaderTotal}`,
    stats.gpa !== undefined && data.seasonStarted ? `Draft GPA: ${stats.gpa}${stats.gradesEarly ? " (early, few eliminations so far)" : ""}` : "",
    stats.steal ? `Steal of the draft: ${name(stats.steal.contestantSlug)} (pick #${stats.steal.pick.overall}, ranks ${stats.steal.rank})` : "",
    stats.reach ? `Reach: ${name(stats.reach.contestantSlug)} (pick #${stats.reach.pick.overall}, ranks ${stats.reach.rank})` : "",
    stats.badges.length ? `Badges: ${stats.badges.map((b) => `${b.name} (${b.rule}${b.detail ? `; ${b.detail}` : ""})`).join("; ")}` : "",
    stats.bestWeek ? `Best week: Ep ${stats.bestWeek.episode} (+${stats.bestWeek.delta})` : "",
    stats.worstWeek ? `Worst week: Ep ${stats.worstWeek.episode} (+${stats.worstWeek.delta})` : "",
    "",
    "Roster:",
  ];
  for (const c of roster) {
    const g = stats.grades.find((x) => x.contestantSlug === c.slug);
    const status = c.winner ? "Sole Survivor" : c.finalist ? "finalist" : c.elimination ? `${c.elimination.placementText ?? "out"}${c.elimination.episode ? ` (Ep ${c.elimination.episode})` : ""}` : "in the game";
    lines.push(
      `- ${c.name}${c.nickname ? ` "${c.nickname}"` : ""}, ${c.age}, ${c.occupation}, ${c.residence ?? c.hometown}; pick #${c.pick?.overall}${c.pick?.leftover ? " (leftover)" : ""}; tribe ${c.tribes.current ?? "TBA"}; ${status}${data.seasonStarted ? `; ${c.points.total} pts (rank ${c.rank} of ${data.contestants.length})${g ? `; grade ${g.grade}` : ""}` : ""}${c.extras?.threeWords ? `; 3 words: ${c.extras.threeWords.join(", ")}` : ""}`,
    );
    if (c.profile) lines.push(`  About: ${c.profile.summary}`);
  }
  return lines.filter((l) => l !== "").join("\n");
}

const SYSTEM = `You are Jeff Probst, host of Survivor, writing a short note to one member of a five-person family fantasy draft about the team they drafted. Energetic, direct, a little theatrical, warm — these are family. Address the drafter by name in the second person. Use only the facts provided; quote the numbers exactly as given and never compute new ones. No predictions about who will be voted out. If the season hasn't started, talk about the team's makeup and what to watch for; if it has, talk about how they're doing.`;

function prompt(src: string): string {
  return `Team facts:\n\n${src}\n\nRespond with JSON only, exactly:\n{\n  "nickname": "a playful 2-4 word team name drawn from the roster (jobs, hometowns, vibes) — no drafter's name in it",\n  "summary": "one paragraph, 55-85 words, Jeff's voice, addressed to the drafter",\n  "bullets": [\n    { "label": "Carrying the load", "text": "one sentence on the top scorer or leader of the roster" },\n    { "label": "Cause for concern", "text": "one sentence on the weakest link, dropped pick, or a loss" },\n    { "label": "Watch for", "text": "one sentence on the storyline to follow next" }\n  ]\n}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = buildSeasonData(loadInputs());
  const file = dataPath("teams.json");
  const teams = readJson<Record<string, TeamSummary>>(file, {});
  const targets = data.season.drafters.filter((d) => !args.drafter || d.id === args.drafter);
  const todo = targets.filter((d) => {
    const hash = createHash("sha1").update(teamSource(data, d.id)).digest("hex").slice(0, 12);
    const ex = teams[d.id];
    return args.force || !ex || ex.sourceHash !== hash;
  });
  if (todo.length === 0) {
    console.log("All team summaries up to date.");
    return;
  }
  console.log(`${todo.length} team summar${todo.length === 1 ? "y" : "ies"} to generate: ${todo.map((d) => d.id).join(", ")}`);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !args.dry) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = args.dry ? null : new Anthropic({ apiKey });

  for (const d of todo) {
    const src = teamSource(data, d.id);
    const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
    if (!client) {
      console.log(`--- ${d.id} ---\n${prompt(src).slice(0, 1200)}\n...`);
      continue;
    }
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user" as const, content: prompt(src) }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      stream: false as const,
    };
    const res = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.BetaMessage & {
      stop_details?: unknown;
    };
    if ((res.stop_reason as string) === "refusal") throw new Error(`Model refused for ${d.id} (${JSON.stringify(res.stop_details)})`);
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    if (!json) throw new Error(`No JSON for ${d.id}: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(json) as { nickname: string; summary: string; bullets: { label: string; text: string }[] };
    teams[d.id] = {
      drafterId: d.id,
      nickname: parsed.nickname.trim(),
      summary: parsed.summary.trim(),
      bullets: (parsed.bullets ?? []).map((b) => ({ label: b.label.trim(), text: b.text.trim() })).slice(0, 3),
      generatedAt: new Date().toISOString(),
      model: res.model ?? MODEL,
      sourceHash: hash,
    };
    writeJson(file, Object.fromEntries(Object.entries(teams).sort(([a], [b]) => a.localeCompare(b))));
    console.log(`${d.id}: "${teams[d.id]!.nickname}" — ${teams[d.id]!.summary.slice(0, 70)}…`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
