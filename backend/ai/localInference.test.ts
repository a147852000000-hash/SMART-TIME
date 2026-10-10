const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();

globalThis.fetch = (async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"أهلاً "}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"بيك"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(body, { status: 200 });
}) as typeof fetch;

process.env.SMART_AI_LOCAL_URL = "http://test";
const { streamLocalSmartAi } = await import("./localInference.js");
const chunks: string[] = [];

for await (const event of streamLocalSmartAi({
  language: "ar",
  message: "قول أهلاً",
  data: {}
})) {
  if (event.type === "delta" && event.text) chunks.push(event.text);
}

globalThis.fetch = originalFetch;
if (chunks.join("") !== "أهلاً بيك") {
  throw new Error(`Streaming parse failed: ${chunks.join("")}`);
}
console.log("LOCAL SMART AI streaming test passed");
