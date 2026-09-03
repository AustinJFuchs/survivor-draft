// Idols, advantages, journeys, Shot in the Dark → data/<season>/events.json.
//   1. Deterministic: parse the Survivor Wiki per-type tables for this season.
//   2. Claude (optional, only when ANTHROPIC_API_KEY is set and the source text changed):
//      read the season page's "Twists/Changes" bullets + voting-table footnotes for
//      Open Era surprises with no type page yet → `type: "other"`, tagged `extracted: "claude"`.
//
//   npm run events
//   npm run events -- --dry            # parse only, print, don't write
//   npm run events -- --skip-claude

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { Contestant, GameEvent } from "../src/lib/types";
import { EVENT_PAGES, parseEventPage } from "./lib/fandom-events";
import { fetchWikitext, FANDOM_API } from "./lib/http";
import { NameMatcher } from "./lib/names";
import { dataPath, readJson, writeJson } from "./lib/paths";
import { plain, stripInvisible } from "./lib/wikitext";
import { anthropicKey } from "./lib/anthropic-key";

interface EventsFile {
  syncedAt: string;
  events: GameEvent[];
  claude?: { sourceHash: string; generatedAt: string; model: string };
  warnings: string[];
}

const MODEL = "claude-opus-5";

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const skipClaude = argv.includes("--skip-claude");
  const season = readJson<{ id: string }>(dataPath("season.json")).id;
  const contestants = readJson<Contestant[]>(dataPath("contestants.json"));
  const matcher = new NameMatcher(contestants);
  const prev = readJson<EventsFile | undefined>(dataPath("events.json"), undefined);
  const warnings: string[] = [];
  const events: GameEvent[] = [];

  // ---- 1. Tables ----
  for (const page of EVENT_PAGES) {
    try {
      const wt = await fetchWikitext(FANDOM_API, page);
      if (!wt) {
        warnings.push(`missing page ${page}`);
        continue;
      }
      for (const e of parseEventPage(page, wt, season)) {
        const slug = matcher.match(e.contestant);
        if (!slug) {
          warnings.push(`${page}: unmatched castaway "${e.contestant}"`);
          continue;
        }
        const targetSlug = e.target ? matcher.match(e.target) : undefined;
        events.push({ ...e, id: `${page.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${slug}-${e.type}-${e.episode ?? "x"}`, contestantSlug: slug, targetSlug });
      }
    } catch (err) {
      warnings.push(`${page}: ${(err as Error).message}`);
    }
  }

  // ---- 2. Claude for the unknown (Open Era) ----
  let claudeMeta = prev?.claude;
  let claudeEvents = (prev?.events ?? []).filter((e) => e.extracted === "claude");
  if (!skipClaude && !dry) {
    const seasonPage = (await fetchWikitext(FANDOM_API, `Survivor_${season}`)) ?? "";
    const voteTable = (await fetchWikitext(FANDOM_API, `Template:S${season}votetable`)) ?? "";
    const twists = /==\s*Twists\/Changes\s*==([\s\S]*?)(?:\n==[^=]|$)/.exec(seasonPage)?.[1] ?? "";
    const notes = [...voteTable.matchAll(/\{\{note\|[^}]*\}\}([^\n]*)/g)].map((m) => plain(m[1]!)).join("\n");
    const source = `${plain(stripInvisible(twists))}\n\n${notes}`.trim();
    const hash = createHash("sha1").update(source).digest("hex").slice(0, 12);
    const apiKey = anthropicKey();
    if (source.length > 40 && apiKey && claudeMeta?.sourceHash !== hash) {
      const known = events.map((e) => `${e.contestant} ${e.type} ep${e.episode ?? "?"} ${e.advantage ?? ""}`).join("\n");
      const client = new Anthropic({ apiKey });
      const prompt = `Season: Survivor ${season}. Castaways: ${contestants.map((c) => c.name).join(", ")}.\n\nAlready tracked from structured tables (do NOT repeat these):\n${known || "(none yet)"}\n\nSource text (wiki "Twists/Changes" bullets and voting-table footnotes):\n${source}\n\nExtract ONLY concrete in-game events involving a named castaway that are NOT in the tracked list — e.g. a new twist being used, an advantage with no known type, someone gaining/losing a vote from a twist. Ignore format descriptions with no castaway. Respond with JSON only: {"events":[{"contestant":"Full Name","episode":number|null,"day":number|null,"advantage":"short name of the twist/advantage","outcome":"success"|"fail"|"pending"|null,"detail":"one sentence"}]}`;
      const params = {
        model: MODEL,
        max_tokens: 1500,
        system: "You extract structured facts from Survivor wiki text. Never invent; if unsure, omit.",
        messages: [{ role: "user" as const, content: prompt }],
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        stream: false as const,
      };
      const res = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.BetaMessage;
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const json = /\{[\s\S]*\}/.exec(text)?.[0];
      const parsed = json ? (JSON.parse(json) as { events?: { contestant: string; episode?: number | null; day?: number | null; advantage?: string; outcome?: "success" | "fail" | "pending" | null; detail?: string }[] }) : { events: [] };
      claudeEvents = [];
      for (const [i, e] of (parsed.events ?? []).entries()) {
        const slug = matcher.match(e.contestant);
        if (!slug) continue;
        claudeEvents.push({
          id: `claude-${slug}-${e.episode ?? "x"}-${i}`,
          type: "other",
          contestant: e.contestant,
          contestantSlug: slug,
          episode: e.episode ?? undefined,
          day: e.day ?? undefined,
          advantage: e.advantage,
          outcome: e.outcome ?? undefined,
          detail: e.detail,
          source: { page: `Survivor ${season} (wiki twists & footnotes)`, url: `https://survivor.fandom.com/wiki/Survivor_${season}` },
          extracted: "claude",
        });
      }
      claudeMeta = { sourceHash: hash, generatedAt: new Date().toISOString(), model: res.model ?? MODEL };
    } else if (!apiKey) {
      warnings.push("ANTHROPIC_API_KEY not set — skipped Claude extraction of Open Era twists");
    }
  }

  const all = [...events, ...claudeEvents].sort((a, b) => (a.episode ?? 99) - (b.episode ?? 99) || (a.day ?? 99) - (b.day ?? 99));
  const out: EventsFile = { syncedAt: new Date().toISOString(), events: all, claude: claudeMeta, warnings };
  if (dry) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  writeJson(dataPath("events.json"), out);
  console.log(`events.json: ${events.length} from tables, ${claudeEvents.length} from Claude${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
  for (const w of warnings) console.warn(`warn: ${w}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
