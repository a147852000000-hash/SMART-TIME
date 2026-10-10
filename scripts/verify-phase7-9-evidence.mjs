import fs from "node:fs";
const checks=[["docs/phase7_closure_record.json","FORMALLY_CLOSED_HISTORICAL_DIAGNOSTIC_BASELINE"],["docs/phase8_closure_record.json","FORMALLY_CLOSED_HISTORICAL_ARCHIVE"],["docs/phase9_closure_record.json","FORMALLY_CLOSED_DIAGNOSTICALLY"]];
for(const [p,s] of checks){if(!fs.existsSync(p))throw new Error("missing "+p);const o=JSON.parse(fs.readFileSync(p,"utf8"));if(o.status!==s)throw new Error(p+" status drift");if(o.release_gate!=="NOT_RELEASED")throw new Error(p+" release drift");if(o.owner_signoff?.status!=="APPROVED_BY_OWNER_DELEGATED_AUTHORIZATION")throw new Error(p+" owner signoff drift");}
const p9=JSON.parse(fs.readFileSync("docs/phase9_closure_record.json","utf8"));
if(p9.evidence.run3_generation_gate.passed!==0||p9.evidence.run3_generation_gate.total!==120)throw new Error("Run3 drift");
if(p9.evidence.corrective_run.passed!==119||p9.evidence.corrective_run.total!==120)throw new Error("Fix1 drift");
if(p9.evidence.unsupported_gate.passed!==14||p9.evidence.unsupported_gate.total!==32)throw new Error("unsupported drift");
console.log("PHASE 7-9 EVIDENCE CONSISTENCY: PASS");
