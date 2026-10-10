import SmartAIDemo from "../../../components/smart-ai/SmartAIDemo";

export default function SmartAIServicePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-white selection:text-black"
    >
      <div className="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_50%)]" />

      <section className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
            SMART TIME AI SERVICE
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
            SMART TIME
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/50 sm:text-lg">
            خدمة SMART TIME: اكتب طلبك بالمصري، والمساعد يفهم السياق ويرد عليك
            باللهجة المصرية باستخدام Groq AI.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {[
              "Groq AI",
              "Egyptian Arabic",
              "SMART TIME Context",
              "Structured Output",
            ].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <SmartAIDemo />
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold text-white/35">AI ENGINE</p>
              <p className="mt-2 text-sm text-white/75">
                Groq AI · المحرك الإنتاجي الأساسي
              </p>
            </div>
            <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/50">
              Egyptian Arabic · SMART TIME Context
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
