// Scrape Wikipedia (scoring facts) + Survivor Wiki (extras) → data/<season>/scraped.json.
//
//   npm run scrape             # live
//   npm run scrape -- --dry    # print result, don't write
//   npm run scrape -- --offline scripts/fixtures/wikipedia-survivor-49.wikitext
//
// scraped.json is machine-owned and fully regenerated each run. Human fixes go
// in overrides.json and are applied by build-data.ts.

import { readFileSync } from "node:fs";
import type { Contestant, Elimination, EpisodeInfo, Milestones, ScrapedData, WikiExtras, ContestantTribes } from "../src/lib/types";
import { dataPath, readJson, writeJson } from "./lib/paths";
import { fetchWikitext, WIKIPEDIA_API } from "./lib/http";
import { NameMatcher } from "./lib/names";
import {
  parseContestantTable,
  parseEpisodeList,
  parseInfoboxWinner,
  parsePlacement,
  parseSeasonSummary,
  parseVotingHistory,
} from "./lib/wikipedia";
import { fetchContestantExtras, listSeasonContestantPages } from "./lib/fandom";

interface Args {
  dry: boolean;
  offline?: string;
  skipFandom: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dry: false, skipFandom: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry") args.dry = true;
    else if (a === "--offline") args.offline = argv[++i];
    else if (a === "--skip-fandom") args.skipFandom = true;
  }
  return args;
}

export interface ScrapeResult {
  data: ScrapedData;
}

