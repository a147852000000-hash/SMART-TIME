import { parseV2StructuredOutput } from "./v2StructuredOutput.js";

const valid = [
  JSON.stringify({tool:"add_expense",arguments:{amount:100,category:"منظفات",title:"منظفات"},needs_clarification:false}),
  JSON.stringify({tool:"add_daily_task",arguments:{title:"ادفع النت",when:"بكرة"},needs_clarification:false}),
  JSON.stringify({tool:"calendar.event.create",arguments:{title:"دكتور",when:"الجمعة 5 مساء"},needs_clarification:false}),
  JSON.stringify({tool:"finance.summary",arguments:{period:"الشهر ده"},needs_clarification:false}),
  JSON.stringify({tool:"finance.compare",arguments:{period:"الشهر ده"},needs_clarification:false}),
  JSON.stringify({tool:"finance.income.summary",arguments:{period:"الأسبوع ده"},needs_clarification:false}),
  JSON.stringify({tool:"finance.fuel.summary",arguments:{period:"الشهر اللي فات"},needs_clarification:false}),
  JSON.stringify({tool:"clarification",ask:"محتاج أعرف المبلغ كام؟",reason:"missing_amount"}),
  JSON.stringify({tool:"unsupported",reason:"secret_request"}),
];

const invalid = [
  "",
  "إذا كنت ترغب في تقليل مصاريفك...",
  "<think>reasoning</think>{\"tool\":\"add_expense\",\"arguments\":{\"amount\":100,\"category\":\"بنزين\"},\"needs_clarification\":false}",
  "{\"tool\":\"unknown.tool\",\"arguments\":{},\"needs_clarification\":false}",
  "{\"tool\":\"add_expense\",\"arguments\":{},\"needs_clarification\":false}",
  "{\"tool\":\"add_expense\",\"arguments\":{\"amount\":0,\"category\":\"بنزين\"},\"needs_clarification\":false}",
  "{\"tool\":\"add_expense\",\"arguments\":{\"amount\":100},\"needs_clarification\":false}",
  "{\"tool\":\"add_daily_task\",\"arguments\":{\"title\":\"ادفع النت\"},\"needs_clarification\":false}",
  "{\"tool\":\"calendar.event.create\",\"arguments\":{\"when\":\"بكرة\"},\"needs_clarification\":false}",
  "{\"tool\":\"finance.summary\",\"arguments\":{},\"needs_clarification\":false}",
  "{\"tool\":\"unsupported\"}",
  "{\"tool\":\"clarification\",\"reason\":\"missing_amount\"}",
  "{\"tool\":\"add_expense\",\"arguments\":{\"amount\":100,\"category\":\"بنزين\"},\"needs_clarification\":true}",
];

let passed = 0;
for (const sample of valid) {
  parseV2StructuredOutput(sample);
  passed++;
}
for (const sample of invalid) {
  let failed = false;
  try { parseV2StructuredOutput(sample); } catch { failed = true; }
  if (!failed) throw new Error("Expected invalid sample to fail: " + sample);
  passed++;
}

// 120 deterministic shape cases: 60 valid finance calls + 60 valid reminder calls.
for (let i = 1; i <= 60; i++) {
  const finance = JSON.stringify({
    tool:"add_expense",
    arguments:{amount:i * 10, category:"منظفات", title:"منظفات"},
    needs_clarification:false
  });
  const reminder = JSON.stringify({
    tool:"add_daily_task",
    arguments:{title:"ادفع النت", when:"بكرة " + i},
    needs_clarification:false
  });
  parseV2StructuredOutput(finance);
  parseV2StructuredOutput(reminder);
  passed += 2;
}

if (passed < 120) throw new Error("V2 gate executed fewer than 120 cases.");
console.log("V2 structured-output tests passed:", passed);
