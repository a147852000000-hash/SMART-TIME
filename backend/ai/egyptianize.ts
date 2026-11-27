// SMART TIME — Egyptian dialect enforcement (v3.2 "الرشرموطة البلدية")
// ------------------------------------------------------------
// Problem: mixed/broken Arabic (فصحى مصطلبة) leaking into replies.
// Three layers:
//   1. msaMarkerCount()  — detects فصحى-heavy replies (fixer pass trigger)
//   2. egyptianizeText() — deterministic, grammar-safe word swaps that
//      run on EVERY Arabic reply as the last-mile cleanup
//   3. (in openMindBrain) a Groq rewrite pass with few-shot for the
//      heavy cases
// All zero-cost, all server-side.
// ------------------------------------------------------------

// Safe 1:1 swaps: standalone function words / frozen phrases that map
// cleanly to Egyptian without breaking grammar. Each rule tolerates the
// Arabic connectors و/ف glued to the front (ويرجى → ولو سمحت).
// Boundary class = Arabic LETTERS only (not the whole 0600-06FF block:
// Arabic punctuation ،؛؟ lives in that block and would break matches).
const LC = "\\u0621-\\u064A\\u0671-\\u06D3\\u0640";
const LETTER_CLASS = `[${LC}]`;
const NOT_LETTER_CLASS = `[^${LC}]`;
function swap(word: string, to: string): [RegExp, string] {
  const re = new RegExp(
    `(?<!${LETTER_CLASS})([وف]{0,2})(?:${word})(?!${LETTER_CLASS})`,
    "g"
  );
  return [re, (_m: string, p: string) => `${p}${to}`];
}

const SWAPS: Array<[RegExp, string]> = [
  swap("بعد\\s?ذلك", "بعد كده"),
  swap("قبل\\s?ذلك", "قبل كده"),
  swap("تلقائياً", "أوتوماتيك"),
  swap("تلقائيًا", "أوتوماتيك"),
  swap("بنجاح", "خلاص"),
  swap("كذلك", "برضه"),
  swap("يمكنك", "تقدر"),
  swap("نستطيع", "نقدر"),
  swap("أستطيع", "أقدر"),
  swap("استطيع", "أقدر"),
  swap("يرجى", "لو سمحت"),
  swap("يتم", "بيتعمل"),
  swap("سيتم", "هيتم"),
  swap("الآن", "دلوقتي"),
  swap("أيضاً", "كمان"),
  swap("أيضًا", "كمان"),
  swap("ایضاً", "كمان"),
  swap("جداً", "أوي"),
  swap("جدًا", "أوي"),
  swap("كثيراً", "كتير"),
  swap("قليلاً", "شوية"),
  swap("عندما", "لما"),
  swap("لماذا", "ليه"),
  swap("كيف", "إزاي"),
  swap("متى", "إمتى"),
  swap("أين", "فين"),
  swap("ماذا", "إيه"),
  swap("الكثير", "الكتير"),
  swap("القليل", "شوية"),
  swap("لذلك", "عشان كده"),
  swap("بالتالي", "يعني"),
  swap("سأقوم", "هعمل"),
  swap("سينفذ", "هيتنفذ"),
  swap("ينبغي", "لازم"),
  swap("لا\\s?تقلق", "متقلقش"),
  swap("ترغب", "عايز"),
  swap("تريد", "عايز"),
  swap("تم\\s?تسجيل", "اتسجل"),
  swap("تم\\s?حفظ", "اتحفظ"),
  swap("تم\\s?تحديث", "اتحدث"),
  swap("تم\\s?تنفيذ", "اتنفذ"),
  swap("تم\\s?حذف", "اتمسح"),
  swap("لا\\s?يمكن", "مش ممكن"),
  swap("حسناً", "ماشي"),
  swap("حسنًا", "ماشي"),
  swap("بالطبع", "طبعاً"),
];

// Words that betray فصحى even when the rest looks dialect — used to
// decide if a reply needs the full rewrite pass (layer 3).
const MSA_MARKERS = [
  "يتم", "يمكنك", "يرجى", "استطيع", "نستطيع", "ترغب", "تريد", "لذلك", "بالتالي",
  "عندما", "لماذا", "أيضاً", "أيضًا", "جداً", "جدًا", "الآن", "سأقوم", "ينبغي",
  "كما", "حيث", "الذي", "التي", "هذا", "هذه", "ذلك", "تلك", "وقد", "ومن ثم",
  "بشكل", "بشكل عام", "من الضروري", "في حال", "عبر", "أيضا", "أن", "إن",
];

export function msaMarkerCount(text: string): number {
  const t = String(text || "");
  let count = 0;
  for (const marker of MSA_MARKERS) {
    // standalone-word match only (Arabic letters, punctuation allowed)
    const re = new RegExp(`(^|${NOT_LETTER_CLASS})${marker}($|${NOT_LETTER_CLASS})`, "g");
    if (re.test(t)) count += 1;
  }
  return count;
}

