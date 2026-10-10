#!/usr/bin/env node
import fs from "node:fs";
const file=process.argv[2]||"infra/smart-ai/training/eval-v4g-predictions.jsonl";
const rows=fs.readFileSync(file,"utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
let passed=0; const failures=[];
const FORBIDDEN_TOOLS=new Set(["smart_time","none","delete_last_expense","search","set_reminder","analyze_budget_file"]);
for(const row of rows){
  const p=row.prediction,e=row.expected;
  const checks=[
    ["valid_json",!row.parse_error&&p&&typeof p==="object"],
    ["canonical_tool",!p?.tool || !FORBIDDEN_TOOLS.has(p.tool)],
    ["intent",p?.intent===e.intent],
    ["tool",(p?.tool??null)===(e.tool??null)],
    ["confirmation",p?.requiresConfirmation===e.requiresConfirmation],
    ["required_arguments",(e.requiredArguments||[]).every(k=>p?.arguments&&Object.prototype.hasOwnProperty.call(p.arguments,k))]
  ];
  if(checks.every(([,v])=>v)) passed++; else failures.push({case_id:row.case_id,failed:checks.filter(([,v])=>!v).map(([n])=>n),raw:row.raw});
}
const total=rows.length,rate=total?passed/total:0;
console.log(JSON.stringify({gate:"4G",passed,total,pass_rate:rate,failures},null,2));
if(total===0||rate<0.8) process.exit(1);
