import type { SmartAiAction, SmartAiResponse } from "./types.js";
import type { SmartTimeData } from "./appContext.js";

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value) + (currency ? " " + currency : "");
}

function periodLabel(key: string | undefined, language: "ar" | "en"): string {
  if (language === "en") {
    if (key === "last_month") return "last month";
    if (key === "last_week") return "last week";
    if (key === "this_week") return "this week";
    if (key === "this_month") return "this month";
    if (key === "today") return "today";
    return "the available period";
  }
  if (key === "last_month") return "الشهر اللي فات";
  if (key === "last_week") return "الأسبوع اللي فات";
  if (key === "this_week") return "الأسبوع ده";
  if (key === "this_month") return "الشهر ده";
  if (key === "today") return "النهاردة";
  return "الفترة المتاحة";
}

function actionFromMessage(_message: string): SmartAiAction {
  // V1 deliberately does not mutate data from free-form text.
  // Existing UI confirmation flow remains available for a future tool/action parser.
  return null;
}

function isExpenseQuestion(q: string): boolean {
  return /(مصاريف|صرف|مصروف|دفعت|expense|expenses|spending|spent)/i.test(q);
}

function isFuelQuestion(q: string): boolean {
  return /(بنزين|وقود|تموين|fuel|gas)/i.test(q);
}

function isEducationQuestion(q: string): boolean {
  return /(تعليم|طالب|مدرسة|درس|education|student|lesson)/i.test(q);
}

function isComparisonQuestion(q: string): boolean {
  return /(قارن|مقارنة|مقارنه|الفرق|مقابل|مقابلين|compare|comparison|difference|versus|vs\.?)/i.test(q);
}

function isNetIncomeQuestion(q: string): boolean {
  return /(صافي الدخل|صافي دخلي|الدخل الصافي|صافى الدخل|net income|take.?home)/i.test(q);
}

function isHelpQuestion(q: string): boolean {
  return /(اشرح|شرح|ازاي|كيف|ماذا تستطيع|تقدر تعمل ايه|what can you do|help)/i.test(q);
}

export function answerWithRules(message: string, language: "ar" | "en", data: SmartTimeData): SmartAiResponse {
  const q = message.toLowerCase();
  const typedData = data as any;
  const currency = String(typedData.profile.currency || "EGP");
  const action = actionFromMessage(message);

  if (isComparisonQuestion(q)) {
    const current = typedData.comparisons?.thisMonth;
    const previous = typedData.comparisons?.lastMonth;
    const currentTotal = Number(current?.total || 0);
    const previousTotal = Number(previous?.total || 0);
    const delta = Math.round((currentTotal - previousTotal) * 100) / 100;
    const percent = previousTotal === 0 ? null : Math.round((delta / previousTotal) * 1000) / 10;
    const direction = delta > 0 ? (language === "ar" ? "أعلى" : "higher") : delta < 0 ? (language === "ar" ? "أقل" : "lower") : (language === "ar" ? "مساوي" : "the same");
    const changeText = percent === null
      ? (language === "ar" ? "لا يمكن حساب نسبة التغير لأن الشهر الماضي كان 0." : "A percentage change cannot be calculated because last month was 0.")
      : (language === "ar" ? "التغير حوالي " + Math.abs(percent) + "%." : "The change was about " + Math.abs(percent) + "%.");
    return {
      reply: language === "ar"
        ? "مصاريف الشهر ده " + money(currentTotal, currency) + " مقابل " + money(previousTotal, currency) + " الشهر اللي فات؛ يعني " + direction + " بمقدار " + money(Math.abs(delta), currency) + ". " + changeText
        : "This month's expenses are " + money(currentTotal, currency) + " versus " + money(previousTotal, currency) + " last month; that is " + direction + " by " + money(Math.abs(delta), currency) + ". " + changeText,
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isNetIncomeQuestion(q)) {
    const income = Number(typedData.comparisons?.thisMonthIncome || 0);
    const expenses = Number(typedData.comparisons?.thisMonth?.total || 0);
    const net = Math.round((income - expenses) * 100) / 100;
    return {
      reply: language === "ar"
        ? "الدخل المسجل في الشهر ده " + money(income, currency) + "، والمصاريف " + money(expenses, currency) + "، وصافي الدخل المحسوب هو " + money(net, currency) + "."
        : "Recorded income this month is " + money(income, currency) + ", expenses are " + money(expenses, currency) + ", and calculated net income is " + money(net, currency) + ".",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isHelpQuestion(q)) {
    return {
      reply: language === "ar"
        ? "أنا SMART AI داخل SMART TIME. أقدر أشرح بيانات التطبيق، ألخّص المصاريف والفترة الزمنية، أراجع الوقود والتعليم، وأساعدك في فهم بياناتك. التنفيذ على البيانات لا يتم إلا بتأكيدك."
        : "I am SMART AI inside SMART TIME. I can explain app data, summarize expenses and periods, review fuel and education data, and help you understand your records. Data changes require your confirmation.",
      action,
      needsClarification: false,
      requiresConfirmation: false,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isFuelQuestion(q)) {
    const total = Number(typedData.fuel?.totalCost || 0);
    const liters = Number(typedData.fuel?.liters || 0);
    const count = Number(typedData.fuel?.count || 0);
    const p = periodLabel(typedData.period?.key, language);
    return {
      reply: language === "ar"
        ? "في " + p + " سجلت " + count + " عمليات تموين، بإجمالي " + money(total, currency) + " و" + liters.toFixed(2) + " لتر."
        : "For " + p + ", there were " + count + " fuel records totaling " + money(total, currency) + " and " + liters.toFixed(2) + " liters.",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isEducationQuestion(q)) {
    const total = Number(typedData.education?.total || 0);
    const count = Number(typedData.education?.count || 0);
    const p = periodLabel(typedData.period?.key, language);
    return {
      reply: language === "ar"
        ? "في " + p + " عندك " + count + " مصروف تعليمي بإجمالي " + money(total, currency) + "."
        : "For " + p + ", there were " + count + " education expenses totaling " + money(total, currency) + ".",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isExpenseQuestion(q) || typedData.period) {
    const total = Number(typedData.expenses?.total || 0);
    const count = Number(typedData.expenses?.count || 0);
    const categories = Array.isArray(typedData.expenses?.categories) ? typedData.expenses.categories : [];
    let reply = language === "ar"
      ? "إجمالي المصاريف في " + periodLabel(typedData.period?.key, "ar") + " هو " + money(total, currency) + " من " + count + " عملية."
      : "Total expenses for " + periodLabel(typedData.period?.key, "en") + ": " + money(total, currency) + " across " + count + " records.";
    if (language === "ar" && categories.length) {
      const top = categories.slice(0, 3).map((x: any) => String(x.category) + ": " + money(Number(x.amount || 0), currency)).join("، ");
      reply += " أكبر البنود: " + top + ".";
    }
    return {
      reply,
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  return {
    reply: language === "ar"
      ? "أنا جاهز أتكلم معاك عن بيانات SMART TIME. جرّب مثلًا: «قارن مصاريف الشهر ده بالشهر اللي فات» أو «احسب صافي دخلي الشهر ده» أو «كام صرفت الأسبوع اللي فات؟»."
      : "I am ready to talk about SMART TIME data. Try: “Compare this month with last month”, “What is my net income this month?”, or “How much did I spend last week?”.",
    action,
    needsClarification: true,
    provider: "smart-ai",
    model: "smart-time-core",
    engine: "rules"
  };
}
