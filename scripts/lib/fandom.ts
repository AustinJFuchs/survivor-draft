// Survivor Wiki (Fandom) extras: bio, "3 words", the EW/CBS questionnaire,
// trivia, challenge wins, votes against, birthdate, alliances, extra photos.
// Display only — never used for scoring.

import { fetchJson, fetchWikitext, FANDOM_API } from "./http";
import { findTemplates, plain, stripInvisible } from "./wikitext";
import type { WikiExtras } from "../../src/lib/types";

export async function listSeasonContestantPages(season: string): Promise<string[]> {
  const url = `${FANDOM_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(`Category:Survivor ${season} Contestants`)}&cmlimit=100&cmnamespace=0&format=json&formatversion=2`;
  const data = await fetchJson<{ query?: { categorymembers?: { title: string }[] } }>(url);
  return (data.query?.categorymembers ?? []).map((m) => m.title);
}

export async function fetchContestantExtras(pageTitle: string, season: string): Promise<WikiExtras | undefined> {
  const wt = await fetchWikitext(FANDOM_API, pageTitle);
  if (!wt) return undefined;
  const extras = parseContestantPage(wt);
  extras.pageUrl = `https://survivor.fandom.com/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
  try {
    const photos = await fetchPagePhotos(pageTitle, season);
    if (photos.length) extras.photos = photos;
  } catch {
    /* photos are optional */
  }
  return extras;
}

/**
 * Season-tagged images on the page (e.g. "S51 Brady Booker.jpg", "S51 brady t.png",
 * tribe-portrait shots). Skips the small thumbnail; the main portrait is already
 * in the repo, so it's excluded too when recognisable.
 */
export async function fetchPagePhotos(pageTitle: string, season: string): Promise<{ url: string; caption?: string }[]> {
  const url = `${FANDOM_API}?action=query&prop=images&titles=${encodeURIComponent(pageTitle)}&imlimit=50&format=json&formatversion=2`;
  const data = await fetchJson<{ query?: { pages?: { images?: { title: string }[] }[] } }>(url);
  const titles = (data.query?.pages?.[0]?.images ?? []).map((i) => i.title);
  const tag = new RegExp(`^File:S${season}[ _]`, "i");
  const wanted = titles.filter((t) => tag.test(t) && !/[ _]t\.png$/i.test(t)).slice(0, 12);
  if (wanted.length === 0) return [];
  const infoUrl = `${FANDOM_API}?action=query&prop=imageinfo&iiprop=url|size&titles=${encodeURIComponent(wanted.join("|"))}&format=json&formatversion=2`;
  const info = await fetchJson<{ query?: { pages?: { title: string; imageinfo?: { url: string; width: number; height: number }[] }[] } }>(infoUrl);
  const out: { url: string; caption?: string }[] = [];
  for (const p of info.query?.pages ?? []) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 200) continue;
    const caption = p.title
      .replace(/^File:/, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(new RegExp(`^S${season}[ _]`, "i"), "")
      .replace(/_/g, " ")
      .trim();
    // Serve a reasonably sized rendition; Fandom honours scale-to-width-down.
    const scaled = ii.url.replace(/\/revision\/latest.*$/, "/revision/latest/scale-to-width-down/640");
    out.push({ url: scaled, caption });
  }
  return out;
}

const SKIP_QA = /^(age|hometown|current residence|occupation|3 words to describe you|three words to describe you)$/i;

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
    const bd = /\{\{\s*birth date(?: and age)?\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i.exec(infobox.named["birthdate"] ?? "");
    if (bd) out.birthdate = `${bd[1]}-${bd[2]!.padStart(2, "0")}-${bd[3]!.padStart(2, "0")}`;
    const alliances = (infobox.named["alliances"] ?? "")
      .split(/<br\s*\/?>|,/)
      .map((a) => plain(a))
      .filter((a) => a.length > 0);
    if (alliances.length) out.alliances = alliances;
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

  // Profile section: '''Question:''' answer<br /> lines. Multi-season pages wrap
  // each season in <tabber>; the first tab is the earliest season.
  const profStart = wikitext.search(/^==\s*Profile\s*==/m);
  if (profStart >= 0) {
    let section = wikitext.slice(profStart + 1);
    const next = section.search(/^==[^=]/m);
    if (next >= 0) section = section.slice(0, next);
    const tab = /<tabber>([\s\S]*?)(?:\|-\||<\/tabber>)/.exec(section);
    if (tab) section = tab[1]!;
    const qa: { question: string; answer: string }[] = [];
    // One entry per line: '''Label:''' answer   (labels may contain ''italics'' but never ''')
    for (const line of section.split(/<br\s*\/?>|\n/)) {
      const m = /^\s*'''((?:(?!''')[\s\S])+?)'''\s*([\s\S]*)$/.exec(line);
      if (!m) continue;
      const question = plain(m[1]!).replace(/:$/, "").trim();
      const answer = plain(m[2]!).trim();
      if (!question || !answer) continue;
      if (/^3 words to describe you|^three words/i.test(question)) {
        const words = answer
          .split(/[,;.]|\band\b|\(/i)
          .map((w) => w.split(/\s*[—–-]{1,2}\s/)[0]!.trim().replace(/[.!]+$/, "").toLowerCase())
          .filter((w) => w.length > 0 && w.length <= 20 && w.split(" ").length <= 2);
        if (words.length) out.threeWords = words.slice(0, 3);
        continue;
      }
      if (SKIP_QA.test(question)) continue;
      qa.push({ question, answer });
    }
    if (qa.length) out.qa = qa.slice(0, 14);
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
