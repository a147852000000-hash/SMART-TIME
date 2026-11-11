interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Configure only with an isolated staging API origin, never the production Oracle host. */
  API_ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname.startsWith("/api/")) {
      const configuredOrigin = String(env.API_ORIGIN || "").trim();
      if (!configuredOrigin) {
        return Response.json(
          { error: "لم يتم إعداد خادم اختبار معزول لمعاينة SMART TIME." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      let apiOrigin: URL;
      try {
        apiOrigin = new URL(configuredOrigin);
        if (
          apiOrigin.protocol !== "https:" ||
          apiOrigin.username ||
          apiOrigin.password ||
          apiOrigin.pathname !== "/" ||
          apiOrigin.search ||
          apiOrigin.hash ||
          apiOrigin.hostname.toLowerCase() === "smart-time-ai.duckdns.org"
        ) throw new Error("API_ORIGIN must be an isolated HTTPS origin.");
      } catch {
        return Response.json(
          { error: "إعداد خادم الاختبار غير صالح أو يشير إلى خادم الإنتاج." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, apiOrigin);
      const headers = new Headers(request.headers);
      headers.delete("origin");
      headers.delete("host");
      try {
        const init: RequestInit = { method: request.method, headers, redirect: "manual" };
        if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
        const upstreamResponse = await fetch(new Request(upstreamUrl.toString(), init));
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set("Cache-Control", "no-store");
        return new Response(upstreamResponse.body, { status: upstreamResponse.status, statusText: upstreamResponse.statusText, headers: responseHeaders });
      } catch {
        return Response.json(
          { error: "تعذر الاتصال بخادم الاختبار المعزول. حاول مرة أخرى بعد قليل." },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    return env.ASSETS.fetch(request);
  },
};
