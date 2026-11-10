interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

/**
 * Keep the preview UI on workers.dev while forwarding API calls to the
 * existing Oracle-backed SMART TIME service. This is a same-origin proxy:
 * browser CORS rules do not need to be widened on the permanent backend.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    if (incomingUrl.pathname.startsWith("/api/")) {
      const upstreamUrl = new URL("https://smart-time-ai.duckdns.org");
      upstreamUrl.pathname = incomingUrl.pathname;
      upstreamUrl.search = incomingUrl.search;

      const headers = new Headers(request.headers);
      headers.delete("origin");
      headers.delete("host");

      try {
        const init: RequestInit = {
          method: request.method,
          headers,
          redirect: "manual",
        };
        if (request.method !== "GET" && request.method !== "HEAD") {
          init.body = request.body;
        }

        const upstreamRequest = new Request(upstreamUrl.toString(), init);
        const upstreamResponse = await fetch(upstreamRequest);
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set("Cache-Control", "no-store");

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      } catch {
        return Response.json(
          { error: "تعذر الاتصال بخادم SMART TIME. حاول مرة أخرى بعد قليل." },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
