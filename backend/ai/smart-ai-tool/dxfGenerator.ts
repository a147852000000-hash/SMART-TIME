// ============================================================
// SMART TIME — CAD DXF GENERATOR (agent tool: generate_dxf)
// Turns a structured drawing description into a valid DXF R12
// ASCII file (AC1009) that opens in AutoCAD, LibreCAD, DraftSight,
// ezdxf and most free viewers. Zero-cost: pure text generation.
// The "dedicated model" produces the entity list; this module is
// the deterministic builder — it never invents geometry.
// ============================================================

export interface DxfLine { type: "line"; x1: number; y1: number; x2: number; y2: number; layer?: string; }
export interface DxfCircle { type: "circle"; cx: number; cy: number; r: number; layer?: string; }
export interface DxfArc { type: "arc"; cx: number; cy: number; r: number; startAngleDeg: number; endAngleDeg: number; layer?: string; }
export interface DxfRectangle { type: "rectangle"; x: number; y: number; width: number; height: number; layer?: string; }
export interface DxfPolyline { type: "polyline"; points: Array<{ x: number; y: number }>; closed?: boolean; layer?: string; }
export interface DxfText { type: "text"; x: number; y: number; height: number; text: string; layer?: string; }

export type DxfEntity = DxfLine | DxfCircle | DxfArc | DxfRectangle | DxfPolyline | DxfText;

export interface DxfDrawingDescription {
  title?: string;
  units?: "mm" | "cm" | "m";
  entities: DxfEntity[];
}

export interface DxfGenerationResult {
  ok: boolean;
  type: "dxf";
  filename: string;
  data: string; // base64
  entityCount: number;
  message: string;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
};

const esc = (value: string) => String(value).replace(/[\r\n]+/g, " ").slice(0, 250);

class DxfWriter {
  private chunks: string[] = [];
  pair(code: number, value: string | number) {
    this.chunks.push(String(code), String(value));
  }
  entity(entity: DxfEntity) {
    switch (entity.type) {
      case "line": {
        this.pair(0, "LINE"); this.pair(8, esc(entity.layer || "0"));
        this.pair(10, num(entity.x1)); this.pair(20, num(entity.y1)); this.pair(30, 0);
        this.pair(11, num(entity.x2)); this.pair(21, num(entity.y2)); this.pair(31, 0);
        break;
      }
      case "circle": {
        this.pair(0, "CIRCLE"); this.pair(8, esc(entity.layer || "0"));
        this.pair(10, num(entity.cx)); this.pair(20, num(entity.cy)); this.pair(30, 0);
        this.pair(40, Math.abs(num(entity.r)));
        break;
      }
      case "arc": {
        this.pair(0, "ARC"); this.pair(8, esc(entity.layer || "0"));
        this.pair(10, num(entity.cx)); this.pair(20, num(entity.cy)); this.pair(30, 0);
        this.pair(40, Math.abs(num(entity.r)));
        this.pair(50, num(entity.startAngleDeg)); this.pair(51, num(entity.endAngleDeg));
        break;
      }
      case "rectangle": {
        const w = Math.abs(num(entity.width)); const h = Math.abs(num(entity.height));
        const x2 = num(entity.x) + w; const y2 = num(entity.y) + h;
        const corners: Array<[number, number, number, number]> = [
          [num(entity.x), num(entity.y), x2, num(entity.y)],
          [x2, num(entity.y), x2, y2],
          [x2, y2, num(entity.x), y2],
          [num(entity.x), y2, num(entity.x), num(entity.y)],
        ];
        for (const [x1, y1, lx2, ly2] of corners) {
          this.pair(0, "LINE"); this.pair(8, esc(entity.layer || "0"));
          this.pair(10, x1); this.pair(20, y1); this.pair(30, 0);
          this.pair(11, lx2); this.pair(21, ly2); this.pair(31, 0);
        }
        break;
      }
      case "polyline": {
        const pts = Array.isArray(entity.points) ? entity.points.slice(0, 200) : [];
        if (pts.length < 2) break;
        this.pair(0, "POLYLINE"); this.pair(8, esc(entity.layer || "0"));
        this.pair(66, 1); this.pair(70, entity.closed ? 1 : 0);
        for (const p of pts) {
          this.pair(0, "VERTEX"); this.pair(8, esc(entity.layer || "0"));
          this.pair(10, num(p.x)); this.pair(20, num(p.y)); this.pair(30, 0);
        }
        this.pair(0, "SEQEND"); this.pair(8, esc(entity.layer || "0"));
        break;
      }
      case "text": {
        this.pair(0, "TEXT"); this.pair(8, esc(entity.layer || "0"));
        this.pair(10, num(entity.x)); this.pair(20, num(entity.y)); this.pair(30, 0);
        this.pair(40, Math.max(0.1, num(entity.height) || 2.5));
        this.pair(1, esc(entity.text || ""));
        break;
      }
    }
  }
  build(): string {
    const out: string[] = [];
    out.push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC");
    out.push("0", "SECTION", "2", "ENTITIES");
    out.push(...this.chunks);
    out.push("0", "ENDSEC", "0", "EOF");
    return out.join("\r\n") + "\r\n";
  }
}

