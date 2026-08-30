import type { SeasonData } from "./lib/types";
import generated from "./generated/season.json";

export const data = generated as unknown as SeasonData;

export const drafterIndex = new Map(data.season.drafters.map((d, i) => [d.id, i]));
export const drafterById = new Map(data.season.drafters.map((d) => [d.id, d]));
export const contestantBySlug = new Map(data.contestants.map((c) => [c.slug, c]));

/** CSS color variable for a drafter, stable across the app. */
export function drafterColor(drafterId: string | undefined): string {
  if (!drafterId) return "var(--color-sand-400)";
  const i = drafterIndex.get(drafterId) ?? 0;
  return `var(--color-d${(i % 6) + 1})`;
}

export function photoUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