export async function scrape(args: Args): Promise<ScrapedData> {
  const season = readJson<{ id: string; name: string; totalContestants: number }>(dataPath("season.json"));
  const contestants = readJson<Contestant[]>(dataPath("contestants.json"));
  const matcher = new NameMatcher(contestants);
  const warnings: string[] = [];

  const wikipediaPage = `Survivor_${season.id}`;
  const wikitext = args.offline
    ? readFileSync(args.offline, "utf8")
    : await fetchWikitext(WIKIPEDIA_API, wikipediaPage);
  if (!wikitext) throw new Error(`Wikipedia page ${wikipediaPage} not found`);

  // ---- Contestant table → tribes, eliminations, milestones ----
  const rows = parseContestantTable(wikitext);
  if (rows.length === 0) warnings.push("Wikipedia: contestant table not found");
  const tribes: Record<string, ContestantTribes> = {};
  const milestones: Milestones = { merged: [], finalists: [], placements: {} };
  const eliminations: Elimination[] = [];
  const rowSlug = new Map<number, string>();

  for (const row of rows) {
    const slug = matcher.match(row.name);
    if (!slug) {
      warnings.push(`Wikipedia: unmatched contestant name "${row.name}"`);
      continue;
    }
    rowSlug.set(row.index, slug);
    const history = [row.tribes.original, ...row.tribes.switches, row.tribes.merged].filter((t): t is string => !!t);
    tribes[slug] = {
      original: row.tribes.original,
      current: history[history.length - 1],
      history,
      merged: row.tribes.merged,
    };
    if (row.tribes.merged) milestones.merged.push(slug);
    const p = parsePlacement(row.placementText);
    if (p.finalist) {
      milestones.finalists.push(slug);
      if (p.finalRank) milestones.placements[slug] = p.finalRank;
      if (p.winner) milestones.winner = slug;
    } else if (p.eliminated) {
      eliminations.push({
        order: 0, // assigned below
        contestantSlug: slug,
        day: row.day,
        kind: p.kind ?? "other",
        placementText: row.placementText,
        juryMember: p.juryMember,
      });
    }
  }
  // Table order is finish order (first out first).
  eliminations.forEach((e, i) => (e.order = i + 1));
  const total = rows.length || season.totalContestants;
  eliminations.forEach((e, i) => (milestones.placements[e.contestantSlug] = total - i));

  // ---- Voting history → episode for each elimination ----
  const vh = parseVotingHistory(wikitext);
  const epByName = new Map<string, { episode?: number; day?: number }>();
  for (const c of vh.columns) {
    if (!c.eliminated) continue;
    const slug = matcher.match(c.eliminated);
    if (slug) epByName.set(slug, { episode: c.episode, day: c.day });
    else warnings.push(`Wikipedia voting history: unmatched name "${c.eliminated}"`);
  }
  // Fallback: season summary "Player" column.
  const summary = parseSeasonSummary(wikitext);
  for (const s of summary) {
    for (const name of s.eliminated) {
      const slug = matcher.match(name);
      if (slug && !epByName.has(slug)) epByName.set(slug, { episode: s.episode });
    }
  }
  for (const e of eliminations) {
    const hit = epByName.get(e.contestantSlug);
    if (hit) {
      e.episode = hit.episode;
      e.day = e.day ?? hit.day;
    } else {
      warnings.push(`No episode found for elimination of ${e.contestantSlug}`);
    }
  }

  // Merge episode: first voting-history column whose tribe is the merged tribe.
  if (milestones.merged.length > 0) {
    const mergedTribe = vh.mergedTribe ?? Object.values(tribes).find((t) => t.merged)?.merged;
    const col = vh.columns.find((c) => c.tribe && mergedTribe && c.tribe.toLowerCase() === mergedTribe.toLowerCase());
    if (col?.episode) milestones.mergeEpisode = col.episode;
    else {
      const eps = eliminations.filter((e) => milestones.merged.includes(e.contestantSlug) && e.episode).map((e) => e.episode!);
      if (eps.length) milestones.mergeEpisode = Math.min(...eps);
    }
  }
  if (!milestones.winner) {
    const w = parseInfoboxWinner(wikitext);
    const slug = w ? matcher.match(w) : undefined;
    if (slug) milestones.winner = slug;
  }

  // ---- Episodes ----
  const today = new Date().toISOString().slice(0, 10);
  const episodes: EpisodeInfo[] = parseEpisodeList(wikitext).map((e) => ({
    number: e.number,
    title: e.title,
    airDate: e.airDate,
    synopsis: e.synopsis,
    aired: e.airDate ? e.airDate <= today : undefined,
  }));
  for (const s of summary) {
    let ep = episodes.find((e) => e.number === s.episode);
    if (!ep) {
      ep = { number: s.episode };
      episodes.push(ep);
    }
    ep.rewardWinners = s.reward;
    ep.immunityWinners = s.immunity;
  }
  episodes.sort((a, b) => a.number - b.number);

  // ---- Survivor Wiki extras ----
  const extras: Record<string, WikiExtras> = {};
  let survivorWikiUrl: string | undefined;
  if (!args.skipFandom && !args.offline) {
    try {
      const pages = await listSeasonContestantPages(season.id);
      survivorWikiUrl = `https://survivor.fandom.com/wiki/Survivor_${season.id}`;
      for (const title of pages) {
        const slug = matcher.match(title);
        if (!slug) {
          warnings.push(`Survivor Wiki: unmatched page "${title}"`);
          continue;
        }
        try {
          const x = await fetchContestantExtras(title);
          if (x) extras[slug] = x;
        } catch (err) {
          warnings.push(`Survivor Wiki: failed ${title}: ${(err as Error).message}`);
        }
      }
      const missing = contestants.filter((c) => !extras[c.slug]).map((c) => c.slug);
      if (missing.length) warnings.push(`Survivor Wiki: no page matched for ${missing.join(", ")}`);
    } catch (err) {
      warnings.push(`Survivor Wiki unavailable: ${(err as Error).message}`);
    }
  }

  return {
    syncedAt: new Date().toISOString(),
    sources: {
      wikipedia: args.offline ? `offline:${args.offline}` : `https://en.wikipedia.org/wiki/${wikipediaPage}`,
      survivorWiki: survivorWikiUrl,
    },
    tribes,
    episodes,
    eliminations,
    milestones,
    extras,
    warnings,
  };
}

const isMain = process.argv[1] && /scrape\.ts$/.test(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  scrape(args)
    .then((data) => {
      if (args.dry) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        // Preserve extras from the previous run if Fandom was skipped/unavailable.
        if (Object.keys(data.extras).length === 0) {
          const prev = readJson<ScrapedData | undefined>(dataPath("scraped.json"), undefined);
          if (prev?.extras) data.extras = prev.extras;
        }
        writeJson(dataPath("scraped.json"), data);
        console.log(`Wrote scraped.json: ${data.eliminations.length} eliminations, ${data.episodes.length} episodes, ${Object.keys(data.extras).length} wiki extras`);
      }
      for (const w of data.warnings) console.warn(`warn: ${w}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
