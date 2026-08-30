// Match names found in scraped tables ("Kilby", "Thien An", "Angelica \"Jelly\" Loblack")
// to contestant slugs.

import type { Contestant } from "../../src/lib/types";

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'“”‘’]/g, "")
    .replace(/[^a-z0-9 ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export class NameMatcher {
  private exact = new Map<string, string>();
  private firsts = new Map<string, string[]>();

  constructor(contestants: Contestant[]) {
    for (const c of contestants) {
      const keys = new Set<string>([c.name, c.shortName, ...(c.aliases ?? [])]);
      if (c.nickname) {
        keys.add(c.nickname);
        const [first, ...rest] = c.name.split(" ");
        keys.add(`${first} "${c.nickname}" ${rest.join(" ")}`);
        keys.add(`${c.nickname} ${rest.join(" ")}`);
      }
      for (const k of keys) {
        const n = normalizeName(k);
        if (n) this.exact.set(n, c.slug);
      }
      // First-token index for fuzzy fallback.
      for (const k of [c.shortName, c.name.split(" ")[0]!, c.nickname ?? ""]) {
        const n = normalizeName(k);
        if (!n) continue;
        const list = this.firsts.get(n) ?? [];
        if (!list.includes(c.slug)) list.push(c.slug);
        this.firsts.set(n, list);
      }
    }
  }

  /** Returns a slug or undefined. Never guesses when ambiguous. */
  match(name: string): string | undefined {
    const n = normalizeName(name);
    if (!n) return undefined;
    const hit = this.exact.get(n);
    if (hit) return hit;
    // Try "First Last" reduced to first token, and quoted-nickname forms.
    const tokens = n.split(" ");
    const cands = new Set<string>();
    for (const t of tokens) for (const s of this.firsts.get(t) ?? []) cands.add(s);
    if (cands.size === 1) return [...cands][0];
    // Try full-name containment (e.g. "Angelica Jelly Loblack" vs "Angelica Loblack").
    for (const [k, slug] of this.exact) {
      const kt = k.split(" ");
      if (kt.length >= 2 && kt.every((t) => tokens.includes(t))) return slug;
    }
    return undefined;
  }
}
