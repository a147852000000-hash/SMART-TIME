export interface WebSearchResult { title: string; snippet: string; url: string; }

export async function web_search(query: string, lang = "ar"): Promise<WebSearchResult[]> {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}&kl=${encodeURIComponent(lang === "ar" ? "eg-ar" : "us-en")}`;
    const response = await fetch(url, { headers: { "User-Agent": "SMART-TIME-SmartAI/3.0" }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const html = await response.text();
    const results: WebSearchResult[] = [];
    const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) && results.length < 8) {
      const url = match[1].replace(/&amp;/g, "&");
      const title = match[2].replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim();
      const after = html.slice(match.index, match.index + 1800);
      const snippetMatch = after.match(/result-snippet[^>]*>([\s\S]*?)<\/td>/i);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim() : "";
      if (title && url) results.push({ title, snippet, url });
    }
    return results;
  } catch {
    return [];
  }
}
