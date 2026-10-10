import { getCanonicalSmartAiContext } from "../canonicalData.js";
import { web_search } from "./webSearch.js";
import { detectProblemType, empathicResponse, type ProblemType } from "./empathyEngine.js";

export interface ProblemSolution { analysis: string; steps: string[]; plan: string[]; estimatedSaving: number; type: ProblemType; }

export async function solveProblem(userId: string, problem: string): Promise<ProblemSolution> {
  const type = detectProblemType(problem);
  const empathy = empathicResponse(type, problem);
  const data = getCanonicalSmartAiContext(userId);
  const expenses = Array.isArray(data.expenses) ? data.expenses.filter((x: any) => x && typeof x === "object") as any[] : [];
  const total = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  let tips: string[] = [];
  if (type === "economic") {
    const results = await web_search("نصائح توفير وإدارة الميزانية الشخصية مصر", "ar");
    tips = results.slice(0, 3).map(r => `${r.title}: ${r.snippet}`);
  }
  const estimatedSaving = type === "economic" ? Math.round(total * 0.1 * 100) / 100 : 0;
  return {
    type,
    analysis: `${empathy.empathy} إجمالي المصروفات المتاحة في البيانات المعيارية: ${Math.round(total * 100) / 100}.`,
    steps: [...empathy.questions, "حدد خطوة واحدة قابلة للتنفيذ اليوم.", "راجع النتيجة بعد أسبوع بدل تغيير كل شيء مرة واحدة."],
    plan: type === "economic" ? ["تحديد البنود الأعلى", "خفض 10% من بند قابل للتعديل", ...tips] : ["تحديد المشكلة", "اختيار خطوة صغيرة", "مراجعة النتيجة"],
    estimatedSaving
  };
}

export const solve_emotional = (userId: string, problem: string) => solveProblem(userId, problem);
export const solve_social = (userId: string, problem: string) => solveProblem(userId, problem);
export const solve_economic = (userId: string, problem: string) => solveProblem(userId, problem);
