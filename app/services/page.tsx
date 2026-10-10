import { useState } from "react";
import type { ReactNode } from "react";
import SmartAIDemo from "../../components/smart-ai/SmartAIDemo";

type IconName =
  | "home" | "note" | "bell" | "calculator" | "calendar" | "money" | "medical"
  | "user" | "users" | "car" | "fuel" | "wrench" | "education" | "briefcase"
  | "bank" | "chart" | "book" | "lock" | "chat" | "media" | "sports" | "spark"
  | "settings" | "download" | "close";

type Feature = {
  title: string;
  description: string;
  icon: IconName;
  web?: boolean;
};

type FeatureGroup = {
  title: string;
  description: string;
  features: Feature[];
};

const featureGroups: FeatureGroup[] = [
  {
    title: "الإدارة اليومية",
    description: "الأدوات الأساسية لتنظيم يومك ومعلوماتك في مكان واحد.",
    features: [
      { title: "الرئيسية", description: "لوحة تحكم تجمع ملخصاتك ومعلوماتك المهمة وتوصلك بسرعة لباقي أقسام التطبيق.", icon: "home" },
      { title: "الملاحظات", description: "أنشئ ملاحظات ومجلدات وعلامات، واحفظ أفكارك ومعلوماتك المهمة.", icon: "note" },
      { title: "ذكرني والتذكيرات", description: "إدارة المهام اليومية، الأولويات، مواعيد الاستحقاق والتنبيهات.", icon: "bell" },
      { title: "الحاسبة", description: "حاسبة أساسية وعلمية وهندسية مع سجل للعمليات وتحويلات الوحدات.", icon: "calculator" },
      { title: "التقويم", description: "تنظيم الأحداث والمواعيد مع التذكير ومتابعة جدولك.", icon: "calendar" },
    ],
  },
  {
    title: "المالية والمصروفات",
    description: "قسم مالي متكامل، والبطاقات التالية تعكس الأقسام الموجودة فعليًا داخل البرنامج.",
    features: [
      { title: "المصروفات", description: "المركز المالي لإدارة المصروفات والدخل ومتابعة صافي الحركة.", icon: "money" },
      { title: "مصروفات المنزل", description: "تسجيل ومتابعة مصروفات المنزل مع القسم الطبي وسجل الكشوفات والأدوية.", icon: "home" },
      { title: "القسم الطبي", description: "حفظ الكشوفات والحالات والتشخيص وتكاليف الكشف والأدوية.", icon: "medical" },
      { title: "الإنفاق الشخصي", description: "متابعة الإنفاق الشخصي اليومي وتصنيف البنود والبحث فيها.", icon: "user" },
      { title: "جمعياتي", description: "متابعة الجمعيات والأقساط ومواعيد القبض والمبالغ المكتسبة.", icon: "users" },
      { title: "مصروفات السيارة", description: "جزء مالي مخصص للسيارة لمتابعة تكلفة الوقود والصيانة والزيوت والفلاتر.", icon: "car" },
      { title: "مصروفات التعليم", description: "متابعة المصروفات التعليمية والكتب والبنود الخاصة بالطلاب.", icon: "education" },
      { title: "مصروفات العمل", description: "متابعة أدوات المكتب والاشتراكات وصيانة أجهزة العمل والتنقلات.", icon: "briefcase" },
      { title: "الدخل والشهادات", description: "إدارة مصادر الدخل والشهادات البنكية والعوائد والحساب الجاري.", icon: "bank" },
      { title: "التقارير المالية", description: "تقارير يومية وأسبوعية وشهرية مع تحليل الحركات والتصدير والمعاينة.", icon: "chart" },
    ],
  },
  {
    title: "التعليم",
    description: "مساحة مستقلة لإدارة الطلاب والدروس والمصروفات التعليمية.",
    features: [
      { title: "الطلاب", description: "ملفات الطلاب والمرحلة والمدرسة أو الجامعة.", icon: "users" },
      { title: "الدروس والحصص", description: "جدول الدروس والمواد والمدرسين والمواعيد والرسوم وحالة السداد.", icon: "book" },
      { title: "مصروفات التعليم", description: "تفاصيل مصروفات كل طالب ومتابعة إجمالي المصروفات التعليمية.", icon: "education" },
    ],
  },
  {
    title: "السيارات",
    description: "إدارة السيارة ومتابعة التشغيل والصيانة والتكاليف.",
    features: [
      { title: "سيارتي", description: "بيانات السيارة والعداد ونوع الوقود ومعلومات المركبة الأساسية.", icon: "car" },
      { title: "الوقود", description: "سجلات التفويل واللترات والسعر والعداد والمحطة وتكلفة الوقود.", icon: "fuel" },
      { title: "الصيانة", description: "سجل الصيانة وقطع الغيار والمصنعية ومواعيد الخدمة القادمة.", icon: "wrench" },
      { title: "الزيوت والفلاتر", description: "متابعة تغيير زيت المحرك والفتيس والزيوت الأخرى والفلاتر ومواعيدها.", icon: "wrench" },
      { title: "الحوادث", description: "حفظ بيانات الحوادث والصور والتاريخ والموقع والتكلفة التقديرية.", icon: "media" },
    ],
  },
  {
    title: "الحياة والمحتوى",
    description: "أقسام شخصية ومحتوى ووسائط داخل تطبيق SMART TIME الكامل.",
    features: [
      { title: "القسم الديني", description: "القرآن والورد اليومي وعلامات الوقف والأذكار والصلاة والتنبيهات، مع محتوى ديني بحسب تفضيل المستخدم.", icon: "book" },
      { title: "الخزنة الرقمية", description: "حفظ البيانات والملفات الحساسة داخل خزنة محلية محمية.", icon: "lock" },
      { title: "المحادثات", description: "غرف ومحادثات ورسائل ووسائط ومشاركة ملفات وموقع واستطلاعات.", icon: "chat" },
      { title: "الذكريات والوسائط", description: "تنظيم الصور والفيديو والصوت وملفات PDF والمستندات داخل مجلدات.", icon: "media" },
      { title: "الرياضة", description: "تمارين ومتابعة رياضية وأخبار ونتائج في مركز رياضي تفاعلي.", icon: "sports" },
    ],
  },
  {
    title: "أدوات التطبيق",
    description: "إعدادات وخدمات مساندة متاحة داخل النسخة الكاملة.",
    features: [
      { title: "الإعدادات والنسخ الاحتياطي", description: "تخصيص التطبيق وإدارة الحساب والتفضيلات والنسخ الاحتياطي والبيانات.", icon: "settings" },
      { title: "مركز الإشعارات", description: "تجميع إشعارات الأقسام ومتابعتها والانتقال للقسم المرتبط.", icon: "bell" },
    ],
  },
];

