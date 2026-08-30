// Small fetch helpers with a polite User-Agent and retries.

const UA = "survivor-draft/1.0 (private fantasy-draft site; contact via GitHub)";

export async function fetchText(url: string, opts: { retries?: number; headers?: Record<string, string> } = {}): Promise<string> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", ...opts.headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/** MediaWiki `action=parse&prop=wikitext` for a page. Returns undefined if missing. */
export async function fetchWikitext(apiBase: string, page: string): Promise<string | undefined> {
  const url = `${apiBase}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const data = await fetchJson<{ parse?: { wikitext: string }; error?: { code: string } }>(url);
  return data.parse?.wikitext;
}

/** MediaWiki `action=parse&prop=text` — rendered HTML for a page. */
export async function fetchRenderedHtml(apiBase: string, page: string): Promise<string | undefined> {
  const url = `${apiBase}?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2&redirects=1&disableeditsection=1`;
  const data = await fetchJson<{ parse?: { text: string } }>(url);
  return data.parse?.text;
}

export const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
export const FANDOM_API = "https://survivor.fandom.com/api.php";
