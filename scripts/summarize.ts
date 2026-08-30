// Generate Jeff Probst–voiced commentary for newly aired episodes.
//
//   npm run summarize                 # every aired episode with eliminations but no commentary
//   npm run summarize -- --episode 3  # one episode (skips if exists)
//   npm run summarize -- --episode 3 --force   # regenerate (overwrites ep-3.json)
//   npm run summarize -- --dry        # print, don't write, don't call the API
//
// Rules (from the design doc):
//   - only fires for episodes that have at least one elimination in the merged data
//   - never regenerates an existing ep-N.json unless --force
//   - needs >= sources.minSources articles, or the episode aired >= maxWaitHours ago
//   - draft-impact numbers come from the scoring engine and are handed to the model
//   - spoiler guard: sources published after the *next* episode's air date are dropped
//   - the model narrates; it never computes points

import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Commentary, EpisodeView, SeasonData } from "../src/lib/types";
import { buildSeasonData, loadInputs } from "./build-data";
import { fetchText } from "./lib/http";
import { DATA_DIR, dataPath, readJson, writeJson } from "./lib/paths";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 2500;
const MAX_ARTICLE_CHARS = 9000;

interface SourcesConfig {
  sites: { id: string; name: string; homepage: string; listing: string; match: string }[];
  wikipediaSynopsis: boolean;
  minSources: number;
  maxWaitHours: number;
}

interface Article {
  title: string;
  url: string;
  publishedAt?: string;
  text: string;
  site: string;
}

interface Args {
  episode?: number;
  force: boolean;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--episode") a.episode = Number(argv[++i]);
    else if (argv[i] === "--force") a.force = true;
    else if (argv[i] === "--dry") a.dry = true;
  }
  return a;
}

// ---------- article discovery ----------

function stripHtml(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Prefer <article> content when present.
  const art = /<article[\s\S]*?<\/article>/i.exec(t);
  if (art) t = art[0];
  t = t.replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&[a-z]+;/g, " ");
  return t
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function extractMeta(html: string, prop: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = re.exec(html) ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html);
  return m?.[1];
}

function candidateLinks(listingHtml: string, base: string, match: RegExp): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listingHtml))) {
    let href = m[1]!;
    if (href.startsWith("/")) href = new URL(href, base).toString();
    if (!/^https?:/.test(href)) continue;
    if (!href.startsWith(new URL(base).origin)) continue;
    if (match.test(href.toLowerCase())) links.add(href);
  }
  return [...links];
}

function episodeMentioned(text: string, ep: EpisodeView, bootNames: string[]): boolean {
  const lower = text.toLowerCase();
  if (ep.title && lower.includes(ep.title.toLowerCase())) return true;
  if (new RegExp(`episode\\s*${ep.number}\\b`).test(lower)) return true;
  return bootNames.some((n) => lower.includes(n.toLowerCase()) && /voted out|eliminated|snuffed|sent home|blindside/.test(lower));
}

async function findArticles(cfg: SourcesConfig, season: SeasonData, ep: EpisodeView, nextAirDate?: string): Promise<Article[]> {
  const boots = ep.eliminations.map((e) => season.contestants.find((c) => c.slug === e.contestantSlug)?.shortName ?? "").filter(Boolean);
  const out: Article[] = [];
  for (const site of cfg.sites) {
    try {
      const listing = await fetchText(site.listing);
      const links = candidateLinks(listing, site.homepage, new RegExp(site.match, "i")).slice(0, 25);
      for (const url of links) {
        if (out.some((a) => a.site === site.id)) break; // one article per site
        try {
          const html = await fetchText(url, { retries: 0 });
          const text = stripHtml(html);
          if (!episodeMentioned(text, ep, boots)) continue;
          const publishedAt = extractMeta(html, "article:published_time") ?? extractMeta(html, "datePublished");
          // Spoiler guard: skip anything published after the following episode aired.
          if (publishedAt && nextAirDate && publishedAt.slice(0, 10) > nextAirDate) continue;
          const title = extractMeta(html, "og:title") ?? /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() ?? url;
          out.push({ title, url, publishedAt, text: text.slice(0, MAX_ARTICLE_CHARS), site: site.id });
        } catch {
          /* skip unreachable article */
        }
      }
    } catch (err) {
      console.warn(`warn: ${site.name} listing unavailable: ${(err as Error).message}`);
    }
  }
  if (cfg.wikipediaSynopsis && ep.synopsis) {
    out.push({ title: `Wikipedia — Survivor ${season.season.id} episode synopsis`, url: `https://en.wikipedia.org/wiki/Survivor_${season.season.id}`, text: ep.synopsis, site: "wikipedia" });
  }
  return out;
}

