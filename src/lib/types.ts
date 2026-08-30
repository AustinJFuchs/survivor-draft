// Shared domain types. Used by the frontend (src/) and the pipeline (scripts/).
//
// Data flows: season.json + contestants.json + draft.json (hand-maintained)
//   + scraped.json (machine-owned, regenerated each run)
//   + overrides.json (human-owned, always wins)
//   + commentary/ep-N.json (generated once per episode)
//   → build-data.ts merges → src/generated/season.json → app.

export type SeasonId = string; // "51"

export interface ScoringConfig {
  /** Points every still-in-the-game contestant earns per elimination event. */
  perEliminationSurvived: number;
  /** Bonus for making the merge. */
  merge: number;
  /** Bonus for reaching Final Tribal Council (finalists). */
  finalTribal: number;
  /** Bonus for winning the season. */
  winner: number;
}

export interface HandicapConfig {
  /** Drafters with more contestants than this only count their best N. */
  countBest: number;
}

export interface Drafter {
  id: string; // "tami"
  name: string; // "Tami"
  draftPosition: number; // 1-based
}

export interface SeasonConfig {
  id: SeasonId;
  name: string; // "Survivor 51"
  subtitle?: string;
  premiereDate: string; // ISO date, ET
  /** Used for "prize valid until" text. Optional until announced. */
  nextSeasonPremiereDate?: string;
  nextSeasonName?: string;
  timezone: string; // "America/New_York"
  totalContestants: number;
  drafters: Drafter[];
  scoring: ScoringConfig;
  handicap: HandicapConfig;
  prize: { title: string; description: string; validUntil: string };
  groupName?: string;
}

export interface Contestant {
  slug: string; // "brady-booker"
  name: string; // "Brady Booker"
  nickname?: string; // "Jelly", "Kilby", "Thien An"
  /** Short name used on Wikipedia/wiki voting tables (first name or nickname). */
  shortName: string;
  age: number;
  hometown: string;
  residence?: string;
  occupation: string;
  bio?: string;
  photo?: string; // path under public/, e.g. "photos/51/brady-booker.jpg"
  /** Extra aliases for matching scraped names. */
  aliases?: string[];
}

export interface DraftPick {
  round: number;
  overall: number; // 1..N
  drafterId: string;
  contestantSlug: string;
  /** True for the undrafted leftover assigned to a drafter. */
  leftover?: boolean;
}

export interface DraftConfig {
  seasonId: SeasonId;
  style: "snake";
  picks: DraftPick[];
}

export type EliminationKind =
  | "voted-out"
  | "medevac"
  | "quit"
  | "removed"
  | "fire" // lost fire-making at final four
  | "other";

export interface Elimination {
  /** 1-based order in which contestants left the game. */
  order: number;
  contestantSlug: string;
  episode?: number;
  day?: number;
  kind: EliminationKind;
  /** Raw placement text from the source, e.g. "7th voted out, 1st jury member". */
  placementText?: string;
  juryMember?: boolean;
  note?: string;
}

export interface EpisodeInfo {
  number: number;
  title?: string;
  airDate?: string; // ISO date
  synopsis?: string;
  /** Display-only. Free text as parsed from the source. */
  rewardWinners?: string;
  immunityWinners?: string;
  aired?: boolean;
}

export interface Milestones {
  /** Contestants who made the merge (scraped from the "Merged" tribe column). */
  merged: string[];
  mergeEpisode?: number;
  /** Contestants who reached Final Tribal Council. */
  finalists: string[];
  winner?: string;
  /** Final placements when known, slug → 1 = winner. */
  placements: Record<string, number>;
}

export interface ContestantTribes {
  original?: string;
  current?: string;
  /** Every tribe in order (original → swaps → merged). */
  history: string[];
  merged?: string;
}

export interface WikiExtras {
  bio?: string;
  threeWords?: string[];
  trivia?: string[];
  challengeWins?: number;
  votesAgainst?: number;
  daysLasted?: string;
  pageUrl?: string;
}

export interface ScrapedData {
  syncedAt: string; // ISO timestamp
  sources: { wikipedia?: string; survivorWiki?: string };
  tribes: Record<string, ContestantTribes>;
  episodes: EpisodeInfo[];
  eliminations: Elimination[];
  milestones: Milestones;
  extras: Record<string, WikiExtras>;
  warnings: string[];
}

export interface Quote {
  id: string;
  episode?: number;
  drafterId: string;
  text: string;
  date?: string;
}

export interface Commentary {
  episode: number;
  generatedAt: string;
  model: string;
  recap: string;
  bullets: string[];
  draftImpact: string;
  sources: { title: string; url: string; publishedAt?: string }[];
  /** Set when a human edited the generated text. */
  edited?: boolean;
}

/** Human-owned corrections. Every field optional; anything present wins. */
export interface Overrides {
  contestants?: Record<string, Partial<Omit<Contestant, "slug">>>;
  tribes?: Record<string, Partial<ContestantTribes>>;
  /** Replace/add elimination records by contestant slug. */
  eliminations?: Partial<Elimination>[];
  /** Remove scraped eliminations for these contestants (e.g. bad data). */
  removeEliminations?: string[];
  episodes?: Partial<EpisodeInfo>[];
  milestones?: Partial<Milestones>;
  funFacts?: Record<string, string[]>;
  quotes?: Quote[];
  commentary?: Record<string, Partial<Commentary>>;
  /** Free-form notes shown on the Rules tab. */
  notes?: string[];
}

// ---------- Merged/derived model consumed by the app ----------

export type ContestantStatus =
  | "active"
  | "eliminated"
  | "finalist"
  | "winner";

export interface ContestantView extends Contestant {
  drafterId?: string;
  pick?: DraftPick;
  tribes: ContestantTribes;
  status: ContestantStatus;
  elimination?: Elimination;
  placement?: number;
  merged: boolean;
  finalist: boolean;
  winner: boolean;
  extras?: WikiExtras;
  funFacts: { text: string; source: "wiki" | "manual" }[];
  points: ContestantPoints;
}

export interface ContestantPoints {
  survival: number;
  merge: number;
  finalTribal: number;
  winner: number;
  total: number;
}

export interface DrafterStanding {
  drafterId: string;
  name: string;
  /** Sum of all contestants' points. */
  rawTotal: number;
  /** Total under the handicap rule (best N). */
  total: number;
  /** Slugs counted toward `total`. */
  counted: string[];
  /** Slug dropped by the handicap, if any. */
  dropped?: string;
  remaining: number;
  rank: number; // 1-based, ties share a rank
  tied: boolean;
}

export interface HistoryPoint {
  /** Elimination order index (0 = pre-season). */
  step: number;
  label: string;
  episode?: number;
  totals: Record<string, number>; // drafterId → counted total
}

export interface EpisodeView extends EpisodeInfo {
  eliminations: Elimination[];
  commentary?: Commentary;
  quotes: Quote[];
}

export interface SeasonData {
  season: SeasonConfig;
  contestants: ContestantView[];
  draft: DraftConfig;
  episodes: EpisodeView[];
  eliminations: Elimination[];
  milestones: Milestones;
  standings: DrafterStanding[];
  history: HistoryPoint[];
  syncedAt?: string;
  builtAt: string;
  warnings: string[];
  notes: string[];
  /** True once at least one elimination has been recorded. */
  seasonStarted: boolean;
}
