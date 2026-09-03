// Shared handling for the Anthropic key across pipeline steps.
//
// A missing key is not fatal: the step skips its Claude work and the run stays
// green, so the scrape still reaches the commit step instead of being thrown
// away. The skip is announced as a GitHub Actions warning annotation so a
// degraded pipeline is visible on the run summary rather than silent.

/** The key, or undefined when unset/blank (an empty secret reads as ""). */
export function anthropicKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? key : undefined;
}

/** Announce that `step` was skipped for want of a key. */
export function skipNotice(step: string): void {
  const msg = `ANTHROPIC_API_KEY not set — skipped ${step}`;
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warn: ${msg}`);
}