// ---------- prompt ----------

function draftImpactFacts(season: SeasonData, ep: EpisodeView): string {
  const lines: string[] = [];
  const stepsThisEp = season.history.filter((h) => h.episode === ep.number);
  const before = season.history[Math.max(0, season.history.indexOf(stepsThisEp[0]!) - 1)] ?? season.history[0]!;
  const after = stepsThisEp[stepsThisEp.length - 1] ?? before;
  for (const d of season.season.drafters) {
    const delta = (after.totals[d.id] ?? 0) - (before.totals[d.id] ?? 0);
    const st = season.standings.find((s) => s.drafterId === d.id);
    const roster = season.contestants.filter((c) => c.drafterId === d.id);
    const lost = roster.filter((c) => ep.eliminations.some((e) => e.contestantSlug === c.slug)).map((c) => c.name);
    lines.push(
      `- ${d.name}: ${before.totals[d.id] ?? 0} → ${after.totals[d.id] ?? 0} (+${delta}) this episode; ${st?.remaining ?? roster.length} of ${roster.length} castaways still in` +
        (lost.length ? `; LOST ${lost.join(", ")}` : "") +
        (st?.dropped ? `; lowest scorer ${season.contestants.find((c) => c.slug === st.dropped)?.name} not counted (best-${season.season.handicap.countBest} rule)` : ""),
    );
  }
  const order = [...season.standings].sort((a, b) => a.rank - b.rank).map((s) => `${s.rank}. ${s.name} (${s.total})`);
  lines.push(`Current standings after this episode: ${order.join(", ")}`);
  return lines.join("\n");
}

function rosterFacts(season: SeasonData): string {
  return season.season.drafters
    .map((d) => {
      const names = season.contestants.filter((c) => c.drafterId === d.id).map((c) => `${c.name}${c.status === "eliminated" ? " (out)" : ""}`);
      return `- ${d.name}: ${names.join(", ")}`;
    })
    .join("\n");
}

function buildPrompt(season: SeasonData, ep: EpisodeView, articles: Article[]): { system: string; user: string } {
  const boots = ep.eliminations
    .map((e) => {
      const c = season.contestants.find((x) => x.slug === e.contestantSlug);
      const d = season.season.drafters.find((x) => x.id === c?.drafterId);
      return `${c?.name ?? e.contestantSlug} (${e.placementText ?? e.kind}${e.day ? `, Day ${e.day}` : ""}) — drafted by ${d?.name ?? "nobody"}`;
    })
    .join("\n");
  const system = `You are Jeff Probst, host of Survivor, writing a short post-episode note to a family fantasy draft of five people: ${season.season.drafters.map((d) => d.name).join(", ")}. Write in Jeff's voice: energetic, direct, a little theatrical, fond of "big moves," "blindside," and the drama of the vote — but keep it warm and fun; these are family. Use only facts from the provided sources and the draft data. Never invent events, quotes, or numbers. Never compute or restate point math beyond the numbers given to you. Do not speculate about future episodes. Refer to drafters by name when their castaways are involved.`;
  const sources = articles.map((a, i) => `<source index="${i + 1}" title="${a.title}" url="${a.url}"${a.publishedAt ? ` published="${a.publishedAt}"` : ""}>\n${a.text}\n</source>`).join("\n\n");
  const user = `Season: ${season.season.name}
Episode ${ep.number}${ep.title ? ` — "${ep.title}"` : ""}${ep.airDate ? `, aired ${ep.airDate}` : ""}

Eliminated this episode:
${boots || "(none recorded)"}
${ep.immunityWinners ? `Immunity: ${ep.immunityWinners}\n` : ""}${ep.rewardWinners ? `Reward: ${ep.rewardWinners}\n` : ""}
Draft rosters:
${rosterFacts(season)}

Draft impact (authoritative, computed by the scoring engine — quote these numbers, do not recalculate):
${draftImpactFacts(season, ep)}

Published recaps:
${sources || "(no articles available — write from the elimination facts only, and keep it short)"}

Respond with JSON only, matching exactly:
{
  "recap": "one paragraph, ~120-170 words, Jeff's voice, what happened this episode",
  "bullets": ["3 to 5 short punchy moments or observations, each one sentence"],
  "draftImpact": "one short paragraph, ~60-100 words, addressed to the five drafters by name: who gained ground, who lost a castaway, who leads",
  "sourcesUsed": [1, 2]
}`;
  return { system, user };
}