function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    note: <><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    money: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /><path d="M7 10h.01M17 15h.01" /></>,
    medical: <><path d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4z" /><path d="M12 7v6M9 10h6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21a6 6 0 0 1 12 0M15 15a5 5 0 0 1 6 5" /></>,
    car: <><path d="m5 16 1.5-6h11L19 16" /><path d="M3 16h18v4H3z" /><circle cx="7" cy="20" r="1" /><circle cx="17" cy="20" r="1" /><path d="M8 10V7h8v3" /></>,
    fuel: <><path d="M6 21V4h9v17M6 9h9M15 7h2l3 3v7a2 2 0 0 1-2 2h-1" /><path d="M9 6h3" /></>,
    wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3.2 3.2-2.9-2.9z" /></>,
    education: <><path d="m3 10 9-5 9 5-9 5z" /><path d="M7 12v5c3 2 7 2 10 0v-5M21 10v7" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2" /></>,
    bank: <><path d="m3 10 9-6 9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M2 21h20" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-5 3 3 5-7" /></>,
    book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" /><path d="M5 4v16M8 20h11" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    chat: <><path d="M4 5h16v11H8l-4 4z" /><path d="M8 9h8M8 12h5" /></>,
    media: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></>,
    sports: <><circle cx="12" cy="12" r="8" /><path d="m7 5 2 4-2 4 4 3 4-2 2 3M9 9l5-1 3 4" /></>,
    spark: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-2.5h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h2.5v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2.5H20a1.7 1.7 0 0 0-.6 3.3Z" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function ServicesPage() {
  const [selected, setSelected] = useState<Feature | null>(null);

  return (
    <main dir="rtl" className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white selection:text-black">
      <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white">
              <Icon name="spark" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight sm:text-xl">SMART TIME</h1>
              <p className="text-[11px] text-zinc-500">كل أدواتك في تطبيق واحد</p>
            </div>
          </div>
          <a href="/downloads/smart-time.apk" download className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a0a0a] sm:px-5 sm:text-sm">
            <Icon name="download" className="h-4 w-4" />
            تحميل SMART TIME
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-[#0a0a0a] p-5 shadow-2xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-bold text-zinc-300">
              <Icon name="spark" className="h-4 w-4" />
              SMART AI على الويب
            </div>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">المساعد الذكي متاح هنا</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              استخدم Smart AI من المتصفح للدردشة والمساعدة بالعربي. أما باقي أقسام SMART TIME ومميزاتها الكاملة فهي داخل التطبيق.
            </p>
          </div>
          <SmartAIDemo />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-500">SMART TIME FULL APP</p>
          <h2 className="mt-2 text-2xl font-black sm:text-4xl">شوف كل أقسام SMART TIME</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            دي خريطة المميزات الموجودة في البرنامج. كل بطاقة للعرض والتعريف فقط، والميزة الكاملة بتشتغل من داخل التطبيق.
          </p>
        </div>

        <div className="space-y-12">
          {featureGroups.map((group) => (
            <section key={group.title}>
              <div className="mb-4">
                <h3 className="text-xl font-black sm:text-2xl">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{group.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.features.map((feature) => (
                  <button
                    key={feature.title}
                    type="button"
                    onClick={() => setSelected(feature)}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-right transition duration-200 hover:-translate-y-1 hover:border-zinc-500 hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-200 transition group-hover:border-zinc-600 group-hover:text-white">
                        <Icon name={feature.icon} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black leading-6">{feature.title}</h4>
                        <p className="mt-1.5 text-xs leading-6 text-zinc-500 group-hover:text-zinc-400">{feature.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-zinc-900 pt-3 text-[11px] font-bold text-zinc-600 group-hover:text-zinc-300">
                      {feature.web ? "متاح على الويب" : "موجود داخل التطبيق الكامل · اضغط للتفاصيل"}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-12 text-center sm:px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
            <Icon name="download" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black sm:text-3xl">SMART AI هنا — وكل SMART TIME في التطبيق</h2>
          <p className="max-w-2xl text-sm leading-7 text-zinc-500">
            استخدم المساعد الذكي من الويب، وحمّل التطبيق الكامل للوصول إلى المالية، التعليم، السيارة، التقويم، الملاحظات، الوسائط، الخزنة وباقي الأقسام.
          </p>
          <a href="/downloads/smart-time.apk" download className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-zinc-200">
            <Icon name="download" className="h-5 w-5" />
            تحميل SMART TIME
          </a>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-dialog-title"
          onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}
        >
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-[#0a0a0a] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
                  <Icon name={selected.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="feature-dialog-title" className="text-lg font-black">{selected.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">الميزة دي موجودة في التطبيق الكامل</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white" aria-label="إغلاق">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-5 text-sm leading-7 text-zinc-400">{selected.description}</p>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center">
              <p className="text-sm font-bold">حمّل SMART TIME للوصول للميزة بالكامل.</p>
              <p className="mt-1 text-xs text-zinc-500">قسم Smart AI فقط متاح لك من الويب.</p>
            </div>
            <a href="/downloads/smart-time.apk" download className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-zinc-200">
              <Icon name="download" className="h-5 w-5" />
              تحميل APK
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
