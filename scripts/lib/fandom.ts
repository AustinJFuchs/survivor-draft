// Survivor Wiki (Fandom) extras: bio, "3 words", trivia, challenge wins, votes
// against. Display only — never used for scoring.

import { fetchJson, fetchWikitext, FANDOM_API } from "./http";
import { findTemplates, plain, stripInvisible } from "./wikitext";
import type { WikiExtras } from "../../src/lib/types";

export async function listSeasonContestantPages(season: string): Promise<string[]> {
  const url = `${FANDOM_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(`Category:Survivor ${season} Contestants`)}&cmlimit=100&cmnamespace=0&format=json&formatversion=2`;
  const data = await fetchJson<{ query?: { categorymembers?: { title: string }[] } }>(url);
  return (data.query?.categorymembers ?? []).map((m) => m.title);
}

export async function fetchContestantExtras(pageTitle: string): Promise<WikiExtras | undefined> {
  const wt = await fetchWikitext(FANDOM_API, pageTitle);
  if (!wt) return undefined;
  const extras = parseContestantPage(wt);
  extras.pageUrl = `https://survivor.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
  return extras;
}

export function parseContestantPage(wikitext: string): WikiExtras {
  const out: WikiExtras = {};
  const infobox = findTemplates(wikitext, "Contestant")[0];
  if (infobox) {
    const n = (k: string) => {
      const v = plain(infobox.named[k] ?? "");
      const num = Number(v.replace(/[^\d.]/g, ""));
      return v && Number.isFinite(num) ? num : undefined;
    };
    out.challengeWins = n("challenges");
    out.votesAgainst = n("votesagainst");
    const days = plain(infobox.named["days"] ?? "");
    if (days) out.daysLasted = days;
  }

  // Bio: prose between the infobox and the first section heading.
  const afterInfobox = infobox ? wikitext.slice(wikitext.indexOf(infobox.raw) + infobox.raw.length) : wikitext;
  const firstHeading = afterInfobox.search(/^==/m);
  const lead = afterInfobox.slice(0, firstHeading < 0 ? undefined : firstHeading);
  const paragraphs = stripInvisible(lead)
    .split(/\n\s*\n/)
    .map((p) => plain(p))
    .filter((p) => p.length > 40 && !/^\[\[File:/i.test(p))
    // Placeholder stubs ("X is a castaway from Survivor 51.") carry no information.
    .filter((p) => !/^[^.]{0,60} is a castaway from Survivor \d+\.$/i.test(p));
  if (paragraphs.length) out.bio = paragraphs.slice(0, 2).join("\n\n");

  // "3 Words to Describe You: a, b, c" from the Profile section.
  const three = /3 Words to Describe You:?'*\s*([^<\n]+)/i.exec(wikitext);
  if (three) {
    const words = plain(three[1]!)
      .split(/[,;.]|\band\b|\(/i)
      // "Consistent— never too high..." → "consistent"
      .map((w) => w.split(/\s*[—–-]{1,2}\s/)[0]!.trim().replace(/[.!]+$/, "").toLowerCase())
      .filter((w) => w.length > 0 && w.length <= 20 && w.split(" ").length <= 2);
    if (words.length) out.threeWords = words.slice(0, 3);
  }

  // Trivia bullets.
  const triviaStart = wikitext.search(/^==\s*Trivia\s*==/m);
  if (triviaStart >= 0) {
    const rest = wikitext.slice(triviaStart);
    const nextHeading = rest.slice(3).search(/^==[^=]/m);
    const section = rest.slice(0, nextHeading < 0 ? undefined : nextHeading + 3);
    const items = section
      .split("\n")
      .filter((l) => /^\*+\s*/.test(l))
      .map((l) => plain(l.replace(/^\*+\s*/, "")))
      .filter((l) => l.length > 15 && !/^\{\{/.test(l));
    if (items.length) out.trivia = items.slice(0, 12);
  }
  return out;
}