// ---------- main ----------

async function generateForEpisode(client: Anthropic | null, season: SeasonData, cfg: SourcesConfig, ep: EpisodeView, args: Args): Promise<Commentary | undefined> {
  const next = season.episodes.find((e) => e.number === ep.number + 1);
  const articles = await findArticles(cfg, season, ep, next?.airDate);
  const external = articles.filter((a) => a.site !== "wikipedia");
  const airedMs = ep.airDate ? new Date(`${ep.airDate}T22:00:00-04:00`).getTime() : 0;
  const hoursSince = airedMs ? (Date.now() - airedMs) / 3_600_000 : Infinity;
  if (external.length < cfg.minSources && hoursSince < cfg.maxWaitHours) {
    console.log(`ep ${ep.number}: only ${external.length} source(s) after ${hoursSince.toFixed(0)}h — waiting (need ${cfg.minSources} or ${cfg.maxWaitHours}h)`);
    return undefined;
  }
  const { system, user } = buildPrompt(season, ep, articles);
  if (args.dry || !client) {
    console.log(`--- ep ${ep.number} prompt (${articles.length} sources) ---\n${user.slice(0, 3000)}\n...`);
    return undefined;
  }
  // Server-side refusal fallbacks: if the safety classifier declines, the API
  // routes to a fallback model instead of returning an empty result.
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user" as const, content: user }],
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
  if (!json) throw new Error(`No JSON in model output: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(json) as { recap: string; bullets: string[]; draftImpact: string; sourcesUsed?: number[] };
  const used = (parsed.sourcesUsed ?? articles.map((_, i) => i + 1)).map((i) => articles[i - 1]).filter((a): a is Article => !!a);
  return {
    episode: ep.number,
    generatedAt: new Date().toISOString(),
    model: res.model ?? MODEL,
    recap: parsed.recap,
    bullets: parsed.bullets ?? [],
    draftImpact: parsed.draftImpact,
    sources: (used.length ? used : articles).map((a) => ({ title: a.title, url: a.url, publishedAt: a.publishedAt })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = readJson<SourcesConfig>(dataPath("sources.json"));
  const season = buildSeasonData(loadInputs());
  const targets = season.episodes.filter((e) => e.eliminations.length > 0 && (args.episode === undefined || e.number === args.episode));
  if (targets.length === 0) {
    console.log("No aired episodes with eliminations to summarize.");
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !args.dry) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = args.dry ? null : new Anthropic({ apiKey });
  for (const ep of targets) {
    const file = join(DATA_DIR, "commentary", `ep-${ep.number}.json`);
    if (existsSync(file) && !args.force) {
      if (args.episode !== undefined) console.log(`ep ${ep.number}: commentary exists (use --force to regenerate)`);
      continue;
    }
    const c = await generateForEpisode(client, season, cfg, ep, args);
    if (c) {
      writeJson(file, c);
      console.log(`ep ${ep.number}: wrote ${file} (${c.sources.length} sources)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
