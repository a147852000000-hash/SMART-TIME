import type { Request, Response } from "express";
import { getFinanceOverview } from "./financeProjection.js";
import { importExpensesForUser } from "./expenseMigration.js";

function authUser(req: Request): { id: string } | null {
  const candidate = (req as any).user;
  if (!candidate?.id) return null;
  return { id: String(candidate.id) };
}

/** Route handler factory: the host server supplies its authenticated req.user. */
export function createExpenseImportHandler() {
  return (req: Request, res: Response) => {
    const user = authUser(req);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول." });
    try {
      const expenses = Array.isArray(req.body?.expenses) ? req.body.expenses : [];
      const results = importExpensesForUser(user.id, expenses);
      const conflicts = results.filter((item) => item.status === "conflict");
      if (conflicts.length) return res.status(409).json({ results, conflicts: conflicts.length });
      const importedIds = results.filter((item) => item.status === "inserted").map((item) => item.id);
      const overview = getFinanceOverview(user.id);
      const verifiedIds = new Set(overview.expenses.map((item) => String((item as any).id ?? "")));
      const verified = importedIds.filter((id) => verifiedIds.has(id));
      return res.json({
        source: "smart-time-finance-sqlite",
        imported: importedIds.length,
        skipped: results.filter((item) => item.status === "skipped").length,
        verified: verified.length,
        verificationPassed: verified.length === importedIds.length,
        results,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "تعذر استيراد المصروفات." });
    }
  };
}