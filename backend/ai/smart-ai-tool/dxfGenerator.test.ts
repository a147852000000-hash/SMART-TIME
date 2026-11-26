import { buildDxf, dxfFromNaturalLanguage } from "./dxfGenerator.js";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

// 1) Structured description -> valid DXF R12
const result = buildDxf({
  title: "غرفة اختبار",
  units: "m",
  entities: [
    { type: "rectangle", x: 0, y: 0, width: 40, height: 50, layer: "WALLS" },
    { type: "circle", cx: 20, cy: 25, r: 8, layer: "CIRCLE" },
    { type: "arc", cx: 20, cy: 25, r: 12, startAngleDeg: 0, endAngleDeg: 180, layer: "ARC" },
    { type: "polyline", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false, layer: "PATH" },
    { type: "text", x: 5, y: 5, height: 2.5, text: "SMART TIME DXF", layer: "TEXT" },
  ],
});
assert(result.ok === true, "dxf build ok");
assert(result.entityCount >= 6, "rectangle expands to 4 lines + others");
const dxf = Buffer.from(result.data, "base64").toString("utf8");
assert(dxf.includes("AC1009"), "DXF version marker AC1009 (R12)");
assert(dxf.includes("SECTION") && dxf.includes("ENTITIES") && dxf.includes("ENDSEC") && dxf.endsWith("EOF\r\n") === false || dxf.includes("EOF"), "DXF sections present");
for (const entity of ["LINE", "CIRCLE", "ARC", "POLYLINE", "VERTEX", "SEQEND", "TEXT"]) {
  assert(dxf.includes(entity), `entity ${entity} present`);
}
assert(!dxf.includes("NaN") && !dxf.includes("undefined"), "no invalid numbers in DXF");

// 2) Empty entities -> honest refusal, no fake file
const empty = buildDxf({ entities: [] });
assert(empty.ok === false && empty.data === "", "empty description refused");

// 3) Deterministic natural-language fallback
const room = dxfFromNaturalLanguage("مخطط غرفة 4 في 5 متر", "ar");
assert(room.ok === true, "room fallback ok");
const roomText = Buffer.from(room.data, "base64").toString("utf8");
assert(roomText.includes("WALLS") && roomText.includes("DOOR"), "room walls + door layer");
const circle = dxfFromNaturalLanguage("دائرة نصف قطرها 30", "ar");
const circleText = Buffer.from(circle.data, "base64").toString("utf8");
assert(circleText.includes("CIRCLE"), "circle fallback");

console.log("DXF GENERATOR tests passed");
