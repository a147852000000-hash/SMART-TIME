export interface ArtifactResult { ok: boolean; type: string; filename?: string; data?: string; message: string; }

async function optionalImport(name: string): Promise<any | null> { try { return await import(name); } catch { return null; } }

export async function generate_excel_report(data: unknown, filename = "smart-time-report.xlsx"): Promise<ArtifactResult> {
  const mod = await optionalImport("exceljs");
  if (!mod) return { ok: false, type: "excel", message: "Excel غير متاح حاليًا. ثبّت exceljs كـ optional dependency ثم أعد المحاولة." };
  const workbook = new mod.Workbook(); const sheet = workbook.addWorksheet("SMART TIME");
  const rows = Array.isArray(data) ? data : [data];
  rows.forEach((row: any, i) => sheet.addRow(typeof row === "object" && row ? Object.values(row) : [row]));
  const buffer = await workbook.xlsx.writeBuffer();
  return { ok: true, type: "excel", filename, data: Buffer.from(buffer).toString("base64"), message: "تم إنشاء تقرير Excel." };
}

export async function generate_word_report(data: unknown): Promise<ArtifactResult> {
  const mod = await optionalImport("docx");
  if (!mod) return { ok: false, type: "word", message: "Word غير متاح حاليًا. ثبّت docx كـ optional dependency ثم أعد المحاولة." };
  const text = JSON.stringify(data, null, 2);
  const doc = new mod.Document({ sections: [{ children: [new mod.Paragraph({ text })] }] });
  const buffer = await mod.Packer.toBuffer(doc);
  return { ok: true, type: "word", filename: "smart-time-report.docx", data: Buffer.from(buffer).toString("base64"), message: "تم إنشاء تقرير Word." };
}

export async function generate_pdf_report(data: unknown): Promise<ArtifactResult> {
  const mod = await optionalImport("pdf-lib");
  if (!mod) return { ok: false, type: "pdf", message: "PDF غير متاح حاليًا. ثبّت pdf-lib كـ optional dependency ثم أعد المحاولة." };
  const pdf = await mod.PDFDocument.create(); const page = pdf.addPage();
  page.drawText(JSON.stringify(data, null, 2).slice(0, 3000), { x: 30, y: page.getHeight() - 40, size: 8 });
  const bytes = await pdf.save();
  return { ok: true, type: "pdf", filename: "smart-time-report.pdf", data: Buffer.from(bytes).toString("base64"), message: "تم إنشاء تقرير PDF." };
}

export function generate_chart(data: unknown): ArtifactResult {
  const rows = Array.isArray(data) ? data : [];
  const values = rows.slice(0, 12).map((r: any) => Number(r?.amount ?? r?.value ?? 0));
  const max = Math.max(1, ...values);
  const bars = values.map((v, i) => `<rect x="${i * 42 + 10}" y="${120 - (v / max) * 100}" width="28" height="{(v / max) * 100}"/><text x="${i * 42 + 20}" y="140" font-size="8">${i + 1}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="160"><line x1="0" y1="120" x2="520" y2="120" stroke="black"/>${bars}</svg>`;  return { ok: true, type: "chart", data: Buffer.from(svg).toString("base64"), filename: "smart-time-chart.svg", message: "تم إنشاء متانا SVG." };
}

export function draw_plan(prompt: string): ArtifactResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect x="20" y="20" width="560" height="360" fill="none" stroke="black"/><text x="30" y="50" font-size="18">SMART TIME PLAN</text><text x="30" y="80" font-size="12">${String(prompt).slice(0, 180).replace(/[<&>]/g, "")}</text></svg>`;
  return { ok: true, type: "drawing", data: Buffer.from(svg).toString("base64"), filename: "smart-time-plan.svg", message: "تم إنشاع واحدة." };
}
