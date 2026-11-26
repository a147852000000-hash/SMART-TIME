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

function isSecretRequest(q: string): boolean {
  return /(api[ _-]?key|توكن|token|كلمة المرور|كلمه المرور|باسورد|password|secret|المفتاح السري)/i.test(q);
}

function isDestructiveRequest(q: string): boolean {
  return /(امسح|احذف|أمسح|أحذف|لغى|إلغاء|الغاء|مسح كل|حذف كل|امسحوا|delete all|remove all|clear all|wipe)/i.test(q);
}

function isRatioQuestion(q: string): boolean {
  return /(نسبة|نسبه|ratio|percent|في المية|بالمية)/i.test(q);
}

function isAverageQuestion(q: string): boolean {
  return /(متوسط|average|متوسط يومي|per day|يوميًا|يوميا)/i.test(q);
}

function isIncomeQuestion(q: string): boolean {
  return /(دخلي|الدخل|مرتب|راتب|income|salary)/i.test(q);
}

export function answerWithRules(message: string, language: "ar" | "en", data: SmartTimeData): SmartAiResponse {
  const q = message.toLowerCase();
  const typedData = data as any;
  const currency = String(typedData.profile.currency || "EGP");
  const action = actionFromMessage(message);

  // Guard 1: no data available for the requested period — say it, never fake 0s.
  if (typedData.dataAvailable === false) {
    return {
      reply: language === "ar"
        ? "مفيش بيانات مسجلة متاحة للفترة المطلوبة في سجلاتك — أقدر أجيبلك من الفترات المسجلة زي الشهر ده أو الشهر اللي فات."
        : "No recorded data is available for that period — I can report the recorded periods such as this month or last month.",
      action,
      needsClarification: true,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  // Guard 2: never expose secrets, tokens, or keys.
  if (isSecretRequest(q)) {
    return {
      reply: language === "ar"
        ? "مش أقدر أعرض أو أشارك مفاتيح API أو توكنات أو كلمات مرور — حماية الأسرار جزء ثابت من قواعدي حتى مع صاحب الحساب."
        : "I cannot display or share API keys, tokens, or passwords — secret protection is a fixed rule even for the account owner.",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

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

  if (isRatioQuestion(q)) {
    const income = Number(typedData.comparisons?.thisMonthIncome || 0);
    const expenses = Number(typedData.expenses?.total ?? typedData.comparisons?.thisMonth?.total ?? 0);
    if (income <= 0) {
      return {
        reply: language === "ar"
          ? "مش قادر أحسب النسبة لأن الدخل المسجل صفر — سجل دخلك الشهري الأول من قسم المصروفات والميزانية."
          : "I cannot compute the ratio because the recorded income is zero — record your monthly income first.",
        action,
        needsClarification: true,
        provider: "smart-ai",
        model: "smart-time-core",
        engine: "rules"
      };
    }
    const percent = Math.round((expenses / income) * 1000) / 10;
    return {
      reply: language === "ar"
        ? "مصاريفك " + money(expenses, currency) + " من دخل مسجل " + money(income, currency) + " — يعني النسبة " + percent + "% من دخلك."
        : "Your expenses are " + money(expenses, currency) + " against recorded income of " + money(income, currency) + " — that is " + percent + "% of your income.",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isAverageQuestion(q) && typedData.period?.days) {
    const total = Number(typedData.expenses?.total ?? typedData.comparisons?.thisMonth?.total ?? 0);
    const days = Number(typedData.period.days);
    if (days <= 0) {
      return {
        reply: language === "ar"
          ? "مش قادر أحسب المتوسط لأن عدد الأيام غير صالح."
          : "I cannot compute the average because the day count is invalid.",
        action,
        needsClarification: true,
        provider: "smart-ai",
        model: "smart-time-core",
        engine: "rules"
      };
    }
    const average = Math.round((total / days) * 100) / 100;
    return {
      reply: language === "ar"
        ? "إجمالي المصاريف " + money(total, currency) + " على " + days + " أيام — المتوسط " + money(average, currency) + " في اليوم."
        : "Total expenses of " + money(total, currency) + " over " + days + " days — an average of " + money(average, currency) + " per day.",
      action,
      provider: "smart-ai",
      model: "smart-time-core",
      engine: "rules"
    };
  }

  if (isIncomeQuestion(q)) {
    const income = Number(typedData.comparisons?.thisMonthIncome || 0);
    return {
      reply: language === "ar"
        ? "الدخل المسجل في " + periodLabel(typedData.period?.key, "ar") + " هو " + money(income, currency) + "."
        : "Recorded income for " + periodLabel(typedData.period?.key, "en") + " is " + money(income, currency) + ".",
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

  if (isDestructiveRequest(q)) {
    const accountsCount = Number(typedData.accounts?.count || 0);
    return {
      reply: language === "ar"
        ? "الطلب ده عملية تدميرية على بياناتك" + (accountsCount > 0 ? " (عندك " + accountsCount + " حساب مسجل)" : "") + " — مش بتنفذ من مسار الشات أبدًا. العمليات التدميرية بتتم من الواجهة فقط بعد تأكيد صريح، وأنا بس أوضحلك النطاق المطلوب قبلها."
        : "That is a destructive operation on your data" + (accountsCount > 0 ? " (you have " + accountsCount + " recorded account(s))" : "") + " — it never executes from the chat path. Destructive operations happen only from the UI after explicit confirmation.",
      action,
      needsClarification: true,
      requiresConfirmation: true,
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