export function egyptianizeText(text: string): string {
  let out = String(text || "");
  for (const [re, to] of SWAPS) out = out.replace(re, to);
  // فصحى demonstratives that slip into otherwise-dialect sentences
  const L = LETTER_CLASS;
  out = out.replace(new RegExp(`(?<!${L})هذا(?!${L})`, "g"), "ده");
  out = out.replace(new RegExp(`(?<!${L})هذه(?!${L})`, "g"), "دي");
  out = out.replace(new RegExp(`(?<!${L})ذلك(?!${L})`, "g"), "ده");
  out = out.replace(new RegExp(`(?<!${L})تلك(?!${L})`, "g"), "دي");
  // plural you (أنتم) is rare from our persona but mark it Egyptian
  out = out.replace(new RegExp(`(?<!${L})أنتم(?!${L})`, "g"), "انتو");
  out = out.replace(new RegExp(`(?<!${L})أنت(?!${L})`, "g"), "انت");
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

// Few-shot bank injected into the Groq persona: examples beat instructions.
export const SHUBRA_FEWSHOT = [
  "مثال ١ — المستخدم: ازاي أضيف مصروف؟",
  "أنت: سهلة خالص يا معلم هههه — افتح قسم المصروفات، دوس على زرار الإضافة، اكتب المبلغ والتصنيف وطريقة الدفع، وارفع صورة الإيصال لو معاك، وخلاص هيبان في التقرير على طول.",
  "مثال ٢ — المستخدم: إيه هي ميزة المهام؟",
  "أنت: بتحط مهامك بأولوية عالية ولا متوسطة ولا منخفضة، وتحدد ميعادها، والتطبيق بيفكرك قبلها بلحظة — ولو نسيت حاجة أنا مش هسكت هههه.",
  "مثال ٣ — المستخدم: الخدمة دي بفلوس؟",
  "أنت: ببلاش يا عم خالص ببلاش لآخر اليوم، مفيش جنيه واحد هتدخله — وأنا مفتخرة بكده هههه.",
  "مثال ٤ — المستخدم: هل يمكن تغيير كلمة المرور؟",
  "أنت: أيوه طبعاً يا معلم — من الإعدادات، ملفك الشخصي، دوس «تغيير كلمة المرور» واكتب الجديدة مرتين، وبس كده.",
  "مثال ٥ — المستخدم: عايز أعرف صافي دخلي الشهر ده",
  "أنت: حاضر يا معلم، هحسبهالك من أرقامك الحقيقية دلوقتي: الدخل المسجل ناقص المصاريف وبيطلعلك الصافي بالجنيه على طول — قولي «احسب صافي دخلي» وأنا أشغلهالك.",
].join("\n");

export const SHUBRA_BANNED =
  "ممنوعات نهائية (أي كلمة من دول تظهر في ردك يبقى الرد مرفوض): يتم، يتم تسجيل، يمكنك، يرجى، استطيع، ترغب، تريد، لذلك، بالتالي، عندما، لماذا، أيضاً، جداً، الآن، سأقوم، ينبغي، كما، حيث، الذي، التي، هذا، هذه، ذلك، تلك، وقد، في حال، من الضروري، أنتم. " +
  "البدائل البلدية فوراً: يتم→بيتعمل، يمكنك→تقدر، يرجى→لو سمحت، الآن→دلوقتي، أيضاً→كمان، جداً→أوي، لماذا→ليه، كيف→إزاي، متى→إمتى، أين→فين، ذلك→ده، هذه→دي، لذلك→عشان كده، سأقوم→هعمل، عندما→لما، عندما تريد→لو عايز.";

// Rewrite-pass prompt (layer 3) used when a reply comes out فصحى-heavy.
export function dialectFixMessages(reply: string) {
  return [
    {
      role: "system" as const,
      content: [
        "أنت مصلحة لهجة مصرية خبيرة في تطبيق SMART TIME («وقتك من ذهب»).",
        "مهمتك واحدة: خد نص وجيبيه بالعامية المصرية القاهرية الحقيقية — كأن بنت شبرا بتكلم جارها على الكوفي.",
        "قواعد: ممنوع تضيفي معلومة جديدة؛ ممنوع تغيري الأرقام والأسماء والمصطلحات التقنية (SMART TIME، Dashboard، PDF)؛ اختصري بس من غير ما تفسدي المعنى؛ ممنوع فصحى نهائيًا حتى في حرف واحد.",
        SHUBRA_BANNED,
        "أمثلة:",
        "المدخل: «يمكنك الآن إضافة مصروف جديد من القسم المخصص، وسيتم تحديث الميزانية تلقائياً بعد ذلك.»",
        "المخرج: «تقدر دلوقتي تضيف مصروف جديد من القسم بتاعه على طول، والميزانية هتتحدث لوحدها بعد كده خلاص.»",
        "المدخل: «تم تسجيل المصروف بنجاح، ويرجى التأكد من البيانات.»",
        "المخرج: «المصروف اتسجل يا معلم خلاص، بس بص على الأرقام كمان مرة لو سمحت عشان تتأكد.»",
        "رجعي النص المصرّي النهائي بس — من غير مقدمات ولا شرح.",
      ].join("\n"),
    },
    { role: "user" as const, content: String(reply || "").slice(0, 1200) },
  ];
}
