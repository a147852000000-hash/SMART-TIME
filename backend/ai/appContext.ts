type AnyRecord = Record<string, unknown>;

const SENSITIVE = /password|passcode|pin|token|secret|api[_-]?key|authorization|cookie|session|vault|secure/i;

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = 800): string {
  return String(value ?? "").trim().slice(0, max);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function dateOnly(value: unknown): string | null {
  const d = text(value, 32);
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d = new Date()): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}

function startOfMonth(d = new Date()): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function startOfLastMonth(d = new Date()): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() - 1);
  return x;
}

function endOfLastMonth(d = new Date()): Date {
  return new Date(startOfMonth(d).getTime() - 1);
}

function resolvePeriod(message: string): { key: string; from: Date; to: Date } | null {
  const q = message.toLowerCase();
  const now = new Date();

  if (q.includes("الشهر اللي فات") || q.includes("الشهر الماضي") || q.includes("الشهر السابق") || q.includes("last month") || q.includes("previous month")) {
    return { key: "last_month", from: startOfLastMonth(now), to: endOfLastMonth(now) };
  }
  if (q.includes("الأسبوع اللي فات") || q.includes("الاسبوع اللي فات") || q.includes("الأسبوع الماضي") || q.includes("الاسبوع الماضي") || q.includes("الأسبوع السابق") || q.includes("last week") || q.includes("previous week")) {
    const thisWeek = startOfWeek(now);
    const from = new Date(thisWeek);
    from.setDate(from.getDate() - 7);
    return { key: "last_week", from, to: new Date(thisWeek.getTime() - 1) };
  }
  if (q.includes("الأسبوع ده") || q.includes("هذا الأسبوع") || q.includes("this week")) {
    return { key: "this_week", from: startOfWeek(now), to: now };
  }
  if (q.includes("الشهر ده") || q.includes("هذا الشهر") || q.includes("this month")) {
    return { key: "this_month", from: startOfMonth(now), to: now };
  }
  if (q.includes("النهاردة") || q.includes("اليوم") || q.includes("today")) {
    return { key: "today", from: startOfDay(now), to: now };
  }
  return null;
}

function inPeriod(value: unknown, from: Date, to: Date): boolean {
  const d = dateOnly(value);
  if (!d) return false;
  const x = new Date(d + "T12:00:00");
  return x >= from && x <= to;
}

function summarizeExpenseRows(rows: AnyRecord[]) {
  const total = rows.reduce((s, x) => s + num(x.amount), 0);
  const byCategory = new Map<string, number>();
  for (const row of rows) {
    const category = text(row.category, 80) || "other";
    byCategory.set(category, (byCategory.get(category) || 0) + num(row.amount));
  }
  return {
    count: rows.length,
    total: Math.round(total * 100) / 100,
    categories: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    rows: rows.slice(-30).map((row) => ({
      id: text(row.id, 100),
      title: text(row.title, 160),
      amount: num(row.amount),
      category: text(row.category, 80),
      date: dateOnly(row.date),
      notes: text(row.notes, 300)
    }))
  };
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (typeof value === "string") return text(value, 1200);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 150).map((v) => sanitize(v, depth + 1)).filter((v) => v !== undefined);
  if (isRecord(value)) {
    const out: AnyRecord = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE.test(key)) continue;
      const clean = sanitize(child, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

function monthKey(value: unknown): string | null {
  const raw = text(value, 32);
  const match = raw.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : null;
}

export function buildSmartTimeData(rawContext: unknown, message: string): Record<string, unknown> {
  const context = sanitize(rawContext);
  if (!isRecord(context)) throw new Error("بيانات SMART TIME غير صالحة.");

  const period = resolvePeriod(message);
  const expenses = asArray(context.expenses);
  const income = asArray(context.monthlyIncome);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);
  const thisMonthExpenses = expenses.filter((row) => inPeriod(row.date, thisMonthStart, now));
  const lastMonthExpenses = expenses.filter((row) => inPeriod(row.date, lastMonthStart, lastMonthEnd));
  const thisMonthKey = now.toISOString().slice(0, 7);
  const lastMonthKey = lastMonthStart.toISOString().slice(0, 7);
  const incomeForMonth = (key: string) => Math.round(income.reduce((sum, row) => {
    if (monthKey(row.month) !== key) return sum;
    return sum + num(row.salary) + num(row.bonuses) + num(row.otherIncome);
  }, 0) * 100) / 100;
  const fuel = asArray(context.fuelRecords);
  const education = asArray(context.educationExpenses);
  const vehicles = asArray(context.vehicles);
  const students = asArray(context.students);
  const tasks = asArray(context.dailyTasks);
  const notes = asArray(context.notes);
  const trips = asArray(context.recentTrips);

  const scopedExpenses = period ? expenses.filter((row) => inPeriod(row.date, period.from, period.to)) : expenses;
  const scopedFuel = period ? fuel.filter((row) => inPeriod(row.date, period.from, period.to)) : fuel;
  const scopedEducation = period ? education.filter((row) => inPeriod(row.date, period.from, period.to)) : education;

  const profile = isRecord(context.profile) ? {
    name: text(context.profile.name, 120),
    currency: text(context.profile.currency, 20) || "EGP",
    language: text(context.profile.language, 10) || "ar"
  } : { name: "", currency: "EGP", language: "ar" };

  return {
    profile,
    period: period ? { key: period.key, from: period.from.toISOString().slice(0, 10), to: period.to.toISOString().slice(0, 10) } : null,
    expenses: summarizeExpenseRows(scopedExpenses),
    fuel: {
      count: scopedFuel.length,
      totalCost: Math.round(scopedFuel.reduce((s, x) => s + num(x.totalCost), 0) * 100) / 100,
      liters: Math.round(scopedFuel.reduce((s, x) => s + num(x.liters), 0) * 100) / 100
    },
    education: {
      count: scopedEducation.length,
      total: Math.round(scopedEducation.reduce((s, x) => s + num(x.amount), 0) * 100) / 100
    },
    comparisons: {
      thisMonth: summarizeExpenseRows(thisMonthExpenses),
      lastMonth: summarizeExpenseRows(lastMonthExpenses),
      thisMonthIncome: incomeForMonth(thisMonthKey),
      lastMonthIncome: incomeForMonth(lastMonthKey)
    },
    income: income.slice(-12).map((x) => ({
      month: text(x.month, 20),
      salary: num(x.salary),
      bonuses: num(x.bonuses),
      otherIncome: num(x.otherIncome)
    })),
    counts: {
      vehicles: vehicles.length,
      students: students.length,
      tasks: tasks.length,
      notes: notes.length,
      trips: trips.length
    }
  };
}

export type SmartTimeData = ReturnType<typeof buildSmartTimeData>;
