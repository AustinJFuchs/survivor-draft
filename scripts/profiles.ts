// Generate a short "who is this person" profile per castaway from the Survivor
// Wiki questionnaire + bio, with claude-opus-5 → data/<season>/profiles.json.
//
//   npm run profiles                     # only castaways missing a profile (or whose questionnaire changed)
//   npm run profiles -- --slug brady-booker --force
//   npm run profiles -- --dry            # print prompts, no API calls
//
// Profiles are generated once; edits go in overrides.profiles[slug] and survive.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { Contestant, Profile, ScrapedData } from "../src/lib/types";
import { dataPath, readJson, writeJson } from "./lib/paths";
import { anthropicKey, skipNotice } from "./lib/anthropic-key";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 1200;

interface Args {
  slug?: string;
  force: boolean;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug") a.slug = argv[++i];
    else if (argv[i] === "--force") a.force = true;
    else if (argv[i] === "--dry") a.dry = true;
  }
  return a;
}

function sourceText(c: Contestant, x: ScrapedData["extras"][string] | undefined): string {
  const lines = [
    `Name: ${c.name}${c.nickname ? ` ("${c.nickname}")` : ""}`,
    `Age: ${c.age}`,
    `Occupation: ${c.occupation}`,
    `Hometown: ${c.hometown}${c.residence && c.residence !== c.hometown ? ` (lives in ${c.residence})` : ""}`,
  ];
  if (x?.threeWords) lines.push(`Three words: ${x.threeWords.join(", ")}`);
  if (x?.bio) lines.push(`\nWiki bio:\n${x.bio}`);
  if (x?.qa?.length) {
    lines.push("\nPre-season questionnaire:");
    for (const q of x.qa) lines.push(`Q: ${q.question}\nA: ${q.answer}`);
  }
  if (x?.trivia?.length) lines.push(`\nTrivia:\n- ${x.trivia.join("\n- ")}`);
  return lines.join("\n");
}

const SYSTEM = `You write short, warm, accurate castaway profiles for a family's private Survivor fantasy-draft site. Use only the material provided. Third person, present tense, no hype, no speculation about how they'll do in the game, no invented facts. Plain language a teenager and a grandparent would both enjoy.`;

function userPrompt(src: string): string {
  return `Source material:\n\n${src}\n\nWrite a profile as JSON only, exactly:\n{\n  "summary": "2-3 sentences (max ~60 words) capturing who they are, what drives them, and their vibe",\n  "bullets": ["3 to 4 short, concrete, memorable facts or traits — each under 14 words, no trailing periods"]\n}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contestants = readJson<Contestant[]>(dataPath("contestants.json"));
  const scraped = readJson<ScrapedData>(dataPath("scraped.json"));
  const file = dataPath("profiles.json");
  const profiles = readJson<Record<string, Profile>>(file, {});

  const targets = contestants.filter((c) => !args.slug || c.slug === args.slug);
  const todo = targets.filter((c) => {
    const src = sourceText(c, scraped.extras[c.slug]);
    const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
    const existing = profiles[c.slug];
    return args.force || !existing || existing.sourceHash !== hash;
  });
  if (todo.length === 0) {
    console.log("All profiles up to date.");
    return;
  }
  console.log(`${todo.length} profile(s) to generate: ${todo.map((c) => c.slug).join(", ")}`);

  const apiKey = anthropicKey();
  if (!apiKey && !args.dry) {
    skipNotice("profile generation");
    return;
  }
  const client = args.dry ? null : new Anthropic({ apiKey });

  for (const c of todo) {
    const src = sourceText(c, scraped.extras[c.slug]);
    const hash = createHash("sha1").update(src).digest("hex").slice(0, 12);
    if (!client) {
      console.log(`--- ${c.slug} ---\n${userPrompt(src).slice(0, 800)}\n...`);
      continue;
    }
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user" as const, content: userPrompt(src) }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      stream: false as const,
    };
    const res = (await client.beta.messages.create(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming)) as Anthropic.Beta.BetaMessage & {
      stop_details?: unknown;
    };
    if ((res.stop_reason as string) === "refusal") throw new Error(`Model refused for ${c.slug} (${JSON.stringify(res.stop_details)})`);
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    if (!json) throw new Error(`No JSON for ${c.slug}: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(json) as { summary: string; bullets: string[] };
    profiles[c.slug] = {
      slug: c.slug,
      summary: parsed.summary.trim(),
      bullets: (parsed.bullets ?? []).map((b) => b.trim().replace(/\.$/, "")).filter(Boolean).slice(0, 4),
      generatedAt: new Date().toISOString(),
      model: res.model ?? MODEL,
      sourceHash: hash,
    };
    writeJson(file, Object.fromEntries(Object.entries(profiles).sort(([a], [b]) => a.localeCompare(b))));
    console.log(`${c.slug}: ${profiles[c.slug]!.summary.slice(0, 80)}…`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