export function buildDxf(description: DxfDrawingDescription): DxfGenerationResult {
  const entities = Array.isArray(description?.entities) ? description.entities : [];
  if (entities.length === 0) {
    return { ok: false, type: "dxf", filename: "smart-time-plan.dxf", data: "", entityCount: 0, message: "لا توجد عناصر رسم في الوصف — أرسل قائمة وحدات (خطوط/دوائر/مستطيلات) وأبنيها كما هي." };
  }
  const writer = new DxfWriter();
  let count = 0;
  for (const entity of entities) {
    if (!entity || typeof entity !== "object") continue;
    writer.entity(entity);
    count += entity.type === "rectangle" ? 4 : entity.type === "polyline" ? 1 : 1;
  }
  if (description?.title) {
    writer.entity({ type: "text", x: 0, y: -8, height: 5, text: `SMART TIME - ${esc(description.title)}` });
    count += 1;
  }
  const dxf = writer.build();
  return {
    ok: true,
    type: "dxf",
    filename: `smart-time-${Date.now()}.dxf`,
    data: Buffer.from(dxf, "utf8").toString("base64"),
    entityCount: count,
    message: `تم توليد ملف DXF صالح (${count} عنصر) يفتح في AutoCAD وبرامج CAD المجانية.`,
  };
}

// Deterministic fallback: simple keyword parsing from natural language.
// The production path is the model producing DxfDrawingDescription via
// structured output; this keeps the tool usable without any API key.
export function dxfFromNaturalLanguage(goal: string, language: "ar" | "en" = "ar"): DxfGenerationResult {
  const text = String(goal || "").toLowerCase();
  const nums = (String(goal || "").match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
  const entities: DxfEntity[] = [];
  const isRoom = /غرفة|أودروم|اوضة|صالة|room|hall|apartment|شقة|مسطح|flat/.test(text);
  const wantsCircle = /دائرة|حلقة|قرص|circle|column|عمود/.test(text);

  if (isRoom && nums.length >= 2) {
    const [w, h] = nums;
    entities.push({ type: "rectangle", x: 0, y: 0, width: w, height: h, layer: "WALLS" });
    entities.push({ type: "text", x: w / 10, y: h / 2, height: Math.max(w, h) / 20, text: `${w} x ${h}` });
    const doorW = Math.min(0.9, w / 3);
    entities.push({ type: "line", x1: w - doorW, y1: 0, x2: w, y2: 0, layer: "DOOR" });
  } else if (wantsCircle && nums.length >= 1) {
    const r = nums[0];
    entities.push({ type: "circle", cx: r, cy: r, r, layer: "CIRCLE" });
    entities.push({ type: "line", x1: 0, y1: r, x2: 2 * r, y2: r, layer: "CENTER" });
    entities.push({ type: "line", x1: r, y1: 0, x2: r, y2: 2 * r, layer: "CENTER" });
  } else if (nums.length >= 2) {
    const [w, h] = nums;
    entities.push({ type: "rectangle", x: 0, y: 0, width: w, height: h, layer: "OUTLINE" });
  } else if (nums.length === 1) {
    const s = nums[0];
    entities.push({ type: "rectangle", x: 0, y: 0, width: s, height: s, layer: "OUTLINE" });
  } else {
    entities.push({ type: "rectangle", x: 0, y: 0, width: 100, height: 60, layer: "OUTLINE" });
    entities.push({ type: "text", x: 10, y: 30, height: 8, text: language === "ar" ? "مخطط افتراضي — حدد المقاسات" : "Default outline - specify dimensions" });
  }
  return buildDxf({ title: goal.slice(0, 60), units: "mm", entities });
}
